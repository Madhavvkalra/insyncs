"use client";

import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Adjust if your lib is elsewhere

export default function GymTracker({ circle, me, circleId, todayKey }: any) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isNewDay = me?.todayDate !== todayKey;
  const currentState = isNewDay ? 'none' : (me?.todayState || 'none');
  const hasLockedLocation = !!me?.lockedLocation;

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; 
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  }

  function formatTime(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  useEffect(() => {
    let interval: any;
    if (currentState === 'working_out' && me?.workoutStartTime) {
      interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - me.workoutStartTime) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [currentState, me?.workoutStartTime]);

  async function updateDocState(data: any) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "circles", circleId, "members", user.uid), data, { merge: true });
  }

  function getYesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  async function lockLocation() {
    setLocationError("");
    setIsLocating(true);
    if (!navigator.geolocation) return setLocationError("GPS not supported.");
    
    if (me?.lockedLocation) {
        setIsLocating(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateDocState({ lockedLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setIsLocating(false);
      },
      () => { setLocationError("GPS permission denied."); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function verifyGymArrival() {
    setLocationError("");
    setIsLocating(true);
    if (!navigator.geolocation) return setLocationError("GPS not supported.");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!me?.lockedLocation) {
          setLocationError("Please lock your Gym Location first!");
          setIsLocating(false);
          return;
        }
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, me.lockedLocation.lat, me.lockedLocation.lng);
        if (dist > 150) {
          setLocationError(`Denied. You are ${Math.round(dist)}m away from your locked gym.`);
          setIsLocating(false);
          return;
        }
        updateDocState({ todayDate: todayKey, todayState: 'verified', todayDuration: 0 });
        setIsLocating(false);
      },
      () => { setLocationError("GPS error. Please allow location access."); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function startWorkout() {
    updateDocState({ todayState: 'working_out', workoutStartTime: Date.now() });
  }

  async function endWorkout() {
    const durationMinutes = Math.round((Date.now() - me.workoutStartTime) / 60000);
    let newStreak = (me.lastCheckin === getYesterday() ? (me.streak || 0) + 1 : 1);
    let newCycleDay = (me.cycleDay || 0) + 1;
    let newCompletedCycles = me.completedCycles || 0;

    if (newCycleDay >= circle?.durationDays) {
      newCompletedCycles += 1;
      newCycleDay = 0; 
    }

    updateDocState({
      todayState: 'completed',
      todayDuration: durationMinutes,
      streak: newStreak,
      lastCheckin: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });
  }

  return (
    <div className="w-full space-y-4">
      {/* Target Gym Coordinates Block */}
      <div className="w-full p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gym Coordinates Secured</span>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono tracking-tight flex items-center gap-2">
                    {hasLockedLocation ? (
                      <>
                        <svg className="w-3 h-3 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {me?.lockedLocation.lat.toFixed(4)}° N, {me?.lockedLocation.lng.toFixed(4)}° W
                      </>
                    ) : (
                      "⚠ Set Location Required"
                    )}
                </p>
            </div>

            <div className="flex flex-col items-center gap-1.5 shrink-0 px-4 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Locked</span>
            </div>
        </div>

        {hasLockedLocation && (
          <a 
            href={`http://googleusercontent.com/maps.google.com/maps?q=${me.lockedLocation.lat},${me.lockedLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            View locked gym on map 🗺️
          </a>
        )}

        {!hasLockedLocation && (
          <button
              onClick={lockLocation}
              disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-black py-4 text-white font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
          >
              {isLocating ? "Set Location..." : "Set Location"}
          </button>
        )}
      </div>

      {locationError && (
        <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs font-medium text-center">
          {locationError}
        </div>
      )}
      
      {/* Main Action Area */}
      <div className="pt-2">
        {currentState === 'completed' ? (
          <div className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold bg-zinc-100 text-green-600 dark:bg-zinc-900 dark:text-green-400 border border-green-200 dark:border-green-900/50">
            ✓ Workout Logged ({me?.todayDuration} min)
          </div>
        ) : currentState === 'working_out' ? (
          <div className="space-y-3">
            <div className="w-full flex flex-col items-center justify-center gap-1 rounded-2xl py-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 animate-pulse">Session Active</span>
              <span className="text-4xl font-mono font-bold tracking-tight">{formatTime(elapsedSeconds)}</span>
            </div>
            <button
              onClick={endWorkout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-4 text-white text-lg font-bold shadow-lg transition-all active:scale-95 hover:bg-red-600"
            >
              Stop & Checkout
            </button>
          </div>
        ) : currentState === 'verified' ? (
          <button
            onClick={startWorkout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white text-lg font-bold shadow-md transition-all active:scale-95 hover:-translate-y-1 dark:bg-white dark:text-black"
          >
            ▶ Start Workout
          </button>
        ) : (
          <button
            onClick={verifyGymArrival}
            disabled={!hasLockedLocation || isLocating}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
              !hasLockedLocation
                ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                : "bg-black text-white dark:bg-white dark:text-black shadow-md hover:-translate-y-1"
            }`}
          >
            {isLocating ? "Verifying GPS..." : 
             !hasLockedLocation ? "Lock Gym to Start" : 
             "Verify GPS & Arrive"}
          </button>
        )}
      </div>
    </div>
  );
}
