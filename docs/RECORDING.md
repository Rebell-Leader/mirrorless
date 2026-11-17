# Recording your hands: a guide for the Quest 3 session

The recorder captures **hand-joint poses only** (25 joints per hand, plus the head pose). There is no camera and no video. Takes are saved on the laptop in `data/recordings/<session>/` (git-ignored), one JSON file per take. Delete them any time.

## 1. Before you put the headset on (2 min)

1. Make sure the dev server is running on the laptop. If it isn't, start it:
   ```bash
   cd /home/obi/meta-vr-hackathon && pnpm dev
   ```
2. Get the URL for the Quest:
   ```bash
   cd /home/obi/meta-vr-hackathon && ./node_modules/.bin/iwsdk dev status | grep -A3 network
   ```
   Last time it was `https://192.168.2.184:8081/`. The Quest must be on the same Wi-Fi.
3. **Don't edit project files while recording.** Any code change hot-reloads the page and ends the XR session.
4. Sit in good, even light. Take off rings and bracelets if you can, and wipe the headset's tracking cameras.

## 2. Start

1. In the Quest Browser, open the URL and accept the certificate warning ("Advanced" → proceed). The certificate is the local dev one.
2. Press **Enter XR** on the panel, then allow hand tracking and spatial data if asked.
3. The recorder panel appears about 1 m in front of you, slightly below eye level. If it's in an awkward place, press **Recenter**.
4. Check the bottom line of the panel. It should say **"Connected to laptop"**. If it says "NOT connected", see Troubleshooting.

## 3. How a take works

1. Read the big letter and its description. If unsure, check a public-domain chart on your phone or laptop: https://commons.wikimedia.org/wiki/Category:ASL_letters
2. Form the letter with your **right hand** about 30–40 cm in front of your chest, palm as described ("palm forward" means facing away from you).
3. **Hold still.** The bar fills in about 1 s. When it's done you hear a chime and see a green "Saved" chip.
4. **Relax your hand** (open it, or drop it out of view), then form the letter again for the next take. The recorder won't take two captures without a relax in between.
5. If you see a **red chip**, the coarse finger check disagrees, for example "index looks straight, should be curled". Fix your hand, or if you're sure it's right, **keep holding for 3 s** to record anyway. The take is then flagged as an override in the data, which is useful for spotting letters where the check is wrong.
6. **J and Z** are movement letters. Hold the start shape still for half a second. After the beep you have 1.6 s to draw the letter.
7. **Words** (if enabled): hold the first letter still, then spell the whole word smoothly within the time shown.

Press buttons with your **other hand**, either by touching them with your index fingertip or by pointing and pinching:

| Button | What it does |
|---|---|
| Redo last | Deletes the last saved take from the laptop and records it again |
| Skip letter | Moves on; use it for letters you can't form |
| Pause | Pauses and resumes |
| Hand: right/left | Switches the recording hand and restarts the takes for the current letter |
| Recenter | Moves the panel back in front of you |

The panel's small line also shows **steadiness** (it needs to be under 0.012). If the bar never fills even though you're holding still, add `&stable=0.02` to the URL.

## 4. What to record (about 45 min in total, split across sessions)

The evaluation needs **at least two separate sessions** to give an honest number. With one session it falls back to an optimistic within-session estimate.

| Session | URL | Takes | Time | Why |
|---|---|---|---|---|
| 1. Letters, now | `https://<ip>:8081/` | A–Z × 3 = 78 | ~15 min | Templates |
| 2. Letters again, later (take the headset off in between and sit a bit differently) | same URL | A–Z × 3 | ~15 min | Held-out test session |
| 3. Words | `https://<ip>:8081/?words=HELLO,BOOK,ANNA,COFFEE,PIZZA,MAYA` plus your own name | 6–7 words × 3 | ~8 min | Transitions, double letters (BOOK, ANNA, COFFEE, PIZZA), rhythm, and a future tutor-hand prototype |
| 4. Optional: left hand | `...?hand=left&letters=LBYAVWIK` | 8 × 3 | ~5 min | Shows left-hand support works |
| 5. Optional: second person | same as session 1 | A–Z × 3 | ~15 min | The judge review's top technical risk: templates from one person's hand. Get the person's explicit consent first |

**Other URL options:**
- `?letters=LBY` records only those letters.
- `?takes=5` changes the number of takes per letter.
- `?probe=1` keeps the dev probe panel (live finger curls) visible in XR.

## 5. After a session

```bash
cd /home/obi/meta-vr-hackathon && pnpm eval:recordings
```

It prints:
- top-1 accuracy on held-out takes;
- an **abstention curve**: accuracy when grading only above a confidence margin, against the share of attempts graded;
- per-letter accuracy;
- the top confusions, for example M→N.

It writes `data/models/templates-right.json`, which the in-headset grader will load next. Letters that stay unreliable become **self-check letters** in the app, rather than being faked or dropped.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "NOT connected to the dev server" | You opened a different URL, or the server stopped. Run `pnpm dev`, reload the page, and re-enter XR |
| Red "Not saved: …" chip | The laptop rejected the take. Read the message. Redo works once the connection is back |
| The bar never fills | Your hand is moving or tracking is jittery. Brace your elbow on the armrest or add `&stable=0.02` |
| "Show your right hand" | Hand tracking lost. Check the lighting, keep the hand in front of you and away from your face |
| A wrong take was saved | Press **Redo last** straight away. It deletes the file on the laptop |
| The XR session ended by itself | A file in the project changed (hot reload). Re-enter XR. The session ID changes, which is fine |

## Notes on accuracy

- The letter descriptions were checked against several references, and A, C, E, G, H, J, M, N, O, R, T, X and Z were corrected (see `docs/research/03-data-licensing-validation.md`).
- They still need sign-off by a **fluent Deaf signer**. Until then, treat your recordings as development data, not ground truth.
- Your own non-native fingerspelling must never become the app's tutor hand for learners.
