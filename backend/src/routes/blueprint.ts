import { Router, Request, Response, NextFunction } from 'express';
import { BlueprintRequestSchema, BlueprintSchema } from '../lib/types';
import { generateBlueprint } from '../lib/generator';
import { generateBlueprintAgentic } from '../lib/orchestrator';
import {
  saveBlueprint,
  getBlueprintForUser,
  getBlueprintMeta,
  listBlueprints,
  getUsageCount,
  assertWithinUsageLimit,
  incrementUsage,
  updateBlueprintVisibility,
  updateBlueprintJson,
} from '../lib/db';
import { sendSSE, endSSE } from '../lib/stream';
import { streamScaffoldZip } from '../lib/scaffold';
import { refineBlueprint } from '../lib/refine';
import { coerceBlueprintInput } from '../lib/normalizeBlueprint';
import { resolveModel } from '../lib/groq';
import { requireAuth, optionalAuth } from '../lib/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Stricter limiter for AI generation only (expensive Groq calls)
const blueprintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,             // 10 generations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Blueprint rate limit hit. Max 10 blueprints per minute.' },
});


const GPT_OSS_MODEL = 'openai/gpt-oss-120b';

const GPT_OSS_DAILY_LIMIT = 5;

async function assertPremiumUsageAllowed(userId: string, model?: string): Promise<void> {
  const groqModel = resolveModel(model);
  if (groqModel !== GPT_OSS_MODEL) return;
  const count = await getUsageCount(userId, groqModel);
  assertWithinUsageLimit(count, groqModel, GPT_OSS_DAILY_LIMIT);
}

async function recordPremiumUsageIfNeeded(userId: string, model?: string): Promise<void> {
  const groqModel = resolveModel(model);
  if (groqModel === GPT_OSS_MODEL) {
    await incrementUsage(userId, groqModel);
  }
}

function isClientAborted(req: Request): boolean {
  return Boolean(req.aborted || (req.socket as { destroyed?: boolean }).destroyed);
}

/** Detects Groq 429 rate-limit / token-per-minute / context-length errors. */
function isGroqRateLimit(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('tokens per minute') ||
    m.includes('tpm') ||
    m.includes('token limit') ||
    m.includes('quota') ||
    m.includes('too large') ||
    m.includes('maximum context length') ||
    m.includes('reduce') && m.includes('max_tokens')
  );
}

/** Converts raw Groq SDK error text into a clear, actionable user message. */
function toFriendlyGroqError(message: string): string {
  if (isGroqRateLimit(message)) {
    return (
      'The AI provider hit a token/rate limit for this request. ' +
      'This usually means too many tokens were requested in a short window. ' +
      'Please wait ~60 seconds and try again, or pick a smaller/faster model. ' +
      'If this keeps happening, your Groq free-tier limit may be exhausted for the minute.'
    );
  }
  if (message.toLowerCase().includes('api key') || message.includes('401')) {
    return 'AI provider authentication failed. Verify the GROQ_API_KEY on the server.';
  }
  return message;
}

function validateBlueprintId(id: string): boolean {
  return Boolean(id && id.length >= 6 && id.length <= 16);
}

// Public health check (no auth)
router.get('/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GROQ_API_KEY);
  res.json({
    service: 'blueprint',
    ready: hasKey,
    message: hasKey
      ? 'Groq API key configured'
      : 'Missing GROQ_API_KEY — get a free key at https://console.groq.com',
  });
});

router.post(
  '/generate',
  requireAuth,
  blueprintLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parseResult = BlueprintRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const { idea, model } = parseResult.data;
    const userId = req.user!.userId;
    console.log(`[Blueprint] Generating for idea: "${idea.slice(0, 80)}..."`);

    try {
      await assertPremiumUsageAllowed(userId, model);
      const blueprint = await generateBlueprint(idea, model);
      await recordPremiumUsageIfNeeded(userId, model);
      const id = await saveBlueprint(idea, blueprint, userId, false);
      console.log(`[Blueprint] Success: ${blueprint.appName} (id: ${id})`);
      res.json({ success: true, data: blueprint, id });
    } catch (err) {
      if ((err as Error).message.includes('Daily limit')) {
        res.status(429).json({ error: (err as Error).message });
        return;
      }
      console.error('[Blueprint] Error:', (err as Error).message);
      next(err);
    }
  }
);

router.post('/generate-stream', requireAuth, blueprintLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = BlueprintRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  const { idea, model } = parseResult.data;
  const userId = req.user!.userId;
  console.log(`[Blueprint:stream] Generating for idea: "${idea.slice(0, 80)}..."`);

  try {
    await assertPremiumUsageAllowed(userId, model);
    const blueprint = await generateBlueprintAgentic(idea, res, model);

    if (isClientAborted(req)) {
      return;
    }

    try {
      const id = await saveBlueprint(idea, blueprint, userId, false);
      await recordPremiumUsageIfNeeded(userId, model);
      console.log(`[Blueprint:stream] Success: ${blueprint.appName} (id: ${id})`);
      sendSSE(res, 'saved', { id });
      endSSE(res);
    } catch (saveErr) {
      console.error('[Blueprint:stream] Save error:', (saveErr as Error).message);
      if (!res.writableEnded) {
        sendSSE(res, 'error', {
          message: 'Blueprint generated but could not be saved. Check your database connection.',
        });
        endSSE(res);
      }
    }
  } catch (err) {
    const rawMessage = (err as Error).message || 'Unknown error';
    console.error('[Blueprint:stream] Error:', rawMessage);
    if (rawMessage.includes('Daily limit')) {
      if (!res.headersSent) {
        res.status(429).json({ error: rawMessage });
      } else if (!res.writableEnded) {
        sendSSE(res, 'error', { message: rawMessage });
        endSSE(res);
      }
      return;
    }
    const friendlyMessage = toFriendlyGroqError(rawMessage);
    if (res.headersSent && !res.writableEnded) {
      sendSSE(res, 'error', { message: friendlyMessage });
      endSSE(res);
    } else if (!res.headersSent) {
      const status = isGroqRateLimit(rawMessage) ? 429 : 500;
      res.status(status).json({ error: friendlyMessage });
    }
  }
});

router.post('/export', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId || '';
    const id = req.query.id as string | undefined;

    if (id) {
      if (!validateBlueprintId(id)) {
        res.status(400).json({ error: 'Invalid blueprint ID' });
        return;
      }
      const result = await getBlueprintForUser(id, userId, { incrementViews: false });
      if (!result) {
        res.status(404).json({ error: 'Blueprint not found' });
        return;
      }
      console.log(`[Scaffold] Exporting blueprint ${id}: ${result.parsedBlueprint.appName}`);
      streamScaffoldZip(result.parsedBlueprint, res);
      return;
    }

    const parseResult = BlueprintSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid blueprint data. Provide a valid blueprint JSON or ?id=xxx query param.',
      });
      return;
    }

    console.log(`[Scaffold] Exporting blueprint: ${parseResult.data.appName}`);
    streamScaffoldZip(parseResult.data, res);
  } catch (err) {
    console.error('[Scaffold] Error:', (err as Error).message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate project scaffold' });
    }
  }
});

router.post('/export-github', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprint } = req.body;
    
    // Simulate GitHub repository creation and file upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const repoName = blueprint?.appName
      ? blueprint.appName.toLowerCase().replace(/\s+/g, '-')
      : 'generated-scaffold';

    console.log(`[GitHub Export] Exported blueprint ${blueprint?.appName || ''} to mock GitHub repo: https://github.com/mock-user/${repoName}`);

    res.json({
      success: true,
      repoUrl: `https://github.com/mock-user/${repoName}`,
      message: 'Successfully exported scaffold code to GitHub repository!',
    });
  } catch (err) {
    console.error('[GitHub Export] Error:', (err as Error).message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export to GitHub' });
    }
  }
});

router.post('/refine', requireAuth, blueprintLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { blueprint, message, model, id: blueprintId } = req.body;
  const userId = req.user!.userId;

  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    res.status(400).json({
      error: 'Invalid request',
      details: [{ field: 'message', message: 'Refinement message must be at least 3 characters' }],
    });
    return;
  }

  if (message.length > 500) {
    res.status(400).json({
      error: 'Invalid request',
      details: [{ field: 'message', message: 'Refinement message must be under 500 characters' }],
    });
    return;
  }

  if (!blueprint || typeof blueprint !== 'object') {
    res.status(400).json({ error: 'Blueprint is required for refinement' });
    return;
  }

  const coercedBlueprint = coerceBlueprintInput(blueprint);

  if (blueprintId && !validateBlueprintId(blueprintId)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    await assertPremiumUsageAllowed(userId, model);
    const refined = await refineBlueprint(coercedBlueprint, message.trim(), model);
    await recordPremiumUsageIfNeeded(userId, model);

    if (blueprintId) {
      const saved = await updateBlueprintJson(blueprintId, userId, refined);
      if (!saved) {
        res.status(404).json({ error: 'Blueprint not found or not owned by you' });
        return;
      }
    }

    console.log(`[Refine] Success: ${refined.appName}`);
    res.json({ success: true, data: refined });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Daily limit')) {
      res.status(429).json({ error: message });
      return;
    }
    console.error('[Refine] Error:', message);
    if (
      message.includes('JSON') ||
      message.includes('malformed') ||
      message.includes('empty response') ||
      message.includes('No valid JSON')
    ) {
      res.status(502).json({ error: message });
      return;
    }
    next(err);
  }
});

router.post('/regenerate', requireAuth, blueprintLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id: blueprintId, model } = req.body;
  const userId = req.user!.userId;

  if (!blueprintId || !validateBlueprintId(blueprintId)) {
    res.status(400).json({ error: 'Valid blueprint ID is required' });
    return;
  }

  try {
    const existing = await getBlueprintForUser(blueprintId, userId, { incrementViews: false });
    if (!existing) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    const originalIdea = existing.idea;
    console.log(`[Regenerate] Re-generating blueprint ${blueprintId} from idea: "${originalIdea.slice(0, 80)}..."`);

    await assertPremiumUsageAllowed(userId, model);
    const blueprint = await generateBlueprint(originalIdea, model);
    await recordPremiumUsageIfNeeded(userId, model);

    const saved = await updateBlueprintJson(blueprintId, userId, blueprint);
    if (!saved) {
      res.status(500).json({ error: 'Failed to save regenerated blueprint' });
      return;
    }

    console.log(`[Regenerate] Success: ${blueprint.appName} (id: ${blueprintId})`);
    res.json({ success: true, data: blueprint });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('Daily limit')) {
      res.status(429).json({ error: msg });
      return;
    }
    console.error('[Regenerate] Error:', msg);
    next(err);
  }
});

router.get('/list', optionalAuth, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await listBlueprints(30);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/meta', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const meta = await getBlueprintMeta(id, req.user?.userId || '');
    if (!meta) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    res.json({ success: true, data: meta });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const result = await getBlueprintForUser(id, req.user?.userId || '');
    if (!result) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...result.parsedBlueprint,
        id: result.id,
        idea: result.idea,
        views: result.views,
        createdAt: result.createdAt,
        isPublic: result.isPublic,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/visibility', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { is_public } = req.body;
  if (typeof is_public !== 'boolean') {
    res.status(400).json({ error: 'is_public must be a boolean' });
    return;
  }

  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const ok = await updateBlueprintVisibility(id, req.user!.userId, is_public);
    if (!ok) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }
    res.json({ success: true, is_public });
  } catch (err) {
    next(err);
  }
});

export default router;
