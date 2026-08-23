// HTTP helpers: JSON responses, CORS, body parsing, error envelope.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  });
}

export function err(status, message, extra = {}) {
  return json({ error: message, ...extra }, status);
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function readJson(request) {
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await request.json();
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return err(e.status, e.message);
    console.error('Unhandled worker error:', e);
    return err(500, 'Internal server error');
  }
}
