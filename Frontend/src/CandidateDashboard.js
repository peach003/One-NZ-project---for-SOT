import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthToken, getCurrentUser, hasAuthChanged } from './authUtils';
import './CandidateDashboard.css';

function CandidateDashboard() {
  const [user, setUser] = useState(null);
  const [positions, setPositions] = useState([]);
  const [myQueues, setMyQueues] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('positions');
  const [notification, setNotification] = useState('');
  const [activityStatus, setActivityStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [conflictMessages, setConflictMessages] = useState([]);
  const [queueOptimization, setQueueOptimization] = useState(null);

  useEffect(() => {
    const userData = getCurrentUser();
    const token = getAuthToken();

    // Check if user is logged in and has candidate role
    if (!token || !userData) {
      window.location.href = '/login';
      return;
    }

    if (userData.role !== 'candidate') {
      alert('Access denied. This page is only for candidates.');
      window.location.href = '/login';
      return;
    }

    // Store current user ID for detecting changes
    const currentUserId = userData.id;

    // Clear previous state when user changes
    setPositions([]);
    setMyQueues([]);
    setSelectedPosition(null);
    setNotification('');

    setUser(userData);
    fetchAvailablePositions();
    fetchMyQueues();
    fetchActivityStatus();

    const interval = setInterval(() => {
      // Check if user has changed (another tab logged in with different account)
      if (hasAuthChanged(currentUserId)) {
        // User has changed in another tab, redirect to login
        alert('Your session has changed in another tab. Please log in again.');
        window.location.href = '/login';
        return;
      }

      fetchMyQueues();
      fetchActivityStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Remove the automatic reload - it's causing login issues
  // Instead, rely on the initial useEffect to load correct data

  useEffect(() => {
    if (activityStatus && !activityStatus.is_started && activityStatus.minutes_until_start > 0) {
      const updateCountdown = () => {
        const minutes = Math.floor(activityStatus.minutes_until_start);
        const seconds = Math.floor((activityStatus.minutes_until_start - minutes) * 60);
        setTimeLeft(`${minutes}m ${seconds}s`);
      };

      updateCountdown();
      const countdownInterval = setInterval(updateCountdown, 1000);
      return () => clearInterval(countdownInterval);
    }
  }, [activityStatus]);

  const fetchAvailablePositions = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('http://www.bon.cc:8080/api/candidate/positions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Map the API response to match frontend expectations
      const mappedPositions = (response.data.positions || []).map(pos => ({
        ...pos,
        title: pos.name, // Map 'name' from API to 'title' for display
        company_name: pos.company?.name || 'Unknown Company',
        location: pos.location || 'Remote',
        type: pos.type || 'Full-time',
        candidates_in_queue: pos.candidates_in_queue || 0,
        available_interviewers: pos.available_interviewers || 0
      }));
      setPositions(mappedPositions);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      if (error.response?.status === 403) {
        setNotification('Access denied. Please login as a candidate.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      setPositions([]);
    }
  };

  const fetchMyQueues = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('http://www.bon.cc:8080/api/candidate/queue/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const queues = response.data.queues || [];
      setMyQueues(queues);

      // Check for optimization first, then conflicts only if no optimization available
      if (queues.length > 1) {
        const hasOptimization = await checkQueueOptimization();
        // Only check conflicts if no optimization is available
        if (!hasOptimization) {
          checkConflicts();
        }
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
      if (error.response?.status === 403) {
        // Don't redirect again if already handling in fetchAvailablePositions
        console.log('User does not have candidate permissions');
      }
      setMyQueues([]);
    }
  };

  const fetchMyQueuesWithoutOptimizationCheck = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('http://www.bon.cc:8080/api/candidate/queue/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const queues = response.data.queues || [];
      setMyQueues(queues);

      // Only check conflicts, do not check for optimization
      if (queues.length > 1) {
        checkConflicts();
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
      if (error.response?.status === 403) {
        console.log('User does not have candidate permissions');
      }
      setMyQueues([]);
    }
  };

  const checkQueueOptimization = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('http://www.bon.cc:8080/api/candidate/queue/optimization', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.can_optimize) {
        setQueueOptimization(response.data);
        return true; // Optimization is available
      } else {
        setQueueOptimization(null);
        return false; // No optimization available
      }
    } catch (error) {
      console.error('Failed to check queue optimization:', error);
      return false; // On error, assume no optimization
    }
  };

  const applyQueueOptimization = async () => {
    if (!queueOptimization) return;

    setLoading(true);

    // Store the time saved before clearing the optimization
    const timeSaved = queueOptimization.time_saved;

    try {
      const token = getAuthToken();
      await axios.post('http://www.bon.cc:8080/api/candidate/queue/optimize', {
        regular_position_id: queueOptimization.regular_position.position_id,
        priority_position_id: queueOptimization.priority_position.position_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Clear the optimization notification immediately
      setQueueOptimization(null);

      // Show success message with details
      setNotification(`✅ The plan has been accepted! Your queue order has been optimized - you saved ${timeSaved} minutes!`);

      // Refresh the queue list WITHOUT checking for optimization again
      await fetchMyQueuesWithoutOptimizationCheck();

      // Clear any conflict messages since optimization was applied
      setConflictMessages([]);

      // Keep the success message visible for longer
      setTimeout(() => setNotification(''), 5000);
    } catch (error) {
      setNotification('❌ Failed to optimize queue order. Please try again.');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const checkConflicts = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get('http://www.bon.cc:8080/api/candidate/queue/conflicts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.has_conflicts) {
        setConflictMessages(response.data.messages || []);
        // Also show a notification about conflicts
        setNotification('⚠️ Time conflicts detected and automatically resolved! Check details below.');
      } else {
        setConflictMessages([]);
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    }
  };

  const fetchActivityStatus = async () => {
    try {
      const response = await axios.get('http://www.bon.cc:8080/api/activity/status');
      setActivityStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch activity status:', error);
    }
  };

  const joinQueue = async (positionId) => {
    if (activityStatus && !activityStatus.can_join_queue) {
      if (!activityStatus.is_started) {
        setNotification(`Activity hasn't started yet. ${timeLeft ? `Starts in ${timeLeft}` : 'Please wait.'}`);
      } else if (activityStatus.is_ended) {
        setNotification('Activity has ended. Queue joining is no longer available.');
      } else {
        setNotification('Queue joining is currently not available.');
      }
      setTimeout(() => setNotification(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.post('http://www.bon.cc:8080/api/candidate/queue/join',
        { position_id: positionId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Successfully joined the queue!');
      fetchMyQueues();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification(error.response?.data?.error || 'Failed to join queue');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const leaveQueue = async (positionId) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.post('http://www.bon.cc:8080/api/candidate/queue/leave',
        { position_id: positionId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Successfully left the queue');
      fetchMyQueues();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to leave queue');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const requestPriority = async (queueId, positionId) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.post('http://www.bon.cc:8080/api/candidate/queue/priority',
        { position_id: positionId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Priority request submitted!');
      fetchMyQueues();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to request priority');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const requestDelay = async (minutes = 10) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.post('http://www.bon.cc:8080/api/candidate/queue/delay',
        { minutes: minutes },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification(`Delayed by ${minutes} minutes`);
      fetchMyQueues();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to delay');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all stored data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();

    // Clear component state
    setUser(null);
    setPositions([]);
    setMyQueues([]);

    // Redirect to login
    window.location.href = '/login';
  };

  const getQueueStatusColor = (status) => {
    switch(status) {
      case 'waiting': return '#ffa500';
      case 'ready': return '#4caf50';
      case 'in_interview': return '#2196f3';
      case 'delayed': return '#ff9800';
      case 'completed': return '#9e9e9e';
      default: return '#757575';
    }
  };

  const getEstimatedWaitTime = (position) => {
    if (!myQueues.length) return 'N/A';
    const queue = myQueues.find(q => q.position_id === position.id);
    if (!queue) return 'Not in queue';
    return queue.estimated_wait_time || 'Calculating...';
  };

  return (
    <div className="candidate-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Candidate Dashboard</h1>
            <span className="welcome-text">Welcome, {user?.name || 'Candidate'} ({user?.account})</span>
          </div>
          <div className="header-right">
            <button className="profile-btn">
              👤 {user?.account}
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}

      {activityStatus && !activityStatus.can_join_queue && (
        <div className="activity-status-banner">
          {!activityStatus.is_started ? (
            <div className="countdown-banner">
              <h3>🕒 Activity will start in {timeLeft || 'calculating...'}</h3>
              <p>Queue joining will be available once the activity starts</p>
            </div>
          ) : activityStatus.is_ended ? (
            <div className="ended-banner">
              <h3>⏰ Activity has ended</h3>
              <p>Queue joining is no longer available</p>
            </div>
          ) : (
            <div className="inactive-banner">
              <h3>⚠️ Activity is currently inactive</h3>
              <p>Please wait for the administrator to activate the interview system</p>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          📋 Available Positions
        </button>
        <button
          className={`tab-btn ${activeTab === 'queues' ? 'active' : ''}`}
          onClick={() => setActiveTab('queues')}
        >
          ⏱️ My Queues ({myQueues.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 My Profile
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'positions' && (
          <div className="positions-section">
            <h2>Available Positions</h2>
            <div className="positions-grid">
              {positions.map(position => (
                <div key={position.id} className="position-card">
                  <div className="position-header">
                    <h3>{position.title}</h3>
                    <span className="company-badge">
                      {position.company_name || 'Company'}
                    </span>
                  </div>
                  <div className="position-details">
                    <p className="description">{position.description}</p>
                    <div className="position-meta">
                      <span>📍 {position.location || 'Remote'}</span>
                      <span>💼 {position.type || 'Full-time'}</span>
                      <span>👥 {position.candidates_in_queue || 0} in queue</span>
                    </div>
                    <div className="position-stats">
                      <div className="stat">
                        <span className="stat-label">Wait Time:</span>
                        <span className="stat-value">{getEstimatedWaitTime(position)}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Interviewers:</span>
                        <span className="stat-value">{position.available_interviewers || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="position-actions">
                    {myQueues.some(q => q.position_id === position.id) ? (
                      <button className="in-queue-btn" disabled>
                        ✓ In Queue
                      </button>
                    ) : (
                      <button
                        className="join-queue-btn"
                        onClick={() => joinQueue(position.id)}
                        disabled={loading || (activityStatus && !activityStatus.can_join_queue)}
                        title={activityStatus && !activityStatus.can_join_queue ?
                          (!activityStatus.is_started ? `Activity starts in ${timeLeft || 'calculating...'}` :
                           activityStatus.is_ended ? 'Activity has ended' : 'Activity not active') : ''}
                      >
                        {activityStatus && !activityStatus.can_join_queue ?
                          (!activityStatus.is_started ? `Starts in ${timeLeft || '...'}` : 'Unavailable') :
                          'Join Queue'}
                      </button>
                    )}
                    <button
                      className="details-btn"
                      onClick={() => setSelectedPosition(position)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'queues' && (
          <div className="queues-section">
            <h2>My Interview Queues</h2>

            {/* Display queue optimization suggestion if available */}
            {queueOptimization && (
              <div className="optimization-alert" style={{
                backgroundColor: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h3 style={{ color: '#1565c0', marginTop: 0 }}>
                  🚀 Queue Optimization Available!
                </h3>
                <p style={{ color: '#1565c0', marginBottom: '10px' }}>
                  {queueOptimization.message}
                </p>
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ color: '#1565c0' }}>Current Plan:</strong>
                    <ul style={{ marginTop: '5px', marginBottom: '10px' }}>
                      <li>⭐ {queueOptimization.priority_position.name}: {queueOptimization.priority_position.wait_time} minutes wait</li>
                      <li>{queueOptimization.regular_position.name}: Would wait {queueOptimization.regular_position.wait_time + queueOptimization.priority_position.wait_time + 8 + 5} minutes</li>
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: '#1565c0' }}>Optimized Plan:</strong>
                    <ul style={{ marginTop: '5px' }}>
                      <li>{queueOptimization.regular_position.name}: {queueOptimization.regular_position.wait_time} minutes wait (do this first)</li>
                      <li>⭐ {queueOptimization.priority_position.name}: {queueOptimization.priority_position.wait_time} minutes wait (no change)</li>
                    </ul>
                  </div>
                  <p style={{ color: '#1565c0', marginTop: '10px', fontWeight: 'bold' }}>
                    ⏰ Time Saved: {queueOptimization.time_saved} minutes!
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={applyQueueOptimization}
                    style={{
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                    disabled={loading}
                  >
                    Accept Optimization
                  </button>
                  <button
                    onClick={() => {
                      setQueueOptimization(null);
                      // After rejecting optimization, check for conflicts
                      checkConflicts();
                    }}
                    style={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Keep Current Order
                  </button>
                </div>
              </div>
            )}

            {/* Display conflict messages if any */}
            {conflictMessages.length > 0 && (
              <div className="conflict-alert" style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h3 style={{ color: '#856404', marginTop: 0 }}>
                  ⚠️ Time Conflicts Detected and Resolved
                </h3>
                <p style={{ color: '#856404', marginBottom: '10px' }}>
                  Your interview times have been automatically adjusted to avoid conflicts:
                </p>
                <ul style={{ color: '#856404', marginBottom: 0 }}>
                  {conflictMessages.map((msg, index) => (
                    <li key={index} style={{ marginBottom: '5px' }}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {myQueues.length === 0 ? (
              <div className="empty-state">
                <p>You are not in any interview queues</p>
                <button
                  className="browse-btn"
                  onClick={() => setActiveTab('positions')}
                >
                  Browse Positions
                </button>
              </div>
            ) : (
              <div className="queues-list">
                {myQueues.map(queue => (
                  <div key={queue.id || Math.random()} className="queue-card">
                    <div className="queue-header">
                      <div>
                        <h3>{queue.position?.name || queue.position_title || 'Position'}</h3>
                        {queue.position?.company?.name && (
                          <span className="company-badge">{queue.position.company.name}</span>
                        )}
                      </div>
                      <span
                        className="queue-status"
                        style={{ backgroundColor: getQueueStatusColor(queue.status) }}
                      >
                        {queue.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="queue-info">
                      <div className="info-row">
                        <span>Position in Queue:</span>
                        <strong>#{queue.queue_position || queue.position_in_queue || 'N/A'}</strong>
                      </div>
                      <div className="info-row">
                        <span>Estimated Wait:</span>
                        <strong>{queue.estimated_wait_time !== undefined && queue.estimated_wait_time !== null ? `${queue.estimated_wait_time} minutes` : 'Calculating...'}</strong>
                      </div>
                      <div className="info-row">
                        <span>Joined At:</span>
                        <strong>{queue.joined_at ? new Date(queue.joined_at).toLocaleString() : 'N/A'}</strong>
                      </div>
                      {queue.priority_expires_at && (
                        <div className="info-row priority">
                          <span>⭐ Priority Until:</span>
                          <strong>{new Date(queue.priority_expires_at).toLocaleTimeString()}</strong>
                        </div>
                      )}
                    </div>
                    <div className="queue-actions">
                      {queue.status === 'waiting' && (
                        <>
                          <button
                            className="priority-btn"
                            onClick={() => requestPriority(queue.id, queue.position?.id || queue.position_id)}
                            disabled={loading || queue.is_priority || queue.is_high_priority}
                          >
                            {(queue.is_priority || queue.is_high_priority) ? '⭐ Priority Active' : '🚀 Request Priority'}
                          </button>
                          <button
                            className="delay-btn"
                            onClick={() => requestDelay(10)}
                            disabled={loading}
                          >
                            ⏰ Delay 10 min
                          </button>
                        </>
                      )}
                      {queue.status === 'ready' && (
                        <div className="ready-notice">
                          🎯 Your turn! Please join the interview room.
                        </div>
                      )}
                      <button
                        className="leave-btn"
                        onClick={() => leaveQueue(queue.position?.id || queue.position_id)}
                        disabled={loading || queue.status === 'in_interview'}
                      >
                        Leave Queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-section">
            <h2>My Profile</h2>
            <div className="profile-card">
              <div className="profile-avatar">
                <div className="avatar-circle">
                  {user?.name?.charAt(0).toUpperCase() || 'C'}
                </div>
              </div>
              <div className="profile-info">
                <div className="info-group">
                  <label>Name</label>
                  <p>{user?.name || 'N/A'}</p>
                </div>
                <div className="info-group">
                  <label>Account</label>
                  <p>{user?.account || 'N/A'}</p>
                </div>
                <div className="info-group">
                  <label>Email</label>
                  <p>{user?.email || 'Not provided'}</p>
                </div>
                <div className="info-group">
                  <label>Phone</label>
                  <p>{user?.phone || 'Not provided'}</p>
                </div>
                <div className="info-group">
                  <label>Role</label>
                  <p className="role-badge">Candidate</p>
                </div>
              </div>
              <div className="profile-stats">
                <h3>Interview Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-number">{myQueues.length}</span>
                    <span className="stat-label">Active Queues</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Interviews Completed</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Average Wait Time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedPosition && (
        <div className="modal-overlay" onClick={() => setSelectedPosition(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPosition.title}</h2>
              <button
                className="close-btn"
                onClick={() => setSelectedPosition(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Description</h4>
                <p>{selectedPosition.description || 'No description available'}</p>
              </div>
              <div className="detail-section">
                <h4>Requirements</h4>
                <p>{selectedPosition.requirements || 'No specific requirements listed'}</p>
              </div>
              <div className="detail-section">
                <h4>Interview Details</h4>
                <ul>
                  <li>Duration: {selectedPosition.interview_duration || '30'} minutes</li>
                  <li>Type: {selectedPosition.interview_type || 'Technical'}</li>
                  <li>Current Queue Size: {selectedPosition.candidates_in_queue || 0}</li>
                  <li>Available Interviewers: {selectedPosition.available_interviewers || 0}</li>
                </ul>
              </div>
              <div className="modal-actions">
                {myQueues.some(q => q.position_id === selectedPosition.id) ? (
                  <button className="in-queue-btn" disabled>
                    Already in Queue
                  </button>
                ) : (
                  <button
                    className="join-queue-btn"
                    onClick={() => {
                      joinQueue(selectedPosition.id);
                      setSelectedPosition(null);
                    }}
                    disabled={loading}
                  >
                    Join Queue for This Position
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateDashboard;