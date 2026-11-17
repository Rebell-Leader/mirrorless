# Role review: Meta VR Start competition judge (simulated, 2026-11-15)

> Produced by a subagent role-playing an experienced XR product lead and judge. Verdict on the concept as proposed: **about 5.3/10, not yet a winner.** It has one genuinely VR-native idea (the ghost hand) but is over-scoped.

## 1. Scores (as proposed)

| Criterion | Score | Why | What would add +2 |
|---|---|---|---|
| Innovation | 6 | The first-person ghost removes mirroring, and it is impossible on a phone. But ASL apps already exist on Quest, and "room objects as curriculum" mirrors Meta's own Spatial Lingo sample. | A **receiver's view** (your hand duplicated across the table, as the reader sees it) and animated transitions between letters |
| Experience | 6 | Using the ghost as onboarding is excellent. But feedback led by chimes excludes Deaf users, and self-check on about a third of the letters breaks the flow. | Visual-first feedback, a dominant-hand toggle, and the tutor hand seated at the real table |
| Technical | 5 | Templates from one non-signer's hand will fail on a judge's hand. IWSDK labels only bounded meshes, and only after Space Setup. | Validation on 3+ people, 10-second calibration, a fallback for rooms with no scene data, and a locked 72 Hz |
| Polish | 4 (projected) | One person, 60 hours, default panels | One visual language (the glowing per-finger ghost as the hero) and an honest video |

## 2. Risks

**Stage 1:**
- Start membership. (Confirmed by the user on 2026-11-15.)
- The link has to load cold in Quest Browser, with the permission prompt explained.
- No identifiable non-entrants may appear in the video, so credit the signer reviewer in text only.

**Stage 2:**
- **"Education is boring."** Not fatal: Inkphony won the 2025 $100k Lifestyle prize teaching music theory, because it felt like play. Flashcards in AR won't.
- **Flat panels.** UIKit defaults look like web forms. Anchor the UI to the hand and the table.
- **Non-signer authorship.** The ghost *defines* what is correct. A wrong thumb on E/M/N/T or a wrong palm on G/H/P/Q is instantly visible to signers.
- **The deaf-children pitch over-claims**, because those parents need vocabulary first. Reframe it as fingerspelling literacy.
- **Competition.** Gesture Play is free, hands-only and has game modes. Our edge is the ghost and the reading mode.
- **The judge's own hands.** Don't onboard on "A": it is in the A/S/E/T/M/N fist cluster, and a failure on the first letter ends the review.
- **Room words hit the abstained letters:** TABLE (T), DOOR (R), WINDOW (N), COUCH (U), LAMP (M/P).
- **"WebXR feels less native."** This is a perception problem, not an fps one. Answer it with a PWA, one button, and a load under 5 seconds.

## 3. Track and award
- **Stay in Productivity.** A daily 5-minute drill is a "habit tied to a recurring context", and real games would outclass this in Gaming.
- **First Five Minutes is the most winnable award**, because the ghost slide-in *is* the product.
- Accessibility Forward invites the question "where are Deaf people in this?", which 60 hours can't answer.

## 4. Proposed additions
- **(a) Multiplayer: don't build.** Networking, hands-only room codes and no WebXR colocation would cost 20+ hours, and judges review solo on one headset.
  - Stretch, about 2 hours: a shareable word-list link.
- **(b) Translation helper: don't build.**
  - Quest tracks only the wearer's hands, so this needs camera access plus in-browser pose estimation, which breaks the frame budget.
  - Recognizing fingerspelling in the wild is unsolved, and it raises bystander privacy issues.
  - It contradicts the line "we never let a model invent a sign".

## 5. Must-haves and cuts

**Must-have:**
- First green letter in under 60 seconds.
- Three outcomes (correct / specific fix / honest abstain), validated on 3+ people.
- Reading mode with the tutor on the real table. It is deterministic, it is the differentiator, and it is purposeful passthrough.
- A signer review, stated in the description.
- A visual equivalent for every audio cue, and support for both hands.
- A saved streak and mastery grid.
- A fallback for rooms with no scene data.

**Cut:**
- multiplayer and translation;
- elaborate spaced repetition;
- letters-per-minute;
- grading of J and Z;
- room spelling as the headline (keep it as a 2-hour extra);
- any LLM.

**First 20 seconds of video:**
- 0–3 s: first-person view of a real hand sliding into the ghost, fingers turning green.
- 3–10 s: a mirrored video teacher next to the ghost, captioned "no mirror".
- 10–20 s: the tutor hand on a real table spells a name, and the user pokes the right card. Caption: "Real Quest 3 footage, hands only."

## Top 5 changes
1. Make reading mode core, and demote room spelling.
2. Onboard on **L, B, Y**, not A.
3. Validate on 3+ people's hands, add calibration, and publish per-letter reliability.
4. Get a signer review, reframe the pitch, and make feedback visual-first.
5. Add the receiver's-view hand.

## Judge's review checklist for the built app
1. From the URL to the first green letter takes 60 seconds or less.
2. No controller is ever needed, including to enter, pause and resume.
3. A stranger passes the first three letters in at least 9 of 10 tries.
4. Holding S when asked for A never passes.
5. Abstained letters show "can't grade", never a false fail.
6. Left-hand dominant works end to end.
7. With an unscanned room or a denied permission, the fallback appears within 3 seconds and nothing crashes.
8. It holds 72 fps for 5 minutes (OVR Metrics), including on letter changes.
9. A hand leaving view mid-letter causes no penalty.
10. Essential UI stays within about 20° of gaze and 2 ft of reach.
11. With sound muted, every cue is still readable.
12. After a browser restart, the lesson and streak persist.
13. Handshapes match the reference (thumbs on A/E/M/N/S/T, palms on G/H/P/Q).
14. Every feature shown in the video exists in the build.

Sources:
- Gesture Play: https://queststoredb.com/app/gesture-play-24771852309158778/
- Spatial Lingo: https://developers.meta.com/horizon/blog/spatial-lingo-open-source-app-ai-assisted-language-practice/
- 2025 winners: https://developers.meta.com/horizon/blog/meta-horizon-start-developer-competition-meet-the-winners/
- Inkphony: https://devpost.com/software/inkphony-the-world-is-your-instrument
- IWSDK scene understanding guide: https://developers.meta.com/horizon/documentation/iwsdk/guides/11-scene-understanding/
