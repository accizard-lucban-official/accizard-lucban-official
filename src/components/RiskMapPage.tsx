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
import { Plus, MapPin, Layers, CalendarIcon, Search, Building2, Ambulance, Waves, Mountain, Building, CircleAlert, Users, ShieldAlert, Activity, Flame, Car, Siren, Home, Navigation, RotateCcw, HelpCircle, Info, ZoomIn, ZoomOut, LocateFixed, X, Filter, Download, FileText, Globe } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { cn, ensureOk } from "@/lib/utils";
import { Layout } from "./Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DateRange } from "react-day-picker";
import { MapboxMap } from "./MapboxMap";
import { usePins } from "@/hooks/usePins";
import { Pin, PinType } from "@/types/pin";
import { toast } from "@/components/ui/sonner";
import { PinModal, PinFormData } from "./PinModal";
import { CompactPinForm } from "./CompactPinForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

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
  const [isLegendDialogOpen, setIsLegendDialogOpen] = useState(false);
  const [tempClickedLocation, setTempClickedLocation] = useState<{ lat: number; lng: number; locationName: string } | null>(null);
  const [compactFormPosition, setCompactFormPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  
  // Filters Panel State
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [mapLayerStyle, setMapLayerStyle] = useState<'streets' | 'satellite'>('streets');
  
  // Add Placemark Mode State
  const [isAddPlacemarkMode, setIsAddPlacemarkMode] = useState(false);

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
    others: false
  });

  const [facilityFilters, setFacilityFilters] = useState({
    evacuationCenters: false,
    healthFacilities: false,
    policeStations: false,
    fireStations: false,
    governmentOffices: false
  });

  const [layerFilters, setLayerFilters] = useState({
    barangay: false, // Hidden by default (lucban-boundary stays visible)
    barangayLabel: false, // Hidden by default
    roadNetwork: false, // Hidden by default
    waterways: false, // Hidden by default
    traffic: false // Hidden by default
  });


  // Accident/Hazard types
  const accidentHazardTypes = [
    "Road Crash", "Fire", "Medical Emergency", "Flooding", "Volcanic Activity",
    "Landslide", "Earthquake", "Civil Disturbance", "Armed Conflict", "Infectious Disease", "Others"
  ];

  // Emergency facility types
  const emergencyFacilityTypes = [
    "Evacuation Centers", "Health Facilities", "Police Stations", "Fire Stations", "Government Offices"
  ];

  // Combined pin types (for backward compatibility)
  const pinTypes = [...accidentHazardTypes, ...emergencyFacilityTypes];

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

  // Effect to populate modal when navigating from a report
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
      setIsPinModalOpen(true);
      setIsFiltersOpen(false); // Close filter panel when pin modal opens
      
      // Clear the location state to prevent it from persisting on refresh
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
      others: false,
      [key]: true
    };
    
    setAccidentFilters(newFilters);
  };

  const handleFacilityFilterChange = (key: keyof typeof facilityFilters) => {
    const isCurrentlyChecked = facilityFilters[key];
    
    // If unchecking, allow it
    if (isCurrentlyChecked) {
      setFacilityFilters(prev => ({ ...prev, [key]: false }));
      return;
    }
    
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

  const handleSelectAllAccidents = (checked: boolean) => {
    if (checked) {
      // Count total if we select all accidents
      const accidentCount = Object.keys(accidentFilters).length;
      const facilityActiveCount = Object.values(facilityFilters).filter(Boolean).length;
      const totalWouldBe = accidentCount + facilityActiveCount;
      
      if (totalWouldBe > 10) {
        toast.error('Cannot select all: Maximum 10 filter types allowed. Please unselect some facility filters first.');
        return;
      }
    }
    
    const newFilters = {
      roadCrash: checked,
      fire: checked,
      medicalEmergency: checked,
      flooding: checked,
      volcanicActivity: checked,
      landslide: checked,
      earthquake: checked,
      civilDisturbance: checked,
      armedConflict: checked,
      infectiousDisease: checked,
      others: checked
    };
    setAccidentFilters(newFilters);
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
    } catch (error: any) {
      console.error("Error saving pin:", error);
      toast.error(error.message || "Failed to save pin");
      throw error; // Re-throw to keep modal open
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
    const activeAccidentTypes = Object.entries(accidentFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => convertFilterKeyToType(key));

    const activeFacilityTypes = Object.entries(facilityFilters)
      .filter(([_, isActive]) => isActive)
      .map(([key]) => convertFilterKeyToType(key));

    return {
      accidentTypes: activeAccidentTypes,
      facilityTypes: activeFacilityTypes,
      layerFilters: layerFilters
    };
  };

  // Get active filter types as PinType array
  const getActiveFilterTypes = (): PinType[] => {
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
    
    return activeTypes;
  };


  // Subscribe to pins from database with real-time updates
  useEffect(() => {
    const activeTypes = getActiveFilterTypes();
    
    // Build filter object
    const filters: any = {
      searchQuery: searchQuery
    };

    // Since we enforce a 10-item limit, we can safely use Firestore filtering
    if (activeTypes.length > 0) {
      filters.types = activeTypes;
    }

    // Add date range filters
    if (date?.from) {
      filters.dateFrom = date.from;
    }
    if (date?.to) {
      filters.dateTo = date.to;
    }

    const unsubscribe = subscribeToPins(
      filters,
      (fetchedPins) => {
        setPins(fetchedPins);
      },
      (error) => {
        // Only show error toast if it's a real error, not just "no pins found"
        if (error.message && !error.message.includes('permission-denied')) {
          toast.error('Failed to fetch pins from database');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [accidentFilters, facilityFilters, date, searchQuery, subscribeToPins]);

  return (
    <Layout>
      <TooltipProvider>
        <div className="flex h-[calc(100vh-12rem)] min-h-[650px] -mx-6 -my-6">
          {/* Map takes full width - no sidebar */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Map Container */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden min-h-0 rounded-xl">
              {/* Map Toolbar - Positioned inside map at top */}
              <div className="absolute top-4 left-4 right-4 z-10 bg-white border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg rounded-lg">
                <div className="flex-1 relative">
                  <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                        <Input
                          type="text"
                          placeholder="Search for a location..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => {
                            if (searchSuggestions.length > 0) {
                              setIsSearchOpen(true);
                            }
                          }}
                          className="pl-9 pr-4 h-9 w-full border-gray-300"
                        />
                      </div>
                    </PopoverTrigger>
                    {searchSuggestions.length > 0 && (
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="max-h-[300px] overflow-y-auto">
                          {searchSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors"
                              onClick={() => handleSelectSearchResult(suggestion)}
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
                      </PopoverContent>
                    )}
                  </Popover>
                </div>

                {/* Add Placemark Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 px-3",
                        isAddPlacemarkMode && "bg-brand-orange text-white hover:bg-brand-orange/90"
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
                          className="h-9 px-3"
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
              onMapClick={async (lngLat, event?) => {
                // If in add placemark mode, place the marker and open the compact form
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
                  
                  // Calculate position for compact form (near the clicked point)
                  if (event && event.point) {
                    // Get the map container to calculate absolute position
                    const mapContainer = event.target.getContainer();
                    if (mapContainer) {
                      const rect = mapContainer.getBoundingClientRect();
                      setCompactFormPosition({
                        x: rect.left + event.point.x,
                        y: rect.top + event.point.y
                      });
                    } else {
                      setCompactFormPosition(null);
                    }
                  } else {
                    // Fallback: position in top-right
                    setCompactFormPosition(null);
                  }
                  
                  setIsAddPlacemarkMode(false); // Exit add placemark mode
                  setIsFiltersOpen(false);
                  toast.success("Placemark placed! Fill in pin details.");
                  return;
                }
                
                // Reverse geocode to get location name
                const locationName = await reverseGeocode(lngLat.lat.toString(), lngLat.lng.toString());
                
                // If modal is already open (create mode), just update coordinates
                if (isPinModalOpen && pinModalMode === "create") {
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
              canEdit={true}
              onEditPin={handleEditPin}
              onDeletePin={handleDeletePinClick}
              hideStyleToggle={false}
              externalStyle={mapLayerStyle}
              onStyleChange={(style) => setMapLayerStyle(style)}
                      />
            
            {/* Compact Pin Form - appears on map when placing placemark */}
            {pinModalMode === "create" && pinModalPrefill && (
              <CompactPinForm
                isOpen={!!pinModalPrefill}
                onClose={() => {
                  setPinModalPrefill(undefined);
                  setTempClickedLocation(null);
                  setCompactFormPosition(null);
                  setIsAddPlacemarkMode(false);
                }}
                onSave={async (pinData) => {
                  await handleSavePin(pinData);
                  setPinModalPrefill(undefined);
                  setTempClickedLocation(null);
                  setCompactFormPosition(null);
                }}
                prefillData={pinModalPrefill}
                position={compactFormPosition || undefined}
              />
            )}

            {/* Pin Modal for Edit - positioned within map container */}
            <PinModal
              isOpen={isPinModalOpen && pinModalMode === "edit"}
              onClose={() => {
                setIsPinModalOpen(false);
                setPinModalPrefill(undefined);
                setEditingPin(undefined);
                setTempClickedLocation(null);
                setIsAddPlacemarkMode(false);
              }}
              onSave={handleSavePin}
              mode={pinModalMode}
              existingPin={editingPin}
              prefillData={pinModalPrefill}
            />
            
            {/* Filters Overlay - positioned within map container */}
            {isFiltersOpen && (
              <div
                className={cn(
                  "bg-white transition-transform duration-300 ease-in-out",
                  "absolute left-0 top-0 h-full w-[450px] z-50 flex flex-col overflow-hidden"
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
                      className="h-8 w-8"
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
                  <Accordion type="multiple" defaultValue={["timeline", "layers", "accidents", "facilities"]} className="space-y-3">
                    {/* Timeline */}
                    <AccordionItem value="timeline" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-4 px-5 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Timeline</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-5 px-5">
                        <div className="flex flex-col space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-700 mb-2 block">Date Range</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-10 border-gray-300 hover:border-gray-300 hover:bg-gray-100",
                                    !date?.from && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date?.from ? (
                                    date.to ? (
                                      <>
                                        {format(date.from, "LLL dd, y")} -{" "}
                                        {format(date.to, "LLL dd, y")}
                                      </>
                                    ) : (
                                      format(date.from, "LLL dd, y")
                                    )
                                  ) : (
                                    <span>Pick a date range</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  initialFocus
                                  mode="range"
                                  defaultMonth={date?.from}
                                  selected={date}
                                  onSelect={setDate}
                                  numberOfMonths={2}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-700 mb-2 block">Quick Filters</label>
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
                      </AccordionContent>
                    </AccordionItem>

                    {/* Map Layers */}
                    <AccordionItem value="layers" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-4 px-5 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-3">
                          <Layers className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Map Layers</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-5 px-5">
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
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Accident/Hazard Types */}
                    <AccordionItem value="accidents" className="mb-0 border-b-0 bg-white rounded-xl overflow-hidden">
                      <AccordionTrigger className="py-4 px-5 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-3">
                          <CircleAlert className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Accident/Hazard Types</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-5 px-5">
                      
                        {/* Heatmap Toggle */}
                        <div className="mb-5 pb-4 border-b border-gray-200">
                          <label className="flex items-center justify-between cursor-pointer group p-3 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                                <Flame className="h-4 w-4 text-orange-600" />
                              </div>
                              <div>
                                <span className="text-m font-semibold text-gray-900 block">Heatmap</span>
                                
                              </div>
                            </div>
                            <Switch
                              checked={showHeatmap}
                              onCheckedChange={setShowHeatmap}
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
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
                      <AccordionTrigger className="py-4 px-5 text-sm font-semibold hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 hover:from-orange-100 hover:to-orange-200/50 transition-all">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-brand-orange" />
                          <span className="text-sm text-brand-orange">Emergency Support Facilities</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-5 px-5">
                        <div className="flex flex-wrap gap-2.5">
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
