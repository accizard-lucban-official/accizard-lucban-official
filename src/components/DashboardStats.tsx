import { useState, useEffect, useMemo, useRef } from "react";
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { AlertTriangle, Users, FileText, MapPin, CloudRain, Clock, TrendingUp, PieChart as PieChartIcon, Building2, Calendar, Download, Maximize2, FileImage, FileType, Facebook, PhoneCall, Wind, Droplets, CloudRain as Precipitation, Car, Layers, Flame, Activity, Sun, Cloud, CloudLightning, CloudSnow, CloudDrizzle, CloudFog, RefreshCw, AlertCircle, UserCheck, Navigation, Waves, Satellite } from "lucide-react";
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveCalendar } from '@nivo/calendar';
import { ResponsiveLine } from '@nivo/line';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { ensureOk, getHttpStatusMessage } from "@/lib/utils";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { usePins } from "@/hooks/usePins";
import { Pin } from "@/types/pin";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, where, Timestamp, limit, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import html2canvas from 'html2canvas';

// Use the custom Mapbox access token for AcciZard Lucban
mapboxgl.accessToken = 'pk.eyJ1IjoiYWNjaXphcmQtbHVjYmFuLW9mZmljaWFsIiwiYSI6ImNtaG93dTA2aDBnMG8ydm9vemd6a29sNzIifQ.j1N_NloJE19I2Mk4X3J2KA';

export function DashboardStats() {
  const { subscribeToPins } = usePins();
  const [totalReportsFilter, setTotalReportsFilter] = useState("this-week");
  const [reportsOverTimeFilter, setReportsOverTimeFilter] = useState("this-week");
  const [reportsOverTimeTypeFilter, setReportsOverTimeTypeFilter] = useState<string>("all");
  const [barangayReportsFilter, setBarangayReportsFilter] = useState("this-week");
  const [barangayReportsTypeFilter, setBarangayReportsTypeFilter] = useState<string>("all");
  const [usersBarangayFilter, setUsersBarangayFilter] = useState("this-week");
  const [usersBarangayBarangayFilter, setUsersBarangayBarangayFilter] = useState<string>("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("this-week");
  const [peakHoursFilter, setPeakHoursFilter] = useState("this-week");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isUsersChartModalOpen, setIsUsersChartModalOpen] = useState(false);
  const [isPieChartModalOpen, setIsPieChartModalOpen] = useState(false);
  const [isPeakHoursModalOpen, setIsPeakHoursModalOpen] = useState(false);
  const [isReportsOverTimeModalOpen, setIsReportsOverTimeModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [weatherData, setWeatherData] = useState({
    temperature: "28°C",
    temperatureCelsius: 28,
    temperatureFahrenheit: 82,
    condition: "Scattered Thunderstorms",
    humidity: "75%",
    rainfall: "0mm",
    precipitation: "0mm",
      windSpeed: "3.1 m/s",
    windDirection: "NE",
    loading: true,
    error: null
  });
  const [weatherOutlook, setWeatherOutlook] = useState([]);
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [pins, setPins] = useState<Pin[]>([]);
  const [mapLayerMode, setMapLayerMode] = useState<'normal' | 'barangayBoundaries' | 'roadNetwork' | 'waterways' | 'traffic' | 'satellite'>('normal');
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [onlineAdminsCount, setOnlineAdminsCount] = useState(0);
  const [pagasaBulletins, setPagasaBulletins] = useState<any[]>([]);
  const [isFetchingBulletins, setIsFetchingBulletins] = useState(false);
  // All 15 report types
  const allReportTypes = useMemo(() => [
    'Road Crash',
    'Fire',
    'Medical Emergency',
    'Flooding',
    'Volcanic Activity',
    'Landslide',
    'Earthquake',
    'Civil Disturbance',
    'Armed Conflict',
    'Infectious Disease',
    'Poor Infrastructure',
    'Obstructions',
    'Electrical Hazard',
    'Environmental Hazard',
    'Animal Concerns',
    'Others'
  ], []);

  const [enabledReportTypes, setEnabledReportTypes] = useState<Record<string, boolean>>({
    'Road Crash': true,
    'Fire': true,
    'Medical Emergency': true,
    'Flooding': true,
    'Volcanic Activity': true,
    'Landslide': true,
    'Earthquake': true,
    'Civil Disturbance': true,
    'Armed Conflict': true,
    'Infectious Disease': true,
    'Poor Infrastructure': true,
    'Obstructions': true,
    'Electrical Hazard': true,
    'Environmental Hazard': true,
    'Animal Concerns': true,
    'Others': true
  });
  const [selectedChartsForExport, setSelectedChartsForExport] = useState<Record<string, boolean>>({
    'Reports Over Time': true,
    'Report Type Distribution': true,
    'Reports per Barangay': true,
    'Active Users per Barangay': true,
    'Peak Reporting Hours': true
  });
  const [showChartFilters, setShowChartFilters] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const currentMapStyleRef = useRef<string>('');

  // List of 32 official barangays in Lucban (case-insensitive matching)
  const officialBarangays = useMemo(() => [
    "Abang", "Aliliw", "Atulinao", "Ayuti", 
    "Barangay 1", "Barangay 2", "Barangay 3", "Barangay 4", "Barangay 5", 
    "Barangay 6", "Barangay 7", "Barangay 8", "Barangay 9", "Barangay 10", 
    "Igang", "Kabatete", "Kakawit", "Kalangay", "Kalyaat", "Kilib", 
    "Kulapi", "Mahabang Parang", "Malupak", "Manasa", "May-it", 
    "Nagsinamo", "Nalunao", "Palola", "Piis", "Samil", "Tiawe", "Tinamnan"
  ], []);

  // Helper function to normalize barangay name (case-insensitive matching)
  // Handles variations like "Brgy. 1", "Barangay 1", "1", etc.
  const normalizeBarangay = (barangay: string): string => {
    if (!barangay || barangay.trim() === '') return 'Others';
    
    // Remove common prefixes and trim whitespace
    let normalized = barangay.trim();
    
    // Remove prefixes (case-insensitive): "Brgy.", "Brgy", "Barangay", "Barangay."
    normalized = normalized.replace(/^(brgy\.?|barangay\.?)\s*/i, '').trim();
    
    // Check if normalized barangay matches any official barangay (case-insensitive)
    const matches = officialBarangays.find(
      official => {
        // Direct match
        if (official.toLowerCase() === normalized.toLowerCase()) return true;
        
        // For numbered barangays, also check if just the number matches
        // e.g., "1" should match "Barangay 1", "Brgy. 1", etc.
        if (official.startsWith('Barangay ')) {
          const officialNumber = official.replace('Barangay ', '').trim();
          if (officialNumber === normalized) return true;
        }
        
        return false;
      }
    );
    
    return matches || 'Others';
  };

  // Hazard colors using brand-orange to brand-red spectrum
  const hazardColors = useMemo(() => ({
    'Road Crash': '#ff4e3a',          // bright red-orange
    'Fire': '#ff703d',                // orange
    'Medical Emergency': '#fcad3e',   // golden orange/amber
    'Flooding': '#439693',            // muted teal
    'Volcanic Activity': '#027a6a',   // deep teal
    'Landslide': '#439693',           // muted teal
    'Earthquake': '#fcad3e',          // golden orange/amber
    'Civil Disturbance': '#ff703d',   // orange
    'Armed Conflict': '#ff4e3a',      // bright red-orange
    'Infectious Disease': '#439693',  // muted teal
    'Poor Infrastructure': '#fb923c', // soft orange
    'Obstructions': '#facc15',        // warm yellow
    'Electrical Hazard': '#f87171',   // coral red
    'Environmental Hazard': '#34d399',// fresh green
    'Animal Concerns': '#a855f7',      // purple
    'Others': '#fcd34d'               // golden yellow
  }), []);

  // Helper function to filter reports by time period
  const filterReportsByPeriod = (reports: any[], period: string) => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "today":
        // Start of today (00:00:00)
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "this-week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "this-month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "this-year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return reports.filter(report => {
      // Handle different timestamp formats from Firestore
      let reportDate: Date;
      if (report.timestamp instanceof Date) {
        reportDate = report.timestamp;
      } else if (report.timestamp?.toDate && typeof report.timestamp.toDate === 'function') {
        reportDate = report.timestamp.toDate();
      } else if (report.timestamp) {
        reportDate = new Date(report.timestamp);
      } else {
        // If no timestamp, skip this report
        return false;
      }
      return reportDate >= startDate && reportDate <= now;
    });
  };

  // Reports per barangay - calculated from real Firestore data (used for summary stats)
  const reportsPerBarangay = useMemo(() => {
    let filteredReports = filterReportsByPeriod(reports, barangayReportsFilter);
    
    // Apply report type filter if not "all"
    if (barangayReportsTypeFilter !== "all") {
      filteredReports = filteredReports.filter(report => {
        const reportTypeValue = report.reportType || report.type || report.category || 'Others';
        const normalizedType = normalizeCategoryToType(reportTypeValue);
        return normalizedType === barangayReportsTypeFilter;
      });
    }
    
    // Group reports by barangay (normalize to official barangays or "Others")
    const barangayCounts: Record<string, number> = {};
    
    filteredReports.forEach(report => {
      const rawBarangay = report.barangay || report.locationName || 'Unknown';
      const normalizedBarangay = normalizeBarangay(rawBarangay);
      barangayCounts[normalizedBarangay] = (barangayCounts[normalizedBarangay] || 0) + 1;
    });
    
    // Convert to array format
    return Object.keys(barangayCounts)
      .map(barangay => ({
        name: barangay,
        reports: barangayCounts[barangay]
      }))
      .sort((a, b) => {
        // Sort "Others" to the end, then by count descending
        if (a.name === 'Others' && b.name !== 'Others') return 1;
        if (b.name === 'Others' && a.name !== 'Others') return -1;
        return b.reports - a.reports;
      });
  }, [reports, barangayReportsFilter, barangayReportsTypeFilter, officialBarangays]);

  // Calculate top 3 most active barangays
  const top3Barangays = useMemo(() => {
    if (!reportsPerBarangay || reportsPerBarangay.length === 0) return [];
    return reportsPerBarangay.slice(0, 3);
  }, [reportsPerBarangay]);

  // Stacked data for Nivo chart - reports by type per barangay - calculated from real Firestore data
  const stackedReportsData = useMemo(() => {
    let filteredReports = filterReportsByPeriod(reports, barangayReportsFilter);
    
    // Apply report type filter if not "all"
    if (barangayReportsTypeFilter !== "all") {
      filteredReports = filteredReports.filter(report => {
        const reportTypeValue = report.reportType || report.type || report.category || 'Others';
        const normalizedType = normalizeCategoryToType(reportTypeValue);
        return normalizedType === barangayReportsTypeFilter;
      });
    }
    
    // All possible report types
    const allTypes = [
      'Road Crash', 'Fire', 'Medical Emergency', 'Flooding', 
      'Volcanic Activity', 'Landslide', 'Earthquake', 'Civil Disturbance',
      'Armed Conflict', 'Infectious Disease', 'Poor Infrastructure',
      'Obstructions', 'Electrical Hazard', 'Environmental Hazard', 'Others'
    ];
    
    // Group reports by barangay and type (normalize to official barangays or "Others")
    const barangayData: Record<string, Record<string, number>> = {};
    
    filteredReports.forEach(report => {
      const rawBarangay = report.barangay || report.locationName || 'Unknown';
      const normalizedBarangay = normalizeBarangay(rawBarangay);
      const reportType = report.type || 'Others';
      
      if (!barangayData[normalizedBarangay]) {
        barangayData[normalizedBarangay] = {};
        allTypes.forEach(type => {
          barangayData[normalizedBarangay][type] = 0;
        });
      }
      
      if (!barangayData[normalizedBarangay][reportType]) {
        barangayData[normalizedBarangay][reportType] = 0;
      }
      
      barangayData[normalizedBarangay][reportType]++;
    });
    
    // Convert to array format
    const data = Object.keys(barangayData).map(barangay => {
      const entry: Record<string, any> = { barangay };
      allTypes.forEach(type => {
        entry[type] = barangayData[barangay][type] || 0;
      });
      return entry;
    });
    
    // Sort by total reports in descending order, with "Others" at the end
    return data.sort((a, b) => {
      // Put "Others" at the end
      if (a.barangay === 'Others' && b.barangay !== 'Others') return 1;
      if (b.barangay === 'Others' && a.barangay !== 'Others') return -1;
      
      const totalA = allTypes.reduce((sum, type) => sum + (a[type] || 0), 0);
      const totalB = allTypes.reduce((sum, type) => sum + (b[type] || 0), 0);
      return totalB - totalA;
    });
  }, [reports, barangayReportsFilter, barangayReportsTypeFilter, officialBarangays]);

  // Users per barangay data - calculated from real Firestore data
  const usersPerBarangay = useMemo(() => {
    // Filter users by time period if needed (for now, show all users)
    // You might want to filter by registration date or last activity
    let filteredUsers = users; // Could add time-based filtering here if needed
    
    // Apply barangay filter if not "all"
    if (usersBarangayBarangayFilter !== "all") {
      filteredUsers = filteredUsers.filter(user => {
        const rawBarangay = user.barangay || 'Unknown';
        const normalizedBarangay = normalizeBarangay(rawBarangay);
        return normalizedBarangay === usersBarangayBarangayFilter;
      });
    }
    
    // Group users by barangay (normalize to official barangays or "Others")
    // Query barangay field directly from users collection
    const barangayCounts: Record<string, number> = {};
    
    filteredUsers.forEach(user => {
      // Use barangay field from users collection (case-insensitive matching)
      const rawBarangay = user.barangay || 'Unknown';
      const normalizedBarangay = normalizeBarangay(rawBarangay);
      barangayCounts[normalizedBarangay] = (barangayCounts[normalizedBarangay] || 0) + 1;
    });
    
    // Convert to array format
    return Object.keys(barangayCounts)
      .map(barangay => ({
        name: barangay,
        users: barangayCounts[barangay]
      }))
      .sort((a, b) => {
        // Sort "Others" to the end, then by count descending
        if (a.name === 'Others' && b.name !== 'Others') return 1;
        if (b.name === 'Others' && a.name !== 'Others') return -1;
        return b.users - a.users;
      });
  }, [users, usersBarangayBarangayFilter, officialBarangays]);

  // Helper function to normalize category values to match expected type names
  // Maps kebab-case values (like 'road-crash') to Title Case (like 'Road Crash')
  function normalizeCategoryToType(category: string | undefined | null): string {
    if (!category) return 'Others';
    
    const normalized = category.trim();
    
    // Map matching REPORT_TYPE_LABELS from ManageReportsPage
    // This converts kebab-case values to Title Case labels
    const REPORT_TYPE_LABELS_MAP: Record<string, string> = {
      'road-crash': 'Road Crash',
      'medical-emergency': 'Medical Emergency',
      'flooding': 'Flooding',
      'volcanic-activity': 'Volcanic Activity',
      'landslide': 'Landslide',
      'earthquake': 'Earthquake',
      'civil-disturbance': 'Civil Disturbance',
      'armed-conflict': 'Armed Conflict',
      'infectious-disease': 'Infectious Disease',
      'poor-infrastructure': 'Poor Infrastructure',
      'obstructions': 'Obstructions',
      'electrical-hazard': 'Electrical Hazard',
      'environmental-hazard': 'Environmental Hazard',
      'animal-concern': 'Animal Concerns',
      'animal-concerns': 'Animal Concerns',
      'others': 'Others',
      // Also handle Title Case (in case it's already converted)
      'Road Crash': 'Road Crash',
      'Medical Emergency': 'Medical Emergency',
      'Flooding': 'Flooding',
      'Volcanic Activity': 'Volcanic Activity',
      'Landslide': 'Landslide',
      'Earthquake': 'Earthquake',
      'Civil Disturbance': 'Civil Disturbance',
      'Armed Conflict': 'Armed Conflict',
      'Infectious Disease': 'Infectious Disease',
      'Poor Infrastructure': 'Poor Infrastructure',
      'Obstructions': 'Obstructions',
      'Electrical Hazard': 'Electrical Hazard',
      'Environmental Hazard': 'Environmental Hazard',
      'Animal Concerns': 'Animal Concerns',
      'Others': 'Others',
      'Fire': 'Fire', // Fire might be stored directly
    };
    
    // Check if it's already a standard type name (case-insensitive match)
    const standardTypes = [
      'Road Crash', 'Fire', 'Medical Emergency', 'Flooding', 
      'Volcanic Activity', 'Landslide', 'Earthquake', 'Civil Disturbance',
      'Armed Conflict', 'Infectious Disease', 'Poor Infrastructure',
      'Obstructions', 'Electrical Hazard', 'Environmental Hazard', 'Animal Concerns', 'Others'
    ];
    
    // First check for exact case-insensitive match with standard types
    const exactMatch = standardTypes.find(type => 
      type.toLowerCase() === normalized.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    // Check REPORT_TYPE_LABELS map (handles kebab-case to Title Case conversion)
    if (REPORT_TYPE_LABELS_MAP[normalized]) {
      return REPORT_TYPE_LABELS_MAP[normalized];
    }
    
    // Check case-insensitive match in map
    const caseInsensitiveMatch = Object.keys(REPORT_TYPE_LABELS_MAP).find(key => 
      key.toLowerCase() === normalized.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      return REPORT_TYPE_LABELS_MAP[caseInsensitiveMatch];
    }
    
    // Return as-is if it doesn't match (will be shown in chart with default color)
    return normalized;
  }

  // Reports over time data - calculated from real Firestore data
  const reportsOverTimeData = useMemo(() => {
    console.log('=== Reports Over Time Calculation ===');
    console.log('Total reports:', reports.length);
    console.log('Reports over time filter:', reportsOverTimeFilter);
    console.log('Reports over time type filter:', reportsOverTimeTypeFilter);
    
    let filteredReports = filterReportsByPeriod(reports, reportsOverTimeFilter);
    
    // Apply report type filter if not "all"
    if (reportsOverTimeTypeFilter !== "all") {
      filteredReports = filteredReports.filter(report => {
        const reportTypeValue = report.reportType || report.type || report.category || 'Others';
        const normalizedType = normalizeCategoryToType(reportTypeValue);
        return normalizedType === reportsOverTimeTypeFilter;
      });
    }
    
    console.log('Filtered reports count:', filteredReports.length);
    
    const reportTypes = [
      'Road Crash', 'Fire', 'Medical Emergency', 'Flooding', 
      'Volcanic Activity', 'Landslide', 'Earthquake', 'Civil Disturbance',
      'Armed Conflict', 'Infectious Disease', 'Poor Infrastructure',
      'Obstructions', 'Electrical Hazard', 'Environmental Hazard', 'Animal Concerns', 'Others'
    ];
    
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Group reports by type and month
    const dataByTypeAndMonth: Record<string, Record<string, number>> = {};
    
    reportTypes.forEach(type => {
      dataByTypeAndMonth[type] = {};
      months.forEach(() => {
        dataByTypeAndMonth[type] = { ...dataByTypeAndMonth[type] };
      });
    });
    
    // Debug: Log sample reports
    if (filteredReports.length > 0) {
      console.log('Sample reports (first 3):', filteredReports.slice(0, 3).map(r => ({
        id: r.id,
        reportType: r.reportType,
        type: r.type,
        category: r.category,
        timestamp: r.timestamp
      })));
    }
    
    filteredReports.forEach(report => {
      // Use reportType field first (same as donut chart for consistency)
      // Then fall back to type (which is mapped during fetch) or category
      const reportTypeValue = report.reportType || report.type || report.category || 'Others';
      // Normalize to match expected type names (same normalization as donut chart)
      const normalizedType = normalizeCategoryToType(reportTypeValue);
      
      // Handle different timestamp formats from Firestore
      let reportDate: Date;
      if (report.timestamp instanceof Date) {
        reportDate = report.timestamp;
      } else if (report.timestamp?.toDate && typeof report.timestamp.toDate === 'function') {
        reportDate = report.timestamp.toDate();
      } else if (report.timestamp) {
        reportDate = new Date(report.timestamp);
      } else {
        // Skip reports without valid timestamps
        return;
      }
      const monthIndex = reportDate.getMonth();
      const monthName = months[monthIndex];
      
      if (!dataByTypeAndMonth[normalizedType]) {
        dataByTypeAndMonth[normalizedType] = {};
      }
      
      if (!dataByTypeAndMonth[normalizedType][monthName]) {
        dataByTypeAndMonth[normalizedType][monthName] = 0;
      }
      
      dataByTypeAndMonth[normalizedType][monthName]++;
    });
    
    // Debug: Log the data structure
    console.log('Data by type and month:', dataByTypeAndMonth);
    
    const result = reportTypes.map(reportType => ({
      id: reportType,
      data: months.map(month => ({
        x: month,
        y: dataByTypeAndMonth[reportType]?.[month] || 0
      }))
    }));
    
    console.log('Final reports over time result:', result);
    console.log('=== End Reports Over Time Calculation ===');
    
    return result;
  }, [reports, reportsOverTimeFilter, reportsOverTimeTypeFilter]);

  // Calculate most active month from reports over time data
  const mostActiveMonth = useMemo(() => {
    if (!reportsOverTimeData || reportsOverTimeData.length === 0) return null;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthTotals: Record<string, number> = {};
    
    // Initialize all months to 0
    months.forEach(month => {
      monthTotals[month] = 0;
    });
    
    // Sum up all report types for each month
    reportsOverTimeData.forEach(typeData => {
      typeData.data.forEach(monthData => {
        monthTotals[monthData.x] = (monthTotals[monthData.x] || 0) + monthData.y;
      });
    });
    
    // Find the month with the highest total
    let maxMonth = months[0];
    let maxCount = monthTotals[months[0]];
    
    months.forEach(month => {
      if (monthTotals[month] > maxCount) {
        maxCount = monthTotals[month];
        maxMonth = month;
      }
    });
    
    return maxCount > 0 ? { month: maxMonth, count: maxCount } : null;
  }, [reportsOverTimeData]);

  // Calculate top 3 most active dates
  const top3MostActiveDates = useMemo(() => {
    // Filter reports by period (respects reportsOverTimeFilter)
    let filteredReports = filterReportsByPeriod(reports, reportsOverTimeFilter);

    // Apply report type filter if not "all"
    if (reportsOverTimeTypeFilter !== "all") {
      filteredReports = filteredReports.filter(report => {
        const reportTypeValue = report.reportType || report.type || report.category || 'Others';
        const normalizedType = normalizeCategoryToType(reportTypeValue);
        return normalizedType === reportsOverTimeTypeFilter;
      });
    }

    // Count reports by date (YYYY-MM-DD format)
    const dateCounts: Record<string, number> = {};
    filteredReports.forEach(report => {
      let reportDate: Date;
      if (report.timestamp instanceof Date) {
        reportDate = report.timestamp;
      } else if (report.timestamp?.toDate && typeof report.timestamp.toDate === 'function') {
        reportDate = report.timestamp.toDate();
      } else if (report.timestamp) {
        reportDate = new Date(report.timestamp);
      } else {
        return;
      }
      
      // Format date as YYYY-MM-DD
      const dateKey = reportDate.toISOString().split('T')[0];
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
    });

    // Get top 3 dates
    const sorted = Object.entries(dateCounts)
      .map(([dateKey, count]) => {
        const date = new Date(dateKey);
        // Format date as "MMM DD, YYYY" (e.g., "Jan 15, 2024")
        const formattedDate = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        return { date: dateKey, formattedDate, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return sorted;
  }, [reports, reportsOverTimeFilter, reportsOverTimeTypeFilter]);

  // Report type distribution data - calculated from real Firestore data
  const reportTypeData = useMemo(() => {
    console.log('=== Report Type Distribution Calculation ===');
    console.log('Reports state length:', reports.length);
    console.log('Report type filter:', reportTypeFilter);
    
    const filteredReports = filterReportsByPeriod(reports, reportTypeFilter);
    
    console.log('Filtered reports count:', filteredReports.length);
    
    // Debug: Log what we're getting from reports
    if (filteredReports.length > 0) {
      console.log('Sample filtered reports:', filteredReports.slice(0, 5).map(r => ({
        id: r.id,
        category: r.category,
        reportType: r.reportType,
        type: r.type,
        timestamp: r.timestamp
      })));
    } else {
      console.warn('No filtered reports found! Check if reports array is populated and filter is correct.');
      console.log('All reports:', reports);
    }
    
    // Count reports by type - use reportType field from Firestore (primary field)
    const typeCounts: Record<string, number> = {};
    filteredReports.forEach(report => {
      // Use reportType field first (this is what's actually stored in Firestore)
      // Then fall back to type (which is mapped during fetch) or category
      const reportTypeValue = report.reportType || report.type || report.category || 'Others';
      console.log(`Processing report ${report.id}: reportType="${report.reportType}", type="${report.type}", category="${report.category}", using="${reportTypeValue}"`);
      // Normalize to match expected type names
      const normalizedType = normalizeCategoryToType(reportTypeValue);
      typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
    });
    
    // Debug: Log the counts
    console.log('Type counts from reportType field:', typeCounts);
    
    // Calculate total for percentage
    const total = filteredReports.length || 1;
    
    // Get all unique types from the data (to show actual types present)
    const typesInData = Object.keys(typeCounts);
    console.log('Unique types found in data:', typesInData);
    
    // All possible report types (matching REPORT_TYPE_LABELS from ManageReportsPage + Fire)
    const allTypes = [
      'Road Crash', 'Fire', 'Medical Emergency', 'Flooding', 
      'Volcanic Activity', 'Landslide', 'Earthquake', 'Civil Disturbance',
      'Armed Conflict', 'Infectious Disease', 'Poor Infrastructure',
      'Obstructions', 'Electrical Hazard', 'Environmental Hazard', 'Animal Concerns', 'Others'
    ];
    
    // Combine predefined types with any types found in data that aren't in the list
    const allUniqueTypes = [...new Set([...allTypes, ...typesInData])];
    
    // Create data array with percentages
    const result = allUniqueTypes
      .map(type => ({
        name: type,
        value: total > 0 ? Math.round(((typeCounts[type] || 0) / total) * 100) : 0,
        count: typeCounts[type] || 0,
        color: hazardColors[type as keyof typeof hazardColors] || hazardColors['Others']
      }))
      .filter(item => item.count > 0) // Only show types that have reports
      .sort((a, b) => b.count - a.count); // Sort by count descending
    
    console.log('Final report type distribution result:', result);
    console.log('Total reports used:', total);
    console.log('=== End Report Type Distribution Calculation ===');
    
    return result;
  }, [reports, reportTypeFilter, hazardColors]);

  // Calculate top 3 most common report types
  const top3ReportTypes = useMemo(() => {
    if (!reportTypeData || reportTypeData.length === 0) return [];
    return reportTypeData.slice(0, 3);
  }, [reportTypeData]);

  // Calculate total reports for donut chart overlay
  const totalReportsForDonut = useMemo(() => {
    if (!reportTypeData || reportTypeData.length === 0) return 0;
    return reportTypeData.reduce((sum, item) => sum + item.count, 0);
  }, [reportTypeData]);

  // Peak hours data - calculated from real Firestore data using createdTime field
  const peakHoursData = useMemo(() => {
    console.log('=== Peak Hours Calculation START ===');
    console.log('Total reports available:', reports.length);
    console.log('Peak hours filter:', peakHoursFilter);
    
    const filteredReports = filterReportsByPeriod(reports, peakHoursFilter);
    
    console.log('Filtered reports count:', filteredReports.length);
    
    // Log sample reports to see their structure
    if (filteredReports.length > 0) {
      console.log('Sample reports (first 3):', filteredReports.slice(0, 3).map(r => ({
        id: r.id,
        hasCreatedTime: !!r.createdTime,
        createdTime: r.createdTime,
        createdTimeType: typeof r.createdTime,
        hasTimestamp: !!r.timestamp,
        timestamp: r.timestamp,
        timestampType: typeof r.timestamp
      })));
    }
    
    // Initialize hour buckets
    const hourBuckets: Record<string, number> = {};
    const hourLabels = [
      "12AM", "1AM", "2AM", "3AM", "4AM", "5AM",
      "6AM", "7AM", "8AM", "9AM", "10AM", "11AM",
      "12PM", "1PM", "2PM", "3PM", "4PM", "5PM",
      "6PM", "7PM", "8PM", "9PM", "10PM", "11PM"
    ];
    
    hourLabels.forEach(label => {
      hourBuckets[label] = 0;
    });
    
    let processedCount = 0;
    let skippedCount = 0;
    const dateSourceCounts: Record<string, number> = {
      'createdTime (Date)': 0,
      'createdTime (Firestore Timestamp)': 0,
      'createdTime (string/number)': 0,
      'timestamp (Date)': 0,
      'timestamp (Firestore Timestamp)': 0,
      'timestamp (string/number)': 0,
      'none': 0
    };
    
    // Count reports by hour using createdTime field
    filteredReports.forEach((report, index) => {
      // Try to get createdTime field first, then fall back to timestamp
      let reportDate: Date | null = null;
      let dateSource = 'none';
      
      // Check for createdTime field (primary source)
      if (report.createdTime) {
        try {
          if (report.createdTime instanceof Date) {
            reportDate = report.createdTime;
            dateSource = 'createdTime (Date)';
          } else if (report.createdTime?.toDate && typeof report.createdTime.toDate === 'function') {
            reportDate = report.createdTime.toDate();
            dateSource = 'createdTime (Firestore Timestamp)';
          } else if (typeof report.createdTime === 'string' || typeof report.createdTime === 'number') {
            reportDate = new Date(report.createdTime);
            dateSource = 'createdTime (string/number)';
          }
        } catch (error) {
          console.warn(`Error parsing createdTime for report ${report.id}:`, error);
        }
      }
      
      // Fall back to timestamp if createdTime is not available
      if (!reportDate && report.timestamp) {
        try {
          if (report.timestamp instanceof Date) {
            reportDate = report.timestamp;
            dateSource = 'timestamp (Date)';
          } else if (report.timestamp?.toDate && typeof report.timestamp.toDate === 'function') {
            reportDate = report.timestamp.toDate();
            dateSource = 'timestamp (Firestore Timestamp)';
          } else if (typeof report.timestamp === 'string' || typeof report.timestamp === 'number') {
            reportDate = new Date(report.timestamp);
            dateSource = 'timestamp (string/number)';
          }
        } catch (error) {
          console.warn(`Error parsing timestamp for report ${report.id}:`, error);
        }
      }
      
      dateSourceCounts[dateSource] = (dateSourceCounts[dateSource] || 0) + 1;
      
      // Skip reports without valid timestamps
      if (!reportDate || isNaN(reportDate.getTime())) {
        skippedCount++;
        if (index < 5) { // Only log first 5 skipped reports to avoid spam
          console.warn(`Report ${report.id} missing valid createdTime or timestamp. createdTime:`, report.createdTime, 'timestamp:', report.timestamp);
        }
        return;
      }
      
      processedCount++;
      const hour = reportDate.getHours();
      
      // Convert 24-hour to 12-hour format with AM/PM
      let hourLabel: string;
      if (hour === 0) hourLabel = "12AM";
      else if (hour < 12) hourLabel = `${hour}AM`;
      else if (hour === 12) hourLabel = "12PM";
      else hourLabel = `${hour - 12}PM`;
      
      if (hourBuckets[hourLabel] !== undefined) {
        hourBuckets[hourLabel]++;
      } else {
        console.warn(`Invalid hour label: ${hourLabel} (hour: ${hour})`);
      }
    });
    
    console.log(`Processed ${processedCount} reports, skipped ${skippedCount} reports`);
    console.log('Date source breakdown:', dateSourceCounts);
    
    // Debug: Log hour distribution
    console.log('Hour buckets:', hourBuckets);
    
    // Convert to array format, only include hours with data or show all hours
    const result = hourLabels.map(hour => ({
      hour,
      reports: hourBuckets[hour] || 0
    }));
    
    console.log('Peak hours result:', result);
    console.log('Total reports in result:', result.reduce((sum, item) => sum + item.reports, 0));
    console.log('=== Peak Hours Calculation END ===');
    
    return result;
  }, [reports, peakHoursFilter]);

  // Get current year for dynamic calendar
  const currentYear = new Date().getFullYear();

  // Color thresholds for calendar intensity
  const calendarColorThresholds = {
    1: 5,  // Level 1: 0-5 reports (lightest)
    2: 10, // Level 2: 6-10 reports
    3: 15, // Level 3: 11-15 reports
    4: 20, // Level 4: 16-20 reports
    5: 21  // Level 5: 20+ reports (darkest); treated as >= value
  };

  // Map a report count to its corresponding color
  const getCalendarColor = (value: number): string => {
    if (value === 0) return '#D9D0C4'; // 0 reports use faded orange-gray
    if (value <= calendarColorThresholds[1]) return '#FFCD90'; // 1-5 reports
    if (value <= calendarColorThresholds[2]) return '#FFB76B'; // 6-10 reports
    if (value <= calendarColorThresholds[3]) return '#FFA652'; // 11-15 reports
    if (value <= calendarColorThresholds[4]) return '#FF8D21'; // 16-20 reports
    return '#FF7B00'; // 20+ reports
  };

  const calendarData = useMemo(() => {
    const data: { day: string; value: number; originalValue?: number }[] = [];
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    // Count reports per day (prefer createdDate string, fallback to timestamp)
    const reportsByDay = new Map<string, number>();
    reports.forEach((report) => {
      let reportDate: Date | null = null;

      // Prefer createdDate if present (format: MM/DD/YYYY)
      if (report?.createdDate) {
        const parts = String(report.createdDate).split('/');
        if (parts.length === 3) {
          const [mm, dd, yyyy] = parts.map((p: string) => parseInt(p, 10));
          if (!isNaN(mm) && !isNaN(dd) && !isNaN(yyyy)) {
            // Month in Date constructor is 0-based
            reportDate = new Date(yyyy, mm - 1, dd);
          }
        }
      }

      // Fallback to timestamp field
      if (!reportDate && report?.timestamp) {
        if (report.timestamp instanceof Date) {
          reportDate = report.timestamp;
        } else if (report.timestamp?.toDate && typeof report.timestamp.toDate === 'function') {
          reportDate = report.timestamp.toDate();
        } else if (typeof report.timestamp === 'string' || typeof report.timestamp === 'number') {
          reportDate = new Date(report.timestamp);
        }
      }

      if (!reportDate || isNaN(reportDate.getTime())) return;
      if (reportDate.getFullYear() !== currentYear) return;

      const dateStr = reportDate.toISOString().split('T')[0];
      const currentCount = reportsByDay.get(dateStr) || 0;
      reportsByDay.set(dateStr, currentCount + 1);
    });

    // Build calendar data for every day of the current year
    // Normalize values to 0-4 range for discrete color mapping
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const reportCount = reportsByDay.get(dateStr) || 0;
      
      // Normalize value to 0-5 for color array indexing
      let normalizedValue = 0;
      if (reportCount === 0) {
        normalizedValue = 0; // 0 reports -> faded orange-gray
      } else if (reportCount <= calendarColorThresholds[1]) {
        normalizedValue = 1; // 1-5 reports -> lightest orange
      } else if (reportCount <= calendarColorThresholds[2]) {
        normalizedValue = 2; // 6-10 reports -> second color
      } else if (reportCount <= calendarColorThresholds[3]) {
        normalizedValue = 3; // 11-15 reports -> third color
      } else if (reportCount <= calendarColorThresholds[4]) {
        normalizedValue = 4; // 16-20 reports -> fourth color
      } else {
        normalizedValue = 5; // 20+ reports -> darkest color
      }
      
      data.push({ day: dateStr, value: normalizedValue, originalValue: reportCount });
    }

    return data;
  }, [reports, currentYear]);

  // Enhanced Weather API integration with dynamic geolocation
  const fetchWeatherData = async () => {
    try {
      const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
      const FALLBACK_CITY = "Lucban,PH"; // Fallback if geolocation fails
      
      console.log("Weather API Debug:", {
        hasApiKey: !!API_KEY,
        apiKeyLength: API_KEY?.length || 0,
        apiKeyPrefix: API_KEY?.substring(0, 8) || "N/A"
      });
      
      if (!API_KEY) {
        console.warn("OpenWeatherMap API key not found. Using mock data.");
        setWeatherData(prev => ({ 
          ...prev, 
          loading: false,
          temperature: "31°C",
          temperatureCelsius: 31,
          temperatureFahrenheit: 88,
          condition: "Clear Sky",
          precipitation: "0mm",
          rainfall: "0mm",
          windSpeed: "2.2 m/s",
          windDirection: "NE",
          humidity: "65%"
        }));
        
        // Set fallback weather outlook data
        setWeatherOutlook([{
          day: "Today",
          tempCelsius: 31,
          tempFahrenheit: 88,
          temp: "31°C",
          condition: "Clear Sky",
          icon: "Clear Sky"
        }, {
          day: "Tomorrow",
          tempCelsius: 32,
          tempFahrenheit: 90,
          temp: "32°C",
          condition: "Few Clouds",
          icon: "Few Clouds"
        }, {
          day: "Wednesday",
          tempCelsius: 29,
          tempFahrenheit: 84,
          temp: "29°C",
          condition: "Shower Rain",
          icon: "Shower Rain"
        }, {
          day: "Thursday",
          tempCelsius: 30,
          tempFahrenheit: 86,
          temp: "30°C",
          condition: "Clear Sky",
          icon: "Clear Sky"
        }, {
          day: "Friday",
          tempCelsius: 33,
          tempFahrenheit: 91,
          temp: "33°C",
          condition: "Clear Sky",
          icon: "Clear Sky"
        }]);
        return;
      }

      // Try to get user's actual location using browser geolocation API
      if ('geolocation' in navigator) {
        console.log("Attempting to get user's location via geolocation...");
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log("Geolocation success:", { latitude, longitude });
            
            try {
              await fetchWeatherByCoordinatesInternal(latitude, longitude, API_KEY);
            } catch (error) {
              console.error("Error fetching weather by coordinates, falling back to city:", error);
              await fetchWeatherByCityInternal(FALLBACK_CITY, API_KEY);
            }
          },
          async (error) => {
            console.warn("Geolocation failed:", error.message);
            console.log("Falling back to Lucban, PH");
            await fetchWeatherByCityInternal(FALLBACK_CITY, API_KEY);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000 // Cache position for 5 minutes
          }
        );
      } else {
        console.log("Geolocation not available, using fallback city:", FALLBACK_CITY);
        await fetchWeatherByCityInternal(FALLBACK_CITY, API_KEY);
      }
      
    } catch (error: any) {
      console.error("Error fetching weather data:", error);
      
      // Don't show toast for weather API errors - just log them
      const message = error?.message || "Weather unavailable";
      console.warn("Weather API failed, using fallback data:", message);
      
      setWeatherData(prev => ({
        ...prev,
        loading: false,
        error: message,
        precipitation: "0mm",
        windSpeed: "0 m/s",
        windDirection: "N"
      }));
      
      // Fallback to mock data
      setWeatherOutlook([{
        day: "Today",
        tempCelsius: 31,
        tempFahrenheit: 88,
        temp: "31°C",
        condition: "Clear Sky",
        icon: "Clear Sky"
      }, {
        day: "Tomorrow",
        tempCelsius: 32,
        tempFahrenheit: 90,
        temp: "32°C",
        condition: "Few Clouds",
        icon: "Few Clouds"
      }, {
        day: "Wednesday",
        tempCelsius: 29,
        tempFahrenheit: 84,
        temp: "29°C",
        condition: "Shower Rain",
        icon: "Shower Rain"
      }, {
        day: "Thursday",
        tempCelsius: 30,
        tempFahrenheit: 86,
        temp: "30°C",
        condition: "Clear Sky",
        icon: "Clear Sky"
      }, {
        day: "Friday",
        tempCelsius: 33,
        tempFahrenheit: 91,
        temp: "33°C",
        condition: "Clear Sky",
        icon: "Clear Sky"
      }]);
    }
  };

  // Helper function to process weather data (internal function inside component)
  const processWeatherDataInternal = async (forecastUrl: string, currentWeather: any, apiKey: string) => {
    const forecastResponse = await fetch(forecastUrl);
    console.log("Forecast API Response Status:", forecastResponse.status);
    
    if (!forecastResponse.ok) {
      const errorText = await forecastResponse.text();
      console.error("Forecast API Error Response:", errorText);
      throw new Error(`Forecast API Error: ${forecastResponse.status} - ${errorText}`);
    }
    
    const forecast = await forecastResponse.json();
    console.log("Forecast API Success:", forecast);
    console.log("Forecast list length:", forecast.list?.length);
    console.log("First forecast item:", forecast.list?.[0]);
    
    // Helper function to convert wind direction from degrees to compass direction
    const getWindDirection = (degrees: number) => {
      const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      const index = Math.round(degrees / 22.5) % 16;
      return directions[index];
    };

    // Helper function to get weather interpretation
    const getWeatherInterpretation = (weatherCode: number, description: string) => {
      const code = weatherCode;
      const desc = description.toLowerCase();
      
      // Weather interpretations based on OpenWeatherMap codes and descriptions
      if (code >= 200 && code < 300) return "Thunderstorm";
      if (code >= 300 && code < 400) return "Drizzle";
      if (code >= 500 && code < 600) {
        if (desc.includes('heavy')) return "Heavy Rain";
        if (desc.includes('moderate')) return "Moderate Rain";
        if (desc.includes('light')) return "Light Rain";
        return "Rain";
      }
      if (code >= 600 && code < 700) return "Snow";
      if (code >= 700 && code < 800) {
        if (desc.includes('mist')) return "Mist";
        if (desc.includes('fog')) return "Fog";
        if (desc.includes('haze')) return "Haze";
        return "Atmospheric";
      }
      if (code === 800) return "Clear Sky";
      if (code === 801) return "Few Clouds";
      if (code === 802) return "Scattered Clouds";
      if (code === 803) return "Broken Clouds";
      if (code === 804) return "Overcast";
      
      // Fallback to capitalized description
      return description.charAt(0).toUpperCase() + description.slice(1);
    };

    // Process current weather data
    const tempCelsius = Math.round(currentWeather.main.temp);
    const tempFahrenheit = Math.round((tempCelsius * 9/5) + 32);
    
    console.log("Processed temperature:", tempCelsius, "°C =", tempFahrenheit, "°F");
    console.log("Processed condition:", getWeatherInterpretation(currentWeather.weather[0].id, currentWeather.weather[0].description));
    console.log("Wind data:", currentWeather.wind);
    console.log("Humidity:", currentWeather.main.humidity);
    console.log("Rain data:", currentWeather.rain);
    
    // Calculate precipitation from rain or snow data
    let precipAmount = 0;
    if (currentWeather.rain) {
      // Rain in last 1 hour or 3 hours
      precipAmount = currentWeather.rain['1h'] || currentWeather.rain['3h'] || 0;
    } else if (currentWeather.snow) {
      // Snow in last 1 hour or 3 hours
      precipAmount = currentWeather.snow['1h'] || currentWeather.snow['3h'] || 0;
    }
    
    const processedWeatherData = {
      temperature: `${tempCelsius}°C`,
      temperatureCelsius: tempCelsius,
      temperatureFahrenheit: tempFahrenheit,
      condition: getWeatherInterpretation(currentWeather.weather[0].id, currentWeather.weather[0].description),
      humidity: `${currentWeather.main.humidity}%`,
      rainfall: precipAmount > 0 ? `${precipAmount.toFixed(1)}mm` : "0mm",
      precipitation: precipAmount > 0 ? `${precipAmount.toFixed(1)}mm` : "0mm",
      windSpeed: `${currentWeather.wind.speed.toFixed(1)} m/s`, // Keep in m/s as provided by API
      windDirection: getWindDirection(currentWeather.wind.deg || 0),
      loading: false,
      error: null
    };
    
    console.log("Final processed weather:", {
      humidity: processedWeatherData.humidity,
      windSpeed: processedWeatherData.windSpeed,
      windDirection: processedWeatherData.windDirection,
      precipitation: processedWeatherData.precipitation
    });
    
    console.log("Final weather data:", processedWeatherData);
    
    // Process 5-day forecast
    const processedForecast = [];
    const today = new Date();
    
    // Get daily forecasts (every 8th item = 24 hours apart)
    for (let i = 0; i < 5; i++) {
      const forecastIndex = i * 8; // Every 8th forecast (24 hours)
      if (forecastIndex < forecast.list.length) {
        const dayForecast = forecast.list[forecastIndex];
        const dayName = i === 0 ? 'Today' : 
                       i === 1 ? 'Tomorrow' : 
                       new Date(today.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long' });
        
        // Calculate temperatures in both units - use proper conversion from actual temp
        const tempCelsius = Math.round(dayForecast.main.temp);
        const tempFahrenheit = Math.round((dayForecast.main.temp * 9/5) + 32);
        
        // Get interpreted weather condition
        const interpretedCondition = getWeatherInterpretation(dayForecast.weather[0].id, dayForecast.weather[0].description);
        
        processedForecast.push({
          day: dayName,
          tempCelsius: tempCelsius,
          tempFahrenheit: tempFahrenheit,
          temp: `${tempCelsius}°C`, // Default to Celsius
          condition: interpretedCondition,
          icon: interpretedCondition // Store condition for icon rendering
        });
      }
    }
    
    console.log("Processed forecast data:", processedForecast);
    
    setWeatherData(processedWeatherData);
    setWeatherOutlook(processedForecast);
  };

  // Helper function to fetch weather by coordinates (internal function inside component)
  const fetchWeatherByCoordinatesInternal = async (lat: number, lon: number, apiKey: string) => {
    try {
      // Fetch current weather by coordinates
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      console.log("Weather API URL (by coordinates):", weatherUrl.replace(apiKey, "***HIDDEN***"));
      
      const weatherResponse = await fetch(weatherUrl);
      console.log("Weather API Response Status:", weatherResponse.status);
      
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        console.error("Weather API Error Response:", errorText);
        throw new Error(`Weather API Error: ${weatherResponse.status} - ${errorText}`);
      }
      
      const currentWeather = await weatherResponse.json();
      console.log("Weather API Success (coordinates):", currentWeather);
      console.log("Location:", currentWeather.name, currentWeather.sys?.country);
      console.log("Raw temperature from API:", currentWeather.main?.temp);
      console.log("Raw weather condition:", currentWeather.weather?.[0]?.description);
      
      // Fetch 5-day forecast by coordinates
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      console.log("Forecast API URL (by coordinates):", forecastUrl.replace(apiKey, "***HIDDEN***"));
      
      await processWeatherDataInternal(forecastUrl, currentWeather, apiKey);
    } catch (error: any) {
      console.error("Error fetching weather by coordinates:", error);
      console.error("Error details:", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      throw error;
    }
  };

  // Helper function to fetch weather by city name (internal function inside component)
  const fetchWeatherByCityInternal = async (city: string, apiKey: string) => {
    try {
      // Fetch current weather
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      console.log("Weather API URL:", weatherUrl.replace(apiKey, "***HIDDEN***"));
      
      const weatherResponse = await fetch(weatherUrl);
      console.log("Weather API Response Status:", weatherResponse.status);
      
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        console.error("Weather API Error Response:", errorText);
        throw new Error(`Weather API Error: ${weatherResponse.status} - ${errorText}`);
      }
      
      const currentWeather = await weatherResponse.json();
      console.log("Weather API Success:", currentWeather);
      console.log("Raw temperature from API:", currentWeather.main?.temp);
      console.log("Raw weather condition:", currentWeather.weather?.[0]?.description);
      
      // Fetch 5-day forecast
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      console.log("Forecast API URL:", forecastUrl.replace(apiKey, "***HIDDEN***"));
      
      await processWeatherDataInternal(forecastUrl, currentWeather, apiKey);
    } catch (error: any) {
      console.error("Error fetching weather by city:", error);
      console.error("Error details:", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      throw error;
    }
  };

  // Update time every second for clock widget
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch weather data on component mount
  useEffect(() => {
    console.log("=== WEATHER API DEBUG START ===");
    fetchWeatherData();
  }, []);

  // Fetch reports from Firestore with real-time updates
  useEffect(() => {
    console.log('=== Setting up reports subscription ===');
    
    const reportsQuery = query(collection(db, "reports"), orderBy("timestamp", "desc"));
    
    // Use onSnapshot for real-time updates (like ManageReportsPage does)
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        console.log('=== Reports snapshot received ===');
        console.log('Total documents:', snapshot.docs.length);
        
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data();
          // Use reportType field as the primary source (this is what's stored in Firestore)
          // Fall back to type or category if reportType doesn't exist
          const reportType = data.reportType || data.type || data.category || 'Others';
          
          // Debug: Log first few reports to see what we're getting
          if (snapshot.docs.indexOf(doc) < 3) {
            console.log(`Report ${doc.id}:`, {
              reportType: data.reportType,
              type: data.type,
              category: data.category,
              mappedType: reportType,
              hasReportType: !!data.reportType,
              hasType: !!data.type,
              hasCategory: !!data.category,
              hasCreatedTime: !!data.createdTime,
              createdTime: data.createdTime
            });
          }
          
          // Parse createdTime field (for peak hours calculation)
          let createdTime: Date | null = null;
          if (data.createdTime) {
            if (data.createdTime?.toDate && typeof data.createdTime.toDate === 'function') {
              createdTime = data.createdTime.toDate();
            } else if (data.createdTime instanceof Date) {
              createdTime = data.createdTime;
            } else if (typeof data.createdTime === 'string' || typeof data.createdTime === 'number') {
              createdTime = new Date(data.createdTime);
            }
          }
          
          return {
            id: doc.id,
            ...data,
            // Map Firestore field names to expected field names
            // Use reportType field first (primary field in Firestore)
            type: reportType,
            // Keep original fields for reference
            reportType: data.reportType,
            category: data.category,
            barangay: data.barangay || data.locationName || 'Unknown', // Use barangay or locationName
            locationName: data.locationName || data.location || data.barangay || 'Unknown',
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp instanceof Date ? data.timestamp : new Date()),
            // Include createdTime field for peak hours calculation
            createdTime: createdTime
          };
        });
        
        console.log('Fetched reports count:', fetched.length);
        console.log('Sample fetched reports (first 3):', fetched.slice(0, 3).map(r => ({
          id: r.id,
          category: r.category,
          type: r.type,
          timestamp: r.timestamp
        })));
        setReports(fetched);
      },
      (error) => {
        console.error("Error in reports snapshot:", error);
      }
    );

    return () => {
      console.log('Unsubscribing from reports');
      unsubscribe();
    };
  }, []);

  // Fetch users from Firestore (polling every 60 seconds)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          } as any; // Type assertion to handle dynamic Firestore data
        });
        setUsers(fetched);
        
        // Count online admins
        const adminUsers = fetched.filter(user => user.role === 'admin');
        const onlineAdmins = adminUsers.filter(admin => admin.isOnline === true || admin.isOnline === 'true');
        setOnlineAdminsCount(onlineAdmins.length);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    // Initial fetch
    fetchUsers();

    // Poll every 60 seconds
    const interval = setInterval(fetchUsers, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch PAGASA bulletins from Firestore (polling every 60 seconds)
  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const bulletinsQuery = query(
          collection(db, "pagasa_bulletins"),
          orderBy("parsedAt", "desc"),
          limit(5)
        );
        
        const snapshot = await getDocs(bulletinsQuery);
        const fetched = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            parsedAt: data.parsedAt?.toDate() || new Date(),
            issueDate: data.issueDate?.toDate() || new Date()
          };
        });
        setPagasaBulletins(fetched);
      } catch (error) {
        console.error("Error fetching PAGASA bulletins:", error);
      }
    };

    // Initial fetch
    fetchBulletins();

    // Poll every 60 seconds
    const interval = setInterval(fetchBulletins, 60000);

    return () => clearInterval(interval);
  }, []);

  // Function to manually fetch PAGASA bulletins
  const fetchPagasaBulletins = async () => {
    setIsFetchingBulletins(true);
    try {
      const functions = getFunctions();
      const fetchBulletins = httpsCallable(functions, 'fetchPagasaBulletins');
      const result = await fetchBulletins();
      const data = result.data as any;
      
      if (data.success) {
        toast.success(`Successfully fetched ${data.count} bulletins`);
      } else {
        toast.error("Failed to fetch bulletins");
      }
    } catch (error: any) {
      console.error("Error fetching PAGASA bulletins:", error);
      toast.error(error.message || "Failed to fetch bulletins");
    } finally {
      setIsFetchingBulletins(false);
    }
  };

  // Helper function to get weather icon component
  const getWeatherIcon = (condition: string, className: string = "w-8 h-8") => {
    const orangeClass = "text-brand-orange stroke-brand-orange";
    const combinedClassName = `${className} ${orangeClass}`;
    const iconProps = { className: combinedClassName, strokeWidth: 1.5 };
    
    if (!condition) return <Sun {...iconProps} />;
    
    const conditionLower = condition.toLowerCase();
    
    // Map weather conditions to Lucide React icons
    // Handle interpreted conditions from getWeatherInterpretation
    if (conditionLower.includes('clear sky') || conditionLower.includes('clear') || conditionLower.includes('sunny')) {
      return <Sun {...iconProps} />;
    } else if (conditionLower.includes('few clouds')) {
      return <Cloud {...iconProps} />;
    } else if (conditionLower.includes('scattered clouds')) {
      return <Cloud {...iconProps} />;
    } else if (conditionLower.includes('broken clouds') || conditionLower.includes('overcast')) {
      return <Cloud {...iconProps} />;
    } else if (conditionLower.includes('shower') || conditionLower.includes('drizzle') || conditionLower.includes('light rain')) {
      return <CloudDrizzle {...iconProps} />;
    } else if (conditionLower.includes('rain') || conditionLower.includes('heavy rain') || conditionLower.includes('moderate rain')) {
      return <CloudRain {...iconProps} />;
    } else if (conditionLower.includes('thunderstorm') || conditionLower.includes('storm')) {
      return <CloudLightning {...iconProps} />;
    } else if (conditionLower.includes('snow')) {
      return <CloudSnow {...iconProps} />;
    } else if (conditionLower.includes('mist') || conditionLower.includes('fog') || conditionLower.includes('haze') || conditionLower.includes('atmospheric')) {
      return <CloudFog {...iconProps} />;
    } else {
      return <Sun {...iconProps} />; // Default fallback
    }
  };

  // Helper function to get pin marker icon path
  const getPinMarkerIcon = (pinType: string) => {
    const icons: Record<string, string> = {
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
      'Animal Concerns': '/markers/animal-concern.svg',
      'Others': '/markers/default.svg',
      'Evacuation Centers': '/markers/evacuation-center.svg',
      'Health Facilities': '/markers/health-facility.svg',
      'Police Stations': '/markers/police-station.svg',
      'Fire Stations': '/markers/fire-station.svg',
      'Government Offices': '/markers/government-office.svg'
    };
    return icons[pinType] || '/markers/default.svg';
  };

  // Initialize map snippet
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      // Start with street style (satellite mode uses different style)
      const initialStyle = mapLayerMode === 'satellite'
        ? 'mapbox://styles/mapbox/satellite-v9'
        : 'mapbox://styles/mapbox/streets-v12';
      
      currentMapStyleRef.current = initialStyle;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: initialStyle,
        center: [121.5556, 14.1139], // Lucban, Quezon coordinates (aligned with RiskMapPage)
        zoom: 13,
        attributionControl: false
      });

      // Wait for map to load before adding custom layers and traffic source
      map.current.on('load', () => {
        if (!map.current) return;
        
        // Add custom layers from custom style (for barangay boundaries, waterways, roads)
        if (initialStyle === 'mapbox://styles/mapbox/streets-v12') {
          try {
            const customStyleUrl = 'https://api.mapbox.com/styles/v1/accizard-lucban-official/cmhox8ita005o01sr1psmbgp6?access_token=' + mapboxgl.accessToken;
            fetch(customStyleUrl)
              .then(response => response.json())
              .then(customStyle => {
                if (!map.current) return;
                
                // Add custom sources
                if (customStyle.sources) {
                  Object.keys(customStyle.sources).forEach(sourceId => {
                    try {
                      if (!map.current!.getSource(sourceId)) {
                        const source = customStyle.sources[sourceId];
                        if (source.type === 'vector' || source.type === 'raster') {
                          map.current!.addSource(sourceId, source);
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add source ${sourceId}:`, error);
                    }
                  });
                }
                
                // Add custom layers
                if (customStyle.layers) {
                  const layersToAdd = new Set([
                    'lucban-boundary', 'lucban-brgys', 'lucban-brgys-satellite', 'lucban-fill', 'lucban-brgy-names'
                  ]);
                  const waterwayPattern = /^waterway/;
                  const roadPattern = /^(road|roads|road-network|highway|road-label)/;
                  
                  customStyle.layers.forEach((layer: any) => {
                    try {
                      const shouldAdd = layersToAdd.has(layer.id) || 
                                        waterwayPattern.test(layer.id) || 
                                        roadPattern.test(layer.id);
                      
                      if (shouldAdd && !map.current!.getLayer(layer.id)) {
                        if (layer.source && map.current!.getSource(layer.source)) {
                          map.current!.addLayer(layer);
                          // Set initial visibility - all custom layers hidden by default (shown only when selected mode)
                          map.current!.setLayoutProperty(layer.id, 'visibility', 'none');
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add layer ${layer.id}:`, error);
                    }
                  });
                }
              })
              .catch(error => {
                console.error('Error fetching custom style for initial load:', error);
              });
          } catch (error) {
            console.error('Error adding custom layers on initial load:', error);
          }
        }
        
        // Add traffic source
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
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when pins change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Don't show any markers - normal mode should not display markers
    // Markers are intentionally hidden for all modes
    return;
    pins.forEach(pin => {
      const iconPath = getPinMarkerIcon(pin.type);
      
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.cssText = `
        width: 40px;
        height: 40px;
        cursor: pointer;
        background-image: url('${iconPath}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      `;

      // Add popup with pin information
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family: 'DM Sans', sans-serif;">
          <h3 style="font-weight: 600; margin-bottom: 4px;">${pin.title}</h3>
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${pin.type}</p>
          <p style="font-size: 11px; color: #9ca3af;">${pin.locationName}</p>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [pins, mapLayerMode]);

  // Subscribe to pins from database
  useEffect(() => {
    console.log('Subscribing to pins for dashboard map');
    
    const unsubscribe = subscribeToPins(
      {}, // No filters - show all pins
      (fetchedPins) => {
        console.log('Dashboard map: Pins updated from database:', fetchedPins.length);
        setPins(fetchedPins);
      },
      (error) => {
        console.error('Dashboard map: Error fetching pins:', error);
        // Silently fail - don't show error toast on dashboard
      }
    );

    return () => {
      console.log('Dashboard map: Unsubscribing from pins');
      unsubscribe();
    };
  }, [subscribeToPins]);

  // Handle map layer mode changes
  useEffect(() => {
    if (!map.current) return;

    const currentMap = map.current;
    if (!currentMap.isStyleLoaded()) return;

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

    // Determine target style based on mode
    const targetStyle = mapLayerMode === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-v9'
      : 'mapbox://styles/mapbox/streets-v12';

    // Helper function to apply layer toggles
    function applyLayerToggles() {
      if (!map.current || !currentMap.isStyleLoaded()) return;

      // Show barangay boundaries only in barangayBoundaries mode
      toggleLayer('lucban-brgys', mapLayerMode === 'barangayBoundaries');
      toggleLayer('lucban-brgys-satellite', mapLayerMode === 'barangayBoundaries');
      toggleLayer('lucban-fill', mapLayerMode === 'barangayBoundaries');
      toggleLayer('lucban-brgy-names', mapLayerMode === 'barangayBoundaries');

      // Toggle road network
      const roadLayerNames = ['road', 'roads', 'road-network', 'highway', 'road-label', 'road-satellite'];
      roadLayerNames.forEach(layerName => {
        try {
          if (map.current && map.current.getLayer(layerName)) {
            toggleLayer(layerName, mapLayerMode === 'roadNetwork');
          }
        } catch (error) {
          // Layer doesn't exist, continue
        }
      });

      // Toggle waterways
      toggleLayer('waterway', mapLayerMode === 'waterways');
      toggleLayer('waterway-satellite', mapLayerMode === 'waterways');

      // Toggle traffic layer
      if (mapLayerMode === 'traffic') {
        if (!map.current.getSource('mapbox-traffic')) {
          map.current.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
          });
        }

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
              'visibility': 'visible'
            }
          });
        } else {
          toggleLayer('traffic', true);
        }
      } else {
        toggleLayer('traffic', false);
      }

      // Hide markers in all modes - normal mode should not display markers
      markersRef.current.forEach(marker => marker.getElement().style.display = 'none');
    }

    // Check if we need to switch styles
    const needsStyleSwitch = currentMapStyleRef.current !== targetStyle;

    if (needsStyleSwitch) {
      const center = currentMap.getCenter();
      const zoom = currentMap.getZoom();

      currentMap.once('style.load', () => {
        if (!map.current) return;
        
        currentMapStyleRef.current = targetStyle;
        map.current.setCenter(center);
        map.current.setZoom(zoom);
        
        // If switching to satellite, add custom layers as overlays
        if (mapLayerMode === 'satellite') {
          try {
            const customStyleUrl = 'https://api.mapbox.com/styles/v1/accizard-lucban-official/cmhox8ita005o01sr1psmbgp6?access_token=' + mapboxgl.accessToken;
            fetch(customStyleUrl)
              .then(response => response.json())
              .then(customStyle => {
                if (!map.current) return;
                
                // Add custom sources
                if (customStyle.sources) {
                  Object.keys(customStyle.sources).forEach(sourceId => {
                    try {
                      if (!map.current!.getSource(sourceId)) {
                        const source = customStyle.sources[sourceId];
                        if (source.type === 'vector' || source.type === 'raster') {
                          map.current!.addSource(sourceId, source);
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add source ${sourceId}:`, error);
                    }
                  });
                }
                
                // Add custom layers
                if (customStyle.layers) {
                  const layersToAdd = new Set([
                    'lucban-boundary', 'lucban-brgys', 'lucban-brgys-satellite', 'lucban-fill', 'lucban-brgy-names'
                  ]);
                  const waterwayPattern = /^waterway/;
                  const roadPattern = /^(road|roads|road-network|highway|road-label)/;
                  
                  customStyle.layers.forEach((layer: any) => {
                    try {
                      const shouldAdd = layersToAdd.has(layer.id) || 
                                        waterwayPattern.test(layer.id) || 
                                        roadPattern.test(layer.id);
                      
                      if (shouldAdd && !map.current!.getLayer(layer.id)) {
                        if (layer.source && map.current!.getSource(layer.source)) {
                          map.current!.addLayer(layer);
                          // Set initial visibility - will be updated by applyLayerToggles
                          map.current!.setLayoutProperty(layer.id, 'visibility', 'none');
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add layer ${layer.id}:`, error);
                    }
                  });
                }
                
                // Add traffic source and layer for satellite
                if (!map.current.getSource('mapbox-traffic')) {
                  map.current.addSource('mapbox-traffic', {
                    type: 'vector',
                    url: 'mapbox://mapbox.mapbox-traffic-v1'
                  });
                }
                
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
                
                // Apply layer toggles after layers are added
                applyLayerToggles();
              })
              .catch(error => {
                console.error('Error fetching custom style for satellite:', error);
                applyLayerToggles();
              });
          } catch (error) {
            console.error('Error adding custom layers to satellite:', error);
            applyLayerToggles();
          }
        } else {
          // For streets-v12 style, add custom layers as overlays
          try {
            const customStyleUrl = 'https://api.mapbox.com/styles/v1/accizard-lucban-official/cmhox8ita005o01sr1psmbgp6?access_token=' + mapboxgl.accessToken;
            fetch(customStyleUrl)
              .then(response => response.json())
              .then(customStyle => {
                if (!map.current) return;
                
                // Add custom sources
                if (customStyle.sources) {
                  Object.keys(customStyle.sources).forEach(sourceId => {
                    try {
                      if (!map.current!.getSource(sourceId)) {
                        const source = customStyle.sources[sourceId];
                        if (source.type === 'vector' || source.type === 'raster') {
                          map.current!.addSource(sourceId, source);
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add source ${sourceId}:`, error);
                    }
                  });
                }
                
                // Add custom layers
                if (customStyle.layers) {
                  const layersToAdd = new Set([
                    'lucban-boundary', 'lucban-brgys', 'lucban-brgys-satellite', 'lucban-fill', 'lucban-brgy-names'
                  ]);
                  const waterwayPattern = /^waterway/;
                  const roadPattern = /^(road|roads|road-network|highway|road-label)/;
                  
                  customStyle.layers.forEach((layer: any) => {
                    try {
                      const shouldAdd = layersToAdd.has(layer.id) || 
                                        waterwayPattern.test(layer.id) || 
                                        roadPattern.test(layer.id);
                      
                      if (shouldAdd && !map.current!.getLayer(layer.id)) {
                        if (layer.source && map.current!.getSource(layer.source)) {
                          map.current!.addLayer(layer);
                          // Set initial visibility - will be updated by applyLayerToggles
                          map.current!.setLayoutProperty(layer.id, 'visibility', 'none');
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not add layer ${layer.id}:`, error);
                    }
                  });
                }
                
                // Re-add traffic source after style change if needed
                if (mapLayerMode === 'traffic' || mapLayerMode === 'normal') {
                  if (!map.current.getSource('mapbox-traffic')) {
                    map.current.addSource('mapbox-traffic', {
                      type: 'vector',
                      url: 'mapbox://mapbox.mapbox-traffic-v1'
                    });
                  }

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
                        'visibility': mapLayerMode === 'traffic' ? 'visible' : 'none'
                      }
                    });
                  }
                }

                // Apply layer toggles after layers are added
                applyLayerToggles();
              })
              .catch(error => {
                console.error('Error fetching custom style for streets:', error);
                // Still apply layer toggles even if custom layers fail
                applyLayerToggles();
              });
          } catch (error) {
            console.error('Error adding custom layers to streets:', error);
            applyLayerToggles();
          }
        }
      });

      currentMap.setStyle(targetStyle);
      return;
    }

    // Apply layer toggles if style is already correct
    applyLayerToggles();
  }, [mapLayerMode, pins]);

  // Format current time for display
  const formattedTime = currentTime.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const getTotalReports = () => {
    switch (totalReportsFilter) {
      case "this-week":
        return 23;
      case "this-month":
        return 156;
      case "this-year":
        return 1840;
      default:
        return 156;
    }
  };

  // Generic export function for charts
  const exportChart = (chartId: string, fileName: string, format: 'png' | 'svg' | 'pdf') => {
    const svgElement = document.querySelector(`${chartId} svg`);
    if (!svgElement) {
      toast.error('Chart not found. Please try again.');
      return;
    }
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    
    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fileName}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    
    // For PNG and PDF, we need to convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'pdf') {
        import('jspdf').then(async ({ default: jsPDF }) => {
          const pdf = new jsPDF('landscape');
          
          // Format current date/time for PDF header (MM/dd/yy at h:mm AM/PM)
          const now = new Date();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          const yy = String(now.getFullYear()).slice(-2);
          const hours12 = now.getHours() % 12 || 12;
          const minutes = String(now.getMinutes()).padStart(2, "0");
          const ampm = now.getHours() >= 12 ? "PM" : "AM";
          const formattedDateTime = `${mm}/${dd}/${yy} at ${hours12}:${minutes} ${ampm}`;
          
          // Load logo images
          const loadImage = (src: string): Promise<string> => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              };
              img.onerror = () => resolve(''); // Return empty string if image fails to load
              img.src = src;
            });
          };
          
          const leftLogoData = await loadImage('/accizard-uploads/lucban-logo.png');
          const rightLogoData = await loadImage('/accizard-uploads/logo-ldrrmo-png.png');
          
          // Add header logos (90px = ~24mm at 96dpi)
          const logoSize = 24; // mm
          const logoY = 5; // mm from top
          
          if (leftLogoData) {
            pdf.addImage(leftLogoData, 'PNG', 5, logoY, logoSize, logoSize);
          }
          
          if (rightLogoData) {
            // Right logo: page width (297mm) - logo size - margin
            pdf.addImage(rightLogoData, 'PNG', 297 - logoSize - 5, logoY, logoSize, logoSize);
          }
          
          // Add header text (centered)
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          
          // Republic of the PHILIPPINES
          pdf.setFont(undefined, 'normal');
          pdf.text('Republic of the', 148.5, logoY + 5, { align: 'center' });
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 102, 204);
          pdf.text('PHILIPPINES', 148.5, logoY + 7, { align: 'center' });
          
          // Province of QUEZON
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.text('Province of', 148.5, logoY + 9, { align: 'center' });
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 102, 204);
          pdf.text('QUEZON', 148.5, logoY + 11, { align: 'center' });
          
          // MUNICIPALITY OF LUCBAN
          pdf.setFontSize(15);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 102, 204);
          pdf.text('MUNICIPALITY OF LUCBAN', 148.5, logoY + 15, { align: 'center' });
          
          // MUNICIPAL DISASTER RISK REDUCTION AND MANAGEMENT OFFICE
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('MUNICIPAL DISASTER RISK REDUCTION AND MANAGEMENT OFFICE', 148.5, logoY + 20, { align: 'center' });
          
          // Chart title (based on fileName)
          const chartTitles: Record<string, string> = {
            'reports-per-barangay': 'REPORTS PER BARANGAY',
            'calendar-activity': 'CALENDAR ACTIVITY',
            'users-per-barangay': 'ACTIVE USERS PER BARANGAY',
            'report-type-distribution': 'REPORT TYPE DISTRIBUTION',
            'peak-reporting-hours': 'PEAK REPORTING HOURS',
            'reports-over-time': 'REPORTS OVER TIME'
          };
          
          const chartTitle = chartTitles[fileName] || 'CHART';
          pdf.setFontSize(13);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 102, 204);
          pdf.text(chartTitle, 148.5, logoY + 28, { align: 'center' });
          
          // Date/Time
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`DATE/TIME: ${formattedDateTime}`, 5, logoY + 33);
          
          // Add chart image below header (starting at ~40mm from top)
          const chartStartY = logoY + 35;
          const chartWidth = 287; // 297mm - 10mm margins
          const chartHeight = (canvas.height / canvas.width) * chartWidth; // Maintain aspect ratio
          const maxChartHeight = 150; // Maximum height to fit on page
          const finalChartHeight = Math.min(chartHeight, maxChartHeight);
          const finalChartWidth = (canvas.width / canvas.height) * finalChartHeight;
          
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', (297 - finalChartWidth) / 2, chartStartY, finalChartWidth, finalChartHeight);
          
          pdf.save(`${fileName}.pdf`);
        });
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Export functions for Barangay Reports chart
  const exportChartAsPNG = () => {
    const chartId = isChartModalOpen ? '#nivo-chart-modal' : '#nivo-chart';
    exportChart(chartId, 'reports-per-barangay', 'png');
  };

  const exportChartAsSVG = () => {
    const chartId = isChartModalOpen ? '#nivo-chart-modal' : '#nivo-chart';
    exportChart(chartId, 'reports-per-barangay', 'svg');
  };

  const exportChartAsPDF = () => {
    const chartId = isChartModalOpen ? '#nivo-chart-modal' : '#nivo-chart';
    exportChart(chartId, 'reports-per-barangay', 'pdf');
  };

  // Export functions for Calendar chart
  const exportCalendarAsPNG = () => {
    exportChart('#calendar-chart', 'calendar-activity', 'png');
  };

  const exportCalendarAsSVG = () => {
    exportChart('#calendar-chart', 'calendar-activity', 'svg');
  };

  const exportCalendarAsPDF = () => {
    exportChart('#calendar-chart', 'calendar-activity', 'pdf');
  };

  // Export functions for Users chart
  const exportUsersChartAsPNG = () => {
    const chartId = isUsersChartModalOpen ? '#users-chart-modal' : '#users-chart';
    exportChart(chartId, 'users-per-barangay', 'png');
  };

  const exportUsersChartAsSVG = () => {
    const chartId = isUsersChartModalOpen ? '#users-chart-modal' : '#users-chart';
    exportChart(chartId, 'users-per-barangay', 'svg');
  };

  const exportUsersChartAsPDF = () => {
    const chartId = isUsersChartModalOpen ? '#users-chart-modal' : '#users-chart';
    exportChart(chartId, 'users-per-barangay', 'pdf');
  };

  // Export functions for Pie chart
  const exportPieChartAsPNG = () => {
    const chartId = isPieChartModalOpen ? '#pie-chart-modal' : '#pie-chart';
    exportChart(chartId, 'report-type-distribution', 'png');
  };

  const exportPieChartAsSVG = () => {
    const chartId = isPieChartModalOpen ? '#pie-chart-modal' : '#pie-chart';
    exportChart(chartId, 'report-type-distribution', 'svg');
  };

  const exportPieChartAsPDF = () => {
    const chartId = isPieChartModalOpen ? '#pie-chart-modal' : '#pie-chart';
    exportChart(chartId, 'report-type-distribution', 'pdf');
  };

  // Export functions for Peak Hours chart
  const exportPeakHoursChartAsPNG = () => {
    const chartId = isPeakHoursModalOpen ? '#peak-hours-chart-modal' : '#peak-hours-chart';
    exportChart(chartId, 'peak-reporting-hours', 'png');
  };

  const exportPeakHoursChartAsSVG = () => {
    const chartId = isPeakHoursModalOpen ? '#peak-hours-chart-modal' : '#peak-hours-chart';
    exportChart(chartId, 'peak-reporting-hours', 'svg');
  };

  const exportPeakHoursChartAsPDF = () => {
    const chartId = isPeakHoursModalOpen ? '#peak-hours-chart-modal' : '#peak-hours-chart';
    exportChart(chartId, 'peak-reporting-hours', 'pdf');
  };

  // Export functions for Reports Over Time chart
  const exportReportsOverTimeChartAsPNG = () => {
    const chartId = isReportsOverTimeModalOpen ? '#reports-over-time-chart-modal' : '#reports-over-time-chart';
    exportChart(chartId, 'reports-over-time', 'png');
  };

  const exportReportsOverTimeChartAsSVG = () => {
    const chartId = isReportsOverTimeModalOpen ? '#reports-over-time-chart-modal' : '#reports-over-time-chart';
    exportChart(chartId, 'reports-over-time', 'svg');
  };

  const exportReportsOverTimeChartAsPDF = () => {
    const chartId = isReportsOverTimeModalOpen ? '#reports-over-time-chart-modal' : '#reports-over-time-chart';
    exportChart(chartId, 'reports-over-time', 'pdf');
  };

  // Export entire dashboard as printable HTML
  const exportDashboardAsHTML = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    toast.success('Generating report with chart screenshots...');

    // Get current date and time
    const now = new Date();
    const dateString = now.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeString = now.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Get statistics
    const totalReports = getTotalReports();

    // Capture chart screenshots
    const captureChartAsBase64 = (selector: string): Promise<string> => {
      return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (!element) {
          resolve('');
          return;
        }
        
        html2canvas(element as HTMLElement, {
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true
        } as any).then(canvas => {
          resolve(canvas.toDataURL('image/png'));
        }).catch(() => {
          resolve('');
        });
      });
    };

    try {
      // Only capture charts that are selected for export
      const chartPromises = [];
      if (selectedChartsForExport['Reports Over Time']) {
        chartPromises.push(captureChartAsBase64('#reports-over-time-chart').then(result => ({ key: 'reportsOverTimeChart', value: result })));
      }
      if (selectedChartsForExport['Report Type Distribution']) {
        chartPromises.push(captureChartAsBase64('#pie-chart').then(result => ({ key: 'pieChart', value: result })));
      }
      if (selectedChartsForExport['Reports per Barangay']) {
        chartPromises.push(captureChartAsBase64('#nivo-chart').then(result => ({ key: 'barangayChart', value: result })));
      }
      if (selectedChartsForExport['Active Users per Barangay']) {
        chartPromises.push(captureChartAsBase64('#users-chart').then(result => ({ key: 'usersChart', value: result })));
      }
      if (selectedChartsForExport['Peak Reporting Hours']) {
        chartPromises.push(captureChartAsBase64('#peak-hours-chart').then(result => ({ key: 'peakHoursChart', value: result })));
      }
      if (selectedChartsForExport['Report Activity Calendar']) {
        chartPromises.push(captureChartAsBase64('#calendar-chart').then(result => ({ key: 'calendarChart', value: result })));
      }

      const chartResults = await Promise.all(chartPromises);
      
      // Create a map of captured charts
      const capturedCharts: Record<string, string> = {};
      chartResults.forEach(result => {
        if (result) {
          capturedCharts[result.key] = result.value;
        }
      });
      
      const reportsOverTimeChart = capturedCharts['reportsOverTimeChart'] || '';
      const pieChart = capturedCharts['pieChart'] || '';
      const barangayChart = capturedCharts['barangayChart'] || '';
      const usersChart = capturedCharts['usersChart'] || '';
      const peakHoursChart = capturedCharts['peakHoursChart'] || '';
      const calendarChart = capturedCharts['calendarChart'] || '';

      // Create HTML content with actual chart screenshots
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AcciZard Dashboard Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'DM Sans', sans-serif;
      padding: 20px;
      background: white;
      color: #111827;
    }
    
    .header {
      border-bottom: 2px solid #f97316;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    
    .header h1 {
      color: #f97316;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .header-info {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    .stat-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    
    .stat-description {
      font-size: 10px;
      color: #f97316;
      margin-top: 2px;
    }
    
    .section {
      margin-bottom: 25px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 10px;
      border-bottom: 2px solid #f97316;
      padding-bottom: 8px;
    }
    
    .section-content {
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
      margin-bottom: 10px;
    }
    
    .charts-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 25px;
      margin-bottom: 30px;
    }
    
    .charts-container [style*="grid-column: 2"] {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .chart-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .chart-item img {
      max-width: 100%;
      height: auto;
      max-height: 600px;
      object-fit: contain;
    }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .chart-placeholder {
      height: 400px;
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      color: #9ca3af;
      font-size: 14px;
    }
    
    @media print {
      body {
        padding: 10px;
      }
      
      .section {
        page-break-inside: avoid;
        margin-bottom: 20px;
      }
      
      .chart-item {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      .stat-card {
        page-break-inside: avoid;
      }
      
      .header {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AcciZard Dashboard Report</h1>
    <div class="header-info">
      <div>
        <strong>Generated:</strong> ${dateString} at ${timeString}
      </div>
      <div>
        <strong>Location:</strong> Lucban, Quezon, Philippines
      </div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Most Common Type</div>
      <div class="stat-value">${mostCommonType.count}</div>
      <div class="stat-description">${mostCommonType.type} - ${mostCommonType.percentage}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Week</div>
      <div class="stat-value">${weeklyReports}</div>
      <div class="stat-description">Last 7 days</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Users</div>
      <div class="stat-value">${activeUsers.toLocaleString()}</div>
      <div class="stat-description">Registered</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Response Time</div>
      <div class="stat-value">8.5</div>
      <div class="stat-description">minutes</div>
    </div>
  </div>

${reportsOverTimeChart || pieChart ? `
  <div class="charts-container">
${reportsOverTimeChart ? `
    <div class="chart-item">
      <div class="section-title">Reports Over Time</div>
      <div class="section-content">Chart showing report trends across different time periods</div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
        <strong>Filter:</strong> ${reportTypeFilter}
      </div>
      <img src="${reportsOverTimeChart}" alt="Reports Over Time Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
    </div>
` : ''}
${pieChart ? `
    <div class="chart-item">
      <div class="section-title">Report Type Distribution</div>
      <div class="section-content">Breakdown of reports by type</div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
        <strong>Filter:</strong> ${reportTypeFilter}
      </div>
      <img src="${pieChart}" alt="Report Type Distribution" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
    </div>
` : ''}
  </div>
` : ''}

${barangayChart && (usersChart || peakHoursChart) ? `
  <div class="charts-container" style="page-break-inside: avoid;">
    ${barangayChart ? `
      <div class="chart-item" style="grid-column: 1;">
        <div class="section-title">Reports per Barangay</div>
        <div class="section-content">Geographic distribution of reports across barangays</div>
        <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
          <strong>Filter:</strong> ${barangayReportsFilter}
        </div>
        <img src="${barangayChart}" alt="Barangay Reports Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
      </div>
    ` : ''}
    ${usersChart || peakHoursChart ? `
      <div style="grid-column: 2; display: flex; flex-direction: column; gap: 15px;">
${usersChart ? `
        <div class="chart-item">
          <div class="section-title">Active Users per Barangay</div>
          <div class="section-content">User distribution across different barangays</div>
          <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
            <strong>Filter:</strong> ${usersBarangayFilter}
          </div>
          <img src="${usersChart}" alt="Users per Barangay Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
        </div>
` : ''}
${peakHoursChart ? `
        <div class="chart-item">
          <div class="section-title">Peak Reporting Hours</div>
          <div class="section-content">Time-based analysis of report submission patterns</div>
          <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
            <strong>Filter:</strong> ${peakHoursFilter}
          </div>
          <img src="${peakHoursChart}" alt="Peak Hours Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
        </div>
` : ''}
      </div>
    ` : ''}
  </div>
` : ''}

${barangayChart && !usersChart && !peakHoursChart ? `
  <div class="chart-item" style="width: 100%; margin-bottom: 30px;">
    <div class="section-title">Reports per Barangay</div>
    <div class="section-content">Geographic distribution of reports across barangays</div>
    <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
      <strong>Filter:</strong> ${barangayReportsFilter}
    </div>
    <img src="${barangayChart}" alt="Barangay Reports Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
  </div>
` : ''}
${(!barangayChart || (!usersChart && !peakHoursChart)) && (usersChart || peakHoursChart) ? `
  <div style="margin-bottom: 30px;">
${usersChart ? `
    <div class="chart-item" style="width: 100%; margin-bottom: 15px;">
      <div class="section-title">Active Users per Barangay</div>
      <div class="section-content">User distribution across different barangays</div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
        <strong>Filter:</strong> ${usersBarangayFilter}
      </div>
      <img src="${usersChart}" alt="Users per Barangay Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
    </div>
` : ''}
${peakHoursChart ? `
    <div class="chart-item" style="width: 100%;">
      <div class="section-title">Peak Reporting Hours</div>
      <div class="section-content">Time-based analysis of report submission patterns</div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px;">
        <strong>Filter:</strong> ${peakHoursFilter}
      </div>
      <img src="${peakHoursChart}" alt="Peak Hours Chart" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
    </div>
` : ''}
  </div>
` : ''}

${calendarChart ? `
  <div class="chart-item" style="width: 100%; margin-bottom: 30px;">
    <div class="section-title">Report Activity Calendar</div>
    <div class="section-content">Daily report activity heatmap for 2025</div>
    <img src="${calendarChart}" alt="Calendar Heatmap" style="border: 1px solid #e5e7eb; border-radius: 8px; width: 100%;" />
  </div>
` : ''}

  <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
    <p>AcciZard - Lucban Disaster Risk Reduction and Management Office</p>
    <p>This report was generated automatically on ${dateString} at ${timeString}</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
    </script>
</body>
</html>
    `;

      // Write and print
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      toast.success('Dashboard exported as printable HTML. The print dialog will open shortly.');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report. Please try again.');
    }
  };

  // Memoized Nivo theme to match DM Sans font
  const nivoTheme = useMemo(() => ({
    text: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 10,
    },
    axis: {
      legend: {
        text: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 11,
          fontWeight: 500,
        }
      },
      ticks: {
        text: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 9,
        }
      }
    },
    legends: {
      text: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 10,
      }
    },
    labels: {
      text: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 9,
      }
    },
    tooltip: {
      container: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 10,
      }
    }
  }), []);

  // Function to toggle report type visibility
  const toggleReportType = (reportType: string) => {
    setEnabledReportTypes(prev => ({
      ...prev,
      [reportType]: !prev[reportType]
    }));
  };

  // Memoized chart keys based on enabled report types
  const chartKeys = useMemo(() => {
    const allKeys = [
      'Road Crash', 'Fire', 'Medical Emergency', 'Flooding', 
      'Volcanic Activity', 'Landslide', 'Earthquake', 'Civil Disturbance',
      'Armed Conflict', 'Infectious Disease', 'Poor Infrastructure',
      'Obstructions', 'Electrical Hazard', 'Environmental Hazard', 'Others'
    ];
    return allKeys.filter(key => enabledReportTypes[key]);
  }, [enabledReportTypes]);

  // Memoized chart margins and axis config
  const chartMargin = useMemo(() => ({ top: 30, right: 60, bottom: 30, left: 60 }), []);
  
  // Main dashboard view - hide x-axis labels completely
  const axisBottomConfig = useMemo(() => ({
    tickSize: 0,
    tickPadding: 0,
    tickRotation: 0,
    legend: '',
    legendPosition: 'middle' as const,
    legendOffset: 0,
    format: () => '' // Hide all tick labels
  }), []);
  
  // Modal view - show x-axis labels
  const axisBottomConfigModal = useMemo(() => ({
    tickSize: 5,
    tickPadding: 5,
    tickRotation: -45,
    legend: 'Barangay',
    legendPosition: 'middle' as const,
    legendOffset: 60
  }), []);

  // Reports Over Time Chart - inline component
  const ReportsOverTimeChart = ({ height = '100%', chartId = 'reports-over-time-chart', pointSize = 6, bottomMargin = 60 }: { height?: string; chartId?: string; pointSize?: number; bottomMargin?: number }) => {
    const filteredData = useMemo(() => {
      // Show all report types by default, only hide if explicitly disabled
      return reportsOverTimeData.filter(item => {
        // If explicitly set to false, hide it
        if (enabledReportTypes[item.id] === false) return false;
        // Otherwise, show it (true or undefined)
        return true;
      });
    }, [reportsOverTimeData, enabledReportTypes]);

    return (
      <div id={chartId} style={{ height, minHeight: '300px' }}>
        <ResponsiveLine
          data={filteredData}
          margin={{ top: 30, right: 60, bottom: bottomMargin, left: 60 }}
          xScale={{ type: 'point' }}
          yScale={{ 
            type: 'linear', 
            min: 'auto', 
            max: 'auto',
            stacked: false,
            reverse: false 
          }}
          yFormat=" >-.0f"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Month',
            legendPosition: 'middle',
            legendOffset: bottomMargin > 60 ? 50 : 40
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Number of Reports',
            legendPosition: 'middle',
            legendOffset: -50
          }}
          colors={({ id }) => hazardColors[id as keyof typeof hazardColors] || '#6B7280'}
          pointSize={pointSize}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'seriesColor' }}
          pointLabelYOffset={-12}
          useMesh={true}
          theme={nivoTheme}
          tooltip={({ point }) => (
            <div style={{
              background: 'white',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 600, color: '#111827' }}>
                {point.data.xFormatted}
              </div>
              <div style={{ color: point.seriesColor, fontWeight: 500 }}>
                {point.seriesId}: {point.data.yFormatted} reports
              </div>
            </div>
          )}
        />
      </div>
    );
  };
  const axisLeftConfig = useMemo(() => ({
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: 'Number of Reports',
    legendPosition: 'middle' as const,
    legendOffset: -50
  }), []);
  const legendsConfig = useMemo(() => [{
    dataFrom: 'keys' as const,
    anchor: 'bottom' as const,
    direction: 'row' as const,
    justify: false,
    translateX: 0,
    translateY: 20,
    itemsSpacing: 20,
    itemWidth: 100,
    itemHeight: 20,
    itemDirection: 'left-to-right' as const,
    itemOpacity: 0.85,
    symbolSize: 18,
    effects: [
      {
        on: 'hover' as const,
        style: {
          itemOpacity: 1
        }
      }
    ]
  }], []);

  // Calculate dynamic statistics from reports
  const weeklyReports = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return reports.filter(r => r.timestamp >= oneWeekAgo).length;
  }, [reports]);

  const activeUsers = useMemo(() => {
    return users.length;
  }, [users]);

  const mostCommonType = useMemo(() => {
    if (reports.length === 0) return { type: 'N/A', count: 0, percentage: 0 };
    
    const typeCounts: Record<string, number> = {};
    reports.forEach(report => {
      const type = report.type || 'Others';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    if (sortedTypes.length === 0) return { type: 'N/A', count: 0, percentage: 0 };

    const [type, count] = sortedTypes[0];
    const percentage = Math.round((count / reports.length) * 100);
    
    return { type, count, percentage };
  }, [reports]);

  // Helper function to parse responseTime string to minutes
  // Handles formats like "1 hr 30 min", "45 min", "2 hr 5 min"
  const parseResponseTimeToMinutes = (responseTime: string): number => {
    try {
      if (!responseTime) return 0;
      
      // Remove extra spaces and convert to lowercase for easier parsing
      const cleaned = responseTime.trim().toLowerCase();
      
      let totalMinutes = 0;
      
      // Check for hours (format: "X hr" or "X hr Y min")
      const hourMatch = cleaned.match(/(\d+)\s*hr/);
      if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10);
        totalMinutes += hours * 60;
      }
      
      // Check for minutes (format: "Y min")
      const minuteMatch = cleaned.match(/(\d+)\s*min/);
      if (minuteMatch) {
        const minutes = parseInt(minuteMatch[1], 10);
        totalMinutes += minutes;
      }
      
      return totalMinutes;
    } catch (error) {
      console.error('Error parsing response time:', error);
      return 0;
    }
  };

  const avgResponseTime = useMemo(() => {
    // Filter reports that have saved responseTime in dispatchInfo
    const reportsWithResponseTime = reports.filter(r => 
      r.dispatchInfo?.responseTime && r.dispatchInfo.responseTime.trim() !== ''
    );
    
    if (reportsWithResponseTime.length === 0) return null;

    // Calculate total response time in minutes by parsing responseTime strings
    const totalMinutes = reportsWithResponseTime.reduce((sum, report) => {
      try {
        const responseTimeStr = report.dispatchInfo.responseTime;
        const minutes = parseResponseTimeToMinutes(responseTimeStr);
        return sum + minutes;
      } catch (error) {
        return sum;
      }
    }, 0);

    const avgMinutes = totalMinutes / reportsWithResponseTime.length;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);

    return {
      avgMinutes: Math.round(avgMinutes),
      formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      count: reportsWithResponseTime.length
    };
  }, [reports]);

  // Reusable chart component - memoized to prevent unnecessary re-renders
  const BarangayReportsChart = useMemo(() => 
    ({ height = '100%', chartId = 'nivo-chart' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '300px' }}>
        <ResponsiveBar
          data={stackedReportsData}
          keys={chartKeys}
          indexBy="barangay"
          margin={chartMargin}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={({ id }) => hazardColors[id as keyof typeof hazardColors] || '#6B7280'}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={axisBottomConfig}
          axisLeft={axisLeftConfig}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          legends={[]}
          animate={true}
          tooltip={({ id, value, indexValue, color }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {value}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  {id}
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {indexValue}
              </div>
            </div>
          )}
        />
      </div>
    ), [stackedReportsData, chartKeys, chartMargin, axisBottomConfig, axisLeftConfig, legendsConfig, hazardColors, nivoTheme]
  );

  // Modal version of Barangay Reports Chart with labels
  const BarangayReportsChartModal = useMemo(() => 
    ({ height = '100%', chartId = 'nivo-chart-modal' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '400px' }}>
        <ResponsiveBar
          data={stackedReportsData}
          keys={chartKeys}
          indexBy="barangay"
          margin={chartMargin}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={({ id }) => hazardColors[id as keyof typeof hazardColors] || '#6B7280'}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={axisBottomConfigModal}
          axisLeft={axisLeftConfig}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          legends={[]}
          animate={true}
          tooltip={({ id, value, indexValue, color }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {value}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  {id}
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {indexValue}
              </div>
            </div>
          )}
        />
      </div>
    ), [stackedReportsData, chartKeys, chartMargin, axisBottomConfigModal, axisLeftConfig, legendsConfig, hazardColors, nivoTheme]
  );

  // Users per Barangay Bar Chart - memoized to prevent unnecessary re-renders
  const UsersPerBarangayChart = useMemo(() => 
    ({ height = '100%', chartId = 'users-chart' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '160px' }}>
        <ResponsiveBar
          data={usersPerBarangay
            .map(item => ({
              barangay: item.name,
              users: item.users
            }))
            .sort((a, b) => b.users - a.users)}
          keys={['users']}
          indexBy="barangay"
          margin={{ top: 20, right: 40, bottom: 40, left: 50 }}
          padding={0.2}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={['#ff703d']}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 0,
            tickPadding: 0,
            tickRotation: 0,
            legend: '',
            legendPosition: 'middle',
            legendOffset: 0,
            format: () => '' // Hide all tick labels
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Number of Users',
            legendPosition: 'middle',
            legendOffset: -40
          }}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          animate={true}
          tooltip={({ id, value, indexValue, color }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {value}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  users
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {indexValue}
              </div>
            </div>
          )}
        />
      </div>
    ), [usersPerBarangay, nivoTheme]
  );

  // Modal version of Users per Barangay Bar Chart with labels
  const UsersPerBarangayChartModal = useMemo(() => 
    ({ height = '100%', chartId = 'users-chart-modal' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '400px' }}>
        <ResponsiveBar
          data={usersPerBarangay
            .map(item => ({
              barangay: item.name,
              users: item.users
            }))
            .sort((a, b) => b.users - a.users)}
          keys={['users']}
          indexBy="barangay"
          margin={{ top: 50, right: 130, bottom: 80, left: 60 }}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={['#ff703d']}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Barangay',
            legendPosition: 'middle',
            legendOffset: 60
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Number of Users',
            legendPosition: 'middle',
            legendOffset: -50
          }}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          animate={true}
          tooltip={({ id, value, indexValue, color }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {value}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  users
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {indexValue}
              </div>
            </div>
          )}
        />
      </div>
    ), [usersPerBarangay, nivoTheme]
  );

  // Peak Reporting Hours Line Chart - memoized to prevent unnecessary re-renders
  const PeakHoursChart = useMemo(() => 
    ({ height = '100%', chartId = 'peak-hours-chart' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '160px' }}>
        <ResponsiveLine
          data={[{
            id: 'reports',
            data: peakHoursData.map(item => ({
              x: item.hour,
              y: item.reports
            }))
          }]}
          margin={{ top: 20, right: 40, bottom: 60, left: 50 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Hour',
            legendPosition: 'middle',
            legendOffset: 50
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Number of Reports',
            legendPosition: 'middle',
            legendOffset: -40
          }}
          pointSize={8}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          pointLabelYOffset={-12}
          enableGridX={true}
          enableGridY={true}
          useMesh={true}
          colors={['#fcad3e']}
          lineWidth={2}
          tooltip={({ point }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#fcad3e',
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {point.data.y}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  reports
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {point.data.x}
              </div>
            </div>
          )}
        />
      </div>
    ), [peakHoursData, nivoTheme]
  );

  // Modal version of Peak Reporting Hours Line Chart
  const PeakHoursChartModal = useMemo(() => 
    ({ height = '100%', chartId = 'peak-hours-chart-modal' }: { height?: string; chartId?: string }) => (
      <div id={chartId} style={{ height, minHeight: '400px' }}>
        <ResponsiveLine
          data={[{
            id: 'reports',
            data: peakHoursData.map(item => ({
              x: item.hour,
              y: item.reports
            }))
          }]}
          margin={{ top: 50, right: 130, bottom: 100, left: 60 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          theme={nivoTheme}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Hour',
            legendPosition: 'middle',
            legendOffset: 80
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Number of Reports',
            legendPosition: 'middle',
            legendOffset: -50
          }}
          pointSize={10}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          pointLabelYOffset={-12}
          enableGridX={true}
          enableGridY={true}
          useMesh={true}
          colors={['#fcad3e']}
          lineWidth={3}
          tooltip={({ point }) => (
            <div style={{
              background: 'white',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontFamily: 'DM Sans, sans-serif',
              minWidth: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#fcad3e',
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1
                }}>
                  {point.data.y}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1
                }}>
                  reports
                </span>
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 400,
                paddingLeft: '16px'
              }}>
                {point.data.x}
              </div>
            </div>
          )}
        />
      </div>
    ), [peakHoursData, nivoTheme]
  );

  return (
    <div className="space-y-6">
      {/* Lucban LDRRMO Profile Card - Full Width */}
      <Card className="bg-orange-50 border border-brand-orange relative overflow-hidden">
        {/* Decorative Pattern Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Rippling concentric circles pattern */}
          <div className="absolute top-1/2 right-20 -translate-y-1/2">
            {/* Outermost ripple */}
            <div className="absolute -top-12 -left-12 w-[30rem] h-[30rem] rounded-full border-2 border-brand-orange opacity-[0.04] animate-pulse" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}></div>
            {/* Large outer ripple */}
            <div className="absolute w-96 h-96 rounded-full border-2 border-brand-orange opacity-[0.06] animate-pulse" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.4s'
            }}></div>
            {/* Medium-large ripple */}
            <div className="absolute top-8 left-8 w-80 h-80 rounded-full border-2 border-brand-orange opacity-[0.07]" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.8s'
            }}></div>
            {/* Medium ripple */}
            <div className="absolute top-16 left-16 w-64 h-64 rounded-full border-2 border-brand-orange opacity-[0.08]" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 1.2s'
            }}></div>
            {/* Medium-small ripple */}
            <div className="absolute top-24 left-24 w-48 h-48 rounded-full border-2 border-brand-orange opacity-[0.09]" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 1.6s'
            }}></div>
            {/* Small ripple */}
            <div className="absolute top-32 left-32 w-32 h-32 rounded-full border-2 border-brand-orange opacity-[0.1]" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 2s'
            }}></div>
            {/* Inner ripple */}
            <div className="absolute top-40 left-40 w-16 h-16 rounded-full border-2 border-brand-orange opacity-[0.12]" style={{
              animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 2.4s'
            }}></div>
            {/* Core circle */}
            <div className="absolute top-44 left-44 w-8 h-8 rounded-full bg-brand-orange opacity-[0.08]"></div>
          </div>
          
          {/* Repeating dots pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, #f97316 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}></div>
        </div>
        
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img 
                src="/accizard-uploads/logo-ldrrmo-png.png" 
                alt="Lucban LDRRMO" 
                className="h-24 w-auto object-contain"
              />
            </div>
            
            {/* Organization Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                Lucban Disaster Risk Reduction and Management Office
              </h2>

              
              {/* Contact Information */}
              <div className="flex items-center gap-4">
                <a 
                  href="https://www.facebook.com/LucbanDRRMO" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm bg-brand-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                  <span>Lucban DRRM Office</span>
                </a>
                <div className="flex items-center gap-2 text-sm bg-brand-orange text-white px-4 py-2 rounded-lg">
                  <PhoneCall className="h-4 w-4" />
                  <span>540-1709 or 0917 520 4211</span>
                </div>
              </div>
              
              {/* Online Admins Indicator */}
              <div className="flex items-center gap-2 mt-4">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">
                  {onlineAdminsCount} Admin{onlineAdminsCount !== 1 ? 's' : ''} Online
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weather Forecast, Date, and Time - 4 columns (3:1 ratio) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Weather Forecast Card - 3 columns */}
        <Card className="md:col-span-3 h-full overflow-hidden relative bg-white border">
          {/* Weather Icon - Top Right Corner */}
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-orange-50 border border-brand-orange rounded-full flex items-center justify-center z-10">
            <CloudRain className="h-6 w-6 text-brand-orange" />
          </div>
          
          <div className="relative">
            {/* Content overlay */}
            <div className="relative z-10">
              <CardHeader className="pb-2">
                <CardTitle>Weather Forecast</CardTitle>
              </CardHeader>
              <CardContent className="h-full flex flex-col">
            <div className="space-y-4 flex-1">
              {/* Current Weather - Reference Layout */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-gray-700 pt-2  ">Current Weather</div>
                
                {/* Temperature and Weather Details */}
                <div className="flex items-start justify-between">
                  {/* Temperature Section */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                       {/* Temperature */}
                       <div className="text-4xl font-bold text-black">
                         {weatherData.loading ? "..." : 
                          temperatureUnit === 'celsius' ? 
                            `${weatherData.temperatureCelsius}°` : 
                            `${weatherData.temperatureFahrenheit}°`}
                       </div>
                      
                      {/* Temperature Unit Toggle - Moved next to temperature */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setTemperatureUnit('celsius')}
                          className={`text-xs px-2 py-1 rounded ${
                            temperatureUnit === 'celsius' 
                              ? 'bg-brand-orange text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          °C
                        </button>
                        <button
                          onClick={() => setTemperatureUnit('fahrenheit')}
                          className={`text-xs px-2 py-1 rounded ${
                            temperatureUnit === 'fahrenheit' 
                              ? 'bg-brand-orange text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          °F
                        </button>
                      </div>
                      
                      {/* Weather Icon */}
                      <div className="w-12 h-12 flex items-center justify-center">
                        {weatherData.loading ? (
                          <div className="w-8 h-8 border-2 border-gray-300 border-t-brand-orange rounded-full animate-spin"></div>
                        ) : weatherData.error ? (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 text-lg">⚠</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            {getWeatherIcon(weatherData.condition, "w-8 h-8")}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Weather Condition */}
                    <div className="text-sm font-medium text-gray-900 mt-2">
                      {weatherData.loading ? "Loading..." : weatherData.error ? "Error" : weatherData.condition}
                    </div>
                  </div>

                  {/* Weather Details Section */}
                  <div className="flex-1 space-y-2">
                    {/* Wind */}
                    <div className="flex items-center gap-2">
                      <Wind className="h-3 w-3 text-gray-600" />
                      <div className="text-xs font-medium text-gray-600">Wind</div>
                      <div className="text-xs font-semibold text-gray-900">
                        {weatherData.loading ? "..." : weatherData.windSpeed}
                      </div>
                    </div>
                    
                    {/* Humidity */}
                    <div className="flex items-center gap-2">
                      <Droplets className="h-3 w-3 text-gray-600" />
                      <div className="text-xs font-medium text-gray-600">Humidity</div>
                      <div className="text-xs font-semibold text-gray-900">
                        {weatherData.loading ? "..." : weatherData.humidity}
                      </div>
                    </div>
                    
                    {/* Precipitation */}
                    <div className="flex items-center gap-2">
                      <Precipitation className="h-3 w-3 text-gray-600" />
                      <div className="text-xs font-medium text-gray-600">Precip</div>
                      <div className="text-xs font-semibold text-gray-900">
                        {weatherData.loading ? "..." : weatherData.precipitation}
                      </div>
                    </div>
                  </div>

                  {/* Location Information - Right aligned */}
                  <div className="flex-1 space-y-1 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <MapPin className="h-3 w-3 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">Lucban, Quezon</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-600">Philippines</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5-Day Outlook */}
              <div className="border-t border-gray-200 pt-3">
                <div className="text-sm font-semibold mb-2">5-Day Outlook</div>
                <div className="grid grid-cols-5 gap-2">
                  {weatherData.loading || weatherOutlook.length === 0 ? (
                    // Loading state with orange spinner
                    Array.from({ length: 5 }, (_, index) => (
                      <div key={index} className="text-center p-2 rounded-lg flex flex-col items-center justify-center min-h-[120px]">
                        <div className="w-8 h-8 border-2 border-brand-orange/20 border-t-brand-orange rounded-full animate-spin"></div>
                      </div>
                    ))
                  ) : (
                    weatherOutlook.map((day, index) => (
                        <div 
                          key={index} 
                          className={`text-center p-2 rounded-lg ${
                            day.day === 'Today' 
                              ? 'bg-orange-50 border border-brand-orange' 
                              : ''
                          }`}
                        >
                          <div className={`text-xs font-semibold mb-1 ${day.day === 'Today' ? 'text-brand-orange' : ''}`}>{day.day}</div>
                          <div className={`flex justify-center mb-1 ${day.day === 'Today' ? '[&_svg]:text-brand-orange [&_svg]:stroke-brand-orange' : ''}`}>
                            {getWeatherIcon(day.icon, "w-10 h-10")}
                          </div>
                          <div className={`text-sm font-bold ${day.day === 'Today' ? 'text-brand-orange' : ''}`}>
                            <div className="leading-tight">
                              <div>{day.tempCelsius}°C</div>
                              <div className={`text-xs font-medium ${day.day === 'Today' ? 'text-brand-orange' : ''}`}>{day.tempFahrenheit}°F</div>
                            </div>
                          </div>
                          <div className={`text-xs truncate ${day.day === 'Today' ? 'text-brand-orange' : ''}`}>{day.condition}</div>
                        </div>
                    ))
                  )}
                </div>
              </div>
            </div>
              </CardContent>
            </div>
          </div>
        </Card>

        {/* Date and Time Cards - Stacked vertically in 1 column */}
        <div className="flex flex-col gap-6 h-full">
          {/* Time Card - 1 part (top) */}
          <Card className="relative overflow-hidden bg-white border flex-[1]">
            {/* Clock Icon - Top Right Corner */}
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-orange-50 border border-brand-orange rounded-full flex items-center justify-center z-10">
              <Clock className="h-6 w-6 text-brand-orange stroke-brand-orange" />
            </div>
            
            <CardContent className="flex flex-col items-center justify-center h-full p-6">
              {/* Time Display */}
              <div className="text-center">
                <div className="text-3xl font-semibold tracking-tight">
                  {currentTime.toLocaleTimeString('en-PH', {
                    timeZone: 'Asia/Manila',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </div>
              </div>

              {/* Timezone */}
              <div className="text-center mt-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Asia/Manila (GMT+8)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Card - 3 parts (bottom) */}
          <Card className="relative overflow-hidden bg-white border flex-[3]">
            <CardContent className="flex flex-col items-center justify-center h-full p-4">
              <style>{`
                .react-calendar {
                  width: 100%;
                  border: none;
                  font-family: 'DM Sans', sans-serif;
                  background: transparent;
                }
                .react-calendar__navigation {
                  display: flex;
                  margin-bottom: 0.25rem;
                  padding: 0.25rem 0.5rem;
                  border-radius: 6px;
                }
                .react-calendar__navigation button {
                  min-width: 32px;
                  background: none;
                  font-size: 14px;
                  font-weight: 600;
                  color: #111827;
                }
                .react-calendar__navigation button:enabled:hover,
                .react-calendar__navigation button:enabled:focus {
                  background-color: #fff7ed;
                  border-radius: 4px;
                  color: #f97316;
                }
                .react-calendar__navigation__label {
                  color: #111827;
                  font-weight: 700;
                  pointer-events: none;
                  cursor: default;
                }
                /* Hide double arrow buttons */
                .react-calendar__navigation__prev2-button,
                .react-calendar__navigation__next2-button {
                  display: none;
                }
                .react-calendar__month-view__weekdays {
                  text-align: center;
                  font-size: 11px;
                  font-weight: 600;
                  color: #6b7280;
                  text-transform: uppercase;
                }
                .react-calendar__month-view__weekdays__weekday {
                  padding: 0.25rem 0;
                }
                .react-calendar__month-view__weekdays__weekday abbr {
                  text-decoration: none;
                }
                .react-calendar__tile {
                  padding: 0.375rem;
                  font-size: 12px;
                  font-weight: 500;
                  background: none;
                  border-radius: 6px;
                  transition: all 0.2s;
                  color: #111827;
                }
                .react-calendar__tile:hover {
                  background-color: #fff7ed;
                  color: #f97316;
                }
                /* Disable only day tiles, not month/year tiles */
                .react-calendar__month-view__days__day {
                  cursor: default;
                  pointer-events: none;
                }
                /* Enable clicking on month and year tiles */
                .react-calendar__year-view__months__month,
                .react-calendar__decade-view__years__year,
                .react-calendar__century-view__decades__decade {
                  cursor: pointer;
                  pointer-events: auto;
                  padding: 0.375rem;
                }
                .react-calendar__year-view__months__month:hover,
                .react-calendar__decade-view__years__year:hover,
                .react-calendar__century-view__decades__decade:hover {
                  background-color: #fff7ed;
                  color: #f97316;
                }
                .react-calendar__tile--now {
                  background: #f97316;
                  color: white;
                  font-weight: 700;
                }
                .react-calendar__tile--active {
                  background: #f97316;
                  color: white;
                  font-weight: 700;
                }
                .react-calendar__month-view__days__day--neighboringMonth {
                  color: #d1d5db;
                }
              `}</style>
              <ReactCalendar
                value={currentTime}
                locale="en-PH"
                selectRange={false}
                showNavigation={true}
                showNeighboringMonth={true}
                allowPartialRange={false}
                onClickDay={() => {}} // Disable day selection
                tileDisabled={() => false} // Keep all tiles enabled for visual purposes
              />
            </CardContent>
          </Card>
        </div>

      </div>

      {/* PAGASA Bulletins Section - HIDDEN FOR NOW */}
      {/* Uncomment below to re-enable PAGASA bulletins */}
      {/*
      <Card className="relative overflow-hidden bg-white border">
        <div className="absolute -top-2 -right-2 w-12 h-12 bg-orange-50 border border-brand-orange rounded-full flex items-center justify-center z-10">
          <AlertCircle className="h-6 w-6 text-brand-orange stroke-brand-orange" />
        </div>
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>PAGASA Weather Bulletins</CardTitle>
            <Button
              onClick={fetchPagasaBulletins}
              disabled={isFetchingBulletins}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isFetchingBulletins ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pagasaBulletins.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">No bulletins available</p>
              <p className="text-xs text-gray-400">Click Refresh to fetch latest bulletins from PAGASA</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagasaBulletins.map((bulletin) => (
                <div
                  key={bulletin.id}
                  className={`p-3 rounded-lg border ${
                    bulletin.priority === 'high'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          bulletin.priority === 'high'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {bulletin.type === 'tropical_cyclone' ? 'Tropical Cyclone' : 'Weather Forecast'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {bulletin.parsedAt.toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {bulletin.title}
                      </h4>
                      {bulletin.content && (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {bulletin.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      */}

      {/* Calendar Heatmap and Map Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Calendar Heatmap - Report Activity */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{currentYear} Report Activity</CardTitle>
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportCalendarAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCalendarAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCalendarAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Expand Button */}
              <Button size="sm" variant="outline" onClick={() => setIsCalendarModalOpen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 py-2">
            <div className="space-y-2">
              {/* Nivo Calendar Chart */}
              <div id="calendar-chart" style={{ height: '120px', minHeight: '100px' }}>
                <ResponsiveCalendar
                  data={calendarData}
                  from={`${currentYear}-01-01`}
                  to={`${currentYear}-12-31`}
                  emptyColor="#f3f4f6"
                  colors={['#D9D0C4', '#FFCD90', '#FFB76B', '#FFA652', '#FF8D21', '#FF7B00']}
                  minValue={0}
                  maxValue={5}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  yearSpacing={20}
                  monthBorderColor="#ffffff"
                  dayBorderWidth={1}
                  dayBorderColor="#ffffff"
                  legends={[
                    {
                      anchor: 'bottom-right',
                      direction: 'row',
                      translateY: 20,
                      itemCount: 4,
                      itemWidth: 35,
                      itemHeight: 30,
                      itemsSpacing: 10,
                      itemDirection: 'right-to-left'
                    }
                  ]}
                  theme={nivoTheme}
                  tooltip={({ day, value }) => {
                    // Find the original data point to get originalValue
                    const dayStr = typeof day === 'string' ? day : new Date(day).toISOString().split('T')[0];
                    const dataPoint = calendarData.find(d => d.day === dayStr);
                    const reportCount = dataPoint?.originalValue ?? value;
                    
                    return (
                    <div style={{
                      background: 'white',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '12px'
                    }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>
                        {new Date(day).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div style={{ color: '#f97316', fontWeight: 500 }}>
                          {reportCount} reports
                      </div>
                    </div>
                    );
                  }}
                />
              </div>

              {/* Color Spectrum Legend */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs text-gray-600 font-medium">Less</span>
                <div className="flex gap-0.5">
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#D9D0C4' }}></div>
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#FFCD90' }}></div>
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#FFB76B' }}></div>
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#FFA652' }}></div>
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#FF8D21' }}></div>
                  <div className="w-5 h-3 rounded" style={{ backgroundColor: '#FF7B00' }}></div>
                </div>
                <span className="text-xs text-gray-600 font-medium">More</span>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 gap-3 pt-2 border-t">
                <div className="text-center">
                  <div className="text-xl font-bold text-brand-orange">
                    {(() => {
                      const peakDay = calendarData.reduce((max, day) => {
                        const dayCount = day.originalValue ?? 0;
                        const maxCount = max.originalValue ?? 0;
                        return dayCount > maxCount ? day : max;
                      }, calendarData[0] || { day: '', originalValue: 0 });
                      
                      if (!peakDay || (peakDay.originalValue ?? 0) === 0) {
                        return 'N/A';
                      }
                      
                      const peakDate = new Date(peakDay.day);
                      return peakDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                  </div>
                  <div className="text-xs text-gray-600">Peak Day</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Snippet */}
        <Card className="relative overflow-hidden">
          <div 
            ref={mapContainer}
            className="w-full rounded-lg overflow-hidden"
            style={{ height: '100%' }}
          >
            {/* Map will be rendered here */}
          </div>
          {/* Map Layer Toggle Button */}
          <Button 
            size="sm" 
            variant="secondary"
            className="absolute top-2 right-2 bg-brand-orange/90 hover:bg-brand-orange text-white border border-brand-orange shadow-sm"
            onClick={() => {
              // Cycle through: normal -> barangayBoundaries -> roadNetwork -> waterways -> traffic -> satellite -> normal
              setMapLayerMode(prev => {
                if (prev === 'normal') return 'barangayBoundaries';
                if (prev === 'barangayBoundaries') return 'roadNetwork';
                if (prev === 'roadNetwork') return 'waterways';
                if (prev === 'waterways') return 'traffic';
                if (prev === 'traffic') return 'satellite';
                return 'normal';
              });
            }}
          >
            {mapLayerMode === 'normal' && (
              <>
                <Layers className="h-3 w-3 mr-1" />
                Normal
              </>
            )}
            {mapLayerMode === 'barangayBoundaries' && (
              <>
                <Building2 className="h-3 w-3 mr-1" />
                Barangay Boundaries
              </>
            )}
            {mapLayerMode === 'roadNetwork' && (
              <>
                <Navigation className="h-3 w-3 mr-1" />
                Road Network
              </>
            )}
            {mapLayerMode === 'waterways' && (
              <>
                <Waves className="h-3 w-3 mr-1" />
                Waterways
              </>
            )}
            {mapLayerMode === 'traffic' && (
              <>
                <Car className="h-3 w-3 mr-1" />
                Traffic
              </>
            )}
            {mapLayerMode === 'satellite' && (
              <>
                <Satellite className="h-3 w-3 mr-1" />
                Satellite
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Statistical Summary Cards with Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-orange-50 border border-brand-orange rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-brand-orange" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Total Reports</p>
                  <p className="text-xs text-brand-orange font-medium">All time</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-orange-50 border border-brand-orange rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-brand-orange" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Most Common Type</p>
                  <p className="text-xs text-brand-orange font-medium">{mostCommonType.type} - {mostCommonType.percentage}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{mostCommonType.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-orange-50 border border-brand-orange rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-brand-orange" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Active Users</p>
                  <p className="text-xs text-brand-orange font-medium">Registered</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{activeUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-orange-50 border border-brand-orange rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-brand-orange" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Avg Response Time</p>
                  <p className="text-xs text-brand-orange font-medium">
                    {avgResponseTime ? `Based on ${avgResponseTime.count} reports` : 'No data'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {avgResponseTime ? avgResponseTime.formatted : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Export Section */}
      <Card className="shadow-sm bg-gradient-to-r from-orange-50 to-red-50 border-brand-orange">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-brand-orange" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Export Dashboard Report</h3>
                <p className="text-sm text-gray-600">Generate a printable summary of all dashboard charts and statistics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowChartFilters(!showChartFilters)}
                className="bg-orange-50 border border-brand-orange hover:bg-brand-orange hover:text-white text-brand-orange"
                size="lg"
              >
                {showChartFilters ? (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Hide Filters
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter Charts
                  </>
                )}
              </Button>
              <Button 
                onClick={exportDashboardAsHTML}
                className="bg-brand-orange hover:bg-orange-600 text-white"
                size="lg"
              >
                <Download className="h-5 w-5 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Chart Selection Filters - Rectangular Token Style (Shown when toggled) */}
          {showChartFilters && (
            <div className="space-y-2 pt-2 border-t border-brand-orange/30">
              <label className="text-sm font-semibold text-gray-700">Select Charts to Include:</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(selectedChartsForExport).map((chartName) => (
                  <button
                    key={chartName}
                    onClick={() => setSelectedChartsForExport(prev => ({
                      ...prev,
                      [chartName]: !prev[chartName]
                    }))}
                    className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-2 ${
                      selectedChartsForExport[chartName]
                        ? 'bg-brand-orange text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{
                      borderRadius: '4px', // Rectangular with small border radius
                    }}
                  >
                    {selectedChartsForExport[chartName] && (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>{chartName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Over Time and Report Type Distribution - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports Over Time Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Reports Over Time</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={reportsOverTimeFilter} onValueChange={setReportsOverTimeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={reportsOverTimeTypeFilter} onValueChange={setReportsOverTimeTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allReportTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Expand Button */}
              <Button size="sm" variant="outline" onClick={() => setIsReportsOverTimeModalOpen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
              <ReportsOverTimeChart 
                height="100%" 
                chartId="reports-over-time-chart" 
              />
            </div>
            
            {/* Top 3 Most Active Dates Summary */}
            {top3MostActiveDates.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Active Dates</div>
                <div className="flex flex-col gap-2">
                  {top3MostActiveDates.map((item, index) => (
                    <div key={item.date} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.formattedDate}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.count} reports</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Custom Legend - Hidden */}
            {/* <div className="pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {Object.keys(enabledReportTypes).map((key) => (
                  <div 
                    key={key} 
                    className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                      enabledReportTypes[key] ? 'opacity-100' : 'opacity-40'
                    }`}
                    onClick={() => toggleReportType(key)}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: hazardColors[key as keyof typeof hazardColors] }}
                    />
                    <span className="text-xs font-medium text-gray-700">{key}</span>
                  </div>
                ))}
              </div>
            </div> */}
          </CardContent>
        </Card>

        {/* Pie Chart - Report Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Report Type Distribution</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPieChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPieChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPieChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Expand Button */}
              <Button size="sm" variant="outline" onClick={() => setIsPieChartModalOpen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="space-y-4">
            <div id="pie-chart" style={{ height: '256px', minHeight: '256px', position: 'relative' }}>
              <ChartContainer config={{
                reports: {
                  label: "Reports",
                  color: "#ff703d"
                }
              }}>
                <PieChart>
                  <Pie 
                    data={reportTypeData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={55} 
                    outerRadius={105} 
                    paddingAngle={5} 
                    dataKey="count"
                  >
                    {reportTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              {/* Number Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{totalReportsForDonut.toLocaleString()}</div>
                  <div className="text-sm font-medium text-gray-600">Total Reports</div>
                </div>
              </div>
            </div>
            {/* Custom Legend with Filter - Show all 15 report types - Hidden */}
            {/* <div className="pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {allReportTypes.map((typeName) => {
                  const reportTypeItem = reportTypeData.find(item => item.name === typeName);
                  const percentage = reportTypeItem ? reportTypeItem.value : 0;
                  const color = reportTypeItem ? reportTypeItem.color : (hazardColors[typeName as keyof typeof hazardColors] || '#6B7280');
                  const isEnabled = enabledReportTypes[typeName] !== false;
                  return (
                    <div 
                      key={typeName} 
                      className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                        isEnabled ? 'opacity-100' : 'opacity-40'
                      }`}
                      onClick={() => toggleReportType(typeName)}
                    >
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{
                          backgroundColor: color
                        }}
                      />
                      <span className="text-xs font-medium text-gray-700">
                        {typeName} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div> */}
            
            {/* Top 3 Most Common Report Types Summary */}
            {top3ReportTypes.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Common Types</div>
                <div className="flex flex-col gap-2">
                  {top3ReportTypes.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.count} reports ({item.value}%)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports per Barangay with Users per Barangay and Peak Reporting Hours - 2:2 Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Reports per Barangay - 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reports per Barangay</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={barangayReportsFilter} onValueChange={setBarangayReportsFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayReportsTypeFilter} onValueChange={setBarangayReportsTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allReportTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Expand Button */}
              <Button size="sm" variant="outline" onClick={() => setIsChartModalOpen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="pt-2">
            <div className="h-80">
              <BarangayReportsChart />
            </div>
            {/* Custom Legend - Hidden */}
            {/* <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {Object.keys(enabledReportTypes).map((key) => (
                  <div 
                    key={key} 
                    className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                      enabledReportTypes[key] ? 'opacity-100' : 'opacity-40'
                    }`}
                    onClick={() => toggleReportType(key)}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: hazardColors[key as keyof typeof hazardColors] }}
                    />
                    <span className="text-xs font-medium text-gray-700">{key}</span>
                  </div>
                ))}
              </div>
            </div> */}
            
            {/* Top 3 Most Active Barangays Summary */}
            {top3Barangays.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Active Barangays</div>
                <div className="flex flex-col gap-2">
                  {top3Barangays.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.reports} reports</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users per Barangay and Peak Reporting Hours - Stacked Vertically - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Users per Barangay Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Users per Barangay</CardTitle>
            </CardHeader>
            <div className="px-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Select value={usersBarangayFilter} onValueChange={setUsersBarangayFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="this-year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={usersBarangayBarangayFilter} onValueChange={setUsersBarangayBarangayFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Barangay" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Barangays</SelectItem>
                    {officialBarangays.map((barangay) => (
                      <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                    ))}
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>

                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportUsersChartAsPNG}>
                      <FileImage className="h-4 w-4 mr-2" />
                      Export as PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportUsersChartAsSVG}>
                      <FileType className="h-4 w-4 mr-2" />
                      Export as SVG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportUsersChartAsPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Expand Button */}
                <Button size="sm" variant="outline" onClick={() => setIsUsersChartModalOpen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent>
              <div className="h-40">
                <UsersPerBarangayChart height="100%" chartId="users-chart" />
              </div>
            </CardContent>
          </Card>

          {/* Peak Reporting Hours - Now as Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Reporting Hours</CardTitle>
            </CardHeader>
            <div className="px-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Select value={peakHoursFilter} onValueChange={setPeakHoursFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="this-year">This Year</SelectItem>
                  </SelectContent>
                </Select>

                {/* Export Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportPeakHoursChartAsPNG}>
                      <FileImage className="h-4 w-4 mr-2" />
                      Export as PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPeakHoursChartAsSVG}>
                      <FileType className="h-4 w-4 mr-2" />
                      Export as SVG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPeakHoursChartAsPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Expand Button */}
                <Button size="sm" variant="outline" onClick={() => setIsPeakHoursModalOpen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent>
              <div className="h-40">
                <PeakHoursChart height="100%" chartId="peak-hours-chart" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expanded Chart Modal */}
      <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reports per Barangay - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={barangayReportsFilter} onValueChange={setBarangayReportsFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayReportsTypeFilter} onValueChange={setBarangayReportsTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allReportTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-4">
            <div className="h-[calc(90vh-200px)]">
              <BarangayReportsChartModal height="calc(90vh - 200px)" chartId="nivo-chart-modal" />
            </div>
            {/* Custom Legend for Modal - Hidden */}
            {/* <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {Object.keys(enabledReportTypes).map((key) => (
                  <div 
                    key={key} 
                    className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                      enabledReportTypes[key] ? 'opacity-100' : 'opacity-40'
                    }`}
                    onClick={() => toggleReportType(key)}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: hazardColors[key as keyof typeof hazardColors] }}
                    />
                    <span className="text-xs font-medium text-gray-700">{key}</span>
                  </div>
                ))}
              </div>
            </div> */}
            
            {/* Top 3 Most Active Barangays Summary */}
            {top3Barangays.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Active Barangays</div>
                <div className="flex flex-col gap-2">
                  {top3Barangays.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.reports} reports</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Users Chart Modal */}
      <Dialog open={isUsersChartModalOpen} onOpenChange={setIsUsersChartModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Users per Barangay - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={usersBarangayFilter} onValueChange={setUsersBarangayFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={usersBarangayBarangayFilter} onValueChange={setUsersBarangayBarangayFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {officialBarangays.map((barangay) => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportUsersChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportUsersChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportUsersChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-4">
            <UsersPerBarangayChartModal height="calc(90vh - 140px)" chartId="users-chart-modal" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Pie Chart Modal */}
      <Dialog open={isPieChartModalOpen} onOpenChange={setIsPieChartModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Type Distribution - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPieChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPieChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPieChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-4 space-y-4">
            <div id="pie-chart-modal" style={{ height: 'calc(90vh - 340px)', minHeight: '500px', position: 'relative' }}>
            <ChartContainer config={{
              reports: {
                label: "Reports",
                color: "#D32F2F"
              }
            }}>
              <PieChart>
                <Pie 
                  data={reportTypeData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={110} 
                  outerRadius={220} 
                  paddingAngle={5} 
                  dataKey="count"
                >
                  {reportTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            {/* Number Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">{totalReportsForDonut.toLocaleString()}</div>
                <div className="text-lg font-medium text-gray-600">Total Reports</div>
              </div>
            </div>
            </div>
            {/* Custom Legend with Filter for Modal - Show all 15 report types - Hidden */}
            {/* <div className="pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {allReportTypes.map((typeName) => {
                  const reportTypeItem = reportTypeData.find(item => item.name === typeName);
                  const percentage = reportTypeItem ? reportTypeItem.value : 0;
                  const color = reportTypeItem ? reportTypeItem.color : (hazardColors[typeName as keyof typeof hazardColors] || '#6B7280');
                  const isEnabled = enabledReportTypes[typeName] !== false;
                  return (
                    <div 
                      key={typeName} 
                      className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                        isEnabled ? 'opacity-100' : 'opacity-40'
                      }`}
                      onClick={() => toggleReportType(typeName)}
                    >
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{
                          backgroundColor: color
                        }}
                      />
                      <span className="text-xs font-medium text-gray-700">
                        {typeName} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div> */}
            
            {/* Top 3 Most Common Report Types Summary */}
            {top3ReportTypes.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Common Types</div>
                <div className="flex flex-col gap-2">
                  {top3ReportTypes.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.count} reports ({item.value}%)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Peak Hours Chart Modal */}
      <Dialog open={isPeakHoursModalOpen} onOpenChange={setIsPeakHoursModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Peak Reporting Hours - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={peakHoursFilter} onValueChange={setPeakHoursFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPeakHoursChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPeakHoursChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPeakHoursChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-4">
            <PeakHoursChartModal height="calc(90vh - 140px)" chartId="peak-hours-chart-modal" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Reports Over Time Chart Modal */}
      <Dialog open={isReportsOverTimeModalOpen} onOpenChange={setIsReportsOverTimeModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reports Over Time - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Select value={reportsOverTimeFilter} onValueChange={setReportsOverTimeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={reportsOverTimeTypeFilter} onValueChange={setReportsOverTimeTypeFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allReportTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsPNG}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsSVG}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportReportsOverTimeChartAsPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 min-h-0 mt-4 space-y-4">
            <div className="flex-1 min-h-0">
              <ReportsOverTimeChart 
                height="calc(90vh - 300px)" 
                chartId="reports-over-time-chart-modal"
                pointSize={8}
                bottomMargin={80}
              />
            </div>
            
            {/* Top 3 Most Active Dates Summary */}
            {top3MostActiveDates.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-2 text-center">Top 3 Most Active Dates</div>
                <div className="flex flex-col gap-2">
                  {top3MostActiveDates.map((item, index) => (
                    <div key={item.date} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-brand-orange">#{index + 1}</div>
                        <div className="text-sm font-medium text-gray-700">{item.formattedDate}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{item.count} reports</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Custom Legend for Modal - Hidden */}
            {/* <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-3 justify-center">
                {Object.keys(enabledReportTypes).map((key) => (
                  <div 
                    key={key} 
                    className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                      enabledReportTypes[key] ? 'opacity-100' : 'opacity-40'
                    }`}
                    onClick={() => toggleReportType(key)}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: hazardColors[key as keyof typeof hazardColors] }}
                    />
                    <span className="text-xs font-medium text-gray-700">{key}</span>
                  </div>
                ))}
              </div>
            </div> */}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Calendar Modal */}
      <Dialog open={isCalendarModalOpen} onOpenChange={setIsCalendarModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Activity Calendar - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            <div id="calendar-chart-modal" style={{ height: 'calc(90vh - 140px)', minHeight: '500px' }}>
              <ResponsiveCalendar
                data={calendarData}
                from={`${currentYear}-01-01`}
                to={`${currentYear}-12-31`}
                emptyColor="#f3f4f6"
                colors={['#D9D0C4', '#FFCD90', '#FFB76B', '#FFA652', '#FF8D21', '#FF7B00']}
                minValue={0}
                maxValue={5}
                margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                yearSpacing={40}
                monthBorderColor="#ffffff"
                dayBorderWidth={2}
                dayBorderColor="#ffffff"
                legends={[
                  {
                    anchor: 'bottom-right',
                    direction: 'row',
                    translateY: 30,
                    itemCount: 4,
                    itemWidth: 40,
                    itemHeight: 36,
                    itemsSpacing: 15,
                    itemDirection: 'right-to-left'
                  }
                ]}
                theme={nivoTheme}
                tooltip={({ day, value }) => {
                  // Find the original data point to get originalValue
                  const dayStr = typeof day === 'string' ? day : new Date(day).toISOString().split('T')[0];
                  const dataPoint = calendarData.find(d => d.day === dayStr);
                  const reportCount = dataPoint?.originalValue ?? value;
                  
                  return (
                  <div style={{
                    background: 'white',
                    padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {new Date(day).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div style={{ color: '#f97316', fontWeight: 500 }}>
                        {reportCount} reports
                    </div>
                  </div>
                  );
                }}
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 gap-4 pt-6 border-t border-gray-200 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-orange">
                  {(() => {
                    const peakDay = calendarData.reduce((max, day) => {
                      const dayCount = day.originalValue ?? 0;
                      const maxCount = max.originalValue ?? 0;
                      return dayCount > maxCount ? day : max;
                    }, calendarData[0] || { day: '', originalValue: 0 });
                    
                    if (!peakDay || (peakDay.originalValue ?? 0) === 0) {
                      return 'N/A';
                    }
                    
                    const peakDate = new Date(peakDay.day);
                    return peakDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    });
                  })()}
                </div>
                <div className="text-sm text-gray-600 mt-1">Peak Day</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}