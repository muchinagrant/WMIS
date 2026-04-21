import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const DispatchDashboard = () => {
    const [incidents, setIncidents] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionStatus, setActionStatus] = useState({ type: '', message: '' });

    // Fetch Incidents and available Technicians on load
    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch all incidents (in a real app, you might paginate or filter by unresolved)
            const incidentRes = await api.get('/api/incidents/');
            setIncidents(incidentRes.data);

            // Fetch users to populate the assignment dropdowns
            const userRes = await api.get('/api/users/');
            // Filter to only show Grade 6 and Grade 5 staff for field assignments
            const fieldStaff = userRes.data.filter(u => u.role === 'attendant' || u.role === 'operator');
            setTechnicians(fieldStaff);
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
            fetchDashboardData(); // Refresh the list to show new status
        } catch (error) {
            setActionStatus({ type: 'error', message: error.response?.data?.error || 'Assignment failed.' });
        }
    };

    // Helper for Severity Color Coding
    const getSeverityBadge = (severity) => {
        const styles = {
            high: { bg: '#fee2e2', color: '#991b1b', icon: 'fa-siren-on' },
            medium: { bg: '#fef3c7', color: '#92400e', icon: 'fa-exclamation-triangle' },
            low: { bg: '#d1fae5', color: '#065f46', icon: 'fa-info-circle' }
        };
        const style = styles[severity] || styles.low;
        
        return (
            <span style={{ background: style.bg, color: style.color, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                <i className={`fas ${style.icon}`} style={{ marginRight: '4px' }}></i>
                {severity}
            </span>
        );
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                <span><i className="fas fa-satellite-dish"></i> Supervisor Dispatch Board</span>
                <button onClick={fetchDashboardData} style={{ background: 'none', border: '1px solid #1a6fb0', color: '#1a6fb0', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
            </h2>

            {actionStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: actionStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: actionStatus.type === 'success' ? '#065f46' : '#991b1b' }}>
                    <i className={`fas ${actionStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: '8px' }}></i>
                    {actionStatus.message}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <i className="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Loading dispatch data...</p>
                </div>
            ) : (
                <div className="scrollable-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569' }}>Date & Loc</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569' }}>Issue</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569' }}>Priority</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569' }}>Status</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', color: '#475569' }}>Dispatch Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.map(inc => (
                                <tr key={inc.id} style={{ borderBottom: '1px solid #eef5fb', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{new Date(inc.reported_at).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}><i className="fas fa-map-marker-alt"></i> {inc.location_text.substring(0, 25)}...</div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ textTransform: 'capitalize', fontWeight: '500' }}>{inc.category.replace('_', ' ')}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>By: {inc.reported_by_name}</div>
                                    </td>
                                    <td style={{ padding: '15px' }}>{getSeverityBadge(inc.severity)}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ 
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600',
                                            background: inc.status === 'new' ? '#e0e7ff' : inc.status === 'resolved' ? '#dcfce3' : '#f3e8ff',
                                            color: inc.status === 'new' ? '#3730a3' : inc.status === 'resolved' ? '#166534' : '#6b21a8'
                                        }}>
                                            {inc.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {inc.status === 'new' ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select 
                                                    id={`assign-${inc.id}`}
                                                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                                >
                                                    <option value="">Select Plumber...</option>
                                                    {technicians.map(tech => (
                                                        <option key={tech.id} value={tech.id}>{tech.full_name || tech.username}</option>
                                                    ))}
                                                </select>
                                                <button 
                                                    onClick={() => handleAssign(inc.id, document.getElementById(`assign-${inc.id}`).value)}
                                                    style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>
                                                <i className="fas fa-hard-hat" style={{ color: '#f59e0b', marginRight: '5px' }}></i>
                                                {inc.assigned_to_name || 'Assigned'}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {incidents.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No incidents reported yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DispatchDashboard;