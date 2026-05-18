import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthContext, { AuthProvider } from './context/AuthContext';
import { wakeUpServer } from './api/axios';
import { getLandingRoute } from './config/roleRouting';

// Import Pages & Layouts
import Login from './pages/Login';
import ProtectedLayout from './components/Layout/ProtectedLayout';

// Import Operational Form Components
import IncidenceForm from './components/IncidenceFormNew';
import RepairForm from './components/RepairForm';
import WeeklyPatrolForm from './components/WeeklyPatrolForm';
import PatrolLogReview from './components/PatrolLogReview';
import TreatmentLogForm from './components/TreatmentLogForm';
import SludgeManifest from './components/SludgeManifest';
import MonthlySummary from './components/MonthlySummary';
import DispatchDashboardNew from './components/DispatchDashboardNew';
import MyTasksNew from './components/MyTasksNew';
import ProfileNew from './components/ProfileNew';
import LabTestForm from './components/LabTestForm';
import PondMaintenanceLogs from './components/PondMaintenanceLogs';
import FlowRecordsForm from './components/FlowRecordsForm';
import InletWorksForm from './components/InletWorksForm';

const RoleRoute = ({ element, allowedRoles }) => {
  const { user } = useContext(AuthContext);
  const role = user?.role || 'line_attendant';

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getLandingRoute(role)} replace />;
  }

  return element;
};

const AppRoutes = () => {
  const { user } = useContext(AuthContext);
  const role = user?.role || 'line_attendant';
  const landingRoute = getLandingRoute(role);

  useEffect(() => {
    wakeUpServer();
  }, []);

  return (
    <div className="container mx-auto max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden my-8" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to={landingRoute} replace />} />

          <Route path="/portal/field" element={<RoleRoute allowedRoles={['line_attendant']} element={<Navigate to="/dispatch" replace />} />} />
          <Route path="/portal/line-supervisor" element={<RoleRoute allowedRoles={['line_supervisor']} element={<Navigate to="/dispatch" replace />} />} />
          <Route path="/portal/attendant" element={<RoleRoute allowedRoles={['stp_attendant']} element={<Navigate to="/treatment" replace />} />} />
          <Route path="/portal/operator" element={<RoleRoute allowedRoles={['stp_operator']} element={<Navigate to="/treatment" replace />} />} />
          <Route path="/portal/lab" element={<RoleRoute allowedRoles={['lab_tech']} element={<Navigate to="/lab-records" replace />} />} />
          <Route path="/portal/supervisor" element={<RoleRoute allowedRoles={['stp_supervisor']} element={<Navigate to="/treatment" replace />} />} />
          <Route path="/portal/superintendent" element={<RoleRoute allowedRoles={['stp_superintendent']} element={<Navigate to="/summary" replace />} />} />
          <Route path="/portal/admin" element={<RoleRoute allowedRoles={['admin']} element={<Navigate to="/summary" replace />} />} />

          <Route path="/incidence" element={<RoleRoute allowedRoles={['line_supervisor', 'line_attendant']} element={<IncidenceForm />} />} />
          <Route path="/repairs" element={<RoleRoute allowedRoles={['line_supervisor', 'line_attendant']} element={<RepairForm />} />} />
          <Route path="/inspection" element={<RoleRoute allowedRoles={['line_supervisor', 'line_attendant']} element={<WeeklyPatrolForm />} />} />
          <Route path="/patrol-review" element={<RoleRoute allowedRoles={['line_supervisor', 'stp_supervisor']} element={<PatrolLogReview />} />} />
          <Route path="/treatment" element={<RoleRoute allowedRoles={['stp_supervisor', 'stp_operator', 'stp_attendant']} element={<TreatmentLogForm />} />} />
          <Route path="/f203a" element={<RoleRoute allowedRoles={['stp_supervisor', 'stp_operator', 'stp_attendant']} element={<InletWorksForm />} />} />
          <Route path="/flow-records" element={<RoleRoute allowedRoles={['stp_supervisor', 'stp_operator', 'stp_attendant']} element={<FlowRecordsForm />} />} />
          <Route path="/sludge" element={<RoleRoute allowedRoles={['stp_supervisor', 'stp_operator', 'stp_attendant']} element={<SludgeManifest />} />} />
          <Route path="/dispatch" element={<RoleRoute allowedRoles={['line_supervisor', 'stp_supervisor']} element={<DispatchDashboardNew />} />} />
          <Route path="/my-tasks" element={<RoleRoute allowedRoles={['line_attendant']} element={<MyTasksNew />} />} />
          <Route path="/lab-records" element={<RoleRoute allowedRoles={['stp_supervisor', 'lab_tech']} element={<LabTestForm />} />} />
          <Route path="/ponds" element={<RoleRoute allowedRoles={['stp_supervisor', 'stp_operator', 'stp_attendant']} element={<PondMaintenanceLogs />} />} />
          <Route path="/summary" element={<RoleRoute allowedRoles={['admin', 'stp_superintendent', 'stp_supervisor']} element={<MonthlySummary />} />} />
          <Route path="/profile" element={<RoleRoute allowedRoles={['admin', 'stp_superintendent', 'stp_supervisor', 'lab_tech', 'stp_operator', 'stp_attendant', 'line_supervisor', 'line_attendant']} element={<ProfileNew />} />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? landingRoute : '/login'} replace />} />
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