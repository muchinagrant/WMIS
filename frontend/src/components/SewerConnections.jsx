import React, { useState, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// 1. Validation Schema
const ConnectionsSchema = Yup.object().shape({
    start_date: Yup.date().required('Start date is required'),
    end_date: Yup.date().min(Yup.ref('start_date'), 'End date cannot be before start date').nullable(),
    ward: Yup.string().required('Ward/Area is required'),
    applications: Yup.array().of(
        Yup.object().shape({
            application_date: Yup.date().required('Required'),
            applicant_name: Yup.string().required('Required'),
            id_no: Yup.string().required('Required'),
            location: Yup.string().required('Required'),
            connection_type: Yup.string().oneOf(['residential', 'commercial', 'institutional']).required('Required'),
            status: Yup.string().oneOf(['pending', 'approved', 'rejected', 'completed']).required('Required')
        })
    )
});

const SewerConnections = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    const today = new Date().toISOString().split('T')[0];
    
    // 4. Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // 2. Initial Values
    const initialValues = {
        start_date: today,
        end_date: '',
        ward: '',
        applications: [
            { application_date: today, applicant_name: '', id_no: '', location: '', connection_type: 'residential', status: 'pending' }
        ]
    };

    // 5. Updated offline-capable submit handler
    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });
        
        try {
            if (isOnline) {
                // Assuming an endpoint for batch submitting connections
                const response = await api.post('/api/connections/batch/', values);
                
                if (response.status === 201 || response.status === 200) {
                    setSubmitStatus({ type: 'success', message: 'Connection applications updated successfully!' });
                    resetForm();
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
                
                // Clean data for offline storage
                const cleanedValues = {
                    ...values,
                    applications: values.applications.filter(app => 
                        app.applicant_name.trim() !== '' || 
                        app.id_no.trim() !== '' || 
                        app.location.trim() !== ''
                    )
                };

                // Only save if there's at least one valid application
                if (cleanedValues.applications.length === 0) {
                    setSubmitStatus({ 
                        type: 'error', 
                        message: 'Cannot save empty connection applications.' 
                    });
                    setSubmitting(false);
                    return;
                }

                // Add to queue with metadata
                await addToQueue('/api/connections/batch/', cleanedValues, 'POST', {
                    isConnectionBatch: true,
                    applicationCount: cleanedValues.applications.length,
                    ward: cleanedValues.ward,
                    dateRange: {
                        start: cleanedValues.start_date,
                        end: cleanedValues.end_date || 'ongoing'
                    },
                    timestamp: new Date().toISOString()
                });
                
                await refreshQueueCount(); // Update the UI counter
                
                setSubmitStatus({ 
                    type: 'info', 
                    message: `Connection batch saved offline with ${cleanedValues.applications.length} application(s). It will sync automatically when connection is restored.`
                });
                
                // Reset form after offline save
                resetForm();
                
            } else {
                // Actual API error (validation, server error, etc.)
                setSubmitStatus({ 
                    type: 'error', 
                    message: error.response?.data?.detail || 'Failed to update connection records.' 
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-network-wired"></i> Sewer Connection Management
            </h2>

            {/* Offline indicator */}
            {!isOnline && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                        <strong>You are currently offline.</strong> Connection applications will be saved locally and synced when connection is restored.
                    </div>
                </div>
            )}

            {submitStatus.message && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: submitStatus.type === 'success' ? '#d1fae5' : 
                                   submitStatus.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: submitStatus.type === 'success' ? '#065f46' : 
                           submitStatus.type === 'error' ? '#991b1b' : '#856404',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className={`fas ${
                        submitStatus.type === 'success' ? 'fa-check-circle' : 
                        submitStatus.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ fontSize: '1.2rem' }}></i>
                    <div>{submitStatus.message}</div>
                </div>
            )}

            <Formik
                initialValues={initialValues}
                validationSchema={ConnectionsSchema}
                onSubmit={handleSubmit}
            >
                {({ values, isSubmitting }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Reporting Period</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <Field 
                                            type="date" 
                                            name="start_date" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="start_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Field 
                                            type="date" 
                                            name="end_date" 
                                            placeholder="End date" 
                                            style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                            disabled={isSubmitting}
                                        />
                                        <ErrorMessage name="end_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Ward/Area</label>
                                <Field 
                                    as="select" 
                                    name="ward" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', background: 'white' }}
                                    disabled={isSubmitting}
                                >
                                    <option value="">Select Ward...</option>
                                    <option value="kerugoya">Kerugoya</option>
                                    <option value="kutus">Kutus</option>
                                    <option value="sagana">Sagana</option>
                                </Field>
                                <ErrorMessage name="ward" component="div" style={{ color: '#e11d48', fontSize: '0.85rem' }} />
                            </div>
                        </div>

                        <h3 style={{ 
                            margin: '20px 0 15px', 
                            color: '#1a6fb0', 
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <i className="fas fa-file-signature"></i>
                            New Connection Applications
                            {!isOnline && values.applications.length > 0 && (
                                <span style={{ 
                                    fontSize: '0.9rem', 
                                    color: '#6c757d',
                                    fontWeight: 'normal'
                                }}>
                                    ({values.applications.length} application(s) will be saved offline)
                                </span>
                            )}
                        </h3>

                        <div className="scrollable-table" style={{ overflowX: 'auto', margin: '25px 0', border: '1px solid #eef5fb', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: '800px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Date</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Applicant Name</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>ID No.</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Location</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Type</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Status</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'center', padding: '12px', fontWeight: '600' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <FieldArray name="applications">
                                        {({ push, remove }) => (
                                            <>
                                                {values.applications.map((app, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #eef5fb', background: index % 2 === 0 ? 'white' : '#f9fbfd' }}>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="date" 
                                                                name={`applications.${index}.application_date`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`applications.${index}.application_date`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="text" 
                                                                name={`applications.${index}.applicant_name`} 
                                                                placeholder="Full name" 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`applications.${index}.applicant_name`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="text" 
                                                                name={`applications.${index}.id_no`} 
                                                                placeholder="ID/Passport" 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`applications.${index}.id_no`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="text" 
                                                                name={`applications.${index}.location`} 
                                                                placeholder="Address" 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`applications.${index}.location`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                as="select" 
                                                                name={`applications.${index}.connection_type`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            >
                                                                <option value="residential">Residential</option>
                                                                <option value="commercial">Commercial</option>
                                                                <option value="institutional">Institutional</option>
                                                            </Field>
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                as="select" 
                                                                name={`applications.${index}.status`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            >
                                                                <option value="pending">Pending</option>
                                                                <option value="approved">Approved</option>
                                                                <option value="rejected">Rejected</option>
                                                                <option value="completed">Completed</option>
                                                            </Field>
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            {values.applications.length > 1 && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => remove(index)} 
                                                                    style={{ 
                                                                        background: '#fee2e2', 
                                                                        color: '#991b1b', 
                                                                        border: 'none', 
                                                                        padding: '6px 10px', 
                                                                        borderRadius: '4px', 
                                                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                                        opacity: isSubmitting ? 0.5 : 1
                                                                    }}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <i className="fas fa-trash"></i>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <td colSpan="7" style={{ textAlign: 'center', padding: '15px' }}>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => push({ application_date: today, applicant_name: '', id_no: '', location: '', connection_type: 'residential', status: 'pending' })}
                                                            style={{ 
                                                                background: '#e0f0fa', 
                                                                color: '#1a6fb0', 
                                                                border: '1px solid #1a6fb0', 
                                                                padding: '8px 20px', 
                                                                borderRadius: '6px', 
                                                                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                                                fontWeight: '600',
                                                                opacity: isSubmitting ? 0.5 : 1
                                                            }}
                                                            disabled={isSubmitting}
                                                        >
                                                            <i className="fas fa-plus" style={{ marginRight: '5px' }}></i> Add Application
                                                        </button>
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                    </FieldArray>
                                </tbody>
                            </table>
                            {typeof values.applications === 'string' && <ErrorMessage name="applications" component="div" style={{ color: '#e11d48', padding: '10px', textAlign: 'center' }} />}
                        </div>

                        <div className="signature-area" style={{ display: 'flex', gap: '20px', marginTop: '30px', paddingTop: '20px', borderTop: '1px dashed #d1e5f1' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Prepared By</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    placeholder="Logged-in User" 
                                    style={{ width: '100%', padding: '12px', background: '#e5e7eb', border: '1px solid #d1e5f1', borderRadius: '6px' }} 
                                />
                                <div style={{ height: '2px', background: '#d1e5f1', marginTop: '5px', marginBottom: '25px' }}></div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
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
                                transition: 'background 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                if (!isSubmitting && isOnline) e.target.style.background = '#155d92';
                            }}
                            onMouseLeave={(e) => {
                                if (!isSubmitting && isOnline) e.target.style.background = '#1a6fb0';
                            }}
                        >
                            <i className={`fas ${isOnline ? 'fa-save' : 'fa-cloud-upload-alt'}`} style={{ marginRight: '8px' }}></i> 
                            {isSubmitting 
                                ? 'Updating...' 
                                : isOnline 
                                    ? 'Update Connections' 
                                    : 'Save Offline'
                            }
                        </button>
                        
                        {/* Validation message for empty applications in offline mode */}
                        {!isOnline && values.applications.every(app => 
                            app.applicant_name.trim() === '' && 
                            app.id_no.trim() === '' && 
                            app.location.trim() === ''
                        ) && values.applications.length > 0 && (
                            <div style={{ 
                                marginTop: '10px', 
                                fontSize: '0.9rem', 
                                color: '#e11d48',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <i className="fas fa-exclamation-circle"></i>
                                <span>At least one application must have data to save offline</span>
                            </div>
                        )}
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default SewerConnections;