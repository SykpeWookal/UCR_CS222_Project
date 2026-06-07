import { writeFileSync } from 'node:fs';

const base = 'http://127.0.0.1:8787';
async function post(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data.detail || data.error}`);
  return data;
}

const topic = 'An agent that detects and explains logical fallacies in online debate comments';

console.log('1) references...');
const refs = await post('/api/agent/references', { topic });
console.log('   mode', refs.mode, 'count', (refs.references || []).length);
for (const r of (refs.references || []).slice(0, 3)) {
  console.log(`   - [${r.relevance}] ${r.title} (${r.year}) ${r.url ? 'link:ok' : 'no-link'}`);
}

console.log('2) start...');
const start = await post('/api/agent/start', { topic });
const project = { ...start.project };
for (const s of start.fieldSuggestions || []) if (s.field && s.value) project[s.field] = s.value;
project.topic = project.topic || project.title;
// attach two chosen references into references text
project.references = (refs.references || [])
  .slice(0, 3)
  .map((r) => `${r.authors || ''} ${r.title} (${r.year || ''}) [${r.relevance}] ${r.url}`)
  .join('\n');

console.log('3) proposal (gpt-5.5, may take a while)...');
const t0 = Date.now();
const prop = await post('/api/proposal', project);
console.log('   took', Math.round((Date.now() - t0) / 1000) + 's');
const latex = prop.proposalLatex || '';
console.log('   latexChars', latex.length);
console.log('   hasTikz', /\\begin\{tikzpicture\}/.test(latex));
console.log('   figureRef', /\\ref\{/.test(latex));
console.log('   hasKeywords', /keyword/i.test(latex));
console.log('   hasNovelty', /novelty|prior work/i.test(latex));
console.log('   coverage', JSON.stringify(prop.coverage));
console.log('   weakClaims', (prop.weakClaims || []).length);
writeFileSync('/tmp/prop.tex', latex);

console.log('4) export pdf...');
const res = await fetch(`${base}/api/export/pdf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: project.title, proposalLatex: latex })
});
console.log('   status', res.status, res.headers.get('content-type'));
if (res.ok) {
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync('/tmp/prop.pdf', buf);
  console.log('   pdf bytes', buf.length, buf.slice(0, 5).toString());
} else {
  console.log('   error', JSON.stringify(await res.json()).slice(0, 300));
}
console.log('DONE');
