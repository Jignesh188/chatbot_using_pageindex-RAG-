'use client';

import { useState, useRef, useCallback } from 'react';

interface UploadModalProps {
    onClose: () => void;
    onUpload: (file: File) => void;
    isUploading: boolean;
}

export default function UploadModal({ onClose, onUpload, isUploading }: UploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback((f: File) => {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
            setFile(f);
        }
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-[fade-in_0.2s_ease-out]">
            <div className="bg-white rounded-2xl w-[480px] max-w-[90vw] shadow-2xl overflow-hidden animate-[scale-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">Upload Document</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`group relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${dragging ? 'border-navy bg-navy-50 scale-[1.02]' : 'border-gray-200 hover:border-navy hover:bg-gray-50'
                            }`}
                    >
                        <div className="absolute inset-0 bg-navy/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors duration-200 ${dragging ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-navy group-hover:text-white'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                            Click or drag PDF here
                        </p>
                        <p className="text-xs text-gray-500">Maximum file size 50MB</p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleChange}
                            className="hidden"
                        />
                    </div>

                    {file && (
                        <div className="mt-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-4 animate-[slide-up_0.3s_ease-out]">
                            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                                📄
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            </div>
                            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all cursor-pointer shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => file && onUpload(file)}
                        disabled={!file || isUploading}
                        className="px-6 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-light transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : 'Upload Document'}
                    </button>
                </div>
            </div>
        </div>
    );
}
