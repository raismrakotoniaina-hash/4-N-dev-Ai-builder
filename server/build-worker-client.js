import { createConnection } from 'node:net';

const SOCKET_PATH = process.env.BUILDER_WORKER_SOCKET || '/run/4n-dev-ai-builder-worker/worker.sock';
const MAX_RESPONSE_BYTES = 16_000;
const REQUEST_TIMEOUT_MS = 130_000;

export function validateBuild(files, { socketPath = SOCKET_PATH, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let output = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else if (!result?.success) {
        const failure = new Error(typeof result?.error === 'string' ? result.error : 'Generated app failed its isolated build.');
        failure.statusCode = 422;
        reject(failure);
      } else resolve(result);
    };
    const timer = setTimeout(() => finish(Object.assign(new Error('Build worker timed out.'), { statusCode: 503 })), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.end(JSON.stringify({ files })));
    socket.on('data', chunk => {
      output += chunk;
      if (Buffer.byteLength(output, 'utf8') > MAX_RESPONSE_BYTES) {
        finish(Object.assign(new Error('Build worker response exceeded size limits.'), { statusCode: 502 }));
      }
    });
    socket.on('end', () => {
      try {
        finish(null, JSON.parse(output));
      } catch {
        finish(Object.assign(new Error('Build worker returned an invalid response.'), { statusCode: 502 }));
      }
    });
    socket.on('error', error => finish(Object.assign(new Error('Build worker unavailable: ' + error.message), { statusCode: 503 })));
  });
}
