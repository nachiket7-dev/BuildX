import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import blueprintRouter from './routes/blueprint';
import authRouter from './routes/auth';

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
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Rate limiting ────────────────────────────────────────
// Global limiter — generous for dev; each page load makes ~5-8 API calls
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,            // 200 requests per minute (was 20)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

// Stricter limiter for AI generation only (expensive Groq calls)
const blueprintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,             // 10 generations per minute (was 5)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Blueprint rate limit hit. Max 10 blueprints per minute.' },
});

app.use(limiter);

// ─── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Health check ─────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/blueprint', blueprintLimiter, blueprintRouter);

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
