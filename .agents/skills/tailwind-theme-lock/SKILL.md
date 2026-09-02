---
name: tailwind-theme-lock
description: Triggers whenever styling UI components, adjusting layout colors, or modifying Tailwind CSS utility classes.
---

# Goal
Protect the Obsidian dark theme palette and ensure compatibility with Sandpack live preview execution.

# Rules
1. **Palette Tokens:** Use standard compiled Tailwind classes (`bg-slate-900`, `bg-zinc-900`, `border-slate-800`, `text-emerald-400`).
2. **No Arbitrary Classes:** Avoid uncompiled arbitrary syntax like `bg-[#13151a]` unless wrapped in explicit inline CSS rules in `index.css`.
3. **Preview Safety:** Ensure preview styling relies on the Tailwind runtime injected inside `LivePreview.tsx`.
