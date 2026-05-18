import React, { useContext, useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';
import { SyncContext } from '../context/SyncContext';

const DispatchDashboardNew = () => {
    const [activeTab, setActiveTab] = useState('unassigned');
    const [incidents, setIncidents] = useState({
        unassigned: [],
        in_progress: [],
        pending_certification: [],
        history: [],
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [certificationModal, setCertificationModal] = useState(null);
    const [certNotes, setCertNotes] = useState('');
    const { user } = useContext(AuthContext);
    const { addToQueue } = useContext(SyncContext);

    const priorityColors = {
        high: '#DC2626',
        medium: '#CA8A04',
        low: '#16A34A',
    };

    const statusBadgeColors = {
        new: '#6B7280',
        assigned: '#3B82F6',
        in_progress: '#F59E0B',
        pending_certification: '#8B5CF6',
        resolved: '#10B981',
        closed: '#10B981',
    };

    // Load users (for lead plumber dropdown)
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const response = await api.get('/api/users/?role=stp_attendant');
                const userList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                setUsers(userList);
            } catch (error) {
                console.error('Failed to load users:', error);
            }
        };
        loadUsers();
    }, []);

    // Load incidents by status
    useEffect(() => {
        loadIncidents();
    }, []);

    const loadIncidents = async () => {
        setLoading(true);
        try {
            // Load all status categories with correct lowercase values
            const statuses = ['new', 'assigned', 'in_progress', 'pending_certification', 'closed'];
            const responses = await Promise.all(
                statuses.map((status) => api.get(`/api/incidents/?status=${status}`))
            );

            const data = {
                unassigned: Array.isArray(responses[0].data) ? responses[0].data : (responses[0].data?.results || []),
                in_progress: [
                    ...(Array.isArray(responses[1].data) ? responses[1].data : (responses[1].data?.results || [])),
                    ...(Array.isArray(responses[2].data) ? responses[2].data : (responses[2].data?.results || [])),
                ],
                pending_certification: Array.isArray(responses[3].data) ? responses[3].data : (responses[3].data?.results || []),
                history: Array.isArray(responses[4].data) ? responses[4].data : (responses[4].data?.results || []),
            };

            setIncidents(data);
        } catch (error) {
            console.error('Failed to load incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTask = async (incidentId, values) => {
        try {
            const payload = {
                status: 'assigned',
                assigned_to: values.lead_plumber,
                assigned_at: new Date().toISOString(),
                assignment_instructions: values.instructions,
            };

            await api.patch(`/api/incidents/${incidentId}/`, payload);

            // Update local state
            setIncidents({
                ...incidents,
                unassigned: incidents.unassigned.filter((i) => i.id !== incidentId),
                in_progress: [
                    ...incidents.in_progress,
                    { ...selectedIncident, ...payload },
                ],
            });

            setSelectedIncident(null);
            loadIncidents();
        } catch (error) {
            console.error('Failed to assign task:', error);
            if (addToQueue) {
                addToQueue({
                    method: 'PATCH',
                    url: `/api/incidents/${incidentId}/`,
                    data: { status: 'assigned', assigned_to: values.lead_plumber },
                });
            }
        }
    };

    const handleCertify = async (incidentId, isApproved) => {
        try {
            const payload = {
                status: isApproved ? 'closed' : 'in_progress',
                certified_by: user?.id,
                certified_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
            };

            await api.patch(`/api/incidents/${incidentId}/`, payload);
            setCertificationModal(null);
            setCertNotes('');
            loadIncidents();
        } catch (error) {
            console.error('Failed to certify incident:', error);
        }
    };

    const exportToCSV = () => {
        if (incidents.history.length === 0) {
            alert('No history records to export');
            return;
        }

        const csvHeaders = ['Reference', 'Category', 'Severity', 'Zone', 'Date Reported', 'Reported By', 'Assigned To', 'Status', 'Completed Date'];
        const csvRows = incidents.history.map((incident) => [
            incident.incident_number,
            incident.category,
            incident.severity,
            incident.zone_name || 'N/A',
            new Date(incident.created_at).toLocaleDateString(),
            incident.reported_by_name || 'N/A',
            incident.assigned_to_name || 'N/A',
            incident.status,
            incident.completed_at ? new Date(incident.completed_at).toLocaleDateString() : 'N/A',
        ]);

        const csv = [csvHeaders, ...csvRows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dispatch-history-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const AssignmentForm = ({ incident }) => {
        const assignmentSchema = Yup.object().shape({
            lead_plumber: Yup.string().required('Lead Plumber is required'),
            assisting_crew: Yup.string(),
            instructions: Yup.string(),
        });

        return (
            <Formik
                initialValues={{
                    lead_plumber: '',
                    assisting_crew: '',
                    instructions: '',
                }}
                validationSchema={assignmentSchema}
                onSubmit={(values) => handleAssignTask(incident.id, values)}
            >
                {({ isSubmitting }) => (
                    <Form>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                Lead Plumber <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <Field
                                as="select"
                                name="lead_plumber"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.95rem',
                                }}
                            >
                                <option value="">Select a plumber</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.full_name} ({u.assigned_tasks_count || 0} tasks)
                                    </option>
                                ))}
                            </Field>
                            <ErrorMessage name="lead_plumber" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Assisting Crew</label>
                            <Field
                                as="textarea"
                                name="assisting_crew"
                                placeholder="e.g., John Mwangi, Mary Kipchoge"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    minHeight: '60px',
                                    fontFamily: 'inherit',
                                    fontSize: '0.95rem',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Assignment Instructions</label>
                            <Field
                                as="textarea"
                                name="instructions"
                                placeholder="Detailed instructions for the team..."
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    minHeight: '80px',
                                    fontFamily: 'inherit',
                                    fontSize: '0.95rem',
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setSelectedIncident(null)}
                                style={{
                                    padding: '10px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{
                                    padding: '10px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: isSubmitting ? 0.7 : 1,
                                }}
                            >
                                <i className="fas fa-paper-plane" style={{ marginRight: '6px' }}></i>
                                {isSubmitting ? 'Assigning...' : 'Assign Task'}
                            </button>
                        </div>
                    </Form>
                )}
            </Formik>
        );
    };

    const IncidentCard = ({ incident, tabName }) => {
        return (
            <div
                style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    borderLeft: `4px solid ${priorityColors[incident.severity] || '#6b7280'}`,
                }}
                onClick={() => {
                    if (tabName === 'unassigned') {
                        setSelectedIncident(incident);
                    } else if (tabName === 'pending_certification') {
                        setCertificationModal(incident);
                    }
                }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'start' }}>
                    <div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{incident.incident_number}</strong>
                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    background: priorityColors[incident.severity],
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                {incident.severity}
                            </span>
                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    background: statusBadgeColors[incident.status],
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                {incident.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '6px' }}>
                            <strong>{incident.category}</strong> — {incident.description?.substring(0, 100)}...
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        fontSize: '0.9rem',
                        color: '#64748b',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #e2e8f0',
                    }}
                >
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date Reported</div>
                        <div>{new Date(incident.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Zone</div>
                        <div>{incident.zone_name || 'N/A'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Location</div>
                        <div>{incident.location_text?.substring(0, 30)}...</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reported By</div>
                        <div>{incident.reported_by_name || 'N/A'}</div>
                    </div>
                </div>

                {incident.assigned_to_name && (
                    <div style={{ color: '#3b82f6', fontSize: '0.9rem', marginBottom: '12px' }}>
                        <i className="fas fa-user-check" style={{ marginRight: '6px' }}></i>Assigned to: {incident.assigned_to_name}
                    </div>
                )}

                {incident.assignment_instructions && (
                    <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '4px', fontSize: '0.9rem', color: '#065f46', marginBottom: '12px' }}>
                        <strong>📋 Instructions:</strong> {incident.assignment_instructions}
                    </div>
                )}

                {(tabName === 'unassigned' || tabName === 'pending_certification') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {tabName === 'unassigned' && (
                            <button
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIncident(incident);
                                }}
                            >
                                <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>Assign
                            </button>
                        )}
                        {tabName === 'pending_certification' && (
                            <button
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCertificationModal(incident);
                                }}
                            >
                                <i className="fas fa-clipboard-check" style={{ marginRight: '4px' }}></i>Review
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderTabContent = () => {
        const tabIncidents = incidents[activeTab];
        if (loading) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Loading incidents...
                </div>
            );
        }

        if (!tabIncidents || tabIncidents.length === 0) {
            const emptyMessages = {
                unassigned: 'No unassigned incidents. Great job! 🎉',
                in_progress: 'No incidents in progress.',
                pending_certification: 'No incidents awaiting certification.',
                history: 'No closed incidents yet.',
            };
            return (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <i className="fas fa-inbox" style={{ fontSize: '2.5rem', marginBottom: '12px', display: 'block', color: '#cbd5e1' }}></i>
                    <p style={{ fontSize: '1.05rem' }}>{emptyMessages[activeTab] || 'No incidents found'}</p>
                </div>
            );
        }

        return (
            <div style={{ display: 'grid', gap: '15px' }}>
                {tabIncidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} tabName={activeTab} />
                ))}
            </div>
        );
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-tasks"></i> Dispatch Dashboard
            </h2>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                {[
                    { id: 'unassigned', label: 'Unassigned', icon: 'fa-inbox' },
                    { id: 'in_progress', label: 'In Progress', icon: 'fa-hourglass-half' },
                    { id: 'pending_certification', label: 'Pending Certification', icon: 'fa-clipboard-check' },
                    { id: 'history', label: 'History', icon: 'fa-history' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 16px',
                            background: activeTab === tab.id ? '#1a6fb0' : 'transparent',
                            color: activeTab === tab.id ? 'white' : '#64748b',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '3px solid #1a6fb0' : 'none',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 600 : 500,
                            fontSize: '0.95rem',
                            transition: 'all 0.3s',
                        }}
                    >
                        <i className={`fas ${tab.icon}`} style={{ marginRight: '6px' }}></i>
                        {tab.label}
                    </button>
                ))}

                {/* CSV Export Button for History Tab */}
                {activeTab === 'history' && (
                    <button
                        onClick={exportToCSV}
                        style={{
                            marginLeft: 'auto',
                            padding: '10px 14px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                        }}
                    >
                        <i className="fas fa-download" style={{ marginRight: '6px' }}></i>Export CSV
                    </button>
                )}
            </div>

            {/* Assignment Modal */}
            {selectedIncident && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bef264', borderRadius: '8px', padding: '20px', marginBottom: '25px' }}>
                    <h3 style={{ color: '#065f46', marginBottom: '16px' }}>
                        <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>Assign Task: {selectedIncident.incident_number}
                    </h3>
                    <AssignmentForm incident={selectedIncident} />
                </div>
            )}

            {/* Certification Modal */}
            {certificationModal && (
                <div style={{ background: '#f3e8ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '20px', marginBottom: '25px' }}>
                    <h3 style={{ color: '#6b21a8', marginBottom: '16px' }}>
                        <i className="fas fa-certificate" style={{ marginRight: '8px' }}></i>Certification: {certificationModal.incident_number}
                    </h3>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginBottom: '16px',
                            paddingBottom: '16px',
                            borderBottom: '1px solid #ddd6fe',
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6b21a8', marginBottom: '4px' }}>Original Incident</div>
                            <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                                {certificationModal.incident_number} — {certificationModal.category} (Severity: {certificationModal.severity})
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6b21a8', marginBottom: '4px' }}>Assigned To</div>
                            <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>{certificationModal.assigned_to_name || 'Not assigned'}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Certification Notes</label>
                        <textarea
                            value={certNotes}
                            onChange={(e) => setCertNotes(e.target.value)}
                            placeholder="Review notes, work performed, materials used, etc."
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ddd6fe',
                                minHeight: '100px',
                                fontFamily: 'inherit',
                                fontSize: '0.95rem',
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <button
                            onClick={() => {
                                setCertificationModal(null);
                                setCertNotes('');
                            }}
                            style={{
                                padding: '10px',
                                background: '#f3f4f6',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleCertify(certificationModal.id, false)}
                            style={{
                                padding: '10px',
                                background: '#f97316',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            <i className="fas fa-arrow-rotate-left" style={{ marginRight: '6px' }}></i>Send Back
                        </button>
                        <button
                            onClick={() => handleCertify(certificationModal.id, true)}
                            style={{
                                padding: '10px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>Certify & Close
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};

export default DispatchDashboardNew;
