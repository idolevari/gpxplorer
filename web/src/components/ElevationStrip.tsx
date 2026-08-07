import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProfilePoint } from '../lib/profile';

export interface ElevationStripProps {
  profile: ProfilePoint[];
  onHover: (p: ProfilePoint | null) => void;
}

interface HoverState {
  isTooltipActive?: boolean;
  activeIndex?: number | string | null;
}

export function ElevationStrip({ profile, onHover }: ElevationStripProps) {
  if (profile.length === 0 || profile.every((p) => p.elevation == null)) {
    return (
      <p className="eyebrow px-6 py-4">Elevation — unknowable for this trip</p>
    );
  }

  return (
    <div className="h-28 px-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={profile}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onMouseMove={(state: HoverState) => {
            // recharts reports activeIndex as a numeric string (e.g. "206") at
            // runtime, not a number -- Number() below still resolves by index,
            // never by x-value, so the day-seam duplicate-distance issue this
            // guards against does not resurface.
            const parsed =
              state.isTooltipActive && state.activeIndex != null
                ? Number(state.activeIndex)
                : NaN;
            const idx = Number.isInteger(parsed) ? parsed : null;
            onHover(idx != null ? profile[idx] ?? null : null);
          }}
          onMouseLeave={() => onHover(null)}
        >
          <defs>
            <linearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a04a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#d4a04a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance"
            unit=" km"
            interval="preserveStartEnd"
            tick={{ fill: '#7f857e', fontSize: 10, fontFamily: 'Menlo, monospace' }}
            axisLine={false}
            tickLine={false}
            height={20}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            cursor={{ stroke: '#e6e0d2', strokeDasharray: '3 3' }}
            content={() => null}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#d4a04a"
            strokeWidth={1.5}
            fill="url(#elev)"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
