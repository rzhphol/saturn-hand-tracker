import { create } from 'zustand';

interface AppState {
  targetScale: number;
  setTargetScale: (scale: number) => void;
  targetPosition: [number, number];
  setTargetPosition: (pos: [number, number]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  targetScale: 1.0,
  setTargetScale: (scale) => set({ targetScale: scale }),
  targetPosition: [0, 0],
  setTargetPosition: (pos) => set({ targetPosition: pos }),
}));
