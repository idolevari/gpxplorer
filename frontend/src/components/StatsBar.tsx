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
    lat?: number;
    lon?: number;
}

interface StatsBarProps {
    stats: TripStats | null;
    graphData: ElevationPoint[] | null;
    isLoading: boolean;
    onHover?: (point: { lat: number, lon: number } | null) => void;
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

export function StatsBar({ stats, graphData, isLoading, onHover }: StatsBarProps) {
    if (!stats && !isLoading) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 h-auto md:h-32 bg-[#030712]/90 backdrop-blur-xl border-t border-[var(--glass-border)] z-20 flex flex-col md:flex-row transition-all duration-300">
            {/* Left: Metrics Grid */}
            <div className="shrink-0 p-3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[var(--glass-border)] w-full md:w-auto md:min-w-[320px]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm py-2 md:py-0">
                        Loading Metrics...
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-x-4 md:gap-x-6 gap-y-2">
                        {/* Row 1 */}
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                                <Activity className="w-3 h-3" /> Distance
                            </div>
                            <div className="text-base md:text-lg font-bold text-white font-mono leading-none">
                                {stats?.distance_km} <span className="text-[10px] font-normal text-gray-500">km</span>
                            </div>
                        </div>

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                                <Mountain className="w-3 h-3" /> Max Elev
                            </div>
                            <div className="text-base md:text-lg font-bold text-white font-mono leading-none">
                                {graphData ? Math.max(...graphData.map(p => p.elevation)) : 0} <span className="text-[10px] font-normal text-gray-500">m</span>
                            </div>
                        </div>

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-green-400 text-[10px] uppercase tracking-wider">
                                <ArrowUp className="w-3 h-3" /> Gain
                            </div>
                            <div className="text-sm md:text-base font-bold text-white font-mono leading-none">
                                +{stats?.elevation_gain_m} m
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                                <Clock className="w-3 h-3" /> Time
                            </div>
                            <div className="text-base md:text-lg font-bold text-white font-mono leading-none">
                                {formatTime(stats?.moving_time_s || 0)}
                            </div>
                        </div>

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                                <Activity className="w-3 h-3" /> Avg Spd
                            </div>
                            <div className="text-base md:text-lg font-bold text-white font-mono leading-none">
                                {stats?.avg_speed_kmh} <span className="text-[10px] font-normal text-gray-500">km/h</span>
                            </div>
                        </div>

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-red-400 text-[10px] uppercase tracking-wider">
                                <ArrowDown className="w-3 h-3" /> Loss
                            </div>
                            <div className="text-sm md:text-base font-bold text-white font-mono leading-none">
                                -{stats?.elevation_loss_m} m
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Elevation Profile Graph */}
            <div className="flex-1 p-2 relative min-w-0 h-24 md:h-full">
                {/* Title Overlay */}
                <h3 className="absolute top-2 left-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest z-10 bg-[#030712]/40 px-1.5 py-0.5 rounded pointer-events-none">
                    Elevation Profile
                </h3>

                {isLoading || !graphData ? (
                    <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
                        Generating Profile...
                    </div>
                ) : (
                    <div className="w-full h-full -ml-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={graphData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                onMouseMove={(state: any) => {
                                    if (state.isTooltipActive && state.activePayload && state.activePayload.length) {
                                        const point = state.activePayload[0].payload;
                                        if (onHover) {
                                            onHover({ lat: point.lat, lon: point.lon });
                                        }
                                    } else {
                                        if (onHover) onHover(null);
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (onHover) onHover(null);
                                }}
                            >
                                <defs>
                                    <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'white', strokeWidth: 1, strokeDasharray: '3 3' }} />
                                <Area
                                    type="monotone"
                                    dataKey="elevation"
                                    stroke="var(--accent-primary)"
                                    fillOpacity={1}
                                    fill="url(#colorElev)"
                                    strokeWidth={2}
                                    activeDot={{ r: 4, fill: 'white', stroke: 'var(--accent-primary)', strokeWidth: 2 }}
                                />
                                <XAxis
                                    dataKey="distance"
                                    tick={{ fill: '#6b7280', fontSize: 9 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                    unit=" km"
                                    height={20}
                                />
                                <YAxis
                                    hide={true}
                                    domain={['auto', 'auto']}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
