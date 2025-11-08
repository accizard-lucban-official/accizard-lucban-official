/**
 * Mapbox Map Component
 * 
 * Features:
 * - Interactive map with custom markers and icons
 * - Type-specific markers with emoji icons and color coding
 * - Toggleable map legend modal showing all marker types
 * - Click to show popups with location details
 * - Travel time and route calculation from user's location
 * - Geocoder for location search
 * - Stable marker rendering without hover effects
 * 
 * Marker Icons (Accident/Hazard Types):
 * - 🚗 Road Crash (Red)
 * - 🔥 Fire (Orange)
 * - 🚑 Medical Emergency (Pink)
 * - 🌊 Flooding (Blue)
 * - 🌋 Volcanic Activity (Amber)
 * - ⛰️ Landslide (Brown)
 * - ⚠️ Earthquake (Dark Red)
 * - 👥 Civil Disturbance (Violet)
 * - 🛡️ Armed Conflict (Darker Red)
 * - 🦠 Infectious Disease (Emerald)
 * 
 * Marker Icons (Emergency Facilities):
 * - 🏢 Evacuation Centers (Purple)
 * - 🏥 Health Facilities (Green)
 * - 🚔 Police Stations (Blue)
 * - 🚒 Fire Stations (Dark Red)
 * - 🏛️ Government Offices (Indigo)
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // Required for proper marker positioning
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Info, Layers } from 'lucide-react';
import { ensureOk } from '@/lib/utils';
import { Pin } from '@/types/pin';

// Use the custom Mapbox access token for AcciZard Lucban
mapboxgl.accessToken = 'pk.eyJ1IjoiYWNjaXphcmQtbHVjYmFuLW9mZmljaWFsIiwiYSI6ImNtaG93dTA2aDBnMG8ydm9vemd6a29sNzIifQ.j1N_NloJE19I2Mk4X3J2KA';

// Custom Mapbox Control for Legend
class LegendControl {
  private _container: HTMLDivElement;
  private _onClick: () => void;

  constructor(onClick: () => void) {
    this._onClick = onClick;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    this._updateButton();
  }

  private _updateButton() {
    this._container.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon';
    button.type = 'button';
    button.title = 'Show map legend';
    button.setAttribute('aria-label', 'Show map legend');
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    
    // Create SVG icon (Info icon)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '12');
    line1.setAttribute('y1', '16');
    line1.setAttribute('x2', '12');
    line1.setAttribute('y2', '12');
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '12');
    line2.setAttribute('y1', '8');
    line2.setAttribute('x2', '12.01');
    line2.setAttribute('y2', '8');
    
    svg.appendChild(circle);
    svg.appendChild(line1);
    svg.appendChild(line2);
    
    button.appendChild(svg);
    button.onclick = () => {
      this._onClick();
    };
    
    this._container.appendChild(button);
  }

  onAdd(map: mapboxgl.Map) {
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
  }
}

// Custom Mapbox Control for Style Toggle
class StyleToggleControl {
  private _container: HTMLDivElement;
  private _currentStyle: 'streets' | 'satellite';
  private _onStyleChange: (style: 'streets' | 'satellite') => void;

  constructor(currentStyle: 'streets' | 'satellite', onStyleChange: (style: 'streets' | 'satellite') => void) {
    this._currentStyle = currentStyle;
    this._onStyleChange = onStyleChange;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    this._updateButton();
  }

  private _updateButton() {
    this._container.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-icon';
    button.type = 'button';
    button.title = `Switch to ${this._currentStyle === 'streets' ? 'Satellite' : 'Streets'} view`;
    button.setAttribute('aria-label', `Switch to ${this._currentStyle === 'streets' ? 'Satellite' : 'Streets'} view`);
    
    // Create SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    
    if (this._currentStyle === 'streets') {
      // Satellite icon (grid)
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'M3 3h18v18H3z');
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('d', 'M3 12h18');
      const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path3.setAttribute('d', 'M12 3v18');
      svg.appendChild(path1);
      svg.appendChild(path2);
      svg.appendChild(path3);
    } else {
      // Streets icon (search/map)
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '11');
      circle.setAttribute('cy', '11');
      circle.setAttribute('r', '8');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm21 21-4.35-4.35');
      svg.appendChild(circle);
      svg.appendChild(path);
    }
    
    button.appendChild(svg);
    button.onclick = () => {
      const newStyle = this._currentStyle === 'streets' ? 'satellite' : 'streets';
      this._currentStyle = newStyle;
      this._onStyleChange(newStyle);
      this._updateButton();
    };
    
    this._container.appendChild(button);
  }

  onAdd(map: mapboxgl.Map) {
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
  }

  updateStyle(newStyle: 'streets' | 'satellite') {
    this._currentStyle = newStyle;
    this._updateButton();
  }
}

interface Marker {
  id: string;
  type: string;
  title: string;
  description: string;
  reportId?: string;
  coordinates: [number, number];
  status?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

interface MapboxMapProps {
  onMapClick?: (lngLat: { lng: number; lat: number }, event?: mapboxgl.MapMouseEvent) => void;
  showHeatmap?: boolean;
  center?: [number, number];
  zoom?: number;
  activeFilters?: {
    accidentTypes?: string[];
    facilityTypes?: string[];
    layerFilters?: {
      barangay?: boolean;
      barangayLabel?: boolean;
      roadNetwork?: boolean;
      waterways?: boolean;
      traffic?: boolean;
    };
  };
  singleMarker?: Marker;
  pins?: Pin[]; // Array of pins from database to display
  showOnlyCurrentLocation?: boolean;
  clickedLocation?: { lat: number; lng: number; address: string } | null;
  showGeocoder?: boolean;
  onGeocoderResult?: (result: { lat: number; lng: number; address: string }) => void;
  showDirections?: boolean; // Control whether to show routes and travel time
  onEditPin?: (pin: Pin) => void; // Callback when edit button is clicked
  onDeletePin?: (pinId: string) => void; // Callback when delete button is clicked
  canEdit?: boolean; // Whether user can edit/delete pins
  showControls?: boolean; // Show built-in mapbox navigation controls
  hideStyleToggle?: boolean; // Hide the internal style toggle button (for use in parent toolbars)
  onStyleChange?: (style: 'streets' | 'satellite') => void; // Callback when style changes
  externalStyle?: 'streets' | 'satellite'; // External style control
  // When true, removes glow/pulse from single marker
  disableSingleMarkerPulse?: boolean;
  onLegendClick?: () => void; // Callback when legend button is clicked
  isAddPlacemarkMode?: boolean; // When true, shows marker cursor and allows placing placemarks
}

// Sample data for markers - currently empty, will be populated from database
const sampleMarkers: Marker[] = [];

// Helper function to parse coordinates
const parseCoordinates = (coordinateString: string): [number, number] => {
  if (!coordinateString) return [121.5556, 14.1139]; // Default to Lucban, Quezon
  
  const coords = coordinateString.split(',').map(coord => parseFloat(coord.trim()));
  
  if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
    console.warn('Invalid coordinates:', coordinateString);
    return [121.5556, 14.1139]; // Default to Lucban, Quezon
  }
  
  // Ensure coordinates are in [longitude, latitude] format
  // If latitude > longitude, they might be swapped
  if (Math.abs(coords[0]) > 90 && Math.abs(coords[1]) <= 90) {
    // Likely swapped, so swap them back
    return [coords[1], coords[0]];
  }
  
  return [coords[0], coords[1]];
};

export function MapboxMap({ 
  onMapClick, 
  showHeatmap = false,
  center = [121.5556, 14.1139], // Lucban, Quezon
  zoom = 14,
  activeFilters,
  singleMarker,
  pins = [],
  showOnlyCurrentLocation = false,
  clickedLocation = null,
  showGeocoder = false,
  onGeocoderResult,
  showDirections = true, // Default to true for backward compatibility
  onEditPin,
  onDeletePin,
  canEdit = false, // Default to false for safety
  showControls = false, // Default to false for backward compatibility
  hideStyleToggle = false, // Default to false
  onStyleChange, // Optional callback
  externalStyle, // Optional external control
  disableSingleMarkerPulse = false,
  onLegendClick, // Optional callback for legend button
  isAddPlacemarkMode = false // Optional add placemark mode
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const tilesetHoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const geocoderRef = useRef<MapboxGeocoder | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [travelTime, setTravelTime] = useState<{duration: number, distance: number} | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const styleToggleControlRef = useRef<StyleToggleControl | null>(null);
  const legendControlRef = useRef<LegendControl | null>(null);
  const cursorElementRef = useRef<HTMLDivElement | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const mapClickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  
  // Use external style if provided, otherwise use internal state
  const currentStyle = externalStyle || mapStyle;

  // Keep onMapClick ref updated
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  
  // Handle style change
  const handleStyleChange = (newStyle: 'streets' | 'satellite') => {
    setMapStyle(newStyle);
    if (onStyleChange) {
      onStyleChange(newStyle);
    }
    // Update control button if it exists
    if (styleToggleControlRef.current) {
      styleToggleControlRef.current.updateStyle(newStyle);
    }
  };


  // Function to get marker icon based on type
  const getMarkerIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      // Default marker
      'Default': '📍',
      // Accident/Hazard Types
      'Road Crash': '🚗',
      'Fire': '🔥',
      'Medical Emergency': '🚑',
      'Flooding': '🌊',
      'Volcanic Activity': '🌋',
      'Landslide': '⛰️',
      'Earthquake': '⚠️',
      'Civil Disturbance': '👥',
      'Armed Conflict': '🛡️',
      'Infectious Disease': '🦠',
      // Emergency Facilities
      'Evacuation Centers': '🏢',
      'Health Facilities': '🏥',
      'Police Stations': '🚔',
      'Fire Stations': '🚒',
      'Government Offices': '🏛️'
    };
    
    return iconMap[type] || '📍';
  };

  // Function to get marker color based on type
  const getMarkerColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      // Default marker
      'Default': '#6B7280', // Gray-500
      // Accident/Hazard Types
      'Road Crash': '#EF4444', // Red
      'Fire': '#F97316', // Orange
      'Medical Emergency': '#EC4899', // Pink
      'Flooding': '#3B82F6', // Blue
      'Volcanic Activity': '#F59E0B', // Amber
      'Landslide': '#78350F', // Brown
      'Earthquake': '#DC2626', // Dark Red
      'Civil Disturbance': '#7C3AED', // Violet
      'Armed Conflict': '#991B1B', // Darker Red
      'Infectious Disease': '#059669', // Emerald
      'Others': '#F97316', // Orange (matches default marker color)
      // Emergency Facilities
      'Evacuation Centers': '#8B5CF6', // Purple
      'Health Facilities': '#10B981', // Green
      'Police Stations': '#3B82F6', // Blue
      'Fire Stations': '#DC2626', // Dark Red
      'Government Offices': '#6366F1' // Indigo
    };
    
    return colorMap[type] || '#6B7280';
  };

  // Function to get marker image URL based on type
  const getMarkerImageUrl = (type: string): string => {
    // Map each type to a custom marker image
    const markerImages: Record<string, string> = {
      // Accident/Hazard Types
      'Road Crash': '/markers/road-crash.svg',
      'Fire': '/markers/fire.svg',
      'Medical Emergency': '/markers/medical-emergency.svg',
      'Flooding': '/markers/flooding.svg',
      'Volcanic Activity': '/markers/volcano.svg',
      'Landslide': '/markers/landslide.svg',
      'Earthquake': '/markers/earthquake.svg',
      'Civil Disturbance': '/markers/civil-disturbance.svg',
      'Armed Conflict': '/markers/armed-conflict.svg',
      'Infectious Disease': '/markers/infectious-disease.svg',
      'Others': '/markers/default.svg',
      // Emergency Facilities
      'Evacuation Centers': '/markers/evacuation-center.svg',
      'Health Facilities': '/markers/health-facility.svg',
      'Police Stations': '/markers/police-station.svg',
      'Fire Stations': '/markers/fire-station.svg',
      'Government Offices': '/markers/government-office.svg',
      // Default
      'Default': '/markers/default.svg'
    };
    
    return markerImages[type] || markerImages['Default'];
  };

  // Function to create a marker element with icon
  const createMarkerElement = (type: string, isSingleMarker = false, enablePulse: boolean = true) => {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    // Optimal sizes: 48px for featured markers, 38px for regular markers
    const size = isSingleMarker ? 48 : 38;
    
    // CRITICAL: Set dimensions with min-width/min-height to prevent collapse during zoom
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.minWidth = `${size}px`;
    el.style.minHeight = `${size}px`;
    el.style.position = 'relative';
    el.style.willChange = 'transform'; // Optimize for transform operations during zoom
    
    // Create image element for the marker icon
    const img = document.createElement('img');
    img.src = getMarkerImageUrl(type);
    img.alt = type;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    img.style.objectFit = 'contain';
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    
    // Fallback: if image fails to load, use default.svg
    img.onerror = () => {
      console.warn(`Failed to load marker image for ${type}, using default.svg fallback`);
      img.src = '/markers/default.svg';
      img.onerror = null; // Prevent infinite loop if default.svg also fails
    };
    
    el.style.cursor = 'pointer';
    
    // Add the image to the container
    el.appendChild(img);
    
    // No hover effects to prevent positioning issues
    
    // Add a pulsing animation for single markers
    if (isSingleMarker && enablePulse) {
      el.style.animation = 'pulse 2s infinite';
      el.style.filter = 'drop-shadow(0 0 8px rgba(255, 79, 11, 0.6))';
    }
    
    return el;
  };

  // Function to create popup content
  const createPopupContent = (marker: Marker, showActions: boolean = false) => {
    return `
      <div class="p-3 min-w-[220px] max-w-[300px] overflow-hidden">
        <h3 class="font-bold text-lg mb-2 text-gray-800 break-words leading-tight">${marker.title}</h3>
        
        <div class="space-y-2 text-sm overflow-hidden">
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              ${marker.type}
            </span>
          </div>
          
          ${marker.locationName ? `
            <div class="flex items-start gap-2">
              <span class="font-medium text-gray-700 flex-shrink-0 mt-0.5">Location:</span>
              <span class="text-gray-600 break-words leading-relaxed">${marker.locationName}</span>
            </div>
          ` : ''}
          
          ${marker.latitude !== undefined && marker.longitude !== undefined ? `
            <div class="flex items-start gap-2">
              <span class="font-medium text-gray-700 flex-shrink-0 mt-0.5">Coordinates:</span>
              <span class="text-gray-600 font-mono text-xs break-all">
                ${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}
              </span>
            </div>
          ` : ''}
          
          ${marker.reportId ? `
            <div class="mt-2 pt-2 border-t border-gray-200">
              <span class="text-xs text-gray-500">Linked to Report #${marker.reportId}</span>
            </div>
          ` : ''}
        </div>
        
        ${showActions && canEdit ? `
          <div class="flex gap-2 pt-3 mt-3 border-t border-gray-200">
            <button 
              onclick="window.handleEditPin && window.handleEditPin('${marker.id}')"
              class="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 flex items-center justify-center gap-1 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Edit
            </button>
            <button 
              onclick="window.handleDeletePin && window.handleDeletePin('${marker.id}')"
              class="flex-1 bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 flex items-center justify-center gap-1 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete
            </button>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Function to create hover popup content (simpler info-only version)
  const createHoverPopupContent = (pin: Pin | Marker) => {
    const description = 'description' in pin ? pin.description : undefined;
    const locationName = 'locationName' in pin ? pin.locationName : (pin.description || '');
    const latitude = 'latitude' in pin ? pin.latitude : (pin.coordinates?.[1] || 0);
    const longitude = 'longitude' in pin ? pin.longitude : (pin.coordinates?.[0] || 0);
    
    return `
      <div class="min-w-[240px] max-w-[320px]">
        <!-- Header Section -->
        <div class="px-4 pt-3 pb-2.5 border-b border-gray-200 bg-gray-50/50">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide" style="background-color: rgba(249, 115, 22, 0.1); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2);">
              ${pin.type}
            </span>
          </div>
          <h4 class="text-base font-bold text-gray-900 break-words leading-tight pr-2">${pin.title}</h4>
        </div>
        
        <!-- Content Section -->
        <div class="px-4 py-3 space-y-3 text-sm">
          ${description ? `
            <div class="space-y-1">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</div>
              <div class="text-gray-700 break-words leading-relaxed">${description}</div>
            </div>
          ` : ''}
          
          ${locationName ? `
            <div class="space-y-1 ${description ? 'pt-1 border-t border-gray-100' : ''}">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</div>
              <div class="text-gray-700 break-words leading-relaxed text-sm">${locationName}</div>
            </div>
          ` : ''}
          
          <div class="space-y-1 ${(description || locationName) ? 'pt-1 border-t border-gray-100' : ''}">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coordinates</div>
            <div class="text-gray-600 font-mono text-xs break-all leading-relaxed">
              ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Function to get user's current location
  const getUserLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Function to calculate travel time using Mapbox Directions API
  const calculateTravelTime = async (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => {
    try {
      const accessToken = mapboxgl.accessToken;
      if (!accessToken) {
        throw new Error('Mapbox access token not available');
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${accessToken}&geometries=geojson&overview=full&steps=true&annotations=duration,distance`;
      
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const totalMinutes = Math.round(route.duration / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        // Format time display
        let timeDisplay;
        if (hours > 0) {
          timeDisplay = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        } else {
          timeDisplay = `${minutes}m`;
        }
        
        return {
          duration: timeDisplay,
          totalMinutes: totalMinutes,
          distance: Math.round(route.distance / 1000 * 10) / 10, // Convert meters to kilometers
          routeData: data // Return full route data for display
        };
      } else {
        throw new Error('No routes found');
      }
    } catch (error: any) {
      console.error('Error calculating travel time:', error);
      return null;
    }
  };

  // Function to reverse geocode coordinates to get location name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const accessToken = mapboxgl.accessToken;
      if (!accessToken) {
        throw new Error('Mapbox access token not available');
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=address,poi,place,locality,neighborhood`;
      
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      
      if (data.features && data.features.length > 0) {
        // Try to get the most specific address first, then fall back to place names
        const feature = data.features[0];
        const placeName = feature.place_name || feature.text || 'Unknown Location';
        return placeName;
      } else {
        return 'Unknown Location';
      }
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      return 'Unknown Location';
    }
  };

  // Function to display route on map
  const displayRoute = (routeData: any) => {
    if (!map.current || !routeData) return;

    // Remove existing route if any
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add route source
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: routeData.routes[0].geometry
      }
    });

    // Add route layer
    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#FF4F0B',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    // Fit map to route bounds
    const coordinates = routeData.routes[0].geometry.coordinates;
    const bounds = coordinates.reduce((bounds: any, coord: any) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    map.current.fitBounds(bounds, {
      padding: 50
    });
  };

  // Function to create popup content with travel time
  const createPopupContentWithTravelTime = async (marker: Marker) => {
    let travelTimeInfo = '';
    
    if (userLocation && marker.latitude && marker.longitude) {
      const travelData = await calculateTravelTime(
        userLocation,
        { lat: marker.latitude, lng: marker.longitude }
      );
      
      if (travelData) {
        // Store route data and display route automatically
        setRouteData(travelData.routeData);
        setShowRoute(true);
        displayRoute(travelData.routeData);
        
        travelTimeInfo = `
          <div class="mt-3 pt-3 border-t border-gray-300">
            <div class="flex items-center gap-2 mb-1">
              <svg class="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span class="text-sm font-medium text-gray-700">Travel time</span>
            </div>
            <div class="text-xs text-gray-500 ml-6">${travelData.duration} (${travelData.distance} km)</div>
          </div>
        `;
      }
    }

    // Get geocoded location name from coordinates
    let locationName = marker.locationName || marker.title;
    if (marker.latitude && marker.longitude) {
      try {
        const geocodedName = await reverseGeocode(marker.latitude, marker.longitude);
        locationName = geocodedName;
      } catch (error) {
        console.error('Error getting geocoded location name:', error);
        // Fall back to original location name if geocoding fails
      }
    }

    return `
      <div class="w-[200px]">
        <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Report Details</h4>
        </div>
        <div class="p-3">
          <div class="flex items-start gap-2 mb-2">
            <svg class="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <div class="min-w-0 flex-1">
              <span class="text-sm font-medium text-gray-900 break-words leading-tight block">${locationName}</span>
              <span class="text-xs text-gray-500 font-mono block mt-1">${marker.latitude?.toFixed(6)}, ${marker.longitude?.toFixed(6)}</span>
            </div>
          </div>
          
          ${travelTimeInfo}
        </div>
      </div>
    `;
  };

  // Set up global event handlers for popup actions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).handleEditPin = (pinId: string) => {
        const pin = pins.find(p => p.id === pinId);
        if (pin && onEditPin) {
          onEditPin(pin);
        }
      };

      (window as any).handleDeletePin = (pinId: string) => {
        if (onDeletePin) {
          onDeletePin(pinId);
        }
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).handleEditPin;
        delete (window as any).handleDeletePin;
      }
    };
  }, [pins, onEditPin, onDeletePin]);

  // Get user's current location on component mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const location = await getUserLocation();
        setUserLocation(location);
      } catch (error) {
        console.error('Error getting user location:', error);
        // Don't set error state, just log it - travel time will be unavailable
      }
    };

    getLocation();
  }, []);

  // Initialize map
  useEffect(() => {
    const initializeMap = () => {
      if (!mapContainer.current) {
        return;
      }

      // Check if Mapbox access token is available
      if (!mapboxgl.accessToken) {
        setMapError('Mapbox access token is not configured');
        return;
      }

      // Set a timeout to handle cases where map doesn't load
      const loadTimeout = setTimeout(() => {
        if (!mapLoaded) {
          setMapError('Map failed to load within timeout');
        }
      }, 10000); // 10 second timeout

      try {
        // Clean up existing map
        if (map.current) {
          map.current.remove();
          map.current = null;
        }

        const styleUrl = currentStyle === 'streets' 
          ? 'mapbox://styles/accizard-lucban-official/cmhox8ita005o01sr1psmbgp6'
          : 'mapbox://styles/mapbox/satellite-v9';
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: styleUrl,
          center: center,
          zoom: zoom  
        });

        // Add built-in controls if enabled
        if (showControls) {
          // Add navigation controls (zoom in/out, rotate, pitch) at bottom-right
          map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
          
          // Add geolocate control (current location button) at bottom-right
          map.current.addControl(
            new mapboxgl.GeolocateControl({
              positionOptions: {
                enableHighAccuracy: true
              },
              trackUserLocation: true,
              showUserHeading: true
            }),
            'bottom-right'
          );
        }

        // Add legend control if callback provided
        if (onLegendClick) {
          legendControlRef.current = new LegendControl(onLegendClick);
          map.current.addControl(legendControlRef.current, 'bottom-right');
        }

        // Add geocoder if enabled
        if (showGeocoder) {
          const geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            marker: false, // We'll handle markers ourselves
            placeholder: 'Search for a location, institution, or facility...',
            // Philippines bounding box: minLon, minLat, maxLon, maxLat
            bbox: [116.0, 4.0, 127.0, 21.5],
            proximity: { longitude: 121.5569, latitude: 14.1133 }, // Lucban, Quezon
            countries: 'ph', // Limit to Philippines
            types: 'place,locality,neighborhood,address,poi,region,district',
            language: 'en',
            limit: 5,
            minLength: 2,
            autocomplete: true,
            fuzzyMatch: true
          });

          // Add geocoder to map
          map.current.addControl(geocoder, 'top-left');
          geocoderRef.current = geocoder;

          // Handle geocoder result
          geocoder.on('result', async (e) => {
            const result = e.result;
            const coordinates = result.geometry.coordinates;
            const address = result.place_name || result.text || 'Selected location';
            
            // Center the map on the selected location
            if (map.current) {
              map.current.flyTo({
                center: coordinates,
                zoom: 16, // Zoom in closer to the selected location
                essential: true
              });
            }

            // Display route if user location is available and directions are enabled
            if (showDirections && userLocation && map.current) {
              try {
                const routeData = await calculateTravelTime(
                  { lat: userLocation.lat, lng: userLocation.lng },
                  { lat: coordinates[1], lng: coordinates[0] }
                );
                
                if (routeData && routeData.routeData) {
                  setRouteData(routeData.routeData);
                  setShowRoute(true);
                  displayRoute(routeData.routeData);
                }
              } catch (error) {
                console.error('Error calculating route:', error);
              }
            }
            
            if (onGeocoderResult) {
              onGeocoderResult({
                lng: coordinates[0],
                lat: coordinates[1],
                address: address
              });
            }
          });
        }

        map.current.on('load', () => {
          clearTimeout(loadTimeout);
          setMapLoaded(true);
          setMapError(null);

          // Hide all layers except lucban-boundary on initial load
          const allLayers = map.current.getStyle().layers;
          allLayers.forEach((layer: any) => {
            try {
              // Keep lucban-boundary visible, hide everything else
              if (layer.id !== 'lucban-boundary') {
                if (map.current && map.current.getLayer(layer.id)) {
                  map.current.setLayoutProperty(layer.id, 'visibility', 'none');
                }
              }
            } catch (error) {
              // Some layers might not support visibility property, skip them
              console.warn(`Could not hide layer ${layer.id}:`, error);
            }
          });

          // Add traffic source and layer (similar to dashboard) - only for streets style
          if (currentStyle === 'streets') {
            if (!map.current.getSource('mapbox-traffic')) {
              map.current.addSource('mapbox-traffic', {
                type: 'vector',
                url: 'mapbox://mapbox.mapbox-traffic-v1'
              });
            }

            // Add traffic layer (hidden by default)
            if (!map.current.getLayer('traffic')) {
              map.current.addLayer({
                id: 'traffic',
                type: 'line',
                source: 'mapbox-traffic',
                'source-layer': 'traffic',
                paint: {
                  'line-width': 2,
                  'line-color': [
                    'case',
                    ['==', ['get', 'congestion'], 'low'], '#4ade80',
                    ['==', ['get', 'congestion'], 'moderate'], '#fbbf24',
                    ['==', ['get', 'congestion'], 'heavy'], '#f87171',
                    ['==', ['get', 'congestion'], 'severe'], '#dc2626',
                    '#94a3b8'
                  ]
                },
                layout: {
                  'visibility': 'none'
                }
              });
            }
          }
        });

        map.current.on('error', (e) => {
          // Map error handled by error state
          clearTimeout(loadTimeout);
          setMapError('Failed to load map');
        });

        // Set up click handler
        const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
          // Only center and zoom if directions are enabled
          if (showDirections) {
            // Center the map on the clicked location
            map.current.flyTo({
              center: [e.lngLat.lng, e.lngLat.lat],
              zoom: 12, // Zoom in closer to the clicked location
              essential: true
            });

            // Display route if user location is available
            if (userLocation) {
              try {
                const routeData = await calculateTravelTime(
                  { lat: userLocation.lat, lng: userLocation.lng },
                  { lat: e.lngLat.lat, lng: e.lngLat.lng }
                );
                
                if (routeData && routeData.routeData) {
                  setRouteData(routeData.routeData);
                  setShowRoute(true);
                  displayRoute(routeData.routeData);
                }
              } catch (error) {
                console.error('Error calculating route:', error);
              }
            }
          }
          
          // Call the callback using ref to get latest version
          if (onMapClickRef.current) {
            onMapClickRef.current(e.lngLat, e);
          }
        };

        // Store handler in ref for cleanup
        mapClickHandlerRef.current = handleMapClick;

        if (onMapClick) {
          map.current.on('click', handleMapClick);
        }

        return () => {
          clearTimeout(loadTimeout);
          if (map.current) {
            // Remove click listener
            if (mapClickHandlerRef.current) {
              map.current.off('click', mapClickHandlerRef.current);
              mapClickHandlerRef.current = null;
            }
            if (geocoderRef.current) {
              geocoderRef.current = null;
            }
            map.current.remove();
            map.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing map:', error);
        clearTimeout(loadTimeout);
        setMapError('Failed to initialize map');
      }
    };

    // Use a small delay to ensure the container is properly rendered
    const timer = setTimeout(initializeMap, 100);

    return () => {
      clearTimeout(timer);
      if (map.current) {
        // Remove legend control before removing map
        if (legendControlRef.current) {
          try {
            map.current.removeControl(legendControlRef.current);
          } catch (e) {
            // Control might not be added yet
          }
          legendControlRef.current = null;
        }
        // Remove style toggle control before removing map
        if (styleToggleControlRef.current) {
          try {
            map.current.removeControl(styleToggleControlRef.current);
          } catch (e) {
            // Control might not be added yet
          }
          styleToggleControlRef.current = null;
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, [currentStyle]); // Re-initialize when map style changes

  // Handle center and zoom changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Don't auto-center if we're in location selection mode (showOnlyCurrentLocation)
    // This allows the map to stay centered on user-selected locations
    if (showOnlyCurrentLocation) {
      return;
    }

    // Use flyTo for smooth animation
    map.current.flyTo({
      center: center,
      zoom: zoom,
      essential: true,
      duration: 1500 // 1.5 second animation
    });
  }, [center, zoom, mapLoaded, showOnlyCurrentLocation]);

  // Handle markers and popups
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Clear hover popup if it exists
    if (hoverPopupRef.current) {
      hoverPopupRef.current.remove();
      hoverPopupRef.current = null;
    }
    
    if (popupRef.current) {
      popupRef.current.remove();
    }

    // Handle single marker (from database)
    if (singleMarker) {
      console.log("=== RENDERING SINGLE MARKER ===");
      console.log("Single marker data:", singleMarker);
      console.log("Coordinates:", singleMarker.coordinates);
      
      // Validate coordinates
      const [lng, lat] = singleMarker.coordinates;
      console.log("Parsed coordinates - lng:", lng, "lat:", lat);
      if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        console.error("Invalid coordinates - lng:", lng, "lat:", lat);
        return;
      }
      
      console.log("Coordinates valid, creating marker element...");
      // Create custom marker element
      const el = createMarkerElement(singleMarker.type, true, !disableSingleMarkerPulse);
      console.log("Marker element created, adding to map...");
      
      // Create Mapbox marker with custom element
      const markerInstance = new mapboxgl.Marker({
        element: el,
        anchor: 'center' // Anchor point is center of the element
      })
      .setLngLat(singleMarker.coordinates)
      .addTo(map.current);
      
      console.log("Marker added to map at:", singleMarker.coordinates);
      console.log("Marker instance:", markerInstance);
      console.log("Map current:", map.current);
      markersRef.current.push(markerInstance);
      
      
      // Add click event to show popup
      el.addEventListener('click', async () => {
        if (popupRef.current) {
          popupRef.current.remove();
        }

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: true,
          className: 'custom-popup',
          maxWidth: '200px'
        })
        .setLngLat(singleMarker.coordinates)
        .setHTML(showDirections ? await createPopupContentWithTravelTime(singleMarker) : createPopupContent(singleMarker))
        .addTo(map.current);

        popupRef.current = popup;
      });
      

      // Add current location marker if available and not showing only current location
      if (userLocation && !showOnlyCurrentLocation) {
        
        const currentLocationEl = document.createElement('div');
        currentLocationEl.className = 'current-location-marker';
        currentLocationEl.style.width = '24px';
        currentLocationEl.style.height = '24px';
        currentLocationEl.style.backgroundColor = '#3B82F6';
        currentLocationEl.style.borderRadius = '50%';
        currentLocationEl.style.border = '3px solid white';
        currentLocationEl.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.6)';
        currentLocationEl.style.cursor = 'pointer';
        currentLocationEl.title = 'Your current location';

        const currentLocationMarker = new mapboxgl.Marker({
          element: currentLocationEl,
          anchor: 'center'
        })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);

        markersRef.current.push(currentLocationMarker);
      }

      // Add clicked location marker if provided
      if (clickedLocation) {
        const clickedLocationEl = document.createElement('div');
        clickedLocationEl.className = 'clicked-location-marker';
        clickedLocationEl.style.width = '28px';
        clickedLocationEl.style.height = '28px';
        clickedLocationEl.style.backgroundColor = '#f97316'; // brand-orange
        clickedLocationEl.style.borderRadius = '50%';
        clickedLocationEl.style.border = '3px solid white';
        clickedLocationEl.style.boxShadow = '0 0 12px rgba(249, 115, 22, 0.6)'; // brand-orange with opacity
        clickedLocationEl.style.cursor = 'pointer';
        clickedLocationEl.title = 'Selected location';

        const clickedLocationMarker = new mapboxgl.Marker({
          element: clickedLocationEl,
          anchor: 'center'
        })
        .setLngLat([clickedLocation.lng, clickedLocation.lat])
        .addTo(map.current);

        markersRef.current.push(clickedLocationMarker);

        // Add popup for clicked location
        const clickedPopup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: true,
          className: 'custom-popup',
          maxWidth: '200px'
        })
        .setLngLat([clickedLocation.lng, clickedLocation.lat])
        .setHTML(`
          <div class="w-[200px]">
            <div class="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h4 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Selected Location</h4>
            </div>
            <div class="p-3">
              <div class="flex items-start gap-2 mb-2">
                <svg class="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <div class="min-w-0 flex-1">
                  <span class="text-sm font-medium text-gray-900 break-words leading-tight block">${clickedLocation.address}</span>
                  <span class="text-xs text-gray-500 font-mono block mt-1">${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)}</span>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-gray-300">
                <div class="flex items-center gap-2 mb-1">
                  <svg class="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm font-medium text-gray-700">Travel time</span>
                </div>
                <div class="text-xs text-gray-500 ml-6" id="travel-time-${clickedLocation.lat}-${clickedLocation.lng}">Calculating...</div>
              </div>
            </div>
          </div>
        `)
        .addTo(map.current);

        // Calculate and update travel time asynchronously, and display route
        if (userLocation) {
          calculateTravelTime(
            { lat: userLocation.lat, lng: userLocation.lng },
            { lat: clickedLocation.lat, lng: clickedLocation.lng }
          ).then(travelTimeData => {
            if (travelTimeData) {
              // Update travel time display
              const travelTimeElement = document.getElementById(`travel-time-${clickedLocation.lat}-${clickedLocation.lng}`);
              if (travelTimeElement) {
                travelTimeElement.textContent = `${travelTimeData.duration} (${travelTimeData.distance} km)`;
              }
              
              // Display route automatically
              if (travelTimeData.routeData) {
                setRouteData(travelTimeData.routeData);
                setShowRoute(true);
                displayRoute(travelTimeData.routeData);
              }
            }
          }).catch(error => {
            console.error('Error calculating travel time:', error);
            const travelTimeElement = document.getElementById(`travel-time-${clickedLocation.lat}-${clickedLocation.lng}`);
            if (travelTimeElement) {
              travelTimeElement.textContent = 'Unable to calculate';
            }
          });
        }

        popupRef.current = clickedPopup;
      }

      return; // Exit early since we're showing a single marker
    }

    // Render pins from database
    if (pins && pins.length > 0) {
      
      pins.forEach(pin => {
        // Create marker element
        const el = createMarkerElement(pin.type, false, false);
        
        // Create marker instance
        const markerInstance = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map.current!);

        // Add hover event to show info popup
        el.addEventListener('mouseenter', () => {
          // Remove any existing hover popup
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
          }

          // Create hover popup
          hoverPopupRef.current = new mapboxgl.Popup({ 
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            className: 'custom-popup hover-popup',
            maxWidth: '320px'
          })
          .setLngLat([pin.longitude, pin.latitude])
          .setHTML(createHoverPopupContent(pin))
          .addTo(map.current!);
        });

        // Remove hover popup on mouse leave
        el.addEventListener('mouseleave', () => {
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
            hoverPopupRef.current = null;
          }
        });

        // Add click event to show popup
        el.addEventListener('click', async () => {
          // Remove hover popup when clicking
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
            hoverPopupRef.current = null;
          }
          
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Convert Pin to Marker format for popup
          const markerData: Marker = {
            id: pin.id,
            type: pin.type,
            title: pin.title,
            description: pin.description || pin.locationName,
            reportId: pin.reportId,
            coordinates: [pin.longitude, pin.latitude],
            locationName: pin.locationName,
            latitude: pin.latitude,
            longitude: pin.longitude
          };

          popupRef.current = new mapboxgl.Popup({ 
            offset: 25,
            closeButton: false,
            closeOnClick: true,
            className: 'custom-popup',
            maxWidth: '240px'
          })
          .setLngLat([pin.longitude, pin.latitude])
          .setHTML(showDirections ? await createPopupContentWithTravelTime(markerData) : createPopupContent(markerData, true))
          .addTo(map.current!);
        });

        markersRef.current.push(markerInstance);
      });
    }

    // Also render legacy sample markers (backward compatibility)
    const filteredMarkers = sampleMarkers.filter(marker => {
      if (!activeFilters) return true;
      
      const isAccidentType = activeFilters.accidentTypes?.includes(marker.type);
      const isFacilityType = activeFilters.facilityTypes?.includes(marker.type);
      
      return isAccidentType || isFacilityType;
    });

    // Add legacy markers
    filteredMarkers.forEach(marker => {
      const el = createMarkerElement(marker.type, false);
      const markerInstance = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(marker.coordinates)
        .addTo(map.current!);

      // Add hover event to show info popup
      el.addEventListener('mouseenter', () => {
        // Remove any existing hover popup
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
        }

        // Create hover popup
        hoverPopupRef.current = new mapboxgl.Popup({ 
          offset: [0, -10],
          closeButton: false,
          closeOnClick: false,
          className: 'custom-popup hover-popup',
          maxWidth: '320px'
        })
        .setLngLat(marker.coordinates)
        .setHTML(createHoverPopupContent(marker))
        .addTo(map.current!);
      });

      // Remove hover popup on mouse leave
      el.addEventListener('mouseleave', () => {
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }
      });

      // Add click event to marker
      el.addEventListener('click', async () => {
        // Remove hover popup when clicking
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }
        
        if (popupRef.current) {
          popupRef.current.remove();
        }

        popupRef.current = new mapboxgl.Popup({ 
          offset: [0, -10],
          closeButton: false,
          closeOnClick: true,
          className: 'custom-popup',
          maxWidth: '200px'
        })
          .setLngLat(marker.coordinates)
          .setHTML(showDirections ? await createPopupContentWithTravelTime(marker) : createPopupContent(marker))
          .addTo(map.current!);
      });

      markersRef.current.push(markerInstance);
    });
  }, [mapLoaded, activeFilters, singleMarker, pins, userLocation, showOnlyCurrentLocation, clickedLocation]);

  // Handle route display
  useEffect(() => {
    if (map.current && mapLoaded && routeData && showRoute) {
      displayRoute(routeData);
    }
  }, [mapLoaded, routeData, showRoute]);

  // Handle route display for location selection mode
  useEffect(() => {
    if (map.current && mapLoaded && routeData && showOnlyCurrentLocation) {
      displayRoute(routeData);
    }
  }, [mapLoaded, routeData, showOnlyCurrentLocation]);

  // Handle heatmap
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (showHeatmap) {
      // Convert pins to GeoJSON features
      const features = pins.map(pin => ({
        type: 'Feature' as const,
        properties: {
          type: pin.type,
          title: pin.title
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [pin.longitude, pin.latitude]
        }
      }));

      const geojsonData = {
        type: 'FeatureCollection' as const,
        features: features
      };

      // Check if source already exists
      if (map.current.getSource('heatmap')) {
        // Update existing source with new data
        const source = map.current.getSource('heatmap') as mapboxgl.GeoJSONSource;
        source.setData(geojsonData);
      } else {
        // Add new source and layer
        map.current.addSource('heatmap', {
          type: 'geojson',
          data: geojsonData
        });

        map.current.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap',
          maxzoom: 15, // Heatmap disappears at high zoom levels
          paint: {
            // Increase weight as diameter breast height increases
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              15, 1
            ],
            // Increase intensity as zoom level increases
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              15, 3
            ],
            // Color ramp for heatmap - transition from blue to red
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ],
            // Adjust the heatmap radius by zoom level
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 2,
              15, 20
            ],
            // Transition from heatmap to circle layer by zoom level
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              7, 1,
              15, 0.5
            ]
          }
        });

      }
    } else {
      // Remove heatmap layer and source when toggled off
      if (map.current.getLayer('heatmap-layer')) {
        map.current.removeLayer('heatmap-layer');
      }
      if (map.current.getSource('heatmap')) {
        map.current.removeSource('heatmap');
      }
    }
  }, [showHeatmap, mapLoaded, pins]);

  // Toggle Mapbox layers based on layerFilters
  useEffect(() => {
    if (!map.current || !mapLoaded || !activeFilters?.layerFilters) return;

    const layerFilters = activeFilters.layerFilters;

    // Helper function to toggle layer visibility
    const toggleLayer = (layerId: string, visible: boolean) => {
      try {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      } catch (error) {
        console.warn(`Could not toggle layer ${layerId}:`, error);
      }
    };

    // Toggle barangay boundaries (lucban-brgys) and fill (lucban-fill)
    // Note: lucban-boundary stays visible (not controlled by these toggles)
    const barangayVisible = layerFilters.barangay ?? false;
    toggleLayer('lucban-brgys', barangayVisible);
    toggleLayer('lucban-fill', barangayVisible); // Toggle fill layer together with boundaries

    // Toggle barangay labels (lucban-brgy-names)
    toggleLayer('lucban-brgy-names', layerFilters.barangayLabel ?? false);

    // Toggle waterways (waterway)
    toggleLayer('waterway', layerFilters.waterways ?? false);

    // Toggle road network - try common layer names
    // Note: The actual layer name may vary, common names: 'road', 'roads', 'road-network', 'highway'
    const roadLayerNames = ['road', 'roads', 'road-network', 'highway', 'road-label'];
    roadLayerNames.forEach(layerName => {
      try {
        if (map.current && map.current.getLayer(layerName)) {
          toggleLayer(layerName, layerFilters.roadNetwork ?? false);
        }
      } catch (error) {
        // Layer doesn't exist, continue
      }
    });

    // Toggle traffic layer (we create it as 'traffic')
    toggleLayer('traffic', layerFilters.traffic ?? false);
  }, [mapLoaded, activeFilters?.layerFilters]);

  // Toggle facility layers based on facility filters
  useEffect(() => {
    if (!map.current || !mapLoaded || !activeFilters?.facilityTypes) return;

    const facilityTypes = activeFilters.facilityTypes;

    // Helper function to toggle layer visibility
    const toggleLayer = (layerId: string, visible: boolean) => {
      try {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      } catch (error) {
        console.warn(`Could not toggle layer ${layerId}:`, error);
      }
    };

    // Toggle health-facilities layer
    const healthFacilitiesVisible = facilityTypes.includes('Health Facilities');
    toggleLayer('health-facilities', healthFacilitiesVisible);

    // Toggle evacuation-centers layer
    const evacuationCentersVisible = facilityTypes.includes('Evacuation Centers');
    toggleLayer('evacuation-centers', evacuationCentersVisible);
  }, [mapLoaded, activeFilters?.facilityTypes]);

  // Update style toggle control when external style changes
  useEffect(() => {
    if (styleToggleControlRef.current && externalStyle) {
      styleToggleControlRef.current.updateStyle(externalStyle);
    }
  }, [externalStyle]);

  // Function to create hover popup content for tileset features
  const createTilesetHoverPopupContent = (feature: mapboxgl.MapboxGeoJSONFeature, layerType: string) => {
    const props = feature.properties || {};
    const geometry = feature.geometry;
    
    // Extract coordinates from geometry
    let coordinates: [number, number] | null = null;
    if (geometry.type === 'Point' && geometry.coordinates) {
      coordinates = geometry.coordinates as [number, number];
    }
    
    // Common properties that might be in tilesets
    const name = props.name || props.Name || props.NAME || props.facility_name || props.facilityName || 'Unknown';
    const type = props.type || props.Type || props.TYPE || layerType;
    const address = props.address || props.Address || props.ADDRESS || props.location || props.Location;
    const description = props.description || props.Description || props.details || props.Details;
    const capacity = props.capacity || props.Capacity || props.max_capacity;
    const contact = props.contact || props.Contact || props.phone || props.Phone;
    const barangay = props.barangay || props.Barangay || props.BARANGAY || props.bgy;
    
    // Build content sections
    const hasPrimaryInfo = description || address || barangay;
    const hasSecondaryInfo = capacity || contact;
    const hasCoordinates = coordinates;
    
    return `
      <div class="min-w-[240px] max-w-[320px]">
        <!-- Header Section -->
        <div class="px-4 pt-3 pb-2.5 border-b border-gray-200 bg-gray-50/50">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide" style="background-color: rgba(249, 115, 22, 0.1); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2);">
              ${type}
            </span>
          </div>
          <h4 class="text-base font-bold text-gray-900 break-words leading-tight pr-2">${name}</h4>
        </div>
        
        <!-- Content Section -->
        <div class="px-4 py-3 space-y-3 text-sm">
          ${description ? `
            <div class="space-y-1">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</div>
              <div class="text-gray-700 break-words leading-relaxed">${description}</div>
            </div>
          ` : ''}
          
          ${address ? `
            <div class="space-y-1 ${description ? 'pt-1 border-t border-gray-100' : ''}">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</div>
              <div class="text-gray-700 break-words leading-relaxed text-sm">${address}</div>
            </div>
          ` : ''}
          
          ${barangay ? `
            <div class="space-y-1 ${(description || address) ? 'pt-1 border-t border-gray-100' : ''}">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Barangay</div>
              <div class="text-gray-700 break-words leading-relaxed text-sm">${barangay}</div>
            </div>
          ` : ''}
          
          ${(capacity || contact) ? `
            <div class="pt-2 border-t border-gray-200 space-y-2.5">
              ${capacity ? `
                <div class="space-y-1">
                  <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity</div>
                  <div class="text-gray-700 text-sm font-medium">${capacity}</div>
                </div>
              ` : ''}
              
              ${contact ? `
                <div class="space-y-1 ${capacity ? 'pt-1 border-t border-gray-100' : ''}">
                  <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</div>
                  <div class="text-gray-700 break-words leading-relaxed text-sm">${contact}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${coordinates ? `
            <div class="space-y-1 ${hasPrimaryInfo || hasSecondaryInfo ? 'pt-2 border-t border-gray-200' : ''}">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coordinates</div>
              <div class="text-gray-600 font-mono text-xs break-all leading-relaxed">
                ${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}
              </div>
            </div>
          ` : ''}
          
          ${Object.keys(props).length > 0 && !name && !address && !description && !barangay && !capacity && !contact ? `
            <div class="pt-2 border-t border-gray-200 space-y-1.5">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Additional Information</div>
              ${Object.entries(props).slice(0, 5).map(([key, value]) => 
                `<div class="space-y-0.5">
                  <span class="text-xs font-medium text-gray-600">${key}:</span>
                  <span class="text-xs text-gray-700 ml-1">${value}</span>
                </div>`
              ).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Handle hover for tileset layers (health-facilities and evacuation-centers)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!map.current) return;

      // Query features at the mouse position for tileset layers
      const layers = ['health-facilities', 'evacuation-centers'];
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: layers
      });

      // Change cursor style
      const canvas = map.current.getCanvasContainer();
      if (canvas) {
        if (features.length > 0) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = '';
        }
      }

      // Remove existing tileset hover popup
      if (tilesetHoverPopupRef.current) {
        tilesetHoverPopupRef.current.remove();
        tilesetHoverPopupRef.current = null;
      }

      // If we found a feature, show hover popup
      if (features.length > 0) {
        const feature = features[0];
        const layerId = feature.layer?.id || '';
        
        // Determine layer type
        let layerType = 'Facility';
        if (layerId.includes('health')) {
          layerType = 'Health Facility';
        } else if (layerId.includes('evacuation')) {
          layerType = 'Evacuation Center';
        }

        // Get coordinates from feature
        let coordinates: [number, number] | null = null;
        if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
          coordinates = feature.geometry.coordinates as [number, number];
        } else if (e.lngLat) {
          coordinates = [e.lngLat.lng, e.lngLat.lat];
        }

        if (coordinates) {
          tilesetHoverPopupRef.current = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            className: 'custom-popup hover-popup',
            maxWidth: '320px'
          })
          .setLngLat(coordinates)
          .setHTML(createTilesetHoverPopupContent(feature, layerType))
          .addTo(map.current);
        }
      }
    };

    const handleMouseLeave = () => {
      // Reset cursor
      if (map.current) {
        const canvas = map.current.getCanvasContainer();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
      
      if (tilesetHoverPopupRef.current) {
        tilesetHoverPopupRef.current.remove();
        tilesetHoverPopupRef.current = null;
      }
    };

    // Add event listeners
    map.current.on('mousemove', handleMouseMove);
    map.current.on('mouseleave', handleMouseLeave);

    return () => {
      if (map.current) {
        map.current.off('mousemove', handleMouseMove);
        map.current.off('mouseleave', handleMouseLeave);
      }
      if (tilesetHoverPopupRef.current) {
        tilesetHoverPopupRef.current.remove();
        tilesetHoverPopupRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Handle cursor change for add placemark mode with custom cursor element
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const canvas = map.current.getCanvasContainer();
    if (!canvas) return;

    if (isAddPlacemarkMode) {
      // Create custom cursor element
      const cursorEl = document.createElement('div');
      cursorEl.className = 'custom-placemark-cursor';
      cursorEl.style.cssText = `
        position: absolute;
        width: 32px;
        height: 40px;
        pointer-events: none !important;
        z-index: 10000;
        transform: translate(-16px, -40px);
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
      `;
      cursorEl.innerHTML = `<img src="/markers/default.svg" alt="cursor" style="width: 32px; height: 40px; object-fit: contain; pointer-events: none;" />`;
      canvas.appendChild(cursorEl);
      cursorElementRef.current = cursorEl;

      // Hide default cursor
      canvas.style.cursor = 'none';

      // Track mouse movement
      const handleMouseMove = (e: MouseEvent) => {
        if (cursorEl && canvas) {
          const rect = canvas.getBoundingClientRect();
          cursorEl.style.left = `${e.clientX - rect.left}px`;
          cursorEl.style.top = `${e.clientY - rect.top}px`;
        }
      };

      // Also handle mouse leave to hide cursor when outside map
      const handleMouseLeave = () => {
        if (cursorEl) {
          cursorEl.style.display = 'none';
        }
      };

      const handleMouseEnter = () => {
        if (cursorEl) {
          cursorEl.style.display = 'flex';
        }
      };

      canvas.addEventListener('mouseenter', handleMouseEnter);
      canvas.addEventListener('mouseleave', handleMouseLeave);

      canvas.addEventListener('mousemove', handleMouseMove);

      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseenter', handleMouseEnter);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        if (cursorEl && cursorEl.parentNode) {
          cursorEl.parentNode.removeChild(cursorEl);
        }
        canvas.style.cursor = '';
        cursorElementRef.current = null;
      };
    } else {
      // Remove cursor element if it exists
      if (cursorElementRef.current && cursorElementRef.current.parentNode) {
        cursorElementRef.current.parentNode.removeChild(cursorElementRef.current);
        cursorElementRef.current = null;
      }
      canvas.style.cursor = '';
    }
  }, [isAddPlacemarkMode, mapLoaded]);

  return (
    <div className="w-full h-full relative">
      
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          /* Ensure markers maintain their position and size during zoom */
          .custom-marker {
            backface-visibility: hidden;
            transform-style: preserve-3d;
            pointer-events: auto;
          }
          
          .mapboxgl-marker {
            will-change: transform;
            transform-origin: center center;
          }
          
          .mapboxgl-popup-content {
            padding: 0 !important;
            border-radius: 8px !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
            max-width: 380px !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            background: white !important;
            border: 1px solid #e5e7eb !important;
            position: relative !important;
          }
          
          .mapboxgl-popup-tip {
            border-top-color: white !important;
            border-bottom-color: white !important;
            width: 0 !important;
            height: 0 !important;
            border-left: 8px solid transparent !important;
            border-right: 8px solid transparent !important;
            border-bottom: 8px solid white !important;
            margin: 0 auto !important;
          }
          
          .mapboxgl-popup {
            z-index: 1001 !important;
            max-width: 380px !important;
          }
        `}
      </style>
      
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-xl"
        style={{ width: '100%', height: '100%', minHeight: '480px' }}
      />
      
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
            <p className="text-xs text-gray-500 mt-1">This may take a few seconds</p>
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-red-600">
            <p className="text-sm font-medium">{mapError}</p>
            <p className="text-xs mt-1">Check console for details</p>
            <button 
              onClick={() => {
                setMapError(null);
                setMapLoaded(false);
                // Force re-initialization
                if (mapContainer.current) {
                  const event = new Event('resize');
                  window.dispatchEvent(event);
                }
              }}
              className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


