'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, Plus, X } from 'lucide-react';
import type { Artwork, Note } from './lib/types';
import ImageViewer from './image-viewer';
import c from './lib/copy.json';
export const categories = { 'time-space': c.timeSpace, graphic: c.graphic, art: c.art };
export const shortDate = (date: string) => date ? new Date(date).toLocaleDateString('zh-CN', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
export default function ArtworkDetail({ artwork, note, compared, externallySaving, onClose, onCompare, onSave }: { artwork: Artwork; note: Note; compared: boolean; externallySaving: boolean; onClose: () => void; onCompare: () => void; onSave: (note: Note) => Promise<void> }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [draft, setDraft] = useState<Note>(note);
  const [tags, setTags] = useState(note.tags.join('，'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = useRef(false);
  const draftKey = 'studio-draft-' + artwork.id;
  const busy = saving || externallySaving;
  function change(next: Note, nextTags = tags) { dirty.current = true; setDraft(next); setTags(nextTags); setSaved(false); try { sessionStorage.setItem(draftKey, JSON.stringify({ note: next, tags: nextTags })); } catch { /* Saving remains available through localStorage. */ } }
  useEffect(() => { try { const raw = sessionStorage.getItem(draftKey); if (raw) { const cached = JSON.parse(raw); if (cached.note?.artworkId === artwork.id) { setDraft(cached.note); setTags(cached.tags || ''); dirty.current = true; return; } } } catch {} if (!dirty.current) { setDraft(note); setTags(note.tags.join('，')); } }, [artwork.id, note.updatedAt]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab' && dialog.current) {
        const all = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]'));
        const first = all[0], last = all[all.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  async function save(next = draft) {
    setSaving(true); setSaved(false);
    try { await onSave({ ...next, tags: tags.split(/[,，]/).map(x => x.trim()).filter(Boolean).slice(0, 12) }); dirty.current = false; sessionStorage.removeItem(draftKey); setSaved(true); } catch { /* Parent shows the save failure. */ } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="detail-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
    <div className="detail-top"><span>{categories[artwork.category]}<span className="separator">/</span>{artwork.year}</span><button className="icon-button" aria-label={c.close} onClick={onClose}><X size={22} /></button></div>
    <div className="detail-body"><section className="detail-visual"><ImageViewer artwork={artwork} /><div className="detail-credit">{artwork.rights.credit}</div></section><aside className="detail-text">
      <h1 id="detail-title">{artwork.title}</h1><p className="original-title">{artwork.titleOriginal}</p><p className="creator-line">{artwork.creator}<span> · {artwork.year}</span></p>
      <div className="tag-row">{artwork.methods.map(m => <span key={m}>{m}</span>)}</div>
      <div className="analysis-block">{(['structure', 'borrow', 'application'] as const).map(key => <section key={key}><h2>{c[key]}</h2><p>{artwork.analysis[key]}</p></section>)}</div>
      <div className="detail-actions">{<button className={`text-button ${draft.favorite ? 'selected' : ''}`} disabled={busy} onClick={() => { const next = { ...draft, favorite: !draft.favorite }; setDraft(next); void save(next); }}><Bookmark size={15} fill={draft.favorite ? 'currentColor' : 'none'} />{draft.favorite ? c.favorited : c.favorite}</button>}<button className="text-button" onClick={onCompare}>{compared ? <Check size={16} /> : <Plus size={16} />}{compared ? c.removeCompare : c.addCompare}</button></div>
      {<section className="note-editor"><h2>{c.noteLabel}</h2><div className="preference-group">{(['like', 'dislike', 'neutral'] as const).map(value => <button key={value} disabled={busy} aria-pressed={draft.preference === value} className={draft.preference === value ? 'selected' : ''} onClick={() => { change({ ...draft, preference: value }); }}>{c[value]}</button>)}</div>
        <textarea disabled={busy} aria-label={c.noteLabel} placeholder={c.notePlaceholder} value={draft.note} maxLength={5000} onChange={e => { change({ ...draft, note: e.target.value }); }} /><input disabled={busy} aria-label={c.tagsLabel} placeholder={c.tagsPlaceholder} value={tags} maxLength={500} onChange={e => { change(draft, e.target.value); }} />
        <div className="save-row"><span aria-live="polite">{saved ? c.saved : ''}</span><button className="solid-button" disabled={busy} onClick={() => void save()}>{saving ? c.saving : c.saveNote}<ArrowRight size={16} /></button></div>
      </section>}
      <details className="provenance"><summary>{c.rights}</summary><p>{artwork.rights.label}</p><p>{artwork.rights.usage}</p>{artwork.rights.url && <a href={artwork.rights.url} target="_blank" rel="noreferrer">{c.rights} ↗</a>}<p>{artwork.evidence}</p></details>
      <details className="provenance"><summary>{c.writing}</summary>
        {artwork.writing.author ? <>
          <p>{artwork.writing.author === 'dot' ? 'dot' : 'Codex'} 撰写 · <time dateTime={artwork.writing.generatedAt}>{artwork.writing.generatedAt}</time></p>
          <p>输入 SHA-256：{artwork.writing.inputHash}</p>
          {artwork.writing.referenceSources.map((url, index) => <p key={url}><a href={url} target="_blank" rel="noreferrer">参考来源 {index + 1} ↗</a></p>)}
        </> : <p>{artwork.writing.model} · {shortDate(artwork.writing.generatedAt)}</p>}
        <p>{c.dateLabel}：{shortDate(artwork.addedAt)}</p>
      </details>
      {artwork.sourceUrl && <a className="source-link" href={artwork.sourceUrl} target="_blank" rel="noreferrer">{c.viewSource}<ArrowUpRight size={17} /></a>}
    </aside></div>
  </div></div>;
}
