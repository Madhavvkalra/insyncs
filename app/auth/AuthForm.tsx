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
import { auth } from "../lib/firebase"; // Make sure this path points to your firebase file

export default function AuthForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (auth.currentUser) {
      router.push("/dashboard");
    }
  }, [router]);

  async function loginGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error) {
      setMsg("Google sign-in failed.");
    }
  }

  async function loginEmail() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error) {
      setMsg("Invalid email or password.");
    }
  }

  async function signupEmail() {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error) {
      setMsg("Signup failed.");
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

        {msg && <p className="text-sm text-center text-red-500">{msg}</p>}

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
