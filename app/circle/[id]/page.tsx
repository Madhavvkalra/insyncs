"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function CirclePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const todayKey = new Date().toISOString().split("T")[0];

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }

  // 1. Live Circle Details
  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, "circles", id), (snap) => {
      if (snap.exists()) setCircle({ id: snap.id, ...snap.data() });
      else router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [id, router]);

  // 2. Live Squad Leaderboard
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user || !id) return;

      const unsubscribeMembers = onSnapshot(collection(db, "circles", id, "members"), (snap) => {
        const membersData = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
        
        // Sort by highest streak
        membersData.sort((a, b) => (b.streak || 0) - (a.streak || 0));
        
        setMembers(membersData);
        
        const me = membersData.find(m => m.uid === user.uid);
        if (me) setCheckedInToday(me.lastCheckin === todayKey);
        
        setLoading(false);
      });

      return () => unsubscribeMembers();
    });

    return () => unsubscribeAuth();
  }, [id, todayKey]);

  async function checkIn() {
    const user = auth.currentUser;
    if (!user) return;

    const memberRef = doc(db, "circles", id, "members", user.uid);
    const memberSnap = await getDoc(memberRef);

    let newStreak = 1, newCycleDay = 1, newCompletedCycles = 0;

    if (memberSnap.exists()) {
      const data = memberSnap.data();
      if (data.lastCheckin === getYesterday()) newStreak = (data.streak || 0) + 1;
      
      newCycleDay = (data.cycleDay || 0) + 1;
      newCompletedCycles = data.completedCycles || 0;

      if (newCycleDay >= circle?.durationDays) {
        newCompletedCycles += 1;
        newCycleDay = 0; 
      }
    }

    await setDoc(memberRef, {
      streak: newStreak,
      lastCheckin: todayKey,
      cycleDay: newCycleDay,
      completedCycles: newCompletedCycles,
    }, { merge: true });
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !circle) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center animate-pulse">
        <div className="w-full h-14 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8"></div>
        <div className="w-full h-32 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mb-4"></div>
        <div className="w-full h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl mb-2"></div>
      </div>
    );
  }

  // ✨ THE FIX: Check if you are the only person in the room!
  const isWaitingForSquad = members.length < 2;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white pb-28">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header (Always Visible) */}
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

                {/* Conditional Rendering: Waiting Room OR Full Dashboard */}
        {isWaitingForSquad ? (
          
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
              {/* ✨ NEW: Secret Code Block */}
              <div className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-between shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Join Code</span>
                  <span className="text-sm font-mono font-bold text-black dark:text-white truncate max-w-[120px]">{id}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                  {copied ? "Copied ✓" : "Copy Code"}
                </button>
              </div>

              {/* Original Link Block */}
              <div className="w-full p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center shadow-inner">
                <div className="flex-1 px-4 py-3 text-xs font-mono truncate text-zinc-500">
                  {`${window.location.origin}/join/${id}`}
                </div>
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                  {copied ? "Copied ✓" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>

        ) : (

          <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            {/* My Action Card */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                 <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{circle.habit}</p>
                    <p className="text-sm font-medium text-zinc-400">{circle.durationDays} Day Cycle</p>
                 </div>
                 <button
                    onClick={copyInviteLink}
                    className="text-xs font-bold bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full"
                 >
                    {copied ? "Copied! ✓" : "Copy Invite"}
                 </button>
              </div>
              
              <button
                onClick={checkIn}
                disabled={checkedInToday}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
                  checkedInToday 
                    ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                    : "bg-black text-white dark:bg-white dark:text-black shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1"
                }`}
              >
                {checkedInToday ? "✓ Checked in Today" : "Check In Now"}
              </button>
            </div>

            {/* 🏆 SQUAD LEADERBOARD */}
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

                  return (
                    <div 
                      key={member.uid}
                      onClick={() => router.push(`/circle/${id}/member/${member.uid}`)}
                      className="group cursor-pointer bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-lg">
                              {displayName.charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <p className="font-semibold text-lg leading-none">
                                 {displayName} {isMe && <span className="text-xs font-normal text-zinc-400 ml-1">(You)</span>}
                              </p>
                              <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-wider">
                                {member.streak || 0} Day Streak 🔥
                              </p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-sm">{member.cycleDay || 0} <span className="text-zinc-400 font-normal">/ {circle.durationDays}</span></p>
                        </div>
                      </div>
                      
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
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
          </div>
        )}

      </div>
    </div>
  );
}
