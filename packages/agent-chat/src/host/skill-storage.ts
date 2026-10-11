import { mkdir, readFile, writeFile, rename, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';

export const skillRevision = (content: string) =>
  createHash('sha256').update(content).digest('hex');
export async function writePersonalSkill(
  root: string,
  args: {
    action: 'create' | 'save';
    name: string;
    content: string;
    revision?: string;
  },
) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(args.name) || !args.content?.trim())
    throw Error('Nombre e instrucciones requeridos');
  await mkdir(root, { recursive: true });
  const folder = join(await realpath(root), args.name),
    path = join(folder, 'SKILL.md');
  let content = args.content;
  if (args.action === 'create') {
    await mkdir(folder); // Refuse replacement, including symlinks.
    if (!content.startsWith('---'))
      content = `---\nname: ${args.name}\ndescription: Flujo local de Syka ${args.name}\n---\n\n${content}`;
    await writeFile(path, content, { flag: 'wx' });
  } else {
    if ((await realpath(folder)) !== folder || (await realpath(path)) !== path)
      throw Error('La skill debe ser un archivo local del perfil');
    const previous = await readFile(path, 'utf8');
    if (args.revision !== skillRevision(previous))
      throw Error('La skill cambió. Volvé a leerla antes de guardar');
    const backup = join(dirname(root), 'skill-history');
    await mkdir(backup, { recursive: true });
    await writeFile(
      join(backup, args.name + '-' + randomUUID() + '.md'),
      previous,
      { flag: 'wx' },
    );
    const temp = path + '.' + randomUUID() + '.tmp';
    await writeFile(temp, content, { flag: 'wx' });
    await rename(temp, path);
  }
  return {
    path,
    name: args.name,
    revision: skillRevision(content),
    saved: true,
  };
}
