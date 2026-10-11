import { readFile, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateAnswers } from "./syka-brand-kit-store";
import {
  editingContext,
  nextQuestion,
  type Answers,
  type EditingContext,
  type AnswerKey,
  type OnboardingState,
  type BrandKit,
} from "./syka-onboarding-contract";

/** Host integration seam: the caller supplies an already authorized project directory.
 * Separate file means assigning a kit never resets project decisions. No model invocation. */
export class ProjectPreferences {
  private queue: Promise<unknown> = Promise.resolve();
  async read(dir: string): Promise<{ revision: number; answers: Answers }> {
    try {
      const value = JSON.parse(
        await readFile(join(dir, ".syka", "editing-preferences.json"), "utf8"),
      );
      if (!Number.isInteger(value.revision) || !value.answers)
        throw new Error();
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { revision: 0, answers: {} };
      throw new Error("No se pudo leer el contexto del proyecto.");
    }
  }
  save(dir: string, revision: number, answers: Answers) {
    const validated = validateAnswers(answers);
    const operation = this.queue.then(async () => {
      const current = await this.read(dir);
      if (current.revision !== revision)
        throw new Error("El contexto cambió; volvé a leerlo.");
      const root = join(dir, ".syka");
      await mkdir(root, { recursive: true });
      const path = join(root, "editing-preferences.json");
      const tmp = `${path}.${randomUUID()}.tmp`;
      const result = { revision: revision + 1, answers: validated };
      try {
        await writeFile(tmp, JSON.stringify(result, null, 2), { mode: 0o600 });
        await rename(tmp, path);
      } finally {
        await unlink(tmp).catch(() => {});
      }
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async context(
    dir: string,
    defaults: Answers,
    project: Omit<EditingContext, "answers">,
    relevant: AnswerKey[],
  ) {
    const stored = await this.read(dir);
    const input = { ...project, answers: stored.answers };
    return {
      ...editingContext(defaults, input),
      question: nextQuestion(defaults, input, relevant),
      revision: stored.revision,
    };
  }
  /** Ready for the agent's context builder; never invoked implicitly by this module. */
  async resolve(
    dir: string,
    defaults: OnboardingState,
    project: Omit<EditingContext, "answers" | "kit">,
    relevant: AnswerKey[],
  ) {
    const preferences = await this.read(dir);
    let kit: BrandKit | null =
      defaults.kits.find((k) => k.id === defaults.defaultKitId) ?? null;
    let resourceBase = "host:brand-kits/assets";
    const answers = { ...preferences.answers };
    try {
      const snapshot = JSON.parse(
        await readFile(join(dir, ".syka", "brand-kit", "context.json"), "utf8"),
      );
      if (snapshot.version !== 1 || !("kit" in snapshot)) throw new Error();
      kit = snapshot.kit;
      resourceBase = ".syka/brand-kit";
      if (!kit)
        answers.brandKit = { state: "skipped", updatedAt: snapshot.assignedAt };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("No se pudo leer el kit del proyecto.");
    }
    const decision = preferences.answers.brandKit;
    if (decision) {
      answers.brandKit = decision;
      if (decision.state === 'skipped' || decision.state === 'unknown') kit = null;
      else if (decision.state === 'accepted' && kit?.id !== decision.value) {
        kit = defaults.kits.find(k => k.id === decision.value) ?? null;
        resourceBase = 'host:brand-kits/assets';
        if (!kit) throw new Error('El kit elegido ya no está disponible; corregí la elección desde Configuración.');
      }
    }
    const input = { ...project, answers, kit };
    return {
      ...editingContext(defaults.answers, input),
      resourceBase,
      question: nextQuestion(defaults.answers, input, relevant),
      revision: preferences.revision,
    };
  }
}
