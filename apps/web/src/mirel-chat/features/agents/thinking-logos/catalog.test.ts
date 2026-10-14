import {describe,it,expect} from 'vitest';
import {BRAND_MARKS,resolveToolBrand} from './catalog';
import {readFileSync} from 'node:fs';

describe('tool brand routing',()=>{
  it('ships the approved 70 plus 40 new marks with valid baked geometry',()=>{
    expect(BRAND_MARKS).toHaveLength(110);expect(BRAND_MARKS.filter(mark=>mark.added)).toHaveLength(40);
    expect(new Set(BRAND_MARKS.map(mark=>mark.id)).size).toBe(110);
    for(const mark of BRAND_MARKS){
      const asset=JSON.parse(readFileSync(new URL(`./data/${mark.id}.json`,import.meta.url),'utf8'));
      for(const size of ['small','large']){const set=asset[size];expect(set.n).toBeGreaterThan(19);expect(set.p.length).toBe(set.n*3);expect(set.e.length).toBe(set.n);expect(set.p.every(Number.isFinite)).toBe(true);}
      expect(asset.svg).not.toMatch(/<script|<foreignObject|\bonload=/i);
    }
  });
  it('prefers the destination over the intermediary and preserves the intermediary',()=>{
    const result=resolveToolBrand({toolName:'mcp__agent_reach__browse',label:'Abrir https://x.com/example',state:'started'});
    expect(result.mark.id).toBe('x');expect(result.via?.id).toBe('agent-reach');expect(result.active).toBe(true);
  });
  it.each([['document','google-docs'],['spreadsheets','google-sheets'],['presentation','google-slides']])('resolves docs.google.com/%s without collapsing it into Google', (path,id)=>{
    expect(resolveToolBrand({toolName:'browser',label:`https://docs.google.com/${path}/d/example/edit`}).mark.id).toBe(id);
  });
  it('does not trust a lookalike domain or a brand in a URL query',()=>{
    expect(resolveToolBrand({toolName:'browse',label:'https://x.com.evil.invalid/?q=github'}).mark.id).toBe('syka');
  });
  it.each([['gh repo view owner/repo','github'],['twitter search cats','x'],['ffmpeg -i input.mp4 output.mp4','ffmpeg'],['npx playwright screenshot https://example.org','playwright']])('recognizes a real executable: %s',(command,id)=>{
    expect(resolveToolBrand({toolName:'exec_command',label:command}).mark.id).toBe(id);
  });
  it('does not match X as a letter or render as a hosting provider',()=>{
    expect(resolveToolBrand({toolName:'render',label:'Render 1920 x 1080'}).mark.id).toBe('syka');
  });
  it('does not mistake a search query or echoed text for the tool being used',()=>{
    expect(resolveToolBrand({toolName:'webSearch',label:'Search Apple announcements'}).mark.id).toBe('syka');
    expect(resolveToolBrand({toolName:'exec_command',label:'echo github'}).mark.id).toBe('syka');
  });
  it('resolves each of the 110 explicit native namespaces',()=>{
    for(const mark of BRAND_MARKS)expect(resolveToolBrand({toolName:`mcp__${mark.aliases[0]}__invoke`,label:'Usar herramienta'}).mark.id).toBe(mark.id);
  });
  it.each([['git status --short','git','searching'],['node --version','nodejs','working'],['python -m json.tool inventory.json','python','solving']])('reads the actual Codex Run envelope: %s',(command,id,state)=>{
    const result=resolveToolBrand({toolName:'commandExecution',label:'Run',summary:command,state:'running'});
    expect(result.mark.id).toBe(id);expect(result.state).toBe(state);expect(result.active).toBe(true);
  });
  it('unwraps a Windows shell without mistaking it for the invoked program',()=>{
    expect(resolveToolBrand({toolName:'commandExecution',label:'Run',summary:'"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoProfile -Command "git status --short"'}).mark.id).toBe('git');
  });
  it('recognizes a native summary truncated before its closing shell quote',()=>{
    const result=resolveToolBrand({toolName:'commandExecution',label:'Run',summary:'"C:\\runtime\\pwsh.exe" -Command \'git status --short; Start-Sleep -Secon…',state:'running'});
    expect(result.mark.id).toBe('git');expect(result.state).toBe('searching');
  });
  it('uses the operation rather than file names or forcing all seven modes on an app',()=>{
    expect(resolveToolBrand({toolName:'mcp__zernio__publish_post',label:'Publicar'}).state).toBe('working');
    expect(resolveToolBrand({toolName:'mcp__zernio__list_posts',label:'Consultar publicaciones'}).state).toBe('searching');
    expect(resolveToolBrand({toolName:'read_file',label:'Read audio-render-test.ts'}).state).toBe('searching');
  });
  it('stops completed and failed operations without inventing success',()=>{
    for(const state of ['completed','done','failed'])expect(resolveToolBrand({toolName:'github',label:'Read issue',state}).active).toBe(false);
  });
  it('resolves native MCP names and operation-specific animation states',()=>{
    expect(resolveToolBrand({toolName:'mcp__codex_apps__google_drive__search',label:'Buscar archivo'}).mark.id).toBe('google-drive');
    expect(resolveToolBrand({toolName:'mcp__blender__render',label:'Renderizar escena'}).state).toBe('generating');
    expect(resolveToolBrand({toolName:'elevenlabs_transcribe',label:'Transcribir audio'}).state).toBe('listening');
    expect(resolveToolBrand({toolName:'github_test',label:'Test'}).state).toBe('solving');
  });
});
