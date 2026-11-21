// Labels for the recorded references from Main.lean to core_gm. Each key
// resolves to its own source span in the pinned declaration index.
export const landmarks = {
  riemannHypothesis: {
    label: "Riemann hypothesis",
    note: "Every nontrivial zero of the zeta function has real part ½.",
  },
  rhOfAll: {
    label: "Specialize to zeta",
    note: "At modulus 1 the L-function is zeta. Nonvanishing to the right of ½ and reflection give RH.",
  },
  allChi: {
    label: "The half-plane theorem",
    note: "This is the name the final proofs use for the same nonvanishing result for all Dirichlet characters.",
  },
  "UpperTheory.FinalTheorems.everyCharacter": {
    label: "Supply the Galois input",
    note: "A theorem built from theta lifts supplies the Galois representation data for the all-character result.",
  },
  "UpperTheory.FinalTheorems.everyCharacter_of_row": {
    label: "Build the window input",
    note: "The same Galois data supply the arithmetic windows and part of the local correspondence data.",
  },
  "UpperTheory.LiteratureTheorems.every_character_of_literature_of_vWin": {
    label: "Assemble the theta inputs",
    note: "Results on theta integrals, local matching and covolumes supply the next theorem’s hypotheses.",
  },
  "UpperTheory.Lit.every_character_of_theta_integrals_local_matching": {
    label: "Match local theta data",
    note: "Agreement of theta integrals and their local models helps establish the conditions on the definite side of the lift.",
  },
  "UpperTheory.Top.every_character_of_green_v_win": {
    label: "Extend to all characters",
    note: "Each Dirichlet character comes from a primitive one. The extra Euler factors preserve nonvanishing in this half-plane.",
  },
  "UpperTheory.Top.zero_free_all_of_green_v_win": {
    label: "Supply primitive windows",
    note: "Each primitive character gets the window data it needs. The proof applies the family theorem at scale 3/2.",
  },
  "UpperTheory.Top.zeroFreeAll_of_topG": {
    label: "Exclude right-hand zeros",
    note: "A bound on prime sums over suitable windows meets the Landau criterion for excluding zeros right of ½.",
  },
  "UpperTheory.Comparison₂.level_gm_le_on_family_scales": {
    label: "Bound sums on family windows",
    note: "The bounds for a family of linked chains put its prime sums within the required estimate on each window.",
  },
  "UpperTheory.Comparison₂.windowInequality_of_artinInputs": {
    label: "From points to windows",
    note: "Above a common threshold, the proof applies a pointwise bound at each eligible point in the window.",
  },
  "UpperTheory.Comparison₂.core_gm": {
    label: "Prime-sum error bound",
    note: "For sufficiently large x, the weighted prime-sum error is at most x raised to ½ + (eD + eL + 7)ε.",
  },
  riemannZeta_eq_zero_re: {
    label: "Zeta zeros on the critical line",
    note: "The nontrivial-zero statement is written out explicitly and uses the same proof as the Mathlib statement of RH.",
  },
  LFunction_ne_zero_of_half_lt_re: {
    label: "Zero-free half-plane",
    note: "For every Dirichlet character, its L-function is nonzero right of ½, apart from the trivial character’s pole at 1.",
  },
  LFunction_eq_zero_re: {
    label: "Dirichlet zeros on the line",
    note: "For every Dirichlet character, zeros strictly inside the critical strip have real part ½.",
  },
  LFunction_eq_zero_re_of_isPrimitive: {
    label: "Primitive Dirichlet zeros",
    note: "For a primitive character, every zero strictly inside the critical strip has real part ½.",
  },
  claimAll: {
    label: "Three conclusions from one bound",
    note: "This theorem collects the zero-free half-plane, the critical-strip conclusion for all characters, and RH.",
  },
  critAll: {
    label: "Reflect a primitive zero",
    note: "The functional equation sends a zero left of ½ to the inverse character on the right, where zeros have been excluded.",
  },
};
