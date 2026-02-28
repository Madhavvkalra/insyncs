"use client";

import GymTracker from "./GymTracker";
// We will import RunningTracker, MeditationTracker, etc., here later!

export default function HabitRouter({ 
  circle, 
  me, 
  circleId, 
  todayKey, 
  checkedInToday, 
  standardCheckIn 
}: any) {
  
  // THE SWITCHBOARD
  switch (circle.habit) {
    case "Gym":
      return <GymTracker circle={circle} me={me} circleId={circleId} todayKey={todayKey} />;
    
    // For now, all other habits fall back to the generic button.
    // Tomorrow, we just add "case 'Running': return <RunningTracker />"
    case "Running":
    case "Meditation":
    case "Reading":
    default:
      return (
        <div className="pt-2">
          <button
            onClick={standardCheckIn}
            disabled={checkedInToday}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold transition-all duration-200 active:scale-95 ${
              checkedInToday 
                ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed" 
                : "bg-black text-white dark:bg-white dark:text-black shadow-md hover:-translate-y-1"
            }`}
          >
            {checkedInToday ? "✓ Checked in Today" : "Check In Now"}
          </button>
        </div>
      );
  }
}
