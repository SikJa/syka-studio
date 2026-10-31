import { describe, expect, it } from 'vitest';
import { parseMixkitPage } from '../src/host/mixkit';

const card = (id: number, title: string, author: string, duration: string, tags: string[]) => `
<div data-test-id="audio-player" data-controller="audio-player" data-audio-player-waveform-url-value="https://assets.mixkit.co/music/${id}/${id}-waveform.json" data-audio-player-preview-url-value="https://assets.mixkit.co/music/${id}/${id}.mp3" data-audio-player-item-id-value="${id}" data-audio-player-item-type-value="music">
</div>
<div class="item-grid-card__meta"> <h2 class="item-grid-card__title"> ${title} </h2> <p class="item-grid-music-preview__author"> by ${author} </p>
<div class="meta-links__links">${tags.map(tag => `<a class="meta-links__link" data-global--meta-links-target="link" href="/free-stock-music/tag/x/">${tag}</a>`).join(' ')}</div>
<div class="item-grid-music-preview__meta-time" data-test-id="duration"> ${duration} </div>
<button data-download--button-modal-url-value="/free-stock-music/download/${id}/?context=item+grid">Download</button></div>`;

describe('Mixkit catalogue pages', () => {
  it('reads every track card with its id, names, length and tags', () => {
    const tracks = parseMixkitPage(`<html>${card(175, 'Digital Clouds', 'Alejandro Magaña (A. M.)', '1:41', ['Chillout', 'Positive'])}${card(51, 'Sports &amp; Highlights', 'Ahjay Stelino', '1:36', ['Rock'])}</html>`);
    expect(tracks).toEqual([
      { id: 175, title: 'Digital Clouds', author: 'Alejandro Magaña (A. M.)', duration: '1:41', seconds: 101, tags: ['Chillout', 'Positive'], page: 'https://mixkit.co/free-stock-music/download/175/', preview: 'https://assets.mixkit.co/music/175/175.mp3' },
      { id: 51, title: 'Sports & Highlights', author: 'Ahjay Stelino', duration: '1:36', seconds: 96, tags: ['Rock'], page: 'https://mixkit.co/free-stock-music/download/51/', preview: 'https://assets.mixkit.co/music/51/51.mp3' },
    ]);
  });

  it('skips cards without a playable preview', () => {
    expect(parseMixkitPage('<div data-controller="audio-player" data-audio-player-item-id-value="9"></div>')).toEqual([]);
  });
});
