import { createContext, createEffect, createMemo, createSignal, onCleanup, onMount, useContext } from 'solid-js';
import { createRoot } from '@/lib/react-root';
import { createElement } from 'react';
import type { ImageAsset } from '@diffusionstudio/assets';
import type { Item } from '@diffusionstudio/agent-chat';
import { ASSET_DRAG_TYPE } from '@/components/sidebar-left/folder-item';
import { ImageGenerationCard } from '@/mirel-chat/features/agents/image-generation-card';
import { generatedImageOutput } from './generated-assets';
import { ChatActionsContext } from './mirel-messages';

// React roots sit outside Solid's refresh boundary. Forward component updates
// to the roots that are already mounted instead of updating only their CSS.
let imageCardView = ImageGenerationCard;
const imageCardUpdates: Set<(view: typeof ImageGenerationCard) => void> | undefined = import.meta.hot
  ? (import.meta.hot.data.imageCardUpdates ??= new Set()) : undefined;
if (import.meta.hot) import.meta.hot.accept('../mirel-chat/features/agents/image-generation-card.tsx', module => {
  if (!module) return;
  imageCardView = module.ImageGenerationCard;
  imageCardUpdates?.forEach(update => update(imageCardView));
});

export type GeneratedImageRegistration = {asset?: ImageAsset; error?: string};
export const GeneratedImagesContext = createContext<{
  registration(id: string): GeneratedImageRegistration | undefined;
  insert(asset: ImageAsset): void;
}>();

/** A native generation keeps its own place in the transcript, including on reopen. */
export function ImageGenerationItem(props: {item: Extract<Item, {kind:'tool'}>}) {
  const context = useContext(GeneratedImagesContext);
  const actions = useContext(ChatActionsContext);
  const registration = createMemo(() => context?.registration(props.item.id));
  const [preview, setPreview] = createSignal<{assetId: string; url: string}>();
  const [previewError, setPreviewError] = createSignal<string>();
  const [cardView, setCardView] = createSignal(imageCardView);
  const updateCardView = (view: typeof ImageGenerationCard) => setCardView(() => view);
  imageCardUpdates?.add(updateCardView);
  onCleanup(() => imageCardUpdates?.delete(updateCardView));
  let element!: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  createEffect(() => {
    const asset = registration()?.asset;
    const output = generatedImageOutput(props.item);
    setPreview(undefined); setPreviewError(undefined);
    if (!asset || !output) return;
    let cancelled = false, url: string | undefined;
    void asset.handle.getFile().then(file => {
      if (cancelled) return;
      if (file.size !== output.bytes) throw Error('El archivo cambió; la previsualización no se cargó.');
      url = URL.createObjectURL(file);
      setPreview({assetId: asset.id, url});
    }).catch(error => {if (!cancelled) setPreviewError(error instanceof Error ? error.message : 'No se pudo cargar la imagen.');});
    onCleanup(() => {cancelled = true; if (url) URL.revokeObjectURL(url);});
  });
  onMount(() => {
    root = createRoot(element);
    createEffect(() => {
      const item = props.item, result = registration(), asset = result?.asset;
      const src = preview()?.assetId === asset?.id ? preview()?.url : undefined;
      const error = result?.error || previewError();
      const active = !!actions?.running() && actions.isActiveItem(item.id);
      const status = item.status === 'failed' || error ? 'failed'
        : item.status === 'running' ? active ? 'running' : 'cancelled'
        : !generatedImageOutput(item) ? 'failed' : src ? 'ready' : 'preparing';
      root.render(createElement(cardView(), {
        status, src, aspect: asset && asset.height > 0 ? asset.width / asset.height : undefined,
        error: error || (item.status === 'failed' ? item.output : status === 'failed' ? 'No llegó un archivo de imagen válido.' : undefined),
        assetId: asset?.id,
        fileName: asset?.source.split(/[\\/]/).at(-1),
        onInsert: () => {if (asset) context?.insert(asset);},
        onDrag: transfer => {if (asset) transfer.setData(ASSET_DRAG_TYPE, asset.id);},
        onImageError: () => setPreviewError('El archivo no se pudo decodificar como imagen.'),
      }));
    });
  });
  onCleanup(() => root?.unmount());
  return <div ref={element} class="syka-mirel-visuals" data-chat-image-item={props.item.id}/>;
}
