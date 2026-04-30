import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserById, listUserBlueprints, renameBlueprint, deleteBlueprint } from '../lib/db';
import { generateToken, requireAuth } from '../lib/auth';

const router = Router();

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

  // Check if email already exists
  const existing = await getUserByEmail(email.toLowerCase().trim());
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  try {
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
  const user = await getUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
  });
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
// PATCH /api/auth/blueprint/:id/rename
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

export default router;
