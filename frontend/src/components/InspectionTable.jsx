import React, { useState, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// 1. Updated Validation Schema with notes field and optional length_m
const InspectionSchema = Yup.object().shape({
    start_date: Yup.date().required('Start date is required'),
    end_date: Yup.date().min(
        Yup.ref('start_date'),
        'End date cannot be before start date'
    ),
    notes: Yup.string(),
    entries: Yup.array().of(
        Yup.object().shape({
            date: Yup.date().required('Date is required'),
            section_identifier: Yup.string().required('Section ID is required'),
            length_m: Yup.number().min(0, 'Must be positive'), // Made optional by removing .required()
            condition: Yup.string().oneOf(['good', 'minor', 'major']).required('Condition is required'),
            remarks: Yup.string(),
            action: Yup.string() // Added action field
        })
    ).min(1, 'Add at least one inspection entry')
});

const InspectionTable = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const today = new Date().toISOString().split('T')[0];
    
    // 4. Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // 2. Updated Initial Values with notes field and action field
    const initialValues = {
        start_date: today,
        end_date: '',
        notes: '',
        entries: [
            { date: today, section_identifier: '', length_m: '', condition: '', remarks: '', action: '' }
        ]
    };

    // 5. Updated offline-capable submit handler
    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setStatusMsg({ type: '', text: '' });
        
        try {
            if (isOnline) {
                // Send the master inspection record and its nested entries in one payload
                const response = await api.post('/inspections/', values);
                
                if (response.status === 201 || response.status === 200) {
                    setStatusMsg({ type: 'success', text: 'Inspection log submitted successfully!' });
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
                
                // Save inspection data to queue with metadata
                await addToQueue('/inspections/', values, 'POST', {
                    isInspection: true,
                    entryCount: values.entries.length,
                    hasNotes: !!values.notes
                });
                
                await refreshQueueCount(); // Update the UI counter
                
                setStatusMsg({ 
                    type: 'info', 
                    text: 'Inspection saved offline. It will sync automatically when connection is restored. ' +
                          `(${values.entries.length} inspection entries queued)`
                });
                
                // Reset form after offline save
                resetForm();
            } else {
                // Actual API error (validation, server error, etc.)
                setStatusMsg({ 
                    type: 'error', 
                    text: 'Submission failed: ' + (error.response?.data?.detail || error.message)
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-search"></i> Sewer Line Inspection Log
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
                        <strong>You are currently offline.</strong> Inspection data will be saved locally and synced when connection is restored.
                    </div>
                </div>
            )}

            {statusMsg.text && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : 
                                   statusMsg.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: statusMsg.type === 'success' ? '#065f46' : 
                           statusMsg.type === 'error' ? '#991b1b' : '#856404',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className={`fas ${
                        statusMsg.type === 'success' ? 'fa-check-circle' : 
                        statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ fontSize: '1.2rem' }}></i>
                    <div>{statusMsg.text}</div>
                </div>
            )}

            <Formik
                initialValues={initialValues}
                validationSchema={InspectionSchema}
                onSubmit={handleSubmit}
            >
                {({ values, isSubmitting }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Inspection Start Date</label>
                                <Field 
                                    type="date" 
                                    name="start_date" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                    disabled={isSubmitting}
                                />
                                <ErrorMessage name="start_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Inspection End Date</label>
                                <Field 
                                    type="date" 
                                    name="end_date" 
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                                    disabled={isSubmitting}
                                />
                                <ErrorMessage name="end_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                            </div>
                        </div>

                        {/* 3. FieldArray handles the dynamic rows */}
                        <div className="scrollable-table" style={{ overflowX: 'auto', margin: '25px 0', border: '1px solid #eef5fb', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Date</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Location/Section ID</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Length (m)</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Condition</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'left', padding: '12px', fontWeight: '600' }}>Remarks</th>
                                        <th style={{ background: '#1a6fb0', color: 'white', textAlign: 'center', padding: '12px', fontWeight: '600' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <FieldArray name="entries">
                                        {({ push, remove }) => (
                                            <>
                                                {values.entries.length > 0 && values.entries.map((entry, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #eef5fb', background: index % 2 === 0 ? 'white' : '#f9fbfd' }}>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="date" 
                                                                name={`entries.${index}.date`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`entries.${index}.date`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="text" 
                                                                name={`entries.${index}.section_identifier`} 
                                                                placeholder="Identifier" 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`entries.${index}.section_identifier`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="number" 
                                                                name={`entries.${index}.length_m`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '80px' }}
                                                                disabled={isSubmitting}
                                                            />
                                                            <ErrorMessage name={`entries.${index}.length_m`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                as="select" 
                                                                name={`entries.${index}.condition`} 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            >
                                                                <option value="">Select</option>
                                                                <option value="good">Good</option>
                                                                <option value="minor">Minor Issues</option>
                                                                <option value="major">Major Defect</option>
                                                            </Field>
                                                            <ErrorMessage name={`entries.${index}.condition`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem' }} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <Field 
                                                                type="text" 
                                                                name={`entries.${index}.remarks`} 
                                                                placeholder="Observations" 
                                                                style={{ padding: '8px', border: '1px solid #d1e5f1', borderRadius: '4px', width: '100%' }}
                                                                disabled={isSubmitting}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                                            {values.entries.length > 1 && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => remove(index)} 
                                                                    style={{ 
                                                                        background: '#e74c3c', 
                                                                        color: 'white', 
                                                                        border: 'none', 
                                                                        padding: '5px 10px', 
                                                                        borderRadius: '4px', 
                                                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                                        opacity: isSubmitting ? 0.5 : 1
                                                                    }}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr>
                                                    <td colSpan="6" style={{ textAlign: 'center', padding: '15px' }}>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => push({ date: today, section_identifier: '', length_m: '', condition: '', remarks: '', action: '' })}
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
                                                            <i className="fas fa-plus" style={{ marginRight: '5px' }}></i> Add Inspection Row
                                                        </button>
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                    </FieldArray>
                                </tbody>
                            </table>
                            {typeof values.entries === 'string' && <ErrorMessage name="entries" component="div" style={{ color: '#e11d48', padding: '10px', textAlign: 'center' }} />}
                        </div>

                        {/* 4. New Notes Field */}
                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>General Notes</label>
                            <Field 
                                as="textarea" 
                                name="notes" 
                                placeholder="Overall inspection observations..." 
                                style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '100px' }}
                                disabled={isSubmitting}
                            />
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
                                gap: '8px',
                                width: 'fit-content'
                            }}
                        >
                            <i className={`fas ${isOnline ? 'fa-save' : 'fa-cloud-upload-alt'}`}></i> 
                            {isSubmitting 
                                ? 'Saving...' 
                                : isOnline 
                                    ? 'Finalize Inspection Log' 
                                    : 'Save Offline'
                            }
                        </button>

                        {/* Show count of entries being saved */}
                        {!isOnline && values.entries.length > 0 && (
                            <div style={{ 
                                marginTop: '10px', 
                                fontSize: '0.9rem', 
                                color: '#6c757d',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <i className="fas fa-info-circle"></i>
                                <span>{values.entries.length} inspection {values.entries.length === 1 ? 'entry' : 'entries'} will be saved offline</span>
                            </div>
                        )}
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default InspectionTable;