import { createEncoder } from '@diffusionstudio/encoder';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import { render } from 'solid-js/web';
import { onMount, createSignal, Show } from 'solid-js';
import { EngineProvider, useEngineContext } from '../src/engine/context';
import { createRuntimeDocument, Rect, Text, SolidPaint, authoredTree, renderAuthored } from '@diffusionstudio/reconciler';
import { Root, Source, Mode, RenderSurface, FrameRate, FramePromises, Workarea, createRuntimeWorld, disposeDecoders, focusRect } from '@diffusionstudio/runtime';
import { createScene } from '../src/engine/new-scene';
import { getDocumentEditor } from '../src/engine/editor';
import { getEditHistory } from '../src/engine/history';
import { FormatPanel } from '../src/components/sidebar-right/inspector/format-panel';
import { sceneSize } from '../src/engine/formats/native';
import '../src/index.css';
function Fixture() {
  const engine = useEngineContext(), world = engine.world;
  createRuntimeDocument(world);
  world.get(Root)!.add(Source);
  world.get(Root)!.set(Source, { value: 'qa.tsx:root' });
  const scene = createScene(world, { width: 1920, height: 1080 }, { format: { width: 1920, height: 1080 } })!;
  const editor = getDocumentEditor(world);
  
  const saved = localStorage.getItem('syka-formats-qa');
  if (saved) {
    const tree = JSON.parse(saved);
    for (const [key, value] of Object.entries(tree.props)) if (!['id','selected'].includes(key)) editor.editProperty(scene, key, value as number);
    for (const child of tree.children.filter((n: { tag: string }) => n.tag !== 'solidPaint')) editor.insertElement(scene, () => renderAuthored(child));
  } else {
    editor.insertElement(scene, () => <Rect name="Tarjeta" width={1920} height={1080}><SolidPaint color="#142a42" /></Rect>);
    editor.insertElement(scene, () => <Text name="Título" x={160} y={700} width={1500} height={160} fontSize={100} color="#ffffff">Cada formato, su encuadre.</Text>);
    editor.insertElement(scene, () => <Rect name="Logo QA" x={1640} y={80} width={160} height={160}><SolidPaint color="#5c99ff" /></Rect>);
  }
  getEditHistory(world).reset();
  let canvas!: HTMLCanvasElement;
  const [exportUrl, setExportUrl] = createSignal('');
  const [status, setStatus] = createSignal('Fixture sintética · motor nativo · sin cuentas ni proyectos personales');
  const frame = () => { const s = sceneSize(scene); focusRect(world, { x: -960, y: -540, ...s }); };
  onMount(() => { engine.mount(canvas); engine.start(); frame(); });
  const save = () => { localStorage.setItem('syka-formats-qa', JSON.stringify(authoredTree(world, scene))); setStatus('Fixture guardada para prueba de reapertura (localStorage de QA).'); };
  const exportFixture = async () => {
    setStatus('Render nativo aislado en curso…');
    const capture = createRuntimeWorld('formats-export-qa');
    const surface = document.createElement('canvas');
    capture.set(Mode, { value: 'offline-video' });
    capture.set(RenderSurface, { canvas: surface, ctx: surface.getContext('2d'), resolution: 1 });
    capture.set(FrameRate, { value: 30 });
    capture.set(FramePromises, { list: [] });
    const doc = createRuntimeDocument(capture);
    const root = capture.get(Root)!; root.add(Source); root.set(Source, { value: 'export.tsx:root' });
    try {
      const [copy] = getDocumentEditor(capture).insertElement(root, () => renderAuthored(authoredTree(world, scene)!));
      copy.add(Workarea); copy.set(Workarea, { start: 0, end: 60 });
      const encoder = await createEncoder(capture, { format: 'mp4', video: { codec: 'avc', resolution: 360, bitrate: 1000000 }, audio: { enabled: false } });
      const result = await encoder.render();
      if (result.type !== 'success' || !result.data) throw new Error(result.type === 'error' ? result.error.message : result.type);
      const input = new Input({ source: new BlobSource(result.data), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      setStatus('Export MP4 nativo verificado: ' + track!.displayWidth + ' × ' + track!.displayHeight + ' · ' + (await input.computeDuration()).toFixed(2) + ' s · ' + result.data.size + ' bytes. Fixture sintética, sin audio.');
      input.dispose(); setExportUrl(URL.createObjectURL(result.data));
    } catch (e) { setStatus('Export falló: ' + String(e)); }
    finally { doc.dispose(); disposeDecoders(capture, root); capture.destroy(); }
  };
  return <main style="display:flex;height:100vh;width:100vw;background:#101216;color:#edf0f8"><div style="flex:1;min-width:0;position:relative"><canvas ref={canvas}/><div style="position:absolute;left:24px;top:24px;max-width:90%;font-size:11px;background:#101216bb;padding:8px;border-radius:8px"><h1>Syka · Formatos</h1><p>{status()}</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px"><button onClick={() => { getEditHistory(world).undo(); frame(); }}>Deshacer</button><button onClick={() => { getEditHistory(world).redo(); frame(); }}>Rehacer</button><button onClick={frame}>Encuadrar</button><button onClick={save}>Guardar fixture</button><button onClick={exportFixture}>Exportar QA 2 s</button><button onClick={() => { localStorage.removeItem('syka-formats-qa'); location.reload(); }}>Restablecer QA</button></div><Show when={exportUrl()}><video controls src={exportUrl()} style="max-width:100%;max-height:180px"/><a href={exportUrl()} download="formats-qa.mp4">Descargar MP4 QA</a></Show></div></div><aside style="width:340px;overflow:auto;padding-top:20px;border-left:1px solid #30343e"><FormatPanel scene={scene}/></aside></main>;
}
render(() => <EngineProvider projectId="formats-isolated-qa"><Fixture /></EngineProvider>, document.getElementById('root')!);

