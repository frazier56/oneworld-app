/**
 * THE ONESCORE CALCULATOR — written FRESH from the settled design (Thread B, 8 Aug 2026).
 * ============================================================================================
 * FINDING, stated per the kickoff's rule zero: `oneScoreCalculator.v11.1.ts` does not exist in
 * any workspace — this file is the algorithm, written new from the settled design in
 * `02_KICKOFF_ONESCORE.md`. The old standalone app's `oneScorePublic.ts` (v2.1, bucket-based,
 * device-local) is retired with the app that carried it; nothing here derives from it.
 *
 * What this file is NOT: the published headline number. That is `profiles.score_v9_snapshot`,
 * the ONE number every sibling reads, and the screens display it directly. This engine exists
 * for the two surfaces that reason about CHANGE — the ranked "how do I raise this?" list on
 * /onescore/score and the what-if Simulator — and for the day the platform recomputes
 * snapshots server-side from the same rules.
 *
 * The settled design it implements, all of it Lee's rulings:
 *   · Verification is the biggest lever — proof strength multiplies the class value, and no
 *     identity verification at all costs ×0.90 on the WHOLE score.
 *   · Seven platform classes at fixed full-strength values. `paid_work` is money RECEIVED —
 *     never rename it "commerce" (Lee read that as money spent, the opposite signal).
 *   · Multiple ways to a high score ("multiple ways to skin a cat") — the three reference
 *     personas land within ~5 points of each other. They are fixtures; spreading them is a
 *     regression.
 *   · Endorsements scale with the endorser's own score SQUARED ("Obama vs my sister"); you
 *     cannot out-rank your own verification; Authority additionally requires an Authority's
 *     endorsement (enforced in `compute_badge_tier`, which carries NO score thresholds).
 *   · Contracts are weighted by counterparty at FIXED levels 100/62/34/14 (Nike vs neighbour) —
 *     the best relationship sets the level; no log saturation across tiers.
 *   · One class vocabulary. An unknown class THROWS — a silent blank score already shipped once.
 */

/* ── The one vocabulary ──────────────────────────────────────────────────────────────────── */
export const ASSET_CLASSES = [
  "identity", "license", "reviews", "paid_work", "certification", "audience", "presence",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Full-strength value of one verified asset of each class. */
export const CLASS_VALUE: Record<AssetClass, number> = {
  identity: 45,
  license: 38,
  reviews: 22,
  paid_work: 20,   // money RECEIVED, not spent. Never "commerce".
  certification: 16,
  audience: 8,
  presence: 3,
};

export const PROOF_LEVELS = [
  "self_asserted", "handle_match", "code_challenge", "oauth", "attested",
] as const;
export type ProofLevel = (typeof PROOF_LEVELS)[number];

/** Verification strength — the biggest single lever in the system. */
export const PROOF_STRENGTH: Record<ProofLevel, number> = {
  self_asserted: 0.15,
  handle_match: 0.30,
  code_challenge: 0.60,
  oauth: 0.90,
  attested: 1.00,
};

/** No identity verification at all → the whole score is multiplied by this. */
export const NO_IDENTITY_MULTIPLIER = 0.90;

/** Counterparty tiers — fixed levels, best relationship sets the level. Nike ≠ neighbour. */
export const CONTRACT_LEVELS = { major: 100, national: 62, regional: 34, local: 14 } as const;
export type ContractTier = keyof typeof CONTRACT_LEVELS;

/* ── Inputs ──────────────────────────────────────────────────────────────────────────────── */
export interface AssetInput { class: AssetClass; proof: ProofLevel; }
export interface ContractInput { tier: ContractTier; }
export interface EndorsementInput {
  /** The endorser's OWN published score at endorsement time (0–100). Squared in the math. */
  endorserScore: number;
  retracted?: boolean; // only a VIP's retraction produces this — permanence is upstream policy
}
export interface ScoreInput {
  assets: AssetInput[];
  contracts?: ContractInput[];
  endorsements?: EndorsementInput[];
}

/* ── Tuning ──────────────────────────────────────────────────────────────────────────────────
 * K shapes the diminishing-returns curve from raw class points to the 0–100 scale; the bonus
 * units size contracts and endorsements against it. These four numbers are what the three-
 * persona fixture suite pins down: change any of them and the personas move. */
const CURVE_K = 40;
/** Verified assets alone top out at 88 — the last stretch to 100 only comes from other PEOPLE
 *  trusting you (endorsements, real contracts). That is deliberate: a perfect score requires
 *  a human counterparty, not just connected accounts. */
const BASE_MAX = 88;
const CONTRACT_UNIT = 9;      // a `major` contract adds 9.0; local adds 1.26 (× level/100)
const ENDORSE_UNIT = 6;       // one 100-score endorser adds 6.0; a 50-score endorser adds 1.5
const ENDORSE_CAP = 12;
/** Same class again counts at half the previous asset's rate; the class value is a hard cap. */
const REPEAT_DECAY = 0.5;

function assertClass(c: string): asserts c is AssetClass {
  if (!(ASSET_CLASSES as readonly string[]).includes(c)) {
    /* Never a silent blank score — code, docs and database disagreed once and the symptom was
       exactly that. Throw loudly with the vocabulary in the message. */
    throw new Error(
      `[oneScore] unknown asset class "${c}" — the vocabulary is ${ASSET_CLASSES.join("/")}`,
    );
  }
}

/** Points one class contributes: strongest asset full, repeats at decaying rate, capped. */
export function classContribution(cls: AssetClass, assets: AssetInput[]): number {
  const strengths = assets
    .filter(a => a.class === cls)
    .map(a => {
      const s = PROOF_STRENGTH[a.proof];
      if (s === undefined) throw new Error(`[oneScore] unknown proof level "${a.proof}"`);
      return s;
    })
    .sort((a, b) => b - a);
  let pts = 0;
  strengths.forEach((s, i) => { pts += CLASS_VALUE[cls] * s * Math.pow(REPEAT_DECAY, i); });
  return Math.min(pts, CLASS_VALUE[cls]);
}

export interface ScoreBreakdown {
  score: number;
  base: number;
  raw: number;
  perClass: Record<AssetClass, number>;
  contractBonus: number;
  endorsementBonus: number;
  identityVerified: boolean;
}

export function computeOneScore(input: ScoreInput): ScoreBreakdown {
  for (const a of input.assets) assertClass(a.class);

  const perClass = {} as Record<AssetClass, number>;
  let raw = 0;
  for (const cls of ASSET_CLASSES) {
    const c = classContribution(cls, input.assets);
    perClass[cls] = c;
    raw += c;
  }

  /* Diminishing returns to 100: every extra point helps, no path is mandatory, and the three
     personas — deep-but-narrow or broad-but-shallow — converge instead of spreading. */
  const base = BASE_MAX * (1 - Math.exp(-raw / CURVE_K));

  /* Contracts: the BEST counterparty sets the level. Fixed levels, deliberately un-saturated —
     log compression once put Nike under 2× the neighbour and Lee rejected it. */
  const best = (input.contracts ?? []).reduce(
    (m, c) => Math.max(m, CONTRACT_LEVELS[c.tier] ?? (() => {
      throw new Error(`[oneScore] unknown contract tier "${c.tier}"`);
    })()),
    0,
  );
  const contractBonus = (best / 100) * CONTRACT_UNIT;

  /* Endorsements: power scales with the endorser's own score, squared. Permanent unless a VIP
     retracts (the `retracted` flag only ever arrives from that path). */
  const endorsementBonus = Math.min(
    ENDORSE_CAP,
    (input.endorsements ?? [])
      .filter(e => !e.retracted)
      .reduce((sum, e) => sum + Math.pow(Math.max(0, Math.min(100, e.endorserScore)) / 100, 2) * ENDORSE_UNIT, 0),
  );

  const identityVerified = input.assets.some(
    a => a.class === "identity" && PROOF_STRENGTH[a.proof] >= PROOF_STRENGTH.code_challenge,
  );

  let score = Math.min(100, base + contractBonus + endorsementBonus);
  if (!identityVerified) score *= NO_IDENTITY_MULTIPLIER;

  return {
    score: Math.round(score * 10) / 10,
    base, raw, perClass, contractBonus, endorsementBonus, identityVerified,
  };
}

/** Points gained if `add` were done now — the Simulator and the ranked-actions list both use
 *  this, so "what it's worth" is always the same number in both places. */
export function scoreDelta(current: ScoreInput, add: Partial<ScoreInput>): number {
  const now = computeOneScore(current).score;
  const then = computeOneScore({
    assets: [...current.assets, ...(add.assets ?? [])],
    contracts: [...(current.contracts ?? []), ...(add.contracts ?? [])],
    endorsements: [...(current.endorsements ?? []), ...(add.endorsements ?? [])],
  }).score;
  return Math.round((then - now) * 10) / 10;
}

/* ── "How do I raise this?" — the ranked action list ─────────────────────────────────────────
 * The /onescore/score screen's whole job. Concrete actions with the points each is worth,
 * computed against the person's ACTUAL current state, sorted by value. Verification actions
 * rank first on their own weight (identity 45 + the ×0.90 release), not by decoration. */
export interface RankedAction {
  key: string;
  points: number;
  class: AssetClass;
  proof: ProofLevel;
}

const CANDIDATE_ACTIONS: { key: string; add: AssetInput }[] = [
  { key: "verify_identity", add: { class: "identity", proof: "oauth" } },
  { key: "add_license", add: { class: "license", proof: "attested" } },
  { key: "connect_reviews", add: { class: "reviews", proof: "oauth" } },
  { key: "connect_paid_work", add: { class: "paid_work", proof: "oauth" } },
  { key: "add_certification", add: { class: "certification", proof: "code_challenge" } },
  { key: "connect_audience", add: { class: "audience", proof: "oauth" } },
  { key: "add_presence", add: { class: "presence", proof: "handle_match" } },
];

export function rankedActions(current: ScoreInput): RankedAction[] {
  return CANDIDATE_ACTIONS
    /* Don't re-suggest a class the person already holds at this strength or better — a repeat
       still adds decayed points, but "verify your identity" on an oauth-verified profile is
       noise, and noise is what gets real actions ignored. */
    .filter(c => !current.assets.some(
      a => a.class === c.add.class && PROOF_STRENGTH[a.proof] >= PROOF_STRENGTH[c.add.proof],
    ))
    .map(c => ({
      key: c.key,
      points: scoreDelta(current, { assets: [c.add] }),
      class: c.add.class,
      proof: c.add.proof,
    }))
    .filter(a => a.points > 0)
    .sort((a, b) => b.points - a.points);
}
