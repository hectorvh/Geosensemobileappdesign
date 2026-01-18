import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as turf from '@turf/turf';
import { LeafletMap } from '../components/LeafletMap';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { useGeofences } from '../hooks/useGeofences';
import { supabase } from '../lib/supabase';
import { Search, Navigation, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const DrawGeofence: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { geofences, refetch: refetchGeofences } = useGeofences(user?.id);
  
  // Get mode and id from URL params
  const mode = searchParams.get('mode') || 'create';
  const geofenceId = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;
  
  // Find geofence to edit if in edit mode
  const editingGeofence = useMemo(() => {
    if (mode === 'edit' && geofenceId) {
      return geofences.find(g => g.id === geofenceId) || null;
    }
    return null;
  }, [mode, geofenceId, geofences]);

  const [mapCenter, setMapCenter] = useState<[number, number]>([51.969205, 7.595761]);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [currentPolygon, setCurrentPolygon] = useState<[number, number][]>([]);
  const [savedPolygon, setSavedPolygon] = useState<[number, number][]>([]);
  const [bufferMeters, setBufferMeters] = useState<number>(0);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedPointPosition, setSelectedPointPosition] = useState<[number, number] | null>(null);

  // Initialize polygon if editing
  useEffect(() => {
    if (editingGeofence && editingGeofence.boundary_inner) {
      const coords = toLatLngArray(editingGeofence.boundary_inner);
      if (coords.length >= 3) {
        setSavedPolygon(coords);
        // Center map on geofence
        if (coords.length > 0) {
          setMapCenter(coords[0]);
        }
      }
    }
  }, [editingGeofence]);

  // Enable drawing by default
  useEffect(() => {
    if (mode === 'create' && savedPolygon.length === 0) {
      // Drawing is enabled by default - no need to set isDrawing state
    }
  }, [mode, savedPolygon.length]);

  type LatLng = [number, number];

  function toLatLngArray(input: any): LatLng[] {
    if (!input) return [];
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { return []; }
    }
    if (input?.type === "Feature" && input?.geometry) input = input.geometry;
    if (input?.type === "Polygon" && Array.isArray(input.coordinates)) {
      const ring = input.coordinates[0] ?? [];
      return ring.map(([lng, lat]: number[]) => [lat, lng]);
    }
    if (input?.type === "MultiPolygon" && Array.isArray(input.coordinates)) {
      const ring = input.coordinates?.[0]?.[0] ?? [];
      return ring.map(([lng, lat]: number[]) => [lat, lng]);
    }
    if (Array.isArray(input) && input.length && Array.isArray(input[0])) {
      return input.map((p: any) => [Number(p[0]), Number(p[1])] as LatLng);
    }
    return [];
  }

  // Check if user has completed onboarding (has at least one geofence)
  const hasCompletedOnboarding = geofences.length > 0;

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
        },
        (error) => {
          toast.error('Unable to get current location. Please enable location permissions.');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    
    // TODO: Implement geocoding service (Nominatim, Google Maps, etc.)
    // For now, show placeholder
    toast.info('Geocoding service will be implemented soon');
    
    // Mock: center on a default location
    setMapCenter([51.969205, 7.595761]);
    setShowSearchModal(false);
    setSearchQuery('');
  };

  const handleMapClick = (lat: number, lng: number) => {
    // If editing existing polygon, don't allow adding new points
    if (mode === 'edit' && savedPolygon.length > 0) {
      return;
    }
    
    // Add point to current polygon
    setCurrentPolygon((prev) => [...prev, [lat, lng]]);
    setSelectedPointIndex(null);
  };

  const handleMarkerClick = (markerIndex: number) => {
    // Show point deletion option
    const displayPolygon = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
    if (displayPolygon[markerIndex]) {
      setSelectedPointIndex(markerIndex);
      setSelectedPointPosition(displayPolygon[markerIndex]);
    }
  };

  const handleDeletePoint = (index: number) => {
    if (savedPolygon.length > 0) {
      // Delete from saved polygon
      const newPolygon = savedPolygon.filter((_, i) => i !== index);
      setSavedPolygon(newPolygon);
    } else {
      // Delete from current polygon
      const newPolygon = currentPolygon.filter((_, i) => i !== index);
      setCurrentPolygon(newPolygon);
    }
    setSelectedPointIndex(null);
  };

  const handleCompletePolygon = () => {
    if (currentPolygon.length < 3) {
      toast.error('A geofence needs at least 3 points.');
      return;
    }
    setSavedPolygon(currentPolygon);
    setCurrentPolygon([]);
    setBufferMeters(0);
  };

  const handleClearPolygon = () => {
    setSavedPolygon([]);
    setCurrentPolygon([]);
    setBufferMeters(0);
    setSelectedPointIndex(null);
  };

  const handleBack = () => {
    if (!hasCompletedOnboarding) {
      // First-time onboarding - go to LinkDevices
      navigate('/link-devices');
    } else {
      // Return to MapTab
      navigate('/main');
    }
  };

  const handleSaveGeofence = async () => {
    const polygonToSave = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
    
    if (polygonToSave.length < 3) {
      toast.error('Please draw a geofence with at least 3 points.');
      return;
    }

    if (!user) {
      toast.error('User not found. Please log in again.');
      return;
    }

    try {
      // Convert [lat,lng][] -> GeoJSON Polygon (GeoJSON uses [lng,lat])
      const ring: number[][] = polygonToSave.map(([lat, lng]) => [lng, lat]);

      // Ensure closed ring
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }

      const innerFeature = turf.polygon([ring]);

      // Calculate outer geometry if buffer is set
      let outerGeom: any = null;
      if (bufferMeters && bufferMeters > 0) {
        const buffered = turf.buffer(innerFeature, bufferMeters, { units: "meters" }) as any;
        const g = buffered?.geometry;

        if (g?.type === "Polygon") {
          outerGeom = g;
        } else if (g?.type === "MultiPolygon") {
          outerGeom = { type: "Polygon", coordinates: g.coordinates[0] };
        }
      }

      if (mode === 'edit' && geofenceId) {
        // Update existing geofence
        const { error } = await supabase
          .from('geofences')
          .update({
            boundary_inner: innerFeature.geometry,
            boundary_outer: outerGeom,
            buffer_m: bufferMeters,
            updated_at: new Date().toISOString(),
          })
          .eq('id', geofenceId)
          .eq('user_id', user.id);

        if (error) throw error;
        
        toast.success('Zone updated successfully');
        await refetchGeofences();
        navigate('/main');
      } else {
        // Create new geofence
        const { data, error } = await supabase
          .from('geofences')
          .insert({
            name: "My Safe Zone",
            user_id: user.id,
            boundary_inner: innerFeature.geometry,
            boundary_outer: outerGeom,
            buffer_m: bufferMeters,
          })
          .select()
          .single();

        if (error) throw error;
        
        toast.success('Zone saved successfully');
        await refetchGeofences();
        
        if (!hasCompletedOnboarding) {
          navigate('/link-devices');
        } else {
          navigate('/main');
        }
      }
    } catch (error: any) {
      console.error('Save geofence failed', error);
      toast.error('Unable to save zone: ' + (error?.message || 'unknown error'));
    }
  };

  const handleDeleteZone = async () => {
    if (!geofenceId || mode !== 'edit') return;
    
    if (!confirm('Are you sure you want to delete this zone?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('geofences')
        .delete()
        .eq('id', geofenceId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast.success('Zone deleted successfully');
      await refetchGeofences();
      navigate('/main');
    } catch (error: any) {
      console.error('Delete geofence failed', error);
      toast.error('Unable to delete zone: ' + (error?.message || 'unknown error'));
    }
  };

  // Prepare polygons for display
  const displayPolygon = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
  const polygons = displayPolygon.length >= 3 ? [{
    coordinates: displayPolygon,
    color: '#78A64A',
    fillColor: '#78A64A',
    fillOpacity: 0.3,
  }] : [];

  // Prepare markers for polygon points
  const markers = displayPolygon.map((p, i) => ({
    position: p as [number, number],
    color: '#F59E0B',
    label: `${i + 1}`,
  }));

  return (
    <div className="h-full flex flex-col relative">
      {/* Header - Match MapTab style */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0">
        <h2
          className="text-white"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          Draw Your Safe Zone
        </h2>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <LeafletMap
          center={mapCenter}
          zoom={mapZoom}
          onZoomChange={setMapZoom}
          onMapClick={handleMapClick}
          onMarkerClick={handleMarkerClick}
          polygons={polygons}
          markers={markers}
          className="w-full h-full"
        />

        {/* Floating Search Button (bottom-left) */}
        <button
          onClick={() => setShowSearchModal(true)}
          className="absolute bottom-20 left-4 z-[1000] bg-white/50 hover:bg-white/70 p-3 rounded-lg shadow-lg transition-colors"
          style={{ opacity: 0.5 }}
        >
          <Search className="w-5 h-5 text-[var(--deep-forest)]" />
        </button>

        {/* Floating Current Location Button (bottom-right) */}
        <button
          onClick={handleUseCurrentLocation}
          className="absolute bottom-20 right-4 z-[1000] bg-blue-500/50 hover:bg-blue-500/70 p-3 rounded-lg shadow-lg transition-colors"
          style={{ opacity: 0.5 }}
        >
          <Navigation className="w-5 h-5 text-white" />
        </button>

        {/* Point Deletion Popover - positioned near the marker */}
        {selectedPointIndex !== null && selectedPointPosition && (
          <div 
            className="absolute z-[1001] bg-white rounded-lg shadow-xl p-2 border border-gray-200"
            style={{
              // Position near the center of the map for now - in production, use Leaflet's latLngToContainerPoint
              left: '50%',
              top: '40%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              onClick={() => {
                handleDeletePoint(selectedPointIndex);
                setSelectedPointIndex(null);
                setSelectedPointPosition(null);
              }}
              className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded w-full"
            >
              <X className="w-4 h-4" />
              Delete point {selectedPointIndex + 1}
            </button>
            <button
              onClick={() => {
                setSelectedPointIndex(null);
                setSelectedPointPosition(null);
              }}
              className="mt-1 text-xs text-gray-500 hover:text-gray-700 w-full text-center"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Complete Polygon Button (if drawing) */}
        {currentPolygon.length >= 3 && savedPolygon.length === 0 && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={handleCompletePolygon}
              className="bg-[var(--grass-green)] text-white px-4 py-2 rounded-lg shadow-lg"
            >
              Complete ({currentPolygon.length})
            </button>
          </div>
        )}

        {/* Clear Button (if polygon exists) */}
        {displayPolygon.length > 0 && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={handleClearPolygon}
              className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls - Match MapTab style */}
      <div className="bg-[var(--deep-forest)] p-4 shrink-0 space-y-3">
        {/* Buffer slider (if polygon is saved) */}
        {savedPolygon.length >= 3 && (
          <div className="bg-[var(--pine-green)] p-3 rounded-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Buffer (meters)</span>
              <span className="text-sm font-semibold">{bufferMeters} m</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={bufferMeters}
              onChange={(e) => setBufferMeters(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {/* Delete Zone Button (edit mode only) */}
        {mode === 'edit' && geofenceId && (
          <button
            onClick={handleDeleteZone}
            className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete zone
          </button>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <GeoButton 
            variant="outline" 
            onClick={handleBack}
            className="flex-1"
          >
            Back
          </GeoButton>
          <GeoButton 
            variant="primary" 
            onClick={handleSaveGeofence}
            className="flex-1"
            disabled={displayPolygon.length < 3}
          >
            Save
          </GeoButton>
        </div>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="absolute inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-white w-full p-4 rounded-t-2xl">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search place or address"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchLocation()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--grass-green)]"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleSearchLocation}
              className="w-full bg-[var(--grass-green)] text-white px-4 py-2 rounded-lg"
            >
              Search
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              TODO: Geocoding service integration
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
