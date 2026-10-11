import type { HarnessId } from '@diffusionstudio/agent-chat';
import { PROVIDER_LOGOS } from '@/agent-chat/provider-catalog';

/** Shared brand assets for connection cards, actions and model selection. */
export function AssistantMark(props: { provider: HarnessId; class?: string }) {
  return <span aria-hidden="true" class={'inline-flex shrink-0 items-center justify-center [&_svg]:size-full ' + (props.class ?? 'size-5')} innerHTML={PROVIDER_LOGOS[props.provider]} />;
}
