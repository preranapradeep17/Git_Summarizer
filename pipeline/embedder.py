"""
Pipeline Step 3: FAST Embeddings + FAISS Vector Store
Optimized with MiniLM + caching + batching
"""

import os
import pickle
import numpy as np
from typing import List, Dict, Any

from sentence_transformers import SentenceTransformer

# Global model (loaded once)
_model = None


def _get_model():
    global _model
    if _model is None:
        print("[Embedder] Loading FAST model (MiniLM)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[Embedder] Model loaded.")
    return _model


# Cache directory
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)


def embed_texts(texts: List[str], cache_key: str = None, batch_size: int = 32) -> np.ndarray:
    """Generate fast embeddings using MiniLM with caching."""
    model = _get_model()

    if cache_key:
        cache_path = os.path.join(CACHE_DIR, f"{cache_key}.pkl")
        if os.path.exists(cache_path):
            print("[Cache] Loading embeddings from disk...")
            with open(cache_path, "rb") as f:
                return pickle.load(f)

    print(f"[Embedder] Embedding {len(texts)} chunks...")

    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True
    )

    embeddings = np.array(embeddings).astype("float32")

    if cache_key:
        with open(cache_path, "wb") as f:
            pickle.dump(embeddings, f)

    return embeddings


class FAISSVectorStore:
    """FAISS-backed vector store with metadata."""

    def __init__(self, index_path: str = None):
        self.index = None
        self.metadata: List[Dict] = []
        self.index_path = index_path
        self.dim = 384  # MiniLM embedding size

    def build(self, chunks: List[Dict[str, Any]], repo_id: str = "default") -> None:
        import faiss

        texts = [c["text"] for c in chunks]

        self.metadata = [
            {
                "chunk_id": c["chunk_id"],
                "file_path": c["file_path"],
                "chunk_name": c["chunk_name"],
                "node_type": c["node_type"],
                "start_line": c["start_line"],
                "end_line": c["end_line"],
                "raw_code": c["raw_code"],
                "language": c.get("language", "unknown"),
            }
            for c in chunks
        ]

        print(f"[FAISS] Embedding {len(texts)} chunks...")
        embeddings = embed_texts(texts, cache_key=f"{repo_id}_embeddings")

        self.index = faiss.IndexFlatIP(self.dim)
        self.index.add(embeddings)

        print(f"[FAISS] Index built with {self.index.ntotal} vectors.")

    def query(self, query_text: str, top_k: int = 8) -> List[Dict[str, Any]]:
        if self.index is None or self.index.ntotal == 0:
            return []

        q_emb = embed_texts([query_text])
        scores, indices = self.index.search(q_emb, min(top_k, self.index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            meta = self.metadata[idx].copy()
            meta["score"] = float(score)
            results.append(meta)

        return results

    def save(self, path: str) -> None:
        import faiss
        os.makedirs(path, exist_ok=True)
        faiss.write_index(self.index, os.path.join(path, "index.faiss"))
        with open(os.path.join(path, "metadata.pkl"), "wb") as f:
            pickle.dump(self.metadata, f)
        print(f"[FAISS] Saved to {path}")

    def load(self, path: str) -> bool:
        import faiss
        idx_path = os.path.join(path, "index.faiss")
        meta_path = os.path.join(path, "metadata.pkl")
        if not (os.path.exists(idx_path) and os.path.exists(meta_path)):
            return False
        self.index = faiss.read_index(idx_path)
        with open(meta_path, "rb") as f:
            self.metadata = pickle.load(f)
        print(f"[FAISS] Loaded {self.index.ntotal} vectors from {path}")
        return True

    @property
    def is_ready(self) -> bool:
        return self.index is not None and self.index.ntotal > 0
