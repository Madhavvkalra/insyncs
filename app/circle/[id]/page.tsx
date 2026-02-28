"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, setDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase"; 

import GymTracker from "../../components/habits/GymTracker";
import SquadLeaderboard from "../../components/SquadLeaderboard"; // 👈 Look at this! Our new component

import WaitingRoom from "../../components/WaitingRoom";

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const todayKey = new Date().toISOString().split("T")[0];

  function getYesterday() {
    const d = new Date(); 
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

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

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function standardCheckIn() {
    const user = auth.currentUser;
    const meMember = members.find(m => m.uid === user?.uid);
    if (!user || !meMember) return;
    
    let newStreak = 1;
    let newCycleDay = (meMember.cycleDay || 0) + 1;
    let newCompletedCycles = meMember.completedCycles || 0;

    if (meMember.lastCheckin === getYesterday()) {
      newStreak = (meMember.streak || 0) + 1;
    }
    
    if (newCycleDay >= circle?.durationDays) {
      newCompletedCycles += 1;
      newCycleDay = 0; 
    }

    await setDoc(doc(db, "circles", id, "members", user.uid), {
      todayState: 'completed',
      streak: newStreak,
      lastCheckin: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
      todayDate: todayKey
    }, { merge: true });
  }

  if (loading || !circle) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center animate-pulse">
        <div className="w-full h-14 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8"></div>
        <div className="w-full h-32 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mb-4"></div>
      </div>
    );
  }

  const isWaitingForSquad = members.length < 2;
  const me = members.find(m => m.uid === auth.currentUser?.uid);
  const isNewDay = me?.todayDate !== todayKey;
  const currentState = isNewDay ? 'none' : (me?.todayState || 'none');
  const checkedInToday = me?.lastCheckin === todayKey || currentState === 'completed';

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-black dark:bg-black dark:text-white pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header */}
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
          <WaitingRoom id={id} />
           ) : (

          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                 <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                    <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                 </div>
                 <button onClick={copyInviteLink} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full">
                    {linkCopied ? "Copied! ✓" : "Copy Invite"}
                 </button>
              </div>

              {circle.habit === "Gym" ? (
                <GymTracker circle={circle} me={me} circleId={id} todayKey={todayKey} />
              ) : (
                <div className="pt-2">
                  <button
                    onClick={standardCheckIn}
                    disabled={checkedInToday}
                    className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
                      checkedInToday 
                        ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                        : "bg-black text-white dark:bg-white dark:text-black shadow-md hover:-translate-y-1"
                    }`}
                  >
                    {checkedInToday ? "✓ Checked in Today" : "Check In Now"}
                  </button>
                </div>
              )}
            </div>

            {/* 🎯 THE MAGIC HAPPENS HERE: 100 lines of code turned into 1 line */}
            <SquadLeaderboard members={members} circle={circle} todayKey={todayKey} />

            <div className="space-y-4 pt-10 pb-6 opacity-70">
                <blockquote className="text-lg font-medium italic text-zinc-700 dark:text-zinc-300 text-center px-4">
                  "You do not rise to the level of your goals. You fall to the level of your systems."
                </blockquote>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center uppercase tracking-widest font-bold">
                  — James Clear
                </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
