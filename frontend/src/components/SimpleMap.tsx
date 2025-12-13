import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

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

export const SimpleMap: React.FC<MapProps> = ({
  center,
  zoom,
  onMapClick,
  polygons = [],
  markers = [],
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [currentCenter, setCurrentCenter] = useState(center);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);

  // Convert lat/lng to pixel coordinates
  const latLngToPixel = (lat: number, lng: number, canvasWidth: number, canvasHeight: number) => {
    const scale = Math.pow(2, currentZoom);
    const worldWidth = canvasWidth;
    const worldHeight = canvasHeight;

    // Mercator projection
    const x = ((lng + 180) / 360) * worldWidth * scale;
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = (worldHeight / 2) - (worldHeight * mercN) / (2 * Math.PI) * scale;

    // Center on current view
    const centerX = ((currentCenter[1] + 180) / 360) * worldWidth * scale;
    const centerLatRad = (currentCenter[0] * Math.PI) / 180;
    const centerMercN = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));
    const centerY = (worldHeight / 2) - (worldHeight * centerMercN) / (2 * Math.PI) * scale;

    return {
      x: x - centerX + canvasWidth / 2,
      y: y - centerY + canvasHeight / 2,
    };
  };

  // Convert pixel coordinates to lat/lng
  const pixelToLatLng = (x: number, y: number, canvasWidth: number, canvasHeight: number) => {
    const scale = Math.pow(2, currentZoom);
    const worldWidth = canvasWidth;
    const worldHeight = canvasHeight;

    const centerX = ((currentCenter[1] + 180) / 360) * worldWidth * scale;
    const centerLatRad = (currentCenter[0] * Math.PI) / 180;
    const centerMercN = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));
    const centerY = (worldHeight / 2) - (worldHeight * centerMercN) / (2 * Math.PI) * scale;

    const worldX = x + centerX - canvasWidth / 2;
    const worldY = y + centerY - canvasHeight / 2;

    const lng = (worldX / (worldWidth * scale)) * 360 - 180;
    const mercN = (worldHeight / 2 - worldY) * (2 * Math.PI) / (worldHeight * scale);
    const latRad = 2 * Math.atan(Math.exp(mercN)) - Math.PI / 2;
    const lat = (latRad * 180) / Math.PI;

    return { lat, lng };
  };

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background (map tiles simulation)
    const gridSize = 50;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, width, height);

    // Draw grid to simulate map
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw polygons
    polygons.forEach((polygon) => {
      if (polygon.coordinates.length < 2) return;

      ctx.beginPath();
      polygon.coordinates.forEach((coord, i) => {
        const pixel = latLngToPixel(coord[0], coord[1], width, height);
        if (i === 0) {
          ctx.moveTo(pixel.x, pixel.y);
        } else {
          ctx.lineTo(pixel.x, pixel.y);
        }
      });
      ctx.closePath();

      // Fill
      ctx.fillStyle = polygon.fillColor || '#78A64A';
      ctx.globalAlpha = polygon.fillOpacity || 0.3;
      ctx.fill();

      // Stroke
      ctx.globalAlpha = 1;
      ctx.strokeStyle = polygon.color || '#78A64A';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw points
      polygon.coordinates.forEach((coord) => {
        const pixel = latLngToPixel(coord[0], coord[1], width, height);
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = polygon.color || '#78A64A';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // Draw markers
    markers.forEach((marker, index) => {
      const pixel = latLngToPixel(marker.position[0], marker.position[1], width, height);

      // Draw marker circle
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = marker.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw label if selected
      if (selectedMarker === index && marker.label) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        const padding = 8;
        const textWidth = ctx.measureText(marker.label).width;
        const boxX = pixel.x - textWidth / 2 - padding;
        const boxY = pixel.y - 40;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 24;

        // Draw popup box
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw text
        ctx.fillStyle = '#333333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(marker.label, pixel.x, boxY + 16);
      }
    });

    // Add attribution
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(0, height - 20, 150, 20);
    ctx.fillStyle = '#333333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('© OpenStreetMap', 5, height - 6);
  }, [currentCenter, currentZoom, polygons, markers, selectedMarker]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on a marker
    let clickedMarker = false;
    markers.forEach((marker, index) => {
      const pixel = latLngToPixel(marker.position[0], marker.position[1], canvas.width, canvas.height);
      const distance = Math.sqrt(Math.pow(x - pixel.x, 2) + Math.pow(y - pixel.y, 2));
      if (distance < 12) {
        setSelectedMarker(index === selectedMarker ? null : index);
        clickedMarker = true;
      }
    });

    // If not clicked on marker and onMapClick is provided
    if (!clickedMarker && onMapClick) {
      const latLng = pixelToLatLng(x, y, canvas.width, canvas.height);
      onMapClick(latLng.lat, latLng.lng);
    }
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update center when prop changes
  useEffect(() => {
    setCurrentCenter(center);
  }, [center]);

  const handleZoomIn = () => {
    setCurrentZoom((z) => Math.min(z + 1, 18));
  };

  const handleZoomOut = () => {
    setCurrentZoom((z) => Math.max(z - 1, 2));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair"
        style={{ display: 'block' }}
      />
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 space-y-2 z-10">
        <button
          onClick={handleZoomIn}
          className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100"
        >
          <ZoomIn className="w-5 h-5 text-[var(--deep-forest)]" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100"
        >
          <ZoomOut className="w-5 h-5 text-[var(--deep-forest)]" />
        </button>
      </div>
    </div>
  );
};
