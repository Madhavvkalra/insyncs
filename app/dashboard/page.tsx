"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useRouter } from "next/navigation";

// ✨ SWIPE-TO-DELETE & INSTANT-CLICK CARD COMPONENT
function SwipeableCircleCard({ circle, isNavigating, onNavigate, onDelete }: any) {
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === 0) return;
    const diff = e.touches[0].clientX - startX;
    if (diff < 0 && !isSwiped) setOffsetX(Math.max(diff, -80));
    else if (diff > 0 && isSwiped) setOffsetX(Math.min(-80 + diff, 0));
  };

  const handleTouchEnd = () => {
    setStartX(0);
    if (offsetX < -40) {
      setIsSwiped(true);
      setOffsetX(-80);
    } else {
      setIsSwiped(false);
      setOffsetX(0);
    }
  };

  const memberCount = circle.members?.length || 1;

  return (
    <div className={`relative rounded-2xl bg-red-500 overflow-hidden shadow-sm transition-transform duration-200 ${isNavigating ? "scale-[0.98]" : "active:scale-[0.98]"}`}>
      
      {/* Background Delete Button */}
      <div className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(circle.id);
          }}
          className="w-full h-full flex flex-col items-center justify-center text-white active:bg-red-700 transition-colors"
        >
          <span className="text-xl mb-1">🗑️</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Foreground Interactive Card */}
      <div
        onClick={() => {
          if (isSwiped) {
            setIsSwiped(false);
            setOffsetX(0);
            return;
          }
          onNavigate(circle.id);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative z-10 flex items-center justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
          isNavigating
            ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
        }`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: startX === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        <div className="flex items-center gap-4 pointer-events-none">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-lg">
            {circle.name ? circle.name.charAt(0).toUpperCase() : "#"}
          </div>
                   {/* Added min-w-0 to the container to handle text truncation cleanly */}
          <div className="flex-1 min-w-0 pointer-events-none">
            <div className="flex items-center gap-2">
              {/* Added truncate so long names get "..." instead of squishing the badge */}
              <h2 className="font-semibold text-lg truncate">
                {circle.name}
              </h2>
              {/* Added flex-shrink-0 and whitespace-nowrap for a perfect pill shape! */}
              <span className={`flex-shrink-0 whitespace-nowrap text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                memberCount >= 6 
                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              }`}>
                {memberCount >= 6 ? "Full" : `${memberCount}/6 Members`}
              </span>
            </div>
            
            <div className="mt-0.5">
              {isNavigating ? (
                <p className="text-sm text-zinc-500">Loading circle...</p>
              ) : (
                <p className="text-sm text-zinc-500">Tap to view leaderboard</p>
              )}
            </div>
          </div>
        </div>

        {isNavigating ? (
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-black rounded-full animate-spin dark:border-zinc-700 dark:border-t-white pointer-events-none"></div>
        ) : (
          <span className="text-zinc-400 pointer-events-none">➔</span>
        )}
      </div>
    </div>
  );
}

// ✨ MAIN DASHBOARD PAGE
export default function DashboardPage() {
  const [circles, setCircles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => setNavigatingTo(null), []);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      try {
        const q = query(
          collection(db, "circles"),
          where("members", "array-contains", user.uid)
        );

        unsubscribeSnapshot = onSnapshot(q, (snap) => {
          setCircles(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Failed to fetch circles", error);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [router]);

  async function handleDeleteCircle(circleId: string) {
    if (!window.confirm("Are you sure you want to permanently delete this circle?")) return;
    setCircles((prev) => prev.filter((c) => c.id !== circleId));
    try {
      await deleteDoc(doc(db, "circles", circleId));
    } catch (error) {
      console.error("Error deleting circle:", error);
      alert("Failed to delete the circle. Please refresh the page.");
    }
  }

  return (
    <div className="min-h-screen p-6 pb-32 bg-zinc-50 dark:bg-black text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="max-w-md mx-auto space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
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

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-t-2 border-zinc-900 dark:border-white animate-[spin_1s_linear_infinite]"></div>
                <div className="absolute inset-2 rounded-full border-b-2 border-zinc-400 dark:border-zinc-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                <div className="w-2 h-2 bg-black dark:bg-white rounded-full animate-pulse"></div>
              </div>
              <p className="text-xs font-bold text-zinc-500 tracking-[0.2em] uppercase animate-pulse">Syncing</p>
            </div>
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
              <SwipeableCircleCard
                key={circle.id}
                circle={circle}
                isNavigating={navigatingTo === circle.id}
                onNavigate={(id: string) => {
                  setNavigatingTo(id);
                  router.push(`/circle/${id}`);
                }}
                onDelete={handleDeleteCircle}
              />
            ))
          )}
        </div>
      </div>

      {!isLoading && (
        <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center z-50 pointer-events-none animate-[fadeIn_0.5s_ease-out_0.2s_both]">
          <div className="w-full max-w-md pointer-events-auto">
            <button
              onClick={() => router.push("/create")}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] active:scale-95 active:translate-y-0 dark:bg-white dark:text-black dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)] dark:hover:bg-zinc-200"
            >
              <span className="text-xl leading-none -mt-1">+</span> Create New Circle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
