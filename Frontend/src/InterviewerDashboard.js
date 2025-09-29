import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InterviewerDashboard.css';

function InterviewerDashboard() {
  const [user, setUser] = useState(null);
  const [assignedPosition, setAssignedPosition] = useState(null);
  const [currentInterview, setCurrentInterview] = useState(null);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [stats, setStats] = useState({
    todayCompleted: 0,
    averageDuration: 0,
    currentWaiting: 0
  });
  const [interviewerStatus, setInterviewerStatus] = useState('available');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  const [interviewTimer, setInterviewTimer] = useState(0);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchInterviewerData();

    const interval = setInterval(() => {
      fetchWaitingQueue();
      fetchCurrentInterview();
      if (currentInterview) {
        setInterviewTimer(prev => prev + 1);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentInterview]);

  const fetchInterviewerData = async () => {
    await Promise.all([
      fetchAssignedPosition(),
      fetchWaitingQueue(),
      fetchCurrentInterview(),
      fetchInterviewerStats()
    ]);
  };

  const fetchAssignedPosition = async () => {
    try {
      const token = localStorage.getItem('token');
      // For now, we'll simulate an assigned position since the endpoint may not be implemented
      // In production, this should fetch from the actual endpoint
      const mockPosition = {
        id: 1,
        name: 'Product Manager',
        company_name: 'Tech Company'
      };
      setAssignedPosition(mockPosition);

      // Uncomment when backend endpoint is ready:
      // const response = await axios.get('http://www.bon.cc:8080/api/interviewer/position', {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      // setAssignedPosition(response.data.position);
    } catch (error) {
      console.error('Failed to fetch assigned position:', error);
      // Set a default position for testing
      setAssignedPosition({
        id: 1,
        name: 'Default Position',
        company_name: 'Company'
      });
    }
  };

  const fetchWaitingQueue = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch real queue data from backend
      const response = await axios.get('http://www.bon.cc:8080/api/interviewer/queue', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Process the queue data
      const queueData = response.data.queue || [];

      // Map the backend data to match frontend expectations
      const mappedQueue = queueData.map(entry => ({
        id: entry.id,
        candidate_id: entry.candidate_id || entry.candidate?.id,
        candidate_name: entry.candidate?.name || entry.candidate_name || 'Unknown',
        employee_id: entry.candidate?.account || entry.employee_id || 'N/A',
        position_id: entry.position_id || entry.position?.id,
        position_name: entry.position?.name || entry.position_name || 'Position',
        is_high_priority: entry.is_high_priority || false,
        wait_time: entry.estimated_wait_time || 0,
        jump_ahead: entry.jump_ahead_allowed || false,
        status: entry.status,
        join_time: entry.join_time
      }));

      setWaitingQueue(mappedQueue);
      setStats(prev => ({ ...prev, currentWaiting: mappedQueue.length }));
    } catch (error) {
      console.error('Failed to fetch queue:', error);

      // If there's an error (e.g., no assigned position), show empty queue
      if (error.response?.status === 404 || error.response?.status === 400) {
        setWaitingQueue([]);
        setStats(prev => ({ ...prev, currentWaiting: 0 }));
      } else {
        setWaitingQueue([]);
      }
    }
  };

  const fetchCurrentInterview = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/interviewer/interview/current', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.interview) {
        setCurrentInterview(response.data.interview);
        setInterviewerStatus('interviewing');
      } else {
        setCurrentInterview(null);
        setInterviewerStatus('available');
        setInterviewTimer(0);
      }
    } catch (error) {
      console.error('Failed to fetch current interview:', error);
    }
  };

  const fetchInterviewerStats = async () => {
    try {
      const token = localStorage.getItem('token');

      // Mock stats for demonstration
      const mockStats = {
        todayCompleted: 9,
        averageDuration: 8.5,
        currentWaiting: waitingQueue.length || 4
      };

      setStats(mockStats);

      // Uncomment when backend is ready:
      // const response = await axios.get('http://www.bon.cc:8080/api/interviewer/stats', {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      // setStats(response.data.stats || {
      //   todayCompleted: 0,
      //   averageDuration: 0,
      //   currentWaiting: waitingQueue.length
      // });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({
        todayCompleted: 0,
        averageDuration: 0,
        currentWaiting: 0
      });
    }
  };

  const startNextInterview = async () => {
    if (waitingQueue.length === 0) {
      setNotification('No candidates in queue');
      setTimeout(() => setNotification(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const nextCandidate = waitingQueue[0];
      // Use position_id from the queue entry - must exist
      const positionId = nextCandidate.position_id || nextCandidate.position?.id || assignedPosition?.id;

      if (!positionId) {
        setNotification('Error: No position assigned to this candidate');
        setTimeout(() => setNotification(''), 3000);
        setLoading(false);
        return;
      }

      await axios.post('http://www.bon.cc:8080/api/interviewer/interview/start',
        {
          candidate_id: nextCandidate.candidate_id || nextCandidate.id,
          position_id: positionId
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification(`Started interview with ${nextCandidate.candidate_name || 'Candidate'}`);
      fetchCurrentInterview();
      fetchWaitingQueue();
      setInterviewTimer(0);
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Failed to start interview:', error.response?.data);
      setNotification(error.response?.data?.error || 'Failed to start interview');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const endCurrentInterview = async () => {
    if (!currentInterview) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://www.bon.cc:8080/api/interviewer/interview/end',
        { interview_id: currentInterview.id },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Interview ended successfully');
      setCurrentInterview(null);
      setInterviewerStatus('available');
      fetchWaitingQueue();
      fetchInterviewerStats();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to end interview');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const extendInterview = async (minutes = 5) => {
    if (!currentInterview) return;

    setNotification(`Extended interview by ${minutes} minutes`);
    setTimeout(() => setNotification(''), 3000);
  };

  const markException = async () => {
    if (!currentInterview) return;

    setNotification('Marked as exception - ending interview');
    await endCurrentInterview();
  };

  const pauseReceiving = () => {
    setInterviewerStatus('paused');
    setNotification('Paused receiving new interviews');
    setTimeout(() => setNotification(''), 3000);
  };

  const resumeReceiving = () => {
    setInterviewerStatus('available');
    setNotification('Resumed receiving interviews');
    setTimeout(() => setNotification(''), 3000);
  };

  const initiateGroupInterview = async () => {
    if (!assignedPosition?.id) {
      setNotification('No position assigned. Cannot initiate group interview.');
      setTimeout(() => setNotification(''), 3000);
      return;
    }

    setShowGroupModal(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        position_id: assignedPosition.id || 1,
        max_participants: 4
      };

      await axios.post('http://www.bon.cc:8080/api/interviewer/group/initiate',
        payload,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Group interview invitations sent!');
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Group interview error:', error.response?.data);
      setNotification(error.response?.data?.error || 'Failed to initiate group interview');
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQueuePriorityIcon = (candidate) => {
    if (candidate.is_high_priority) return '🔥';
    if (candidate.jump_ahead) return '⚡';
    return '📝';
  };

  const getQueuePriorityLabel = (candidate) => {
    if (candidate.is_high_priority) return '【High Priority】';
    if (candidate.jump_ahead) return '【Jump Ahead】';
    return '【Regular】';
  };

  return (
    <div className="interviewer-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>👔 Interviewer Dashboard</h1>
            <span className="welcome-text">Welcome, {user?.name || 'Interviewer'}</span>
          </div>
          <div className="header-right">
            <div className="status-indicator">
              <span className={`status-dot ${interviewerStatus}`}></span>
              <span className="status-text">
                {interviewerStatus === 'interviewing' ? 'Interviewing' :
                 interviewerStatus === 'paused' ? 'Paused' : 'Available'}
              </span>
            </div>
            <button className="profile-btn">👤 {user?.account}</button>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {notification && (
        <div className="notification">{notification}</div>
      )}

      <div className="position-confirmation">
        {assignedPosition ? (
          <div className="position-info">
            <h2>📋 Assigned Position: {assignedPosition.name || assignedPosition.title}</h2>
            <span className="company-name">{assignedPosition.company_name || 'Company'}</span>
          </div>
        ) : (
          <div className="no-position">
            <h2>⚠️ No Position Assigned</h2>
            <p>Please contact your administrator to assign you to a position.</p>
          </div>
        )}
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          📋 Interview Queue ({waitingQueue.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`tab-btn ${activeTab === 'group' ? 'active' : ''}`}
          onClick={() => setActiveTab('group')}
        >
          🎯 Group Interview
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'queue' && (
          <div className="queue-section">
            {currentInterview && (
              <div className="current-interview-card">
                <div className="interview-status">
                  <span className="status-icon">🟢</span>
                  <h3>Currently Interviewing</h3>
                </div>
                <div className="interview-details">
                  <div className="candidate-info">
                    <h4>{currentInterview.candidate_name}</h4>
                    <span className="employee-id">Employee ID: {currentInterview.employee_id || 'N/A'}</span>
                  </div>
                  <div className="interview-meta">
                    <div className="meta-item">
                      <span className="label">Position:</span>
                      <span className="value">{currentInterview.position_name || assignedPosition?.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="label">Start Time:</span>
                      <span className="value">{new Date(currentInterview.start_time).toLocaleTimeString()}</span>
                    </div>
                    <div className="meta-item">
                      <span className="label">Duration:</span>
                      <span className="value timer">{formatDuration(interviewTimer)} minutes</span>
                    </div>
                  </div>
                </div>
                <div className="interview-actions">
                  <button
                    className="end-btn"
                    onClick={endCurrentInterview}
                    disabled={loading}
                  >
                    End Interview
                  </button>
                  <button
                    className="exception-btn"
                    onClick={markException}
                    disabled={loading}
                  >
                    Mark Exception
                  </button>
                  <button
                    className="extend-btn"
                    onClick={() => extendInterview(5)}
                    disabled={loading}
                  >
                    Extend 5 min
                  </button>
                </div>
              </div>
            )}

            <div className="waiting-queue">
              <div className="queue-header">
                <h3>📋 Waiting Queue ({waitingQueue.length} people total)</h3>
                {!currentInterview && waitingQueue.length > 0 && (
                  <button
                    className="start-next-btn"
                    onClick={startNextInterview}
                    disabled={loading || interviewerStatus === 'paused'}
                  >
                    Start Next Interview
                  </button>
                )}
              </div>

              {waitingQueue.length === 0 ? (
                <div className="empty-queue">
                  <p>No candidates waiting in queue</p>
                </div>
              ) : (
                <div className="queue-list">
                  {waitingQueue.map((candidate, index) => (
                    <div key={candidate.id} className="queue-item">
                      <div className="queue-number">{index + 1}</div>
                      <div className="queue-candidate">
                        <div className="candidate-header">
                          <span className="priority-icon">{getQueuePriorityIcon(candidate)}</span>
                          <span className="candidate-name">{candidate.candidate_name}</span>
                          <span className="priority-label">{getQueuePriorityLabel(candidate)}</span>
                        </div>
                        <div className="candidate-meta">
                          {candidate.is_high_priority && (
                            <span className="meta-tag">Set time: {new Date(candidate.priority_set_time).toLocaleTimeString()}</span>
                          )}
                          {candidate.jump_ahead && (
                            <span className="meta-tag">Reason: Save {candidate.time_saved} minutes</span>
                          )}
                          <span className="meta-tag">Waiting: {candidate.wait_time || 0} minutes</span>
                        </div>
                      </div>
                      {index === 0 && !currentInterview && (
                        <button
                          className="call-btn"
                          onClick={startNextInterview}
                          disabled={loading || interviewerStatus === 'paused'}
                        >
                          Call Now
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="queue-controls">
                {interviewerStatus === 'available' ? (
                  <button className="pause-btn" onClick={pauseReceiving}>
                    ⏸️ Pause Receiving
                  </button>
                ) : interviewerStatus === 'paused' ? (
                  <button className="resume-btn" onClick={resumeReceiving}>
                    ▶️ Resume Receiving
                  </button>
                ) : null}
                <button className="end-work-btn" onClick={handleLogout}>
                  🚪 End Work
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <h2>Today's Performance Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.todayCompleted || 0}</span>
                  <span className="stat-label">Interviews Completed</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.averageDuration || 0} min</span>
                  <span className="stat-label">Average Duration</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.currentWaiting || 0}</span>
                  <span className="stat-label">Currently Waiting</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <span className="stat-value">
                    {stats.averageDuration && stats.averageDuration <= 8 ? 'Excellent' :
                     stats.averageDuration <= 10 ? 'Good' : 'Needs Improvement'}
                  </span>
                  <span className="stat-label">Performance Rating</span>
                </div>
              </div>
            </div>

            <div className="interview-history">
              <h3>Recent Interview History</h3>
              <div className="history-list">
                <div className="history-item">
                  <span className="time">14:45</span>
                  <span className="candidate">Zhang San - Product Manager</span>
                  <span className="duration">8 minutes</span>
                  <span className="status completed">Completed</span>
                </div>
                <div className="history-item">
                  <span className="time">14:30</span>
                  <span className="candidate">Li Si - Frontend Engineer</span>
                  <span className="duration">10 minutes</span>
                  <span className="status completed">Completed</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'group' && (
          <div className="group-section">
            <h2>Group Interview Management</h2>

            <div className="group-trigger-info">
              <div className="info-card">
                <h3>⏰ Group Interview Trigger Conditions</h3>
                <ul>
                  <li>Activity has less than 5 minutes remaining</li>
                  <li>Large number of candidates still waiting</li>
                  <li>Recommended to maximize interview completions</li>
                </ul>
              </div>
            </div>

            <div className="group-mode-selection">
              <h3>Choose Interview Mode</h3>
              <div className="mode-options">
                <div className="mode-card recommended">
                  <div className="mode-header">
                    <span className="mode-icon">🎯</span>
                    <h4>Group Interview Mode</h4>
                    <span className="recommended-badge">Recommended</span>
                  </div>
                  <ul className="mode-details">
                    <li>Send invitations to all waiting candidates</li>
                    <li>Maximum participants: 4 people</li>
                    <li>Expected completions: 10-12 interviews</li>
                  </ul>
                  <button
                    className="initiate-btn"
                    onClick={initiateGroupInterview}
                    disabled={loading}
                  >
                    Initiate Group Interview
                  </button>
                </div>

                <div className="mode-card">
                  <div className="mode-header">
                    <span className="mode-icon">👤</span>
                    <h4>Continue Individual Mode</h4>
                  </div>
                  <ul className="mode-details">
                    <li>Continue one-on-one interviews</li>
                    <li>Control each interview to 5 minutes</li>
                    <li>Expected completions: 2-3 interviews</li>
                  </ul>
                  <button
                    className="continue-btn"
                    onClick={() => setActiveTab('queue')}
                  >
                    Continue Individual Interviews
                  </button>
                </div>
              </div>
            </div>

            {showGroupModal && (
              <div className="group-progress">
                <h3>Group Interview Progress</h3>
                <div className="response-monitoring">
                  <div className="response-item">
                    <span className="candidate-name">Zhang San</span>
                    <span className="response-status accepted">✅ Accepted</span>
                  </div>
                  <div className="response-item">
                    <span className="candidate-name">Li Si</span>
                    <span className="response-status pending">⏳ Pending</span>
                  </div>
                  <div className="response-item">
                    <span className="candidate-name">Wang Wu</span>
                    <span className="response-status accepted">✅ Accepted</span>
                  </div>
                </div>
                <div className="group-actions">
                  <button className="start-group-btn">
                    Start Group Interview (2/4 confirmed)
                  </button>
                  <button className="cancel-group-btn" onClick={() => setShowGroupModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InterviewerDashboard;