import { Router, Request, Response } from 'express';
import { generateVFSFromBlueprint, getLanguageFromPath } from '../services/vfsService';
import { enhanceVfsUi } from '../services/uiEnhancerService';

import {
  getBlueprintForUser,
  getBlueprintOwnedByUser,
  getBlueprintFiles,

  saveBlueprintFilesAtomically,
} from '../lib/db';
import { isWorkspacePath } from '../lib/agent/validation';
import { optionalAuth, requireAuth } from '../lib/auth';

const router = Router();

/**
 * POST /api/blueprints/:id/vfs/init
 * Initialize a missing VFS file tree without replacing saved work
 */
router.post('/:id/vfs/init', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID is required' });
    }

    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const spec = (blueprint as any).parsedBlueprint || blueprint;
    // Generate full VFS map dictionary (filePath -> content)
    const vfsMap = generateVFSFromBlueprint(spec);

    // Initialization is idempotent: never replace an existing workspace.
    const existing = await getBlueprintFiles(id);
    if (existing.length) {
      return res.json({ success: true, data: { id, files: existing, fileTree: Object.fromEntries(existing.map(f => [f.path, f.content])) } });
    }
    const savedFiles = Object.entries(vfsMap).map(([path, content]) => ({ path, content, language: getLanguageFromPath(path) }));
    await saveBlueprintFilesAtomically(id, savedFiles, { onlyIfEmpty: true });
    const authoritative = await getBlueprintFiles(id);

    return res.json({
      success: true,
      data: {
        id,
        files: authoritative,
        fileTree: Object.fromEntries(authoritative.map(file => [file.path, file.content])),
      },
    });
  } catch (err: any) {
    console.error('[VFS Init Error]', err);
    return res.status(500).json({ error: 'Failed to initialize VFS workspace' });
  }
});

/**
 * GET /api/blueprints/:id/vfs
 * Read the stored VFS snapshot without mutating it
 */
router.get('/:id/vfs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID is required' });
    }

    const blueprint = await getBlueprintForUser(id, req.user?.userId || '', { incrementViews: false });
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found or access denied' });
    }

    // Reading a workspace must never repair, unwrap, or overwrite saved files.
    const files = await getBlueprintFiles(id);
    const fileTree = Object.fromEntries(files.map(file => [file.path, file.content]));

    return res.json({
      success: true,
      data: {
        id,
        files,
        fileTree,
      },
    });
  } catch (err: any) {
    console.error('[VFS Fetch Error]', err);
    return res.status(500).json({ error: 'Failed to fetch VFS files' });
  }
});

/**
 * PUT & PATCH /api/blueprints/:id/vfs/file
 * Update or create a single file in the VFS
 */
const handleVfsFileUpdate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { path, content, expectedContent } = req.body ?? {};

    if (
      !id ||
      !isWorkspacePath(path) ||
      path.length > 512 ||
      path.startsWith('/') ||
      path.split('/').includes('..') ||
      path.includes('\0') ||
      typeof content !== 'string' ||
      content.length > 2_000_000
    ) {
      return res.status(400).json({ error: 'Blueprint ID, path, and content are required' });
    }

    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    }

    const language = getLanguageFromPath(path);
    if (expectedContent !== undefined && typeof expectedContent !== 'string') return res.status(400).json({ error: 'expectedContent must be a string' });
    await saveBlueprintFilesAtomically(id, [{ path, content, language }], expectedContent !== undefined ? { expected: { [path]: expectedContent } } : undefined);

    return res.json({
      success: true,
      data: {
        file: {
          path,
          content,
          language,
        },
      },
    });
  } catch (err: any) {
    if (err.code === 'WORKSPACE_CONFLICT') return res.status(409).json({ error: err.message });
    console.error('[VFS File Update Error]', err);
    return res.status(500).json({ error: 'Failed to update VFS file' });
  }
};

router.put('/:id/vfs/file', requireAuth, handleVfsFileUpdate);
router.patch('/:id/vfs/file', requireAuth, handleVfsFileUpdate);

/**
 * POST /api/blueprints/:id/enhance-ui
 * Upgrade existing VFS App.tsx to a high-fidelity dark glassmorphic React interface.
 * The LLM rewrites the primary app component with KPI cards, charts, tables, and realistic mock data.
 */
router.post('/:id/enhance-ui', requireAuth, async (req: Request, res: Response) => {
  if (process.env.AGENT_QUEUE_ENABLED === 'true') return res.status(409).json({error:'Use a queued agent request to stage UI changes for review.'});
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID is required' });
    }

    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    }

    const result = await enhanceVfsUi(id, req.user!.userId);

    // Build structured file list for frontend VFSContext sync
    const files = Object.entries(result.updatedFiles).map(([path, content]) => ({
      path,
      content,
      language: getLanguageFromPath(path),
    }));

    return res.json({
      success: true,
      data: {
        id,
        files,
        fileTree: result.updatedFiles,
        modelUsed: result.modelUsed,
        usedFallback: result.usedFallback,
      },
    });
  } catch (err: any) {
    console.error('[VFS Enhance UI Error]', err);
    return res.status(500).json({ error: 'Failed to enhance UI' });
  }
});

export default router;
