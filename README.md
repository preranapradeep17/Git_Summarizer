# RepoExplainer — AI-Powered GitHub Repository Explainer

> Drop a GitHub link. Get architecture breakdowns, code explanations, dependency analysis, and an interactive Q&A — all powered by CodeBERT + FAISS + RAG + MCP.

---

## Architecture

```
GitHub URL
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                   MCP Server                         │
│ fetch_repository() → list_files() → read_file()     │
│ → fetch_issues()                                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│               Preprocessing Pipeline                 │
│ Filter files → Clean content → Detect tech stack    │
│ + Process GitHub issues                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              AST Parser + Chunker                    │
│ Tree-sitter (Python/JS) → Regex fallback            │
│ → Functions / Classes / Issue chunks                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│        MiniLM Embeddings + FAISS Index               │
│ all-MiniLM-L6-v2 → 384-dim vectors                  │
│ Code + Issues unified embedding space               │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              RAG Query Engine (Groq)                 │
│ Query → embed → retrieve (code + issues) → LLM      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Flask Frontend                          │
│ Project overview · Issues · Q&A chat                │
│ Dependency graph · Tech stack                       │
└─────────────────────────────────────────────────────┘
```

## Setup

### 1. Clone / navigate to the project
```bash
cd GitExplainer-2
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — add GROQ_API_KEY and optionally GITHUB_TOKEN
```

### 4. Run
```bash
chmod +x run.sh
./run.sh
```

Then open **http://localhost:5001**

---

## API Keys

| Key | Where to get | Required? |
|-----|-------------|-----------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | **Yes** |
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) | No (but raises rate limit 60→5000/hr) |

---

## Project Structure

```
GitExplainer-2/
├── app.py                    # Flask API routes
├── orchestrator.py           # Pipeline coordinator + caching + issues
├── requirements.txt
├── run.sh
├── .env
├── cache/                    # Saved FAISS indexes
│
├── mcp_server/
│   ├── client.py
│   └── github_tools.py       # MCP tools (repo, files, issues)
│
├── pipeline/
│   ├── preprocessor.py       # File + issue preprocessing
│   ├── parser.py             # AST + regex chunking
│   ├── embedder.py           # MiniLM embeddings + FAISS
│   └── rag_engine.py         # RAG + Groq LLM
│
├── templates/
│   └── index.html
│
└── static/
    ├── css/style.css
    └── js/app.js
```

## Features

* MCP-based GitHub access — structured tool calls for repo, files, and issues
* Tree-sitter AST parsing — accurate code structure extraction (Python/JS)
* Regex fallback — supports additional languages
* MiniLM embeddings (384-dim) — fast and efficient semantic search
* FAISS indexing — high-speed similarity retrieval
* RAG + Groq (LLaMA 3.3) — grounded, context-aware explanations
* GitHub Issues Integration — bug and feature awareness
* Unified retrieval — code and issues processed together
* Session caching — avoids re-embedding for faster reuse
* Interactive Q&A — ask anything about the repository
* File-level explanations — module breakdowns
* Dependency & tech stack analysis
