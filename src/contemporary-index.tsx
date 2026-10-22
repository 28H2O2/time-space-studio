import { ArrowUpRight } from 'lucide-react';
import references from './lib/contemporary-references.json';

export default function ContemporaryIndex({ query, category, method }: { query: string; category: string; method: string }) {
  const items = references.filter(item => (category === 'all' || item.category === category) && (method === 'all' || item.methods.includes(method)) && [item.title, item.originalTitle, item.creator, item.year, item.medium, ...item.methods].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="contemporary-index" aria-label="当代作品原站索引"><header><div className="eyebrow">原站观察 · {items.length} / {references.length}</div><h2>走进作品本身</h2><p>交互、动画与装置在作者原站看完整体验。这些条目未取得图片转载许可，保留来源与阅读提示，不计入站内图片数量。</p></header>
    <div className="reference-grid">{items.map(item => <article className="reference-entry" key={item.id}><div className="reference-kicker"><span>{item.medium}</span><span>{item.year}</span></div><h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ArrowUpRight size={17} /></a></h3><p className="reference-original">{item.originalTitle}</p><p className="reference-creator">{item.creator}</p><p>{item.summary}</p><p className="reference-borrow">{item.borrow}</p><details><summary>带着一个问题去看</summary><p>{item.question}</p><small>{item.relation}</small></details><a className="text-button" href={item.url} target="_blank" rel="noreferrer">在作者原站看作品 <ArrowUpRight size={14} /></a></article>)}</div>
    {!items.length && <p className="muted-text">当前筛选下没有原站条目。</p>}
    <p className="reference-credit">选题与阅读提示：Codex · 来源核验于 2026-10-22。建议是本站的读图练习，不代表作者自述。</p>
  </section>;
}
