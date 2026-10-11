/** @jsxImportSource react */
import type { AgentStoredAttachment } from "./syka-contracts";
import { useMemo, useRef, useState } from "react";
import { AgentImageLightbox } from "./agent-image-lightbox.js";
import { AgentMediaCarousel } from "./agent-media-carousel.js";

export function AgentAttachmentCoverFlow({ images }: { images: readonly AgentStoredAttachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const lightboxImages = useMemo(() => images.map(image => ({
    id: image.assetRef, name: image.name, previewUrl: image.previewUrl ?? image.contentUrl, contentUrl: image.contentUrl,
  })), [images]);
  if (!images.length) return null;
  return <div className="agent-attachment-depth-gallery">
    <AgentMediaCarousel images={lightboxImages} onActivate={(index, trigger) => { triggerRef.current = trigger; setLightboxIndex(index); }}/>
    <AgentImageLightbox images={lightboxImages} activeIndex={lightboxIndex === null ? null : Math.min(lightboxIndex, images.length - 1)} onActiveIndexChange={setLightboxIndex} triggerRef={triggerRef}/>
  </div>;
}
