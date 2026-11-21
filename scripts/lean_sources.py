"""Pinned, digest-verified inputs shared by both declaration indexes."""
import hashlib
import shutil
import urllib.request
from pathlib import Path
from tempfile import NamedTemporaryFile


UPSTREAM = "https://github.com/james-shore/rh-proof-dependencies/releases/download/v0.2/"
INPUTS = {
    "decls.csv.gz": "af5daf53fdb72862666665eaf02a6f22b3307d5e0d175e3864d37a1ebcc9b4db",
    "decl_edges.csv.gz": "0e450a0120add04c917c574150a2898db6c07c87e1da9623d2eafe506ddc2025",
    "why-parents.csv.gz": "200328c49d1918bf67a95e98dc0873f033e207c4efcdb21a963c5a828a70a330",
}
SOURCE_COMMIT = "0fb9869c6e6d7b54b67de803af0e0be29d37fc22"
SOURCE_URL = "https://github.com/CocoSgt/riemann-hypothesis-lean/blob/" + SOURCE_COMMIT + "/"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verified_inputs(cache, required=None):
    cache.mkdir(parents=True, exist_ok=True)
    for name in required or INPUTS:
        expected = INPUTS[name]
        file = cache / name
        if file.exists():
            if digest(file) != expected:
                raise ValueError(f"Incorrect SHA-256 for {file}. Replace it from the v0.2 release.")
            continue
        with NamedTemporaryFile(dir=cache, prefix=name + ".", suffix=".download", delete=False) as output:
            temporary = Path(output.name)
        try:
            with urllib.request.urlopen(UPSTREAM + name, timeout=90) as response, temporary.open("wb") as output:
                shutil.copyfileobj(response, output)
            if digest(temporary) != expected:
                raise ValueError(f"Incorrect SHA-256 for downloaded {name}.")
            temporary.replace(file)
        finally:
            temporary.unlink(missing_ok=True)
