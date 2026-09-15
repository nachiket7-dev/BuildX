# Frontend upgrade — 9 September 2026

This records the first frontend pass. The subsequent animated visual upgrade restores the brand entrance and replaces the static Atlas illustration; see [the current delivery and validation notes](FRONTEND_VISUAL_UPGRADE.md).

The landing page is now a product showcase. Its Atlas workspace is static HTML/CSS, with no prompt input, generation action, editor engine, or live iframe. Launch Studio opens the separate working composer at `/create`.

## Delivered

- Rebuilt the landing composition, capability illustrations, workflow, project examples, FAQ, and footer in the existing obsidian/violet palette.
- Added a focused creation form with labeled stack choices, validation, duplicate-submit protection, and a session draft retained through sign-in.
- Updated the gallery with actual artifact counts, search/category/complexity filters, clear project links, and accessible preview dialogs.
- Replaced commit-style blueprint headings with project identity, useful facts, and owner workspace access.
- Refined sign-in/sign-up screens and return destinations, including the `/signup` alias.
- Corrected guest sidebar spacing; added mobile navigation and focus-managed project history.
- Consolidated shared controls, connected theme tokens, and added `/__components` for development-only checks. Dialogs trap focus, support Escape, and restore focus to their opener.
- Added desktop panel resizing and Files / Code / Preview / Agent navigation for smaller workspace screens. Preserved raw CodeMirror diff mounts and existing change-review behavior.
- Added serial per-file save queues, save status, failure retry, a warning on closing with unsaved work, and flushing queued writes on route teardown. Corrected the editor overlap that blocked save-status controls.
- Restricted exports to valid saved project context and appropriate ownership, removed synthetic success paths, and separated ZIP, preview links, and GitHub export.
- Added retryable session verification failures, account-scoped personal list caches, project-scoped VFS lifetime, route error boundaries, and workspace load errors.
- Deferred workspace/editor/diagram code, removed the landing preloader, honored reduced motion, and removed duplicate/unused font requests.
- Updated the React Vite plugin to 6.1.1 for the installed Vite 8, following the [Vite 8 release guidance](https://vite.dev/blog/announcing-vite8). Added Prettier for source formatting.

## Validation

| Check | Result |
| --- | --- |
| Frontend production build | Pass |
| Frontend lint | Pass, zero warnings; warning limit now zero |
| Frontend regression tests | 7 pass |
| Existing backend tests | 8 pass |
| Landing widths: 360, 390, 768, 1024, 1440 | No page-wide overflow; no prompt inputs or operative demo controls |
| Workspace widths: 360, 390, 768, 1024, 1440 | No page-wide overflow; phone panel switching checked |
| Gallery | Public projects load; search/no-match state and preview dialog checked |
| Modal keyboard behavior | Focus containment, Escape dismissal, and return to opener checked |
| Creation draft | Prompt and Express selection survive the sign-in round trip |
| Isolated owner workspace | File switching, delayed/failed save retry, persisted content, diff accept/reject, keyboard resizing, and export prerequisites checked |
| Main JS entry | Approximately 530 KB → 116 KB gzip (about 78% smaller) |
| CSS bundle | Approximately 30 KB gzip |

The bundle figure is the main JavaScript entry, not all deferred chunks. The workspace still has substantial editor, preview, and diagram dependencies, loaded when needed.

## Reproduce

```sh
npm run build --workspace=frontend
npm run lint --workspace=frontend
npm test --workspace=frontend
npm test --workspace=backend
npm run test:workspace --workspace=frontend
```

The last command runs a disposable fixture server at `http://localhost:5190/agent/qa-workspace`. Sign in with `qa@example.test` and any nonempty password. It creates no account and intercepts all API requests locally. The first file save intentionally fails; Retry should save the same edit. Reload verifies persistence during that server session. The development-only Test Diff button exercises accept/reject without calling an AI provider. Stop the process to discard its in-memory data.

## Validation limits

Live AI generation, real account switching, GitHub OAuth/publishing, and successful real export artifacts were not exercised. The owner-workspace checks use the isolated fixture server; they do not certify those external integrations. Browser 200% zoom and an OS-level reduced-motion toggle were not exercised. Reduced-motion support was implemented in CSS, MotionConfig, and Aurora initialization.

Failed edits remain available while the workspace is mounted; this is not an offline draft store. Before closing or signing out, resolve any save failure. Normal route teardown attempts to flush pending saves, but a failed network write after leaving cannot be retried from the departed view.
