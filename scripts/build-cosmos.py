"""Publish the source-backed, five-target declaration cone as bounded gzip shards.

The SQLite input is built by lean-db.py from James Shore's verified v0.2 CSV
tables. Only direct references with both endpoints in the used source cone are
included. Inputs, chunk sizes, sort order and compression parameters are fixed.
"""

import argparse
import array
import collections
import gzip
import json
import os
from pathlib import Path
import sqlite3
import tempfile

from lean_sources import INPUTS, SOURCE_COMMIT, SOURCE_URL
from cosmos_paths import ROOTS, decode_csr, trace_tables, directory_flows

HERE = Path(__file__).resolve().parents[1]
BLOCK = 4096
DIR_BUCKETS = 64
SOURCE_COUNTS = (804912, 146292)
REFERENCE_IDENTITY = {k: INPUTS[k] for k in ("decls.csv.gz", "decl_edges.csv.gz")}


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def write_blob(output, name, data):
    compressed = gzip.compress(data, compresslevel=6, mtime=0)
    (output / name).write_bytes(compressed)


def stable_bucket(path):
    h = 2166136261
    for byte in path.encode("utf-8"):
        h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
    return h % DIR_BUCKETS


def varint(buffer, n):
    while n >= 128:
        buffer.append((n & 127) | 128)
        n >>= 7
    buffer.append(n)


def read_nodes(db):
    capacity = db.execute("SELECT MAX(id)+1 FROM symbols").fetchone()[0]
    # Maps database ids to publication ids + 1; zero means outside this graph.
    dense = array.array("I", [0]) * capacity
    nodes, files, file_starts, file_regions, region_names = [], [], [], [], []
    region_ids, kind_ids, known_files = {}, {}, set()
    last_file = None
    query = """SELECT s.id,s.name,p.kind,p.file,p.start,p.end
        FROM spans p INDEXED BY span_location JOIN symbols s ON s.id=p.symbol
        WHERE p.used=1 ORDER BY p.symbol"""
    for dbid, name, kind, file, start, end in db.execute(query):
        if dense[dbid]:
            raise ValueError(f"Multiple used source declarations for {name}")
        dense[dbid] = len(nodes) + 1
        if file != last_file:
            if file in known_files:
                raise ValueError("Expected contiguous source-file rows")
            known_files.add(file)
            branch = "/".join(file.split("/")[:2])
            if branch not in region_ids:
                region_ids[branch] = len(region_names)
                region_names.append(branch)
            files.append(file)
            file_regions.append(region_ids[branch])
            file_starts.append(len(nodes))
            last_file = file
        kind_id = kind_ids.setdefault(kind, len(kind_ids))
        nodes.append((name, kind_id, len(files) - 1, start, end))
    if (len(nodes), len(files)) != SOURCE_COUNTS:
        raise ValueError(
            "Used declarations/source files differ from pinned v0.2 counts"
        )
    file_starts.append(len(nodes))
    return nodes, files, file_starts, region_names, file_regions, list(kind_ids), dense


def build_directories(output, files, starts):
    children = collections.defaultdict(dict)
    for i, path in enumerate(files):
        count = starts[i + 1] - starts[i]
        directory, name = path.rsplit("/", 1)
        children[directory][name] = [name, "f", count, 1, starts[i]]
        while directory != "src":
            parent, name = directory.rsplit("/", 1)
            entry = children[parent].setdefault(name, [name, "d", 0, 0])
            entry[2] += count
            entry[3] += 1
            directory = parent
    buckets = [{} for _ in range(DIR_BUCKETS)]
    for directory, entries in sorted(children.items()):
        buckets[stable_bucket(directory)][directory] = sorted(
            entries.values(), key=lambda row: (-row[2], row[0])
        )
    for n, bucket in enumerate(buckets):
        write_blob(output, f"dirs-{n:02}.json.gz", compact(bucket))
    return children["src"]


def edge_pass(db, output, dense, direction, node_count, regions, region_names):
    """Scan a covering SQLite index once, writing delta-coded typed neighbor ids."""
    incoming = direction == "callers"
    first, second, index = (
        ("dst", "src", "incoming") if incoming else ("src", "dst", "outgoing")
    )
    query = f"SELECT {first},{second},via FROM refs INDEXED BY {index} ORDER BY {first},{second},via"
    counts = array.array("I", [0]) * node_count
    type_counts = array.array("I", [0]) * node_count if not incoming else None
    value_counts = array.array("I", [0]) * node_count if not incoming else None
    matrix = [[0, 0] for _ in range(len(region_names) ** 2)]
    omitted = array.array("I", [0]) * node_count if not incoming else None
    omitted_pair = None
    unique = 0
    buffer = bytearray()
    active = 0
    neighbors = []
    chunk_id = 0
    last_key = -1
    region_count = len(region_names)

    def finish_row():
        nonlocal unique, buffer, chunk_id
        counts[active] = len(neighbors)
        unique += len(neighbors)
        varint(buffer, len(neighbors))
        prior = 0
        for target, flags in neighbors:
            varint(buffer, ((target - prior) << 2) | flags)
            prior = target
            if not incoming:
                # bit 0 = type, bit 1 = value; a pair may contribute to both.
                typed = flags & 1
                value = flags >> 1
                type_counts[active] += typed
                value_counts[active] += value
                bucket = matrix[regions[active] * region_count + regions[target]]
                bucket[0] += typed
                bucket[1] += value
        if (active + 1) % BLOCK == 0 or active == node_count - 1:
            write_blob(output, f"{direction}-{chunk_id:04}.bin.gz", buffer)
            buffer = bytearray()
            chunk_id += 1
        neighbors.clear()

    for db_src, db_dst, via in db.execute(query):
        a, b = dense[db_src], dense[db_dst]
        if not (a and b):
            if not incoming and a and (db_src, db_dst) != omitted_pair:
                # Distinct project destinations without a used source span (most
                # are compiler-generated helpers). One pair may occur twice.
                omitted[a - 1] += 1
                omitted_pair = (db_src, db_dst)
            continue
        src, dst = a - 1, b - 1
        if src != active:
            while active < src:
                finish_row()
                active += 1
            last_key = -1
        flag = 1 << via
        if dst == last_key:
            neighbors[-1][1] |= flag
        else:
            if dst < last_key:
                raise ValueError("Destinations must be ordered by publication id")
            neighbors.append([dst, flag])
            last_key = dst
    while active < node_count:
        finish_row()
        active += 1
    return counts, type_counts, value_counts, unique, matrix, omitted


def build(db, output):
    meta = dict(db.execute("SELECT key,value FROM meta"))
    if meta.get("schema") != "1" or json.loads(meta["inputs"]) != REFERENCE_IDENTITY:
        raise ValueError("Database identity differs from the pinned v0.2 release")
    nodes, files, starts, region_names, file_regions, kinds, dense = read_nodes(db)
    regions = array.array("B", (file_regions[row[2]] for row in nodes))
    top = build_directories(output, files, starts)
    print(
        f"Prepared {len(nodes):,} declarations and {len(files):,} used source files",
        flush=True,
    )
    out, t, v, unique, matrix, omitted = edge_pass(
        db, output, dense, "deps", len(nodes), regions, region_names
    )
    print(f"Encoded {unique:,} outgoing references", flush=True)
    callers, _, _, reverse_count, _, _ = edge_pass(
        db, output, dense, "callers", len(nodes), regions, region_names
    )
    if unique != reverse_count:
        raise ValueError("Forward and reverse counts differ")
    print(f"Encoded {reverse_count:,} reverse references", flush=True)
    offsets, packed = decode_csr(output)
    if len(offsets) != len(nodes) + 1 or len(packed) != unique:
        raise ValueError("Invalid adjacency size")
    witness, masks, distance, target_counts, root_ids = trace_tables(
        nodes, offsets, packed
    )
    print(
        f"Computed witness paths for {sum(bool(x) for x in masks):,} declarations",
        flush=True,
    )
    flow_count = directory_flows(
        output,
        nodes,
        files,
        offsets,
        packed,
        DIR_BUCKETS,
        stable_bucket,
        compact,
        write_blob,
    )
    print(f"Aggregated {flow_count:,} distinct directory flows", flush=True)
    for first in range(0, len(nodes), BLOCK):
        part = nodes[first : first + BLOCK]
        offset = part[0][2]
        rows = [
            [
                name,
                kind,
                f - offset,
                start,
                end,
                out[i],
                callers[i],
                t[i],
                v[i],
                omitted[i],
                witness[i],
                masks[i],
                distance[i],
            ]
            for i, (name, kind, f, start, end) in enumerate(part, first)
        ]
        write_blob(
            output,
            f"nodes-{first//BLOCK:04}.json.gz",
            compact([files[offset : part[-1][2] + 1], rows]),
        )
    # Match JavaScript's UTF-16 binary ordering, including non-BMP code points.
    order = sorted(
        range(len(nodes)),
        key=lambda i: (
            nodes[i][0].lower().encode("utf-16-be"),
            nodes[i][0].encode("utf-16-be"),
        ),
    )
    search_bounds = []
    for first in range(0, len(nodes), BLOCK):
        part = order[first : first + BLOCK]
        rows = [[nodes[i][0], i] for i in part]
        search_bounds.append([rows[0][0].lower(), rows[-1][0].lower(), len(rows)])
        write_blob(output, f"names-{first//BLOCK:04}.json.gz", compact(rows))
    links = []
    for i, source in enumerate(region_names):
        for j, target in enumerate(region_names):
            typed, values = matrix[i * len(region_names) + j]
            if typed or values:
                links.append(
                    dict(source=source, target=target, type=typed, value=values)
                )
    summary = []
    for n, k, c, f, *_ in sorted(top.values(), key=lambda x: (-x[2], x[0])):
        path = "src/" + n
        summary.append(
            dict(
                id=path,
                path=path,
                name=n,
                kind="directory" if k == "d" else "file",
                region=path,
                count=c,
                files=f,
            )
        )
    manifest = dict(
        schema=1,
        release="James Shore v0.2",
        sourceCommit=SOURCE_COMMIT,
        sourceUrl=SOURCE_URL,
        inputSha256=REFERENCE_IDENTITY,
        blockSize=BLOCK,
        dirBuckets=DIR_BUCKETS,
        kinds=kinds,
        nodeCount=len(nodes),
        fileCount=len(files),
        edgeCount=unique,
        typeReferences=sum(t),
        valueReferences=sum(v),
        omittedProjectRefs=sum(omitted),
        regions=summary,
        links=links,
        searchBounds=search_bounds,
        typedProjectRows=int(meta["referenceRows"]),
        targets=ROOTS,
        targetIds=["d:" + str(i) for i in root_ids],
        reachableByTarget=target_counts,
        rootedCount=sum(bool(x) for x in masks),
        maxDistance=max(distance),
        directoryFlowCount=flow_count,
    )
    (output / "manifest.json").write_bytes(compact(manifest) + b"\n")
    print(
        f"Published {len(links)} regional flows; {sum(p.stat().st_size for p in output.iterdir()):,} bytes total",
        flush=True,
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", type=Path, default=HERE / "dist/full.sqlite")
    ap.add_argument("--output", type=Path, default=HERE / "site/data/cosmos")
    args = ap.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(
        args.db.resolve().as_uri() + "?mode=ro&immutable=1", uri=True
    ) as db:
        with tempfile.TemporaryDirectory(
            dir=args.output.parent, prefix=".cosmos-build-"
        ) as tmp:
            dest = Path(tmp)
            build(db, dest)
            args.output.mkdir(exist_ok=True)
            for child in sorted(
                dest.iterdir(), key=lambda p: (p.name == "manifest.json", p.name)
            ):
                os.replace(child, args.output / child.name)
