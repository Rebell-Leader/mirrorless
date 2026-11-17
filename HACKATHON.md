# Meta VR Start Developer Competition 2026: rules digest

Source: https://start-developer-competition-26.devpost.com/ and /rules (read 2026-11-15).

## Dates
- **Submission deadline: Wed 2026-11-18 12:00 PT = 21:00 CET (Munich).** The entry is frozen at the deadline.
- Judging runs from about Nov 18 to Dec 9. Winners are announced around Dec 11.
- The New Experience division counts only work started on or after 2026-09-24.

## Eligibility (blockers)
- **You must be a member of the Meta VR Start program by the time you submit.** Apply via the Devpost page (about 5 min). Approval time is not stated.
- You need a Meta account with Developer Access, and you must be 18 or older.
- Residents of Russia, Crimea, Brazil, Quebec, Cuba, Iran, North Korea and Syria are not eligible. Eligibility depends on where you live, not your citizenship.
- One entry per person. You cannot both enter solo and be a team's Representative.
- The project must not have received direct funding from Meta.

## Hard requirements
- **Hands-first:** the whole experience must be completable without ever pairing a controller.
- It must comply with Meta VR policies, be in English (or English-subtitled), and avoid brands, logos and identifiable people other than the entrants.
- It must be free and stay accessible until the winners are announced.

## Design guidelines (judges score against these)
- **Seated:** every interaction should work within a 2 ft radius (the "airplane seat test").
- **Quick to start:** fast cold start, clean pause and resume, and a satisfying moment in 10 minutes or less (the "bus stop test").
- **Not a wrapper:** if you remove the third-party service, a project should still be left. ChatGPT or YouTube wrappers are explicitly discouraged.

## Tracks and divisions
| Track | New: winner / runner-up | Adapted: winner / runner-up |
|---|---|---|
| Gaming | $100k / $50k | $100k / $50k |
| Entertainment | $100k / $50k | $100k / $50k |
| Productivity (habits, daily moments, creative tools, workspaces) | $70k / $35k | $70k / $35k |

Special awards are $25k each:
- Social & Multiplayer
- Agentic Interaction (AI is core)
- Reason to Come Back
- First Five Minutes
- Accessibility Forward
- Boldest Original Concept (fails on any other platform)

Judge's Choice is 2 × $20k. **An entry can win at most one prize.**

## Judging
- **Stage 1:** pass/fail. The entry must fit the theme and use the required tools.
- **Stage 2:** four criteria, each weighted 25%:
  1. **Innovation & Creativity:** originality and track relevance; uses Meta device strengths (spatial depth, hands, gaze, passthrough, scene understanding, anchors) to drive repeat use.
  2. **Experience Design:** seated and hands-first, intuitive onboarding, a habit-forming purpose. **Passthrough must be purposeful**: the real room has to change the experience. **FoV-aware**: keep essential UI inside a narrow FoV.
  3. **Technical Implementation:** hand tracking, gaze, passthrough, anchors, scene understanding (planes and room geometry), and it must hold up in untested rooms. **At least 60 fps on Quest**, bug-free.
  4. **Polish & Presentation:** UI/UX, art, sound, and submission materials. The video should show real footage, lead with the story, and **not rely on AI-generated video**.
- AI tools may assist the judges, but humans make the final decision.

## What to submit
1. **The build.** IWSDK (WebXR): a hosted link on GitHub Pages, Vercel, or similar. Unity/Unreal/Android: an APK in a release channel named "Competition", plus an invite URL.
2. **A video under 3 min**, public on YouTube or Vimeo, filmed on a Quest or in the XR Simulator.
3. **The form:**
   - name
   - tagline (140 chars)
   - track and division
   - description of about 500 words (inspiration, how it was built, future plans)
   - how hand interactions are implemented
   - target launch date
   - team members
