'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Maximize2, Move } from 'lucide-react';
import type { Artwork } from './lib/types';
import c from './lib/copy.json';
export const imagePath = (a: Artwork) => `/media/${encodeURIComponent(a.imageKey)}`;
export default function ImageViewer({ artwork }: { artwork: Artwork }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 600, height: 450 });
  const [failed, setFailed] = useState(false);
  useEffect(() => { setZoom(1); setFailed(false); if (box.current) { box.current.scrollLeft = 0; box.current.scrollTop = 0; } }, [artwork.id]);
  useEffect(() => { const node = box.current; if (!node) return; const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight })); observer.observe(node); return () => observer.disconnect(); }, []);
  const fit = Math.min((size.width - 32) / artwork.width, (size.height - 32) / artwork.height);
  const width = Math.max(1, artwork.width * fit * zoom), height = Math.max(1, artwork.height * fit * zoom);
  const changeZoom = (value: number) => setZoom(Math.max(1, Math.min(8, value)));
  return <div className="image-viewer"><div className="viewer-toolbar"><span className="viewer-hint"><Move size={13} />{c.panHint}</span><div className="zoom-controls">
    <button aria-label={c.zoomOut} disabled={zoom === 1} onClick={() => changeZoom(zoom / 1.5)}><Minus size={16} /></button><button className="zoom-value" aria-label={c.resetZoom} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label={c.zoomIn} disabled={zoom >= 8} onClick={() => changeZoom(zoom * 1.5)}><Plus size={16} /></button><button aria-label={c.resetZoom} onClick={() => setZoom(1)}><Maximize2 size={15} /></button>
  </div></div><div ref={box} className={`zoom-viewport ${zoom > 1 ? 'pannable' : ''}`} onDoubleClick={() => setZoom(zoom === 1 ? 2 : 1)}
    onPointerDown={e => { if (zoom > 1 && e.pointerType === 'mouse' && box.current) { drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); } }}
    onPointerMove={e => { if (drag.current && box.current) { box.current.scrollLeft = drag.current.left - e.clientX + drag.current.x; box.current.scrollTop = drag.current.top - e.clientY + drag.current.y; } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {failed ? <div className="image-failure"><p>{c.imageError}</p><a href={artwork.sourceUrl} target="_blank" rel="noreferrer">{c.viewSource} ↗</a></div> : <div className="zoom-canvas" style={{ minWidth: '100%', minHeight: '100%', width: width + 32, height: height + 32 }}><img src={imagePath(artwork)} alt={artwork.title} width={width} height={height} style={{ width, height }} draggable={false} onError={() => setFailed(true)} /></div>}
  </div></div>;
}
