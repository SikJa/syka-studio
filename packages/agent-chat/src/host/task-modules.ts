/** Discovery hints, not classifiers: select from the complete task and current context. */
export const TASK_MODULES = [
  ['syka-editing-basics', 'general editing, execution and source/history'],
  ['syka-motion-brief', 'new motion consultation and a shared native production plan'],
  ['syka-visual-direction', 'brand, reference matching and composition'],
  ['syka-editorial-motion', 'editable cards, callouts and comparisons'],
  ['syka-explainer-edit', 'recorded explanation and screen demos'],
  ['syka-captions', 'real transcript, style and timing'],
  ['syka-local-audio', 'music, SFX, native mixing and listening evidence'],
  ['syka-video-references', 'bounded video inspection and reference reuse'],
  ['syka-edit-review', 'proportional visual/playback/audio review'],
] as const;

export const TASK_MODULE_INSTRUCTIONS = [
  'Retrieve task guidance only when needed with syka_skills. Bundled native skills expose a mandatory contract plus a section index. Read the selected phase with action:"read", name:"<skill>", mode:"section", sectionId:"brief", "build" or "review"; a default read is orientation, not the complete workflow. Load brief for unresolved new-work decisions, build for implementation, review for the changed risk. A small correction uses the source and existing decisions, not all phases.',
  'Choose from the whole request and current project context, not keywords. Main entry points: ' + TASK_MODULES.map(([name, purpose]) => `${name} (${purpose})`).join('; ') + '.',
  'For specialized routes (product launch, storyboard, typography, reels, camera captions, music-led edits, syka-music-video, syka-pr-to-video, syka-slideshow, faceless explanation, design import, media or content packages), discover syka_skills list with a precise query or read syka-editing-basics file:"references/task-modules.md". Load only the relevant section and conditional support file/example. Dependencies are suggestions with conditions, never recursive or eager reads; do not follow cycles back into resolved brief/production docs. External skills without this contract keep legacy full reads; use explicit supported ranges/sections only when their coverage is sufficient.',
].join('\n');
