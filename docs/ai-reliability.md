# AI reliability

Search and deterministic analysis work without credentials. Existing RAG uses SQLite FTS5 BM25 and lexical term overlap, followed by exact sentence extraction with paper/page/chunk references. The evidence inspector resolves the stored passage. This is extractive retrieval, not a semantic embedding model. Embeddings, hybrid semantic reranking and automated contradiction resolution are **not implemented**.

Ollama and OpenAI-compatible adapters may return a validated structured interpretation with explicit excerpt indices. Unknown citations, additional numbers, certification claims, invalid schemas and detected instruction-like content fail closed to extractive results. Model/provider timeouts leave search and exact quotes available. Prompts tell the provider to treat documents and questions as untrusted data. Pattern detection is defense in depth and cannot guarantee immunity to all prompt injection.

Interpretations are labeled hypotheses. Numeric/citation checks do **not** prove entailment, factual correctness or scientific validation. Provider identity and method version accompany responses; generated outputs are not persisted as experimental facts. There is no validated predictive model. The existing unsupported lunar/certification refusal gate is conservative and may reject a legitimate qualitative question; use mission ranking for evidence relevance rather than safety claims.

`python -m app.evaluate` runs a small versioned source-referenced regression set, checks expected source retrieval and exact quote attribution, and writes actual results. This is an engineering regression set, not an expert-reviewed scientific benchmark or a generative-model accuracy score. Additional adversarial/structured-output tests are in `tests/test_reliability.py`.
