/** One few-shot example: a fixed input/output pair spliced into the prompt as a human/ai message turn (§3). */
export interface FewShotExample {
  input: string;
  output: string;
}

/**
 * The subset of a stored prompt-template version (`modules/prompts`) that
 * `render-prompt.ts` actually needs to assemble a `ChatPromptTemplate` —
 * kept here (in `langchain/`, not `modules/`) so this lower layer never
 * depends on the `modules/prompts` application layer, mirroring how
 * `langchain/memory/memory.types.ts` is consumed by `modules/chat`.
 */
export interface RenderablePromptTemplate {
  systemPrompt: string;
  fewShotExamples: readonly FewShotExample[];
}
