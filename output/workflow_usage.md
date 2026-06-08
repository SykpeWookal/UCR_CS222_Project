# Workflow Usage Report

## Initial Idea
An agentic, rubric-aware system that turns a rough research idea into a complete, citation-grounded research proposal through human-in-the-loop critique and a verifiable revision loop

Domain/constraints: CS NLP course final project; single student; one quarter; LLM API with a local deterministic fallback

## Workflow Run Summary

| Step | What Happened | Artifact Or Evidence |
| --- | --- | --- |
| Intake | Captured rough idea + domain | run_log.md |
| References | Agent recommended references; user used 4 | run-evidence.json |
| Upload | Uploaded "reading-note.pdf" (270 chars) | run-evidence.json |
| Suggestions | 12 accepted, 1 edited, 1 rejected, 1 commented | this file |
| Draft v1 | Coverage 13/13, 4 weak claims | compliance_matrix.md |
| Revision v2 | Coverage 13/13 -> 13/13 | evaluation_report.md |
| Final | v2 (revised) exported | proposal.pdf / proposal.tex |

## Accepted / Edited / Rejected / Commented

| Suggestion | Action | Reason |
| --- | --- | --- |
| Concise project title | Accepted | High confidence |
| Keywords | Accepted | High confidence |
| Motivation, gap, and target context | Accepted | High confidence |
| Novelty relative to prior work | Accepted | High confidence |
| Agent workflow | Accepted | High confidence |
| Architecture diagram | Accepted | High confidence |
| Abstract | Accepted | High confidence |
| Project Goal | Accepted | High confidence |
| Expected Results | Accepted | High confidence |
| Risks / Mitigation | Accepted | High confidence |
| Research Milestones | Accepted | High confidence |
| Resources | Accepted | High confidence |
| Evaluation plan | Edited | user added baselines/metrics |
| Sources / Assumptions | Rejected | Use AI-recommended + uploaded references instead. |
| novelty | Commented | "Be explicit about prior work: contrast with general LLM chat (ChatGPT), one-shot..." |

## Revision Evidence
- Weakness(es) selected: The expected outcome is a prototype that improves proposal completeness, alignment with rubrics, citation traceability, and user efficiency compared with baseline LLM drafting workflows. | These systems can help draft text or check broad requirements, but they typically do not treat a proposal rubric as an executable specification that drives generation, critique, and revision.
- Feedback given: Strengthen the evaluation with explicit baselines and numbers (single-shot ChatGPT vs our workflow), and make the novelty claim verifiable rather than comparative wording.
- Coverage before/after: 13/13 -> 13/13
- Remaining weak claims after revision: 0

### Changelog
- **Abstract**: Stated that the expected outcome improves completeness, traceability, and user efficiency relative to baselines. -> Reframed improvement as a hypothesis with explicit metrics and made user efficiency optional, measured by time-on-task and manual edits. (Addresses selected weakness about claiming improvement before evaluation and lacking a user-efficiency metric.)
- **Novelty and Relation to Prior Work**: Made a broad comparative claim that comparable systems typically do not treat a proposal rubric as an executable specification. -> Scoped novelty to the course proposal task and made it verifiable through checklist, source-note, critique, decision, and revision-diff traceability. (Addresses selected weakness about broad comparative wording and feedback requesting verifiable novelty.)
- **Expected Results and Milestones**: Mentioned evaluation against a baseline but did not emphasize explicit baseline setup in the milestone text. -> Added baseline prompt and annotation guide to weeks 1--2 and described evaluation against explicit baselines. (Addresses feedback to strengthen evaluation with explicit baselines and numbers.)
- **Evaluation**: Compared draft version 1, revised version 2, and a single-shot LLM baseline with several targets. -> Defined B1 as a single-shot ChatGPT-style baseline, Ours as the full workflow, optional no-retrieval ablation, numeric targets for coverage, unsupported claims, citation links, LaTeX compilation, audit completeness, and optional efficiency measures. (Addresses both selected weakness on metrics and feedback requesting explicit baselines and numbers.)

## Used References
1. Lewis et al., Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (2020) [High] https://scholar.google.com/scholar?q=Retrieval-Augmented%20Generation%20for%20Knowledge-Intensive%20NLP%20Tasks
2. Gao et al., ALCE: Enabling Large Language Models to Generate Text with Citations (2023) [High] https://scholar.google.com/scholar?q=ALCE%3A%20Enabling%20Large%20Language%20Models%20to%20Generate%20Text%20with%20Citations
3. Madaan et al., Self-Refine: Iterative Refinement with Self-Feedback (2023) [High] https://scholar.google.com/scholar?q=Self-Refine%3A%20Iterative%20Refinement%20with%20Self-Feedback
4. Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (2023) [High] https://scholar.google.com/scholar?q=Reflexion%3A%20Language%20Agents%20with%20Verbal%20Reinforcement%20Learning

## Reflection
- The agent reliably structured the idea, recommended relevant references, and produced a covered, ~3-page proposal.
- Human judgment was needed for the novelty framing, the evaluation baselines, and selecting which weaknesses to fix.
