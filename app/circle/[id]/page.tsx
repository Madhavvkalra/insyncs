"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import PageTransition from "./components/PageTransition"; // Reuse the existing PageTransition component

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  
  const [members, setMembers] = useState<any[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const todayKey = new Date().toISOString().split("T")[0];

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; 
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  }

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, "circles", id), (snap) => {
      if (snap.exists()) setCircle({ id: snap.id, ...snap.data() });
      else router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [id, router]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user || !id) return;

      const unsubscribeMembers = onSnapshot(collection(db, "circles", id, "members"), (snap) => {
        const membersData = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
        
        membersData.sort((a, b) => (b.streak || 0) - (a.streak || 0));
        setMembers(membersData);
        
        const me = membersData.find(m => m.uid === user.uid);
        if (me) setCheckedInToday(me.lastCheckin === todayKey);
        
        setLoading(false);
      });

      return () => unsubscribeMembers();
    });

    return () => unsubscribeAuth();
  }, [id, todayKey]);

  async function lockLocation() {
    setLocationError("");
    setIsLocating(true);

    if (!navigator.geolocation) {
      setLocationError("Your device does not support location tracking.");
      setIsLocating(false);
      return;
    }

    const me = members.find(m => m.uid === auth.currentUser?.uid);
    if (me?.lockedLocation) {
        setIsLocating(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const user = auth.currentUser;
        if (!user) return;

        const memberRef = doc(db, "circles", id, "members", user.uid);
        
        await setDoc(memberRef, {
          lockedLocation: { lat: latitude, lng: longitude }
        }, { merge: true });
        
        setIsLocating(false);
      },
      (error) => {
        setLocationError("Failed to get location. Please allow GPS permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function verifyCheckIn() {
    setLocationError("");
    setIsLocating(true);

    if (!navigator.geolocation) {
      setLocationError("Your device does not support location tracking.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const user = auth.currentUser;
        if (!user) return;

        const memberRef = doc(db, "circles", id, "members", user.uid);
        const memberSnap = await getDoc(memberRef);
        
        if (!memberSnap.exists()) return;
        const data = memberSnap.data();

        if (!data.lockedLocation) {
          setLocationError("Please lock your Gym Location first!");
          setIsLocating(false);
          return;
        }

        const dist = calculateDistance(latitude, longitude, data.lockedLocation.lat, data.lockedLocation.lng);
        
        if (dist > 150) {
          setLocationError(`Denied. You are ${Math.round(dist)}m away from your locked gym.`);
          setIsLocating(false);
          return;
        }

        let newStreak = 1, newCycleDay = 1, newCompletedCycles = data.completedCycles || 0;

        if (data.lastCheckin === getYesterday()) {
          newStreak = (data.streak || 0) + 1;
        }
        
        newCycleDay = (data.cycleDay || 0) + 1;

        if (newCycleDay >= circle?.durationDays) {
          newCompletedCycles += 1;
          newCycleDay = 0; 
        }

        await setDoc(memberRef, {
          streak: newStreak,
          lastCheckin: todayKey,
          cycleDay: newCycleDay,
          completedCycles: newCompletedCycles,
        }, { merge: true });

        setIsLocating(false);
      },
      (error) => {
        setLocationError("Failed to verify location. Please allow GPS permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (loading || !circle) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center animate-pulse">
        <div className="w-full h-14 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8"></div>
        <div className="w-full h-32 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mb-4"></div>
        <div className="w-full h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl mb-2"></div>
      </div>
    );
  }

  const isWaitingForSquad = members.length < 2;
  const me = members.find(m => m.uid === auth.currentUser?.uid);
  const hasLockedLocation = !!me?.lockedLocation;

  return (
    <PageTransition> {/* Wrap the entire page with the existing transition */}
      <div className="min-h-screen bg-white px-6 py-10 text-black dark:bg-black dark:text-white pb-28">
        <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
          
          {/* Header */}
          <div className="relative flex items-center justify-center pt-2 h-14 mb-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-100 text-black shadow-sm transition-all active:scale-90 dark:bg-zinc-900 dark:text-white"
            >
              <span className="text-2xl leading-none -mt-1 font-light">←</span>
            </button>
            <h1 className="text-xl font-semibold tracking-tight truncate px-14">
              {circle.name}
            </h1>
          </div>

          {isWaitingForSquad ? (
            // Waiting Room UI...
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Waiting Room</h2>
              <p>Your squad will appear here.</p>
            </div>
          ) : (
            // Active Dashboard UI
            <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
              
              {/* Accountability Card */}
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                
                {/* Gym Cycle Text */}
                <div className="flex justify-between items-center">
                   <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                      <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                   </div>
                </div>

                {/* ✨ THE FIX: Coordinates, Locked Visual, and Map Link */}
                <div className="w-full p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gym Coordinates Secured</span>
                          
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono tracking-tight flex items-center gap-2">
                              {hasLockedLocation ? (
                                <>
                                  <svg className="w-3 h-3 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                  {me?.lockedLocation.lat.toFixed(4)}° N, {me?.lockedLocation.lng.toFixed(4)}° W
                                </>
                              ) : (
                                "⚠ Set Location Required"
                              )}
                          </p>
                      </div>

                      {/* Premium 'Locked' visual (status, not a generic button) */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0 px-4 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                          <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Locked</span>
                      </div>
                  </div>

                  {hasLockedLocation && (
                    <a 
                      href={`https://www.google.com/maps?q=${me.lockedLocation.lat},${me.lockedLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-black py-4 text-white font-medium shadow- transition-all active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
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
                
                {/* Main Check-in Button */}
                <button
                  onClick={verifyCheckIn}
                  disabled={!hasLockedLocation || checkedInToday || isLocating}
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
                    !hasLockedLocation || checkedInToday 
                      ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                      : "bg-black text-white dark:bg-white dark:text-black shadow- hover:-translate-y-1"
                  }`}
                >
                  {isLocating ? "Verifying GPS..." : 
                   checkedInToday ? "✓ Checked in Today" : 
                   !hasLockedLocation ? "Lock Gym to Start" : 
                   "Verify & Check In"}
                </button>
              </div>

              {/* Squad Leaderboard and Philosophy Quote */}
              <div className="space-y-4 pt-4">
                  <blockquote className="text-xl font-medium italic text-zinc-700 dark:text-zinc-300 text-center">
                    "You do not rise to the level of your goals. You fall to the level of your systems."
                  </blockquote>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    — James Clear
                  </p>
              </div>

            </div>
          )}

        </div>
      </div>
    </PageTransition>
  );
}
