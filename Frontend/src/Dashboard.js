import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      navigate('/login');
      return;
    }

    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <h1>Interview Scheduling System</h1>
        <div className="nav-right">
          <span>Welcome, {user?.username || 'User'}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Active Positions</h3>
            <p className="stat-number">12</p>
          </div>
          <div className="stat-card">
            <h3>Candidates in Queue</h3>
            <p className="stat-number">45</p>
          </div>
          <div className="stat-card">
            <h3>Interviews Today</h3>
            <p className="stat-number">8</p>
          </div>
          <div className="stat-card">
            <h3>Average Wait Time</h3>
            <p className="stat-number">15 min</p>
          </div>
        </div>

        <div className="main-content">
          <div className="section">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="action-btn">Manage Positions</button>
              <button className="action-btn">View Queue</button>
              <button className="action-btn" onClick={() => navigate('/settings')}>Interview Settings</button>
              <button className="action-btn">Reports</button>
            </div>
          </div>

          <div className="section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
              <div className="activity-item">
                <span className="time">10:15 AM</span>
                <span>Interview completed for Software Engineer position</span>
              </div>
              <div className="activity-item">
                <span className="time">10:02 AM</span>
                <span>New candidate joined queue for Data Analyst</span>
              </div>
              <div className="activity-item">
                <span className="time">9:45 AM</span>
                <span>High priority set by candidate #123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;