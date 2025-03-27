"use client";

import React, { useEffect, useRef, useState } from "react";

import { registerTimerElement, useTimerStore } from "@/app/stores/timerStore";

// This component renders a DOM node that gets updated directly
// without causing React re-renders
export function DomTimer() {
  const timerRef = useRef<HTMLSpanElement>(null);
  // Add local state for initial render only
  const [initialTime, setInitialTime] = useState("00:00");

  // Ensure the timer starts correctly
  useEffect(() => {
    // Debug timer value
    console.log("[DOMTIMER] Mounting with time:", useTimerStore.getState().sessionTimeElapsed);

    // Setup direct DOM manipulation for the timer
    if (timerRef.current) {
      // Format the initial time for first render
      const time = useTimerStore.getState().sessionTimeElapsed;
      const mins = Math.floor(time / 60);
      const secs = time % 60;
      const formattedTime = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      // Set initial time
      timerRef.current.textContent = formattedTime;

      // Register this element for direct updates
      const unregister = registerTimerElement(timerRef.current);

      // Setup debug interval
      const debugInterval = setInterval(() => {
        if (timerRef.current) {
          console.log("[DOMTIMER] Current display:", timerRef.current.textContent);
        }
      }, 5000);

      return () => {
        unregister();
        clearInterval(debugInterval);
      };
    }
  }, []);

  // The span never re-renders once mounted
  return (
    <span ref={timerRef} className="timer-text">
      {initialTime}
    </span>
  );
}
