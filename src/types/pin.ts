/**
 * Pin Type Definitions
 * 
 * Defines the structure for map pins stored in Firestore.
 * These pins are displayed on the Risk Map and can be fetched by the mobile app.
 */

export type PinType = 
  // Accidents/Hazards
  | 'Road Crash'
  | 'Fire'
  | 'Medical Emergency'
  | 'Flooding'
  | 'Volcanic Activity'
  | 'Landslide'
  | 'Earthquake'
  | 'Civil Disturbance'
  | 'Armed Conflict'
  | 'Infectious Disease'
  | 'Others'
  // Emergency Facilities
  | 'Evacuation Centers'
  | 'Health Facilities'
  | 'Police Stations'
  | 'Fire Stations'
  | 'Government Offices';

export type PinCategory = 'accident' | 'facility';

export interface Pin {
  // Firestore document ID (auto-generated)
  id: string;
  
  // Pin Classification
  type: PinType;
  category: PinCategory;
  title: string;                  // Max 60 characters
  description?: string;           // Max 120 characters
  
  // Geographic Data
  latitude: number;
  longitude: number;
  locationName: string;           // Geocoded address
  
  // Relationships
  reportId?: string;              // Optional: Links to reports collection
  
  // Metadata
  createdAt: Date;                // Firestore Timestamp
  updatedAt: Date;                // Firestore Timestamp
  createdBy: string;              // Admin user ID
  createdByName: string;          // Admin display name
}

// Data structure for creating a new pin
export interface CreatePinData {
  type: PinType;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  locationName: string;
  reportId?: string;
}

// Data structure for updating a pin
export interface UpdatePinData {
  type?: PinType;
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  reportId?: string;
}

// Filters for querying pins
export interface PinFilters {
  types?: PinType[];              // Filter by pin types
  categories?: PinCategory[];     // Filter by accident or facility
  dateFrom?: Date;                // Filter by creation date
  dateTo?: Date;                  // Filter by creation date
  reportId?: string;              // Filter by linked report
  searchQuery?: string;           // Search in title and locationName
}

// Helper function to determine pin category from type
export function getPinCategory(type: PinType): PinCategory {
  const facilityTypes: PinType[] = [
    'Evacuation Centers',
    'Health Facilities',
    'Police Stations',
    'Fire Stations',
    'Government Offices'
  ];
  
  return facilityTypes.includes(type) ? 'facility' : 'accident';
}

// Helper function to generate search terms for a pin
export function generateSearchTerms(title: string, locationName: string, type: string): string[] {
  const terms = new Set<string>();
  
  // Add words from title
  title.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 2) terms.add(word);
  });
  
  // Add words from location
  locationName.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 2) terms.add(word);
  });
  
  // Add type
  terms.add(type.toLowerCase());
  
  return Array.from(terms);
}

