import { create } from "zustand";

interface TimerState {
  sessionTimeElapsed: number;
  isTimerActive: boolean;
  isExpired: boolean;
  setSessionTimeElapsed: (time: number) => void;
  incrementTime: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  expireTimer: () => void;
}

export const useTimerStore = create<TimerState>(set => ({
  sessionTimeElapsed: 0,
  isTimerActive: false,
  isExpired: false,

  setSessionTimeElapsed: time => set({ sessionTimeElapsed: time }),

  incrementTime: () =>
    set(state => ({
      sessionTimeElapsed: state.sessionTimeElapsed + 1,
    })),

  startTimer: () => set({ isTimerActive: true }),

  stopTimer: () => set({ isTimerActive: false }),

  resetTimer: () =>
    set({
      sessionTimeElapsed: 0,
      isTimerActive: false,
      isExpired: false,
    }),

  expireTimer: () =>
    set({
      isTimerActive: false,
      isExpired: true,
    }),
}));

// Create a standalone DOM element for the timer outside React
let timerElements: HTMLElement[] = [];

// Format time as MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Register a DOM element to receive direct timer updates
export function registerTimerElement(element: HTMLElement) {
  timerElements.push(element);
  updateElement(element);
  return () => {
    timerElements = timerElements.filter(el => el !== element);
  };
}

// Update a single element with current time
function updateElement(element: HTMLElement) {
  const time = useTimerStore.getState().sessionTimeElapsed;
  const formattedTime = formatTime(time);

  if (element.textContent !== formattedTime) {
    console.log(`[TIMER] Updating element from ${element.textContent} to ${formattedTime}`);
    element.textContent = formattedTime;
  }
}

// Subscribe to timer changes and update all elements directly
useTimerStore.subscribe((currentTime, previousTime) => {
  console.log(`[TIMER] Time changed from ${previousTime} to ${currentTime}`);
  if (timerElements.length === 0) {
    console.log("[TIMER] No elements registered for updates");
  } else {
    console.log(`[TIMER] Updating ${timerElements.length} elements`);
    timerElements.forEach(updateElement);
  }
});
