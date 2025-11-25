/**
 * usePins Hook
 * 
 * Custom hook for managing map pins in Firestore.
 * Provides CRUD operations and real-time subscriptions for pins.
 */

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { Pin, CreatePinData, UpdatePinData, PinFilters, getPinCategory, generateSearchTerms } from '@/types/pin';
import { toast } from '@/components/ui/sonner';
import { logActivity, ActionType, formatLogMessage } from '@/lib/activityLogger';

export function usePins() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Get current user information for audit trail
   */
  const getCurrentUser = async () => {
    try {
      // Check if admin is logged in (LDRRMO Admin)
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      
      if (adminLoggedIn) {
        const username = localStorage.getItem("adminUsername");
        if (username) {
          const q = query(collection(db, "admins"), where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            return {
              id: querySnapshot.docs[0].id,
              name: data.name || data.fullName || username,
              type: "admin"
            };
          }
        }
      } else {
        // Super admin user
        const authUser = auth.currentUser;
        if (authUser && authUser.email) {
          const q = query(collection(db, "superAdmin"), where("email", "==", authUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            return {
              id: querySnapshot.docs[0].id,
              name: data.fullName || data.name || "Super Admin",
              type: "superadmin"
            };
          }
          // Fallback for super admin
          return {
            id: authUser.uid,
            name: authUser.displayName || authUser.email?.split("@")[0] || "Super Admin",
            type: "superadmin"
          };
        }
      }
      
      // Fallback
      return {
        id: "unknown",
        name: "Unknown Admin",
        type: "unknown"
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return {
        id: "unknown",
        name: "Unknown Admin",
        type: "unknown"
      };
    }
  };

  /**
   * Create a new pin in Firestore
   */
  const createPin = async (pinData: CreatePinData): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!pinData.type || !pinData.title || !pinData.latitude || !pinData.longitude) {
        throw new Error("Missing required fields: type, title, latitude, and longitude are required");
      }

      if (pinData.latitude < -90 || pinData.latitude > 90) {
        throw new Error("Invalid latitude: must be between -90 and 90");
      }

      if (pinData.longitude < -180 || pinData.longitude > 180) {
        throw new Error("Invalid longitude: must be between -180 and 180");
      }

      // Get current user for audit trail
      const currentUser = await getCurrentUser();

      // Determine category from type
      const category = getPinCategory(pinData.type);

      // Generate search terms
      const searchTerms = generateSearchTerms(pinData.title, pinData.locationName, pinData.type);

      // Create pin document
      const pinDoc = {
        type: pinData.type,
        category: category,
        title: pinData.title.trim(),
        description: pinData.description?.trim() || null,
        latitude: pinData.latitude,
        longitude: pinData.longitude,
        locationName: pinData.locationName || 'Unknown Location',
        reportId: pinData.reportId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        searchTerms: searchTerms
      };

      console.log('Creating pin in Firestore:', pinDoc);

      // Route to correct collection based on category
      // Facilities go to "pins", accidents/hazards go to "reportPins"
      const collectionName = category === 'facility' ? 'pins' : 'reportPins';
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, collectionName), pinDoc);
      
      console.log('Pin created successfully with ID:', docRef.id);
      
      // Log activity
      await logActivity({
        actionType: pinData.reportId ? ActionType.REPORT_ADDED_TO_MAP : ActionType.PIN_CREATED,
        action: pinData.reportId 
          ? `Added report pin "${pinData.title}" to map (${docRef.id})`
          : formatLogMessage('Created', 'pin', pinData.title, docRef.id),
        entityType: 'pin',
        entityId: docRef.id,
        entityName: pinData.title,
        metadata: {
          type: pinData.type,
          category,
          locationName: pinData.locationName || 'Unknown Location',
          reportId: pinData.reportId || undefined
        }
      });
      
      setLoading(false);
      return docRef.id;
    } catch (err: any) {
      console.error('Error creating pin:', err);
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Update an existing pin in Firestore
   */
  const updatePin = async (pinId: string, updates: UpdatePinData): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Validation

      if (updates.latitude !== undefined && (updates.latitude < -90 || updates.latitude > 90)) {
        throw new Error("Invalid latitude: must be between -90 and 90");
      }

      if (updates.longitude !== undefined && (updates.longitude < -180 || updates.longitude > 180)) {
        throw new Error("Invalid longitude: must be between -180 and 180");
      }

      // Try to find pin in both collections
      let pinRef = doc(db, "pins", pinId);
      let pinSnap = await getDoc(pinRef);
      
      if (!pinSnap.exists()) {
        // Try reportPins collection
        pinRef = doc(db, "reportPins", pinId);
        pinSnap = await getDoc(pinRef);
        if (!pinSnap.exists()) {
          throw new Error("Pin not found");
        }
      }

      const currentData = pinSnap.data();
      const collectionName = currentData.category === 'facility' ? 'pins' : 'reportPins';
      
      // Update pinRef to correct collection if needed
      if (pinRef.path.split('/')[0] !== collectionName) {
        pinRef = doc(db, collectionName, pinId);
      }
      
      // Prepare update object
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (updates.type !== undefined) {
        updateData.type = updates.type;
        updateData.category = getPinCategory(updates.type);
      }
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim() || null;
      if (updates.latitude !== undefined) updateData.latitude = updates.latitude;
      if (updates.longitude !== undefined) updateData.longitude = updates.longitude;
      if (updates.locationName !== undefined) updateData.locationName = updates.locationName;
      if (updates.reportId !== undefined) updateData.reportId = updates.reportId;

      // Regenerate search terms if title, location, or type changed
      if (updates.title || updates.locationName || updates.type) {
        const newTitle = updates.title || currentData.title;
        const newLocation = updates.locationName || currentData.locationName;
        const newType = updates.type || currentData.type;
        updateData.searchTerms = generateSearchTerms(newTitle, newLocation, newType);
      }

      console.log('Updating pin:', pinId, updateData);

      await updateDoc(pinRef, updateData);
      
      // Log activity
      const changes: Record<string, { from: any; to: any }> = {};
      if (updates.type !== undefined && updates.type !== currentData.type) {
        changes.type = { from: currentData.type, to: updates.type };
      }
      if (updates.title !== undefined && updates.title !== currentData.title) {
        changes.title = { from: currentData.title, to: updates.title };
      }
      if (updates.description !== undefined && updates.description !== currentData.description) {
        changes.description = { from: currentData.description || '', to: updates.description || '' };
      }
      if (updates.locationName !== undefined && updates.locationName !== currentData.locationName) {
        changes.locationName = { from: currentData.locationName, to: updates.locationName };
      }
      
      await logActivity({
        actionType: ActionType.PIN_UPDATED,
        action: formatLogMessage('Updated', 'pin', currentData.title, pinId),
        entityType: 'pin',
        entityId: pinId,
        entityName: currentData.title,
        changes: Object.keys(changes).length > 0 ? changes : undefined
      });
      
      console.log('Pin updated successfully');
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating pin:', err);
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Permanently delete a pin from Firestore
   */
  const deletePin = async (pinId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Try to find pin in both collections
      let pinRef = doc(db, "pins", pinId);
      let pinSnap = await getDoc(pinRef);
      
      if (!pinSnap.exists()) {
        // Try reportPins collection
        pinRef = doc(db, "reportPins", pinId);
        pinSnap = await getDoc(pinRef);
        if (!pinSnap.exists()) {
          throw new Error("Pin not found");
        }
      }
      
      // Get pin data before deletion for logging
      const pinData = pinSnap.exists() ? pinSnap.data() : null;
      
      console.log('Deleting pin:', pinId);
      await deleteDoc(pinRef);
      
      // Log activity
      if (pinData) {
        await logActivity({
          actionType: ActionType.PIN_DELETED,
          action: formatLogMessage('Deleted', 'pin', pinData.title, pinId),
          entityType: 'pin',
          entityId: pinId,
          entityName: pinData.title,
          metadata: {
            type: pinData.type,
            category: pinData.category,
            locationName: pinData.locationName
          }
        });
      }
      
      console.log('Pin deleted successfully');
      setLoading(false);
    } catch (err: any) {
      console.error('Error deleting pin:', err);
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get a single pin by ID
   */
  const getPinById = async (pinId: string): Promise<Pin | null> => {
    try {
      // Try pins collection first
      let pinRef = doc(db, "pins", pinId);
      let pinSnap = await getDoc(pinRef);
      
      if (!pinSnap.exists()) {
        // Try reportPins collection
        pinRef = doc(db, "reportPins", pinId);
        pinSnap = await getDoc(pinRef);
        if (!pinSnap.exists()) {
          return null;
        }
      }

      const data = pinSnap.data();
      return {
        id: pinSnap.id,
        type: data.type,
        category: data.category,
        title: data.title,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        locationName: data.locationName,
        reportId: data.reportId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        createdByName: data.createdByName
      } as Pin;
    } catch (err: any) {
      console.error('Error fetching pin:', err);
      return null;
    }
  };

  /**
   * Subscribe to pins with real-time updates
   * Returns an unsubscribe function
   */
  const subscribeToPins = (
    filters: PinFilters,
    onUpdate: (pins: Pin[]) => void,
    onError?: (error: Error) => void
  ): (() => void) => {
    try {
      // Determine which collections to query based on category filter
      const needsFacilities = !filters.categories || filters.categories.includes('facility');
      const needsAccidents = !filters.categories || filters.categories.includes('accident');
      
      const collections: string[] = [];
      if (needsFacilities) collections.push('pins');
      if (needsAccidents) collections.push('reportPins');
      
      // If no category filter, query both collections
      if (collections.length === 0) {
        collections.push('pins', 'reportPins');
      }

      // Create queries for each collection
      const createQuery = (collectionName: string) => {
        let q = query(collection(db, collectionName));

        // Apply filters
        if (filters.types && filters.types.length > 0) {
          // Firestore "in" operator has a limit of 10 items
          if (filters.types.length > 10) {
            console.warn('Too many types selected (max 10). Using first 10 types.');
            filters.types = filters.types.slice(0, 10);
          }
          q = query(collection(db, collectionName), where("type", "in", filters.types));
        }

        if (filters.categories && filters.categories.length > 0) {
          const category = collectionName === 'pins' ? 'facility' : 'accident';
          if (!filters.categories.includes(category)) {
            return null; // Skip this collection if category doesn't match
          }
        }

        if (filters.reportId) {
          q = query(collection(db, collectionName), where("reportId", "==", filters.reportId));
        }

        return q;
      };

      const queries = collections.map(createQuery).filter(q => q !== null) as any[];

      if (queries.length === 0) {
        onUpdate([]);
        return () => {};
      }

      // Subscribe to all queries and combine results
      const unsubscribes: (() => void)[] = [];
      let allPins: Pin[] = [];

      const updateCombined = () => {
        // Sort by createdAt descending
        allPins.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Client-side filtering for date range
        let filteredPins = [...allPins];
        if (filters.dateFrom) {
          filteredPins = filteredPins.filter(pin => pin.createdAt >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          filteredPins = filteredPins.filter(pin => pin.createdAt <= filters.dateTo!);
        }

        // Client-side search filtering
        if (filters.searchQuery && filters.searchQuery.trim()) {
          const searchLower = filters.searchQuery.toLowerCase();
          filteredPins = filteredPins.filter(pin => 
            pin.title.toLowerCase().includes(searchLower) ||
            pin.locationName.toLowerCase().includes(searchLower) ||
            pin.type.toLowerCase().includes(searchLower)
          );
        }

        console.log('Filtered pins:', filteredPins.length);
        onUpdate(filteredPins);
      };

      queries.forEach((q, index) => {
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log(`Pins snapshot received from ${collections[index]}:`, snapshot.docs.length, 'pins');
            
            const collectionPins = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                type: data.type,
                category: data.category,
                title: data.title,
                description: data.description || undefined,
                latitude: data.latitude,
                longitude: data.longitude,
                locationName: data.locationName,
                reportId: data.reportId,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                createdBy: data.createdBy,
                createdByName: data.createdByName
              } as Pin;
            });

            // Update allPins array - remove old pins from this collection and add new ones
            allPins = allPins.filter(pin => {
              // Check if pin exists in current collection snapshot
              return !collectionPins.some(cp => cp.id === pin.id);
            });
            allPins.push(...collectionPins);

            updateCombined();
          },
        (err: any) => {
          console.error('Error in pins subscription:', err);
          console.error('Error details:', {
            code: err?.code,
            message: err?.message,
            stack: err?.stack
          });
          
          // Provide more specific error information
          let errorMessage = 'Failed to fetch pins from database';
          
          if (err?.code === 'failed-precondition') {
            // Missing composite index - Firestore usually provides a link in the error
            const indexLink = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0];
            if (indexLink) {
              console.error('Missing Firestore composite index. Create it here:', indexLink);
              errorMessage = 'Database index required. Check console for link to create index.';
            } else {
              errorMessage = 'Database index required. The query needs an index on (type, createdAt).';
              console.error('Missing Firestore composite index. The query requires an index on (type, createdAt).');
            }
          } else if (err?.code === 'permission-denied') {
            errorMessage = 'Permission denied. You may not have access to view pins.';
          } else if (err?.code === 'unavailable') {
            errorMessage = 'Database temporarily unavailable. Please try again.';
          } else if (err?.code === 'deadline-exceeded') {
            errorMessage = 'Query timeout. Please try again.';
          } else if (err?.message) {
            errorMessage = err.message;
          }
          
          if (onError) {
            const error = new Error(errorMessage);
            (error as any).code = err?.code;
            (error as any).originalError = err;
            (error as any).indexLink = err?.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0];
            onError(error);
          }
        }
        );
        unsubscribes.push(unsubscribe);
      });

      // Return combined unsubscribe function
      return () => {
        unsubscribes.forEach(unsub => unsub());
      };
    } catch (err: any) {
      console.error('Error setting up pins subscription:', err);
      if (onError) {
        onError(err);
      }
      return () => {}; // Return empty unsubscribe function
    }
  };

  /**
   * Fetch all pins once (no real-time updates)
   */
  const fetchPins = async (filters?: PinFilters): Promise<Pin[]> => {
    setLoading(true);
    setError(null);

    try {
      // Determine which collections to query
      const needsFacilities = !filters?.categories || filters.categories.includes('facility');
      const needsAccidents = !filters?.categories || filters.categories.includes('accident');
      
      const collections: string[] = [];
      if (needsFacilities) collections.push('pins');
      if (needsAccidents) collections.push('reportPins');
      
      if (collections.length === 0) {
        collections.push('pins', 'reportPins');
      }

      // Fetch from all relevant collections
      const fetchPromises = collections.map(async (collectionName) => {
        let q = query(collection(db, collectionName), orderBy("createdAt", "desc"));

        // Apply filters
        if (filters?.types && filters.types.length > 0) {
          q = query(collection(db, collectionName), where("type", "in", filters.types), orderBy("createdAt", "desc"));
        }

        if (filters?.reportId) {
          q = query(collection(db, collectionName), where("reportId", "==", filters.reportId), orderBy("createdAt", "desc"));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            category: data.category,
            title: data.title,
            description: data.description || undefined,
            latitude: data.latitude,
            longitude: data.longitude,
            locationName: data.locationName,
            reportId: data.reportId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            createdBy: data.createdBy,
            createdByName: data.createdByName
          } as Pin;
        });
      });

      const results = await Promise.all(fetchPromises);
      let pins = results.flat();

      // Client-side filtering
      if (filters?.dateFrom) {
        pins = pins.filter(pin => pin.createdAt >= filters.dateFrom!);
      }
      if (filters?.dateTo) {
        pins = pins.filter(pin => pin.createdAt <= filters.dateTo!);
      }
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        const searchLower = filters.searchQuery.toLowerCase();
        pins = pins.filter(pin => 
          pin.title.toLowerCase().includes(searchLower) ||
          pin.locationName.toLowerCase().includes(searchLower) ||
          pin.type.toLowerCase().includes(searchLower)
        );
      }

      // Sort by createdAt descending
      pins.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setLoading(false);
      return pins;
    } catch (err: any) {
      console.error('Error fetching pins:', err);
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  return {
    createPin,
    updatePin,
    deletePin,
    getPinById,
    subscribeToPins,
    fetchPins,
    loading,
    error
  };
}

