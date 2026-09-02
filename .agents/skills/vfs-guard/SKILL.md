---
name: vfs-guard
description: Triggers whenever reading, editing, or creating files in frontend/src/ or updating Virtual File System (VFS) context state.
---

# Goal
Prevent file wipes, state corruption, and hallucinated npm imports during code generation.

# Rules
1. **Read Before Editing:** Always inspect existing file contents in `frontend/src/` before proposing changes. Never emit placeholders like `// ... rest of code stays the same`.
2. **Buffer Edits:** Direct code changes to `vfs.stageDiff()` rather than mutating `vfs.files` directly.
3. **Import Check:** Cross-reference imported modules against `frontend/package.json`. Use browser/React primitives if a package is uninstalled.
