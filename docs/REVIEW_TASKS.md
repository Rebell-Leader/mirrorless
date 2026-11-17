# Review tasks for the built app, by role (prepared 2026-11-16)

Run these against a **real Quest 3 build** before submitting, and again after any big change. They merge the three role checklists (`docs/reviews/*.md`) with the data-validation protocol (`docs/research/03-data-licensing-validation.md`).

**How each item is checked:**
- **EMU** = desktop emulator through the IWSDK CLI (scriptable).
- **QUEST** = by hand on the headset.
- **HUMAN** = needs another person: a stranger, a second learner, or a Deaf reviewer.
- **DOC** = submission text and video.

Priority: **P0** blocks submission · **P1** should pass · **P2** nice to have.

## A. Judge (Meta VR Start competition)

| # | Check | How | P |
|---|---|---|---|
| J1 | From the URL to the first green letter takes ≤ 60 s, with no reading needed | QUEST, stopwatch | P0 |
| J2 | No controller is ever needed, including enter, pause, resume and exit | QUEST | P0 |
| J3 | A stranger passes L, B, Y on their first attempt in ≥ 9 of 10 tries | HUMAN | P0 |
| J4 | Holding S when asked for A never passes; confusable pairs (M/N, U/V/R, K/P, G/H) never cross-pass | QUEST + EMU replay of recorded takes | P0 |
| J5 | Abstained letters show "can't grade" and a self-check, never a false fail | QUEST | P0 |
| J6 | Left-hand dominant works end to end | QUEST (`?hand=left`), EMU | P1 |
| J7 | Unscanned room or denied spatial permission: the fallback table appears within 3 s and nothing crashes | QUEST (deny the permission), EMU (no environment) | P0 |
| J8 | ≥ 72 fps for 5 minutes, including letter changes and replay | QUEST + OVR Metrics | P0 |
| J9 | A hand leaving view mid-letter causes no penalty, and the app recovers | QUEST, EMU (`set-connected`) | P1 |
| J10 | Essential UI stays within about 20° of gaze and reach; nothing important at the frame edges | QUEST, EMU screenshot | P1 |
| J11 | With sound muted, every cue is still visible | QUEST | P0 |
| J12 | After a browser restart, the streak, mastery grid and personal word list persist | QUEST | P1 |
| J13 | Handshapes match the reviewed reference (thumbs on A/E/M/N/S/T, palms on G/H/P/Q) | HUMAN (Deaf reviewer) | P0 |
| J14 | Every feature shown in the video exists in the build; footage is real Quest capture | DOC | P0 |
| J15 | The video's first 20 s show the ghost slide-in, the "no mirror" comparison, and the tutor on a real table | DOC | P1 |

## B. Caregiver trainee ("Maya")

| # | Check | How | P |
|---|---|---|---|
| C1 | From the Quest home screen to the first exercise takes ≤ 30 s (bookmark or PWA, one button) | QUEST | P1 |
| C2 | Within 5 min she spells her own name and gets a verdict for each letter | QUEST | P0 |
| C3 | She enters a client's name and one medication before XR, then practises both in one session | QUEST | P0 |
| C4 | A wrong shape gets a plain-words finger hint ("bend your index"), and she fixes it within 3 tries | QUEST | P0 |
| C5 | A deliberately wrong M, N and T each get "can't grade", never a pass | QUEST | P0 |
| C6 | Tracking holds in a dim living room and with the left hand | QUEST | P1 |
| C7 | Reading mode: 8/10 at the slowest tier, with replay; the speed rises only after success | QUEST | P1 |
| C8 | The next day it opens on her weakest letters | QUEST (fake the date), EMU | P2 |
| C9 | 10 seated minutes cause no nausea and no arm ache, and the text stays readable | HUMAN | P1 |
| C10 | The reviewer credit and the "not for medical communication / not an interpreter" notice are easy to find | QUEST, DOC | P0 |
| C11 | After a week she reads her client's name spelled at a natural pace | HUMAN (post-hackathon) | P2 |

## C. Deaf ASL user ("Jordan")

| # | Check | How | P |
|---|---|---|---|
| D1 | All 26 letters, including the J and Z movements, are signed off by a **named, paid Deaf signer** (credited in text only, with consent) | HUMAN | P0 |
| D2 | "Learn ASL", "translate", "fluent" and "interpreter" (as a claim) appear nowhere: app, video, Devpost | DOC, `grep -ri` over `src/`, `public/`, the submission | P0 |
| D3 | The app states what it can't do: signs, grammar, facial expressions, mouthing | QUEST | P0 |
| D4 | Left-handed mode grades correctly (features are mirrored; verify on real takes) | QUEST + eval on left-hand takes | P1 |
| D5 | Deliberately bouncy spelling never gets a perfect score in reader's view | QUEST | P1 |
| D6 | Double letters (BOOK, ANNA, COFFEE) are taught and checked | QUEST | P1 |
| D7 | The reading-mode hand is labelled "synthetic" until it comes from 2+ consenting Deaf spellers | QUEST, DOC | P0 |
| D8 | The learner can see per-letter grading reliability and which letters are never graded | QUEST | P0 |
| D9 | Any word that has a common sign (room words) is marked "this has a sign" | QUEST | P1 |
| D10 | The first session and the end screen link to Deaf-led learning (ASDC SignOn, Deaf teachers, local Deaf events) | QUEST | P0 |
| D11 | Nothing reads anyone else's hands; recordings stay local and are opt-in (dev recorder only) | Code review | P0 |
| D12 | The pitch uses no deaf children or Deaf stories without consent, and never implies it fixes language deprivation | DOC | P0 |

## D. Data and recognizer validation

| # | Check | How | P |
|---|---|---|---|
| V1 | Two or more sessions recorded; `pnpm eval:recordings` uses leave-one-session-out | eval | P0 |
| V2 | Per graded letter: precision ≥ 95% on held-out takes; otherwise the letter becomes self-check | eval | P0 |
| V3 | Second-person takes are evaluated on the first person's model; report the drop honestly | eval | P1 |
| V4 | Override-flagged takes are reviewed: is the finger gate wrong for that letter? | eval + manual | P1 |
| V5 | The abstention margin used in the app matches the eval's suggested threshold | code + eval | P0 |

## Re-running the role reviews on the built app

When there is a build (URL plus a video or screenshots), re-run three fresh subagents with the same personas as before: the judge, "Maya" the caregiver trainee, and "Jordan" the Deaf ASL user. Give each:
1. the URL or video, plus `docs/SYNTHESIS.md`;
2. their previous review (`docs/reviews/<role>.md`);
3. this checklist section for their role;
4. the instruction: "for each item report pass / fail / can't tell, with evidence; then list the top 3 remaining blockers."

Remind each one that it is a simulated perspective, and that D1 and J13 can only be passed by a real Deaf reviewer.
