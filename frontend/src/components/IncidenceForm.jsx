import React, { useState, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios'; // Your configured Axios instance
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// 1. Define Validation Rules using Yup
const IncidenceSchema = Yup.object().shape({
    reported_at: Yup.date().required('Date of incident is required'),
    location_text: Yup.string().required('Location is required'),
    reported_by_name: Yup.string().required('Reporter name is required'),
    reported_contact: Yup.string().required('Contact information is required'),
    description: Yup.string().required('Please describe the problem'),
});

const IncidenceForm = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    
    // 4. Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // 2. Initial Form Values
    const initialValues = {
        reported_at: new Date().toISOString().slice(0, 16), // Default to current date/time
        location_text: '',
        reported_by_name: '',
        reported_contact: '',
        description: '',
    };

    // 5. Updated offline-capable submit handler
    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });
        
        try {
            if (isOnline) {
                // If we have internet, send it straight to the Django API
                const response = await api.post('/api/incidents/', values);
                
                if (response.status === 201) {
                    setSubmitStatus({ type: 'success', message: 'Incidence report submitted successfully!' });
                    resetForm(); // Clear the form after success
                }
            } else {
                // Force the catch block if offline
                throw new Error('Network offline');
            }
        } catch (error) {
            // Check if we're offline or if it's a network error
            if (!navigator.onLine || 
                error.message === 'Network Error' || 
                error.message === 'Network offline' ||
                error.code === 'ERR_NETWORK') {
                
                // Save to IndexedDB queue
                await addToQueue('/api/incidents/', values);
                await refreshQueueCount(); // Update the UI counter
                
                setSubmitStatus({ 
                    type: 'info', 
                    message: 'Saved offline. Will sync automatically when connection is restored.' 
                });
                
                // Optionally reset form after offline save
                resetForm();
            } else {
                // Actual API error (validation, server error, etc.)
                setSubmitStatus({ 
                    type: 'error', 
                    message: error.response?.data?.detail || 'Failed to submit report. Please try again.' 
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-exclamation-triangle"></i> Sewer Incidence Report
            </h2>

            {/* Offline indicator (optional) */}
            {!isOnline && (
                <div style={{
                    padding: '10px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash"></i>
                    You are currently offline. Submissions will be saved locally and synced when connection is restored.
                </div>
            )}

            {/* Status Messages */}
            {submitStatus.message && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
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
                validationSchema={IncidenceSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date & Time of Incident</label>
                                <Field 
                                    type="datetime-local" 
                                    name="reported_at" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                />
                                <ErrorMessage name="reported_at" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                                <Field 
                                    type="text" 
                                    name="location_text" 
                                    placeholder="GPS coordinates/landmark" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                />
                                <ErrorMessage name="location_text" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Reported By</label>
                                <Field 
                                    type="text" 
                                    name="reported_by_name" 
                                    placeholder="Full name" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                />
                                <ErrorMessage name="reported_by_name" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Contact Information</label>
                                <Field 
                                    type="text" 
                                    name="reported_contact" 
                                    placeholder="Phone/email" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                />
                                <ErrorMessage name="reported_contact" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Problem Description</label>
                            <Field 
                                as="textarea" 
                                name="description" 
                                placeholder="Nature of incident (spill, blockage, odor, etc.)" 
                                style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '100px' }}
                            />
                            <ErrorMessage name="description" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                        </div>

                        {/* Signatures placeholder - we will upgrade this to digital canvas in a later sprint */}
                        <div className="signature-area" style={{ display: 'flex', gap: '20px', marginTop: '30px', paddingTop: '20px', borderTop: '1px dashed #d1e5f1' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Received By (Current User)</label>
                                <input type="text" disabled placeholder="Will auto-fill from AuthContext" style={{ width: '100%', padding: '12px', background: '#e5e7eb', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <div style={{ height: '2px', background: '#d1e5f1', marginTop: '5px', marginBottom: '25px' }}></div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn" 
                            disabled={isSubmitting}
                            style={{ 
                                background: isOnline ? '#1a6fb0' : '#6c757d', 
                                color: 'white', 
                                border: 'none', 
                                padding: '12px 25px', 
                                borderRadius: '6px', 
                                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                fontSize: '15px', 
                                fontWeight: '600', 
                                opacity: isSubmitting ? 0.7 : 1,
                                transition: 'background 0.3s ease'
                            }}
                        >
                            <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i> 
                            {isSubmitting 
                                ? 'Submitting...' 
                                : isOnline 
                                    ? 'Submit Report' 
                                    : 'Save Offline'
                            }
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default IncidenceForm;