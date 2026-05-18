import React, { useEffect, useState } from 'react';
import api from '../api/axios';

const PatrolLogReview = () => {
    const [patrols, setPatrols] = useState([]);
    const [filterStatus, setFilterStatus] = useState('submitted');
    const [filterZone, setFilterZone] = useState('');
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedPatrol, setExpandedPatrol] = useState(null);
    const [reviewingPatrol, setReviewingPatrol] = useState(null);
    const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');

    // Load zones
    useEffect(() => {
        const loadZones = async () => {
            try {
                const response = await api.get('/api/zones/');
                const zoneList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                setZones(zoneList);
            } catch (error) {
                console.error('Failed to load zones:', error);
            }
        };
        loadZones();
    }, []);

    // Load patrol logs
    useEffect(() => {
        loadPatrols();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStatus, filterZone]);

    const loadPatrols = async () => {
        setLoading(true);
        try {
            let url = `/api/patrols/?status=${filterStatus}`;
            if (filterZone) url += `&zone=${filterZone}`;
            const response = await api.get(url);
            const patrolList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setPatrols(patrolList);
        } catch (error) {
            console.error('Failed to load patrol logs:', error);
            setPatrols([]);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (patrolId) => {
        try {
            const response = await api.patch(`/api/patrols/${patrolId}/`, {
                status: 'verified',
            });
            setPatrols(patrols.map(p => p.id === patrolId ? response.data : p));
            setReviewingPatrol(null);
            setAcknowledgmentNotes('');
            setFilterStatus('verified');
        } catch (error) {
            console.error('Failed to verify patrol:', error);
        }
    };

    const getZoneName = (zoneId) => {
        const zone = zones.find(z => z.id === zoneId);
        return zone ? zone.name : `Zone ${zoneId}`;
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-clipboard-list"></i> Weekly Patrol Log Review
            </h2>

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    >
                        <option value="submitted">Submitted (Pending Review)</option>
                        <option value="verified">Verified (Acknowledged)</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Zone</label>
                    <select
                        value={filterZone}
                        onChange={(e) => setFilterZone(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    >
                        <option value="">All Zones</option>
                        {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                                {zone.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Patrol List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Loading patrol logs...
                </div>
            ) : patrols.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block', color: '#cbd5e1' }}></i>
                    <p>No patrol logs found</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {patrols.map((patrol) => (
                        <div
                            key={patrol.id}
                            style={{
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '16px',
                                background: patrol.status === 'verified' ? '#f0fdf4' : '#fef8e7',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}
                            onClick={() => setExpandedPatrol(expandedPatrol === patrol.id ? null : patrol.id)}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '15px', alignItems: 'start' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                                            {patrol.date} — {getZoneName(patrol.zone)}
                                        </strong>
                                        <span
                                            style={{
                                                fontSize: '0.8rem',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                background: patrol.status === 'verified' ? '#d1fae5' : '#fef3c7',
                                                color: patrol.status === 'verified' ? '#065f46' : '#92400e',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {patrol.status.charAt(0).toUpperCase() + patrol.status.slice(1)}
                                        </span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                        <span style={{ marginRight: '20px' }}>
                                            <i className="fas fa-user" style={{ marginRight: '6px' }}></i>
                                            {patrol.attendant_name || 'Unknown Attendant'}
                                        </span>
                                        <span style={{ marginRight: '20px' }}>
                                            <i className="fas fa-rows" style={{ marginRight: '6px' }}></i>
                                            {patrol.rows?.length || 0} rows
                                        </span>
                                        {patrol.verified_at && (
                                            <span>
                                                <i className="fas fa-check-circle" style={{ marginRight: '6px', color: '#10b981' }}></i>
                                                Verified by {patrol.verified_by_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {patrol.status === 'submitted' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setReviewingPatrol(patrol.id);
                                        }}
                                        style={{
                                            padding: '10px 16px',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <i className="fas fa-check-square" style={{ marginRight: '6px' }}></i>Review
                                    </button>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {expandedPatrol === patrol.id && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                    <h4 style={{ marginBottom: '12px', color: '#0f172a' }}>Patrol Rows ({patrol.rows?.length || 0})</h4>
                                    {patrol.rows && patrol.rows.length > 0 ? (
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            {patrol.rows.map((row, idx) => (
                                                <div
                                                    key={row.id}
                                                    style={{
                                                        background: 'white',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '6px',
                                                        padding: '12px',
                                                    }}
                                                >
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '15px', marginBottom: '8px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Time</div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.time}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Section</div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.section_code || row.sewer_line_ref_text}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Main Connections</div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.new_main_connections}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Branch Connections</div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.new_branch_connections}</div>
                                                        </div>
                                                    </div>

                                                    {row.abnormality_observed !== 'none' && (
                                                        <div style={{
                                                            background: '#fef3c7',
                                                            border: '1px solid #fcd34d',
                                                            borderRadius: '4px',
                                                            padding: '10px',
                                                            marginTop: '10px',
                                                        }}>
                                                            <strong style={{ color: '#92400e', fontSize: '0.9rem' }}>
                                                                <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                                                                Abnormality: {row.abnormality_observed.replace(/_/g, ' ')}
                                                            </strong>
                                                            {row.abnormality_details && (
                                                                <div style={{ color: '#92400e', fontSize: '0.85rem', marginTop: '6px' }}>
                                                                    {row.abnormality_details}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {row.photo_url && (
                                                        <div style={{ marginTop: '10px' }}>
                                                            <img
                                                                src={row.photo_url}
                                                                alt="Patrol inspection"
                                                                style={{
                                                                    maxWidth: '100%',
                                                                    maxHeight: '200px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid #e2e8f0',
                                                                    cursor: 'pointer',
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: '#64748b' }}>No rows in this patrol</p>
                                    )}
                                </div>
                            )}

                            {/* Review Modal */}
                            {reviewingPatrol === patrol.id && (
                                <div style={{
                                    marginTop: '16px',
                                    paddingTop: '16px',
                                    borderTop: '1px solid #e2e8f0',
                                    background: '#f0fdf4',
                                    padding: '16px',
                                    borderRadius: '6px',
                                }}>
                                    <h4 style={{ marginBottom: '12px', color: '#065f46' }}>Acknowledge & Verify Patrol Log</h4>
                                    <textarea
                                        value={acknowledgmentNotes}
                                        onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                                        placeholder="Optional: Add verification notes or supervisor remarks..."
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '4px',
                                            border: '1px solid #bef264',
                                            minHeight: '80px',
                                            marginBottom: '12px',
                                            fontFamily: 'inherit',
                                            fontSize: '0.9rem',
                                        }}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            onClick={() => {
                                                setReviewingPatrol(null);
                                                setAcknowledgmentNotes('');
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
                                            onClick={() => handleReview(patrol.id)}
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
                                            <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>Verify & Acknowledge
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PatrolLogReview;
