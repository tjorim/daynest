import { Navigate, Route, Routes } from 'react-router-dom';
import { TodayPage } from '../../features/today/TodayPage';
import { CalendarPage } from '../../features/calendar/CalendarPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/today" element={<TodayPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
