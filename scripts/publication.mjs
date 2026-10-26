import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDay, isTimestamp, validateArtworks, validateLibrary } from './content-validation.mjs';

export function localDay(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validateQueue(library, queue) {
  assert(queue.version === 1 && Array.isArray(queue.issues), 'Invalid publication queue');
  const ids = new Set(), selected = new Set(library.batches.flatMap(b => b.featuredIds));
  const consumed = new Set(library.batches.map(b => b.queueId).filter(Boolean));
  const known = new Set(library.artworks.map(a => a.id));
  let previousDay = '';
  for (const issue of queue.issues) {
    assert(/^queue-[a-z0-9-]+$/.test(issue.id) && !ids.has(issue.id) && !consumed.has(issue.id), `Duplicate queue item: ${issue.id}`); ids.add(issue.id);
    assert(isDay(issue.notBefore) && issue.notBefore >= previousDay, 'Queue must be ordered by notBefore'); previousDay = issue.notBefore;
    assert(typeof issue.title === 'string' && issue.title.trim(), 'Missing editorial theme');
    assert(['codex', 'dot', 'human'].includes(issue.approvedBy) && isTimestamp(issue.approvedAt), `Queue item is not approved: ${issue.id}`);
    assert(Array.isArray(issue.artworks), `Missing artworks array: ${issue.id}`);
    assert(Array.isArray(issue.featuredIds) && issue.featuredIds.length === 3 && new Set(issue.featuredIds).size === 3, `Queue item needs three distinct works: ${issue.id}`);
    const available = new Set(known);
    for (const artwork of issue.artworks) {
      assert(!known.has(artwork.id) && issue.featuredIds.includes(artwork.id), `Invalid new artwork: ${artwork.id}`);
      known.add(artwork.id); available.add(artwork.id);
    }
    for (const id of issue.featuredIds) {
      assert(available.has(id), `Unknown queued artwork: ${id}`);
      assert(!selected.has(id), `Artwork already featured or queued: ${id}`);
      selected.add(id);
    }
  }
}

export function readPublication(root) {
  const library = JSON.parse(readFileSync(join(root, 'content/library.json'), 'utf8'));
  const queue = JSON.parse(readFileSync(join(root, 'content/publication-queue.json'), 'utf8'));
  const publicImage = a => readFileSync(join(root, 'public/media', a.imageKey));
  const { images } = validateLibrary(library, publicImage);
  assert.deepEqual(readdirSync(join(root, 'public/media')).sort(), [...images].sort(), 'Unreferenced public media');
  validateQueue(library, queue);
  const incoming = queue.issues.flatMap(issue => issue.artworks);
  const publicIds = new Set(library.artworks.map(a => a.id));
  validateArtworks([...library.artworks, ...incoming], a => publicIds.has(a.id) ? publicImage(a) : readFileSync(join(root, 'content/queue-media', a.imageKey)));
  assert.deepEqual(readdirSync(join(root, 'content/queue-media')).filter(name => name !== '.gitkeep').sort(), incoming.map(a => a.imageKey).sort(), 'Unreferenced queue media');
  return { library, queue };
}

export function planPublication(library, queue, now = new Date(), rehearse = false) {
  assert(Number.isFinite(now.getTime()), 'Invalid clock');
  validateQueue(library, queue);
  let day = localDay(now);
  const existing = library.batches.find(batch => batch.date === day);
  if (existing && !rehearse) return { changed: false, batch: existing, library, queue };
  if (rehearse && existing) day = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  const issue = queue.issues[0];
  assert(issue, 'Publication queue is empty; prepare and approve more content.');
  if (rehearse && issue.notBefore > day) day = issue.notBefore;
  if (issue.notBefore > day) return { changed: false, batch: null, library, queue };
  assert(now.getTime() >= Date.parse(library.latestSuccess), 'Clock precedes the latest publication');
  const createdAt = now.toISOString();
  const batch = { id: `daily-${day}`, date: day, featuredIds: [...issue.featuredIds], status: 'published', count: 3, createdAt, queueId: issue.id };
  assert(!library.batches.some(b => b.id === batch.id || b.date === day), `Date already published: ${day}`);
  return {
    changed: true, batch, issue,
    library: { ...library, artworks: [...issue.artworks.map(a => ({ ...a, addedAt: createdAt })), ...library.artworks], batches: [batch, ...library.batches], latestSuccess: createdAt },
    queue: { ...queue, issues: queue.issues.slice(1) },
  };
}
