import React, { useContext, useEffect, useState } from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const TIME_SLOTS = [
    { value: '09:00', label: '9:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '15:00', label: '3:00 PM' },
    { value: '18:00', label: '6:00 PM' },
];

const FlowSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    remarks: Yup.string(),
    readings: Yup.array().of(
        Yup.object().shape({
            time_slot: Yup.string().required('Time slot required'),
            meter_1: Yup.number().typeError('Must be a number').nullable(),
            meter_2: Yup.number().typeError('Must be a number').nullable(),
        })
    )
});

const FlowRecordsForm = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const [records, setRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [showMonthlyRecord, setShowMonthlyRecord] = useState(false);
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);
    const role = user?.role || '';

    const initialValues = {
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        readings: TIME_SLOTS.map((slot) => ({
            time_slot: slot.value,
            meter_1: '',
            meter_2: '',
        })),
    };

    const loadRecords = async () => {
        if (!isOnline) return;
        setLoadingRecords(true);
        try {
            const res = await api.get('/api/flow-records/');
            setRecords(res.data?.results || res.data || []);
        } catch {
            setStatusMsg({ type: 'error', message: 'Failed to load flow records.' });
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
        return (
            <AttendantF203CDailyCard
                isOnline={isOnline}
                refreshQueueCount={refreshQueueCount}
                loadRecords={loadRecords}
                records={records}
                loadingRecords={loadingRecords}
                statusMsg={statusMsg}
                setStatusMsg={setStatusMsg}
                showMonthlyRecord={showMonthlyRecord}
                setShowMonthlyRecord={setShowMonthlyRecord}
            />
        );
    }

    const addOperatorNote = async (id) => {
        const operator_note = window.prompt('Add operator note:');
        if (!operator_note) return;
        try {
            await api.patch(`/api/flow-records/${id}/add_operator_note/`, { operator_note });
            setStatusMsg({ type: 'success', message: 'Operator note saved.' });
            loadRecords();
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.response?.data?.error || 'Failed to save note.' });
        }
    };

    const addSupervisorNote = async (id) => {
        const supervisor_note = window.prompt('Add supervisor note:');
        if (!supervisor_note) return;
        try {
            await api.patch(`/api/flow-records/${id}/add_supervisor_note/`, { supervisor_note });
            setStatusMsg({ type: 'success', message: 'Supervisor note saved.' });
            loadRecords();
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.response?.data?.error || 'Failed to save note.' });
        }
    };

    if (role === 'stp_operator' || role === 'stp_supervisor') {
        return (
            <div className="form-section active">
                <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                    <i className="fas fa-water" style={{ marginRight: 8 }}></i>F203C Flow Records Review
                </h2>
                {statusMsg.message && (
                    <div style={{ padding: '12px', marginBottom: '14px', borderRadius: 6, background: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: statusMsg.type === 'success' ? '#065f46' : '#991b1b' }}>
                        {statusMsg.message}
                    </div>
                )}
                {loadingRecords ? (
                    <div style={{ color: '#64748b' }}>Loading flow records...</div>
                ) : records.length === 0 ? (
                    <div style={{ color: '#64748b' }}>No flow records submitted yet.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {records.map((r) => (
                            <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <strong>{r.date}</strong>
                                    <span style={{ color: '#0f766e', fontSize: '0.85rem' }}>Avg: {r.average_daily_flow ?? '—'} m³/day</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
                                    Remarks: {r.remarks || '—'}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 10 }}>
                                    Operator note: {r.operator_note || '—'} • Supervisor note: {r.supervisor_note || '—'}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {role === 'stp_operator' && <button onClick={() => addOperatorNote(r.id)} style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Add Operator Note</button>}
                                    {role === 'stp_supervisor' && <button onClick={() => addSupervisorNote(r.id)} style={{ background: '#334155', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Add Supervisor Note</button>}
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

        const payload = {
            date: values.date,
            remarks: values.remarks || '',
            readings: values.readings.map((r) => ({
                time_slot: r.time_slot,
                meter_1: r.meter_1 === '' ? null : Number(r.meter_1),
                meter_2: r.meter_2 === '' ? null : Number(r.meter_2),
            }))
        };

        try {
            if (isOnline) {
                const res = await api.post('/api/flow-records/', payload);
                if (res.status === 201 || res.status === 200) {
                    setStatusMsg({ type: 'success', message: 'Flow record submitted successfully.' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/flow-records/', payload, 'POST', { isFlowRecord: true, date: values.date });
                await refreshQueueCount();
                setStatusMsg({ type: 'info', message: 'Flow record saved offline and will sync when connection is restored.' });
                resetForm();
            } else {
                setStatusMsg({ type: 'error', message: 'Failed to submit flow record.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-water"></i> F203C Flow Measurement
            </h2>

            {!isOnline && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash"></i>
                    You are offline. Records will be saved locally.
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
                validationSchema={FlowSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values }) => (
                    <Form>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Record Date</label>
                                <Field type="date" name="date" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                                <ErrorMessage name="date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Remarks</label>
                                <Field type="text" name="remarks" placeholder="Optional notes" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                            </div>
                        </div>

                        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '25px' }}>
                            <h3 style={{ margin: '0 0 15px', color: '#0369a1', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-table"></i> Meter Readings
                            </h3>

                            <div className="scrollable-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Time Slot</th>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'center', fontWeight: '600' }}>Meter 1 (m3/hr)</th>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'center', fontWeight: '600' }}>Meter 2 (m3/hr)</th>
                                        </tr>
                                    </thead>
                                    <FieldArray name="readings">
                                        {() => (
                                            <tbody>
                                                {values.readings.map((reading, index) => (
                                                    <tr key={reading.time_slot} style={{ borderBottom: '1px solid #e0e7ff' }}>
                                                        <td style={{ padding: '12px', fontWeight: '600', color: '#1e293b' }}>
                                                            {TIME_SLOTS[index]?.label || reading.time_slot}
                                                            <Field type="hidden" name={`readings.${index}.time_slot`} />
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            <Field
                                                                type="number"
                                                                step="0.01"
                                                                name={`readings.${index}.meter_1`}
                                                                placeholder="0.00"
                                                                style={{ width: '120px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            <Field
                                                                type="number"
                                                                step="0.01"
                                                                name={`readings.${index}.meter_2`}
                                                                placeholder="0.00"
                                                                style={{ width: '120px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        )}
                                    </FieldArray>
                                </table>
                            </div>
                        </div>

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
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Flow Record' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default FlowRecordsForm;

const AttendantF203CDailyCard = ({ isOnline, refreshQueueCount, loadRecords, records, loadingRecords, statusMsg, setStatusMsg, showMonthlyRecord, setShowMonthlyRecord }) => {
    const today = new Date().toISOString().split('T')[0];
    const [draft, setDraft] = useState({
        date: today,
        remarks: '',
        readings: TIME_SLOTS.map((slot) => ({ time_slot: slot.value, meter_1: '', meter_2: '' })),
    });
    const [saving, setSaving] = useState(false);

    const currentMonthPrefix = today.slice(0, 7);
    const monthlyRecords = records.filter((record) => String(record.date || '').startsWith(currentMonthPrefix));
    const todayRecord = monthlyRecords.find((record) => record.date === today) || null;

    useEffect(() => {
        if (!todayRecord) return;
        const readingMap = new Map((todayRecord.readings || []).map((reading) => [reading.time_slot, reading]));
        setDraft({
            date: todayRecord.date || today,
            remarks: todayRecord.remarks || '',
            readings: TIME_SLOTS.map((slot) => {
                const existing = readingMap.get(slot.value) || {};
                return {
                    time_slot: slot.value,
                    meter_1: existing.meter_1 !== null && existing.meter_1 !== undefined ? String(existing.meter_1) : '',
                    meter_2: existing.meter_2 !== null && existing.meter_2 !== undefined ? String(existing.meter_2) : '',
                };
            }),
        });
    }, [todayRecord?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const slotValue = (slot, key) => draft.readings.find((reading) => reading.time_slot === slot)?.[key] ?? '';

    const updateSlot = (slot, key, value) => {
        setDraft((current) => ({
            ...current,
            readings: current.readings.map((reading) => (
                reading.time_slot === slot ? { ...reading, [key]: value } : reading
            )),
        }));
    };

    const computeAverage = () => {
        const slotAverages = draft.readings
            .map((reading) => {
                const values = [reading.meter_1, reading.meter_2]
                    .filter((value) => value !== '' && value !== null && value !== undefined)
                    .map(Number)
                    .filter((value) => !Number.isNaN(value));
                if (!values.length) return null;
                return values.reduce((sum, value) => sum + value, 0) / values.length;
            })
            .filter((value) => value !== null);

        if (!slotAverages.length) return null;
        return ((slotAverages.reduce((sum, value) => sum + value, 0) / slotAverages.length) * 24).toFixed(3);
    };

    const buildPayload = () => {
        const mergedReadings = TIME_SLOTS.map((slot) => {
            const draftReading = draft.readings.find((reading) => reading.time_slot === slot.value) || {};
            const existingReading = (todayRecord?.readings || []).find((reading) => reading.time_slot === slot.value) || {};
            const meter1 = draftReading.meter_1 !== '' ? draftReading.meter_1 : existingReading.meter_1;
            const meter2 = draftReading.meter_2 !== '' ? draftReading.meter_2 : existingReading.meter_2;
            if ((meter1 === '' || meter1 === null || meter1 === undefined) && (meter2 === '' || meter2 === null || meter2 === undefined)) {
                return null;
            }
            return {
                time_slot: slot.value,
                meter_1: meter1 === '' || meter1 === null || meter1 === undefined ? null : Number(meter1),
                meter_2: meter2 === '' || meter2 === null || meter2 === undefined ? null : Number(meter2),
            };
        }).filter(Boolean);

        return {
            date: today,
            remarks: draft.remarks,
            readings: mergedReadings,
        };
    };

    const handleSave = async () => {
        setSaving(true);
        setStatusMsg({ type: '', message: '' });
        const payload = buildPayload();

        try {
            if (todayRecord) {
                await api.patch(`/api/flow-records/${todayRecord.id}/`, payload);
                setStatusMsg({ type: 'success', message: 'Flow record saved.' });
            } else {
                await api.post('/api/flow-records/', payload);
                setStatusMsg({ type: 'success', message: 'Flow record saved.' });
            }
            await loadRecords();
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/flow-records/', payload, 'POST', { isFlowRecord: true, date: today });
                await refreshQueueCount();
                setStatusMsg({ type: 'info', message: 'Flow record saved offline and will sync when connection is restored.' });
            } else {
                setStatusMsg({ type: 'error', message: error.response?.data?.error || 'Failed to save flow record.' });
            }
        } finally {
            setSaving(false);
        }
    };

    const averageDailyFlow = computeAverage();

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-water"></i> F203C Daily Flow Card
            </h2>

            {statusMsg.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#fff3cd', color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#856404' }}>
                    <i className={`fas ${statusMsg.type === 'success' ? 'fa-check-circle' : statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} style={{ marginRight: '8px' }}></i>
                    {statusMsg.message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 16, alignItems: 'start' }}>
                <div style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Today's Flow Entry</div>
                            <h3 style={{ margin: 0, color: '#0f172a' }}>{today}</h3>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Enter any readings available now. Leave blank time slots for later partial saves.</p>
                        </div>
                        <div style={badgeStyle(todayRecord ? '#dcfce7' : '#e2e8f0', todayRecord ? '#166534' : '#334155')}>
                            {todayRecord ? 'Saved today' : 'Not yet saved'}
                        </div>
                    </div>

                    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                        {TIME_SLOTS.map((slot) => (
                            <div key={slot.value} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{slot.label}</div>
                                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Fill one or both meter readings for this slot.</div>
                                    </div>
                                    <div style={badgeStyle('#e0f2fe', '#0369a1')}>{slot.value}</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label style={labelStyle}>Meter 1 (m³)</label>
                                        <input type="number" step="0.01" value={slotValue(slot.value, 'meter_1')} onChange={(e) => updateSlot(slot.value, 'meter_1', e.target.value)} style={inputStyle} placeholder="Optional" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Meter 2 (m³)</label>
                                        <input type="number" step="0.01" value={slotValue(slot.value, 'meter_2')} onChange={(e) => updateSlot(slot.value, 'meter_2', e.target.value)} style={inputStyle} placeholder="Optional" />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div>
                            <label style={labelStyle}>Remarks</label>
                            <textarea value={draft.remarks} onChange={(e) => setDraft((current) => ({ ...current, remarks: e.target.value }))} rows={3} style={textareaStyle} placeholder="Optional notes for the day." />
                        </div>

                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                            <div style={{ color: '#0369a1', fontWeight: 700 }}>Average Daily Flow</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f766e' }}>{averageDailyFlow ? `${averageDailyFlow} m³/day` : '—'}</div>
                        </div>
                    </div>

                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <button type="button" onClick={() => setShowMonthlyRecord((value) => !value)} style={secondaryButton}>
                            {showMonthlyRecord ? 'Hide Monthly Record' : 'View Monthly Record'}
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving} style={primaryButton}>
                            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ marginRight: '8px' }}></i>
                            {saving ? 'Saving...' : 'Save Flow Record'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                    <InfoCard title="Status" value={todayRecord ? 'Saved today' : 'Not yet saved'} tone={todayRecord ? 'green' : 'slate'} />
                    <InfoCard title="Average Daily Flow" value={averageDailyFlow || '—'} suffix={averageDailyFlow ? ' m³/day' : ''} tone={averageDailyFlow ? 'amber' : 'slate'} />
                    <InfoCard title="Saved Records" value={monthlyRecords.length} tone="slate" subtitle="Monthly entries loaded" />
                </div>
            </div>

            {showMonthlyRecord && (
                <div style={{ marginTop: 18, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Monthly Record</div>
                    {loadingRecords ? (
                        <div style={{ color: '#64748b' }}>Loading monthly record...</div>
                    ) : monthlyRecords.length === 0 ? (
                        <div style={{ color: '#64748b' }}>No records yet for this month.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHead}>Date</th>
                                        <th style={tableHead}>9 AM</th>
                                        <th style={tableHead}>12 PM</th>
                                        <th style={tableHead}>3 PM</th>
                                        <th style={tableHead}>6 PM</th>
                                        <th style={tableHead}>Average</th>
                                        <th style={tableHead}>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyRecords.map((record) => (
                                        <tr key={record.id}>
                                            <td style={tableCell}>{record.date}</td>
                                            {TIME_SLOTS.map((slot) => {
                                                const row = (record.readings || []).find((reading) => reading.time_slot === slot.value);
                                                return <td key={slot.value} style={tableCell}>{row ? `${row.meter_1 ?? '—'} / ${row.meter_2 ?? '—'}` : '—'}</td>;
                                            })}
                                            <td style={tableCell}>{record.average_daily_flow ?? '—'}</td>
                                            <td style={tableCell}>{record.remarks || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const InfoCard = ({ title, value, tone = 'slate', subtitle }) => (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
        <div style={badgeStyle(tone === 'green' ? '#dcfce7' : tone === 'amber' ? '#fef3c7' : '#e2e8f0', tone === 'green' ? '#166534' : tone === 'amber' ? '#92400e' : '#334155')}>{value}</div>
        {subtitle && <div style={{ marginTop: 8, color: '#64748b', fontSize: '0.85rem' }}>{subtitle}</div>}
    </div>
);

const badgeStyle = (background, color) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background, color, padding: '6px 10px', fontWeight: 800, fontSize: '0.78rem' });

const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 700, color: '#334155', fontSize: '0.86rem' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' };
const textareaStyle = { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical', fontSize: '0.9rem' };
const secondaryButton = { background: 'white', color: '#0369a1', border: '1px solid #93c5fd', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 };
const primaryButton = { background: '#0369a1', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 };
const tableHead = { background: '#0f4c81', color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '0.82rem' };
const tableCell = { padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '0.84rem', whiteSpace: 'nowrap' };
