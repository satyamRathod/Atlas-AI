/**
 * Lightweight token overlap helpers for context precision without an LLM
 * call when citations are clearly unused / clearly used (§ hybrid scoring
 * in docs/phases/phase-9-evaluation.md).
 */

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'as',
  'by',
  'with',
  'from',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'you',
  'your',
  'we',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'if',
  'i',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** Jaccard-like overlap of content tokens between two strings. */
export function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Heuristic: a citation is "relevant" if it overlaps the reply OR the
 * question above a small threshold. Clear misses (near-zero overlap with
 * both) short-circuit as irrelevant without an LLM call.
 */
export function heuristicCitationRelevant(
  question: string,
  reply: string,
  citationText: string,
): { relevant: boolean; confident: boolean; overlap: number } {
  const withReply = tokenOverlapRatio(citationText, reply);
  const withQuestion = tokenOverlapRatio(citationText, question);
  const overlap = Math.max(withReply, withQuestion);

  if (overlap >= 0.08) {
    return { relevant: true, confident: true, overlap };
  }
  if (overlap <= 0.02) {
    return { relevant: false, confident: true, overlap };
  }
  // Ambiguous band — let the LLM decide when the caller asks.
  return { relevant: overlap >= 0.05, confident: false, overlap };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
