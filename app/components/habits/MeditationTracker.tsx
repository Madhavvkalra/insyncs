"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function MeditationTracker({ circle, me, circleId, todayKey, members }: any) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [focusError, setFocusError] = useState("");
  const wakeLockRef = useRef<any>(null);

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

  // 🔒 THE ANTI-ESCAPE LOCK REFS
  const validExitRef = useRef(false);
  const stateRef = useRef(currentState);
  
  // Keep the stateRef perfectly synced with the current state for the unmount check
  useEffect(() => {
    stateRef.current = currentState;
  }, [currentState]);

  // ☢️ THE ESCAPE PENALTY (Triggers when component unmounts unexpectedly)
  useEffect(() => {
    return () => {
      // If the component unmounts and they didn't explicitly click "Finish Session"
      if (!validExitRef.current && (stateRef.current === "working_out" || stateRef.current === "waiting_in_lobby")) {
        console.log("🚨 ILLEGAL NAVIGATION DETECTED: Triggering Reset 🚨");
        
        const user = auth.currentUser;
        if (user) {
          // 1. Wipe their personal progress instantly
          setDoc(doc(db, "circles", circleId, "members", user.uid), {
            todayState: "none",
            workoutStartTime: null,
            todayDuration: 0
          }, { merge: true });
        }

        // 2. THE NUCLEAR SQUAD RESET
        if (isSynced) {
          setDoc(doc(db, "circles", circleId), {
            syncStartTime: null,
            currentSyncSession: null
          }, { merge: true });
        }
      }
    };
  }, [circleId, isSynced]);

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

  // ⏱️ AUTO-DISMISS TOAST NOTIFICATION
  useEffect(() => {
    if (focusError) {
      const timer = setTimeout(() => {
        setFocusError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [focusError]);

  // 📡 THE "MAGIC SYNC" LISTENER
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby") {
      if (circle?.currentSyncSession === todayKey && circle?.syncStartTime) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey]);

  // 💥 THE NUCLEAR PENALTY LISTENER (Squad Reset via visibility change)
  useEffect(() => {
    if (isSynced && currentState === "working_out" && circle?.syncStartTime && me?.workoutStartTime) {
      if (circle.syncStartTime > me.workoutStartTime) {
        const breakerName = circle.focusBrokenBy || "A squad member";
        const myName = me?.name || me?.email?.split('@')[0];
        
        if (breakerName !== myName) {
          setFocusError(`⚠ Focus broken! Timer reset because ${breakerName} exited the app.`);
        }
        
        updateDocState({ workoutStartTime: circle.syncStartTime });
      }
    }
  }, [isSynced, currentState, circle?.syncStartTime, circle?.focusBrokenBy, me?.workoutStartTime]);

  // 🧘‍♂️ THE FOCUS LOCK
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

    const handleVisibilityChange = async () => {
      if (document.hidden && currentState === "working_out") {
        const now = Date.now();
        const myName = me?.name || me?.email?.split('@')[0] || "A squad member";

        if (isSynced) {
          setFocusError("Focus broken! You left the app. Timer reset for everyone.");
          await setDoc(doc(db, "circles", circleId), {
            syncStartTime: now,
            focusBrokenBy: myName,
            focusBrokenAt: now
          }, { merge: true });
        } else {
          setFocusError("Focus broken! Your timer has been reset to 0:00.");
        }
        
        updateDocState({ todayState: "working_out", workoutStartTime: now });
      }
    };

    if (currentState === "working_out" && me?.workoutStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - me.workoutStartTime) / 1000)), 1000);
      requestWakeLock();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [currentState, me?.workoutStartTime, isSynced, circleId, me?.name, me?.email]);

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
    setFocusError("");
    updateDocState({ todayState: "waiting_in_lobby", todayDate: todayKey });
  }

  async function startSquadWorkout() {
    const startTime = Date.now();
    await setDoc(doc(db, "circles", circleId), { currentSyncSession: todayKey, syncStartTime: startTime }, { merge: true });
    startWorkout(startTime);
  }

  async function startWorkout(overrideStartTime?: number) {
    setFocusError("");
    const startTime = overrideStartTime || Date.now();
    updateDocState({ todayState: "working_out", workoutStartTime: startTime, todayDate: todayKey });
  }

  async function endWorkout() {
    validExitRef.current = true; // ✅ Mocks the exit as a legal completion

    if (!me?.workoutStartTime) return;
    const user = auth.currentUser;
    if (!user) return;

    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    
    if (durationMinutes < 1) {
      setFocusError("Meditation too short to log. Keep focusing.");
      validExitRef.current = false; // ❌ Reset the flag because they failed to complete it
      return;
    }
    
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
      streak: newStreak,
      lastCheckin: todayKey,
      todayDate: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    await addDoc(collection(db, "circles", circleId, "members", user.uid, "history"), {
      date: todayKey,
      durationMinutes: durationMinutes,
      habit: "Meditation",
      createdAt: serverTimestamp()
    });
  }

  return (
    <div className="w-full space-y-4 relative">
      
      {/* 🔔 THE FLOATING IN-APP NOTIFICATION */}
      {focusError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-[350px] p-4 bg-red-100 border-2 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-400 rounded-2xl text-sm font-bold text-center shadow-[0_10px_40px_rgba(239,68,68,0.3)] animate-[shake_0.5s_ease-in-out]">
          {focusError}
        </div>
      )}

      <div className="pt-2">
        {currentState === "completed" ? (
          <div className="w-full flex flex-col items-center justify-center gap-1 rounded-2xl py-6 bg-zinc-100 text-green-600 dark:bg-zinc-900 dark:text-green-400 border border-green-200 dark:border-green-900/50">
            <span className="text-lg font-bold">✓ Mind Cleared</span>
            <span className="text-sm font-medium opacity-80">{me?.todayDuration || 0} min</span>
          </div>
        ) : currentState === "working_out" ? (
          <div className="space-y-3">
            <div className="w-full flex flex-col items-center justify-center gap-6 rounded-2xl py-12 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                {isSynced ? "Synced Focus Active" : "Focus Active"}
              </span>
              
              {/* Pulsing Zen UI */}
              <div className="relative flex items-center justify-center w-32 h-32">
                <div className="absolute inset-0 rounded-full border border-black/10 dark:border-white/10 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="absolute inset-4 rounded-full border border-black/20 dark:border-white/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]"></div>
                <div className="relative z-10 w-full h-full rounded-full flex items-center justify-center">
                  <span className="text-4xl font-mono font-light tracking-tight">{formatTime(elapsedSeconds)}</span>
                </div>
              </div>
              
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/80 mt-2">
                Do not switch apps
              </span>
            </div>
            
            <button
              onClick={endWorkout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Finish Session
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
                    ? "Everyone is ready to focus."
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
              {isSquadReady ? "🚀 Begin Sync" : "🔒 Start Locked"}
            </button>
          </div>
        ) : (
          <button
            onClick={isSynced ? enterLobby : () => startWorkout()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-5 text-white text-xl font-bold shadow-md transition-all active:scale-95 hover:-translate-y-1 dark:bg-white dark:text-black"
          >
            {isSynced ? "Enter Waiting Lobby" : "▶ Start Meditation"}
          </button>
        )}
      </div>
    </div>
  );
}
