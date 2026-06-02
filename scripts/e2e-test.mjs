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

function show(label, obj) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

const topic = 'An agent that turns a rough CS research idea into a complete, rubric-aligned research proposal through critique and revision';

const start = await post('/api/agent/start', { topic });
show('START', {
  mode: start.mode,
  provider: start.provider,
  projectTitle: start.project?.title,
  suggestionFields: (start.fieldSuggestions || []).map((s) => s.field),
  decisionFields: (start.decisions || []).map((d) => d.field),
  questions: (start.questions || []).map((q) => q.question),
  hasTranscript: Boolean(start.transcript)
});

// Build a project from accepted suggestions (accept all suggested fields).
const project = { ...start.project };
for (const s of start.fieldSuggestions || []) {
  if (s.field && s.value) project[s.field] = s.value;
}
project.topic = project.topic || project.title || topic;

const answer = await post('/api/agent/answer', {
  project,
  question: start.questions?.[0] || { field: 'novelty', question: 'note', priority: 'High' },
  answer: 'Prior work includes general LLM chat assistants and template fillers; our novelty is rubric-aware coverage checking plus a measurable before/after revision loop.'
});
show('ANSWER', {
  mode: answer.mode,
  provider: answer.provider,
  updatedNovelty: (answer.project?.novelty || '').slice(0, 80),
  suggestions: (answer.fieldSuggestions || []).length
});

const merged = { ...project, ...answer.project };

const proposal = await post('/api/proposal', merged);
show('PROPOSAL v1', {
  mode: proposal.mode,
  provider: proposal.provider,
  latexChars: (proposal.proposalLatex || '').length,
  hasKeywords: /keyword/i.test(proposal.proposalLatex || ''),
  hasNovelty: /novelty|prior work/i.test(proposal.proposalLatex || ''),
  hasFigure: /\\begin\{figure\}/.test(proposal.proposalLatex || ''),
  matrix: (proposal.complianceMatrix || []).length,
  coverage: proposal.coverage,
  weakClaims: (proposal.weakClaims || []).map((w) => `[${w.severity}] ${w.claim?.slice(0, 50)}`),
  hasTranscript: Boolean(proposal.transcript)
});

const selectedWeaknesses = (proposal.weakClaims || []).slice(0, 2);
const revise = await post('/api/agent/revise', {
  ...merged,
  previousLatex: proposal.proposalLatex,
  selectedWeaknesses,
  feedback: 'Strengthen the evaluation metrics with explicit before/after numbers.'
});
show('REVISE v2', {
  mode: revise.mode,
  provider: revise.provider,
  beforeCoverage: revise.beforeCoverage,
  afterCoverage: revise.coverage,
  changelog: (revise.changelog || []).map((c) => `${c.section}: ${c.reason}`),
  remainingWeak: (revise.weakClaims || []).length,
  hasTranscript: Boolean(revise.transcript)
});

console.log('\nALL OK');
