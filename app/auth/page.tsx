"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [redirect, setRedirect] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  // Safely read search params AFTER mount
  useEffect(() => {
    const r = searchParams.get("redirect");
    if (r) setRedirect(r);
  }, [searchParams]);

  async function loginGoogle() {
    if (!auth) return;

    try {
      setMsg("Signing in...");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push(redirect);
    } catch (error) {
      setMsg("Google sign-in failed.");
    }
  }

  async function loginEmail() {
    if (!auth) return;

    try {
      setMsg("Signing in...");
      await signInWithEmailAndPassword(auth, email, password);
      router.push(redirect);
    } catch (error) {
      setMsg("Invalid email or password.");
    }
  }

  async function signupEmail() {
    if (!auth) return;

    try {
      setMsg("Creating account...");
      await createUserWithEmailAndPassword(auth, email, password);
      router.push(redirect);
    } catch (error) {
      setMsg("Signup failed. Try stronger password.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6 text-black dark:text-white">
      <div className="w-full max-w-sm space-y-5">

        <div className="flex justify-center">
          <Image src="/logo.png" alt="logo" width={64} height={64} />
        </div>

        <h1 className="text-center text-2xl font-semibold">
          InSyncs
        </h1>

        <p className="text-center text-sm text-zinc-500">
          No noise. Pure consistency.
        </p>

        {msg && (
          <div className="text-center text-sm text-zinc-500">
            {msg}
          </div>
        )}

        <button
          onClick={loginGoogle}
          className="w-full rounded-full bg-black py-3 text-white dark:bg-white dark:text-black"
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-zinc-400">OR</div>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border p-3 bg-transparent"
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full rounded-xl border p-3 bg-transparent"
        />

        <button
          onClick={loginEmail}
          className="w-full rounded-full border py-3"
        >
          Sign In
        </button>

        <button
          onClick={signupEmail}
          className="w-full rounded-full border py-3"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}

