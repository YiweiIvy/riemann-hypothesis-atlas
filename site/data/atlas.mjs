// Each prerequisite comes from the cited proof or its construction. A displayed
// edge may compress several Lean declarations. The teaching graph is selective.
export const SOURCE_COMMIT = "2f097b744a6460c73f3e4cc550baa83698409876";
const tree =
  "https://github.com/leanprover-community/riemann-hypothesis/blob/" +
  SOURCE_COMMIT +
  "/src/";
const arithmetic = "Development/AutomorphicArithmetic/";
const boxes = arithmetic + "CharacterBoxes/";
const cosets = arithmetic + "PrimitiveCosets/";
const third =
  arithmetic + "ThetaCorrespondence/ThetaPairLifts/ThirdPlaceSeries/";
const rep = arithmetic + "Foundations/GaloisRepresentations/";
const windows =
  "Formalism/SharpRestriction/RamificationFrobenius/TotientGaloisClasses/";
const crit = "Formalism/GammaFactorNonvanishing/CritLine";
const wrapper = "Supplements/Kernels/MainTheorems";
const mit = {
  label: "Sutherland · axiom audit",
  url: "https://math.mit.edu/~drew/grh/",
};
const clay = {
  label: "Clay · problem statement",
  url: "https://www.claymath.org/millennium/riemann-hypothesis/",
};
const lean = (label, file, line) => ({
  label,
  url: tree + file + ".lean#L" + line,
});
const note = (page, label) => ({
  label,
  url: "https://alpo.ge/remark.pdf#page=" + page,
});

export const SECTIONS = [
  { id: "result", title: "The claims", english: "The claims" },
  { id: "analysis", title: "Analytic reduction", english: "Analytic reduction" },
  { id: "arithmetic", title: "Arithmetic inputs", english: "Arithmetic inputs" },
];

export const NODES = [
  {
    id: "rh",
    title: "Riemann hypothesis",
    english: "The Riemann hypothesis",
    section: "result",
    leanId: "riemannHypothesis",
    leanIds: [
      "riemannHypothesis",
      "riemannZeta_eq_zero_re",
      "rhOfAll",
      "Formalism.VW.rh_of_every",
    ],
    plain:
      "Every nontrivial zero of the zeta function has real part ½.",
    detail:
      "At modulus 1 the half-plane result applies to ζ. Its functional equation reflects any zero left of the line to the right. Both RH targets call rhOfAll.",
    question:
      "Check the domain, the pole at 1, and the two calls to rhOfAll.",
    sources: [
      lean("Main · RH targets", "Main", 4),
      lean("Modulus-one character", crit, 29),
      lean(
        "Reflection for ζ",
        "Formalism/GammaFactorNonvanishing/RhOfRight",
        5,
      ),
      clay,
    ],
    dependsOn: ["every"],
  },
  {
    id: "strip",
    title: "Zeros in the critical strip",
    english: "The critical strip",
    section: "result",
    leanId: "LFunction_eq_zero_re",
    leanIds: ["LFunction_eq_zero_re", "claimAll", "Claim.strip"],
    plain:
      "Every zero of a Dirichlet L-function inside the critical strip lies on its midline.",
    detail:
      "Claim.strip passes to the inducing primitive character, then reflects a left-hand zero to 1−s for the inverse character.",
    question:
      "Check that removing Euler factors preserves zeros inside the open strip.",
    sources: [
      lean("Main · all characters", "Main", 10),
      lean("Claim.strip · reflection", boxes + "ClaimStrip", 59),
      lean("prim_zero · change of modulus", boxes + "ClaimStrip", 23),
    ],
    dependsOn: ["every"],
  },
  {
    id: "primitive",
    title: "Primitive characters",
    english: "Primitive characters",
    section: "result",
    leanId: "LFunction_eq_zero_re_of_isPrimitive",
    leanIds: [
      "LFunction_eq_zero_re_of_isPrimitive",
      "critAll",
      "Formalism.VW.critLine",
    ],
    plain:
      "Primitive characters encode weights that cannot come from a smaller modulus. Their zeros have a separate target.",
    detail:
      "The completed L-function reflects s to 1−s for the inverse character. Main uses critAll, critLine and allChi on this path.",
    question:
      "Locate the primitive-character and open-strip hypotheses in critLine.",
    sources: [
      lean("Main · primitive characters", "Main", 12),
      lean("critAll · half-plane input", wrapper, 11),
      lean("critLine · reflection", crit, 11),
    ],
    dependsOn: ["every"],
  },
  {
    id: "every",
    title: "Zero-free half-plane",
    english: "A zero-free half-plane",
    section: "result",
    leanId: "UpperTheory.FinalTheorems.everyCharacter",
    leanIds: [
      "UpperTheory.FinalTheorems.everyCharacter",
      "LFunction_ne_zero_of_half_lt_re",
      "allChi",
      "UpperTheory.Top.imprimitive",
    ],
    plain:
      "For every Dirichlet character, the region to the right of ½ is zero-free, with the pole excluded.",
    detail:
      "The primitive and induced L-functions differ by finitely many Euler factors. These factors are nonzero in this half-plane.",
    question:
      "Check the quantifiers and the exception for the trivial character at s = 1.",
    sources: [
      lean("Main · half-plane target", "Main", 8),
      lean("EveryCharacter · quantifiers", boxes + "EveryCharacter", 13),
      lean("TopPlug · induced characters", third + "TopPlug", 16),
      lean("MainConclusion · inputs", boxes + "MainConclusion", 7),
      mit,
    ],
    dependsOn: ["zero"],
  },
  {
    id: "zero",
    title: "Excluding a zero",
    english: "Excluding a zero",
    section: "analysis",
    leanId: "UpperTheory.Top.zeroFreeAll_of_topG",
    leanIds: [
      "UpperTheory.Top.zeroFreeAll_of_topG",
      "Formalism.HC.level_of_tiedWin",
      "UpperTheory.Top.zero_free_all_of_green_v_win",
    ],
    plain:
      "A proposed zero to the right of ½ leaves room for a sharper estimate between it and the line.",
    detail:
      "For any σ > ½, choose ½ < θ < σ. The construction supplies distant intervals on which Gm(x) ≤ x^θ. The local Landau criterion excludes the zero.",
    question:
      "Trace the order of choices as σ approaches ½.",
    sources: [
      lean("zeroFreeAll_of_topG · inputs", boxes + "ZeroFreeAllOfTopG", 26),
      lean("level_of_tiedWin · choice of ε", windows + "TopWin", 68),
      lean("TopPlug · window data", third + "TopPlug", 12),
    ],
    dependsOn: ["windows", "gm", "landau"],
  },
  {
    id: "landau",
    title: "Landau criterion",
    english: "The Landau criterion",
    section: "analysis",
    leanId: "UpperTheory.Comparison₂.formB",
    leanIds: [
      "UpperTheory.Comparison₂.formB",
      "Formalism.HC.Level.FormBAt",
      "Deduction.landau_window",
    ],
    plain:
      "A zero too far to the right would force a prime sum to exceed its bound on every sufficiently distant window.",
    detail:
      "FormBAt uses arbitrarily large Y with the bound holding throughout [Y, Yᵃ] for a fixed a > 1. It excludes zeros with real part above θ.",
    question:
      "Check the interval quantifiers in HasWindows.",
    sources: [
      lean("FormBAt · window definition", windows + "Window", 30),
      lean("formB · local reduction", cosets + "Imports", 8),
      lean(
        "landau_window · criterion",
        arithmetic + "DedekindLFunctions/LandauTheorems/landauWindow",
        83,
      ),
    ],
    dependsOn: [],
  },
  {
    id: "gm",
    title: "Prime-sum bound",
    english: "A square-root bound",
    section: "analysis",
    leanId: "UpperTheory.Comparison₂.core_gm",
    leanIds: [
      "UpperTheory.Comparison₂.core_gm",
      "UpperTheory.Comparison₂.level_gm_le_on_family_scales",
      "UpperTheory.Comparison₂.windowInequality_of_artinInputs",
    ],
    plain:
      "Subtract the main term from a weighted sum of prime powers. The proof bounds what remains near square-root scale.",
    detail:
      "Given EAtH and CoreAtH, core_gm bounds Gm(x) by x^(½ + (eD + eL + 7)ε). The window inequality applies the pointwise estimate over an interval.",
    question:
      "Check the exponent losses and the direction of the bound.",
    sources: [
      lean("core_gm · exponent", cosets + "CoreGm", 12),
      lean(
        "Gm · weighted sum",
        windows + "ExplicitFormulaErrorOfHostConditions",
        38,
      ),
      lean(
        "Window inequality",
        cosets + "WindowInequalityOfArtinInputs",
        17,
      ),
    ],
    dependsOn: ["chain"],
  },
  {
    id: "windows",
    title: "Arithmetic windows",
    english: "Constructing windows",
    section: "arithmetic",
    leanId: "UpperTheory.Top.winPairs",
    leanIds: [
      "UpperTheory.Top.winPairs",
      "UpperTheory.Top.supplyChi",
      "UpperTheory.T3.supplyOfAdmOf",
    ],
    plain:
      "The proof needs whole intervals, arbitrarily far out, where the arithmetic estimates hold together.",
    detail:
      "winPairs combines PairEx and VWinAt ψ 401. For small ε it supplies WinDatum throughout [Z, Z^(3/2)] for arbitrarily large Z.",
    question:
      "Locate both inputs and the quantifier over x in the interval.",
    sources: [
      lean("winPairs · inputs", boxes + "WinPairs", 5),
      lean(
        "supplyOfAdmOf · prime pairs",
        arithmetic + "ShortNorms/supplyOfAdmOf",
        29,
      ),
      lean("supplyChi · window data", boxes + "SupplyChi", 8),
    ],
    dependsOn: ["pairs", "vwin"],
  },
  {
    id: "pairs",
    title: "Auxiliary prime pairs",
    english: "Auxiliary prime pairs",
    section: "arithmetic",
    leanId: "QH.pairEx",
    leanIds: [
      "QH.pairEx",
      "UpperTheory.Top.PairEx",
      "UpperTheory.Top.PairGood",
    ],
    plain:
      "Two primes q and d control the twists used in the window construction.",
    detail:
      "PairGood requires q ≡ 3 (mod 8), d ≡ 7 (mod 16), coprimality, prime-sum bounds and zero-free rectangles for the specified twists.",
    question:
      "Trace the existence witnesses q and d from pairEx to PairGood.",
    sources: [
      lean("pairEx · existence", arithmetic + "MeanSquareBounds/pairEx", 112),
      lean("PairGood · bounds and rectangles", boxes + "PairGood", 18),
      lean("WinPair · congruences", boxes + "ExistsPageN", 27),
    ],
    dependsOn: [],
  },
  {
    id: "vwin",
    title: "Cohomological bound",
    english: "A cohomological bound",
    section: "arithmetic",
    leanId: "UpperTheory.One.vwin_of_row",
    leanIds: [
      "UpperTheory.One.vwin_of_row",
      "UpperTheory.Top.VWin",
      "UpperTheory.Top.VWinAt",
    ],
    plain:
      "Local arithmetic data can agree in each place and still fail to fit together. The proof bounds these obstructions.",
    detail:
      "VVle weights the group lengths shaLen by log ℓ and sums over primes and twists. vwin_of_row uses Row0b to obtain VWin.",
    question:
      "Check the weighted bound and how Row0b enters vwin_of_row.",
    sources: [
      lean(
        "vwin_of_row · Row0b input",
        arithmetic +
          "AutomorphicVarieties/ModularityArgument/ThresholdArguments/DenseThresholdCases/VwinOfRow",
        4,
      ),
      lean("VVle · weighted lengths", boxes + "ExistsPageN", 12),
      lean("VWinAt · interval", boxes + "ExistsPageN", 44),
    ],
    dependsOn: ["galois"],
  },
  {
    id: "chain",
    title: "Length and error terms",
    english: "Length and error terms",
    section: "arithmetic",
    leanId: "UpperTheory.Comparison₂.CoreAtH",
    leanIds: [
      "UpperTheory.Comparison₂.CoreAtH",
      "Formalism.LFunctionChainParameters.LChain.RestSize",
      "UpperTheory.Comparison₂.tiedCore_of_chainTied",
    ],
    plain:
      "Each step of a long chain adds cost. The prime-sum estimate needs both enough steps and a bound on their combined error.",
    detail:
      "RestSize requires m ≥ x^(½−ε). tiedCore_of_chainTied extracts the scale conditions consumed by core_gm.",
    question:
      "Locate the chain-length inequality and its use in CoreAtH.",
    sources: [
      lean("CoreAtH · chain data", cosets + "CoreAtH", 29),
      lean(
        "RestSize · length bound",
        "Formalism/SizeWindowBrackets/SChain",
        53,
      ),
      lean(
        "tiedCore_of_chainTied · scales",
        cosets + "LevelGmLeOnFamilyScales",
        13,
      ),
    ],
    dependsOn: [],
  },
  {
    id: "galois",
    title: "Galois representations",
    english: "Galois representations",
    section: "arithmetic",
    leanId: "UpperTheory.Gal.Int.galoisLocalGlobalStrong_recParameter",
    leanIds: [
      "UpperTheory.Gal.Int.galoisLocalGlobalStrong_recParameter",
      "UpperTheory.Gal.Int.galoisRepresentations_of_thetaLift",
      "UpperTheory.GalStar.Row0b",
    ],
    plain:
      "Galois representations express arithmetic symmetries as matrices, allowing local data to be compared.",
    detail:
      "Row0b specifies representations for certain regular algebraic, polarized cuspidal automorphic representations over CM fields. RowSrc supplies them using theta lifts.",
    question:
      "Trace the local conditions and the geometric input to the lift.",
    sources: [
      lean("RowSrc · Row0b", rep + "IntegralStructures/RowSrc", 6),
      lean(
        "Geometry and theta lifts",
        rep + "IntegralStructures/GaloisRepresentationsOfThetaLift",
        6,
      ),
      lean("Row0b · hypotheses", rep + "TypeConditions/WeightsConjBis", 69),
    ],
    dependsOn: [],
  },
];

// An editorial sequence through the author's discovery narrative. Order means
// “read next”; it supplies no formal prerequisite or audit propagation.
export const AUTHOR_ROUTE = [
  {
    id: "outline-stepanov",
    title: "Stepanov’s method",
    english: "Stepanov’s method",
    section: "outline",
    dependsOn: [],
    plain:
      "A finite-field argument gains strength by making auxiliary objects vanish to high order.",
    detail:
      "Alpöge describes the difficulty of finding an analogue of multiplicity over the integers.",
    question:
      "Locate the finite-field analogy in the announcement.",
    sources: [note(1, "Announcement · p. 1"), note(3, "Timeline · items 1–4")],
  },
  {
    id: "outline-primes",
    title: "Weighted prime sums",
    english: "Weighted prime sums",
    section: "outline",
    dependsOn: [],
    plain:
      "The von Mangoldt function assigns log p to powers of p and zero elsewhere.",
    detail:
      "Item 5 adds the weight X/n−1 and subtracts a main term. The rest of the argument needs control of the error.",
    question: "Identify the extra weight and the main term.",
    sources: [note(3, "Announcement · p. 3, item 5")],
  },
  {
    id: "outline-theta",
    title: "Iterated theta lifts",
    english: "Iterated theta lifts",
    section: "outline",
    dependsOn: [],
    plain:
      "Successive lifts transfer information between spaces with different symmetries.",
    detail:
      "The announcement describes a chain of about √X lifts for a prime sum of length X. Items 8–10 discuss norms and divisibility.",
    question: "Check which quantity grows like √X.",
    sources: [note(1, "Announcement · p. 1"), note(4, "Timeline · items 8–10")],
  },
  {
    id: "outline-cost",
    title: "Cost of a lift",
    english: "Accounting for each lift",
    section: "outline",
    dependsOn: [],
    plain:
      "Each extra lift may increase divisibility as well as its cost.",
    detail:
      "Items 12–16 discuss the Rallis seesaw, slopes and integral structures. The author cautions that the retrospective timeline was assembled by Claude.",
    question:
      "Check the distinction between the retrospective and the Lean dependency record.",
    sources: [
      note(4, "Timeline · items 12–20"),
      note(3, "Announcement · p. 3, footnote 4"),
    ],
  },
];

export const READING_ORDER = [
  "rh",
  "every",
  "zero",
  "landau",
  "gm",
  "chain",
  "windows",
  "pairs",
  "vwin",
  "galois",
  "strip",
  "primitive",
];
