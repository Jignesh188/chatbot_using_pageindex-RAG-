'use client';

import { useState } from 'react';

interface ChunkData {
    doc_id: string;
    chunk_index: number;
    text: string;
    token_count: number;
    page_numbers: number[];
    char_start: number;
    char_end: number;
}

interface VRAGStatus {
    doc_id: string;
    status: string;
    num_chunks: number;
    num_pages: number;
    embedding_dim: number;
    total_text_tokens: number;
    total_chunk_tokens: number;
    processing_time?: number;
    extract_time?: number;
    chunk_time?: number;
    embed_time?: number;
}

interface VectorChunksViewerProps {
    chunks: ChunkData[];
    vragStatus: VRAGStatus | null;
    onClose: () => void;
    docName: string;
}

export default function VectorChunksViewer({ chunks, vragStatus, onClose, docName }: VectorChunksViewerProps) {
    const [expandedChunk, setExpandedChunk] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredChunks = searchTerm
        ? chunks.filter(c =>
            c.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.page_numbers.some(p => p.toString().includes(searchTerm))
        )
        : chunks;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-[scale-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">Vector RAG Chunks</h2>
                            <p className="text-xs font-medium text-gray-500 truncate max-w-md">{docName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Stats Bar */}
                {vragStatus && (
                    <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/80">
                        <div className="grid grid-cols-6 gap-3">
                            <StatBadge label="Chunks" value={vragStatus.num_chunks.toString()} color="black" />
                            <StatBadge label="Pages" value={vragStatus.num_pages.toString()} color="black" />
                            <StatBadge label="Embed Dim" value={vragStatus.embedding_dim.toString() + 'd'} color="black" />
                            <StatBadge label="Tokens" value={vragStatus.total_chunk_tokens.toLocaleString()} color="black" />
                            <StatBadge label="Embed Time" value={vragStatus.embed_time ? vragStatus.embed_time + 's' : '-'} color="black" />
                            <StatBadge label="Total Time" value={vragStatus.processing_time ? vragStatus.processing_time + 's' : '-'} color="black" />
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="px-6 py-3 border-b border-gray-100">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search chunks by text or page number..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                        />
                        {searchTerm && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                                {filteredChunks.length} results
                            </span>
                        )}
                    </div>
                </div>

                {/* Chunks List */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <div className="space-y-2">
                        {filteredChunks.map((chunk) => {
                            const isExpanded = expandedChunk === chunk.chunk_index;
                            return (
                                <div
                                    key={chunk.chunk_index}
                                    className={`border rounded-xl transition-all duration-200 ${isExpanded
                                        ? 'border-gray-300 bg-gray-100/50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                                        }`}
                                >
                                    <button
                                        onClick={() => setExpandedChunk(isExpanded ? null : chunk.chunk_index)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isExpanded
                                            ? 'bg-gray-800 text-white'
                                            : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {chunk.chunk_index}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 truncate font-medium">
                                                {chunk.text.substring(0, 120)}...
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                    </svg>
                                                    Pages: {chunk.page_numbers.join(', ')}
                                                </span>
                                                <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" />
                                                        <line x1="12" y1="4" x2="12" y2="20" />
                                                    </svg>
                                                    {chunk.token_count} tokens
                                                </span>
                                                <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                        <circle cx="12" cy="10" r="3" />
                                                    </svg>
                                                    {chunk.char_start}-{chunk.char_end}
                                                </span>
                                            </div>
                                        </div>
                                        <svg
                                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            className={`text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                        >
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 animate-[fade-in_0.2s_ease-out]">
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-800">Full Text</span>
                                                    <span className="text-[10px] font-medium text-gray-400">
                                                        ({chunk.token_count} tokens / {chunk.text.length} chars)
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-[system-ui]">
                                                    {chunk.text}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {filteredChunks.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-sm text-gray-500">No chunks found matching your search.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        black: 'bg-gray-100 border border-gray-200 text-gray-800',
        blue: 'bg-blue-100 text-blue-700',
        purple: 'bg-purple-100 text-purple-700',
        indigo: 'bg-indigo-100 text-indigo-700',
        fuchsia: 'bg-fuchsia-100 text-fuchsia-700',
        pink: 'bg-pink-100 text-pink-700',
    };
    const classes = colorMap[color] || colorMap.black;

    return (
        <div className={`${classes} rounded-lg px-3 py-2 text-center`}>
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-sm font-bold mt-0.5">{value}</p>
        </div>
    );
}
