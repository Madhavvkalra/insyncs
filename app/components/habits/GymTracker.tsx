"use client";

import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

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

  async function lockLocation() {
    setLocationError("");
    setIsLocating(true);
    if (!navigator.geolocation) return setLocationError("GPS not supported.");
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateDocState({ lockedLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setIsLocating(false);
      },
      () => { setLocationError("GPS permission denied."); setIsLocating(false); },
      { enableHighAccuracy: true }
    );
  }

  async function verifyGymArrival() {
    setLocationError("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, me.lockedLocation.lat, me.lockedLocation.lng);
        if (dist > 150) {
          setLocationError(`Denied. You are ${Math.round(dist)}m away.`);
          setIsLocating(false);
          return;
        }
        updateDocState({ todayDate: todayKey, todayState: 'verified', todayDuration: 0 });
        setIsLocating(false);
      },
      () => { setLocationError("GPS error."); setIsLocating(false); },
      { enableHighAccuracy: true }
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

  function getYesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  return (
    <div className="w-full space-y-4">
      {/* Location Lock UI */}
      <div className="w-full p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gym Coordinates</span>
                <p className="text-xs font-mono tracking-tight">
                    {hasLockedLocation ? `✓ ${me.lockedLocation.lat.toFixed(4)}° N` : "⚠ Action Required"}
                </p>
            </div>
        </div>
        {!hasLockedLocation && (
          <button onClick={lockLocation} disabled={isLocating} className="w-full bg-black py-4 text-white rounded-xl text-xs font-bold uppercase dark:bg-white dark:text-black">
              {isLocating ? "Locating..." : "Set Location"}
          </button>
        )}
      </div>

      {locationError && <p className="text-xs text-red-500 text-center">{locationError}</p>}

      {/* Action Buttons */}
      <div className="pt-2">
        {currentState === 'completed' ? (
          <div className="w-full text-center py-4 font-bold bg-zinc-100 text-green-600 dark:bg-zinc-900 rounded-2xl">✓ Workout Logged</div>
        ) : currentState === 'working_out' ? (
          <div className="space-y-3">
            <div className="text-center py-6 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
              <span className="text-4xl font-mono font-bold">{formatTime(elapsedSeconds)}</span>
            </div>
            <button onClick={endWorkout} className="w-full bg-red-500 py-4 text-white text-lg font-bold rounded-2xl">Stop & Checkout</button>
          </div>
        ) : currentState === 'verified' ? (
          <button onClick={startWorkout} className="w-full bg-black py-4 text-white text-lg font-bold rounded-2xl dark:bg-white dark:text-black">▶ Start Workout</button>
        ) : (
          <button onClick={verifyGymArrival} disabled={!hasLockedLocation || isLocating} className="w-full bg-black py-4 text-white text-lg font-bold rounded-2xl disabled:opacity-50 dark:bg-white dark:text-black">
            {isLocating ? "Verifying..." : !hasLockedLocation ? "Lock Gym to Start" : "Verify GPS"}
          </button>
        )}
      </div>
    </div>
  );
}
