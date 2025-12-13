import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { LeafletMap } from '../LeafletMap';
import { GeoButton } from '../GeoButton';
import { MapPin, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MapTab: React.FC = () => {
  const navigate = useNavigate();
  const { devices, geofences, removeGeofence } = useApp();
  const [showRetry, setShowRetry] = useState(false);

  // Calculate map center based on geofence or devices
  const getMapCenter = (): [number, number] => {
    if (geofences.length > 0 && geofences[0].coordinates.length > 0) {
      const coords = geofences[0].coordinates[0];
      return coords;
    }
    if (devices.length > 0) {
      return [devices[0].lat, devices[0].lng];
    }
    return [51.969209, 7.595595];
  };

  const handleDeleteGeofence = () => {
    if (geofences.length > 0 && confirm('Delete this geofence?')) {
      removeGeofence(geofences[0].id);
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
  const polygons = [];
  if (geofences.length > 0) {
    const geofence = geofences[0];
    // Buffer zone
    polygons.push({
      coordinates: getBufferPolygon(geofence.coordinates),
      color: '#3FB7FF',
      fillColor: '#3FB7FF',
      fillOpacity: 0.1,
    });
    // Main geofence
    polygons.push({
      coordinates: geofence.coordinates,
      color: '#78A64A',
      fillColor: '#78A64A',
      fillOpacity: 0.3,
    });
  }

  // Prepare markers
  const markers = devices.map((device) => ({
    position: [device.lat, device.lng] as [number, number],
    color: getMarkerColor(device.status),
    label: `${device.animalName} - ${getStatusText(device.status)}`,
  }));

  return (
    <div className="h-full relative">
      {/* Map */}
      <LeafletMap
        center={getMapCenter()}
        zoom={20}
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
          {geofences.length > 0 && (
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
