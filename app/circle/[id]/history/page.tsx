"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// 🎯 Three '../' required here based on your file structure
import { db } from "../../../lib/firebase"; 
import dynamic from "next/dynamic";

// 🎯 This tells Next.js: "Do not render this on the server!"
const RouteMap = dynamic(() => import("../../../components/RouteMap"), { 
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 uppercase font-bold tracking-widest">Loading Map...</div>
});

export default function SquadHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!id) return;

      // 1. Get Circle Info
      const circleSnap = await getDoc(doc(db, "circles", id));
      if (circleSnap.exists()) {
        setCircle({ id: circleSnap.id, ...circleSnap.data() });
      }

      // 2. Get all Members
      const membersSnap = await getDocs(collection(db, "circles", id, "members"));
      const membersList = membersSnap.docs.map(d => ({ uid: d.id, ...d.data() as any }));

      // 3. Dive into each member's personal history ledger
      let masterFeed: any[] = [];
      
      for (const member of membersList) {
        const historySnap = await getDocs(collection(db, "circles", id, "members", member.uid, "history"));
        historySnap.forEach((docSnap) => {
          const data = docSnap.data();
          masterFeed.push({
            id: docSnap.id,
            memberName: member.name || member.email?.split('@')[0] || "Anonymous",
            memberUid: member.uid,
            date: data.date,
            distanceKm: data.distanceKm,
            durationMinutes: data.durationMinutes,
            routePath: data.routePath || [], // The Breadcrumbs!
            createdAt: data.createdAt?.toMillis() || Date.now(), // For sorting
          });
        });
      }

      // 4. Sort from Newest to Oldest
      masterFeed.sort((a, b) => b.createdAt - a.createdAt);
      setFeed(masterFeed);
      setLoading(false);
    }

    fetchHistory();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center justify-center animate-pulse text-zinc-400">
        Pulling squad ledgers...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header */}
        <div className="relative flex items-center justify-center pt-2 h-14 mb-4">
          <button
            onClick={() => router.push(`/circle/${id}`)}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all active:scale-90 dark:bg-white dark:text-black"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          <div className="text-center px-14">
            <h1 className="text-xl font-semibold tracking-tight truncate">{circle?.name}</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Activity Feed</p>
          </div>
        </div>

        {/* The Feed */}
        <div className="space-y-4">
          {feed.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 text-sm">No activity recorded yet.</p>
              <p className="text-xs font-bold uppercase mt-2 opacity-50">Time to get to work.</p>
            </div>
          ) : (
            feed.map((entry) => (
              <div key={entry.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                
                {/* Header: Who and When */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-lg">
                      {entry.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-none">{entry.memberName}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">{entry.date}</p>
                    </div>
                  </div>
                </div>

                {/* 🧠 SMART STATS UI */}
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Time</span>
                    <span className="text-xl font-mono font-bold">{entry.durationMinutes} <span className="text-sm font-sans text-zinc-400">min</span></span>
                  </div>

                  {/* ONLY show Distance and Pace if it's a Running Circle */}
                  {circle?.habit === "Running" && entry.distanceKm !== undefined && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Distance</span>
                        <span className="text-xl font-mono font-bold">{entry.distanceKm} <span className="text-sm font-sans text-zinc-400">km</span></span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pace</span>
                        <span className="text-xl font-mono font-bold">
                          {entry.distanceKm > 0 ? (entry.durationMinutes / entry.distanceKm).toFixed(2) : 0} <span className="text-sm font-sans text-zinc-400">/km</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>

               {/* 🗺️ THE LIVE MAP ENGINE */}
                {circle?.habit === "Running" && entry.routePath && entry.routePath.length > 0 && (
                  <div className="w-full h-40 bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mt-4 relative overflow-hidden">
                    <RouteMap routePath={entry.routePath} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
