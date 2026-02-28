"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, setDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase"; 
import GymTracker from "../../components/habits/GymTracker";

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
          <div className="flex flex-col items-center justify-center py-8 space-y-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm mt-4">
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="relative z-10 w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xl shadow-xl">⏳</div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Waiting for squad...</h2>
              <p className="text-zinc-500 text-sm">Share the code or link below.</p>
            </div>
            <div className="w-full space-y-3">
              <div className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-between">
                <span className="text-sm font-mono font-bold">{id}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(id); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                  className="px-4 py-2 bg-white dark:bg-black rounded-xl text-xs font-bold uppercase"
                >
                  {codeCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                 <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                    <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                 </div>
                 <button onClick={copyInviteLink} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full">
                    {linkCopied ? "Copied!" : "Invite"}
                 </button>
              </div>

              {circle.habit === "Gym" ? (
                <GymTracker circle={circle} me={me} circleId={id} todayKey={todayKey} />
              ) : (
                <div className="pt-2">
                  <button
                    onClick={standardCheckIn}
                    disabled={checkedInToday}
                    className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all ${
                      checkedInToday ? "bg-zinc-100 text-zinc-400" : "bg-black text-white"
                    }`}
                  >
                    {checkedInToday ? "✓ Done" : "Check In"}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-1">Squad Progress</h3>
              <div className="space-y-3">
                {members.map((member) => {
                  const progress = Math.min(100, ((member.cycleDay || 0) / circle.durationDays) * 100);
                  const isMeMember = member.uid === auth.currentUser?.uid;
                  const isCompletedToday = member.todayDate === todayKey && member.todayState === 'completed';
                  const isWorkingOut = member.todayDate === todayKey && member.todayState === 'working_out';

                  return (
                    <div key={member.uid} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold relative">
                              {(member.name || member.email || "A").charAt(0).toUpperCase()}
                              {isWorkingOut && <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-full animate-pulse"></div>}
                           </div>
                           <div>
                              <p className="font-semibold">{member.name || "Anonymous"} {isMeMember && "(You)"}</p>
                              <div className="mt-1 flex items-center gap-2">
                                {circle.habit === "Gym" ? (
                                  isWorkingOut ? (
                                    <span className="text-[10px] font-bold text-blue-500">⏱️ Active</span>
                                  ) : isCompletedToday ? (
                                    <span className="text-[10px] font-bold text-green-600">✓ {member.todayDuration}m</span>
                                  ) : (
                                    <>
                                      <span className="text-[10px] text-zinc-400">{!!member.lockedLocation ? "Locked" : "Pending"}</span>
                                      {!!member.lockedLocation && !isMeMember && (
                                        <a 
                                          href={`https://www.google.com/maps?q=${member.lockedLocation.lat},${member.lockedLocation.lng}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] text-blue-500"
                                        >
                                          (Map 🗺️)
                                        </a>
                                      )}
                                    </>
                                  )
                                ) : (
                                  <span className="text-[10px] text-zinc-400">{isCompletedToday ? "✓ Done" : "Pending"}</span>
                                )}
                              </div>
                           </div>
                        </div>
                        <p className="font-bold text-sm">{member.cycleDay || 0}/{circle.durationDays}</p>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-black dark:bg-white transition-all duration-1000" style={{ width: `${progress}%` }}></div>
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
