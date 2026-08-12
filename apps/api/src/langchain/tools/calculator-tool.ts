import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import type { RegisteredTool } from './tool.types.js';

const NAME = 'calculator';
const DESCRIPTION =
  'Evaluates an arithmetic expression and returns the numeric result. Supports ' +
  '+, -, *, /, % (modulo), ^ (power), parentheses, and unary minus, e.g. "(12 + 8) * 3" or "2^10 % 7".';

const schema = z.object({
  expression: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('The arithmetic expression to evaluate, e.g. "(12 + 8) * 3".'),
});

type CalculatorArgs = z.infer<typeof schema>;

export class ExpressionError extends Error {}

/**
 * A small, dependency-free tokenizer + recursive-descent parser —
 * deliberately not `eval`/`new Function`. The model (not a trusted
 * developer) controls `expression`, so it must never reach a general-purpose
 * JS evaluator; this grammar can only ever produce a number, never execute
 * arbitrary code (§2 of docs/phases/phase-5-tools.md's "why" for this tool).
 */
function tokenize(expression: string): string[] {
  const pattern = /([()+\-*/%^]|\d+\.?\d*|\.\d+)/g;
  const tokens: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-loop idiom
  while ((match = pattern.exec(expression))) {
    const gap = expression.slice(lastIndex, match.index);
    if (gap.trim().length > 0) {
      throw new ExpressionError(`Unexpected character near "${gap.trim()}".`);
    }
    tokens.push(match[1] as string);
    lastIndex = pattern.lastIndex;
  }

  const trailingGap = expression.slice(lastIndex);
  if (trailingGap.trim().length > 0) {
    throw new ExpressionError(`Unexpected character near "${trailingGap.trim()}".`);
  }

  if (tokens.length === 0) {
    throw new ExpressionError('Expression is empty.');
  }

  return tokens;
}

/** Grammar (highest to lowest precedence): primary/parens -> power (^, right-assoc) -> unary (-, +) -> term (*, /, %) -> expression (+, -). */
function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  let pos = 0;

  const peek = (): string | undefined => tokens[pos];
  const next = (): string => {
    const token = tokens[pos];
    if (token === undefined) throw new ExpressionError('Unexpected end of expression.');
    pos += 1;
    return token;
  };

  function parsePrimary(): number {
    const token = next();

    if (token === '(') {
      const value = parseAddSub();
      if (next() !== ')') throw new ExpressionError('Missing closing parenthesis.');
      return value;
    }

    const value = Number(token);
    if (Number.isNaN(value)) throw new ExpressionError(`Unexpected token "${token}".`);
    return value;
  }

  function parsePower(): number {
    const base = parsePrimary();
    if (peek() === '^') {
      next();
      return base ** parseUnary();
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      next();
      return -parseUnary();
    }
    if (peek() === '+') {
      next();
      return parseUnary();
    }
    return parsePower();
  }

  function parseMulDiv(): number {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const rhs = parseUnary();
      if (op === '*') value *= rhs;
      else {
        if (rhs === 0) throw new ExpressionError('Division by zero.');
        value = op === '/' ? value / rhs : value % rhs;
      }
    }
    return value;
  }

  function parseAddSub(): number {
    let value = parseMulDiv();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const rhs = parseMulDiv();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  const result = parseAddSub();
  if (pos !== tokens.length) {
    throw new ExpressionError(`Unexpected token "${tokens[pos]}".`);
  }
  if (!Number.isFinite(result)) {
    throw new ExpressionError('Result is not a finite number.');
  }

  return result;
}

async function execute({
  expression,
}: CalculatorArgs): Promise<{ expression: string; result: number }> {
  return { expression, result: evaluateExpression(expression) };
}

export function createCalculatorTool(): RegisteredTool {
  return {
    name: NAME,
    description: DESCRIPTION,
    schema,
    execute,
    structuredTool: tool(execute, { name: NAME, description: DESCRIPTION, schema }),
  } as unknown as RegisteredTool;
}
