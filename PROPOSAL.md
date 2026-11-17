# Proposal: Mirrorless (working title), revised 2026-11-16

> Revised after the research and simulated role reviews in `docs/` (see `docs/SYNTHESIS.md`). The first version over-scoped room spelling and over-claimed the deaf-children framing.

**Tagline (≤140 chars):** Fingerspelling practice that sees your hand from your own eyes, shows you how others see it, and admits when it can't judge.

**Entry:** Productivity track (a daily 5-minute practice habit), New Experience division. The most winnable special award is **First Five Minutes**. An entry can win at most one prize.

**Scope, stated everywhere:**
- ASL *fingerspelling* practice (the manual alphabet) only.
- Not ASL, not a translator, not communication access.
- Built by a hearing developer; letter shapes pending review by a paid Deaf signer.

## Problem
Hearing people who need to fingerspell names (caregivers, family of deaf people, students) practise alone with videos.
- Video teachers face you, so every handshape must be **mirror-flipped in your head**.
- Nothing tells you whether your hand is right.
- When apps do judge, they quietly drop the letters the tracker can't see.

About 95% of deaf children have hearing parents (Mitchell & Karchmer 2004), so many families start from zero. We cite this as context only. Families need everyday signs and Deaf mentors first; we link to Deaf-led resources and do **not** claim to address language deprivation.

## What makes it VR-native
1. **First-person ghost hand.**
   - The target handshape is a translucent hand anchored to your wrist, seen from your own eyes. Fingers turn green as they match.
   - No mirroring, and impossible on a phone or monitor.
   - Motor-learning research supports first-person imitation; it is untested for signing, and we say so.
2. **Honest grader.**
   - Per-finger hints ("index looks straight, should be curled") plus a template recognizer with a confidence margin.
   - When the margin is low, or a letter is measured as unreliable on Quest (expected for the thumb-over-fist group M/N/T/S/E/A and crossed R), the app says **"can't see well enough to grade this; check it against the ghost"**.
   - It never fakes a grade and never silently drops a letter.
3. **Reader's view replay.** After spelling a word, your own hand replays *facing you across your real table*: what a Deaf reader sees. It comes with bounce and rhythm feedback, because fluent fingerspelling is movement, not frozen poses.
4. **Reading mode on your table.** A tutor hand sits on the table detected in passthrough (with a virtual fallback) and spells words at rising speed tiers; you poke the right card. For the hackathon the tutor hand is synthetic and labelled as such. Afterwards it should be recorded from paid, consenting Deaf fingerspellers.
5. **Names first.** Your own name and a short personal list (a client's name, a street, a medication) come before anything else.

## First five minutes
- 0:00–0:20: a scope card (one sentence), then hands are detected.
- 0:20–1:00: match the ghost for **L, B, Y** (easy to track, distinct; the judge review advised not to start on A). A green chime-and-glow on each.
- 1:00–3:00: spell **your name**, entered on the page before entering XR. Per-letter verdicts, including honest "can't grade".
- 3:00–5:00: watch your name replayed in reader's view, then one reading round on your table.

## Stack
- **Immersive Web SDK** (three.js + ECS, TypeScript), hosted as a static site.
- Runs in immersive-ar (passthrough) with hand tracking and plane/mesh detection.
- No camera access, no LLM, no API keys, no cloud: hand data stays on the device.
- **Quest Browser does show a hand-tracking and spatial-data permission prompt.** The first version of this proposal wrongly said there were none.

## Built so far
- Hand features (52 values, mirrored for the left hand, unit-tested).
- Dev probe panel.
- Headset letter and word **recorder** with capture gates, saving to the laptop (`docs/RECORDING.md`).
- Offline evaluation: held-out sessions, abstention curve, model export.

## Plan to the deadline (Wed 2026-11-18 21:00 CET)

| When | Goal | Exit gate |
|---|---|---|
| Sun 16 | Record letters (2 sessions) and words. Train and evaluate. Show the ghost hand driven by your templates. Book a paid Deaf-tutor review. | A per-letter reliability table, and the ghost hand tracking your wrist |
| Mon 17 | Grader with abstention in the headset. Names-first flow. Reader's view replay with a bounce check. Reading mode on the table. Scope card. Persistence. | A complete cold-start 5-minute session works hands-only |
| Tue 18 | Polish (visual-first feedback, FoV, 72 fps), fallback room, real Quest footage, video, form. **Submit by about 18:00 CET.** | Submitted, with a 3 h buffer |

## Explicitly out of scope
- Multiplayer: only a stretch shareable word-list link.
- Any translation or recognition of other people's signing.
- Vocabulary signs.
- AI-generated signs.
- Medical or child-development claims.
- J/Z grading: self-check only.

## Risks
1. **Deaf review.** Book a paid session with a Deaf ASL tutor (online tutoring platforms) to review a 60 s A–Z clip, and credit them by name with consent. If that isn't possible in time, say exactly that in the submission.
2. **Templates from one person's hand fail on a judge's hand.** Record a second person, keep the abstention conservative, and onboard on L/B/Y.
3. **Existing apps** (Gesture Play, SignPose VR). Our edges: honest abstention, the first-person ghost, reader's view, and reading mode.
4. **Time.** Mon and Tue are workdays. Cut order: reading-mode speed tiers, then the replay's rhythm metric, then the fallback room's polish.
