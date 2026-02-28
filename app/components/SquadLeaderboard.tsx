"use client";

import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase"; // Adjust path if needed

export default function SquadLeaderboard({ members, circle, todayKey }: any) {
  const router = useRouter();

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between ml-1">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Squad Progress</h3>
        <span className="text-xs font-bold text-zinc-400">{members.length}/6</span>
      </div>
      
      <div className="space-y-3">
        {members.map((member: any) => {
          const progress = Math.min(100, ((member.cycleDay || 0) / circle.durationDays) * 100);
          const isMeMember = member.uid === auth.currentUser?.uid;
          const displayName = member.name || member.email?.split('@')[0] || "Anonymous";
          const hasLocked = !!member.lockedLocation;
          
          const isCompletedToday = member.todayDate === todayKey && member.todayState === 'completed';
          const isWorkingOut = member.todayDate === todayKey && member.todayState === 'working_out';

          return (
            <div 
              key={member.uid}
              onClick={() => router.push(`/circle/${circle.id}/member/${member.uid}`)}
              className="group cursor-pointer bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98]"
            >
              <div className="flex justify-between items-end mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-lg relative">
                      {displayName.charAt(0).toUpperCase()}
                      {isWorkingOut && circle.habit === "Gym" && <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white dark:border-zinc-950 rounded-full animate-pulse"></div>}
                    </div>
                    <div>
                      <p className="font-semibold text-lg leading-none flex items-center gap-2">
                          {displayName} 
                          {isMeMember && <span className="text-xs font-normal text-zinc-400 ml-1">(You)</span>}
                      </p>
                      
                      <div className="mt-1">
                        {circle.habit === "Gym" ? (
                          isWorkingOut ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 animate-pulse">
                              ⏱️ At the Gym
                            </span>
                          ) : isCompletedToday ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                              ✓ {member.todayDuration} Min Workout
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1 mt-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                {hasLocked ? (
                                  <span className="text-zinc-500 font-mono">📍 {member.lockedLocation.lat.toFixed(4)}°, {member.lockedLocation.lng.toFixed(4)}°</span>
                                ) : (
                                  <span className="text-orange-500">⚠ Setup Pending</span>
                                )}
                              </p>
                              {hasLocked && !isMeMember && (
                                <a 
                                  // PERFECTED UNIVERSAL MAPS LINK
                                  href={`https://maps.google.com/?q=${member.lockedLocation.lat},${member.lockedLocation.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()} 
                                  className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors w-fit"
                                >
                                  (View Map 🗺️)
                                </a>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            {isCompletedToday ? "✓ Checked In" : "Pending Check-in"}
                          </span>
                        )}
                      </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-sm">{member.cycleDay || 0} <span className="text-zinc-400 font-normal">/ {circle.durationDays}</span></p>
                </div>
              </div>
              
              <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
