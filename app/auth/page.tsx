"use client";

import dynamic from "next/dynamic";

// Dynamically import the AuthForm component and disable server-side rendering
const AuthForm = dynamic(() => import("./AuthForm"), {
  ssr: false,
});

export default function AuthPage() {
  return <AuthForm />;

}