# Two-visit field trial

This is a practical protocol, not completed field evidence. The bundled WAVs are generated synthetic demonstrations. They do not establish outdoor usability or model accuracy.

## A first walk: three stops, no experiment required

A single walk can establish whether the workflow is usable; it cannot establish accuracy or a change in habits. Before using AI, write one sentence at each stop about what you noticed. Back home, compare it with the suggestions and write what helped, what failed and what you would change. One truthful failure is more useful than an invented success. A second visit tests the comparison feature and can follow later.

Report template:

- Why I chose this route (broad context, no precise location needed):
- Stop 1: original note; recording or no recording; AI suggestion; my correction and reason:
- Stop 2: original note; recording or no recording; AI suggestion; my correction and reason:
- Stop 3: original note; recording or no recording; AI suggestion; my correction and reason:
- What I noticed because I stopped to listen:
- Where the workflow got in my way:
- What I am willing to share publicly (notes, audio, images, or none):

## Before leaving

1. Choose three familiar, publicly accessible stops. Avoid traffic, private property and places where stopping or recording is inappropriate. The application is not a navigation or safety service.
2. Create one route and keep its stop IDs for both visits. Print the listening card. Name stops without exact addresses or GPS coordinates if privacy matters.
3. Use your phone's ordinary recorder. Test one actual recorder file in the app first. Prefer about ten seconds; the current limit is thirty seconds / 20 MB. Analysis defaults to the first ten seconds, allows selecting a later interval, and zero-pads shorter recordings.
4. Record your phone/recorder format and broad context for later comparison. Do not enter phone identifiers, private addresses or names of bystanders.
5. Decide which original recordings, if any, may be made public. Permission to record is separate from permission to publish. An AI model's license does not license recordings.

## At each stop, on both visits

- Stop safely, put away the screen and listen for approximately one minute.
- Write a short observation **before seeing model suggestions**: near/far sounds, intermittent/continuous sounds, and uncertainty. Do not invent a sound just to fit a category.
- Optionally record about ten seconds while stationary. Avoid conversations and identifiable speech. If consent is unclear, use written observations instead; do not publish that audio.
- Record coarse context: time of day, wind/rain, recorder/device changes, and any interruption. Count active screen interactions rather than claiming zero interaction.
- Record the actual duration and any missing stop. Missing recordings are useful evidence; they are not silent recordings.

Return to the same three stops for the second visit. Use the same recorder and capture protocol when feasible, but document differences. This is an observational comparison, not a controlled environmental experiment.

## Back on the laptop

1. Create a separate visit on the same route. Import each clip into its matching stable stop.
2. Enter the pre-model observation in the upload form before analysis. Keep original audio available for replay.
3. Before requesting AI suggestions, record expected broad labels in a separate trial worksheet. Use multiple labels where appropriate; retain ambiguous, unfamiliar, quiet or mixed recordings.
4. Run local analysis, replay the clip and confirm/correct labels. Leave uncertainty enabled whenever needed. Relative similarity scores are not confidence probabilities.
5. Compare the two visits. Report exactly what these samples captured, rather than making claims about a place's overall quietness, health or biodiversity.
6. Export the JSON journal and open it to check corrections and model provenance. JSON contains records, not audio. Use Private backup + audio for a ZIP you can restore additively; keep original recordings and backups private.
7. Restart the local application and confirm records/reviews persist. Test deletion with an expendable recording; independently saved exports/backups are not removed by app deletion.

## Worksheet: copy one row for each recording

| Field | Your actual observation |
|---|---|
| Visit and stable stop | |
| Date/time and broad conditions | |
| Original pre-model note | |
| Recorder format / duration | |
| Expected audible labels before inference | |
| Mixed / uncertain / poor recording | |
| Model suggestions and revision | |
| Final human correction and reason | |
| Processing time and failure, if any | |
| Screen interactions outdoors | |
| Permission to publish audio / image | |

## Evaluation without overclaiming

For an exploratory evaluation, collect separate recording sessions for calibration and held-out review. An optional target is twelve calibration and twelve held-out clips, including confusing and quiet controls. A tiny held-out set cannot establish general or per-class accuracy. Never tune prompts on the same clips subsequently advertised as an independent test.

Where possible, ask a second consenting listener to label clips before seeing predictions. Preserve disagreements. Model-assisted corrections are not independent ground truth. Compare the usefulness and effort of manual review with model-assisted review honestly; do not report a time-saving result without measuring it.

## Still unverified until you perform this trial

Actual outdoor usefulness, your phone's recorder compatibility, field interaction counts, held-out accuracy, bystander consent, and any effect on your outdoor habits. Synthetic model benchmarks establish only the tested local execution path. No species identification, sound-level measurement, source separation, or safety/accessibility guarantee is provided.
