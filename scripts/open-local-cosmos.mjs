// The PR validator and command-line tools use the same versioned shards as the site.
import { readFile } from "node:fs/promises";
import { openCosmos } from "../site/cosmos-data.mjs";
export async function openLocalCosmos(
  directory = new URL("../site/data/cosmos/", import.meta.url),
) {
  const readBytes = async (filename) => {
    if (!/^[a-z0-9.-]+$/.test(filename))
      throw new Error("Invalid corpus filename");
    return new Uint8Array(await readFile(new URL(filename, directory)));
  };
  return openCosmos({ readBytes });
}
