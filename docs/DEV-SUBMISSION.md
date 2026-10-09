---
title: Soundwalk Atlas — a listening walk, with AI that waits until you get home
published: true
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

What changes when you walk the same route twice—and actually listen?

I chose this concept and shaped its direction through repeated design reviews, including requests for a more seamless interface and expressive scroll motion. I also supplied my own recordings of page turns and footsteps as development examples. AI agents handled implementation and automated checks; my role focused on product direction, design feedback and real development inputs.

Soundwalk Atlas is a private listening journal built around that question. Prepare a few stops and a printable listening card, put the screen away, and write what you hear. A short phone recording is optional. Once home, an open-weight audio model offers a second perspective on your recordings. You replay them, accept or reject its suggestions, and keep your own interpretation.

The order matters: observation first, AI afterwards. A written note without audio is a complete observation. You decide which labels belong in the journal, including when none fits or several sounds overlap. An unreviewed suggestion never becomes something you supposedly heard.

Return another day and compare the same stops: your notes, recording context and reviewed sound labels. The goal is to make a familiar place worth noticing again, without turning a walk into a classification score.

## Demo

[Watch the working Soundwalk Atlas demo](https://yashanand69.github.io/soundwalk-atlas/#demo)

The captioned 72-second video is an edited walkthrough of captured app screens, including saved results from real local inference. It does not show continuous interaction or inference wait times. Its recordings are clearly labelled procedural synthetic fixtures, not an outdoor trip. No completed outdoor trial or independent field-accuracy result is claimed.

![The scroll-led illustrated listening trail](https://raw.githubusercontent.com/YashAnand69/soundwalk-atlas/main/docs/premium-trail.png)

## Code

[Source, setup instructions and review evidence on GitHub](https://github.com/YashAnand69/soundwalk-atlas)

The application source is MIT licensed. Setup instructions, synthetic fixture provenance, model preparation and evaluation tools are included. Private journals and model assets stay outside the repository.

## How I Built It

React and TypeScript provide the journal interface. Scrolling draws an illustrated trail and moves a marker through the listening ritual; it is decorative, not location tracking. Focus mode, motion controls and reduced-motion support keep the working forms accessible. A local Python/FastAPI service stores visits, observations and reviews in SQLite, retaining original recordings for replay.

The AI is [LAION CLAP](https://huggingface.co/laion/clap-htsat-unfused), which compares audio and descriptive text in a shared embedding space. It matches a selected interval of up to ten seconds against eleven versioned sound prompts, then offers two candidates. Model revision, prompts and analysed interval travel with the result. The waveform comes from decoded audio, and changing the selected interval does not silently alter an existing prediction.

A concrete failure shaped the design: procedural noise returned “Running water” and “Rain.” The model had executed correctly, but there was no outdoor water recording behind either label. A plausible match was not a trustworthy observation.

That is why human labels start empty, raw similarities are not called confidence, and “none fits,” multiple sounds and uncertainty are separate choices. A useful suggestion might prompt you to replay a detail you missed; an incorrect one can prompt a correction. Neither replaces listening. Digital silence produces no candidates, while amplitude warnings help spot quiet or clipped recordings.

Review also covered cancellation, draft recovery and private backup restoration. ZIP imports validate checksums, audio and record relationships before adding fresh IDs without overwriting existing visits. The repository's [dated upgrade review](https://github.com/YashAnand69/soundwalk-atlas/blob/main/docs/UPGRADE-REVIEW.md) distinguishes automated checks from real-model execution and records their limits. Benchmark results measure a specific synthetic fixture and machine, not field accuracy.

## Why Does Open Innovation Matter?

A recording can reveal someone's routines or conversations. It should not need to leave their laptop to receive suggestions. After explicit dependency and model downloads, inference uses prepared local assets without a remote API fallback. Local computation still costs memory, storage and processing time.

Open weights make the model inspectable and replaceable. The prompts are visible source code; the model revision and weight checksum are pinned. A surprising result can be reproduced and questioned rather than accepted as an opaque service response.

This release uses a phone's ordinary recorder followed by file transfer; it does not run inference on the phone. It cannot identify species, separate sound sources, measure noise exposure or assess environmental health. Unsupported sounds may still receive plausible labels. Independent recordings and outdoor use remain the next validation step.

## My Agent Session

### My role

I chose Soundwalk Atlas from the proposed concepts and set its direction. I supplied my own recordings of book pages turning and footsteps as development inputs, with descriptions of what I recorded. These short development examples helped examine model suggestions; they do not establish an outdoor trial or independent accuracy study, and the recordings remain private.

I reviewed the presentation and requested repeated refinements to the interface, scroll animation and overall quality. I wanted the experience to feel seamless while keeping human judgment central: suggestions should invite listening and correction, rather than manufacture certainty.

### Working with agents

I used OpenAI Codex and research, audio, backend and interface subagents to help plan, implement, test and review the project. Codex and the subagents produced the code and automated checks; integration review corrected defects. The repository contains [stage reviews](https://github.com/YashAnand69/soundwalk-atlas/blob/main/docs/STAGE-REVIEWS.md) and engineering evidence, without publishing private recordings or session transcripts.

## Prize Categories

Overall challenge.
