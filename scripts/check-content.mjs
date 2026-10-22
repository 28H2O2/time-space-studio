import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const data = JSON.parse(readFileSync(new URL('../content/library.json', import.meta.url)));
const media = new URL('../public/media/', import.meta.url);
const ids = new Set(), images = new Set(), hashes = new Set(), sources = new Set();
const date = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const text = v => typeof v === 'string' && v.trim().length > 0;
const url = v => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
assert(Array.isArray(data.artworks) && data.artworks.length > 0);
for (const a of data.artworks) {
  assert(/^[a-z0-9][a-z0-9-]+$/.test(a.id) && !a.id.startsWith('personal-'), `Invalid id: ${a.id}`);
  assert(!ids.has(a.id), `Duplicate artwork: ${a.id}`); ids.add(a.id);
  assert(['time-space', 'graphic', 'art'].includes(a.category), `Invalid category: ${a.id}`);
  for (const key of ['title','titleOriginal','creator','year','observation','evidence']) assert(text(a[key]), `Missing ${key}: ${a.id}`);
  assert(url(a.sourceUrl), `Invalid source: ${a.id}`);
  // Several details may share an institutional source page. IDs and image bytes must still be unique.
  sources.add(a.sourceUrl);
  for (const key of ['methods','topics']) assert(Array.isArray(a[key]) && a[key].length && a[key].every(text), `Missing ${key}: ${a.id}`);
  for (const key of ['structure','borrow','application']) assert(text(a.analysis?.[key]), `Missing analysis: ${a.id}`);
  for (const key of ['label','credit','usage']) assert(text(a.rights?.[key]), `Missing rights: ${a.id}`);
  assert(url(a.rights.url), `Invalid rights URL: ${a.id}`);
  assert(date(a.addedAt) && date(a.writing?.generatedAt), `Invalid date: ${a.id}`);
  assert(/^[a-f0-9]{64}$/.test(a.writing.inputHash), `Missing input hash: ${a.id}`);
  if (a.writing.author) {
    assert(['dot','codex'].includes(a.writing.author));
    assert(Array.isArray(a.writing.referenceSources) && a.writing.referenceSources.length && a.writing.referenceSources.every(url));
  } else assert(['gemini-4-argon','factory/gemini-4-argon'].includes(a.writing.model));
  assert(Number.isInteger(a.width) && a.width > 0 && Number.isInteger(a.height) && a.height > 0);
  assert(/^[a-z0-9][a-z0-9-]+\.(jpg|png)$/.test(a.imageKey) && !a.imageKey.startsWith('personal-'));
  assert(!images.has(a.imageKey)); images.add(a.imageKey);
  const bytes = readFileSync(new URL(a.imageKey, media));
  assert(bytes.length > 100 && bytes.length < 20_000_000, `Invalid image size: ${a.imageKey}`);
  assert(a.imageKey.endsWith('.png') ? bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 255 && bytes[1] === 216, `Invalid image bytes: ${a.imageKey}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert(!hashes.has(hash), `Duplicate image: ${a.imageKey}`); hashes.add(hash);
}
assert.deepEqual(readdirSync(media).sort(), [...images].sort(), 'Unreferenced media is not allowed in the public folder');
const batches = new Set();
for (const b of data.batches) {
  assert(!batches.has(b.id)); batches.add(b.id);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(b.date) && date(b.createdAt) && b.status === 'published');
  assert(Number.isInteger(b.count) && b.count >= b.featuredIds.length && b.count <= ids.size);
  assert(b.featuredIds.length === 3 && new Set(b.featuredIds).size === 3 && b.featuredIds.every(id => ids.has(id)), `Invalid issue: ${b.id}`);
}
assert(data.batches.length && date(data.latestSuccess));
assert(data.latestSuccess === data.batches[0].createdAt, 'latestSuccess must match the latest issue');
for (let i=1;i<data.batches.length;i++) assert(Date.parse(data.batches[i-1].createdAt) >= Date.parse(data.batches[i].createdAt), 'Issues must be newest first');
const references = JSON.parse(readFileSync(new URL('../src/lib/contemporary-references.json',import.meta.url)));
assert(references.every(r => url(r.url) && text(r.title) && text(r.summary)));
// Scan only files that belong in the public source tree. Never print matching secret values.
const root = new URL('../',import.meta.url);
function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules','dist','.git'].includes(name)) continue;
    const path = new URL(name,dir), stat = statSync(path);
    assert(!/^\.env/.test(name) && !['.openai','.wrangler','wrangler.jsonc'].includes(name), `Private configuration: ${name}`);
    if (stat.isDirectory()) { scan(new URL(name+'/',dir)); continue; }
    if (/\.(png|jpe?g)$/.test(name)) continue;
    const body = readFileSync(path,'utf8');
    assert(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(body), `Credential-like content in ${name}`);
    if (['.json','.tsx','.ts'].some(ext => name.endsWith(ext)) && name !== 'check-content.mjs') assert(!/personal-(?:move-schedule|room-options|room-history)|siwc_bypass_bearer_token|CURATOR_TOKEN|OWNER_EMAIL/.test(body), `Private data in ${name}`);
  }
}
scan(root);
console.log(`Content OK: ${ids.size} artworks, ${images.size} images, ${batches.size} issues, ${references.length} external references.`);
