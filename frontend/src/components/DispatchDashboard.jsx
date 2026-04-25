import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const DispatchDashboard = () => {
    const [incidents, setIncidents] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionStatus, setActionStatus] = useState({ type: '', message: '' });
    
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'attendant';
    const isSupervisor = ['admin', 'superintendent', 'supervisor'].includes(userRole);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const incidentRes = await api.get('/api/incidents/');
            
            // Filter view based on role
            if (isSupervisor) {
                setIncidents(incidentRes.data);
                const userRes = await api.get('/api/users/');
                const fieldStaff = userRes.data.filter(u => u.role === 'attendant' || u.role === 'operator');
                setTechnicians(fieldStaff);
            } else {
                // Technicians only see their own assigned incidents
                const myIncidents = incidentRes.data.filter(inc => inc.assigned_to === user?.user_id);
                setIncidents(myIncidents);
            }
        } catch (error) {
            console.error("Failed to load dashboard data", error);
            setActionStatus({ type: 'error', message: 'Failed to load live data. Check connection.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (incidentId, userId) => {
        if (!userId) return;
        try {
            await api.post(`/api/incidents/${incidentId}/assign/`, { user_id: userId });
            setActionStatus({ type: 'success', message: `Incident #${incidentId} assigned successfully.` });
            fetchDashboardData(); 
        } catch (error) {
            setActionStatus({ type: 'error', message: error.response?.data?.error || 'Assignment failed.' });
        }
    };

    // Helper for Severity Color Coding
    const getSeverityBadge = (severity) => {
        const styles = {
            high: { bg: '#fee2e2', color: '#991b1b', icon: 'fa-exclamation-circle' },
            medium: { bg: '#fef3c7', color: '#92400e', icon: 'fa-exclamation-triangle' },
            low: { bg: '#d1fae5', color: '#065f46', icon: 'fa-info-circle' }
        };
        const style = styles[severity] || styles.low;
        return (
            <span style={{ background: style.bg, color: style.color, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                <i className={`fas ${style.icon}`} style={{ marginRight: '4px' }}></i> {severity}
            </span>
        );
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                <span><i className="fas fa-tasks"></i> {isSupervisor ? 'Supervisor Dispatch Board' : 'My Assigned Tasks'}</span>
                <button onClick={fetchDashboardData} style={{ background: 'none', border: '1px solid #1a6fb0', color: '#1a6fb0', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
            </h2>

            {actionStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: actionStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: actionStatus.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {actionStatus.message}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}><i className="fas fa-spinner fa-spin fa-2x"></i><p>Loading tasks...</p></div>
            ) : (
                <div className="scrollable-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date & Loc</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Issue</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Priority</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.map(inc => (
                                <tr key={inc.id} style={{ borderBottom: '1px solid #eef5fb' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 'bold' }}>{new Date(inc.reported_at).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}><i className="fas fa-map-marker-alt"></i> {inc.location_text.substring(0, 25)}</div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ textTransform: 'capitalize', fontWeight: '500' }}>{inc.category.replace('_', ' ')}</div>
                                    </td>
                                    <td style={{ padding: '15px' }}>{getSeverityBadge(inc.severity)}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', background: '#e0e7ff', color: '#3730a3' }}>
                                            {inc.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {/* SUPERVISOR VIEW: Assign Dropdown */}
                                        {isSupervisor && inc.status === 'new' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select id={`assign-${inc.id}`} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                    <option value="">Select Plumber...</option>
                                                    {technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.username}</option>)}
                                                </select>
                                                <button onClick={() => handleAssign(inc.id, document.getElementById(`assign-${inc.id}`).value)} style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Assign</button>
                                            </div>
                                        )}
                                        {/* TECHNICIAN VIEW: Log Repair Button */}
                                        {!isSupervisor && inc.status === 'assigned' && (
                                            <button 
                                                onClick={() => navigate(`/repairs?incident=${inc.id}`)}
                                                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                <i className="fas fa-tools"></i> Log Repair
                                            </button>
                                        )}
                                        {inc.status !== 'new' && inc.status !== 'assigned' && (
                                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Processed</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DispatchDashboard;