// Isolated preview: no Electron, profile, MCP, provider or personal project access.
import { createServer } from "vite";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const qa = join(root, ".runtime", "onboarding-qa");
await mkdir(qa, { recursive: true });
const bundle = join(qa, "store.mjs");
await build({
  entryPoints: [join(root, "apps/desktop/src/syka-brand-kit-store.ts")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "esm",
});
const { BrandKitStore } = await import(pathToFileURL(bundle).href);
const stores = new Map();
for (const scenario of ["empty", "partial", "complete", "missing"]) {
  const store = new BrandKitStore(join(qa, scenario));
  stores.set(scenario, store);
  if (scenario !== "empty" && !(await store.read()).kits.length) {
    const kit = {
      id: `fixture-${scenario}`,
      revision: 0,
      name: "Estudio Norte · demo",
      colors: ["#3488FF", "#F3E8D5", "#181B22"],
      fonts: ["Inter", "Georgia"],
      references: ["https://example.com/reference"],
      tone: "Cercano, concreto y tranquilo",
      notes: "Evitar textos largos sobre el video.",
      assets: [],
    };
    await store.save(0, kit, true);
    if (scenario !== "partial") {
      const logo = join(qa, "fixture-logo.svg");
      await writeFile(
        logo,
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70"><path fill="#3488ff" d="M10 60V10h12l26 31V10h14v50H50L24 29v31z"/><circle fill="#F3E8D5" cx="102" cy="35" r="24"/></svg>',
      );
      await store.import(1, kit.id, logo);
      if (scenario === "missing")
        await store.mutate(2, (state) => {
          state.kits[0].assets[0].sha256 = "missing-fixture";
        });
    }
  }
}
const server = await createServer({
  root: join(root, "apps/web"),
  configFile: join(root, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5294, strictPort: true },
  plugins: [
    {
      name: "isolated-onboarding-host",
      configureServer(server) {
        server.middlewares.use("/onboarding-qa", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          try {
            if (
              req.method !== "POST" ||
              (req.headers.origin &&
                req.headers.origin !== "http://127.0.0.1:5294")
            )
              throw new Error("Solicitud no admitida.");
            const scenario = req.url?.slice(1);
            if (scenario === "error")
              throw new Error("Error de lectura simulado.");
            const store = stores.get(scenario);
            if (!store) throw new Error("Fixture inexistente.");
            let body = "";
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 100000)
                throw new Error("Solicitud demasiado grande.");
            }
            const request = JSON.parse(body);
            let state;
            if (request.action === "get") state = await store.view();
            else if (request.action === "save")
              state = await store.save(
                request.revision,
                request.kit,
                request.makeDefault,
              );
            else if (request.action === "project") {
              await store.assign(join(qa, "project"), request.id);
              state = await store.view();
            } else if (request.action === "import") {
              state = await store.import(
                request.revision,
                request.id,
                join(qa, "fixture-logo.svg"),
              );
            } else if (
              request.action === "delete" ||
              request.action === "remove-asset"
            )
              state = await store.remove(
                request.revision,
                request.id,
                request.action === "remove-asset" ? request.assetId : undefined,
              );
            else
              state = await store.mutate(request.revision, (state) => {
                if (request.action === "dismiss")
                  state.dismissed = request.dismissed;
                else if (request.action === "answers")
                  state.answers = request.answers;
                else throw new Error("Acción no admitida.");
              });
            res.end(
              JSON.stringify({
                state,
                projectName:
                  request.action === "project"
                    ? "Proyecto QA aislado"
                    : undefined,
              }),
            );
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Preview aislada: http://127.0.0.1:5294/onboarding-preview.html?case=empty",
);
