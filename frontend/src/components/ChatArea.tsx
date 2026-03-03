'use client';

import { useState, useRef, useEffect } from 'react';

interface Section {
    node_id: string;
    title: string;
    start_index?: number;
    end_index?: number;
}

interface Message {
    role: 'user' | 'bot';
    content: string;
    sections?: Section[];
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

interface ChatAreaProps {
    activeDoc: DocInfo | null;
    messages: Message[];
    isThinking: boolean;
    onSend: (question: string) => void;
}

export default function ChatArea({ activeDoc, messages, isThinking, onSend }: ChatAreaProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;
        onSend(input.trim());
        setInput('');
    };

    // Empty state — no document loaded
    if (!activeDoc) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white text-center p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-white to-white opacity-50"></div>

                <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center mb-6 relative z-10 animate-[slide-up_0.5s_ease-out]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight relative z-10 animate-[slide-up_0.6s_ease-out]">Welcome to PageIndex</h2>
                <p className="text-base text-gray-500 max-w-sm leading-relaxed relative z-10 animate-[slide-up_0.7s_ease-out]">
                    Upload a PDF document from the sidebar to start asking questions and extracting information.
                </p>
            </div>
        );
    }

    const isReady = activeDoc.status === 'completed';

    return (
        <div className="flex-1 flex flex-col h-screen bg-white relative">
            {/* Header */}
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <span className="text-lg">📄</span>
                    </div>
                    <h2 className="text-base font-bold text-gray-900 truncate max-w-[300px]">{activeDoc.doc_name}</h2>
                </div>

                <div className="flex items-center gap-3">
                    {activeDoc.status === 'processing' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                            <div className="w-3.5 h-3.5 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Processing...</span>
                        </div>
                    )}
                    {isReady && (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {activeDoc.num_sections} sections indexed
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 space-y-6 scrollbar-thin bg-gray-50/30">
                {messages.length === 0 && isReady && (
                    <div className="h-full flex flex-col items-center justify-center text-center animate-[fade-in_0.5s_ease-out]">
                        <div className="w-16 h-16 rounded-full bg-navy-50 text-navy flex items-center justify-center mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4"></path>
                                <path d="M12 8h.01"></path>
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Document is ready</h3>
                        <p className="text-sm text-gray-500 max-w-sm">
                            Try asking something specific like "What is the main conclusion of the document?"
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'bot' && (
                            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm animate-[scale-in_0.3s_ease]">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                    <path d="M12 8V4H8"></path>
                                    <rect x="4" y="8" width="16" height="12" rx="2"></rect>
                                    <path d="M2 14h2"></path>
                                    <path d="M20 14h2"></path>
                                    <path d="M15 13v2"></path>
                                    <path d="M9 13v2"></path>
                                </svg>
                            </div>
                        )}

                        <div
                            className={`max-w-[75%] md:max-w-[65%] px-5 py-4 text-[15px] leading-relaxed shadow-sm animate-[slide-up_0.3s_ease-out] ${msg.role === 'user'
                                ? 'bg-navy text-white rounded-2xl rounded-tr-sm'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                                }`}
                        >
                            {/* Render basic markdown bold manually for the welcome message formatting */}
                            {msg.content.split('\n').map((line, idx) => {
                                const parseBold = (text: string) => {
                                    const parts = text.split(/(\*\*.*?\*\*)/g);
                                    return parts.map((part, pIdx) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={pIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    });
                                };
                                return <p key={idx} className={`${idx !== 0 ? 'mt-2' : ''}`}>{parseBold(line)}</p>;
                            })}

                            {/* Retrieved sections */}
                            {msg.sections && msg.sections.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                        </svg>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            Sources
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.sections.map((s) => (
                                            <span
                                                key={s.node_id}
                                                className="inline-flex items-center px-2.5 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-600 cursor-default transition-colors"
                                                title={`Start p.${s.start_index} - End p.${s.end_index}`}
                                            >
                                                {s.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div className="flex w-full justify-start animate-[fade-in_0.3s_ease]">
                        <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <path d="M12 8V4H8"></path>
                                <rect x="4" y="8" width="16" height="12" rx="2"></rect>
                                <path d="M2 14h2"></path>
                                <path d="M20 14h2"></path>
                                <path d="M15 13v2"></path>
                                <path d="M9 13v2"></path>
                            </svg>
                        </div>
                        <div className="px-5 py-4 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-[blink_1.4s_infinite]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-[blink_1.4s_infinite_0.2s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-[blink_1.4s_infinite_0.4s]" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 md:px-8 md:py-6 bg-white border-t border-gray-100">
                <form
                    onSubmit={handleSubmit}
                    className={`flex items-center gap-3 bg-white border-2 rounded-2xl px-3 py-2 transition-all shadow-sm ${!isReady || isThinking
                            ? 'border-gray-200 bg-gray-50/50'
                            : 'border-gray-200 focus-within:border-navy focus-within:ring-4 focus-within:ring-navy-50'
                        }`}
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isReady ? 'Ask a question about your document...' : 'Waiting for document to finish processing...'}
                        disabled={!isReady || isThinking}
                        className="flex-1 bg-transparent border-none outline-none text-[15px] py-1.5 px-2 text-gray-900 placeholder:text-gray-400 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || !isReady || isThinking}
                        className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shrink-0 hover:bg-navy-light transition-all disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
                <div className="mt-2 text-center">
                    <p className="text-[11px] text-gray-400">AI responses generated by PageIndex backend. Context and reasoning are isolated per query.</p>
                </div>
            </div>
        </div>
    );
}
