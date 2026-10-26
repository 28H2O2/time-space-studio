import { fileURLToPath } from 'node:url';
import { readPublication } from './publication.mjs';
const { queue } = readPublication(fileURLToPath(new URL('../', import.meta.url)));
console.log(`Queue OK: ${queue.issues.length} approved issues, ${queue.issues.reduce((n, issue) => n + issue.artworks.length, 0)} new artworks waiting.`);
