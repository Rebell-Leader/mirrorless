# Prior art & user feedback (subagent report, 2026-11-15)

> Produced by a research subagent.
> - Devpost returned HTTP 403, so Devpost facts come from search snippets only. Winner status is **unverified**.
> - Live Reddit threads and full app-store review texts could not be pulled.
> - Vendor and affiliate "best app" lists are weighted lightly.

## Comparable projects

| Name | Platform | What it does | Feedback / status | Link |
|---|---|---|---|---|
| Gesture Play | Quest, free, early access (Jan 2026) | ASL alphabet via hand tracking, with a practice mode and a survival game | No ratings. **Drops J/M/N/P/Q/R/T/U** as untrackable | https://queststoredb.com/app/gesture-play-24771852309158778/ |
| SignPose VR | Quest, free (Jul 2025) | ASL Learn and Quiz modes, hand tracking | 1.0 stars from 3 ratings | https://queststoredb.com/app/sign-pose-vr/24069781642651333 |
| ISENSE | Quest 2 research app (Spanish and Italian sign languages) | Match an avatar's handshape, with a real-time ML check | Research paper, evaluation not read | https://arxiv.org/pdf/2401.08714 |
| Bern VR finger-alphabet trainer | Quest, SideQuest (German fingerspelling) | 3D sign display compared against a saved hand model; 23 signs | Student project | https://roadtovr.com/oculus-quest-hand-tracking-sign-language-vr/ |
| Talking Hands | Quest 3/3S, Unity, course project | Typing with the ASL alphabet | R read as U; M/N occluded, so they switched to the old M/N forms | https://eric-z4.github.io/projects/talking-hands.html |
| Devpost: ARSL, Catiator, Cast Your Sign, Gesture XR, Signari, Glyph | Quest or AR, student projects | ARSL spells objects detected in passthrough; Gesture XR has ghost-hand demos | Winner status unverified | https://devpost.com/software/arsl-vr-asl-learning , https://devpost.com/software/gesture-xr , https://devpost.com/software/signari-immersive-sign-language-learning-in-vr , https://devpost.com/software/catiator |
| Fingerspelling.xyz (Hello Monday / DEPT) | Web, webcam, MediaPipe | Fingerspelling checker aimed at parents of deaf children | Webby 2022 for Best UI; no accuracy figures | https://www.webbyawards.com/crafted-with-code/fingerspelling-with-machine-learning |
| Signs (NVIDIA + ASDC) | Web, camera | 3D avatar demonstrates signs, AI gives feedback on camera video, users contribute data | Launched Feb 2025; no public Deaf validation of the feedback | https://abc7news.com/post/nvidia-launching-artificial-intelligence-platform-signs-make-learning-american-sign-language-easier/15938292/ |
| Lingvano | Mobile | 600+ lessons by Deaf teachers (self-reported) | Thin reviews | https://apps.apple.com/app/id1547252782 |
| ASL Bloom | Mobile | Lessons, behind a paywall | Progress stalls without Pro | https://appshunter.io/ios/app/1631587710/reviews |
| The ASL App | Mobile | Made by Deaf creators, multigenerational signers | 4.2 from 10 reviews | https://trustburn.com/reviews/theaslapp-com |
| Ace ASL (SignAll) | Mobile | Camera-based AI feedback | Reviews not read | https://www.producthunt.com/products/ace-asl-by-signall |
| VR Fingerspeller | Windows + Leap Motion (2015) | Spell words with hand tracking; co-made by a Deaf author | E/M/N/T/R/S can't be formed on controllers | https://deaf.itch.io/vrfingerspeller |

Healthcare XR communication training is nearly absent.
- A co-designed 360 VR nursing simulation (n=8, aimed at empathy) is the closest: https://cronfa.swan.ac.uk/Record/cronfa70570/Details
- The Vital Signs trial (a Deaf-made training film): only 52 of 208 completed, and the effect reversed in older participants. https://pubmed.ncbi.nlm.nih.gov/41444068/

## Recurring requests by role

Direct feedback on XR apps is thin (3 Quest ratings in total), so most of this is inferred from adjacent evidence.

- **Hearing beginners:**
  - real handshape feedback (vendors market "AI feedback");
  - no paywall partway through;
  - every letter working.
- **Hearing parents:** time is the main barrier, then the learning curve and others' perceptions.
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC10785677/
  - https://read.qxmd.com/read/38221976/
  - Short sessions and a family framing fit this group.
- **Caregivers and healthcare workers:** evidence favours content produced by Deaf people. Nothing shows that fingerspelling alone helps clinical care.
- **Teachers and interpreters:** no direct sources. One r/asl post asks how Deaf people view Lingvano.
- **Deaf signers:**
  - Presence in VR is valued.
  - Worry that technology leaves signers behind again: https://uploadvr.com/sign-language-vr-asl/

## Deaf community critiques

- **Signing gloves:**
  - They capture only fingerspelling, not face, torso or signing space.
  - They are built for hearing people's convenience, without Deaf input, and billed as "translation".
  - Sources: https://www.kith.org/words/2020/02/29/sign-language-gloves-dont-translate/ and https://kmack3.github.io/Mack_and_Tian.pdf
- **Avatars:** WFD and WASLI caution against replacing human signers: https://wfdeaf.org/?p=7496
- **AI recognition** (Northeastern 2026 survey: https://news.northeastern.edu/2026/03/19/sign-language-technology-skepticism/):
  - Respondents fear hearing people will stop accommodating them, and that interpreters will be replaced in medical and legal settings.
  - They want the community involved from the start and defining what success means.
  - They want regional variation respected.

## Gaps this project can fill

1. **Honest abstention.** Others drop letters (Gesture Play) or swap in different forms (Talking Hands).
2. **First-person ghost hand anchored to the learner's wrist.** None found shipped. Check Gesture XR's demo before claiming novelty.
3. **Per-finger correction.** Every other app found is described as match / no-match.
4. **Room-aware spelling without a camera** (scene labels). Cite ARSL, which detected objects in passthrough, as precedent.
5. **Receptive practice with a tutor hand that speeds up.** None found on Quest.
6. **No cloud, no LLM, no camera.** This answers the privacy concern and the "wrapper" guideline.

## Mistakes to avoid

- Claiming "translation" or "learn sign language". Frame it as a **fingerspelling trainer**.
- Grading what Quest cannot see. Show the abstention in the demo.
- **No Deaf involvement**, the most repeated criticism. Get a Deaf signer to review handshapes and wording, and credit them.
- Positioning it as a substitute for interpreters. It is practice, not communication access.
- Publishing unvalidated accuracy numbers.
- Using a tutor avatar that looks like an authority without a published source behind it.
- Ignoring regional variants, such as the older M/N forms.

## Open questions

- What did the Devpost judges say?
- What results does ISENSE report?
- What does the CHI 2026 Deaf-focused paper recommend?
- How good is tracking on Quest 3 now?
- What do r/asl and r/deaf users actually say about fingerspelling-only practice?
- Does any Quest title already show a first-person ghost hand?
