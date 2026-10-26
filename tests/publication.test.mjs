import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDay, validateArtworks } from '../scripts/content-validation.mjs';
import { localDay, planPublication, readPublication, validateQueue } from '../scripts/publication.mjs';

const timestamp = '2026-10-26T01:00:00.000Z';
const now = new Date('2026-10-27T00:37:00.000Z');
function artwork(id) {
  return { id, title: id, titleOriginal: id, creator: 'Test', year: '1900', category: 'art', methods: ['pattern'], topics: ['test'], sourceUrl: 'https://example.org/' + id,
    imageKey: id + '.jpg', width: 10, height: 10, rights: { label: 'Test rights', url: 'https://example.org/rights', credit: 'Test', usage: 'Test fixture' },
    observation: 'Visible shapes', evidence: 'Test record', analysis: { structure: 'Shapes', borrow: 'Pattern', application: 'Test' }, addedAt: timestamp,
    writing: { author: 'codex', generatedAt: timestamp, inputHash: 'a'.repeat(64), referenceSources: ['https://example.org'] } };
}
function fixtures() {
  const ids = ['old-a', 'old-b', 'old-c', 'next-a', 'next-b', 'next-c', 'later-a', 'later-b', 'later-c'];
  return {
    library: { artworks: ids.map(artwork), batches: [{ id: 'launch', date: '2026-10-26', featuredIds: ids.slice(0, 3), status: 'published', count: 3, createdAt: timestamp }], latestSuccess: timestamp },
    queue: { version: 1, issues: [
      { id: 'queue-next', title: 'Next', notBefore: '2026-10-27', approvedBy: 'codex', approvedAt: timestamp, featuredIds: ids.slice(3, 6), artworks: [] },
      { id: 'queue-later', title: 'Later', notBefore: '2026-10-28', approvedBy: 'human', approvedAt: timestamp, featuredIds: ids.slice(6), artworks: [] },
    ] },
  };
}

test('publication uses UTC+8 calendar day at the UTC midnight boundary', () => {
  assert.equal(localDay(new Date('2026-10-26T15:59:59Z')), '2026-10-26');
  assert.equal(localDay(new Date('2026-10-26T16:00:00Z')), '2026-10-27');
  assert.equal(isDay('2026-02-30'), false);
});
test('publishes one due issue without changing past works, provenance or issues', () => {
  const { library, queue } = fixtures(), original = structuredClone({ library, queue });
  const plan = planPublication(library, queue, now);
  assert.equal(plan.batch.id, 'daily-2026-10-27');
  assert.equal(plan.batch.createdAt, now.toISOString());
  assert.equal(plan.batch.queueId, 'queue-next');
  assert.equal(plan.queue.issues.length, 1);
  assert.deepEqual(plan.library.artworks, library.artworks);
  assert.deepEqual(plan.library.batches.slice(1), library.batches);
  assert.deepEqual({ library, queue }, original);
});
test('retries do not consume another issue, including after inventory is exhausted', () => {
  const { library, queue } = fixtures(); queue.issues.pop();
  const first = planPublication(library, queue, now);
  const retry = planPublication(first.library, first.queue, now);
  assert.equal(retry.changed, false);
  assert.deepEqual(retry.library, first.library);
  assert.equal(retry.queue.issues.length, 0);
});
test('manual issues on the same day also prevent automatic duplicates', () => {
  const { library, queue } = fixtures();
  assert.equal(planPublication(library, queue, new Date(timestamp)).changed, false);
});
test('future entries wait; missed days publish only one issue under the actual day', () => {
  const { library, queue } = fixtures();
  queue.issues.forEach(issue => issue.notBefore = '2026-10-28');
  assert.equal(planPublication(library, queue, now).changed, false);
  const delayed = planPublication(library, queue, new Date('2026-10-30T02:00:00Z'));
  assert.equal(delayed.batch.date, '2026-10-30');
  assert.equal(delayed.library.batches.length, 2);
  assert.equal(delayed.queue.issues.length, 1);
});
test('empty inventory fails clearly when today has no issue', () => {
  const { library } = fixtures();
  assert.throws(() => planPublication(library, { version: 1, issues: [] }, now), /queue is empty/);
});
test('queue rejects unknown works, repeats, malformed dates, and unapproved content', () => {
  for (const mutate of [
    q => q.issues[0].featuredIds[0] = 'unknown',
    q => q.issues[0].featuredIds[0] = 'old-a',
    q => q.issues[1].featuredIds[0] = 'next-a',
    q => q.issues[0].featuredIds.pop(),
    q => q.issues[0].notBefore = '2026-02-30',
    q => q.issues[0].approvedBy = '',
    q => q.issues[0].approvedAt = 'not a date',
  ]) {
    const { library, queue } = fixtures(); mutate(queue);
    assert.throws(() => validateQueue(library, queue));
  }
});
test('consumed queue IDs cannot be replayed', () => {
  const { library, queue } = fixtures(); library.batches[0].queueId = queue.issues[0].id;
  assert.throws(() => validateQueue(library, queue), /Duplicate queue/);
});
test('rehearsal prepares the next future issue without mutating its input', () => {
  const { library, queue } = fixtures();
  const plan = planPublication(library, queue, new Date(timestamp), true);
  assert.equal(plan.batch.date, '2026-10-27');
  assert.equal(queue.issues.length, 2);
  assert.equal(library.batches.length, 1);
});
test('new artwork ingestion preserves writing provenance and uses actual ingestion time', () => {
  const { library, queue } = fixtures();
  const added = artwork('brand-new'); queue.issues[0].artworks.push(added); queue.issues[0].featuredIds[0] = added.id;
  const plan = planPublication(library, queue, now);
  assert.equal(plan.library.artworks[0].addedAt, now.toISOString());
  assert.deepEqual(plan.library.artworks[0].writing, added.writing);
});
test('duplicate image bytes are rejected even under distinct IDs and filenames', () => {
  const bytes = Buffer.alloc(150, 1); bytes[0] = 255; bytes[1] = 216;
  assert.throws(() => validateArtworks([artwork('image-a'), artwork('image-b')], () => bytes), /Duplicate image/);
});
test('publisher moves approved new media only when publishing, and repeated runs are byte-identical', () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-publish-'));
  try {
    const { library, queue } = fixtures();
    library.batches[0].date = '2020-01-01'; library.batches[0].createdAt = library.latestSuccess = '2020-01-01T00:00:00Z';
    const today = localDay(new Date()); queue.issues[0].notBefore = today; queue.issues[1].notBefore = today;
    const added = artwork('brand-new'); queue.issues[0].artworks.push(added); queue.issues[0].featuredIds[0] = added.id;
    for (const dir of ['content/queue-media', 'public/media']) mkdirSync(join(root, dir), { recursive: true });
    cpSync(fileURLToPath(new URL('../scripts', import.meta.url)), join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'content/library.json'), JSON.stringify(library, null, 2) + '\n');
    writeFileSync(join(root, 'content/publication-queue.json'), JSON.stringify(queue));
    for (const [index, a] of [...library.artworks, added].entries()) {
      const bytes = Buffer.alloc(150, index); bytes[0] = 255; bytes[1] = 216;
      writeFileSync(join(root, a.id === added.id ? 'content/queue-media' : 'public/media', a.imageKey), bytes);
    }
    const script = join(root, 'scripts/publish-daily.mjs');
    const before = readFileSync(join(root, 'content/library.json'));
    const env = { ...process.env }; delete env.GITHUB_OUTPUT; delete env.GITHUB_STEP_SUMMARY;
    execFileSync(process.execPath, [script, '--dry-run'], { env });
    assert.deepEqual(readFileSync(join(root, 'content/library.json')), before);
    assert.ok(!existsSync(join(root, 'public/media', added.imageKey)));
    execFileSync(process.execPath, [script], { env });
    assert.ok(existsSync(join(root, 'public/media', added.imageKey)));
    assert.ok(!existsSync(join(root, 'content/queue-media', added.imageKey)));
    assert.equal(readPublication(root).queue.issues.length, 1);
    const published = readFileSync(join(root, 'content/library.json'));
    execFileSync(process.execPath, [script], { env });
    assert.deepEqual(readFileSync(join(root, 'content/library.json')), published);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
