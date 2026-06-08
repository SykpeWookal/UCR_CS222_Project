# AI Usage Log

## Tools Used
- Cursor (vibe coding) to build the agent and UI.
- Local Node/Express API wrapping the OpenAI-compatible endpoint.
- poppler pdftotext for uploaded-PDF text extraction; LaTeX (latexmk/pdflatex) for PDF compilation.

## Models Or APIs
- Provider: openai-compatible
- Model: gpt-5.5
- Local fallback used? no (API configured)

## What AI Helped With
- Planning: workflow stages and stopping criteria.
- Coding: agent endpoints, references, upload, PDF export.
- Writing proposal: drafting the LaTeX from the project state.
- Evaluating proposal: compliance matrix, weak-claim detection, revision changelog.

## Workflow Calls
| Stage | Tool / Model | Input | Output | Human decision |
| --- | --- | --- | --- | --- |
| references | openai-compatible / gpt-5.5 | "references" | { "references": [ { "title": "Retrieval-Augmented ... | reviewed |
| start | openai-compatible / gpt-5.5 | "start" | { "project": { "title": "Rubric-Aware Agentic Prop... | reviewed |
| comment-novelty | openai-compatible / gpt-5.5 | "integrate-answer" | { "project": { "title": "Rubric-Aware Agentic Prop... | reviewed |
| answer-question | openai-compatible / gpt-5.5 | "integrate-answer" | { "project": { "title": "Rubric-Aware Agentic Prop... | reviewed |
| proposal-v1 | openai-compatible / gpt-5.5 | "Rubric-Aware Agentic Proposal Builder w | { "proposalLatex": "\\documentclass[11pt]{article}... | reviewed |
| revision-v2 | openai-compatible / gpt-5.5 | "Rubric-Aware Agentic Proposal Builder w | { "proposalLatex": "\\documentclass[11pt]{article}... | reviewed |

## Human Review
- Checked weak-claim flags before accepting the draft.
- Verified the figure renders and is referenced in text.
- Compared coverage before/after revision.
- API key kept only in server-side .env (gitignored).

## Final Ownership Statement
I reviewed the generated code and proposal artifacts. I am responsible for the final submission.
