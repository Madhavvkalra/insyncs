"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 1. Check Auth State implicitly so we know who is looking at the page
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load the Circle Data
  useEffect(() => {
    async function loadCircle() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "circles", id));

        if (!snap.exists()) {
          setError("This invite link is invalid or the circle was deleted.");
          setLoading(false);
          return;
        }

        setCircle(snap.data());
      } catch (err) {
        setError("Failed to load circle details.");
      } finally {
        setLoading(false);
      }
    }

    loadCircle();
  }, [id]);

  async function joinCircle() {
    // If not logged in, send them to auth, but save where they were trying to go!
    if (!currentUser) {
      // Note: You will need to update your Auth page later to read this redirect query param!
      router.push(`/auth?redirect=/join/${id}`);
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      // Safety Check 1: Are they already in it?
      if (circle.members?.includes(currentUser.uid)) {
        router.push(`/circle/${id}`);
        return;
      }

        // Safety Check 2: Is it already full?
      if (circle.members?.length >= 6) {   // <--- CHANGE THIS 2 TO A 6
        setError("This circle is already full!");
        setIsJoining(false);
        return;
      }


      // 1. Add user to the main circle array
      await updateDoc(doc(db, "circles", id), {
        members: arrayUnion(currentUser.uid),
      });

      // 2. Initialize their personal stats document in the subcollection
      await setDoc(doc(db, "circles", id, "members", currentUser.uid), {
        streak: 0,
        cycleDay: 0,
        completedCycles: 0,
        lastCheckin: "",
      });

      // 3. Zoom them directly into the active circle!
      router.push(`/circle/${id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to join the circle. Please try again.");
      setIsJoining(false);
    }
  }

  // --- UI RENDERING ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-sm p-8 flex flex-col items-center space-y-6">
          <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse"></div>
          <div className="w-48 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse"></div>
          <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 text-center shadow-xl animate-[fadeIn_0.4s_ease-out]">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold mb-2 text-black dark:text-white">Oops!</h1>
          <p className="text-sm text-zinc-500 mb-8">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-2xl bg-black py-4 text-white font-medium hover:bg-zinc-800 active:scale-95 transition-all dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Determine button state and text dynamically
  const isAlreadyMember = currentUser && circle.members?.includes(currentUser.uid);
  const isFull = circle.members?.length >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-6 selection:bg-zinc-300 dark:selection:bg-zinc-700">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl shadow-black/5 dark:shadow-white/5 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Animated Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-black dark:bg-white rounded-full blur-md opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black text-4xl font-bold shadow-lg">
              {circle.name ? circle.name.charAt(0).toUpperCase() : "✨"}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="text-center space-y-2 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            You've been invited to
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
            {circle.name}
          </h1>
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
              {circle.habit}
            </span>
            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
              {circle.durationDays} Days
            </span>
          </div>
        </div>

        {/* Action Button */}
        {isAlreadyMember ? (
           <button
             onClick={() => router.push(`/circle/${id}`)}
             className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] active:scale-95 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
           >
             Go to Circle ➔
           </button>
        ) : isFull ? (
           <button
             disabled
             className="w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 py-4 font-medium cursor-not-allowed border border-transparent"
           >
             Circle is Full
           </button>
        ) : (
          <button
            onClick={joinCircle}
            disabled={isJoining}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black py-4 text-white font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-200 hover:bg-zinc-800 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(0,0,0,0.2)] active:scale-95 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 dark:bg-white dark:text-black dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)] dark:hover:bg-zinc-200"
          >
            {isJoining ? (
              <span className="animate-pulse">Joining...</span>
            ) : currentUser ? (
              "Accept Invite"
            ) : (
              "Login to Join"
            )}
          </button>
        )}

      </div>
    </div>
  );
}
