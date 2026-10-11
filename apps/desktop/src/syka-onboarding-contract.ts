/** Public data only. Provider credentials never belong in this contract. */
export type ConnectionState =
  "unconfigured" | "configured" | "verified" | "error" | "unknown";
export type ConnectionStatus = {
  state: ConnectionState;
  checkedAt?: string;
  detail?: string;
};
export type AnswerKey =
  "purpose" | "destination" | "brandKit" | "reference" | "referenceAspect";
export type Answer = {
  state: "accepted" | "proposed" | "skipped" | "unknown";
  value?: string;
  updatedAt: string;
};
export type Answers = Partial<Record<AnswerKey, Answer>>;
export type BrandAsset = {
  id: string;
  name: string;
  file: string;
  mime: string;
  bytes: number;
  sha256: string;
  importedAt: string;
  preview?: string;
  missing?: boolean;
};
export type BrandKit = {
  id: string;
  revision: number;
  name: string;
  colors: string[];
  fonts: string[];
  references: string[];
  tone: string;
  notes: string;
  assets: BrandAsset[];
};
export type OnboardingState = {
  version: 1;
  revision: number;
  dismissed: boolean;
  defaultKitId: string | null;
  kits: BrandKit[];
  answers: Answers;
};
export type BrandRequest =
  | { action: "get" }
  | { action: "save"; revision: number; kit: BrandKit; makeDefault: boolean }
  | { action: "delete"; revision: number; id: string }
  | { action: "import"; revision: number; id: string }
  | { action: "remove-asset"; revision: number; id: string; assetId: string }
  | { action: "dismiss"; revision: number; dismissed: boolean }
  | { action: "answers"; revision: number; answers: Answers }
  | { action: "project"; revision: number; id: string | null };
export type BrandResponse = {
  state: OnboardingState;
  projectName?: string;
  cancelled?: boolean;
};

export const emptyOnboarding = (): OnboardingState => ({
  version: 1,
  revision: 0,
  dismissed: false,
  defaultKitId: null,
  kits: [],
  answers: {},
});
export const newBrandKit = (): BrandKit => ({
  id: crypto.randomUUID(),
  revision: 0,
  name: "",
  colors: [],
  fonts: [],
  references: [],
  tone: "",
  notes: "",
  assets: [],
});

/** Adapter input is supplied by the publishing integration, never inferred from Codex MCP. */
export function publicationStatus(input?: {
  configured: boolean;
  verifiedAt?: string;
  error?: boolean;
}): ConnectionStatus {
  if (!input)
    return { state: "unknown", detail: "Integración de publicación pendiente" };
  if (input.error)
    return { state: "error", detail: "La conexión requiere revisión" };
  if (!input.configured) return { state: "unconfigured" };
  return input.verifiedAt
    ? { state: "verified", checkedAt: input.verifiedAt }
    : { state: "configured" };
}

export type EditingContext = {
  projectId: string;
  answers: Answers;
  kit?: BrandKit | null;
  format?: {
    destination?: string;
    revision: number;
    source: "manual" | "detected";
  };
  recipe?: { purpose?: string; reference?: string };
};

/** Project decisions (including a skip) shadow defaults. Proposals are not approved context. */
export function editingContext(defaults: Answers, project: EditingContext) {
  const answers = { ...defaults, ...project.answers };
  const accepted = Object.fromEntries(
    Object.entries(answers)
      .filter(([, a]) => a?.state === "accepted")
      .map(([k, a]) => [k, a!.value]),
  );
  if (project.format?.destination)
    accepted.destination = project.format.destination;
  if (project.kit) accepted.brandKit = project.kit.id;
  if (!answers.purpose && project.recipe?.purpose)
    accepted.purpose = project.recipe.purpose;
  if (!answers.reference && project.recipe?.reference)
    accepted.reference = project.recipe.reference;
  return {
    projectId: project.projectId,
    accepted,
    kit: project.kit ?? null,
    format: project.format,
    answers,
  };
}

/** Only the next operation's relevant unknowns; at most one question per turn. */
export function nextQuestion(
  defaults: Answers,
  project: EditingContext,
  relevant: AnswerKey[],
): AnswerKey | null {
  const context = editingContext(defaults, project);
  return (
    relevant.find(
      (key) =>
        !context.accepted[key] &&
        !["skipped", "unknown"].includes(context.answers[key]?.state ?? ""),
    ) ?? null
  );
}

export function referenceIntent(url: string, aspect: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:")
    throw new Error("La referencia debe usar HTTPS.");
  return {
    kind: "watch-reference" as const,
    url: parsed.href,
    aspect,
    transcript: "optional" as const,
    requiresUserRequest: true,
    upload: false,
    autoRun: false,
  };
}
