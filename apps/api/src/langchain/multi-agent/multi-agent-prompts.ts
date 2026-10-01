import type { DraftVersion, ResearchNote, ReviewVerdict } from './multi-agent.types.js';

const TEAM_DESCRIPTION = `Team:
- planner: breaks the question into a short ordered list of steps the team should follow.
- researcher: looks up facts/context and can call tools (calculator, weather, file search, order lookup, current date/time) to gather information the answer needs.
- writer: drafts (or revises) the final answer to the user's question, using the plan and research gathered so far.
- reviewer: critiques the latest draft for accuracy/completeness/clarity and returns approved or rejected-with-feedback.`;

function renderPlan(plan: readonly string[]): string {
  if (plan.length === 0) return '(no plan yet)';
  return plan.map((step, i) => `${i + 1}. ${step}`).join('\n');
}

function renderResearchNotes(notes: readonly ResearchNote[]): string {
  if (notes.length === 0) return '(no research gathered yet)';
  return notes.map((note) => `[Round ${note.round}] ${note.content}`).join('\n\n');
}

function renderLatestDraft(drafts: readonly DraftVersion[]): string {
  const latest = drafts.at(-1);
  return latest ? `[Round ${latest.round}]\n${latest.content}` : '(no draft yet)';
}

function renderLatestReview(reviews: readonly ReviewVerdict[]): string {
  const latest = reviews.at(-1);
  if (!latest) return '(not reviewed yet)';
  return latest.approved
    ? `Approved (round ${latest.round}).`
    : `Rejected (round ${latest.round}) — feedback: ${latest.feedback ?? '(none given)'}`;
}

/**
 * Renders the full shared-state snapshot every prompt in this file uses in
 * some form — the concrete implementation of "shared state" (§1 of
 * docs/phases/phase-8-multi-agent.md): instead of a growing message
 * transcript, every specialist (and the coordinator) sees the same compact
 * summary of everything the team has produced so far.
 */
function renderStateSummary(state: {
  question: string;
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  reviewHistory: readonly ReviewVerdict[];
}): string {
  return `User's question: ${state.question}

Plan:
${renderPlan(state.plan)}

Research notes:
${renderResearchNotes(state.researchNotes)}

Latest draft:
${renderLatestDraft(state.draftHistory)}

Latest review:
${renderLatestReview(state.reviewHistory)}`;
}

/**
 * The coordinator's system prompt (§1) — describes the team and the
 * routing decision it must make every visit. Used with
 * `withStructuredOutput({ next, instructions })`.
 */
export function buildCoordinatorSystemPrompt(): string {
  return `You are the coordinator of a small team of specialist AI agents working together to answer a user's question thoroughly and accurately.

${TEAM_DESCRIPTION}

On every turn, decide which ONE specialist should act next and give them clear, specific instructions for what to do this round.

Guidance:
- Start with the planner if there is no plan yet.
- Send the researcher when the plan calls for information not already gathered, or when the reviewer said the research was insufficient.
- Send the writer once there is enough research to draft an answer, or to revise a draft after reviewer feedback.
- Always send the reviewer after a new or revised draft, before finishing.
- Only choose "finish" once the latest draft has been reviewed and approved.`;
}

export function buildCoordinatorHumanPrompt(state: {
  question: string;
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  reviewHistory: readonly ReviewVerdict[];
  round: number;
  maxRounds: number;
}): string {
  return `${renderStateSummary(state)}

Round ${state.round + 1} of at most ${state.maxRounds}. Decide the next specialist and their instructions.`;
}

export function buildPlannerSystemPrompt(): string {
  return `You are the planning specialist on a team of AI agents (a researcher, a writer, and a reviewer, coordinated by a supervisor). Given the user's question and the coordinator's instructions, propose (or revise) a short ordered list of high-level steps the team should take to produce a thorough, accurate answer. Keep each step to one short sentence.`;
}

export function buildPlannerHumanPrompt(state: {
  question: string;
  plan: readonly string[];
  instructions: string;
}): string {
  return `Coordinator's instructions: ${state.instructions}

User's question: ${state.question}

Existing plan (revise it if the instructions call for that, otherwise propose a fresh one):
${renderPlan(state.plan)}`;
}

export function buildResearcherSystemPrompt(input: {
  context: string;
  summary: string;
  memory: string;
}): string {
  return `You are the research specialist on a team of AI agents answering a user's question. Use the provided context, conversation summary, remembered facts, and — when genuinely needed — your tools to gather the information the coordinator asked for. Reply with a concise, factual summary of what you found (or already knew); this becomes a shared research note the rest of the team relies on. Do not draft the final answer yourself.

Context:
${input.context}

Conversation summary:
${input.summary}

Remembered facts:
${input.memory}`;
}

export function buildResearcherHumanPrompt(state: {
  question: string;
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  instructions: string;
}): string {
  return `Coordinator's instructions: ${state.instructions}

User's question: ${state.question}

Plan:
${renderPlan(state.plan)}

Research gathered so far:
${renderResearchNotes(state.researchNotes)}`;
}

export function buildWriterSystemPrompt(): string {
  return `You are the writing specialist on a team of AI agents. Draft a clear, well-organized final answer to the user's question, using the plan and research notes below. If reviewer feedback is present, revise the previous draft to directly address every point raised — do not ignore it or start over unnecessarily. Reply with only the answer itself, not commentary about your process.`;
}

export function buildWriterHumanPrompt(state: {
  question: string;
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  reviewHistory: readonly ReviewVerdict[];
  instructions: string;
}): string {
  return `Coordinator's instructions: ${state.instructions}

${renderStateSummary(state)}`;
}

export function buildReviewerSystemPrompt(): string {
  return `You are the reviewer on a team of AI agents. Check the latest draft against the user's question, the plan, and the research notes for accuracy, completeness, and clarity. Approve only if it fully and accurately answers the question with no unsupported claims. If not, reject with specific, actionable feedback the writer can use to revise. Be reasonably strict on the first pass, but avoid demanding endless revisions over minor stylistic preferences.`;
}

export function buildReviewerHumanPrompt(state: {
  question: string;
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  instructions: string;
}): string {
  return `Coordinator's instructions: ${state.instructions}

User's question: ${state.question}

Plan:
${renderPlan(state.plan)}

Research notes:
${renderResearchNotes(state.researchNotes)}

Draft to review:
${renderLatestDraft(state.draftHistory)}`;
}
