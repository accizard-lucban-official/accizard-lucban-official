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
import { MapPin, X, Type, FileText, MapPin as MapPinIcon, Navigation, Trash2 } from "lucide-react";
import { Pin, PinType } from "@/types/pin";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// Pin type icons mapping (for the select dropdown)
import { Car, Flame, Ambulance, Waves, Mountain, CircleAlert, Users, ShieldAlert, Activity, Building, Building2, Wrench, AlertTriangle, Zap, Leaf, HelpCircle } from "lucide-react";

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
  "Others": HelpCircle,
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
  "Poor Infrastructure", "Obstructions", "Electrical Hazard", "Environmental Hazard"
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
  canDelete = true
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
        // Stop waiting for map click if coordinates are provided
        if (prefillData.latitude !== undefined && prefillData.longitude !== undefined) {
          setIsWaitingForMapClick(false);
        } else {
          setIsWaitingForMapClick(true);
        }
      } else {
        // No prefillData, use clean form
        setFormData(baseFormData);
        setIsWaitingForMapClick(true); // Start in map click mode for new pins
      }
    }
  }, [mode, existingPin, prefillData, isOpen]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(formData);
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
    setIsWaitingForMapClick(true);
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

  const isFromReport = !!prefillData?.reportId;
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

      {/* Overlay Panel */}
      <div 
        className={cn(
          "bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          // Desktop: Right side overlay within map container
          "md:absolute md:right-0 md:top-0 md:h-full md:w-[420px] lg:w-[450px] md:z-50",
          // Mobile: Bottom sheet (fixed for mobile)
          "fixed bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl z-50",
          "md:rounded-none"
        )}
        style={{
          // Ensure it stays within bounds on desktop
          ...(isMobile ? {} : { 
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100%',
            zIndex: 50
          })
        }}
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
                <Badge variant="secondary" className="text-xs">
                  From Report
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
          {/* Pin Type */}
          <div className="space-y-1">
            <Label htmlFor="pin-type" className="text-sm font-medium text-gray-700">
              Pin Type <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({ ...formData, type: value })}
              disabled={isFromReport}
            >
              <SelectTrigger className={cn(
                "h-10 border-gray-300 focus:border-black focus:ring-black/20",
                isFromReport && "bg-gray-50 cursor-not-allowed"
              )}>
                <SelectValue placeholder="Select pin type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-gray-600 px-2 py-1.5">
                    Accident/Hazard Types
                  </SelectLabel>
                  {accidentHazardTypes.map((type) => {
                    const Icon = pinTypeIcons[type] || MapPin;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center">
                          <Icon className="h-4 w-4 mr-2 text-gray-500" />
                          {type}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
                
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-gray-600 px-2 py-1.5">
                    Emergency Facilities
                  </SelectLabel>
                  {emergencyFacilityTypes.map((type) => {
                    const Icon = pinTypeIcons[type] || MapPin;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center">
                          <Icon className="h-4 w-4 mr-2 text-gray-500" />
                          {type}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Report ID - Only show for Accident/Hazard types */}
          {accidentHazardTypes.includes(formData.type) && (
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
                    placeholder="Enter report ID number"
                    value={formData.reportId || ''}
                    onChange={(e) => {
                      // Only allow numeric characters
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, reportId: value || undefined });
                    }}
                    className="h-10 rounded-l-none border-l-0 border-gray-300 focus:border-black focus:ring-black/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="pin-title" className="text-sm font-medium text-gray-700">
              Title
            </Label>
            <div className="relative">
              <Input
                id="pin-title"
                placeholder="Enter marker title"
                value={formData.title}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 60) {
                    setFormData({ ...formData, title: value });
                  }
                }}
                maxLength={60}
                className="h-10 border-gray-300 focus:border-black focus:ring-black/20"
              />
              <div className="text-xs text-gray-500 mt-0.5 text-right">
                <span className={formData.title.length === 60 ? "text-orange-600 font-medium" : ""}>
                  {formData.title.length}/60
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pin-description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <div className="relative">
              <Textarea
                id="pin-description"
                placeholder="Enter pin description"
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 120) {
                    setFormData({ ...formData, description: value });
                  }
                }}
                maxLength={120}
                rows={2}
                className="resize-none border-gray-300 focus:border-black focus:ring-black/20 min-h-[60px]"
              />
              <div className="text-xs text-gray-500 mt-0.5 text-right">
                <span className={formData.description.length === 120 ? "text-orange-600 font-medium" : ""}>
                  {formData.description.length}/120
                </span>
              </div>
            </div>
          </div>

          {/* Location Section */}
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
                readOnly
                className="bg-gray-50 cursor-not-allowed border-gray-200 h-10"
              />
            </div>

            {/* Coordinates */}
            <div className="space-y-1 mb-4">
              <Label htmlFor="coordinates" className="text-sm font-medium text-gray-700">
                Coordinates
              </Label>
              <Input
                id="coordinates"
                type="text"
                placeholder="Latitude, Longitude (e.g., 14.1139, 121.5556)"
                value={
                  formData.latitude !== null && formData.latitude !== undefined &&
                  formData.longitude !== null && formData.longitude !== undefined
                    ? `${formData.latitude}, ${formData.longitude}`
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === '') {
                    setFormData({ ...formData, latitude: null, longitude: null });
                    return;
                  }
                  
                  // Parse "Latitude, Longitude" format
                  const parts = val.split(',').map(p => p.trim());
                  if (parts.length === 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                      setFormData({ ...formData, latitude: lat, longitude: lng });
                    }
                  }
                  // If only one value is entered, don't update yet (wait for comma and second value)
                }}
                className="h-10 border-gray-300 focus:border-black focus:ring-black/20"
              />
            </div>
          </div>

          {/* Map Click Helper */}
          {isWaitingForMapClick && (
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

          </div>
        </div>

        {/* Action Buttons - Footer */}
        <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-shrink-0">
          <div className="flex gap-3">
            {mode === "edit" && onDelete && existingPin?.id && (
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
          </div>
        </div>
      </div>
    </>
  );
}

