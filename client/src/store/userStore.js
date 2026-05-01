import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      meetingHistory: [],

      setUser: (user, token) => set({ user, token }),

      clearUser: () => set({ user: null, token: null }),

      addToHistory: (meeting) => {
        const history = get().meetingHistory;
        const exists = history.find(m => m.id === meeting.id);
        if (!exists) {
          set({ meetingHistory: [meeting, ...history].slice(0, 50) });
        }
      },

      updateHistoryItem: (id, updates) => {
        set(state => ({
          meetingHistory: state.meetingHistory.map(m =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },
    }),
    {
      name: 'nexmeet-user',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        meetingHistory: state.meetingHistory,
      }),
    }
  )
);
