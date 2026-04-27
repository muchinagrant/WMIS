import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthContext, { AuthProvider } from './context/AuthContext';
import { wakeUpServer } from './api/axios';

// Import Pages & Layouts
import Login from './pages/Login';
import ProtectedLayout from './components/Layout/ProtectedLayout';

// Import Operational Form Components
import IncidenceForm from './components/IncidenceForm';
import RepairForm from './components/RepairForm';
import InspectionTable from './components/InspectionTable';
import TreatmentLogForm from './components/TreatmentLogForm';
import SludgeManifest from './components/SludgeManifest';
import SewerConnections from './components/SewerConnections';
import MonthlySummary from './components/MonthlySummary';
import DispatchDashboard from './components/DispatchDashboard';
import Profile from './components/Profile';

const RoleRoute = ({ element, allowedRoles }) => {
  const { user } = useContext(AuthContext);
  const role = user?.role || 'attendant';

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/incidence" replace />;
  }

  return element;
};

const AppRoutes = () => {
  useEffect(() => {
    wakeUpServer();
  }, []);

  return (
    <div className="container mx-auto max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden my-8" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/incidence" replace />} />
          <Route path="/incidence" element={<IncidenceForm />} />
          <Route path="/repairs" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'operator', 'attendant']} element={<RepairForm />} />} />
          <Route path="/inspection" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'attendant']} element={<InspectionTable />} />} />
          <Route path="/treatment" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator']} element={<TreatmentLogForm />} />} />
          <Route path="/sludge" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'operator']} element={<SludgeManifest />} />} />
          <Route path="/connections" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor']} element={<SewerConnections />} />} />
          <Route path="/dispatch" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'operator', 'attendant']} element={<DispatchDashboard />} />} />
          <Route path="/summary" element={<RoleRoute allowedRoles={['admin', 'superintendent']} element={<MonthlySummary />} />} />
          <Route path="/profile" element={<RoleRoute allowedRoles={['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator', 'attendant']} element={<Profile />} />} />
        </Route>

        <Route path="*" element={<Navigate to="/incidence" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;