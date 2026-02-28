"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// ✨ FIXED: Added setDoc and doc to the imports!
import { addDoc, collection, serverTimestamp, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const HABIT_OPTIONS = ["Gym", "Reading", "Coding", "Meditation", "Running"];
const DURATION_OPTIONS = [7, 21, 30, 60];

export default function CreateCirclePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); 
  const [isLoading, setIsLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [habit, setHabit] = useState("Gym");
  const [duration, setDuration] = useState(21);
  
  const [circleId, setCircleId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step === 2 && circleId) {
      const unsubscribe = onSnapshot(doc(db, "circles", circleId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // As soon as at least 1 other person joins, warp them to the circle!
          if (data.members && data.members.length > 1) {
            router.push(`/circle/${circleId}`);
          }
        }
      });

      return () => unsubscribe(); 
    }
  }, [step, circleId, router]);

  async function handleCreateCircle() {
    if (!name.trim()) return;
    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        router.push("/auth");
        return;
      }

      // 1. Create the circle in Firebase
      const docRef = await addDoc(collection(db, "circles"), {
        name,
        habit,
        durationDays: duration,
        members: [user.uid], 
        createdAt: serverTimestamp(),
      });

      // 2. Initialize your own personal stats document inside the circle!
      await setDoc(doc(db, "circles", docRef.id, "members", user.uid), {
        email: user.email,
        name: user.displayName, // ✨ NEW: Pulls your real name from your profile!
        streak: 0,
        cycleDay: 0,
        completedCycles: 0,
        lastCheckin: ""
      });


      setCircleId(docRef.id);
      setStep(2);
    } catch (error) {
      console.error("Error creating circle:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function copyInviteLink() {
    const inviteUrl = `${window.location.origin}/join/${circleId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        <div className="relative flex items-center justify-center pt-2 h-14">
          <button
            onClick={() => step === 2 ? setStep(1) : router.push("/dashboard")}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 active:scale-90 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            aria-label="Go back"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          
          <h1 className="text-xl font-semibold tracking-tight">
            {step === 1 ? "New Circle" : "Invite Squad"}
          </h1>
        </div>

           ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-8 animate-[fadeIn_0.4s_ease-out]">
            
            <div className="relative flex items-center justify-center w-32 h-32">
              <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-4 rounded-full border-4 border-black/20 dark:border-white/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
              <div className="relative z-10 w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-3xl shadow-xl">
                ⏳
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Waiting for squad...</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mx-auto">
                Share the code or link below. The tracker will unlock when the first person joins!
              </p>
            </div>

            <div className="w-full space-y-3">
              {/* ✨ NEW: The Secret Code Block */}
              <div className="w-full p-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-between shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Join Code</span>
                  <span className="text-sm font-mono font-bold text-black dark:text-white truncate max-w-[150px]">{circleId}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(circleId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
                >
                  {copied ? "Copied ✓" : "Copy Code"}
                </button>
              </div>

              {/* The Original Link Block */}
              <div className="w-full p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center shadow-inner">
                <div className="flex-1 px-4 py-3 text-xs font-mono truncate text-zinc-500">
                  {`${window.location.origin}/join/${circleId}`}
                </div>
                <button
                  onClick={copyInviteLink}
                  className="px-5 py-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold shadow-sm hover:scale-105 active:scale-95 transition-all"
                >
                  {copied ? "Copied ✓" : "Copy Link"}
                </button>
              </div>
            </div>

          </div>
        )}
