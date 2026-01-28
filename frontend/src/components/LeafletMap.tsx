import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

type BasemapType = 'street' | 'terrain' | 'satellite';

interface MapProps {
  center: [number, number];
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  onZoomChange?: (zoom: number) => void;
  onViewportChange?: (center: [number, number], zoom: number) => void;
  onPolygonClick?: (polygonIndex: number) => void;
  onMarkerClick?: (markerIndex: number) => void;
  polygons?: Array<{
    coordinates: [number, number][];
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    id?: string | number;
  }>;
  markers?: Array<{
    position: [number, number];
    color: string;
    label?: string;
    popup?: React.ReactNode;
  }>;
  selectedPolygonId?: string | number | null;
  className?: string;
  /**
   * If true and no saved viewport exists, automatically fit bounds
   * to polygons + markers once on initial render.
   */
  autoFitBounds?: boolean;
  /**
   * Basemap tile layer to display
   */
  basemap?: BasemapType;
}

export const LeafletMap: React.FC<MapProps> = ({
  center,
  zoom,
  onMapClick,
  onZoomChange,
  onViewportChange,
  onPolygonClick,
  onMarkerClick,
  polygons = [],
  markers = [],
  selectedPolygonId,
  className = '',
  autoFitBounds = false,
  basemap = 'street',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const markerLayersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const onMapClickRef = useRef<MapProps["onMapClick"]>(onMapClick);
  const onZoomChangeRef = useRef<MapProps["onZoomChange"]>(onZoomChange);
  const onViewportChangeRef = useRef<MapProps["onViewportChange"]>(onViewportChange);
  const onPolygonClickRef = useRef<MapProps["onPolygonClick"]>(onPolygonClick);
  const onMarkerClickRef = useRef<MapProps["onMarkerClick"]>(onMarkerClick);
  const currentZoomRef = useRef<number>(zoom);
  const isUserInteractionRef = useRef<boolean>(false);
  const hasAutoFittedRef = useRef<boolean>(false);
  const currentBasemapRef = useRef<BasemapType>(basemap);

  // Get tile layer URL and attribution based on basemap type
  const getTileLayerConfig = (basemapType: BasemapType) => {
    switch (basemapType) {
      case 'street':
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        };
      case 'terrain':
        return {
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap contributors, © OpenTopoMap',
          maxZoom: 17,
        };
      case 'satellite':
        // Using Esri World Imagery (free, no API key required)
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '© Esri',
          maxZoom: 19,
        };
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        };
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance without zoom control initially
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, zoom);

    // Add initial tile layer based on basemap prop
    const tileConfig = getTileLayerConfig(basemap);
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    });
    
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;
    currentBasemapRef.current = basemap;

    // Handle map clicks (but not on polygons/markers)
    map.on('click', (e: any) => {
      // Only trigger if clicking directly on the map, not on a layer
      if (e.originalEvent && e.originalEvent.target === map.getContainer()) {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      }
    });

    // Track zoom changes from user interaction
    map.on('zoomend', () => {
      if (mapInstanceRef.current) {
        const newZoom = mapInstanceRef.current.getZoom();
        currentZoomRef.current = newZoom;
        isUserInteractionRef.current = true;
        onZoomChangeRef.current?.(newZoom);
        const centerLatLng = mapInstanceRef.current.getCenter();
        onViewportChangeRef.current?.(
          [centerLatLng.lat, centerLatLng.lng],
          newZoom
        );
      }
    });

    // Track drag/pan to detect user interaction and notify viewport change
    map.on('moveend', () => {
      if (mapInstanceRef.current) {
        isUserInteractionRef.current = true;
        const c = mapInstanceRef.current.getCenter();
        const z = mapInstanceRef.current.getZoom();
        currentZoomRef.current = z;
        onViewportChangeRef.current?.([c.lat, c.lng], z);
      }
    });

    mapInstanceRef.current = map;

    // Force map to resize after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update tile layer when basemap changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    if (currentBasemapRef.current === basemap) return; // Already using this basemap

    // Remove old tile layer
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    // Add new tile layer
    const tileConfig = getTileLayerConfig(basemap);
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    });
    
    newTileLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
    currentBasemapRef.current = basemap;
  }, [basemap]);

  // Update zoom change callback
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  // Update viewport change callback
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Track initial mount
  const isInitialMountRef = useRef(true);
  const lastCenterRef = useRef<[number, number]>(center);

  // Update center only (preserve user's zoom level)
  useEffect(() => {
    if (mapInstanceRef.current) {
      if (isInitialMountRef.current) {
        // On initial mount, set both center and zoom
        mapInstanceRef.current.setView(center, zoom);
        currentZoomRef.current = zoom;
        lastCenterRef.current = center;
        isInitialMountRef.current = false;
      } else {
        // After initial mount, only update center if it actually changed
        // Use panTo to preserve zoom level
        const [lastLat, lastLng] = lastCenterRef.current;
        const [newLat, newLng] = center;
        if (Math.abs(lastLat - newLat) > 0.0001 || Math.abs(lastLng - newLng) > 0.0001) {
          mapInstanceRef.current.panTo(center, { animate: false });
          lastCenterRef.current = center;
        }
      }
    }
  }, [center, zoom]);

  // Don't update zoom after initial mount - let user control it
  // Zoom is only set on initial mount above

  // Update polygon click callback
  useEffect(() => {
    onPolygonClickRef.current = onPolygonClick;
  }, [onPolygonClick]);

  // Update marker click callback
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // Update polygons
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing polygons
    polygonLayersRef.current.forEach((layer) => layer.remove());
    polygonLayersRef.current = [];

    // Add new polygons
    polygons.forEach((polygon, index) => {
      if (polygon.coordinates.length < 3) return;

      const isSelected = selectedPolygonId !== undefined && polygon.id === selectedPolygonId;
      
      const leafletPolygon = L.polygon(polygon.coordinates, {
        color: isSelected ? '#3FB7FF' : (polygon.color || '#78A64A'),
        fillColor: isSelected ? '#3FB7FF' : (polygon.fillColor || '#78A64A'),
        fillOpacity: isSelected ? 0.5 : (polygon.fillOpacity ?? 0.3),
        weight: isSelected ? 4 : 3,
      }).addTo(mapInstanceRef.current!);

      // Ensure polygons stay visually below markers
      leafletPolygon.bringToBack();

      // Add click handler for polygon
      if (onPolygonClick) {
        leafletPolygon.on('click', () => {
          onPolygonClickRef.current?.(index);
        });
      }

      // Make polygon interactive
      leafletPolygon.on('mouseover', function() {
        this.setStyle({
          weight: 4,
          fillOpacity: 0.5,
        });
      });
      leafletPolygon.on('mouseout', function() {
        if (!isSelected) {
          this.setStyle({
            weight: 3,
            fillOpacity: polygon.fillOpacity ?? 0.3,
          });
        }
      });

      polygonLayersRef.current.push(leafletPolygon);
    });
  }, [polygons, selectedPolygonId, onPolygonClick]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing markers
    markerLayersRef.current.forEach((layer) => layer.remove());
    markerLayersRef.current = [];

    // Add new markers
    markers.forEach((marker, index) => {
      const circleMarker = L.circleMarker(marker.position, {
        radius: 8,
        fillColor: marker.color,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(mapInstanceRef.current!);

      // Ensure markers are always drawn above polygons
      circleMarker.bringToFront();

      // Add click handler for marker
      if (onMarkerClick) {
        circleMarker.on('click', () => {
          onMarkerClickRef.current?.(index);
        });
      }

      // Add popup if label or popup provided
      if (marker.popup) {
        circleMarker.bindPopup(marker.popup, { className: 'custom-popup' });
      } else if (marker.label) {
        circleMarker.bindPopup(marker.label);
      }

      markerLayersRef.current.push(circleMarker);
    });
  }, [markers, onMarkerClick]);

  // Auto-fit bounds once if requested and no saved viewport is being used
  // Uses dynamic padding to achieve ~70% window occupancy (15% padding on each side)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!autoFitBounds) return;
    if (hasAutoFittedRef.current) return;

    const bounds = L.latLngBounds([]);

    // Include ALL geofence polygons
    polygons.forEach((polygon) => {
      polygon.coordinates.forEach(([lat, lng]) => {
        bounds.extend([lat, lng]);
      });
    });

    // Include ALL device marker positions
    markers.forEach((marker) => {
      bounds.extend(marker.position);
    });

    if (bounds.isValid()) {
      // Calculate dynamic padding based on map container size
      // Target: ~70% occupancy = 15% padding on each side
      const container = mapInstanceRef.current.getContainer();
      const containerWidth = container.clientWidth || 800; // fallback
      const containerHeight = container.clientHeight || 600; // fallback

      // 15% of container size on each side
      const padX = Math.round(containerWidth * 0.15);
      const padY = Math.round(containerHeight * 0.15);

      mapInstanceRef.current.fitBounds(bounds, {
        paddingTopLeft: [padY, padX],
        paddingBottomRight: [padY, padX],
        maxZoom: 17,
      } as L.FitBoundsOptions);
      hasAutoFittedRef.current = true;
    }
  }, [polygons, markers, autoFitBounds]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);


  return (
    <div
      ref={mapRef}
      className={className}
      style={{ width: '100%', height: '100%', zIndex: 0 }}
    />
  );
};
