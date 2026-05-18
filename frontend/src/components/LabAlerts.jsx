import React, { useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const badgeStyle = (severity) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    background: severity === 'red' ? '#fee2e2' : '#fef3c7',
    color: severity === 'red' ? '#991b1b' : '#92400e',
});

const CorrectiveActionModal = ({ flag, onClose, onSubmit }) => {
    const [actionTaken, setActionTaken] = useState('');
    const [actionAt, setActionAt] = useState(() => {
        const n = new Date();
        n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
        return n.toISOString().slice(0, 16);
    });
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!actionTaken.trim()) return;
        setSubmitting(true);
        const body = {
            corrective_action: `[${actionAt.replace('T', ' ')}] ${actionTaken.trim()}`,
            notes: notes.trim(),
        };
        await onSubmit(body);
        setSubmitting(false);
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
            onClick={onClose}
        >
            <div
                style={{ background: '#fff', borderRadius: 12, maxWidth: 480, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: '0 0 12px', color: '#0f172a' }}>Corrective Action</h3>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.88rem' }}>
                    <div><strong>Parameter:</strong> {flag.parameter_key}</div>
                    <div><strong>Date:</strong> {flag.lab_record_date}</div>
                    <div><strong>Measured:</strong> {flag.measured_value ?? '—'} (threshold {flag.threshold_mode} {flag.threshold_value})</div>
                    <div style={{ marginTop: 6 }}><span style={badgeStyle(flag.severity)}>{flag.severity.toUpperCase()}</span></div>
                </div>
                <form onSubmit={handleSubmit}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Action taken *</label>
                    <textarea
                        rows={3}
                        value={actionTaken}
                        onChange={(e) => setActionTaken(e.target.value)}
                        required
                        placeholder="Describe corrective action taken at the plant…"
                        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 12, boxSizing: 'border-box' }}
                    />
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Date & time of action</label>
                    <input
                        type="datetime-local"
                        value={actionAt}
                        onChange={(e) => setActionAt(e.target.value)}
                        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 12 }}
                    />
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Additional notes</label>
                    <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 16, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{ background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}>
                            {submitting ? 'Saving…' : 'Submit & Resolve'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LabAlerts = () => {
    const { user } = useContext(AuthContext);
    const role = user?.role || '';
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [resolveTarget, setResolveTarget] = useState(null);

    const loadFlags = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/lab-flags/');
            setFlags(res.data?.results || res.data || []);
        } catch {
            setMessage({ type: 'error', text: 'Failed to load alerts.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFlags();
    }, [loadFlags]);

    const submitResolve = async (body) => {
        if (!resolveTarget) return;
        try {
            await api.patch(`/api/lab-flags/${resolveTarget.id}/resolve/`, body);
            setMessage({ type: 'success', text: 'Corrective action recorded.' });
            setResolveTarget(null);
            loadFlags();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to resolve alert.' });
        }
    };

    const acknowledgeFlag = async (id) => {
        try {
            await api.patch(`/api/lab-flags/${id}/acknowledge/`);
            setMessage({ type: 'success', text: 'Alert acknowledged.' });
            loadFlags();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to acknowledge alert.' });
        }
    };

    const escalateFlag = async (id) => {
        try {
            await api.patch(`/api/lab-flags/${id}/escalate/`);
            setMessage({ type: 'success', text: 'Alert escalated.' });
            loadFlags();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to escalate alert.' });
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-bell" style={{ marginRight: 8 }}></i>Lab Compliance Alerts
            </h2>

            {message.text && (
                <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 6, background: message.type === 'success' ? '#d1fae5' : '#fee2e2', color: message.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <div style={{ color: '#64748b' }}><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading alerts…</div>
            ) : flags.length === 0 ? (
                <div style={{ color: '#64748b' }}>No active compliance alerts.</div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {flags.map((flag) => (
                        <div key={flag.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <strong style={{ color: '#0f172a' }}>{flag.parameter_key}</strong>
                                <span style={badgeStyle(flag.severity)}>{flag.severity.toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
                                Date: {flag.lab_record_date} • Measured: {flag.measured_value ?? '—'} • Threshold: {flag.threshold_mode} {flag.threshold_value ?? '—'}
                                <br />Status: {flag.status}
                            </div>
                            {flag.corrective_action && (
                                <p style={{ fontSize: '0.85rem', background: '#f0fdf4', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                                    <strong>Corrective action:</strong> {flag.corrective_action}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {role === 'stp_operator' && flag.status === 'open' && (
                                    <button onClick={() => setResolveTarget(flag)} style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Add Corrective Action</button>
                                )}
                                {role === 'stp_supervisor' && flag.status === 'resolved' && (
                                    <button onClick={() => acknowledgeFlag(flag.id)} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Acknowledge</button>
                                )}
                                {role === 'stp_supervisor' && flag.severity === 'red' && flag.status !== 'escalated' && (
                                    <button onClick={() => escalateFlag(flag.id)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Escalate</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {resolveTarget && (
                <CorrectiveActionModal flag={resolveTarget} onClose={() => setResolveTarget(null)} onSubmit={submitResolve} />
            )}
        </div>
    );
};

export default LabAlerts;
