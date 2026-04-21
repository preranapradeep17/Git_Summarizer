# GitExplainer-2 — AI-Powered GitHub Repository Explainer

> Drop a GitHub link. Get architecture breakdowns, code explanations, dependency analysis, and an interactive Q&A — all powered by CodeBERT + FAISS + RAG + MCP.

---

## Architecture

```
GitHub URL
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                   MCP Server                         │
│  fetch_repository() → list_files() → read_file()   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│               Preprocessing Pipeline                 │
│  Filter noise → Fetch content → Detect tech stack  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              AST Parser + Chunker                    │
│  Tree-sitter (Python/JS) → Regex fallback           │
│  → Functions / Classes / Segments                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         CodeBERT Embeddings + FAISS Index            │
│  microsoft/codebert-base → 768-dim vectors          │
│  IndexFlatIP (cosine similarity)                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              RAG Query Engine (Groq)                 │
│  Query → embed → retrieve top-k → LLM explain      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Flask Frontend                          │
│  Dark UI · Project overview · Q&A chat              │
│  File explorer · Dependency graph · Tech stack      │
└─────────────────────────────────────────────────────┘
```

## Setup

### 1. Navigate to the project
```bash
cd GitExplainer-2
```

### 2. Create virtual environment (recommended)
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp sample_env.txt .env
# Edit .env — set GROQ_API_KEY (required), optionally GITHUB_TOKEN, SECRET_KEY
```

### 4. Run
```bash
./run.sh   # chmod +x if needed
```

Open **http://localhost:5001**

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
├── app.py                    # Flask application + API routes (/analyze, /query, /explain, /status)
├── orchestrator.py           # Pipeline coordinator + session cache (cache/)
├── requirements.txt
├── run.sh
├── .env                      # Config: GROQ_API_KEY, GITHUB_TOKEN, SECRET_KEY
├── sample_env.txt            # Template for .env
├── TODO.md                   # Development tasks
├── test_issues.py            # Issue testing utilities
│
├── cache/                    # Session embeddings (*.pkl)
│
├── mcp_server/
│   ├── __init__.py
│   ├── client.py             # MCP client wrapper
│   └── github_tools.py       # MCP server: fetch_repository, list_files, read_file, get_issues
│
├── pipeline/
│   ├── __init__.py
│   ├── preprocessor.py       # Filter, clean, detect tech stack
│   ├── parser.py             # Tree-sitter AST + regex chunker
│   ├── embedder.py           # CodeBERT embeddings + FAISS index
│   └── rag_engine.py         # RAG query + Groq LLM generation
│
├── templates/
│   └── index.html            # Dark-themed frontend
│
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```


## Features

- **MCP-based GitHub access** — structured tool calls via Model Context Protocol (repo fetch, files, issues)
- **Tree-sitter AST parsing** — semantically accurate code chunking (Python/JS)
- **CodeBERT embeddings** — code-aware vectors + FAISS index
- **RAG + Groq** — grounded explanations with citations
- **GitHub issues** — top issues fetched & searchable in RAG
- **Session caching** — instant reloads from cache/
- **Interactive Q&A** — codebase + issues queries
- **File explanations** — LLM breakdowns per file
- **Dependency & tech stack analysis** — imports graph, detected stack
