
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';

const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://gpxplorer-production.up.railway.app';

function App() {
  const [trips, setTrips] = useState([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New States for Metrics
  const [tripStats, setTripStats] = useState(null);
  const [graphData, setGraphData] = useState<any[] | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number, lon: number } | null>(null);

  // Toggle trip selection
  const toggleTrip = (id: string) => {
    setSelectedTrips(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // Initial Fetch of Trips
  useEffect(() => {
    fetch(`${API_URL}/api/trips`)
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        if (data.length > 0) {
          // Select all trips by default
          setSelectedTrips(data.map((t: any) => t.id));
        }
      })
      .catch(err => console.error("Failed to load trips", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch metrics for all selected trips and aggregate them
  useEffect(() => {
    if (selectedTrips.length === 0) {
      setTripStats(null);
      setGraphData(null);
      return;
    }

    setIsMetricsLoading(true);
    Promise.all(
      selectedTrips.map(id =>
        fetch(`${API_URL}/api/trips/${id}/metrics`).then(res => res.json())
      )
    )
      .then(results => {
        const aggregated = results.reduce((acc, data) => {
          const s = data.stats;
          const maxElev = data.graph?.length
            ? Math.max(...data.graph.map((p: any) => p.elevation))
            : 0;
          return {
            distance_km: acc.distance_km + s.distance_km,
            elevation_gain_m: acc.elevation_gain_m + s.elevation_gain_m,
            elevation_loss_m: acc.elevation_loss_m + s.elevation_loss_m,
            moving_time_s: acc.moving_time_s + s.moving_time_s,
            stopped_time_s: acc.stopped_time_s + s.stopped_time_s,
            max_speed_kmh: Math.max(acc.max_speed_kmh, s.max_speed_kmh),
            avg_speed_kmh: acc.avg_speed_kmh + s.avg_speed_kmh,
            max_elevation_m: Math.max(acc.max_elevation_m, maxElev),
            _count: acc._count + 1,
          };
        }, {
          distance_km: 0, elevation_gain_m: 0, elevation_loss_m: 0,
          moving_time_s: 0, stopped_time_s: 0, max_speed_kmh: 0,
          avg_speed_kmh: 0, max_elevation_m: 0, _count: 0,
        });

        const count = aggregated._count;
        delete aggregated._count;

        setTripStats({
          ...aggregated,
          distance_km: Math.round(aggregated.distance_km * 100) / 100,
          elevation_gain_m: Math.round(aggregated.elevation_gain_m),
          elevation_loss_m: Math.round(aggregated.elevation_loss_m),
          max_speed_kmh: Math.round(aggregated.max_speed_kmh * 10) / 10,
          avg_speed_kmh: Math.round((aggregated.avg_speed_kmh / count) * 10) / 10,
          max_elevation_m: Math.round(aggregated.max_elevation_m),
        });

        // Concatenate graph data across all trips with continuous distance offset
        let distanceOffset = 0;
        const combinedGraph = results.flatMap(data => {
          const points = (data.graph ?? []).map((p: any) => ({
            ...p,
            distance: Math.round((p.distance + distanceOffset) * 100) / 100,
          }));
          if (points.length > 0) {
            distanceOffset += points[points.length - 1].distance - distanceOffset;
          }
          return points;
        });
        setGraphData(combinedGraph.length > 0 ? combinedGraph : null);
      })
      .catch(err => console.error("Failed to load metrics", err))
      .finally(() => setIsMetricsLoading(false));
  }, [selectedTrips]);

  return (
    <Layout
      trips={trips}
      selectedTrips={selectedTrips}
      onToggleTrip={toggleTrip}
      isLoadingTrips={isLoading}
      stats={tripStats}
      graphData={graphData}
      isMetricsLoading={isMetricsLoading}
      hoveredPoint={hoveredPoint}
      onHoverPoint={setHoveredPoint}
    >
      <MapViewer tripIds={selectedTrips} hoveredPoint={hoveredPoint} />
    </Layout>
  );
}

export default App;
