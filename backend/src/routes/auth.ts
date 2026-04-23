import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserById, listUserBlueprints, renameBlueprint, deleteBlueprint, claimUnownedBlueprints } from '../lib/db';
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
  const existing = getUserByEmail(email.toLowerCase().trim());
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = createUser(name.trim(), email.toLowerCase().trim(), hashedPassword);

    // Claim any blueprints created before auth was added
    const claimed = claimUnownedBlueprints(id);
    const token = generateToken({ userId: id, email: email.toLowerCase().trim() });

    console.log(`[Auth] New user: ${name.trim()} (${email.toLowerCase().trim()})${claimed ? ` — claimed ${claimed} blueprints` : ''}`);
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

  const user = getUserByEmail(email.toLowerCase().trim());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Claim any blueprints created before auth was added
  const claimed = claimUnownedBlueprints(user.id);
  const token = generateToken({ userId: user.id, email: user.email });

  console.log(`[Auth] Login: ${user.name} (${user.email})${claimed ? ` — claimed ${claimed} blueprints` : ''}`);
  res.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// Headers: Authorization: Bearer <token>
// Returns: { success, user: { id, name, email } }
// ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  const user = getUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Claim any unclaimed blueprints on every auth check
  claimUnownedBlueprints(req.user!.userId);

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
router.get('/my-blueprints', requireAuth, (req: Request, res: Response): void => {
  const items = listUserBlueprints(req.user!.userId);
  res.json({ success: true, data: items });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/auth/blueprint/:id/rename
// Body: { title: string }
// ─────────────────────────────────────────────────────────────
router.patch('/blueprint/:id/rename', requireAuth, (req: Request, res: Response): void => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length < 1) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  const ok = renameBlueprint(req.params.id, req.user!.userId, title.trim());
  if (!ok) {
    res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    return;
  }
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/auth/blueprint/:id
// ─────────────────────────────────────────────────────────────
router.delete('/blueprint/:id', requireAuth, (req: Request, res: Response): void => {
  const ok = deleteBlueprint(req.params.id, req.user!.userId);
  if (!ok) {
    res.status(404).json({ error: 'Blueprint not found or not owned by you' });
    return;
  }
  res.json({ success: true });
});

export default router;
