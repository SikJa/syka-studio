import type { Item } from '@diffusionstudio/agent-chat';
import type { MascotActivity } from '@/lib/syka-mascot';
import type {NoticeKind} from '../../../../packages/agent-chat/src/notifications';

export function noticeMascotActivity(kind:NoticeKind):MascotActivity {
  return kind==='question'?'question':kind==='blocked'||kind==='auth'?'error':'notification';
}

/** A generic shell/file change isn't proof of an edit in the native timeline. */
export function mascotTimelineTool(items:readonly Item[],running:boolean) {
  if(!running)return undefined;
  const start=items.findLastIndex(item=>item.kind==='user')+1;
  return items.slice(start).findLast(item=>item.kind==='tool'&&item.status==='running'
    && ['syka_edit_source','syka_undo_source','syka_redo_source','source_update','source_create']
      .includes(item.name.replace(/^.*__/,'').toLowerCase()));
}

/** Only explicit tool names from the current turn select a specialized gesture.
 * Prompt/reasoning/output text cannot pretend that an operation is running. */
export function mascotActivity(items: readonly Item[], running: boolean, waiting: boolean): MascotActivity {
  if (waiting) return 'question';
  const start = items.findLastIndex(item => item.kind === 'user') + 1;
  const turn = items.slice(start);
  if (!running) {
    const last = turn.at(-1);
    if (last?.kind === 'notice' && last.level === 'error') return 'error';
    // Idle is not proof that a video finished or an interrupted turn succeeded.
    return 'idle';
  }
  const tool = turn.findLast(item => item.kind === 'tool' && item.status === 'running');
  if (tool?.kind !== 'tool') return 'thinking';
  const name = tool.name.replace(/^.*__/, '').toLowerCase();
  if (['media_transcribe', 'syka_read_transcript', 'captions_create', 'captions_update'].includes(name)) return 'captions';
  if (['syka_audio_analyze', 'syka_audio_enhance', 'audio_analyze', 'audio_mix', 'syka_local_audio'].includes(name)) return 'audio';
  if (['syka_motion_review', 'check', 'capture', 'syka_check', 'syka_capture'].includes(name)) return 'review';
  if (['syka_edit_source', 'syka_undo_source', 'syka_redo_source', 'apply_patch', 'filechange', 'source_update', 'source_create'].includes(name)) return 'editing';
  return 'thinking';
}
