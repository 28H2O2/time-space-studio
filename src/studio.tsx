'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Bookmark, Check, Plus, X, Search, SlidersHorizontal, Download, Languages } from 'lucide-react';
import type { Artwork, Note, StyleRule, LibraryResponse, Reference } from './lib/types';
import ArtworkDetail from './artwork-detail';
import ImageViewer, { imagePath } from './image-viewer';
import libraryData from '../content/library.json';
import libraryEn from '../content/library.en.json';
import { readRecords, writeRecords, parseRecords, mergeRecords, downloadRecords } from './lib/records';
import ContemporaryIndex from './contemporary-index';
import contemporaryReferences from './lib/contemporary-references.json';
import referencesEn from './lib/contemporary-references.en.json';
import { LANG_KEY, compareText, formatDate, formatDateTime, localizeArtworks, localizeReferences, resolveLang } from './lib/i18n';
import type { Lang, Overlays, ReferenceOverlay } from './lib/i18n';
import { LangProvider, categoryLabels, copies } from './lib/lang';
type View = 'today' | 'library' | 'compare' | 'notes';
const emptyNote = (id: string): Note => ({ artworkId: id, favorite: false, preference: 'neutral', note: '', tags: [], updatedAt: '' });
const baseReferences = contemporaryReferences as Reference[];
function initialLang(): Lang {
  let stored: string | null = null;
  try { stored = localStorage.getItem(LANG_KEY); } catch { /* Language choice is optional. */ }
  return resolveLang(location.search, stored, navigator.language);
}
export default function Studio() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const c = copies[lang], categories = categoryLabels(c);
  const [view, setView] = useState<View>('today');
  const [collection, setCollection] = useState('all');
  const [library, setLibrary] = useState<LibraryResponse>({ artworks: [], batches: [], latestSuccess: null });
  const [notes, setNotes] = useState<Record<string, Note>>({}), [rules, setRules] = useState<StyleRule[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [method, setMethod] = useState('all');
  const [selected, setSelected] = useState<string | null>(null), [compare, setCompare] = useState<string[]>(['', '']);
  const [batchId, setBatchId] = useState(''), [toast, setToast] = useState(''), [ruleText, setRuleText] = useState('');
  const [ruleBusy, setRuleBusy] = useState(false), [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingNotes, setPendingNotes] = useState<Set<string>>(new Set());
  const savingIds = useRef(new Set<string>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string) { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3500); }
  async function load() {
    setLoading(true); setError(false);
    try { const data = libraryData as LibraryResponse; setLibrary(data); setBatchId(data.batches[0]?.id || '');
      try { const saved = readRecords(); setNotes(saved.notes); setRules(saved.rules); } catch { notify(c.notesReadFailed); }
    } catch { setError(true); } finally { setLoading(false); }
  }
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = c.docTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', c.docDescription);
  }, [lang, c]);
  function switchLang() { const next: Lang = lang === 'zh' ? 'en' : 'zh'; setLang(next); try { localStorage.setItem(LANG_KEY, next); } catch { /* The choice still applies for this visit. */ } }
  useEffect(() => {
    void load();
    const read = () => { const params = new URLSearchParams(location.search), v = params.get('view'); setView(['today', 'library', 'compare', 'notes'].includes(v || '') ? v as View : 'today'); setSelected(params.get('work')); setCollection(params.get('collection') === 'contemporary' ? 'contemporary' : 'all'); };
    read(); window.addEventListener('popstate', read);
    try { const saved = JSON.parse(sessionStorage.getItem('studio-compare') || '[]'); if (Array.isArray(saved)) setCompare([...saved.filter(x => typeof x === 'string'), '', ''].slice(0, 2)); } catch { /* Nonessential view preference. */ }
    return () => { window.removeEventListener('popstate', read); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  function navigate(next: View) { setView(next); setSelected(null); history.pushState({}, '', `/?view=${next}${collection === 'contemporary' && next === 'library' ? '&collection=contemporary' : ''}`); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function chooseCollection(next: string) { setCollection(next); setCategory('all'); setQuery(''); setMethod('all'); setView('library'); setSelected(null); history.pushState({}, '', '/?view=library' + (next === 'contemporary' ? '&collection=contemporary' : '')); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function open(id: string) { setSelected(id); history.pushState({}, '', `/?view=${view}${collection === 'contemporary' ? '&collection=contemporary' : ''}&work=${encodeURIComponent(id)}`); }
  function close() { setSelected(null); history.replaceState({}, '', `/?view=${view}${collection === 'contemporary' ? '&collection=contemporary' : ''}`); }
  function updateCompare(next: string[]) { const slots = [...next, '', ''].slice(0, 2); setCompare(slots); sessionStorage.setItem('studio-compare', JSON.stringify(slots)); }
  function toggleCompare(id: string) { const next = [...compare]; const current = next.indexOf(id); if (current >= 0) next[current] = ''; else { const empty = next.findIndex(x => !x); if (empty < 0) { notify(c.compareFull); return; } next[empty] = id; } updateCompare(next); }
  const importFile = useRef<HTMLInputElement>(null);
  async function saveNote(note: Note) {
    savingIds.current.add(note.artworkId); setPendingNotes(new Set(savingIds.current));
    try { const current = readRecords(); const next = { ...current, notes: { ...current.notes, [note.artworkId]: { ...note, updatedAt: new Date().toISOString() } } }; writeRecords(next); setNotes(next.notes); setRules(next.rules); notify(c.noteSaved); }
    catch { notify(c.saveFailed); throw new Error(c.saveFailed); }
    finally { savingIds.current.delete(note.artworkId); setPendingNotes(new Set(savingIds.current)); }
  }
  function favorite(a: Artwork) { void saveNote({ ...(notes[a.id] || emptyNote(a.id)), favorite: !notes[a.id]?.favorite }).catch(() => {}); }
  async function addRule() {
    if (!ruleText.trim()) return; setRuleBusy(true);
    try { const current = readRecords(); const next = { ...current, rules: [{ id: crypto.randomUUID(), text: ruleText.trim(), exampleIds: compare.filter(Boolean), createdAt: new Date().toISOString() }, ...current.rules] }; writeRecords(next); setRules(next.rules); setNotes(next.notes); setRuleText(''); notify(c.ruleSaved); } catch { notify(c.saveFailed); } finally { setRuleBusy(false); }
  }
  async function deleteRule(id: string) { try { const next = readRecords(); next.rules = next.rules.filter(r => r.id !== id); writeRecords(next); setRules(next.rules); } catch { notify(c.rulesDeleteError); } }
  function exportData(format: 'json' | 'markdown') { try { downloadRecords(readRecords(), artworks, format, lang); } catch { notify(c.exportError); } }
  async function importData(file?: File) {
    if (!file) return;
    try { if (file.size > 5_000_000) throw new Error('too large'); const next = mergeRecords(readRecords(), parseRecords(JSON.parse(await file.text()))); writeRecords(next); setNotes(next.notes); setRules(next.rules); notify(c.importOk); }
    catch { notify(c.importFailed); }
    finally { if (importFile.current) importFile.current.value = ''; }
  }
  const artworks = useMemo(() => localizeArtworks(library.artworks, lang === 'en' ? (libraryEn.artworks as Overlays) : null), [library.artworks, lang]);
  const references = useMemo(() => localizeReferences(baseReferences, lang === 'en' ? (referencesEn as Record<string, ReferenceOverlay>) : null), [lang]);
  // Collection membership comes from the original topic so it does not depend on the display language.
  const contemporaryIds = useMemo(() => new Set(library.artworks.filter(a => a.topics.includes('当代观察')).map(a => a.id)), [library.artworks]);
  const methods = useMemo(() => Array.from(new Set([...artworks.flatMap(a => a.methods), ...(collection === 'contemporary' ? references.flatMap(a => a.methods) : [])])).sort((a, b) => { const major = c.majorMethods; const ai = major.indexOf(a), bi = major.indexOf(b); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || compareText(a, b, lang); }), [artworks, references, collection, lang, c]);
  const filtered = useMemo(() => artworks.filter(a => (collection !== 'contemporary' || contemporaryIds.has(a.id)) && (category === 'all' || a.category === category) && (method === 'all' || a.methods.includes(method)) && `${a.title} ${a.titleOriginal} ${a.creator} ${a.year} ${a.topics.join(' ')} ${a.methods.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [artworks, contemporaryIds, category, method, query, collection]);
  const selectedArtwork = artworks.find(a => a.id === selected), currentBatch = library.batches.find(b => b.id === batchId) || library.batches[0];
  const featured = (currentBatch?.featuredIds || []).map(id => artworks.find(a => a.id === id)).filter((a): a is Artwork => Boolean(a));
  const recorded = artworks.filter(a => { const n = notes[a.id]; return n && (favoritesOnly ? n.favorite : n.favorite || n.preference !== 'neutral' || n.note || n.tags.length); });
  const selectedCompare = compare.map(id => artworks.find(a => a.id === id));
  const compareCount = compare.filter(Boolean).length;
  const compareWorks = selectedCompare.filter((a): a is Artwork => Boolean(a));
  function tile(a: Artwork, index: number) {
    const compared = compare.includes(a.id), n = notes[a.id];
    return <article className="artwork-tile" key={a.id}><button className="artwork-image" onClick={() => open(a.id)} aria-label={`${c.openDetails}${c.colon}${a.title}`}><img src={imagePath(a)} alt={a.title} loading="lazy" width={a.width} height={a.height} /><span className="image-open"><ArrowUpRight size={20} /></span></button>
      <div className="tile-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>{categories[a.category]}</span><span>{a.year}</span></div><button className="tile-title" onClick={() => open(a.id)}>{a.title}</button><p className="tile-creator">{a.creator}</p>
      <div className="tile-bottom"><span className="method-label">{a.methods[0]}</span><div><button className={`icon-button ${n?.favorite ? 'active' : ''}`} aria-label={`${n?.favorite ? c.favorited : c.favorite}${c.colon}${a.title}`} aria-pressed={Boolean(n?.favorite)} disabled={pendingNotes.has(a.id)} onClick={() => favorite(a)}><Bookmark size={16} fill={n?.favorite ? 'currentColor' : 'none'} /></button><button className={`icon-button ${compared ? 'active' : ''}`} aria-label={`${compared ? c.removeCompare : c.addCompare}${c.colon}${a.title}`} aria-pressed={compared} onClick={() => toggleCompare(a.id)}>{compared ? <Check size={17} /> : <Plus size={17} />}</button></div></div>
    </article>;
  }
  return <LangProvider value={{ lang, c }}><div className="studio-shell"><header className="site-header"><a className="wordmark" href="/" onClick={e => { e.preventDefault(); navigate('today'); }}><span className="brand-symbol" aria-hidden="true"><span>{c.brandMark[0]}</span><span>{c.brandMark[1]}</span></span><strong>{c.siteTitle}</strong></a><nav aria-label={c.siteTitle}>{([['today', c.navToday], ['library', c.navLibrary], ['compare', c.navCompare], ['notes', c.navNotes]] as [View, string][]).map(([key, label]) => <button key={key} className={view === key ? 'current' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}{key === 'compare' && compareCount > 0 && <span className="count-dot">{compareCount}</span>}</button>)}</nav><button className="lang-toggle" lang={lang === 'zh' ? 'en' : 'zh'} aria-label={c.switchLang} title={c.switchLang} onClick={switchLang}><Languages size={15} />{c.switchLangShort}</button></header>
    <main>{loading ? <div className="loading-state"><span className="loading-mark" />{c.loading}</div> : error ? <div className="empty-state"><p>{c.loadFailed}</p><button className="text-button" onClick={() => void load()}>{c.retry}<ArrowRight size={16} /></button></div> : <>
      {view === 'today' && <><section className="page-heading today-heading"><div><div className="eyebrow">{currentBatch?.date.replaceAll('-', ' . ') || '—'}</div><h1>{c.todayTitle}</h1></div><div className="issue-picker"><span>{c.todayArchive}</span><select aria-label={c.todayArchive} value={currentBatch?.id || ''} onChange={e => setBatchId(e.target.value)}>{library.batches.map(b => <option key={b.id} value={b.id}>{b.date} · {b.id.startsWith('launch') ? c.issueLaunch : b.id.startsWith('contemporary') ? c.issueContemporary : c.issueDaily}</option>)}</select></div></section>
        {featured.length ? <div className="daily-grid">{featured.map((a, i) => <div className={`daily-work work-${i}`} key={a.id}>{tile(a, i)}<div className="daily-reading"><p>{a.analysis.borrow}</p></div></div>)}</div> : <div className="empty-state">{c.todayEmpty}</div>}
        <section className="contemporary-entry"><h2>{c.contemporaryTitle}</h2><button className="text-button" onClick={() => chooseCollection('contemporary')}>{c.viewCollection}<ArrowRight size={18} /></button></section><section className="collection-entry"><h2>{c.navLibrary}<span>{artworks.length}</span></h2><button className="text-button" onClick={() => navigate('library')}>{c.goLibrary}<ArrowRight size={18} /></button></section><div className="mini-strip">{artworks.filter(a => !featured.some(f => f.id === a.id)).slice(0, 6).map(a => <button key={a.id} onClick={() => open(a.id)}><img src={imagePath(a)} alt={a.title} width={a.width} height={a.height} loading="lazy" /><span>{a.title}</span></button>)}</div>
      </>}
      {view === 'library' && <><section className="page-heading"><div><h1>{collection === 'contemporary' ? c.contemporaryTitle : c.libraryTitle}</h1></div></section><div className="collection-switch" aria-label={c.collectionAria}><button aria-pressed={collection === 'all'} onClick={() => chooseCollection('all')}>{c.allImages}</button><button aria-pressed={collection === 'contemporary'} onClick={() => chooseCollection('contemporary')}>{c.contemporaryTitle}</button></div><div className="library-tools"><div className="category-tabs">{[['all', c.all], ...Object.entries(categories)].map(([key, label]) => <button key={key} className={category === key ? 'current' : ''} onClick={() => setCategory(key)}>{label}<sup>{key === 'all' ? artworks.length : artworks.filter(a => a.category === key).length}</sup></button>)}</div><div className="search-tools"><label className="search-field"><Search size={17} /><input aria-label={c.searchPlaceholder} placeholder={c.searchPlaceholder} value={query} onChange={e => setQuery(e.target.value)} /></label><label className="method-filter"><SlidersHorizontal size={15} /><select aria-label={c.allMethods} value={method} onChange={e => setMethod(e.target.value)}><option value="all">{c.allMethods}</option>{methods.map(m => <option key={m}>{m}</option>)}</select></label></div></div>{filtered.length ? <div className="gallery-grid">{filtered.map(tile)}</div> : <div className="empty-state"><p>{collection === 'contemporary' ? c.noContemporaryMatch : c.noResults}</p><button className="text-button" onClick={() => { setQuery(''); setCategory('all'); setMethod('all'); }}>{c.clearFilters}</button></div>}{collection === 'contemporary' && <ContemporaryIndex references={references} query={query} category={category} method={method} />}</>}
      {view === 'compare' && <><section className="page-heading"><div><div className="eyebrow">{String(compareCount).padStart(2, '0')} / 02</div><h1>{c.compareTitle}</h1></div>{compareCount > 0 && <button className="text-button" onClick={() => updateCompare([])}>{c.clearCompare}<X size={16} /></button>}</section><div className="compare-grid">{[0, 1].map(index => { const a = selectedCompare[index]; return <section className="compare-slot" key={index}><div className="compare-picker"><span>0{index + 1}</span><select aria-label={`${c.chooseWork} ${index + 1}`} value={a?.id || ''} onChange={e => { const next = [...compare]; if (!e.target.value || !next.includes(e.target.value)) next[index] = e.target.value; updateCompare(next); }}><option value="">{c.chooseWork}</option>{artworks.map(work => <option key={work.id} value={work.id} disabled={compare.includes(work.id) && work.id !== a?.id}>{work.title}</option>)}</select></div>{a ? <><ImageViewer artwork={a} /><div className="compare-caption"><button onClick={() => open(a.id)}>{a.title}<ArrowUpRight size={17} /></button><p>{a.creator} · {a.year}</p><div className="compare-analysis"><h3>{c.structure}</h3><p>{a.analysis.structure}</p><h3>{c.borrow}</h3><p>{a.analysis.borrow}</p></div>{a.sourceUrl && <a href={a.sourceUrl} target="_blank" rel="noreferrer">{c.viewSource} ↗</a>}</div></> : <div className="compare-placeholder"><Plus size={30} strokeWidth={1} /><p>{c.compareEmpty}</p><button className="text-button" onClick={() => navigate('library')}>{c.goLibrary}<ArrowRight size={16} /></button></div>}</section>; })}</div></>}
      {view === 'notes' && <><section className="page-heading"><div><h1>{c.notesTitle}</h1></div><div className="export-actions"><button className="text-button" onClick={() => exportData('json')}><Download size={15} />{c.exportJson}</button><button className="text-button" onClick={() => exportData('markdown')}>{c.exportMarkdown}<ArrowUpRight size={15} /></button><button className="text-button" onClick={() => importFile.current?.click()}>{c.importJson}<Plus size={15} /></button><input ref={importFile} type="file" accept=".json,application/json" hidden onChange={e => void importData(e.target.files?.[0])} /></div></section><div className="notes-layout"><section className="saved-records"><div className="section-bar"><label><input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} />{c.favoriteFilter}</label></div>{recorded.length ? recorded.map(a => { const n = notes[a.id]; return <article className="note-record" key={a.id}><button className="record-image" onClick={() => open(a.id)}><img src={imagePath(a)} alt={a.title} loading="lazy" /></button><div><div className="record-top"><button className="record-title" onClick={() => open(a.id)}>{a.title}</button>{n.favorite && <Bookmark size={15} fill="currentColor" />}</div><small>{a.creator}</small><div className="note-preference">{c[n.preference]}</div>{n.note && <p className="personal-note">{n.note}</p>}<div className="tag-row">{n.tags.map(t => <span key={t}>{t}</span>)}</div><button className="text-button" onClick={() => open(a.id)}>{c.noteLabel}<ArrowUpRight size={14} /></button></div></article>; }) : <div className="empty-state compact">{c.notesEmpty}</div>}</section><aside className="style-notes"><h2>{c.styleRules}</h2><textarea disabled={ruleBusy} aria-label={c.styleRules} placeholder={c.rulePlaceholder} maxLength={2000} value={ruleText} onChange={e => setRuleText(e.target.value)} />{compareWorks.length > 0 && <p className="rule-association">{c.ruleExamples}{c.colon}{compareWorks.map(a => a.title).join(' / ')}</p>}<button className="solid-button" disabled={!ruleText.trim() || ruleBusy} onClick={() => void addRule()}>{ruleBusy ? c.saving : c.saveRule}<Plus size={16} /></button><div className="rule-list">{rules.length ? rules.map((rule, i) => <article key={rule.id}><div className="rule-number">{String(rules.length - i).padStart(2, '0')}<button className="icon-button" aria-label={c.deleteRule} onClick={() => void deleteRule(rule.id)}><X size={13} /></button></div><p>{rule.text}</p><div className="rule-examples">{rule.exampleIds.map(id => { const a = artworks.find(x => x.id === id); return a && <button key={id} onClick={() => open(id)}>{a.title} ↗</button>; })}</div><small>{formatDate(rule.createdAt, lang)}</small></article>) : <p className="muted-text">{c.noRules}</p>}</div></aside></div></>}
    </>}</main>
    <footer className="site-footer"><div className="footer-meta"><div><small>{c.lastUpdated} · {library.latestSuccess ? formatDateTime(library.latestSuccess, lang) : c.unpublished}</small></div></div><div className="maker-signature"><a href="https://github.com/28H2O2/time-space-studio" target="_blank" rel="noreferrer">made by H2O2</a></div></footer>
    {compareCount > 0 && view !== 'compare' && !selectedArtwork && <div className="compare-dock"><span>{c.navCompare} <b>{compareCount}/2</b></span><button onClick={() => navigate('compare')}>{c.compareNow}<ArrowRight size={16} /></button></div>}<div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    {selectedArtwork && <ArtworkDetail key={selectedArtwork.id} artwork={selectedArtwork} note={notes[selectedArtwork.id] || emptyNote(selectedArtwork.id)} compared={compare.includes(selectedArtwork.id)} externallySaving={pendingNotes.has(selectedArtwork.id)} onClose={close} onCompare={() => toggleCompare(selectedArtwork.id)} onSave={saveNote} />}
  </div></LangProvider>;
}
