"use client";

import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function RouteMap({ routePath }: { routePath: { lat: number; lng: number }[] }) {
  if (!routePath || routePath.length === 0) return null;

  // Convert our Firebase {lat, lng} format to Leaflet's expected [lat, lng] array format
  const positions = routePath.map(pos => [pos.lat, pos.lng] as [number, number]);
  
  // Center the map thumbnail exactly where the run started
  const center = positions[0];

  return (
    <div className="w-full h-full z-0">
      <MapContainer 
        center={center} 
        zoom={15} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={false} // Hides the +/- buttons for a clean thumbnail look
        attributionControl={false}
        dragging={false} // Locks the map so it behaves like a static image in the feed
        scrollWheelZoom={false}
        doubleClickZoom={false}
      >
        {/* The Premium Dark Mode Map Tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* The Glowing Strava Line */}
        <Polyline 
          positions={positions} 
          pathOptions={{ 
            color: "#3b82f6", // Bright blue
            weight: 4, 
            opacity: 0.9, 
            lineCap: "round", 
            lineJoin: "round" 
          }} 
        />
      </MapContainer>
    </div>
  );
}
