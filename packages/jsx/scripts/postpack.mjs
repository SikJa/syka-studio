import { renameSync } from "node:fs";

renameSync(
  new URL("../package.json.orig", import.meta.url),
  new URL("../package.json", import.meta.url),
);
