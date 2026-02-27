"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function AuthForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false); // NEW: Tracks loading state

  useEffect(() => {
    if (auth.currentUser) {
      router.push("/dashboard");
    }
  }, [router]);

  async function loginGoogle() {
    setIsLoading(true);
    setMsg("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      setMsg(`Google Error: ${error.message}`);
      setIsLoading(false);
    }
  }

  async function loginEmail() {
    setIsLoading(true);
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Email Login Error:", error);
      setMsg(`Login Error: ${error.message}`);
      setIsLoading(false);
    }
  }

  async function signupEmail() {
    setIsLoading(true);
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Signup Error:", error);
      setMsg(`Signup Error: ${error.message}`);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6 text-black dark:text-white selection:bg-zinc-300 dark:selection:bg-zinc-700">
      {/* Added a subtle fade-in animation to the main container */}
      <div className="w-full max-w-sm space-y-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex justify-center">
          {/* Added a bounce animation to the logo on load */}
          <div className="animate-[bounce_1s_ease-in-out]">
            <Image src="/logo.png" alt="logo" width={64} height={64} className="rounded-xl" />
          </div>
        </div>

        <h1 className="text-center text-3xl font-bold tracking-tight">
          InSyncs
        </h1>

        {msg && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm text-center transition-all">
            {msg}
          </div>
        )}

        <button
          onClick={loginGoogle}
          disabled={isLoading}
          // Tailwind magic: hover effects, click scaling (active:scale-95), and smooth transitions
          className="w-full flex items-center justify-center gap-2 rounded-full bg-black py-3.5 text-white font-medium transition-all duration-200 hover:bg-zinc-800 hover:shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isLoading ? (
             <span className="animate-pulse">Connecting...</span>
          ) : (
            <>
              {/* Optional: Add a Google SVG icon here if you have one! */}
              Continue with Google
            </>
          )}
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
          <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-medium tracking-wider uppercase">Or continue with email</span>
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
        </div>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            disabled={isLoading}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-transparent transition-all focus:ring-2 focus:ring-black dark:focus:ring-white outline-none disabled:opacity-50"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            disabled={isLoading}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-transparent transition-all focus:ring-2 focus:ring-black dark:focus:ring-white outline-none disabled:opacity-50"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={loginEmail}
            disabled={isLoading}
            className="w-full rounded-full border border-zinc-200 dark:border-zinc-800 py-3.5 font-medium transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-95 disabled:opacity-50"
          >
            Sign In
          </button>

          <button
            onClick={signupEmail}
            disabled={isLoading}
            className="w-full rounded-full border border-zinc-200 dark:border-zinc-800 py-3.5 font-medium transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-95 disabled:opacity-50"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
