import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './content-validation.mjs';
const bytes = readFileSync(new URL('../content/library.json', import.meta.url));
const library = JSON.parse(bytes);
const batch = library.batches[0];
const manifest = {
  version: 1,
  libraryHash: sha256(bytes),
  batchId: batch.id,
  date: batch.date,
  featuredIds: batch.featuredIds,
  images: batch.featuredIds.map(id => {
    const artwork = library.artworks.find(a => a.id === id);
    return { path: `/media/${artwork.imageKey}`, sha256: sha256(readFileSync(new URL(`../public/media/${artwork.imageKey}`, import.meta.url))) };
  }),
};
writeFileSync(new URL('../dist/publication.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Publication manifest: ${batch.id} (${manifest.libraryHash.slice(0, 12)})`);
