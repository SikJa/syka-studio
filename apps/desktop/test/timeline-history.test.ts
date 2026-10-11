import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ listeners: [] as ((edit: any) => void)[], entities: new Map<string, any>(), serial: 0 }));
vi.mock('@diffusionstudio/runtime', () => ({ Source: 'source', getEntityChildren: () => [] }));
vi.mock('@diffusionstudio/reconciler', () => ({ authoredElement: (entity: any) => ({ props: { ...entity.props } }), renderAuthored: (tree: any) => tree }));
vi.mock('../../web/src/engine/editor', () => ({ getDocumentEditor: () => ({
  onEdit: (listener: (edit: any) => void) => { harness.listeners.push(listener); }, onRename: () => {},
  editProperty: (entity: any, name: string, value: unknown) => { const previous = entity.props[name]; entity.props[name] = value; harness.listeners.forEach(fn => fn({ kind: 'prop', source: entity.source, name, value, previous })); },
  insertElement: (parent: any, render: () => any) => {
    const tree = render(); const source = `audio-${++harness.serial}`;
    const entity = { source, props: { ...tree.props }, get: () => ({ value: source }), isAlive: () => true };
    harness.entities.set(source, entity);
    harness.listeners.forEach(fn => fn({ kind: 'insert', source, parent: parent.source, tag: tree.tag, props: tree.props }));
    return [entity];
  },
  remove: (entity: any) => { harness.entities.delete(entity.source); },
}) }));
import { EditHistory } from '../../web/src/engine/history';
import { getDocumentEditor } from '../../web/src/engine/editor';

const world = { query: () => [...harness.entities.values()] } as any;
const add = (source: string, props: Record<string, unknown> = {}) => {
  const entity = { source, props, get: () => ({ value: source }), isAlive: () => true };
  harness.entities.set(source, entity); return entity as any;
};
beforeEach(() => { harness.listeners = []; harness.entities.clear(); harness.serial = 0; });

describe('compound edit history', () => {
  it('undoes audio insertion plus original mute in one step and redoes both with a fresh source id', () => {
    const parent = add('scene'); const video = add('video', { muted: false });
    const history = new EditHistory(world); const editor = getDocumentEditor(world);
    history.command(() => {
      editor.insertElement(parent, () => ({ tag: 'audio', props: { src: 'take.mp4' }, children: [] }));
      editor.editProperty(video, 'muted', true);
    });
    expect(harness.entities.size).toBe(3); expect(video.props.muted).toBe(true);
    history.undo();
    expect(harness.entities.size).toBe(2); expect(video.props.muted).toBe(false); expect(history.canUndo()).toBe(false);
    history.redo();
    expect(harness.entities.has('audio-2')).toBe(true); expect(video.props.muted).toBe(true);
    history.undo(); expect(harness.entities.size).toBe(2); expect(video.props.muted).toBe(false);
  });
  it('rolls back a failed compound command without consuming prior history', () => {
    const video = add('video', { muted: false, volume: 0 });
    const history = new EditHistory(world); const editor = getDocumentEditor(world);
    history.command(() => editor.editProperty(video, 'volume', -6));
    expect(() => history.command(() => { editor.editProperty(video, 'muted', true); throw Error('failed'); })).toThrow('failed');
    expect(video.props.muted).toBe(false);
    history.undo(); expect(video.props.volume).toBe(0); expect(history.canUndo()).toBe(false);
  });
  it('invalidates old source steps on remount and keeps the reason visible', () => {
    const video = add('video', { muted: false });
    const history = new EditHistory(world);
    history.command(() => getDocumentEditor(world).editProperty(video, 'muted', true));
    history.reset('Código recargado'); history.undo();
    expect(video.props.muted).toBe(true); expect(history.canUndo()).toBe(false); expect(history.boundary()).toBe('Código recargado');
    history.reset(); expect(history.boundary()).toBeUndefined();
  });
  it('never replays old manual stamps when a bound desktop journal is blocked', () => {
    const video = add('video', { muted: false });
    const history = new EditHistory(world);
    history.command(() => getDocumentEditor(world).editProperty(video, 'muted', true));
    const undo = vi.fn();
    history.bindBackend({ canUndo: () => false, canRedo: () => false, busy: () => false, problem: () => 'Conflicto externo', undo, redo: () => {}, refresh: async () => {} });
    history.undo();
    expect(video.props.muted).toBe(true); expect(history.canUndo()).toBe(false);
    expect(history.shared()).toBe(true); expect(history.problem()).toBe('Conflicto externo');
    expect(undo).toHaveBeenCalledOnce();
  });
});
