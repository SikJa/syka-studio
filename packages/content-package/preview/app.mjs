const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
let s, style, step = 0, view = 'style', selectedAccount, refKind = 'url', busy = false, styleDirty = false, downloadUrl;
let demo = localStorage.getItem('syka-content-demo') === 'true';
const targetDrafts = new Map();
const QUESTIONS = [
  { key: 'identity', label: 'Tu marca', title: 'Primero, contame quién está del otro lado.', detail: '¿Qué compartís, para quién lo hacés y qué querés que se lleven? Si ya tenés publicaciones que te representan, sumalas como referencia.', hints: ['Comparto lo que aprendo', 'Muestro mi trabajo', 'Creo contenido para una marca'] },
  { key: 'voice', label: 'Tu voz', title: '¿Cómo querés sonar cuando escribís?', detail: 'Como si me explicaras tu manera de hablar: cercano, seco, con humor, técnico… También sirve contarme qué frases o tonos no usarías nunca.', hints: ['Cercano y directo', 'Con humor, sin exagerar', 'Claro y profesional'] },
  { key: 'descriptions', label: 'Descripciones', title: 'Ahora sí: ¿cómo te gustan tus descripciones?', detail: '¿Un gancho corto, contexto del video, una historia? Contame cuánto escribir, si usás emojis, hashtags o un cierre. Pegá algún texto tuyo o de otra persona que te guste.', hints: ['Cortas, sin relleno', 'Con contexto y una pregunta', 'Sin emojis ni hashtags'] },
  { key: 'covers', label: 'Portadas', title: '¿Qué tendría que tener una portada para decir «esta es mía»?', detail: 'Mostrame ejemplos y señalá qué te gusta: foto, tipografía, colores, cantidad de texto, tu logo. También podés elegir no usar portadas.', hints: ['Mi cara y un título corto', 'Limpias, con mi marca', 'Prefiero no usar portada'] },
  { key: 'differences', label: 'Cada red', title: '¿Querés hablar igual en todas tus redes?', detail: 'Por ejemplo, más breve en TikTok y con más contexto en Instagram. Contame tus diferencias y guardamos la dirección para las próximas piezas.', hints: ['Misma voz, distinta extensión', 'TikTok más directo', 'Mantener el mismo estilo'] },
];
const notice = text => { $('notice').textContent = text; };
async function request(route, data) {
  const res = await fetch(route, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  const result = await res.json(); if (!res.ok) throw new Error(result.error); return result;
}
async function action(work) {
  if (busy) return; busy = true; document.body.setAttribute('aria-busy', 'true');
  try { await work(); } catch (error) { notice(error.message); } finally { busy = false; document.body.removeAttribute('aria-busy'); }
}
const accounts = () => s.accounts.accounts.filter(a => a.status === 'connected');
const platform = key => s.platforms[key] ?? { name: key, format: 'Video', descriptionLayout: 'detail' };
function logo(key) { const img = el('img'); if (s.platforms[key]) { img.src = `/logos/${key}.svg`; img.alt = platform(key).name; } else { const fallback = el('span', key.slice(0, 2).toUpperCase(), 'account-avatar'); return fallback; } return img; }
function setLogo(node, key) { node.hidden = !s.platforms[key]; if (!node.hidden) { node.src = `/logos/${key}.svg`; node.alt = platform(key).name; } }
function collectStyle() { if (!style) return; style.name = $('style-name').value; style.answers[QUESTIONS[step].key] = $('answer').value; }
function dirtyStyle() { styleDirty = true; style.status = 'draft'; $('saved-state').textContent = 'Estilo con cambios sin guardar'; $('download').hidden = true; }
async function persistStyle(ready = false) {
  collectStyle(); style.status = ready ? 'ready' : 'draft'; style = await request('/api/style', { style });
  styleDirty = false; localStorage.setItem('syka-content-style', style.id); await load(style.id);
}
async function load(styleId = style?.id) {
  s = await request(`/api/session?demo=${demo ? '1' : '0'}`);
  const wanted = styleId || localStorage.getItem('syka-content-style');
  style = structuredClone(styleDirty && style ? style : s.styles.find(p => p.id === wanted) ?? style ?? s.emptyStyle);
  $('style-select').replaceChildren();
  const option = el('option', 'Nuevo estilo'); option.value = ''; $('style-select').append(option);
  for (const profile of s.styles) { const o = el('option', profile.name || 'Estilo sin nombre'); o.value = profile.id; $('style-select').append(o); }
  $('style-select').value = s.styles.some(p => p.id === style.id) ? style.id : '';
  $('style-name').value = style.name;
  $('connected-count').textContent = `${accounts().length}${demo ? ' demo' : ''}`; $('target-count').textContent = accounts().length;
  $('demo-banner').hidden = !demo;
  $('saved-state').textContent = styleDirty ? 'Cambios sin guardar' : style.revision ? `${style.status === 'ready' ? 'Estilo guardado' : 'Estilo en preparación'} · v${style.revision}` : 'Todavía sin configurar';
  $('video-name').textContent = s.pkg.context.video.name; $('video-detail').textContent = `Export verificado · ${s.pkg.context.video.hash.slice(0, 10)}`;
  $('using-style').textContent = style.name || 'Elegí tu estilo';
  renderQuestion(); renderReferences(); renderContent(); show(view);
}
function show(nextView) {
  collectStyle(); view = nextView; $('style-view').hidden = view !== 'style'; $('content-view').hidden = view !== 'content';
  $('nav-style').classList.toggle('active', view === 'style'); $('nav-content').classList.toggle('active', view === 'content'); $('page-label').textContent = view === 'style' ? 'Tu estilo' : 'Para tus redes';
  if (view === 'content') renderContent();
}
function renderQuestion() {
  const q = QUESTIONS[step]; $('question').textContent = q.title; $('question-detail').textContent = q.detail;
  $('answer').value = style.answers[q.key] ?? ''; $('brand-label').hidden = step !== 0;
  $('step-position').textContent = `${step + 1} de ${QUESTIONS.length}`; $('back-step').hidden = step === 0;
  $('next-step').textContent = step === 4 ? 'Guardar mi estilo ✓' : 'Guardar y seguir →';
  $('steps').replaceChildren(...QUESTIONS.map((q, index) => {
    const b = el('button'); b.append(el('span', style.answers[q.key]?.trim() ? '✓' : String(index + 1).padStart(2, '0'), 'step-index'), el('span', q.label));
    if (step === index) b.setAttribute('aria-current', 'step'); b.onclick = () => { collectStyle(); step = index; renderQuestion(); }; return b;
  }));
  $('suggestions').replaceChildren(...q.hints.map(hint => { const b = el('button', hint); b.onclick = () => { $('answer').value += ($('answer').value ? '\n' : '') + hint; dirtyStyle(); }; return b; }));
  $('platform-preferences').hidden = step !== 4; $('platform-prefs-list').replaceChildren();
  const platforms = [...new Set(accounts().map(a => a.platform))];
  if (!platforms.length) $('platform-prefs-list').append(el('p', 'Todavía no hay redes compartidas por Publicación. Tu dirección general se guarda igual.', 'hint'));
  for (const key of platforms) {
    const prefs = style.platformPreferences[key] ?? { layout: platform(key).descriptionLayout, notes: '' };
    const row = el('div', undefined, 'platform-preference'), identity = el('div', undefined, 'identity'); identity.append(logo(key), el('strong', platform(key).name));
    const selectLabel = el('label', `Extensión para ${platform(key).name}`), select = el('select'); select.setAttribute('aria-label', `Extensión para ${platform(key).name}`);
    for (const [value, name] of [['direct', 'Directa · sólo lo esencial'], ['story', 'Con contexto · gancho y descripción'], ['detail', 'Detallada · título, contexto y formato']]) { const o = el('option', name); o.value = value; select.append(o); }
    select.value = prefs.layout;
    const notes = el('textarea'); notes.rows = 2; notes.placeholder = `Algo que quieras hacer distinto en ${platform(key).name}…`; notes.setAttribute('aria-label', `Indicaciones para ${platform(key).name}`); notes.value = prefs.notes;
    const changed = () => { style.platformPreferences[key] = { layout: select.value, notes: notes.value }; dirtyStyle(); };
    select.onchange = changed; notes.oninput = changed; selectLabel.append(select); row.append(identity, selectLabel, notes); $('platform-prefs-list').append(row);
  }
}
function renderReferences() {
  $('reference-count').textContent = style.references.length; $('references').replaceChildren();
  if (!style.references.length) { const empty = el('div', undefined, 'empty-board'); empty.append(el('span', '↗', 'empty-icon'), el('p', 'Un link. Una captura. Un texto.\nEmpezá por algo que te represente.')); $('references').append(empty); }
  for (const ref of style.references) {
    const card = el('div', undefined, 'reference-card');
    if (ref.kind === 'image') { const img = el('img'); img.src = `/references/${ref.file}`; img.alt = ref.label; card.append(img); }
    const body = el('div', undefined, 'reference-body');
    body.append(el('span', `${ref.origin === 'own' ? 'PROPIO' : 'INSPIRACIÓN'} · ${{ cover: 'PORTADAS', description: 'DESCRIPCIONES', both: 'ESTILO', logo: 'MARCA' }[ref.purpose]}`, 'ref-kind'), el('strong', ref.label));
    if (ref.kind === 'url') { const a = el('a', new URL(ref.url).hostname); a.href = ref.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; body.append(a); }
    if (ref.kind === 'text') body.append(el('p', ref.content.slice(0, 180)));
    body.append(el('p', ref.note));
    const remove = el('button', 'Quitar referencia', 'quiet'); remove.onclick = () => action(async () => { collectStyle(); style.references = style.references.filter(r => r.id !== ref.id); await persistStyle(); notice('Referencia quitada de esta revisión. Las anteriores se conservan.'); }); body.append(remove); card.append(body); $('references').append(card);
  }
}
function currentTargets() { return s.pkg.social?.styleId === style.id && s.pkg.social?.source === s.accounts.source ? s.pkg.social.targets : []; }
function renderContent() {
  const connected = accounts(), targets = currentTargets();
  $('no-accounts').hidden = connected.length > 0; $('destinations').hidden = !connected.length;
  $('prepare-social').disabled = !connected.length || style.status !== 'ready' || styleDirty;
  if (!selectedAccount || !connected.some(a => a.id === selectedAccount)) selectedAccount = connected[0]?.id;
  $('account-tabs').replaceChildren(...connected.map(account => {
    const target = targets.find(t => t.account.id === account.id), b = el('button'); b.dataset.account = account.id;
    const identity = el('span', platform(account.platform).name); identity.append(el('small', account.label)); b.append(logo(account.platform), identity, el('span', target?.state === 'reviewed' ? '✓' : '•', 'tab-state'));
    if (selectedAccount === account.id) b.setAttribute('aria-current', 'page'); b.onclick = () => { selectedAccount = account.id; renderContent(); }; return b;
  }));
  const target = targets.find(t => t.account.id === selectedAccount);
  $('needs-preparation').hidden = !!target; $('delivery').hidden = !target; $('delivery-footer').hidden = !targets.length || !connected.length;
  if (!target) return;
  const draft = targetDrafts.get(selectedAccount) ?? target;
  $('network-name').textContent = platform(target.account.platform).name; $('account-name').textContent = target.account.label;
  setLogo($('editor-logo'), target.account.platform); setLogo($('preview-logo'), target.account.platform);
  $('target-state').textContent = !s.socialCurrent || styleDirty ? 'Estilo o cuentas cambiaron' : targetDrafts.has(selectedAccount) ? 'Sin guardar' : target.state === 'reviewed' ? 'Revisado' : 'Borrador';
  $('target-title').value = draft.title; $('target-description').value = draft.description;
  $('target-cover-enabled').checked = !!draft.cover; $('target-cover-title').value = draft.cover?.title ?? ''; $('target-cover-subtitle').value = draft.cover?.subtitle ?? '';
  $('preview-account').textContent = target.account.label; $('preview-platform').textContent = platform(target.account.platform).name;
  $('preview-kind').textContent = platform(target.account.platform).format; $('post').className = `post ${target.account.platform}`;
  $('post-image').src = target.cover ? `/api/social-cover?account=${encodeURIComponent(target.account.id)}&r=${s.pkg.revision}` : '/api/frame';
  $('save-target').disabled = $('review-target').disabled = !s.socialCurrent || styleDirty;
  const reviewed = targets.filter(t => t.state === 'reviewed' && !targetDrafts.has(t.account.id)).length;
  $('review-progress').textContent = `${reviewed} de ${targets.length} versiones revisadas`;
  $('handoff').disabled = reviewed !== targets.length || !s.socialCurrent || styleDirty || targetDrafts.size > 0;
  previewText();
}
function previewText() { $('post-title').textContent = $('target-title').value; $('post-description').textContent = $('target-description').value; $('description-count').textContent = `${$('target-description').value.length} caracteres`; }
function targetPayload() { return { title: $('target-title').value, description: $('target-description').value, cover: $('target-cover-enabled').checked ? { title: $('target-cover-title').value, subtitle: $('target-cover-subtitle').value } : null }; }
function targetChanged() { targetDrafts.set(selectedAccount, targetPayload()); $('target-state').textContent = 'Sin guardar'; $('handoff').disabled = true; $('download').hidden = true; previewText(); }
const socialPayload = () => ({ revision: s.pkg.revision, styleId: style.id, demo });
async function saveTarget(review = false) {
  await request(`/api/social/${review ? 'review' : 'save'}`, { ...socialPayload(), accountId: selectedAccount, ...targetPayload() });
  targetDrafts.delete(selectedAccount); await load(); notice(review ? 'Versión revisada. Las otras redes conservan sus propios textos.' : 'Borrador de esta cuenta guardado.');
}
function chooseRef(kind) {
  refKind = kind; $('ref-url-label').hidden = kind !== 'url'; $('ref-file-label').hidden = kind !== 'image'; $('ref-text-label').hidden = kind !== 'text';
  $('ref-url').required = kind === 'url'; $('ref-file').required = kind === 'image'; $('ref-text').required = kind === 'text';
  document.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('active', b.dataset.kind === kind));
}
function openReference() { $('reference-form').reset(); $('ref-error').textContent = ''; chooseRef('url'); $('reference-dialog').showModal(); }
$('add-reference').onclick = $('attach-from-chat').onclick = openReference;
$('close-reference').onclick = () => $('reference-dialog').close();
document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => chooseRef(b.dataset.kind));
$('reference-form').onsubmit = async event => {
  event.preventDefault(); if (busy) return; busy = true;
  const referencesBefore = structuredClone(style.references);
  try {
    const ref = { id: crypto.randomUUID(), kind: refKind, label: $('ref-label').value, purpose: $('ref-purpose').value, origin: $('ref-origin').value, note: $('ref-note').value };
    if (refKind === 'url') ref.url = $('ref-url').value;
    if (refKind === 'text') ref.content = $('ref-text').value;
    if (refKind === 'image') {
      const file = $('ref-file').files[0]; if (!file || file.size > 5000000) throw new Error('Elegí un PNG o JPG de hasta 5 MB');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      ref.file = (await request('/api/reference', { mime: file.type, base64: dataUrl.split(',')[1] })).file;
    }
    collectStyle(); style.references.push(ref); await persistStyle(); $('reference-dialog').close(); notice('Referencia guardada con lo que te gusta de ella.');
  } catch (error) { style.references = referencesBefore; $('ref-error').textContent = error.message; } finally { busy = false; }
};
$('answer').oninput = $('style-name').oninput = dirtyStyle;
$('next-step').onclick = () => action(async () => { const finished = step === 4; await persistStyle(finished); if (finished) { show('content'); notice('Tu estilo quedó guardado. Ya podés preparar versiones para tus redes.'); } else { step++; renderQuestion(); notice(''); } });
$('back-step').onclick = () => { collectStyle(); step = Math.max(0, step - 1); renderQuestion(); };
$('nav-style').onclick = $('edit-style').onclick = () => show('style');
$('nav-content').onclick = $('account-info').onclick = () => show('content');
$('style-select').onchange = () => action(async () => { if (styleDirty || targetDrafts.size) { notice('Guardá tus cambios antes de cambiar de estilo.'); $('style-select').value = style.id; return; } const found = s.styles.find(p => p.id === $('style-select').value); style = structuredClone(found ?? { ...s.emptyStyle, id: crypto.randomUUID() }); localStorage.setItem('syka-content-style', style.id); step = 0; targetDrafts.clear(); await load(style.id); show('style'); });
$('new-style').onclick = () => action(async () => { if (styleDirty || targetDrafts.size) { notice('Guardá tus cambios antes de crear otro estilo.'); return; } style = { ...structuredClone(s.emptyStyle), id: crypto.randomUUID() }; step = 0; targetDrafts.clear(); await load(style.id); show('style'); });
$('demo-accounts').onclick = () => action(async () => { collectStyle(); demo = true; localStorage.setItem('syka-content-demo', 'true'); await load(); show('content'); notice('Ejemplo activado. No se conectaron cuentas reales.'); });
$('exit-demo').onclick = () => action(async () => { if (targetDrafts.size) throw new Error('Guardá o descartá los cambios antes de salir del ejemplo'); demo = false; localStorage.removeItem('syka-content-demo'); await load(); notice('Vista de cuentas reales. La integración con Publicación está pendiente.'); });
$('prepare-social').onclick = () => action(async () => { if (targetDrafts.size) throw new Error('Guardá o descartá los cambios antes de preparar nuevas versiones'); await request('/api/social/prepare', socialPayload()); await load(); notice('Borradores por cuenta preparados desde el brief. La voz y las referencias quedan guardadas para el adaptador de IA; esta preview usa composición local.'); });
for (const id of ['target-title', 'target-description', 'target-cover-enabled', 'target-cover-title', 'target-cover-subtitle']) $(id).oninput = targetChanged;
$('save-target').onclick = () => action(() => saveTarget()); $('review-target').onclick = () => action(() => saveTarget(true));
$('discard-target').onclick = () => { targetDrafts.delete(selectedAccount); renderContent(); notice('Cambios de esta cuenta descartados.'); };
$('copy-text').onclick = () => action(async () => { await navigator.clipboard.writeText($('target-description').value); notice('Descripción copiada.'); });
$('handoff').onclick = () => action(async () => { const draft = await request('/api/social/draft', socialPayload()); if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })); $('download').href = downloadUrl; $('download').download = `syka-redes-r${s.pkg.revision}.json`; $('download').hidden = false; notice('Paquete local preparado con una versión por cuenta. No se publicó ni programó contenido.'); });
window.addEventListener('beforeunload', event => { if (styleDirty || targetDrafts.size) { event.preventDefault(); event.returnValue = ''; } });
action(() => load());
