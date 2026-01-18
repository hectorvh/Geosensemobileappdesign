import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapProps {
  center: [number, number];
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  onZoomChange?: (zoom: number) => void;
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
}

export const LeafletMap: React.FC<MapProps> = ({
  center,
  zoom,
  onMapClick,
  onZoomChange,
  onPolygonClick,
  onMarkerClick,
  polygons = [],
  markers = [],
  selectedPolygonId,
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const markerLayersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const onMapClickRef = useRef<MapProps["onMapClick"]>(onMapClick);
  const onZoomChangeRef = useRef<MapProps["onZoomChange"]>(onZoomChange);
  const onPolygonClickRef = useRef<MapProps["onPolygonClick"]>(onPolygonClick);
  const onMarkerClickRef = useRef<MapProps["onMarkerClick"]>(onMarkerClick);
  const currentZoomRef = useRef<number>(zoom);
  const isUserInteractionRef = useRef<boolean>(false);


  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance without zoom control initially
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, zoom);

    // Add OpenStreetMap tiles
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });
    
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

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
      }
    });

    // Track drag/pan to detect user interaction
    map.on('dragend', () => {
      isUserInteractionRef.current = true;
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

  // Update zoom change callback
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

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
