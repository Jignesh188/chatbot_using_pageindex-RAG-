import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'PageIndex vs Vector RAG — Document Chatbot Comparison',
    description: 'Compare tree-based PageIndex retrieval with traditional Vector RAG on your PDF documents — side by side, in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-gray-50 text-gray-900" suppressHydrationWarning>{children}</body>
        </html>
    );
}
