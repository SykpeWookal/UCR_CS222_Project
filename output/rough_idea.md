# Rough idea and the user's interaction

## Rough idea
An agentic, rubric-aware system that turns a rough research idea into a complete, citation-grounded research proposal through human-in-the-loop critique and a verifiable revision loop

## Domain / constraints
CS NLP course final project; LLM API

## Comment sent to the agent (Novelty)
Be explicit about prior work: contrast with general LLM chat (ChatGPT), one-shot proposal generators, and compliance tools like Civio. Our difference is rubric-grounded coverage checks plus a measurable before/after revision loop with weak-claim detection.

## Manual edit (Evaluation)
Evaluate on 12 rough ideas across 3 domains. Metrics: required-section coverage (target 13/13), number of high-severity unsupported claims (target 0 after one revision), and a 1-5 human rubric score for novelty/method/evaluation (target mean >= 4). Compare draft v1 vs revised v2 (before/after) and against a single-shot ChatGPT baseline.

## Answer to the agent's clarifying question
The target users are CS students writing their first research proposal and TAs who review them. Success means a reviewer can reconstruct the workflow from the run log and confirm the revised proposal covers all required sections with no unsupported claims.

## Revision feedback
Strengthen the evaluation with explicit baselines and numbers (single-shot ChatGPT vs our workflow), and make the novelty claim verifiable rather than comparative wording.

## Suggestion decisions
- Accepted: Concise project title, Keywords, Motivation, gap, and target context, Novelty relative to prior work, Agent workflow, Architecture diagram, Abstract, Project Goal, Expected Results, Risks / Mitigation, Research Milestones, Resources
- Edited: Evaluation plan
- Rejected: Sources / Assumptions
- Commented: novelty
