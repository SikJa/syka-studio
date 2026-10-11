export type RecipeFormat = 'general' | 'reels' | 'youtube';
/** Read only the optional metadata block, never prose inside a personal skill. */
export function recipeFormat(content: string): RecipeFormat {
  const frontmatter = content.replace(/^\uFEFF/,'').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const metadata = frontmatter?.match(/^metadata:\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m)?.[1];
  const format = metadata?.match(/^[ \t]+format:\s*['"]?(general|reels|youtube)['"]?\s*$/m)?.[1];
  return format as RecipeFormat ?? 'general';
}
