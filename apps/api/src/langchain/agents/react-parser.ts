import type { ReactParseResult } from './agent.types.js';

const THOUGHT_RE = /^Thought:\s*(.*)$/i;
const ACTION_RE = /^Action:\s*(.*)$/i;
const ACTION_INPUT_RE = /^Action Input:\s*(.*)$/i;
const FINAL_ANSWER_RE = /^Final Answer:\s*(.*)$/i;

/**
 * A small line-based parser for the model's raw `Thought:`/`Action:`/
 * `Action Input:`/`Final Answer:` completion (§2 of
 * docs/phases/phase-6-agents.md). Each labeled section may span multiple
 * lines — it runs until the next recognized label or end of text.
 *
 * If neither `Action:` nor `Final Answer:` is found anywhere in the text,
 * the whole response is treated as an implicit final answer rather than
 * re-prompting the model to fix its format — a documented limitation, not a
 * bug (§9/known trade-offs).
 */
export function parseReactResponse(text: string): ReactParseResult {
  const lines = text.split('\n');

  let current: 'thought' | 'action' | 'actionInput' | 'finalAnswer' | undefined;
  const buffers: Record<'thought' | 'action' | 'actionInput' | 'finalAnswer', string[]> = {
    thought: [],
    action: [],
    actionInput: [],
    finalAnswer: [],
  };

  for (const line of lines) {
    const thoughtMatch = line.match(THOUGHT_RE);
    const actionMatch = line.match(ACTION_RE);
    const actionInputMatch = line.match(ACTION_INPUT_RE);
    const finalAnswerMatch = line.match(FINAL_ANSWER_RE);

    if (thoughtMatch) {
      current = 'thought';
      buffers.thought.push(thoughtMatch[1] ?? '');
    } else if (actionMatch) {
      current = 'action';
      buffers.action.push(actionMatch[1] ?? '');
    } else if (actionInputMatch) {
      current = 'actionInput';
      buffers.actionInput.push(actionInputMatch[1] ?? '');
    } else if (finalAnswerMatch) {
      current = 'finalAnswer';
      buffers.finalAnswer.push(finalAnswerMatch[1] ?? '');
    } else if (current) {
      buffers[current].push(line);
    }
  }

  const thought = buffers.thought.join('\n').trim();
  const actionText = buffers.action.join('\n').trim();
  const action = actionText.length > 0 ? actionText : undefined;
  const actionInputRaw = buffers.actionInput.join('\n').trim();
  const finalAnswerText = buffers.finalAnswer.join('\n').trim();
  const finalAnswer = finalAnswerText.length > 0 ? finalAnswerText : undefined;

  if (!action && !finalAnswer) {
    return { thought: thought || text.trim(), finalAnswer: text.trim() };
  }

  if (finalAnswer) {
    return { thought, finalAnswer };
  }

  return {
    thought,
    ...(action ? { action } : {}),
    actionInput: parseActionInput(actionInputRaw),
  };
}

function parseActionInput(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
