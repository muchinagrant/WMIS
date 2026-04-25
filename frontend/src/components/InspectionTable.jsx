import React, { useState, useContext } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';

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
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });

        const cleanedValues = {
            ...values,
            new_mother_accounts: values.new_mother_accounts === '' ? 0 : parseInt(values.new_mother_accounts, 10),
            new_child_accounts: values.new_child_accounts === '' ? 0 : parseInt(values.new_child_accounts, 10)
        };

        try {
            if (isOnline) {
                const response = await api.post('/api/weekly-patrols/', cleanedValues);

                if (response.status === 201 || response.status === 200) {
                    setSubmitStatus({ type: 'success', message: 'Patrol record submitted successfully!' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/weekly-patrols/', cleanedValues, 'POST', {
                    isPatrol: true,
                    area: cleanedValues.drainage_area,
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
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-search-location"></i> F201 Weekly Line Patrol
            </h2>

            {submitStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: submitStatus.type === 'success' ? '#d1fae5' : '#e0f2fe', color: submitStatus.type === 'success' ? '#065f46' : '#0284c7' }}>
                    {submitStatus.message}
                </div>
            )}

            <Formik
                initialValues={{
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().slice(0, 5),
                    drainage_area: '', sewer_line_ref: '', abnormality_observed: 'none',
                    abnormality_details: '', new_mother_accounts: 0, new_child_accounts: 0,
                    corrective_action_taken: '', further_action_required: ''
                }}
                validationSchema={PatrolSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Date</label>
                                <Field type="date" name="date" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Time</label>
                                <Field type="time" name="time" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Drainage Area / Estate</label>
                                <Field type="text" name="drainage_area" placeholder="e.g. Kerugoya Central" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Sewer Line Ref No.</label>
                                <Field type="text" name="sewer_line_ref" placeholder="e.g. SL-104" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1rem', color: '#0f172a', marginBottom: '15px' }}><i className="fas fa-exclamation-triangle" style={{color: '#eab308'}}></i> Field Observations</h3>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Abnormality Observed</label>
                                <Field as="select" name="abnormality_observed" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
                                    <option value="none">None (Line Clear)</option>
                                    <option value="erosion">Erosion along lines</option>
                                    <option value="missing_cover">Broken/Missing Manhole Cover</option>
                                    <option value="blockage">Blockage</option>
                                    <option value="overflow">Overflow/Spillage</option>
                                    <option value="other">Other (Specify below)</option>
                                </Field>
                                {values.abnormality_observed !== 'none' && (
                                    <Field type="text" name="abnormality_details" placeholder="Specify details..." style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                )}
                            </div>
                        </div>

                        {/* REVENUE PROTECTION SECTION */}
                        <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1rem', color: '#991b1b', marginBottom: '15px' }}><i className="fas fa-coins"></i> New Unauthorized Connections Found</h3>
                            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold' }}>Mother Accounts</label>
                                    <Field type="number" min="0" name="new_mother_accounts" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold' }}>Child Accounts</label>
                                    <Field type="number" min="0" name="new_child_accounts" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                </div>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ fontWeight: 'bold' }}>Corrective Action Taken</label>
                            <Field as="textarea" name="corrective_action_taken" placeholder="What did you do on site?" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }} />
                        </div>

                        <button type="submit" disabled={isSubmitting} style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            <i className="fas fa-save"></i> Save Patrol Log
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default InspectionTable;