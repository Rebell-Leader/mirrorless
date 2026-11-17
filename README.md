# Mirrorless

A hands-first ASL fingerspelling trainer for Meta Quest, built with the
Immersive Web SDK (WebXR) for the Meta VR Start Developer Competition 2026.
See `PROPOSAL.md` for the product plan and `HACKATHON.md` for the rules digest.

## Run it

This machine's system npm (9.x) cannot install this project, because it can't
parse the `npm:super-three` alias. Use pnpm via corepack instead (a `pnpm` shim
is installed in `~/.local/bin`):

```sh
pnpm install
pnpm dev            # starts Vite + the emulator window (IWSDK-managed)
pnpm test           # hand-feature geometry tests (node:test + tsx)
pnpm typecheck
./node_modules/.bin/iwsdk dev down   # stop the dev server
```

`pnpm-workspace.yaml` sets `nodeLinker: hoisted`. The IWSDK editor runtime
imports transitive packages that pnpm's strict layout would hide.

## Test on the Quest 3

With the dev server running, open `https://<laptop LAN IP>:8081/` in the Quest
browser on the same Wi-Fi network (check `iwsdk dev status` for the URL).
Accept the self-signed certificate warning, then press **Enter XR**.

## Recording hands

See [docs/RECORDING.md](docs/RECORDING.md). In short: open the LAN URL on the Quest, press Enter XR, hold each letter still until it saves, and relax between takes. Then run `pnpm eval:recordings`. Recordings go to `data/recordings/` (git-ignored).

## Research and plan

- `docs/AUDIT_AND_PLAN.md`: comprehensive project audit, multi-role review, competitor analysis, VR best practices, and Phase 1–2 implementation plan.
- `docs/SYNTHESIS.md`: what the research and role reviews concluded, the value analysis, and the revised plan.
- `docs/REVIEW_TASKS.md`: build-review checklists by role (judge, caregiver, Deaf user) plus data validation.
- `docs/research/`: prior art, science, and data/licensing/validation reports.
- `docs/reviews/`: simulated role reviews.

## What exists now

- **Learner Experience (default `/`)**:
  - `src/trainer.ts` + `public/ui/trainer.uikitml`: the 4-stage "First Five Minutes" spatial trainer:
    1. **Ghost Hand Warmup (`L -> B -> Y`)**: 1st-person wrist-anchored 3D Ghost Hand (`src/hand-rig.ts`) with per-finger green/amber match feedback and wrist progress halo.
    2. **My Name & Personal Words**: hybrid grader (`src/recognizer.ts` + `src/finger-gate.ts`) with plain-English coaching hints and honest abstention for self-occluded thumb-in-fist letters (`M/N/T/S/E/R/A`) and movement letters (`J/Z`): the app never grades these; you compare with the 3D Ghost Hand and tap **Looks right** (stored as a self-check, not a pass). **Skip Letter** is stored as a skip. After the letters you spell the whole word once, in one go, and that attempt is recorded (in memory only).
    3. **Reader's View Replay on Table**: replays *your own recorded one-go attempt*, turned 180° so you see it the way a reader across from you would, on a nearby real table (`XRPlane` labelled table/desk or a horizontal surface at seated table height within 1.3 m) or a world-locked virtual desk. A **wrist steadiness check** counts repeated up-and-down swings after filtering out tracker jitter. Double letters (`BOOK`, `ANNA`, `COFFEE`) are explained, not graded. With no recording it shows a labelled synthetic reference hand and says the check has no data.
    4. **Table Reading Mode (Receptive)**: a clearly labelled **Synthetic Tutor Hand** sits on your table and spells words at rising speed tiers (`Slow / Normal / Fast`) with 3 tactile word-choice buttons.
  - `src/setup-overlay.ts` + `src/storage.ts`: pre-XR 2D setup bar & drawer for entering your name and personal word list, choosing starter word packs (*Caregiver & Meds*, *Family & Names*, *Double Letters*), generating shareable word-list links, viewing the 26-letter tracker reliability & mastery grid, and linking to Deaf-led ASL learning resources.
- **Core Math, Pose Synthesis & Recognizer**:
  - `src/hand-features.ts`: turns the 25 WebXR hand joints into a 52-value hand-shape feature vector (mirrored for the left hand, zero-allocation, unit-tested in `tests/`).
  - `src/hand-poses.ts`: forward-kinematics 25-joint pose synthesizer for all 26 ASL letters (`A–Z`), `J`/`Z` motion trajectories, coarticulated word playback, and wrist bounce / double-letter dynamics analysis.
  - `src/asl-letters.ts` + `src/finger-gate.ts` + `src/recognizer.ts`: letter reference, variant-tolerant finger & palm coaching gate, and hybrid template recognizer with margin abstention.
- **Developer Tools (`?recorder=1` and `?probe=1`)**:
  - `src/recorder.ts` + `public/ui/recorder.uikitml` + `scripts/recordings-plugin.ts`: headset letter/word dataset recorder (`?recorder=1` or `?letters=...`).
  - `src/probe.ts` + `public/ui/probe.uikitml`: live feature & scene-understanding probe (`?probe=1`).
