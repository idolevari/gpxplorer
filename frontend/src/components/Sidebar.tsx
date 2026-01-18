import React from 'react';
import { Network, MapPin } from 'lucide-react';

interface Trip {
    id: string;
    name: string;
    description: string;
}

interface SidebarProps {
    trips: Trip[];
    selectedTripId: string | null;
    onSelectTrip: (id: string) => void;
    isLoading: boolean;
}

export function Sidebar({ trips, selectedTripId, onSelectTrip, isLoading }: SidebarProps) {
    return (
        <div className="w-80 h-full flex flex-col flex-shrink-0 relative overflow-hidden"
            style={{
                backgroundColor: 'var(--glass-bg)',
                borderRight: '1px solid var(--glass-border)',
                backdropFilter: 'blur(12px)'
            }}>
            <div className="p-6 border-b border-[var(--glass-border)]">
                <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]"></span>
                    Available Expeditions
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoading ? (
                    <div className="text-center text-[var(--text-secondary)] text-sm py-8">Loading data...</div>
                ) : (
                    trips.map((trip) => {
                        const isSelected = selectedTripId === trip.id;
                        return (
                            <button
                                key={trip.id}
                                onClick={() => onSelectTrip(trip.id)}
                                className={`w-full text-left p-4 rounded-xl transition-all duration-300 group border
                                    ${isSelected
                                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                                    }
                                `}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-2 rounded-lg transition-colors ${isSelected ? 'text-[var(--accent-glow)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                        {trip.id === 'all-trips' || trip.id === 'cross-israel'
                                            ? <Network className="w-5 h-5" />
                                            : <MapPin className="w-5 h-5" />
                                        }
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-semibold tracking-wide ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                            {trip.name}
                                        </h3>
                                        <p className="text-xs mt-1.5 opacity-60 font-light leading-relaxed">
                                            {trip.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
