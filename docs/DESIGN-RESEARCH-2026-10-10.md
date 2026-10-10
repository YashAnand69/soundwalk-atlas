# Soundwalk Atlas: design and usefulness research

Research date: October 10, 2026. Primary sources below were read for this review. Recommendations are design judgments, not proof of retention, accessibility conformance, health benefits, or contest success. Code inspected: `frontend/src/App.tsx`, `ListeningPrelude.tsx`, and public `docs/index.html` / `atlas.js`; the workspace was being actively improved during inspection.

## Product direction

Make the first useful action possible on a phone without installing the local AI stack: open a small pocket journal, listen, write, save, and return another day. Keep desktop audio review an optional second stage. The product's value should survive the absence of recordings, model installation, or perfect model suggestions.

The National Park Service describes quiet listening, reflection stops, and changes when revisiting a route at different times. It explicitly permits a seated “sound sit” and visual or tactile observations for accessibility. Its prompts progress from nearby/faraway sounds to changes and layers. This supports a short observation workflow and a repeat-visit comparison; it does not prove this particular app improves attention. [NPS soundwalk teaching guide](https://www.nps.gov/teachers/classrooms/young-sound-seekers-soundwalk.htm)

John Muir Laws presents journaling as deliberate observation, curiosity, and remembering discoveries. Soundwalk should preserve a person's own words and questions before model suggestions; a journal is more than a catalogue of predicted labels. [Nature journaling guidance](https://johnmuirlaws.com/nature-journaling-starting-growing/)

Headspace's walking guidance adapts to city, nature, home, and different durations. Its stepwise prompts are useful interaction inspiration: one simple invitation at a time. We should not adopt its health claims as claims about Soundwalk Atlas. [Walking meditation](https://www.headspace.com/meditation/walking-meditation)

## Priority decisions

| Priority | Improvement | Reason and acceptance evidence |
| --- | --- | --- |
| P0 | A browser-based, note-first pocket journal | A visitor can create and save one observation without audio, account, coordinates, model download, or reading the whole landing page. Verify empty state, keyboard flow, mobile sizing, reload persistence, and storage failure. |
| P0 | Honest persistence and portable export | Explain that notes stay in this browser and may disappear if browser data is cleared. Export a readable copy. Different hosting origins do not share browser storage; do not imply cloud sync or automatic desktop transfer. Test export and prevent HTML interpretation of user text. |
| P0 | Return to the same place | Preserve previous notes and offer a fresh visit rather than overwriting them. Put two observations next to one another with a prompt such as “What changed?” Validate that date and place names remain understandable. |
| P0 | One obvious next action | Before a visit, prepare/start; during a visit, write; after saving, reflect/return/export. Do not make optional recording the required next step after a complete written observation. |
| P1 | A short ritual plus a seated alternative | Offer one to three stops, or one comfortable place. Near/far, continuous/passing, and one unexpected detail work without scientific sound identification. A timer must be optional, pausable, and non-punitive. |
| P1 | Public review exercise with explicit provenance | Let visitors hear the known synthetic sample, reveal saved model suggestions, and reject them. State that the public exercise uses saved output rather than live AI. Retain the current failure evidence instead of replacing it with a perfect-looking demo. |
| P1 | Lightweight return invitation | Finish with the visitor's note and a suggestion to revisit at another time. Saved history supplies the reason to return. Avoid streaks, scoreboards, unsolicited notifications, or claims of habit formation. |
| P2 | Fresh real-world usefulness evidence | Record a real walk only when the owner actually performs it. Before/after observations and whether AI helped, repeated, or distracted are more informative than additional visual polish. |

## Visual direction and interaction references

Use an illustrated field journal: warm paper, dark forest ink, restrained brass highlights, contour lines, generous editorial headings, and readable everyday form text. These are proposed design choices for this app, not findings that any palette wins competitions.

AllTrails separates discovery, saved places, and recorded activities; its save-and-return structure is useful reference for the journal. Soundwalk should keep a much smaller navigation surface and avoid implying that its imaginary trail is GPS navigation. [AllTrails official app structure](https://support.alltrails.com/hc/en-gb/articles/44409942124052-Understanding-the-AllTrails-App), [official feature overview](https://www.alltrails.com/welcome)

Headspace uses approachable illustration and short guided activities. Adopt the clarity of a small invitation rather than reproducing its artwork or implying a clinical wellness product. [Headspace walking activity](https://www.headspace.com/content/mindful-activity/walking-in-the-city/114)

Use one signature motion: a marker travelling along an illustrated SVG trail as a visitor scrolls through arrive/listen/return. This communicates the product's sequence and can stay lightweight. Gentle depth in two or three landscape layers is sufficient; WebGL or a camera flying through 3D scenery adds complexity without helping someone preserve an observation. Keep motion away from the journal's text entry and reading area. Never move the page on behalf of the scroll user.

## Motion and accessibility requirements

- Respect `prefers-reduced-motion` on initial load and when it changes. Freeze decorative travel/parallax in a meaningful static position; keep every instruction visible. W3C's interaction-animation criterion is Level AAA, not a blanket AA requirement, but it is a sound design target for this motion-heavy request. [SC 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions), [CSS C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html)
- Provide a visible pause control for ongoing decorative animation. W3C SC 2.2.2 covers automatically started motion lasting more than five seconds alongside other content, and automatically updating information. Do not claim that reduced-motion alone constitutes full compliance. [SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Use comfortably sized primary mobile controls, preferably at least 44 CSS pixels. WCAG 2.2 AA SC 2.5.8 specifies 24 by 24 CSS pixels with defined exceptions; 44 pixels is a deliberate stronger design target, not that criterion's minimum. [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Keep content visible without animation/JavaScript enhancement. Scroll reveals must not hide keyboard-focused controls. Use real headings, labels, focus indicators, native buttons, and status messages for save/export failures. Make the decorative scene nonessential to understanding progress.
- Pause offscreen work, batch scroll reads and writes with animation frames, and animate small transforms rather than layout. Verify behavior at narrow widths and zoom, including long user notes and long names.

## Evidence still needed

The existing `USEFULNESS-REVIEW.md` documents two familiar development recordings and synthetic controls. It already acknowledges unsupported sounds receiving plausible labels. Neither those examples nor automated tests establish field accuracy or usefulness.

The next validation should ask a few people to begin a walk without explanation, preserve a note, retrieve it later, and explain the privacy/storage model in their own words. Observe friction directly. Record whether they would revisit and why; do not infer actual retention from stated intention. A genuine outdoor trial and fresh independently described recordings remain outstanding. No winning probability follows from this research.
