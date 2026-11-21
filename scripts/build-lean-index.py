"""Reproduce the browser's declaration index from verified CC0 release tables."""
import argparse
import csv
import gzip
import json
import os
from collections import deque
from pathlib import Path
from tempfile import mkstemp
from urllib.parse import quote

from lean_sources import INPUTS, SOURCE_COMMIT, SOURCE_URL, verified_inputs


PROJECT = Path(__file__).resolve().parents[1]
ROOTS = [
    "riemannHypothesis",
    "riemannZeta_eq_zero_re",
    "LFunction_ne_zero_of_half_lt_re",
    "LFunction_eq_zero_re",
    "LFunction_eq_zero_re_of_isPrimitive",
]
ANCHORS = {
    "rh": "riemannHypothesis",
    "strip": "LFunction_eq_zero_re",
    "primitive": "LFunction_eq_zero_re_of_isPrimitive",
    "every": "UpperTheory.FinalTheorems.everyCharacter",
    "zero": "UpperTheory.Top.zeroFreeAll_of_topG",
    "windows": "UpperTheory.Top.winPairs",
    "gm": "UpperTheory.Comparison₂.core_gm",
    "landau": "UpperTheory.Comparison₂.formB",
    "pairs": "QH.pairEx",
    "vwin": "UpperTheory.One.vwin_of_row",
    "chain": "UpperTheory.Comparison₂.CoreAtH",
    "galois": "UpperTheory.Gal.Int.galoisLocalGlobalStrong_recParameter",
}
OVERVIEW_DEPTH = 6


def choose_names(cache, extra):
    # Project declarations in why-parents are 'decl@src/path'. Shared helpers
    # have separate project: names, and are never turned into invented edges.
    anchors = set(ANCHORS.values()) | set(extra)
    selected = set(ROOTS) | set(extra)
    paths = {}
    with gzip.open(cache / "why-parents.csv.gz", "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            depth = int(row["decl_depth"])
            if row["origin"] != "project" or "@src/" not in row["node"]:
                continue
            if depth > 13 and not extra:
                continue
            name = row["decl_or_const"]
            parent = row["parent"].split("@src/", 1)[0]
            paths[name] = parent
            if depth <= OVERVIEW_DEPTH or name in anchors or parent in anchors:
                selected.add(name)

    # Include witness paths reaching each teaching anchor and its sample
    # children. The edges themselves are looked up in the separate edge table.
    for start in sorted(selected):
        current = start
        while current:
            current = paths.get(current)
            if current:
                selected.add(current)
    return selected


def lookup_declarations(cache, selected):
    nodes = {}
    with gzip.open(cache / "decls.csv.gz", "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            name = row["decl"]
            if name not in selected or row["in_cone"] != "true":
                continue
            if name in nodes:
                raise ValueError(f"Multiple used declaration spans for {name}")
            path = row["file"]
            line = int(row["range_start_line"])
            nodes[name] = {
                "id": name,
                "kind": row["command_kind"],
                "file": path,
                "line": line,
                "endLine": int(row["range_end_line"]),
                "url": f"{SOURCE_URL}{quote(path)}#L{line}",
                "kernelDepth": int(row["depth"]),
            }
    return nodes


def load_edges(cache, nodes):
    # A destination can occur in both the type and the value. Combine its two
    # rows while keeping enough information for those claims to be audited.
    refs = {name: {} for name in nodes}
    with gzip.open(cache / "decl_edges.csv.gz", "rt", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        assert next(reader) == ["src", "src_kind", "dst", "dst_kind", "via"]
        for source, source_kind, destination, dest_kind, via in reader:
            if source not in refs or source_kind != "decl":
                continue
            flags = refs[source]
            key = (dest_kind, destination)
            flag = {"type": 1, "value": 2}[via]
            flags[key] = flags.get(key, 0) | flag
    return refs


def form_slice(nodes, refs, extra):
    reachable = set(ROOTS) | set(extra)
    pending = deque(sorted(reachable))
    while pending:
        name = pending.popleft()
        for kind, destination in refs[name]:
            if kind == "decl" and destination in nodes and destination not in reachable:
                reachable.add(destination)
                pending.append(destination)
    if not set(ANCHORS.values()) <= reachable:
        raise ValueError("A teaching anchor was not reached along actual declaration references.")
    result = []
    for name in sorted(reachable, key=lambda n: (nodes[n]["kernelDepth"], n)):
        visible = sorted((dst, flags) for (kind, dst), flags in refs[name].items()
                         if kind == "decl" and dst in reachable)
        result.append({
            **nodes[name],
            "deps": [dst for dst, _ in visible],
            "refKinds": [{1: "type", 2: "value", 3: "both"}[flags] for _, flags in visible],
            "omitted": len(refs[name]) - len(visible),
        })
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True, help="Cache for three verified release files (165 MB).")
    parser.add_argument("--output", type=Path, default=PROJECT / "site/data/lean-index.json")
    parser.add_argument("--targets", type=Path, default=PROJECT / "site/data/review-targets.json",
                        help="Versioned JSON array of additional, independently resolved declaration names")
    args = parser.parse_args()
    extra = json.loads(args.targets.read_text(encoding="utf-8"))
    if not isinstance(extra, list) or not all(isinstance(name, str) and name.strip() == name and name for name in extra):
        parser.error("Targets must be a JSON array of nonempty declaration names.")
    extra = sorted(set(extra))
    verified_inputs(args.cache)
    nodes = lookup_declarations(args.cache, choose_names(args.cache, extra))
    missing = set(extra) - nodes.keys()
    if missing:
        raise ValueError(f"Targets absent from the pinned five-theorem declaration cone: {sorted(missing)}")
    result = form_slice(nodes, load_edges(args.cache, nodes), extra)
    data = {
        "meta": {
            "version": "1", "upstream": "James Shore v0.2", "license": "CC0-1.0",
            "sourceCommit": SOURCE_COMMIT,
            "url": "https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2",
            "inputSha256": INPUTS,
            "nodeCount": len(result),
            "edgeCount": sum(len(node["deps"]) for node in result),
            "projectFiles": 175187, "projectSourceLines": 17374215, "usedProjectDeclarations": 804912,
            "scope": "Project declaration references in types and bodies. Omitted counts exclude Mathlib and Lean core."
        },
        "roots": ROOTS,
        "anchors": ANCHORS,
        "nodes": result,
    }
    if extra:
        data["meta"]["extraReviewTargets"] = extra
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    descriptor, temporary_name = mkstemp(dir=args.output.parent, prefix=args.output.name + ".", suffix=".building")
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(encoded)
        temporary.replace(args.output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"{len(result):,} declarations, {data['meta']['edgeCount']:,} edges; {len(encoded.encode('utf-8')):,} bytes")


if __name__ == "__main__":
    main()
