# Submission presentation review — October 9, 2026

## Design and motion

The editorial redesign uses warm paper, muted brass, serif headings, a larger arch-framed landscape, fewer boxed controls and an unobtrusive Journal tools menu. Focus mode keeps the introduction out of the working journal.

The primary scroll element is an imagined listening trail. The landscape remains sticky while three narrative sections scroll past. Scroll position draws the path and moves an SVG marker along its actual geometry; terrain and sun move slightly at different depths. This is decorative storytelling, not a live route or audio measurement. It uses passive scroll listeners and one scheduled animation frame, without scroll hijacking or an animation library.

Section reveals use IntersectionObserver with a zero threshold so very tall recording sections cannot remain hidden. Keyboard focus reveals a section immediately. Pause and reduced-motion changes reveal all pending content. Missing observer or SVG APIs leave a readable static presentation. Mutation observers discover dynamic journal sections and all listeners/frames/observers are cleaned up.

## Performed review

- 43 interface tests passed, including seven reveal/progress regressions and five trail geometry/pause/reduced-motion/cleanup regressions. TypeScript, production build and formatting checks passed.
- 57 Python tests passed for the unchanged audio, backup and persistence implementation. Read-only installation readiness passed.
- Real browser: path progression and changing marker position, sticky landscape, pause (zero pending hidden sections), focus mode, Journal tools, saved original notes, real local inference for 14–24 seconds, human rejection/save and comparison review counts.
- Mobile: 390 × 844 viewport, 390-pixel document width; compact sticky illustration leaves room for readable narrative. Desktop viewport reset afterward.
- Production assets: roughly 84.4 KB gzipped JavaScript and 11.3 KB gzipped CSS. No new network animation/font service.
- Demo: 72-second captioned edited sequence of captured working UI screens. It explicitly identifies synthetic data and shows saved model results, not continuous interaction or inference timing. Video captions and an accompanying transcript state the boundaries. No private audio or location appears.

Screenshots: `premium-hero.png` and `premium-trail.png`. The previous UI review remains historical evidence.

## Publication boundary

The public demo page is static; it does not host inference, access localhost or expose the private journal. The prepared DEV article follows the live official template. Genuine fieldwork remains recommended evidence, and independent evaluation is needed before accuracy claims. Neither is falsely claimed by the article. The DEV entry has not been published and personal eligibility/terms remain for the user to review.
