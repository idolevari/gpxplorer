
import { Network, MapPin } from 'lucide-react';

interface Trip {
    id: string;
    name: string;
    description: string;
}

interface SidebarProps {
    trips: Trip[];
    selectedTrips: string[];
    onToggleTrip: (id: string) => void;
    isLoading: boolean;
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ trips, selectedTrips, onToggleTrip, isLoading, isOpen, onClose }: SidebarProps) {
    return (
        <>
            {/* Mobile Overlay Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden
                    ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
            />

            {/* Sidebar Container */}
            <div className={`
                absolute md:relative top-0 left-0 bottom-0
                w-80 h-full flex flex-col flex-shrink-0
                z-50 md:z-auto
                transition-transform duration-300 ease-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
                style={{
                    backgroundColor: 'var(--glass-bg)',
                    borderRight: '1px solid var(--glass-border)',
                    backdropFilter: 'blur(12px)'
                }}>
                <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
                    <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]"></span>
                        Available Expeditions
                    </h2>
                    {/* Mobile Close Button */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 text-[var(--text-secondary)] hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="text-center text-[var(--text-secondary)] text-sm py-8">Loading data...</div>
                    ) : (
                        trips.map((trip) => {
                            const isSelected = selectedTrips.includes(trip.id);
                            return (
                                <div
                                    key={trip.id}
                                    onClick={() => onToggleTrip(trip.id)}
                                    className={`
                                        group flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all duration-300
                                        ${isSelected
                                            ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                            : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                                        }
                                    `}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                                            ${isSelected
                                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                                                : 'border-[var(--text-secondary)] group-hover:border-[var(--accent-primary)]'
                                            }
                                        `}>
                                            {isSelected && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                                </svg>
                                            )}
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
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}
