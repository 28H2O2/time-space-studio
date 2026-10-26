import { readFileSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { text, url, validateLibrary } from './content-validation.mjs';
const data = JSON.parse(readFileSync(new URL('../content/library.json', import.meta.url)));
const media = new URL('../public/media/', import.meta.url);
const { ids, images, batches } = validateLibrary(data, a => readFileSync(new URL(a.imageKey, media)));
assert.deepEqual(readdirSync(media).sort(), [...images].sort(), 'Unreferenced media is not allowed in the public folder');
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
