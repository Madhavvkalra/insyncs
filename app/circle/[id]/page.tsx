"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase"; 
import PageTransition from "../../components/PageTransition";

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
    const d = new Date(); d.setDate(d.getDate() - 1);
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

  // Fallback Check-in for Non-Gym Habits (Until we build them)
  async function standardCheckIn() {
    const user = auth.currentUser;
    if (!user || !me) return;
    
    let newStreak = 1, newCycleDay = (me.cycleDay || 0) + 1, newCompletedCycles = me.completedCycles || 0;
    if (me.lastCheckin === getYesterday()) newStreak = (me.streak || 0) + 1;
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
    <PageTransition> 
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
            
            // WAITING ROOM UI
            <div className="flex flex-col items-center justify-center py-8 space-y-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm mt-4">
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="relative z-10 w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-xl shadow-xl">
                  ⏳
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Waiting for squad...</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Share the code or link below.
                </p>
              </div>
              <div className="w-full space-y-3">
                <div className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-between shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Join Code</span>
                    <span className="text-sm font-mono font-bold text-black dark:text-white truncate max-w-[120px]">{id}</span>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(id); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                    className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                  >
                    {codeCopied ? "Copied ✓" : "Copy Code"}
                  </button>
                </div>
                <div className="w-full p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center shadow-inner">
                  <div className="flex-1 px-4 py-3 text-xs font-mono truncate text-zinc-500">
                    {`${window.location.origin}/join/${id}`}
                  </div>
                  <button
                    onClick={copyInviteLink}
                    className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                  >
                    {linkCopied ? "Copied ✓" : "Copy Link"}
                  </button>
                </div>
              </div>
            </div>

          ) : (

            <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
              
              {/* HABIT DASHBOARD UI */}
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

                {/* ✨ DYNAMIC HABIT COMPONENT INJECTION */}
                {circle.habit === "Gym" ? (
                  <GymTracker circle={circle} me={me} circleId={id} todayKey={todayKey} />
                ) : (
                  // Generic Check-In Fallback
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

              {/* ✨ RESTORED SQUAD LEADERBOARD */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between ml-1">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Squad Progress</h3>
                  <span className="text-xs font-bold text-zinc-400">{members.length}/6</span>
                </div>
                
                <div className="space-y-3">
                  {members.map((member) => {
                    const progress = Math.min(100, ((member.cycleDay || 0) / circle.durationDays) * 100);
                    const isMe = member.uid === auth.currentUser?.uid;
                    const displayName = member.name || member.email?.split('@')[0] || "Anonymous";
                    const hasLocked = !!member.lockedLocation;
                    
                    const isCompletedToday = member.todayDate === todayKey && member.todayState === 'completed';
                    const isWorkingOut = member.todayDate === todayKey && member.todayState === 'working_out';

                    return (
                      <div 
                        key={member.uid}
                        onClick={() => router.push(`/circle/${id}/member/${member.uid}`)}
                        className="group cursor-pointer bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98]"
                      >
                        <div className="flex justify-between items-end mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-lg relative">
                                {displayName.charAt(0).toUpperCase()}
                                {isWorkingOut && circle.habit === "Gym" && <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white dark:border-zinc-950 rounded-full animate-pulse"></div>}
                             </div>
                             <div>
                                <p className="font-semibold text-lg leading-none flex items-center gap-2">
                                   {displayName} 
                                   {isMe && <span className="text-xs font-normal text-zinc-400">(You)</span>}
                                </p>
                                
                                <div className="mt-1 flex items-center gap-2">
                                  {circle.habit === "Gym" ? (
                                    isWorkingOut ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 animate-pulse">
                                        ⏱️ At the Gym
                                      </span>
                                    ) : isCompletedToday ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                                        ✓ {member.todayDuration} Min Workout
                                      </span>
                                    ) : (
                                      <>
                                        <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                          {hasLocked ? <span className="text-zinc-500">Location Locked</span> : <span className="text-orange-500">⚠ Setup Pending</span>}
                                        </p>
                                        {hasLocked && !isMe && (
                                          <a 
                                            href={`http://googleusercontent.com/maps.google.com/maps?q=${member.lockedLocation.lat},${member.lockedLocation.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()} 
                                            className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors"
                                          >
                                            (Map 🗺️)
                                          </a>
                                        )}
                                      </>
                                    )
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                      {isCompletedToday ? "✓ Checked In" : "Pending Check-in"}
                                    </span>
                                  )}
                                </div>

                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-sm">{member.cycleDay || 0} <span className="text-zinc-400 font-normal">/ {circle.durationDays}</span></p>
                          </div>
                        </div>
                        
                        {/* THE PROGRESS BAR */}
                        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden mt-2">
                          <div 
                            className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Quote */}
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
    </PageTransition>
  );
}
