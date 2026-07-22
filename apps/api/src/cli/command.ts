export interface Command {
  readonly name: string;
  readonly description: string;

  execute(args: string[]): Promise<void>;
}
