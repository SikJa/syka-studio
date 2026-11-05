import type { SettingsPage } from '@/components/settings/state';
import type { WhatsNewMessageKey } from './whats-new-messages';

export type WhatsNewPageId = 'parakeet' | 'pc' | 'voice' | 'settings' | 'update';

export interface WhatsNewPage {
  id: WhatsNewPageId;
  /** The pair of hues the hero glides to. */
  hues: readonly [number, number];
  link?: { label: WhatsNewMessageKey; section: SettingsPage };
}

/**
 * The pages of Kevin's What's new card for this release: a glow with its pair
 * of hues and one drawing each. A release with new highlights changes these
 * pages and their texts.
 */
export const WHATS_NEW_PAGES: readonly WhatsNewPage[] = [
  { id: 'parakeet', hues: [150, 200], link: { label: 'parakeet.link', section: 'groq' } },
  { id: 'pc', hues: [28, 340], link: { label: 'pc.link', section: 'groq' } },
  { id: 'voice', hues: [212, 268], link: { label: 'voice.link', section: 'groq' } },
  { id: 'settings', hues: [262, 318] },
  { id: 'update', hues: [190, 230] },
];
