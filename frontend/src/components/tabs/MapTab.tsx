import React, { useState, useMemo } from 'react';
import { LeafletMap } from '../LeafletMap';
import { GeoButton } from '../GeoButton';
import { MapPin, Trash2, Edit, Loader2, Map, Mountain, Satellite, Layers, Plus, Search, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLiveLocations } from '../../hooks/useLiveLocations';
import { useGeofences } from '../../hooks/useGeofences';
import { useAlerts } from '../../hooks/useAlerts';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type BasemapType = 'street' | 'terrain' | 'satellite';

export const MapTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showRetry, setShowRetry] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(19); // Maximum zoom level
  const [hasSavedViewport, setHasSavedViewport] = useState(false);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  const { locations, loading: locationsLoading, error: locationsError } = useLiveLocations(user?.id, 5000);
  const { geofences, loading: geofencesLoading, error: geofencesError } = useGeofences(user?.id);
  const { alerts } = useAlerts(user?.id, true);

  const geolocationRequestedRef = React.useRef(false);
  const saveViewportTimeoutRef = React.useRef<number | null>(null);
  const isRestoringViewportRef = React.useRef(false);

  const LAST_VIEWPORT_KEY = 'MapTab:lastViewport';
  const BASEMAP_KEY = 'MapTab:basemap';

  // Basemap state with localStorage persistence
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>(() => {
    if (typeof window === 'undefined') return 'satellite';
    try {
      const saved = window.localStorage.getItem(BASEMAP_KEY);
      if (saved === 'street' || saved === 'terrain' || saved === 'satellite') {
        return saved;
      }
    } catch (err) {
      console.error('Failed to load saved basemap:', err);
    }
    return 'satellite';
  });

  const [isBasemapMenuOpen, setIsBasemapMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBasemapChange = (basemap: BasemapType) => {
    setActiveBasemap(basemap);
    setIsBasemapMenuOpen(false); // Close menu after selection
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(BASEMAP_KEY, basemap);
      } catch (err) {
        console.error('Failed to save basemap preference:', err);
      }
    }
  };

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

  // Load last saved viewport from localStorage on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LAST_VIEWPORT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.center) &&
        parsed.center.length === 2 &&
        typeof parsed.zoom === 'number'
      ) {
        const [lat, lng] = parsed.center;
        // Validate: lat/lng must be finite and within valid bounds
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180 &&
          Number.isFinite(parsed.zoom) &&
          parsed.zoom >= 0 &&
          parsed.zoom <= 20
        ) {
          isRestoringViewportRef.current = true;
          setMapCenter([lat, lng]);
          setMapZoom(parsed.zoom);
          setHasSavedViewport(true);
          // Reset flag after a short delay to allow map to restore
          setTimeout(() => {
            isRestoringViewportRef.current = false;
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Failed to load last map viewport:', err);
    }
  }, []);

  // Cleanup debounced save timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveViewportTimeoutRef.current !== null) {
        window.clearTimeout(saveViewportTimeoutRef.current);
      }
    };
  }, []);

  // Explicitly persist the latest viewport when leaving MapTab (component unmount)
  React.useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (!mapCenter) return;
      try {
        window.localStorage.setItem(
          LAST_VIEWPORT_KEY,
          JSON.stringify({ center: mapCenter, zoom: mapZoom })
        );
      } catch (err) {
        console.error('Failed to save map viewport on exit:', err);
      }
    };
    // We register the cleanup with current center/zoom so the latest values are saved on exit
  }, [mapCenter, mapZoom]);

  // Persist viewport whenever map moves/zooms (debounced)
  // IMPORTANT: Do NOT save during initial restore to avoid overwriting with restore values
  const handleViewportChange = React.useCallback(
    (center: [number, number], zoom: number) => {
      setMapCenter(center);
      setMapZoom(zoom);

      // Prevent saving during initial restore
      if (isRestoringViewportRef.current) {
        return;
      }

      if (typeof window === 'undefined') return;

      if (saveViewportTimeoutRef.current !== null) {
        window.clearTimeout(saveViewportTimeoutRef.current);
      }

      // Debounce saves to avoid excessive writes (500ms)
      saveViewportTimeoutRef.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(
            LAST_VIEWPORT_KEY,
            JSON.stringify({ center, zoom })
          );
        } catch (err) {
          console.error('Failed to save map viewport:', err);
        }
      }, 500);
    },
    []
  );

  // Set initial map center only once when data is first loaded and no saved viewport
  React.useEffect(() => {
    if (mapCenter !== null) return;

    // Prefer geofence polygons
    if (geofences.length > 0) {
      const coords = toLatLngArray(geofences[0].boundary_inner);
      if (coords.length > 0) {
        setMapCenter(coords[0]);
        return;
      }
    }

    // Next: first live location if available
    if (locations.length > 0) {
      setMapCenter([locations[0].lat, locations[0].lng]);
      return;
    }

    // If no geofences and no locations, try user geolocation once
    if (!geolocationRequestedRef.current && typeof navigator !== 'undefined' && navigator.geolocation) {
      geolocationRequestedRef.current = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
          setMapZoom(19); // Maximum zoom level
        },
        () => {
          // Fallback default if geolocation fails/permission denied
          setMapCenter([51.969209, 7.595595]);
          setMapZoom(19); // Maximum zoom level
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
      return;
    }

    // Final fallback default if everything else fails
    setMapCenter([51.969209, 7.595595]);
    setMapZoom(19); // Maximum zoom level
  }, [geofences, locations, mapCenter]);

  // Use the stored center or default
  const currentCenter = mapCenter || [51.969209, 7.595595];
  // Ensure zoom is at maximum if not set from saved viewport
  const currentZoom = mapZoom || 19;

  // Clear selection when clicking on map (not on polygon)
  const handleMapClick = () => {
    setSelectedGeofenceId(null);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setMapZoom(15); // Adjusted zoom level for better location context
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
    setShowSearchModal(false);
    setSearchQuery('');
  };

  const stopLeaflet = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  // SECURITY: Only allow selecting geofences from the user-filtered list
  const handlePolygonClick = (polygonIndex: number) => {
    const polygon = polygons[polygonIndex];
    if (polygon) {
      // Verify the geofence belongs to the current user
      const geofence = geofences.find(g => g.id === polygon.id);
      if (geofence && geofence.user_id === user?.id) {
        setSelectedGeofenceId(polygon.id);
      } else {
        console.warn('Attempted to select geofence not owned by current user');
      }
    }
  };

  // Handle edit zone
  const handleEditZone = () => {
    if (selectedGeofenceId) {
      navigate(`/draw-geofence?mode=edit&id=${selectedGeofenceId}`, {
        state: {
          mode: 'edit',
          from: { pathname: '/main', mainTab: 'map' }
        }
      });
    }
  };


  // Prepare markers from live locations with coloring rules:
  // - green: live_location_active = true AND has_active_alert = false
  // - red: live_location_active = true AND has_active_alert = true
  // - grey: live_location_active = false
  const markers = useMemo(() => {
    return locations
      .filter((location) => {
        // Only include locations with valid geometry or lat/lng fallback
        return location.geom || (location.lat != null && location.lng != null);
      })
      .map((location) => {
        const updatedAt = new Date(location.updated_at);
        const now = new Date();
        const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;
        
        // Determine if location is active (updated within last 1 minute)
        const live_location_active = secondsSinceUpdate <= 30;
        
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

        // Extract lat/lng from geometry (GeoJSON Point format: [lng, lat])
        // Fallback to lat/lng columns if geom is not available
        let markerLat: number;
        let markerLng: number;
        
        if (location.geom && location.geom.type === 'Point' && Array.isArray(location.geom.coordinates)) {
          // GeoJSON Point coordinates are [lng, lat]
          markerLng = location.geom.coordinates[0];
          markerLat = location.geom.coordinates[1];
        } else {
          // Fallback to lat/lng columns
          markerLat = location.lat;
          markerLng = location.lng;
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
          position: [markerLat, markerLng] as [number, number],
          color,
          label: `Tracker ${location.tracker_id}`,
          popup: popupContent,
        };
      });
  }, [locations, alerts]);





  return (
    <div className="h-full relative overflow-visible">
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
        zoom={currentZoom}
        onViewportChange={handleViewportChange}
        onZoomChange={setMapZoom}
        onMapClick={handleMapClick}
        onPolygonClick={handlePolygonClick}
        polygons={polygons}
        markers={markers}
        selectedPolygonId={selectedGeofenceId}
        autoFitBounds={!hasSavedViewport}
        basemap={activeBasemap}
        className="w-full h-full"
      />

      {/* Floating buttons - Search and Current Location */}
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

      {/* Draw Geofence Shortcut Button - Bottom Right */}
      <div 
        className="absolute bottom-4 right-4 pointer-events-auto"
        style={{ zIndex: 2000 }}
      >
        <button
          type="button"
          onClick={() => navigate('/draw-geofence?mode=create', {
            state: {
              mode: 'create',
              from: { pathname: '/main', mainTab: 'map' }
            }
          })}
          className="bg-[var(--grass-green)] hover:bg-[var(--pine-green)] text-white rounded-lg shadow-xl p-3 border-2 border-white transition-colors opacity-40 hover:opacity-50"
          aria-label="Draw safe zone"
          title="Draw safe zone"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Basemap Selector - Collapsible menu */}
      <div 
        className="absolute bottom-4 left-4 pointer-events-auto"
        style={{ zIndex: 2000 }}
      >
        <div className="relative">
          {/* Toggle button - small icon */}
          <button
            type="button"
            onClick={() => setIsBasemapMenuOpen(!isBasemapMenuOpen)}
            className="bg-white rounded-lg shadow-xl p-2 border-2 border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Toggle basemap selector"
            title="Basemap layers"
          >
            <Layers className="w-5 h-5 text-gray-700" />
          </button>

          {/* Expandable menu - expands upward */}
          {isBasemapMenuOpen && (
            <div 
              className="absolute left-0 bg-white rounded-lg shadow-xl p-2 flex flex-col gap-2 border-2 border-gray-300"
              style={{ bottom: 'calc(100% + 8px)' }}
            >
              <button
                type="button"
                onClick={() => handleBasemapChange('street')}
                className={`p-2 rounded-md transition-all ${
                  activeBasemap === 'street'
                    ? 'bg-[var(--grass-green)] text-white ring-2 ring-[var(--deep-forest)]'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Street map"
                title="Street map"
              >
                <Map className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleBasemapChange('terrain')}
                className={`p-2 rounded-md transition-all ${
                  activeBasemap === 'terrain'
                    ? 'bg-[var(--grass-green)] text-white ring-2 ring-[var(--deep-forest)]'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Terrain map"
                title="Terrain map"
              >
                <Mountain className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleBasemapChange('satellite')}
                className={`p-2 rounded-md transition-all ${
                  activeBasemap === 'satellite'
                    ? 'bg-[var(--grass-green)] text-white ring-2 ring-[var(--deep-forest)]'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Satellite imagery"
                title="Satellite imagery"
              >
                <Satellite className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

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
