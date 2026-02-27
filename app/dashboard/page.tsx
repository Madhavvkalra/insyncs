"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [circles, setCircles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      try {
        const q = query(
          collection(db, "circles"),
          where("members", "array-contains", user.uid)
        );

        const snap = await getDocs(q);
        setCircles(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Failed to fetch circles", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen p-6 pb-32 bg-zinc-50 dark:bg-black text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="max-w-md mx-auto space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header Section */}
        <div className="flex items-center justify-between pt-4">
          <h1 className="text-3xl font-bold tracking-tight">My Circles</h1>
          
          <button
            onClick={() => router.push("/profile")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-95"
            aria-label="Profile"
          >
            👤
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="h-20 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800/50 animate-pulse" />
              ))}
            </>
          ) : circles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="text-4xl mb-3">✨</div>
              <h3 className="text-lg font-medium">No circles yet</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Create your first circle to start syncing up with your friends.
              </p>
            </div>
          ) : (
            circles.map((circle) => (
              <div
                key={circle.id}
                onClick={() => router.push(`/circle/${circle.id}`)}
                className="group relative flex items-center justify-between p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-lg">
                    {circle.name ? circle.name.charAt(0).toUpperCase() : "#"}
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                      {circle.name}
                      {/* Show a pending badge if there is only 1 member! */}
                      {circle.members?.length < 2 && (
                        <span className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                          Waiting
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-zinc-500">
                      {circle.members?.length < 2 ? "Needs a partner" : "Tap to view"}
                    </p>
                  </div>
                </div>
                
                <span className="text-zinc-400 group-hover:translate-x-1 transition-transform">
                  ➔
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FIXED FLOATING ACTION BUTTON */}
      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center z-50 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto">
          <button
            onClick={() => router.push("/create")}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] active:scale-95 active:translate-y-0 dark:bg-white dark:text-black dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)] dark:hover:bg-zinc-200"
          >
            <span className="text-xl leading-none -mt-1">+</span> Create New Circle
          </button>
        </div>
      </div>
    </div>
  );
}
