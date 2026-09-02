---
name: pr-autofix
description: Triggers when addressing CodeRabbit PR review suggestions, GitHub CLI issues, or failed build logs.
---

# Goal
Apply automated surgical patches based on external PR feedback or CI log inspection.

# Rules
1. **Targeted Scope:** Apply minimal line-level fixes addressing only the flagged issue.
2. **Verification:** Run `npx tsc --noEmit` or `npm run lint` locally before confirming the resolution.
