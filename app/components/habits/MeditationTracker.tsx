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

  // 🧘‍♂️ THE FOCUS LOCK (Page Visibility API + Wake Lock)
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

    // THE BRUTAL RULE: If they switch apps, kill the session.
    const handleVisibilityChange = () => {
      if (document.hidden && currentState === "working_out") {
        setFocusError("Focus broken! You left the app. Session invalidated.");
        // Instantly reset them back to the start
        updateDocState({ todayState: "none", workoutStartTime: null });
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
    if (!me?.workoutStartTime) return;
    const user = auth.currentUser;
    if (!user) return;

    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    
    // Optional: Prevent them from checking out if they did less than 1 minute
    if (durationMinutes < 1) {
      setFocusError("Meditation too short to log. Keep focusing.");
      return;
    }
    
    let newStreak = me.lastCheckin === getYesterday() ? (me.streak || 0) + 1 : 1;
    let newCycleDay = (me.cycleDay || 0) + 1;
    let newCompletedCycles = me.completedCycles || 0;

    if (newCycleDay >= circle?.durationDays) {
      newCompletedCycles += 1;
      newCycleDay = 0;
    }

    // 1. Update Daily Snapshot
    await updateDocState({
      todayState: "completed",
      todayDuration: durationMinutes,
      streak: newStreak,
      lastCheckin: todayKey,
      todayDate: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    // 2. The History Ledger
    await addDoc(collection(db, "circles", circleId, "members", user.uid, "history"), {
      date: todayKey,
      durationMinutes: durationMinutes,
      habit: "Meditation",
      createdAt: serverTimestamp()
    });
  }

  return (
    <div className="w-full space-y-4">
      {focusError && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-900 dark:text-red-400 rounded-2xl text-sm font-bold text-center animate-[shake_0.5s_ease-in-out]">
          ⚠ {focusError}
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
