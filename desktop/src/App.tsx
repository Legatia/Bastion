import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import InstallWizard from './components/InstallWizard';
import Dashboard from './components/Dashboard';
import LoginPage from './pages/LoginPage';
import AgentsPage from './pages/AgentsPage';
import PoliciesPage from './pages/PoliciesPage';
import LogsPage from './pages/LogsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BillingPage from './pages/BillingPage';
import ProfilePage from './pages/ProfilePage';
import ReferralsPage from './pages/ReferralsPage';
import SuccessPage from './pages/SuccessPage';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already set up (API key exists = was installed before)
    const key = localStorage.getItem('bastion_api_key');
    if (key) setInstalled(true);
  }, []);

  if (!installed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <InstallWizard onComplete={() => setInstalled(true)} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/referrals" element={<ReferralsPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
