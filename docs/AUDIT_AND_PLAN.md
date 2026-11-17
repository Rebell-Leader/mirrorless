# Comprehensive Project Audit & Winning Implementation Plan (2026-11-17)

## 1. Executive Reality Check: Documentation vs. Shipped Code

The research, ethical scoping, and synthesis documents (`PROPOSAL.md`, `docs/SYNTHESIS.md`, `docs/REVIEW_TASKS.md`) are well-grounded, honest, and directly aligned with the Meta VR Start Developer Competition 2026 rubric.

However, a ground-truth code audit of `src/`, `public/`, `scripts/`, and `data/` shows that **only the developer data-collection and diagnostic tools exist in code so far**. None of the learner-facing application exists yet:

| Component | Planned in `PROPOSAL.md` / `SYNTHESIS.md` | Actual Status in Codebase |
|---|---|---|
| **Hand Feature Math** | 52-value scale/hand-invariant vector | **Built & tested** (`src/hand-features.ts`, `tests/hand-features.test.ts`), but has **2 math defects** (Section 5) |
| **Dev Recorder & Probe** | Capture letter/word takes to laptop | **Built** (`src/recorder.ts`, `src/probe.ts`, `scripts/recordings-plugin.ts`) |
| **Offline Recognizer & Eval** | Template matcher + margin abstention | **Built** (`src/recognizer.ts`, `scripts/eval-recordings.ts`), but has **3 algorithmic flaws** (Section 5) |
| **Real Quest 3 Recordings** | 2+ sessions of A–Z + words in `data/recordings/` | **0 files** (`data/recordings/` is empty; only synthetic emulator takes exist in `data/emulator-test/`) |
| **1st-Person 3D Ghost Hand** | Wrist-anchored translucent 3D hand with per-finger green match glow | **0% built** (no 3D hand rig or canonical 25-joint pose synthesizer exists) |
| **Learner Onboarding & Grader** | Cold-start `L → B → Y → Your Name` with honest abstention & self-check | **0% built** (`src/index.ts` boots directly into the dev `RecorderSystem`) |
| **Reader's View Replay** | 3D hand replaying your word across the table + wrist-bounce & double-letter check | **0% built** |
| **Table Reading Mode** | Synthetic tutor hand on detected `XRPlane` table (or virtual fallback) + 3 poke cards | **0% built** |
| **Pre-XR 2D Setup & Scope UI** | Enter your name + personal words before XR; scope disclaimer & Deaf-led links | **0% built** (`index.html` is an empty `#scene-container`) |
| **Static Build Readiness** | Hosted URL on Vercel/GitHub Pages working standalone | **Broken on static hosts** (`RecorderSystem` calls `/api/recordings/summary`, which only exists in Vite dev server middleware) |

---

## 2. Multi-Perspective Review (Code + Design Audit)

### 2.1 Meta VR Start Competition Judge
* **Stage 1 Pass/Fail Blocker — Broken In-XR Exit Button:**
  * In `src/panel.ts`, `#exit-button` lives inside `probe-panel` (`public/ui/probe.uikitml`).
  * However, `src/probe.ts` hides `probe-panel` (`entity.object3D.visible = false` and removes `RayInteractable`) upon entering XR (`VisibilityState.Visible`) unless `?probe=1` is set.
  * Consequence: inside XR, there is no button to exit the session hands-only, failing Judge check **J2** (*"No controller is ever needed, including enter, pause, resume and exit"*).
* **Stage 2 — Innovation & Creativity (25%):**
  * The **1st-person wrist-anchored Ghost Hand** + **Reader's View Replay** is a genuine VR-native differentiator: a phone or webcam app cannot anchor a 3D target skeleton onto your own wrist in stereoscopic depth or replay your recorded 3D trajectory facing you across a physical table.
  * Gap: `TemplateModel` (`src/recognizer.ts`) strips out the 25 joint poses and stores only standardized 51-float vectors, which cannot render a 3D hand. We need canonical 25-joint 3D poses (`src/hand-poses.ts`) scaled to the user's live hand size (`handScale`).
* **Stage 2 — Experience Design (25%):**
  * **"Airplane Seat Test" (2 ft / 0.6 m reach) Violation:** `src/recorder.ts` places the main panel at `1.0 m` (`3.3 ft`) in front of the head (`hx + fx * 1.0`), even though `PokeInteractable` is attached. A seated user cannot poke a panel 1.0 m away without leaning out of their chair.
  * **Purposeful Passthrough:** `ProbeSystem` only counts `XRPlane` / `XRMesh` labels into a debug string. To satisfy the competition requirement that *the real room changes the experience*, the **Reader's View Replay**, **Reading Mode Tutor Hand**, and **tactile Poke Cards** must anchor onto a detected horizontal table/desk `XRPlane` (with an automatic 3-second fallback virtual table at seated desk height when no plane is detected or spatial permission is denied).
* **Stage 2 — Technical Implementation (25%):**
  * `HandTrackingSystem` (`src/hand-tracking.ts`) uses batched `fillPoses` / `fillJointRadii` with zero per-frame allocations.
  * However, in `data/emulator-test/models/templates-right.json`, letter `B` (open flat palm) had **0% accuracy** (confused with `A`, closed fist) due to un-gated training takes and z-score variance blowup on low-variance dimensions.

### 2.2 Deaf ASL User & Educator ("Jordan")
* **Strengths:**
  * `src/asl-letters.ts` uses original descriptions checked against multiple references with corrected thumb/palm rules (`A, C, E, G, H, J, M, N, O, R, T, X, Z`) and explicit `verified` status notes.
  * Framing avoids "learn ASL", "translator", or replacing interpreters.
* **Gaps to Fix:**
  * **Visual-first state transitions:** Audio chimes (`this.beep(...)`) must always be paired with an immediate 3D visual cue on the Ghost Hand and status badge so Deaf and muted users never miss a capture, transition, or coaching hint.
  * **Variant tolerance in `finger-gate.ts`:** Letter `E` is currently `CCCC.` (`curl >= 0.55`), which rejects the common open/hooked `E` variant where MCP knuckles are less flexed (`curl ~ 0.42–0.52`). Adjusting `E` to accept hooked/curled fingers and relaxing palm orientation weights for `C, G, H, P` avoids marking natural signing variants wrong.
  * **Movement over frozen poses:** Word practice must evaluate **wrist bounce** (vertical pumping `Δy` per letter) and **smooth double-letter slides/re-articulations** (`BOOK`, `ANNA`, `COFFEE`, `PIZZA`) in Reader's View Replay.

### 2.3 Caregiver / Healthcare Trainee ("Maya")
* **Pre-XR Personalization:** Typing on a virtual keyboard in VR is slow. Adding a clean **2D HTML setup overlay** before entering XR lets Maya type her own name (`MAYA`) and client/medication words (`HANNAH`, `ADVIL`, `BOOK`, `COFFEE`) in seconds, persisted in `localStorage`.
* **Plain-English Coaching & Honest Abstention:** Replace raw numbers (`steadiness 0.012`) with plain-language finger coaching (`"Bend your index finger"`, `"Turn your palm toward yourself"`) and an explicit **Honest Abstention / Self-Check** flow when a letter is in the self-occluded thumb-over-fist group (`M, N, T, S, E, R`).

### 2.4 Cold-Start Stranger in XR
* **Hand-Over-Panel Occlusion & Accidental Pinch-Ray Clicks:**
  * In Quest WebXR, pinching thumb and index finger together (as required to sign `F`, `O`, `D`, or `A`) triggers a system `select` event along the hand's forward ray.
  * If interactive buttons (`RayInteractable`) sit directly behind the signing hand at `[0, 1.45, -1.0]`, forming `F` or `O` accidentally clicks panel buttons!
  * **Fix:** Offset the instructional HUD slightly above eye-center (`~0.85 m` away) and place interactive controls on a **tilted console/table dock within seated reach (`0.48 m` forward, `0.28 m` below eye level)**, guarded against accidental triggers while actively holding a letter.

---

## 3. Competitive Landscape & Positioning

| Project | Platform | Approach | Weakness | Mirrorless Advantage |
|---|---|---|---|---|
| **Gesture Play** (2026) | Quest Store | Free ASL alphabet practice & survival game | **Drops 8 letters** (`J, M, N, P, Q, R, T, U`) as untrackable | **All 26 letters included:** honest abstention + 1st-person Ghost Hand self-check on occluded letters |
| **SignPose VR** (2025) | Quest Store | Learn & Quiz modes | **1.0★ rating:** binary pass/fail with no finger-level coaching | **Per-finger 3D color feedback** + plain-English finger hints (`finger-gate.ts`) |
| **Talking Hands** | Quest 3 (Unity) | ASL alphabet typing | `R` read as `U`; replaced `M/N` with archaic forms to satisfy tracker | **Never alter ASL to fit the sensor;** report tracker confidence honestly |
| **Fingerspelling.xyz** | Web (MediaPipe) | 2D webcam fingerspelling trainer | Requires mental mirror-flipping; no 3D depth for `P/Q/G/H`; no receptive mode | **Zero mirror-flip** (1st-person wrist ghost) + **Reader's View across your table** + **Table Reading Mode** |
| **Inkphony** (2025 $100k Winner) | Quest MR | Passthrough piano trainer | Won by anchoring immediate tactile spatial feedback onto a real surface | **3D Ghost Hand on wrist + Tutor Hand & tactile cards anchored to the user's real table** |

---

## 4. VR, WebXR & IWSDK Best Practices Checklist

1. **Seated 2 ft ("Airplane Seat") Envelope:**
   * Neutral signing space is `0.32–0.42 m` in front of the chest.
   * Interactive desk dock / poke cards sit at `0.45–0.52 m` depth, `-0.26 m` below eye level, tilted `30–35°` upward for effortless seated reach and ray/poke comfort.
2. **FoV-Aware Spatial Layout:**
   * Keep the active prompt, Ghost Hand, and feedback banner inside a `±20°` horizontal cone so the user never has to crane their neck between their hand and the instructions.
3. **Hands-Only Completeness (J2):**
   * Include an explicit **Exit XR** button on the in-XR trainer dock alongside **Pause**, **Hand: Right/Left**, **Recenter**, and **Mode Switch**.
4. **72–90 fps Frame Budget (`< 11 ms`):**
   * Pre-allocate all `Vector3`, `Quaternion`, `Matrix4`, and typed arrays in `init()`.
   * Build the 3D hand rigs (`GhostHand`, `ReaderReplayHand`, `TutorHand`) from shared low-poly Three.js primitives (`SphereGeometry` + `CylinderGeometry` imported from `@iwsdk/core`), keeping total triangle count under `4,000` triangles across the entire scene.
5. **Graceful Passthrough & Unscanned Room Fallback (J7):**
   * Query `XRPlane` entities for horizontal table/desk surfaces; if none is found within 2.5 seconds (or permissions are denied / running in desktop emulator), automatically materialize a clean, semi-transparent **Virtual Practice Desk Surface** at seated table height (`hy - 0.38 m, dist 0.52 m`).

---

## 5. Mathematical & Algorithmic Fixes Required

1. **`F.spread` Singularity on Curled Fingers (`src/hand-features.ts`):**
   * `bonePlaneAngle` projects the proximal phalanx onto `(ax, ay)` and calls `Math.atan2(dot(a, ax), dot(a, ay))`. When fingers are curled into a fist (`A, S, E, M, N, T`), `dot(a, ay) ≈ 0`, causing `atan2` to flip wildly between `$-\pi$` and `$+\pi$`.
   * **Fix:** Weight/attenuate each spread angle by the extension of the two adjacent fingers (`Math.max(0, 1 - curl_i) * Math.max(0, 1 - curl_j)`) and clamp minimum forward projection so curled fingers always yield `spread ≈ 0`.
2. **Thumb Across-Palm Adduction (`src/hand-features.ts`):**
   * `F.flex + 14` (`dot(a, az)`) only captures thumb out-of-palm elevation, missing across-palm tuck (`dot(a, ax)`).
   * **Fix:** Incorporate across-palm thumb orientation into the thumb opposition feature and refine `checkFingers` thumb checks (`A` = thumb alongside index, `T` = tucked across palm, `O` = thumb abducted out).
3. **Recognizer Variance Floor, Absolute Distance Gate & Hybrid Grader (`src/recognizer.ts`):**
   * Floor `std[d]` per feature group to physically meaningful minimums (`0.18` for curls, `0.35` for flex/tips, `0.25` for spread/thumbTo/cross, `0.40` for head-relative orientation) so low-variance training sets never blow up orientation diffs by `1000x`.
   * Add `gradeHandshape()` combining:
     * **Per-finger & palm coaching gate** (`checkFingers` + palm facing for `G, H, P, Q`),
     * **Template distance & margin check** (requiring both `distance <= maxDistance` and `margin >= abstainMargin`),
     * **Honest Abstention** on high-occlusion letters (`M, N, T, S, E, R`) or low-margin matches, routing the learner to **Ghost Self-Check** instead of guessing.
4. **Canonical 3D Hand Pose Synthesizer (`src/hand-poses.ts`):**
   * Synthesize anatomically accurate 25-joint wrist-local poses (and `J`/`Z` + word trajectories) for all 26 ASL letters, scaled dynamically to the user's `handScale`.
   * Generate baseline template vectors from these canonical poses so the recognizer works immediately out-of-the-box for all 26 letters, while seamlessly merging any recorded Quest 3 takes from `/models/templates-right.json` or `/models/templates-left.json`.

---

## 6. Implementation Roadmap (Phases 1 & 2)

### Phase 1: Core Math Fixes, Canonical 26-Letter Poses & 3D Hand Rig
1. **Fix `src/hand-features.ts` & `src/finger-gate.ts`:**
   * Fix `F.spread` curled-finger `atan2` instability.
   * Add palm-facing coaching helper (`checkPalm`) and variant-tolerant finger patterns (`E`, `C`, `G`, `H`, `O`).
   * Add per-finger match scoring (`fingerMatchScores`) returning `[0..1]` match per finger (`thumb..pinky`) to drive per-finger green/amber coloring on the 3D Ghost Hand.
2. **Upgrade `src/recognizer.ts`:**
   * Add group-aware minimum `std` floors, absolute `maxDistance` gate, and `gradeAttempt()` returning `{ outcome: 'pass' | 'coach' | 'abstain' | 'self-check', ... }`.
3. **Create `src/hand-poses.ts`:**
   * Forward-kinematics 25-joint pose generator for all 26 ASL letters (`A–Z`), including animated trajectories for `J`, `Z`, and arbitrary fingerspelled words (with natural coarticulation and double-letter slight horizontal slide for `BOOK`, `ANNA`, `COFFEE`).
   * Provides both 3D joint matrices (for Ghost Hand & Tutor Hand) and a fallback 26-letter `TemplateModel` when recorded model files don't cover a letter yet.
4. **Create `src/hand-rig.ts`:**
   * Reusable, zero-allocation Three.js 3D hand visual (`HandRig`) built from `@iwsdk/core` primitives (25 joint spheres + 20 bone cylinders + wrist progress ring), supporting:
     * **1st-person Wrist-Anchored Ghost mode** (translucent, per-finger green/amber/teal coloring),
     * **Table-Anchored Reader's View Replay mode** (shows the user's recorded frames facing them across the table + wrist-bounce trajectory line),
     * **Table-Anchored Synthetic Tutor mode** (smoothly interpolates letter poses at selectable speed tiers).

### Phase 2: "First Five Minutes" Learner App, Pre-XR Setup & Modes
5. **Create `src/storage.ts`:**
   * `localStorage` persistence for learner profile: `userName` (default `MAYA`), `personalWords` (`['HANNAH', 'ADVIL', 'BOOK', 'COFFEE']`), `dominantHand` (`right` | `left`), `soundEnabled`, `streakDays`, `lastPracticeDate`, and per-letter `mastery` & `reliability` stats.
   * Supports shareable word-list URL params (`?name=MAYA&wordlist=HANNAH,ADVIL,BOOK`).
6. **Build Pre-XR 2D Setup Overlay (`index.html` + `src/setup-overlay.ts`):**
   * Fast, accessible 2D card shown before entering XR (and when returning from XR):
     * Edit **Your Name** and **Personal Word List** (or pick starter presets: *Caregiver & Meds*, *Family & Names*, *Double-Letter Practice*),
     * Choose **Right / Left Hand** and **Audio Chimes On/Off**,
     * View the **Scope & Honesty Notice** (*ASL fingerspelling practice only; not ASL, not a translator, not medical communication; built by a hearing developer; links to ASDC SignOn & Deaf-led instruction*),
     * View the **26-Letter Tracker Reliability & Mastery Grid**,
     * One-tap **Start 5-Minute Practice (Enter XR)** button (plus a link to `?recorder=1` for dev recording).
7. **Build In-XR Trainer (`src/trainer.ts` + `public/ui/trainer.uikitml`):**
   * **Guided 5-Minute Flow** (plus free mode switching at any time):
     1. **Step 1 — Ghost Warmup (`L → B → Y`):** Match the 1st-person wrist Ghost Hand; fingers light up green as they align; first green letter in `< 30 s`.
     2. **Step 2 — Spell Your Name & Personal Words:** Per-letter grading with plain-English finger hints, honest abstention + Ghost self-check on occluded letters (`M, N, T, S, E, R`), and live recording of the whole-word trajectory.
     3. **Step 3 — Reader's View Replay on Your Table:** Automatically replays your own hand spelling your name across the detected table (`XRPlane` or virtual desk fallback), reporting **Wrist Steadiness (Bounce Check)** and **Rhythm / Double-Letter Slide**.
     4. **Step 4 — Table Reading Mode (Receptive):** Synthetic Tutor Hand (clearly badged `"Synthetic Tutor Hand"`) spells words on your table at `Slow / Normal / Fast` tiers; learner selects from 3 word buttons or replays.
   * Keep `?recorder=1` activating `RecorderSystem` so Quest 3 dataset recording continues to work unchanged.
8. **Verify with Typecheck, Unit Tests & IWSDK Runtime Inspection.**
