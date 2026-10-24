import { randomBytes, randomUUID, scrypt as scryptCallback, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const scrypt = promisify(scryptCallback);
const EMPTY = { users: [], sessions: [], projects: [] };

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
        projects: Array.isArray(parsed.projects) ? parsed.projects : []
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
    if (!Array.isArray(files) || files.length < 1) throw new Error('At least one generated file is required.');
    return transact((state) => {
      const project = state.projects.find((item) => item.id === projectId && item.userId === userId);
      if (!project) return null;
      const now = new Date().toISOString();
      const saved = files.map(({ path, content }) => {
        const normalizedPath = path.replace(/^\/+/, '');
        const existing = project.files.find((file) => file.path === normalizedPath);
        if (existing) { existing.content = content; existing.updatedAt = now; }
        else project.files.push({ path: normalizedPath, content, updatedAt: now });
        return structuredClone(project.files.find((file) => file.path === normalizedPath));
      });
      project.updatedAt = now;
      return saved;
    });
  }

  async function putFile(userId, projectId, file) {
    const saved = await putFiles(userId, projectId, [file]);
    return saved?.[0] ?? null;
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

  return { createUser, verifyUser, createSession, getUserForSession, deleteSession, connectCoreKey, getCoreKey, disconnectCoreKey, coreConnectionStatus, listProjects, createProject, getProject, updateProject, deleteProject, putFile, putFiles, deleteFile };
}
