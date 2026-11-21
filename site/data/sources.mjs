// A dated reading list. The release and logs each answer a different question.
const archiveHash =
  "9631b4f020199e580ba86178cb56c6e9b09f690c2369a80dc4334aa93f49c7fc";
const cocoCommit = "0fb9869c6e6d7b54b67de803af0e0be29d37fc22";
const lumiCommit = "6e1d323a571e1ba5d6948922d30c8d0631df24fb";
const mit = "https://math.mit.edu/~drew/grh/";

export const SOURCES = [
  {
    id: "announcement",
    digests: {
      "remark.pdf":
        "3fc97784b71ddd44ff8aa0a177e99622a1c61b13cfa843a0989ee4a7a0cfeb8d",
    },
    kind: "Announcement",
    publisher: "Levent Alpöge",
    date: "2026-11-20",
    title: "Remark on the Riemann hypothesis",
    url: "https://alpo.ge/remark.pdf",
    detail:
      "The archive links are on page 1. Footnote 2 on page 2 describes a text exceeding 250,000 pages. The author released the Lean source.",
  },
  {
    id: "archive",
    kind: "Source archive",
    publisher: "Levent Alpöge",
    date: "2026-11-20",
    title: "The 14 original parts",
    url: "https://alpo.ge/remark.pdf#page=1",
    detail: "The fourteen files join to form a single 239,275,554-byte gzip archive.",
    digests: { "lean.tar.gz": archiveHash },
    links: Array.from({ length: 14 }, (_, i) => {
      const part = String(i + 1).padStart(2, "0");
      return {
        title: "Part " + part,
        url: "https://alpo.ge/lean.tar.gz.part" + part,
      };
    }),
  },
  {
    id: "mirror",
    kind: "Mirror",
    publisher: "CocoSgt · GitHub",
    date: "2026-11-20",
    title: "CocoSgt release",
    url: "https://github.com/CocoSgt/riemann-hypothesis-lean/releases/tag/v2026-11-20",
    detail:
      "All 175,187 source files matched the original archive at commit 0fb9869. The README describes verification status at release time.",
    links: [
      {
        title: "Pinned commit",
        url:
          "https://github.com/CocoSgt/riemann-hypothesis-lean/tree/" +
          cocoCommit,
      },
    ],
  },
  {
    id: "statements",
    kind: "Formal statements",
    publisher: "Lean / Mathlib",
    date: "2026-11-20",
    title: "The five targets",
    url:
      "https://github.com/CocoSgt/riemann-hypothesis-lean/blob/" +
      cocoCommit +
      "/src/Main.lean",
    detail:
      "Two statements of RH, a zero-free half-plane for Dirichlet L-functions, and critical-strip results for all characters and for primitive characters.",
    links: [
      {
        title: "Statements.lean",
        url:
          "https://github.com/CocoSgt/riemann-hypothesis-lean/blob/" +
          cocoCommit +
          "/src/Statements.lean",
      },
      {
        title: "Mathlib definition",
        url: "https://github.com/leanprover-community/mathlib4/blob/0df444a360eaa60ab8c11dca51a86af692955474/Mathlib/NumberTheory/LSeries/RiemannZeta.lean#L185",
      },
    ],
  },
  {
    id: "audit",
    digests: {
      "audit.log":
        "0a1473fce6eed840011f4a76b1c51558fc6f03edd1e6bd1ee542e6c738d87a62",
      "nanoda.log":
        "d4c5360b02d8dd885150c1cc28b616cb6fb5bf5b20d142558d79a7b15ae9d9df",
      "con-leche-compare.log":
        "5a068bf55f24904eea9f05eda947c63d43bdee3c6ab0490e43943a3bd9af1f6e",
    },
    kind: "Kernel audit",
    publisher: "Andrew Sutherland · MIT",
    date: "2026-11-21",
    title: "Independent kernel checks",
    url: mit,
    detail:
      "At 12:55 UTC, all modules had compiled and passed kernel replay. The five targets passed the axiom audit. Two independent kernels accepted the export. The end-to-end comparator was still running.",
    links: [
      { title: "Axiom audit", url: mit + "audit.log" },
      { title: "nanoda log", url: mit + "nanoda.log" },
      { title: "con-leche log", url: mit + "con-leche-master.log" },
      { title: "Target comparison", url: mit + "con-leche-compare.log" },
      { title: "Checksums", url: mit + "SHA256SUMS" },
    ],
  },
  {
    id: "lumi",
    kind: "Rebuild",
    publisher: "Aapo Lipponen · LUMI",
    date: "2026-11-21",
    title: "LUMI sandbox rebuild",
    url:
      "https://github.com/aapolipponen/rh-lean-check-lumi/tree/" + lumiCommit,
    detail:
      "All modules built in a network-isolated sandbox. Checksums for Main.olean and Statements.olean matched Sutherland’s build. Both used the same toolchain.",
    links: [
      {
        title: "Build manifest",
        url:
          "https://github.com/aapolipponen/rh-lean-check-lumi/blob/" +
          lumiCommit +
          "/results/build-summary.json",
      },
    ],
  },
  {
    id: "shore",
    kind: "Dataset",
    publisher: "James Shore",
    date: "2026-11-21",
    title: "Kernel-term references",
    url: "https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2",
    detail:
      "Shore’s CC0 dataset maps compiled declarations and references to source lines. Of 175,187 project files, 146,292 contain a declaration used by at least one target.",
    links: [
      {
        title: "Data dictionary",
        url: "https://github.com/james-shore/rh-proof-dependencies/blob/v0.2/docs/dataset.md",
      },
    ],
  },
  {
    id: "clay",
    kind: "Problem statement",
    publisher: "Clay Mathematics Institute",
    date: "2026-11-21",
    title: "Riemann hypothesis",
    url: "https://www.claymath.org/millennium/riemann-hypothesis/",
    detail:
      "Clay’s official problem page listed the question as unsolved on the snapshot date.",
  },
];
