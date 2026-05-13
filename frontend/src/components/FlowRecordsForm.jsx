import React, { useContext, useState } from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';

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
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    const initialValues = {
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        readings: TIME_SLOTS.map((slot) => ({
            time_slot: slot.value,
            meter_1: '',
            meter_2: '',
        })),
    };

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
