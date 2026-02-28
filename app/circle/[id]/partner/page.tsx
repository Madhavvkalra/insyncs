"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot, collection } from "firebase/firestore";
// FIXED: Removed one set of "../" so it points correctly to the lib folder!
import { db, auth } from "../../../lib/firebase";

export default function PartnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [circle, setCircle] = useState<any>(null);
  const [partnerStats, setPartnerStats] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user || !id) return;

      try {
        const circleSnap = await getDoc(doc(db, "circles", id));
        if (circleSnap.exists()) {
          setCircle(circleSnap.data());
        } else {
          router.push("/dashboard");
          return;
        }

        const unsubscribeMembers = onSnapshot(collection(db, "circles", id, "members"), (snap) => {
          const membersData = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
          const partner = membersData.find(m => m.uid !== user.uid);
          setPartnerStats(partner || null);
          setLoading(false);
        });

        return () => unsubscribeMembers();
      } catch (error) {
        console.error("Error loading partner stats:", error);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse mt-8"></div>
        <div className="w-48 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse mt-4"></div>
      </div>
    );
  }

  if (!partnerStats) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Partner data not found.
      </div>
    );
  }

  const progressPercentage = Math.min(100, ((partnerStats.cycleDay || 0) / circle.durationDays) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700 pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        <div className="relative flex items-center justify-center pt-2 h-14">
          <button
            onClick={() => router.back()}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 active:scale-90 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Partner Stats</h1>
        </div>

        <div className="flex flex-col items-center mt-6 mb-10">
          <div className="w-24 h-24 flex items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 text-4xl font-bold mb-4 shadow-inner">
             P
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium tracking-wide uppercase">
            Circle Progress
          </p>
          <h2 className="text-2xl font-bold mt-1">{circle.name}</h2>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
            {circle.habit}
          </span>
          <span className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
            {circle.durationDays} Days
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:shadow-md">
            <p className="text-4xl font-bold mb-2">{partnerStats.streak || 0} <span className="text-2xl">🔥</span></p>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider text-center">Active Streak</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:shadow-md">
            <p className="text-4xl font-bold mb-2">{partnerStats.completedCycles || 0} <span className="text-2xl">🏆</span></p>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider text-center">Total Cycles</p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 space-y-4">
          <div className="flex justify-between items-end">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Cycle Progress</p>
            <p className="text-xl font-bold">Day {partnerStats.cycleDay || 0} <span className="text-zinc-400 font-normal text-sm">/ {circle.durationDays}</span></p>
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
