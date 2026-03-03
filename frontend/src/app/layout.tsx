import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'PageIndex — Chat with your Documents',
    description: 'Upload a PDF and chat with it using AI-powered document retrieval',
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
