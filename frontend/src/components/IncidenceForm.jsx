import React, { useState, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

// 1. Upgraded Validation Schema (Added Category & Severity)
const IncidenceSchema = Yup.object().shape({
    reported_at: Yup.date().required('Date of incident is required'),
    category: Yup.string().required('Please select a category'),
    severity: Yup.string().required('Please select a severity level'),
    location_text: Yup.string().required('Location is required'),
    reported_by_name: Yup.string().required('Reporter name is required'),
    reported_contact: Yup.string().required('Contact information is required'),
    description: Yup.string().required('Please describe the problem'),
});

const IncidenceForm = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext); // Pull user data for the signature

    const initialValues = {
        reported_at: new Date().toISOString().slice(0, 16),
        category: 'blockage',
        severity: 'low',
        location_text: '',
        latitude: '',
        longitude: '',
        reported_by_name: '',
        reported_contact: '',
        description: '',
        photo: null // Storing the file object locally
    };

    // Hardware Geolocation Capture
    const captureLocation = (setFieldValue) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(6);
                    const lng = position.coords.longitude.toFixed(6);
                    setFieldValue('latitude', lat);
                    setFieldValue('longitude', lng);
                    // Provide a helpful string combining GPS and a prompt for landmarks
                    setFieldValue('location_text', `GPS: ${lat}, ${lng} - [Add Landmark]`);
                }, 
                (error) => {
                    alert("Location access denied or unavailable. Please enter location manually.");
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });
        
        // Separate the file from the JSON payload
        const payload = { ...values };
        const photoData = payload.photo;
        delete payload.photo; 

        try {
            if (isOnline) {
                // Step 1: Create the Incident Record
                const response = await api.post('/api/incidents/', payload);
                const incidentId = response.data.id;
                
                // Step 2: Upload the Photo (If provided)
                if (photoData && incidentId) {
                    const formData = new FormData();
                    formData.append('file', photoData);
                    formData.append('content_type', 'incident');
                    formData.append('object_id', incidentId);
                    
                    await api.post('/api/attachments/', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }

                setSubmitStatus({ type: 'success', message: 'Incidence report & evidence submitted successfully!' });
                resetForm();
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline') {
                
                // Note: File objects are tricky to sync offline reliably without Base64 encoding.
                // For this sprint, we queue the text data and drop the photo if offline.
                await addToQueue('/api/incidents/', payload);
                await refreshQueueCount(); 
                
                setSubmitStatus({ 
                    type: 'info', 
                    message: 'Saved offline. Text data will sync automatically. (Photo upload skipped during offline mode).' 
                });
                resetForm();
            } else {
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

            {!isOnline && (
                <div style={{
                    padding: '10px', marginBottom: '20px', borderRadius: '6px',
                    backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba',
                    display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash"></i>
                    You are currently offline. Text data will be saved locally.
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
                validationSchema={IncidenceSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, setFieldValue, values }) => (
                    <Form>
                        {/* CLASSIFICATION ROW */}
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', background: '#f9fbfd', padding: '15px', borderRadius: '8px', border: '1px solid #eef5fb' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Incident Category <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field as="select" name="category" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}>
                                    <option value="blockage">Blockage</option>
                                    <option value="burst">Burst Pipe</option>
                                    <option value="spillage">Sewer Spillage</option>
                                    <option value="odor">Foul Odor</option>
                                    <option value="missing_cover">Missing Manhole Cover</option>
                                    <option value="illegal_connection">Illegal Connection</option>
                                    <option value="other">Other</option>
                                </Field>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Severity / Priority <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field as="select" name="severity" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}>
                                    <option value="low">Low (Routine/Minor)</option>
                                    <option value="medium">Medium (Urgent/Operational)</option>
                                    <option value="high">High (Emergency/Critical)</option>
                                </Field>
                            </div>
                        </div>

                        {/* CORE DATA ROW */}
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date & Time of Incident</label>
                                <Field type="datetime-local" name="reported_at" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="reported_at" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '600' }}>
                                    Location Description
                                    <button type="button" onClick={() => captureLocation(setFieldValue)} style={{ background: 'none', border: 'none', color: '#1a6fb0', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                        <i className="fas fa-map-marker-alt"></i> Get GPS
                                    </button>
                                </label>
                                <Field type="text" name="location_text" placeholder="Press 'Get GPS' or type manually" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="location_text" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                
                                {/* Hidden fields for database mapping */}
                                <Field type="hidden" name="latitude" />
                                <Field type="hidden" name="longitude" />
                            </div>
                        </div>

                        {/* REPORTER ROW */}
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Reported By</label>
                                <Field type="text" name="reported_by_name" placeholder="Civilian or Staff name" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="reported_by_name" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Contact Information</label>
                                <Field type="text" name="reported_contact" placeholder="Phone/email" style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <ErrorMessage name="reported_contact" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        {/* DESCRIPTION AND EVIDENCE */}
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Problem Description</label>
                            <Field as="textarea" name="description" placeholder="Specific details about the incident..." style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '80px' }} />
                            <ErrorMessage name="description" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                        </div>

                        <div className="form-group" style={{ marginBottom: '30px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                <i className="fas fa-camera"></i> Photographic Evidence (Optional)
                            </label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                onChange={(event) => {
                                    setFieldValue("photo", event.currentTarget.files[0]);
                                }} 
                                style={{ width: '100%', padding: '10px', border: '1px dashed #1a6fb0', borderRadius: '6px', background: '#f9fbfd' }}
                            />
                        </div>

                        {/* SIGNATURE AREA */}
                        <div className="signature-area" style={{ display: 'flex', gap: '20px', paddingTop: '20px', borderTop: '1px dashed #d1e5f1' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Received By</label>
                                <input type="text" disabled value={user?.full_name || 'Current User'} style={{ width: '100%', padding: '12px', background: '#e5e7eb', border: '1px solid #d1e5f1', borderRadius: '6px' }} />
                                <div style={{ height: '2px', background: '#d1e5f1', marginTop: '5px', marginBottom: '25px' }}></div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn" 
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
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Smart Report' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default IncidenceForm;