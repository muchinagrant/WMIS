import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const TreatmentLogSchema = Yup.object().shape({
    report_date: Yup.date().required('Date is required'),
    shift: Yup.string().oneOf(['Day', 'Night']).required('Shift is required'),
    parameters: Yup.array().of(
        Yup.object().shape({
            parameter: Yup.string().required('Parameter name required'),
            influent_value: Yup.number().typeError('Must be a number').nullable(),
            effluent_value: Yup.number().typeError('Must be a number').nullable(),
        })
    ),
});

const bandColor = (pct) => {
    if (pct == null || Number.isNaN(pct)) return '#64748b';
    if (pct >= 80) return '#16a34a';
    if (pct >= 60) return '#ca8a04';
    return '#dc2626';
};

const statusBadge = (status) => {
    const map = {
        pending_review: { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
        correction_requested: { bg: '#fee2e2', color: '#991b1b', label: 'Correction Requested' },
        supervisor_approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
    };
    const s = map[status] || { bg: '#f1f5f9', color: '#475569', label: status };
    return (
        <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>
            {s.label}
        </span>
    );
};

const logEfficiency = (log) => {
    const bod = (log.parameters || []).find((p) => (p.parameter || '').toLowerCase().includes('bod'));
    if (!bod || !bod.influent_value || !bod.effluent_value) return null;
    const inf = parseFloat(bod.influent_value);
    const eff = parseFloat(bod.effluent_value);
    if (!inf || inf <= 0) return null;
    return ((inf - eff) / inf) * 100;
};

const TreatmentLogReview = () => {
    const [logs, setLogs] = useState([]);
    const [selected, setSelected] = useState(null);
    const [comment, setComment] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/treatment-logs/');
            const all = res.data?.results || res.data || [];
            const filtered = all.filter((l) => {
                const d = new Date(l.report_date);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            });
            setLogs(filtered.sort((a, b) => (a.report_date < b.report_date ? 1 : -1)));
        } catch {
            setMsg({ type: 'error', text: 'Failed to load treatment logs.' });
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        load();
    }, [load]);

    const openLog = (log) => {
        setSelected(log);
        setComment(log.supervisor_comment || '');
    };

    const runAction = async (action, body = {}) => {
        if (!selected) return;
        try {
            const res = await api.patch(`/api/treatment-logs/${selected.id}/${action}/`, body);
            setMsg({ type: 'success', text: 'Updated successfully.' });
            setSelected(res.data);
            load();
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Action failed.' });
        }
    };

    return (
        <div>
            <h2 style={{ color: '#0369a1', marginBottom: 20, paddingBottom: 15, borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-clipboard-check" style={{ marginRight: 8 }}></i>
                Treatment Log Review
            </h2>
            <p style={{ color: '#64748b', marginBottom: 16 }}>
                Review operator submissions for the selected month. Approve, comment, or request corrections.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                </select>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {msg.text && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {msg.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.2fr' : '1fr', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, maxHeight: 520, overflow: 'auto' }}>
                    {loading ? <p style={{ color: '#64748b' }}>Loading…</p> : logs.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No treatment logs for this month.</p>
                    ) : logs.map((log) => {
                        const eff = logEfficiency(log);
                        return (
                            <button
                                key={log.id}
                                type="button"
                                onClick={() => openLog(log)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', marginBottom: 8,
                                    padding: 12, border: selected?.id === log.id ? '2px solid #0369a1' : '1px solid #e2e8f0',
                                    borderRadius: 8, background: selected?.id === log.id ? '#eff6ff' : '#fff', cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>{log.report_date}</strong>
                                    {statusBadge(log.review_status)}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                                    {log.operator_name || 'Operator'} • {log.shift}
                                    {eff != null && (
                                        <span style={{ marginLeft: 8, color: bandColor(eff), fontWeight: 600 }}>
                                            BOD eff: {eff.toFixed(1)}%
                                        </span>
                                    )}
                                    {log.alert && <span style={{ marginLeft: 8, color: '#dc2626' }}>ALERT</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selected && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                        <h3 style={{ margin: '0 0 12px' }}>{selected.report_date} — {selected.shift}</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: 12 }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: 8, textAlign: 'left' }}>Parameter</th>
                                    <th style={{ padding: 8 }}>Influent</th>
                                    <th style={{ padding: 8 }}>Effluent</th>
                                    <th style={{ padding: 8 }}>Eff %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(selected.parameters || []).map((p) => (
                                    <tr key={p.id || p.parameter} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: 8 }}>{p.parameter}</td>
                                        <td style={{ padding: 8, textAlign: 'center' }}>{p.influent_value ?? '—'}</td>
                                        <td style={{ padding: 8, textAlign: 'center' }}>{p.effluent_value ?? '—'}</td>
                                        <td style={{ padding: 8, textAlign: 'center', color: bandColor(p.removal_percent), fontWeight: 600 }}>
                                            {p.removal_percent != null ? `${p.removal_percent}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {selected.correction_note && (
                            <p style={{ fontSize: '0.85rem', background: '#fee2e2', padding: 10, borderRadius: 6 }}>
                                <strong>Prior correction note:</strong> {selected.correction_note}
                            </p>
                        )}
                        <label style={{ display: 'block', marginTop: 12, fontWeight: 600, fontSize: '0.9rem' }}>Supervisor comment</label>
                        <textarea
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 10 }}
                        />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => runAction('add_comment', { supervisor_comment: comment })} style={btn('#334155')}>Save Comment</button>
                            <button type="button" onClick={() => runAction('approve_review', { supervisor_comment: comment })} style={btn('#16a34a')}>Approve</button>
                            <button
                                type="button"
                                onClick={() => {
                                    const note = window.prompt('Correction required — explain what the operator must fix:');
                                    if (note) runAction('request_correction', { correction_note: note });
                                }}
                                style={btn('#dc2626')}
                            >
                                Request Correction
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const btn = (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
});

const TreatmentLogEntry = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    const initialValues = {
        report_date: new Date().toISOString().split('T')[0],
        shift: 'Day',
        parameters: [
            { parameter: 'BOD (mg/l)', influent_value: '', effluent_value: '' },
            { parameter: 'TSS (mg/l)', influent_value: '', effluent_value: '' },
            { parameter: 'pH', influent_value: '', effluent_value: '' },
        ],
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setStatusMsg({ type: '', message: '' });
        const payload = {
            report_date: values.report_date,
            shift: values.shift,
            parameters: values.parameters
                .filter((p) => p.influent_value !== '' || p.effluent_value !== '')
                .map((p) => ({
                    parameter: p.parameter,
                    influent_value: p.influent_value || 0,
                    effluent_value: p.effluent_value || 0,
                })),
        };

        try {
            if (isOnline) {
                const res = await api.post('/api/treatment-logs/', payload);
                if (res.status === 201) {
                    setStatusMsg({ type: 'success', message: 'Treatment Plant Efficiency log submitted successfully!' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/treatment-logs/', payload, 'POST', { isTreatmentLog: true, date: values.report_date, shift: values.shift });
                await refreshQueueCount();
                setStatusMsg({ type: 'info', message: 'Treatment log saved offline and will sync when connection is restored.' });
                resetForm();
            } else {
                setStatusMsg({ type: 'error', message: error.response?.data?.error || 'Failed to submit treatment log.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <h2 style={{ color: '#0369a1', marginBottom: 25, paddingBottom: 15, borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-leaf"></i> Treatment Plant Efficiency Log
            </h2>

            {!isOnline && (
                <div style={{ padding: 15, marginBottom: 20, borderRadius: 6, backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }}>
                    <i className="fas fa-wifi-slash"></i> You are offline. Logs will be saved locally.
                </div>
            )}

            {statusMsg.message && (
                <div style={{
                    padding: 15, marginBottom: 20, borderRadius: 6,
                    backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#856404',
                }}>
                    {statusMsg.message}
                </div>
            )}

            <Formik initialValues={initialValues} validationSchema={TreatmentLogSchema} onSubmit={handleSubmit}>
                {({ isSubmitting, values }) => (
                    <Form>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Report Date *</label>
                                <Field type="date" name="report_date" style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6 }} />
                                <ErrorMessage name="report_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: 5 }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Shift *</label>
                                <Field as="select" name="shift" style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6 }}>
                                    <option value="Day">Day</option>
                                    <option value="Night">Night</option>
                                </Field>
                            </div>
                        </div>

                        <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 30 }}>
                            <h3 style={{ margin: '0 0 20px', color: '#0369a1' }}>Treatment Plant Parameters</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: '#0369a1', color: 'white', padding: 12, textAlign: 'left' }}>Parameter</th>
                                        <th style={{ background: '#0369a1', color: 'white', padding: 12, textAlign: 'center' }}>Influent</th>
                                        <th style={{ background: '#0369a1', color: 'white', padding: 12, textAlign: 'center' }}>Effluent</th>
                                        <th style={{ background: '#0369a1', color: 'white', padding: 12, textAlign: 'center' }}>Efficiency %</th>
                                    </tr>
                                </thead>
                                <FieldArray name="parameters">
                                    {() => (
                                        <tbody>
                                            {values.parameters.map((param, index) => {
                                                const inf = parseFloat(values.parameters[index].influent_value);
                                                const eff = parseFloat(values.parameters[index].effluent_value);
                                                let liveEff = '—';
                                                let effColor = '#64748b';
                                                if (inf && eff && !Number.isNaN(inf) && !Number.isNaN(eff) && inf > 0) {
                                                    const calc = ((inf - eff) / inf) * 100;
                                                    liveEff = `${calc.toFixed(2)}%`;
                                                    effColor = bandColor(calc);
                                                }
                                                return (
                                                    <tr key={index} style={{ borderBottom: '1px solid #e0e7ff' }}>
                                                        <td style={{ padding: 12, fontWeight: 600 }}>{param.parameter}</td>
                                                        <td style={{ padding: 8, textAlign: 'center' }}>
                                                            <Field type="number" step="0.1" name={`parameters.${index}.influent_value`} style={{ width: 110, padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center' }} />
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'center' }}>
                                                            <Field type="number" step="0.1" name={`parameters.${index}.effluent_value`} style={{ width: 110, padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center' }} />
                                                        </td>
                                                        <td style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: effColor }}>{liveEff}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    )}
                                </FieldArray>
                            </table>
                        </div>

                        <div style={{ marginBottom: 25 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Operator</label>
                            <input type="text" disabled value={user?.full_name || 'Current User'} style={{ width: '100%', padding: 12, background: '#f3f4f6', border: '1px solid #cbd5e1', borderRadius: 6 }} />
                        </div>

                        <button type="submit" disabled={isSubmitting} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '12px 25px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            {isSubmitting ? 'Submitting…' : 'Submit Treatment Log'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

const TreatmentLogReadOnly = () => {
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        api.get('/api/treatment-logs/').then((res) => setLogs(res.data?.results || res.data || [])).catch(() => {});
    }, []);

    return (
        <div>
            <h2 style={{ color: '#0369a1', marginBottom: 16, borderBottom: '2px solid #e0f0fa', paddingBottom: 12 }}>
                <i className="fas fa-industry" style={{ marginRight: 8 }}></i>
                Treatment Logs (Read-only)
            </h2>
            <p style={{ color: '#64748b', marginBottom: 16 }}>Cross-reference operator entries against your lab results.</p>
            <div style={{ display: 'grid', gap: 10 }}>
                {logs.slice(0, 20).map((log) => (
                    <div key={log.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                        <strong>{log.report_date}</strong> — {log.operator_name} ({log.shift})
                        {log.alert && <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600 }}>ALERT</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const TreatmentLogForm = () => {
    const { user } = useContext(AuthContext);
    const role = user?.role || '';

    if (role === 'stp_supervisor') {
        return (
            <div className="form-section active">
                <TreatmentLogReview />
            </div>
        );
    }

    if (role === 'lab_tech') {
        return (
            <div className="form-section active">
                <TreatmentLogReadOnly />
            </div>
        );
    }

    return (
        <div className="form-section active">
            <TreatmentLogEntry />
        </div>
    );
};

export default TreatmentLogForm;
