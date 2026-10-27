import { randomBytes, randomUUID, scrypt as scryptCallback, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getBuilderPriceUsdCents } from './builder-plans.js';

const scrypt = promisify(scryptCallback);
const EMPTY = { users: [], sessions: [], projects: [], subscriptions: [], creditLedger: [] };

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deriveEncryptionKey(secret) {
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('BUILDER_ENCRYPTION_KEY must be set to a random secret of at least 32 bytes.');
  }
  return createHash('sha256').update(secret).digest();
}

export function createPersistence({ filePath = process.env.BUILDER_DATA_FILE || './data/builder-store.json', encryptionKey = process.env.BUILDER_ENCRYPTION_KEY } = {}) {
  let queue = Promise.resolve();
  const key = encryptionKey ? deriveEncryptionKey(encryptionKey) : null;

  async function readState() {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
        creditLedger: Array.isArray(parsed.creditLedger) ? parsed.creditLedger : []
      };
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(EMPTY);
      throw error;
    }
  }

  async function transact(mutator) {
    const run = queue.then(async () => {
      const state = await readState();
      const result = await mutator(state);
      await mkdir(dirname(filePath), { recursive: true });
      const temp = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, filePath);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  async function view(reader) {
    await queue;
    return reader(await readState());
  }

  function encryptSecret(value) {
    if (!key) throw new Error('Core-key storage is not configured. Set BUILDER_ENCRYPTION_KEY before connecting a Core key.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  }

  function decryptSecret(encrypted) {
    if (!key) throw new Error('Core-key storage is not configured.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }

  async function createUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    return transact((state) => {
      if (state.users.some((user) => user.email === normalizedEmail)) {
        const error = new Error('An account with this email already exists.');
        error.code = 'EMAIL_EXISTS';
        throw error;
      }
      const user = {
        id: randomUUID(),
        email: normalizedEmail,
        passwordSalt: salt,
        passwordHash: Buffer.from(derived).toString('hex'),
        createdAt: new Date().toISOString(),
        coreKey: null
      };
      state.users.push(user);
      return { id: user.id, email: user.email, createdAt: user.createdAt };
    });
  }

  async function verifyUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await view((state) => state.users.find((item) => item.email === normalizedEmail) || null);
    if (!user) return null;
    const derived = Buffer.from(await scrypt(password, user.passwordSalt, 64));
    const expected = Buffer.from(user.passwordHash, 'hex');
    if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) return null;
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    await transact((state) => {
      state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > Date.now());
      state.sessions.push({ tokenHash: hash(token), userId, expiresAt });
    });
    return { token, expiresAt };
  }

  async function getUserForSession(token) {
    if (!token) return null;
    return view((state) => {
      const session = state.sessions.find((item) => item.tokenHash === hash(token) && Date.parse(item.expiresAt) > Date.now());
      const user = session && state.users.find((item) => item.id === session.userId);
      return user ? { id: user.id, email: user.email, createdAt: user.createdAt } : null;
    });
  }

  async function deleteSession(token) {
    if (!token) return;
    await transact((state) => { state.sessions = state.sessions.filter((session) => session.tokenHash !== hash(token)); });
  }

  async function connectCoreKey(userId, apiKey) {
    const encrypted = encryptSecret(apiKey);
    await transact((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user) throw new Error('Account not found.');
      user.coreKey = encrypted;
      user.coreKeyConnectedAt = new Date().toISOString();
    });
  }

  async function getCoreKey(userId) {
    return view((state) => {
      const user = state.users.find((item) => item.id === userId);
      return user?.coreKey ? decryptSecret(user.coreKey) : null;
    });
  }

  async function disconnectCoreKey(userId) {
    await transact((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (user) { user.coreKey = null; user.coreKeyConnectedAt = null; }
    });
  }

  async function coreConnectionStatus(userId) {
    return view((state) => {
      const user = state.users.find((item) => item.id === userId);
      return { connected: Boolean(user?.coreKey), connectedAt: user?.coreKeyConnectedAt || null };
    });
  }

  async function listProjects(userId) {
    return view((state) => state.projects
      .filter((project) => project.userId === userId)
      .map(({ id, name, description, createdAt, updatedAt, files }) => ({
        id, name, description, createdAt, updatedAt, fileCount: files.length
      })));
  }

  async function createProject(userId, { name, description = '' }) {
    return transact((state) => {
      const now = new Date().toISOString();
      const project = { id: randomUUID(), userId, name: name.trim(), description: description.trim(), files: [], createdAt: now, updatedAt: now };
      state.projects.push(project);
      return { ...project, fileCount: 0 };
    });
  }

  async function getProject(userId, projectId) {
    return view((state) => {
      const project = state.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      return structuredClone(project);
    });
  }

  async function updateProject(userId, projectId, patch) {
    return transact((state) => {
      const project = state.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      if (typeof patch.name === 'string') project.name = patch.name.trim();
      if (typeof patch.description === 'string') project.description = patch.description.trim();
      project.updatedAt = new Date().toISOString();
      return { ...project, fileCount: project.files.length };
    });
  }

  async function deleteProject(userId, projectId) {
    return transact((state) => {
      const index = state.projects.findIndex((item) => item.id === projectId && item.userId === userId);
      if (index < 0) return false;
      state.projects.splice(index, 1);
      return true;
    });
  }

  async function putFiles(userId, projectId, files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new TypeError('At least one project file is required.');
    }
    const seen = new Set();
    for (const file of files) {
      if (!file || typeof file.path !== 'string' || !file.path || typeof file.content !== 'string' || seen.has(file.path)) {
        throw new TypeError('Project files must have unique paths and string contents.');
      }
      seen.add(file.path);
    }

    return transact((state) => {
      const project = state.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      const saved = [];
      for (const file of files) {
        const normalizedPath = file.path.replace(/^\/+/, '');
        const existing = project.files.find((item) => item.path === normalizedPath);
        const now = new Date().toISOString();
        if (existing) {
          existing.content = file.content;
          existing.updatedAt = now;
          saved.push(structuredClone(existing));
        } else {
          const created = { path: normalizedPath, content: file.content, updatedAt: now };
          project.files.push(created);
          saved.push(structuredClone(created));
        }
      }
      project.updatedAt = new Date().toISOString();
      return saved;
    });
  }

  async function putFile(userId, projectId, file) {
    const saved = await putFiles(userId, projectId, [file]);
    return saved ? saved[0] : null;
  }

  async function deleteFile(userId, projectId, path) {
    return transact((state) => {
      const project = state.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      const index = project.files.findIndex((file) => file.path === path);
      if (index < 0) return false;
      project.files.splice(index, 1);
      project.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async function recordSubscription({ userId, plan, billingInterval, status, periodStart, periodEnd, cancelAtPeriodEnd = false, provider = null, providerCustomerId = null, providerSubscriptionId = null }) {
    const priceUsdCents = getBuilderPriceUsdCents(plan, billingInterval);
    if (priceUsdCents === null) throw new TypeError('Invalid Builder plan or billing interval.');
    if (!['incomplete', 'active', 'past_due', 'canceled', 'expired'].includes(status)) throw new TypeError('Invalid subscription status.');
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new TypeError('Invalid subscription period.');
    return transact((state) => {
      if (!state.users.some((user) => user.id === userId)) throw new Error('Account not found.');
      const subscription = {
        id: randomUUID(), userId, plan, billingInterval, status, priceUsdCents,
        currency: 'USD', periodStart: start.toISOString(), periodEnd: end.toISOString(),
        cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd), canceledAt: status === 'canceled' ? new Date().toISOString() : null,
        provider, providerCustomerId, providerSubscriptionId, createdAt: new Date().toISOString()
      };
      state.subscriptions.push(subscription);
      return structuredClone(subscription);
    });
  }

  async function getBillingState(userId) {
    return view((state) => {
      const now = Date.now();
      const candidates = state.subscriptions
        .filter((item) => item.userId === userId && ['active', 'past_due', 'canceled'].includes(item.status) && Date.parse(item.periodEnd) > now)
        .sort((a, b) => {
          const priority = { active: 0, past_due: 1, canceled: 2 };
          return priority[a.status] - priority[b.status] || Date.parse(b.periodEnd) - Date.parse(a.periodEnd);
        });
      const subscription = candidates[0];
      const ledger = state.creditLedger.filter((item) => item.userId === userId);
      const latest = ledger.reduce((best, item) => !best || item.sequence > best.sequence ? item : best, null);
      return {
        subscription: subscription ? {
          plan: subscription.plan,
          billingInterval: subscription.billingInterval,
          status: subscription.status,
          priceUsdCents: subscription.priceUsdCents,
          currency: subscription.currency || 'USD',
          periodStart: subscription.periodStart,
          periodEnd: subscription.periodEnd,
          cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd)
        } : {
          plan: 'free', billingInterval: 'monthly', status: 'active',
          priceUsdCents: 0, currency: 'USD', periodStart: null, periodEnd: null,
          cancelAtPeriodEnd: false
        },
        creditsBalance: latest?.balanceAfter ?? 0
      };
    });
  }

  async function changeCredits({ userId, amount, idempotencyKey, eventType, reason, projectId = null, jobId = null, periodStart = null, periodEnd = null, metadata = {} }) {
    if (!Number.isSafeInteger(amount) || amount === 0 || typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) {
      throw new TypeError('A non-zero integer credit amount and valid idempotency key are required.');
    }
    if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('A credit ledger reason is required.');
    if (!['grant', 'reserve', 'charge', 'refund', 'expire', 'adjustment'].includes(eventType)) throw new TypeError('Invalid credit ledger event type.');
    return transact((state) => {
      if (!state.users.some((user) => user.id === userId)) throw new Error('Account not found.');
      const existing = state.creditLedger.find((item) => item.userId === userId && item.idempotencyKey === idempotencyKey);
      if (existing) return { balance: existing.balanceAfter, duplicate: true };
      const userLedger = state.creditLedger.filter((item) => item.userId === userId);
      const current = userLedger.reduce((best, item) => !best || item.sequence > best.sequence ? item : best, null);
      const balance = (current?.balanceAfter ?? 0) + amount;
      if (balance < 0) {
        const error = new Error('Insufficient Builder credits.');
        error.code = 'INSUFFICIENT_CREDITS';
        throw error;
      }
      state.creditLedger.push({
        sequence: state.creditLedger.reduce((max, item) => Math.max(max, item.sequence || 0), 0) + 1,
        userId, delta: amount, balanceAfter: balance, eventType, idempotencyKey,
        periodStart, periodEnd, projectId, jobId, reason: reason.trim(), metadata,
        createdAt: new Date().toISOString()
      });
      return { balance, duplicate: false };
    });
  }

  async function grantCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Granted credits must be a positive integer.');
    return changeCredits({ ...options, eventType: 'grant' });
  }

  async function consumeCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Consumed credits must be a positive integer.');
    return changeCredits({ ...options, amount: -options.amount, eventType: 'charge' });
  }

  return { createUser, verifyUser, createSession, getUserForSession, deleteSession, connectCoreKey, getCoreKey, disconnectCoreKey, coreConnectionStatus, listProjects, createProject, getProject, updateProject, deleteProject, putFile, putFiles, deleteFile, getBillingState, recordSubscription, grantCredits, consumeCredits };
}
