import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

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

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="container mx-auto max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden my-8" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes grouped under the ProtectedLayout */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Navigate to="/incidence" replace />} />
              <Route path="/incidence" element={<IncidenceForm />} />
              <Route path="/repairs" element={<RepairForm />} />
              <Route path="/inspection" element={<InspectionTable />} />
              <Route path="/treatment" element={<TreatmentLogForm />} />
              <Route path="/sludge" element={<SludgeManifest />} />
              <Route path="/connections" element={<SewerConnections />} />
              <Route path="/summary" element={<MonthlySummary />} />
            </Route>

            {/* Catch-all route for undefined URLs */}
            <Route path="*" element={<Navigate to="/incidence" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;