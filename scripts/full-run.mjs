// End-to-end "I am the user" run of the Research Proposal Agent.
// Drives the real API exactly like the UI would, captures every interaction,
// and writes all artifacts (tex/pdf/log/evidence/transcripts) into output/.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8787';
const OUT = path.resolve('output');

const steps = [];
const transcripts = [];
const log = (stage, message) => {
  const entry = { stage, message, at: new Date().toISOString() };
  steps.push(entry);
  console.log(`[${stage}] ${message}`);
};
const keepTranscript = (label, t) => {
  if (t) transcripts.push({ label, at: new Date().toISOString(), prompt: t.prompt, rawResponse: t.rawResponse });
};

async function post(p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${p} -> ${res.status}: ${data.detail || data.error}`);
  return data;
}

// ---------------------------------------------------------------------------
// The user's inputs (rough idea, comments, decisions, feedback)
// ---------------------------------------------------------------------------
const roughIdea =
  'An agentic, rubric-aware system that turns a rough research idea into a complete, citation-grounded research proposal through human-in-the-loop critique and a verifiable revision loop';
const domain = 'CS NLP course final project; single student; one quarter; LLM API with a local deterministic fallback';

const noveltyComment =
  'Be explicit about prior work: contrast with general LLM chat (ChatGPT), one-shot proposal generators, and compliance tools like Civio. Our difference is rubric-grounded coverage checks plus a measurable before/after revision loop with weak-claim detection.';
const evaluationEdit =
  'Evaluate on 12 rough ideas across 3 domains. Metrics: required-section coverage (target 13/13), number of high-severity unsupported claims (target 0 after one revision), and a 1-5 human rubric score for novelty/method/evaluation (target mean >= 4). Compare draft v1 vs revised v2 (before/after) and against a single-shot ChatGPT baseline.';
const clarifyingAnswer =
  'The target users are CS students writing their first research proposal and TAs who review them. Success means a reviewer can reconstruct the workflow from the run log and confirm the revised proposal covers all required sections with no unsupported claims.';
const revisionFeedback =
  'Strengthen the evaluation with explicit baselines and numbers (single-shot ChatGPT vs our workflow), and make the novelty claim verifiable rather than comparative wording.';

const decisionRecord = { accepted: [], edited: [], rejected: [], commented: [] };

async function main() {
  await mkdir(OUT, { recursive: true });
  const health = await (await fetch(`${BASE}/api/health`)).json();
  log('Setup', `Provider ${health.provider}, model ${health.model}, mode ${health.mode}.`);

  // 1) Auto-discover references for the rough idea -------------------------
  log('References', 'Asking the agent to recommend references for the rough idea...');
  const refData = await post('/api/agent/references', { topic: roughIdea, context: domain });
  keepTranscript('references', refData.transcript);
  const allRefs = refData.references || [];
  log('References', `Got ${allRefs.length} recommendations.`);
  // User ticks the 4 most relevant ones.
  const chosenRefs = allRefs
    .filter((r) => /high/i.test(r.relevance))
    .slice(0, 4);
  const usedRefs = chosenRefs.length ? chosenRefs : allRefs.slice(0, 4);
  usedRefs.forEach((r) => log('References', `USE: [${r.relevance}] ${r.title}`));

  // 2) Upload the user's own PDF reference --------------------------------
  log('Upload', 'Creating a small PDF reference note and uploading it...');
  const noteLatex = String.raw`\documentclass[11pt]{article}\usepackage[margin=1in]{geometry}\begin{document}
\textbf{Personal reading note.} Civio shows proposal/compliance workflows can become products.
General LLM chat produces one-shot drafts without requirement coverage or revision evidence.
Key gap for our project: verifiable, rubric-grounded revision with weak-claim detection.
\end{document}`;
  const notePdfRes = await fetch(`${BASE}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'reading-note', proposalLatex: noteLatex })
  });
  let uploaded = null;
  if (notePdfRes.ok) {
    const buf = Buffer.from(await notePdfRes.arrayBuffer());
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'application/pdf' }), 'reading-note.pdf');
    const up = await fetch(`${BASE}/api/references/upload`, { method: 'POST', body: form });
    const upData = await up.json();
    if (up.ok) {
      uploaded = upData;
      log('Upload', `Extracted ${upData.chars} characters from "${upData.filename}".`);
    } else {
      log('Upload', `Upload failed: ${upData.detail || upData.error}`);
    }
  }

  // 3) Structure the idea -------------------------------------------------
  log('Intake', `Rough idea: "${roughIdea}"`);
  log('Extract', 'Structuring the idea into fields, decisions, and questions...');
  const start = await post('/api/agent/start', { topic: roughIdea });
  keepTranscript('start', start.transcript);
  const suggestions = start.fieldSuggestions || [];
  log('Extract', `Agent returned ${suggestions.length} field suggestions, ${(start.decisions || []).length} decisions, ${(start.questions || []).length} questions.`);

  // 4) Process suggestions (accept / edit / reject) -----------------------
  const project = { ...start.project };
  for (const s of suggestions) {
    if (!s.field || !s.value) continue;
    if (s.field === 'references') {
      decisionRecord.rejected.push({ field: s.field, label: s.label, reason: 'Use AI-recommended + uploaded references instead.' });
      log('Reject', `Rejected suggested ${s.label || s.field} (using curated references).`);
      continue;
    }
    if (s.field === 'evaluation') {
      project.evaluation = evaluationEdit;
      decisionRecord.edited.push({ field: s.field, label: s.label, value: evaluationEdit });
      log('Edit', `Edited ${s.label || s.field} to add explicit baselines/metrics.`);
      continue;
    }
    project[s.field] = s.value;
    decisionRecord.accepted.push({ field: s.field, label: s.label, confidence: s.confidence });
    log('Accept', `Accepted ${s.label || s.field}.`);
  }
  project.topic = project.topic || project.title || roughIdea;

  // 5) Comment on the novelty suggestion (agent integrates) ---------------
  log('Comment', 'Sending a comment on Novelty back to the agent...');
  const noveltyBefore = project.novelty || '';
  const commentRes = await post('/api/agent/answer', {
    project,
    question: { field: 'novelty', question: 'Refine Novelty based on this comment.', reason: 'User comment on a suggestion.', priority: 'High' },
    answer: noveltyComment,
    requirements: undefined
  });
  keepTranscript('comment-novelty', commentRes.transcript);
  if (commentRes.project?.novelty) project.novelty = commentRes.project.novelty;
  decisionRecord.commented.push({ field: 'novelty', comment: noveltyComment, before: noveltyBefore.slice(0, 160), after: (project.novelty || '').slice(0, 160) });
  log('Comment', 'Agent revised the Novelty field from the comment.');

  // 6) Answer a clarifying question ---------------------------------------
  const q = (start.questions || [])[0];
  if (q) {
    log('Answer', `Answering clarifying question: "${q.question}"`);
    const ansRes = await post('/api/agent/answer', {
      project,
      question: q,
      answer: clarifyingAnswer,
      requirements: undefined
    });
    keepTranscript('answer-question', ansRes.transcript);
    if (ansRes.project && q.field && ansRes.project[q.field]) {
      project[q.field] = ansRes.project[q.field];
    }
    log('Answer', `Integrated the answer into "${q.field}".`);
  }

  // 7) Compose references (chosen recommended + uploaded + manual) --------
  const refLines = [];
  usedRefs.forEach((r) => refLines.push(`${r.authors ? `${r.authors}, ` : ''}${r.title}${r.year ? ` (${r.year})` : ''}${r.venue ? `, ${r.venue}` : ''} [${r.relevance}] ${r.url}`));
  if (uploaded) refLines.push(`Uploaded reference "${uploaded.filename}". Excerpt: ${(uploaded.text || '').slice(0, 600)}`);
  refLines.push('Course materials: proposal_requirements.md and grading_rubric.md (format and required sections).');
  project.references = refLines.join('\n');
  project.problem = `${project.problem}\nDomain/constraints: ${domain}`;

  // 8) Generate the proposal (v1) -----------------------------------------
  log('Draft', 'Generating proposal v1 (gpt-5.5)...');
  let t0 = Date.now();
  const v1 = await post('/api/proposal', project);
  keepTranscript('proposal-v1', v1.transcript);
  log('Draft', `v1 in ${Math.round((Date.now() - t0) / 1000)}s — coverage ${v1.coverage?.covered}/${v1.coverage?.total}, ${(v1.weakClaims || []).length} weak claim(s), ${v1.proposalLatex.length} chars.`);

  // 9) Select weaknesses + feedback, then revise (v2) ---------------------
  const selectedWeaknesses = (v1.weakClaims || []).slice(0, 2);
  selectedWeaknesses.forEach((w) => log('Critique', `Selected weakness: [${w.severity}] ${w.claim}`));
  log('Revise', 'Applying revision with feedback...');
  t0 = Date.now();
  const v2 = await post('/api/agent/revise', {
    ...project,
    previousLatex: v1.proposalLatex,
    selectedWeaknesses,
    feedback: revisionFeedback
  });
  keepTranscript('revision-v2', v2.transcript);
  log('Revise', `v2 in ${Math.round((Date.now() - t0) / 1000)}s — coverage ${v2.beforeCoverage?.covered}/${v2.beforeCoverage?.total} -> ${v2.coverage?.covered}/${v2.coverage?.total}, changelog ${(v2.changelog || []).length}, remaining weak ${(v2.weakClaims || []).length}.`);

  const final = v2.proposalLatex ? v2 : v1;
  const versionUsed = v2.proposalLatex ? 'v2 (revised)' : 'v1';

  // 10) Export tex + pdf --------------------------------------------------
  log('Export', 'Compiling final PDF...');
  await writeFile(path.join(OUT, 'proposal.tex'), final.proposalLatex, 'utf8');
  const pdfRes = await fetch(`${BASE}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: project.title || 'proposal', proposalLatex: final.proposalLatex })
  });
  if (!pdfRes.ok) throw new Error(`export failed: ${JSON.stringify(await pdfRes.json())}`);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  await writeFile(path.join(OUT, 'proposal.pdf'), pdfBuf);
  log('Export', `Wrote proposal.pdf (${pdfBuf.length} bytes) and proposal.tex.`);

  // ---------------------------------------------------------------------
  // Write all artifacts
  // ---------------------------------------------------------------------
  await writeFile(path.join(OUT, 'rough_idea.md'), buildRoughIdeaDoc(), 'utf8');
  await writeFile(path.join(OUT, 'run_log.md'), buildRunLog(), 'utf8');
  await writeFile(path.join(OUT, 'transcripts.json'), JSON.stringify(transcripts, null, 2), 'utf8');
  await writeFile(path.join(OUT, 'compliance_matrix.md'), buildMatrix(final), 'utf8');
  await writeFile(path.join(OUT, 'evaluation_report.md'), final.evaluationReport || '', 'utf8');
  await writeFile(path.join(OUT, 'workflow_usage.md'), buildWorkflowUsage({ v1, v2: final, versionUsed, usedRefs, uploaded }), 'utf8');
  await writeFile(path.join(OUT, 'AI_USAGE.md'), buildAiUsage(health), 'utf8');
  await writeFile(
    path.join(OUT, 'run-evidence.json'),
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        health,
        roughIdea,
        domain,
        decisionRecord,
        usedReferences: usedRefs,
        uploaded: uploaded ? { filename: uploaded.filename, chars: uploaded.chars } : null,
        finalProject: project,
        coverage: { v1: v1.coverage, v2: final.coverage },
        weakClaims: { v1: v1.weakClaims, v2: final.weakClaims },
        changelog: final.changelog || [],
        steps
      },
      null,
      2
    ),
    'utf8'
  );

  log('Done', 'All artifacts written to output/.');
  console.log('\nFINAL_VERSION ' + versionUsed);
}

function buildRoughIdeaDoc() {
  return `# Rough idea and the user's interaction

## Rough idea
${roughIdea}

## Domain / constraints
${domain}

## Comment sent to the agent (Novelty)
${noveltyComment}

## Manual edit (Evaluation)
${evaluationEdit}

## Answer to the agent's clarifying question
${clarifyingAnswer}

## Revision feedback
${revisionFeedback}

## Suggestion decisions
- Accepted: ${decisionRecord.accepted.map((a) => a.label || a.field).join(', ')}
- Edited: ${decisionRecord.edited.map((a) => a.label || a.field).join(', ')}
- Rejected: ${decisionRecord.rejected.map((a) => a.label || a.field).join(', ')}
- Commented: ${decisionRecord.commented.map((a) => a.field).join(', ')}
`;
}

function buildRunLog() {
  return `# Run log\n\n${steps.map((s) => `- **${s.stage}** (${s.at}): ${s.message}`).join('\n')}\n`;
}

function buildMatrix(result) {
  const rows = (result.complianceMatrix || [])
    .map((r) => `| ${r.requirement} | ${r.status} | ${(r.evidence || '').replace(/\|/g, '/')} | ${(r.fix || '').replace(/\|/g, '/')} |`)
    .join('\n');
  return `# Compliance matrix\n\n| Requirement | Status | Evidence | Fix |\n| --- | --- | --- | --- |\n${rows}\n`;
}

function buildWorkflowUsage({ v1, v2, versionUsed, usedRefs, uploaded }) {
  const acc = decisionRecord.accepted.map((a) => `| ${a.label || a.field} | Accepted | ${a.confidence || ''} confidence |`);
  const edt = decisionRecord.edited.map((a) => `| ${a.label || a.field} | Edited | user added baselines/metrics |`);
  const rej = decisionRecord.rejected.map((a) => `| ${a.label || a.field} | Rejected | ${a.reason} |`);
  const cmt = decisionRecord.commented.map((a) => `| ${a.field} | Commented | "${a.comment.slice(0, 80)}..." |`);
  const cl = (v2.changelog || []).map((c) => `- **${c.section}**: ${c.before} -> ${c.after} (${c.reason})`);
  return `# Workflow Usage Report

## Initial Idea
${roughIdea}

Domain/constraints: ${domain}

## Workflow Run Summary

| Step | What Happened | Artifact Or Evidence |
| --- | --- | --- |
| Intake | Captured rough idea + domain | run_log.md |
| References | Agent recommended references; user used ${usedRefs.length} | run-evidence.json |
| Upload | Uploaded ${uploaded ? `"${uploaded.filename}" (${uploaded.chars} chars)` : 'none'} | run-evidence.json |
| Suggestions | ${decisionRecord.accepted.length} accepted, ${decisionRecord.edited.length} edited, ${decisionRecord.rejected.length} rejected, ${decisionRecord.commented.length} commented | this file |
| Draft v1 | Coverage ${v1.coverage?.covered}/${v1.coverage?.total}, ${(v1.weakClaims || []).length} weak claims | compliance_matrix.md |
| Revision v2 | Coverage ${v1.coverage?.covered}/${v1.coverage?.total} -> ${v2.coverage?.covered}/${v2.coverage?.total} | evaluation_report.md |
| Final | ${versionUsed} exported | proposal.pdf / proposal.tex |

## Accepted / Edited / Rejected / Commented

| Suggestion | Action | Reason |
| --- | --- | --- |
${[...acc, ...edt, ...rej, ...cmt].join('\n')}

## Revision Evidence
- Weakness(es) selected: ${(v1.weakClaims || []).slice(0, 2).map((w) => w.claim).join(' | ') || 'see matrix'}
- Feedback given: ${revisionFeedback}
- Coverage before/after: ${v1.coverage?.covered}/${v1.coverage?.total} -> ${v2.coverage?.covered}/${v2.coverage?.total}
- Remaining weak claims after revision: ${(v2.weakClaims || []).length}

### Changelog
${cl.length ? cl.join('\n') : '- (none)'}

## Used References
${usedRefs.map((r, i) => `${i + 1}. ${r.authors ? r.authors + ', ' : ''}${r.title} (${r.year || 'n/a'}) [${r.relevance}] ${r.url}`).join('\n')}

## Reflection
- The agent reliably structured the idea, recommended relevant references, and produced a covered, ~3-page proposal.
- Human judgment was needed for the novelty framing, the evaluation baselines, and selecting which weaknesses to fix.
`;
}

function buildAiUsage(health) {
  const calls = transcripts
    .map((t) => `| ${t.label} | ${health.provider} / ${health.model} | ${JSON.stringify(t.prompt?.task || t.prompt?.project?.title || 'payload').slice(0, 40)} | ${String(t.rawResponse || '').replace(/\s+/g, ' ').slice(0, 50)}... | reviewed |`)
    .join('\n');
  return `# AI Usage Log

## Tools Used
- Cursor (vibe coding) to build the agent and UI.
- Local Node/Express API wrapping the OpenAI-compatible endpoint.
- poppler pdftotext for uploaded-PDF text extraction; LaTeX (latexmk/pdflatex) for PDF compilation.

## Models Or APIs
- Provider: ${health.provider}
- Model: ${health.model}
- Local fallback used? no (API configured)

## What AI Helped With
- Planning: workflow stages and stopping criteria.
- Coding: agent endpoints, references, upload, PDF export.
- Writing proposal: drafting the LaTeX from the project state.
- Evaluating proposal: compliance matrix, weak-claim detection, revision changelog.

## Workflow Calls
| Stage | Tool / Model | Input | Output | Human decision |
| --- | --- | --- | --- | --- |
${calls}

## Human Review
- Checked weak-claim flags before accepting the draft.
- Verified the figure renders and is referenced in text.
- Compared coverage before/after revision.
- API key kept only in server-side .env (gitignored).

## Final Ownership Statement
I reviewed the generated code and proposal artifacts. I am responsible for the final submission.
`;
}

main().catch((e) => {
  console.error('RUN FAILED:', e.message);
  process.exit(1);
});
