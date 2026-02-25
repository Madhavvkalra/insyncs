export const dynamic = "force-dynamic";

"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function loginGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push(redirect);
    } catch {
      setMsg("Google sign-in failed.");
    }
  }

  async function loginEmail() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push(redirect);
    } catch {
      setMsg("Invalid email or password.");
    }
  }

  async function signupEmail() {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push(redirect);
    } catch {
      setMsg("Signup failed.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6">
      <div className="w-full max-w-sm space-y-4">
        <Image src="/logo.png" alt="logo" width={64} height={64} />

        <button
          onClick={loginGoogle}
          className="w-full rounded-full bg-black py-3 text-white"
        >
          Continue with Google
        </button>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border rounded-xl p-3"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full border rounded-xl p-3"
        />

        <button onClick={loginEmail} className="w-full border rounded-full p-3">
          Sign In
        </button>

        <button onClick={signupEmail} className="w-full border rounded-full p-3">
          Create Account
        </button>

        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
