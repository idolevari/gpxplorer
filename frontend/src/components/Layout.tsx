import React from 'react';
import { Map, Download } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { StatsBar } from './StatsBar';

interface Trip {
    id: string;
    name: string;
    description: string;
}

interface LayoutProps {
    children: React.ReactNode;
    trips: Trip[];
    selectedTrips: string[];
    onToggleTrip: (id: string) => void;
    isLoadingTrips: boolean;
    stats?: any;
    graphData?: any;
    isMetricsLoading?: boolean;
    hoveredPoint?: { lat: number, lon: number } | null;
    onHoverPoint?: (point: { lat: number, lon: number } | null) => void;
}

export function Layout({
    children,
    trips,
    selectedTrips,
    onToggleTrip,
    isLoadingTrips,
    stats,
    graphData,
    isMetricsLoading,
    onHoverPoint
}: LayoutProps) {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

    return (
        <div className="flex flex-col h-screen overflow-hidden selection:bg-[var(--accent-primary)] selection:text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#030712] to-[#030712] pointer-events-none z-0" />

            <header className="px-4 md:px-6 py-4 flex items-center justify-between z-10 shrink-0 relative"
                style={{ borderBottom: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(3, 7, 18, 0.4)' }}>
                <div className="flex items-center gap-3">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                        className="md:hidden p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>

                    <div className="hidden md:block bg-[var(--accent-primary)] p-2 rounded-xl shadow-[0_0_15px_var(--accent-primary)]">
                        <Map className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        GPXplorer
                    </h1>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => {
                            const lastSelected = selectedTrips.length > 0 ? selectedTrips[selectedTrips.length - 1] : null;
                            if (lastSelected) {
                                const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://gpxplorer-production.up.railway.app';
                                window.open(`${API_URL}/api/trips/${lastSelected}/download`, '_blank');
                            }
                        }}
                        disabled={selectedTrips.length === 0}
                        className="flex items-center gap-2 px-3 md:px-5 py-2 text-sm font-bold text-white bg-[var(--accent-primary)] hover:bg-blue-400 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Download Active</span>
                    </button>
                </div>
            </header>
            <div className="flex-1 flex overflow-hidden z-10 relative">
                <Sidebar
                    trips={trips}
                    selectedTrips={selectedTrips}
                    onToggleTrip={(id) => {
                        onToggleTrip(id);
                    }}
                    isLoading={isLoadingTrips}
                    isOpen={isMobileSidebarOpen}
                    onClose={() => setIsMobileSidebarOpen(false)}
                />
                <main className="flex-1 relative flex flex-col">
                    <div className="flex-1 relative">
                        {children}
                    </div>
                    <div className="relative shrink-0 z-20">
                        <StatsBar
                            stats={stats || null}
                            graphData={graphData || null}
                            isLoading={!!isMetricsLoading}
                            onHover={onHoverPoint}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}
