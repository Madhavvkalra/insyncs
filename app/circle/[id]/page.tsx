"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection
} from "firebase/firestore";
// Notice the two sets of dots here! This is required for this specific folder depth.
import { db, auth } from "../../lib/firebase";

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [copied, setCopied] = useState(false);

  // My Stats State
  const [streak, setStreak] = useState(0);
  const [cycleDay, setCycleDay] = useState(0);
  const [completedCycles, setCompletedCycles] = useState(0);
  
  // Partner's Stats State
  const [partnerStats, setPartnerStats] = useState<any>(null);

  const todayKey = new Date().toISOString().split("T")[0];

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // 1. LIVE LISTENER: Watch the circle document
  useEffect(() => {
    if (!id) return;
    const unsubscribeCircle = onSnapshot(doc(db, "circles", id), (snap) => {
      if (snap.exists()) {
        setCircle({ id: snap.id, ...snap.data() });
      } else {
        router.push("/dashboard"); 
      }
      setLoading(false);
    });
    return () => unsubscribeCircle();
  }, [id, router]);

  // 2. LIVE LISTENER: Watch the members subcollection for REAL-TIME stats
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      if (id) {
        const unsubscribeMembers = onSnapshot(collection(db, "circles", id, "members"), (snap) => {
          // The TypeScript 'as any' fix is applied right here!
          const membersData = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
          
          // Find MY stats
          const me = membersData.find(m => m.uid === user.uid);
          if (me) {
            setStreak(me.streak || 0);
            setCycleDay(me.cycleDay || 0);
            setCompletedCycles(me.completedCycles || 0);
            setCheckedInToday(me.lastCheckin === todayKey);
          }

          // Find PARTNER'S stats
          const partner = membersData.find(m => m.uid !== user.uid);
          setPartnerStats(partner || null);
        });

        return () => unsubscribeMembers();
      }
    });

    return () => unsubscribeAuth();
  }, [id, todayKey, router]);

  async function checkIn() {
    const user = auth.currentUser;
    if (!user) return;

    const memberRef = doc(db, "circles", id, "members", user.uid);
    const memberSnap = await getDoc(memberRef);

    let newStreak = 1;
    let newCycleDay = 1;
    let newCompletedCycles = 0;

    if (memberSnap.exists()) {
      const data = memberSnap.data();

      if (data.lastCheckin === getYesterday()) {
        newStreak = (data.streak || 0) + 1;
      }

      newCycleDay = (data.cycleDay || 0) + 1;
      newCompletedCycles = data.completedCycles || 0;

      if (newCycleDay >= circle.durationDays) {
        newCompletedCycles += 1;
        newCycleDay = 0; 
      }
    }

    await setDoc(memberRef, {
      streak: newStreak,
      lastCheckin: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    });

    setStatus("Awesome job! Check-in successful.");
  }

  function copyInviteLink() {
    const inviteUrl = `${window.location.origin}/join/${id}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 flex flex-col items-center">
        <div className="w-full max-w-md h-14 animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8"></div>
        <div className="w-full max-w-md h-64 animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-3xl"></div>
      </div>
    );
  }

  const isWaitingForPartner = circle?.members?.length < 2;
  const progressPercentage = Math.min(100, (cycleDay / circle.durationDays) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700 pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* HEADER */}
        <div className="relative flex items-center justify-center pt-2 h-14 mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 active:scale-90 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          <h1 className="text-xl font-semibold tracking-tight truncate px-14">
            {circle.name}
          </h1>
        </div>

        {isWaitingForPartner ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
            <div className="relative flex items-center justify-center w-32 h-32">
              <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-4 rounded-full border-4 border-black/20 dark:border-white/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
              <div className="relative z-10 w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-3xl shadow-xl">
                ⏳
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Waiting for partner...</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Share this link. The tracker will unlock the moment they join!
              </p>
            </div>

            <div className="w-full p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center shadow-inner">
              <div className="flex-1 px-4 py-3 text-sm font-mono truncate text-zinc-600 dark:text-zinc-400">
                {`${window.location.origin}/join/${id}`}
              </div>
              <button
                onClick={copyInviteLink}
                className="px-5 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                {copied ? "Copied! ✓" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
            
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                {circle.habit}
              </span>
              <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                {circle.durationDays} Days
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:shadow-md">
                <p className="text-4xl font-bold mb-2">{streak} <span className="text-2xl">🔥</span></p>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Current Streak</p>
              </div>

              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:shadow-md">
                <p className="text-4xl font-bold mb-2">{completedCycles} <span className="text-2xl">🏆</span></p>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Cycles</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Cycle Progress</p>
                <p className="text-xl font-bold">Day {cycleDay} <span className="text-zinc-400 font-normal text-sm">/ {circle.durationDays}</span></p>
              </div>
              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                onClick={checkIn}
                disabled={checkedInToday}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-5 text-lg font-bold transition-all duration-200 active:scale-95 ${
                  checkedInToday 
                    ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed border border-transparent" 
                    : "bg-black text-white dark:bg-white dark:text-black shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)]"
                }`}
              >
                {checkedInToday ? "✓ Checked in Today" : "Check In"}
              </button>

              {status && (
                <div className="text-sm text-center text-green-600 dark:text-green-400 font-medium animate-[fadeIn_0.3s_ease-out]">
                  {status}
                </div>
              )}
            </div>

            {/* LIVE LEADERBOARD */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4 mt-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-2">Circle Members</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-lg">
                       {auth.currentUser?.email?.charAt(0).toUpperCase() || "Y"}
                    </div>
                    <p className="font-semibold">You</p>
                  </div>
                  <div className="text-right">
                     <p className="font-bold text-lg">{streak} <span className="text-sm">🔥</span></p>
                  </div>
                </div>

                {partnerStats && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 flex items-center justify-center font-bold text-lg">
                         P
                      </div>
                      <p className="font-semibold text-zinc-600 dark:text-zinc-300">Partner</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                       {partnerStats.lastCheckin === todayKey && (
                          <span className="text-xs font-bold text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">Done Today</span>
                       )}
                       <p className="font-bold text-lg text-zinc-600 dark:text-zinc-300">{partnerStats.streak || 0} <span className="text-sm opacity-50">🔥</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
