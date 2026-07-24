import type { Logger } from 'pino';

/**
 * Shared execution context for workflows.
 */
export interface WorkflowContext {
  /**
   * Structured logger.
   */
  readonly logger: Logger;

  /**
   * Correlation identifier.
   */
  readonly correlationId: string;

  /**
   * Workflow start time.
   */
  readonly startedAt: Date;
}
