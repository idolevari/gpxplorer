
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';
import { aggregateTripMetrics } from './lib/aggregate';
import type { AggregatedStats, ElevationPoint, TripMetrics, Trip } from './lib/types';

const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://gpxplorer-production.up.railway.app';

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tripStats, setTripStats] = useState<AggregatedStats | null>(null);
  const [graphData, setGraphData] = useState<ElevationPoint[] | null>(null);
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
      .then(res => res.json() as Promise<Trip[]>)
      .then(data => {
        setTrips(data);
        if (data.length > 0) {
          // Select all trips by default
          setSelectedTrips(data.map((t: Trip) => t.id));
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
        fetch(`${API_URL}/api/trips/${id}/metrics`).then(res => {
          if (!res.ok) throw new Error(`Failed to load metrics for ${id}`);
          return res.json() as Promise<TripMetrics>;
        })
      )
    )
      .then(results => {
        const aggregated = aggregateTripMetrics(results);
        setTripStats(aggregated?.stats ?? null);
        setGraphData(aggregated?.graph ?? null);
      })
      .catch(err => console.error('Failed to load metrics', err))
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
