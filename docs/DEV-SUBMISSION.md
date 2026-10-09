---
title: Soundwalk Atlas — a listening walk, with AI that waits until you get home
published: false
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

A familiar walk can become background noise. Soundwalk Atlas turns it into a small listening ritual: pick a few stops, put the screen away, listen, and return another day.

It is a private listening journal for people who want to notice the places they already pass through. Before leaving, you prepare a route and a printable listening card. At each stop, you write what you heard; a short phone recording is optional. Back at your laptop, an open-weight audio model offers broad sound candidates. You replay the recording and decide what belongs in your journal.

The order matters. Your observation comes before the model's interpretation. A stop with only a written note is a valid stop. A missing recording remains missing. The application never turns a candidate label into something you supposedly heard.

On a second visit, the same stops let you compare your own notes and reviewed recordings. The goal is a reason to return and pay attention, rather than another score to optimise.

## Demo

[Watch the working Soundwalk Atlas demo](https://yashanand69.github.io/soundwalk-atlas/#demo)

The captioned 72-second demo is an edited walkthrough of captured app screens, showing saved results from real local inference. It does not represent continuous interaction or inference wait times. The demonstration uses clearly labelled procedural synthetic recordings. These show the working interface, local inference and review workflow; they are not recordings of an outdoor trip. No completed outdoor trial or independent field-accuracy result is claimed in this entry.

![The scroll-led illustrated listening trail](https://raw.githubusercontent.com/YashAnand69/soundwalk-atlas/main/docs/premium-trail.png)

## Code

[Source, setup instructions and review evidence on GitHub](https://github.com/YashAnand69/soundwalk-atlas)

The application source is MIT licensed. The repository includes synthetic fixture provenance, pinned dependency requirements, model preparation, test suites, a field-trial protocol and an evaluation script. Model assets and private journals stay outside the source repository.

## How I Built It

The interface uses React and TypeScript. An illustrated trail stays in view as scrolling draws the route and moves a marker through the listening ritual. This is decorative, not tracking; pause and reduced-motion settings keep the page readable. Journal tools sit in a quiet menu, with focus mode for the working forms. A local Python/FastAPI service stores routes, visits, observations and reviews in SQLite, and keeps original recordings for replay. It binds to the laptop's loopback address: the supported field workflow is your normal phone recorder, then file transfer back to the laptop. This release does not perform inference on the phone.

The AI is [LAION CLAP](https://huggingface.co/laion/clap-htsat-unfused), an open-weight model that places audio and descriptive text into comparable embedding spaces. Soundwalk Atlas compares a selected interval against eleven versioned prompts, including birds, road traffic, footsteps and rain. It returns two candidates for human review. Results preserve the exact model revision, prompts and analysed interval so later changes remain inspectable.

Uploads are bounded to 20 MB and thirty seconds. Analysis takes a selected interval of up to ten seconds, converts it to mono at 48 kHz, and pads shorter clips. The waveform comes from decoded samples; moving the interval selector does not silently change an existing prediction. Digital silence produces no candidates. Quiet and clipping warnings concern recording amplitude, not measured ambient decibels.

One development lesson shaped the whole interface: a model can rank a convincing label for the wrong reason. Our procedural noise fixture returned “Running water” and “Rain.” There was no outdoor water recording behind it. This is a real execution result, not evidence that either sound occurred. Consequently, similarity values are not presented as confidence, human labels start empty, and “none fits,” multiple sounds and uncertainty are separate choices.

Reliability also needed attention outside the model. Review found that cancelled jobs could interfere with queue-history cleanup. The worker now tracks active jobs separately and ignores late cancelled results. Private ZIP restoration validates audio, checksums and relationships before importing records atomically with fresh IDs. It preserves original review and model provenance without overwriting existing visits.

The October 9 integration review recorded 57 passing Python tests and 43 passing interface tests, plus TypeScript and production-build checks. Model-job tests use explicit doubles; separate real-model checks exercised cached CPU inference with network connections blocked. The recorded vocabulary-v2 synthetic benchmark on an Apple Silicon Mac took 1.282 seconds for first load and inference, about 0.032 seconds for warm runs, and roughly 1018 MiB peak process memory. These are measurements on that fixture and machine, not accuracy or universal speed claims.

## Why Does Open Innovation Matter?

The recordings may contain a person's surroundings, routines or conversations. They do not need to leave the laptop to obtain candidates. After an explicit one-time dependency and model download, inference uses prepared local assets and does not fall back to a remote API. There is no paid inference service to keep running, although downloads, disk space and computation still have costs.

Open weights also make the model choice inspectable and replaceable. The vocabulary is source code, rather than an undocumented remote label set. The model revision and weight checksum are pinned, and the project records which prompts produced each result. Someone can reproduce a surprising prediction, change the prompts and compare the outcome.

Keeping this open made the limits easier to confront. The app does not identify species, separate sound sources, measure noise exposure or judge environmental health. Unsupported sounds can still receive plausible candidates. Those constraints belong beside the working demonstration, because the useful part is a person's listening and correction, not an assertion that AI knows a place.

## My Agent Session

I used OpenAI Codex and research, audio, backend and interface subagents to help plan, implement, test and review the project. Integration review checked their work and corrected defects; this is not a claim of human-only authorship. Dated engineering evidence is available in the repository's [stage reviews](https://github.com/YashAnand69/soundwalk-atlas/blob/main/docs/STAGE-REVIEWS.md) and [upgrade review](https://github.com/YashAnand69/soundwalk-atlas/blob/main/docs/UPGRADE-REVIEW.md). No private session transcript or user recording is published here.

## Prize Categories

Overall challenge. This entry does not claim an optional partner category: local CLAP inference and Codex assistance alone do not establish use of a listed partner technology.
