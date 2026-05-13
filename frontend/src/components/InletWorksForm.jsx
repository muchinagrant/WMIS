import React, { useContext, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';

const InletWorksSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    abnormalities: Yup.string(),
    shift_notes: Yup.string(),
});

const InletWorksForm = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const [createdTask, setCreatedTask] = useState(null);
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

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
