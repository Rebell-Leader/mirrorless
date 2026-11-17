# Data, licensing & validation (subagent report, 2026-11-15)

> Produced by a research subagent with web search and page fetches.
> - Chart images were not visually inspected.
> - Helen Keller Services (HKS) and Wiktionary share near-identical wording, so they count as **one** source.
> - Nothing here is legal advice.
> - Letter fixes have been applied to `src/asl-letters.ts`. They still need **Deaf signer sign-off**.

## 1. Letter verification

| L | Verdict | Correction (now in `asl-letters.ts`) | Sources |
|---|---|---|---|
| A | fix | Thumb rests flat against the side of the index, tip level with the top of the fist; it doesn't stick up | HKS, WP, SSc |
| B | OK | | HKS, WP |
| C | fix | Palm **forward**, angled toward the non-dominant side if comfortable; accept the range. A fully sideways C is called a mistake | SSc, SSm, LP2 |
| D | OK | The middle fingertip touches the thumb tip | HKS, LP2 |
| E | fix | Tips rest **on** the thumb. The open-gap E is a common variant: accept it, don't mark it wrong | HKS, SSm, LPE, WP |
| F | OK | | HKS, WP |
| G | fix | Points toward the non-dominant side (anywhere from forward to across the body), palm toward the signer. A thumb-up variant exists | SSm, LPh, WP, YRK |
| H | fix | As G with index and middle fingers. A thumb-up variant exists | SSc, LPh, WP |
| I | OK | | HKS, WP |
| J | fix | Start from I, palm forward. Rotate the forearm; the pinky traces down, then hooks toward the midline. *The exact path needs a video check* | WP, LP2 |
| K | OK | Palm forward | HKS, WP, SSm |
| L | OK | | HKS, WP |
| M | OK+ | Thumb tip peeks out between ring and pinky. Fluent signers fold it more loosely | HKS, LP2, LPh |
| N | OK+ | Thumb tip peeks out between middle and ring | HKS, LP2 |
| O | fix | Palm **forward**; rounded | SSm, SSc, HKS |
| P | OK | Comes from K by bending the wrist; palm roughly parallel to the ground. A regional variant exists | SSc, SSm, LP2, LPh |
| Q | OK | | SSc, LP2, YRK |
| R | fix | Middle finger **behind** the index (the index is on the palm side) | LPR, HKS, PS |
| S | OK | | HKS, WP, SSc |
| T | OK+ | Thumb under the index finger, tip poking out between index and middle | HKS, SSc |
| U | OK | | SSc, WIKT |
| V | OK | | HKS, WP |
| W | OK | Often the same as the number 6 | WIKT, LPW |
| X | fix? | Palm forward; base joint straight, middle and end joints bent. *A signer needs to confirm* | HKS, YRK, WP |
| Y | OK | | HKS, WP |
| Z | OK+ | Draws a Z as if on a wall in front: across, diagonal, across | LPZ, SSm, WP |

Sources:
- HKS https://www.helenkeller.org/asl-handshapes-described/
- WIKT https://en.wiktionary.org/wiki/Appendix:Sign_language_handshapes
- WP https://en.wikipedia.org/wiki/American_manual_alphabet
- SSc https://www.signingsavvy.com/article/366/
- SSm https://www.signingsavvy.com/article/251/gift
- LP2 https://www.lifeprint.com/asl101/fingerspelling/fingerspelling2.htm
- LPh https://www.lifeprint.com/asl101/pages-layout/handshapes.htm
- LPR https://www.lifeprint.com/asl101/pages-signs/r/r.htm
- LPZ https://www.lifeprint.com/asl101/pages-signs/z/z.htm
- LPE https://lifeprint.com/asl101/pages-signs/e/e.htm
- PS https://www.pocketsign.org/asl/r (weak source)
- YRK https://arxiv.org/html/2406.04024v2: G, H, P and Q are the only palm orientations that differ from the default.

## 2. Licensing

| Source | Terms | What we can do |
|---|---|---|
| Lifeprint | © Lifeprint, no reuse terms | Treat as all rights reserved |
| Signing Savvy | Terms forbid copying, embedding or repackaging | Don't use |
| Handspeak | Needs prior written permission; **forbids AI/ML use** | Never use it to build templates |
| HKS | All rights reserved | Don't use |
| Wiktionary | CC BY-SA 4.0 | Reusable with attribution and share-alike |
| Wikimedia Commons "Sign language A.svg" … "Z.svg" by wpclipart.com | **Public domain worldwide** | **Use these.** Check each one visually against the table first. https://commons.wikimedia.org/wiki/Category:ASL_letters |
| "Asl alphabet gallaudet.svg" | Unclear: derived from a font Lifeprint says is copyrighted | **Avoid** |

- **Our approach:** write all descriptions in our own words, and treat reference sites as fact-checking only.
- **Courtesy credit for the Commons images:** "ASL letter illustrations: wpclipart.com via Wikimedia Commons, public domain."

## 3. Open datasets

| Dataset | License | Use for us |
|---|---|---|
| **FSboard** (Google): https://www.kaggle.com/datasets/googleai/fsboard , https://arxiv.org/abs/2407.15806 | **CC BY 4.0**, plus responsible-use requests (no re-identification, don't exaggerate, involve the Deaf community) | 147 Deaf signers, more than 3M characters, MediaPipe landmarks. Labels are per sequence, so templates need alignment. Phrases are synthetic. Usable only as a MediaPipe proxy benchmark |
| Kaggle ASL Fingerspelling (same data) | "CC-BY", version not verified | Prefer FSboard |
| ChicagoFSWild / FSWild+: https://home.ttic.edu/~klivescu/ChicagoFSWild.htm | Not stated (third-party online videos) | Best source of natural fingerspelled words, if the license allows |
| ASL Citizen, WLASL, How2Sign | Non-commercial only | Avoid for a prize entry |
| MS-ASL | Not stated | Avoid |
| Sign Language MNIST | CC0 | Too low-resolution |
| ASL Alphabet (Kaggle) | GPL-2, uploader label | Rough cross-check only |
| **Quest / OpenXR / Leap fingerspelling joint data** | **None public found** | Our own recordings are the only Quest-native data, which is a contribution in itself |

**Does MediaPipe data transfer to WebXR?**
- MediaPipe has 21 landmarks; WebXR has 25 joints. The phalanx joints map to MCP/PIP/DIP/TIP, and the thumb metacarpal/proximal/distal map to CMC/MCP/IP. WebXR's finger metacarpals have no MediaPipe counterpart. *This mapping is inferred and needs checking against a logged frame.*
- MediaPipe coordinates are normalized to the image and viewed from the camera, often mirrored as a selfie.
- **Only scale- and rotation-invariant features transfer**, which is how ours are built.
- **WebXR lets runtimes *emulate* occluded joints.** For M/N/T/S/E the grader may be grading guessed joints, which strengthens the case for abstaining.

## 4. Restrictions and checkers

**Meta policy:**
- No claims to diagnose, mitigate, cure or treat a disease, and no claims to be a medical device.
- No apps directed at children under 10. Market to parents and learners.
- Hand data counts as Device User Data. It may not be sold, used for profiling, or used to identify someone. Collecting it requires a privacy policy and a deletion path.

**Deaf community:**
- **WFD/WASLI:** signed languages are full languages. Sign-language work should be led by Deaf native signers and reflect variation.
- **EUD ethical framework (2025):** co-creation, consent and fair pay. A signer's style may not be cloned without separate written authorisation, which applies if the tutor hand is recorded from a signer.
- **BDA:** calls for deep involvement of the deaf signing community.
- **Desai et al. 2024:** Deaf researchers should lead.

**What this asks of us:**
- Call it "ASL fingerspelling practice", never "translation".
- Say the builder is hearing.
- Pay and credit Deaf reviewers.
- Note individual and regional variation, and that other countries use different manual alphabets.

**Privacy:**
- WebXR hand input requires consent, and Quest Browser shows a permission notice. **The proposal's "no privacy prompts" was wrong.**
- Illinois BIPA counts hand geometry as a biometric identifier.
- Keep joint logs local, get written consent from anyone recorded, and keep recordings out of git.

**Naming:**
- Descriptive use of "ASL" is probably fine (unverified).
- Avoid names close to Handspeak®, ASL University™, Signing Savvy and Lifeprint.
- "Mirrorless" has no conflict with an ASL product name.

**Validation protocol for the next 2 days:**
1. Apply the letter fixes. **Done.**
2. Record a 30–60 s clip of the ghost hand doing A–Z, in first-person and viewer views, plus 5 fingerspelled words.
3. One or two paid fluent Deaf signers rate each letter as acceptable, acceptable variant, or wrong.
4. A letter is graded only if every rater accepts it. Otherwise it moves to self-check.
5. **Recognizer gate, per letter:** 60 held trials over 3 sessions, evaluated leave-one-session-out.
   - Graded precision of at least 95%.
   - False acceptance of 5% or less on at least 20 confusable attempts.
   - Report the abstain rate.
   - Note: 0 errors in 60 trials still means an upper bound of about 5% (rule of three).
6. **Receptive check:** a rater reads the tutor hand at two speeds and gets at least 90% of words right.

**Fuller protocol for later:**
- At least 3 Deaf raters; target Fleiss' kappa of 0.61 or more.
- Agreement between the recognizer and the raters on the same attempts.
- 10–20 learners, including left-handed users, varied hand sizes and lighting.
- Confusion matrices and coverage curves.
- A pre/post receptive test, with ethics review before publishing.

## Must-fix before showing learners

1. Letter fixes for A, C, E, G, H, J, O, R, X and Z. **Applied; awaiting Deaf review.**
2. Accept or abstain on known variants (open E, angled C, thumb-up G/H, loose M/N/T, regional P). Never mark them wrong.
3. Use no Lifeprint, Signing Savvy, Handspeak or HKS text or images. Use only the wpclipart public-domain SVGs, after a visual check.
4. Show a disclaimer: manual alphabet only, not ASL, not a translator, built by a hearing non-signer, reviewer named with consent, letters vary.
5. Room words have their own signs. Frame them as spelling practice and say so in the app.
6. Fix "no privacy prompts" in the proposal, and keep hand data local.
7. If a tutor hand is ever recorded from a signer, get written consent and pay them.
8. Make no health or child-development outcome claims.
