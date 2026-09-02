---
name: codemirror-diff-engine
description: Triggers when modifying CodeStudio.tsx, CodeMirror 6 extensions, or inline diff highlighting logic.
---

# Goal
Ensure `@codemirror/merge` (`unifiedMergeView`) mounts cleanly without hitting React wrapper stale-state bugs.

# Rules
1. **Raw DOM Binding:** Instantiate `unifiedMergeView` on a raw `div` container reference inside a `useEffect` hook.
2. **Re-key Container:** Apply a dynamic React `key` prop (`diff-${activeFile}-${Date.now()}`) to force CodeMirror re-instantiation when toggling diff mode.
3. **Style Verification:** Verify `.cm-insertedLine` (emerald) and `.cm-deletedLine` (red strikethrough) rules exist in `frontend/src/index.css`.
