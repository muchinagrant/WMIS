import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';
import RepairForm from './RepairForm';
import RepairReview from './RepairReview';

const DispatchDashboard = () => {
    const [incidents, setIncidents] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionStatus, setActionStatus] = useState({ type: '', message: '' });
    const [expandedIncidentId, setExpandedIncidentId] = useState(null);
    const [pondAlerts, setPondAlerts] = useState([]);
    
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'line_attendant';
    const canDispatchActions = ['admin', 'stp_superintendent', 'line_supervisor'].includes(userRole);
    const isSupervisorView = canDispatchActions;

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const incidentRes = await api.get('/api/incidents/');
            
            // Safely support both DRF paginated responses and flat arrays.
            const incidentsArray = incidentRes.data.results || incidentRes.data;

            if (!Array.isArray(incidentsArray)) {
                throw new Error('Received invalid data format for incidents.');
            }
            
            // Filter view based on role
            if (isSupervisorView) {
                setIncidents(incidentsArray);
                if (canDispatchActions) {
                    const userRes = await api.get('/api/users/');

                    // Safely support both DRF paginated responses and flat arrays.
                    const usersArray = userRes.data.results || userRes.data;

                    if (Array.isArray(usersArray)) {
                        const fieldStaff = usersArray.filter(u => u.role === 'line_attendant');
                        setTechnicians(fieldStaff);
                    }
                }
            } else {
                // Technicians only see their own assigned incidents
                const myIncidents = incidentsArray.filter(inc => inc.assigned_to === user?.user_id);
                setIncidents(myIncidents);
            }
        } catch (error) {
            console.error("Failed to load dashboard data", error);
            setActionStatus({ type: 'error', message: 'Failed to load live data. Check connection.' });
        } finally {
            setLoading(false);
        }
    }, [canDispatchActions, isSupervisorView, user?.user_id]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        if (!isSupervisorView) return;
        const today = new Date().toISOString().split('T')[0];
        api.get('/api/pond-logs/', { params: { year: today.slice(0,4), month: parseInt(today.slice(5,7), 10) } })
            .then(res => {
                const todayLogs = (res.data || []).filter(l => l.log_date === today);
                const alerts = todayLogs.filter(l => l.surface_scum || l.odour_complaint || (l.do_level !== null && Number(l.do_level) < 0.5));
                setPondAlerts(alerts);
            })
            .catch(() => {});
    }, [isSupervisorView]);

    const handleAssign = async (incidentId) => {
        const userId = document.getElementById(`assign-user-${incidentId}`).value;
        const crew = document.getElementById(`assign-crew-${incidentId}`)?.value || '';

        if (!userId) return;
        try {
            await api.post(`/api/incidents/${incidentId}/assign/`, {
                user_id: userId,
                assisting_crew: crew
            });
            setActionStatus({ type: 'success', message: `Incident #${incidentId} assigned successfully.` });
            fetchDashboardData(); 
        } catch (error) {
            setActionStatus({ type: 'error', message: error.response?.data?.error || 'Assignment failed.' });
        }
    };

    const getActiveWorkload = (technicianId) => {
        return incidents.filter(inc =>
            inc.assigned_to === technicianId &&
            ['assigned', 'in_progress', 'on_hold_materials', 'on_hold_equipment'].includes(inc.status)
        ).length;
    };

    const handleStartWork = async (incidentId) => {
        setActionStatus({ type: 'info', message: 'Starting work...' });
        try {
            await api.post(`/api/incidents/${incidentId}/update_status/`, { status: 'in_progress' });
            setActionStatus({ type: 'success', message: `Incident #${incidentId} is now In Progress.` });
            setExpandedIncidentId(incidentId);
            fetchDashboardData();
        } catch (error) {
            setActionStatus({ type: 'error', message: error.response?.data?.error || 'Failed to start work.' });
        }
    };

    const toggleExpand = (incidentId) => {
        setExpandedIncidentId(prev => prev === incidentId ? null : incidentId);
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
                <span>
                    <i className="fas fa-tasks"></i>
                    {canDispatchActions
                        ? 'Supervisor Dispatch Board'
                        : 'My Assigned Tasks'}
                </span>
                <button onClick={fetchDashboardData} style={{ background: 'none', border: '1px solid #1a6fb0', color: '#1a6fb0', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <i className="fas fa-sync-alt"></i> Refresh
                </button>
            </h2>

            {actionStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: actionStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: actionStatus.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {actionStatus.message}
                </div>
            )}

            {isSupervisorView && pondAlerts.length > 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className="fas fa-water" style={{ color: '#d97706' }}></i>
                        Pond Alerts Today ({pondAlerts.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {pondAlerts.map(log => (
                            <span key={log.id} style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                                <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }}></i>
                                {log.pond_code}
                                {log.surface_scum && ' · Scum'}
                                {log.odour_complaint && ' · Odour'}
                                {log.do_level !== null && Number(log.do_level) < 0.5 && ` · DO ${log.do_level}`}
                                {log.incident_number && (
                                    <span style={{ marginLeft: 6, opacity: 0.7, fontWeight: 400 }}>
                                        ({log.incident_number})
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
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
                                <th style={{ padding: '12px', textAlign: 'left' }}>Issue & Reporter</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Priority</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.map(inc => (
                                <React.Fragment key={inc.id}>
                                    <tr style={{ borderBottom: '1px solid #eef5fb', background: expandedIncidentId === inc.id ? '#f0fdf4' : 'transparent' }}>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ fontWeight: 'bold' }}>{new Date(inc.reported_at).toLocaleDateString()}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}><i className="fas fa-map-marker-alt"></i> {inc.location_text.substring(0, 25)}</div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ textTransform: 'capitalize', fontWeight: '500' }}>{inc.category.replace('_', ' ')}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                <i className="fas fa-user"></i> Reported by: {inc.reported_by_name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>{getSeverityBadge(inc.severity)}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', background: '#e0e7ff', color: '#3730a3' }}>
                                                {inc.status.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            {/* SUPERVISOR VIEW: Assign Dropdown */}
                                            {canDispatchActions && inc.status === 'new' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                                                    <select id={`assign-user-${inc.id}`} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                        <option value="">Select Lead Plumber...</option>
                                                        {technicians.map(tech => (
                                                            <option key={tech.id} value={tech.id}>
                                                                {tech.username} ({getActiveWorkload(tech.id)} Active Tasks)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        id={`assign-crew-${inc.id}`}
                                                        placeholder="Assisting Crew (Optional)"
                                                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                                    />
                                                    <button onClick={() => handleAssign(inc.id)} style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                                                        <i className="fas fa-user-check"></i> Assign Task
                                                    </button>
                                                </div>
                                            )}

                                            {/* SUPERVISOR VIEW: Review & Certify Button */}
                                            {canDispatchActions && inc.status === 'pending_certification' && (
                                                <button
                                                    onClick={() => toggleExpand(inc.id)}
                                                    style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '5px' }}
                                                >
                                                    <i className="fas fa-clipboard-check"></i> {expandedIncidentId === inc.id ? 'Close Review' : 'Review & Certify'}
                                                </button>
                                            )}

                                            {/* TECHNICIAN VIEW: State Machine Buttons */}
                                            {!isSupervisorView && inc.status === 'assigned' && (
                                                <button
                                                    onClick={() => handleStartWork(inc.id)}
                                                    style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                                                >
                                                    <i className="fas fa-play-circle"></i> Start Work
                                                </button>
                                            )}
                                            {!isSupervisorView && inc.status === 'in_progress' && (
                                                <button
                                                    onClick={() => toggleExpand(inc.id)}
                                                    style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                                                >
                                                    <i className="fas fa-tools"></i> {expandedIncidentId === inc.id ? 'Close Workspace' : 'Log Details'}
                                                </button>
                                            )}
                                            {inc.status !== 'new' && inc.status !== 'assigned' && inc.status !== 'in_progress' && (
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Processed</span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* EXPANDABLE ACCORDION ROW */}
                                    {expandedIncidentId === inc.id && (
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                            <td colSpan="5" style={{ padding: '20px' }}>
                                                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                                    {canDispatchActions ? (
                                                        <RepairReview
                                                            incidentId={inc.id}
                                                            onSuccess={() => {
                                                                setExpandedIncidentId(null);
                                                                fetchDashboardData();
                                                            }}
                                                        />
                                                    ) : (
                                                        <RepairForm
                                                            incidentId={inc.id}
                                                            locationText={inc.location_text}
                                                            onSuccess={() => {
                                                                setExpandedIncidentId(null);
                                                                fetchDashboardData();
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DispatchDashboard;