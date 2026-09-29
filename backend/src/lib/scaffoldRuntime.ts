import type { Blueprint } from "./types";

export function generatedAuth(bp: Blueprint): string {
  const auth = bp.architecture.auth.toLowerCase();
  const verifier = auth.includes("clerk")
    ? `import { verifyToken } from '@clerk/backend';\nasync function claims(token: string) {\n  if (!process.env.CLERK_SECRET_KEY) throw new Error('Configure CLERK_SECRET_KEY');\n  return verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: (process.env.AUTHORIZED_PARTIES || '').split(',').filter(Boolean) });\n}`
    : auth.includes("nextauth") || auth.includes("auth.js")
      ? `import { decode } from 'next-auth/jwt';\nasync function claims(token: string) {\n  if (!process.env.NEXTAUTH_SECRET) throw new Error('Configure NEXTAUTH_SECRET');\n  return decode({ token, secret: process.env.NEXTAUTH_SECRET });\n}`
      : `import jwt from 'jsonwebtoken';\nasync function claims(token: string) {\n  const secret = process.env.JWT_SECRET;\n  if (!secret || secret.length < 32) throw new Error('Configure a JWT_SECRET of at least 32 characters');\n  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER || 'buildx-app', audience: process.env.JWT_AUDIENCE || 'buildx-api' });\n}`;
  const identity =
    auth.includes("clerk") ||
    auth.includes("nextauth") ||
    auth.includes("auth.js")
      ? `export async function identity(_action: string, _input: unknown) { return { status: 400, body: { error: 'Sign in through the configured identity provider and send its session token as Bearer authorization' } }; }`
      : `import { randomBytes, scrypt, timingSafeEqual, createHash } from 'crypto';
import * as storage from './repository';
const hashPassword = (password: string, salt: string) => new Promise<Buffer>((resolve,reject) => scrypt(password,salt,64,(error,key) => error ? reject(error) : resolve(key)));
export async function identity(action: string, input: unknown) {
  const body = input as { email?: unknown; password?: unknown } | null;
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || !/^[^@ ]+@[^@ ]+\\.[^@ ]+$/.test(body.email) || body.password.length < 12 || body.password.length > 128) return { status: 400, body: { error: 'Valid email and password of 12–128 characters required' } };
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return { status: 503, body: { error: 'Authentication is not configured' } };
  const email = body.email.trim().toLowerCase();
  const id = createHash('sha256').update(email).digest('hex');
  try {
    if (action === '/signup' || action === '/register') {
      const salt = randomBytes(16).toString('hex');
      const hash = (await hashPassword(body.password,salt)).toString('hex');
      await storage.insert('_identity','private',{ id,email,salt,hash });
    } else if (action === '/login') {
      const account = (await storage.list('_identity','private',id))[0];
      const salt = account?.salt || 'missing-account-fixed-salt';
      const actual = await hashPassword(body.password,salt);
      const expected = account ? Buffer.from(account.hash,'hex') : Buffer.alloc(64);
      if (!account || expected.length !== actual.length || !timingSafeEqual(actual,expected)) return { status: 401, body: { error: 'Invalid credentials' } };
    } else return { status: 404, body: { error: 'Unknown authentication action' } };
    const token = jwt.sign({},secret,{ subject:id,expiresIn:'1h',issuer:process.env.JWT_ISSUER || 'buildx-app',audience:process.env.JWT_AUDIENCE || 'buildx-api' });
    return { status: action === '/login' ? 200 : 201, body: { token,user:{ id,email } } };
  } catch (error: any) { return { status: error.code === '23505' || error.code === 11000 ? 409 : 503, body: { error: 'Unable to complete authentication' } }; }
}`;
  return `${verifier}
${identity}
export async function authenticate(header: string | undefined): Promise<string> {
  const match = /^Bearer ([^ ]+)$/i.exec(header || '');
  if (!match) throw new Error('Authentication required');
  const result = await claims(match[1]);
  if (!result || typeof result === 'string' || typeof result.sub !== 'string' || !result.sub || typeof result.exp !== 'number' || result.exp * 1000 <= Date.now()) throw new Error('Invalid or expired session');
  return result.sub;
}
`;
}

export function generatedRepository(bp: Blueprint): string {
  if (bp.architecture.database.toLowerCase().includes("mongo"))
    return `import mongoose from 'mongoose';
const schema = new mongoose.Schema({ resource: String, owner: String, id: String, data: mongoose.Schema.Types.Mixed }, { versionKey: false });
schema.index({ resource: 1, owner: 1, id: 1 }, { unique: true });
const RecordModel = mongoose.model('BuildXRecord', schema);
let ready: Promise<unknown> | undefined;
async function connect() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  ready ||= mongoose.connect(process.env.DATABASE_URL).then(() => RecordModel.init()).catch(error => { ready = undefined; throw error; });
  await ready;
}
export async function list(resource: string, owner: string | null, id?: string) { await connect(); return (await RecordModel.find({ resource, ...(owner === null ? {} : { owner }), ...(id ? { id } : {}) }).limit(100).lean()).map(row => row.data); }
export async function insert(resource: string, owner: string, data: Record<string, unknown>) { await connect(); await RecordModel.create({ resource, owner, id: data.id, data }); return data; }
export async function update(resource: string, owner: string, id: string, data: Record<string, unknown>) {
  await connect(); const fields = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'id').map(([key,value]) => ['data.' + key,value]));
  const row = await RecordModel.findOneAndUpdate({ resource, owner, id }, { $set: fields }, { new: true }).lean(); return row?.data;
}
export async function remove(resource: string, owner: string, id: string) { await connect(); return (await RecordModel.findOneAndDelete({ resource, owner, id }).lean())?.data; }
`;
  return `import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ready: Promise<unknown> | undefined;
async function connect() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  ready ||= pool.query('CREATE TABLE IF NOT EXISTS buildx_records (resource TEXT NOT NULL, owner TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(resource,owner,id))').catch(error => { ready = undefined; throw error; });
  await ready;
}
export async function list(resource: string, owner: string | null, id?: string) { await connect(); return (await pool.query('SELECT data FROM buildx_records WHERE resource=$1 AND ($2::text IS NULL OR owner=$2) AND ($3::text IS NULL OR id=$3) ORDER BY id LIMIT 100', [resource,owner,id || null])).rows.map(row => row.data); }
export async function insert(resource: string, owner: string, data: Record<string, unknown>) { await connect(); await pool.query('INSERT INTO buildx_records(resource,owner,id,data) VALUES($1,$2,$3,$4)', [resource,owner,data.id,JSON.stringify(data)]); return data; }
export async function update(resource: string, owner: string, id: string, data: Record<string, unknown>) { await connect(); return (await pool.query('UPDATE buildx_records SET data=data || $4::jsonb WHERE resource=$1 AND owner=$2 AND id=$3 RETURNING data', [resource,owner,id,JSON.stringify({ ...data,id })])).rows[0]?.data; }
export async function remove(resource: string, owner: string, id: string) { await connect(); return (await pool.query('DELETE FROM buildx_records WHERE resource=$1 AND owner=$2 AND id=$3 RETURNING data', [resource,owner,id])).rows[0]?.data; }
`;
}

export function generatedHandler(): string {
  return `import { randomUUID } from 'crypto';
import { authenticate, identity } from './auth';
import * as repository from './repository';
export async function handle(resource: string, method: string, requiresAuth: boolean, header: string | undefined, id: string | undefined, input: unknown, action = '/') {
  if (resource === 'auth' && method === 'post') return identity(action, input);
  let owner = 'public';
  if (requiresAuth || header) {
    try { owner = await authenticate(header); } catch { return { status: 401, body: { error: 'Invalid or expired session' } }; }
  }
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  if (Object.keys(body).some(key => ['__proto__','constructor','prototype'].includes(key) || key.includes('.') || key.startsWith('$'))) return { status: 400, body: { error: 'Invalid field name' } };
  // Account credentials and provider callbacks are not generic CRUD resources.
  if ((resource.startsWith('_') || ['auth','users','accounts','webhooks'].includes(resource))) return { status: 501, body: { error: 'Use the configured identity provider flow; this resource requires a domain-specific implementation' } };
  try {
    if (method === 'get') return { status: 200, body: { data: await repository.list(resource, requiresAuth ? owner : null, id) } };
    if (method === 'post') return { status: 201, body: { data: await repository.insert(resource, owner, { ...body, id: randomUUID() }) } };
    if (!id) return { status: 400, body: { error: 'Resource id is required' } };
    const data = method === 'delete' ? await repository.remove(resource, owner, id) : await repository.update(resource, owner, id, body);
    return data ? { status: 200, body: { data } } : { status: 404, body: { error: 'Resource not found' } };
  } catch { return { status: 503, body: { error: 'Storage unavailable' } }; }
}
`;
}
