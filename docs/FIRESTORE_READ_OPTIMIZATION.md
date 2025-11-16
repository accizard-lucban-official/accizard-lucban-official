# Firestore Read Optimization Guide

## Overview

This guide outlines strategies to reduce Firestore reads per day while maintaining good user experience. The free tier allows 50K reads/day, and these optimizations can reduce reads by 70-90%.

## Strategy: Hybrid Approach

Use different data fetching strategies based on data criticality:

### 1. **Real-Time Listeners** (`onSnapshot`) - Keep for Critical Data Only
- **Use for:** Chat messages, active collaborative editing
- **Files:** `AdminChatPage.tsx`, `ChatSupportPage.tsx`
- **Reads:** High (every change triggers read)
- **Keep as-is:** Yes

### 2. **Polling** (Periodic Fetches) - For Frequently Updated Data
- **Use for:** Dashboard stats, reports list, user list, system logs
- **Files:** `DashboardStats.tsx`, `ManageReportsPage.tsx`, `ManageUsersPage.tsx`, `SystemLogsPage.tsx`
- **Reads:** Low-Medium (1 read per interval)
- **Recommended interval:** 30-60 seconds
- **Implementation:** Replace `onSnapshot` with `getDocs` + `setInterval`

### 3. **Manual Refresh** - For Infrequently Updated Data
- **Use for:** Announcements, historical logs, archived data
- **Files:** `AnnouncementsPage.tsx`
- **Reads:** Very Low (only when user clicks refresh)
- **Implementation:** One-time fetch on mount + refresh button

### 4. **React Query Caching** - For All Queries
- **Use for:** All Firestore queries
- **Benefits:** Prevents duplicate reads, automatic caching, refetch on window focus
- **Implementation:** Wrap all `getDocs` calls with `useQuery`

## Implementation Patterns

### Pattern 1: Polling with React Query (Recommended)

```typescript
import { useQuery } from '@tanstack/react-query';
import { collection, query, getDocs } from 'firebase/firestore';

const { data: reports, isLoading } = useQuery({
  queryKey: ['reports', filters],
  queryFn: async () => {
    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  staleTime: 30000,        // Consider stale after 30 seconds
  refetchInterval: 60000,   // Auto-refetch every 60 seconds
  refetchOnWindowFocus: true, // Refetch when user returns to tab
});
```

### Pattern 2: Manual Refresh Button

```typescript
const [isRefreshing, setIsRefreshing] = useState(false);
const [data, setData] = useState([]);

const fetchData = async () => {
  setIsRefreshing(true);
  try {
    const snapshot = await getDocs(dataQuery);
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } finally {
    setIsRefreshing(false);
  }
};

useEffect(() => {
  fetchData(); // Initial fetch
}, []);

// In JSX:
<Button onClick={fetchData} disabled={isRefreshing}>
  {isRefreshing ? 'Refreshing...' : 'Refresh'}
</Button>
```

### Pattern 3: Simple Polling (Without React Query)

```typescript
useEffect(() => {
  const fetchData = async () => {
    const snapshot = await getDocs(dataQuery);
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };
  
  fetchData(); // Initial fetch
  const interval = setInterval(fetchData, 60000); // Every 60 seconds
  
  return () => clearInterval(interval);
}, [dependencies]);
```

## Files to Optimize

### High Priority (Highest Read Reduction)

| File | Current | Recommended | Expected Reduction |
|------|---------|-------------|-------------------|
| `DashboardStats.tsx` | Multiple `onSnapshot` | Polling (60s) | 80-90% |
| `Layout.tsx` | `onSnapshot` for notifications | Polling (30s) | 70-80% |
| `ManageReportsPage.tsx` | `onSnapshot` for reports | Polling (60s) or manual refresh | 70-85% |
| `SystemLogsPage.tsx` | `onSnapshot` for logs | Manual refresh | 90-95% |

### Medium Priority

| File | Current | Recommended | Expected Reduction |
|------|---------|-------------|-------------------|
| `ManageUsersPage.tsx` | Multiple `getDocs` calls | React Query caching | 30-50% |
| `AnnouncementsPage.tsx` | `getDocs` on mount | Manual refresh | 50-70% |
| `usePins.ts` | `onSnapshot` for pins | Polling (30s) or event-driven | 60-80% |

### Keep Real-Time (Do Not Change)

| File | Reason |
|------|--------|
| `AdminChatPage.tsx` | Chat requires real-time updates |
| `ChatSupportPage.tsx` | Chat requires real-time updates |

## Specific Optimizations

### 1. DashboardStats.tsx
**Current:** 3+ `onSnapshot` listeners running continuously
**Change to:** React Query with 60-second polling
**Impact:** ~80-90% reduction

### 2. Layout.tsx Notifications
**Current:** Real-time listeners for reports/users/chats
**Change to:** Polling every 30 seconds
**Impact:** ~70-80% reduction

### 3. ManageReportsPage.tsx
**Current:** `onSnapshot` for reports list
**Change to:** 
- Polling (60s) when no filters applied
- Manual refresh when filters applied
**Impact:** ~70-85% reduction

### 4. SystemLogsPage.tsx
**Current:** `onSnapshot` for logs
**Change to:** Manual refresh button (logs don't need real-time)
**Impact:** ~90-95% reduction

### 5. Typing Indicators (ChatSupportPage.tsx)
**Current:** Real-time listener for typing status
**Change to:** Remove or throttle to 3-second checks
**Impact:** ~50-70% reduction in typing-related reads

## React Query Setup

### Install (Already Installed)
```bash
# Already in package.json
npm install @tanstack/react-query
```

### Configure QueryClient (Already Done)
```typescript
// Already in App.tsx
const queryClient = new QueryClient();
```

### Create Custom Hook for Firestore Queries

```typescript
// src/hooks/useFirestoreQuery.ts
import { useQuery } from '@tanstack/react-query';
import { Query } from 'firebase/firestore';
import { getDocs } from 'firebase/firestore';

export function useFirestoreQuery<T>(
  queryKey: string[],
  firestoreQuery: Query,
  options?: {
    staleTime?: number;
    refetchInterval?: number;
    enabled?: boolean;
  }
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const snapshot = await getDocs(firestoreQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    },
    staleTime: options?.staleTime ?? 30000,
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
```

## Debouncing Search Queries

Add debouncing to search inputs to prevent reads on every keystroke:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 500); // Wait 500ms after user stops typing

  return () => clearTimeout(timer);
}, [searchQuery]);

// Use debouncedQuery in Firestore query
```

## Monitoring Read Usage

1. **Firebase Console** → Usage and billing
2. Check daily read counts per collection
3. Identify collections with highest reads
4. Focus optimizations on those collections first

## Expected Results

### Before Optimization
- **Daily reads:** 10,000 - 50,000+ (depending on active users)
- **Risk:** Exceeding free tier (50K/day)

### After Optimization
- **Daily reads:** 2,000 - 10,000 (70-90% reduction)
- **Safety margin:** Well within free tier limits

## Implementation Checklist

- [ ] Replace `DashboardStats.tsx` `onSnapshot` with polling
- [ ] Replace `Layout.tsx` notification listeners with polling
- [ ] Replace `ManageReportsPage.tsx` `onSnapshot` with polling/manual refresh
- [ ] Replace `SystemLogsPage.tsx` `onSnapshot` with manual refresh
- [ ] Add React Query caching to all `getDocs` calls
- [ ] Remove or throttle typing indicator listeners
- [ ] Add debouncing to search queries
- [ ] Consolidate duplicate queries (Layout.tsx + PageHeader.tsx)
- [ ] Test all pages after changes
- [ ] Monitor Firebase Console for read reduction

## Notes

- **Keep real-time for chat:** Chat messages need instant updates
- **Test thoroughly:** Ensure polling doesn't break functionality
- **User experience:** Polling intervals should feel responsive (30-60s)
- **Cache aggressively:** Use React Query's caching to prevent duplicate reads
- **Monitor first:** Check current usage before optimizing to identify hotspots

## References

- [Firebase Pricing](https://firebase.google.com/pricing)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)












