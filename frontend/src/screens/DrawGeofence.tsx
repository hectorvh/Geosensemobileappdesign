import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { LeafletMap } from '../components/LeafletMap';
import { useApp } from '../contexts/AppContext';
import { MapPin, Navigation, X, Trash2 } from 'lucide-react';
import welcomeImage from '../assets/20250621-P1300259-2-3.jpg';

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
    if (!isDrawing) return;
    setCurrentPolygon((prev) => [...prev, [lat, lng]]);
  };

  const handleCompletePolygon = () => {
    if (currentPolygon.length < 3) {
      alert('A geofence needs at least 3 points.');
      return;
    }
    setSavedPolygon(currentPolygon);
    setCurrentPolygon([]); 
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

    // POST polygon to backend API (see server/) then add to local context
    (async () => {
      try {
        const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000';
        const res = await fetch(`${apiBase}/api/geofences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Geofence', userId: user.id, coordinates: savedPolygon }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save geofence');
        }
        const saved = await res.json();
        const newGeofence = {
          id: saved.id?.toString() || Date.now().toString(),
          name: saved.name || 'My Geofence',
          coordinates: saved.coordinates || savedPolygon,
          userId: saved.userId || user.id,
        };
        addGeofence(newGeofence);
        navigate('/link-devices');
      } catch (error: any) {
        console.error('Save geofence failed', error);
        alert('Unable to save geofence to server: ' + (error?.message || 'unknown error'));
      }
    })();
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
  const markers = (isDrawing ? currentPolygon : savedPolygon).map((p, i) => ({
    position: p as [number, number],
    color: '#F59E0B',
    label: `P${i + 1}`,
  }));

  return (
    <div className="mobile-screen flex flex-col">
      {/* Background Image Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{
                backgroundImage: `url(${welcomeImage})`
              }}
            />
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0">
        <h2
          className="mb-2"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          Draw Your Geofence
        </h2>
        <p className="text-sm opacity-90">Create safe zones on the map for your livestock.</p>
      </div>

      {/* Search Controls */}
      <div className="bg-[var(--pine-green)] p-3 space-y-2 shrink-0 relative z-10">
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
        <div className="bg-[var(--high-yellow)] text-[var(--deep-forest)] p-2 text-center text-sm shrink-0 relative z-10">
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
          markers={markers}
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
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0 relative z-10">
        <div className="flex gap-2">
          <GeoButton 
            variant="outline" 
            onClick={handleSaveGeofence}
            className="flex-1"
          >
            Save Geofence
          </GeoButton>
          <GeoButton 
            variant="primary" 
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
