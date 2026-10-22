import type { Artwork, Note, StyleRule } from './types.ts';
export interface Records { version: 1; notes: Record<string, Note>; rules: StyleRule[] }
export const STORAGE_KEY = 'time-space-studio:records:v1';
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(v) && !['constructor', 'prototype', '__proto__'].includes(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const date = (v: unknown): v is string => typeof v === 'string' && v.length < 50 && Number.isFinite(Date.parse(v));
const strings = (v: unknown, max: number, length: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(s => str(s, length));
export function parseRecords(raw: unknown): Records {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid backup');
  const r = raw as Records;
  if (r.version !== 1 || !r.notes || typeof r.notes !== 'object' || Array.isArray(r.notes) || !Array.isArray(r.rules) || r.rules.length > 10000 || Object.keys(r.notes).length > 10000) throw new Error('Invalid backup');
  const notes: Record<string, Note> = {};
  for (const [key, n] of Object.entries(r.notes)) {
    if (!id(key) || !n || n.artworkId !== key || typeof n.favorite !== 'boolean' || !['like', 'dislike', 'neutral'].includes(n.preference) || !str(n.note, 5000) || !strings(n.tags, 12, 500) || !date(n.updatedAt)) throw new Error('Invalid note');
    notes[key] = { artworkId: key, favorite: n.favorite, preference: n.preference, note: n.note, tags: [...n.tags], updatedAt: n.updatedAt };
  }
  const seen = new Set<string>();
  const rules = r.rules.map(r => {
    if (!r || !id(r.id) || seen.has(r.id) || !str(r.text, 2000) || !Array.isArray(r.exampleIds) || r.exampleIds.length > 100 || !r.exampleIds.every(id) || !date(r.createdAt)) throw new Error('Invalid rule');
    seen.add(r.id);
    return { id: r.id, text: r.text, exampleIds: [...r.exampleIds], createdAt: r.createdAt };
  });
  return { version: 1, notes, rules };
}
export function readRecords(): Records {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? { version: 1, notes: {}, rules: [] } : parseRecords(JSON.parse(raw));
}
export function writeRecords(records: Records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(parseRecords(records))); }
export function mergeRecords(current: Records, incoming: Records): Records {
  const result = parseRecords(current), source = parseRecords(incoming);
  for (const [id, note] of Object.entries(source.notes)) if (!result.notes[id] || Date.parse(note.updatedAt) > Date.parse(result.notes[id].updatedAt)) result.notes[id] = note;
  const rules = new Map(result.rules.map(r => [r.id, r]));
  for (const rule of source.rules) if (!rules.has(rule.id) || Date.parse(rule.createdAt) > Date.parse(rules.get(rule.id)!.createdAt)) rules.set(rule.id, rule);
  result.rules = [...rules.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return result;
}
export function recordsMarkdown(records: Records, artworks: Artwork[]): string {
  const titles = new Map(artworks.map(a => [a.id, a.title]));
  return ['# 时空图像研究室 · 我的笔记', '', ...Object.values(records.notes).flatMap(n => [`## ${titles.get(n.artworkId) || n.artworkId}`, '', `作品 ID：${n.artworkId}`, `收藏：${n.favorite ? '是' : '否'} · 判断：${({like:'喜欢',dislike:'不喜欢',neutral:'暂不判断'})[n.preference]}`, `标签：${n.tags.join('、')}`, `更新时间：${n.updatedAt}`, '', n.note, '']), '# 方法笔记', '', ...records.rules.flatMap(r => [r.text, '', `关联作品：${r.exampleIds.map(id => titles.get(id) || id).join(' / ')}`, `记录 ID：${r.id} · 创建时间：${r.createdAt}`, ''])].join('\n');
}
export function downloadRecords(records: Records, artworks: Artwork[], format: 'json' | 'markdown') {
  const blob = new Blob([format === 'json' ? JSON.stringify({ ...records, exportedAt: new Date().toISOString() }, null, 2) : recordsMarkdown(records, artworks)], { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `time-space-notes-${new Date().toISOString().slice(0, 10)}.${format === 'json' ? 'json' : 'md'}`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
