import Link from "next/link";
import Image from "next/image";
import PageTransition from "./components/PageTransition";

export default function Home() {
  return (
    <PageTransition>
      {/* 🌑 Hard-coded Black Background & White Text */}
      <div className="min-h-screen flex items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm space-y-12">
          
          <div className="space-y-4 text-center">
            <Image 
              src="/logo.png" 
              alt="InSyncs logo" 
              width={48} 
              height={48} 
              className="mx-auto rounded-xl grayscale invert" // Added invert to make dark logo visible on black
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">InSyncs</h1>
              <p className="mt-2 text-sm text-zinc-500">No Bullshit, Pure Consistency.</p>
            </div>
          </div>

          <div className="space-y-3 text-center">
            {/* 📜 Neutral Zinc colors that won't flip */}
            <blockquote className="text-lg font-medium italic text-zinc-300">
              "You do not rise to the level of your goals. You fall to the level of your systems."
            </blockquote>
            <p className="text-sm text-zinc-500">
              — James Clear
            </p>
          </div>

          <Link
            href="/auth"
            className="block w-full rounded-xl bg-white py-4 text-center text-sm font-bold text-black transition-transform active:scale-95"
          >
            Start
          </Link>

        </div>
      </div>
    </PageTransition>
  );
}
