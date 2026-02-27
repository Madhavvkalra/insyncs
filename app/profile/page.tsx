"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

type MemberStats = {
  streak: number;
  completedCycles: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [totalCycles, setTotalCycles] = useState(0);
  const [activeStreaks, setActiveStreaks] = useState(0);
  const [circlesCount, setCirclesCount] = useState(0);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      setEmail(user.email || "");

      try {
        let cycles = 0;
        let streaks = 0;
        let circles = 0;

        const circlesSnap = await getDocs(collection(db, "circles"));

        for (const circleDoc of circlesSnap.docs) {
          const memberRef = collection(db, "circles", circleDoc.id, "members");
          const memberSnap = await getDocs(memberRef);

          memberSnap.docs.forEach((doc) => {
            if (doc.id === user.uid) {
              circles += 1;
              const data = doc.data() as MemberStats;
              cycles += data.completedCycles || 0;
              streaks += data.streak || 0;
            }
          });
        }

        setCirclesCount(circles);
        setTotalCycles(cycles);
        setActiveStreaks(streaks);
      } catch (error) {
        console.error("Error loading profile stats:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleLogout() {
    await signOut(auth);
    router.push("/auth");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* UPDATED: Header Navigation */}
        <div className="relative flex items-center justify-center pt-2 h-14">
          <button
            onClick={() => router.push("/dashboard")}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-xl active:scale-90 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            aria-label="Go back"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          
          <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse mt-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="w-40 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="h-28 rounded-3xl bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="h-28 rounded-3xl bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="h-32 col-span-2 rounded-3xl bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mt-6 mb-10">
              <div className="w-24 h-24 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black text-4xl font-bold mb-4 shadow-lg">
                {email ? email.charAt(0).toUpperCase() : "👤"}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium tracking-wide uppercase">
                Logged in as
              </p>
              <p className="text-lg font-medium mt-1">{email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm">
                <p className="text-4xl font-bold mb-2">{circlesCount}</p>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Circles</p>
              </div>

              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm">
                <p className="text-4xl font-bold mb-2">{totalCycles} <span className="text-2xl">🏆</span></p>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Cycles</p>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 flex flex-col items-center justify-center col-span-2 transition-all hover:border-orange-200 dark:hover:border-orange-900/50 hover:shadow-md group">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-orange-50/50 dark:to-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-6xl font-black mb-3 z-10">{activeStreaks} <span className="text-5xl drop-shadow-md">🔥</span></p>
                <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest z-10">Active Streak Power</p>
              </div>
            </div>

            <div className="space-y-3 pt-6">
              <button
                onClick={handleLogout}
                className="w-full rounded-2xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 py-4 font-medium transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95"
              >
                Log Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
