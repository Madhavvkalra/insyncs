"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// 📍 Drop your calculateDistance function here
// ...

export default function RunningTracker({ circle, me, circleId, todayKey, members }: any) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [locationError, setLocationError] = useState("");
  
  // 🕒 Track exactly when we joined the lobby
  const [lobbyEntryTime, setLobbyEntryTime] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const routePathRef = useRef<{ lat: number; lng: number }[]>([]);
  const latestStatsRef = useRef({ distance: 0, elapsed: 0 });

  const isSynced = circle?.syncTimings === true;
  const isNewDay = me?.todayDate !== todayKey;
  let currentState = me?.todayState || "none";

  if (isNewDay) {
    currentState = currentState === "working_out" ? "working_out" : "none";
  }

  // 🚨 REFINED LOBBY LOGIC: Who isn't here yet?
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

  // 📡 THE "FRESH SYNC" LISTENER
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby" && lobbyEntryTime) {
      if (
        circle?.currentSyncSession === todayKey && 
        circle?.syncStartTime && 
        circle.syncStartTime > lobbyEntryTime
      ) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey, lobbyEntryTime]);

  // 📍 Drop your GPS Engine and Broadcaster effects here
  // ...

  async function updateDocState(data: any) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "circles", circleId, "members", user.uid), data, { merge: true });
  }

  // 🎮 LOBBY FUNCTIONS
  async function enterLobby() {
    setLocationError("");
    setLobbyEntryTime(Date.now());
    updateDocState({ 
      todayState: "waiting_in_lobby", 
      todayDate: todayKey,
      todayDistance: 0,
      todayPace: 0
    });
  }

  async function startSquadWorkout() {
    if (!isSquadReady) return; 
    
    const startTime = Date.now();
    await setDoc(doc(db, "circles", circleId), { 
      currentSyncSession: todayKey, 
      syncStartTime: startTime 
    }, { merge: true });
    
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
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    updateDocState({ todayState: "completed", todayDate: todayKey });
  }

  // ✅ THIS FIXES YOUR ERROR: The component MUST explicitly return JSX elements here.
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-zinc-900 rounded-xl text-white">
      {/* State: NONE */}
      {currentState === "none" && (
        <button 
          onClick={isSynced ? enterLobby : () => startWorkout()} 
          className="px-6 py-3 bg-white text-black font-bold rounded-lg w-full"
        >
          {isSynced ? "Enter Lobby" : "Start Run"}
        </button>
      )}

      {/* State: LOBBY */}
      {currentState === "waiting_in_lobby" && (
        <div className="text-center w-full space-y-4">
          <p className="text-lg font-bold">Waiting in Lobby</p>
          {isSquadReady ? (
            <button onClick={startSquadWorkout} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg w-full">
              NUCLEAR LAUNCH (Start Squad Run)
            </button>
          ) : (
            <div className="text-sm text-zinc-400">
              Waiting for {unreadyMembers.length} member(s)...
            </div>
          )}
        </div>
      )}

      {/* State: WORKING OUT */}
      {currentState === "working_out" && (
        <div className="text-center w-full space-y-4">
          <p className="text-4xl font-mono text-green-400">{formatTime(elapsedSeconds)}</p>
          <p className="text-xl text-zinc-300">{distanceMeters} Meters</p>
          <button onClick={endWorkout} className="px-6 py-3 bg-zinc-700 text-white font-bold rounded-lg w-full">
            End Run
          </button>
        </div>
      )}

      {/* State: COMPLETED */}
      {currentState === "completed" && (
        <div className="text-center text-green-500 font-bold">
          Run Completed for Today.
        </div>
      )}

      {/* Error Output */}
      {locationError && <p className="text-red-500 text-sm mt-2">{locationError}</p>}
    </div>
  );
}
