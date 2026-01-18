import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { LeafletMap } from '../LeafletMap';
import { GeoButton } from '../GeoButton';
import { MapPin, Trash2, Edit, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLiveLocations } from '../../hooks/useLiveLocations';
import { useGeofences } from '../../hooks/useGeofences';

export const MapTab: React.FC = () => {
  const navigate = useNavigate();
  const { devices, geofences: localGeofences, removeGeofence, user } = useApp();
  const [showRetry, setShowRetry] = useState(false);
  const { locations, loading: locationsLoading, error: locationsError } = useLiveLocations(5000); // Poll every 5 seconds
  const { geofences: supabaseGeofences, loading: geofencesLoading, error: geofencesError } = useGeofences(user?.id);

  type LatLng = [number, number];

  function toLatLngArray(input: any): LatLng[] {
    if (!input) return [];

    // Si viene como string JSON
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { return []; }
    }

    // Si viene como GeoJSON Feature
    if (input?.type === "Feature" && input?.geometry) input = input.geometry;

    // GeoJSON Polygon: coordinates[0] es el anillo exterior en [lng,lat]
    if (input?.type === "Polygon" && Array.isArray(input.coordinates)) {
      const ring = input.coordinates[0] ?? [];
      return ring.map(([lng, lat]: number[]) => [lat, lng]);
    }

    // GeoJSON MultiPolygon: toma el primer polígono/anillo
    if (input?.type === "MultiPolygon" && Array.isArray(input.coordinates)) {
      const ring = input.coordinates?.[0]?.[0] ?? [];
      return ring.map(([lng, lat]: number[]) => [lat, lng]);
    }

    // Formato viejo: [[lat,lng], ...]
    if (Array.isArray(input) && input.length && Array.isArray(input[0])) {
      return input.map((p: any) => [Number(p[0]), Number(p[1])] as LatLng);
    }

    return [];
  }



  // Combine local and Supabase geofences
  const allGeofences = useMemo(() => {
    // Convert Supabase geofences to the format expected by the app
    const supabaseFormatted = supabaseGeofences.map((gf) => ({
      id: gf.id.toString(),
      name: gf.name,
      coordinates: gf.boundary_inner,
      userId: gf.user_id,
    }));
    return [...localGeofences, ...supabaseFormatted];
  }, [localGeofences, supabaseGeofences]);

  // Calculate map center based on geofence, live locations, or devices
  const getMapCenter = (): [number, number] => {
    if (allGeofences.length > 0) {
      const coords = toLatLngArray(allGeofences[0].coordinates);
      if (coords.length > 0) return coords[0];
    }
    // Use first live location if available
    if (locations.length > 0) {
      return [locations[0].lat, locations[0].lng];
    }
    if (devices.length > 0) {
      return [devices[0].lat, devices[0].lng];
    }
    return [51.969209, 7.595595];
  };

  const handleDeleteGeofence = () => {
    if (allGeofences.length > 0 && confirm('Delete this geofence?')) {
      removeGeofence(allGeofences[0].id);
    }
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'inside':
        return '#78A64A';
      case 'outside-recent':
        return '#FFEE8A';
      case 'outside-alert':
        return '#EF4444';
      default:
        return '#78A64A';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inside':
        return 'Inside fence';
      case 'outside-recent':
        return 'Outside < 30s';
      case 'outside-alert':
        return 'Outside ≥ 30s';
      default:
        return 'Unknown';
    }
  };

  // Calculate buffer polygon (10% larger)
  const getBufferPolygon = (coords: [number, number][]) => {
    if (coords.length === 0) return [];
    
    // Simple buffer calculation - in production use turf.js
    const center = coords.reduce(
      (acc, coord) => [acc[0] + coord[0] / coords.length, acc[1] + coord[1] / coords.length],
      [0, 0]
    ) as [number, number];
    
    return coords.map((coord) => {
      const dx = coord[0] - center[0];
      const dy = coord[1] - center[1];
      return [center[0] + dx * 1.1, center[1] + dy * 1.1] as [number, number];
    });
  };

  // Prepare polygons for the map
  //const polygons = [];
  //if (geofences.length > 0) {
  //  const geofence = geofences[0];
    // Buffer zone
  //  polygons.push({
  //    coordinates: getBufferPolygon(geofence.coordinates),
  //    color: '#3FB7FF',
  //    fillColor: '#3FB7FF',
  //    fillOpacity: 0.1,
  //  });
    // Main geofence
  //  polygons.push({
  //    coordinates: geofence.coordinates,
  //    color: '#78A64A',
  //    fillColor: '#78A64A',
  //    fillOpacity: 0.3,
  //  });
  //}

  // Prepare polygons from all geofences (local + Supabase)
  const polygons = useMemo(() => {
    const polyArray: Array<{
      coordinates: [number, number][];
      color: string;
      fillColor: string;
      fillOpacity: number;
    }> = [];

    allGeofences.forEach((geofence) => {
      const coords = toLatLngArray(geofence.coordinates);

      if (coords.length >= 3) {
        // Buffer zone (simple 10% bigger) - only if we have outer boundary
        const supabaseGeofence = supabaseGeofences.find((gf) => gf.id.toString() === geofence.id);
        if (supabaseGeofence?.boundary_outer) {
          const outerCoords = toLatLngArray(supabaseGeofence.boundary_outer);
          if (outerCoords.length >= 3) {
            polyArray.push({
              coordinates: outerCoords,
              color: '#3FB7FF',
              fillColor: '#3FB7FF',
              fillOpacity: 0.1,
            });
          }
        } else {
          // Fallback to simple buffer calculation
          const bufferCoords = getBufferPolygon(coords);
          if (bufferCoords.length >= 3) {
            polyArray.push({
              coordinates: bufferCoords,
              color: '#3FB7FF',
              fillColor: '#3FB7FF',
              fillOpacity: 0.1,
            });
          }
        }

        // Main geofence
        polyArray.push({
          coordinates: coords,
          color: '#78A64A',
          fillColor: '#78A64A',
          fillOpacity: 0.3,
        });
      }
    });

    return polyArray;
  }, [allGeofences, supabaseGeofences]);


  // Prepare markers from live locations
  const markers = useMemo(() => {
    return locations.map((location) => {
      const updatedAt = new Date(location.updated_at);
      const now = new Date();
      const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;
      
      // Determine marker color based on how recent the update is
      let color = '#78A64A'; // Green for recent
      if (secondsSinceUpdate > 60) {
        color = '#EF4444'; // Red for stale (> 1 minute)
      } else if (secondsSinceUpdate > 30) {
        color = '#FFEE8A'; // Yellow for somewhat stale (> 30 seconds)
      }

      // Build popup content
      const popupContent = `
        <div style="padding: 8px;">
          <strong>Tracker: ${location.tracker_id}</strong><br/>
          <small>Updated: ${updatedAt.toLocaleString()}</small><br/>
          ${location.speed_mps !== null ? `<small>Speed: ${(location.speed_mps * 3.6).toFixed(1)} km/h</small><br/>` : ''}
          ${location.accuracy_m !== null ? `<small>Accuracy: ${location.accuracy_m.toFixed(1)}m</small>` : ''}
        </div>
      `;

      return {
        position: [location.lat, location.lng] as [number, number],
        color,
        label: `Tracker ${location.tracker_id}`,
        popup: popupContent,
      };
    });
  }, [locations]);





  return (
    <div className="h-full relative">
      {/* Loading indicators */}
      {(locationsLoading || geofencesLoading) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg px-4 py-2 shadow-lg z-[1000] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--deep-forest)]" />
          <span className="text-sm text-[var(--deep-forest)]">
            {locationsLoading && geofencesLoading ? 'Loading...' : locationsLoading ? 'Loading locations...' : 'Loading geofences...'}
          </span>
        </div>
      )}

      {/* Error indicators */}
      {locationsError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2 shadow-lg z-[1000] max-w-sm">
          <p className="text-sm">Error loading locations: {locationsError}</p>
          <p className="text-xs mt-1">Make sure VITE_SUPABASE_ANON_KEY is set in your .env file</p>
        </div>
      )}
      {geofencesError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 rounded-lg px-4 py-2 shadow-lg z-[1000] max-w-sm">
          <p className="text-sm">Error loading geofences: {geofencesError}</p>
        </div>
      )}

      {/* Map */}
      <LeafletMap
        center={getMapCenter()}
        zoom={locations.length > 0 ? 15 : 20}
        polygons={polygons}
        markers={markers}
        className="w-full h-full"
      />

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 space-y-2 z-[1000]">
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/draw-geofence')}
            className="flex-1 bg-white text-[var(--deep-forest)] px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex items-center justify-center gap-2 shadow-lg"
          >
            <Edit className="w-4 h-4" />
            Edit Fence
          </button>
          {allGeofences.length > 0 && (
            <button
              onClick={handleDeleteGeofence}
              className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600 flex items-center justify-center gap-2 shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete Fence
            </button>
          )}
        </div>
      </div>

      {/* Connection Retry */}
      {showRetry && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl z-[1001] max-w-sm">
          <h4 className="text-[var(--deep-forest)] mb-3">Connection Issue</h4>
          <p className="text-sm text-gray-600 mb-4">
            Unable to connect to device. Possible causes:
          </p>
          <ul className="text-sm text-gray-600 mb-4 space-y-1 list-disc list-inside">
            <li>No GPS signal</li>
            <li>No internet connection</li>
            <li>Server error</li>
          </ul>
          <div className="space-y-2">
            <GeoButton variant="primary" onClick={() => setShowRetry(false)} className="w-full">
              Retry
            </GeoButton>
            <GeoButton variant="outline" onClick={() => setShowRetry(false)} className="w-full">
              Close
            </GeoButton>
          </div>
        </div>
      )}
    </div>
  );
};
