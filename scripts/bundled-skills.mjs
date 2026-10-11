// Inventory only the product's public skills, never this machine's agent profile.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const categories = [
  ['Edición y revisión', ['editor.md','watch.md','syka-editing-basics','syka-editing-recipe','syka-edit-review','syka-explainer-edit','syka-design-import']],
  ['Dirección y motion', ['syka-visual-direction','syka-editorial-motion','syka-motion-brief','syka-motion-direction','syka-motion-storyboard','syka-motion-reels','syka-motion-typography','syka-motion-transitions','syka-faceless-explainer','syka-slideshow','syka-pr-to-video']],
  ['Subtítulos', ['syka-captions','syka-camera-3d-captions']],
  ['Música y sonido', ['syka-local-audio','syka-music-video']],
  ['Referencias y recursos', ['syka-media-use','syka-video-references','syka-motion-reference','syka-motion-references']],
  ['Entrega y publicación', ['syka-content-package']],
];
export async function bundledSkills(docsDir) {
  const skills=[];
  for(const entry of await readdir(join(docsDir,'skills'),{withFileTypes:true})) {
    if(!entry.isDirectory()&&!entry.name.endsWith('.md'))continue;
    const path=entry.isDirectory()?`skills/${entry.name}/SKILL.md`:`skills/${entry.name}`;
    const content=await readFile(join(docsDir,path),'utf8');
    const front=content.match(/^---\r?\n([\s\S]*?)\r?\n---/),description=front?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'')??content.split(/\r?\n\r?\n/)[1]?.trim()??'';
    const title=content.match(/^#\s+(.+)$/m)?.[1]?.trim()??entry.name;
    const category=categories.find(([,names])=>names.includes(entry.name))?.[0];
    if(!category)throw Error(`La skill ${entry.name} necesita una categoría en el catálogo de distribución.`);
    skills.push({name:entry.name,title,category,path,description,sha256:createHash('sha256').update(content).digest('hex'),delivery:'bundled'});
  }
  skills.sort((a,b)=>a.name.localeCompare(b.name));
  const manifest={version:1,engine:'diffusion',count:skills.length,skills};
  await writeFile(join(docsDir,'skills','catalog.json'),JSON.stringify(manifest,null,2)+'\n');
  const groups=categories.map(([category])=>`## ${category}\n\n| Skill incluida | Función |\n|---|---|\n`+skills.filter(s=>s.category===category).map(s=>`| [${s.name}](${s.path}) | ${s.title.replaceAll('|','\\|')} |`).join('\n')).join('\n\n');
  await writeFile(join(docsDir,'SKILLS_INCLUDED.md'),`# Skills incluidas en Syka Studio\n\nCatálogo generado desde los archivos públicos del producto: **${skills.length} skills**. Se incluyen en los recursos de la aplicación y se accede con syka_skills; no se descargan videos ni se requiere la biblioteca personal de su desarrollador. El manifiesto [catalog.json](skills/catalog.json) registra nombre, categoría, ruta relativa y SHA256.\n\n${groups}\n\n## Qué necesita configurar cada persona\n\nLas instrucciones vienen incluidas; ejecutar sus herramientas requiere una cuenta del agente conectada. El motor Diffusion y sus funciones nativas de preview/export pertenecen a la aplicación. La transcripción nueva usa la conexión opcional propia de Groq; subtítulos ya transcritos no necesitan repetirla. La revisión del MP4 y ciertos flujos de audio/referencias requieren los binarios locales que figuran en Herramientas locales (FFmpeg/FFprobe, Python o yt-dlp según la operación). Búsqueda web, imagen, publicación y modelos dependen de sus proveedores y capacidades reales. Una skill no instala ni autentica un servicio.\n\nLas skills del perfil personal, de otro agente o de un proyecto son opcionales y no se cuentan como parte del instalador. Los medios privados, cuentas, claves, historial y proyectos del desarrollador no se incluyen. El staging valida este catálogo; el tamaño final sólo se conoce al generar un instalador.\n`);
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const result=await bundledSkills(join(root,'docs'));
  console.log(JSON.stringify({count:result.count,categories:categories.map(([name])=>({name,count:result.skills.filter(s=>s.category===name).length}))}));
}
