"""Compute witness paths and typed sibling flows over the published direct references."""

import array
from collections import deque
from functools import lru_cache
from itertools import islice
import gzip

ROOTS = [
    "riemannHypothesis",
    "riemannZeta_eq_zero_re",
    "LFunction_ne_zero_of_half_lt_re",
    "LFunction_eq_zero_re",
    "LFunction_eq_zero_re_of_isPrimitive",
]


def integers(data):
    value = shift = 0
    for octet in data:
        value |= (octet & 127) << shift
        if octet >= 128:
            shift += 7
        else:
            yield value
            value = shift = 0
    if shift:
        raise ValueError("Truncated adjacency shard")


def decode_csr(output):
    offsets = array.array("I", [0])
    packed = array.array("I")
    for path in sorted(output.glob("deps-*.bin.gz")):
        records = integers(gzip.decompress(path.read_bytes()))
        for count in records:
            target = 0
            for raw in islice(records, count):
                target += raw >> 2
                packed.append((target << 2) | (raw & 3))
            offsets.append(len(packed))
    return offsets, packed


def trace_tables(nodes, offsets, packed):
    roots = {name: i for i, (name, *_) in enumerate(nodes) if name in ROOTS}
    n = len(nodes)
    witness = array.array("I", [0]) * n
    distance = array.array("I", [0]) * n
    root_indices = [roots[name] for name in ROOTS]
    seen = bytearray(n)
    queue = deque(root_indices)
    for root in root_indices:
        seen[root] = 1
    while queue:
        parent = queue.popleft()
        for i in range(offsets[parent], offsets[parent + 1]):
            edge = packed[i]
            child = edge >> 2
            if not seen[child]:
                seen[child] = 1
                distance[child] = distance[parent] + 1
                witness[child] = ((parent + 1) << 2) | (edge & 3)
                queue.append(child)
    masks = bytearray(n)
    counts = []
    for bit, root in enumerate(root_indices):
        mask = 1 << bit
        masks[root] |= mask
        queue = deque([root])
        covered = 1
        while queue:
            node = queue.popleft()
            for i in range(offsets[node], offsets[node + 1]):
                child = packed[i] >> 2
                if not masks[child] & mask:
                    masks[child] |= mask
                    covered += 1
                    queue.append(child)
        counts.append(covered)
    return witness, masks, distance, counts, root_indices


def directory_flows(
    output,
    nodes,
    files,
    offsets,
    packed,
    bucket_count,
    stable_bucket,
    compact,
    write_blob,
):
    tree = {"src": 0}
    labels = ["src"]
    parent = [None]
    ancestry = []
    for file in files:
        chain = []
        prefix = "src"
        for segment in file.split("/")[1:]:
            prefix += "/" + segment
            branch = tree.get(prefix)
            if branch is None:
                branch = len(labels)
                tree[prefix] = branch
                labels.append(segment)
                parent.append(chain[-1] if chain else 0)
            chain.append(branch)
        ancestry.append(chain)

    # The child ids uniquely identify their parent directory. For a reference
    # crossing two source branches, record its flow at their lowest common parent.
    width = len(labels).bit_length()
    low_bits = (1 << width) - 1

    @lru_cache(maxsize=150000)
    def pair(source_file, target_file):
        for left, right in zip(ancestry[source_file], ancestry[target_file]):
            if left != right:
                return (left << width) | right
        return 0

    totals = {}
    file_ids = array.array("I", (row[2] for row in nodes))
    weighted = [0, 1, 1 << 32, (1 << 32) + 1]
    for node, f in enumerate(file_ids):
        for i in range(offsets[node], offsets[node + 1]):
            raw = packed[i]
            g = file_ids[raw >> 2]
            if f == g:
                continue
            key = pair(f, g)
            totals[key] = totals.get(key, 0) + weighted[raw & 3]
    pair.cache_clear()
    by_directory = {}
    for item, weight in totals.items():
        left, right = item >> width, item & low_bits
        if parent[left] != parent[right]:
            raise ValueError("Incoherent source hierarchy")
        by_directory.setdefault(parent[left], []).append(
            (left, right, weight & 0xFFFFFFFF, weight >> 32)
        )
    buckets = [{} for _ in range(bucket_count)]
    for path, dir_id in tree.items():
        if dir_id not in by_directory:
            continue
        flows = by_directory[dir_id]
        chosen = sorted(flows, key=lambda v: (-v[2] - v[3], v[0], v[1]))
        buckets[stable_bucket(path)][path] = [
            len(flows),
            [[labels[a], labels[b], t, v] for a, b, t, v in chosen],
        ]
    for i, bucket in enumerate(buckets):
        write_blob(output, f"flows-{i:02}.json.gz", compact(bucket))
    return len(totals)
