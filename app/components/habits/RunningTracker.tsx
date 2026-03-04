"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// ... (calculateDistance remains the same)

export default function RunningTracker({ circle, me, circleId, todayKey, members }: any) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [locationError, setLocationError] = useState("");
  
  // 🕒 Track exactly when we joined the lobby to ignore old sync signals
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
  
  // Squad is ready only if everyone is in the lobby/running and there's more than just you
  const isSquadReady = members && members.length > 1 && unreadyMembers.length === 0;

  function formatTime(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // 📡 THE "FRESH SYNC" LISTENER
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby" && lobbyEntryTime) {
      // 🛡️ ONLY start if the syncStartTime is NEWER than when we joined the lobby
      if (
        circle?.currentSyncSession === todayKey && 
        circle?.syncStartTime && 
        circle.syncStartTime > lobbyEntryTime
      ) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey, lobbyEntryTime]);

  // ... (GPS Engine and Broadcaster effects remain the same)

  async function updateDocState(data: any) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "circles", circleId, "members", user.uid), data, { merge: true });
  }

  // 🎮 LOBBY FUNCTIONS
  async function enterLobby() {
    setLocationError("");
    setLobbyEntryTime(Date.now()); // 🔒 Set our entry timestamp locally
    updateDocState({ 
      todayState: "waiting_in_lobby", 
      todayDate: todayKey,
      todayDistance: 0,
      todayPace: 0
    });
  }

  async function startSquadWorkout() {
    if (!isSquadReady) return; // Double-check lock
    
    const startTime = Date.now();
    // Update the circle doc so everyone's listener triggers
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

  // ... (endWorkout and Return remains the same)
}
