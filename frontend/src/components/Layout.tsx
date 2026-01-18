import React from 'react';
import { Map, Share2, Download } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Map className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">GPXplorer</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors transition-transform active:scale-95">
                        <Download className="w-4 h-4" />
                        Download GPX
                    </button>
                </div>
            </header>
            <main className="flex-1 relative overflow-hidden">
                {children}
            </main>
        </div>
    );
}
