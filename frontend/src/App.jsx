import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { setAuthHandlers } from "./api";
import HomePage from "./HomePage";
import Dashboard from "./Dashboard";
import JobsView from "./JobsView";
import FleetView from "./FleetView";
import EconomicsView from "./EconomicsView";

export default function App() {
  const [auth, setAuth] = useState(null);

  const getToken = useCallback(() => auth?.token ?? null, [auth]);
  const onUnauth = useCallback(() => setAuth(null), []);

  useEffect(() => {
    setAuthHandlers(getToken, onUnauth);
  }, [getToken, onUnauth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            auth ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <HomePage onLogin={setAuth} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            auth ? (
              <Dashboard auth={auth} onLogout={() => setAuth(null)} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route index element={<JobsView />} />
          <Route path="fleet" element={<FleetView />} />
          <Route path="economics" element={<EconomicsView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
