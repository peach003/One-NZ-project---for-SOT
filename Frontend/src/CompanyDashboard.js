import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CompanyDashboard.css';

function CompanyDashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [positions, setPositions] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({
    totalPositions: 0,
    activeInterviews: 0,
    totalCandidates: 0,
    averageWaitTime: 0
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    fetchCompanyData();

    const interval = setInterval(() => {
      fetchCompanyStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchCompanyData = async () => {
    await Promise.all([
      fetchPositions(),
      fetchInterviewers(),
      fetchCandidates(),
      fetchCompanyStats()
    ]);
  };

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/company/positions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPositions(response.data.positions || []);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      setPositions([]);
    }
  };

  const fetchInterviewers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/company/interviewers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInterviewers(response.data.interviewers || []);
    } catch (error) {
      console.error('Failed to fetch interviewers:', error);
      setInterviewers([]);
    }
  };

  const fetchCandidates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/company/candidates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCandidates(response.data.candidates || []);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      setCandidates([]);
    }
  };

  const fetchCompanyStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/company/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data || {
        totalPositions: 0,
        activeInterviews: 0,
        totalCandidates: 0,
        averageWaitTime: 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreatePosition = async (formData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const companyId = user?.company_id || user?.company?.id || 1;

      const payload = {
        name: formData.title,
        company_id: companyId,
        description: formData.description || '',
      };

      await axios.post('http://www.bon.cc:8080/api/company/positions', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotification('Position created successfully!');
      setShowModal(false);
      fetchPositions();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Error creating position:', error.response?.data);
      setNotification(error.response?.data?.error || 'Failed to create position');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePosition = async (id, formData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: formData.title,
        description: formData.description || '',
      };

      await axios.put(`http://www.bon.cc:8080/api/company/positions/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotification('Position updated successfully!');
      setShowModal(false);
      setEditItem(null);
      fetchPositions();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Error updating position:', error.response?.data);
      setNotification(error.response?.data?.error || 'Failed to update position');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (id) => {
    if (!window.confirm('Are you sure you want to delete this position?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://www.bon.cc:8080/api/company/positions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotification('Position deleted successfully!');
      fetchPositions();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to delete position');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInterviewer = async (formData) => {
    setLoading(true);
    try {
      const companyId = user?.company_id || user?.company?.id || 1;

      const payload = {
        account: formData.account,
        password: formData.password,
        name: formData.name,
        email: formData.email || '',
        phone: formData.phone || '',
        employee_id: formData.employee_id || '',
        role: 'interviewer',
        company_id: companyId
      };

      // Use register endpoint to create interviewer account
      await axios.post('http://www.bon.cc:8080/api/register', payload);

      setNotification('Interviewer added successfully!');
      setShowModal(false);
      fetchInterviewers();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Error creating interviewer:', error.response?.data);
      setNotification(error.response?.data?.error || 'Failed to add interviewer');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignInterviewer = async (positionId, interviewerId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://www.bon.cc:8080/api/company/positions/${positionId}/assign`,
        { interviewer_id: interviewerId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNotification('Interviewer assigned successfully!');
      fetchPositions();
      fetchInterviewers();
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      setNotification('Failed to assign interviewer');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setModalType('');
  };

  return (
    <div className="company-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🏢 Company Admin Dashboard</h1>
            <span className="welcome-text">Welcome, {user?.name || 'Admin'}</span>
          </div>
          <div className="header-right">
            <span className="company-name">{user?.company?.name || 'Company'}</span>
            <button className="profile-btn">👤 {user?.account}</button>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {notification && (
        <div className="notification">{notification}</div>
      )}

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          💼 Positions ({positions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'interviewers' ? 'active' : ''}`}
          onClick={() => setActiveTab('interviewers')}
        >
          👔 Interviewers ({interviewers.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          👥 Candidates ({candidates.length})
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Company Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💼</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.totalPositions || positions.length}</span>
                  <span className="stat-label">Total Positions</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.activeInterviews || 0}</span>
                  <span className="stat-label">Active Interviews</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.totalCandidates || candidates.length}</span>
                  <span className="stat-label">Total Candidates</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.averageWaitTime || 0} min</span>
                  <span className="stat-label">Avg Wait Time</span>
                </div>
              </div>
            </div>

            <div className="recent-activities">
              <h3>Recent Activities</h3>
              <div className="activities-list">
                <div className="activity-item">
                  <span className="activity-icon">🆕</span>
                  <div className="activity-details">
                    <p>New candidate joined queue for Senior Developer</p>
                    <span className="activity-time">5 minutes ago</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">✅</span>
                  <div className="activity-details">
                    <p>Interview completed for Product Manager position</p>
                    <span className="activity-time">15 minutes ago</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">👔</span>
                  <div className="activity-details">
                    <p>John Doe started interview session</p>
                    <span className="activity-time">30 minutes ago</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <button
                  className="action-btn"
                  onClick={() => openModal('position')}
                >
                  ➕ Create Position
                </button>
                <button
                  className="action-btn"
                  onClick={() => openModal('interviewer')}
                >
                  👤 Add Interviewer
                </button>
                <button
                  className="action-btn"
                  onClick={() => setActiveTab('candidates')}
                >
                  📋 View Candidates
                </button>
                <button
                  className="action-btn"
                  onClick={fetchCompanyStats}
                >
                  🔄 Refresh Stats
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="positions-section">
            <div className="section-header">
              <h2>Position Management</h2>
              <button
                className="create-btn"
                onClick={() => openModal('position')}
              >
                ➕ Create New Position
              </button>
            </div>

            <div className="positions-grid">
              {positions.map(position => (
                <div key={position.id} className="position-card">
                  <div className="position-header">
                    <h3>{position.name || position.title}</h3>
                    <div className="position-status">
                      {position.is_active ? (
                        <span className="status-badge active">Active</span>
                      ) : (
                        <span className="status-badge inactive">Inactive</span>
                      )}
                    </div>
                  </div>

                  <div className="position-details">
                    <p className="description">{position.description}</p>
                    <div className="position-meta">
                      <div className="meta-item">
                        <span className="meta-label">Location:</span>
                        <span className="meta-value">{position.location || 'Remote'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Type:</span>
                        <span className="meta-value">{position.type || 'Full-time'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Candidates:</span>
                        <span className="meta-value">{position.candidates_count || 0}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Interviewers:</span>
                        <span className="meta-value">{position.interviewers_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="assigned-interviewers">
                    <h4>Assigned Interviewers</h4>
                    {position.interviewers?.length > 0 ? (
                      <div className="interviewer-list">
                        {position.interviewers.map(interviewer => (
                          <span key={interviewer.id} className="interviewer-tag">
                            {interviewer.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-interviewers">No interviewers assigned</p>
                    )}
                  </div>

                  <div className="position-actions">
                    <button
                      className="edit-btn"
                      onClick={() => openModal('position', position)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="assign-btn"
                      onClick={() => openModal('assign', position)}
                    >
                      👤 Assign
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeletePosition(position.id)}
                      disabled={loading}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'interviewers' && (
          <div className="interviewers-section">
            <div className="section-header">
              <h2>Interviewer Management</h2>
              <button
                className="create-btn"
                onClick={() => openModal('interviewer')}
              >
                ➕ Add New Interviewer
              </button>
            </div>

            <div className="interviewers-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Assigned Positions</th>
                    <th>Current Interview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewers.map(interviewer => (
                    <tr key={interviewer.id}>
                      <td>
                        <div className="interviewer-info">
                          <div className="avatar">
                            {interviewer.name?.charAt(0).toUpperCase()}
                          </div>
                          <span>{interviewer.name}</span>
                        </div>
                      </td>
                      <td>{interviewer.email || 'N/A'}</td>
                      <td>{interviewer.phone || 'N/A'}</td>
                      <td>
                        {interviewer.is_available ? (
                          <span className="status-badge available">Available</span>
                        ) : (
                          <span className="status-badge busy">Busy</span>
                        )}
                      </td>
                      <td>
                        <div className="positions-list">
                          {(() => {
                            const assignedPosition = positions.find(pos =>
                              pos.interviewers?.some(i => i.id === interviewer.id)
                            );
                            return assignedPosition ? (
                              <span className="position-tag">
                                {assignedPosition.name || assignedPosition.title}
                              </span>
                            ) : (
                              <span className="no-position">Not assigned</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td>
                        {interviewer.current_interview ? (
                          <span className="interview-active">In Session</span>
                        ) : (
                          <span className="interview-idle">Idle</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn-small edit"
                            onClick={() => openModal('interviewer', interviewer)}
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn-small view"
                            onClick={() => openModal('interviewer-detail', interviewer)}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="candidates-section">
            <div className="section-header">
              <h2>Candidate Tracking</h2>
              <div className="filter-controls">
                <select className="filter-select">
                  <option value="all">All Candidates</option>
                  <option value="waiting">Waiting</option>
                  <option value="interviewed">Interviewed</option>
                  <option value="pending">Pending</option>
                </select>
                <input
                  type="search"
                  placeholder="Search candidates..."
                  className="search-input"
                />
              </div>
            </div>

            <div className="candidates-table">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position Applied</th>
                    <th>Queue Status</th>
                    <th>Wait Time</th>
                    <th>Priority</th>
                    <th>Interview Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => (
                    <tr key={candidate.id}>
                      <td>
                        <div className="candidate-info">
                          <div className="avatar">
                            {candidate.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="name">{candidate.name}</span>
                            <span className="email">{candidate.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{candidate.position_title || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${candidate.queue_status}`}>
                          {candidate.queue_status || 'Not in Queue'}
                        </span>
                      </td>
                      <td>{candidate.wait_time || '0'} min</td>
                      <td>
                        {candidate.is_priority ? (
                          <span className="priority-badge">⭐ Priority</span>
                        ) : (
                          <span className="normal-badge">Normal</span>
                        )}
                      </td>
                      <td>{candidate.interview_time || 'Not scheduled'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn-small view"
                            onClick={() => openModal('candidate-detail', candidate)}
                          >
                            View
                          </button>
                          <button className="action-btn-small contact">
                            Contact
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalType === 'position' && (editItem ? 'Edit Position' : 'Create New Position')}
                {modalType === 'interviewer' && (editItem ? 'Edit Interviewer' : 'Add New Interviewer')}
                {modalType === 'assign' && 'Assign Interviewer to Position'}
                {modalType === 'interviewer-detail' && 'Interviewer Details'}
                {modalType === 'candidate-detail' && 'Candidate Details'}
              </h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              {modalType === 'position' && (
                <PositionForm
                  position={editItem}
                  onSubmit={editItem ?
                    (data) => handleUpdatePosition(editItem.id, data) :
                    handleCreatePosition
                  }
                  onCancel={closeModal}
                  loading={loading}
                />
              )}

              {modalType === 'interviewer' && (
                <InterviewerForm
                  interviewer={editItem}
                  onSubmit={handleCreateInterviewer}
                  onCancel={closeModal}
                  loading={loading}
                />
              )}

              {modalType === 'assign' && (
                <AssignInterviewerForm
                  position={editItem}
                  interviewers={interviewers}
                  positions={positions}
                  onSubmit={(interviewerId) => {
                    handleAssignInterviewer(editItem.id, interviewerId);
                    closeModal();
                  }}
                  onCancel={closeModal}
                  loading={loading}
                />
              )}

              {modalType === 'interviewer-detail' && (
                <InterviewerDetail interviewer={editItem} />
              )}

              {modalType === 'candidate-detail' && (
                <CandidateDetail candidate={editItem} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PositionForm({ position, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    title: position?.name || position?.title || '',
    description: position?.description || '',
    requirements: position?.requirements || '',
    location: position?.location || '',
    type: position?.type || 'Full-time',
    interview_duration: position?.interview_duration || 30,
    is_active: position?.is_active !== undefined ? position.is_active : true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <div className="form-group">
        <label>Position Title*</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
        />
      </div>

      <div className="form-group">
        <label>Description*</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows="4"
          required
        />
      </div>

      <div className="form-group">
        <label>Requirements</label>
        <textarea
          value={formData.requirements}
          onChange={(e) => setFormData({...formData, requirements: e.target.value})}
          rows="3"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            placeholder="e.g., Remote, New York"
          />
        </div>

        <div className="form-group">
          <label>Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
          >
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Interview Duration (minutes)</label>
          <input
            type="number"
            value={formData.interview_duration}
            onChange={(e) => setFormData({...formData, interview_duration: parseInt(e.target.value)})}
            min="15"
            max="120"
          />
        </div>

        <div className="form-group">
          <label>Status</label>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            />
            <label htmlFor="is_active">Active</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Saving...' : (position ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  );
}

function InterviewerForm({ interviewer, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: interviewer?.name || '',
    email: interviewer?.email || '',
    phone: interviewer?.phone || '',
    account: interviewer?.account || '',
    password: '',
    employee_id: interviewer?.employee_id || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <div className="form-group">
        <label>Name*</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>

      <div className="form-group">
        <label>Account Username*</label>
        <input
          type="text"
          value={formData.account}
          onChange={(e) => setFormData({...formData, account: e.target.value})}
          required
        />
      </div>

      {!interviewer && (
        <div className="form-group">
          <label>Password*</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required={!interviewer}
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Employee ID</label>
        <input
          type="text"
          value={formData.employee_id}
          onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Saving...' : (interviewer ? 'Update' : 'Add Interviewer')}
        </button>
      </div>
    </form>
  );
}

function AssignInterviewerForm({ position, interviewers, positions, onSubmit, onCancel, loading }) {
  const [selectedInterviewer, setSelectedInterviewer] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  // Get interviewers that are not already assigned to this position
  const availableInterviewers = interviewers.filter(
    i => !position.interviewers?.some(pi => pi.id === i.id)
  );

  // Check which position each interviewer is currently assigned to
  const getInterviewerCurrentPosition = (interviewerId) => {
    for (const pos of positions) {
      if (pos.interviewers?.some(i => i.id === interviewerId)) {
        return pos.name || pos.title;
      }
    }
    return null;
  };

  const handleInterviewerChange = (e) => {
    const interviewerId = parseInt(e.target.value);
    setSelectedInterviewer(interviewerId);

    // Check if interviewer is already assigned to another position
    const currentPosition = getInterviewerCurrentPosition(interviewerId);
    if (currentPosition && currentPosition !== (position.name || position.title)) {
      setWarningMessage(`Warning: This interviewer is currently assigned to "${currentPosition}". They will be reassigned to this position.`);
    } else {
      setWarningMessage('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedInterviewer) {
      onSubmit(selectedInterviewer);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <div className="form-info">
        <p>Assign an interviewer to: <strong>{position.name || position.title}</strong></p>
      </div>

      <div className="form-group">
        <label>Select Interviewer*</label>
        <select
          value={selectedInterviewer}
          onChange={handleInterviewerChange}
          required
        >
          <option value="">-- Select Interviewer --</option>
          {availableInterviewers.map(interviewer => {
            const currentPos = getInterviewerCurrentPosition(interviewer.id);
            return (
              <option key={interviewer.id} value={interviewer.id}>
                {interviewer.name}
                {currentPos ? ` (Currently: ${currentPos})` : ' (Available)'}
              </option>
            );
          })}
        </select>
      </div>

      {warningMessage && (
        <div className="warning-message">
          ⚠️ {warningMessage}
        </div>
      )}

      <div className="info-note">
        ℹ️ Note: Each interviewer can only be assigned to one position at a time.
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={loading || !selectedInterviewer}>
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </form>
  );
}

function InterviewerDetail({ interviewer }) {
  return (
    <div className="detail-view">
      <div className="detail-section">
        <h3>Personal Information</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Name:</label>
            <span>{interviewer.name}</span>
          </div>
          <div className="detail-item">
            <label>Email:</label>
            <span>{interviewer.email || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <label>Phone:</label>
            <span>{interviewer.phone || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <label>Employee ID:</label>
            <span>{interviewer.employee_id || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h3>Interview Statistics</h3>
        <div className="stats-mini-grid">
          <div className="stat-mini">
            <span className="stat-value">{interviewer.total_interviews || 0}</span>
            <span className="stat-label">Total Interviews</span>
          </div>
          <div className="stat-mini">
            <span className="stat-value">{interviewer.today_interviews || 0}</span>
            <span className="stat-label">Today's Interviews</span>
          </div>
          <div className="stat-mini">
            <span className="stat-value">{interviewer.avg_duration || 0} min</span>
            <span className="stat-label">Avg Duration</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateDetail({ candidate }) {
  return (
    <div className="detail-view">
      <div className="detail-section">
        <h3>Candidate Information</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Name:</label>
            <span>{candidate.name}</span>
          </div>
          <div className="detail-item">
            <label>Email:</label>
            <span>{candidate.email || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <label>Phone:</label>
            <span>{candidate.phone || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <label>Applied Position:</label>
            <span>{candidate.position_title || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h3>Queue Information</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Queue Status:</label>
            <span className={`status-badge ${candidate.queue_status}`}>
              {candidate.queue_status || 'Not in Queue'}
            </span>
          </div>
          <div className="detail-item">
            <label>Position in Queue:</label>
            <span>{candidate.queue_position || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <label>Wait Time:</label>
            <span>{candidate.wait_time || 0} minutes</span>
          </div>
          <div className="detail-item">
            <label>Priority Status:</label>
            <span>{candidate.is_priority ? '⭐ Priority' : 'Normal'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyDashboard;