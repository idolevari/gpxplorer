
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
  const [graphData, setGraphData] = useState(null);
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

  // Fetch Metrics when Trip Changes - defaulting to showing stats for the *last* selected trip just to show something, or maybe hide it? 
  // For now, let's just pick the last one selected to show stats for.
  const activeTripId = selectedTrips.length > 0 ? selectedTrips[selectedTrips.length - 1] : null;

  useEffect(() => {
    if (!activeTripId) {
      setTripStats(null);
      setGraphData(null);
      return;
    }

    setIsMetricsLoading(true);
    fetch(`${API_URL}/api/trips/${activeTripId}/metrics`)
      .then(res => res.json())
      .then(data => {
        setTripStats(data.stats);
        setGraphData(data.graph);
      })
      .catch(err => console.error("Failed to load metrics", err))
      .finally(() => setIsMetricsLoading(false));

  }, [activeTripId]);

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
