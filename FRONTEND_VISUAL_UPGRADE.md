# BuildX visual upgrade — implementation history

## Connected BX refinement

Refined the uppercase BX with a wider B, a connected upper shoulder, and a shared diagonal. A small violet terminal on the X is separated by a precise cut. Adjusted the wordmark weight and spacing and updated all shared logo placements, favicon, standalone SVG, and a monochrome SVG export. The loader traces the shoulder/diagonal once before the full mark settles; reduced motion displays the complete mark without tracing.

Checked the landing header and demo at desktop and 390 px with no horizontal overflow, and inspected the loader's initial stroke. Build, lint, and whitespace checks pass; existing bundle-size warnings remain. No dependencies were added.

## Shared page grid background

Added an opt-in CSS grid texture to the landing page, Studio/generation surface, Gallery, and sign-in/sign-up regions. It reuses the blueprint's 44 px spacing and faint violet lines, fading at the sides. It sits behind content, ignores pointer events, and adds no animation or dependency. Existing blueprint, loader, and OAuth callback grid backgrounds remain intact; neither agent route receives the new class.

Visually checked landing, Studio, Gallery, and sign-in, including sign-in at 390 px without horizontal overflow. Verified the agent workspace has no new grid layer. Build and lint pass, with the existing bundle-size warning.

## Logo revision: uppercase BX monogram

The X-only direction below is superseded by the user's request for both B and X. The current mark pairs an uppercase B with open, rounded counters and a sharp X of matching weight. Both letters use a single off-white fill, with no surrounding badge in the application. All shared Logo/BrandMark placements, the standalone SVG, and the favicon use the same geometry. The wider proportions are sized independently for navigation, the product demo, sign-in, and the startup entrance; existing reduced-motion support remains.

Visually checked the landing header and smaller demo mark on desktop and at 390 px. Both letters are readable and the mobile page has no horizontal overflow. Production build, lint, and whitespace checks pass; the existing bundle-size warning remains. No dependencies were added.

## Logo replacement: interlocking X

Replaced the rejected split-B symbol with an interlocking X formed by two diagonal structural beams. A narrow seam defines the crossing, with a single violet accent on the upper-right arm. The shape is centered on a 48 px grid and shared by every existing BrandMark/Logo consumer, the standalone SVG, and favicon. Startup now introduces the complete symbol with a brief fade/rise rather than separating its parts.

Checked the actual landing header and product demo, plus the header at 390 px: the wordmark fits without overflow. Build, lint, and whitespace checks pass. This supersedes the earlier split-B design described below.

## Blueprint panel alignment and density

Follow-up: API route cards now use the shared 12 px corners and 16 px horizontal padding, with a 16 px gap to the inspector. Diagrams uses the same numbered section heading, compact violet view controls, and 16 px canvas padding. Browser checks confirmed endpoint selection still opens the inspector, diagrams render, and both layouts fit at 390 px without page-wide overflow. Build and lint pass; no browser errors were recorded in the isolated checks.

Shared blueprint cards now use 16 px padding/gaps and stretch to equal heights within each grid row. Database cards use a compact 48 px header with column counts, smaller field rows, and full-width secondary constraint text; the grid fits three cards on a wide content area and collapses as available space decreases. All names, types, constraints, and schema code/export controls remain available. Screen and architecture layouts now respond to the content width, including when the sidebar is visible.

Effort metrics share a consistent height. Long complexity explanations move into a readable notes row below the metrics instead of enlarging one card. The sticky tab strip now sits at the top of the actual scroll area, and tab changes reposition the section so its heading remains visible. Section numbering now agrees with the tabs. Only the outer horizontal scrollbar is suppressed; tab strips and code blocks retain their own horizontal scrolling.

Validation used the isolated `--panels` fixture with uneven feature counts, six schemas containing long constraints, and verbose effort text. Desktop feature pairs measured equal heights, all four effort cards measured approximately 109 px, and schema cards fit three columns at 1440 px. At 1024 px the content-aware grids used two columns; at 390 px they used one with no field overflow. Switching sections after scrolling to the bottom preserved heading clearance, and SQL view remained accessible. Build, lint, all 10 frontend tests, and whitespace checks pass. Existing bundle-size warnings remain.

## Brand and interaction polish

Replaced the overlapping b× and legacy lightning marks with a geometric B built from two blueprint-like bays. The reusable SVG now appears in application and marketing headers, sign-in/session screens, the footer, product demo, and startup entrance. A matching favicon and standalone `frontend/public/buildx-mark.svg` are included. The entrance assembles the two sections once and retains its existing readable timing and Skip action.

Added navigation underlines and icon feedback, sidebar and stack-control hover responses, a composer focus line, gallery artwork movement, workspace-card reveals as they enter the viewport, and brief transitions for expanded agent details and landing demo state changes. Effects use existing CSS and Framer Motion; no dependencies were added. Pointer movement is limited to fine-pointer hover where appropriate, and new motion has reduced-motion alternatives. Existing product interactions remain available.

Direction: quick utility feedback and more expressive brand moments, informed by [Carbon's motion guidance](https://carbondesignsystem.com/elements/motion/overview/), while retaining BuildX's neutral/violet palette.

Validation: production build, lint, and all 10 frontend tests pass. Browser checks covered composer focus, gallery artwork hover, navigation selection, stack dialog opening/closing, landing demo state changes, mobile loader assembly/wordmark, and 24-card workspace scrolling at 1440 × 900 and 390 × 844. Cards finished revealing and the final item remained reachable without horizontal overflow. Reduced-motion rules were reviewed in code; an OS preference toggle and physical touch-device testing were not performed. Existing bundle-size warnings remain.

## Workspace selector scrolling and theme — 14 September 2026

The `/agent` project picker now scrolls in AppShell's main content area. Previously it inherited the IDE's `overflow-hidden`, clipping longer project lists. Only `/agent/:id` keeps that scroll lock for its independent editor/chat panes. The selector grows from the top with bottom padding rather than shrinking and vertically centering overflowing content.

Selector cards, loading/empty states, navigation, and headings now use shared surface, text, border, and violet accent tokens. Descriptions wrap to two lines, cards have restrained hover/focus feedback, and the grid changes to one column on mobile. Motion honors reduced-motion preferences.

Validation: build, lint, all 10 frontend tests, and whitespace checks pass. An opt-in 24-project fixture (`npm run test:workspace --workspace=frontend -- --long-list`) verified keyboard scrolling to both ends at 1440 × 900 and 390 × 844. The final card was fully visible with bottom space, the fixed header remained in place, and neither size had horizontal overflow. Opening the last project retained viewport-contained IDE layout at both sizes. Browser screenshots were reviewed; physical-device touch scrolling was not tested. Existing bundle-size warnings remain.

## Chat theme alignment — 14 September 2026

Both user and assistant messages now use bordered cards with matching 10 px corners and 12 × 14 px padding. User cards use the shared surface-2 color; replies use surface-1. Active runs use the same response-card treatment. Chat background matches the editor background token, while headers, input, text, borders, focus, and send controls use the existing shared theme tokens instead of a separate purple-gray palette. Existing activity disclosures and chat behavior are unchanged.

Validation: production build and diff whitespace checks pass. The rendered desktop cards were checked for matching border, radius, and padding; the chat pane resolves to the editor's #0F0F12 background. This correction changes CSS only.

## Agent workspace refinement — 13 September 2026

Removed the full-width project-name/file-count strip on desktop and integrated project switching into the editor toolbar. The Files, editor, and agent headers now share a compact layout. Mobile/tablet keep panel-switch controls so files and conversation remain reachable.

Replaced repeated multi-color pipeline cards with neutral conversation messages, restrained violet accents, and collapsed Run details containing only recorded activity/model/file data. Removed unconditional Verified labels and hardcoded model badges. Long diagnostic requests retain their full content behind a disclosure. Active requests show a single stage/time row with optional activity and plan details. The multiline composer uses Enter to send and Shift+Enter for a newline, and historical reading no longer forces scrolling on every activity update. Per-run telemetry resets before a new request.

Validation: TypeScript/production build, lint, all 10 frontend tests, and diff whitespace checks pass. Browser verification used isolated history and SSE fixtures: collapsed details, full diagnostic expansion, live activity, completion, failure recovery, mobile panel navigation, and file switching were exercised. No page-wide overflow at 390, 768, or 1440 px. No new dependencies; real project files and external AI services were not used during tests. The existing bundle-size warning remains.

## Architecture studio redesign — 13 September 2026

The earlier compact-form revision is superseded by a new split composition: an editorial headline and small growing composer beside an explorable interface/API/data illustration. Stack settings open from a summary control into an accessible dialog. Illustrated example cards retain the existing prompts. The shared shell has quieter navigation and consistent avatars, and recent-project date grouping handles timestamps with a timezone correctly.

Startup branding now lives at the App root and appears on **every full page load**, including direct Studio/project links. The normal sequence is 2.35 seconds of hold plus a 450 ms fade; Skip is available immediately. Normal client-side navigation does not replay it. This supersedes the session-only timing described in the historical entries below.

See [DESIGN_DIRECTION.md](./DESIGN_DIRECTION.md) for the research, composition sketch, implementation choices, current verification results, and limitations. No additional dependencies were installed in this revision.

## Application polish correction — 11 September 2026

This follow-up applies to every project. It corrects missing API-card and architecture-flow styles that the earlier visual verification missed, then carries consistent spacing, surfaces, and typography through the working application.

- API routes now have aligned method badges, separate paths and descriptions, authentication indicators, search, method filters, empty results, and a coordinated mock-request inspector. Changing routes cancels a pending simulated response.
- Architecture uses bounded SVG connectors and readable responsive nodes. Missing architecture is explicit. Data-model fields wrap rather than silently truncating; feature and screen definitions use consistent readable rows. Diagrams use the violet palette and explicit loading/empty states.
- Effort retains the project's estimates but replaces the previously hardcoded completed/current milestones with a labelled suggested sequence. No fictitious progress is presented.
- Project actions are grouped in an accessible menu, retaining downloads, GitHub export/update/link, regeneration, and new-project access. Sharing and visibility remain immediately available.
- The refinement dock is compact when collapsed. Its measured height is reserved in the blueprint scroll region, including when expanded and on mobile. Hidden suggestions are inert. Long content remains reachable above the dock.
- The creation composer has a smaller header, closer examples, compact stack controls, a growing textarea, and a reachable primary action. Gallery cards and shared controls follow the same spacing rules. Default 3D tilt is disabled on dense content cards; hover feedback remains.
- The brand entrance now holds for at least 1.4 seconds before a 400 ms fade, also waiting for bounded font readiness. Reduced motion uses a static reveal and shorter fade. A versioned session key lets existing sessions see the revised sequence once. The development preview can replay it.

Validation: production build and zero-warning lint pass; all 8 frontend regression tests pass. Browser checks cover standard, long, and empty panel content; all seven panels have no page-wide overflow at 360, 390, and 768 px. Desktop API, architecture, schema, screen, effort, and diagram layouts were inspected. Method filtering, no-match search, route selection, cancelled mock responses, grouped project actions, mobile dock positioning, and scrolling to lower content were exercised. In the owner fixture, the scroll viewport's bottom exactly matched the expanded dock's top on desktop and mobile. The loader was captured at 900 ms with the complete wordmark visible at full opacity.

The expanded `/__components` route is development-only and provides repeatable standard/long/empty fixtures for every blueprint panel. The isolated workspace fixture now includes longer blueprint content for dock and scrolling checks.

Limits: no physical-device, OS reduced-motion toggle, browser 200% zoom, live AI, or external publishing checks were performed in this correction. Main JavaScript remains about 168 KB gzip; Vite's existing large-chunk warning remains. No new dependencies were installed. The sections below record the earlier pass and its separate validation.

The approved visual pass preserves BuildX’s obsidian/violet identity and the working Studio. The landing page now explains the product with an animated, inspectable generation demo. Its authored Linkspace example uses the application's Blueprint data shape; it is explicitly simulated and never submits prompts or calls an AI provider.

## Delivered

- Replaced the static Atlas mock with an idea-to-blueprint sequence: planning, database, API, screens, code, and review. Active nodes, connecting lines, progressive artifacts, and a persistent output canvas explain what each stage contributes. Users can pause, resume, replay, or inspect individual stages and outputs.
- Demo autoplay runs once, holds the completed result, and pauses outside the viewport or when the browser tab is hidden. Reduced-motion users receive manual progression. Mobile layouts use a compact stepper, wrapped artifact tabs, and playback controls above the output.
- Restored a brief BuildX wordmark entrance once per tab session, with a Continue control, bounded font readiness, and reduced-motion support. Actual route loading uses a compact brand fallback. The page mounts beneath the entrance without a white startup flash.
- Improved headline hierarchy, spacing, card depth, gradients, fine borders, hover feedback, focus states, section reveals, page transitions, dialogs, and menus. The existing palette and product terminology remain intact.
- Added interactive capability illustrations and blueprint-specific example cards. FAQ disclosures animate and permit multiple answers to remain open.
- Replaced native application Lucide imports with named IBM Carbon icon exports through one shared icon module. Generated-app preview compatibility with Lucide remains available.
- Updated gallery cards with bounded, deterministic architecture constellations and actual artifact counts; refined sign-in and creation surfaces.
- Added a real-event generation timeline and previews of received tables, API routes, and screen definitions. Waiting stages remain waiting until their agent events arrive; correction events can return a completed stage to active.
- Preserved workspace file editing, diff mounts, save recovery, exports, authentication, and VFS behavior. Added keyboard navigation for blueprint tabs and retained segmented-control keyboard support.

## Techniques and footprint

Motion uses the already installed Framer Motion plus CSS transforms, opacity, SVG strokes, and IntersectionObserver. No additional animation engine, live editor, iframe, or diagram renderer is mounted in the landing demo. Carbon is the new icon dependency and uses named imports.

The production main JavaScript entry is approximately 168 KB gzip, compared with 116 KB after the earlier static pass. This is a material increase from bringing motion into the landing experience. Editor and diagram packages remain deferred; Vite still warns about chunks over 500 KB raw, including the main entry. This pass does not claim a measured Lighthouse or low-end-device performance score.

## Verification

| Check | Result |
| --- | --- |
| Frontend production build / TypeScript | Pass |
| Frontend lint | Pass, zero warnings |
| Frontend regression tests | 8 pass |
| Backend build and existing tests | 8 pass |
| Landing at 360, 390, 768, 1024, 1440 px | No page-wide overflow |
| Demo | Autoplay reaches completion; pause, replay, stage selection, and output inspection checked |
| Gallery | Real projects load; preview opens and Escape restores focus |
| Blueprint tabs | Arrow-key selection and associated panel labeling checked |
| FAQ | Multiple answers can remain open |
| Isolated owner workspace | Diff reject/accept, file switching, intentional failed save, retry, and persisted edit after reload checked |
| Mobile workspace | Files-to-code selection and agent panel switching checked; no page-wide overflow at 390 px |
| Generation display | Simulated event fixture checked against received artifact content and stage states |

Commands:

```sh
npm run build --workspace=frontend
npm run lint --workspace=frontend
npm test --workspace=frontend
npm test --workspace=backend
npm run test:workspace --workspace=frontend
```

The last command starts the disposable owner-workspace fixture on port 5190. The first file save deliberately returns 503 so retry can be verified without touching a real project. Development-only `/__components` includes brand entrance and generation-stage previews.

## Validation limits

Live AI generation, GitHub OAuth/publishing, and real export downloads were not exercised in this visual pass. Workspace mutation checks used the isolated fixture. Reduced-motion behavior is implemented but an OS-level preference toggle was not exercised; browser 200% zoom, CPU throttling, and physical mobile devices were not tested. No deployment was performed.
