# Science & pedagogy review (subagent report, 2026-11-15)

> Produced by a research subagent from web searches; most full texts were not opened.
> **[V]** = stated by a search result or fetched page; **[U]** = unverified or from memory.
> Treat [U] items as leads, not facts.

## 1. Sign language learning in VR/AR

- **ASL Champ!** is a VR game with a signing avatar and a recognizer trained on VR hand data, reporting about 87% test accuracy on 15 participants [V].
  - Sources: https://par.nsf.gov/biblio/10660437 ; https://arxiv.org/abs/2401.00289
  - The user studies were small, with no controlled learning-outcome comparison. It measures recognition and user experience, not whether people learned.
- **SAIL** (Quandt, Gallaudet) is a VR avatar teacher plus gesture tracking.
  - A study with 60 participants found a significant gain over non-interactive desktop learning [V]: https://par.nsf.gov/biblio/10303928
  - An AR signing avatar beat video and book learning [V]: https://par.nsf.gov/servlets/purl/10356532
- **Quest hand-tracking sign prototypes** have news coverage only [V]: https://roadtovr.com/oculus-quest-hand-tracking-sign-language-vr/
  - No peer-reviewed evaluation of a Quest fingerspelling tutor was found [U: the search was not exhaustive].

## 2. Perspective (the core of the ghost hand)

- **Imitation is most accurate from a first-person view.** The two third-person views (mirrored and anatomical) did not differ [V].
  - Source: https://link.springer.com/doi/10.1007/s00221-018-5428-7
- A first-person view means less mental spatial transformation [V].
  - Source: Jackson, Meltzoff & Decety 2006, https://ilabs.uw.edu/wp-content/uploads/Jackson_Meltzoff_Decety_NI06.pdf
- **No head-to-head study of first- versus third-person perspective in sign learning was found** [V]. SAIL frames first-person as a hypothesis, not a result.
  - Source: https://stemforall2019.videohall.com/presentations/1363
- **Conclusion:** the ghost hand is well motivated by motor-learning research but untested for signing. That makes it a novel contribution, and we must not claim it is proven.

## 3. Feedback and pedagogy

- **Guidance hypothesis:** feedback that is too frequent or too easy to lean on hurts retention (Salmoni, Schmidt & Walter 1984) [V].
- **Terminal beats concurrent:** feedback after the attempt outperformed feedback during it (Sigrist et al. 2013) [V].
- **Receptive fingerspelling is hard for second-language learners** [V]. Explicit phonetic instruction improved comprehension (Geer & Keane 2018, *Language Teaching Research* 22(4)) [V].
- **Spacing:** the optimal gap between reviews grows with how long you need to remember (Cepeda et al. 2006, https://pubmed.ncbi.nlm.nih.gov/16719566/) [V].
- **ASL 101 objectives** (ASLTA/ACTFL standards): not researched [U].

## 4. Quest hand-tracking accuracy

- **Quest 2 against motion capture** (Abdlkarim et al. 2024, https://pmc.ncbi.nlm.nih.gov/articles/PMC10830632/) [V]:
  - about 1.1 cm fingertip error;
  - about 9.6° mean joint-angle error;
  - about 45 ms delay.
- **Anecdotal Quest letter failures:**
  - R/U/M/N (R misread as U): https://eric-z4.github.io/projects/talking-hands.html
  - M/N/R/T/X: https://stewartsmith.io/work/handy-js
  - Gesture Play drops J/M/N/P/Q/R/T/U.
- **MediaPipe confusions:**
  - {A, M, N, S, T}: https://arxiv.org/pdf/2408.09311
  - M/N, U/V, D/O: https://arxiv.org/pdf/2305.17192
- **Candidate abstention set, to be measured on our own data:** M, N, T, S, E, A, R/U/V, plus the motion letters J and Z.

## 5. Hearing parents of deaf children

- **Mitchell & Karchmer 2004** (doi 10.1353/sls.2004.0005): fewer than 5% of US deaf and hard-of-hearing students have at least one deaf parent [V].
  - **Safe wording:** "about 95% of deaf children have hearing parents (Mitchell & Karchmer 2004)". Check Table 3 before publishing.
  - The sample is US students, so "born to" is slightly loose.
- **Language deprivation:**
  - Early language exposure (signed or spoken) determines later language-learning ability (Mayberry, Lock & Kazmi 2002, *Nature* 417:38) [V].
  - Humphries et al. 2012 make the case on the risks for deaf children [V].
  - **Cite these as urgency and risk, not as a diagnosis.**
- **Where fingerspelling fits for parents** (names, links to literacy): this is the common view, not established by evidence [U].

## 6. What we can measure and claim

- **Per session:** accuracy on graded letters, time to form a letter, and receptive letters per second at a fixed speed.
- **Over a week:** delayed retention, speed thresholds, and how consistently the streak is kept.
- **Limit:** before/after measurements without a control group cannot show the app teaches better than alternatives.

## Design implications

1. Keep the first-person ghost hand, and add a mirrored-view toggle as a cheap internal comparison.
2. Give feedback after each attempt by default, and fade it as the learner improves.
3. Show per-finger cues only after a failed attempt.
4. Abstain from grading M/N/T/S/E/A, R/U/V and J/Z, but calibrate that list on real Quest 3 captures.
5. On abstained letters, switch to a **self-check** against the ghost hand instead of silently dropping the letter.
6. Base mastery on recognizer confidence.
7. In receptive mode, use explicit phonetic cues (handshape and movement).
8. Space reviews out: same day, next day, then about a week.
9. For parents and caregivers, start with **names**.
10. Log recognizer latency and dropouts.

## Claims we can safely make

- The app uses a first-person view, which motor-learning research supports for imitation.
- It abstains rather than guessing on letters that tracking confuses.
- It measures accuracy, speed and retention in-app.

## Claims we must not make

- That it "teaches ASL", or that first-person beats a human teacher.
- That it diagnoses or intervenes in language deprivation.
- That it is validated on Quest 3.
- Any per-letter accuracy before we have measured it.
- That fingerspelling is the first thing parents should learn.
