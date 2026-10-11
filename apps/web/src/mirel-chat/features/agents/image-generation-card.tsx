/** @jsxImportSource react */
import { useRef, useState } from 'react';
import { Download, Expand, ImagePlus, ImageOff } from 'lucide-react';
import { GridReveal } from './grid-reveal';
import { AgentImageLightbox } from './agent-image-lightbox';
import './image-generation-card.css';

export type ImageGenerationStatus = 'running' | 'preparing' | 'ready' | 'failed' | 'cancelled';
export type ImageGenerationCardProps = {
  status: ImageGenerationStatus;
  src?: string;
  aspect?: number;
  error?: string;
  assetId?: string;
  fileName?: string;
  imageLabel?: string;
  onInsert?(): void;
  onDrag?(transfer: DataTransfer): void;
  onImageError?(): void;
};

const ACTIONS_OUTLINE = 'M0 0 C10.4 0 12.48 8 13.152 17.6 C13.54 23.2 13.7 29 22 29 H130 C138.3 29 138.46 23.2 138.848 17.6 C139.52 8 141.6 0 152 0';

export function ImageGenerationCard(props: ImageGenerationCardProps) {
  const imageLabel = props.imageLabel || 'Imagen generada';
  const [revealed, setRevealed] = useState(props.status === 'ready' && !!props.src);
  const animateArrival = useRef(props.status === 'running');
  const [expanded, setExpanded] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const terminal = props.status === 'failed' || props.status === 'cancelled';
  const settled = revealed || !animateArrival.current;
  const pending = !terminal && (!props.src || !settled);
  const actionsReady = !terminal && !!props.src && props.status === 'ready' && settled;
  const label = props.status === 'running' ? 'Generando imagen'
    : props.status === 'preparing' ? 'Preparando la previsualización'
    : props.status === 'failed' ? 'No se pudo mostrar la imagen'
        : props.status === 'cancelled' ? 'Generación interrumpida' : imageLabel;

  return <section className="syka-image-generation" data-image-generation={props.status} data-codex-generated-asset={props.assetId} aria-label={props.imageLabel || 'Imagen generada por Syka'} aria-busy={pending}>
    {terminal ? <div className="syka-image-generation-error" role={props.status === 'failed' ? 'alert' : 'status'}>
      <ImageOff aria-hidden="true" />
      <strong>{label}</strong>
      {props.error ? <p>{props.error}</p> : null}
    </div> : <div className="syka-image-generation-preview" style={{ aspectRatio: props.aspect || 1 }} draggable={!!props.assetId} onDragStart={event => { dragged.current = true; if (props.assetId) props.onDrag?.(event.dataTransfer); }}>
      {!props.src || !settled ? <GridReveal src={props.src} aspect={props.aspect || 1} caption={label} estimatedDuration={25000} onRevealComplete={() => setRevealed(true)} onError={props.onImageError} alt="Previsualización de la imagen generada" /> : null}
      {settled && props.src ? <img src={props.src} alt={imageLabel} draggable={false} onError={props.onImageError} /> : null}
      {actionsReady ? <button type="button" className="syka-image-generation-open" aria-label="Abrir imagen en grande" title="Abrir imagen en grande"
        onPointerDown={() => { dragged.current = false; }} onClick={event => { if (!dragged.current) { trigger.current = event.currentTarget; setExpanded(0); } }}/>:null}
    </div>}
    {!terminal ? <div className="syka-image-generation-actions-space t-resize" data-ready={actionsReady} aria-hidden={!actionsReady}>
      {actionsReady ? <div className="syka-image-generation-actions" role="group" aria-label="Acciones de la imagen">
        <svg className="syka-image-generation-arc" viewBox="0 0 152 30" aria-hidden="true" focusable="false"><path className="syka-image-generation-fill" d={ACTIONS_OUTLINE + ' Z'} /><path className="syka-image-generation-edge" d={ACTIONS_OUTLINE} /></svg>
        <a href={props.src} download={props.fileName || 'imagen-syka.png'} aria-label="Descargar imagen generada" title="Descargar imagen"><Download aria-hidden="true" /></a>
        <button type="button" disabled={!props.assetId && !props.onInsert} onClick={props.onInsert} aria-label="Agregar al video" title="Agregar al video"><ImagePlus aria-hidden="true" /></button>
        <button type="button" ref={trigger} aria-label="Ampliar imagen generada" title="Ampliar imagen" onClick={event => { trigger.current = event.currentTarget; setExpanded(0); }}><Expand aria-hidden="true" /></button>
      </div> : null}
    </div> : null}
    {props.src && props.status === 'ready' ? <span className="syka-image-generation-status" role="status">{label}</span> : null}
    {props.src ? <AgentImageLightbox images={[{id: props.assetId || 'generated', name: imageLabel, previewUrl: props.src}]} activeIndex={expanded} onActiveIndexChange={setExpanded} triggerRef={trigger} /> : null}
  </section>;
}
