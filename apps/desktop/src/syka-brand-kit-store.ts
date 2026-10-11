import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  unlink,
  lstat,
} from "node:fs/promises";
import { join, extname, basename } from "node:path";
import {
  emptyOnboarding,
  type Answers,
  type BrandKit,
  type OnboardingState,
  type BrandAsset,
} from "./syka-onboarding-contract";

const MAX_ASSET = 5 * 1024 * 1024;
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
function id(value: string) {
  if (!idPattern.test(value)) throw new Error("ID inválido.");
  return value;
}
function text(value: unknown, limit = 2000): string {
  if (typeof value !== "string" || value.length > limit)
    throw new Error("Texto inválido o demasiado largo.");
  return value.trim();
}
export function validateAnswers(value: Answers): Answers {
  const result: Answers = {};
  for (const [key, answer] of Object.entries(value)) {
    if (
      ![
        "purpose",
        "destination",
        "brandKit",
        "reference",
        "referenceAspect",
      ].includes(key) ||
      !answer ||
      !["accepted", "proposed", "skipped", "unknown"].includes(answer.state)
    )
      throw new Error("Preferencia inválida.");
    const content = answer.value === undefined ? undefined : text(answer.value);
    if (answer.state === "accepted" && !content)
      throw new Error("Una respuesta aprobada necesita contenido.");
    result[key as keyof Answers] = {
      state: answer.state,
      value: content,
      updatedAt: new Date().toISOString(),
    };
  }
  return result;
}
export function validateKit(kit: BrandKit): BrandKit {
  const name = text(kit.name, 100);
  if (!name) throw new Error("Poné un nombre al kit.");
  const list = (values: string[], limit: number) => {
    if (!Array.isArray(values) || values.length > limit)
      throw new Error("Demasiados elementos.");
    return values.map((v) => text(v, 500)).filter(Boolean);
  };
  const colors = list(kit.colors, 20);
  if (colors.some((c) => !/^#[\da-f]{6}$/i.test(c)))
    throw new Error(
      "Usá colores hexadecimales de seis dígitos, por ejemplo #3488FF.",
    );
  const references = list(kit.references, 20);
  for (const value of references) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Referencia inválida.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(
        "Las referencias deben ser enlaces HTTPS sin credenciales.",
      );
  }
  return {
    id: id(kit.id),
    revision: kit.revision,
    name,
    colors,
    fonts: list(kit.fonts, 12),
    references,
    tone: text(kit.tone),
    notes: text(kit.notes, 8000),
    assets: [],
  };
}

/** Deliberately small inert SVG subset. No scripts, links, CSS, images, entities or foreign markup. */
export function validateAsset(name: string, data: Buffer): string {
  if (!data.length || data.length > MAX_ASSET)
    throw new Error("El recurso debe pesar entre 1 byte y 5 MB.");
  const ext = extname(name).toLowerCase();
  if (
    ext === ".png" &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    [".jpg", ".jpeg"].includes(ext) &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255
  )
    return "image/jpeg";
  if (
    ext === ".webp" &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (ext === ".svg") {
    const svg = data.toString("utf8");
    const safeTags = new Set([
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "defs",
      "linearGradient",
      "radialGradient",
      "stop",
      "clipPath",
      "title",
      "desc",
    ]);
    if (
      !/^\s*<svg[\s>]/.test(svg) ||
      /<!|<\?|&|\bon\w+\s*=|href\s*=|style\s*=|url\s*\(|javascript:|data:|https?:/i.test(
        svg.replace(/xmlns="http:\/\/www.w3.org\/2000\/svg"/g, ""),
      ) ||
      [...svg.matchAll(/<\/?([\w:-]+)/g)].some((m) => !safeTags.has(m[1]))
    )
      throw new Error(
        "SVG no compatible: exportalo sin enlaces, estilos ni contenido activo, o usá PNG.",
      );
    return "image/svg+xml";
  }
  throw new Error("Formato inválido. Usá PNG, JPEG, WebP o SVG estático.");
}

async function atomic(path: string, value: string | Buffer) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, value, { mode: 0o600 });
    await rename(tmp, path);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export class BrandKitStore {
  private queue: Promise<unknown> = Promise.resolve();
  readonly root: string;
  constructor(root: string) {
    this.root = root;
  }
  private get path() {
    return join(this.root, "onboarding.json");
  }
  async read(): Promise<OnboardingState> {
    try {
      const state = JSON.parse(
        await readFile(this.path, "utf8"),
      ) as OnboardingState;
      if (
        state.version !== 1 ||
        !Array.isArray(state.kits) ||
        !Number.isInteger(state.revision)
      )
        throw new Error();
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyOnboarding();
      throw new Error(
        "No se pudo leer la configuración. Se conservó el archivo original.",
      );
    }
  }
  async view(): Promise<OnboardingState> {
    const state = await this.read();
    for (const kit of state.kits)
      for (const asset of kit.assets) {
        try {
          const data = await this.assetBytes(asset);
          asset.preview = `data:${asset.mime};base64,${data.toString("base64")}`;
        } catch {
          asset.missing = true;
        }
      }
    return state;
  }
  private async assetBytes(asset: BrandAsset) {
    if (
      asset.file !== `${id(asset.id)}${extname(asset.file)}` ||
      !/^\.(png|jpg|jpeg|webp|svg)$/.test(extname(asset.file))
    )
      throw new Error("Recurso inválido.");
    const path = join(this.root, "assets", asset.file);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ASSET)
      throw new Error("Recurso inválido.");
    const bytes = await readFile(path);
    if (
      createHash("sha256").update(bytes).digest("hex") !== asset.sha256 ||
      validateAsset(asset.file, bytes) !== asset.mime
    )
      throw new Error("Recurso alterado.");
    return bytes;
  }
  mutate(
    revision: number,
    change: (state: OnboardingState) => Promise<void> | void,
  ): Promise<OnboardingState> {
    const operation = this.queue.then(async () => {
      const state = await this.read();
      if (revision !== state.revision)
        throw new Error(
          "La configuración cambió en otra ventana. Recargá antes de guardar.",
        );
      await change(state);
      state.revision++;
      await mkdir(this.root, { recursive: true });
      await atomic(this.path, JSON.stringify(state, null, 2));
      return this.view();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  save(revision: number, input: BrandKit, makeDefault: boolean) {
    const kit = validateKit(input);
    return this.mutate(revision, (state) => {
      const index = state.kits.findIndex((k) => k.id === kit.id);
      const old = state.kits[index];
      kit.assets = old?.assets ?? [];
      kit.revision = (old?.revision ?? 0) + 1;
      if (index < 0) {
        if (state.kits.length >= 30) throw new Error("Máximo 30 kits.");
        state.kits.push(kit);
      } else state.kits[index] = kit;
      if (makeDefault) state.defaultKitId = kit.id;
      else if (state.defaultKitId === kit.id) state.defaultKitId = null;
    });
  }
  import(revision: number, kitId: string, source: string) {
    return this.mutate(revision, async (state) => {
      const kit = state.kits.find((k) => k.id === kitId);
      if (!kit) throw new Error("Guardá el kit antes de importar.");
      if (kit.assets.length >= 12)
        throw new Error("Máximo 12 recursos por kit.");
      const info = await lstat(source);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ASSET)
        throw new Error("Archivo inválido o mayor a 5 MB.");
      if (
        state.kits
          .flatMap((k) => k.assets)
          .reduce((total, a) => total + a.bytes, 0) +
          info.size >
        50 * 1024 * 1024
      )
        throw new Error(
          "Los recursos de marca alcanzaron el límite total de 50 MB. Quitá los que no uses.",
        );
      const data = await readFile(source);
      const mime = validateAsset(source, data);
      const assetId = randomUUID();
      const file = assetId + extname(source).toLowerCase();
      await mkdir(join(this.root, "assets"), { recursive: true });
      await atomic(join(this.root, "assets", file), data);
      kit.assets.push({
        id: assetId,
        name: basename(source),
        file,
        mime,
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
        importedAt: new Date().toISOString(),
      });
      kit.revision++;
    });
  }
  async remove(revision: number, kitId: string, assetId?: string) {
    const files: string[] = [];
    const result = await this.mutate(revision, (state) => {
      const kit = state.kits.find((k) => k.id === kitId);
      if (!kit) throw new Error("Kit inexistente.");
      for (const asset of kit.assets)
        if (!assetId || asset.id === assetId)
          files.push(`${id(asset.id)}${extname(asset.file)}`);
      if (assetId) {
        kit.assets = kit.assets.filter((a) => a.id !== assetId);
        kit.revision++;
      } else {
        state.kits = state.kits.filter((k) => k.id !== kitId);
        if (state.defaultKitId === kitId) state.defaultKitId = null;
      }
    });
    // Project snapshots have their own bytes and are deliberately untouched.
    for (const file of files)
      await unlink(join(this.root, "assets", file)).catch(() => {});
    return result;
  }
  /** The project receives its own snapshot and bytes; subsequent global changes cannot alter it. */
  async assign(projectDir: string, kitId: string | null) {
    const state = await this.read();
    const kit = kitId === null ? null : state.kits.find((k) => k.id === kitId);
    if (kit === undefined) throw new Error("Kit inexistente.");
    const root = join(projectDir, ".syka", "brand-kit");
    await mkdir(root, { recursive: true });
    const snapshot = kit ? structuredClone(kit) : null;
    if (snapshot)
      for (const asset of snapshot.assets) {
        const bytes = await this.assetBytes(asset);
        await atomic(join(root, asset.file), bytes);
        delete asset.preview;
        delete asset.missing;
      }
    let answers: Answers = {};
    try {
      answers =
        JSON.parse(await readFile(join(root, "context.json"), "utf8"))
          .answers ?? {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error(
          "El contexto del proyecto no se pudo leer; no fue reemplazado.",
        );
    }
    await atomic(
      join(root, "context.json"),
      JSON.stringify(
        {
          version: 1,
          kit: snapshot,
          answers,
          assignedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
}
