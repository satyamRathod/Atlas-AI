export interface ExecutionOptions {
  /**
   * Override the default provider model.
   * Example:
   *  - gpt-5
   *  - gpt-5-mini
   */
  model?: string;

  /**
   * Sampling temperature.
   */
  temperature?: number;

  /**
   * Maximum number of output tokens.
   */
  maxOutputTokens?: number;

  /**
   * Stream the response.
   */
  stream?: boolean;

  /**
   * Cancel an in-flight request.
   */
  signal?: AbortSignal;

  /**
   * Timeout in milliseconds.
   */
  timeoutMs?: number;
}
