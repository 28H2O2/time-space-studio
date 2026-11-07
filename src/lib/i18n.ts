import type { Artwork } from './types.ts';

export type Lang = 'zh' | 'en';
export const LANG_KEY = 'time-space-studio:lang';
const isLang = (value: unknown): value is Lang => value === 'zh' || value === 'en';

// Explicit ?lang= wins so a shared link keeps its language, then the saved
// choice, then the browser language. Chinese stays the fallback.
export function resolveLang(search: string, stored: string | null, browser: string): Lang {
  const param = new URLSearchParams(search).get('lang');
  if (isLang(param)) return param;
  if (isLang(stored)) return stored;
  return /^en\b/i.test(browser) ? 'en' : 'zh';
}

export interface ArtworkOverlay {
  title?: string;
  creator?: string;
  year?: string;
  methods?: string[];
  topics?: string[];
  evidence?: string;
  analysis?: Partial<Artwork['analysis']>;
  rights?: Partial<Artwork['rights']>;
}
export type Overlays = Record<string, ArtworkOverlay>;

// Fields without an English entry keep the original text, so newly published
// works stay readable before they are translated.
export function localizeArtworks(artworks: Artwork[], overlays: Overlays | null): Artwork[] {
  if (!overlays) return artworks;
  return artworks.map(a => {
    const o = overlays[a.id];
    if (!o) return a;
    return {
      ...a,
      title: o.title ?? a.title,
      creator: o.creator ?? a.creator,
      year: o.year ?? a.year,
      methods: o.methods ?? a.methods,
      topics: o.topics ?? a.topics,
      evidence: o.evidence ?? a.evidence,
      analysis: { ...a.analysis, ...o.analysis },
      rights: { ...a.rights, ...o.rights },
    };
  });
}

export interface ReferenceOverlay { title?: string; creator?: string; medium?: string; methods?: string[]; summary?: string; borrow?: string; question?: string; relation?: string }
export function localizeReferences<T extends { id: string }>(references: T[], overlays: Record<string, ReferenceOverlay> | null): T[] {
  if (!overlays) return references;
  return references.map(r => (overlays[r.id] ? { ...r, ...overlays[r.id] } : r));
}

const locales: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US' };
const dateOptions: Record<Lang, Intl.DateTimeFormatOptions> = {
  zh: { year: 'numeric', month: '2-digit', day: '2-digit' },
  en: { year: 'numeric', month: 'short', day: 'numeric' },
};
export const formatDate = (date: string, lang: Lang) => date ? new Date(date).toLocaleDateString(locales[lang], { timeZone: 'Asia/Taipei', ...dateOptions[lang] }) : '—';
export const formatDateTime = (date: string, lang: Lang) => new Date(date).toLocaleString(locales[lang], { timeZone: 'Asia/Taipei', hour12: false, ...dateOptions[lang], hour: '2-digit', minute: '2-digit' });
export const compareText = (a: string, b: string, lang: Lang) => a.localeCompare(b, lang === 'zh' ? 'zh' : 'en');
