/** Offline intent matching. No embeddings, network calls or model tokens. */
const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const groups = [
  ['music','musica','musical','soundtrack','score','base','bed'],
  ['elegante','elegant','premium','luxury','lujo','delicado','refinado','minimal','ambient','suave','soft'],
  ['ambient','ambiente','atmosfera','atmospheric','calma','suave','soft','minimal'],
  ['warm','calido','calida','acustico','acoustic','organic','organico'],
  ['pulse','pulso','ritmico','ritmo','energetic','energia','electronico','tech'],
  ['glass','vidrio','cristal'], ['paper','papel','page','pagina'],
  ['metal','metalico','metallic'], ['wood','madera','wooden'],
  ['whoosh','barrido','swoosh','transicion','transition'],
  ['click','clic','pulsacion','press','tap'], ['impact','impacto','hit','golpe','land'],
  ['launch','lanzamiento','product','producto','promo'], ['logo','marca','brand'],
];
const stop = new Set(['para','con','una','uno','unos','las','los','del','que','hacer','video','the','and','for','with']);
const brandAliases: Record<string, string[]> = {
  anthropic: ['antropic'], claude: ['claude ai'], openai: ['open ai', 'chatgpt', 'chat gpt'],
  gemini: ['google gemini'], higgsfield: ['higgs field'], huggingface: ['hugging face'],
};
export function logoBrandKey(brand: string) {
  const key = normalize(brand).replace(/[^a-z0-9]/g, '');
  return key === 'hermesagent' ? 'hermes' : key === 'claudeai' ? 'claude' : key === 'googlegemini' ? 'gemini' : key;
}
export function logoScore(query: string, brand: string, searchable: string) {
  const key = logoBrandKey(brand), aliases = brandAliases[key] ?? [];
  const score = resourceScore(query, searchable + ' ' + aliases.join(' '));
  if (!score || !query.trim()) return score;
  const q = normalize(query).replace(/[^a-z0-9]/g, '');
  return score + (key === q || aliases.some(alias => logoBrandKey(alias) === q) ? 30 : key.startsWith(q) ? 10 : 0);
}
export function featuredLogoRank(brand: string) {
  const order = ['anthropic', 'claude', 'gemini', 'openai', 'higgsfield', 'deepseek', 'grok', 'cursor', 'opencode', 'hermes', 'huggingface'];
  const index = order.indexOf(logoBrandKey(brand));
  return index < 0 ? 0 : 100 - index;
}
export function resourceScore(query: string, searchable: string, audio = false): number {
  const q = normalize(query).trim(), haystack = normalize(searchable);
  if (!q) return 1;
  const compact = (value: string) => value.replace(/[\s_-]/g, '');
  if (haystack.includes(q) || compact(haystack).includes(compact(q))) return 12;
  const terms = [...new Set(q.match(/[\p{L}\p{N}]{2,}/gu) ?? [])].filter(term => !stop.has(term));
  if (!terms.length) return 0;
  // Generic music words cannot dominate a search for a specific mood/material.
  const specific = terms.filter(term => !groups[0].includes(term) && !(audio && ['quiero','busca','buscar','necesito','instrumental','fondo','sonido','sonidos','effect','audio','sin','voz','vocals'].includes(term)));
  const relevant = specific.length ? specific : terms;
  const scores = relevant.map(term => haystack.includes(term) ? 4 : groups.some(group => group.includes(term) && group.some(alias => haystack.includes(alias))) ? 2 : 0);
  if (!audio) return scores.every(score => score > 0) ? scores.reduce<number>((a, b) => a + b, 0) : 0;
  if (/\b(sin voz|no vocals|instrumental)\b/.test(q) && /\b(vocals|vocal|singing|cantado|canto|con voz)\b/.test(haystack)) return 0;
  const matched = scores.filter(score => score > 0);
  return matched.length ? matched.reduce<number>((a,b) => a+b,0) * (.5 + .5 * matched.length / relevant.length) : 0;
}

export function smallResponse<T extends { entries: unknown[]; nextOffset: number | null }>(result: T, maxChars = 6000, offset = 0) {
  // Count the actual serialized payload, with room for the budget metadata.
  while (JSON.stringify(result, null, 2).length > maxChars - 200 && result.entries.length > 1) {
    result.entries.pop(); result.nextOffset = offset + result.entries.length;
  }
  const response = { ...result, budget: { maxChars, characters: 0, tokenEstimate: 0, tokenEstimateIsApproximate: true } };
  for (let i = 0; i < 4; i++) {
    response.budget.characters = JSON.stringify(response, null, 2).length;
    response.budget.tokenEstimate = Math.ceil(response.budget.characters / 3);
  }
  if (response.budget.characters > maxChars) throw Error('Resource metadata exceeds the response budget. Use a narrower query or a larger maxChars (up to 12000).');
  return response;
}
