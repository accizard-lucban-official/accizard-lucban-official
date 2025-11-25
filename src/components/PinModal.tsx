/**
 * PinModal Component
 * 
 * A reusable overlay for creating and editing map pins.
 * Supports three modes:
 * - Create: Add new pin manually
 * - Edit: Update existing pin
 * - FromReport: Create pin from emergency report
 * 
 * Displays as:
 * - Fixed right-side overlay on desktop
 * - Bottom sheet on mobile
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MapPin, X, Type, FileText, MapPin as MapPinIcon, Navigation, Trash2, Plus } from "lucide-react";
import { Pin, PinType } from "@/types/pin";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/sonner";

// Pin type icons mapping (for the select dropdown)
import { Car, Flame, Ambulance, Waves, Mountain, CircleAlert, Users, ShieldAlert, Activity, Building, Building2, Wrench, AlertTriangle, Zap, Leaf, HelpCircle, AlertCircle, Heart } from "lucide-react";

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
  "Others": AlertCircle,
  "Evacuation Centers": Building,
  "Health Facilities": Building2,
  "Police Stations": ShieldAlert,
  "Fire Stations": Flame,
  "Government Offices": Building2,
};

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pinData: PinFormData) => Promise<void>;
  mode: "create" | "edit";
  existingPin?: Pin;
  prefillData?: Partial<PinFormData>;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onDelete?: (pinId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  unpinMode?: boolean;
  onUnpin?: (pinId: string) => Promise<void>;
  onCoordinatesChange?: (coordinates: { lat: number; lng: number }) => void;
}

export interface PinFormData {
  id?: string;
  type: string;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  reportId?: string;
}

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

export function PinModal({
  isOpen,
  onClose,
  onSave,
  mode,
  existingPin,
  prefillData,
  onMapClick,
  onDelete,
  canEdit = true,
  canDelete = true,
  unpinMode = false,
  onUnpin,
  onCoordinatesChange
}: PinModalProps) {
  const [formData, setFormData] = useState<PinFormData>({
    type: "",
    title: "",
    description: "",
    latitude: null,
    longitude: null,
    locationName: "",
    reportId: undefined
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isWaitingForMapClick, setIsWaitingForMapClick] = useState(false);
  const [isAddCustomTypeDialogOpen, setIsAddCustomTypeDialogOpen] = useState(false);
  const [customTypeName, setCustomTypeName] = useState("");
  const [customPinTypes, setCustomPinTypes] = useState<string[]>([]);
  const [coordinatesInput, setCoordinatesInput] = useState("");
  const [coordinatesError, setCoordinatesError] = useState(false);

  // Load custom pin types from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("customPinTypes");
    if (stored) {
      try {
        setCustomPinTypes(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse custom pin types:", e);
      }
    }
  }, []);

  // Initialize form data
  useEffect(() => {
    if (mode === "edit" && existingPin) {
      setFormData({
        id: existingPin.id,
        type: existingPin.type,
        title: existingPin.title,
        description: existingPin.description || "",
        latitude: existingPin.latitude,
        longitude: existingPin.longitude,
        locationName: existingPin.locationName,
        reportId: existingPin.reportId
      });
      // Initialize coordinates input
      if (existingPin.latitude !== null && existingPin.longitude !== null) {
        setCoordinatesInput(`${existingPin.latitude}, ${existingPin.longitude}`);
        setCoordinatesError(false);
      } else {
        setCoordinatesInput("");
        setCoordinatesError(false);
      }
      setIsWaitingForMapClick(false);
    } else if (mode === "create") {
      // Always start with a clean form in create mode
      const baseFormData = {
        type: "",
        title: "",
        description: "",
        latitude: null,
        longitude: null,
        locationName: "",
        reportId: undefined
      };
      
      // Then apply prefillData if provided, checking for explicit values
      if (prefillData) {
        setFormData({
          type: prefillData.type !== undefined ? prefillData.type : baseFormData.type,
          title: prefillData.title !== undefined ? prefillData.title : baseFormData.title,
          description: prefillData.description !== undefined ? prefillData.description : baseFormData.description,
          latitude: prefillData.latitude !== undefined ? prefillData.latitude : baseFormData.latitude,
          longitude: prefillData.longitude !== undefined ? prefillData.longitude : baseFormData.longitude,
          locationName: prefillData.locationName !== undefined ? prefillData.locationName : baseFormData.locationName,
          reportId: prefillData.reportId !== undefined ? prefillData.reportId : baseFormData.reportId
        });
        // Initialize coordinates input
        if (prefillData.latitude !== undefined && prefillData.latitude !== null && 
            prefillData.longitude !== undefined && prefillData.longitude !== null) {
          setCoordinatesInput(`${prefillData.latitude}, ${prefillData.longitude}`);
          setCoordinatesError(false);
        } else {
          setCoordinatesInput("");
          setCoordinatesError(false);
        }
        // Stop waiting for map click if coordinates are provided
        if (prefillData.latitude !== undefined && prefillData.longitude !== undefined) {
          setIsWaitingForMapClick(false);
        } else {
          setIsWaitingForMapClick(true);
        }
      } else {
        // No prefillData, use clean form
        setFormData(baseFormData);
        setCoordinatesInput("");
        setCoordinatesError(false);
        setIsWaitingForMapClick(true); // Start in map click mode for new pins
      }
    }
  }, [mode, existingPin, prefillData, isOpen]);

  // Update locationName when prefillData.locationName changes (e.g., after reverse geocoding)
  useEffect(() => {
    if (prefillData?.locationName && mode === "create") {
      setFormData(prev => ({
        ...prev,
        locationName: prefillData.locationName
      }));
    }
  }, [prefillData?.locationName, mode]);

  // Update coordinatesInput when prefillData coordinates change (from parent component)
  useEffect(() => {
    if (prefillData?.latitude !== undefined && prefillData?.longitude !== undefined &&
        prefillData.latitude !== null && prefillData.longitude !== null &&
        mode === "create") {
      const newInput = `${prefillData.latitude}, ${prefillData.longitude}`;
      setCoordinatesInput(prev => {
        // Only update if different to avoid unnecessary re-renders
        return prev !== newInput ? newInput : prev;
      });
      setCoordinatesError(false);
    }
  }, [prefillData?.latitude, prefillData?.longitude, mode]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // For "Others" and custom types: use user-entered title and description
      // For other accident/hazard types: auto-generate title, no description
      // For emergency facilities: use user-entered title and description
      const isOthersOrCustom = formData.type === "Others" || customPinTypes.includes(formData.type);
      const isAccidentHazard = accidentHazardTypes.includes(formData.type) || customPinTypes.includes(formData.type);
      
      let finalPinData: PinFormData;
      
      if (isOthersOrCustom) {
        // For "Others" and custom types, use user-entered title and description
        finalPinData = {
          ...formData,
          title: formData.title.trim() || `${formData.type || 'Pin'}${formData.locationName ? ` - ${formData.locationName}` : ''}`,
          description: formData.description || ""
        };
      } else if (isAccidentHazard) {
        // Auto-generate title based on type and location
        const autoTitle = formData.type 
          ? `${formData.type}${formData.locationName ? ` - ${formData.locationName}` : ''}`
          : formData.locationName || 'Untitled Pin';
        
        finalPinData = {
          ...formData,
          title: autoTitle,
          description: "" // Set description to empty string for accident/hazard types
        };
      } else {
        // For emergency facilities, use the user-entered title and description
        // If title is empty, provide a default
        finalPinData = {
          ...formData,
          title: formData.title.trim() || `${formData.type || 'Facility'}${formData.locationName ? ` - ${formData.locationName}` : ''}`,
          description: formData.description || ""
        };
      }
      
      await onSave(finalPinData);
      onClose();
    } catch (error) {
      console.error("Error saving pin:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && existingPin?.id) {
      onDelete(existingPin.id);
      onClose();
    }
  };

  const handleUnpin = async () => {
    if (onUnpin && existingPin?.id) {
      try {
        setIsSaving(true);
        await onUnpin(existingPin.id);
        toast.success("Pin removed from map successfully");
        onClose();
      } catch (error: any) {
        console.error("Error unpinning:", error);
        toast.error(error.message || "Failed to unpin");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleReset = () => {
    setFormData({
      type: "",
      title: "",
      description: "",
      latitude: null,
      longitude: null,
      locationName: "",
      reportId: undefined
    });
    setCoordinatesInput("");
    setCoordinatesError(false);
    setIsWaitingForMapClick(true);
  };

  const handleAddCustomType = () => {
    if (!customTypeName.trim()) {
      toast.error("Please enter a pin type name");
      return;
    }

    const trimmedName = customTypeName.trim();
    
    // Check if it already exists
    const allTypes = [...accidentHazardTypes, ...emergencyFacilityTypes, ...customPinTypes];
    if (allTypes.includes(trimmedName)) {
      toast.error("This pin type already exists");
      return;
    }

    // Add to custom types
    const updated = [...customPinTypes, trimmedName];
    setCustomPinTypes(updated);
    localStorage.setItem("customPinTypes", JSON.stringify(updated));
    
    // Set the new type as selected
    setFormData({ ...formData, type: trimmedName });
    
    // Close dialog and reset
    setIsAddCustomTypeDialogOpen(false);
    setCustomTypeName("");
    toast.success(`"${trimmedName}" added successfully`);
  };

  const handleChangeLocation = () => {
    setIsWaitingForMapClick(true);
    if (onMapClick) {
      // Signal to parent that we're waiting for map click
    }
  };

  const isValid = () => {
    // Only pin type is required
    return formData.type.trim().length > 0;
  };

  const isFromReport = !!prefillData?.reportId || !!(existingPin && existingPin.reportId);
  const isCustomPin = mode === "edit" && existingPin && !existingPin.reportId;
  const isUnpinningFromReport = unpinMode && isFromReport;
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  return (
    <>
      {/* Custom scrollbar styles */}
      <style>{`
        .pin-modal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .pin-modal-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .pin-modal-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .pin-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {/* Mobile Backdrop - only show on mobile */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Floating Modal Panel */}
      <div 
        className={cn(
          "bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col",
          // Desktop: Overlay on left side within map container, below toolbar
          "md:absolute md:left-4 md:top-20 md:bottom-4 md:w-[420px] lg:w-[450px] md:z-50 md:rounded-lg md:border md:border-gray-200 md:overflow-hidden",
          // Mobile: Bottom sheet (fixed for mobile)
          "fixed bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl z-50"
        )}
      >
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#FF4F0B]" />
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === "create" ? "Add New Pin" : "Edit Pin"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isFromReport && (
                <Badge variant="outline" className="text-xs bg-brand-orange/10 text-brand-orange border-brand-orange rounded-md px-2.5 py-1">
                  From Report
                </Badge>
              )}
              {isCustomPin && (
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-300 rounded-md px-2.5 py-1">
                  Custom Pin
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="h-8 w-8 hover:bg-gray-100 group p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          className="pin-modal-scroll px-4 sm:px-6 pt-3 pb-4 flex-1 overflow-y-auto" 
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9',
            minHeight: 0
          }}
        >
          <div className="space-y-3">
          {/* Location Section - Moved to top */}
          <div className="space-y-2">
            {/* Location Name */}
            <div className="space-y-1">
              <Label htmlFor="location-name" className="text-sm font-medium text-gray-700">
                Location Name
              </Label>
              <Input
                id="location-name"
                placeholder="Location will be set automatically"
                value={formData.locationName}
                readOnly={isFromReport || mode === "edit" || isUnpinningFromReport}
                disabled={isFromReport || mode === "edit" || isUnpinningFromReport}
                className="h-10 bg-gray-50 cursor-not-allowed border-gray-200"
              />
            </div>

            {/* Coordinates */}
            <div className="space-y-1">
              <Label htmlFor="coordinates" className="text-sm font-medium text-gray-700">
                Coordinates
              </Label>
              <Input
                id="coordinates"
                type="text"
                placeholder="Latitude, Longitude (e.g., 14.1139, 121.5556)"
                value={coordinatesInput}
                readOnly={isFromReport || isUnpinningFromReport}
                disabled={isFromReport || isUnpinningFromReport}
                onChange={(e) => {
                  if (isFromReport || isUnpinningFromReport) return;
                  const val = e.target.value;
                  
                  // Update input value immediately for free typing
                  setCoordinatesInput(val);
                  
                  const trimmedVal = val.trim();
                  if (trimmedVal === '') {
                    setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
                    setCoordinatesError(false);
                    if (onCoordinatesChange) {
                      onCoordinatesChange({ lat: 0, lng: 0 }); // Clear marker
                    }
                    return;
                  }
                  
                  // Parse "Latitude, Longitude" format
                  const parts = trimmedVal.split(',').map(p => p.trim());
                  
                  // Check for error: text entered but no comma, or comma but invalid values
                  if (parts.length === 1) {
                    // Has text but no comma - show error
                    setCoordinatesError(true);
                    setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
                  } else if (parts.length === 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                      // Valid coordinates - clear error
                      setCoordinatesError(false);
                      
                      // Validate latitude range (-90 to 90)
                      const validLat = Math.max(-90, Math.min(90, lat));
                      // Validate longitude range (-180 to 180)
                      const validLng = Math.max(-180, Math.min(180, lng));
                      
                      setFormData(prev => ({ ...prev, latitude: validLat, longitude: validLng }));
                      
                      // Notify parent to update marker position
                      if (onCoordinatesChange) {
                        onCoordinatesChange({ lat: validLat, lng: validLng });
                      }
                    } else {
                      // Has comma but invalid numbers - show error
                      setCoordinatesError(true);
                      setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
                    }
                  } else {
                    // More than 2 parts (multiple commas) - show error
                    setCoordinatesError(true);
                    setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
                  }
                }}
                className={cn(
                  "h-10",
                  (isFromReport || isUnpinningFromReport)
                    ? "bg-gray-50 cursor-not-allowed border-gray-200" 
                    : coordinatesError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-gray-300 focus:border-black focus:ring-black/20"
                )}
              />
              {coordinatesError && (
                <p className="text-xs text-red-500 mt-1">
                  Please enter coordinates in the format: Latitude, Longitude (e.g., 14.1139, 121.5556)
                </p>
              )}
              {!coordinatesError && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter coordinates manually or click on the map. Marker will update automatically when both values are entered.
                </p>
              )}
            </div>
          </div>

          {/* Pin Type */}
          <div className="space-y-1.5">
            <Label htmlFor="pin-type" className="text-sm font-medium text-gray-700">
              Pin Type <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                disabled={isFromReport || isUnpinningFromReport}
                className="flex-1"
              >
                <SelectTrigger className={cn(
                  "h-10 border-gray-300 focus:border-black focus:ring-black/20",
                  isFromReport && "bg-gray-50 cursor-not-allowed"
                )}>
                  <SelectValue placeholder="Select pin type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-sm font-semibold text-gray-700 px-2 py-2">
                      Accident/Hazard Types
                    </SelectLabel>
                    {accidentHazardTypes.map((type) => {
                      const Icon = pinTypeIcons[type] || MapPin;
                      return (
                        <SelectItem key={type} value={type} className="group">
                          <div className="flex items-center">
                            <Icon className="h-4 w-4 mr-2 text-gray-500 group-hover:text-brand-orange transition-colors" />
                            {type}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                  
                  <SelectGroup>
                    <SelectLabel className="text-sm font-semibold text-gray-700 px-2 py-2">
                      Emergency Facilities
                    </SelectLabel>
                    {emergencyFacilityTypes.map((type) => {
                      const Icon = pinTypeIcons[type] || MapPin;
                      return (
                        <SelectItem key={type} value={type} className="group">
                          <div className="flex items-center">
                            <Icon className="h-4 w-4 mr-2 text-gray-500 group-hover:text-brand-orange transition-colors" />
                            {type}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                  
                  {customPinTypes.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-sm font-semibold text-gray-700 px-2 py-2">
                        Custom Types
                      </SelectLabel>
                      {customPinTypes.map((type) => {
                        const Icon = AlertCircle; // Use AlertCircle icon for custom types
                        return (
                          <SelectItem key={type} value={type} className="group">
                            <div className="flex items-center">
                              <Icon className="h-4 w-4 mr-2 text-gray-500 group-hover:text-brand-orange transition-colors" />
                              {type}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 border-gray-300 hover:bg-gray-50"
                onClick={() => setIsAddCustomTypeDialogOpen(true)}
                disabled={isFromReport || isUnpinningFromReport}
                title="Add custom pin type"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Report ID - Show for all Accident/Hazard types, but only if pin has reportId */}
          {(accidentHazardTypes.includes(formData.type) || customPinTypes.includes(formData.type)) && (isFromReport || (mode === "edit" && existingPin?.reportId)) && (
            <div className="space-y-1">
              <Label htmlFor="report-id" className="text-sm font-medium text-gray-700">
                Report ID
              </Label>
              <div className="relative">
                <div className="flex items-center">
                  <div className="flex items-center px-3 h-10 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md text-sm font-medium text-gray-700">
                    RID
                  </div>
                  <Input
                    id="report-id"
                    type="text"
                    placeholder={prefillData?.reportId ? "Enter report ID number" : "Not linked to a report"}
                    value={formData.reportId || ''}
                    onChange={(e) => {
                      // Only allow numeric characters
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, reportId: value || undefined });
                    }}
                    disabled={(mode === "create" && isFromReport) || (mode === "create" && !prefillData?.reportId) || (mode === "edit" && isFromReport)}
                    readOnly={(mode === "create" && isFromReport) || (mode === "edit" && isFromReport)}
                    className={cn(
                      "h-10 rounded-l-none border-l-0 border-gray-300 focus:border-black focus:ring-black/20",
                      ((mode === "create" && isFromReport) || (mode === "create" && !prefillData?.reportId) || (mode === "edit" && isFromReport)) ? "bg-gray-50 cursor-not-allowed" : ""
                    )}
                  />
                </div>
                {mode === "create" && !prefillData?.reportId && (
                  <p className="text-xs text-gray-500 mt-1">Report ID is only available when pinning from a report</p>
                )}
              </div>
            </div>
          )}

          {/* Title - Show for Emergency Facilities, "Others", and Custom Types */}
          {(emergencyFacilityTypes.includes(formData.type) || formData.type === "Others" || customPinTypes.includes(formData.type)) && (
            <div className="space-y-1.5">
              <Label htmlFor={emergencyFacilityTypes.includes(formData.type) ? "facility-name" : "pin-title"} className="text-sm font-medium text-gray-700">
                {emergencyFacilityTypes.includes(formData.type) ? "Facility Name" : "Title"}
              </Label>
              <div className="relative">
                <Input
                  id={emergencyFacilityTypes.includes(formData.type) ? "facility-name" : "pin-title"}
                  placeholder={emergencyFacilityTypes.includes(formData.type) ? "Enter facility name" : "Enter pin title"}
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                  }}
                  readOnly={isUnpinningFromReport}
                  disabled={isUnpinningFromReport}
                  className={cn(
                    "h-10",
                    isUnpinningFromReport ? "bg-gray-50 cursor-not-allowed border-gray-200" : "border-gray-300 focus:border-black focus:ring-black/20"
                  )}
                />
              </div>
            </div>
          )}

          {/* Description - Show for Emergency Facilities, "Others", and Custom Types */}
          {(emergencyFacilityTypes.includes(formData.type) || formData.type === "Others" || customPinTypes.includes(formData.type)) && (
            <div className="space-y-1.5">
              <Label htmlFor="pin-description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <div className="relative">
                <Textarea
                  id="pin-description"
                  placeholder={emergencyFacilityTypes.includes(formData.type) ? "Enter facility description" : "Enter pin description"}
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                  }}
                  readOnly={isUnpinningFromReport}
                  disabled={isUnpinningFromReport}
                  rows={2}
                  className={cn(
                    "resize-none min-h-[60px]",
                    isUnpinningFromReport ? "bg-gray-50 cursor-not-allowed border-gray-200" : "border-gray-300 focus:border-black focus:ring-black/20"
                  )}
                />
              </div>
            </div>
          )}

          {/* Map Click Helper - Hide when pin is connected to a report */}
          {isWaitingForMapClick && !isFromReport && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Set Location on Map
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Click on the map to set coordinates automatically
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Info message when pin is connected to a report */}
          {isFromReport && (
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-900">
                    Location Locked
                  </p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    This pin is connected to a report. Location cannot be changed.
                  </p>
                </div>
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Action Buttons - Footer */}
        <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-shrink-0">
          <div className="flex gap-3">
            {/* Unpin mode from report: Show only Unpin button */}
            {isUnpinningFromReport && onUnpin && existingPin?.id && (
              <Button 
                onClick={handleUnpin} 
                className="flex-1 h-10 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium shadow-sm hover:shadow-md transition-all"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Unpinning...
                  </>
                ) : (
                  "Unpin"
                )}
              </Button>
            )}
            
            {/* Pin from report in edit mode: Show only Unpin button */}
            {!isUnpinningFromReport && mode === "edit" && isFromReport && onUnpin && existingPin?.id && (
              <Button 
                onClick={handleUnpin} 
                className="flex-1 h-10 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium shadow-sm hover:shadow-md transition-all"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Unpinning...
                  </>
                ) : (
                  "Unpin"
                )}
              </Button>
            )}
            
            {/* Custom pin in edit mode: Show both Unpin and Save buttons */}
            {!isUnpinningFromReport && mode === "edit" && isCustomPin && onUnpin && existingPin?.id && (
              <Button 
                onClick={handleUnpin} 
                variant="outline"
                className="h-10 px-4 border-gray-300 hover:bg-gray-100"
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Unpin
              </Button>
            )}
            
            {/* Regular delete button (for non-unpin scenarios) */}
            {!isUnpinningFromReport && mode === "edit" && onDelete && existingPin?.id && !isCustomPin && !isFromReport && (
              canDelete ? (
                <Button 
                  onClick={handleDelete} 
                  variant="destructive"
                  className="h-10 px-4 border-red-300 hover:bg-red-600 hover:border-red-400"
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              ) : (
                <Button 
                  variant="destructive"
                  className="h-10 px-4 border-red-300 opacity-50 cursor-not-allowed"
                  disabled
                  title="You don't have permission to delete pins. Contact your super admin for access."
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )
            )}
            
            {/* Save button - hidden in unpin mode from report and when editing pins from report, shown otherwise */}
            {!isUnpinningFromReport && !(mode === "edit" && isFromReport) && (
              <Button 
                onClick={handleSave} 
                className="flex-1 h-10 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium shadow-sm hover:shadow-md transition-all"
                disabled={!isValid() || isSaving || (mode === "edit" && !canEdit)}
                title={mode === "edit" && !canEdit ? "You don't have permission to edit pins. Contact your super admin for access." : undefined}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  mode === "create" ? "Add Pin" : "Save Changes"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add Custom Pin Type Dialog */}
      <Dialog open={isAddCustomTypeDialogOpen} onOpenChange={setIsAddCustomTypeDialogOpen}>
        <DialogContent 
          className="sm:max-w-[425px] z-[1010]"
          overlayClassName="z-[1005]"
        >
          <DialogHeader>
            <div className="flex items-center gap-2 pb-2 border-b">
              <Plus className="h-5 w-5 text-brand-orange" />
              <DialogTitle className="text-lg font-semibold">Add Custom Pin Type</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Enter a name for the new pin type. Custom pin types will be categorized under "Others" and use the default marker icon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-type-name" className="text-sm font-medium text-gray-700">
                Pin Type Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="custom-type-name"
                placeholder="e.g., Chemical Spill, Gas Leak, etc."
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddCustomType();
                  }
                }}
                className="h-10 border-gray-300 focus:border-black focus:ring-black/20"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCustomTypeDialogOpen(false);
                setCustomTypeName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomType}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white"
              disabled={!customTypeName.trim()}
            >
              Add Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

