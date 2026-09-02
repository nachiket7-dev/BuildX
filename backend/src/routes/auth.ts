import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByEmail,
  getUserById,
  listUserBlueprints,
  renameBlueprint,
  deleteBlueprint,
  getUserByGithubId,
  createGithubUser,
  linkUserGithub,
  getChatMessages
} from '../lib/db';
import { generateToken, requireAuth } from '../lib/auth';

const router = Router();

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal as any,
  }).finally(() => clearTimeout(id));
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/signup
// Body: { name, email, password }
// Returns: { success, token, user: { id, name, email } }
// ─────────────────────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  // Validate
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Name must be at least 2 characters' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  try {
    // Check if email already exists inside the guarded block so database
    // outages are converted into a controlled response.
    const existing = await getUserByEmail(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = await createUser(name.trim(), email.toLowerCase().trim(), hashedPassword);

    const token = generateToken({ userId: id, email: email.toLowerCase().trim() });

    console.log(`[Auth] New user: ${name.trim()} (${email.toLowerCase().trim()})`);
    res.status(201).json({
      success: true,
      token,
      user: { id, name: name.trim(), email: email.toLowerCase().trim() },
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    console.error('[Auth] Signup error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Returns: { success, token, user: { id, name, email } }
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    console.log(`[Auth] Login: ${user.name} (${user.email})`);
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[Auth] Login error:', (err as Error).message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// Headers: Authorization: Bearer <token>
// Returns: { success, user: { id, name, email } }
// ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        githubLinked: Boolean(user.githubId),
      },
    });
  } catch (err) {
    console.error('[Auth] /me error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/my-blueprints
// Headers: Authorization: Bearer <token>
// Returns: { success, data: BlueprintListItem[] }
// ─────────────────────────────────────────────────────────────
router.get('/my-blueprints', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await listUserBlueprints(req.user!.userId);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[Auth] my-blueprints error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to load blueprints' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/chat/:id
// Headers: Authorization: Bearer <token>
// Returns: { success, data: ChatMessageRow[] }
// ─────────────────────────────────────────────────────────────
router.get('/chat/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await getChatMessages(req.params.id, req.user!.userId);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[Auth] chat history error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});


// Body: { title: string }
// ─────────────────────────────────────────────────────────────
router.patch('/blueprint/:id/rename', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length < 1) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  try {
    const ok = await renameBlueprint(req.params.id, req.user!.userId, title.trim());
    if (!ok) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] rename error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to rename blueprint' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/auth/blueprint/:id
// ─────────────────────────────────────────────────────────────
router.delete('/blueprint/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await deleteBlueprint(req.params.id, req.user!.userId);
    if (!ok) {
      res.status(404).json({ error: 'Blueprint not found or not owned by you' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('[Auth] delete error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to delete blueprint' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/github/callback
// Body: { code }
// Returns: { success, token, user: { id, name, email } }
// ─────────────────────────────────────────────────────────────
router.post('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, redirect_uri } = req.body;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'OAuth authorization code is required' });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Auth] GitHub OAuth credentials not configured on backend');
    res.status(500).json({ error: 'GitHub OAuth is not configured on the server' });
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };
    if (redirect_uri) {
      tokenBody.redirect_uri = redirect_uri;
    }

    const tokenRes = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenBody),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.statusText}`);
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to obtain access token');
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const userRes = await fetchWithTimeout('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BuildX-App',
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.statusText}`);
    }

    const userData = await userRes.json() as { id: number; login: string; name?: string; email?: string | null };
    const githubId = String(userData.id);
    const githubName = userData.name || userData.login;

    // 3. Fetch user emails (if primary email is private or null)
    let email = userData.email || '';
    if (!email) {
      const emailsRes = await fetchWithTimeout('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'BuildX-App',
        },
      });
      if (emailsRes.ok) {
        const emailsData = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primaryEmail = emailsData.find((e) => e.primary && e.verified) || emailsData.find((e) => e.verified);
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      res.status(400).json({ error: 'A verified primary email is required on your GitHub account' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 4. Authenticate user
    let user = await getUserByGithubId(githubId);
    
    if (user) {
      // User exists with this GitHub account — update/refresh token
      await linkUserGithub(user.id, githubId, accessToken);
    } else {
      // Check if a user with this email already exists
      const existingUser = await getUserByEmail(normalizedEmail);
      if (existingUser) {
        if (existingUser.githubId && existingUser.githubId !== githubId) {
          res.status(409).json({ error: 'This email is already linked to a different GitHub account' });
          return;
        }
        // Link GitHub to this existing email account
        await linkUserGithub(existingUser.id, githubId, accessToken);
        user = await getUserByGithubId(githubId);
      } else {
        // Create new user
        await createGithubUser(githubName, normalizedEmail, githubId, accessToken);
        user = await getUserByGithubId(githubId);
      }
    }

    if (!user) {
      throw new Error('Failed to retrieve user record after authentication');
    }

    const token = generateToken({ userId: user.id, email: user.email });

    console.log(`[Auth] GitHub Login: ${user.name} (${user.email})`);
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error('[Auth] GitHub OAuth error:', errMsg);
    res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/github/link
// Headers: Authorization: Bearer <token>
// Body: { code }
// Links a GitHub account to the currently authenticated user
// ─────────────────────────────────────────────────────────────
router.post('/github/link', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code, redirect_uri } = req.body;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'OAuth authorization code is required' });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Auth] GitHub OAuth credentials not configured on backend');
    res.status(500).json({ error: 'GitHub OAuth is not configured on the server' });
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };
    if (redirect_uri) {
      tokenBody.redirect_uri = redirect_uri;
    }

    const tokenRes = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenBody),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.statusText}`);
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to obtain access token');
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch GitHub user profile
    const userRes = await fetchWithTimeout('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BuildX-App',
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.statusText}`);
    }

    const userData = await userRes.json() as { id: number; login: string };
    const githubId = String(userData.id);

    // 3. Check if this GitHub account is already linked to another user
    const existingGhUser = await getUserByGithubId(githubId);
    if (existingGhUser && existingGhUser.id !== req.user!.userId) {
      res.status(409).json({ error: 'This GitHub account is already linked to a different BuildX account' });
      return;
    }

    // 4. Link to current user
    await linkUserGithub(req.user!.userId, githubId, accessToken);

    console.log(`[Auth] GitHub linked for user ${req.user!.userId}`);
    res.json({ success: true, githubLinked: true });
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error('[Auth] GitHub link error:', errMsg);
    res.status(500).json({ error: 'Failed to link GitHub account' });
  }
});

export default router;
