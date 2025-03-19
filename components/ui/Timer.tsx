import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { useSteelContext } from "@/app/contexts/SteelContext";

const Timer = () => {
  const [sessionTimeElapsed, setSessionTimeElapsed] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const { currentSession, maxSessionDuration } = useSteelContext();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    console.info("⏱️ Timer effect triggered", { currentSession, isExpired });
    let intervalId: NodeJS.Timeout;

    if (currentSession && !isExpired) {
      console.info("⏰ Starting session timer");
      intervalId = setInterval(() => {
        setSessionTimeElapsed(prev => {
          const newTime = prev + 1;
          if (newTime >= maxSessionDuration) {
            console.warn("⚠️ Session expired after reaching maxSessionDuration");
            setIsExpired(true);
            clearInterval(intervalId);
            return maxSessionDuration;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        console.info("🛑 Clearing session timer");
        clearInterval(intervalId);
      }
    };
  }, [currentSession, isExpired]);

  return (
    <div className="flex gap-2 font-sans">
      <span className="flex items-center gap-2">
        <div
          className={cn(
            "size-2 rounded-full",
            currentSession ? (isExpired ? "bg-[--red-9]" : "bg-[--green-9]") : "bg-[--gray-8]"
          )}
        />
        {currentSession ? (isExpired ? "Session Expired" : "Session Connected") : "No Session"}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[--gray-12]">
          {currentSession ? formatTime(sessionTimeElapsed) : "--:--"}
        </span>{" "}
        /<span className="text-[--gray-11]">{formatTime(maxSessionDuration)}</span>
      </span>
    </div>
  );
};

export default Timer;
