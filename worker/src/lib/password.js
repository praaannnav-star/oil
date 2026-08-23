// PBKDF2-SHA256 password hashing (WebCrypto-native; no bcrypt dep in Workers).
// Stored format: pbkdf2$<iterations>$<saltB64>$<hashB64>

const ITERATIONS = 100000;

const enc = new TextEncoder();

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function derive(password, saltBuf, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
    key,
    256
  );
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const bits = await derive(String(password), salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, itersStr, saltB64, hashB64] = String(stored || '').split('$');
    if (scheme !== 'pbkdf2') return false;
    const iterations = Number(itersStr);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    const bits = await derive(String(password), fromB64(saltB64), iterations);
    return toB64(bits) === hashB64;
  } catch {
    return false;
  }
}
