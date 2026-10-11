/** Integration boundary only. Host paths are not persisted in portable package JSON. */
export interface ContentInput {
  projectId: string;
  videoPath: string;
  videoRevision: string;
  /** Set by the editor after successful export verification, never by provider output. */
  exportVerified: true;
  expectedVideoHash?: string;
  brief: { subject: string; objective: string; format?: string; provenance?: string; recipeRevision?: string };
  materials?: { kind: 'frame' | 'logo' | 'transcript' | 'resource'; path: string; source: string; atSeconds?: number }[];
}
export interface CopyVariant { title: string; description: string; summary: string }
export interface TextCapabilityAdapter {
  id: string;
  capability: 'text';
  status: 'configured';
  /** Source fields are untrusted data. No automatic tools, external uploads or fallback billing. */
  generate(request: { policy: string; data: unknown; signal?: AbortSignal }): Promise<{ variants: CopyVariant[]; model?: string }>;
}
export interface ImageCapability {
  id: string;
  status: 'configured' | 'available' | 'unknown' | 'unsupported' | 'needs-configuration';
  imageGeneration: boolean;
}
export interface CoverRecipe {
  mode: 'frame-composition'; title: string; subtitle: string; frameHash: string; logoHash?: string;
}
export interface PublicationDraft {
  schemaVersion: 1; kind: 'publication-draft'; packageId: string; packageRevision: number;
  video: { hash: string; revision: string; name: string; verified: true };
  copy: CopyVariant; cover: CoverRecipe | null; contextFingerprint: string; reviewedAt: string;
}
/** Read-only input from Publication. Never accept a provider's claim of connected accounts. */
export interface AccountSnapshot {
  source: 'publication' | 'demo';
  accounts: { id: string; platform: string; label: string; status: 'connected' | 'disconnected' }[];
}
export interface StyleReference {
  id: string; kind: 'url' | 'text' | 'image'; label: string;
  purpose: 'cover' | 'description' | 'both' | 'logo'; origin: 'own' | 'inspiration'; note: string;
  url?: string; content?: string; file?: string;
}
export interface ContentStyle {
  id: string; revision: number; name: string; status: 'draft' | 'ready';
  answers: { identity: string; voice: string; descriptions: string; covers: string; differences: string };
  references: StyleReference[];
  platformPreferences: Record<string, { layout: 'direct' | 'story' | 'detail'; notes: string }>;
}
/** v2 handoff has a reviewed entry for EVERY active account, not one generic caption. */
export interface MultiPlatformDraft {
  schemaVersion: 2; kind: 'publication-draft'; demo: boolean;
  packageId: string; packageRevision: number; contextFingerprint: string; styleFingerprint: string;
  video: PublicationDraft['video'];
  targets: { account: { id: string; platform: string; label: string }; title: string; description: string; cover: CoverRecipe | null }[];
}
export interface SocialTextAdapter {
  id: string; status: 'configured'; capability: 'text';
  generate(request: { policy: string; data: { context: unknown; style: ContentStyle; accounts: Array<Pick<AccountSnapshot['accounts'][number], 'id' | 'platform' | 'label'>> }; signal?: AbortSignal }): Promise<{
    targets: { accountId: string; title: string; description: string }[];
  }>;
}
