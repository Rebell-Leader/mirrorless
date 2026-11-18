# Mirrorless

<img src="public/mirrorless.svg" width="64" height="64" alt="" />

Practice ASL fingerspelling on Meta Quest. Spell a name, then replay your own hand from across the table.

[Open Mirrorless in Quest Browser](https://mirrorless-two.vercel.app)

## Practice

1. Sit facing a clear area. Enable hand tracking, open the link in Quest Browser, and select **Start practice**. Allow the browser’s immersive and hand-tracking prompts.
2. Match the guide hand on your wrist. A tracked match advances automatically. For a visual self-check, compare your hand with the guide and select **Compare and continue**. Select **Skip letter** to move on.
3. Spell the full word when you see **Recording**. Let the timer finish or select **Done**. Watch your attempt from the reader’s side, then try another word or switch to **Read a word**. If no suitable table is found, look for the virtual desk.

Use **Personalize** to set a practice name, add up to five comma-separated words, choose your signing hand, or change sound. Names and words use A–Z and are limited to 2–12 letters each. Open the in-headset **Menu** to switch modes, adjust the guide, recenter, or exit. Use **Play again** in reading mode to repeat the hand animation.

## Tracking and privacy

Mirrorless practices the ASL manual alphabet. It offers visual self-checks for A, E, J, M, N, R, S, T and Z, and when the tracker is uncertain. J and Z rely on movement. For a double letter, compare the transition in replay. Reading mode uses a simulated hand. The right-hand model was tested offline on recordings from a single signer. Left-hand grading uses synthetic templates.

Progress stays in browser storage. The latest learner replay stays in memory in the open tab. A copied practice link includes the name, words and hand preference you chose, so use sample names for links you plan to share. Keep practice separate from interpretation and medical communication.

For lessons with Deaf educators, see [ASDC SignOn](https://deafchildren.org/parents-and-families/asl-signon/) and [ASL University](https://www.lifeprint.com/).

## Development

Use the Node version in [`.nvmrc`](.nvmrc) and pnpm. The Immersive Web SDK uses [IWER, its browser-based emulator](https://iwsdk.dev/guides/02-testing-experience.html), for local immersive testing.

```sh
pnpm install
pnpm dev
```

For a headset test, run `pnpm dev:status` and open a reported LAN HTTPS URL in Quest Browser on the same network. The local development certificate prompts for acceptance. Run `pnpm typecheck`, `pnpm test` and `pnpm build` to check a change.

- [Recorder workflow](docs/RECORDING.md) covers `?recorder=1`, take export, and model evaluation.
- `?probe=1` shows hand-tracking and room detection diagnostics.
- [Review checklist](docs/REVIEW_TASKS.md) covers headset checks. [Research notes](docs/SYNTHESIS.md) explain the training and feedback choices.
