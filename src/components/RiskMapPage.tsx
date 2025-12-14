import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MapPin, Layers, CalendarIcon, Search, Building2, Ambulance, Waves, Mountain, Building, CircleAlert, Users, ShieldAlert, Activity, Flame, Car, Siren, Home, Navigation, RotateCcw, HelpCircle, Info, ZoomIn, ZoomOut, LocateFixed, X, Filter, Download, FileText, Globe, Wrench, AlertTriangle, Zap, Leaf, Satellite, Heart } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { cn, ensureOk } from "@/lib/utils";
import { Layout } from "./Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MapboxMap } from "./MapboxMap";
import { usePins } from "@/hooks/usePins";
import { Pin, PinType } from "@/types/pin";
import { toast } from "@/components/ui/sonner";
import { PinModal, PinFormData } from "./PinModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

// Pin type icons mapping
const pinTypeIcons: Record<string, any> = {
  "Road Crash": Car,
  "Fire": Flame,
  "Medical Emergency": Ambulance,
  "Flooding": Waves,
  "Volcanic Activity": Mountain,
  "Landslide": Mountain,
  "Earthquake": CircleAlert,
  "Civil Disturbance": Users,
  "Armed Conflict": ShieldAlert,
  "Infectious Disease": Activity,
  "Poor Infrastructure": Wrench,
  "Obstructions": AlertTriangle,
  "Electrical Hazard": Zap,
  "Environmental Hazard": Leaf,
  "Animal Concerns": Heart,
  "Others": HelpCircle,
  "Evacuation Centers": Building,
  "Health Facilities": Building2,
  "Police Stations": ShieldAlert,
  "Fire Stations": Flame,
  "Government Offices": Building2,
};

// Facility icons mapping
const facilityIcons: Record<string, any> = {
  evacuationCenters: Building,
  healthFacilities: Building2,
  policeStations: ShieldAlert,
  fireStations: Flame,
  governmentOffices: Building2,
};


export function RiskMapPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { createPin, updatePin, subscribeToPins, deletePin, loading: pinLoading } = usePins();
  const { canAddPlacemark, canEditPins, canDeletePins } = useUserRole();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();
  const [quickDateFilter, setQuickDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([121.5556, 14.1139]);
  const [mapZoom, setMapZoom] = useState(11);
  const [isFromReport, setIsFromReport] = useState(false); // Track if data came from a report
  const [pins, setPins] = useState<Pin[]>([]); // Store pins from database
  
  // Pin Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<"create" | "edit">("create");
  const [editingPin, setEditingPin] = useState<Pin | undefined>(undefined);
  const [pinModalPrefill, setPinModalPrefill] = useState<Partial<PinFormData> | undefined>(undefined);
  const [isUnpinMode, setIsUnpinMode] = useState(false);
  const [isLegendDialogOpen, setIsLegendDialogOpen] = useState(false);
  const [tempClickedLocation, setTempClickedLocation] = useState<{ lat: number; lng: number; locationName: string } | null>(null);
  
  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  
  // Filters Panel State
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [mapLayerStyle, setMapLayerStyle] = useState<'streets' | 'satellite'>('streets');
  
  // Track previous filter state to prevent duplicate toast messages
  const previousFilterStateRef = useRef<string>('');
  const hasShownToastRef = useRef<boolean>(false);
  
  // Add Placemark Mode State
  const [isAddPlacemarkMode, setIsAddPlacemarkMode] = useState(false);

  const [showAllAccidents, setShowAllAccidents] = useState(false); // Track "All" selection for accidents
  const [showAllFacilities, setShowAllFacilities] = useState(false); // Track "All" selection for facilities
  const [accidentFilters, setAccidentFilters] = useState({
    roadCrash: false,
    fire: false,
    medicalEmergency: false,
    flooding: false,
    volcanicActivity: false,
    landslide: false,
    earthquake: false,
    civilDisturbance: false,
    armedConflict: false,
    infectiousDisease: false,
    poorInfrastructure: false,
    obstructions: false,
    electricalHazard: false,
    environmentalHazard: false,
    animalConcern: false,
    others: false
  });

  const [facilityFilters, setFacilityFilters] = useState({
    evacuationCenters: false,
    healthFacilities: false,
    policeStations: false,
    fireStations: false,
    governmentOffices: false
  });

  // Custom pin types loaded from localStorage
  const [customPinTypes, setCustomPinTypes] = useState<string[]>([]);
  const [customPinFilters, setCustomPinFilters] = useState<Record<string, boolean>>({});

  const [layerFilters, setLayerFilters] = useState({
    barangay: false, // Hidden by default (lucban-boundary stays visible)
    barangayLabel: false, // Hidden by default
    roadNetwork: false, // Hidden by default
    waterways: false, // Hidden by default
    traffic: false, // Hidden by default
    satellite: false // Hidden by default
  });


  // Accident/Hazard types
  const accidentHazardTypes = [
    "Road Crash", "Fire", "Medical Emergency", "Flooding", "Volcanic Activity",
    "Landslide", "Earthquake", "Civil Disturbance", "Armed Conflict", "Infectious Disease",
    "Poor Infrastructure", "Obstructions", "Electrical Hazard", "Environmental Hazard", "Animal Concerns", "Others"
  ];

  // Emergency facility types
  const emergencyFacilityTypes = [
    "Evacuation Centers", "Health Facilities", "Police Stations", "Fire Stations", "Government Offices"
  ];

  // Combined pin types (for backward compatibility)
  const pinTypes = [...accidentHazardTypes, ...emergencyFacilityTypes];

  // Function to load custom pin types from localStorage
  const loadCustomPinTypes = useCallback(() => {
    const stored = localStorage.getItem("customPinTypes");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomPinTypes(parsed);
        // Initialize filter state for custom pin types
        const initialFilters: Record<string, boolean> = {};
        parsed.forEach((type: string) => {
          // Create a key from the type name (convert to camelCase-like key)
          const key = type.toLowerCase().replace(/\s+/g, '');
          initialFilters[key] = false;
        });
        setCustomPinFilters(prev => {
          // Preserve existing checked states
          const newFilters: Record<string, boolean> = {};
          parsed.forEach((type: string) => {
            const key = type.toLowerCase().replace(/\s+/g, '');
            newFilters[key] = prev[key] ?? false;
          });
          return newFilters;
        });
      } catch (e) {
        console.error("Failed to parse custom pin types:", e);
      }
    } else {
      setCustomPinTypes([]);
      setCustomPinFilters({});
    }
  }, []);

  // Load custom pin types from localStorage on mount
  useEffect(() => {
    loadCustomPinTypes();
  }, [loadCustomPinTypes]);

  // Reload custom pin types when filter panel opens (in case they were added elsewhere)
  useEffect(() => {
    if (isFiltersOpen) {
      loadCustomPinTypes();
    }
  }, [isFiltersOpen, loadCustomPinTypes]);


  // Function to reverse geocode coordinates to get location name
  const reverseGeocode = async (lat: string, lng: string) => {
    try {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return "Invalid coordinates";
      }

      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        return "Geocoding unavailable";
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}&types=address,poi,place,locality,neighborhood`;
      
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return feature.place_name || feature.text || 'Unknown Location';
      } else {
        return 'Unknown Location';
      }
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      return 'Geocoding failed';
    }
  };

  // Geocoding search with Mapbox API
  const handleGeocodingSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchSuggestions([]);
      setIsSearchOpen(false);
      return;
    }

    try {
      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) {
        console.error('Mapbox access token not found');
        return;
      }

      // Add proximity bias to Lucban, Quezon for better local results
      // Philippines bbox: 116.0,4.0,127.0,21.5 (minLon,minLat,maxLon,maxLat)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&limit=5&proximity=121.5569,14.1133&country=PH&bbox=116,4,127,21.5`;
      
      const data = await ensureOk(await fetch(url)).then(r => r.json());
      setSearchSuggestions(data.features || []);
      setIsSearchOpen(data.features && data.features.length > 0);
    } catch (error: any) {
      console.error('Error fetching geocoding results:', error);
      setSearchSuggestions([]);
      setIsSearchOpen(false);
    }
  }, []);

  // Debounce geocoding search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleGeocodingSearch(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleGeocodingSearch]);

  // Handle selecting a search result
  const handleSelectSearchResult = (feature: any) => {
    const [lng, lat] = feature.geometry.coordinates;
    const placeName = feature.place_name || feature.text || 'Selected location';
    
    // Update map center and zoom
    setMapCenter([lng, lat]);
    setMapZoom(15); // Zoom in to show the location
    
    // Update search query with selected location
    setSearchQuery(placeName);
    
    // Close dropdown
    setIsSearchOpen(false);
    
    toast.success(`Navigated to ${placeName}`);
  };

  // Effect to populate modal when navigating from a report or pin
  useEffect(() => {
    const state = location.state as any;
    console.log("Location state changed:", state);
    if (state && state.report) {
      const report = state.report;
      console.log("Loading report data from Manage Reports:", report);
      
      // Open the modal with pre-filled data
      setPinModalMode("create");
      setPinModalPrefill({
        type: report.type || "",
        title: "", // Keep title empty for admin to customize
        latitude: report.latitude || null,
        longitude: report.longitude || null,
        locationName: report.location || "",
        reportId: report.id || ""
      });
      setIsUnpinMode(false);
      setIsPinModalOpen(true);
      setIsFiltersOpen(false); // Close filter panel when pin modal opens
      
      // Clear the location state to prevent it from persisting on refresh
      navigate("/risk-map", { replace: true, state: {} });
    } else if (state && state.pin && state.unpinMode) {
      // Handle unpin mode - open edit modal with pin data
      const pin = state.pin;
      console.log("Loading pin data for unpin mode:", pin);
      
      setPinModalMode("edit");
      setEditingPin(pin);
      setPinModalPrefill({
        type: pin.type,
        title: pin.title,
        description: pin.description || "",
        latitude: pin.latitude,
        longitude: pin.longitude,
        locationName: pin.locationName,
        reportId: pin.reportId
      });
      setIsUnpinMode(true);
      setIsPinModalOpen(true);
      setIsFiltersOpen(false);
      
      // Clear the location state
      navigate("/risk-map", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleAccidentFilterChange = (key: keyof typeof accidentFilters) => {
    const isCurrentlyChecked = accidentFilters[key];
    
    // If unchecking, allow it
    if (isCurrentlyChecked) {
      setAccidentFilters(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    // If checking an accident/hazard filter, turn off "All" mode, custom pins, and emergency facility filters
    setShowAllAccidents(false);
    setShowAllFacilities(false);
    // Clear all custom pin filters
    const clearedCustomFilters: Record<string, boolean> = {};
    Object.keys(customPinFilters).forEach(key => {
      clearedCustomFilters[key] = false;
    });
    setCustomPinFilters(clearedCustomFilters);
    setFacilityFilters({
      evacuationCenters: false,
      healthFacilities: false,
      policeStations: false,
      fireStations: false,
      governmentOffices: false
    });
    
    // If checking, uncheck all other accident filters (only one at a time)
    const newFilters = {
      roadCrash: false,
      fire: false,
      medicalEmergency: false,
      flooding: false,
      volcanicActivity: false,
      landslide: false,
      earthquake: false,
      civilDisturbance: false,
      armedConflict: false,
      infectiousDisease: false,
      poorInfrastructure: false,
      obstructions: false,
      electricalHazard: false,
      environmentalHazard: false,
      animalConcern: false,
      others: false,
      [key]: true
    };
    
    setAccidentFilters(newFilters);
  };

  const handleToggleAllAccidents = (checked: boolean) => {
    setShowAllAccidents(checked);
    
    // If checking "All", uncheck all individual filters, custom pins, and facility filters
    if (checked) {
      setAccidentFilters({
        roadCrash: false,
        fire: false,
        medicalEmergency: false,
        flooding: false,
        volcanicActivity: false,
        landslide: false,
        earthquake: false,
        civilDisturbance: false,
        armedConflict: false,
        infectiousDisease: false,
        poorInfrastructure: false,
        obstructions: false,
        electricalHazard: false,
        environmentalHazard: false,
        animalConcern: false,
        others: false
      });
      // Clear all custom pin filters
      const clearedCustomFilters: Record<string, boolean> = {};
      Object.keys(customPinFilters).forEach(key => {
        clearedCustomFilters[key] = false;
      });
      setCustomPinFilters(clearedCustomFilters);
      setShowAllFacilities(false);
      setFacilityFilters({
        evacuationCenters: false,
        healthFacilities: false,
        policeStations: false,
        fireStations: false,
        governmentOffices: false
      });
    }
  };

  const handleToggleAllFacilities = (checked: boolean) => {
    setShowAllFacilities(checked);
    
    // If checking "All", uncheck all individual filters, custom pins, and accident filters
    if (checked) {
      setFacilityFilters({
        evacuationCenters: false,
        healthFacilities: false,
        policeStations: false,
        fireStations: false,
        governmentOffices: false
      });
      // Clear all custom pin filters
      const clearedCustomFilters: Record<string, boolean> = {};
      Object.keys(customPinFilters).forEach(key => {
        clearedCustomFilters[key] = false;
      });
      setCustomPinFilters(clearedCustomFilters);
      setShowAllAccidents(false);
      setAccidentFilters({
        roadCrash: false,
        fire: false,
        medicalEmergency: false,
        flooding: false,
        volcanicActivity: false,
        landslide: false,
        earthquake: false,
        civilDisturbance: false,
        armedConflict: false,
        infectiousDisease: false,
        poorInfrastructure: false,
        obstructions: false,
        electricalHazard: false,
        environmentalHazard: false,
        animalConcern: false,
        others: false
      });
    }
  };

  const handleCustomPinFilterChange = (customType: string) => {
    const key = customType.toLowerCase().replace(/\s+/g, '');
    const isCurrentlyChecked = customPinFilters[key] ?? false;
    
    // If unchecking, allow it
    if (isCurrentlyChecked) {
      setCustomPinFilters(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    // If checking a custom pin filter, turn off all other filters
    setShowAllAccidents(false);
    setAccidentFilters({
      roadCrash: false,
      fire: false,
      medicalEmergency: false,
      flooding: false,
      volcanicActivity: false,
      landslide: false,
      earthquake: false,
      civilDisturbance: false,
      armedConflict: false,
      infectiousDisease: false,
      poorInfrastructure: false,
      obstructions: false,
      electricalHazard: false,
      environmentalHazard: false,
      animalConcern: false,
      others: false
    });
    setFacilityFilters({
      evacuationCenters: false,
      healthFacilities: false,
      policeStations: false,
      fireStations: false,
      governmentOffices: false
    });
    
    // Uncheck all other custom pins and check this one
    const newCustomFilters: Record<string, boolean> = {};
    customPinTypes.forEach(type => {
      const typeKey = type.toLowerCase().replace(/\s+/g, '');
      newCustomFilters[typeKey] = typeKey === key;
    });
    setCustomPinFilters(newCustomFilters);
  };

  const handleFacilityFilterChange = (key: keyof typeof facilityFilters) => {
    const isCurrentlyChecked = facilityFilters[key];
    
    // If unchecking, allow it
    if (isCurrentlyChecked) {
      setFacilityFilters(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    // If checking a facility filter, turn off all accident/hazard filters, custom pins, and "All" mode
    setShowAllAccidents(false);
    setAccidentFilters({
      roadCrash: false,
      fire: false,
      medicalEmergency: false,
      flooding: false,
      volcanicActivity: false,
      landslide: false,
      earthquake: false,
      civilDisturbance: false,
      armedConflict: false,
      infectiousDisease: false,
      poorInfrastructure: false,
      obstructions: false,
      electricalHazard: false,
      environmentalHazard: false,
      animalConcern: false,
      others: false
    });
    // Clear all custom pin filters
    const clearedCustomFilters: Record<string, boolean> = {};
    Object.keys(customPinFilters).forEach(key => {
      clearedCustomFilters[key] = false;
    });
    setCustomPinFilters(clearedCustomFilters);
    
    // If checking, count total active filters
    const totalActive = Object.values(accidentFilters).filter(Boolean).length + 
                        Object.values(facilityFilters).filter(Boolean).length;
    
    if (totalActive >= 10) {
      toast.error('Maximum 10 filter types can be selected at once');
      return;
    }
    
    setFacilityFilters(prev => ({ ...prev, [key]: true }));
  };


  const handleQuickDateFilter = (period: 'all' | 'week' | 'month' | 'year') => {
    setQuickDateFilter(period);
    if (period === 'all') {
      setDate(undefined);
      return;
    }
    
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'week':
        start = startOfWeek(today);
        end = endOfWeek(today);
        break;
      case 'month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'year':
        start = startOfYear(today);
        end = endOfYear(today);
        break;
    }

    setDate({ from: start, to: end });
  };


  const handleSelectAllFacilities = (checked: boolean) => {
    if (checked) {
      // Count total if we select all facilities
      const facilityCount = Object.keys(facilityFilters).length;
      const accidentActiveCount = Object.values(accidentFilters).filter(Boolean).length;
      const totalWouldBe = facilityCount + accidentActiveCount;
      
      if (totalWouldBe > 10) {
        toast.error('Cannot select all: Maximum 10 filter types allowed. Please unselect some accident filters first.');
        return;
      }
    }
    
    const newFilters = {
      evacuationCenters: checked,
      healthFacilities: checked,
      policeStations: checked,
      fireStations: checked,
      governmentOffices: checked
    };
    setFacilityFilters(newFilters);
  };

  // Export functions
  const exportToCSV = () => {
    if (pins.length === 0) {
      toast.error('No pins to export');
      return;
    }

    // CSV header
    const headers = ['ID', 'Type', 'Title', 'Latitude', 'Longitude', 'Location Name', 'Category', 'Report ID', 'Created At', 'Created By'];
    const rows = pins.map(pin => [
      pin.id,
      pin.type,
      pin.title,
      pin.latitude.toString(),
      pin.longitude.toString(),
      pin.locationName,
      pin.category,
      pin.reportId || '',
      pin.createdAt instanceof Date ? pin.createdAt.toISOString() : pin.createdAt,
      pin.createdByName || ''
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `accizard-pins-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${pins.length} pins to CSV`);
  };

  const exportToKML = () => {
    if (pins.length === 0) {
      toast.error('No pins to export');
      return;
    }

    // KML structure
    const placemarks = pins.map(pin => {
      const description = [
        `<b>Type:</b> ${pin.type}`,
        `<b>Title:</b> ${pin.title}`,
        `<b>Location:</b> ${pin.locationName}`,
        `<b>Category:</b> ${pin.category}`,
        pin.reportId ? `<b>Report ID:</b> ${pin.reportId}` : '',
        `<b>Created:</b> ${pin.createdAt instanceof Date ? pin.createdAt.toISOString() : pin.createdAt}`,
        `<b>Created By:</b> ${pin.createdByName || ''}`
      ].filter(Boolean).join('<br/>');

      return `    <Placemark>
      <name><![CDATA[${pin.title}]]></name>
      <description><![CDATA[${description}]]></description>
      <Point>
        <coordinates>${pin.longitude},${pin.latitude},0</coordinates>
      </Point>
    </Placemark>`;
    }).join('\n');

    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>AcciZard Map Pins</name>
    <description>Exported pins from AcciZard Risk Map</description>
${placemarks}
  </Document>
</kml>`;

    // Create blob and download
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `accizard-pins-${new Date().toISOString().split('T')[0]}.kml`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${pins.length} pins to KML`);
  };

  const exportToGeoJSON = () => {
    if (pins.length === 0) {
      toast.error('No pins to export');
      return;
    }

    // GeoJSON structure
    const features = pins.map(pin => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.longitude, pin.latitude]
      },
      properties: {
        id: pin.id,
        type: pin.type,
        title: pin.title,
        locationName: pin.locationName,
        category: pin.category,
        reportId: pin.reportId || null,
        createdAt: pin.createdAt instanceof Date ? pin.createdAt.toISOString() : pin.createdAt,
        createdBy: pin.createdByName || '',
        createdById: pin.createdBy || ''
      }
    }));

    const geoJSON = {
      type: 'FeatureCollection',
      metadata: {
        name: 'AcciZard Map Pins',
        description: 'Exported pins from AcciZard Risk Map',
        exportedAt: new Date().toISOString(),
        count: pins.length
      },
      features: features
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `accizard-pins-${new Date().toISOString().split('T')[0]}.geojson`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${pins.length} pins to GeoJSON`);
  };

  // New Modal-based Pin Management Handlers
  const handleEditPin = (pin: Pin) => {
    console.log("Edit pin:", pin);
    setPinModalMode("edit");
    setEditingPin(pin);
    setPinModalPrefill({
      type: pin.type,
      title: pin.title,
      description: pin.description || "",
      latitude: pin.latitude,
      longitude: pin.longitude,
      locationName: pin.locationName,
      reportId: pin.reportId
    });
    setIsPinModalOpen(true);
    setIsFiltersOpen(false); // Close filter panel when pin modal opens
  };

  const handleDeletePinClick = (pinId: string) => {
    console.log("Delete pin:", pinId);
    setPinToDelete(pinId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pinToDelete) return;
    
    try {
      await deletePin(pinToDelete);
      toast.success("Pin deleted successfully");
      setIsDeleteDialogOpen(false);
      setPinToDelete(null);
    } catch (error: any) {
      console.error("Error deleting pin:", error);
      toast.error(error.message || "Failed to delete pin");
    }
  };

  const handleSavePin = async (pinData: PinFormData) => {
    try {
      if (pinModalMode === "create") {
        // Create new pin
        if (!pinData.latitude || !pinData.longitude) {
          toast.error("Please select a location on the map");
          return;
        }

        const pinId = await createPin({
          type: pinData.type as PinType,
          title: pinData.title,
          description: pinData.description || undefined,
          latitude: pinData.latitude,
          longitude: pinData.longitude,
          locationName: pinData.locationName || 'Unknown Location',
          reportId: pinData.reportId || undefined
        });

        console.log("Pin created successfully with ID:", pinId);
        toast.success(`Pin "${pinData.title}" added successfully!`);
      } else if (pinModalMode === "edit" && editingPin) {
        // Update existing pin
        await updatePin(editingPin.id, {
          type: pinData.type as PinType,
          title: pinData.title,
          description: pinData.description || undefined,
          latitude: pinData.latitude!,
          longitude: pinData.longitude!,
          locationName: pinData.locationName
        });

        console.log("Pin updated successfully");
        toast.success(`Pin "${pinData.title}" updated successfully!`);
      }

      setIsPinModalOpen(false);
      setPinModalPrefill(undefined);
      setEditingPin(undefined);
      setTempClickedLocation(null); // Clear temporary marker after pin is saved
      setIsUnpinMode(false);
    } catch (error: any) {
      console.error("Error saving pin:", error);
      toast.error(error.message || "Failed to save pin");
      throw error; // Re-throw to keep modal open
    }
  };

  const handleUnpin = async (pinId: string) => {
    try {
      await deletePin(pinId);
      toast.success("Pin removed from map successfully");
      setIsPinModalOpen(false);
      setEditingPin(undefined);
      setPinModalPrefill(undefined);
      setIsUnpinMode(false);
    } catch (error: any) {
      console.error("Error unpinning:", error);
      toast.error(error.message || "Failed to unpin");
      throw error;
    }
  };

  // Handle coordinate changes from PinModal
  const handleCoordinatesChange = async (coordinates: { lat: number; lng: number }) => {
    // Don't allow coordinate changes if pin is connected to a report
    const hasReportId = pinModalPrefill?.reportId || editingPin?.reportId;
    if (hasReportId) {
      // Pin is connected to a report - don't allow location changes
      return;
    }
    
    // Update the temporary clicked location to move the marker
    if (coordinates.lat !== 0 && coordinates.lng !== 0) {
      // Reverse geocode to get location name
      const locationName = await reverseGeocode(coordinates.lat.toString(), coordinates.lng.toString());
      setTempClickedLocation({
        lat: coordinates.lat,
        lng: coordinates.lng,
        locationName: locationName
      });
      
      // Update the prefill data with new coordinates and location name
      setPinModalPrefill(prev => ({
        ...prev,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        locationName: locationName
      }));
    } else {
      // Clear the marker if coordinates are cleared
      setTempClickedLocation(null);
    }
  };

  // Convert camelCase filter key to PinType display name
  const convertFilterKeyToType = (key: string): string => {
    // Direct mapping to ensure exact match with PinType values
    const typeMapping: Record<string, string> = {
      // Accident/Hazard Types
      'roadCrash': 'Road Crash',
      'fire': 'Fire',
      'medicalEmergency': 'Medical Emergency',
      'flooding': 'Flooding',
      'volcanicActivity': 'Volcanic Activity',
      'landslide': 'Landslide',
      'earthquake': 'Earthquake',
      'civilDisturbance': 'Civil Disturbance',
      'armedConflict': 'Armed Conflict',
      'infectiousDisease': 'Infectious Disease',
      'poorInfrastructure': 'Poor Infrastructure',
      'obstructions': 'Obstructions',
      'electricalHazard': 'Electrical Hazard',
      'environmentalHazard': 'Environmental Hazard',
      'animalConcern': 'Animal Concerns',
      'others': 'Others',
      // Emergency Facilities
      'evacuationCenters': 'Evacuation Centers',
      'healthFacilities': 'Health Facilities',
      'policeStations': 'Police Stations',
      'fireStations': 'Fire Stations',
      'governmentOffices': 'Government Offices'
    };
    
    return typeMapping[key] || key;
  };

  // Get active filters for the map
  const getActiveFilters = () => {
    // If "All" is selected, return empty array to indicate all types
    const activeAccidentTypes = showAllAccidents 
      ? [] 
      : Object.entries(accidentFilters)
          .filter(([_, isActive]) => isActive)
          .map(([key]) => convertFilterKeyToType(key));

    const activeFacilityTypes = showAllFacilities
      ? []
      : Object.entries(facilityFilters)
          .filter(([_, isActive]) => isActive)
          .map(([key]) => convertFilterKeyToType(key));

    const activeCustomTypes = Object.entries(customPinFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => {
        const customType = customPinTypes.find(type => 
          type.toLowerCase().replace(/\s+/g, '') === key
        );
        return customType || '';
      })
      .filter(Boolean);

    return {
      accidentTypes: activeAccidentTypes,
      facilityTypes: activeFacilityTypes,
      customTypes: activeCustomTypes,
      layerFilters: layerFilters,
      showAllAccidents: showAllAccidents,
      showAllFacilities: showAllFacilities
    };
  };

  // Get active filter types as PinType array
  const getActiveFilterTypes = (): PinType[] => {
    // If "All" is selected for accidents or facilities, return empty array to fetch all pins
    if (showAllAccidents || showAllFacilities) {
      return []; // Empty array means fetch all pins of the selected category
    }
    
    const activeTypes: PinType[] = [];
    
    Object.entries(accidentFilters).forEach(([key, isActive]) => {
      if (isActive) {
        const type = convertFilterKeyToType(key) as PinType;
        activeTypes.push(type);
      }
    });
    
    Object.entries(facilityFilters).forEach(([key, isActive]) => {
      if (isActive) {
        const type = convertFilterKeyToType(key) as PinType;
        activeTypes.push(type);
      }
    });
    
    // Add custom pin types that are active
    Object.entries(customPinFilters).forEach(([key, isActive]) => {
      if (isActive) {
        // Find the custom type name from the key
        const customType = customPinTypes.find(type => 
          type.toLowerCase().replace(/\s+/g, '') === key
        );
        if (customType) {
          activeTypes.push(customType as PinType);
        }
      }
    });
    
    return activeTypes;
  };


  // Subscribe to pins from database with real-time updates
  useEffect(() => {
    const activeTypes = getActiveFilterTypes();
    
    // Get active accident/hazard types (excluding facilities)
    const activeAccidentTypes = Object.entries(accidentFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => convertFilterKeyToType(key));
    
    // Get active custom pin types
    const activeCustomTypes = Object.entries(customPinFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => {
        const customType = customPinTypes.find(type => 
          type.toLowerCase().replace(/\s+/g, '') === key
        );
        return customType || '';
      })
      .filter(Boolean);

    // Get active facility types
    const activeFacilityTypes = Object.entries(facilityFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => convertFilterKeyToType(key));

    // If no filters are active (including "All"), clear pins and don't subscribe
    if (activeTypes.length === 0 && !showAllAccidents && !showAllFacilities && activeAccidentTypes.length === 0 && 
        activeFacilityTypes.length === 0 && activeCustomTypes.length === 0) {
      setPins([]);
      return () => {}; // Return empty cleanup function
    }
    
    // Build filter object
    const filters: any = {
      searchQuery: searchQuery
    };

    // If "All" is selected for accidents or facilities, fetch all pins without type filter
    if (showAllAccidents) {
      filters.categories = ['accident']; // Only fetch from reportPins collection
    } else if (showAllFacilities) {
      filters.categories = ['facility']; // Only fetch from pins collection
    } else if (activeTypes.length > 0) {
      // Otherwise, apply type filters (with 10-item limit)
      filters.types = activeTypes;
    }

    // Add date range filters only if accident/hazard types are selected, "All" is selected, or custom pins are selected
    // Date filters should not apply to emergency support facilities
    if (activeAccidentTypes.length > 0 || showAllAccidents || activeCustomTypes.length > 0) {
      if (date?.from) {
        const fromDate = new Date(date.from);
        fromDate.setHours(0, 0, 0, 0);
        filters.dateFrom = fromDate;
      }
      if (date?.to) {
        const toDate = new Date(date.to);
        toDate.setHours(23, 59, 59, 999);
        filters.dateTo = toDate;
      }
    }

    // Create a unique key for the current filter state
    const currentFilterKey = JSON.stringify({
      showAllAccidents: showAllAccidents,
      showAllFacilities: showAllFacilities,
      types: activeAccidentTypes.sort(),
      facilityTypes: activeFacilityTypes.sort(),
      customTypes: activeCustomTypes.sort(),
      dateFrom: date?.from?.toISOString(),
      dateTo: date?.to?.toISOString()
    });
    
    // Check if filters have changed
    const filtersChanged = previousFilterStateRef.current !== currentFilterKey;
    
    // Reset toast flag when filters change
    if (filtersChanged) {
      previousFilterStateRef.current = currentFilterKey;
      hasShownToastRef.current = false;
    }

    const unsubscribe = subscribeToPins(
      filters,
      (fetchedPins) => {
        setPins(fetchedPins);
        
        // Show message only once when filters change
        if ((activeAccidentTypes.length > 0 || showAllAccidents || activeFacilityTypes.length > 0 || showAllFacilities || activeCustomTypes.length > 0) && !hasShownToastRef.current) {
          if (fetchedPins.length === 0) {
            // No pins found
            if (showAllAccidents) {
              toast.info('No reports found', {
                duration: 3000
              });
            } else if (showAllFacilities) {
              toast.info('No facilities found', {
                duration: 3000
              });
            } else if (activeCustomTypes.length > 0) {
              toast.info(`No reports for ${activeCustomTypes[0]}`, {
                duration: 3000
              });
            } else if (activeFacilityTypes.length > 0) {
              toast.info(`No facilities for ${activeFacilityTypes[0]}`, {
                duration: 3000
              });
            } else {
              const firstActiveType = activeAccidentTypes[0];
              toast.info(`No reports for ${firstActiveType}`, {
                duration: 3000
              });
            }
          } else {
            // Pins found - show count
            const count = fetchedPins.length;
            if (showAllAccidents) {
              toast.info(`Showing ${count} ${count === 1 ? 'report' : 'reports'}`, {
                duration: 3000
              });
            } else if (showAllFacilities) {
              toast.info(`Showing ${count} ${count === 1 ? 'facility' : 'facilities'}`, {
                duration: 3000
              });
            } else if (activeCustomTypes.length > 0) {
              toast.info(`${count} ${count === 1 ? 'report' : 'reports'} for ${activeCustomTypes[0]}`, {
                duration: 3000
              });
            } else if (activeFacilityTypes.length > 0) {
              toast.info(`${count} ${count === 1 ? 'facility' : 'facilities'} for ${activeFacilityTypes[0]}`, {
                duration: 3000
              });
            } else {
              const firstActiveType = activeAccidentTypes[0];
              toast.info(`${count} ${count === 1 ? 'report' : 'reports'} for ${firstActiveType}`, {
                duration: 3000
              });
            }
          }
          hasShownToastRef.current = true;
        }
      },
      (error) => {
        // Only show error toast if it's a real error, not just "no pins found"
        if (error.message && !error.message.includes('permission-denied')) {
          // Show more specific error message
          const errorMessage = error.message || 'Failed to fetch pins from database';
          toast.error(errorMessage);
          console.error('Error fetching pins:', error);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [accidentFilters, facilityFilters, customPinFilters, date, searchQuery, subscribeToPins, showAllAccidents, showAllFacilities, customPinTypes]);

  return (
    <Layout>
      <TooltipProvider>
        <div className="flex h-[calc(100vh-12rem)] min-h-[650px] -mx-6 -my-6">
          {/* Map takes full width - no sidebar */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Map Container */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden min-h-0 rounded-xl">
              {/* Map Toolbar - Positioned inside map at top */}
              <div className="absolute top-4 left-4 right-4 z-40 bg-white border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg rounded-lg">
                {/* Filters Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3"
                      onClick={() => {
                        setIsFiltersOpen(true);
                        setIsPinModalOpen(false); // Close pin modal when filter panel opens
                        setIsAddPlacemarkMode(false); // Exit add placemark mode
                      }}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filter pins by type and date</p>
                  </TooltipContent>
                </Tooltip>

                <div className="flex-1 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                    <Input
                      type="text"
                      placeholder="Search for a location..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        // Keep suggestions open while typing
                        if (e.target.value.length >= 3) {
                          setIsSearchOpen(true);
                        } else {
                          setIsSearchOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchSuggestions.length > 0) {
                          setIsSearchOpen(true);
                        }
                      }}
                      onBlur={(e) => {
                        // Don't close if clicking on a suggestion
                        const relatedTarget = e.relatedTarget as HTMLElement;
                        if (!relatedTarget || !relatedTarget.closest('.search-suggestions')) {
                          // Delay closing to allow click events to fire
                          setTimeout(() => setIsSearchOpen(false), 200);
                        }
                      }}
                      className="pl-9 pr-4 h-9 w-full border-gray-300"
                    />
                    {isSearchOpen && searchSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-[400px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto search-suggestions">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors"
                            onMouseDown={(e) => {
                              // Prevent input blur when clicking suggestion
                              e.preventDefault();
                              handleSelectSearchResult(suggestion);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {suggestion.text}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {suggestion.place_name}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Placemark Button */}
                {canAddPlacemark() ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-9 px-3 bg-brand-orange text-white hover:bg-brand-orange/90 border-brand-orange",
                          isAddPlacemarkMode && "ring-2 ring-brand-orange ring-offset-2"
                        )}
                        onClick={() => {
                          if (isAddPlacemarkMode) {
                            // Toggle off if already active
                            setIsAddPlacemarkMode(false);
                          } else {
                            setIsAddPlacemarkMode(true);
                            setIsFiltersOpen(false);
                            setIsPinModalOpen(false);
                          }
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Add Placemark
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add a new placemark on the map</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="h-9 px-3 opacity-50 cursor-not-allowed"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Add Placemark
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You don't have permission to add placemarks. Contact your super admin for access.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Map Legend Dialog */}
                <Dialog open={isLegendDialogOpen} onOpenChange={setIsLegendDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">Map Legend</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {/* Accident/Hazard Types Section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2">Accident/Hazard Types</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-3">
                        <img src="/markers/road-crash.svg" alt="Road Crash" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Road Crash</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/fire.svg" alt="Fire" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Fire</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/medical-emergency.svg" alt="Medical Emergency" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Medical Emergency</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/flooding.svg" alt="Flooding" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Flooding</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/volcano.svg" alt="Volcanic Activity" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Volcanic Activity</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/landslide.svg" alt="Landslide" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Landslide</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/earthquake.svg" alt="Earthquake" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Earthquake</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/civil-disturbance.svg" alt="Civil Disturbance" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Civil Disturbance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/armed-conflict.svg" alt="Armed Conflict" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Armed Conflict</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/infectious-disease.svg" alt="Infectious Disease" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Infectious Disease</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/poor-infrastructure.svg" alt="Poor Infrastructure" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Poor Infrastructure</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/obstruction.svg" alt="Obstructions" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Obstructions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/electrical-hazard.svg" alt="Electrical Hazard" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Electrical Hazard</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/environmental-hazard.svg" alt="Environmental Hazard" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Environmental Hazard</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/animal-concern.svg" alt="Animal Concerns" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Animal Concerns</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/default.svg" alt="Others" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Others</span>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Facilities Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2">Emergency Facilities</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-3">
                        <img src="/markers/evacuation-center.svg" alt="Evacuation Centers" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Evacuation Centers</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/health-facility.svg" alt="Health Facilities" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Health Facilities</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/police-station.svg" alt="Police Stations" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Police Stations</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/fire-station.svg" alt="Fire Stations" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Fire Stations</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <img src="/markers/government-office.svg" alt="Government Offices" className="w-10 h-10 flex-shrink-0" />
                        <span className="text-sm text-gray-700">Government Offices</span>
                      </div>
                    </div>
                  </div>
                                    </div>
                  </DialogContent>
                </Dialog>

                {/* Export Button */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 bg-green-600 text-white hover:bg-green-700 border-green-600 hover:border-green-700"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export pins to CSV, KML, or GeoJSON</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
                      <FileText className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToKML} className="cursor-pointer">
                      <Globe className="h-4 w-4 mr-2" />
                      Export as KML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToGeoJSON} className="cursor-pointer">
                      <MapPin className="h-4 w-4 mr-2" />
                      Export as GeoJSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
              
              <MapboxMap 
              showControls={true}
              onLegendClick={() => setIsLegendDialogOpen(true)}
              onReportIdClick={(reportId) => {
                // Navigate to ManageReportsPage with the reportId in search
                navigate("/manage-reports", { 
                  state: { searchTerm: reportId } 
                });
              }}
              onZoomChange={(newZoom) => {
                setMapZoom(newZoom);
              }}
              onCenterChange={(newCenter) => {
                setMapCenter(newCenter);
              }}
              onMapClick={async (lngLat) => {
                // If in add placemark mode, place the marker and open the form
                if (isAddPlacemarkMode) {
                  const locationName = await reverseGeocode(lngLat.lat.toString(), lngLat.lng.toString());
                  console.log("=== PLACING PLACEMARK ===");
                  console.log("Coordinates:", { lat: lngLat.lat, lng: lngLat.lng });
                  console.log("Location name:", locationName);
                  setPinModalMode("create");
                  setPinModalPrefill({
                    type: "",
                    title: "",
                    latitude: lngLat.lat,
                    longitude: lngLat.lng,
                    locationName: locationName,
                    reportId: undefined
                  });
                  // Set clicked location to show marker immediately
                  setTempClickedLocation({
                    lat: lngLat.lat,
                    lng: lngLat.lng,
                    locationName: locationName
                  });
                  console.log("Pin modal prefill set with coordinates");
                  setIsPinModalOpen(true);
                  setIsAddPlacemarkMode(false); // Exit add placemark mode
                  setIsFiltersOpen(false);
                  toast.success("Placemark placed! Fill in pin details.");
                  return;
                }
                
                // Reverse geocode to get location name
                const locationName = await reverseGeocode(lngLat.lat.toString(), lngLat.lng.toString());
                
                // If modal is already open (create mode), just update coordinates
                // BUT: Don't update if pin is connected to a report (reportId exists)
                if (isPinModalOpen && pinModalMode === "create") {
                  // Check if pin is connected to a report
                  const hasReportId = pinModalPrefill?.reportId || editingPin?.reportId;
                  
                  if (hasReportId) {
                    // Pin is connected to a report - don't allow location changes
                    toast.info("Location is locked because this pin is connected to a report");
                    return;
                  }
                  
                  setPinModalPrefill(prev => ({
                    ...prev,
                    latitude: lngLat.lat,
                    longitude: lngLat.lng,
                    locationName: locationName
                  }));
                  // Update clicked location marker
                  setTempClickedLocation({
                    lat: lngLat.lat,
                    lng: lngLat.lng,
                    locationName: locationName
                  });
                  toast.success("Location updated!");
                }
              }}
              isAddPlacemarkMode={isAddPlacemarkMode}
              showHeatmap={showHeatmap}
              showDirections={false}
              pins={pins}
              center={mapCenter}
              zoom={mapZoom}
              activeFilters={getActiveFilters()}
              clickedLocation={tempClickedLocation ? {
                lat: tempClickedLocation.lat,
                lng: tempClickedLocation.lng,
                address: tempClickedLocation.locationName
              } : null}
              canEdit={canEditPins() && canDeletePins()}
              onEditPin={handleEditPin}
              onDeletePin={handleDeletePinClick}
              hideStyleToggle={false}
              externalStyle={mapLayerStyle}
              onStyleChange={(style) => setMapLayerStyle(style)}
                      />
            
            {/* Pin Modal for Create/Edit - positioned within map container */}
            <PinModal
              isOpen={isPinModalOpen}
              onClose={() => {
                setIsPinModalOpen(false);
                setPinModalPrefill(undefined);
                setEditingPin(undefined);
                setTempClickedLocation(null); // Clear temporary marker when modal closes
                setIsAddPlacemarkMode(false); // Exit add placemark mode when modal closes
                setIsUnpinMode(false);
              }}
              onSave={handleSavePin}
              mode={pinModalMode}
              existingPin={editingPin}
              prefillData={pinModalPrefill}
              onDelete={handleDeletePinClick}
              canEdit={canEditPins()}
              canDelete={canDeletePins()}
              unpinMode={isUnpinMode}
              onUnpin={handleUnpin}
              onCoordinatesChange={handleCoordinatesChange}
            />
            
            {/* Filters Overlay - positioned within map container */}
            {isFiltersOpen && (
              <div
                className={cn(
                  "bg-white shadow-2xl transition-all duration-300 ease-in-out",
                  "absolute left-4 top-20 bottom-4 w-[450px] z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200"
                )}
              >
                <style>{`
                  .filters-scrollable::-webkit-scrollbar {
                    width: 8px;
                  }
                  .filters-scrollable::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                  }
                  .filters-scrollable::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                  }
                  .filters-scrollable::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                  }
                `}</style>
                {/* Header */}
                <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-[#FF4F0B]" />
                      <h2 className="text-lg font-semibold">Map Filters</h2>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setIsFiltersOpen(false)}
                      className="h-8 w-8 hover:bg-gray-100 p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div 
                  className="flex-1 overflow-y-auto px-6 py-5 filters-scrollable bg-gray-50/30" 
                  style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 #f1f5f9'
                  }}
                >
                  <Accordion type="multiple" defaultValue={["layers", "accidents", "facilities", "custom"]} className="space-y-2">

                    {/* Map Layers */}
                    <AccordionItem value="layers" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-3 px-4 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-2.5">
                          <Layers className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Map Layers</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-3 pb-3 px-4">
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            onClick={() => setLayerFilters(prev => {
                              const newBarangayValue = !prev.barangay;
                              return {
                                ...prev, 
                                barangay: newBarangayValue,
                                barangayLabel: newBarangayValue // Toggle labels together with boundaries
                              };
                            })}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              layerFilters.barangay 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Layers className={cn("h-4 w-4 transition-colors", layerFilters.barangay ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            Barangay Boundaries
                          </button>
                          <button
                            onClick={() => setLayerFilters(prev => ({ ...prev, roadNetwork: !prev.roadNetwork }))}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              layerFilters.roadNetwork 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Navigation className={cn("h-4 w-4 transition-colors", layerFilters.roadNetwork ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            Road Network
                          </button>
                          <button
                            onClick={() => setLayerFilters(prev => ({ ...prev, waterways: !prev.waterways }))}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              layerFilters.waterways 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Waves className={cn("h-4 w-4 transition-colors", layerFilters.waterways ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            Waterways
                          </button>
                          <button
                            onClick={() => setLayerFilters(prev => ({ ...prev, traffic: !prev.traffic }))}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              layerFilters.traffic 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Car className={cn("h-4 w-4 transition-colors", layerFilters.traffic ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            Traffic
                          </button>
                          <button
                            onClick={() => {
                              setLayerFilters(prev => {
                                const newSatelliteValue = !prev.satellite;
                                // Update map style when satellite is toggled
                                setMapLayerStyle(newSatelliteValue ? 'satellite' : 'streets');
                                // When enabling satellite view, also enable barangay boundaries and labels
                                return { 
                                  ...prev, 
                                  satellite: newSatelliteValue,
                                  barangay: newSatelliteValue ? true : prev.barangay, // Enable barangay when satellite is enabled, keep current state when disabled
                                  barangayLabel: newSatelliteValue ? true : prev.barangayLabel // Enable labels when satellite is enabled, keep current state when disabled
                                };
                              });
                            }}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              layerFilters.satellite 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Satellite className={cn("h-4 w-4 transition-colors", layerFilters.satellite ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            Satellite View
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Accident/Hazard Types */}
                    <AccordionItem value="accidents" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-3 px-4 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-2.5">
                          <CircleAlert className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Accident/Hazard Types</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-3 pb-3 px-4">
                        {/* Heatmap Toggle */}
                        <div className="mb-3 pb-3">
                          <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-orange-100 rounded-lg">
                                <Flame className="h-3.5 w-3.5 text-orange-600" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-900 block">Heatmap</span>
                                
                              </div>
                            </div>
                            <Switch
                              checked={showHeatmap}
                              onCheckedChange={setShowHeatmap}
                            />
                          </label>
                        </div>
                        
                        {/* Date Range */}
                        <div className="mb-3 pb-3">
                          <div className="flex flex-col space-y-2">
                            <div>
                              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Date Range</label>
                              <DateRangePicker
                                value={date}
                                onChange={setDate}
                                className="w-auto"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Quick Filters</label>
                              <Select onValueChange={(value) => handleQuickDateFilter(value as 'week' | 'month' | 'year')}>
                                <SelectTrigger className="h-10 border-gray-300 hover:border-gray-300 hover:bg-gray-100">
                                  <SelectValue placeholder="Select quick filter" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="week">This Week</SelectItem>
                                  <SelectItem value="month">This Month</SelectItem>
                                  <SelectItem value="year">This Year</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {/* "All" button for accidents */}
                          <button
                            onClick={() => handleToggleAllAccidents(!showAllAccidents)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              showAllAccidents 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <CircleAlert className={cn("h-4 w-4 transition-colors", showAllAccidents ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            All Accidents/Hazards
                          </button>
                          
                          {Object.entries(accidentFilters).map(([key, checked]) => {
                            const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            const Icon = pinTypeIcons[displayName] || MapPin;
                            return (
                              <button
                                key={key}
                                onClick={() => handleAccidentFilterChange(key as keyof typeof accidentFilters)}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                                  checked 
                                    ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                    : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                                )}
                              >
                                <Icon className={cn("h-4 w-4 transition-colors", checked ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                                {displayName}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Emergency Support Facilities */}
                    <AccordionItem value="facilities" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-3 px-4 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Emergency Support Facilities</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-3 pb-3 px-4">
                        <div className="flex flex-wrap gap-2.5">
                          {/* "All" button for facilities */}
                          <button
                            onClick={() => handleToggleAllFacilities(!showAllFacilities)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                              showAllFacilities 
                                ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                            )}
                          >
                            <Building2 className={cn("h-4 w-4 transition-colors", showAllFacilities ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                            All Facilities
                          </button>
                          
                          {Object.entries(facilityFilters).map(([key, checked]) => {
                            const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            const Icon = facilityIcons[key] || MapPin;
                            return (
                              <button
                                key={key}
                                onClick={() => handleFacilityFilterChange(key as keyof typeof facilityFilters)}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                                  checked 
                                    ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                    : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                                )}
                              >
                                <Icon className={cn("h-4 w-4 transition-colors", checked ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                                {displayName}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Custom Pin Types */}
                    {customPinTypes.length > 0 && (
                      <AccordionItem value="custom" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                        <AccordionTrigger className="py-3 px-4 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-brand-orange" />
                            <span className="text-sm text-brand-orange">Custom Pin Types</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-3 pb-3 px-4">
                          <div className="flex flex-wrap gap-2.5">
                            {customPinTypes.map((customType) => {
                              const key = customType.toLowerCase().replace(/\s+/g, '');
                              const isChecked = customPinFilters[key] ?? false;
                              return (
                                <button
                                  key={customType}
                                  onClick={() => handleCustomPinFilterChange(customType)}
                                  className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all border-2 group",
                                    isChecked 
                                      ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white border-brand-orange" 
                                      : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-brand-orange"
                                  )}
                                >
                                  <MapPin className={cn("h-4 w-4 transition-colors", isChecked ? "text-white" : "text-gray-600 group-hover:text-brand-orange")} />
                                  {customType}
                                </button>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pin? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPinToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </TooltipProvider>
    </Layout>
  );
}
