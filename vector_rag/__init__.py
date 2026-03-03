"""
Vector RAG Module
=================
Traditional Vector RAG pipeline for comparison with PageIndex.
Uses chunking + embeddings + cosine similarity search.
"""

from .processor import VectorRAGProcessor
from .search import VectorRAGSearch
