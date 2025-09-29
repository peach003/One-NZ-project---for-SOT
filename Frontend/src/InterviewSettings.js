import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './InterviewSettings.css';

function InterviewSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({
    activeQueueLimit: 6,
    highPriorityQuota: 2,
    averageInterviewTime: 8,
    bufferTime: 5,
    groupInterviewMaxSize: 4,
    highPriorityTimeLimit: 30,
    activityStartTime: '09:00',
    activityEndTime: '17:00',
    isActivityActive: true,
    allowNewRegistrations: true,
    maxQueueLength: 100,
    autoCloseQueue: false
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSettings();
  }, [navigate]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://www.bon.cc:8080/api/admin/activity', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data) {
        // Handle direct data response
        const activityData = response.data;

        // Map snake_case to camelCase
        setSettings(prevSettings => ({
          ...prevSettings,
          activeQueueLimit: activityData.active_queue_limit || prevSettings.activeQueueLimit,
          highPriorityQuota: activityData.high_priority_quota || prevSettings.highPriorityQuota,
          averageInterviewTime: activityData.average_interview_time || prevSettings.averageInterviewTime,
          bufferTime: activityData.buffer_time || prevSettings.bufferTime,
          groupInterviewMaxSize: activityData.group_interview_max_size || prevSettings.groupInterviewMaxSize,
          status: activityData.status || 'active',
          isActivityActive: activityData.status === 'active',
          activityStartTime: activityData.activity_start_time || prevSettings.activityStartTime,
          activityEndTime: activityData.activity_end_time || prevSettings.activityEndTime
        }));
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Only Control Admin can access these settings. Please login as admin.');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError('Failed to fetch settings');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked :
               type === 'number' ? parseInt(value) : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');

      // Convert camelCase to snake_case for backend
      const payload = {
        active_queue_limit: settings.activeQueueLimit,
        high_priority_quota: settings.highPriorityQuota,
        average_interview_time: settings.averageInterviewTime,
        buffer_time: settings.bufferTime,
        group_interview_max_size: settings.groupInterviewMaxSize,
        status: settings.isActivityActive ? 'active' : 'inactive',
        start_time: settings.activityStartTime,
        end_time: settings.activityEndTime
      };

      await axios.put('http://www.bon.cc:8080/api/admin/activity', payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Only Control Admin can modify these settings.');
      } else {
        setError(err.response?.data?.error || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={handleBack} className="back-btn">← Back to Dashboard</button>
        <h1>Interview Settings</h1>
      </div>

      <div className="settings-content">
        {error && <div className="error-alert">{error}</div>}
        {message && <div className="success-alert">{message}</div>}

        <div className="settings-section">
          <h2>Activity Control</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  name="isActivityActive"
                  checked={settings.isActivityActive}
                  onChange={handleChange}
                />
                Activity Active
              </label>
              <span className="setting-help">Enable/disable the entire interview activity</span>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  name="allowNewRegistrations"
                  checked={settings.allowNewRegistrations}
                  onChange={handleChange}
                />
                Allow New Registrations
              </label>
              <span className="setting-help">Allow candidates to register and join queues</span>
            </div>

            <div className="setting-item">
              <label>Activity Start Time</label>
              <input
                type="time"
                name="activityStartTime"
                value={settings.activityStartTime}
                onChange={handleChange}
              />
            </div>

            <div className="setting-item">
              <label>Activity End Time</label>
              <input
                type="time"
                name="activityEndTime"
                value={settings.activityEndTime}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Queue Management</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Active Queue Limit</label>
              <input
                type="number"
                name="activeQueueLimit"
                value={settings.activeQueueLimit}
                onChange={handleChange}
                min="4"
                max="10"
              />
              <span className="setting-help">Number of candidates in active queue (4-10)</span>
            </div>

            <div className="setting-item">
              <label>Max Queue Length</label>
              <input
                type="number"
                name="maxQueueLength"
                value={settings.maxQueueLength}
                onChange={handleChange}
                min="50"
                max="500"
              />
              <span className="setting-help">Maximum total candidates in queue</span>
            </div>

            <div className="setting-item">
              <label>High Priority Quota</label>
              <input
                type="number"
                name="highPriorityQuota"
                value={settings.highPriorityQuota}
                onChange={handleChange}
                min="1"
                max="4"
              />
              <span className="setting-help">Number of high priority slots per position (1-4)</span>
            </div>

            <div className="setting-item">
              <label>High Priority Time Limit (minutes)</label>
              <input
                type="number"
                name="highPriorityTimeLimit"
                value={settings.highPriorityTimeLimit}
                onChange={handleChange}
                min="15"
                max="60"
              />
              <span className="setting-help">Minutes before activity end to disable high priority</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Interview Parameters</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Average Interview Time (minutes)</label>
              <input
                type="number"
                name="averageInterviewTime"
                value={settings.averageInterviewTime}
                onChange={handleChange}
                min="5"
                max="15"
              />
              <span className="setting-help">Expected duration of each interview (5-15)</span>
            </div>

            <div className="setting-item">
              <label>Buffer Time (minutes)</label>
              <input
                type="number"
                name="bufferTime"
                value={settings.bufferTime}
                onChange={handleChange}
                min="3"
                max="8"
              />
              <span className="setting-help">Time between interviews (3-8)</span>
            </div>

            <div className="setting-item">
              <label>Group Interview Max Size</label>
              <input
                type="number"
                name="groupInterviewMaxSize"
                value={settings.groupInterviewMaxSize}
                onChange={handleChange}
                min="2"
                max="8"
              />
              <span className="setting-help">Maximum candidates per group interview (2-8)</span>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  name="autoCloseQueue"
                  checked={settings.autoCloseQueue}
                  onChange={handleChange}
                />
                Auto-close Queue at End Time
              </label>
              <span className="setting-help">Automatically close queues when activity ends</span>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-btn"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="reset-btn"
          >
            Reset to Current
          </button>
        </div>
      </div>
    </div>
  );
}

export default InterviewSettings;