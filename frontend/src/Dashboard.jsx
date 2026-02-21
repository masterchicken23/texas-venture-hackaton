import { NavLink, Outlet } from "react-router-dom";

export default function Dashboard({ auth, onLogout }) {
  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">FleetCompute</div>
        <div className="sidebar-user">
          <span className="sidebar-username">{auth?.username}</span>
          <span className="sidebar-company">{auth?.company}</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end className="sidebar-link">
            JOBS
          </NavLink>
          <NavLink to="/dashboard/fleet" className="sidebar-link">
            FLEET STATUS
          </NavLink>
          <NavLink to="/dashboard/economics" className="sidebar-link">
            ECONOMICS
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
