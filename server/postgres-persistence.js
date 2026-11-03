import { randomBytes, randomUUID, scrypt as scryptCallback, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getBuilderPriceUsdCents } from './builder-plans.js';

const scrypt = promisify(scryptCallback);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deriveEncryptionKey(secret) {
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('BUILDER_ENCRYPTION_KEY must be set to a random secret of at least 32 bytes.');
  }
  return createHash('sha256').update(secret).digest();
}

function publicUser(row) {
  return row ? { id: row.id, email: row.email, createdAt: new Date(row.created_at).toISOString() } : null;
}

function projectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export function createPostgresPersistence({ pool, encryptionKey = process.env.BUILDER_ENCRYPTION_KEY }) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new Error('A PostgreSQL pool is required.');
  }
  const key = deriveEncryptionKey(encryptionKey);

  function encryptSecret(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  }

  function decryptSecret(encrypted) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }

  async function createUser({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const salt = randomBytes(16).toString('hex');
    const derived = Buffer.from(await scrypt(password, salt, 64)).toString('hex');
    const id = randomUUID();
    try {
      const result = await pool.query(
        'INSERT INTO builder_users(id,email,password_salt,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,created_at',
        [id, normalizedEmail, salt, derived]
      );
      return publicUser(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        const duplicate = new Error('An account with this email already exists.');
        duplicate.code = 'EMAIL_EXISTS';
        throw duplicate;
      }
      throw error;
    }
  }

  async function verifyUser({ email, password }) {
    const result = await pool.query(
      'SELECT id,email,password_salt,password_hash,created_at FROM builder_users WHERE email=$1',
      [email.trim().toLowerCase()]
    );
    const row = result.rows[0];
    if (!row) return null;
    const derived = Buffer.from(await scrypt(password, row.password_salt, 64));
    const expected = Buffer.from(row.password_hash, 'hex');
    if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) return null;
    return publicUser(row);
  }

  async function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query('DELETE FROM builder_sessions WHERE expires_at <= NOW()');
    await pool.query(
      'INSERT INTO builder_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [hash(token), userId, expiresAt]
    );
    return { token, expiresAt: expiresAt.toISOString() };
  }

  async function getUserForSession(token) {
    if (!token) return null;
    const result = await pool.query(
      'SELECT u.id,u.email,u.created_at FROM builder_sessions s JOIN builder_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > NOW()',
      [hash(token)]
    );
    return publicUser(result.rows[0]);
  }

  async function deleteSession(token) {
    if (token) await pool.query('DELETE FROM builder_sessions WHERE token_hash=$1', [hash(token)]);
  }

  async function connectCoreKey(userId, apiKey) {
    const encrypted = encryptSecret(apiKey);
    await pool.query(
      `INSERT INTO builder_core_credentials(user_id,encrypted_key,encryption_iv,encryption_tag,connected_at)
       VALUES($1,$2,$3,$4,NOW())
       ON CONFLICT(user_id) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,encryption_iv=EXCLUDED.encryption_iv,encryption_tag=EXCLUDED.encryption_tag,connected_at=NOW()`,
      [userId, encrypted.ciphertext, encrypted.iv, encrypted.tag]
    );
  }

  async function getCoreKey(userId) {
    const result = await pool.query(
      'SELECT encrypted_key,encryption_iv,encryption_tag FROM builder_core_credentials WHERE user_id=$1',
      [userId]
    );
    const row = result.rows[0];
    return row ? decryptSecret({ ciphertext: row.encrypted_key, iv: row.encryption_iv, tag: row.encryption_tag }) : null;
  }

  async function disconnectCoreKey(userId) {
    await pool.query('DELETE FROM builder_core_credentials WHERE user_id=$1', [userId]);
  }

  async function coreConnectionStatus(userId) {
    const result = await pool.query('SELECT connected_at FROM builder_core_credentials WHERE user_id=$1', [userId]);
    const row = result.rows[0];
    return { connected: Boolean(row), connectedAt: row ? new Date(row.connected_at).toISOString() : null };
  }

  async function listProjects(userId) {
    const result = await pool.query(
      `SELECT p.id,p.user_id,p.name,p.description,p.created_at,p.updated_at,COUNT(f.path)::int AS file_count
       FROM builder_projects p LEFT JOIN builder_project_files f ON f.project_id=p.id
       WHERE p.user_id=$1 GROUP BY p.id ORDER BY p.updated_at DESC`,
      [userId]
    );
    return result.rows.map((row) => ({ ...projectRow(row), fileCount: row.file_count }));
  }

  async function createProject(userId, { name, description = '' }) {
    const result = await pool.query(
      'INSERT INTO builder_projects(id,user_id,name,description) VALUES($1,$2,$3,$4) RETURNING id,user_id,name,description,created_at,updated_at',
      [randomUUID(), userId, name.trim(), description.trim()]
    );
    return { ...projectRow(result.rows[0]), files: [], fileCount: 0 };
  }

  async function getProject(userId, projectId) {
    const result = await pool.query(
      'SELECT id,user_id,name,description,created_at,updated_at FROM builder_projects WHERE id=$1 AND user_id=$2',
      [projectId, userId]
    );
    const project = projectRow(result.rows[0]);
    if (!project) return null;
    const files = await pool.query(
      'SELECT path,content,updated_at FROM builder_project_files WHERE project_id=$1 ORDER BY path',
      [projectId]
    );
    return { ...project, files: files.rows.map((row) => ({ path: row.path, content: row.content, updatedAt: new Date(row.updated_at).toISOString() })) };
  }

  async function updateProject(userId, projectId, patch) {
    const result = await pool.query(
      `UPDATE builder_projects SET
        name=CASE WHEN $3::boolean THEN $4 ELSE name END,
        description=CASE WHEN $5::boolean THEN $6 ELSE description END,
        updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING id,user_id,name,description,created_at,updated_at`,
      [projectId, userId, typeof patch.name === 'string', typeof patch.name === 'string' ? patch.name.trim() : '', typeof patch.description === 'string', typeof patch.description === 'string' ? patch.description.trim() : '']
    );
    const project = projectRow(result.rows[0]);
    if (!project) return null;
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM builder_project_files WHERE project_id=$1', [projectId]);
    return { ...project, fileCount: count.rows[0].count };
  }

  async function deleteProject(userId, projectId) {
    const result = await pool.query('DELETE FROM builder_projects WHERE id=$1 AND user_id=$2 RETURNING id', [projectId, userId]);
    return result.rowCount > 0;
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await client.query('SELECT id FROM builder_projects WHERE id=$1 AND user_id=$2 FOR UPDATE', [projectId, userId]);
      if (!owner.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      const saved = [];
      for (const file of files) {
        const result = await client.query(
          `INSERT INTO builder_project_files(project_id,path,content) VALUES($1,$2,$3)
           ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content,updated_at=NOW()
           RETURNING path,content,updated_at`,
          [projectId, file.path, file.content]
        );
        const row = result.rows[0];
        saved.push({ path: row.path, content: row.content, updatedAt: new Date(row.updated_at).toISOString() });
      }
      await client.query('UPDATE builder_projects SET updated_at=NOW() WHERE id=$1', [projectId]);
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function putFile(userId, projectId, file) {
    const saved = await putFiles(userId, projectId, [file]);
    return saved ? saved[0] : null;
  }

  async function deleteFile(userId, projectId, path) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await client.query('SELECT id FROM builder_projects WHERE id=$1 AND user_id=$2 FOR UPDATE', [projectId, userId]);
      if (!owner.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      const deleted = await client.query('DELETE FROM builder_project_files WHERE project_id=$1 AND path=$2 RETURNING path', [projectId, path]);
      if (deleted.rowCount) await client.query('UPDATE builder_projects SET updated_at=NOW() WHERE id=$1', [projectId]);
      await client.query('COMMIT');
      return deleted.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function recordSubscription({ userId, plan, billingInterval, status, periodStart, periodEnd, cancelAtPeriodEnd = false, provider = null, providerCustomerId = null, providerSubscriptionId = null }) {
    const priceUsdCents = getBuilderPriceUsdCents(plan, billingInterval);
    if (priceUsdCents === null) throw new TypeError('Invalid Builder plan or billing interval.');
    if (!['incomplete', 'active', 'past_due', 'canceled', 'expired'].includes(status)) throw new TypeError('Invalid subscription status.');
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new TypeError('Invalid subscription period.');
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO builder_subscriptions(id,user_id,plan,billing_interval,status,price_usd_cents,currency,period_start,period_end,cancel_at_period_end,canceled_at,provider,provider_customer_id,provider_subscription_id)
       VALUES($1,$2,$3,$4,$5,$6,'USD',$7,$8,$9,CASE WHEN $5='canceled' THEN NOW() ELSE NULL END,$10,$11,$12)
       RETURNING id,plan,billing_interval,status,price_usd_cents,period_start,period_end,cancel_at_period_end`,
      [id, userId, plan, billingInterval, status, priceUsdCents, start, end, Boolean(cancelAtPeriodEnd), provider, providerCustomerId, providerSubscriptionId]
    );
    return result.rows[0];
  }

  async function getBillingState(userId) {
    const subscriptionResult = await pool.query(
      `SELECT plan,billing_interval,status,price_usd_cents,currency,period_start,period_end,cancel_at_period_end
       FROM builder_subscriptions
       WHERE user_id=$1 AND status IN ('active','past_due','canceled') AND period_end > NOW()
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'past_due' THEN 1 ELSE 2 END, period_end DESC
       LIMIT 1`,
      [userId]
    );
    const subscription = subscriptionResult.rows[0] || null;
    const balanceResult = await pool.query(
      'SELECT DISTINCT ON (credit_pool) credit_pool,balance_after FROM builder_credit_ledger WHERE user_id=$1 ORDER BY credit_pool,id DESC',
      [userId]
    );
    const creditBalances = Object.fromEntries(balanceResult.rows.map((item) => [item.credit_pool, item.balance_after]));
    const builderCreditsBalance = creditBalances.builder ?? 0;
    const runtimeCreditsBalance = creditBalances.runtime ?? 0;
    const row = subscription ? {
      plan: subscription.plan,
      billingInterval: subscription.billing_interval,
      status: subscription.status,
      priceUsdCents: subscription.price_usd_cents,
      currency: subscription.currency,
      periodStart: new Date(subscription.period_start).toISOString(),
      periodEnd: new Date(subscription.period_end).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    } : {
      plan: 'free', billingInterval: 'monthly', status: 'active',
      priceUsdCents: 0, currency: 'USD', periodStart: null, periodEnd: null,
      cancelAtPeriodEnd: false
    };
    return { subscription: row, creditsBalance: builderCreditsBalance, builderCreditsBalance, runtimeCreditsBalance };
  }

  async function changeCredits({ userId, amount, idempotencyKey, eventType, reason, creditPool = 'builder', projectId = null, jobId = null, periodStart = null, periodEnd = null, metadata = {} }) {
    if (!Number.isSafeInteger(amount) || amount === 0 || typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) {
      throw new TypeError('A non-zero integer credit amount and valid idempotency key are required.');
    }
    if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('A credit ledger reason is required.');
    if (!['builder', 'runtime'].includes(creditPool)) throw new TypeError('Invalid credit pool.');
    if (!['grant', 'reserve', 'charge', 'refund', 'expire', 'adjustment'].includes(eventType)) throw new TypeError('Invalid credit ledger event type.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await client.query('SELECT id FROM builder_users WHERE id=$1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new Error('Account not found.');
      const existing = await client.query('SELECT balance_after FROM builder_credit_ledger WHERE user_id=$1 AND credit_pool=$2 AND idempotency_key=$3', [userId, creditPool, idempotencyKey]);
      if (existing.rowCount) {
        await client.query('COMMIT');
        return { balance: existing.rows[0].balance_after, duplicate: true };
      }
      const current = await client.query('SELECT balance_after FROM builder_credit_ledger WHERE user_id=$1 AND credit_pool=$2 ORDER BY id DESC LIMIT 1', [userId, creditPool]);
      const balance = (current.rows[0]?.balance_after ?? 0) + amount;
      if (balance < 0) {
        const error = new Error('Insufficient Builder credits.');
        error.code = 'INSUFFICIENT_CREDITS';
        throw error;
      }
      await client.query(
        `INSERT INTO builder_credit_ledger(user_id,credit_pool,delta,balance_after,event_type,idempotency_key,period_start,period_end,project_id,job_id,reason,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [userId, creditPool, amount, balance, eventType, idempotencyKey, periodStart, periodEnd, projectId, jobId, reason.trim(), JSON.stringify(metadata)]
      );
      await client.query('COMMIT');
      return { balance, duplicate: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        const existing = await pool.query('SELECT balance_after FROM builder_credit_ledger WHERE user_id=$1 AND credit_pool=$2 AND idempotency_key=$3', [userId, creditPool, idempotencyKey]);
        if (existing.rowCount) return { balance: existing.rows[0].balance_after, duplicate: true };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function grantCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Granted credits must be a positive integer.');
    return changeCredits({ ...options, creditPool: 'builder', eventType: 'grant' });
  }

  async function consumeCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Consumed credits must be a positive integer.');
    return changeCredits({ ...options, creditPool: 'builder', amount: -options.amount, eventType: 'charge' });
  }


  async function reserveBuilderCredits({ userId, amount, idempotencyKey, projectId = null, jobId, reason = 'AI generation reservation', metadata = {} }) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || typeof jobId !== 'string' || !jobId.trim() || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) throw new TypeError('A positive credit amount, job ID and idempotency key are required.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await client.query('SELECT id FROM builder_users WHERE id=$1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new Error('Account not found.');
      const existing = await client.query('SELECT amount,idempotency_key,status,balance_after FROM builder_credit_reservations WHERE user_id=$1 AND job_id=$2 FOR UPDATE', [userId, jobId]);
      if (existing.rowCount) { const row = existing.rows[0]; if (row.amount !== amount || row.idempotency_key !== idempotencyKey) throw new Error('Credit reservation job ID conflict.'); await client.query('COMMIT'); return { status: row.status, duplicate: true, balance: row.balance_after }; }
      const current = await client.query("SELECT balance_after FROM builder_credit_ledger WHERE user_id=$1 AND credit_pool='builder' ORDER BY id DESC LIMIT 1", [userId]);
      const balance = (current.rows[0]?.balance_after ?? 0) - amount;
      if (balance < 0) { const error = new Error('Insufficient Builder credits.'); error.code = 'INSUFFICIENT_CREDITS'; throw error; }
      await client.query("INSERT INTO builder_credit_ledger(user_id,credit_pool,delta,balance_after,event_type,idempotency_key,project_id,job_id,reason,metadata) VALUES($1,'builder',$2,$3,'reserve',$4,$5,$6,$7,$8::jsonb)", [userId, -amount, balance, 'reserve:' + jobId, projectId, jobId, String(reason).slice(0, 200), JSON.stringify(metadata)]);
      await client.query("INSERT INTO builder_credit_reservations(user_id,job_id,amount,idempotency_key,project_id,status,balance_after) VALUES($1,$2,$3,$4,$5,'reserved',$6)", [userId, jobId, amount, idempotencyKey, projectId, balance]);
      await client.query('COMMIT'); return { status: 'reserved', duplicate: false, balance };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }
  async function settleBuilderCreditReservation({ userId, jobId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM builder_users WHERE id=$1 FOR UPDATE', [userId]);
      const result = await client.query(
        "UPDATE builder_credit_reservations SET status='settled',updated_at=NOW() WHERE user_id=$1 AND job_id=$2 AND status='reserved' RETURNING status",
        [userId, jobId]
      );
      if (result.rowCount) {
        await client.query('COMMIT');
        return { status: 'settled', duplicate: false };
      }
      const existing = await client.query(
        'SELECT status FROM builder_credit_reservations WHERE user_id=$1 AND job_id=$2',
        [userId, jobId]
      );
      await client.query('COMMIT');
      return existing.rowCount
        ? { status: existing.rows[0].status, duplicate: true }
        : { status: 'not_found', duplicate: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  async function refundBuilderCreditReservation({ userId, jobId, reason = 'AI generation failed' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM builder_users WHERE id=$1 FOR UPDATE', [userId]);
      const result = await client.query('SELECT * FROM builder_credit_reservations WHERE user_id=$1 AND job_id=$2 FOR UPDATE', [userId, jobId]);
      if (!result.rowCount) { await client.query('COMMIT'); return { status: 'not_found', duplicate: false }; }
      const item = result.rows[0];
      if (item.status === 'refunded' || item.status === 'settled') { await client.query('COMMIT'); return { status: item.status, duplicate: true }; }
      const current = await client.query("SELECT balance_after FROM builder_credit_ledger WHERE user_id=$1 AND credit_pool='builder' ORDER BY id DESC LIMIT 1", [userId]);
      const balance = (current.rows[0]?.balance_after ?? 0) + item.amount;
      await client.query("INSERT INTO builder_credit_ledger(user_id,credit_pool,delta,balance_after,event_type,idempotency_key,project_id,job_id,reason,metadata) VALUES($1,'builder',$2,$3,'refund',$4,$5,$6,$7,$8::jsonb)", [userId, item.amount, balance, 'refund:' + jobId, item.project_id, jobId, String(reason).slice(0, 200), JSON.stringify({ reservationIdempotencyKey: item.idempotency_key })]);
      await client.query("UPDATE builder_credit_reservations SET status='refunded',updated_at=NOW() WHERE user_id=$1 AND job_id=$2", [userId, jobId]);
      await client.query('COMMIT'); return { status: 'refunded', duplicate: false, balance };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }
  async function recordCoreUsage({ userId, projectId, jobId, stage, model, chargedUsd = null, currency = 'USD', usage = {} }) {
    if (!userId || !jobId || !stage || typeof stage !== 'string') throw new TypeError('Core usage requires user, job and stage identifiers.');
    if (chargedUsd !== null && (!Number.isFinite(Number(chargedUsd)) || Number(chargedUsd) < 0)) throw new TypeError('Core charged amount must be a non-negative number.');
    const result = await pool.query('INSERT INTO builder_core_usage(user_id,project_id,job_id,stage,model,charged_usd,currency,usage) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(job_id,stage) DO NOTHING RETURNING id', [userId, projectId, jobId, stage, String(model || '').slice(0, 120), chargedUsd, String(currency || 'USD').slice(0, 3), JSON.stringify(usage)]);
    return { duplicate: result.rowCount === 0, id: result.rows[0]?.id ?? null };
  }


  async function getFreeGenerationStatus(userId) {
    const result = await pool.query(
      `SELECT status,project_id,created_at,updated_at,
        CASE WHEN status='reserved' AND updated_at < NOW() - INTERVAL '30 minutes' THEN 'available'
             WHEN status='completed' THEN 'used' ELSE 'processing' END AS effective_status
       FROM builder_free_generation_claims WHERE user_id=$1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return { status: 'available', projectId: null, usedAt: null };
    return {
      status: row.effective_status,
      projectId: row.project_id || null,
      usedAt: row.effective_status === 'used' ? new Date(row.updated_at).toISOString() : null
    };
  }

  async function reserveFreeGeneration({ userId, jobId, projectId = null }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await client.query('SELECT id FROM builder_users WHERE id=$1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new Error('Account not found.');
      const existing = await client.query('SELECT job_id,status,updated_at FROM builder_free_generation_claims WHERE user_id=$1 FOR UPDATE', [userId]);
      if (existing.rowCount) {
        const row = existing.rows[0];
        if (row.status === 'completed') {
          await client.query('COMMIT');
          return { status: 'used', duplicate: true };
        }
        if (Date.now() - new Date(row.updated_at).getTime() <= 30 * 60 * 1000) {
          await client.query('COMMIT');
          return { status: 'processing', duplicate: true };
        }
        await client.query(
          'UPDATE builder_free_generation_claims SET job_id=$2,project_id=$3,created_at=NOW(),updated_at=NOW() WHERE user_id=$1',
          [userId, jobId, projectId]
        );
        await client.query('COMMIT');
        return { status: 'reserved', duplicate: false, reclaimed: true };
      }
      await client.query(
        "INSERT INTO builder_free_generation_claims(user_id,job_id,project_id,status) VALUES($1,$2,$3,'reserved')",
        [userId, jobId, projectId]
      );
      await client.query('COMMIT');
      return { status: 'reserved', duplicate: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function releaseFreeGeneration({ userId, jobId }) {
    const result = await pool.query(
      "DELETE FROM builder_free_generation_claims WHERE user_id=$1 AND job_id=$2 AND status='reserved' RETURNING job_id",
      [userId, jobId]
    );
    return { status: result.rowCount ? 'released' : 'not_found' };
  }

  async function putFilesAndCompleteFreeGeneration({ userId, projectId, files, jobId }) {
    if (!Array.isArray(files) || files.length === 0) throw new TypeError('At least one project file is required.');
    const seen = new Set();
    for (const file of files) {
      if (!file || typeof file.path !== 'string' || !file.path || typeof file.content !== 'string' || seen.has(file.path)) throw new TypeError('Project files must have unique paths and string contents.');
      seen.add(file.path);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await client.query('SELECT id FROM builder_projects WHERE id=$1 AND user_id=$2 FOR UPDATE', [projectId, userId]);
      if (!owner.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      const claim = await client.query(
        "SELECT status FROM builder_free_generation_claims WHERE user_id=$1 AND job_id=$2 FOR UPDATE",
        [userId, jobId]
      );
      if (!claim.rowCount || claim.rows[0].status !== 'reserved') {
        const error = new Error('The one-time free generation reservation is no longer active.');
        error.statusCode = 409;
        throw error;
      }
      const saved = [];
      for (const file of files) {
        const result = await client.query(
          `INSERT INTO builder_project_files(project_id,path,content) VALUES($1,$2,$3)
           ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content,updated_at=NOW()
           RETURNING path,content,updated_at`,
          [projectId, file.path.replace(/^\\/+/, ''), file.content]
        );
        const row = result.rows[0];
        saved.push({ path: row.path, content: row.content, updatedAt: new Date(row.updated_at).toISOString() });
      }
      await client.query('UPDATE builder_projects SET updated_at=NOW() WHERE id=$1', [projectId]);
      await client.query(
        "UPDATE builder_free_generation_claims SET status='completed',updated_at=NOW() WHERE user_id=$1 AND job_id=$2",
        [userId, jobId]
      );
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function grantRuntimeCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Granted credits must be a positive integer.');
    return changeCredits({ ...options, creditPool: 'runtime', eventType: 'grant' });
  }

  async function consumeRuntimeCredits(options) {
    if (!Number.isSafeInteger(options.amount) || options.amount <= 0) throw new TypeError('Consumed credits must be a positive integer.');
    return changeCredits({ ...options, creditPool: 'runtime', amount: -options.amount, eventType: 'charge' });
  }

  return { createUser, verifyUser, createSession, getUserForSession, deleteSession, connectCoreKey, getCoreKey, disconnectCoreKey, coreConnectionStatus, listProjects, createProject, getProject, updateProject, deleteProject, putFile, putFiles, deleteFile, getBillingState, recordSubscription, grantCredits, consumeCredits, reserveBuilderCredits, settleBuilderCreditReservation, refundBuilderCreditReservation, recordCoreUsage, getFreeGenerationStatus, reserveFreeGeneration, releaseFreeGeneration, putFilesAndCompleteFreeGeneration, grantRuntimeCredits, consumeRuntimeCredits };
}
