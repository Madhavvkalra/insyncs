"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// Some premium default habits to make the UI look great
const HABIT_OPTIONS = ["Gym", "Reading", "Coding", "Meditation", "Running"];
const DURATION_OPTIONS = [7, 21, 30, 60];

export default function CreateCirclePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Form, Step 2: Waiting Room
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [habit, setHabit] = useState("Gym");
  const [duration, setDuration] = useState(21);
  
  // Waiting Room State
  const [circleId, setCircleId] = useState("");
  const [copied, setCopied] = useState(false);

  // Live listener for when the second person joins
  useEffect(() => {
    if (step === 2 && circleId) {
      // onSnapshot listens to this specific document in real-time
      const unsubscribe = onSnapshot(doc(db, "circles", circleId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // If a second person is added to the members array, redirect instantly!
          if (data.members && data.members.length >= 2) {
            router.push(`/circle/${circleId}`);
          }
        }
      });

      return () => unsubscribe(); // Cleanup listener if they leave the page
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

      // ✨ NEW: Add your own personal stats document inside the circle with your email!
      await setDoc(doc(db, "circles", docRef.id, "members", user.uid), {
        email: user.email,  // <--- THIS IS THE MAGIC LINE
        streak: 0,
        cycleDay: 0,
        completedCycles: 0,
        lastCheckin: ""
      });


      // 2. Save the ID and move to the Waiting Room
      setCircleId(docRef.id);
      setStep(2);
    } catch (error) {
      console.error("Error creating circle:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function copyInviteLink() {
    // Creates a join link based on your current website URL
    const inviteUrl = `${window.location.origin}/join/${circleId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-10 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="mx-auto max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Universal Header with Back Button */}
        <div className="relative flex items-center justify-center pt-2 h-14">
          <button
            onClick={() => step === 2 ? setStep(1) : router.push("/dashboard")}
            className="absolute left-0 w-12 h-12 flex items-center justify-center rounded-full bg-black text-white shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 active:scale-90 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            aria-label="Go back"
          >
            <span className="text-2xl leading-none -mt-1 font-light">←</span>
          </button>
          
          <h1 className="text-xl font-semibold tracking-tight">
            {step === 1 ? "New Circle" : "Invite Partner"}
          </h1>
        </div>

        {step === 1 ? (
          /* STEP 1: CREATION FORM */
          <div className="space-y-8 mt-8 animate-[fadeIn_0.3s_ease-out]">
            
            {/* Name Input */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider ml-1">Circle Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Warriors"
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950 text-lg transition-all focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
              />
            </div>

            {/* Habit Selection (Replaces Hardcoded 'Gym') */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider ml-1">Primary Habit</label>
              <div className="flex flex-wrap gap-2">
                {HABIT_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHabit(h)}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                      habit === h 
                        ? "bg-black text-white dark:bg-white dark:text-black shadow-md" 
                        : "bg-white text-black border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white hover:border-zinc-400"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection (Replaces Hardcoded '21') */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider ml-1">Duration (Days)</label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all active:scale-95 ${
                      duration === d 
                        ? "bg-black text-white dark:bg-white dark:text-black shadow-md" 
                        : "bg-white text-black border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white hover:border-zinc-400"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <div className="pt-6">
              <button
                onClick={handleCreateCircle}
                disabled={!name.trim() || isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] active:scale-95 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 dark:bg-white dark:text-black dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)] dark:hover:bg-zinc-200"
              >
                {isLoading ? <span className="animate-pulse">Creating...</span> : "Create & Get Invite Link"}
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: WAITING ROOM */
          <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-[fadeIn_0.4s_ease-out]">
            
            {/* Pulsing Radar Animation */}
            <div className="relative flex items-center justify-center w-32 h-32">
              <div className="absolute inset-0 rounded-full border-4 border-black/10 dark:border-white/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-4 rounded-full border-4 border-black/20 dark:border-white/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
              <div className="relative z-10 w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center text-3xl shadow-xl">
                ⏳
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Waiting for partner...</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mx-auto">
                Send this link to your friend. This screen will automatically update when they join!
              </p>
            </div>

            {/* Invite Code Box */}
            <div className="w-full p-1 bg-zinc-200 dark:bg-zinc-800 rounded-2xl flex items-center shadow-inner mt-4">
              <div className="flex-1 px-4 py-3 text-sm font-mono truncate text-zinc-600 dark:text-zinc-300">
                {`${window.location.origin}/join/${circleId}`}
              </div>
              <button
                onClick={copyInviteLink}
                className="px-6 py-3 bg-white dark:bg-black rounded-xl text-sm font-semibold shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                {copied ? "Copied! ✓" : "Copy"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
