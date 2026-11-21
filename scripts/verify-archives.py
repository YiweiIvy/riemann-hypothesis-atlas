"""Compare the original 14-part archive and the pinned CocoSgt source tree without extraction."""
import argparse
import hashlib
import json
import pathlib
import tarfile
import tempfile

EXPECTED = "9631b4f020199e580ba86178cb56c6e9b09f690c2369a80dc4334aa93f49c7fc"
MIRROR_COMMIT = "0fb9869c6e6d7b54b67de803af0e0be29d37fc22"


def source_digests(archive):
    sources = {}
    with tarfile.open(fileobj=archive, mode="r|gz") as tar:
        for entry in tar:
            if not entry.isfile():
                continue
            path = pathlib.PurePosixPath(entry.name)
            pieces = path.parts
            if "src" not in pieces or path.suffix != ".lean":
                continue
            relative = "/".join(pieces[pieces.index("src"):])
            if relative in sources:
                raise ValueError("Duplicate source path: " + relative)
            sources[relative] = hashlib.file_digest(tar.extractfile(entry), "sha256").hexdigest()
    if "src/Main.lean" not in sources:
        raise ValueError("Missing src/Main.lean")
    return sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("part_directory", type=pathlib.Path, help="Files part01 through part14")
    parser.add_argument("mirror_tar_gz", type=pathlib.Path)
    args = parser.parse_args()
    digest = hashlib.sha256()
    part_hashes = {}
    with tempfile.TemporaryFile() as archive:
        for i in range(1, 15):
            name = f"part{i:02d}"
            data = (args.part_directory / name).read_bytes()
            digest.update(data)
            part_hashes[name] = hashlib.sha256(data).hexdigest()
            archive.write(data)
        size = archive.tell()
        if digest.hexdigest() != EXPECTED:
            raise ValueError("Archive differs from Sutherland's published SHA-256")
        archive.seek(0)
        original = source_digests(archive)
    with args.mirror_tar_gz.open("rb") as archive:
        mirror = source_digests(archive)
    differences = sorted(k for k in original.keys() | mirror.keys() if original.get(k) != mirror.get(k))
    print(json.dumps(dict(archiveBytes=size, archiveSHA256=digest.hexdigest(), parts=part_hashes,
                          mirrorCommit=MIRROR_COMMIT, scope="src/**/*.lean",
                          originalFiles=len(original), mirrorFiles=len(mirror),
                          mainSHA256=original["src/Main.lean"], differences=differences), indent=2))
    return bool(differences)


if __name__ == "__main__":
    raise SystemExit(main())
