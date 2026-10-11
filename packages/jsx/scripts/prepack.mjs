// npm ignores publishConfig field overrides, so the tarball's exports are
// rewritten here to point at dist; postpack.mjs restores the src exports
// that workspace consumers (Vite) rely on.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const pkgPath = new URL("../package.json", import.meta.url);
copyFileSync(pkgPath, new URL("../package.json.orig", import.meta.url));

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.exports = {
  ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
  "./jsx-runtime": { types: "./dist/jsx-runtime.d.ts", default: "./dist/jsx-runtime.js" },
  "./jsx-dev-runtime": { types: "./dist/jsx-runtime.d.ts", default: "./dist/jsx-runtime.js" },
};
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
