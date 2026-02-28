"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../../../../lib/firebase"; // 5 dots deep!

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const memberId = params.memberId as string; // The specific person we clicked

  const [loading, setLoading] = useState(true);
  const [circle, setCircle] = useState<any>(null);
  const [memberStats, setMemberStats] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user || !id || !memberId) return;

      try {
        const circleSnap = await getDoc(doc(db, "circles", id));
        if (circleSnap.exists()) setCircle(circleSnap.data());
        else router.push("/dashboard");

        // Fetch exactly the member we clicked on
        const unsubscribeMember = onSnapshot(doc(db, "circles", id, "members", memberId), (snap) => {
          if (snap.exists()) {
             setMemberStats(snap.data());
          }
          setLoading(false);
        });

        return () => unsubscribeMember();
      } catch (error) {
        console.error("Error loading member stats:", error);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [id, memberId, router]);

  if (loading || !memberStats) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 flex flex-col items-center justify-center">
         <div className="w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full animate-spin dark:border-zinc-800 dark:border-t-white"></div>
      </div>
    );
  }

  const progressPercentage = Math.min(100, ((memberStats.cycleDay || 0) / circle.durationDays) * 100);
  const displayName = memberStats.name || memberStats.email?.split('@')[0] || "Anonymous";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        <div className="relative flex items-center justify-center pt-2 h-14">
          <button
            onClick={() => router.back()}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg active:scale-90 dark:bg-white dark:text-black"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
        </div>

        <div className="flex flex-col items-center mt-6 mb-10">
          <div className="w-24 h-24 flex items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black text-4xl font-bold mb-4 shadow-lg">
             {displayName.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium tracking-wide uppercase">
            {circle.name} Member
          </p>
          <h2 className="text-2xl font-bold mt-1">{displayName}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold mb-2">{memberStats.streak || 0} <span className="text-2xl">🔥</span></p>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider text-center">Active Streak</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold mb-2">{memberStats.completedCycles || 0} <span className="text-2xl">🏆</span></p>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider text-center">Total Cycles</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 space-y-4">
          <div className="flex justify-between items-end">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Cycle Progress</p>
            <p className="text-xl font-bold">Day {memberStats.cycleDay || 0} <span className="text-zinc-400 font-normal text-sm">/ {circle.durationDays}</span></p>
          </div>
          <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

      </div>
    </div>
  );
}
