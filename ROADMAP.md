# Atlas AI Roadmap

## Vision

Atlas AI is a practical AI application platform built to learn and implement modern Generative AI systems from first principles.

The goal is **not** to build another LangChain.

The goal is to understand how modern AI applications are built and then integrate the right frameworks where they add value.

---

# Current Status

## ✅ Completed

### Platform

- [x] Monorepo
- [x] Express API
- [x] Logging
- [x] Configuration
- [x] SSE Streaming

### LLM

- [x] Provider abstraction
- [x] OpenAI/Groq provider
- [x] Request builder
- [x] Response mapper
- [x] Streaming support



### Chat

- [x] Conversation store
- [x] Prompt builder
- [x] Context trimming
- [x] Token budgeting

---



# Phase 1 — Production RAG

Goal:

Chat with your own knowledge.

## 1. Knowledge Ingestion

- [ ] Markdown Loader
- [ ] PDF Loader
- [ ] HTML Loader

---



## 2. Chunking

- [ ] Fixed Chunking
- [ ] Sliding Window
- [ ] Recursive Chunking
- [ ] Metadata

---



## 3. Embeddings

- [ ] Embedding Provider
- [ ] OpenAI Embeddings
- [ ] Local Embeddings
- [ ] Embedding Versioning

---



## 4. Vector Storage

- [ ] pgvector
- [ ] Similarity Search
- [ ] Metadata Storage

---



## 5. Retrieval

- [ ] Top-K Search
- [ ] Score Threshold
- [ ] Metadata Filters

---



## 6. RAG Prompt Builder

- [ ] Inject Retrieved Context
- [ ] Citations
- [ ] Prompt Compression

---



## Milestone

Atlas AI answers questions from uploaded documents.

---



# Phase 2 — Better Retrieval

Goal:

Improve answer quality.

- [ ] Hybrid Search (BM25 + Vector)
- [ ] Query Expansion
- [ ] Multi Query Retrieval
- [ ] Parent Document Retrieval
- [ ] Context Compression
- [ ] Reranking

---



# Phase 3 — LangChain

Goal:

Understand what LangChain abstracts.

Replace our implementation with LangChain components one by one.

- [ ] Document Loaders
- [ ] Text Splitters
- [ ] Embeddings
- [ ] Retrievers
- [ ] Chains

Understand:

- Why it exists
- What code it replaces
- When to use it
- When not to use it

---



# Phase 4 — LangGraph

Goal:

State-based AI workflows.

- [ ] State
- [ ] Nodes
- [ ] Edges
- [ ] Conditional Routing
- [ ] Persistence

---



# Phase 5 — Tool Calling

Goal:

LLM performs actions.

- [ ] Weather Tool
- [ ] Calculator
- [ ] SQL Tool
- [ ] HTTP Tool
- [ ] Custom Tools

---



# Phase 6 — AI Agents

Goal:

Autonomous reasoning.

- [ ] Planning
- [ ] Reflection
- [ ] Memory
- [ ] Tool Selection
- [ ] Error Recovery
- [] ReAct
- [] Self Correction

---



# Phase 7 — Multi-Agent Systems

Goal:

Agents collaborate.

- [ ] Supervisor Pattern
- [ ] Research Agent
- [ ] Coding Agent
- [ ] Reviewer Agent

---



# Phase 8 — Production

- [ ] Observability
- [ ] Evaluation
- [ ] Guardrails
- [ ] Cost Tracking
- [ ] Rate Limiting
- [ ] Deployment
- [ ] Tracing




Atlas AI

Phase 0 ✅

Basic Chat
Streaming
Provider Abstraction

────────────────────────────

Phase 1

Production RAG

    1. Markdown Loader
    2. PDF Loader
    3. Chunking
    4. Embeddings
    5. pgvector
    6. Retrieval
    7. RAG Prompt
    8. Citations

Deliverable:

Chat with your own documents.

────────────────────────────

Phase 2

Advanced Retrieval

Hybrid Search
BM25
Reranking
Metadata Filtering
Query Expansion

────────────────────────────

Phase 3

LangChain

Replace our implementation piece by piece.

Understand:

- Loaders
- Splitters
- Retrievers
- Chains

────────────────────────────

Phase 4

LangGraph

State
Nodes
Edges
Persistence
Conditional Routing

────────────────────────────

Phase 5

Tool Calling

OpenAI Tool Calling
MCP
Custom Tools
