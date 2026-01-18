import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapProps {
  center: [number, number];
  zoom: number;
  onMapClick?: (lat: number, lng: number) => void;
  polygons?: Array<{
    coordinates: [number, number][];
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
  }>;
  markers?: Array<{
    position: [number, number];
    color: string;
    label?: string;
    popup?: React.ReactNode;
  }>;
  className?: string;
}

export const LeafletMap: React.FC<MapProps> = ({
  center,
  zoom,
  onMapClick,
  polygons = [],
  markers = [],
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const markerLayersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const onMapClickRef = useRef<MapProps["onMapClick"]>(onMapClick);


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

    // Handle map clicks
    //if (onMapClick) {
      map.on('click', (e: any) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    //}

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

  // Update center and zoom
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Update polygons
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing polygons
    polygonLayersRef.current.forEach((layer) => layer.remove());
    polygonLayersRef.current = [];

    // Add new polygons
    polygons.forEach((polygon) => {
      if (polygon.coordinates.length < 3) return;

      const leafletPolygon = L.polygon(polygon.coordinates, {
        color: polygon.color || '#78A64A',
        fillColor: polygon.fillColor || '#78A64A',
        fillOpacity: polygon.fillOpacity ?? 0.3,
        weight: 3,
      }).addTo(mapInstanceRef.current!);

      polygonLayersRef.current.push(leafletPolygon);
    });
  }, [polygons]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing markers
    markerLayersRef.current.forEach((layer) => layer.remove());
    markerLayersRef.current = [];

    // Add new markers
    markers.forEach((marker) => {
      const circleMarker = L.circleMarker(marker.position, {
        radius: 8,
        fillColor: marker.color,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(mapInstanceRef.current!);

      // Add popup if label or popup provided
      if (marker.popup) {
        circleMarker.bindPopup(marker.popup, { className: 'custom-popup' });
      } else if (marker.label) {
        circleMarker.bindPopup(marker.label);
      }

      markerLayersRef.current.push(circleMarker);
    });
  }, [markers]);

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
