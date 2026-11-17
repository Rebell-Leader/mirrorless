# Synthesis: research, role reviews and value (2026-11-16)

**Inputs:**
- `docs/research/01-prior-art-feedback.md`
- `docs/research/02-science-pedagogy.md`
- `docs/research/03-data-licensing-validation.md`
- `docs/reviews/judge.md`
- `docs/reviews/caregiver-trainee.md`
- `docs/reviews/deaf-asl-user.md`

The role reviews are **simulated** perspectives grounded in published sources. They do not replace real Deaf reviewers or real users.

## 1. Where all six sources agree

| # | Finding | Sources |
|---|---|---|
| 1 | **Honest abstention is our clearest differentiator.** Gesture Play drops 8 letters, Talking Hands swaps letter forms, and nobody else says "I can't see this". The caregiver trusts the app *more* because of it. | prior art, science, caregiver, judge |
| 2 | **The first-person ghost hand is novel and well motivated, but unproven for signing.** Imitation is best from a first-person view (motor-learning literature), but no sign-learning study exists. It helps in week 1; reading other people's hands is the long-term skill. | science, Jordan, judge |
| 3 | **Static pose grading is not how fingerspelling works.** Grade transitions, bounce, rhythm and whole words. Reading whole-word shapes is the expert skill. | Jordan, science (Geer & Keane), judge (animate transitions) |
| 4 | **Room-object spelling is backwards as a headline.** TABLE, DOOR and LAMP have their own signs, and those words hit our abstained letters (T, R, N, U, M, P). Keep passthrough purposeful in another way: put the tutor hand and cards *on your real table*. | Jordan, judge, data report |
| 5 | **Names first.** A personal word list (your name, a client's name, medications, places) is what caregivers and parents actually need from fingerspelling. | caregiver, Jordan, science (names-first) |
| 6 | **No translation helper.** It is technically infeasible (Quest tracks only the wearer's hands, so it would need the camera), harmful (it would replace interpreters, push Deaf people to sign "for the machine", surveil bystanders), and it contradicts our honesty pitch. | all three reviewers, prior art, data report |
| 7 | **No multiplayer now.** It would cost 20+ hours, judges review solo, beginners lock in each other's errors, and the app must never grade a Deaf partner. | judge, Jordan, caregiver |
| 8 | **A Deaf reviewer is mandatory**: paid, credited by name with consent, before public footage. This is the most repeated criticism of hearing-built sign tech. | prior art, Jordan, data report, judge |
| 9 | **Scope wording.** Say "ASL fingerspelling practice". Never "learn ASL", "translate" or "fluent". State the limits: no signs, grammar, faces or mouthing. Say a hearing developer built it. | Jordan, data report, prior art |
| 10 | **Feedback must be visual-first** (Deaf and muted users), terminal rather than continuous, and faded over time. | judge, science |

## 2. Value: who gets what

| Who | Value we can honestly deliver | Value we must not claim |
|---|---|---|
| Hearing learners (students, caregivers, family) | Private, fast, hands-on practice of the manual alphabet, with feedback that admits uncertainty; names and personal words first; reading practice | Learning ASL; communication access |
| Hearing parents of deaf children | A supplement for names, and links to Deaf-led resources (ASDC SignOn, Deaf mentors) | Fixing language deprivation; "what parents should learn first" (everyday signs come first) |
| Caregivers and healthcare workers | Spelling client and medication names; a "can't grade" signal that prevents false confidence | Use in medical communication; that needs interpreters, writing and teach-back |
| Deaf community | More hearing people who can fingerspell names properly; a tool that credits and pays Deaf reviewers | Any representation of ASL beyond the manual alphabet |
| Meta judges | A hands-first app whose hands are the subject; honest abstention; a first-person view impossible on flat screens; real passthrough use (tutor on your table) | Validated learning outcomes; validated Quest 3 accuracy before we measure it |
| Research | The first Quest-native fingerspelling joint dataset we know of, plus measured per-letter reliability on Quest 3 | Generalization beyond our recorded hands |

**One-line value proposition (revised):** *"Fingerspelling practice that sees your hand from your own eyes, shows you how others see it, and tells you honestly when it can't judge."*

## 3. The two proposed additions: decision

### (a) Multiplayer practice with hints: not for the hackathon
- **Now:** a 2-hour stretch goal at most, a **shareable word-list link** (a teacher, parent or caregiver agency shares names to practise). No networking.
- **Later:**
  - Async "practice partner" challenges between learners, graded only by the app's checker, with hint limits.
  - Optional co-practice with **paid Deaf mentors** who set the terms. The app never grades the Deaf person.

### (b) Automatic translation helper: rejected, now and later
**The safe version of the same wish is two features we can build:**
1. **Reader's view replay.** Replay *your own* recorded spelling as a hand facing you across your real table, so you see what others see, with bounce and rhythm feedback. It uses only your own data, needs no camera, and directly answers the judge's "+2 Innovation" ask and Jordan's "reader's view" ask.
2. **Reading mode from consenting Deaf fingerspellers.** For the hackathon, use a synthetic tutor hand clearly labelled as synthetic. After the hackathon, record paid, consenting Deaf spellers under a written agreement (EUD framework).

## 4. Revised product plan for the remaining ~45 hours

**P0, must ship:**
1. **First five minutes:**
   - The ghost hand appears on your wrist, and you match **L → B → Y**, letters that are easy to track and visually distinct. The judge warns not to start on A.
   - Then you spell **your own name**, entered on the page before entering XR.
   - First green letter in under 60 s.
2. **Grader:** per-finger hints (finger gate) plus a template recognizer with **margin abstention**. Self-check mode for unreliable letters. A per-letter reliability card. Trained on your recordings, ideally plus one more person's.
3. **Names-first practice:** a personal word list with up to 5 names or words, stored locally.
4. **Reader's view replay with a bounce/rhythm check** for word attempts.
5. **Reading mode on your real table:**
   - A tutor hand on a detected table plane, falling back to a virtual table, spells words at speed tiers.
   - You poke the right card out of 3.
   - The tutor hand is labelled "synthetic".
6. **Honesty and respect:**
   - A scope card: fingerspelling practice only, not ASL, not a translator, built by a hearing developer, letters pending Deaf review.
   - Links to Deaf-led learning.
   - Visual-first feedback, with sound optional.
7. Streak and mastery grid saved in localStorage. Left-hand support (the features are already mirrored).

**P1:**
- A Deaf reviewer session (book a paid online session with a Deaf ASL tutor to review a 60 s clip of A–Z).
- Second-person recordings.
- A fallback room with no scene data.
- The 72 fps check with OVR Metrics.

**P2:** a shareable word-list link; room labels as optional spelling practice tagged "this has a sign".

**Cut:** multiplayer, translation, J/Z grading (record them but self-check), letters-per-minute, any LLM.

## 5. Recorder implications (already built in this session)
- **Word mode** records whole words (transitions, bounce, double letters) for the reader's-view replay and rhythm checks.
- **Capture gates:** the finger pattern plus consistency with earlier takes, with a 3 s override that gets flagged. These stop relaxed hands being saved as letters.
- **Recordings stay local and git-ignored.** Get consent from anyone else recorded (hand geometry counts as biometric under laws such as Illinois BIPA).
