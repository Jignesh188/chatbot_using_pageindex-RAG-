"""
Vector RAG Processor
====================
Handles PDF text extraction, chunking, and embedding generation.
Uses Ollama's nomic-embed-text model for embeddings.
"""

import os
import time
import math
import asyncio
import aiohttp
import pymupdf
import tiktoken
from typing import List, Dict, Any, Optional
from database import get_logger

logger = get_logger()


class VectorRAGProcessor:
    """Complete Vector RAG processing pipeline."""

    EMBEDDING_MODEL = "nomic-embed-text"
    OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"
    CHUNK_SIZE = 500       # tokens per chunk
    CHUNK_OVERLAP = 50     # overlapping tokens

    def __init__(self):
        self.tokenizer = tiktoken.get_encoding("cl100k_base")

    # ─── Text Extraction ────────────────────────────────────────────────

    def extract_text_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extract text from each page of the PDF.
        Returns list of {page_number, text} dicts.
        """
        pages = []
        doc = pymupdf.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            if text.strip():
                pages.append({
                    "page_number": page_num + 1,
                    "text": text.strip()
                })
        doc.close()
        logger.info(f"📄 [VectorRAG] Extracted text from {len(pages)} pages")
        return pages

    # ─── Chunking ────────────────────────────────────────────────────────

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken."""
        return len(self.tokenizer.encode(text))

    def chunk_text(
        self,
        pages: List[Dict[str, Any]],
        chunk_size: int = None,
        chunk_overlap: int = None
    ) -> List[Dict[str, Any]]:
        """
        Split page texts into overlapping chunks.
        Each chunk has: chunk_index, text, token_count, page_numbers, char_start, char_end.
        """
        chunk_size = chunk_size or self.CHUNK_SIZE
        chunk_overlap = chunk_overlap or self.CHUNK_OVERLAP

        # Combine all pages into one continuous text with page markers
        full_text = ""
        page_boundaries = []  # (char_start, char_end, page_number)
        for page in pages:
            start = len(full_text)
            full_text += page["text"] + "\n\n"
            end = len(full_text)
            page_boundaries.append((start, end, page["page_number"]))

        # Tokenize and chunk
        tokens = self.tokenizer.encode(full_text)
        chunks = []
        chunk_index = 0
        i = 0

        while i < len(tokens):
            # Get chunk tokens
            chunk_tokens = tokens[i:i + chunk_size]
            chunk_text = self.tokenizer.decode(chunk_tokens).strip()

            if not chunk_text:
                i += chunk_size - chunk_overlap
                continue

            # Find character positions
            try:
                char_start = full_text.find(chunk_text[:50])
                char_end = char_start + len(chunk_text) if char_start >= 0 else -1
            except Exception:
                char_start = -1
                char_end = -1

            # Find which pages this chunk spans
            chunk_pages = []
            for pb_start, pb_end, page_num in page_boundaries:
                if char_start < pb_end and char_end > pb_start:
                    chunk_pages.append(page_num)

            chunks.append({
                "chunk_index": chunk_index,
                "text": chunk_text,
                "token_count": len(chunk_tokens),
                "page_numbers": chunk_pages if chunk_pages else [1],
                "char_start": max(char_start, 0),
                "char_end": max(char_end, 0),
            })

            chunk_index += 1
            i += chunk_size - chunk_overlap

        logger.info(
            f"✂️  [VectorRAG] Created {len(chunks)} chunks "
            f"(size={chunk_size}, overlap={chunk_overlap})"
        )
        return chunks

    # ─── Embedding Generation ────────────────────────────────────────────

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text using Ollama."""
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": self.EMBEDDING_MODEL,
                "prompt": text
            }
            async with session.post(self.OLLAMA_EMBED_URL, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("embedding", [])
                else:
                    error_text = await resp.text()
                    logger.error(f"❌ [VectorRAG] Embedding error: {error_text}")
                    return []

    async def generate_embeddings_batch(
        self,
        chunks: List[Dict[str, Any]],
        batch_size: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate embeddings for all chunks in batches.
        Returns chunks with 'embedding' field added.
        """
        total = len(chunks)
        logger.info(f"🧬 [VectorRAG] Generating embeddings for {total} chunks...")
        start_time = time.time()

        for i in range(0, total, batch_size):
            batch = chunks[i:i + batch_size]
            tasks = [self.generate_embedding(chunk["text"]) for chunk in batch]
            embeddings = await asyncio.gather(*tasks)

            for chunk, embedding in zip(batch, embeddings):
                chunk["embedding"] = embedding

            progress = min(i + batch_size, total)
            logger.info(
                f"   📊 [VectorRAG] Embedded {progress}/{total} chunks "
                f"({math.ceil(progress / total * 100)}%)"
            )

        elapsed = round(time.time() - start_time, 2)
        embedding_dim = len(chunks[0]["embedding"]) if chunks and chunks[0].get("embedding") else 0
        logger.info(
            f"✅ [VectorRAG] All embeddings generated in {elapsed}s "
            f"(dim={embedding_dim})"
        )

        return chunks

    # ─── Full Pipeline ───────────────────────────────────────────────────

    async def process_pdf(self, doc_id: str, pdf_path: str) -> Dict[str, Any]:
        """
        Complete Vector RAG processing pipeline.
        Returns processing result with stats.
        """
        pipeline_start = time.time()

        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 [VectorRAG] Starting processing for doc_id={doc_id}")
        logger.info(f"{'='*60}")

        # Step 1: Extract text
        step_start = time.time()
        pages = self.extract_text_from_pdf(pdf_path)
        extract_time = round(time.time() - step_start, 2)

        total_text = " ".join(p["text"] for p in pages)
        total_text_tokens = self.count_tokens(total_text)

        logger.info(f"   ⏱️  Text extraction: {extract_time}s | {total_text_tokens} tokens")

        # Step 2: Chunk text
        step_start = time.time()
        chunks = self.chunk_text(pages)
        chunk_time = round(time.time() - step_start, 2)
        logger.info(f"   ⏱️  Chunking: {chunk_time}s | {len(chunks)} chunks created")

        # Step 3: Generate embeddings
        step_start = time.time()
        chunks = await self.generate_embeddings_batch(chunks)
        embed_time = round(time.time() - step_start, 2)

        embedding_dim = len(chunks[0]["embedding"]) if chunks and chunks[0].get("embedding") else 0
        logger.info(f"   ⏱️  Embedding: {embed_time}s | dim={embedding_dim}")

        total_time = round(time.time() - pipeline_start, 2)

        # Calculate total chunk tokens
        total_chunk_tokens = sum(c["token_count"] for c in chunks)

        result = {
            "doc_id": doc_id,
            "status": "completed",
            "num_chunks": len(chunks),
            "num_pages": len(pages),
            "embedding_dim": embedding_dim,
            "total_text_tokens": total_text_tokens,
            "total_chunk_tokens": total_chunk_tokens,
            "processing_time": total_time,
            "extract_time": extract_time,
            "chunk_time": chunk_time,
            "embed_time": embed_time,
            "chunks": chunks,
        }

        logger.info(f"\n{'='*60}")
        logger.info(f"✅ [VectorRAG] Processing complete for doc_id={doc_id}")
        logger.info(
            f"   📊 {len(chunks)} chunks | {total_chunk_tokens} tokens | "
            f"{embedding_dim}d embeddings | {total_time}s total"
        )
        logger.info(f"{'='*60}\n")

        return result
