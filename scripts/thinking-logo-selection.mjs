/** Explicit selection: 70 approved candidates + 40 additions. A mark is not a capability claim. */
const groups = {
  'Agentes e IA': `syka|Syka Studio|@syka|a6b4c2
agent-reach|Agent Reach|@agent-reach|399cff
openai|ChatGPT / OpenAI|OpenAI|85bca8|openai,chatgpt|chatgpt.com,openai.com
codex|Codex|Codex|c7c7c7|codex
claude|Claude / Claude Code|Claude AI|d97757|claude,claude_code|claude.ai,anthropic.com
gemini|Gemini|Gemini|718aff|gemini|gemini.google.com
antigravity|Antigravity|Google Antigravity|7ea8fa|antigravity|antigravity.google
grok|Grok|Grok|c2c2c2|grok|grok.com,x.ai
cursor|Cursor|Cursor|c2c2c2|cursor|cursor.com
hermes|Hermes|Hermesagent|d6a975|hermes
opencode|OpenCode|OpenCode|c2c2c2|opencode|opencode.ai
hugging-face|Hugging Face|Hugging Face|ffca59|hugging_face,huggingface|huggingface.co
openrouter|OpenRouter|OpenRouter|aaa4ea|openrouter|openrouter.ai
ollama|Ollama|Ollama|c2c2c2|ollama|ollama.com
deepseek|DeepSeek|DeepSeek|688cf5|deepseek|deepseek.com
qwen|Qwen|Qwen|9a87ec|qwen|qwen.ai
mistral|Mistral|Mistral AI|f79b39|mistral|mistral.ai
perplexity|Perplexity|Perplexity AI|56b8c1|perplexity|perplexity.ai
github-copilot|GitHub Copilot|GitHub Copilot|c2c2c2|github_copilot,copilot`,
  'Redes y publicación': `youtube|YouTube|YouTube|ff4545|youtube|youtube.com,youtu.be
x|X|X (formerly Twitter)|c2c2c2|twitter,x_twitter|x.com,twitter.com
instagram|Instagram|Instagram|eb698e|instagram|instagram.com
whatsapp|WhatsApp|WhatsApp|52ca79|whatsapp|whatsapp.com,wa.me
linkedin|LinkedIn|LinkedIn|559de2|linkedin|linkedin.com
discord|Discord|Discord|8590ff|discord|discord.com,discord.gg
zernio|Zernio|@zernio|bba7f8|zernio|zernio.com
tiktok|TikTok|TikTok|69d4da|tiktok|tiktok.com
facebook|Facebook|Facebook|5794ff|facebook|facebook.com,fb.com
reddit|Reddit|Reddit|ff783f|reddit|reddit.com
telegram|Telegram|Telegram|60b5e6|telegram|telegram.org,t.me
twitch|Twitch|Twitch|b084ff|twitch|twitch.tv`,
  'Google y documentos': `google|Google Search|Google|6d9eed|google_search|google.com
gmail|Gmail|Gmail|ea736c|gmail|mail.google.com
google-drive|Google Drive|Google Drive|60bd84|google_drive,gdrive|drive.google.com
google-docs|Google Docs|@google-docs|6098f0|google_docs,gdocs
google-sheets|Google Sheets|Google Sheets|59bf87|google_sheets,gsheets
google-slides|Google Slides|Google Slides|ecc15e|google_slides,gslides
google-calendar|Google Calendar|Google Calendar|75a3f1|google_calendar,gcal|calendar.google.com
google-meet|Google Meet|Google Meet|62be98|google_meet|meet.google.com
notion|Notion|Notion|c2c2c2|notion|notion.so,notion.com
slack|Slack|Slack|cc8dbe|slack|slack.com
word|Microsoft Word|Microsoft Word|77a1e7|microsoft_word,word,docx
excel|Microsoft Excel|Microsoft Excel|70bb92|microsoft_excel,excel,xlsx
powerpoint|Microsoft PowerPoint|Microsoft PowerPoint|dc947b|microsoft_powerpoint,powerpoint,pptx`,
  'Desarrollo y servicios': `github|GitHub|GitHub|c2c2c2|github|github.com
supabase|Supabase|Supabase|69dba4|supabase|supabase.com
cloudflare|Cloudflare|Cloudflare|f4aa57|cloudflare|cloudflare.com
vercel|Vercel|Vercel|c2c2c2|vercel|vercel.com
playwright|Playwright|Playwright|81c978|playwright
powershell|PowerShell|PowerShell|78a4e7|powershell,pwsh
graphify|Graphify|@graphify|baa0ea|graphify,syka_code_graph
exa|Exa|Exa|889ef1|exa
jina|Jina|Jina|8fbdda|jina|jina.ai
firecrawl|Firecrawl|Firecrawl|ed9862|firecrawl|firecrawl.dev`,
  'Imagen, video y audio': `canva|Canva|Canva|69c5d8|canva|canva.com
higgsfield|Higgsfield|@higgsfield|b7cc85|higgsfield|higgsfield.ai
blender|Blender|Blender|f1a65b|blender
remotion|Remotion|Remotion|77a5ed|remotion
hyperframes|HyperFrames|@hyperframes|c2c2c2|hyperframes
elevenlabs|ElevenLabs|Elevenlabs|c2c2c2|elevenlabs,eleven_labs|elevenlabs.io
obs|OBS Studio|OBS|c2c2c2|obs,obs_studio
figma|Figma|Figma|ae97ee|figma|figma.com
ffmpeg|FFmpeg|@ffmpeg|81c974|ffmpeg,ffprobe
suno|Suno|Suno|e9a582|suno|suno.com
runway|Runway|Runway|c2c2c2|runway|runwayml.com
spotify|Spotify|Spotify|6ccb87|spotify|spotify.com`,
  'Sistemas y navegación': `apple|Apple|Apple|c2c2c2|apple|apple.com
windows|Windows|Windows|77b6ee|windows
chrome|Chrome|Chrome|e2b667|chrome,chromium
edge|Edge|Edge|76b8d2|edge,microsoft_edge`,
  'Ampliación · desarrollo': `git|Git|Git|f09779|git
docker|Docker|Docker|7aaae5|docker
nodejs|Node.js|Node.js|8fc67a|node,nodejs
python|Python|Python|dbc071|python,python3
typescript|TypeScript|TypeScript|7ca5df|typescript,tsc
react|React|React|8bd5e8|react
nextjs|Next.js|Next.js|c2c2c2|nextjs,next_js
vscode|Visual Studio Code|Visual Studio Code|79b9e9|vscode,visual_studio_code
npm|npm|NPM|d48a8a|npm
pnpm|pnpm|Pnpm|e6bd61|pnpm
bun|Bun|Bun|e0cab6|bun`,
  'Ampliación · infraestructura': `postgresql|PostgreSQL|PostgreSQL|80a7d0|postgresql,postgres
sqlite|SQLite|SQLite|8dbad4|sqlite,sqlite3
redis|Redis|Redis|db8d88|redis
mongodb|MongoDB|MongoDB|91bd77|mongodb
firebase|Firebase|Firebase|edbd65|firebase
railway|Railway|Railway|bdade0|railway|railway.com,railway.app
render|Render|Render|b4afd4|render_com|render.com
aws|Amazon Web Services|Amazon Web Services|e6b474|aws,amazon_web_services|aws.amazon.com
google-cloud|Google Cloud|Google Cloud|86ace3|google_cloud,gcloud|cloud.google.com
azure|Microsoft Azure|Microsoft Azure|80b9df|microsoft_azure,azure|azure.microsoft.com
netlify|Netlify|Netlify|87ccc5|netlify|netlify.com
n8n|n8n|n8n|d995af|n8n|n8n.io`,
  'Ampliación · trabajo': `outlook|Microsoft Outlook|Microsoft Outlook|79afe5|microsoft_outlook,outlook|outlook.com,outlook.live.com,outlook.office.com
onedrive|OneDrive|Microsoft OneDrive|7cafe2|microsoft_onedrive,onedrive|onedrive.live.com
teams|Microsoft Teams|Microsoft Teams|a8a1dc|microsoft_teams|teams.microsoft.com
zoom|Zoom|Zoom|80a6e9|zoom|zoom.us
dropbox|Dropbox|Dropbox|7fa5ec|dropbox|dropbox.com
linear|Linear|Linear|a3a4e4|linear|linear.app
trello|Trello|Trello|7ba4de|trello|trello.com
obsidian|Obsidian|Obsidian|b09ae0|obsidian|obsidian.md`,
  'Ampliación · creación': `adobe|Adobe|Adobe|e59a91|adobe|adobe.com
photoshop|Photoshop|Photoshop|7cb7ed|photoshop
illustrator|Illustrator|Illustrator|edb56b|illustrator
after-effects|After Effects|After Effects|b6a2ec|after_effects,aftereffects
premiere|Premiere Pro|Premiere|b5a2eb|premiere
capcut|CapCut|Capcut|c2c2c2|capcut|capcut.com
kling|Kling|Kling|abcc86|kling|klingai.com
sora|Sora|Sora|a2b8de|sora|sora.com
replicate|Replicate|Replicate|c2c2c2|replicate|replicate.com`,
};

export const selection = Object.entries(groups).flatMap(([category, rows]) => rows.split('\n').map(row => {
  const [id, name, brand, tint, aliasText = id, domainText = ''] = row.split('|');
  return { id, name, brand, tint: `#${tint}`, category, added: category.startsWith('Ampliación'), aliases: aliasText.split(','), domains: domainText.split(',').filter(Boolean) };
}));
if (selection.length !== 110 || new Set(selection.map(x => x.id)).size !== 110) throw new Error('Expected 110 distinct selected marks');

export const customSources = {
  syka: { path: 'apps/web/src/assets/icons/syka-logo.svg', source: 'Syka Studio', kind: 'project' },
  zernio: { path: 'apps/web/src/assets/providers/zernio.svg', source: 'Syka Studio provider assets', kind: 'brand' },
  'agent-reach': { path: 'docs/resources/thinking-logos/sources/agent-reach.svg', source: 'https://github.com/Panniantong/Agent-Reach/blob/main/docs/assets/logo-1.svg', kind: 'brand', crop: true },
  hyperframes: { path: 'docs/resources/thinking-logos/sources/hyperframes.svg', source: 'https://github.com/heygen-com/hyperframes/blob/main/docs/logo/symbol-dark.svg', kind: 'brand' },
  higgsfield: { path: 'docs/resources/thinking-logos/sources/higgsfield.svg', source: 'https://higgsfield.ai/', kind: 'brand' },
  'google-docs': { path: 'docs/resources/thinking-logos/sources/google-docs.svg', source: 'https://github.com/simple-icons/simple-icons/blob/develop/icons/googledocs.svg', kind: 'brand' },
  ffmpeg: { path: 'docs/resources/thinking-logos/sources/ffmpeg.svg', source: 'https://github.com/simple-icons/simple-icons/blob/develop/icons/ffmpeg.svg', kind: 'brand' },
  graphify: { path: 'docs/resources/thinking-logos/sources/graphify.svg', source: 'Syka: functional graph symbol, not an official Graphify logo', kind: 'functional' },
};

/** Symbol variants and silhouette treatments selected after comparing all 110 at chat size. */
export const artworkOverrides = {
  'agent-reach': {flattenOpacity:true},
  opencode: {path:'lobehub/opencode/opencode.svg'},
  notion: {path:'lobehub/notion/notion.svg'},
  runway: {path:'lobehub/runway/runway.svg'},
  photoshop: {path:'photoshop/photoshop.svg',foreground:'light'},
  illustrator: {path:'illustrator/illustrator.svg',foreground:'light'},
  'after-effects': {path:'after-effects/after-effects.svg',foreground:'light'},
  premiere: {path:'premiere/premiere.svg',foreground:'light'},
  obs: {foreground:'light'},
  nextjs: {foreground:'light'},
  hyperframes: {foreground:'light'},
  sqlite: {cropViewBox:[0,0,214,228],removePaths:[0],staticMonochrome:true},
  perplexity: {path:'lobehub/perplexity/perplexity.svg'},
  exa: {path:'lobehub/exa/exa.svg'},
  mongodb: {path:'mongodb/mongodb-icon-dark.svg'},
  aws: {staticMonochrome:true},
};
