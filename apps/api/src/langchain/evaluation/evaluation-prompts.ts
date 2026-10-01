export function buildClaimExtractionSystemPrompt(): string {
  return `You extract atomic factual claims from an assistant's answer. Each claim must be a short, self-contained statement that can be checked against retrieved context. Do not invent claims that are not in the answer. Cap the list at the requested maximum.`;
}

export function buildClaimExtractionHumanPrompt(params: {
  question: string;
  reply: string;
  maxClaims: number;
}): string {
  return `User question:
${params.question}

Assistant answer:
${params.reply}

Extract up to ${params.maxClaims} atomic factual claims from the assistant answer. Return JSON { "claims": string[] }.`;
}

export function buildFaithfulnessSystemPrompt(): string {
  return `You are a RAG faithfulness judge. For each claim, decide whether the retrieved context supports it, does not support it, or contradicts it. Use only the provided context — do not use outside knowledge. If the context is empty or says no relevant context was found, mark claims as unsupported unless they are pure tautologies about the lack of information.`;
}

export function buildFaithfulnessHumanPrompt(params: {
  question: string;
  context: string;
  claims: readonly string[];
}): string {
  const claimList = params.claims.map((c, i) => `${i + 1}. ${c}`).join('\n');
  return `User question:
${params.question}

Retrieved context:
${params.context || '(empty)'}

Claims to judge:
${claimList}

For each claim (same order), return JSON { "verdicts": [{ "support": "supported"|"unsupported"|"contradictory", "rationale": string }] }.`;
}

export function buildChunkRelevanceSystemPrompt(): string {
  return `You decide whether a retrieved document chunk is useful for answering the user's question. Answer strictly yes or no.`;
}

export function buildChunkRelevanceHumanPrompt(params: {
  question: string;
  chunk: string;
}): string {
  return `Question: ${params.question}

Chunk:
${params.chunk}

Is this chunk useful for answering the question? Return JSON { "relevant": boolean }.`;
}

export function buildRecallCoverageSystemPrompt(): string {
  return `You extract atomic claims from a ground-truth answer, then decide whether each claim is attributable to the retrieved context (even if paraphrased). Do not use outside knowledge.`;
}

export function buildRecallCoverageHumanPrompt(params: {
  question: string;
  groundTruth: string;
  context: string;
  maxClaims: number;
}): string {
  return `User question:
${params.question}

Ground-truth answer:
${params.groundTruth}

Retrieved context:
${params.context || '(empty)'}

1) Extract up to ${params.maxClaims} atomic claims from the ground-truth answer.
2) For each, say whether the retrieved context covers it.

Return JSON { "items": [{ "claim": string, "covered": boolean }] }.`;
}

export function buildCorrectnessSystemPrompt(): string {
  return `You score how correctly an assistant answer matches a reference answer for the same question. Score from 0 (wrong / unrelated) to 1 (fully correct). Partial credit is allowed.`;
}

export function buildCorrectnessHumanPrompt(params: {
  question: string;
  reply: string;
  expectedAnswer: string;
}): string {
  return `Question: ${params.question}

Reference answer:
${params.expectedAnswer}

Assistant answer:
${params.reply}

Return JSON { "score": number } where score is between 0 and 1.`;
}
