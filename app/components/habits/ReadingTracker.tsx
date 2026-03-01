"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function ReadingTracker({ circle, me, circleId, todayKey, members }: any) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [focusError, setFocusError] = useState("");
  
  const [bookName, setBookName] = useState(me?.todayBook || "");
  const [takeaway, setTakeaway] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const isSynced = circle?.syncTimings === true;

  // 🕒 THE MIDNIGHT REFEREE
  const isNewDay = me?.todayDate !== todayKey;
  let currentState = me?.todayState || "none";

  if (isNewDay) {
    if (currentState === "working_out" || currentState === "logging_proof") {
      currentState = currentState; 
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
      m.todayState !== "logging_proof" &&
      m.todayState !== "completed"
  );
  const isSquadReady = members && members.length > 1 && unreadyMembers.length === 0;

  function formatTime(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // 📡 THE "MAGIC SYNC" LISTENER (Starts the session)
  useEffect(() => {
    if (isSynced && currentState === "waiting_in_lobby") {
      if (circle?.currentSyncSession === todayKey && circle?.syncStartTime) {
        startWorkout(circle.syncStartTime);
      }
    }
  }, [isSynced, currentState, circle?.currentSyncSession, circle?.syncStartTime, todayKey]);

  // 💥 THE NUCLEAR PENALTY LISTENER (Squad Reset)
  useEffect(() => {
    if (isSynced && currentState === "working_out" && circle?.syncStartTime && me?.workoutStartTime) {
      // If the global sync timer was forced forward (because someone broke focus)
      if (circle.syncStartTime > me.workoutStartTime) {
        const breakerName = circle.focusBrokenBy || "A squad member";
        const myName = me?.name || me?.email?.split('@')[0];
        
        // Show the penalty message only to the victims (the breaker gets a different message)
        if (breakerName !== myName) {
          setFocusError(`⚠ Focus broken! Timer reset because ${breakerName} exited the app.`);
        }
        
        // Force local timer to match the new global reset time
        updateDocState({ workoutStartTime: circle.syncStartTime });
      }
    }
  }, [isSynced, currentState, circle?.syncStartTime, circle?.focusBrokenBy, me?.workoutStartTime]);


  // 📖 FOCUS LOCK (With Trigger for Squad Reset)
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
          // Drop the nuke on the global circle document
          await setDoc(doc(db, "circles", circleId), {
            syncStartTime: now,
            focusBrokenBy: myName,
            focusBrokenAt: now
          }, { merge: true });
        } else {
          setFocusError("Focus broken! You left the app. Timer reset.");
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
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // 🔢 LIVE COUNTER UPDATES
  async function updateCount(type: "page" | "chapter", amount: number) {
    const currentVal = type === "page" ? (me?.todayPage || 0) : (me?.todayChapter || 0);
    const newVal = Math.max(0, currentVal + amount); 
    
    if (type === "page") {
      await updateDocState({ todayPage: newVal });
    } else {
      await updateDocState({ todayChapter: newVal });
    }
  }

  // 🎮 LOBBY FUNCTIONS
  async function enterLobby() {
    setFocusError("");
    updateDocState({ 
      todayState: "waiting_in_lobby", 
      todayDate: todayKey, 
      todayBook: bookName.trim(),
      todayPage: me?.todayPage || 0,
      todayChapter: me?.todayChapter || 0 
    });
  }

  async function startSquadWorkout() {
    const startTime = Date.now();
    await setDoc(doc(db, "circles", circleId), { 
      currentSyncSession: todayKey, 
      syncStartTime: startTime 
    }, { merge: true });
    startWorkout(startTime);
  }

  async function startWorkout(overrideStartTime?: number) {
    setFocusError("");
    const startTime = overrideStartTime || Date.now();
    updateDocState({ 
      todayState: "working_out", 
      workoutStartTime: startTime, 
      todayDate: todayKey,
      todayBook: bookName.trim(),
      todayPage: me?.todayPage || 0,
      todayChapter: me?.todayChapter || 0 
    });
  }

  // 🚧 PHASE 1: Stop the timer, enter "Logging Proof" mode
  async function triggerProofPhase() {
    if (!me?.workoutStartTime) return;
    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    
    if (durationMinutes < 1) {
      setFocusError("Reading session too short. Keep reading.");
      return;
    }
    
    updateDocState({ 
      todayState: "logging_proof", 
      todayDuration: durationMinutes
    });
  }

  // 🔒 PHASE 2: Submit the takeaway to verify and finish
  async function submitProofAndFinish() {
    if (takeaway.trim().length < 5) {
      setFocusError("Please provide a real takeaway to prove you read.");
      return;
    }
    
    setIsSubmitting(true);
    const user = auth.currentUser;
    if (!user) return;

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
      streak: newStreak,
      lastCheckin: todayKey,
      todayDate: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    // 2. The History Ledger
    await addDoc(collection(db, "circles", circleId, "members", user.uid, "history"), {
      date: todayKey,
      durationMinutes: me.todayDuration,
      habit: "Reading",
      bookName: me.todayBook,
      pagesRead: me.todayPage || 0,
      chaptersRead: me.todayChapter || 0,
      takeaway: takeaway.trim(),
      createdAt: serverTimestamp()
    });

    setIsSubmitting(false);
  }

  return (
    <div className="w-full space-y-4">
      {focusError && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-900 dark:text-red-400 rounded-2xl text-sm font-bold text-center animate-[shake_0.5s_ease-in-out]">
          {focusError}
        </div>
      )}

      <div className="pt-2">
        {currentState === "completed" ? (
          <div className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl py-6 bg-zinc-100 text-green-600 dark:bg-zinc-900 dark:text-green-400 border border-green-200 dark:border-green-900/50">
            <span className="text-lg font-bold">✓ Read "{me?.todayBook}"</span>
            <span className="text-sm font-medium opacity-80">{me?.todayDuration || 0} min • {me?.todayPage} pages</span>
          </div>
        ) : currentState === "logging_proof" ? (
          <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-full flex flex-col gap-4 rounded-2xl p-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              <div className="text-center">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Timer Stopped</span>
                <p className="text-3xl font-mono font-bold tracking-tight mt-1">{me?.todayDuration || 0} min</p>
                <p className="text-sm font-medium text-zinc-500 mt-1">{me?.todayPage} Pages • {me?.todayChapter} Chapters</p>
              </div>
              
              <div className="w-full h-[1px] bg-zinc-200 dark:bg-zinc-800"></div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Proof of Knowledge
                </label>
                <textarea
                  value={takeaway}
                  onChange={(e) => {
                    setTakeaway(e.target.value);
                    setFocusError("");
                  }}
                  placeholder="Drop a 1-sentence takeaway from what you just read..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-950 text-sm transition-all focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none h-24"
                />
              </div>
            </div>
            
            <button
              onClick={submitProofAndFinish}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {isSubmitting ? "Verifying..." : "Submit & Checkout"}
            </button>
          </div>
        ) : currentState === "working_out" ? (
          <div className="space-y-3">
            {/* THE LIVE DASHBOARD */}
            <div className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl py-8 px-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {isSynced ? "Synced Reading Active" : "Reading Active"}
              </span>
              
              {/* Timer */}
              <span className="text-6xl font-mono font-bold tracking-tighter">{formatTime(elapsedSeconds)}</span>
              
              <div className="w-full h-[1px] bg-zinc-200 dark:bg-zinc-800 my-2"></div>

              {/* LIVE COUNTERS (+ / -) */}
              <div className="flex items-center justify-between w-full gap-3 px-1">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pages</span>
                  <div className="flex items-center justify-between w-full max-w-[130px] bg-white dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                     <button onClick={() => updateCount('page', -1)} className="w-9 h-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all text-lg">-</button>
                     <span className="font-mono text-xl text-center">{me?.todayPage || 0}</span>
                     <button onClick={() => updateCount('page', 1)} className="w-9 h-9 flex items-center justify-center bg-black text-white dark:bg-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all text-lg">+</button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Chapters</span>
                  <div className="flex items-center justify-between w-full max-w-[130px] bg-white dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                     <button onClick={() => updateCount('chapter', -1)} className="w-9 h-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all text-lg">-</button>
                     <span className="font-mono text-xl text-center">{me?.todayChapter || 0}</span>
                     <button onClick={() => updateCount('chapter', 1)} className="w-9 h-9 flex items-center justify-center bg-black text-white dark:bg-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all text-lg">+</button>
                  </div>
                </div>
              </div>

              {/* LIVE SQUAD RADAR */}
              {members.filter((m: any) => m.uid !== me?.uid && (m.todayState === 'working_out' || m.todayState === 'waiting_in_lobby')).length > 0 && (
                <div className="w-full mt-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 pl-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Squad Live Status
                  </span>
                  {members
                    .filter((m: any) => m.uid !== me?.uid && (m.todayState === 'working_out' || m.todayState === 'waiting_in_lobby'))
                    .map((m: any) => (
                    <div key={m.uid} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                       <div className="flex flex-col truncate pr-4">
                          <p className="text-sm font-bold truncate">{m.name || "Squad Member"}</p>
                          <p className="text-[10px] uppercase text-zinc-500 truncate">{m.todayBook || "Choosing book..."}</p>
                       </div>
                       <div className="flex gap-4 text-sm font-mono shrink-0">
                          <span className="flex flex-col items-center"><span className="text-[8px] text-zinc-400">PG</span>{m.todayPage || 0}</span>
                          <span className="flex flex-col items-center"><span className="text-[8px] text-zinc-400">CH</span>{m.todayChapter || 0}</span>
                       </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/80 mt-2">
                Do not switch apps
              </span>
            </div>
            
            <button
              onClick={triggerProofPhase}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Finish Reading
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
                    ? "Books open. Ready to sync."
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
          <div className="space-y-4">
             {/* THE SETUP PHASE */}
             <div className="w-full p-5 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
               <label className="text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  What are you reading today?
                </label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="e.g. Atomic Habits"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-black text-sm transition-all focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                />
             </div>

             <button
              onClick={isSynced ? enterLobby : () => startWorkout()}
              disabled={bookName.trim().length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-5 text-white text-xl font-bold shadow-md transition-all active:scale-95 hover:-translate-y-1 dark:bg-white dark:text-black disabled:opacity-50 disabled:hover:-translate-y-0"
            >
              {isSynced ? "Enter Waiting Lobby" : "▶ Start Reading"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
