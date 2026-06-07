const DEFAULT_REQUIREMENTS = `Proposal must include:
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

const EMPTY_PROJECT_FOR_SERVER = {
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

const SYSTEM_PROMPT = `You are a research proposal agent for a CS research proposal.

Return strict JSON with this shape:
{
  "proposalLatex": "complete, compile-ready LaTeX source for proposal.tex",
  "complianceMatrix": [
    {
      "requirement": "requirement text",
      "status": "Covered | Needs work",
      "evidence": "short evidence",
      "fix": "short next action"
    }
  ],
  "weakClaims": [
    {
      "claim": "exact unsupported or vague claim from the draft",
      "severity": "High | Medium | Low",
      "issue": "why it is weak (no source, vague comparative, missing metric)",
      "fix": "concrete revision that grounds or scopes the claim"
    }
  ],
  "evaluationReport": "plain text or Markdown report with covered count, missing items, weak claims, timeline risks, and prioritized revision actions",
  "questions": ["short clarifying question"]
}

Rules:
- The proposal artifact must be LaTeX, not Markdown.
- Return a complete LaTeX document with \\documentclass[11pt]{article}, 1-inch margins, title, sections, and a plain references list.
- Cover every required section explicitly: Title, Abstract, Keywords, Introduction (motivation + gap + target context), Novelty and relation to prior work, Goal, Methods (agent workflow with stages, inputs, outputs, feedback loop, revision loop, stopping criteria), Figure with caption, Expected results and milestones, Evaluation, Risks and mitigation, Resources, References/assumptions.

LENGTH AND DENSITY (critical — must fit 3 pages):
- HARD LIMIT: the entire document MUST fit within 3 pages at 11pt with 1-inch margins (references included). Aim to fill close to 3 pages but NEVER overflow to a 4th page — tighten prose instead.
- Target approximately 800-950 words of body text in total across all sections. Be concise and information-dense; never pad with filler.
- Write tight paragraphs of 2-3 sentences. Use compact itemize/enumerate lists for milestones, risks, evaluation metrics, and resources to save vertical space. Keep the Abstract to 3-4 sentences.
- Maximize information per sentence with concrete specifics: named prior work, metric targets (e.g., macro-F1 >= 0.70), dataset/study details, exact agent stages with inputs/outputs, and time-boxed milestones in weeks. Prefer numbers over vague language.
- Keep the References list to 4-5 entries.

FIGURE (compact, important):
- Include exactly one COMPACT figure built with TikZ inside a figure environment with a \\caption and \\label, referenced in the Methods text (e.g., "Figure~\\ref{fig:workflow} shows ...").
- The figure should occupy at most about one quarter of a page. Use \\usepackage{tikz} and \\usetikzlibrary{arrows.meta, positioning}. Draw a small workflow/architecture/evaluation diagram with short labeled nodes and [-{Stealth}] arrows, fitting within the text width. Use \\small or \\footnotesize inside the figure to keep it compact.
- Do not use \\includegraphics or external image files.

COMPILE-SAFETY:
- Use compile-safe LaTeX only: article class, geometry, hyperref, enumitem, tikz. Avoid minted, shell-escape, custom fonts, or packages needing extra tools.
- Do not invent citations. Do NOT use \\cite, \\bibliography, or BibTeX. Write references as a plain enumerated/itemized list (author, title, venue, year) in the References section.
- Do NOT use math-only symbols in normal text. Use plain words (write "to" instead of an arrow) or wrap math in $...$. Never place \\rightarrow, Greek letters, or subscripts/superscripts (_ or ^) in plain text (TikZ arrows are fine inside tikzpicture).

CONTENT QUALITY:
- Write the final artifact as a research proposal, not a short course implementation report.
- Keep the plan credible, appropriately scoped, and supported by milestones, resources, risks, and evaluation criteria.
- The Novelty section must name relevant prior work or comparable tools and state precisely what is new or different.
- When the input provides recommended or uploaded references, integrate the most relevant ones into Introduction/Novelty and list them in References.
- Mark unsupported claims as assumptions. Never state vague comparatives like "better" or "state of the art" without a source or a metric.`;

const REVISE_SYSTEM_PROMPT = `You are the revision step of a research proposal agent.

You receive the current project state, the previous LaTeX draft, and a list of selected weaknesses or student feedback. Produce a revised draft that fixes the selected items without dropping previously covered sections.

Return strict JSON with this shape:
{
  "proposalLatex": "complete, compile-ready revised LaTeX source",
  "complianceMatrix": [
    { "requirement": "requirement text", "status": "Covered | Needs work", "evidence": "short evidence", "fix": "short next action" }
  ],
  "weakClaims": [
    { "claim": "remaining weak claim or empty if resolved", "severity": "High | Medium | Low", "issue": "why", "fix": "how" }
  ],
  "changelog": [
    { "section": "section name", "before": "short summary of old text", "after": "short summary of revised text", "reason": "which weakness or feedback this addresses" }
  ],
  "evaluationReport": "plain text or Markdown report describing what improved and what still needs work",
  "questions": ["short remaining clarifying question"]
}

Rules:
- Keep the same LaTeX format rules as the drafting step (11pt, 1-inch margins, compile-safe, no external images).
- Only change what the selected weaknesses and feedback require; preserve already-strong sections.
- Each changelog entry must map to a selected weakness or to the student feedback.
- Strengthen novelty, evaluation metrics, and unsupported claims first when they are selected.
- Keep the document within 3 pages at 11pt (about 900-1100 words of body text); tighten or trim elsewhere so revisions never push it past 3 pages. Keep the TikZ figure compact.
- Do not invent citations; mark unsupported claims as assumptions. Do NOT use \\cite or \\bibliography; write references as a plain list.
- Do NOT use math-only symbols in normal text (no \\rightarrow, Greek letters, or _/^ outside $...$); use plain words or wrap math in $...$.`;

const QUESTION_SYSTEM_PROMPT = `You are running an interactive proposal-agent workflow.

Return strict JSON:
{
  "project": {
    "title": "",
    "keywords": "",
    "abstract": "",
    "problem": "",
    "novelty": "",
    "goal": "",
    "method": "",
    "figure": "",
    "expectedResults": "",
    "timeline": "",
    "evaluation": "",
    "risks": "",
    "resources": "",
    "references": ""
  },
  "fieldSuggestions": [
    {
      "field": "title | keywords | abstract | problem | novelty | goal | method | figure | expectedResults | timeline | evaluation | risks | resources | references",
      "label": "human-readable label",
      "value": "specific suggested content",
      "confidence": "High | Medium | Low",
      "reason": "why this suggestion fits the rough idea"
    }
  ],
  "decisions": [
    {
      "id": "short-stable-id",
      "title": "decision title",
      "field": "problem | novelty | goal | method | evaluation | risks | timeline | resources | references",
      "question": "context-aware decision prompt",
      "options": [
        {
          "label": "short option label",
          "value": "content to write into the project state",
          "rationale": "when this option is a good fit"
        }
      ]
    }
  ],
  "questions": [
    {
      "field": "problem | novelty | goal | method | figure | expectedResults | evaluation | risks | timeline | resources | references",
      "question": "one concise question",
      "reason": "why this answer matters",
      "priority": "High | Medium | Low"
    }
  ],
  "updates": ["short state update"]
}

The novelty field must connect the idea to prior work or comparable tools and state what is new. Keywords should be 4-6 comma-separated terms. The figure field should describe what a workflow/architecture/evaluation diagram would show plus a caption.

First infer concrete proposal data from the rough idea. Give the user suggested data and selectable options before asking open-ended questions. Ask open-ended questions only for information that cannot be reasonably inferred.`;

export async function startAgentSession(payload) {
  const project = normalizePayload(payload);
  const checklist = extractChecklist(project.requirements || DEFAULT_REQUIREMENTS);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const result = await refineProjectWithApi({
      task: 'start',
      project,
      checklist,
      activeQuestion: null,
      answer: ''
    });

    return {
      ...result,
      project: keepOnlyAcceptedStartFields(project, result.project),
      checklist,
      inputSummary: summarizeProjectInput(result.project),
      runMessage: `Initialized topic and prepared ${result.fieldSuggestions.length} suggested field(s) and ${result.decisions.length} decision card(s).`
    };
  }

  const questions = buildQuestionObjects(project);
  const fieldSuggestions = buildFieldSuggestions(project);
  const decisions = buildDecisionCards(project);

  return {
    mode: 'local-fallback',
    provider: 'template',
    project,
    checklist,
    suggestedProject: projectFromSuggestions(project, fieldSuggestions),
    fieldSuggestions,
    decisions,
    questions,
    inputSummary: summarizeProjectInput(project),
    updates: [`Initialized topic: ${project.title}.`],
    runMessage: `Initialized topic and prepared ${fieldSuggestions.length} fallback suggestion(s).`,
    transcript: {
      prompt: { task: 'start', project, checklist },
      rawResponse: 'Generated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

export async function answerAgentQuestion(payload) {
  const project = normalizePayload(payload.project || payload);
  const checklist = extractChecklist(project.requirements || payload.requirements || DEFAULT_REQUIREMENTS);
  const activeQuestion = normalizeQuestion(payload.question);
  const answer = clean(payload.answer);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const result = await refineProjectWithApi({
      task: 'integrate-answer',
      project,
      checklist,
      activeQuestion,
      answer
    });

    return {
      ...result,
      checklist,
      inputSummary: summarizeProjectInput(result.project),
      runMessage: result.updates.join(' ') || 'Integrated answer with model reasoning.'
    };
  }

  const integration = integrateAnswerLocally(project, answer, activeQuestion);
  const questions = buildQuestionObjects(integration.project);

  return {
    mode: 'local-fallback',
    provider: 'template',
    project: integration.project,
    checklist,
    suggestedProject: projectFromSuggestions(integration.project, buildFieldSuggestions(integration.project)),
    fieldSuggestions: buildFieldSuggestions(integration.project),
    decisions: buildDecisionCards(integration.project),
    questions,
    inputSummary: summarizeProjectInput(integration.project),
    updates: integration.updates,
    runMessage: `${integration.updates.join(' ')} ${questions.length} follow-up question(s) remain.`.trim(),
    transcript: {
      prompt: { task: 'integrate-answer', project, activeQuestion, answer, checklist },
      rawResponse: 'Integrated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

export async function generateProposal(payload) {
  const project = normalizePayload(payload);
  const requirements = project.requirements || DEFAULT_REQUIREMENTS;
  const checklist = extractChecklist(requirements);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    return generateWithApi(project, checklist);
  }

  return generateLocally(project, checklist);
}

const REFERENCES_SYSTEM_PROMPT = `You recommend academic references for a research proposal topic.

Return strict JSON:
{
  "references": [
    {
      "title": "exact paper or book title",
      "authors": "short author list, e.g. Habernal et al.",
      "year": "publication year",
      "venue": "conference/journal/publisher",
      "relevance": "High | Medium | Low",
      "reason": "one sentence on why it is relevant to the topic"
    }
  ]
}

Rules:
- Return 6 to 8 real, well-known references relevant to the topic when possible.
- Prefer seminal/highly-cited works and recent surveys; rank by relevance.
- Do NOT fabricate DOIs or URLs; omit links (the app adds a search link).
- Be accurate with titles; if unsure, choose a closely related well-known work and mark relevance Medium/Low.`;

export async function recommendReferences(payload) {
  const topic = clean(payload.topic) || clean(payload.title);

  if (!topic) {
    throw new Error('Topic is required.');
  }

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const model = clean(process.env.LLM_MODEL);

    if (!model) {
      throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
    }

    const promptPayload = { topic, context: clean(payload.context) };
    const content = await callModel({
      systemPrompt: REFERENCES_SYSTEM_PROMPT,
      payload: promptPayload,
      model,
      temperature: 0.3,
      maxTokens: 3000
    });
    const parsed = parseJsonContent(content);

    return {
      mode: 'api',
      provider: process.env.LLM_API_URL,
      references: normalizeReferences(parsed.references),
      transcript: { prompt: { task: 'references', ...promptPayload }, rawResponse: content }
    };
  }

  return {
    mode: 'local-fallback',
    provider: 'template',
    references: fallbackReferences(topic),
    transcript: {
      prompt: { task: 'references', topic },
      rawResponse: 'Generated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

function scholarUrl(title) {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
}

function normalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  return references
    .map((item, index) => {
      const title = clean(item.title);
      if (!title) return null;
      const relevance = clean(item.relevance);
      return {
        id: `ref-${index + 1}-${Date.now().toString(36)}`,
        title,
        authors: clean(item.authors),
        year: clean(item.year),
        venue: clean(item.venue),
        relevance: /^(high|medium|low)$/i.test(relevance) ? titleCase(relevance) : 'Medium',
        reason: clean(item.reason),
        url: scholarUrl(title)
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function fallbackReferences(topic) {
  const t = shortTopic(topic);
  return [
    {
      id: `ref-1-${Date.now().toString(36)}`,
      title: `A survey of methods related to ${t}`,
      authors: 'Various',
      year: '2023',
      venue: 'Survey',
      relevance: 'High',
      reason: 'Background and taxonomy for the proposed direction.',
      url: scholarUrl(`survey ${t}`)
    },
    {
      id: `ref-2-${Date.now().toString(36)}`,
      title: `Evaluation methodology for ${t}`,
      authors: 'Various',
      year: '2022',
      venue: 'Workshop',
      relevance: 'Medium',
      reason: 'Informs the evaluation plan and metrics.',
      url: scholarUrl(`evaluation ${t}`)
    },
    {
      id: `ref-3-${Date.now().toString(36)}`,
      title: `Agent and LLM workflow patterns`,
      authors: 'Various',
      year: '2024',
      venue: 'arXiv',
      relevance: 'Medium',
      reason: 'Supports the critique-and-revision agent design.',
      url: scholarUrl('LLM agent critique revision workflow')
    }
  ];
}

export async function reviseProposal(payload) {
  const project = normalizePayload(payload);
  const requirements = project.requirements || DEFAULT_REQUIREMENTS;
  const checklist = extractChecklist(requirements);
  const previousLatex = clean(payload.previousLatex);
  const selectedWeaknesses = Array.isArray(payload.selectedWeaknesses)
    ? payload.selectedWeaknesses.map((item) => (typeof item === 'string' ? { claim: clean(item) } : {
        claim: clean(item.claim),
        severity: clean(item.severity),
        issue: clean(item.issue),
        fix: clean(item.fix),
        field: clean(item.field)
      }))
    : [];
  const feedback = clean(payload.feedback);
  const beforeCoverage = computeCoverage(buildComplianceMatrix(project, checklist));

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    return reviseWithApi({ project, checklist, previousLatex, selectedWeaknesses, feedback, beforeCoverage });
  }

  return reviseLocally({ project, checklist, selectedWeaknesses, feedback, beforeCoverage });
}

async function reviseWithApi({ project, checklist, previousLatex, selectedWeaknesses, feedback, beforeCoverage }) {
  const model = clean(process.env.LLM_MODEL);

  if (!model) {
    throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
  }

  const promptPayload = {
    project,
    checklist,
    previousLatex,
    selectedWeaknesses,
    feedback,
    outputContract: {
      proposalLatex: 'Complete compile-ready revised LaTeX',
      complianceMatrix: 'Array of requirement coverage rows',
      weakClaims: 'Remaining weak claims',
      changelog: 'What changed and why, mapped to weaknesses',
      evaluationReport: 'What improved and what remains',
      questions: 'Remaining clarifying questions'
    }
  };

  const content = await callModel({
    systemPrompt: REVISE_SYSTEM_PROMPT,
    payload: promptPayload,
    model,
    temperature: 0.2,
    maxTokens: 12000
  });
  const parsed = parseJsonContent(content);
  const coerced = coerceResult(parsed, project, checklist);

  return {
    mode: 'api',
    provider: process.env.LLM_API_URL,
    ...coerced,
    beforeCoverage,
    transcript: {
      prompt: promptPayload,
      rawResponse: content
    }
  };
}

function reviseLocally({ project, checklist, selectedWeaknesses, feedback, beforeCoverage }) {
  const nextProject = { ...project };
  const defaults = buildFieldSuggestions({ ...project, title: project.title, topic: project.topic });
  const defaultByField = new Map(defaults.map((item) => [item.field, item.value]));
  const changelog = [];

  const fillField = (field, reason) => {
    if (!Object.hasOwn(nextProject, field)) return;
    if (clean(nextProject[field])) return;
    const value = defaultByField.get(field);
    if (!value) return;
    nextProject[field] = value;
    changelog.push({
      section: labelForField(field),
      before: 'Missing or too thin.',
      after: `${value.slice(0, 120)}${value.length > 120 ? '…' : ''}`,
      reason
    });
  };

  selectedWeaknesses.forEach((weakness) => {
    const field = clean(weakness.field) || inferFieldFromText(`${weakness.claim} ${weakness.issue}`);
    if (field) fillField(field, weakness.fix || `Resolve weakness: ${weakness.claim}`);
  });

  ['novelty', 'goal', 'keywords', 'abstract', 'figure', 'expectedResults', 'risks', 'evaluation', 'references']
    .forEach((field) => fillField(field, 'Filled a missing required section during the revision loop.'));

  if (feedback) {
    const field = inferFieldFromText(feedback) || 'method';
    nextProject[field] = mergeField(nextProject[field], feedback);
    changelog.push({
      section: labelForField(field),
      before: 'Before student feedback.',
      after: `Incorporated: ${feedback.slice(0, 120)}${feedback.length > 120 ? '…' : ''}`,
      reason: 'Applied student feedback from the revision panel.'
    });
  }

  const proposalLatex = buildLocalProposalLatex(nextProject);
  const complianceMatrix = buildComplianceMatrix(nextProject, checklist);
  const weakClaims = detectWeakClaims(nextProject, complianceMatrix);
  const coverage = computeCoverage(complianceMatrix);
  const questions = buildQuestions(nextProject);
  const needsWork = complianceMatrix.filter((row) => row.status === 'Needs work');

  if (!changelog.length) {
    changelog.push({
      section: 'No change',
      before: 'Draft already covered all detected sections.',
      after: 'No automatic revision was required.',
      reason: 'The fallback reviser found nothing missing to fill.'
    });
  }

  const evaluationReport = `${buildEvaluationReport({
    mode: 'local deterministic revision',
    coverage,
    needsWork,
    weakClaims,
    questions
  })}

## Coverage Change
- Before: ${beforeCoverage.covered}/${beforeCoverage.total}
- After: ${coverage.covered}/${coverage.total}
`;

  return {
    mode: 'local-fallback',
    provider: 'template',
    project: nextProject,
    proposalLatex,
    complianceMatrix,
    weakClaims,
    coverage,
    beforeCoverage,
    changelog,
    evaluationReport,
    questions,
    transcript: {
      prompt: { task: 'revise', project, selectedWeaknesses, feedback, checklist },
      rawResponse: 'Revised by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

function inferFieldFromText(text) {
  const value = clean(text).toLowerCase();
  if (!value) return '';
  if (/novel|prior work|state of the art|differen|compar/.test(value)) return 'novelty';
  if (/keyword/.test(value)) return 'keywords';
  if (/abstract/.test(value)) return 'abstract';
  if (/goal|objective/.test(value)) return 'goal';
  if (/figure|diagram/.test(value)) return 'figure';
  if (/expected result|outcome/.test(value)) return 'expectedResults';
  if (/risk|mitigation/.test(value)) return 'risks';
  if (/eval|metric|test|measure/.test(value)) return 'evaluation';
  if (/milestone|timeline|schedule|phase/.test(value)) return 'timeline';
  if (/resource|budget|tool|release/.test(value)) return 'resources';
  if (/reference|source|citation|assumption/.test(value)) return 'references';
  if (/method|workflow|approach|stage/.test(value)) return 'method';
  if (/problem|motivation|gap|user|context/.test(value)) return 'problem';
  return '';
}

async function refineProjectWithApi(payload) {
  const model = clean(process.env.LLM_MODEL);

  if (!model) {
    throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
  }

  const content = await callModel({
    systemPrompt: QUESTION_SYSTEM_PROMPT,
    payload,
    model,
    temperature: 0.2,
    maxTokens: 6000
  });
  const parsed = parseJsonContent(content);
  const nextProject = mergeProject(payload.project, normalizePayload(parsed.project || {}));
  const fieldSuggestions = normalizeFieldSuggestions(parsed.fieldSuggestions, nextProject);
  const decisions = normalizeDecisions(parsed.decisions, nextProject);
  const questions = normalizeQuestions(parsed.questions, nextProject);

  return {
    mode: 'api',
    provider: process.env.LLM_API_URL,
    project: nextProject,
    suggestedProject: nextProject,
    fieldSuggestions,
    decisions,
    questions,
    updates: Array.isArray(parsed.updates) ? parsed.updates.map(clean).filter(Boolean) : ['Updated project state.'],
    transcript: {
      prompt: payload,
      rawResponse: content
    }
  };
}

async function generateWithApi(project, checklist) {
  const model = clean(process.env.LLM_MODEL);

  if (!model) {
    throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
  }

  const promptPayload = {
    project,
    checklist,
    outputContract: {
      proposalLatex: 'Complete compile-ready LaTeX source for proposal.tex',
      complianceMatrix: 'Array of requirement coverage rows',
      evaluationReport: 'Plain text or Markdown self-evaluation',
      questions: 'Remaining clarifying questions'
    }
  };

  const content = await callModel({
    systemPrompt: SYSTEM_PROMPT,
    payload: promptPayload,
    model,
    temperature: 0.2,
    maxTokens: 12000
  });
  const parsed = parseJsonContent(content);

  return {
    mode: 'api',
    provider: process.env.LLM_API_URL,
    ...coerceResult(parsed, project, checklist),
    transcript: {
      prompt: promptPayload,
      rawResponse: content
    }
  };
}

async function callModel({ systemPrompt, payload, model, temperature, maxTokens }) {
  if (getProvider() === 'gemini') {
    return callGemini({ systemPrompt, payload, model, temperature, maxTokens });
  }

  return callOpenAiCompatible({ systemPrompt, payload, model, temperature, maxTokens });
}

// GPT-5 family (and other reasoning models) reject custom temperature and use
// max_completion_tokens instead of max_tokens.
function isReasoningModel(model) {
  return /(^|[-/])(gpt-5|o[134])/i.test(clean(model));
}

async function callGemini({ systemPrompt, payload, model, temperature, maxTokens }) {
  const baseUrl = clean(process.env.LLM_API_URL) || 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = { temperature, responseMimeType: 'application/json' };
  if (maxTokens) {
    generationConfig.maxOutputTokens = maxTokens;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.LLM_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(payload, null, 2) }]
        }
      ],
      generationConfig
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini API returned ${response.status}`);
  }

  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n');

  if (!content) {
    throw new Error('Gemini API returned no text content.');
  }

  return content;
}

async function callOpenAiCompatible({ systemPrompt, payload, model, temperature, maxTokens }) {
  const reasoning = isReasoningModel(model);
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(payload, null, 2) }
    ]
  };

  // Reasoning models only support the default temperature; others keep the
  // requested low temperature for stable JSON.
  if (!reasoning && typeof temperature === 'number') {
    body.temperature = temperature;
  }

  if (maxTokens) {
    body.max_completion_tokens = maxTokens;
  }

  const response = await fetch(process.env.LLM_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `API returned ${response.status}`);
  }

  return readModelContent(data);
}

function buildComplianceMatrix(project, checklist) {
  return checklist.map((requirement) => {
    const evidence = findRequirementEvidence(requirement, project);

    return {
      requirement,
      status: evidence ? 'Covered' : 'Needs work',
      evidence: evidence || 'No strong evidence in the current project state.',
      fix: evidence ? 'Keep this section specific.' : `Add concrete detail for: ${requirement}.`
    };
  });
}

function generateLocally(project, checklist) {
  const questions = buildQuestions(project);
  const proposalLatex = buildLocalProposalLatex(project);
  const complianceMatrix = buildComplianceMatrix(project, checklist);

  const needsWork = complianceMatrix.filter((row) => row.status === 'Needs work');
  const weakClaims = detectWeakClaims(project, complianceMatrix);
  const coverage = computeCoverage(complianceMatrix);
  const evaluationReport = buildEvaluationReport({
    mode: 'local deterministic fallback',
    coverage,
    needsWork,
    weakClaims,
    questions
  });

  return {
    mode: 'local-fallback',
    provider: 'template',
    proposalLatex,
    complianceMatrix,
    weakClaims,
    coverage,
    evaluationReport,
    questions,
    transcript: {
      prompt: { project, checklist },
      rawResponse: 'Generated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

function computeCoverage(complianceMatrix) {
  const total = complianceMatrix.length;
  const covered = complianceMatrix.filter((row) => /^covered$/i.test(clean(row.status))).length;
  return { covered, total };
}

function detectWeakClaims(project, complianceMatrix) {
  const claims = [];
  const text = [
    project.problem,
    project.novelty,
    project.method,
    project.evaluation,
    project.expectedResults,
    project.abstract
  ]
    .map(clean)
    .filter(Boolean)
    .join('\n');

  const vaguePattern = /\b(better|best|state[- ]of[- ]the[- ]art|cutting[- ]edge|revolutionary|optimal|superior|most accurate|fastest|seamless|robust)\b/gi;
  const seen = new Set();
  let match;
  while ((match = vaguePattern.exec(text)) !== null) {
    const word = match[0].toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    const start = Math.max(0, match.index - 30);
    const snippet = text.slice(start, Math.min(text.length, match.index + 40)).replace(/\s+/g, ' ').trim();
    claims.push({
      claim: snippet,
      severity: 'High',
      issue: `Vague comparative "${match[0]}" without a source or metric.`,
      fix: 'Replace with a measurable comparison or mark it as an assumption tied to a source.'
    });
  }

  if (!clean(project.novelty)) {
    claims.push({
      claim: 'No explicit novelty or prior-work comparison.',
      severity: 'High',
      issue: 'Novelty and relation to prior work is the highest-weight section and is missing.',
      fix: 'Name comparable tools or prior work and state what is new or different.'
    });
  }

  if (!clean(project.references)) {
    claims.push({
      claim: 'No references, source notes, or assumptions section.',
      severity: 'Medium',
      issue: 'Unsupported claims must be grounded or marked as assumptions.',
      fix: 'Add at least source notes or an explicit assumptions list.'
    });
  }

  const needsWork = complianceMatrix.filter((row) => row.status === 'Needs work');
  needsWork.forEach((row) => {
    claims.push({
      claim: `Missing required section: ${row.requirement}.`,
      severity: 'Medium',
      issue: 'Required section is not covered by the current project state.',
      fix: row.fix || `Add concrete content for: ${row.requirement}.`
    });
  });

  return dedupeWeakClaims(claims).slice(0, 10);
}

function dedupeWeakClaims(claims) {
  const seen = new Set();
  return claims.filter((item) => {
    const key = clean(item.claim).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEvaluationReport({ mode, coverage, needsWork, weakClaims, questions }) {
  const highClaims = weakClaims.filter((item) => /^high$/i.test(item.severity));
  return `# Evaluation Report

## Summary
- Mode: ${mode}.
- Covered requirements: ${coverage.covered}/${coverage.total}.
- Weak or unsupported claims: ${weakClaims.length} (${highClaims.length} high severity).
- Remaining questions: ${questions.length}.

## Weak Claims And Risks
${weakClaims.length ? weakClaims.map((item) => `- [${item.severity}] ${item.claim} -> ${item.fix}`).join('\n') : '- No weak claims detected by the checker.'}

## Missing Required Sections
${needsWork.length ? needsWork.map((row) => `- ${row.requirement}: ${row.fix}`).join('\n') : '- All required sections are covered.'}

## Revision Priorities
${questions.length ? questions.map((question) => `- ${typeof question === 'string' ? question : question.question}`).join('\n') : '- Draft is ready for human revision or finalization.'}
`;
}

function buildLocalProposalLatex(project) {
  const title = project.title || project.topic || 'Research Proposal';
  const keywords = project.keywords || 'research proposal, agent workflow, evaluation, human-in-the-loop';
  const abstract =
    project.abstract ||
    `This proposal presents ${shortTopic(project.topic || title)}. It states the target problem and gap, summarizes the agent workflow used to produce the proposal, and describes how the work will be evaluated through requirement coverage and a documented revision loop.`;
  const problem = project.problem || 'The current problem is still underspecified and should be refined through clarifying questions.';
  const novelty =
    project.novelty ||
    'Compared to general LLM chat or single-shot proposal generators, this workflow is staged and rubric-aware, with explicit critique and a revision loop. \\textbf{Assumption:} comparable tools do not check requirement coverage or produce before/after revision evidence.';
  const goal = project.goal || 'Produce a complete, reviewable research proposal from a rough idea, with coverage checks and at least one documented revision loop.';
  const method = project.method || 'The agent workflow will collect a rough research direction, ask targeted clarification questions, update project state, draft a research proposal, check requirements, and revise weak sections.';
  const figureCaption = project.figure || 'End-to-end agent workflow with a human-in-the-loop revision loop and explicit stopping criteria.';
  const expected = project.expectedResults || 'A reproducible workflow that raises required-section coverage between the first and revised drafts and flags unsupported claims.';
  const evaluation = project.evaluation || 'Evaluate the first and revised drafts against section coverage, missing fields, weak claims, prior-work comparison, research milestones, and proposal-specific success criteria.';
  const timeline = project.timeline || 'Phase 1 literature and requirement review; Phase 2 workflow and method design; Phase 3 prototype or study setup; Phase 4 evaluation and analysis; Phase 5 final proposal revision and source notes.';
  const risks = project.risks || 'API key missing: use deterministic fallback. Unsupported claims: mark as assumptions and request source notes. Scope too broad: narrow contribution, milestones, and evaluation criteria before drafting.';
  const resources = project.resources || 'This browser app, a local Node API service, an optional LLM API key, proposal-writing references, and source notes for unsupported claims.';
  const references = project.references || 'Course proposal requirements and demo scaffold. Additional claims are treated as assumptions.';

  return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\setlist{nosep}
\title{${escapeLatex(title)}}
\author{}
\date{}

\begin{document}
\maketitle

\begin{abstract}
${latexParagraph(abstract)}
\end{abstract}

\noindent\textbf{Keywords:} ${escapeLatex(keywords)}

\section{Introduction: Motivation and Gap}
${latexParagraph(problem)}

Students often have partial ideas but need help converting them into proposal sections with clear methods, milestones, and evaluation criteria. \textbf{Assumption:} a lightweight guided workflow is sufficient for a useful classroom demo.

\section{Novelty and Relation to Prior Work}
${latexParagraph(novelty)}

\section{Project Goal}
${latexParagraph(goal)}

\section{Method and Agent Workflow}
${latexParagraph(method)}

\begin{enumerate}
\item Capture topic, problem, novelty, method, figure plan, milestones, evaluation, risks, resources, and requirement text.
\item Send the structured state to the local API service.
\item Use the configured LLM API when available; otherwise use a deterministic fallback.
\item Return LaTeX source, requirement coverage, weak-claim flags, self-evaluation, and clarification questions.
\item Apply a revision loop until the stopping criteria are met, then compile \texttt{proposal.tex} into \texttt{proposal.pdf}.
\end{enumerate}

\section{Figure}
\begin{figure}[h]
\centering
\fbox{\begin{minipage}{0.9\linewidth}
\centering
Rough idea $\rightarrow$ structured suggestions $\rightarrow$ student decisions $\rightarrow$ accepted project state $\rightarrow$ draft $\rightarrow$ compliance review $\rightarrow$ revision loop $\rightarrow$ final proposal
\end{minipage}}
\caption{${escapeLatex(figureCaption)}}
\end{figure}

\section{Expected Results and Research Milestones}
${latexParagraph(expected)}

${latexParagraph(timeline)}

\section{Evaluation Plan}
${latexParagraph(evaluation)}

Test cases include a complete idea, a missing-information idea, a requirement-check case, and a revision case after weak claims are flagged.

\section{Risks and Mitigation}
${latexParagraph(risks)}

\section{Resources}
${latexParagraph(resources)}

\section{References and Assumptions}
${latexParagraph(references)}

\end{document}
`;
}

function buildQuestions(project) {
  return buildQuestionObjects(project).map((question) => question.question);
}

function buildQuestionObjects(project) {
  const questions = [];
  const add = (field, question, reason, priority = 'High') => {
    questions.push({
      id: `${field}-${questions.length + 1}`,
      field,
      question,
      reason,
      priority
    });
  };

  if (!isSpecific(project.problem, 80)) {
    add(
      'problem',
      'What concrete problem does this proposal solve, and who experiences it?',
      'The proposal needs a specific motivation and user or stakeholder.'
    );
  }

  if (!isSpecific(project.novelty, 80)) {
    add(
      'novelty',
      'What prior work or comparable tools exist, and what is new or different here?',
      'Novelty and relation to prior work is the highest-weight section and must name comparisons.'
    );
  }

  if (!isSpecific(project.method, 80)) {
    add(
      'method',
      'What exact workflow or technical method will the project implement?',
      'The method should describe stages, inputs, outputs, and the API-backed loop.'
    );
  }

  if (!isSpecific(project.evaluation, 60)) {
    add(
      'evaluation',
      'What measurable checks will prove the revised proposal is better than the first draft?',
      'The evaluation plan needs concrete tests or metrics.'
    );
  }

  if (!isSpecific(project.timeline, 40)) {
    add(
      'timeline',
      'What research milestones and timeline estimates make this proposal credible?',
      'The proposal needs scoped milestones, feasibility evidence, and realistic risks.'
    );
  }

  if (!isSpecific(project.resources, 30)) {
    add(
      'resources',
      'What tools, APIs, files, or fallback mode will make this reproducible?',
      'The proposal needs implementation resources and API-key handling.',
      'Medium'
    );
  }

  if (!isSpecific(project.references, 30)) {
    add(
      'references',
      'What sources or assumptions should ground the claims?',
      'Unsupported claims should be marked as assumptions or tied to source notes.',
      'Medium'
    );
  }

  if (!questions.length) {
    add(
      'next-step',
      'The project state looks draftable. Should I generate the proposal now?',
      'No required missing field remains in the basic checker.',
      'Low'
    );
  }

  return questions.slice(0, 5);
}

function integrateAnswerLocally(project, answer, question) {
  const targetField = question?.field && question.field !== 'next-step' ? question.field : firstMissingField(project);
  const nextProject = { ...project };
  const updates = [];

  if (targetField && Object.hasOwn(nextProject, targetField)) {
    nextProject[targetField] = mergeField(nextProject[targetField], answer);
    updates.push(`Updated ${targetField}.`);
  } else {
    nextProject.method = mergeField(nextProject.method, answer);
    updates.push('Updated method.');
  }

  return { project: nextProject, updates };
}

function buildFieldSuggestions(project) {
  const topic = project.title || project.topic || 'the project';
  const suggestions = [
    {
      field: 'title',
      label: 'Project Title',
      value: project.title || titleCase(topic),
      confidence: 'High',
      reason: 'Use the rough idea as the working title so the proposal has a stable anchor.'
    },
    {
      field: 'keywords',
      label: 'Keywords',
      value:
        project.keywords ||
        `${shortTopic(topic)}, agent workflow, research proposal, evaluation, human-in-the-loop`,
      confidence: project.keywords ? 'High' : 'Medium',
      reason: 'The required format asks for 4-6 keywords that index the proposal.'
    },
    {
      field: 'abstract',
      label: 'Abstract',
      value:
        project.abstract ||
        `This proposal presents ${topic}. It states the target problem and gap, summarizes the method and agent workflow, and outlines how the work will be evaluated and why the outcome matters.`,
      confidence: project.abstract ? 'High' : 'Medium',
      reason: 'A short abstract anchors the rest of the proposal and is a required section.'
    },
    {
      field: 'problem',
      label: 'Problem Framing',
      value:
        project.problem ||
        `Students or project authors have a rough idea for ${topic}, but need help turning it into a structured, rubric-aligned proposal with clear scope and evaluation.`,
      confidence: project.problem ? 'High' : 'Medium',
      reason: 'A proposal needs a concrete user pain point before method details are useful.'
    },
    {
      field: 'novelty',
      label: 'Novelty / Prior Work',
      value:
        project.novelty ||
        `Unlike generic chat-based drafting or single-shot proposal generators, ${shortTopic(topic)} adds a staged, rubric-aware workflow with explicit critique and a revision loop. Assumption: comparable tools (general LLM chat, template fillers) do not check requirement coverage or produce before/after revision evidence.`,
      confidence: project.novelty ? 'High' : 'Low',
      reason: 'Novelty and relation to prior work is the single highest-weight section in the final rubric.'
    },
    {
      field: 'goal',
      label: 'Project Goal',
      value:
        project.goal ||
        `Deliver a workflow that turns a rough idea about ${shortTopic(topic)} into a complete, reviewable research proposal with coverage checks and at least one documented revision loop.`,
      confidence: project.goal ? 'High' : 'Medium',
      reason: 'A crisp goal statement is a required section and frames the evaluation.'
    },
    {
      field: 'method',
      label: 'Method / Agent Workflow',
      value:
        project.method ||
        'Build an agent workflow that extracts project state from a rough idea, presents suggested fields and decision options, accepts user edits, drafts a proposal, checks requirements, and revises weak sections. Stages: intake, extract, decide, draft, critique-and-revise, finalize. Stopping criteria: all required sections covered, no high-severity unsupported claims, and at least one completed revision loop.',
      confidence: project.method ? 'High' : 'Medium',
      reason: 'The method should describe the agent process rather than only promising a final text draft.'
    },
    {
      field: 'figure',
      label: 'Figure Plan',
      value:
        project.figure ||
        'A workflow diagram showing rough idea -> structured suggestions -> student decisions -> accepted state -> draft -> compliance review -> revision loop -> final proposal. Caption: end-to-end agent workflow with a human-in-the-loop revision loop and stopping criteria.',
      confidence: project.figure ? 'High' : 'Medium',
      reason: 'A referenced figure explaining the workflow or evaluation is worth dedicated points.'
    },
    {
      field: 'expectedResults',
      label: 'Expected Results',
      value:
        project.expectedResults ||
        'A reproducible workflow that raises required-section coverage between the first and revised drafts, flags unsupported claims, and produces an auditable run trace as evidence.',
      confidence: project.expectedResults ? 'High' : 'Medium',
      reason: 'Expected results should be concrete outcomes tied to the evaluation.'
    },
    {
      field: 'evaluation',
      label: 'Evaluation Plan',
      value:
        project.evaluation ||
        'Test complete, missing-info, requirement-check, unsupported-claim, and revision scenarios. Compare draft quality by checklist coverage, specificity, and whether weak claims are flagged. Metric: covered-section count and number of resolved weak claims before vs after revision.',
      confidence: project.evaluation ? 'High' : 'Medium',
      reason: 'The course proposal needs evidence that the workflow improves the artifact.'
    },
    {
      field: 'risks',
      label: 'Risks / Mitigation',
      value:
        project.risks ||
        'Risk: the model invents citations -> mitigation: mark unsupported claims as assumptions and require source notes. Risk: scope too broad -> mitigation: narrow contribution and milestones before drafting. Risk: API unavailable -> mitigation: deterministic local fallback mode.',
      confidence: project.risks ? 'High' : 'Medium',
      reason: 'Risks with mitigations show feasibility and earn feasibility points.'
    },
    {
      field: 'timeline',
      label: 'Research Milestones',
      value:
        project.timeline ||
        'Phase 1: proposal-writing research and prior-work review. Phase 2: workflow and method design. Phase 3: prototype or study setup. Phase 4: evaluation and unsupported-claim review. Phase 5: final proposal revision and source notes.',
      confidence: project.timeline ? 'High' : 'Medium',
      reason: 'Research milestones help reviewers judge feasibility, expected outcomes, and scope.'
    },
    {
      field: 'resources',
      label: 'Resources',
      value: project.resources || 'React, Vite, Node, Gemini API, local fallback mode, sample research ideas, and course requirements.',
      confidence: project.resources ? 'High' : 'Medium',
      reason: 'Resource notes make the API-backed workflow reproducible.'
    },
    {
      field: 'references',
      label: 'Sources / Assumptions',
      value: project.references || 'Course proposal requirements, the provided demo workflow, and explicit assumptions for unsupported claims.',
      confidence: project.references ? 'High' : 'Medium',
      reason: 'Source notes prevent the proposal from inventing unsupported claims.'
    }
  ];

  return suggestions.filter((item) => clean(item.value));
}

function buildDecisionCards(project) {
  const topic = project.title || project.topic || 'this project';

  return [
    {
      id: 'problem-framing',
      title: 'Choose The Problem Framing',
      field: 'problem',
      question: 'Which problem framing should the proposal emphasize?',
      options: [
        {
          label: 'Rubric alignment',
          value: `Students have rough ideas for ${topic}, but struggle to translate them into proposal sections that satisfy the course rubric.`,
          rationale: 'Best when the project is mainly about proposal structure and grading requirements.'
        },
        {
          label: 'Revision quality',
          value: `Students can produce a first draft for ${topic}, but need help identifying weak claims, missing evidence, and unclear evaluation plans before submission.`,
          rationale: 'Best when the agent focuses on critique and revision.'
        },
        {
          label: 'Scope control',
          value: `Students often choose research directions that are too broad or underspecified, so they need a workflow that narrows the idea into a credible proposal with explicit milestones and evaluation criteria.`,
          rationale: 'Best when feasibility, milestones, and research scope are the main risks.'
        }
      ]
    },
    {
      id: 'novelty-angle',
      title: 'Choose The Novelty Angle',
      field: 'novelty',
      question: 'How should the proposal position novelty against prior work?',
      options: [
        {
          label: 'Workflow vs chat',
          value: `Unlike one-shot LLM chat for ${topic}, this workflow is staged and rubric-aware, with explicit coverage checks and a revision loop. Assumption: general chat tools do not verify required-section coverage.`,
          rationale: 'Best when the contribution is the structured process itself.'
        },
        {
          label: 'Evaluation evidence',
          value: `Comparable proposal helpers rarely produce before/after evidence. This project adds measurable coverage and weak-claim deltas across draft versions for ${topic}.`,
          rationale: 'Best when measurable revision evidence is the differentiator.'
        },
        {
          label: 'Domain grounding',
          value: `Generic generators ignore domain sources. This project grounds ${topic} in named prior work and marks unsupported claims as assumptions.`,
          rationale: 'Best when source grounding and citations matter most.'
        }
      ]
    },
    {
      id: 'method-style',
      title: 'Choose The Agent Method',
      field: 'method',
      question: 'What should the core agent workflow optimize for?',
      options: [
        {
          label: 'Structured extraction',
          value:
            'The agent extracts project fields from a rough idea, shows suggested data for user approval, and only asks clarifying questions when required fields remain uncertain.',
          rationale: 'Best for reducing manual prompting.'
        },
        {
          label: 'Rubric-first drafting',
          value:
            'The agent parses requirements into a checklist, maps each project field to required proposal sections, drafts the proposal, and produces a compliance matrix.',
          rationale: 'Best when grading coverage is the main concern.'
        },
        {
          label: 'Critique and revise',
          value:
            'The agent drafts quickly, judges the draft for missing sections and weak claims, proposes targeted revisions, and lets the user accept or edit changes.',
          rationale: 'Best for a visible revision loop.'
        }
      ]
    },
    {
      id: 'evaluation-choice',
      title: 'Choose Evaluation Evidence',
      field: 'evaluation',
      question: 'How should the demo prove the workflow is useful?',
      options: [
        {
          label: 'Before / after',
          value: 'Compare a rough initial draft with the revised proposal on required-section coverage, specificity, and unresolved assumptions.',
          rationale: 'Simple and convincing for a classroom demo.'
        },
        {
          label: 'Scenario tests',
          value: 'Run normal, missing-information, requirement-check, unsupported-claim, and revision scenarios, then report pass/fail outcomes.',
          rationale: 'Best for demonstrating agent behavior across cases.'
        },
        {
          label: 'Human review',
          value: 'Have the student review whether each suggested field is accurate, useful, and ready for the final proposal before export.',
          rationale: 'Best when student ownership is important.'
        }
      ]
    }
  ];
}

function normalizeFieldSuggestions(suggestions, project) {
  const parsed = Array.isArray(suggestions)
    ? suggestions
        .map((item) => ({
          field: clean(item.field),
          label: clean(item.label) || labelForField(item.field),
          value: clean(item.value),
          confidence: clean(item.confidence) || 'Medium',
          reason: clean(item.reason) || 'Suggested by the model from the rough idea.'
        }))
        .filter((item) => item.field && item.value)
    : [];

  const fallback = buildFieldSuggestions(project);
  const seen = new Set(parsed.map((item) => item.field));
  const merged = [...parsed, ...fallback.filter((item) => !seen.has(item.field))];

  return merged.length ? merged : fallback;
}

function normalizeDecisions(decisions, project) {
  const parsed = Array.isArray(decisions)
    ? decisions
        .map((decision, index) => ({
          id: clean(decision.id) || `decision-${index + 1}`,
          title: clean(decision.title) || 'Decision Needed',
          field: clean(decision.field) || 'problem',
          question: clean(decision.question) || 'Which option best fits the project?',
          options: Array.isArray(decision.options)
            ? decision.options
                .map((option) => ({
                  label: clean(option.label),
                  value: clean(option.value),
                  rationale: clean(option.rationale)
                }))
                .filter((option) => option.label && option.value)
            : []
        }))
        .filter((decision) => decision.options.length)
    : [];

  return parsed.length ? parsed : buildDecisionCards(project);
}

function projectFromSuggestions(project, suggestions) {
  const next = { ...project };

  suggestions.forEach((suggestion) => {
    if (Object.hasOwn(next, suggestion.field) && suggestion.value) {
      next[suggestion.field] = suggestion.value;
    }
  });

  return next;
}

function keepOnlyAcceptedStartFields(originalProject, suggestedProject) {
  return {
    ...EMPTY_PROJECT_FOR_SERVER,
    ...originalProject,
    title: suggestedProject.title || originalProject.title,
    topic: originalProject.topic || originalProject.title,
    requirements: originalProject.requirements || DEFAULT_REQUIREMENTS
  };
}

function labelForField(field) {
  const labels = {
    title: 'Project Title',
    keywords: 'Keywords',
    abstract: 'Abstract',
    problem: 'Problem Framing',
    novelty: 'Novelty / Prior Work',
    goal: 'Project Goal',
    method: 'Method / Agent Workflow',
    figure: 'Figure Plan',
    expectedResults: 'Expected Results',
    timeline: 'Research Milestones',
    evaluation: 'Evaluation Plan',
    risks: 'Risks / Mitigation',
    resources: 'Resources',
    references: 'Sources / Assumptions'
  };

  return labels[clean(field)] || titleCase(field);
}

function summarizeProjectInput(project) {
  const fields = [
    ['Topic', project.title || project.topic],
    ['Keywords', project.keywords],
    ['Problem', project.problem],
    ['Novelty', project.novelty],
    ['Goal', project.goal],
    ['Method', project.method],
    ['Figure', project.figure],
    ['Expected results', project.expectedResults],
    ['Timeline', project.timeline],
    ['Evaluation', project.evaluation],
    ['Risks', project.risks],
    ['Resources', project.resources],
    ['References', project.references]
  ];
  const missing = buildQuestionObjects(project)
    .filter((question) => question.field !== 'next-step')
    .map((question) => question.reason);

  return {
    fields,
    missing,
    markdown: `# Intake Summary

${fields.map(([label, value]) => `- ${label}: ${clean(value) || 'Missing'}`).join('\n')}

## Missing or Weak Inputs
${missing.length ? missing.map((item) => `- ${item}`).join('\n') : '- None detected by the basic checker.'}
`
  };
}

function normalizeQuestions(questions, project) {
  const parsed = Array.isArray(questions)
    ? questions.map(normalizeQuestion).filter((question) => question.question)
    : [];

  return (parsed.length ? parsed : buildQuestionObjects(project)).slice(0, 5);
}

function normalizeQuestion(question) {
  if (!question) return null;

  if (typeof question === 'string') {
    return {
      id: `question-${question.slice(0, 18)}`,
      field: 'method',
      question: clean(question),
      reason: 'The model requested this clarification.',
      priority: 'High'
    };
  }

  return {
    id: clean(question.id) || `${clean(question.field) || 'question'}-${clean(question.question).slice(0, 18)}`,
    field: clean(question.field) || 'method',
    question: clean(question.question),
    reason: clean(question.reason) || 'This detail will improve the proposal.',
    priority: clean(question.priority) || 'High'
  };
}

function firstMissingField(project) {
  const firstQuestion = buildQuestionObjects(project).find((question) => question.field !== 'next-step');
  return firstQuestion?.field || 'method';
}

function mergeProject(current, incoming) {
  const next = { ...current };

  Object.entries(incoming).forEach(([key, value]) => {
    const cleaned = clean(value);
    if (cleaned) next[key] = cleaned;
  });

  return next;
}

function mergeField(current, addition) {
  const base = clean(current);
  const next = clean(addition);

  if (!base) return next;
  if (!next) return base;
  if (base.toLowerCase().includes(next.toLowerCase())) return base;
  return `${base}\n${next}`;
}

function normalizePayload(payload) {
  return {
    topic: clean(payload.topic),
    title: clean(payload.title) || clean(payload.topic),
    keywords: clean(payload.keywords),
    abstract: clean(payload.abstract),
    problem: clean(payload.problem),
    novelty: clean(payload.novelty),
    goal: clean(payload.goal),
    method: clean(payload.method),
    figure: clean(payload.figure),
    expectedResults: clean(payload.expectedResults),
    timeline: clean(payload.timeline),
    evaluation: clean(payload.evaluation),
    risks: clean(payload.risks),
    resources: clean(payload.resources),
    references: clean(payload.references),
    requirements: clean(payload.requirements) || DEFAULT_REQUIREMENTS
  };
}

function extractChecklist(requirements) {
  const items = clean(requirements)
    .split(/\n|;/)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 4)
    .filter((line) => !/^proposal must include:?$/i.test(line));

  return [...new Set(items.length ? items : DEFAULT_REQUIREMENTS.split('\n').slice(1).map((line) => line.replace(/^-\s*/, '')))];
}

function findRequirementEvidence(requirement, project) {
  const text = requirement.toLowerCase();

  if (/title/.test(text)) return project.title || '';
  if (/keyword/.test(text)) return project.keywords || '';
  if (/abstract/.test(text)) return project.abstract || '';
  if (/novelty|prior work/.test(text)) return project.novelty || '';
  if (/motivation|gap|problem|target context/.test(text)) return project.problem || '';
  if (/goal/.test(text)) return project.goal || '';
  if (/method|workflow|approach/.test(text)) return project.method || '';
  if (/figure|diagram/.test(text)) return project.figure || '';
  if (/expected|milestone|timeline/.test(text)) return project.expectedResults || project.timeline || '';
  if (/evaluation|metric|test/.test(text)) return project.evaluation || '';
  if (/risk|mitigation/.test(text)) return project.risks || '';
  if (/resource|budget|tool|release/.test(text)) return project.resources || '';
  if (/reference|assumption|source/.test(text)) return project.references || '';

  return '';
}

function readModelContent(data) {
  if (typeof data?.choices?.[0]?.message?.content === 'string') {
    return data.choices[0].message.content;
  }

  if (typeof data?.output_text === 'string') {
    return data.output_text;
  }

  const outputText = data?.output
    ?.flatMap((item) => item?.content || [])
    ?.map((item) => item?.text)
    ?.filter(Boolean)
    ?.join('\n');

  if (outputText) return outputText;

  return JSON.stringify(data);
}

function parseJsonContent(content) {
  const trimmed = clean(content);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    return {
      proposalLatex: looksLikeLatex(trimmed) ? trimmed : '',
      complianceMatrix: [],
      evaluationReport: '# Evaluation Report\n\nThe API returned text that was not JSON.',
      questions: ['Should the API prompt be tightened to return strict JSON?']
    };
  }
}

function coerceResult(result, project, checklist) {
  const complianceMatrix = Array.isArray(result.complianceMatrix) && result.complianceMatrix.length
    ? result.complianceMatrix.map((row) => ({
        requirement: clean(row.requirement),
        status: clean(row.status) || 'Needs work',
        evidence: clean(row.evidence),
        fix: clean(row.fix)
      }))
    : checklist.map((requirement) => ({
        requirement,
        status: findRequirementEvidence(requirement, project) ? 'Covered' : 'Needs work',
        evidence: findRequirementEvidence(requirement, project) || 'API did not provide matrix evidence.',
        fix: 'Regenerate with stricter output instructions.'
      }));

  const weakClaims = normalizeWeakClaims(result.weakClaims);

  return {
    proposalLatex: extractProposalLatex(result, project),
    complianceMatrix,
    weakClaims: weakClaims.length ? weakClaims : detectWeakClaims(project, complianceMatrix),
    coverage: computeCoverage(complianceMatrix),
    changelog: normalizeChangelog(result.changelog),
    evaluationReport: clean(result.evaluationReport) || '# Evaluation Report\n\nNo evaluation report returned.',
    questions: Array.isArray(result.questions) ? result.questions.map(clean).filter(Boolean).slice(0, 5) : []
  };
}

function normalizeWeakClaims(weakClaims) {
  if (!Array.isArray(weakClaims)) return [];
  return weakClaims
    .map((item) => ({
      claim: clean(item.claim),
      severity: clean(item.severity) || 'Medium',
      issue: clean(item.issue),
      fix: clean(item.fix)
    }))
    .filter((item) => item.claim)
    .slice(0, 10);
}

function normalizeChangelog(changelog) {
  if (!Array.isArray(changelog)) return [];
  return changelog
    .map((item) => ({
      section: clean(item.section),
      before: clean(item.before),
      after: clean(item.after),
      reason: clean(item.reason)
    }))
    .filter((item) => item.section || item.after)
    .slice(0, 20);
}

function extractProposalLatex(result, project) {
  const candidates = [
    result?.proposalLatex,
    result?.proposalTex,
    result?.latex,
    result?.tex
  ]
    .map(clean)
    .filter(Boolean);

  for (const candidate of candidates) {
    const unwrapped = unwrapLatexCandidate(candidate);
    if (looksLikeLatex(unwrapped)) {
      return unwrapped;
    }
  }

  return buildLocalProposalLatex(project);
}

function unwrapLatexCandidate(value) {
  let candidate = stripCodeFence(clean(value));

  for (let index = 0; index < 3; index += 1) {
    const trimmed = candidate.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) break;

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        candidate = stripCodeFence(parsed);
        continue;
      }

      const nested = parsed?.proposalLatex || parsed?.proposalTex || parsed?.latex || parsed?.tex;
      if (nested) {
        candidate = stripCodeFence(String(nested));
        continue;
      }

      break;
    } catch {
      const extracted = extractNestedLatexString(trimmed);
      if (extracted) {
        candidate = stripCodeFence(extracted);
        continue;
      }
      break;
    }
  }

  return candidate;
}

function stripCodeFence(value) {
  const trimmed = clean(value);
  const fenced = trimmed.match(/```(?:latex|tex)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
}

function isSpecific(value, length) {
  return clean(value).length >= length;
}

function clean(value) {
  return String(value || '').trim();
}

function looksLikeLatex(value) {
  return /^\\(?:documentclass\b|begin\{document\}|section\{)/.test(String(value || '').trim());
}

function extractNestedLatexString(value) {
  const match = String(value || '').match(/"proposalLatex"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:complianceMatrix|evaluationReport|questions)"/);

  if (!match?.[1]) {
    return '';
  }

  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function latexParagraph(value) {
  return escapeLatex(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

function escapeLatex(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function getProvider() {
  const provider = clean(process.env.LLM_PROVIDER).toLowerCase();
  const url = clean(process.env.LLM_API_URL).toLowerCase();

  if (provider === 'gemini' || url.includes('generativelanguage.googleapis.com')) {
    return 'gemini';
  }

  return 'openai-compatible';
}

function titleCase(value) {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function shortTopic(value) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  if (!words.length) return 'the proposed system';
  return words.slice(0, 8).join(' ');
}
