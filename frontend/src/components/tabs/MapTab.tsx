import React, { useState, useMemo } from 'react';
import { LeafletMap } from '../LeafletMap';
import { GeoButton } from '../GeoButton';
import { MapPin, Trash2, Edit, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLiveLocations } from '../../hooks/useLiveLocations';
import { useGeofences } from '../../hooks/useGeofences';
import { useAlerts } from '../../hooks/useAlerts';
import { supabase } from '../../lib/supabase';

export const MapTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showRetry, setShowRetry] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  const { locations, loading: locationsLoading, error: locationsError } = useLiveLocations(5000);
  const { geofences, loading: geofencesLoading, error: geofencesError } = useGeofences(user?.id);
  const { alerts } = useAlerts(user?.id, true);

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



  // Set initial map center only once when data is first loaded
  React.useEffect(() => {
    if (mapCenter === null) {
      // Only set initial center if we don't have one yet
      if (geofences.length > 0) {
        const coords = toLatLngArray(geofences[0].boundary_inner);
        if (coords.length > 0) {
          setMapCenter(coords[0]);
          return;
        }
      }
      // Use first live location if available
      if (locations.length > 0) {
        setMapCenter([locations[0].lat, locations[0].lng]);
        return;
      }
      // Default center
      setMapCenter([51.969209, 7.595595]);
    }
  }, [geofences, locations, mapCenter]);

  // Use the stored center or default
  const currentCenter = mapCenter || [51.969209, 7.595595];

  // Clear selection when clicking on map (not on polygon)
  const handleMapClick = () => {
    setSelectedGeofenceId(null);
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

  // Prepare polygons from geofences (only inner_geom, not outer_geom)
  const polygons = useMemo(() => {
    const polyArray: Array<{
      coordinates: [number, number][];
      color: string;
      fillColor: string;
      fillOpacity: number;
      id: number;
    }> = [];

    geofences.forEach((geofence) => {
      const coords = toLatLngArray(geofence.boundary_inner);

      if (coords.length >= 3) {
        // Only show inner_geom (main geofence) - per requirements, do not render outer_geom
        polyArray.push({
          coordinates: coords,
          color: '#78A64A',
          fillColor: '#78A64A',
          fillOpacity: 0.3,
          id: geofence.id,
        });
      }
    });

    return polyArray;
  }, [geofences]);

  // Handle polygon click
  const handlePolygonClick = (polygonIndex: number) => {
    const polygon = polygons[polygonIndex];
    if (polygon) {
      setSelectedGeofenceId(polygon.id);
    }
  };

  // Handle edit zone
  const handleEditZone = () => {
    if (selectedGeofenceId) {
      navigate(`/draw-geofence?mode=edit&id=${selectedGeofenceId}`);
    }
  };


  // Prepare markers from live locations with coloring rules:
  // - green: live_location_active = true AND has_active_alert = false
  // - red: live_location_active = true AND has_active_alert = true
  // - grey: live_location_active = false
  const markers = useMemo(() => {
    return locations.map((location) => {
      const updatedAt = new Date(location.updated_at);
      const now = new Date();
      const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;
      
      // Determine if location is active (updated within last 1 minute)
      const live_location_active = secondsSinceUpdate <= 60;
      
      // Check if device has active alert
      // Find device by tracker_id, then check if it has active alerts
      const deviceAlerts = alerts.filter((alert) => {
        // We need to match by device_id, but we only have tracker_id
        // For now, we'll check if any alert's device tracker_id matches
        return alert.device?.tracker_id === location.tracker_id;
      });
      const has_active_alert = deviceAlerts.length > 0;
      
      // Determine marker color based on rules
      let color = '#9CA3AF'; // Grey (default - inactive)
      if (live_location_active) {
        if (has_active_alert) {
          color = '#EF4444'; // Red: active but has alert
        } else {
          color = '#78A64A'; // Green: active and no alert
        }
      }

      // Build popup content
      const popupContent = `
        <div style="padding: 8px;">
          <strong>Tracker: ${location.tracker_id}</strong><br/>
          <small>Updated: ${updatedAt.toLocaleString()}</small><br/>
          <small>Status: ${live_location_active ? 'Active' : 'Inactive'}</small><br/>
          ${has_active_alert ? '<small style="color: red;">⚠ Has Active Alert</small><br/>' : ''}
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
  }, [locations, alerts]);





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
        center={currentCenter}
        zoom={mapZoom}
        onZoomChange={setMapZoom}
        onMapClick={handleMapClick}
        onPolygonClick={handlePolygonClick}
        polygons={polygons}
        markers={markers}
        selectedPolygonId={selectedGeofenceId}
        className="w-full h-full"
      />

      {/* Bottom Controls - Show Edit Zone button when polygon is selected */}
      {selectedGeofenceId && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <button
            onClick={handleEditZone}
            className="w-full bg-[var(--grass-green)] text-white px-4 py-3 rounded-lg text-sm hover:bg-[var(--pine-green)] flex items-center justify-center gap-2 shadow-lg font-medium"
          >
            <Edit className="w-4 h-4" />
            Edit zone
          </button>
        </div>
      )}

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
