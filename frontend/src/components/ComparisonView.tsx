'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface VRAGChunk {
    chunk_index: number;
    text: string;
    page_numbers: number[];
    token_count: number;
    similarity_score: number;
}

interface Message {
    role: 'user' | 'bot';
    content: string;
    // PageIndex fields
    sections?: { node_id: string; title: string; start_index?: number; end_index?: number }[];
    // Vector RAG fields
    chunks?: VRAGChunk[];
    tokens?: number;
    time?: number;
}

interface DocInfo {
    doc_id: string;
    doc_name: string;
    status: string;
    processing_time?: number;
    total_tokens?: number;
    num_sections?: number;
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

interface ComparisonViewProps {
    activeDoc: DocInfo | null;
    // PageIndex
    piMessages: Message[];
    piIsThinking: boolean;
    piOnViewTree?: () => void;
    // Vector RAG
    vragMessages: Message[];
    vragIsThinking: boolean;
    vragStatus: VRAGStatus | null;
    // Shared
    onSend: (question: string) => void;
    onViewChunks?: () => void;
}

/* ─── Inline SVG Icon Components ──────────────────────────────────────────── */

function TreeIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" /><rect x="3" y="18" width="18" height="4" rx="1" />
            <path d="M12 2v10" /><path d="M8 6l4-4 4 4" /><path d="M12 8h6" /><path d="M12 12H6" />
        </svg>
    );
}

function VectorIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}

function CompareIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="2" y="4" width="8" height="16" rx="2" /><rect x="14" y="4" width="8" height="16" rx="2" />
            <path d="M12 2v20" />
        </svg>
    );
}

function DocIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}

function ChatPanel({
    mode,
    messages,
    isThinking,
    activeDoc,
    vragStatus,
    onViewTree,
    onViewChunks,
}: {
    mode: 'pageindex' | 'vector-rag';
    messages: Message[];
    isThinking: boolean;
    activeDoc: DocInfo | null;
    vragStatus?: VRAGStatus | null;
    onViewTree?: () => void;
    onViewChunks?: () => void;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const isPI = mode === 'pageindex';
    const accentBg = isPI ? 'bg-navy' : 'bg-black';
    const accentBgLight = isPI ? 'bg-navy-50' : 'bg-gray-100';
    const accentText = isPI ? 'text-navy' : 'text-black';
    const accentBorder = isPI ? 'border-navy' : 'border-black';
    const label = isPI ? 'PageIndex' : 'Vector RAG';

    const isProcessing = isPI
        ? activeDoc?.status === 'processing'
        : vragStatus?.status === 'processing';
    const isReady = isPI
        ? activeDoc?.status === 'completed'
        : vragStatus?.status === 'completed';

    const statCount = isPI
        ? activeDoc?.num_sections
        : vragStatus?.num_chunks;
    const statLabel = isPI ? 'sections indexed' : 'chunks embedded';

    return (
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden border-r border-gray-100 last:border-r-0">
            {/* Panel Header */}
            <div className={`px-5 py-3.5 border-b-2 ${accentBorder} flex items-center justify-between bg-white sticky top-0 z-10`}>
                <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${accentBg} flex items-center justify-center shadow-sm`}>
                        {isPI
                            ? <TreeIcon size={14} className="text-white" />
                            : <VectorIcon size={14} className="text-white" />
                        }
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold ${accentText} tracking-tight`}>{label}</h3>
                        <p className="text-[10px] text-gray-400 font-medium">
                            {isPI ? 'Tree-based retrieval' : 'Embedding similarity search'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isProcessing && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-full border border-amber-100">
                            <div className="w-3 h-3 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Processing</span>
                        </div>
                    )}
                    {isReady && (
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isPI ? 'bg-emerald-500' : 'bg-gray-800'} shadow-sm`}></span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                {statCount} {statLabel}
                            </span>
                            {isPI && onViewTree && (
                                <button
                                    onClick={onViewTree}
                                    className="ml-1 flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 hover:border-navy hover:text-navy text-gray-500 rounded-md text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><line x1="10" y1="6" x2="21" y2="6"></line>
                                        <line x1="4" y1="12" x2="4.01" y2="12"></line><line x1="4" y1="18" x2="4.01" y2="18"></line><line x1="4" y1="6" x2="4.01" y2="6"></line>
                                    </svg>
                                    Tree
                                </button>
                            )}
                            {!isPI && onViewChunks && (
                                <button
                                    onClick={onViewChunks}
                                    className="ml-1 flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 hover:border-black hover:text-black text-gray-500 rounded-md text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                                >
                                    <VectorIcon size={12} className="" />
                                    Chunks
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-thin bg-gray-50/30">
                {messages.length === 0 && isReady && (
                    <div className="h-full flex flex-col items-center justify-center text-center animate-[fade-in_0.5s_ease-out] px-4">
                        <div className={`w-12 h-12 rounded-full ${accentBgLight} ${accentText} flex items-center justify-center mb-3`}>
                            {isPI ? <TreeIcon size={22} /> : <VectorIcon size={22} />}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">Ready to compare</h4>
                        <p className="text-xs text-gray-500 max-w-[220px]">
                            Ask a question below — both engines will answer simultaneously
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'bot' && (
                            <div className={`w-6 h-6 rounded-md ${accentBg} flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm`}>
                                {isPI
                                    ? <TreeIcon size={12} className="text-white" />
                                    : <VectorIcon size={12} className="text-white" />
                                }
                            </div>
                        )}

                        <div className={`max-w-[90%] px-4 py-3 text-[13px] leading-relaxed shadow-sm animate-[slide-up_0.3s_ease-out] overflow-hidden ${msg.role === 'user'
                            ? `${accentBg} text-white rounded-2xl rounded-tr-sm`
                            : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                            }`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ node, ref, ...props }: any) => <h1 className="text-base font-bold mt-3 mb-1.5" {...props} />,
                                    h2: ({ node, ref, ...props }: any) => <h2 className="text-sm font-bold mt-3 mb-1.5" {...props} />,
                                    h3: ({ node, ref, ...props }: any) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
                                    p: ({ node, ref, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                    ul: ({ node, ref, ...props }: any) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
                                    ol: ({ node, ref, ...props }: any) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />,
                                    li: ({ node, ref, ...props }: any) => <li className="" {...props} />,
                                    a: ({ node, ref, ...props }: any) => <a className="text-blue-500 hover:text-blue-600 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isInline = !match && !className;
                                        return isInline ? (
                                            <code className="bg-black/10 rounded px-1 py-0.5 font-mono text-xs" {...props}>{children}</code>
                                        ) : (
                                            <code className="block font-mono text-xs leading-relaxed" {...props}>{children}</code>
                                        );
                                    },
                                    pre: ({ node, ref, ...props }: any) => <pre className="bg-gray-800 text-gray-50 rounded-lg p-3 mb-3 overflow-x-auto text-xs" {...props} />,
                                    table: ({ node, ref, ...props }: any) => (
                                        <div className="overflow-x-auto my-4 border border-black/10 rounded-lg">
                                            <table className="border-collapse w-full text-xs text-left align-middle" {...props} />
                                        </div>
                                    ),
                                    thead: ({ node, ref, ...props }: any) => <thead className="bg-[#f0f4f8] text-[#1c2e4a] border-b border-black/10" {...props} />,
                                    tbody: ({ node, ref, ...props }: any) => <tbody className="divide-y divide-black/5" {...props} />,
                                    tr: ({ node, ref, ...props }: any) => <tr className="hover:bg-black/5" {...props} />,
                                    th: ({ node, ref, ...props }: any) => <th className="px-3 py-2 font-semibold border-r border-black/5 last:border-0" {...props} />,
                                    td: ({ node, ref, ...props }: any) => <td className="px-3 py-2 border-r border-black/5 last:border-0 align-top" {...props} />,
                                    blockquote: ({ node, ref, ...props }: any) => <blockquote className="border-l-3 border-black/20 pl-3 py-1 italic opacity-80 mb-2" {...props} />,
                                    hr: ({ node, ref, ...props }: any) => <hr className="my-3 border-black/10" {...props} />,
                                }}
                            >
                                {msg.content.replace(/<br\s*\/?>/gi, '\n\n')}
                            </ReactMarkdown>

                            {/* PageIndex: Retrieved sections */}
                            {msg.sections && msg.sections.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-1 mb-1.5">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                        </svg>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Sources</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {msg.sections.map((s) => (
                                            <span
                                                key={s.node_id}
                                                className="inline-flex items-center px-2 py-0.5 bg-navy-50 border border-navy/10 rounded text-[10px] font-medium text-navy cursor-default"
                                                title={`p.${s.start_index}-${s.end_index}`}
                                            >
                                                {s.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Vector RAG: Retrieved chunks */}
                            {msg.chunks && msg.chunks.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-1 mb-1.5">
                                        <VectorIcon size={11} className="text-gray-400" />
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Matched Chunks</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {msg.chunks.map((c: VRAGChunk, idx: number) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-medium text-gray-800 cursor-default"
                                                title={c.text.substring(0, 100) + '...'}
                                            >
                                                Chunk {c.chunk_index}
                                                <span className="text-gray-500 font-mono">
                                                    {(c.similarity_score * 100).toFixed(0)}%
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stats footer */}
                            {msg.role === 'bot' && (msg.tokens || msg.time) && (
                                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-3">
                                    {msg.tokens && (
                                        <span className="text-[9px] font-medium text-gray-400">
                                            {msg.tokens.toLocaleString()} tokens
                                        </span>
                                    )}
                                    {msg.time && (
                                        <span className="text-[9px] font-medium text-gray-400">
                                            {msg.time}s
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div className="flex w-full justify-start animate-[fade-in_0.3s_ease]">
                        <div className={`w-6 h-6 rounded-md ${accentBg} flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm`}>
                            {isPI
                                ? <TreeIcon size={12} className="text-white" />
                                : <VectorIcon size={12} className="text-white" />
                            }
                        </div>
                        <div className="px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${isPI ? 'bg-navy/30' : 'bg-gray-400'} animate-[blink_1.4s_infinite]`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${isPI ? 'bg-navy/30' : 'bg-gray-400'} animate-[blink_1.4s_infinite_0.2s]`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${isPI ? 'bg-navy/30' : 'bg-gray-400'} animate-[blink_1.4s_infinite_0.4s]`} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-400">
                                {isPI ? 'Searching tree...' : 'Searching vectors...'}
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}


export default function ComparisonView({
    activeDoc,
    piMessages,
    piIsThinking,
    piOnViewTree,
    vragMessages,
    vragIsThinking,
    vragStatus,
    onSend,
    onViewChunks,
}: ComparisonViewProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSend(input.trim());
        setInput('');
    };

    const piIsReady = activeDoc?.status === 'completed';
    const vragIsReady = vragStatus?.status === 'completed';
    const bothReady = piIsReady && vragIsReady;
    const eitherThinking = piIsThinking || vragIsThinking;

    // Empty state
    if (!activeDoc) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white text-center p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-white to-white opacity-50"></div>
                <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center mb-6 relative z-10 animate-[slide-up_0.5s_ease-out]">
                    <CompareIcon size={32} className="text-gray-900" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight relative z-10 animate-[slide-up_0.6s_ease-out]">
                    PageIndex vs Vector RAG
                </h2>
                <p className="text-base text-gray-500 max-w-md leading-relaxed relative z-10 animate-[slide-up_0.7s_ease-out]">
                    Upload a PDF document to compare tree-based retrieval (PageIndex) with traditional vector similarity search (RAG) side by side.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-screen bg-white relative">
            {/* Comparison Header Bar */}
            <div className="px-6 py-3 border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                            <DocIcon size={16} className="text-gray-800" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 truncate max-w-[280px]">{activeDoc.doc_name}</h2>
                            <p className="text-[10px] text-gray-500 font-medium tracking-wide">Comparison Mode</p>
                        </div>
                    </div>

                    {/* Live Status Badges */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-navy-50 rounded-full">
                            <span className={`w-1.5 h-1.5 rounded-full ${piIsReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                            <span className="text-[10px] font-bold text-navy">PageIndex</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full border border-gray-200">
                            <span className={`w-1.5 h-1.5 rounded-full ${vragIsReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                            <span className="text-[10px] font-bold text-gray-800">Vector RAG</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Split Panels */}
            <div className="flex-1 flex overflow-hidden">
                <ChatPanel
                    mode="pageindex"
                    messages={piMessages}
                    isThinking={piIsThinking}
                    activeDoc={activeDoc}
                    onViewTree={piOnViewTree}
                />
                <ChatPanel
                    mode="vector-rag"
                    messages={vragMessages}
                    isThinking={vragIsThinking}
                    activeDoc={activeDoc}
                    vragStatus={vragStatus}
                    onViewChunks={onViewChunks}
                />
            </div>

            {/* Shared Input Bar */}
            <div className="p-3 md:px-6 md:py-4 bg-white border-t border-gray-100">
                <form
                    onSubmit={handleSubmit}
                    className={`flex items-center gap-3 bg-white border-2 rounded-2xl px-3 py-2 transition-all shadow-sm ${!bothReady || eitherThinking
                        ? 'border-gray-200 bg-gray-50/50'
                        : 'border-gray-900 focus-within:ring-4 focus-within:ring-gray-100'
                        }`}
                >
                    {/* Dual indicator */}
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-navy shadow-sm"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-black shadow-sm"></div>
                    </div>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={bothReady ? 'Ask both engines simultaneously...' : 'Waiting for both engines to finish processing...'}
                        disabled={!bothReady || eitherThinking}
                        className="flex-1 bg-transparent border-none outline-none text-[14px] py-1.5 px-1 text-gray-900 placeholder:text-gray-400 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || !bothReady || eitherThinking}
                        className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0 hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
                <div className="mt-1.5 text-center">
                    <p className="text-[10px] text-gray-400">
                        Questions are sent to <span className="font-bold text-navy">PageIndex</span> and <span className="font-bold text-gray-900">Vector RAG</span> simultaneously for fair comparison
                    </p>
                </div>
            </div>
        </div>
    );
}
