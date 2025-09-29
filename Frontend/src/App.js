import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import InterviewSettings from './InterviewSettings';
import CandidateDashboard from './CandidateDashboard';
import CompanyDashboard from './CompanyDashboard';
import InterviewerDashboard from './InterviewerDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<InterviewSettings />} />
        <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
        <Route path="/company-dashboard" element={<CompanyDashboard />} />
        <Route path="/interviewer-dashboard" element={<InterviewerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;