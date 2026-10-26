import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planPublication, readPublication } from './publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--rehearse', '--dry-run'].includes(arg))) throw new Error('Use --dry-run, --rehearse, or no arguments.');
const { library, queue } = readPublication(root);
const plan = planPublication(library, queue, new Date(), args.includes('--rehearse'));
const dryRun = args.includes('--dry-run');
if (plan.changed && !dryRun) {
  for (const a of plan.issue.artworks) {
    const target = join(root, 'public/media', a.imageKey);
    if (existsSync(target)) throw new Error(`Refusing to overwrite ${a.imageKey}`);
    copyFileSync(join(root, 'content/queue-media', a.imageKey), target);
  }
  for (const [name, data] of [['library.json', plan.library], ['publication-queue.json', plan.queue]]) {
    const target = join(root, 'content', name);
    let text = JSON.stringify(data, null, 2) + '\n';
    if (name === 'library.json') {
      // Insert new records without rewriting historical text or provenance.
      text = readFileSync(target, 'utf8');
      const eol = text.includes('\r\n') ? '\r\n' : '\n';
      const insert = (key, entries) => {
        if (!entries.length) return;
        const marker = `"${key}": [${eol}`;
        assert(text.includes(marker), `Expected formatted ${key} array`);
        const fragment = entries.map(entry => JSON.stringify(entry, null, 2).split('\n').map(line => '    ' + line).join(eol)).join(',' + eol);
        text = text.replace(marker, marker + fragment + ',' + eol);
      };
      insert('artworks', plan.library.artworks.slice(0, plan.issue.artworks.length));
      insert('batches', [plan.batch]);
      text = text.replace(/("latestSuccess"\s*:\s*)"[^"]*"/, (_, prefix) => prefix + JSON.stringify(data.latestSuccess));
      assert.deepEqual(JSON.parse(text), data);
    }
    writeFileSync(target + '.tmp', text);
    renameSync(target + '.tmp', target);
  }
  for (const a of plan.issue.artworks) unlinkSync(join(root, 'content/queue-media', a.imageKey));
  readPublication(root);
}
const message = plan.changed ? `${dryRun ? 'Would publish' : 'Prepared'} ${plan.batch.id}: ${plan.issue.title}` : plan.batch ? `Already published: ${plan.batch.id}` : 'No issue due today.';
console.log(message);
console.log(`Approved issues remaining: ${plan.queue.issues.length}`);
if (plan.queue.issues.length <= 2) console.log('::warning::Content inventory is low; prepare and approve more issues.');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${plan.changed && !dryRun}\nbatch_id=${plan.batch?.id || ''}\nremaining=${plan.queue.issues.length}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Daily publication\n\n${message}\n\nMode: ${args.includes('--rehearse') ? 'rehearsal (no production push)' : 'publish'}\n\nApproved issues remaining: **${plan.queue.issues.length}**\n`);
