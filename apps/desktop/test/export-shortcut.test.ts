import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  keydown: undefined as ((event: KeyboardEvent) => void) | undefined,
  saved: undefined as Record<string, unknown> | undefined,
  otherSaved: undefined as Record<string, unknown> | undefined,
  scene: { isAlive: () => true, get: () => ({ width: 1920, height: 1080 }) },
  otherScene: { isAlive: () => true, get: () => ({ width: 1080, height: 1920 }) },
  context: undefined as { exportScene: (scene: unknown, config?: unknown) => Promise<void> } | undefined,
  menuActions: [] as Array<() => Promise<void>>,
  render: vi.fn(async (_engine: unknown, _options: unknown) => ({ type: 'success' })),
  bridge: vi.fn(async () => ({ path: 'F:/shortcut-test/output.webm' })),
}));

vi.mock('solid-js', async (importOriginal) => ({
  ...await importOriginal<typeof import('solid-js')>(),
  createContext: () => ({ Provider: () => null }),
  useContext: () => state.context,
  createMemo: (read: () => unknown) => read,
  createEffect: (run: () => void) => run(),
  For: 'For', Show: 'Show',
  onMount: (run: () => void) => run(),
  onCleanup: () => {},
}));
vi.mock('solid-js/jsx-runtime', () => ({ jsx: () => null, jsxs: () => null, Fragment: () => null }));
vi.mock('@diffusionstudio/koota-solid', () => ({
  useWorld: () => ({ get: () => ({ exportOf: (scene: unknown) => scene === state.otherScene ? state.otherSaved : state.saved }) }),
  useQuery: () => () => [state.otherScene],
}));
vi.mock('@diffusionstudio/runtime', () => ({
  Computed: 'computed', getActiveEntity: () => state.scene,
  AssetId: 'asset', ChildOf: () => 'child', Name: 'name', Root: 'root', Scene: 'scene', getAssetFile: () => {}, sortByItemIndex: () => 0,
}));
vi.mock('@diffusionstudio/encoder', () => ({ computeOutputSize: () => ({ width: 1280, height: 720 }) }));
vi.mock('@/engine/traits', () => ({ ProjectConfig: 'project-config' }));
vi.mock('@/engine/formats/output', () => ({ sceneFormatOutput: () => ({ publicationStatus: 'draft', output: { width: 1280, height: 720 } }) }));
vi.mock('@/engine', () => ({ useEngineContext: () => ({ snapshot: vi.fn() }) }));
vi.mock('@/context/project', () => ({ useProject: () => ({ id: () => 'shortcut-test', name: () => 'Shortcut test', dir: () => 'F:/shortcut-test' }) }));
vi.mock('@/context/render', () => ({ renderScene: state.render, renderOverlay: () => null, cancelRender: () => {} }));
vi.mock('@/lib/ipc', () => ({ mainBridge: { call: state.bridge } }));
vi.mock('@/lib/electron-file-writable', () => ({ ElectronWritableFileHandle: class { constructor(readonly path: string) {} } }));
vi.mock('@/components/sidebar-right/inspector/export-progress', () => ({ ExportProgress: () => null }));
vi.mock('@/components/post-export-offer', () => ({ PostExportOffer: () => null }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: 'MenuItem', DropdownMenuPortal: 'MenuPortal', DropdownMenuSeparator: 'MenuSeparator',
  DropdownMenuShortcut: 'MenuShortcut', DropdownMenuSub: 'MenuSub', DropdownMenuSubContent: 'MenuSubContent',
  DropdownMenuSubTrigger: 'MenuSubTrigger', DropdownMenuGroup: 'MenuGroup',
}));
vi.mock('@solidjs/router', () => ({ useLocation: () => ({}), useNavigate: () => () => {} }));
vi.mock('@/lib/db', () => ({ forgetProjectBundle: () => {}, generateProjectName: () => 'Test' }));
vi.mock('@/projects', () => ({ createProject: () => {}, deleteProject: () => {}, duplicateProject: () => {}, ensureProjectsRoot: () => {} }));
vi.mock('@diffusionstudio/assets', () => ({ assetName: () => 'asset' }));
vi.mock('@/engine/library', () => ({ useLibrary: () => () => undefined }));
vi.mock('@/engine/asset-actions', () => ({ pickAndImport: () => {} }));
vi.mock('@/hooks/use-project-route', () => ({ projectRoute: () => '/' }));
vi.mock('@/utils', () => ({ assert: () => {}, downloadObject: () => {}, isInputTarget: () => false, mimeTypeToExtension: () => '' }));
vi.mock('somoto', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('mediabunny', () => ({ canEncodeVideo: async () => true }));

import { ExportProvider } from '../../web/src/context/export';
import { getDefaultExportTemplate } from '../../web/src/components/sidebar-right/inspector/export-templates';
import { FileExportMenu, FileExportSpecificSceneMenu } from '../../web/src/components/sidebar-left/project-menu/file-menu';

beforeEach(() => {
  vi.clearAllMocks();
  state.saved = undefined;
  state.otherSaved = undefined;
  state.keydown = undefined;
  state.context = undefined;
  state.menuActions = [];
  vi.stubGlobal('React', { createElement: (type: unknown, props: any, ...children: any[]) => {
    if (props?.value?.exportScene) state.context = props.value;
    if (type === 'MenuItem' && props?.onSelect) state.menuActions.push(props.onSelect);
    if (type === 'For') props.each.forEach((scene: unknown, index: number) => children[0](scene, () => index));
    return null;
  } });
  vi.stubGlobal('window', {
    desktop: true,
    addEventListener: (_name: string, handler: (event: KeyboardEvent) => void) => { state.keydown = handler; },
    removeEventListener: () => {},
  });
  ExportProvider({ children: null });
});
afterEach(() => vi.unstubAllGlobals());

const exportShortcut = () => state.keydown!({
  key: 'e', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn(),
} as unknown as KeyboardEvent);

describe('scene export entry points', () => {
  it('uses the active scene saved container, codecs, frame rate and audio settings', async () => {
    state.saved = {
      format: 'webm',
      video: { codec: 'vp9', resolution: 720, bitrate: 7e6, fps: 24 },
      audio: { codec: 'opus', enabled: false, bitrate: 96e3 },
    };
    exportShortcut();
    await vi.waitFor(() => expect(state.render).toHaveBeenCalledOnce());
    expect(state.bridge).toHaveBeenCalledWith('file:pick-export', expect.objectContaining({ extension: 'webm', name: 'shortcut-test.webm' }));
    expect(state.render.mock.calls[0][1]).toMatchObject({ scene: state.scene, config: state.saved, source: 'ui' });
  });

  it('keeps the default export when the active scene has no saved settings', async () => {
    exportShortcut();
    await vi.waitFor(() => expect(state.render).toHaveBeenCalledOnce());
    expect(state.render.mock.calls[0][1]).toMatchObject({ config: getDefaultExportTemplate() });
  });

  it('uses saved settings when exporting the active scene from File', async () => {
    state.saved = { format: 'mov', video: { codec: 'hevc', resolution: 1440 }, audio: { enabled: false } };
    FileExportMenu();
    await state.menuActions[0]();
    expect(state.render.mock.calls[0][1]).toMatchObject({ scene: state.scene, config: state.saved });
    expect(state.bridge).toHaveBeenCalledWith('file:pick-export', expect.objectContaining({ extension: 'mov' }));
  });

  it('exports the chosen scene with its own settings instead of the active scene settings', async () => {
    state.saved = { format: 'mp4', video: { codec: 'avc' } };
    state.otherSaved = { format: 'ogg', video: { enabled: false }, audio: { codec: 'opus', bitrate: 96e3 } };
    FileExportSpecificSceneMenu();
    await state.menuActions[0]();
    expect(state.render.mock.calls[0][1]).toMatchObject({ scene: state.otherScene, config: state.otherSaved });
    expect(state.bridge).toHaveBeenCalledWith('file:pick-export', expect.objectContaining({ extension: 'ogg' }));
  });

  it('preserves settings explicitly supplied by the export panel', async () => {
    state.saved = { format: 'webm', video: { codec: 'vp9' } };
    const explicit = { format: 'mp4', video: { codec: 'avc', fps: 60 }, audio: { bitrate: 128e3 } };
    await state.context!.exportScene(state.scene, explicit);
    expect(state.render.mock.calls[0][1]).toMatchObject({ config: explicit });
    expect(state.bridge).toHaveBeenCalledWith('file:pick-export', expect.objectContaining({ extension: 'mp4' }));
  });
});
