import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const DEFAULT_REQUIREMENTS = `Proposal must include:
- Project title
- Abstract
- Keywords
- Motivation, gap, and target context
- Novelty and relation to prior work
- Project goal
- Method or agent workflow
- Figure or diagram with caption
- Expected results and research milestones with timeline estimates
- Evaluation plan
- Risks and mitigation
- Resources, tools, or release plan
- References, assumptions, or source notes`;

export const EMPTY_PROJECT = {
  title: '',
  topic: '',
  keywords: '',
  abstract: '',
  problem: '',
  novelty: '',
  goal: '',
  method: '',
  figure: '',
  expectedResults: '',
  timeline: '',
  evaluation: '',
  risks: '',
  resources: '',
  references: '',
  requirements: DEFAULT_REQUIREMENTS
};

// field key, label, multiline?, group
export const PROJECT_FIELDS = [
  ['title', 'Project Title', false],
  ['keywords', 'Keywords', false],
  ['abstract', 'Abstract', true],
  ['problem', 'Problem / Motivation', true],
  ['novelty', 'Novelty / Prior Work', true],
  ['goal', 'Project Goal', true],
  ['method', 'Method / Agent Workflow', true],
  ['figure', 'Figure Plan', true],
  ['expectedResults', 'Expected Results', true],
  ['timeline', 'Milestones / Timeline', true],
  ['evaluation', 'Evaluation Plan', true],
  ['risks', 'Risks / Mitigation', true],
  ['resources', 'Resources', true],
  ['references', 'Sources / Assumptions', true]
];

// Fields that count toward required-section coverage.
export const REQUIRED_FIELDS = PROJECT_FIELDS.map(([field]) => field);

export const STAGES = [
  ['1', 'Intake', 'Capture the rough idea and any domain constraints'],
  ['2', 'Extract', 'Agent infers structured fields, decisions, and questions'],
  ['3', 'Decide', 'You accept, edit, choose options, and add sources'],
  ['4', 'Draft', 'Agent writes the proposal, matrix, and critique'],
  ['5', 'Revise', 'Fix weaknesses and compare coverage before vs after'],
  ['6', 'Finalize', 'Meet stopping criteria, then export proposal and evidence']
];

const MEMORY_KEY = 'proposal-agent-final-project-memory-v2';

function labelForField(field) {
  const found = PROJECT_FIELDS.find(([key]) => key === field);
  return found?.[1] || field;
}

function sourcesToReferencesText(sources, baseReferences) {
  const lines = sources
    .filter((source) => source.title || source.note || source.link)
    .map((source, index) => {
      const parts = [`[S${index + 1}] ${source.title || 'Untitled source'}`];
      if (source.link) parts.push(`(${source.link})`);
      if (source.usedFor) parts.push(`— used for ${source.usedFor}`);
      if (source.note) parts.push(`: ${source.note}`);
      return parts.join(' ');
    });
  return [baseReferences, ...lines].filter(Boolean).join('\n');
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || 'Request failed.');
  }
  return data;
}

async function exportPdfBlobUrl(proposalLatex, title) {
  const response = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, proposalLatex })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || 'PDF export failed.');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function logEntry(stage, message) {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    stage,
    message,
    at: new Date().toISOString()
  };
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}

function downloadTextFile(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function severityRank(severity) {
  const value = String(severity || '').toLowerCase();
  if (value === 'high') return 0;
  if (value === 'medium') return 1;
  return 2;
}

export function useProposalAgent() {
  const [health, setHealth] = useState({ mode: 'loading', provider: '', model: '' });
  const [topicInput, setTopicInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [fieldSuggestions, setFieldSuggestions] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [customNote, setCustomNote] = useState('');
  const [rejectedSuggestions, setRejectedSuggestions] = useState([]);
  const [sources, setSources] = useState([]);
  const [result, setResult] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedWeaknessKeys, setSelectedWeaknessKeys] = useState([]);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [runLog, setRunLog] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pdf');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [decisionIndex, setDecisionIndex] = useState(0);
  const [markedFinal, setMarkedFinal] = useState(false);
  const [memorySavedAt, setMemorySavedAt] = useState('');

  const memoryReady = useRef(false);

  const pushLog = useCallback((stage, message) => {
    setRunLog((current) => [...current, logEntry(stage, message)]);
  }, []);

  const pushTranscript = useCallback((label, transcript) => {
    if (!transcript) return;
    setTranscripts((current) => [
      ...current,
      { id: `${label}-${Date.now()}`, label, at: new Date().toISOString(), ...transcript }
    ]);
  }, []);

  const updatePdfUrl = useCallback((nextUrl) => {
    setPdfUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextUrl;
    });
  }, []);

  const clearArtifacts = useCallback(() => {
    setResult(null);
    setVersions([]);
    setSelectedWeaknessKeys([]);
    setMarkedFinal(false);
    setPdfError('');
    updatePdfUrl('');
  }, [updatePdfUrl]);

  // Load health + memory on mount.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ mode: 'offline', provider: '', model: '' });
      });

    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (raw) {
        const snapshot = JSON.parse(raw);
        setTopicInput(snapshot.topicInput || '');
        setDomainInput(snapshot.domainInput || '');
        setProject({ ...EMPTY_PROJECT, ...(snapshot.project || {}) });
        setFieldSuggestions(snapshot.fieldSuggestions || []);
        setDecisions(snapshot.decisions || []);
        setQuestions(snapshot.questions || []);
        setSources(snapshot.sources || []);
        setResult(snapshot.result || null);
        setVersions(snapshot.versions || []);
        setRunLog(snapshot.runLog || []);
        setTranscripts(snapshot.transcripts || []);
        setMarkedFinal(Boolean(snapshot.markedFinal));
        setMemorySavedAt(snapshot.savedAt || '');
      }
    } catch {
      // ignore corrupt memory
    }
    memoryReady.current = true;
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist memory.
  useEffect(() => {
    if (!memoryReady.current) return;
    if (!topicInput && !fieldSuggestions.length && !result) return;
    const snapshot = {
      savedAt: new Date().toISOString(),
      topicInput,
      domainInput,
      project,
      fieldSuggestions,
      decisions,
      questions,
      sources,
      result,
      versions,
      runLog,
      transcripts,
      markedFinal
    };
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(snapshot));
      setMemorySavedAt(snapshot.savedAt);
    } catch {
      // storage full — ignore
    }
  }, [
    topicInput,
    domainInput,
    project,
    fieldSuggestions,
    decisions,
    questions,
    sources,
    result,
    versions,
    runLog,
    transcripts,
    markedFinal
  ]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const currentSuggestion = fieldSuggestions[suggestionIndex] || null;
  const currentDecision = decisions[decisionIndex] || null;
  const currentQuestion = questions[0] || null;
  const acceptedSuggestionCount = fieldSuggestions.filter(
    (suggestion) => project[suggestion.field] === suggestion.value
  ).length;
  const acceptedCount = REQUIRED_FIELDS.filter((field) => Boolean(project[field])).length;

  const coverage = result?.coverage || { covered: 0, total: 0 };
  const weakClaims = useMemo(() => {
    const list = result?.weakClaims || [];
    return [...list].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  }, [result]);
  const highWeakCount = weakClaims.filter((item) => /^high$/i.test(item.severity)).length;

  const stoppingCriteria = useMemo(() => {
    const allCovered = coverage.total > 0 && coverage.covered === coverage.total;
    const noHighWeak = Boolean(result) && highWeakCount === 0;
    const revisedOnce = versions.length >= 2;
    return {
      allCovered,
      noHighWeak,
      revisedOnce,
      markedFinal,
      canFinalize: allCovered && noHighWeak && revisedOnce
    };
  }, [coverage, highWeakCount, result, versions, markedFinal]);

  function composeProjectForSend() {
    const referencesWithSources = sources.length
      ? sourcesToReferencesText(sources, project.references)
      : project.references;
    const domainNote = domainInput.trim()
      ? `${project.problem ? `${project.problem}\n` : ''}Domain/constraints: ${domainInput.trim()}`
      : project.problem;
    return {
      ...project,
      topic: project.topic || project.title || topicInput,
      problem: domainNote,
      references: referencesWithSources,
      requirements: DEFAULT_REQUIREMENTS
    };
  }

  function applyAgentResponse(data, { extraLog } = {}) {
    setProject((current) => ({ ...EMPTY_PROJECT, ...current, ...data.project }));
    setFieldSuggestions(data.fieldSuggestions || []);
    setDecisions(data.decisions || []);
    setQuestions(data.questions || []);
    setSuggestionIndex(0);
    setDecisionIndex(0);
    pushTranscript(extraLog || 'agent', data.transcript);
  }

  const startAgentForTopic = useCallback(
    async (nextTopic) => {
      const trimmed = String(nextTopic || '').trim();
      if (!trimmed) return;
      setStatus('starting');
      setError('');
      clearArtifacts();
      try {
        const data = await postJson('/api/agent/start', {
          topic: trimmed,
          requirements: DEFAULT_REQUIREMENTS
        });
        setProject({ ...EMPTY_PROJECT, ...data.project });
        setFieldSuggestions(data.fieldSuggestions || []);
        setDecisions(data.decisions || []);
        setQuestions(data.questions || []);
        setSuggestionIndex(0);
        setDecisionIndex(0);
        setCustomNote('');
        pushTranscript('start', data.transcript);
        setRunLog([
          logEntry('Intake', `Captured rough idea: "${trimmed}".`),
          logEntry('Extract', data.runMessage || 'Agent prepared structured suggestions.'),
          logEntry(
            'Decide',
            `Review ${(data.fieldSuggestions || []).length} fields and ${(data.decisions || []).length} decision card(s).`
          )
        ]);
      } catch (requestError) {
        setError(readError(requestError));
      } finally {
        setStatus('idle');
      }
    },
    [clearArtifacts, pushTranscript]
  );

  const startAgent = useCallback(() => startAgentForTopic(topicInput), [startAgentForTopic, topicInput]);

  const startSampleAgent = useCallback(() => {
    const sampleTopic = 'Citation-grounded agent for literature review workflows';
    setTopicInput(sampleTopic);
    return startAgentForTopic(sampleTopic);
  }, [startAgentForTopic]);

  const submitCustomNote = useCallback(async () => {
    const trimmed = customNote.trim();
    if (!trimmed) return;
    setStatus('answering');
    setError('');
    try {
      const data = await postJson('/api/agent/answer', {
        project,
        question:
          currentQuestion || {
            field: 'method',
            question: 'Integrate this user note into the project state.',
            reason: 'The user provided a custom refinement.',
            priority: 'Medium'
          },
        answer: trimmed,
        requirements: DEFAULT_REQUIREMENTS
      });
      applyAgentResponse(data, { extraLog: 'answer' });
      setCustomNote('');
      clearArtifacts();
      pushLog('Update', data.runMessage || 'Integrated custom note into the project state.');
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }, [customNote, project, currentQuestion, clearArtifacts, pushLog]);

  const updateProjectField = useCallback(
    (field, value) => {
      setProject((current) => ({
        ...current,
        [field]: value,
        topic: current.topic || current.title || topicInput
      }));
      clearArtifacts();
    },
    [clearArtifacts, topicInput]
  );

  const acceptSuggestion = useCallback(
    (suggestion) => {
      updateProjectField(suggestion.field, suggestion.value);
      setSuggestionIndex((current) => Math.min(current + 1, Math.max(fieldSuggestions.length - 1, 0)));
      pushLog('Accept', `Accepted ${suggestion.label || suggestion.field}.`);
    },
    [updateProjectField, fieldSuggestions.length, pushLog]
  );

  const skipSuggestion = useCallback(() => {
    if (!currentSuggestion) return;
    setSuggestionIndex((current) => Math.min(current + 1, Math.max(fieldSuggestions.length - 1, 0)));
    pushLog('Skip', `Skipped ${currentSuggestion.label || currentSuggestion.field}.`);
  }, [currentSuggestion, fieldSuggestions.length, pushLog]);

  const removeSuggestion = useCallback((suggestion) => {
    setFieldSuggestions((current) =>
      current.filter((item) => !(item.field === suggestion.field && item.value === suggestion.value))
    );
  }, []);

  const rejectSuggestion = useCallback(
    (suggestion) => {
      removeSuggestion(suggestion);
      setRejectedSuggestions((current) => [
        ...current,
        { field: suggestion.field, label: suggestion.label || suggestion.field, value: suggestion.value }
      ]);
      pushLog('Reject', `Rejected suggestion for ${suggestion.label || suggestion.field}.`);
    },
    [removeSuggestion, pushLog]
  );

  const editAndAcceptSuggestion = useCallback(
    (suggestion, newValue) => {
      const value = String(newValue || '').trim();
      if (!value) return;
      updateProjectField(suggestion.field, value);
      removeSuggestion(suggestion);
      pushLog('Edit', `Edited and accepted ${suggestion.label || suggestion.field}.`);
    },
    [updateProjectField, removeSuggestion, pushLog]
  );

  const commentOnSuggestion = useCallback(
    async (suggestion, comment) => {
      const trimmed = String(comment || '').trim();
      if (!trimmed) return;
      setStatus('answering');
      setError('');
      try {
        const data = await postJson('/api/agent/answer', {
          project,
          question: {
            field: suggestion.field,
            question: `Refine "${suggestion.label || suggestion.field}" based on this comment.`,
            reason: 'The student commented on a specific suggestion.',
            priority: 'High'
          },
          answer: trimmed,
          requirements: DEFAULT_REQUIREMENTS
        });
        applyAgentResponse(data, { extraLog: 'comment' });
        clearArtifacts();
        pushLog('Comment', `Commented on ${suggestion.label || suggestion.field}: "${trimmed.slice(0, 60)}".`);
      } catch (requestError) {
        setError(readError(requestError));
      } finally {
        setStatus('idle');
      }
    },
    [project, clearArtifacts, pushLog]
  );

  const chooseOption = useCallback(
    (decision, option) => {
      updateProjectField(decision.field, option.value);
      setDecisions((current) => {
        const next = current.filter((item) => item.id !== decision.id);
        setDecisionIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));
        return next;
      });
      pushLog('Decision', `Selected "${option.label}" for ${decision.title}.`);
    },
    [updateProjectField, pushLog]
  );

  const skipDecision = useCallback(() => {
    if (!currentDecision) return;
    setDecisionIndex((current) => Math.min(current + 1, Math.max(decisions.length - 1, 0)));
    pushLog('Skip', `Skipped ${currentDecision.title}.`);
  }, [currentDecision, decisions.length, pushLog]);

  const addSource = useCallback(() => {
    setSources((current) => [
      ...current,
      { id: `src-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: '', link: '', usedFor: '', note: '' }
    ]);
  }, []);

  const updateSource = useCallback((id, key, value) => {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, [key]: value } : source)));
  }, []);

  const removeSource = useCallback((id) => {
    setSources((current) => current.filter((source) => source.id !== id));
  }, []);

  async function refreshPdf(latex, title) {
    try {
      const nextUrl = await exportPdfBlobUrl(latex, title);
      updatePdfUrl(nextUrl);
      setPdfError('');
    } catch (pdfErr) {
      updatePdfUrl('');
      setPdfError(readError(pdfErr));
    }
  }

  const generateProposal = useCallback(async () => {
    if (!project.title) return;
    setStatus('drafting');
    setError('');
    try {
      const payload = composeProjectForSend();
      const data = await postJson('/api/proposal', payload);
      setResult(data);
      setSelectedWeaknessKeys([]);
      setMarkedFinal(false);
      setActiveTab('pdf');
      const version = {
        version: 1,
        createdAt: new Date().toISOString(),
        mode: data.mode,
        provider: data.provider,
        proposalLatex: data.proposalLatex,
        complianceMatrix: data.complianceMatrix,
        weakClaims: data.weakClaims || [],
        coverage: data.coverage || { covered: 0, total: 0 },
        evaluationReport: data.evaluationReport,
        changelog: []
      };
      setVersions([version]);
      pushTranscript('proposal-v1', data.transcript);
      pushLog('Draft', `Generated proposal v1 using ${data.mode} (${data.provider}).`);
      pushLog(
        'Review',
        `Coverage ${data.coverage?.covered || 0}/${data.coverage?.total || 0}; ${(data.weakClaims || []).length} weak claim(s).`
      );
      // Set the result first; PDF export is best-effort so a missing LaTeX
      // engine never hides a successfully generated draft.
      await refreshPdf(data.proposalLatex, project.title || 'proposal');
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }, [project, sources, domainInput, topicInput, pushLog, pushTranscript]);

  const toggleWeakness = useCallback((key) => {
    setSelectedWeaknessKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, []);

  const reviseProposal = useCallback(async () => {
    if (!result) return;
    setStatus('revising');
    setError('');
    try {
      const selectedWeaknesses = weakClaims.filter((_item, index) =>
        selectedWeaknessKeys.includes(String(index))
      );
      const payload = {
        ...composeProjectForSend(),
        previousLatex: result.proposalLatex,
        selectedWeaknesses,
        feedback: revisionFeedback.trim()
      };
      const data = await postJson('/api/agent/revise', payload);
      if (data.project) {
        setProject((current) => ({ ...EMPTY_PROJECT, ...current, ...data.project }));
      }
      setResult(data);
      setSelectedWeaknessKeys([]);
      setRevisionFeedback('');
      setActiveTab('review');
      const nextVersionNumber = versions.length + 1;
      const version = {
        version: nextVersionNumber,
        createdAt: new Date().toISOString(),
        mode: data.mode,
        provider: data.provider,
        proposalLatex: data.proposalLatex,
        complianceMatrix: data.complianceMatrix,
        weakClaims: data.weakClaims || [],
        coverage: data.coverage || { covered: 0, total: 0 },
        evaluationReport: data.evaluationReport,
        changelog: data.changelog || []
      };
      setVersions((current) => [...current, version]);
      pushTranscript(`revision-v${nextVersionNumber}`, data.transcript);
      const before = data.beforeCoverage || { covered: 0, total: 0 };
      pushLog(
        'Revise',
        `Revised to v${nextVersionNumber}. Coverage ${before.covered}/${before.total} -> ${data.coverage?.covered || 0}/${
          data.coverage?.total || 0
        }; ${(data.changelog || []).length} change(s).`
      );
      await refreshPdf(data.proposalLatex, project.title || 'proposal');
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }, [
    result,
    weakClaims,
    selectedWeaknessKeys,
    revisionFeedback,
    versions.length,
    project,
    sources,
    domainInput,
    topicInput,
    pushLog,
    pushTranscript
  ]);

  const markFinal = useCallback(() => {
    setMarkedFinal(true);
    pushLog('Finalize', 'Marked the current proposal version as final.');
  }, [pushLog]);

  const downloadLatex = useCallback(() => {
    if (!result?.proposalLatex) return;
    downloadTextFile('proposal.tex', result.proposalLatex, 'text/x-tex;charset=utf-8');
    pushLog('Export', 'Downloaded proposal.tex.');
  }, [result, pushLog]);

  const downloadPdf = useCallback(async () => {
    if (!result?.proposalLatex) return;
    setStatus('exporting');
    setError('');
    try {
      const href = pdfUrl || (await exportPdfBlobUrl(result.proposalLatex, project.title || 'proposal'));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'proposal.pdf';
      anchor.click();
      if (!pdfUrl) URL.revokeObjectURL(href);
      pushLog('Export', 'Downloaded proposal.pdf.');
    } catch (requestError) {
      setPdfError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }, [result, pdfUrl, project.title, pushLog]);

  function buildWorkflowUsageMd() {
    const accepted = fieldSuggestions
      .filter((suggestion) => project[suggestion.field] === suggestion.value)
      .map((suggestion) => `| ${suggestion.label || suggestion.field} | Accepted | ${suggestion.confidence} confidence |`);
    const rejected = rejectedSuggestions.map(
      (item) => `| ${item.label || item.field} | Rejected | Student dismissed this suggestion |`
    );
    const latest = versions[versions.length - 1];
    const first = versions[0];
    const changelogRows = (latest?.changelog || []).map(
      (item) => `- **${item.section}**: ${item.before} -> ${item.after} (${item.reason})`
    );
    const traceRows = PROJECT_FIELDS.map(
      ([field, label]) => `| ${label} | project.${field} | ${project[field] ? 'Filled' : 'Empty'} |`
    );
    return `# Workflow Usage Report

## Initial Idea

${topicInput || '(not set)'}${domainInput ? `\n\nDomain/constraints: ${domainInput}` : ''}

## Workflow Run Summary

| Step | What Happened | Artifact Or Evidence |
| --- | --- | --- |
| Intake | Captured rough idea | run log |
| Suggestions or questions | ${fieldSuggestions.length} suggestions, ${decisions.length} decisions, ${questions.length} questions | suggestions panel |
| Student decision or answer | ${acceptedSuggestionCount} suggestions accepted | accepted state |
| Project state update | ${acceptedCount}/${REQUIRED_FIELDS.length} fields filled | project editor |
| Draft generation | Proposal v1 (${first?.mode || 'n/a'}) | LaTeX + matrix |
| Evaluation | Coverage ${first?.coverage?.covered || 0}/${first?.coverage?.total || 0}, ${(first?.weakClaims || []).length} weak claims | compliance matrix + review |
| Revision | ${versions.length > 1 ? `v${versions.length}, coverage ${latest?.coverage?.covered || 0}/${latest?.coverage?.total || 0}` : 'not run yet'} | changelog |
| Artifact export or Stage 3 handoff | proposal.tex / proposal.pdf | export buttons |

## Accepted And Rejected Suggestions

| Suggestion Or Decision | Accepted / Rejected / Edited | Reason |
| --- | --- | --- |
${[...accepted, ...rejected].length ? [...accepted, ...rejected].join('\n') : '| (none recorded) | | |'}

## Revision Evidence

- Weakness found: ${(first?.weakClaims || [])[0]?.claim || 'see compliance matrix'}
- Change made: ${(latest?.changelog || [])[0]?.after || 'see changelog below'}
- Evidence that the proposal improved: coverage ${first?.coverage?.covered || 0}/${first?.coverage?.total || 0} -> ${latest?.coverage?.covered || 0}/${latest?.coverage?.total || 0}

### Changelog
${changelogRows.length ? changelogRows.join('\n') : '- (no revision run yet)'}

## Traceability

| Proposal Section | Workflow Step Or State Field | Notes |
| --- | --- | --- |
${traceRows.join('\n')}

## Reflection

- What did the workflow do well? Structured a rough idea into rubric-aligned sections and tracked coverage.
- What still required human judgment? Novelty framing, source accuracy, and final wording.
- What would you improve with more time? Deeper prior-work retrieval and stronger evaluation metrics.
`;
  }

  function buildAiUsageMd() {
    const callRows = transcripts.map((entry) => {
      const inputSummary = JSON.stringify(entry.prompt?.task || entry.prompt?.project?.title || 'payload').slice(0, 60);
      const outputSummary = String(entry.rawResponse || '').replace(/\s+/g, ' ').slice(0, 60);
      return `| ${entry.label} | ${health.provider || 'template'} / ${health.model || 'n/a'} | ${inputSummary} | ${outputSummary}… | reviewed |`;
    });
    const firstPrompt = transcripts[0];
    return `# AI Usage Log

## Tools Used

- Cursor (vibe coding) for building the agent and UI.
- Local Node/Express API wrapping the LLM provider.

## Models Or APIs

- Provider: ${health.provider || 'local template'}
- Model: ${health.model || 'n/a'}
- Local fallback used? ${health.mode === 'api-ready' ? 'no (API configured)' : 'yes'}

## What AI Helped With

- Planning: workflow stage design.
- Coding: agent endpoints and UI.
- Debugging: PDF export and JSON parsing.
- Writing proposal: drafting LaTeX sections from the project state.
- Evaluating proposal: compliance matrix and weak-claim detection.

## Key Prompts Or Request Payloads

\`\`\`json
${firstPrompt ? JSON.stringify(firstPrompt.prompt, null, 2).slice(0, 1500) : 'No transcript captured yet.'}
\`\`\`

## Workflow Calls

| Stage | Tool / Model | Input Summary | Output Summary | Human Decision |
| --- | --- | --- | --- | --- |
${callRows.length ? callRows.join('\n') : '| (none yet) | | | | |'}

## Human Review

- Code changes: reviewed in the editor.
- Proposal claims: checked weak-claim flags before accepting.
- Figure quality: reviewed the workflow diagram caption.
- Evaluation scores: compared coverage before and after revision.
- Security/API key handling: key stored only in server-side .env (gitignored).

## Failures and Fixes

| Issue | What happened | How I fixed it |
| --- | --- | --- |
| PDF engine missing | tectonic not installed | LaTeX still generated; PDF degrades gracefully |

## Final Ownership Statement

I reviewed the generated code and proposal artifacts. I am responsible for the final submission.
`;
  }

  function buildRunEvidenceJson() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        health,
        topicInput,
        domainInput,
        project,
        sources,
        runLog,
        versions: versions.map((version) => ({
          ...version,
          proposalLatex: `${(version.proposalLatex || '').slice(0, 400)}…`
        })),
        transcripts
      },
      null,
      2
    );
  }

  const downloadEvidence = useCallback(
    (kind) => {
      if (kind === 'workflow') {
        downloadTextFile('workflow_usage.md', buildWorkflowUsageMd(), 'text/markdown;charset=utf-8');
      } else if (kind === 'ai') {
        downloadTextFile('AI_USAGE.md', buildAiUsageMd(), 'text/markdown;charset=utf-8');
      } else if (kind === 'json') {
        downloadTextFile('run-evidence.json', buildRunEvidenceJson(), 'application/json;charset=utf-8');
      } else {
        downloadTextFile('workflow_usage.md', buildWorkflowUsageMd(), 'text/markdown;charset=utf-8');
        downloadTextFile('AI_USAGE.md', buildAiUsageMd(), 'text/markdown;charset=utf-8');
        downloadTextFile('run-evidence.json', buildRunEvidenceJson(), 'application/json;charset=utf-8');
      }
      pushLog('Evidence', `Exported Stage 2 evidence (${kind || 'all'}).`);
    },
    [
      pushLog,
      transcripts,
      versions,
      project,
      sources,
      runLog,
      health,
      topicInput,
      domainInput,
      fieldSuggestions,
      decisions,
      questions
    ]
  );

  const reset = useCallback(() => {
    setTopicInput('');
    setDomainInput('');
    setProject(EMPTY_PROJECT);
    setFieldSuggestions([]);
    setDecisions([]);
    setQuestions([]);
    setCustomNote('');
    setRejectedSuggestions([]);
    setSources([]);
    setRevisionFeedback('');
    setRunLog([]);
    setTranscripts([]);
    setError('');
    setActiveTab('pdf');
    setSuggestionIndex(0);
    setDecisionIndex(0);
    clearArtifacts();
  }, [clearArtifacts]);

  const clearSavedMemory = useCallback(() => {
    localStorage.removeItem(MEMORY_KEY);
    setMemorySavedAt('');
  }, []);

  return {
    // status + meta
    health,
    status,
    error,
    memorySavedAt,
    // intake
    topicInput,
    setTopicInput,
    domainInput,
    setDomainInput,
    startAgent,
    startSampleAgent,
    reset,
    clearSavedMemory,
    // project state
    project,
    updateProjectField,
    acceptedCount,
    // suggestions
    fieldSuggestions,
    suggestionIndex,
    setSuggestionIndex,
    currentSuggestion,
    acceptSuggestion,
    skipSuggestion,
    rejectSuggestion,
    editAndAcceptSuggestion,
    commentOnSuggestion,
    rejectedSuggestions,
    acceptedSuggestionCount,
    // decisions + questions
    decisions,
    decisionIndex,
    setDecisionIndex,
    currentDecision,
    chooseOption,
    skipDecision,
    questions,
    currentQuestion,
    customNote,
    setCustomNote,
    submitCustomNote,
    // sources
    sources,
    addSource,
    updateSource,
    removeSource,
    // draft + revise
    result,
    versions,
    coverage,
    weakClaims,
    highWeakCount,
    selectedWeaknessKeys,
    toggleWeakness,
    revisionFeedback,
    setRevisionFeedback,
    generateProposal,
    reviseProposal,
    stoppingCriteria,
    markFinal,
    // artifacts
    activeTab,
    setActiveTab,
    pdfUrl,
    pdfError,
    downloadLatex,
    downloadPdf,
    transcripts,
    downloadEvidence,
    buildWorkflowUsageMd,
    buildAiUsageMd,
    // logs
    runLog
  };
}
