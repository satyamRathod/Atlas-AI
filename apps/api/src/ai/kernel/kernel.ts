import { KnowledgeModule } from './knowledge-module.js';

/**
 * Atlas AI application kernel.
 *
 * The kernel acts as the composition root for the application.
 * It is responsible for constructing and exposing application modules.
 */
export class Kernel {
  /**
   * Knowledge module.
   */
  public readonly knowledge: KnowledgeModule;

  constructor() {
    this.knowledge = new KnowledgeModule();
  }
}
