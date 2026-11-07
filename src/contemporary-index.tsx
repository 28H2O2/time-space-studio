import { ArrowUpRight } from 'lucide-react';
import type { Reference } from './lib/types';
import { useLang } from './lib/lang';

export default function ContemporaryIndex({ references, query, category, method }: { references: Reference[]; query: string; category: string; method: string }) {
  const { c } = useLang();
  const items = references.filter(item => (category === 'all' || item.category === category) && (method === 'all' || item.methods.includes(method)) && [item.title, item.originalTitle, item.creator, item.year, item.medium, ...item.methods].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="contemporary-index" aria-label={c.referencesAria}><header><h2>{c.referencesTitle}<span>{items.length} / {references.length}</span></h2></header>
    <div className="reference-grid">{items.map(item => <article className="reference-entry" key={item.id}><div className="reference-kicker"><span>{item.medium}</span><span>{item.year}</span></div><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ArrowUpRight size={17} /></a></h3><p className="reference-original">{item.originalTitle}</p><p className="reference-creator">{item.creator}</p><p>{item.summary}</p><p className="reference-borrow">{item.borrow}</p><details><summary>{c.observationQuestion}</summary><p>{item.question}</p><small>{item.relation}</small></details><a className="text-button" href={item.url} target="_blank" rel="noreferrer">{c.viewOnOriginalSite} <ArrowUpRight size={14} /></a></article>)}</div>
    {!items.length && <p className="muted-text">{c.noReferences}</p>}
    <p className="reference-credit">{c.referencesCredit}</p>
  </section>;
}
