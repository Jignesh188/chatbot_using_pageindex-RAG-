"""
Vector RAG Search
=================
Vector similarity search and answer generation for the Vector RAG pipeline.
Uses cosine similarity with NumPy for efficient search.
"""

import time
import numpy as np
from typing import List, Dict, Any
from database import get_logger, get_vrag_chunks_collection
from pageindex.utils import Ollama_API_async, count_tokens

logger = get_logger()


class VectorRAGSearch:
    """Vector similarity search and LLM answer generation."""

    def __init__(self, embedding_model: str = "nomic-embed-text"):
        self.embedding_model = embedding_model

    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        a_arr = np.array(a)
        b_arr = np.array(b)
        dot = np.dot(a_arr, b_arr)
        norm_a = np.linalg.norm(a_arr)
        norm_b = np.linalg.norm(b_arr)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a query text."""
        import aiohttp
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": self.embedding_model,
                "prompt": query
            }
            async with session.post(
                "http://localhost:11434/api/embeddings", json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("embedding", [])
                else:
                    logger.error(f"❌ [VectorRAG] Query embedding error")
                    return []

    async def search_chunks(
        self,
        query: str,
        doc_id: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for most relevant chunks using vector similarity.
        Returns top-k chunks with similarity scores.
        """
        search_start = time.time()

        # Embed the query
        query_embedding = await self.embed_query(query)
        if not query_embedding:
            logger.error("❌ [VectorRAG] Failed to embed query")
            return []

        # Fetch all chunks for this document from MongoDB
        chunks_collection = get_vrag_chunks_collection()
        if chunks_collection is None:
            return []

        cursor = chunks_collection.find({"doc_id": doc_id})
        all_chunks = await cursor.to_list(length=10000)

        if not all_chunks:
            logger.warning(f"⚠️ [VectorRAG] No chunks found for doc_id={doc_id}")
            return []

        # Compute similarity scores
        scored_chunks = []
        for chunk in all_chunks:
            embedding = chunk.get("embedding", [])
            if embedding:
                score = self.cosine_similarity(query_embedding, embedding)
                scored_chunks.append({
                    "chunk_index": chunk.get("chunk_index", 0),
                    "text": chunk.get("text", ""),
                    "page_numbers": chunk.get("page_numbers", []),
                    "token_count": chunk.get("token_count", 0),
                    "similarity_score": round(score, 4),
                })

        # Sort by similarity (descending) and take top-k
        scored_chunks.sort(key=lambda x: x["similarity_score"], reverse=True)
        top_chunks = scored_chunks[:top_k]

        search_time = round(time.time() - search_start, 2)
        logger.info(
            f"🔍 [VectorRAG] Search completed in {search_time}s | "
            f"Top score: {top_chunks[0]['similarity_score'] if top_chunks else 'N/A'}"
        )

        return top_chunks

    async def generate_answer(
        self,
        query: str,
        relevant_chunks: List[Dict[str, Any]],
        model: str = "gpt-oss:120b-cloud"
    ) -> Dict[str, Any]:
        """
        Generate an answer using retrieved chunks as context.
        Uses the same Ollama model as PageIndex.
        """
        tokens_used = 0

        # Build context from retrieved chunks
        context_parts = []
        for chunk in relevant_chunks:
            pages = ", ".join(str(p) for p in chunk.get("page_numbers", []))
            context_parts.append(
                f"[Chunk {chunk['chunk_index']} | Pages: {pages} | "
                f"Similarity: {chunk['similarity_score']}]\n{chunk['text']}"
            )
        context = "\n\n---\n\n".join(context_parts)

        if not context.strip():
            return {
                "answer": "I couldn't find relevant information in the document for your question.",
                "tokens_used": 0,
            }

        # Generate answer using same prompt style as PageIndex
        answer_prompt = f"""You are a helpful, conversational, and expert AI assistant.
Your task is to answer the user's question clearly, naturally, and warmly, using ONLY the information provided in the Context below.

Guidelines:
1. Speak in a natural, human-like, and friendly tone. If the user greets (Hi, Hy, hey, Hello, Good morning, etc.) or says Goodbye, respond politely and naturally.
2. Structure your answer beautifully (using paragraphs or bullet points if it helps readability).
3. If the answer cannot be found in the context, politely inform the user that the document doesn't contain that information, rather than making things up.
4. Do not mention that you are reading from a "context" or "provided text" - just answer the question directly as if you are the knowledgeable author of the document.
5. If the user asks something outside the scope of the provided document, politely say: "I only know about the information provided in your document. Please ask questions related to it."

Context:
{context}

User Question: {query}

Please provide your conversational and helpful answer:"""

        tokens_used += count_tokens(answer_prompt, model=model)

        answer = await Ollama_API_async(model, answer_prompt)
        tokens_used += count_tokens(answer, model=model)

        return {
            "answer": answer,
            "tokens_used": tokens_used,
        }
