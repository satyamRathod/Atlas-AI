Raw - Project: Atlas-AI

A production-grade AI backend built with Node.js + TypeScript + LangChain + Groq + Qdrant that demonstrates modern GenAI, RAG, and LLM engineering concepts.

The goal is not just "chat with PDFs". The goal is to showcase engineering skills that companies expect from senior backend engineers working with AI.

Tech Stack
Node.js 24+
TypeScript
Express
LangChain (JS v1)
Groq (LLM)
Transformers.js (local embeddings)
Qdrant
Zod
Pino
pnpm Workspace
Final Features

Phase 1 — AI Chat
Chat endpoint
Streaming (SSE)
Conversation history
Session management
LangChain Chat Model
Prompt Templates
Phase 2 — RAG

Knowledge base from local documents.

Pipeline:

Markdown/PDF/DOCX

↓

LangChain Loaders

↓

Text Splitter

↓

Local Embeddings

↓

Qdrant

↓

Retriever

↓

LLM

↓

Answer with citations

Features

Semantic Search
Configurable chunking
Metadata
Citations
Phase 3 — Advanced Retrieval

Not just vector search.

Implement

Hybrid Search
BM25
Reciprocal Rank Fusion (RRF)
Cross Encoder Re-ranking
Metadata Filtering
Similarity Threshold
Max Marginal Relevance (MMR)

This is what differentiates production RAG.

Phase 4 — Memory

Conversation memory

Short-term memory
Long-term memory
Conversation summarization
Context trimming
Token budgeting
Phase 5 — AI Observability

Every AI request should expose

Model
Provider
Input Tokens
Output Tokens
Cost
Latency
Prompt
Retrieved Documents
Scores
Sources

Very useful for interviews.

Phase 6 — Prompt Engineering

Implement multiple prompt strategies

Basic Prompt
RAG Prompt
Structured Output
JSON Mode
Few-shot
Chain of Thought (when appropriate)
Dynamic Prompt Building
Phase 7 — Structured Output

Generate

JSON
Zod validated responses
Tool outputs

Instead of plain text.

Phase 8 — Function Calling / Tools

LangChain Tools

Examples

Weather
Calculator
Database Search
File Search

Understand

Tool Calling
Tool Execution
Tool Results
Phase 9 — Agents

Build

Single Agent
ReAct Agent
Tool Calling Agent

Understand

Planning
Acting
Observation
Phase 10 — LangGraph

Move from simple chains to graphs.

Learn

State
Nodes
Edges
Conditional Routing
Human in the Loop
Checkpointing
Phase 11 — Multi-Agent

Example

User

↓

Planner

↓

Retriever

↓

Research Agent

↓

Writer Agent

↓

Reviewer

↓

Final Answer
Phase 12 — Evaluation

Build evaluation framework

Retrieval Precision
Recall
Faithfulness
Hallucination Detection
Latency
Cost
Phase 13 — Production Features
Rate Limiting
Retry
Timeouts
Caching
Streaming
Cancellation
Request IDs
Logging
Metrics
Folder Structure (High Level)
src/

app/
config/
http/

langchain/
chat/
embeddings/
loaders/
splitters/
vectorstores/
retrievers/
prompts/
indexing/
tools/
agents/
graphs/

modules/
chat/

cli/

Only langchain contains AI-specific infrastructure.

What We Had Already Built

Before switching to LangChain, we had implemented and understood:

Custom LLM provider abstraction
Streaming abstraction
Embedding provider
Qdrant integration
Semantic retrieval
Context provider
Prompt builder
Conversation store
Token counting
Context trimming
Conversation summarization
RAG with citations

Those concepts are important because they explain what LangChain is abstracting away.

What We Are Replacing With LangChain
Old New
LLMProvider BaseChatModel
PromptBuilder ChatPromptTemplate
EmbeddingProvider Embeddings
SemanticRetriever VectorStore.asRetriever()
GenerateRequest PromptValue / BaseMessage[]
GenerateResponse AIMessage
ContextWindowTrimmer LangChain memory / future
ConversationSummarizer LangGraph / memory

The goal is to use native LangChain contracts wherever possible.

Immediate Roadmap

This is what I'd generate with Codex, in order:

Rename/create the new LangChain modules (create-chat-model, create-embeddings, create-knowledge-loader, create-text-splitter, create-qdrant-vector-store).
Build the knowledge indexing CLI using:
DirectoryLoader
RecursiveCharacterTextSplitter
QdrantVectorStore
Replace the current custom ingestion pipeline.
Build retrieval using vectorStore.asRetriever().
Replace the current chat flow with an LCEL RAG chain (ChatPromptTemplate → Retriever → ChatModel).
Add streaming with LangChain.
Add advanced retrieval (hybrid search, reranking, etc.).
My recommendation

Don't ask Codex to generate the whole project in one shot.

Give it small, architecture-aware milestones such as:

"Implement the LangChain indexing pipeline."
"Replace the custom chat service with an LCEL chain."
"Implement a retriever using QdrantVectorStore.asRetriever()."

That way, the generated code stays cohesive, and it's much easier for you to read and understand each concept afterward.

I think this approach will get you back on track much faster than continuing to redesign while coding.

#######################################
Detailed
#######################################

Atlas-AI Roadmap
Phase 1 — LangChain Foundation ⭐

Goal: Replace custom AI infrastructure with native LangChain.

Topics:

LangChain architecture
Chat Models
Prompt Templates
Messages
LCEL basics
Streaming
DirectoryLoader
TextSplitter
Embeddings
QdrantVectorStore
Retriever
Indexing CLI

Deliverable:

AI Chat + RAG working end-to-end

GitHub milestone:

"Production-ready LangChain RAG foundation"

Phase 2 — Advanced RAG ⭐⭐⭐

Topics:

Hybrid Search
BM25
RRF
MMR
Cross Encoder Re-ranking
Metadata Filtering
Query Expansion
Multi Query Retrieval
Context Compression
Parent Document Retrieval
Self Query Retriever

Deliverable:

Production-grade retrieval engine

This phase alone teaches what most engineers call "advanced RAG".

Phase 3 — Memory ⭐⭐⭐

Topics:

Chat History
Token Budgeting
Conversation Summaries
Long-term Memory
Semantic Memory
Vector Memory
Memory Retrieval

Deliverable:

Persistent AI conversations
Phase 4 — Prompt Engineering ⭐⭐

Topics:

Prompt Templates
Dynamic Prompts
Few-shot
Structured Output
JSON Mode
Output Parsers
Guardrails

Deliverable:

Reliable structured AI responses
Phase 5 — Tools ⭐⭐⭐

Topics:

Tool Calling
Calculator
Weather
File Search
Database Search
Custom Tools
Tool Error Handling

Deliverable:

LLM can interact with external systems
Phase 6 — Agents ⭐⭐⭐⭐

Topics:

ReAct
Planning
Acting
Observation
AgentExecutor
Multi-tool agents

Deliverable:

Autonomous task execution
Phase 7 — LangGraph ⭐⭐⭐⭐⭐

Topics:

State
Nodes
Edges
Conditional Routing
Checkpoints
Human Approval
Interrupts

Deliverable:

Complex AI workflows
Phase 8 — Multi-Agent ⭐⭐⭐⭐⭐

Topics:

Planner
Researcher
Writer
Reviewer
Critic
Coordinator

Deliverable:

Multi-agent collaboration system
Phase 9 — Evaluation ⭐⭐⭐⭐

Topics:

Faithfulness
Precision
Recall
Hallucination Detection
RAG Evaluation
Prompt Evaluation
Benchmarking

Deliverable:

AI quality dashboard
Phase 10 — Observability ⭐⭐⭐

Topics:

Token Usage
Costs
Latency
Tracing
Logs
Retrieved Documents
Prompt Inspection

Deliverable:

Production AI monitoring
Phase 11 — Production ⭐⭐⭐

Topics:

Caching
Rate Limiting
Retries
Timeouts
Background Jobs
Incremental Indexing
Webhooks

Deliverable:

Production-ready AI backend
Phase 12 — Capstone ⭐⭐⭐⭐⭐

Build one complete system using everything.

Examples:

AI Knowledge Assistant
Customer Support Copilot
Codebase Assistant
Internal Company Search
Research Assistant

This becomes the centerpiece of your GitHub portfolio.

How to use Codex

I would not ask:

"Build Phase 1."

That's too large.

Instead, split each phase into milestones.

For example, Phase 1 becomes:

LangChain project structure.
Chat model + prompt + streaming.
Document indexing pipeline.
Retriever.
RAG chat chain.
Conversation history.
End-to-end integration.
Cleanup and documentation.

Each milestone is around 300–800 lines of code, which is a comfortable size for review and understanding.

I have one more recommendation

Don't think of these as "12 prompts."

Think of them as 12 GitHub milestones.

Each milestone should end with:

✅ Working application
✅ Git commit
✅ README update
✅ Architecture diagram
✅ Things learned
✅ Next milestone

By the time you finish all 12, your repository won't just be a collection of AI examples—it will read like the incremental development of a production AI platform. That's much more compelling in interviews because you can explain not only what you built, but why each capability was added and how the architecture evolved.
