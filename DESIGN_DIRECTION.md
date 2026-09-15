# BuildX — architecture studio direction

## Inspection findings

The previous revisions changed detail, not composition. The create page remains a large enclosing form, another enclosing textarea, three always-visible settings groups, and a footer. The primary interaction feels like administration. The sidebar repeats a prominent New project action, while the header repeats it again. The account avatar references an old, unstyled class. The branded entrance only mounts on HomePage and is session-suppressed; direct entry into Studio receives the short Suspense fallback instead. These are application-level issues, independent of any project.

## Reference analysis

- [Raycast AI](https://www.raycast.com/core-features/ai): a compact composer and nearby contextual choices. Suitable for starting a blueprint without a large configuration form. Keep BuildX's existing stack selections, but disclose them from one summary control.
- [Linear's 2026 interface refresh](https://linear.app/now/behind-the-latest-design-refresh): navigation recedes, borders establish structure without dominating, and actions have predictable locations. Suitable for the shared shell and dense project views, not a prescription to make BuildX visually quiet everywhere.
- [v0](https://v0.app/): idea-first entry with examples that help users begin. Suitable for the low-friction entry flow; its generic prompt-box composition alone would repeat the problem here.

## Chosen composition

An architectural studio: dark ink surfaces, illuminated violet paths, large editorial typography, and a lightweight interactive stack of blueprint layers. No stock imagery, generic glowing sphere, or fake AI progress. The artwork explains BuildX's actual outputs; generation remains an explicit user action.

Desktop sketch:

    quiet navigation                    account
    ┌─────────────┬──────────────────────────────────────────┐
    │ projects    │ ARCHITECTURE STARTS HERE                 │
    │             │                                         │
    │             │ It starts       / floating UI layer /   │
    │             │ with an idea.    / API layer /          │
    │             │                  / data layer /         │
    │             │ short supporting copy                   │
    │             │ [ compact idea composer         ↑ ]     │
    │             │ [ selected stack · Configure ]           │
    │             │                                         │
    │             │ illustrated starting-point cards        │
    └─────────────┴──────────────────────────────────────────┘

On phones the illustration becomes a compact, horizontal preview below the composer. A one/two-line empty input grows with real content, capped at a usable height. Stack settings open in a focused accessible dialog, preserving all existing choices. Examples fill the idea; they never submit it.

## Implementation sequence

1. Replace the create-page composition completely. Preserve draft persistence, validation, keyboard submit, session failure recovery, loading lock, and all stack options. Provide an explicit Generate action and accessible labels.
2. Build the layered architecture illustration in HTML/SVG/CSS. Layer selection updates the highlighted layer and explanatory text. Use restrained entrance, slow finite assembly, and direct hover/selection feedback. Reduced motion produces a stationary composition.
3. Rework examples into small illustrated project cards; lower the visual weight of sidebar controls and correct the account avatar. Carry the same border, radius, focus, and spacing treatment through shared controls.
4. Move startup branding to the app root. It appears on every full page load, including direct Studio/project URLs; ordinary client-side navigation does not repeatedly block work. Hold the full sequence for roughly 2.8 seconds, with an explicit skip control. Use clock-based completion rather than an animation-complete callback, and no sessionStorage suppression. Content loads underneath; the demo waits for startup completion.
5. Inspect standard, long, empty, focused, selected, loading, and failure states. Verify actual rendered dimensions, keyboard interactions, repeated full-load startup behaviour, route navigation, and responsive layouts. Keep existing blueprint panel fixes and editor/VFS behaviour.

## Quality gates

The empty composer must not resemble the previous giant form. Stack settings must be discoverable without occupying the whole page. The illustration must tell the architecture story and never look like actual generated output. No page-wide overflow at phone/tablet/desktop widths. The full name must remain visible for a readable hold, including with cached fonts. Inputs and real data remain usable without motion. Production build, lint, and existing regression tests must pass. No new dependencies are planned.

## Risks

3D CSS layers can become illegible on small screens: simplify and flatten the mobile presentation. Too much motion competes with writing: keep the art's idle state still, animate entry/selection, and respect reduced motion. The startup sequence intentionally adds a short branded pause on full loads: provide Skip immediately and do not replay it during normal navigation. Preserving draft and submit behaviour is a regression priority.


## Implementation and verification — 13 September 2026

Implemented the new composition in `CreateProjectForm`, the illustrative layer assembly in `StudioBlueprint`, and scoped presentation in `studio.css`. The empty textarea measures approximately 65 px; a longer draft grows up to 220 px and then scrolls. Stack settings live in the existing Radix-backed Modal with the existing keyboard-accessible segmented controls. Examples populate and focus the input without submitting. No dependencies were added.

The shared shell now uses a quieter New project control, matching account avatars, and a clearer Studio navigation label. Corrected date handling so timestamps already carrying a timezone are not given a second `Z` and incorrectly grouped under Older. The local fixture now supplies representative project metadata and the correct personal-project endpoint.

The branded entrance is owned by App, outside route Suspense. It reappears on full loads of any route, holds for 2.35 seconds, then fades for 450 ms. In the browser, the full wordmark was visible at full opacity after about one second; the complete reload-to-dismiss measurement was approximately three seconds. A second reload displayed it again, Skip dismissed it immediately, and ordinary project/Studio/landing navigation did not replay it. Reduced motion uses a static presentation and shorter timing. The underlying landing demo waits for completion.

Verified in the browser:

- Signed-in and signed-out Studio; widths of 360, 390, 768, 1024, and 1440 px without page-wide overflow.
- Narrow desktop with the 280 px project sidebar; tablet and phone stack dialog layout.
- Empty validation, a 24-line draft capped at 220 px, example selection/focus, and draft restoration after reload.
- Keyboard arrow selection in the stack dialog, Escape/Done dismissal, and focus returning to Configure.
- Layer selection updates the explanation and brings the selected illustrated layer forward.
- Recent project grouping, project navigation, structured API rows, architecture flow, and the refinement dock after moving startup to the app root.
- Landing navigation still shows the guided simulated pipeline, with real generation kept in Studio.

Production build, TypeScript, zero-warning lint, all eight existing frontend regression tests, and `git diff --check` pass. The main JavaScript entry is approximately 168.5 KB gzip; the existing large-chunk warning remains. An observed ResizeObserver notification loop during responsive testing was corrected by deferring height updates to the next animation frame; repeating phone-to-desktop resizing then produced no new browser errors.

Limits: no live AI generation, external exports, physical devices, OS reduced-motion toggle, CPU throttling, or 200% browser zoom was exercised in this pass. The earlier panel/editor checks are recorded separately in `FRONTEND_VISUAL_UPGRADE.md`. No deployment was performed.
