export const AGENT_ATTACHMENT_MAX_COUNT = 30;
export const AGENT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const AGENT_ATTACHMENT_MAX_BATCH_BYTES = 250 * 1024 * 1024;
export const AGENT_ATTACHMENT_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv,.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv";

const supportedExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "mp4", "mov", "webm", "mkv", "txt", "pdf", "doc", "docx", "xls", "xlsx", "csv"]);

export interface ExistingAgentAttachment {
  name: string;
  size: number;
}

export interface AgentAttachmentSelection {
  accepted: File[];
  notice: string | null;
}

export function selectAgentAttachments(
  files: readonly File[],
  existing: readonly ExistingAgentAttachment[],
): AgentAttachmentSelection {
  const accepted: File[] = [];
  const rejected = { duplicate: 0, unsupported: 0, oversized: 0, excess: 0 };
  const occupied = new Set(existing.map(fileKey));
  let remainingSlots = Math.max(0, AGENT_ATTACHMENT_MAX_COUNT - existing.length);
  let remainingBytes = Math.max(0, AGENT_ATTACHMENT_MAX_BATCH_BYTES - existing.reduce((total, file) => total + file.size, 0));

  for (const file of files) {
    if (!isSupportedAgentFile(file)) { rejected.unsupported += 1; continue; }
    if (file.size > AGENT_ATTACHMENT_MAX_BYTES) { rejected.oversized += 1; continue; }
    const key = fileKey(file);
    if (occupied.has(key)) { rejected.duplicate += 1; continue; }
    if (remainingSlots === 0 || file.size > remainingBytes) { rejected.excess += 1; continue; }
    occupied.add(key);
    accepted.push(file);
    remainingSlots -= 1;
    remainingBytes -= file.size;
  }

  const reasons: string[] = [];
  if (rejected.unsupported) reasons.push(`${rejected.unsupported} con formato no admitido`);
  if (rejected.oversized) reasons.push(`${rejected.oversized} de más de 25 MB`);
  if (rejected.duplicate) reasons.push(`${rejected.duplicate} duplicado${rejected.duplicate === 1 ? "" : "s"}`);
  if (rejected.excess) reasons.push(`${rejected.excess} fuera del máximo de ${AGENT_ATTACHMENT_MAX_COUNT} archivos o 250 MB por mensaje`);

  return {
    accepted,
    notice: reasons.length ? `No se prepararon: ${reasons.join(", ")}.` : null,
  };
}

export function isSupportedAgentFile(file: Pick<File, "name" | "type">): boolean {
  if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) return true;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return supportedExtensions.has(extension);
}

function fileKey(file: ExistingAgentAttachment): string {
  return `${file.name.toLowerCase()}::${file.size}`;
}
