import {
  type BaseMessagePromptTemplateLike,
  ChatPromptTemplate,
  type Example,
  FewShotChatMessagePromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';

import type { RenderablePromptTemplate } from './prompt-template.types.js';

/** Formats one `{input, output}` example as a human/ai message pair. */
const EXAMPLE_PROMPT = ChatPromptTemplate.fromMessages([
  ['human', '{input}'],
  ['ai', '{output}'],
]);

export interface BuildDynamicPromptOptions {
  /** Only spliced in when both this is `true` *and* the template has examples — see chat.schema.ts's `useFewShot`. */
  useFewShot: boolean;
}

/**
 * Assembles the chat prompt for a turn from a stored template record —
 * this is what "dynamic prompts" means in this codebase (§3 of
 * docs/phases/phase-4-prompt-engineering.md): which system-prompt text runs
 * and whether few-shot examples are spliced in is decided per-request from
 * the prompt registry, instead of Phase 1-3's single `ragPrompt` built once
 * at module load.
 *
 * Scope limit: `template.systemPrompt` may reference any subset of the four
 * variables `ChatService` always supplies — `{context}`, `{summary}`,
 * `{memory}` here, `{question}` in the trailing human message — but can't
 * introduce new variable names, since nothing else fills them in.
 */
export function buildDynamicPrompt(
  template: RenderablePromptTemplate,
  { useFewShot }: BuildDynamicPromptOptions,
): ChatPromptTemplate {
  // Untyped array because `FewShotChatMessagePromptTemplate` (a
  // `BaseChatPromptTemplate`) isn't part of `fromMessages`'s
  // `BaseMessagePromptTemplateLike` union in these type defs, even though
  // it's a documented, supported entry at runtime.
  const messages: unknown[] = [['system', template.systemPrompt]];

  if (useFewShot && template.fewShotExamples.length > 0) {
    messages.push(
      new FewShotChatMessagePromptTemplate({
        // `Example` is a `Record<string, string>`; `FewShotExample` is a
        // plain named interface with the same shape but no index
        // signature, which TS won't structurally match here.
        examples: [...template.fewShotExamples] as unknown as Example[],
        examplePrompt: EXAMPLE_PROMPT,
        inputVariables: [],
      }),
    );
  }

  messages.push(new MessagesPlaceholder('history'), ['human', '{question}']);

  return ChatPromptTemplate.fromMessages(messages as BaseMessagePromptTemplateLike[]);
}
