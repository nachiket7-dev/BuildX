import { Router, Request, Response, NextFunction } from 'express';
import { BlueprintRequestSchema, BlueprintSchema, type Blueprint } from '../lib/types';
import { generateBlueprintAgentic, runAgenticBlueprintPipeline } from '../lib/orchestrator';
import { generateApplicationCode } from '../lib/codegen/agent';
import { generatePreviewHtml, buildDeterministicPreview } from '../lib/codegen/preview';
import {
  saveBlueprint,
  getBlueprintForUser,
  getBlueprintOwnedByUser,
  getBlueprintMeta,
  listBlueprints,
  getUsageCount,
  assertWithinUsageLimit,
  incrementUsage,
  updateBlueprintVisibility,
  updateBlueprintJson,
  getUserById,
  saveBlueprintFile,
  getBlueprintAny,
  getBlueprintFiles,
  getBlueprintFile,
  clearBlueprintFiles,
} from '../lib/db';
import { initSSE, sendSSE, endSSE } from '../lib/stream';
import { streamScaffoldZip, generateMonorepoFiles } from '../lib/scaffold';
import { refineBlueprint } from '../lib/refine';
import { coerceBlueprintInput } from '../lib/normalizeBlueprint';
import {
  resolveModelId,
  isPremiumModel,
  getProviderHealth,
} from '../lib/llm/router';
import { generatePreviewToken, isValidPreviewToken, requireAuth, optionalAuth } from '../lib/auth';
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


const GPT_OSS_DAILY_LIMIT = 5;

function attachModelMeta(blueprint: Blueprint, model?: string): Blueprint {
  // The pipeline records the provider/model that actually completed the first
  // stage. Preserve it instead of relabeling the result with the request key.
  return blueprint.modelUsed ? blueprint : model ? { ...blueprint, modelUsed: model } : blueprint;
}

async function assertPremiumUsageAllowed(userId: string, model?: string): Promise<void> {
  if (!isPremiumModel(model)) return;
  const modelId = resolveModelId(model);
  const count = await getUsageCount(userId, modelId);
  assertWithinUsageLimit(count, modelId, GPT_OSS_DAILY_LIMIT);
}

async function recordPremiumUsageIfNeeded(userId: string, model?: string): Promise<void> {
  if (!isPremiumModel(model)) return;
  await incrementUsage(userId, resolveModelId(model));
}

function isClientAborted(req: Request): boolean {
  return Boolean(req.aborted || (req.socket as { destroyed?: boolean }).destroyed);
}

/** Detects LLM rate-limit / token / quota errors across providers. */
function isLLMRateLimit(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('tokens per minute') ||
    m.includes('tpm') ||
    m.includes('token limit') ||
    m.includes('quota') ||
    m.includes('resourceexhausted') ||
    m.includes('too many requests') ||
    m.includes('too large') ||
    m.includes('maximum context length') ||
    (m.includes('reduce') && m.includes('max_tokens'))
  );
}

/** Converts raw LLM SDK error text into a clear, actionable user message. */
function toFriendlyLLMError(message: string, model?: string): string {
  if (isLLMRateLimit(message)) {
    return (
      'The AI provider hit a token or rate limit for this request. ' +
      'Wait ~60 seconds and try again, or switch to a smaller/faster model (e.g. Gemini 3.5 Flash).'
    );
  }

  const lower = message.toLowerCase();
  if (lower.includes('api key') || message.includes('401')) {
    if (model?.startsWith('gemini') || lower.includes('gemini')) {
      return 'Gemini authentication failed. Verify GEMINI_API_KEY on the server.';
    }
    if (model?.includes('nemotron') || lower.includes('nvidia')) {
      return 'NVIDIA authentication failed. Verify NVIDIA_API_KEY on the server.';
    }
    return 'Groq authentication failed. Verify GROQ_API_KEY on the server.';
  }

  return message;
}

function validateBlueprintId(id: string): boolean {
  return Boolean(id && id.length >= 6 && id.length <= 16);
}

// Public health check (no auth)
router.get('/health', (_req: Request, res: Response) => {
  const providers = getProviderHealth();
  const configured = Object.values(providers).filter((p) => p.configured);
  res.json({
    service: 'blueprint',
    ready: configured.length > 0,
    providers,
    message: configured.length > 0
      ? `${configured.map((p) => p.label).join(', ')} configured`
      : 'No LLM API keys configured — add GROQ_API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY',
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

    const { idea, model, stack } = parseResult.data;
    const userId = req.user!.userId;
    console.log(`[Blueprint] Generating for idea: "${idea.slice(0, 80)}..." with stack:`, stack);

    try {
      await assertPremiumUsageAllowed(userId, model);
      const blueprint = await runAgenticBlueprintPipeline(idea, model, undefined, stack);
      const id = await saveBlueprint(idea, attachModelMeta(blueprint, model), userId, false);
      await recordPremiumUsageIfNeeded(userId, model);
      console.log(`[Blueprint] Success: ${blueprint.appName} (id: ${id})`);
      console.log('--- GENERATED BLUEPRINT LAYOUT ---', { id, layoutParadigm: blueprint.layoutParadigm, productArchetype: blueprint.productArchetype });
      res.json({ success: true, data: attachModelMeta(blueprint, model), id });
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

  const { idea, model, stack } = parseResult.data;
  const userId = req.user!.userId;
  console.log(`[Blueprint:stream] Generating for idea: "${idea.slice(0, 80)}..." with stack:`, stack);

  try {
    await assertPremiumUsageAllowed(userId, model);
    const blueprint = await generateBlueprintAgentic(idea, res, model, stack);

    // Unconditional DB persistence: generated blueprint specs are always preserved
    try {
      const id = await saveBlueprint(idea, attachModelMeta(blueprint, model), userId, false);
      await recordPremiumUsageIfNeeded(userId, model);
      console.log(`[Blueprint:stream] Success: ${blueprint.appName} (id: ${id})`);
      console.log('--- GENERATED BLUEPRINT LAYOUT ---', { id, layoutParadigm: blueprint.layoutParadigm, productArchetype: blueprint.productArchetype });
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
    const friendlyMessage = toFriendlyLLMError(rawMessage, model);
    if (res.headersSent && !res.writableEnded) {
      sendSSE(res, 'error', { message: friendlyMessage });
      endSSE(res);
    } else if (!res.headersSent) {
      const status = isLLMRateLimit(rawMessage) ? 429 : 500;
      res.status(status).json({ error: friendlyMessage });
    }
  }
});

/** Triggers streaming file-by-file code generation for a blueprint */
router.post('/:id/codegen', requireAuth, blueprintLimiter, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { model } = req.body;

  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    await assertPremiumUsageAllowed(req.user!.userId, model);

    // Set up SSE streaming response — extend socket timeout for large models (Nemotron 550B etc.)
    req.socket.setTimeout(10 * 60 * 1000); // 10 minutes
    initSSE(res);

    // Run the codegen agent
    await generateApplicationCode(id, blueprint.parsedBlueprint, res, model);
    await recordPremiumUsageIfNeeded(req.user!.userId, model);
    
    // Close SSE connection
    endSSE(res);
  } catch (err: any) {
    console.error('[Codegen Route] Error:', err.message);
    const message = 'Code generation failed. Please try again.';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else if (!res.writableEnded) {
      sendSSE(res, 'error', { message });
      endSSE(res);
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
    const { blueprint, id: blueprintId } = req.body;
    if (!blueprint || typeof blueprint !== 'object') {
      res.status(400).json({ error: 'Blueprint data is required for exporting' });
      return;
    }

    const userId = req.user!.userId;
    const userRecord = await getUserById(userId);

    if (!userRecord || !userRecord.githubToken) {
      res.status(400).json({
        error: 'Your GitHub account is not linked. Please connect with GitHub to export repositories.',
        require_github_auth: true
      });
      return;
    }

    const githubToken = userRecord.githubToken;
    const baseRepoName = blueprint.appName
      ? blueprint.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'generated-scaffold';

    console.log(`[GitHub Export] Starting export for "${blueprint.appName}" to GitHub...`);

    // 1. Get user profile and verify token scopes
    const userProfileRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!userProfileRes.ok) {
      if (userProfileRes.status === 401) {
        throw new Error('Your GitHub token has expired. Please re-link your GitHub account from the user menu.');
      }
      throw new Error(`Failed to fetch GitHub profile: ${userProfileRes.statusText}`);
    }

    // Check that the token has repo scope
    const tokenScopes = userProfileRes.headers.get('x-oauth-scopes') || '';
    if (!tokenScopes.includes('repo')) {
      throw new Error('Your GitHub token does not have repository access. Please re-link your GitHub account to grant the "repo" permission.');
    }

    const userProfile = await userProfileRes.json() as { login: string };
    const owner = userProfile.login;
    let repoOwner = owner;

    // 2. Create the repository on GitHub (handle name conflicts) or verify existing
    let createdRepoName = '';
    let repoHtmlUrl = '';
    let defaultBranch = 'main';
    let isExistingRepo = false;

    // Check if the blueprint already has a githubUrl
    if (blueprint.githubUrl) {
      // Try to parse owner and repo name from the githubUrl
      // Format: https://github.com/owner/repo
      const match = blueprint.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const urlOwner = match[1];
        const urlRepo = match[2].replace(/\.git$/, '');

        console.log(`[GitHub Export] Found existing repository in blueprint: ${urlOwner}/${urlRepo}. Verifying accessibility...`);
        const checkRepoRes = await fetch(`https://api.github.com/repos/${urlOwner}/${urlRepo}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'BuildX-App',
            'Accept': 'application/vnd.github.v3+json',
          }
        });

        if (checkRepoRes.ok) {
          const checkRepoInfo = await checkRepoRes.json() as { name: string; default_branch?: string; html_url: string };
          createdRepoName = checkRepoInfo.name;
          repoHtmlUrl = checkRepoInfo.html_url;
          defaultBranch = checkRepoInfo.default_branch || 'main';
          isExistingRepo = true;
          repoOwner = urlOwner;
          console.log(`[GitHub Export] Verified existing repository: ${repoOwner}/${createdRepoName}. Will push updates to it.`);
        } else {
          console.log(`[GitHub Export] Existing repository not accessible or deleted (status: ${checkRepoRes.status}). Will create a new repository.`);
        }
      }
    }

    if (!isExistingRepo) {
      let repoName = baseRepoName;
      let createRepoRes: globalThis.Response | null = null;
      let repoCreated = false;

      for (let attempt = 0; attempt < 5; attempt++) {
        const candidateName = attempt === 0 ? repoName : `${baseRepoName}-${attempt}`;
        createRepoRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'BuildX-App',
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            name: candidateName,
            description: (blueprint.description || 'Scaffolded by BuildX AI App Architect').slice(0, 350),
            auto_init: true,
            private: true
          })
        });

        if (createRepoRes.ok) {
          repoName = candidateName;
          repoCreated = true;
          break;
        }

        // Check if it's a name conflict (422 with "name already exists")
        const errData = await createRepoRes.json() as { message?: string; errors?: Array<{ message?: string }> };
        const isNameConflict = createRepoRes.status === 422 &&
          (errData.errors?.some(e => e.message?.includes('name already exists')) ||
           errData.message?.includes('name already exists'));

        if (!isNameConflict) {
          // Not a name conflict — real error, throw immediately
          const details = errData.errors?.map(e => e.message).join('; ') || '';
          throw new Error(`Failed to create repository "${candidateName}": ${errData.message || createRepoRes.statusText}${details ? ` (${details})` : ''}`);
        }

        console.log(`[GitHub Export] Repo "${candidateName}" already exists, trying next name...`);
      }

      if (!repoCreated || !createRepoRes) {
        throw new Error(`Could not create repository — all name variants of "${baseRepoName}" already exist on your GitHub account.`);
      }

      const repoInfo = await createRepoRes.json() as { html_url: string; name: string; default_branch?: string };
      createdRepoName = repoInfo.name;
      repoHtmlUrl = repoInfo.html_url;
      defaultBranch = repoInfo.default_branch || 'main';

      // Wait a brief moment to let GitHub propagate branch creation
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // 3. Get the latest commit ref on heads/defaultBranch
    const refRes = await fetch(`https://api.github.com/repos/${repoOwner}/${createdRepoName}/git/refs/heads/${defaultBranch}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!refRes.ok) {
      throw new Error(`Failed to fetch ${defaultBranch} branch ref: ${refRes.statusText}`);
    }

    const refData = await refRes.json() as { object: { sha: string } };
    const baseCommitSha = refData.object.sha;

    // Get the tree SHA of that commit
    const commitRes = await fetch(`https://api.github.com/repos/${repoOwner}/${createdRepoName}/git/commits/${baseCommitSha}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    if (!commitRes.ok) {
      throw new Error(`Failed to fetch commit tree: ${commitRes.statusText}`);
    }
    const commitData = await commitRes.json() as { tree: { sha: string } };
    const baseTreeSha = commitData.tree.sha;

    // 4. Generate monorepo files dictionary
    const files = generateMonorepoFiles(blueprint);

    // 5. Create a new Git Tree with all files
    const treeEntries = Object.entries(files).map(([filepath, content]) => ({
      path: filepath,
      mode: '100644',
      type: 'blob',
      content: content
    }));

    const createTreeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${createdRepoName}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries
      })
    });

    if (!createTreeRes.ok) {
      const errData = await createTreeRes.json() as { message?: string };
      throw new Error(`Failed to create Git Tree: ${errData.message || createTreeRes.statusText}`);
    }
    const treeData = await createTreeRes.json() as { sha: string };
    const newTreeSha = treeData.sha;

    // 6. Create a commit pointing to the new tree
    const createCommitRes = await fetch(`https://api.github.com/repos/${repoOwner}/${createdRepoName}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: isExistingRepo
          ? 'Refined project scaffold update by BuildX AI App Architect'
          : 'Initial project scaffold generated by BuildX AI App Architect',
        tree: newTreeSha,
        parents: [baseCommitSha]
      })
    });

    if (!createCommitRes.ok) {
      throw new Error(`Failed to create commit: ${createCommitRes.statusText}`);
    }
    const newCommitData = await createCommitRes.json() as { sha: string };
    const newCommitSha = newCommitData.sha;

    // 7. Update reference heads/defaultBranch to point to the new commit
    const updateRefRes = await fetch(`https://api.github.com/repos/${repoOwner}/${createdRepoName}/git/refs/heads/${defaultBranch}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BuildX-App',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });

    if (!updateRefRes.ok) {
      throw new Error(`Failed to update ${defaultBranch} branch reference: ${updateRefRes.statusText}`);
    }

    console.log(`[GitHub Export] Successfully exported "${blueprint.appName}" to: ${repoHtmlUrl}`);

    // Update the blueprint JSON in database if it exists
    if (blueprintId) {
      try {
        const updatedBlueprint = { ...blueprint, githubUrl: repoHtmlUrl };
        await updateBlueprintJson(blueprintId, userId, updatedBlueprint);
      } catch (dbErr) {
        console.error('[GitHub Export] Failed to update blueprint with githubUrl:', dbErr);
      }
    }

    res.json({
      success: true,
      repoUrl: repoHtmlUrl,
      message: isExistingRepo
        ? 'Successfully pushed refined blueprint updates to your GitHub repository!'
        : 'Successfully exported scaffold code to GitHub repository!',
    });
  } catch (err) {
    console.error('[GitHub Export] Error:', (err as Error).message);
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message || 'Failed to export to GitHub' });
    }
  }
});

router.post('/check-github-repo', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { githubUrl, appName, id: blueprintId } = req.body;
    const userId = req.user!.userId;
    const userRecord = await getUserById(userId);
    if (!userRecord || !userRecord.githubToken) {
      res.json({ exists: false });
      return;
    }

    const githubToken = userRecord.githubToken;
    let exists = false;
    let resolvedUrl = '';

    // 1. If githubUrl is provided, check it first
    if (githubUrl && typeof githubUrl === 'string') {
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, '');

        const checkRepoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'BuildX-App',
            'Accept': 'application/vnd.github.v3+json',
          }
        });

        if (checkRepoRes.ok) {
          const repoInfo = await checkRepoRes.json() as { html_url: string };
          exists = true;
          resolvedUrl = repoInfo.html_url;
        }
      }
    }

    let isHeuristicMatch = false;

    // 2. If it did not exist or wasn't provided, try to find a repository with the default app name
    if (!exists && appName && typeof appName === 'string') {
      const userProfileRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${githubToken}`,
          'User-Agent': 'BuildX-App',
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (userProfileRes.ok) {
        const userProfile = await userProfileRes.json() as { login: string };
        const owner = userProfile.login;
        const defaultRepoName = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const checkRepoRes = await fetch(`https://api.github.com/repos/${owner}/${defaultRepoName}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'BuildX-App',
            'Accept': 'application/vnd.github.v3+json',
          }
        });

        if (checkRepoRes.ok) {
          const repoInfo = await checkRepoRes.json() as { html_url: string };
          exists = true;
          resolvedUrl = repoInfo.html_url;
          isHeuristicMatch = true;
          console.log(`[Check GitHub Repo] Self-healed/found repository for app "${appName}": ${resolvedUrl}`);
        }
      }
    }

    // 3. If we found a repository, self-heal/update the database blueprint record with the githubUrl
    if (exists && resolvedUrl && blueprintId && !isHeuristicMatch) {
      try {
        const blueprintRecord = await getBlueprintOwnedByUser(blueprintId, userId);
        if (blueprintRecord && !blueprintRecord.parsedBlueprint.githubUrl) {
          const updatedBlueprint = { ...blueprintRecord.parsedBlueprint, githubUrl: resolvedUrl };
          await updateBlueprintJson(blueprintId, userId, updatedBlueprint);
          console.log(`[Check GitHub Repo] Successfully updated blueprint ${blueprintId} database record with githubUrl: ${resolvedUrl}`);
        }
      } catch (dbErr) {
        console.error('[Check GitHub Repo] Database update error:', dbErr);
      }
    }

    res.json({ exists, repoUrl: resolvedUrl });
  } catch (err) {
    console.error('[Check GitHub Repo] Error:', (err as Error).message);
    res.json({ exists: false });
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

  const coercedBlueprint = coerceBlueprintInput(blueprint, { skipScaffoldRegen: true });

  if (blueprintId && !validateBlueprintId(blueprintId)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    if (blueprintId) {
      const ownedBlueprint = await getBlueprintOwnedByUser(blueprintId, userId);
      if (!ownedBlueprint) {
        res.status(404).json({ error: 'Blueprint not found or not owned by you' });
        return;
      }
    }

    await assertPremiumUsageAllowed(userId, model);
    const refined = await refineBlueprint(coercedBlueprint, message.trim(), model);
    const refinedWithModel = attachModelMeta(refined, model || coercedBlueprint.modelUsed);

    if (blueprintId) {
      const saved = await updateBlueprintJson(blueprintId, userId, refinedWithModel);
      if (!saved) {
        res.status(404).json({ error: 'Blueprint not found or not owned by you' });
        return;
      }
      await clearBlueprintFiles(blueprintId);
    }

    await recordPremiumUsageIfNeeded(userId, model);

    console.log(`[Refine] Success: ${refined.appName}`);
    res.json({ success: true, data: refinedWithModel });
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
    const friendly = toFriendlyLLMError(message, model);
    if (isLLMRateLimit(message)) {
      res.status(429).json({ error: friendly });
      return;
    }
    if (message.includes('API key') || message.includes('401') || message.includes('authentication')) {
      res.status(502).json({ error: friendly });
      return;
    }
    next(err);
  }
});

router.post('/regenerate-stream', requireAuth, blueprintLimiter, async (req: Request, res: Response): Promise<void> => {
  const { id: blueprintId, model } = req.body;
  const userId = req.user!.userId;

  if (!blueprintId || !validateBlueprintId(blueprintId)) {
    res.status(400).json({ error: 'Valid blueprint ID is required' });
    return;
  }

  try {
    const existing = await getBlueprintOwnedByUser(blueprintId, userId);
    if (!existing) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    const originalIdea = existing.idea;
    console.log(`[Regenerate:stream] Re-generating blueprint ${blueprintId} from idea: "${originalIdea.slice(0, 80)}..."`);

    await assertPremiumUsageAllowed(userId, model);
    const blueprint = await generateBlueprintAgentic(originalIdea, res, model);

    if (isClientAborted(req)) {
      return;
    }

    if (existing.parsedBlueprint.githubUrl) {
      blueprint.githubUrl = existing.parsedBlueprint.githubUrl;
    }

    const blueprintWithModel = attachModelMeta(blueprint, model || existing.parsedBlueprint.modelUsed);
    const saved = await updateBlueprintJson(blueprintId, userId, blueprintWithModel);
    if (!saved) {
      if (!res.writableEnded) {
        sendSSE(res, 'error', { message: 'Failed to save regenerated blueprint' });
        endSSE(res);
      }
      return;
    }

    await clearBlueprintFiles(blueprintId);
    await recordPremiumUsageIfNeeded(userId, model);

    console.log(`[Regenerate:stream] Success: ${blueprint.appName} (id: ${blueprintId})`);
    sendSSE(res, 'saved', { id: blueprintId });
    endSSE(res);
  } catch (err) {
    const rawMessage = (err as Error).message || 'Unknown error';
    console.error('[Regenerate:stream] Error:', rawMessage);
    if (rawMessage.includes('Daily limit')) {
      if (!res.headersSent) {
        res.status(429).json({ error: rawMessage });
      } else if (!res.writableEnded) {
        sendSSE(res, 'error', { message: rawMessage });
        endSSE(res);
      }
      return;
    }
    const friendlyMessage = toFriendlyLLMError(rawMessage, model);
    if (res.headersSent && !res.writableEnded) {
      sendSSE(res, 'error', { message: friendlyMessage });
      endSSE(res);
    } else if (!res.headersSent) {
      const status = isLLMRateLimit(rawMessage) ? 429 : 500;
      res.status(status).json({ error: friendlyMessage });
    }
  }
});

/** @deprecated Use POST /regenerate-stream — kept for backwards compatibility */
router.post('/regenerate', requireAuth, blueprintLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id: blueprintId, model } = req.body;
  const userId = req.user!.userId;

  if (!blueprintId || !validateBlueprintId(blueprintId)) {
    res.status(400).json({ error: 'Valid blueprint ID is required' });
    return;
  }

  try {
    const existing = await getBlueprintOwnedByUser(blueprintId, userId);
    if (!existing) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    const originalIdea = existing.idea;
    console.log(`[Regenerate] Re-generating blueprint ${blueprintId} from idea: "${originalIdea.slice(0, 80)}..."`);

    await assertPremiumUsageAllowed(userId, model);
    const blueprint = await runAgenticBlueprintPipeline(originalIdea, model);

    if (existing.parsedBlueprint.githubUrl) {
      blueprint.githubUrl = existing.parsedBlueprint.githubUrl;
    }

    const blueprintWithModel = attachModelMeta(blueprint, model || existing.parsedBlueprint.modelUsed);
    const saved = await updateBlueprintJson(blueprintId, userId, blueprintWithModel);
    if (!saved) {
      res.status(500).json({ error: 'Failed to save regenerated blueprint' });
      return;
    }

    await clearBlueprintFiles(blueprintId);
    await recordPremiumUsageIfNeeded(userId, model);

    console.log(`[Regenerate] Success: ${blueprint.appName} (id: ${blueprintId})`);
    res.json({ success: true, data: blueprintWithModel });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('Daily limit')) {
      res.status(429).json({ error: msg });
      return;
    }
    console.error('[Regenerate] Error:', msg);
    const friendly = toFriendlyLLMError(msg, model);
    if (isLLMRateLimit(msg)) {
      res.status(429).json({ error: friendly });
      return;
    }
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
        isOwner: Boolean(req.user?.userId && result.userId === req.user.userId),
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

// ─── Blueprint Files Storage API Endpoints ───────────────────

/** List all generated files for a blueprint (metadata only) */
router.get('/:id/files', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const meta = await getBlueprintMeta(id, req.user?.userId || '');
    if (!meta) {
      res.status(404).json({ error: 'Blueprint not found or access denied' });
      return;
    }

    const files = await getBlueprintFiles(id);
    const fileList = files.map(f => ({ path: f.path, language: f.language }));
    res.json({ success: true, data: { files: fileList } });
  } catch (err) {
    next(err);
  }
});

/** List all generated files with full contents (single request — avoids N+1) */
router.get('/:id/files/contents', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const meta = await getBlueprintMeta(id, req.user?.userId || '');
    if (!meta) {
      res.status(404).json({ error: 'Blueprint not found or access denied' });
      return;
    }

    const files = await getBlueprintFiles(id);
    res.json({ success: true, data: { files } });
  } catch (err) {
    next(err);
  }
});

/** Retrieve a single blueprint file's content */
router.get('/:id/files/*', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const filePath = req.params[0]; // Capture wildcard path matched by '*'

  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }
  if (!filePath) {
    res.status(400).json({ error: 'File path parameter is required' });
    return;
  }

  try {
    const meta = await getBlueprintMeta(id, req.user?.userId || '');
    if (!meta) {
      res.status(404).json({ error: 'Blueprint not found or access denied' });
      return;
    }

    const file = await getBlueprintFile(id, filePath);
    if (!file) {
      res.status(404).json({ error: `File not found: ${filePath}` });
      return;
    }

    res.json({ success: true, data: { file } });
  } catch (err) {
    next(err);
  }
});



// ─── Live Preview API Endpoints ──────────────────────────────

/** Fetch the compiled preview HTML page for the sandbox iframe */
router.get('/:id/preview', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const ownedOrPublicBlueprint = await getBlueprintForUser(id, req.user?.userId || '', { incrementViews: false });
    const previewToken = typeof req.query.token === 'string' ? req.query.token : '';
    const blueprint = ownedOrPublicBlueprint || (
      previewToken && isValidPreviewToken(previewToken, id)
        ? await getBlueprintAny(id)
        : null
    );
    if (!blueprint) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }

    console.log(`[Preview Route] Serving rich interactive UI preview for ${id}...`);
    const html = buildDeterministicPreview(blueprint.parsedBlueprint);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Preview-Source', 'deterministic');
    res.send(html);
  } catch (err: any) {
    console.error('[Preview Route] Error:', err.message);
    res.status(500).send('<html><body><h3>Preview Generation Failed</h3><p>Unable to generate preview.</p></body></html>');
  }
});

/** Create a short-lived URL that can be opened in a new tab or shared. */
router.post('/:id/preview/link', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
  if (!blueprint) {
    res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    return;
  }

  res.json({
    success: true,
    data: { path: `/api/blueprint/${id}/preview?token=${encodeURIComponent(generatePreviewToken(id))}` },
  });
});

/** Force-regenerate the preview HTML page */
router.post('/:id/preview/regenerate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { model } = req.body;

  if (!validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  try {
    const blueprint = await getBlueprintOwnedByUser(id, req.user!.userId);
    if (!blueprint) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    console.log(`[Preview Route] Regenerating preview.html for ${id}...`);
    const html = await generatePreviewHtml(blueprint.parsedBlueprint, model);
    await saveBlueprintFile(id, 'preview.html', html, 'html');

    res.json({ success: true, message: 'Preview regenerated successfully' });
  } catch (err: any) {
    console.error('[Preview Route] Regenerate Error:', err.message);
    res.status(500).json({ error: 'Failed to regenerate preview' });
  }
});

// ─── POST /:id/refine ──────────────────────────────────────────────────────
// Fetch blueprint from DB → mutate via LLM → persist → return updated spec.
router.post('/:id/refine', requireAuth, blueprintLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { prompt, model } = req.body as { prompt?: string; model?: string };
  const userId = req.user!.userId;

  // ── Validate ID ──────────────────────────────────────────────────────────
  if (!id || !validateBlueprintId(id)) {
    res.status(400).json({ error: 'Invalid blueprint ID' });
    return;
  }

  // ── Validate prompt ──────────────────────────────────────────────────────
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    res.status(400).json({
      error: 'Invalid request',
      details: [{ field: 'prompt', message: 'Refinement prompt must be at least 3 characters' }],
    });
    return;
  }

  if (prompt.length > 500) {
    res.status(400).json({
      error: 'Invalid request',
      details: [{ field: 'prompt', message: 'Refinement prompt must be under 500 characters' }],
    });
    return;
  }

  // ── Fetch existing blueprint from DB ─────────────────────────────────────
  const stored = await getBlueprintOwnedByUser(id, userId);
  if (!stored) {
    res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    return;
  }

  const existingBlueprint = stored.parsedBlueprint as Blueprint;
  if (!existingBlueprint || typeof existingBlueprint !== 'object') {
    res.status(422).json({ error: 'Stored blueprint spec is malformed' });
    return;
  }

  // ── LLM mutation call ────────────────────────────────────────────────────
  try {
    await assertPremiumUsageAllowed(userId, model);

    const coerced = coerceBlueprintInput(existingBlueprint, { skipScaffoldRegen: true });
    const refined = await refineBlueprint(coerced, prompt.trim(), model);
    const refinedWithModel = attachModelMeta(refined, model || coerced.modelUsed);

    // ── Persist updated spec ───────────────────────────────────────────────
    const saved = await updateBlueprintJson(id, userId, refinedWithModel);
    if (!saved) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }

    // Clear any stale generated files so next file-tree load regenerates fresh
    await clearBlueprintFiles(id);

    await recordPremiumUsageIfNeeded(userId, model);

    console.log(`[Refine/:id] Success id=${id} | app=${refined.appName}`);
    res.json({ success: true, blueprint: refinedWithModel });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('Daily limit')) {
      res.status(429).json({ error: msg });
      return;
    }
    console.error('[Refine/:id] Error:', msg);
    if (
      msg.includes('JSON') ||
      msg.includes('malformed') ||
      msg.includes('empty response') ||
      msg.includes('No valid JSON')
    ) {
      res.status(502).json({ error: msg });
      return;
    }
    const friendly = toFriendlyLLMError(msg, model);
    if (isLLMRateLimit(msg)) {
      res.status(429).json({ error: friendly });
      return;
    }
    if (msg.includes('API key') || msg.includes('401') || msg.includes('authentication')) {
      res.status(502).json({ error: friendly });
      return;
    }
    next(err);
  }
});

export default router;
