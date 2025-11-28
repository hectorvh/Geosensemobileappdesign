import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { LeafletMap } from '../components/LeafletMap';
import { useApp } from '../contexts/AppContext';
import { MapPin, Navigation, X, Trash2 } from 'lucide-react';

export const DrawGeofence: React.FC = () => {
  const navigate = useNavigate();
  const { user, addGeofence } = useApp();
  const [searchLocation, setSearchLocation] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.969205, 7.595761]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<[number, number][]>([]);
  const [savedPolygon, setSavedPolygon] = useState<[number, number][]>([]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
        },
        (error) => {
          alert('Unable to get current location. Please enter a location manually.');
        }
      );
    }
  };

  const handleSearchLocation = async () => {
    if (!searchLocation) return;
    
    // Mock geocoding - in production, use Nominatim or another geocoding service
    // For now, set a default location
    alert(`Searching for: ${searchLocation}. Using default location for demo.`);
    setMapCenter([51.969205, 7.595761]); // Munster as example
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setCurrentPolygon([]);
    setSavedPolygon([]);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isDrawing) {
      setCurrentPolygon([...currentPolygon, [lat, lng]]);
    }
  };

  const handleCompletePolygon = () => {
    if (currentPolygon.length < 3) {
      alert('A geofence needs at least 3 points.');
      return;
    }
    setSavedPolygon(currentPolygon);
    setIsDrawing(false);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setCurrentPolygon([]);
  };

  const handleClearPolygon = () => {
    setSavedPolygon([]);
    setCurrentPolygon([]);
    setIsDrawing(false);
  };

  const handleSaveGeofence = () => {
    if (savedPolygon.length === 0) {
      alert('Please draw a geofence on the map first.');
      return;
    }

    if (!user) {
      alert('User not found. Please log in again.');
      return;
    }

    const newGeofence = {
      id: Date.now().toString(),
      name: 'My Geofence',
      coordinates: savedPolygon,
      userId: user.id,
    };

    addGeofence(newGeofence);
    navigate('/link-devices');
  };

  const polygons = [];
  if (currentPolygon.length > 0) {
    polygons.push({
      coordinates: currentPolygon,
      color: '#78A64A',
      fillColor: '#78A64A',
      fillOpacity: 0.3,
    });
  }
  if (savedPolygon.length > 0) {
    polygons.push({
      coordinates: savedPolygon,
      color: '#195A3A',
      fillColor: '#78A64A',
      fillOpacity: 0.4,
    });
  }

  return (
    <div className="mobile-screen flex flex-col">
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0">
        <h3 className="mb-3">Draw Your Geofence</h3>
        <p className="text-sm opacity-90">Create safe zones on the map for your livestock.</p>
      </div>

      {/* Search Controls */}
      <div className="bg-[var(--pine-green)] p-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <GeoInput
            type="text"
            placeholder="Search city or coordinates"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className="flex-1"
          />
          <button
            onClick={handleSearchLocation}
            className="bg-[var(--grass-green)] text-white px-4 rounded-lg hover:bg-[var(--pine-green)]"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={handleUseCurrentLocation}
          className="w-full bg-[var(--accent-aqua)] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--pine-green)]"
        >
          <Navigation className="w-4 h-4" />
          Use my current location
        </button>
      </div>

      {/* Drawing Instructions */}
      {isDrawing && (
        <div className="bg-[var(--high-yellow)] text-[var(--deep-forest)] p-2 text-center text-sm shrink-0">
          Click on the map to add points. Need at least 3 points.
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <LeafletMap
          center={mapCenter}
          zoom={16}
          onMapClick={handleMapClick}
          polygons={polygons}
          className="w-full h-full"
        />

        {/* Floating Drawing Controls */}
        {!savedPolygon.length && (
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            {!isDrawing ? (
              <button
                onClick={handleStartDrawing}
                className="bg-[var(--grass-green)] text-white px-4 py-2 rounded-lg shadow-lg"
              >
                Start Drawing
              </button>
            ) : (
              <>
                <button
                  onClick={handleCompletePolygon}
                  className="bg-[var(--grass-green)] text-white px-4 py-2 rounded-lg shadow-lg"
                  disabled={currentPolygon.length < 3}
                >
                  Complete ({currentPolygon.length})
                </button>
                <button
                  onClick={handleCancelDrawing}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* Clear button when polygon is saved */}
        {savedPolygon.length > 0 && (
          <div className="absolute top-4 left-4 z-[1000]">
            <button
              onClick={handleClearPolygon}
              className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <GeoButton 
            variant="primary" 
            onClick={handleSaveGeofence}
            className="flex-1"
          >
            Save geofence
          </GeoButton>
          <GeoButton 
            variant="secondary" 
            onClick={() => navigate('/link-devices')}
            className="flex-1"
          >
            Next
          </GeoButton>
        </div>
        <GeoButton 
          variant="outline" 
          onClick={() => navigate('/tutorial')}
          className="w-full"
        >
          Back
        </GeoButton>
      </div>
    </div>
  );
};
