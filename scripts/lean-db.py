"""Index all v0.2 project declarations locally and query their direct references."""
import argparse
import csv
import gzip
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

from lean_sources import INPUTS, SOURCE_URL, verified_inputs


ASSETS = ("decls.csv.gz", "decl_edges.csv.gz")
IDENTITY = json.dumps({name: INPUTS[name] for name in ASSETS}, sort_keys=True)
SCHEMA = """
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE symbols(id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE spans(symbol INTEGER NOT NULL, kind TEXT, file TEXT, start INTEGER, end INTEGER, used INTEGER);
CREATE TABLE refs(src INTEGER NOT NULL, dst INTEGER NOT NULL, via INTEGER NOT NULL);
"""
BATCH_SIZE = 50000


def bulk_insert(connection, table, rows):
    if rows:
        placeholders = ",".join("?" for _ in rows[0])
        connection.executemany(f"INSERT INTO {table} VALUES ({placeholders})", rows)
        rows.clear()


def fill_db(connection, cache):
    connection.executescript(SCHEMA)
    # Integers keep the 20 million edge rows compact. The source-level graph
    # distinguishes named declarations from separate compiler-generated helpers.
    ids = {"decl": {}, "constant": {}}
    symbols = []
    next_id = 1

    def symbol_id(name, kind):
        nonlocal next_id
        mapping = ids[kind]
        index = mapping.get(name)
        if index is None:
            index = next_id
            next_id += 1
            mapping[name] = index
            symbols.append((index, name, kind))
            if len(symbols) >= BATCH_SIZE:
                bulk_insert(connection, "symbols", symbols)
        return index

    spans = []
    decl_count = 0
    with gzip.open(cache / ASSETS[0], "rt", encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            index = symbol_id(row["decl"], "decl")
            spans.append((index, row["command_kind"], row["file"], int(row["range_start_line"]),
                          int(row["range_end_line"]), row["in_cone"] == "true"))
            decl_count += 1
            if len(spans) >= BATCH_SIZE:
                bulk_insert(connection, "spans", spans)
    bulk_insert(connection, "spans", spans)

    edge_count = 0
    refs = []
    with gzip.open(cache / ASSETS[1], "rt", encoding="utf-8", newline="") as stream:
        reader = csv.reader(stream)
        if next(reader) != ["src", "src_kind", "dst", "dst_kind", "via"]:
            raise ValueError("Unrecognized v0.2 edge layout")
        for src, src_kind, dst, dst_kind, via in reader:
            refs.append((symbol_id(src, src_kind), symbol_id(dst, dst_kind), int(via == "value")))
            edge_count += 1
            if len(refs) >= BATCH_SIZE:
                bulk_insert(connection, "refs", refs)
    bulk_insert(connection, "refs", refs)
    bulk_insert(connection, "symbols", symbols)
    if (decl_count, edge_count) != (1063284, 20372294):
        raise ValueError("Unexpected row counts")
    print(f"Indexing {edge_count:,} references in both directions…", file=sys.stderr, flush=True)
    connection.executescript("""
        CREATE UNIQUE INDEX symbol_name ON symbols(name,kind);
        CREATE INDEX span_location ON spans(symbol);
        CREATE INDEX outgoing ON refs(src,dst,via);
        CREATE INDEX incoming ON refs(dst,src,via);
    """)
    connection.executemany("INSERT INTO meta VALUES (?,?)", [
        ("inputs", IDENTITY), ("schema", "1"), ("declarationRows", str(decl_count)),
        ("referenceRows", str(edge_count)), ("symbols", str(next_id - 1))])
    connection.commit()


def build(db, cache):
    if db.exists():
        with open_database(db) as existing:
            print("Verified input identity; this index already exists.", dict(existing.execute("SELECT * FROM meta")))
        return
    verified_inputs(cache, ASSETS)
    db.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=db.name + ".", suffix=".building", dir=db.parent)
    os.close(fd)
    temp = Path(name)
    try:
        connection = sqlite3.connect(temp)
        try:
            # This is a new disposable build file. It only becomes visible at the
            # requested path after the data and both indexes have been committed.
            connection.execute("PRAGMA journal_mode=OFF")
            connection.execute("PRAGMA synchronous=OFF")
            connection.execute("PRAGMA cache_size=-65536")
            fill_db(connection, cache)
        finally:
            connection.close()
        # No overwriting the output of a concurrent builder or another program.
        os.link(temp, db)
        print(f"Built {db} ({db.stat().st_size:,} bytes).")
    finally:
        temp.unlink(missing_ok=True)


def open_database(path):
    connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        meta = dict(connection.execute("SELECT key,value FROM meta"))
        if meta.get("inputs") != IDENTITY or meta.get("schema") != "1":
            raise ValueError("Wrong database version or input tables")
        return connection
    except Exception:
        connection.close()
        raise


def locations(connection, symbol):
    rows = connection.execute(
        "SELECT kind,file,start,end,used FROM spans WHERE symbol=? ORDER BY file,start", (symbol,))
    return [{"kind": kind, "file": file, "line": start, "endLine": end, "inFiveTargets": bool(used),
             "url": f"{SOURCE_URL}{quote(file)}#L{start}-L{end}"} for kind, file, start, end, used in rows]


def neighbors(connection, index, direction, limit, offset):
    source, target = ("src", "dst") if direction == "deps" else ("dst", "src")
    count, = connection.execute(
        f"SELECT COUNT(DISTINCT {target}) FROM refs WHERE {source}=?", (index,)).fetchone()
    rows = connection.execute(f"""
        SELECT r.id, s.name, s.kind, r.lo, r.hi FROM (
            SELECT {target} AS id, MIN(via) AS lo, MAX(via) AS hi FROM refs
            WHERE {source}=? GROUP BY {target} ORDER BY {target} LIMIT ? OFFSET ?
        ) AS r JOIN symbols AS s ON s.id=r.id ORDER BY r.id
    """, (index, limit, offset))
    return {"total": count, "offset": offset, "items": [
        {"id": name, "kind": kind, "via": "both" if lo != hi else ("value" if lo else "type"),
         "locations": locations(connection, idx)} for idx, name, kind, lo, hi in rows]}


def query(connection, args):
    if args.action == "search":
        # Binary comparison supports case-sensitive Unicode name prefixes.
        lo = args.prefix
        rows = connection.execute("""
            SELECT id,name,kind FROM symbols WHERE name>=? AND name<? ORDER BY name,kind LIMIT ? OFFSET ?
        """, (lo, lo + chr(0x10ffff), args.limit + 1, args.offset)).fetchall()
        return {"offset": args.offset, "hasMore": len(rows) > args.limit, "items": [
            {"id": name, "kind": kind, "locations": locations(connection, idx)}
            for idx, name, kind in rows[:args.limit]]}
    row = connection.execute("SELECT id,name,kind FROM symbols WHERE name=? AND kind=?",
                             (args.name, args.kind)).fetchone()
    if row is None:
        raise ValueError(f"Unknown {args.kind} in the pinned v0.2 database: {args.name}")
    idx, name, kind = row
    result = {"id": name, "kind": kind, "locations": locations(connection, idx)}
    for direction in ("deps", "callers"):
        if args.direction in [direction, "both"]:
            result[direction] = neighbors(connection, idx, direction, args.limit, args.offset)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True, help="Location of your full local SQLite file")
    actions = parser.add_subparsers(required=True, dest="action")
    init = actions.add_parser("build", help="Build once from the verified v0.2 release tables")
    init.add_argument("--cache", type=Path, required=True)
    search = actions.add_parser("search", help="Find project symbols by complete name prefix")
    search.add_argument("prefix")
    show = actions.add_parser("show", help="Show a project symbol's source span and direct references")
    show.add_argument("name")
    show.add_argument("--kind", choices=["decl", "constant"], default="decl")
    show.add_argument("--direction", choices=["both", "deps", "callers"], default="both")
    for action in (search, show):
        action.add_argument("--limit", type=int, default=20)
        action.add_argument("--offset", type=int, default=0)
    args = parser.parse_args()
    if args.action == "build":
        build(args.db, args.cache)
        return
    if not 1 <= args.limit <= 1000 or args.offset < 0:
        parser.error("limit must be 1–1000 and offset must be nonnegative")
    connection = open_database(args.db)
    try:
        print(json.dumps(query(connection, args), ensure_ascii=False, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, sqlite3.DatabaseError, ValueError) as error:
        sys.exit(str(error))
