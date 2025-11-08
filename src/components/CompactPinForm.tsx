/**
 * CompactPinForm Component
 * 
 * A compact form that appears on the map as a popup when placing a new pin.
 * Contains the same fields as PinModal but in a more compact format.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { X } from "lucide-react";
import { PinFormData } from "./PinModal";
import { cn } from "@/lib/utils";

// Pin type icons mapping
import { Car, Flame, Ambulance, Waves, Mountain, CircleAlert, Users, ShieldAlert, Activity, Building, Building2, MapPin } from "lucide-react";

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
  "Evacuation Centers": Building,
  "Health Facilities": Building2,
  "Police Stations": ShieldAlert,
  "Fire Stations": Flame,
  "Government Offices": Building2,
};

// Accident/Hazard types
const accidentHazardTypes = [
  "Road Crash", "Fire", "Medical Emergency", "Flooding", "Volcanic Activity",
  "Landslide", "Earthquake", "Civil Disturbance", "Armed Conflict", "Infectious Disease"
];

// Emergency facility types
const emergencyFacilityTypes = [
  "Evacuation Centers", "Health Facilities", "Police Stations", "Fire Stations", "Government Offices"
];

interface CompactPinFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pinData: PinFormData) => Promise<void>;
  prefillData?: Partial<PinFormData>;
  position?: { x: number; y: number };
}

export function CompactPinForm({
  isOpen,
  onClose,
  onSave,
  prefillData,
  position
}: CompactPinFormProps) {
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
  const formRef = useRef<HTMLDivElement>(null);

  // Initialize form data
  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({
        type: prefillData.type || prev.type || "",
        title: prefillData.title || prev.title || "",
        description: prefillData.description || prev.description || "",
        latitude: prefillData.latitude !== undefined ? prefillData.latitude : prev.latitude,
        longitude: prefillData.longitude !== undefined ? prefillData.longitude : prev.longitude,
        locationName: prefillData.locationName || prev.locationName || "",
        reportId: prefillData.reportId || prev.reportId
      }));
    }
  }, [prefillData, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

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

  const isValid = () => {
    return (
      formData.type &&
      formData.title.trim() &&
      formData.locationName.trim() &&
      formData.latitude !== null &&
      formData.longitude !== null
    );
  };

  if (!isOpen) return null;

  return (
    <div
      ref={formRef}
      className="fixed z-[1000] bg-white rounded-lg shadow-2xl border border-gray-200 w-[380px] max-h-[85vh] overflow-hidden flex flex-col"
      style={{
        ...(position ? {
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, calc(-100% - 20px))'
        } : {
          right: '20px',
          top: '20px'
        })
      }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-orange" />
          <h3 className="text-sm font-semibold text-gray-900">Add New Pin</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 hover:bg-brand-orange hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto px-4 py-3 flex-1" style={{ maxHeight: 'calc(85vh - 120px)' }}>
        <div className="space-y-3">
          {/* Pin Type */}
          <div className="space-y-1.5">
            <Label htmlFor="compact-pin-type" className="text-xs font-medium text-gray-700">
              Pin Type
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-black focus:ring-black/20">
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
                          <Icon className="h-3.5 w-3.5 mr-2 text-gray-500" />
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
                          <Icon className="h-3.5 w-3.5 mr-2 text-gray-500" />
                          {type}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="compact-pin-title" className="text-xs font-medium text-gray-700">
              Title
            </Label>
            <div className="relative">
              <Input
                id="compact-pin-title"
                placeholder="Enter marker title"
                value={formData.title}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 60) {
                    setFormData({ ...formData, title: value });
                  }
                }}
                maxLength={60}
                className="h-9 text-sm border-gray-300 focus:border-black focus:ring-black/20"
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
            <Label htmlFor="compact-pin-description" className="text-xs font-medium text-gray-700">
              Description
            </Label>
            <div className="relative">
              <Textarea
                id="compact-pin-description"
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
                className="resize-none text-sm border-gray-300 focus:border-black focus:ring-black/20 min-h-[60px]"
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
            <div className="space-y-1.5">
              <Label htmlFor="compact-location-name" className="text-xs font-medium text-gray-700">
                Location Name
              </Label>
              <Input
                id="compact-location-name"
                placeholder="Location will be set automatically"
                value={formData.locationName}
                readOnly
                className="bg-gray-50 cursor-not-allowed border-gray-200 h-9 text-sm"
              />
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="compact-latitude" className="text-xs font-medium text-gray-700">
                  Latitude
                </Label>
                <Input
                  id="compact-latitude"
                  type="number"
                  step="any"
                  placeholder="0.000000"
                  value={formData.latitude !== null && formData.latitude !== undefined ? formData.latitude.toString() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, latitude: val === '' ? null : parseFloat(val) || null });
                  }}
                  className="h-9 text-sm border-gray-300 focus:border-black focus:ring-black/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compact-longitude" className="text-xs font-medium text-gray-700">
                  Longitude
                </Label>
                <Input
                  id="compact-longitude"
                  type="number"
                  step="any"
                  placeholder="0.000000"
                  value={formData.longitude !== null && formData.longitude !== undefined ? formData.longitude.toString() : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, longitude: val === '' ? null : parseFloat(val) || null });
                  }}
                  className="h-9 text-sm border-gray-300 focus:border-black focus:ring-black/20"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 bg-white">
        <Button
          onClick={handleSave}
          className="w-full h-9 bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-medium"
          disabled={!isValid() || isSaving}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            "Add Pin"
          )}
        </Button>
      </div>
    </div>
  );
}

