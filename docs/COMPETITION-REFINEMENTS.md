# October 10 submission refinements

- No-install public review exercise lets visitors listen to a six-second CC0 generated noise sample, enter an observation before revealing saved actual CLAP candidates, and review with independent labels, free text, mixture, uncertainty and vocabulary rejection. It is explicitly not live inference or the full journal. Answers remain in page memory and reset on reload. No private recordings published.
- Actual model runs on two known private development clips and three generated controls are documented in USEFULNESS-REVIEW.md. Correct candidate matches and unsupported-sound failures remain separate from field usefulness and independent accuracy.
- Article now opens with a documented model failure and explains the product decisions it motivated. User direction and supplied inputs are credited alongside agent implementation.
- Single-walk three-stop report template added to FIELD-TRIAL.md; a second visit is optional follow-through for comparison. No completed walk fabricated.

## Performed checks

Parent inspected private actual output and verified the public sample checksum against benchmark-model-v2.json. A jsdom execution of the real public script verified no preselected labels, inert rendering of HTML-like notes, rejection of an empty review, independent multiple labels/mixture/uncertainty, none-fits clearing, and full reset. Actual browser verified note/reveal/reject/correction/summary/reset, six-second audio metadata, and no horizontal overflow at 390px. No new full application code changed; historical 106 application checks were not rerun or claimed as new results.

## Remaining evidence

The user requested finishing other improvements before doing a walk. Actual outdoor workflow, benefit to attention, independent annotations and any usability interview remain unperformed. Installation/model download remain required for the full private app; the public exercise reduces demo friction but does not eliminate that requirement. ElevenLabs audio/category remains pending connection and compatible publication rights; free tier only.
