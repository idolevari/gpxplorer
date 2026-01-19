
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';

const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://gpxplorer-production.up.railway.app';

function App() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New States for Metrics
  const [tripStats, setTripStats] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number, lon: number } | null>(null);

  // Initial Fetch of Trips
  useEffect(() => {
    fetch(`${API_URL}/api/trips`)
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        if (data.length > 0) {
          setSelectedTripId(data[0].id);
        }
      })
      .catch(err => console.error("Failed to load trips", err))
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch Metrics when Trip Changes
  useEffect(() => {
    if (!selectedTripId) return;

    setIsMetricsLoading(true);
    setTripStats(null);
    setGraphData(null);

    fetch(`${API_URL}/api/trips/${selectedTripId}/metrics`)
      .then(res => res.json())
      .then(data => {
        setTripStats(data.stats);
        setGraphData(data.graph);
      })
      .catch(err => console.error("Failed to load metrics", err))
      .finally(() => setIsMetricsLoading(false));

  }, [selectedTripId]);

  return (
    <Layout
      trips={trips}
      selectedTripId={selectedTripId}
      onSelectTrip={setSelectedTripId}
      isLoadingTrips={isLoading}
      stats={tripStats}
      graphData={graphData}
      isMetricsLoading={isMetricsLoading}
      hoveredPoint={hoveredPoint}
      onHoverPoint={setHoveredPoint}
    >
      <MapViewer tripId={selectedTripId} hoveredPoint={hoveredPoint} />
    </Layout>
  );
}

export default App;
