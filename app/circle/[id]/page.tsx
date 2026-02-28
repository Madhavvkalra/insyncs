"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  const [members, setMembers] = useState<any[]>([]);
  
  // ✨ NEW: GPS State
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const todayKey = new Date().toISOString().split("T")[0];

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // Haversine formula to calculate distance in meters between two coordinates
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Returns distance in meters
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

  // ✨ NEW: Handes both Locking Location AND Verifying Check-ins
  async function handleAction() {
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

        // SCENARIO 1: Day 1 - Lock the Gym Location
        if (!data.lockedLocation) {
          await setDoc(memberRef, {
            lockedLocation: { lat: latitude, lng: longitude }
          }, { merge: true });
          setIsLocating(false);
          return;
        }

        // SCENARIO 2: Day 2+ - Verify they are within 150 meters
        const dist = calculateDistance(latitude, longitude, data.lockedLocation.lat, data.lockedLocation.lng);
        
        if (dist > 150) {
          setLocationError(`Denied. You are ${Math.round(dist)}m away from your locked gym.`);
          setIsLocating(false);
          return;
        }

        // Verification Passed: Proceed with Check-in
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
        setLocationError("Failed to get location. Please allow GPS permissions in your browser/phone settings.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        <div className="relative flex items-center justify-center pt-2 h-14 mb-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all active:scale-90 dark:bg-white dark:text-black"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          <h1 className="text-xl font-semibold tracking-tight truncate px-14">
            {circle.name}
          </h1>
        </div>

        {isWaitingForSquad ? (
          
          <div className="flex flex-col items-center justify-center py-8 space-y-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm mt-4">
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="relative z-10 w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xl shadow-xl">
                ⏳
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Waiting for squad...</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Share the code or link below.
              </p>
            </div>

            <div className="w-full space-y-3">
              <div className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-between shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Join Code</span>
                  <span className="text-sm font-mono font-bold text-black dark:text-white truncate max-w-[120px]">{id}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(id);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                  {codeCopied ? "Copied ✓" : "Copy Code"}
                </button>
              </div>

              <div className="w-full p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center shadow-inner">
                <div className="flex-1 px-4 py-3 text-xs font-mono truncate text-zinc-500">
                  {`${window.location.origin}/join/${id}`}
                </div>
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                  {linkCopied ? "Copied ✓" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>

        ) : (

          <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                 <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                    <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                 </div>
                 <button
                    onClick={copyInviteLink}
                    className="text-xs font-bold bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full"
                 >
                    {linkCopied ? "Copied! ✓" : "Copy Invite"}
                 </button>
              </div>

              {/* ✨ NEW: GPS Error Message UI */}
              {locationError && (
                <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs font-medium text-center">
                  {locationError}
                </div>
              )}
              
              <button
                onClick={handleAction}
                disabled={checkedInToday || isLocating}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
                  checkedInToday 
                    ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                    : "bg-black text-white dark:bg-white dark:text-black shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1"
                }`}
              >
                {isLocating ? "Verifying GPS..." : 
                 checkedInToday ? "✓ Checked in Today" : 
                 !hasLockedLocation ? "📍 Lock Gym Location" : 
                 "Verify & Check In"}
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between ml-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Squad Progress</h3>
                <span className="text-xs font-bold text-zinc-400">{members.length}/6</span>
              </div>
              
              <div className="space-y-3">
                {members.map((member) => {
                  const progress = Math.min(100, ((member.cycleDay || 0) / circle.durationDays) * 100);
                  const isMe = member.uid === auth.currentUser?.uid;
                  const displayName = member.name || member.email?.split('@')[0] || "Anonymous";
                  const hasLocked = !!member.lockedLocation;

                  return (
                    <div 
                      key={member.uid}
                      onClick={() => router.push(`/circle/${id}/member/${member.uid}`)}
                      className="group cursor-pointer bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-lg">
                              {displayName.charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <p className="font-semibold text-lg leading-none">
                                 {displayName} {isMe && <span className="text-xs font-normal text-zinc-400 ml-1">(You)</span>}
                              </p>
                              {/* ✨ NEW: Shows if they have locked their location yet */}
                              <p className="text-[10px] font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                                {hasLocked ? <span className="text-green-600 dark:text-green-400">✓ Location Locked</span> : <span className="text-orange-500">⚠ Setup Pending</span>}
                              </p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-sm">{member.cycleDay || 0} <span className="text-zinc-400 font-normal">/ {circle.durationDays}</span></p>
                        </div>
                      </div>
                      
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden mt-2">
                        <div 
                          className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
