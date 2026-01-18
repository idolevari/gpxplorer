
import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';

const API_URL = import.meta.env.VITE_API_URL || 'https://gpxplorer-production.up.railway.app';

function App() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/trips`)
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        // Auto-select the first trip (Cross Israel)
        if (data.length > 0) {
          setSelectedTripId(data[0].id);
        }
      })
      .catch(err => console.error("Failed to load trips", err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Layout
      trips={trips}
      selectedTripId={selectedTripId}
      onSelectTrip={setSelectedTripId}
      isLoadingTrips={isLoading}
    >
      <MapViewer tripId={selectedTripId} />
    </Layout>
  );
}

export default App;
