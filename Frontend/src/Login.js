import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { storeAuth } from './authUtils';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Role configurations with test credentials
  const roles = [
    {
      id: 'control_admin',
      name: 'System Administrator',
      icon: '🛠️',
      color: '#e74c3c',
      testAccount: 'admin',
      testPassword: 'admin123',
      description: 'Full system control and configuration'
    },
    {
      id: 'company_admin',
      name: 'Company Admin',
      icon: '🏢',
      color: '#3498db',
      testAccount: 'company_admin1',
      testPassword: 'admin123',
      description: 'Manage company positions and interviewers'
    },
    {
      id: 'interviewer',
      name: 'Interviewer',
      icon: '👔',
      color: '#2ecc71',
      testAccount: 'interviewer1',
      testPassword: 'admin123',
      description: 'Conduct interviews and evaluate candidates'
    },
    {
      id: 'candidate',
      name: 'Candidate',
      icon: '👤',
      color: '#9b59b6',
      testAccount: 'candidate1',
      testPassword: 'admin123',
      description: 'Apply for positions and join interview queues'
    }
  ];

  const handleRoleSelect = (role) => {
    setSelectedRole(role.id);
    // Auto-fill test credentials for demo
    setUsername(role.testAccount);
    setPassword(role.testPassword);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRole) {
      setError('Please select a role to continue');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://www.bon.cc:8080/api/login', {
        account: username,
        password
      });

      if (response.data.token) {
        // Use the new auth utility for better tab isolation
        storeAuth(response.data.token, response.data.user);

        // Navigate based on user role
        const userRole = response.data.user.role;
        switch(userRole) {
          case 'control_admin':
            navigate('/dashboard');
            break;
          case 'company_admin':
            navigate('/company-dashboard');
            break;
          case 'interviewer':
            navigate('/interviewer-dashboard');
            break;
          case 'candidate':
            navigate('/candidate-dashboard');
            break;
          default:
            navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    setUsername(role.testAccount);
    setPassword(role.testPassword);
    setSelectedRole(role.id);
    // Auto-submit for demo
    setTimeout(() => {
      document.getElementById('login-form').requestSubmit();
    }, 100);
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>Interview Management System</h1>
        <p>Select your role and sign in to continue</p>
      </div>

      <div className="role-selection">
        <h3>Choose Your Role</h3>
        <div className="role-cards">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
              onClick={() => handleRoleSelect(role)}
              style={{ borderColor: selectedRole === role.id ? role.color : '#ddd' }}
            >
              <div className="role-icon" style={{ backgroundColor: role.color }}>
                {role.icon}
              </div>
              <h4>{role.name}</h4>
              <p className="role-description">{role.description}</p>
              <button
                className="quick-login-btn"
                style={{ backgroundColor: role.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickLogin(role);
                }}
              >
                Quick Login
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="login-box">
        <h2>Sign In</h2>
        {selectedRole && (
          <div className="selected-role-badge" style={{
            backgroundColor: roles.find(r => r.id === selectedRole)?.color
          }}>
            {roles.find(r => r.id === selectedRole)?.icon} {roles.find(r => r.id === selectedRole)?.name}
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading || !selectedRole}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <div className="test-credentials">
            <h4>Test Credentials</h4>
            <div className="credentials-list">
              {roles.map((role) => (
                <div key={role.id} className="credential-item">
                  <span className="role-label">{role.name}:</span>
                  <code>{role.testAccount} / {role.testPassword}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;