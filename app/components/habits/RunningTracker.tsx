"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// Haversine formula to calculate meters between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export default function RunningTracker({ circle, me, circleId, todayKey, members }: any) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [locationError, setLocationError] = useState("");

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const routePathRef = useRef<{ lat: number; lng: number }[]>([]);
  const latestStatsRef = useRef({ distance: 0, elapsed: 0 }); 

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

  function formatTime(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // 📡 THE "MAGIC SYNC" LISTENER
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby") {
      if (circle?.currentSyncSession === todayKey && circle?.syncStartTime) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey]);

  // 🏃 THE GPS ENGINE (Now Actually Real-Time)
  useEffect(() => {
    let interval: any;

    if (currentState === "working_out" && me?.workoutStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - me.workoutStartTime) / 1000)), 1000);

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            
            // 🔧 FIX 1: Relaxed accuracy threshold so standard phones don't get rejected
            if (accuracy > 40) return; 

            const currentCoord = { lat: latitude, lng: longitude };

            if (lastPosRef.current) {
              const dist = calculateDistance(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
              
              // 🔧 FIX 2: Lowered the deadzone from 10m to 3m so the UI ticks up smoothly
              if (dist > 3) {
                setDistanceMeters((prev) => prev + dist);
                lastPosRef.current = currentCoord;
                routePathRef.current.push(currentCoord);
              }
            } else {
              lastPosRef.current = currentCoord;
              routePathRef.current.push(currentCoord);
            }
          },
          (err) => setLocationError("GPS signal lost. Try moving to a clearer area."),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 } // Faster timeout for quicker recovery
        );
      } else {
        setLocationError("GPS not supported on this device.");
      }
    }

    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [currentState, me?.workoutStartTime]);

  // Keep the vault updated with your freshest numbers without restarting the interval
  useEffect(() => {
    latestStatsRef.current = { distance: distanceMeters, elapsed: elapsedSeconds };
  }, [distanceMeters, elapsedSeconds]);

  // 📡 THE LIVE BROADCASTER (Sped up to 3 seconds)
  useEffect(() => {
    let syncInterval: any;
    
    if (currentState === "working_out") {
      syncInterval = setInterval(() => {
        const dist = latestStatsRef.current.distance;
        const elap = latestStatsRef.current.elapsed;
        
        const currentPace = dist > 0 ? (elap / 60) / (dist / 1000) : 0;
        
        updateDocState({ 
          todayDistance: dist,
          todayPace: currentPace
        });
      }, 3000); // 🔧 FIX 3: Broadcast to the squad every 3 seconds for tighter syncing
    }
    
    return () => clearInterval(syncInterval);
  }, [currentState]); 

  async function updateDocState(data: any) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "circles", circleId, "members", user.uid), data, { merge: true });
  }

  function getYesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // 🎮 LOBBY FUNCTIONS
  async function enterLobby() {
    setLocationError("");
    updateDocState({ 
      todayState: "waiting_in_lobby", 
      todayDate: todayKey,
      todayDistance: 0,
      todayPace: 0
    });
  }

  async function startSquadWorkout() {
    const startTime = Date.now();
    await setDoc(doc(db, "circles", circleId), { currentSyncSession: todayKey, syncStartTime: startTime }, { merge: true });
    startWorkout(startTime);
  }

  async function startWorkout(overrideStartTime?: number) {
    setLocationError("");
    const startTime = overrideStartTime || Date.now();
    updateDocState({ 
      todayState: "working_out", 
      workoutStartTime: startTime, 
      todayDate: todayKey,
      todayDistance: 0,
      todayPace: 0
    });
  }

  async function endWorkout() {
    if (!me?.workoutStartTime) return;
    const user = auth.currentUser;
    if (!user) return;

    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    
    let newStreak = me.lastCheckin === getYesterday() ? (me.streak || 0) + 1 : 1;
    let newCycleDay = (me.cycleDay || 0) + 1;
    let newCompletedCycles = me.completedCycles || 0;

    if (newCycleDay >= circle?.durationDays) {
      newCompletedCycles += 1;
      newCycleDay = 0;
    }

    await updateDocState({
      todayState: "completed",
      todayDuration: durationMinutes,
      todayDistance: distanceMeters,
      streak: newStreak,
      lastCheckin: todayKey,
      todayDate: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    await addDoc(collection(db, "circles", circleId, "members", user.uid, "history"), {
      date: todayKey,
      durationMinutes: durationMinutes,
      distanceKm: distanceKm,
      routePath: routePathRef.current, 
      habit: "Running",
      createdAt: serverTimestamp()
    });
  }

  // 🎨 YOUR ORIGINAL UI RENDER BLOCK
  const distanceKm = (distanceMeters / 1000).toFixed(2);
  const pace = distanceMeters > 0 ? ((elapsedSeconds / 60) / (distanceMeters / 1000)).toFixed(2) : "0.00";

  return (
    <div className="w-full space-y-4">
      {locationError && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-900 dark:text-red-400 rounded-2xl text-sm font-bold text-center">
          ⚠ {locationError}
        </div>
      )}

      <div className="pt-2">
        {currentState === "completed" ? (
          <div className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl py-6 bg-zinc-100 text-green-600 dark:bg-zinc-900 dark:text-green-400 border border-green-200 dark:border-green-900/50">
            <span className="text-lg font-bold">✓ Run Logged</span>
            <span className="text-sm font-medium opacity-80">{distanceKm} km in {me?.todayDuration || 0} min</span>
          </div>
        ) : currentState === "working_out" ? (
          <div className="space-y-3">
            <div className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl py-8 px-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
                {isSynced ? "Synced Run Active" : "Run Active"}
              </span>
              
              <span className="text-6xl font-mono font-bold tracking-tighter">{formatTime(elapsedSeconds)}</span>
              
              <div className="w-full h-[1px] bg-zinc-200 dark:bg-zinc-800 my-2"></div>

              {/* LOCAL STATS */}
              <div className="flex justify-around w-full px-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Distance</span>
                  <span className="text-3xl font-mono font-bold">{distanceKm}<span className="text-sm font-sans text-zinc-400 ml-1">km</span></span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Avg Pace</span>
                  <span className="text-3xl font-mono font-bold">{pace}<span className="text-sm font-sans text-zinc-400 ml-1">/km</span></span>
                </div>
              </div>

              {/* 📡 LIVE SQUAD RADAR */}
              {members.filter((m: any) => m.uid !== me?.uid && (m.todayState === 'working_out' || m.todayState === 'waiting_in_lobby')).length > 0 && (
                <div className="w-full mt-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 pl-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-[ping_2s_ease-out_infinite]"></span> Squad Live Status
                  </span>
                  {members
                    .filter((m: any) => m.uid !== me?.uid && (m.todayState === 'working_out' || m.todayState === 'waiting_in_lobby'))
                    .map((m: any) => {
                      const mDistKm = ((m.todayDistance || 0) / 1000).toFixed(2);
                      const mPace = (m.todayPace || 0).toFixed(2);
                      
                      return (
                      <div key={m.uid} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                         <div className="flex flex-col truncate pr-4">
                            <p className="text-sm font-bold truncate">{m.name || "Squad Member"}</p>
                            <p className="text-[10px] uppercase text-zinc-500 truncate">{m.todayState === 'working_out' ? "Running" : "In Lobby"}</p>
                         </div>
                         <div className="flex gap-4 text-sm font-mono shrink-0">
                            <span className="flex flex-col items-center"><span className="text-[8px] text-zinc-400 font-sans tracking-widest uppercase">Dist</span>{mDistKm}</span>
                            <span className="flex flex-col items-center"><span className="text-[8px] text-zinc-400 font-sans tracking-widest uppercase">Pace</span>{mPace}</span>
                         </div>
                      </div>
                    )})}
                </div>
              )}
            </div>
            
            <button
              onClick={endWorkout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Finish Run
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
                  {isSquadReady ? "Squad Ready" : "In Lobby"}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  {isSquadReady
                    ? "Laces tied. Ready to sync."
                    : `Waiting for ${unreadyMembers.length} member(s)...`}
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
              {isSquadReady ? "🚀 Begin Sync Run" : "🔒 Start Locked"}
            </button>
          </div>
        ) : (
          <button
            onClick={isSynced ? enterLobby : () => startWorkout()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-5 text-white text-xl font-bold shadow-md transition-all active:scale-95 hover:-translate-y-1 dark:bg-white dark:text-black"
          >
            {isSynced ? "Enter Waiting Lobby" : "▶ Start GPS Run"}
          </button>
        )}
      </div>
    </div>
  );
}
