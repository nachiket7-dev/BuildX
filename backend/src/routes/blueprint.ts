import { Router, Request, Response, NextFunction } from 'express';
import { BlueprintRequestSchema, BlueprintSchema } from '../lib/types';
import { generateBlueprint, generateBlueprintStream } from '../lib/generator';
import { saveBlueprint, getBlueprint, getBlueprintMeta, listBlueprints, saveChatMessage, getChatMessages } from '../lib/db';
import { sendSSE, endSSE } from '../lib/stream';
import { streamScaffoldZip } from '../lib/scaffold';
import { refineBlueprint } from '../lib/refine';
import { optionalAuth } from '../lib/auth';

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/blueprint/generate
// Body: { idea: string }
// Returns: { success, data: Blueprint, id: string }
// ─────────────────────────────────────────────────────────────
router.post(
  '/generate',
  optionalAuth,
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

    const { idea } = parseResult.data;
    console.log(`[Blueprint] Generating for idea: "${idea.slice(0, 80)}..."`);

    try {
      const blueprint = await generateBlueprint(idea);
      const id = await saveBlueprint(idea, blueprint, req.user?.userId);
      console.log(`[Blueprint] Success: ${blueprint.appName} (id: ${id})`);
      res.json({ success: true, data: blueprint, id });
    } catch (err) {
      console.error('[Blueprint] Error:', (err as Error).message);
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/blueprint/generate-stream
// Body: { idea: string }
// Returns: SSE stream with section events + complete event
// ─────────────────────────────────────────────────────────────
router.post(
  '/generate-stream',
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
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

    const { idea } = parseResult.data;
    console.log(`[Blueprint:stream] Generating for idea: "${idea.slice(0, 80)}..."`);

    // Handle client disconnect
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      const blueprint = await generateBlueprintStream(idea, res);

      if (!clientDisconnected) {
        // Save to database
        const id = await saveBlueprint(idea, blueprint, req.user?.userId);
        console.log(`[Blueprint:stream] Success: ${blueprint.appName} (id: ${id})`);
        sendSSE(res, 'saved', { id });
        endSSE(res);
      }
    } catch (err) {
      console.error('[Blueprint:stream] Error:', (err as Error).message);
      if (!clientDisconnected) {
        sendSSE(res, 'error', { message: (err as Error).message });
        endSSE(res);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/blueprint/export
// Body: Blueprint JSON  OR  query: ?id=xxxx
// Returns: ZIP file download
// ─────────────────────────────────────────────────────────────
router.post(
  '/export',
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Option 1: Blueprint ID in query param
      const id = req.query.id as string | undefined;
      if (id) {
        const result = await getBlueprint(id);
        if (!result) {
          res.status(404).json({ error: 'Blueprint not found' });
          return;
        }
        console.log(`[Scaffold] Exporting blueprint ${id}: ${result.parsedBlueprint.appName}`);
        streamScaffoldZip(result.parsedBlueprint, res);
        return;
      }

      // Option 2: Full blueprint in request body
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
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/blueprint/refine
// Body: { blueprint: Blueprint, message: string }
// Returns: { success, data: Blueprint }
// ─────────────────────────────────────────────────────────────
router.post(
  '/refine',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { blueprint, message } = req.body;

    // Validate message
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

    // Validate blueprint
    const bpResult = BlueprintSchema.safeParse(blueprint);
    if (!bpResult.success) {
      res.status(400).json({
        error: 'Invalid blueprint data',
        details: bpResult.error.issues.slice(0, 3).map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    try {
      const refined = await refineBlueprint(bpResult.data, message.trim());
      console.log(`[Refine] Success: ${refined.appName}`);
      res.json({ success: true, data: refined });
    } catch (err) {
      console.error('[Refine] Error:', (err as Error).message);
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/blueprint/list
// Returns: { success, data: BlueprintListItem[] }
// ─────────────────────────────────────────────────────────────
router.get('/list', async (_req: Request, res: Response): Promise<void> => {
  const items = await listBlueprints(30);
  res.json({ success: true, data: items });
});

// ─────────────────────────────────────────────────────────────
// GET /api/blueprint/health
// Quick check that the blueprint service + Groq key is configured
// NOTE: Must be defined BEFORE /:id to avoid being caught by it
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// GET /api/blueprint/:id
// Returns: { success, data: SavedBlueprint }
// ─────────────────────────────────────────────────────────────
router.get(
  '/:id',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || id.length < 6 || id.length > 16) {
      res.status(400).json({ error: 'Invalid blueprint ID' });
      return;
    }

    const result = await getBlueprint(id);
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
      },
    });
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/blueprint/:id/meta
// Returns: { id, idea, createdAt, views } — for link previews
// ─────────────────────────────────────────────────────────────
router.get(
  '/:id/meta',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || id.length < 6 || id.length > 16) {
      res.status(400).json({ error: 'Invalid blueprint ID' });
      return;
    }

    const meta = await getBlueprintMeta(id);
    if (!meta) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }

    res.json({ success: true, data: meta });
  }
);

export default router;
