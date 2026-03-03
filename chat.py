"""
PageIndex Local Chatbot
=======================
Chat with your documents using the PageIndex tree structure and local Ollama model.
Uses the same reasoning-based retrieval pattern from the PageIndex cookbooks:
  1. LLM Tree Search  → find relevant nodes
  2. Context Extraction → get text from matched nodes
  3. Answer Generation → answer based on retrieved context

Usage:
  python chat.py ./results/your_document_structure.json
  python chat.py ./results/your_document_structure.json --model gpt-oss:120b-cloud
"""

import json
import copy
import argparse
import asyncio
from pageindex.utils import remove_fields, extract_json, Ollama_API_async


def create_node_mapping(tree):
    """Build a flat mapping of node_id -> node for quick lookup."""
    mapping = {}
    def traverse(nodes):
        if isinstance(nodes, list):
            for node in nodes:
                if isinstance(node, dict):
                    if 'node_id' in node:
                        mapping[node['node_id']] = node
                    if 'nodes' in node:
                        traverse(node['nodes'])
    traverse(tree)
    return mapping


async def run_chat(tree_path, model):
    print(f"Loading document tree from {tree_path}...")
    with open(tree_path, 'r', encoding='utf-8') as f:
        tree_data = json.load(f)

    # The structure JSON has format: {"doc_name": "...", "structure": [...]}
    if isinstance(tree_data, dict) and 'structure' in tree_data:
        doc_name = tree_data.get('doc_name', 'Unknown Document')
        tree_nodes = tree_data['structure']
    elif isinstance(tree_data, list):
        doc_name = 'Unknown Document'
        tree_nodes = tree_data
    else:
        print("Error: Unrecognized JSON structure format.")
        return

    node_map = create_node_mapping(tree_nodes)
    # Create a text-free copy for use in tree search prompts
    tree_for_search = remove_fields(copy.deepcopy(tree_nodes), fields=['text'])

    print(f"Document: {doc_name}")
    print(f"Total sections loaded: {len(node_map)}")
    print("Type your question and press Enter. Type 'exit' or 'quit' to stop.\n")

    while True:
        try:
            query = input("You: ").strip()
            if not query:
                continue
            if query.lower() in ['exit', 'quit']:
                print("Goodbye!")
                break

            # --- Step 1: LLM Tree Search (from tutorials/tree-search) ---
            print("\n🔍 Searching document tree...")

            search_prompt = f"""You are given a question and a tree structure of a document.
Each node contains a node_id, title, and summary.
Your task is to find all nodes that are likely to contain the answer to the question.

Question: {query}

Document tree structure:
{json.dumps(tree_for_search, indent=2)}

Reply in the following JSON format:
{{
    "thinking": "<your reasoning about which nodes are relevant>",
    "node_list": ["node_id_1", "node_id_2"]
}}
Directly return the final JSON structure. Do not output anything else."""

            search_response = await Ollama_API_async(model, search_prompt)

            # Use the project's own extract_json helper
            search_result = extract_json(search_response)

            node_list = search_result.get("node_list", [])
            if not node_list:
                print("\n⚠️ Could not identify relevant sections. Please try rephrasing.\n")
                continue

            # --- Step 2: Context Extraction (from cookbook/pageindex_RAG_simple) ---
            print("\n� Retrieved sections:")
            for nid in node_list:
                if nid in node_map:
                    node = node_map[nid]
                    page_info = f" (pages {node.get('start_index')}-{node.get('end_index')})" if 'start_index' in node else ""
                    print(f"  • {node.get('title', 'Unknown')}{page_info}")

            relevant_content = "\n\n".join(
                node_map[nid].get("text", node_map[nid].get("summary", ""))
                for nid in node_list
                if nid in node_map
            )

            if not relevant_content.strip():
                print("\n⚠️ No text content found in the matched sections.\n")
                continue

            # --- Step 3: Answer Generation (from cookbook/pageindex_RAG_simple) ---
            print("\n🤖 Generating answer...\n")

            answer_prompt = f"""Answer the question based on the context below.
If the answer cannot be found in the context, say so clearly.

Question: {query}
Context: {relevant_content}

Provide a clear, concise answer based only on the context provided."""

            answer = await Ollama_API_async(model, answer_prompt)

            print(f"Answer:\n{answer}")
            print("-" * 60 + "\n")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except json.JSONDecodeError:
            print("\n⚠️ Failed to parse the model's response as JSON. Please try again.\n")
        except Exception as e:
            print(f"\n⚠️ Error: {e}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Chat with your PageIndex document tree using local Ollama model"
    )
    parser.add_argument('tree_path', type=str,
                        help='Path to the generated _structure.json file')
    parser.add_argument('--model', type=str, default='gpt-oss:120b-cloud',
                        help='Ollama model to use (default: gpt-oss:120b-cloud)')
    args = parser.parse_args()

    asyncio.run(run_chat(args.tree_path, args.model))
