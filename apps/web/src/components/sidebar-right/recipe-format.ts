import { recipeFormat, type RecipeFormat } from '@diffusionstudio/agent-chat';
export { recipeFormat, type RecipeFormat };

export type LibrarySkill = { name?: string; description: string; format?: RecipeFormat };
export function librarySkillFormat(skill: LibrarySkill): RecipeFormat {
  if (skill.format && skill.format !== 'general') return skill.format;
  // This bundled workflow predates format metadata; don't classify arbitrary
  // personal skill names or body text by a substring search.
  if (skill.name === 'syka-motion-reels') return 'reels';
  return recipeFormat(skill.description);
}
export function matchesLibraryFormat(skill: LibrarySkill, format: string): boolean {
  return format === 'all' || librarySkillFormat(skill) === format;
}
