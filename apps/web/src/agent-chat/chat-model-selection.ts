import type { ChatSummary, ModelRef } from '@diffusionstudio/agent-chat';

export type ChatModelSelection = { ref: ModelRef; chosenAt: number };
/** A global draft preference must never override an existing chat. */
export function resolveChatModel(chat: ChatSummary, selected?: ChatModelSelection): ModelRef {
  if (selected?.ref && typeof selected.ref.model === 'string' && selected.ref.harness === chat.harness && Number.isFinite(selected.chosenAt) && selected.chosenAt >= chat.updatedAt) return selected.ref;
  if (chat.modelRef?.harness === chat.harness && chat.modelRef.model === chat.model) return chat.modelRef;
  return { harness: chat.harness, model: chat.model };
}
