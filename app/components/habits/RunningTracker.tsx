"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function RunningTracker({ circle, me, circleId, todayKey, members }: any) {
  const [locationError, setLocationError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);

  // 📡 Refs for tracking without causing infinite re-renders
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const wakeLockRef = useRef<any>(null);
  const routePathRef = useRef<{ lat: number; lng: number }[]>([]); // 👈 NEW: The Breadcrumb Bag

  const isSynced = circle?.syncTimings === true;

  // 🕒 THE MIDNIGHT REFEREE
  const isNewDay = me?.todayDate !== todayKey;
  let currentState = me?.todayState || "none";

  if (isNewDay) {
    if (currentState === "working_out") {
      currentState = "working_out";
    } else {
      currentState = "none";
    }
  }

  // 🚨 STRICT LOBBY LOGIC
  const unreadyMembers = (members || []).filter(
    (m: any) =>
      m.uid !== me?.uid &&
      m.todayState !== "waiting_in_lobby" &&
      m.todayState !== "working_out" &&
      m.todayState !== "completed"
  );
  const isSquadReady = members && members.length > 1 && unreadyMembers.length === 0;

  // 📐 THE HAVERSINE FORMULA
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const a =
      Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatTime(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // 📡 THE "MAGIC SYNC" LISTENER
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby") {
      if (circle?.currentSyncSession === todayKey && circle?.syncStartTime) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey]);

  // 🏃‍♂️ THE RUNNING ENGINE (Timer + GPS Watcher + Wake Lock + Route Recording)
  useEffect(() => {
    let interval: any;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.log("Wake Lock failed:", err);
      }
    };

    if (currentState === "working_out" && me?.workoutStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - me.workoutStartTime) / 1000)), 1000);
      requestWakeLock();

            if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            
            // 🛑 ANTI-CHEAT 1: Reject terrible signals.
            // If the phone's accuracy guess is worse than 15 meters, ignore it completely.
            if (accuracy > 15) return; 

            const currentCoord = { lat: latitude, lng: longitude };

            if (lastPosRef.current) {
              const dist = calculateDistance(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
              
              // 🛑 ANTI-CHEAT 2: The 10-Meter Deadzone.
              // You must physically move 10 meters away from your last footprint for it to count.
              if (dist > 10) {
                setDistanceMeters((prev) => prev + dist);
                lastPosRef.current = currentCoord;
                routePathRef.current.push(currentCoord);
              }
            } else {
              // First ping
              lastPosRef.current = currentCoord;
              routePathRef.current.push(currentCoord);
            }
          },
          (err) => setLocationError("GPS signal lost. Make sure location is allowed."),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    }

    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [currentState, me?.workoutStartTime]);

  async function updateDocState(data: any) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "circles", circleId, "members", user.uid), data, { merge: true });
  }

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // 🎮 LOBBY FUNCTIONS
  async function enterLobby() {
    updateDocState({ todayState: "waiting_in_lobby", todayDate: todayKey });
  }

  async function startSquadWorkout() {
    const startTime = Date.now();
    await setDoc(doc(db, "circles", circleId), { currentSyncSession: todayKey, syncStartTime: startTime }, { merge: true });
    startWorkout(startTime);
  }

  async function startWorkout(overrideStartTime?: number) {
    setLocationError("");
    setDistanceMeters(0);
    lastPosRef.current = null; 
    routePathRef.current = []; // 👈 NEW: Clear the breadcrumbs for a fresh run
    const startTime = overrideStartTime || Date.now();
    updateDocState({ todayState: "working_out", workoutStartTime: startTime, todayDate: todayKey });
  }

  async function endWorkout() {
    if (!me?.workoutStartTime) return;
    const user = auth.currentUser;
    if (!user) return;

    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    
    let newStreak = me.lastCheckin === getYesterday() ? (me.streak || 0) + 1 : 1;
    let newCycleDay = (me.cycleDay || 0) + 1;
    let newCompletedCycles = me.completedCycles || 0;

    if (newCycleDay >= circle?.durationDays) {
      newCompletedCycles += 1;
      newCycleDay = 0;
    }

    // 1. Update the Daily Leaderboard state
    await updateDocState({
      todayState: "completed",
      todayDuration: durationMinutes,
      todayDistance: distanceKm, 
      streak: newStreak,
      lastCheckin: todayKey,
      todayDate: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    // 2. 👈 NEW: THE HISTORY LEDGER
    // Save the permanent receipt of this run, including the entire map route
    await addDoc(collection(db, "circles", circleId, "members", user.uid, "history"), {
      date: todayKey,
      distanceKm: distanceKm,
      durationMinutes: durationMinutes,
      routePath: routePathRef.current, // Saves the array of GPS coordinates
      createdAt: serverTimestamp()
    });
  }

  return (
    <div className="w-full space-y-4">
      {locationError && (
        <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs font-medium text-center">
          {locationError}
        </div>
      )}

      <div className="pt-2">
        {currentState === "completed" ? (
          <div className="w-full flex flex-col items-center justify-center gap-1 rounded-2xl py-6 bg-zinc-100 text-green-600 dark:bg-zinc-900 dark:text-green-400 border border-green-200 dark:border-green-900/50">
            <span className="text-lg font-bold">✓ Run Completed</span>
            <span className="text-sm font-medium opacity-80">{me?.todayDistance || 0} km in {me?.todayDuration || 0} min</span>
          </div>
        ) : currentState === "working_out" ? (
          <div className="space-y-3">
            <div className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl py-8 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Live GPS</span>
              </div>
              
              <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                {isSynced ? "Synced Run Active" : "Run Active"}
              </span>
              
              <div className="flex items-end gap-2 mt-2">
                <span className="text-6xl font-mono font-bold tracking-tighter">{(distanceMeters / 1000).toFixed(2)}</span>
                <span className="text-xl font-bold text-zinc-400 pb-2">km</span>
              </div>
              
              <span className="text-2xl font-mono font-medium tracking-tight text-zinc-500 mt-2">{formatTime(elapsedSeconds)}</span>
            </div>
            
            <button
              onClick={endWorkout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              🏁 Finish Run
            </button>
          </div>
        ) : currentState === "waiting_in_lobby" ? (
          <div className="space-y-3">
            <div className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl py-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all">
              <div className="relative flex items-center justify-center w-12 h-12">
                <div className={`absolute inset-0 rounded-full border-4 ${isSquadReady ? "border-green-500/30" : "border-blue-500/30"} animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]`}></div>
                <div className={`relative z-10 w-4 h-4 ${isSquadReady ? "bg-green-500" : "bg-blue-500"} rounded-full transition-colors`}></div>
              </div>
              <div className="text-center px-4">
                <span className="text-sm font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 block mb-1">
                  {isSquadReady ? "Runners Ready" : "In Lobby"}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  {isSquadReady
                    ? "Everyone is at the starting line."
                    : `Waiting for ${unreadyMembers.length} member(s) to stretch...`}
                </span>
              </div>
            </div>
            <button
              onClick={startSquadWorkout}
              disabled={!isSquadReady}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-300 active:scale-95 ${
                isSquadReady
                  ? "bg-green-600 text-white shadow-lg hover:bg-green-700 hover:-translate-y-1"
                  : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              {isSquadReady ? "🚀 Fire Starting Gun" : "🔒 Start Locked"}
            </button>
          </div>
        ) : (
          <button
            onClick={isSynced ? enterLobby : () => startWorkout()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-5 text-white text-xl font-bold shadow-md transition-all active:scale-95 hover:-translate-y-1 dark:bg-white dark:text-black"
          >
            {isSynced ? "Enter Waiting Lobby" : "▶ Start Run"}
          </button>
        )}
      </div>
    </div>
  );
}
