import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Clock, Mountain, ArrowUp, ArrowDown } from 'lucide-react';

interface TripStats {
    distance_km: number;
    elevation_gain_m: number;
    elevation_loss_m: number;
    moving_time_s: number;
    stopped_time_s: number;
    max_speed_kmh: number;
    avg_speed_kmh: number;
}

interface ElevationPoint {
    distance: number;
    elevation: number;
}

interface StatsBarProps {
    stats: TripStats | null;
    graphData: ElevationPoint[] | null;
    isLoading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#030712]/90 backdrop-blur-md border border-[var(--glass-border)] p-2 rounded-lg text-xs shadow-xl">
                <p className="font-bold text-white">{label} km</p>
                <p className="text-[var(--accent-primary)]">{payload[0].value}m Elev</p>
            </div>
        );
    }
    return null;
};

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

export function StatsBar({ stats, graphData, isLoading }: StatsBarProps) {
    if (!stats && !isLoading) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-[#030712]/80 backdrop-blur-xl border-t border-[var(--glass-border)] z-20 flex transition-all duration-300">
            {/* Left: Metrics Grid */}
            <div className="w-1/3 min-w-[300px] p-6 grid grid-cols-2 gap-4 border-r border-[var(--glass-border)] overflow-y-auto">
                {isLoading ? (
                    <div className="col-span-2 flex items-center justify-center h-full text-[var(--text-secondary)]">
                        Loading Metrics...
                    </div>
                ) : (
                    <>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                                <Activity className="w-3 h-3" /> Distance
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                {stats?.distance_km} <span className="text-sm font-normal text-gray-500">km</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                                <Clock className="w-3 h-3" /> Time (Mov)
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                {formatTime(stats?.moving_time_s || 0)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                                <Mountain className="w-3 h-3" /> Max Elev
                            </div>
                            <div className="text-xl font-bold text-white font-mono">
                                {graphData ? Math.max(...graphData.map(p => p.elevation)) : 0} <span className="text-sm font-normal text-gray-500">m</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                                <Activity className="w-3 h-3" /> Avg Speed
                            </div>
                            <div className="text-xl font-bold text-white font-mono">
                                {stats?.avg_speed_kmh} <span className="text-sm font-normal text-gray-500">km/h</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-green-400 text-xs uppercase tracking-wider">
                                <ArrowUp className="w-3 h-3" /> Gain
                            </div>
                            <div className="text-lg font-bold text-white font-mono">
                                +{stats?.elevation_gain_m} m
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-red-400 text-xs uppercase tracking-wider">
                                <ArrowDown className="w-3 h-3" /> Loss
                            </div>
                            <div className="text-lg font-bold text-white font-mono">
                                -{stats?.elevation_loss_m} m
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Right: Elevation Profile Graph */}
            <div className="flex-1 p-4 relative">
                <h3 className="absolute top-4 left-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest z-10 bg-[#030712]/30 px-2 py-1 rounded">
                    Elevation Profile
                </h3>
                {isLoading || !graphData ? (
                    <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                        Generating Profile...
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={graphData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="elevation"
                                stroke="var(--accent-primary)"
                                fillOpacity={1}
                                fill="url(#colorElev)"
                                strokeWidth={2}
                            />
                            <XAxis
                                dataKey="distance"
                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                unit=" km"
                            />
                            <YAxis
                                hide={true}
                                domain={['auto', 'auto']}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
