/** Public IPC data only. Credentials never belong in this contract. */
export type ZernioAccount = { id: string; platform: string; username: string; profileId: string | null; active: boolean; canPost: boolean | null; health: string | null };
export type ZernioConnection = {
  id: string; label: string; method: 'api_key' | 'oauth'; configured: boolean;
  pending: boolean; owner: { id: string; name: string } | null;
  accounts: ZernioAccount[]; checkedAt: string | null; error: string | null;
};
export type PublicationMedia = { path: string; name: string; size: number; sha256: string; mime: string; duration: number | null; width: number | null; height: number | null; videoCodec?: string | null };
export type PublicationTarget = { accountId: string; platform: 'youtube' | 'instagram'; username: string };
export type PublicationTiming = { mode: 'now' } | { mode: 'schedule'; atUtc: string; timezone: string };
export type PublicationResult = { platform: string; accountId: string; status: string; url: string | null; error: string | null };
export type PublicationDraft = {
  id: string; revision: number; connectionId: string | null; media: PublicationMedia;
  target: PublicationTarget | null; title: string; text: string;
  visibility: 'private' | 'unlisted' | 'public'; madeForKids: boolean; syntheticMedia: boolean;
  timing: PublicationTiming; phase: 'local_draft' | 'uploading' | 'submitting_unknown' | 'remote' | 'error';
  createdAt: string; updatedAt: string; externalPostId: string | null; providerStatus: string | null;
  results: PublicationResult[]; error: string | null; retryAfterAt: number | null;
  attempt: { key: string; startedAt: number; payload: Record<string, unknown> } | null;
  upload: { publicUrl: string; at: number } | null;
};
export type DraftChanges = Pick<PublicationDraft, 'connectionId' | 'target' | 'title' | 'text' | 'visibility' | 'madeForKids' | 'syntheticMedia' | 'timing'>;
export type PublicationOverview = { connections: ZernioConnection[]; drafts: PublicationDraft[]; secureStorage: boolean };
export type PublicationRequest =
  | { action: 'get' }
  | { action: 'add-key'; label: string; key: string }
  | { action: 'add-oauth'; label: string }
  | { action: 'sync' | 'disconnect' | 'cancel-oauth'; id: string }
  | { action: 'pick-export' }
  | { action: 'save-draft'; id: string; revision: number; changes: DraftChanges }
  | { action: 'delete-draft' | 'refresh-post' | 'cancel-upload'; id: string; revision: number }
  | { action: 'submit'; id: string; revision: number };
