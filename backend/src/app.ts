import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import blueprintRouter from './routes/blueprint';
import authRouter from './routes/auth';
import agentRouter from './routes/agent';
import vfsRouter from './routes/vfs';
import { getDatabaseStatus } from './lib/db';

const app = express();

// ─── Security ───────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Rate limiting ────────────────────────────────────────
// Behind a reverse proxy (Render et al.) the socket IP is the proxy's, which
// would collapse every user into a single shared bucket. Trusting exactly one
// hop makes req.ip the real client. Deliberately NOT `true`: blanket trust lets
// any client spoof X-Forwarded-For and bypass the limiter entirely.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Global limiter — generous for dev; each page load makes ~5-8 API calls
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,            // 200 requests per minute (was 20)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

app.use(limiter);

// ─── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health check ─────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const db = getDatabaseStatus();
  const dbOk = db.mode === 'postgresql';
  res.status(dbOk || db.mode === 'fallback' ? 200 : 503).json({
    status: dbOk ? 'ok' : db.mode === 'fallback' ? 'degraded' : 'misconfigured',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    database: {
      mode: db.mode,
      ok: dbOk,
      error: db.error,
      fallbackAllowed: db.fallbackAllowed,
    },
  });
});

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/agent', agentRouter);
app.use('/api/blueprints', vfsRouter);
app.use('/api/blueprint', vfsRouter); // Route alias for VFS workspace compatibility
app.use('/api/blueprint', blueprintRouter);

// ─── 404 ──────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────
// Must have 4 params to be treated as error handler by Express
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
});

export default app;
