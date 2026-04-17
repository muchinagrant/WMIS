import React, { useState, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';

// Validation Schema for F201 Template
const PatrolSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    time: Yup.string().required('Time is required'),
    drainage_area: Yup.string().required('Drainage area/estate is required'),
    sewer_line_ref: Yup.string().required('Sewer line reference is required'),
    abnormality_observed: Yup.string().required('Select an abnormality status'),
    abnormality_details: Yup.string(),
    new_mother_accounts: Yup.number().min(0, 'Cannot be negative').integer(),
    new_child_accounts: Yup.number().min(0, 'Cannot be negative').integer(),
    corrective_action_taken: Yup.string(),
    further_action_required: Yup.string()
});

const InspectionTable = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });

    // Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // Initial values for the patrol record
    const initialValues = {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        drainage_area: '',
        sewer_line_ref: '',
        abnormality_observed: 'none',
        abnormality_details: '',
        new_mother_accounts: 0,
        new_child_accounts: 0,
        corrective_action_taken: '',
        further_action_required: ''
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });

        try {
            if (isOnline) {
                // Post to our new Weekly Line Patrol API endpoint
                const response = await api.post('/api/weekly-patrols/', values);

                if (response.status === 201) {
                    setSubmitStatus({ type: 'success', message: 'Patrol record submitted successfully!' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine ||
                error.message === 'Network Error' ||
                error.message === 'Network offline' ||
                error.code === 'ERR_NETWORK') {

                // Save to IndexedDB queue for offline sync
                await addToQueue('/api/weekly-patrols/', values, 'POST', {
                    isPatrol: true,
                    area: values.drainage_area,
                    timestamp: new Date().toISOString()
                });
                await refreshQueueCount();

                setSubmitStatus({
                    type: 'info',
                    message: 'Saved offline. Record will sync automatically when connection is restored.'
                });
                resetForm();
            } else {
                setSubmitStatus({
                    type: 'error',
                    message: error.response?.data?.detail || 'Failed to submit patrol record. Please try again.'
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-search"></i> Sewer Lines Weekly Patrol (F201)
            </h2>

            {!isOnline && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash"></i>
                    You are currently offline. Patrol records will be saved locally and synced automatically.
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
                validationSchema={PatrolSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field type="date" name="date" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Time <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field type="time" name="time" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="time" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Drainage Area / Estate <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field type="text" name="drainage_area" placeholder="e.g. Kerugoya Town" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="drainage_area" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Sewer Line Ref. No <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field type="text" name="sewer_line_ref" placeholder="e.g. SL-045" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="sewer_line_ref" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <h3 style={{ margin: '30px 0 15px', color: '#1a6fb0', fontSize: '1.2rem', borderBottom: '1px solid #e0f0fa', paddingBottom: '10px' }}>
                            Observations & Findings
                        </h3>

                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Abnormality Observed <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field as="select" name="abnormality_observed" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}>
                                    <option value="none">None (Good Condition)</option>
                                    <option value="erosion">Erosion along lines</option>
                                    <option value="missing_cover">Broken/Missing Manhole Cover</option>
                                    <option value="blockage">Blockage</option>
                                    <option value="overflow">Overflow/Spillage</option>
                                    <option value="other">Other (Specify in remarks)</option>
                                </Field>
                                <ErrorMessage name="abnormality_observed" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Remarks / Other Details</label>
                                <Field type="text" name="abnormality_details" placeholder="Specifics about the issue" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} disabled={values.abnormality_observed === 'none'} />
                            </div>
                        </div>

                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>New Mother Accounts Found</label>
                                <Field type="number" min="0" name="new_mother_accounts" style={{ width: '100%', padding: '10px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>New Child Accounts Found</label>
                                <Field type="number" min="0" name="new_child_accounts" style={{ width: '100%', padding: '10px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Immediate Corrective Action Taken</label>
                            <Field as="textarea" name="corrective_action_taken" placeholder="What did you do on-site?" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                        </div>

                        <div className="form-group" style={{ marginBottom: '30px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Further Action Required</label>
                            <Field as="textarea" name="further_action_required" placeholder="What needs to be done by the team?" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }} />
                        </div>

                        <div className="signature-area" style={{ display: 'flex', gap: '20px', paddingTop: '20px', borderTop: '1px dashed #d1e5f1', marginBottom: '25px' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Line Patroller</label>
                                <input type="text" disabled placeholder="Will auto-fill from AuthContext" style={{ width: '100%', padding: '12px', background: '#e5e7eb', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <div style={{ height: '2px', background: '#d1e5f1', marginTop: '5px', marginBottom: '5px' }}></div>
                                <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>Auto-signed on submission</span>
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
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Patrol Record' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default InspectionTable;
