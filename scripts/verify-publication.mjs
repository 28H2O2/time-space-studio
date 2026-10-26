import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sha256 } from './content-validation.mjs';
const expected = JSON.parse(readFileSync(new URL('../dist/publication.json', import.meta.url)));
const site = new URL(process.env.SITE_URL || 'https://time-space-studio.vercel.app');
assert(site.protocol === 'https:', 'Production verification requires HTTPS');
const timeout = Number(process.env.VERIFY_TIMEOUT_SECONDS || '600');
assert(Number.isFinite(timeout) && timeout >= 0 && timeout <= 900, 'Invalid verification timeout');
const deadline = Date.now() + timeout * 1000;
async function get(path) {
  const url = new URL(path, site);
  url.searchParams.set('publication_check', expected.libraryHash);
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}
while (true) {
  try {
    const actual = await (await get('/publication.json')).json();
    assert.deepEqual(actual, expected, 'Production content does not yet match this build');
    await get('/');
    for (const image of expected.images) assert.equal(sha256(Buffer.from(await (await get(image.path)).arrayBuffer())), image.sha256, `Production image mismatch: ${image.path}`);
    console.log(`Verified live: ${site.origin}, ${expected.batchId}, all three image hashes match.`);
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    console.log(`Waiting for deployment: ${error.message.slice(0, 160)}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}
