/**
 * Base class for all Atlas AI workflows.
 */
export abstract class Workflow<TContext, TResult> {
  /**
   * Executes the workflow.
   */
  public abstract execute(context: TContext): Promise<TResult>;
}
