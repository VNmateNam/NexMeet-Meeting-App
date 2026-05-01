import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MeetingPage from './pages/MeetingPage';
import HistoryPage from './pages/HistoryPage';
import { useUserStore } from './store/userStore';

export default function App() {
  const { user } = useUserStore();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route
        path="/meeting/:roomId"
        element={user ? <MeetingPage /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
