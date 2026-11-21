// Each source run can cover several statements. Keep the same run group across
// entries so repeated reports of the shared export cannot count as new evidence.
const oldTargets = {
  rh: "Main 中经典 RH 的两种表述",
  every: "Main 中全体狄利克雷特征右半平面无零点的结论",
  strip: "全体狄利克雷特征的临界带结论",
  primitive: "本原狄利克雷特征的临界带结论",
};
const raw = [
  "riemannHypothesis",
  "riemannZeta_eq_zero_re",
  "LFunction_ne_zero_of_half_lt_re",
  "LFunction_eq_zero_re",
  "LFunction_eq_zero_re_of_isPrimitive",
];
for (const name of raw) oldTargets["lean:" + name] = name;
const targets = {
  rh: "Both RH statements",
  every: "Right-half-plane nonvanishing",
  strip: "Critical-strip zeros for all characters",
  primitive: "Critical-strip zeros for primitive characters",
};
for (const name of raw) targets["lean:" + name] = name;
const runs = [
  {
    id: "nanoda",
    group: "sutherland-main-export",
    at: "2026-11-20T19:05:45Z",
    source: "https://math.mit.edu/~drew/grh/nanoda.log",
    note: "nanoda accepted the full export (exit 0).",
    oldNote: "Sutherland 报告 nanoda 接受含此目标的完整导出，日志退出码为 0。此项检查覆盖内核重放。",
  },
  {
    id: "compare",
    group: "sutherland-main-export",
    at: "2026-11-20T21:19:12Z",
    source: "https://math.mit.edu/~drew/grh/con-leche-compare.log",
    note: "con-leche matched all five targets against the independent challenge, using the same export as nanoda.",
    oldNote: "con-leche 的 compare 模式逐项确认五个目标均匹配独立挑战。它与 nanoda 使用同一次构建导出的证明，归到同一个证据组。",
  },
  {
    id: "lumi",
    group: "lipponen-lumi-build",
    at: "2026-11-21T12:40:00Z",
    source:
      "https://github.com/aapolipponen/rh-lean-check-lumi/tree/6e1d323a571e1ba5d6948922d30c8d0631df24fb",
    note: "The LUMI sandbox rebuild found only the three standard axioms. The timestamp is the report update.",
    oldNote: "LUMI 的独立沙箱重建与依赖审计报告此目标仅使用三条标准公理。时间取自报告更新时间。两次重建共享源码、Lean 和 Mathlib。",
  },
];
export const BASELINE = Object.entries(targets).flatMap(([nodeId, title]) =>
  runs.map((run) => ({
    id: "public-" + run.id + "-" + nodeId,
    nodeId,
    group: run.group,
    at: run.at,
    outcome: "support",
    source: run.source,
    note: title + ". " + run.note,
  })),
);

// Historic exports may include an unchanged public entry from the Chinese edition.
// Migrate only exact published notes. User text and ID collision checks stay intact.
const oldNotes = new Map(Object.entries(oldTargets).flatMap(([id, title]) =>
  runs.map(run => ["public-" + run.id + "-" + id, title + "。" + run.oldNote])
));
const notes = new Map(BASELINE.map(review => [review.id, review.note]));
export function baselineNote(id, note) {
  return oldNotes.get(id) === note ? notes.get(id) : note;
}
