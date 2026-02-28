"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { db, auth } from "../../lib/firebase"; 
import PageTransition from "../../components/PageTransition";

// Import your habit engines here!
import GymTracker from "../../components/habits/GymTracker";

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);

  const todayKey = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!id) return;
    const unsubscribeCircle = onSnapshot(doc(db, "circles", id), (snap) => {
      if (snap.exists()) setCircle({ id: snap.id, ...snap.data() });
      else router.push("/dashboard");
    });

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const unsubscribeMembers = onSnapshot(collection(db, "circles", id, "members"), (snap) => {
        const membersData = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
        membersData.sort((a, b) => (b.streak || 0) - (a.streak || 0));
        setMembers(membersData);
        setLoading(false);
      });
      return () => unsubscribeMembers();
    });

    return () => { unsubscribeCircle(); unsubscribeAuth(); };
  }, [id, router]);

  if (loading || !circle) return <div className="min-h-screen bg-zinc-50 dark:bg-black animate-pulse" />;

  const me = members.find(m => m.uid === auth.currentUser?.uid);

  return (
    <PageTransition> 
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-black dark:bg-black dark:text-white pb-28">
        <div className="mx-auto max-w-md space-y-8">
          
          <div className="relative flex items-center justify-center pt-2 h-14 mb-4">
            <button onClick={() => router.push("/dashboard")} className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white">←</button>
            <h1 className="text-xl font-semibold tracking-tight truncate px-14">{circle.name}</h1>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                  <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                </div>
            </div>

            {/* ✨ DYNAMIC HABIT ROUTER */}
            {circle.habit === "Gym" && <GymTracker circle={circle} me={me} circleId={id} todayKey={todayKey} />}
            {/* {circle.habit === "Running" && <RunningTracker circle={circle} me={me} circleId={id} todayKey={todayKey} />} */}
            
          </div>

          {/* Leaderboard mapping code goes here (kept clean and separate) */}
          <div className="space-y-4 pt-4">
             <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Squad Progress</h3>
             {members.map(member => (
               <div key={member.uid} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                  <p className="font-semibold">{member.name || "Anonymous"}</p>
                  <p className="text-sm text-zinc-500">Cycle Day {member.cycleDay || 0} / {circle.durationDays}</p>
               </div>
             ))}
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
