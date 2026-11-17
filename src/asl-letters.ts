/**
 * ASL manual alphabet: the reference data the recorder shows and the
 * recognizer will key on.
 *
 * STATUS (2026-11-15): descriptions are our own wording. A research pass
 * checked every letter against several references (Helen Keller Services,
 * Wikipedia, Signing Savvy, Lifeprint) and corrected A, C, E, G, H, J, M, N, O,
 * R, T, X and Z (see docs/research/03-data-licensing-validation.md). They STILL
 * need sign-off by a paid fluent Deaf signer before learners see them. Do not
 * copy text or images from those sites (their terms forbid reuse).
 *
 * Descriptions are for a right-handed signer, as seen by the signer. A
 * left-handed signer mirrors everything.
 */

export type PalmFacing = 'forward' | 'side' | 'down' | 'in';

/**
 * Expected Quest hand-tracking difficulty, a hypothesis to measure:
 * - low: fingers clearly separated, little self-occlusion
 * - medium: fingers touch, or orientation is subtle
 * - high: thumb hidden behind or between fingers (self-occlusion)
 */
export type TrackingRisk = 'low' | 'medium' | 'high';

export interface AslLetter {
  letter: string;
  /** Short handshape description shown to the learner. */
  shape: string;
  palm: PalmFacing;
  /** True for letters that are defined by movement (J, Z). */
  motion: boolean;
  risk: TrackingRisk;
  /** Letters most often confused with this one. */
  confusable: string[];
  /**
   * Coarse finger pattern used as a capture gate and for "which finger is off"
   * hints: index, middle, ring, pinky as U = straight, C = curled,
   * H = half-bent, E = curled or hooked (open-E variant), . = any; then the
   * thumb as A = across the palm, O = out (away from the index knuckle),
   * S = alongside index, . = any.
   */
  fingers: string;
  /** Verification notes from source checks (empty until verified). */
  verified?: string;
}

export const ASL_LETTERS: AslLetter[] = [
  { letter: 'A', shape: 'Fist; thumb rests flat against the side of the index finger, tip about level with the top of the fist (not sticking up)', palm: 'forward', motion: false, risk: 'medium', fingers: 'CCCC.', confusable: ['S', 'E', 'T'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'B', shape: 'Four fingers straight up and together, thumb folded across the palm', palm: 'forward', motion: false, risk: 'low', fingers: 'UUUUA', confusable: ['4'] },
  { letter: 'C', shape: 'Fingers together and curved, thumb curved below them, like holding a cup: a C shape', palm: 'forward', motion: false, risk: 'low', fingers: 'HHHH.', confusable: ['O'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'D', shape: 'Index finger straight up; middle, ring and pinky curve down to touch the thumb tip', palm: 'forward', motion: false, risk: 'medium', fingers: 'UHHH.', confusable: ['F', 'O'] },
  { letter: 'E', shape: 'Fingers hooked down, tips resting on the thumb, which lies across the palm (an open-gap E is a common variant)', palm: 'forward', motion: false, risk: 'high', fingers: 'EEEEA', confusable: ['S', 'A', 'O'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'F', shape: 'Thumb and index tips touch in a circle; middle, ring and pinky straight up and spread', palm: 'forward', motion: false, risk: 'medium', fingers: '.UUU.', confusable: ['D', '9'] },
  { letter: 'G', shape: 'Index finger and thumb straight and parallel, pointing toward your other side; other fingers closed', palm: 'in', motion: false, risk: 'medium', fingers: 'UCCC.', confusable: ['H', 'Q'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'H', shape: 'Index and middle fingers straight together, pointing toward your other side; thumb holds ring and pinky', palm: 'in', motion: false, risk: 'medium', fingers: 'UUCC.', confusable: ['G', 'U', 'P'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'I', shape: 'Pinky straight up; other fingers in a fist with the thumb across them', palm: 'forward', motion: false, risk: 'low', fingers: 'CCCU.', confusable: ['J', 'Y'] },
  { letter: 'J', shape: 'Start from I (palm forward), then turn the forearm so the pinky draws a J: down, then hooking toward your middle as the palm turns toward you', palm: 'forward', motion: true, risk: 'medium', fingers: 'CCCU.', confusable: ['I'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'K', shape: 'Index straight up, middle finger angled forward, thumb tip touching the middle finger between them', palm: 'forward', motion: false, risk: 'high', fingers: 'U.CC.', confusable: ['V', 'P'] },
  { letter: 'L', shape: 'Index finger straight up and thumb straight out: an L; other fingers closed', palm: 'forward', motion: false, risk: 'low', fingers: 'UCCCO', confusable: ['G'] },
  { letter: 'M', shape: 'Thumb tucked under the index, middle and ring fingers; thumb tip peeks out between ring and pinky', palm: 'forward', motion: false, risk: 'high', fingers: 'CCCC.', confusable: ['N', 'T', 'S'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'N', shape: 'Thumb tucked under the index and middle fingers; thumb tip peeks out between middle and ring', palm: 'forward', motion: false, risk: 'high', fingers: 'CCCC.', confusable: ['M', 'T'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'O', shape: 'All fingertips curve to touch the thumb tip, forming a rounded O', palm: 'forward', motion: false, risk: 'medium', fingers: 'HHHH.', confusable: ['C', 'E'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'P', shape: 'K handshape turned to point down: index forward, middle finger down', palm: 'down', motion: false, risk: 'high', fingers: 'U.CC.', confusable: ['K', 'Q'] },
  { letter: 'Q', shape: 'G handshape turned to point down: index and thumb point down', palm: 'down', motion: false, risk: 'medium', fingers: 'UCCC.', confusable: ['G', 'P'] },
  { letter: 'R', shape: 'Index and middle fingers up and crossed, middle finger behind the index; thumb holds ring and pinky', palm: 'forward', motion: false, risk: 'high', fingers: 'UUCC.', confusable: ['U', 'V'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'S', shape: 'Fist with the thumb wrapped across the front of the fingers', palm: 'forward', motion: false, risk: 'high', fingers: 'CCCC.', confusable: ['A', 'E', 'T'] },
  { letter: 'T', shape: 'Fist with the thumb under the index finger, tip poking out between the index and middle fingers', palm: 'forward', motion: false, risk: 'high', fingers: 'CCCC.', confusable: ['S', 'A', 'N'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'U', shape: 'Index and middle fingers straight up and together; thumb holds the others down', palm: 'forward', motion: false, risk: 'low', fingers: 'UUCC.', confusable: ['V', 'R', 'H'] },
  { letter: 'V', shape: 'Index and middle fingers straight up and spread in a V; thumb holds the others down', palm: 'forward', motion: false, risk: 'low', fingers: 'UUCC.', confusable: ['U', 'K'] },
  { letter: 'W', shape: 'Index, middle and ring fingers straight up and spread; thumb holds the pinky down', palm: 'forward', motion: false, risk: 'low', fingers: 'UUUC.', confusable: ['6', 'F'] },
  { letter: 'X', shape: 'Index finger hooked: base joint straight, middle and end joints bent; other fingers closed', palm: 'forward', motion: false, risk: 'medium', fingers: 'HCCC.', confusable: ['D'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
  { letter: 'Y', shape: 'Thumb and pinky straight out; other three fingers folded', palm: 'forward', motion: false, risk: 'low', fingers: 'CCCUO', confusable: ['I'] },
  { letter: 'Z', shape: 'Index finger points forward and draws a Z as if on a wall in front of you: across, diagonal down, across', palm: 'forward', motion: true, risk: 'medium', fingers: 'UCCC.', confusable: ['D'], verified: 'checked 2026-11-15 vs Helen Keller Services, Wikipedia, Signing Savvy, Lifeprint (subagent); still needs Deaf signer review' },
];

export const LETTER_INDEX: Record<string, AslLetter> = Object.fromEntries(
  ASL_LETTERS.map((l) => [l.letter, l]),
);
