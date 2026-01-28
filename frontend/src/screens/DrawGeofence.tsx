import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import * as turf from '@turf/turf';
import { LeafletMap } from '../components/LeafletMap';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { useGeofences } from '../hooks/useGeofences';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { Search, Navigation, X, Trash2, Move } from 'lucide-react';
import { toast } from 'sonner';

type LatLng = [number, number];

const VIEWPORT_STORAGE_KEY = 'drawGeofence:lastViewport';

interface ViewportState {
  center: [number, number];
  zoom: number;
}

export const DrawGeofence: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { geofences, refetch: refetchGeofences } = useGeofences(user?.id);
  const { navigateBackToLast, setLastRoute, setLastMainTab } = useApp();
  
  // Get navigation state from location
  const fromState = (location.state as { from?: { pathname: string; mainTab?: string } })?.from;
  
  // State machine: 'create' | 'edit'
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  
  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.969205, 7.595761]);
  const [mapZoom, setMapZoom] = useState<number>(17); // Maximum zoom level
  
  // Polygon state
  const [currentPolygon, setCurrentPolygon] = useState<LatLng[]>([]);
  const [savedPolygon, setSavedPolygon] = useState<LatLng[]>([]);
  const [bufferMeters, setBufferMeters] = useState<number>(0);
  
  // UI state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedPointPosition, setSelectedPointPosition] = useState<LatLng | null>(null);
  const [isMovingPoint, setIsMovingPoint] = useState(false);
  const [movingPointIndex, setMovingPointIndex] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  // Refs
  const validationTimeoutRef = useRef<number | null>(null);

  // Load viewport from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (saved) {
        const viewport: ViewportState = JSON.parse(saved);
        setMapCenter(viewport.center);
        setMapZoom(viewport.zoom);
      }
    } catch (e) {
      console.error('Failed to load viewport:', e);
    }
  }, []);

  // Save viewport to localStorage on change
  useEffect(() => {
    try {
      const viewport: ViewportState = { center: mapCenter, zoom: mapZoom };
      localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
    } catch (e) {
      console.error('Failed to save viewport:', e);
    }
  }, [mapCenter, mapZoom]);

  // Initialize from URL params and track navigation state
  // SECURITY: Verify ownership when loading from URL params
  useEffect(() => {
    const urlMode = searchParams.get('mode') || 'create';
    const urlId = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null;
    
    // Track current route for navigation memory
    if (fromState) {
      setLastRoute(fromState.pathname);
      if (fromState.mainTab) {
        setLastMainTab(fromState.mainTab as any);
      }
    }
    
    if (urlMode === 'edit' && urlId && user?.id) {
      // Verify the geofence belongs to the current user
      const geofence = geofences.find(g => g.id === urlId && g.user_id === user.id);
      if (geofence) {
        setMode('edit');
        setSelectedGeofenceId(urlId);
      } else if (geofences.length > 0) {
        // Only show error if geofences have loaded (to avoid false positives during loading)
        // Geofence not found or doesn't belong to user - switch to create mode
        console.warn('Attempted to edit geofence not owned by current user:', urlId);
        toast.error('You don\'t have permission to edit this zone.');
        setMode('create');
        setSelectedGeofenceId(null);
        setSearchParams({ mode: 'create' });
      }
      // If geofences are still loading, wait for them to load
    } else {
      setMode(urlMode as 'create' | 'edit');
      setSelectedGeofenceId(null);
    }
  }, [searchParams, geofences, user?.id, setSearchParams, fromState, setLastRoute, setLastMainTab]);

  // Load selected geofence for editing
  // SECURITY: Only allow editing geofences from the user-filtered list
  const editingGeofence = useMemo(() => {
    if (selectedGeofenceId && user?.id) {
      const geofence = geofences.find(g => g.id === selectedGeofenceId);
      // Verify ownership before allowing edit
      if (geofence && geofence.user_id === user.id) {
        return geofence;
      }
      // If geofence not found in user's list, it doesn't belong to them
      console.warn('Attempted to edit geofence not owned by current user');
      return null;
    }
    return null;
  }, [selectedGeofenceId, geofences, user?.id]);

  // Initialize polygon if editing
  useEffect(() => {
    if (editingGeofence && editingGeofence.boundary_inner) {
      const coords = toLatLngArray(editingGeofence.boundary_inner);
      if (coords.length >= 3) {
        setSavedPolygon(coords);
      // Center map on geofence
      if (coords.length > 0) {
        const ring: number[][] = coords.map(([lat, lng]: LatLng) => [lng, lat]);
        const center = turf.centroid(turf.polygon([ring]));
        const centerCoords = center.geometry.coordinates;
        setMapCenter([centerCoords[1] as number, centerCoords[0] as number] as [number, number]);
      }
      }
    } else if (mode === 'create') {
      setSavedPolygon([]);
      setCurrentPolygon([]);
    }
  }, [editingGeofence, mode]);

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

  // Validate polygon geometry using Supabase RPC
  const validatePolygon = useCallback(async (polygon: LatLng[]): Promise<boolean> => {
    if (polygon.length < 3) return true; // Allow incomplete polygons
    
    try {
      // Convert to GeoJSON Polygon
      const ring: number[][] = polygon.map(([lat, lng]) => [lng, lat]);
      // Ensure closed ring
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      
      const geojson = {
        type: 'Polygon',
        coordinates: [ring]
      };

      const { data, error } = await supabase.rpc('validate_polygon_simple', {
        p_geojson: geojson
      });

      if (error) {
        console.error('Validation error:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }, []);

  // Debounced validation (not used currently, but kept for future use)
  // const validatePolygonDebounced = useCallback(async (polygon: LatLng[]) => {
  //   if (validationTimeoutRef.current) {
  //     clearTimeout(validationTimeoutRef.current);
  //   }
  //   
  //   validationTimeoutRef.current = window.setTimeout(async () => {
  //     setIsValidating(true);
  //     const isValid = await validatePolygon(polygon);
  //     setIsValidating(false);
  //     return isValid;
  //   }, 300);
  // }, [validatePolygon]);

  const hasCompletedOnboarding = geofences.length > 0;

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setMapZoom(17); // Maximum zoom level
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
    
    toast.info('Geocoding service will be implemented soon');
    setMapCenter([51.969205, 7.595761]);
    setShowSearchModal(false);
    setSearchQuery('');
  };

  const handleMapClick = async (lat: number, lng: number) => {
    // If moving a point, place it at the clicked location
    if (isMovingPoint && movingPointIndex !== null) {
      const displayPolygon = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
      const newPolygon: LatLng[] = [...displayPolygon];
      newPolygon[movingPointIndex] = [lat, lng] as LatLng;
      
      // Validate the new polygon
      setIsValidating(true);
      const isValid = await validatePolygon(newPolygon);
      setIsValidating(false);
      
      if (!isValid) {
        toast.error('Please draw a non-overlapping zone');
        setIsMovingPoint(false);
        setMovingPointIndex(null);
        return;
      }
      
      // Update polygon
      if (savedPolygon.length > 0) {
        setSavedPolygon(newPolygon);
      } else {
        setCurrentPolygon(newPolygon);
      }
      
      setIsMovingPoint(false);
      setMovingPointIndex(null);
      return;
    }
    
    // If in edit mode and clicking empty space, switch to create mode
    if (mode === 'edit' && selectedPointIndex === null) {
      setMode('create');
      setSelectedGeofenceId(null);
      setSavedPolygon([]);
      setCurrentPolygon([]);
      return;
    }
    
    // If editing existing polygon, don't allow adding new points
    if (mode === 'edit' && savedPolygon.length > 0) {
      return;
    }
    
    // Add point to current polygon
    const newPolygon: LatLng[] = [...currentPolygon, [lat, lng] as LatLng];
    
    // Validate if polygon has 3+ points (4th point onward)
    if (newPolygon.length >= 3) {
      setIsValidating(true);
      const isValid = await validatePolygon(newPolygon);
      setIsValidating(false);
      
      if (!isValid) {
        toast.error('Please draw a non-overlapping zone');
        return; // Don't add the point
      }
    }
    
    setCurrentPolygon(newPolygon);
    setSelectedPointIndex(null);
  };

  const handlePolygonClick = (polygonIndex: number) => {
    // SECURITY: Only allow selecting geofences from the user-filtered list
    // The geofences array already contains only the current user's geofences
    const clickedGeofence = geofences[polygonIndex];
    if (clickedGeofence && clickedGeofence.user_id === user?.id) {
      // Double-check ownership (defense in depth)
      setMode('edit');
      setSelectedGeofenceId(clickedGeofence.id);
      // Update URL
      setSearchParams({ mode: 'edit', id: clickedGeofence.id.toString() });
    } else {
      console.warn('Attempted to select geofence not owned by current user');
      toast.error('You can only edit your own zones.');
    }
  };

  const handleMarkerClick = (markerIndex: number) => {
    const displayPolygon = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
    if (displayPolygon[markerIndex]) {
      setSelectedPointIndex(markerIndex);
      setSelectedPointPosition(displayPolygon[markerIndex]);
    }
  };

  const handleMovePoint = () => {
    if (selectedPointIndex !== null) {
      setIsMovingPoint(true);
      setMovingPointIndex(selectedPointIndex);
      setSelectedPointIndex(null);
      setSelectedPointPosition(null);
      toast.info('Click on the map to move this point');
    }
  };

  const handleDeletePoint = (index: number) => {
    if (savedPolygon.length > 0) {
      const newPolygon = savedPolygon.filter((_, i) => i !== index);
      setSavedPolygon(newPolygon);
    } else {
      const newPolygon = currentPolygon.filter((_, i) => i !== index);
      setCurrentPolygon(newPolygon);
    }
    setSelectedPointIndex(null);
    setIsMovingPoint(false);
    setMovingPointIndex(null);
  };

  const handleCompletePolygon = async () => {
    if (currentPolygon.length < 3) {
      toast.error('A geofence needs at least 3 points.');
      return;
    }
    
    // Final validation
    setIsValidating(true);
    const isValid = await validatePolygon(currentPolygon);
    setIsValidating(false);
    
    if (!isValid) {
      toast.error('Please draw a non-overlapping zone');
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
    setIsMovingPoint(false);
    setMovingPointIndex(null);
  };

  const handleBack = () => {
    if (mode === 'create') {
      // Create mode: Back goes to Tutorial
      navigate('/tutorial');
    } else {
      // Edit mode: Back goes to last screen/tab
      navigateBackToLast(navigate);
    }
  };

  const handleDiscard = () => {
    // Edit mode: Discard goes back without saving
    navigateBackToLast(navigate);
  };

  const handleSaveGeofence = async () => {
    const polygonToSave = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
    
    if (polygonToSave.length < 3) {
      toast.error('Please draw a geofence with at least 3 points.');
      return;
    }

    // Final validation before save
    setIsValidating(true);
    const isValid = await validatePolygon(polygonToSave);
    setIsValidating(false);
    
    if (!isValid) {
      toast.error('Please draw a non-overlapping zone');
      return;
    }

    if (!user) {
      toast.error('User not found. Please log in again.');
      return;
    }

    try {
      const ring: number[][] = polygonToSave.map(([lat, lng]) => [lng, lat]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }

      const innerFeature = turf.polygon([ring]);

      let outerGeom: any = null;
      if (bufferMeters && bufferMeters > 0 && mode === 'create') {
        const buffered = turf.buffer(innerFeature, bufferMeters, { units: "meters" }) as any;
        const g = buffered?.geometry;
        if (g?.type === "Polygon") {
          outerGeom = g;
        } else if (g?.type === "MultiPolygon") {
          outerGeom = { type: "Polygon", coordinates: g.coordinates[0] };
        }
      }

      if (mode === 'edit' && selectedGeofenceId) {
        // SECURITY: Verify ownership before update (defense in depth)
        // First, verify the geofence exists and belongs to the user
        const { data: existingGeofence, error: verifyError } = await supabase
          .from('geofences')
          .select('id, user_id')
          .eq('id', selectedGeofenceId)
          .eq('user_id', user.id)
          .single();

        if (verifyError || !existingGeofence) {
          toast.error('You don\'t have permission to edit this zone.');
          console.error('Geofence ownership verification failed:', verifyError);
          return;
        }

        // Now perform the update (RLS will also enforce ownership)
        const { data: updatedData, error: updateError } = await supabase
          .from('geofences')
          .update({
            boundary_inner: innerFeature.geometry,
            boundary_outer: outerGeom,
            buffer_m: bufferMeters,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedGeofenceId)
          .eq('user_id', user.id) // Explicit user filter
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Verify update succeeded (0 rows = permission denied)
        if (!updatedData) {
          toast.error('You don\'t have permission to edit this zone.');
          return;
        }
        
        toast.success('Zone updated successfully');
        await refetchGeofences();
        // Edit mode: navigate back to last screen/tab
        navigateBackToLast(navigate);
      } else {
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
        
        // Create mode: Continue goes to LinkDevices
        navigate('/link-devices', { state: { mode: 'create', from: { pathname: '/draw-geofence', mainTab: undefined } } });
      }
    } catch (error: any) {
      console.error('Save geofence failed', error);
      toast.error('Unable to save zone: ' + (error?.message || 'unknown error'));
    }
  };

  const handleDeleteZone = async () => {
    if (!selectedGeofenceId || mode !== 'edit' || !user?.id) return;
    
    if (!confirm('Are you sure you want to delete this zone?')) {
      return;
    }

    try {
      // SECURITY: Verify ownership before delete (defense in depth)
      const { data: existingGeofence, error: verifyError } = await supabase
        .from('geofences')
        .select('id, user_id')
        .eq('id', selectedGeofenceId)
        .eq('user_id', user.id)
        .single();

      if (verifyError || !existingGeofence) {
        toast.error('You don\'t have permission to delete this zone.');
        console.error('Geofence ownership verification failed:', verifyError);
        return;
      }

      // Perform delete (RLS will also enforce ownership)
      const { data: deletedData, error: deleteError } = await supabase
        .from('geofences')
        .delete()
        .eq('id', selectedGeofenceId)
        .eq('user_id', user.id) // Explicit user filter
        .select()
        .single();

      if (deleteError) {
        throw deleteError;
      }

      // Verify delete succeeded (0 rows = permission denied)
      if (!deletedData) {
        toast.error('You don\'t have permission to delete this zone.');
        return;
      }
      
      toast.success('Zone deleted successfully');
      await refetchGeofences();
      
      // Switch back to create mode
      setMode('create');
      setSelectedGeofenceId(null);
      setSavedPolygon([]);
      setCurrentPolygon([]);
      setSearchParams({ mode: 'create' });
    } catch (error: any) {
      console.error('Delete geofence failed', error);
      toast.error('Unable to delete zone: ' + (error?.message || 'unknown error'));
    }
  };

  // Prepare polygons for display
  const displayPolygon = savedPolygon.length > 0 ? savedPolygon : currentPolygon;
  
  // Convert existing geofences to polygon format
  const existingPolygons = useMemo(() => {
    return geofences.map((geofence) => {
      const coords = toLatLngArray(geofence.boundary_inner);
      return {
        coordinates: coords,
        color: '#78A64A',
        fillColor: '#78A64A',
        fillOpacity: 0.2,
        id: geofence.id,
      };
    });
  }, [geofences]);

  // Current drawing polygon
  const drawingPolygon = displayPolygon.length >= 3 ? [{
    coordinates: displayPolygon,
    color: mode === 'edit' ? '#3FB7FF' : '#78A64A',
    fillColor: mode === 'edit' ? '#3FB7FF' : '#78A64A',
    fillOpacity: 0.3,
    id: selectedGeofenceId || 'drawing',
  }] : [];

  // Combine existing and drawing polygons
  const allPolygons = [...existingPolygons, ...drawingPolygon];

  // Prepare markers for polygon points
  const markers = displayPolygon.map((p, i) => ({
    position: p as [number, number],
    color: isMovingPoint && movingPointIndex === i ? '#FF0000' : '#F59E0B',
    label: `${i + 1}`,
  }));

  const stopLeaflet = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0">
        <h2
          className="text-white"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          {mode === 'create' ? 'Create Zone' : 'Edit Zone'}
        </h2>
        {isValidating && (
          <p className="text-xs mt-1 opacity-75">Validating geometry...</p>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <LeafletMap
          center={mapCenter}
          zoom={mapZoom}
          onZoomChange={setMapZoom}
          onMapClick={handleMapClick}
          onPolygonClick={handlePolygonClick}
          onMarkerClick={handleMarkerClick}
          polygons={allPolygons}
          markers={markers}
          selectedPolygonId={selectedGeofenceId}
          className="w-full h-full"
        />

        {/* Floating buttons */}
        <div className="absolute right-4 top-4 z-[5000] pointer-events-auto">
          <div className="bg-[var(--grass-green)]/90 backdrop-blur-sm rounded-lg p-1 shadow-lg flex flex-col gap-2">
            <button
              onPointerDown={stopLeaflet}
              onClick={(e) => {
                stopLeaflet(e);
                setShowSearchModal(true);
              }}
              className="bg-white/90 hover:bg-white p-3 rounded-lg transition-colors"
              title="Search location"
            >
              <Search className="w-4 h-4 text-[var(--deep-forest)]" />
            </button>

            <button
              onPointerDown={stopLeaflet}
              onClick={(e) => {
                stopLeaflet(e);
                handleUseCurrentLocation();
              }}
              className="bg-white/90 hover:bg-white p-3 rounded-lg transition-colors"
              title="Use current location"
            >
              <Navigation className="w-4 h-4 text-[var(--deep-forest)]" />
            </button>
          </div>
        </div>

        

        {/* Point Action Popover */}
        {selectedPointIndex !== null && selectedPointPosition && !isMovingPoint && (
          <div 
            className="absolute z-[1001] bg-white rounded-lg shadow-xl p-2 border border-gray-200"
            style={{
              left: '50%',
              top: '40%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              onClick={handleMovePoint}
              className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded w-full"
            >
              <Move className="w-4 h-4" />
              Move Point
            </button>
            <button
              onClick={() => {
                handleDeletePoint(selectedPointIndex);
                setSelectedPointIndex(null);
                setSelectedPointPosition(null);
              }}
              className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded w-full mt-1"
            >
              <X className="w-4 h-4" />
              Delete
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

        {/* Complete Polygon Button */}
        {currentPolygon.length >= 3 && savedPolygon.length === 0 && mode === 'create' && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={handleCompletePolygon}
              className="bg-[var(--grass-green)] text-white px-4 py-2 rounded-lg shadow-lg"
            >
              Complete ({currentPolygon.length})
            </button>
          </div>
        )}

        {/* Clear Button */}
        {displayPolygon.length > 0 && (
          <div className="absolute bottom-4 right-4 z-[1000]">
            <button
              onClick={handleDeleteZone}
              className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center opacity-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-[var(--deep-forest)] p-4 shrink-0 space-y-3">
        {/* Buffer slider (only in create mode) */}
        {savedPolygon.length >= 3 && mode === 'create' && (
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          {mode === 'create' ? (
            <>
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
                disabled={displayPolygon.length < 3 || isValidating}
              >
                {isValidating ? 'Validating...' : 'Continue'}
              </GeoButton>
            </>
          ) : (
            <>
              <GeoButton 
                variant="outline" 
                onClick={handleDiscard}
                className="flex-1"
              >
                Discard
              </GeoButton>
              <GeoButton 
                variant="primary" 
                onClick={handleSaveGeofence}
                className="flex-1"
                disabled={displayPolygon.length < 3 || isValidating}
              >
                {isValidating ? 'Validating...' : 'Save'}
              </GeoButton>
            </>
          )}
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
