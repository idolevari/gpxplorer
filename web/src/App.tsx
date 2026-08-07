
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';
import { aggregateTripMetrics } from './lib/aggregate';
import type { AggregatedStats, ElevationPoint, TripMetrics, Trip } from './lib/types';
import { API_URL } from './lib/config';

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [tripStats, setTripStats] = useState<AggregatedStats | null>(null);
  const [graphData, setGraphData] = useState<ElevationPoint[] | null>(null);
  // Tracks the selection the last metrics fetch settled for, so "loading"
  // can be derived instead of stored (see visibleStats/visibleGraph below).
  const [settledSelection, setSettledSelection] = useState<string[]>(selectedTrips);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number, lon: number } | null>(null);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Toggle trip selection
  const toggleTrip = (id: string) => {
    setSelectedTrips(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // Initial Fetch of Trips
  useEffect(() => {
    fetch(`${API_URL}/api/trips`)
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json() as Promise<Trip[]>;
      })
      .then(data => {
        setTrips(data);
        setTripsError(null);
        if (data.length > 0) {
          // Select all trips by default
          setSelectedTrips(data.map((t: Trip) => t.id));
        }
      })
      .catch(err => {
        console.error('Failed to load trips', err);
        setTripsError("Couldn't reach the trip server. Check your connection and try again.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const hasSelection = selectedTrips.length > 0;
  const visibleStats = hasSelection ? tripStats : null;
  const visibleGraph = hasSelection ? graphData : null;
  const visibleMetricsError = hasSelection ? metricsError : null;
  const isMetricsLoading = hasSelection && settledSelection !== selectedTrips;

  // Fetch metrics for all selected trips and aggregate them
  useEffect(() => {
    if (selectedTrips.length === 0) {
      return;
    }

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
        setMetricsError(null);
      })
      .catch(err => {
        console.error('Failed to load metrics', err);
        setMetricsError("Couldn't load trip statistics. The map may be incomplete.");
      })
      .finally(() => setSettledSelection(selectedTrips));
  }, [selectedTrips]);

  return (
    <Layout
      trips={trips}
      selectedTrips={selectedTrips}
      onToggleTrip={toggleTrip}
      isLoadingTrips={isLoading}
      stats={visibleStats}
      graphData={visibleGraph}
      isMetricsLoading={isMetricsLoading}
      hoveredPoint={hoveredPoint}
      onHoverPoint={setHoveredPoint}
      tripsError={tripsError}
      metricsError={visibleMetricsError}
    >
      <MapViewer tripIds={selectedTrips} hoveredPoint={hoveredPoint} />
    </Layout>
  );
}

export default App;
