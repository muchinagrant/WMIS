import React, { useState, useContext } from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const DailyPlantSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    readings: Yup.array().of(
        Yup.object().shape({
            meter_1: Yup.number().min(0, 'Must be positive').nullable().transform((v) => (v === '' || isNaN(v) ? null : v)),
            meter_2: Yup.number().min(0, 'Must be positive').nullable().transform((v) => (v === '' || isNaN(v) ? null : v))
        })
    ),
    abnormalities: Yup.string(),
    remarks: Yup.string()
});

const TreatmentLogForm = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    const initialValues = {
        date: new Date().toISOString().split('T')[0],
        readings: [
            { time_slot: '09:00', label: '9:00 AM', meter_1: '', meter_2: '' },
            { time_slot: '12:00', label: '12:00 PM', meter_1: '', meter_2: '' },
            { time_slot: '15:00', label: '3:00 PM', meter_1: '', meter_2: '' },
            { time_slot: '18:00', label: '6:00 PM', meter_1: '', meter_2: '' }
        ],
        raking_t1: false,
        raking_t2: false,
        raking_t3: false,
        screenings_burial: false,
        grit_scooping: false,
        grit_burial: false,
        abnormalities: '',
        remarks: ''
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });

        const flowPayload = {
            date: values.date,
            remarks: values.remarks,
            readings: values.readings
                .filter(r => r.meter_1 !== '' || r.meter_2 !== '')
                .map(r => ({
                    time_slot: r.time_slot,
                    meter_1: r.meter_1 || 0,
                    meter_2: r.meter_2 || 0
                }))
        };

        const taskPayload = {
            date: values.date,
            raking_t1: values.raking_t1,
            raking_t2: values.raking_t2,
            raking_t3: values.raking_t3,
            screenings_burial: values.screenings_burial,
            grit_scooping: values.grit_scooping,
            grit_burial: values.grit_burial,
            abnormalities: values.abnormalities
        };

        try {
            if (isOnline) {
                const [flowRes, taskRes] = await Promise.all([
                    api.post('/api/daily-flow-records/', flowPayload),
                    api.post('/api/inlet-daily-tasks/', taskPayload)
                ]);

                if (flowRes.status === 201 && taskRes.status === 201) {
                    setSubmitStatus({ type: 'success', message: 'Inlet Works Logs (Flow & Screens) submitted successfully!' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/daily-flow-records/', flowPayload, 'POST', { isFlowRecord: true, date: values.date });
                await addToQueue('/api/inlet-daily-tasks/', taskPayload, 'POST', { isInletTask: true, date: values.date });

                await refreshQueueCount();

                setSubmitStatus({
                    type: 'info',
                    message: 'Saved offline. Both Flow and Screen logs will sync automatically when connection is restored.'
                });
                resetForm();
            } else {
                setSubmitStatus({
                    type: 'error',
                    message: 'Failed to submit logs. Check for existing entries on this date.'
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-industry"></i> Inlet Works Daily Log
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

            {submitStatus.message && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: submitStatus.type === 'success' ? '#d1fae5' :
                                   submitStatus.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: submitStatus.type === 'success' ? '#065f46' :
                           submitStatus.type === 'error' ? '#991b1b' : '#856404'
                }}>
                    <i className={`fas ${
                        submitStatus.type === 'success' ? 'fa-check-circle' :
                        submitStatus.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ marginRight: '8px' }}></i>
                    {submitStatus.message}
                </div>
            )}

            <Formik
                initialValues={initialValues}
                validationSchema={DailyPlantSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values }) => (
                    <Form>
                        <div className="form-group" style={{ maxWidth: '300px', marginBottom: '30px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Reporting Date <span style={{ color: '#e11d48' }}>*</span></label>
                            <Field type="date" name="date" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                            <ErrorMessage name="date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                        </div>

                        <div style={{ background: '#f9fbfd', padding: '20px', borderRadius: '8px', border: '1px solid #eef5fb', marginBottom: '30px' }}>
                            <h3 style={{ margin: '0 0 15px', color: '#1a6fb0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-water"></i> F203C: Flow Measurement
                            </h3>

                            <div className="scrollable-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: '#1a6fb0', color: 'white', padding: '10px', textAlign: 'left' }}>Time</th>
                                            <th style={{ background: '#1a6fb0', color: 'white', padding: '10px', textAlign: 'center' }}>Meter 1 (m³)</th>
                                            <th style={{ background: '#1a6fb0', color: 'white', padding: '10px', textAlign: 'center' }}>Meter 2 (m³)</th>
                                        </tr>
                                    </thead>
                                    <FieldArray name="readings">
                                        {() => (
                                            <tbody>
                                                {values.readings.map((reading, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #eef5fb' }}>
                                                        <td style={{ padding: '12px', fontWeight: '600', color: '#2c3e50' }}>{reading.label}</td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            <Field
                                                                type="number"
                                                                step="0.01"
                                                                name={`readings.${index}.meter_1`}
                                                                placeholder="0.00"
                                                                style={{ width: '120px', padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', textAlign: 'center' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            <Field
                                                                type="number"
                                                                step="0.01"
                                                                name={`readings.${index}.meter_2`}
                                                                placeholder="0.00"
                                                                style={{ width: '120px', padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', textAlign: 'center' }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        )}
                                    </FieldArray>
                                </table>
                            </div>

                            <div className="form-group" style={{ marginTop: '15px', marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Flow Remarks</label>
                                <Field type="text" name="remarks" placeholder="Any flow meter issues?" style={{ width: '100%', padding: '10px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                            </div>
                        </div>

                        <div style={{ background: '#f9fbfd', padding: '20px', borderRadius: '8px', border: '1px solid #eef5fb', marginBottom: '30px' }}>
                            <h3 style={{ margin: '0 0 15px', color: '#1a6fb0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-trash-alt"></i> F203A: Screens & Grit Removal
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.9rem', color: '#7f8c8d', marginBottom: '10px' }}>Screen Raking</h4>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="raking_t1" style={{ width: '18px', height: '18px' }} /> T1 Complete
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="raking_t2" style={{ width: '18px', height: '18px' }} /> T2 Complete
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="raking_t3" style={{ width: '18px', height: '18px' }} /> T3 Complete
                                    </label>
                                </div>

                                <div>
                                    <h4 style={{ fontSize: '0.9rem', color: '#7f8c8d', marginBottom: '10px' }}>Waste Management</h4>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="screenings_burial" style={{ width: '18px', height: '18px' }} /> Screenings Buried
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="grit_scooping" style={{ width: '18px', height: '18px' }} /> Grit Scooped
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                                        <Field type="checkbox" name="grit_burial" style={{ width: '18px', height: '18px' }} /> Grit Buried
                                    </label>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Screening Abnormalities / Reasons for missed tasks</label>
                                <Field as="textarea" name="abnormalities" placeholder="e.g. Heavy rains caused overflow, skipping T3." style={{ width: '100%', padding: '10px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                            </div>
                        </div>

                        <div className="signature-area" style={{ display: 'flex', gap: '20px', paddingTop: '10px', borderTop: '1px dashed #d1e5f1', marginBottom: '25px' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Attendant / Operator</label>
                                <input type="text" disabled value={user?.full_name || 'Current User'} style={{ width: '100%', padding: '12px', background: '#e5e7eb', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            style={{ 
                                background: isOnline ? '#1a6fb0' : '#6c757d', 
                                color: 'white', border: 'none', padding: '12px 25px', 
                                borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                fontSize: '15px', fontWeight: '600', opacity: isSubmitting ? 0.7 : 1,
                                transition: 'background 0.3s ease'
                            }}
                        >
                            <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i> 
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Daily Logs' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default TreatmentLogForm;