import type { TokenBudget } from './token-budget.js';

interface TokenBudgetManagerOptions {
  contextWindow: number;
  reservedOutputTokens: number;
}

export class TokenBudgetManager {
  constructor(private readonly options: TokenBudgetManagerOptions) {}

  createBudget(): TokenBudget {
    const availableInputTokens = this.options.contextWindow - this.options.reservedOutputTokens;

    return {
      maxInputTokens: this.options.contextWindow,
      reservedOutputTokens: this.options.reservedOutputTokens,
      availableInputTokens,
    };
  }

  fits(inputTokens: number): boolean {
    return inputTokens <= this.createBudget().availableInputTokens;
  }
}
