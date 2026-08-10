import { Router, Request, Response } from 'express';
import { generateVFSFromBlueprint, getLanguageFromPath } from '../services/vfsService';
import {
  getBlueprintAny,
  getBlueprintFiles,
  saveBlueprintFile,
  clearBlueprintFiles,
} from '../lib/db';
import { optionalAuth } from '../lib/auth';

const router = Router();

/**
 * POST /api/blueprints/:id/vfs/init
 * Initialize or re-generate VFS file tree for a blueprint
 */
router.post('/:id/vfs/init', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID is required' });
    }

    const blueprint = await getBlueprintAny(id);
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const spec = (blueprint as any).parsedBlueprint || blueprint;
    // Generate full VFS map dictionary (filePath -> content)
    const vfsMap = generateVFSFromBlueprint(spec);

    // Clear existing DB files and persist new VFS files
    await clearBlueprintFiles(id);

    const savedFiles: Array<{ path: string; content: string; language: string }> = [];

    for (const [filePath, content] of Object.entries(vfsMap)) {
      const language = getLanguageFromPath(filePath);
      await saveBlueprintFile(id, filePath, content, language);
      savedFiles.push({ path: filePath, content, language });
    }

    return res.json({
      success: true,
      data: {
        id,
        files: savedFiles,
        fileTree: vfsMap,
      },
    });
  } catch (err: any) {
    console.error('[VFS Init Error]', err);
    return res.status(500).json({ error: err.message || 'Failed to initialize VFS workspace' });
  }
});

/**
 * GET /api/blueprints/:id/vfs
 * Get all stored VFS files for a blueprint
 */
router.get('/:id/vfs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID is required' });
    }

    const files = await getBlueprintFiles(id);
    
    // Construct key-value fileTree dictionary
    const fileTree: Record<string, string> = {};
    for (const file of files) {
      fileTree[file.path] = file.content;
    }

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
    return res.status(500).json({ error: err.message || 'Failed to fetch VFS files' });
  }
});

/**
 * PUT /api/blueprints/:id/vfs/file
 * Update or create a single file in the VFS
 */
router.put('/:id/vfs/file', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { path, content } = req.body;

    if (!id || !path || content === undefined) {
      return res.status(400).json({ error: 'Blueprint ID, path, and content are required' });
    }

    const language = getLanguageFromPath(path);
    await saveBlueprintFile(id, path, content, language);

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
    console.error('[VFS File Update Error]', err);
    return res.status(500).json({ error: err.message || 'Failed to update VFS file' });
  }
});

export default router;
