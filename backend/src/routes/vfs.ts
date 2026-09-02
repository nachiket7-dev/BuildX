import { Router, Request, Response } from 'express';
import { generateVFSFromBlueprint, getLanguageFromPath } from '../services/vfsService';
import { enhanceVfsUi } from '../services/uiEnhancerService';
import { generateFrontendPage } from '../lib/scaffold';
import {
  getBlueprintForUser,
  getBlueprintOwnedByUser,
  getBlueprintFiles,
  saveBlueprintFile,
  clearBlueprintFiles,
} from '../lib/db';
import { isPlausibleSourceCode } from '../lib/codegen/skeletonizer';
import { optionalAuth, requireAuth } from '../lib/auth';

const router = Router();

/**
 * POST /api/blueprints/:id/vfs/init
 * Initialize or re-generate VFS file tree for a blueprint
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
    return res.status(500).json({ error: 'Failed to initialize VFS workspace' });
  }
});

/**
 * GET /api/blueprints/:id/vfs
 * Get all stored VFS files for a blueprint with universal auto-heal validation
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

    const canPersist = Boolean(req.user?.userId && blueprint.userId === req.user.userId);
    let files = await getBlueprintFiles(id);
    const appFile = files.find(f => f.path === 'frontend/src/App.tsx' || f.path === 'src/App.tsx');
    const isAppCorrupt = appFile && !isPlausibleSourceCode(appFile.content, 'App.tsx');

    // Universal Auto-Heal: If files are missing OR core App.tsx is corrupt/prose, regenerate from spec
    if (files.length === 0 || !appFile || isAppCorrupt) {
      const vfsMap = generateVFSFromBlueprint(blueprint.parsedBlueprint);
      const generatedFiles = Object.entries(vfsMap).map(([filePath, content]) => ({
        path: filePath,
        content,
        language: getLanguageFromPath(filePath),
      }));

      if (canPersist) {
        await clearBlueprintFiles(id);
        for (const file of generatedFiles) {
          await saveBlueprintFile(id, file.path, file.content, file.language);
        }
      }
      files = generatedFiles;
    }
    
    // Universal Page Auto-Heal: Upgrade skeleton/placeholder pages to full interactive React screens
    const screens = blueprint.parsedBlueprint?.screens || [];
    for (const file of files) {
      if (file.path.includes('pages/') && (file.content.includes('Components needed:') || file.content.includes('Implement:') || file.content.includes('Example record'))) {
        const matchingScreen = screens.find((s: any) => {
          const cleanName = s.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const cleanPath = file.path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return cleanPath.includes(cleanName);
        }) || { name: file.path.split('/').pop()?.replace(/Page\.tsx|\.tsx/, '') || 'Overview', icon: '•', components: '' };

        const richPageCode = generateFrontendPage(matchingScreen, blueprint.parsedBlueprint);
        file.content = richPageCode;
        if (canPersist) {
          saveBlueprintFile(id, file.path, richPageCode, file.language).catch(() => {});
        }
      }
    }

    // Construct key-value fileTree dictionary with automatic JSON-wrapper unpacking
    const fileTree: Record<string, string> = {};
    for (const file of files) {
      let content = file.content;
      // Auto-unpack accidental JSON wrappers in non-JSON source files
      if (!file.path.endsWith('.json') && content.startsWith('{') && (content.includes('"content"') || content.includes('"filePath"'))) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.content === 'string') {
            content = parsed.content;
            // Update database so it's clean permanently
            if (canPersist) {
              saveBlueprintFile(id, file.path, content, file.language).catch(() => {});
            }
          }
        } catch {}
      }
      fileTree[file.path] = content;
      file.content = content;
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
    const { path, content } = req.body ?? {};

    if (
      !id ||
      typeof path !== 'string' ||
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
