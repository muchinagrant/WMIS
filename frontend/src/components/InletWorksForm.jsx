import React, { useContext, useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const InletWorksSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    abnormalities: Yup.string(),
    shift_notes: Yup.string(),
});

const InletWorksForm = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const [createdTask, setCreatedTask] = useState(null);
    const [records, setRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);
    const role = user?.role || '';

    const initialValues = {
        date: new Date().toISOString().split('T')[0],
        raking_t1: false,
        raking_t2: false,
        raking_t3: false,
        screenings_burial: false,
        grit_scooping: false,
        grit_burial: false,
        t1_grit_buried: false,
        t2_screenings_buried: false,
        abnormalities: '',
        shift_notes: '',
    };

    const loadRecords = async () => {
        if (!isOnline) return;
        setLoadingRecords(true);
        try {
            const res = await api.get('/api/f203a/');
            const rows = res.data?.results || res.data || [];
            setRecords(rows);
        } catch {
            setStatusMsg({ type: 'error', message: 'Failed to load F203A records.' });
        } finally {
            setLoadingRecords(false);
        }
    };

    useEffect(() => {
        if (role === 'stp_attendant' || role === 'stp_operator' || role === 'stp_supervisor') {
            loadRecords();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, isOnline]);

    if (role === 'stp_attendant') {
        return <AttendantF203ADailyCard isOnline={isOnline} refreshQueueCount={refreshQueueCount} loadRecords={loadRecords} records={records} loadingRecords={loadingRecords} statusMsg={statusMsg} setStatusMsg={setStatusMsg} />;
    }

    const handleSign = async (id) => {
        try {
            await api.patch(`/api/f203a/${id}/sign/`);
            setStatusMsg({ type: 'success', message: 'Entry signed successfully.' });
            loadRecords();
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.response?.data?.error || 'Failed to sign entry.' });
        }
    };

    const handleRequestCorrection = async (id) => {
        const correction_note = window.prompt('Enter correction note for attendant:');
        if (!correction_note) return;
        try {
            await api.patch(`/api/f203a/${id}/request_correction/`, { correction_note });
            setStatusMsg({ type: 'success', message: 'Correction requested.' });
            loadRecords();
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.response?.data?.error || 'Failed to request correction.' });
        }
    };

    if (role === 'stp_operator') {
        const pending = records.filter((r) => r.status === 'pending_operator' || r.status === 'returned');
        return (
            <div className="form-section active">
                <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                    <i className="fas fa-signature" style={{ marginRight: 8 }}></i>F203A Pending Co-signs
                </h2>
                {statusMsg.message && (
                    <div style={{ padding: '12px', marginBottom: '14px', borderRadius: 6, background: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: statusMsg.type === 'success' ? '#065f46' : '#991b1b' }}>
                        {statusMsg.message}
                    </div>
                )}
                {loadingRecords ? (
                    <div style={{ color: '#64748b' }}>Loading pending entries...</div>
                ) : pending.length === 0 ? (
                    <div style={{ color: '#64748b' }}>No pending F203A co-sign requests.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {pending.map((task) => (
                            <div key={task.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <strong>{task.date}</strong>
                                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>{task.status}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 10 }}>
                                    Attendant: {task.attendant_name || '—'} • Remarks: {task.abnormalities || '—'}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => handleSign(task.id)} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Sign as STW-OP</button>
                                    <button onClick={() => handleRequestCorrection(task.id)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Request Correction</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (role === 'stp_supervisor') {
        return (
            <div className="form-section active">
                <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                    <i className="fas fa-eye" style={{ marginRight: 8 }}></i>F203A Review
                </h2>
                {loadingRecords ? (
                    <div style={{ color: '#64748b' }}>Loading records...</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {records.map((task) => (
                            <div key={task.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <strong>{task.date}</strong>
                                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 999, background: task.status === 'fully_signed' ? '#d1fae5' : '#fef3c7', color: task.status === 'fully_signed' ? '#065f46' : '#92400e' }}>{task.status}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 6 }}>
                                    Attendant: {task.attendant_name || '—'} • Note: {task.correction_note || '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setStatusMsg({ type: '', message: '' });

        try {
            if (isOnline) {
                const res = await api.post('/api/f203a/', values);
                if (res.status === 201 || res.status === 200) {
                    setStatusMsg({ type: 'success', message: 'Inlet works log submitted successfully.' });
                    setCreatedTask(res.data);
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/f203a/', values, 'POST', { isF203A: true, date: values.date });
                await refreshQueueCount();
                setStatusMsg({ type: 'info', message: 'Inlet works log saved offline and will sync when connection is restored.' });
                setCreatedTask(null);
                resetForm();
            } else {
                setStatusMsg({ type: 'error', message: 'Failed to submit inlet works log.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-filter"></i> F203A Screens & Grit Removal
            </h2>

            {!isOnline && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash"></i>
                    You are offline. Logs will be saved locally.
                </div>
            )}

            {statusMsg.message && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: statusMsg.type === 'success' ? '#d1fae5' :
                                   statusMsg.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: statusMsg.type === 'success' ? '#065f46' :
                           statusMsg.type === 'error' ? '#991b1b' : '#856404'
                }}>
                    <i className={`fas ${
                        statusMsg.type === 'success' ? 'fa-check-circle' :
                        statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ marginRight: '8px' }}></i>
                    {statusMsg.message}
                </div>
            )}

            <Formik
                initialValues={initialValues}
                validationSchema={InletWorksSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting }) => (
                    <Form>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Record Date</label>
                                <Field type="date" name="date" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                                <ErrorMessage name="date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 15px', color: '#0369a1', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-check-square"></i> Daily Tasks
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <label><Field type="checkbox" name="raking_t1" /> Raking T1</label>
                                <label><Field type="checkbox" name="raking_t2" /> Raking T2</label>
                                <label><Field type="checkbox" name="raking_t3" /> Raking T3</label>
                                <label><Field type="checkbox" name="t1_grit_buried" /> T1 Grit Buried</label>
                                <label><Field type="checkbox" name="t2_screenings_buried" /> T2 Screenings Buried</label>
                                <label><Field type="checkbox" name="screenings_burial" /> Screenings Burial</label>
                                <label><Field type="checkbox" name="grit_scooping" /> Grit Scooping</label>
                                <label><Field type="checkbox" name="grit_burial" /> Grit Burial</label>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Abnormalities</label>
                            <Field
                                as="textarea"
                                name="abnormalities"
                                placeholder="Describe any issues"
                                disabled={Boolean(createdTask?.incident_created)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '80px' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Shift Notes</label>
                            <Field
                                as="textarea"
                                name="shift_notes"
                                placeholder="Optional notes"
                                disabled={Boolean(createdTask?.incident_created)}
                                style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '80px' }}
                            />
                        </div>

                        {createdTask?.incident_created && createdTask?.incident_number && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: '#fee2e2', color: '#991b1b',
                                padding: '8px 14px', borderRadius: '6px',
                                fontWeight: 600, fontSize: '0.88rem', marginBottom: '16px',
                                border: '1px solid #fca5a5',
                            }}>
                                <i className="fas fa-link"></i>
                                Incident Created: <span style={{ fontFamily: 'monospace' }}>{createdTask.incident_number}</span>
                            </div>
                        )}

                        {createdTask?.id && !createdTask?.incident_created && (
                            <button
                                type="button"
                                onClick={async () => {
                                    setStatusMsg({ type: 'info', message: 'Escalating to incident...' });
                                    try {
                                        const res = await api.post(`/api/f203a/${createdTask.id}/escalate/`);
                                        setCreatedTask(res.data);
                                        setStatusMsg({ type: 'success', message: 'Escalated to incident. Remarks are now locked.' });
                                    } catch (error) {
                                        setStatusMsg({ type: 'error', message: 'Failed to escalate to incident.' });
                                    }
                                }}
                                disabled={!isOnline}
                                style={{
                                    background: isOnline ? '#f97316' : '#94a3b8',
                                    color: 'white', border: 'none', padding: '10px 20px',
                                    borderRadius: '6px', cursor: isOnline ? 'pointer' : 'not-allowed',
                                    fontSize: '14px', fontWeight: '600', marginBottom: '20px'
                                }}
                            >
                                <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                                Escalate to Incident
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{
                                background: isOnline ? '#0369a1' : '#6c757d',
                                color: 'white', border: 'none', padding: '12px 25px',
                                borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                fontSize: '15px', fontWeight: '600', opacity: isSubmitting ? 0.7 : 1,
                                transition: 'background 0.3s ease'
                            }}
                        >
                            <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i>
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Inlet Works Log' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default InletWorksForm;

const ATTENDANT_TASKS = [
    { key: 'raking_t1', label: 'Morning raking (T1)', reasonKey: 'raking_t1_reason' },
    { key: 'raking_t2', label: 'Midday raking (T2)', reasonKey: 'raking_t2_reason' },
    { key: 'raking_t3', label: 'Afternoon raking (T3)', reasonKey: 'raking_t3_reason' },
    { key: 'screenings_burial', label: 'Screenings burial', reasonKey: 'screenings_burial_reason' },
    { key: 'grit_scooping', label: 'Grit scooping', reasonKey: 'grit_scooping_reason' },
    { key: 'grit_burial', label: 'Grit burial', reasonKey: 'grit_burial_reason' },
];

const AttendantF203ADailyCard = ({ isOnline, refreshQueueCount, loadRecords, records, loadingRecords, statusMsg, setStatusMsg }) => {
    const [draft, setDraft] = useState({
        date: new Date().toISOString().split('T')[0],
        raking_t1: true,
        raking_t2: true,
        raking_t3: true,
        screenings_burial: true,
        grit_scooping: true,
        grit_burial: true,
        raking_t1_reason: '',
        raking_t2_reason: '',
        raking_t3_reason: '',
        screenings_burial_reason: '',
        grit_scooping_reason: '',
        grit_burial_reason: '',
        abnormalities: '',
        shift_notes: '',
    });
    const [saving, setSaving] = useState(false);
    const today = draft.date;
    const todayRecord = records.find((record) => record.date === today) || null;

    useEffect(() => {
        if (!todayRecord) return;
        setDraft((current) => ({
            ...current,
            date: todayRecord.date || current.date,
            raking_t1: Boolean(todayRecord.raking_t1),
            raking_t2: Boolean(todayRecord.raking_t2),
            raking_t3: Boolean(todayRecord.raking_t3),
            screenings_burial: Boolean(todayRecord.screenings_burial),
            grit_scooping: Boolean(todayRecord.grit_scooping),
            grit_burial: Boolean(todayRecord.grit_burial),
            raking_t1_reason: todayRecord.raking_t1_reason || '',
            raking_t2_reason: todayRecord.raking_t2_reason || '',
            raking_t3_reason: todayRecord.raking_t3_reason || '',
            screenings_burial_reason: todayRecord.screenings_burial_reason || '',
            grit_scooping_reason: todayRecord.grit_scooping_reason || '',
            grit_burial_reason: todayRecord.grit_burial_reason || '',
            abnormalities: todayRecord.abnormalities || '',
            shift_notes: todayRecord.shift_notes || '',
        }));
    }, [todayRecord?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

    const submitRecord = async (submitForSignoff) => {
        setSaving(true);
        setStatusMsg({ type: '', message: '' });
        const payload = {
            ...draft,
            submit_for_signoff: submitForSignoff,
        };
        try {
            if (todayRecord) {
                await api.patch(`/api/f203a/${todayRecord.id}/`, payload);
                setStatusMsg({ type: submitForSignoff ? 'success' : 'info', message: submitForSignoff ? 'F203A entry submitted for operator co-sign.' : 'Draft saved.' });
            } else {
                await api.post('/api/f203a/', payload);
                setStatusMsg({ type: submitForSignoff ? 'success' : 'info', message: submitForSignoff ? 'F203A entry submitted for operator co-sign.' : 'Draft saved.' });
            }
            await loadRecords();
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.response?.data?.error || 'Failed to save F203A entry.' });
        } finally {
            setSaving(false);
        }
    };

    const pendingStatus = todayRecord?.status === 'pending_operator';
    const fullySigned = todayRecord?.status === 'fully_signed';
    const returned = todayRecord?.status === 'returned';
    const draftStatus = todayRecord?.status === 'draft' || !todayRecord;

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: '18px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-filter"></i> F203A Inlet Works Daily Card
            </h2>

            {statusMsg.message && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#e0f2fe',
                    color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#0369a1'
                }}>
                    <i className={`fas ${statusMsg.type === 'success' ? 'fa-check-circle' : statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} style={{ marginRight: '8px' }}></i>
                    {statusMsg.message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16, alignItems: 'start' }}>
                <div style={{ background: 'white', border: '1px solid #dbeafe', borderRadius: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>Today's Task Checklist</div>
                            <h3 style={{ margin: 0, color: '#0f172a' }}>{today}</h3>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Mark tasks performed or not performed, then save a draft or submit for operator co-sign.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <span style={statusBadge(fullySigned ? 'green' : pendingStatus ? 'amber' : returned ? 'red' : 'slate')}>
                                {fullySigned ? 'Fully signed' : pendingStatus ? 'Awaiting operator co-sign' : returned ? 'Returned for correction' : 'Draft'}
                            </span>
                        </div>
                    </div>

                    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                        {ATTENDANT_TASKS.map((task) => (
                            <TaskRow
                                key={task.key}
                                task={task}
                                value={draft[task.key]}
                                reason={draft[task.reasonKey]}
                                disabled={fullySigned}
                                onToggle={(nextValue) => setField(task.key, nextValue)}
                                onReasonChange={(value) => setField(task.reasonKey, value)}
                            />
                        ))}

                        <div style={noteGridStyle}>
                            <div>
                                <label style={labelStyle}>Abnormalities / remarks</label>
                                <textarea value={draft.abnormalities} onChange={(e) => setField('abnormalities', e.target.value)} disabled={fullySigned} rows={4} style={textareaStyle(fullySigned)} placeholder="Describe abnormalities or observed issues." />
                            </div>
                            <div>
                                <label style={labelStyle}>Shift notes</label>
                                <textarea value={draft.shift_notes} onChange={(e) => setField('shift_notes', e.target.value)} disabled={fullySigned} rows={4} style={textareaStyle(fullySigned)} placeholder="Optional shift notes." />
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ color: '#64748b', fontSize: '0.88rem' }}>
                            Save a draft at any time. Submit only when the row is complete and reasons are filled for any not-performed task.
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => submitRecord(false)} disabled={saving || fullySigned} style={secondaryButtonStyle}>
                                <i className="fas fa-save" style={{ marginRight: 6 }}></i>
                                {saving ? 'Saving…' : 'Save Draft'}
                            </button>
                            <button type="button" onClick={() => submitRecord(true)} disabled={saving || fullySigned} style={primaryButtonStyle}>
                                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} style={{ marginRight: 6 }}></i>
                                {saving ? 'Submitting…' : 'Submit for Co-sign'}
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                    <SummaryCard title="Today's Status" value={draftStatus ? 'Not yet submitted' : todayRecord?.status === 'pending_operator' ? 'Pending operator' : todayRecord?.status === 'returned' ? 'Returned' : 'Fully signed'} tone={draftStatus ? 'slate' : todayRecord?.status === 'fully_signed' ? 'green' : todayRecord?.status === 'returned' ? 'red' : 'amber'} />
                    <SummaryCard title="Current Co-sign Queue" value={pendingStatus ? 'In queue' : 'Not in queue'} tone={pendingStatus ? 'amber' : 'slate'} />
                    <SummaryCard title="Recent Submissions" value={records.slice(0, 5).length} tone="slate" subtitle="Last 5 F203A entries" />
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Quick reminder</div>
                        <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
                            If a task was not performed, the reason field becomes mandatory before submission. The operator will see the row only after you submit for co-sign.
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 18, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Recent Submissions</div>
                {loadingRecords ? (
                    <div style={{ color: '#64748b' }}>Loading records...</div>
                ) : records.length === 0 ? (
                    <div style={{ color: '#64748b' }}>No submissions yet.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {records.slice(0, 5).map((task) => (
                            <div key={task.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                    <strong>{task.date}</strong>
                                    <span style={statusBadge(task.status === 'fully_signed' ? 'green' : task.status === 'pending_operator' ? 'amber' : task.status === 'returned' ? 'red' : 'slate')}>
                                        {task.status === 'fully_signed' ? 'Fully signed' : task.status === 'pending_operator' ? 'Pending co-sign' : task.status === 'returned' ? 'Returned' : 'Draft'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 6 }}>
                                    Attendant: {task.attendant_name || '—'} • Operator note: {task.correction_note || '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const TaskRow = ({ task, value, reason, disabled, onToggle, onReasonChange }) => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{task.label}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Choose performed or not performed. If not performed, add a reason.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <TogglePill active={value === true} color="green" onClick={() => onToggle(true)} disabled={disabled}>Performed</TogglePill>
                <TogglePill active={value === false} color="red" onClick={() => onToggle(false)} disabled={disabled}>Not performed</TogglePill>
            </div>
        </div>
        {value === false && (
            <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Reason required</label>
                <textarea value={reason} onChange={(e) => onReasonChange(e.target.value)} disabled={disabled} rows={2} style={textareaStyle(disabled)} placeholder="Explain why the task was not performed." />
            </div>
        )}
    </div>
);

const TogglePill = ({ active, color, onClick, disabled, children }) => {
    const palette = {
        green: { activeBg: '#dcfce7', activeColor: '#166534' },
        red: { activeBg: '#fee2e2', activeColor: '#991b1b' },
    };
    const activeStyle = palette[color] || palette.green;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                border: '1px solid ' + (active ? (color === 'red' ? '#fca5a5' : '#86efac') : '#cbd5e1'),
                background: active ? activeStyle.activeBg : 'white',
                color: active ? activeStyle.activeColor : '#334155',
                borderRadius: 999,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            {children}
        </button>
    );
};

const SummaryCard = ({ title, value, tone = 'slate', subtitle }) => {
    const colors = {
        green: { bg: '#dcfce7', fg: '#166534' },
        amber: { bg: '#fef3c7', fg: '#92400e' },
        red: { bg: '#fee2e2', fg: '#991b1b' },
        slate: { bg: '#e2e8f0', fg: '#334155' },
    };
    const palette = colors[tone] || colors.slate;
    return (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: palette.bg, color: palette.fg, fontWeight: 800, padding: '6px 10px' }}>{value}</div>
            {subtitle && <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.85rem' }}>{subtitle}</div>}
        </div>
    );
};

const statusBadge = (tone) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
    background: tone === 'green' ? '#dcfce7' : tone === 'amber' ? '#fef3c7' : tone === 'red' ? '#fee2e2' : '#e2e8f0',
    color: tone === 'green' ? '#166534' : tone === 'amber' ? '#92400e' : tone === 'red' ? '#991b1b' : '#334155',
});

const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 700, color: '#334155', fontSize: '0.86rem' };
const textareaStyle = (disabled) => ({ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical', minHeight: 76, background: disabled ? '#f8fafc' : 'white', color: disabled ? '#94a3b8' : '#0f172a' });
const secondaryButtonStyle = { background: 'white', color: '#0369a1', border: '1px solid #93c5fd', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 };
const primaryButtonStyle = { background: '#0369a1', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 };
const noteGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
