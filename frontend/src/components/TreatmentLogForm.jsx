import React, { useState, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// 1. Validation Schema with conditional pH validation
const TreatmentLogSchema = Yup.object().shape({
    report_date: Yup.date().required('Report date is required'),
    shift: Yup.string().required('Shift is required'),
    operational_notes: Yup.string(),
    parameters: Yup.array().of(
        Yup.object().shape({
            parameter: Yup.string().required('Parameter name is required'),
            influent_value: Yup.number()
                .nullable()
                .transform((value) => (isNaN(value) ? null : value))
                .when(['parameter'], {
                    is: (param) => param && param.toLowerCase().includes('ph'),
                    then: (schema) => schema
                        .min(0, 'pH must be at least 0')
                        .max(14, 'pH must be at most 14'),
                    otherwise: (schema) => schema
                }),
            effluent_value: Yup.number()
                .nullable()
                .transform((value) => (isNaN(value) ? null : value))
                .when(['parameter'], {
                    is: (param) => param && param.toLowerCase().includes('ph'),
                    then: (schema) => schema
                        .min(0, 'pH must be at least 0')
                        .max(14, 'pH must be at most 14'),
                    otherwise: (schema) => schema
                }),
            influent_time: Yup.string().nullable(),
            effluent_time: Yup.string().nullable(),
            remarks: Yup.string()
        })
    )
});

// Pre-fill standard KICOWASCO parameters
const defaultParameters = [
    { parameter: 'Flow Rate (m³/hr)', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' },
    { parameter: 'pH', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' },
    { parameter: 'Temperature (°C)', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' },
    { parameter: 'BOD (mg/l)', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' },
    { parameter: 'COD (mg/l)', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' },
    { parameter: 'TSS (mg/l)', influent_value: '', influent_time: '', effluent_value: '', effluent_time: '', remarks: '' }
];

const TreatmentLogForm = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const [alertTriggered, setAlertTriggered] = useState(false);
    const today = new Date().toISOString().split('T')[0];
    
    // 4. Extract offline states from context
    const { isOnline, refreshQueueCount } = useContext(SyncContext);

    // 2. Initial Values with today's date
    const initialValues = {
        report_date: today,
        shift: '',
        operational_notes: '',
        parameters: defaultParameters
    };

    // 5. Updated offline-capable submit handler
    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setStatusMsg({ type: '', text: '' });
        
        try {
            // Clean up empty values before sending
            const cleanedValues = {
                ...values,
                parameters: values.parameters.map(param => ({
                    ...param,
                    influent_value: param.influent_value === '' ? null : param.influent_value,
                    effluent_value: param.effluent_value === '' ? null : param.effluent_value,
                    influent_time: param.influent_time === '' ? null : param.influent_time,
                    effluent_time: param.effluent_time === '' ? null : param.effluent_time
                })).filter(param => param.parameter.trim() !== '') // Remove empty parameter rows
            };

            if (isOnline) {
                const response = await api.post('/api/treatment-logs/', cleanedValues);
                
                if (response.status === 201) {
                    setStatusMsg({ 
                        type: 'success', 
                        text: 'Daily treatment log submitted successfully!' 
                    });
                    
                    // Check if our backend flagged this submission with an alert
                    if (response.data.alert) {
                        setAlertTriggered(true);
                    } else {
                        setAlertTriggered(false);
                    }
                    
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
                    parameters: values.parameters.map(param => ({
                        ...param,
                        influent_value: param.influent_value === '' ? null : param.influent_value,
                        effluent_value: param.effluent_value === '' ? null : param.effluent_value,
                        influent_time: param.influent_time === '' ? null : param.influent_time,
                        effluent_time: param.effluent_time === '' ? null : param.effluent_time
                    })).filter(param => param.parameter.trim() !== '')
                };

                // Add to queue with metadata
                await addToQueue('/api/treatment-logs/', cleanedValues, 'POST', {
                    isTreatmentLog: true,
                    parameterCount: cleanedValues.parameters.length,
                    hasNotes: !!cleanedValues.operational_notes,
                    shift: cleanedValues.shift,
                    timestamp: new Date().toISOString()
                });
                
                await refreshQueueCount(); // Update the UI counter
                
                setStatusMsg({ 
                    type: 'info', 
                    text: `Treatment log saved offline with ${cleanedValues.parameters.length} parameters. It will sync automatically when connection is restored.`
                });
                
                // Reset form after offline save
                resetForm();
                setAlertTriggered(false);
                
            } else {
                // Actual API error (validation, server error, etc.)
                setStatusMsg({ 
                    type: 'error', 
                    text: error.response?.data?.detail || 
                           error.response?.data?.non_field_errors?.[0] || 
                           'Failed to submit treatment log. Please check your inputs.' 
                });
                
                // Log detailed errors for debugging
                if (error.response?.data) {
                    console.error('Validation errors:', error.response.data);
                }
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ 
                color: '#1a6fb0', 
                marginBottom: '25px', 
                paddingBottom: '15px', 
                borderBottom: '2px solid #e0f0fa', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px' 
            }}>
                <i className="fas fa-industry"></i> Treatment Plant Daily Log
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
                        <strong>You are currently offline.</strong> Treatment logs will be saved locally and synced when connection is restored.
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {statusMsg.text && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : 
                                   statusMsg.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: statusMsg.type === 'success' ? '#065f46' : 
                           statusMsg.type === 'error' ? '#991b1b' : '#856404',
                    border: statusMsg.type === 'success' ? '1px solid #a7f3d0' : 
                           statusMsg.type === 'error' ? '1px solid #fecaca' : '1px solid #ffeeba',
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
            
            {/* Alert Notification */}
            {alertTriggered && isOnline && (
                <div style={{ 
                    color: '#856404', 
                    background: '#fff3cd', 
                    padding: '15px', 
                    marginBottom: '20px', 
                    border: '1px solid #ffeeba', 
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                        <strong>⚠️ Alert:</strong> Some parameters in your last submission exceeded regulatory thresholds. A supervisor has been notified.
                    </div>
                </div>
            )}

            <Formik
                initialValues={initialValues}
                validationSchema={TreatmentLogSchema}
                onSubmit={handleSubmit}
                enableReinitialize={true}
            >
                {({ values, isSubmitting, errors, touched }) => (
                    <Form>
                        <div className="grid-2" style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '20px', 
                            marginBottom: '25px' 
                        }}>
                            <div className="form-group">
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    Reporting Date <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <Field 
                                    type="date" 
                                    name="report_date" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        border: `1px solid ${touched.report_date && errors.report_date ? '#e11d48' : '#d1e5f1'}`, 
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                    disabled={isSubmitting}
                                />
                                <ErrorMessage name="report_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    Shift <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <Field 
                                    as="select" 
                                    name="shift" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        border: `1px solid ${touched.shift && errors.shift ? '#e11d48' : '#d1e5f1'}`, 
                                        borderRadius: '6px', 
                                        background: 'white',
                                        fontSize: '14px'
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <option value="">Select Shift</option>
                                    <option value="Morning">Morning (06:00 - 14:00)</option>
                                    <option value="Evening">Evening (14:00 - 22:00)</option>
                                    <option value="Night">Night (22:00 - 06:00)</option>
                                </Field>
                                <ErrorMessage name="shift" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <h3 style={{ 
                            margin: '30px 0 15px', 
                            color: '#1a6fb0', 
                            fontSize: '1.2rem',
                            fontWeight: '600'
                        }}>
                            <i className="fas fa-flask" style={{ marginRight: '8px' }}></i>
                            Process Parameters
                            {!isOnline && values.parameters.length > 0 && (
                                <span style={{ 
                                    marginLeft: '15px', 
                                    fontSize: '0.9rem', 
                                    color: '#6c757d',
                                    fontWeight: 'normal'
                                }}>
                                    ({values.parameters.length} parameters will be saved offline)
                                </span>
                            )}
                        </h3>

                        <div className="scrollable-table" style={{ 
                            overflowX: 'auto', 
                            margin: '25px 0', 
                            border: '1px solid #eef5fb', 
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            <table style={{ 
                                width: '100%', 
                                borderCollapse: 'collapse', 
                                background: 'white', 
                                minWidth: '900px' 
                            }}>
                                <thead>
                                    <tr>
                                        <th rowSpan="2" style={{ 
                                            background: '#1a6fb0', 
                                            color: 'white', 
                                            textAlign: 'left', 
                                            padding: '12px', 
                                            fontWeight: '600', 
                                            borderRight: '1px solid #155d92',
                                            width: '200px'
                                        }}>Parameter</th>
                                        <th colSpan="2" style={{ 
                                            background: '#1a6fb0', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '12px', 
                                            fontWeight: '600', 
                                            borderRight: '1px solid #155d92' 
                                        }}>Influent</th>
                                        <th colSpan="2" style={{ 
                                            background: '#1a6fb0', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '12px', 
                                            fontWeight: '600', 
                                            borderRight: '1px solid #155d92' 
                                        }}>Effluent</th>
                                        <th rowSpan="2" style={{ 
                                            background: '#1a6fb0', 
                                            color: 'white', 
                                            textAlign: 'left', 
                                            padding: '12px', 
                                            fontWeight: '600',
                                            width: '150px' 
                                        }}>Action</th>
                                    </tr>
                                    <tr>
                                        <th style={{ 
                                            background: '#2c9cd4', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '8px', 
                                            fontWeight: '500', 
                                            fontSize: '0.9rem',
                                            borderRight: '1px solid #155d92'
                                        }}>Value</th>
                                        <th style={{ 
                                            background: '#2c9cd4', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '8px', 
                                            fontWeight: '500', 
                                            fontSize: '0.9rem',
                                            borderRight: '1px solid #155d92' 
                                        }}>Time</th>
                                        <th style={{ 
                                            background: '#2c9cd4', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '8px', 
                                            fontWeight: '500', 
                                            fontSize: '0.9rem',
                                            borderRight: '1px solid #155d92'
                                        }}>Value</th>
                                        <th style={{ 
                                            background: '#2c9cd4', 
                                            color: 'white', 
                                            textAlign: 'center', 
                                            padding: '8px', 
                                            fontWeight: '500', 
                                            fontSize: '0.9rem',
                                            borderRight: '1px solid #155d92' 
                                        }}>Time</th>
                                    </tr>
                                </thead>
                                <FieldArray name="parameters">
                                    {({ push, remove }) => (
                                        <tbody>
                                            {values.parameters.map((param, index) => (
                                                <tr key={index} style={{ 
                                                    borderBottom: '1px solid #eef5fb', 
                                                    background: index % 2 === 0 ? 'white' : '#f9fbfd'
                                                }}>
                                                    <td style={{ padding: '10px' }}>
                                                        <Field 
                                                            type="text" 
                                                            name={`parameters.${index}.parameter`} 
                                                            style={{ 
                                                                padding: '8px', 
                                                                border: `1px solid ${touched.parameters?.[index]?.parameter && errors.parameters?.[index]?.parameter ? '#e11d48' : 'transparent'}`, 
                                                                background: index < 6 ? '#f0f7ff' : 'white',
                                                                borderRadius: '4px',
                                                                width: '100%',
                                                                fontWeight: index < 6 ? '600' : '400',
                                                                color: '#2c3e50',
                                                                fontSize: '14px'
                                                            }} 
                                                            readOnly={index < 6}
                                                            disabled={isSubmitting}
                                                        />
                                                        <ErrorMessage name={`parameters.${index}.parameter`} component="div" style={{ color: '#e11d48', fontSize: '0.75rem', marginTop: '3px' }} />
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <Field 
                                                            type="number" 
                                                            step="0.01" 
                                                            name={`parameters.${index}.influent_value`} 
                                                            placeholder="Value"
                                                            style={{ 
                                                                padding: '8px', 
                                                                border: `1px solid ${touched.parameters?.[index]?.influent_value && errors.parameters?.[index]?.influent_value ? '#e11d48' : '#d1e5f1'}`, 
                                                                borderRadius: '4px', 
                                                                width: '90px',
                                                                fontSize: '14px'
                                                            }} 
                                                            disabled={isSubmitting}
                                                        />
                                                        <ErrorMessage name={`parameters.${index}.influent_value`} component="div" style={{ color: '#e11d48', fontSize: '0.7rem', marginTop: '2px' }} />
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <Field 
                                                            type="time" 
                                                            name={`parameters.${index}.influent_time`} 
                                                            style={{ 
                                                                padding: '8px', 
                                                                border: '1px solid #d1e5f1', 
                                                                borderRadius: '4px', 
                                                                width: '100px',
                                                                fontSize: '14px'
                                                            }} 
                                                            disabled={isSubmitting}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <Field 
                                                            type="number" 
                                                            step="0.01" 
                                                            name={`parameters.${index}.effluent_value`} 
                                                            placeholder="Value"
                                                            style={{ 
                                                                padding: '8px', 
                                                                border: `1px solid ${touched.parameters?.[index]?.effluent_value && errors.parameters?.[index]?.effluent_value ? '#e11d48' : '#d1e5f1'}`, 
                                                                borderRadius: '4px', 
                                                                width: '90px',
                                                                fontSize: '14px'
                                                            }} 
                                                            disabled={isSubmitting}
                                                        />
                                                        <ErrorMessage name={`parameters.${index}.effluent_value`} component="div" style={{ color: '#e11d48', fontSize: '0.7rem', marginTop: '2px' }} />
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <Field 
                                                            type="time" 
                                                            name={`parameters.${index}.effluent_time`} 
                                                            style={{ 
                                                                padding: '8px', 
                                                                border: '1px solid #d1e5f1', 
                                                                borderRadius: '4px', 
                                                                width: '100px',
                                                                fontSize: '14px'
                                                            }} 
                                                            disabled={isSubmitting}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                                        {index >= 6 && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => remove(index)}
                                                                style={{ 
                                                                    background: '#fee2e2', 
                                                                    color: '#e11d48', 
                                                                    border: 'none',
                                                                    padding: '5px 10px', 
                                                                    borderRadius: '4px', 
                                                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                                    fontSize: '13px',
                                                                    fontWeight: '500',
                                                                    opacity: isSubmitting ? 0.5 : 1
                                                                }}
                                                                title="Remove parameter"
                                                                disabled={isSubmitting}
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '15px' }}>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => push({ 
                                                            parameter: '', 
                                                            influent_value: '', 
                                                            influent_time: '', 
                                                            effluent_value: '', 
                                                            effluent_time: '', 
                                                            remarks: '' 
                                                        })}
                                                        style={{ 
                                                            background: '#e0f0fa', 
                                                            color: '#1a6fb0', 
                                                            border: '1px dashed #1a6fb0', 
                                                            padding: '10px 25px', 
                                                            borderRadius: '6px', 
                                                            cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                                            fontWeight: '600',
                                                            fontSize: '14px',
                                                            transition: 'all 0.2s',
                                                            opacity: isSubmitting ? 0.5 : 1
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isSubmitting) {
                                                                e.target.style.background = '#c9e4fa';
                                                                e.target.style.border = '1px solid #1a6fb0';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isSubmitting) {
                                                                e.target.style.background = '#e0f0fa';
                                                                e.target.style.border = '1px dashed #1a6fb0';
                                                            }
                                                        }}
                                                        disabled={isSubmitting}
                                                    >
                                                        <i className="fas fa-plus-circle" style={{ marginRight: '8px' }}></i> 
                                                        Add Custom Parameter
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    )}
                                </FieldArray>
                            </table>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: '600',
                                color: '#2c3e50'
                            }}>
                                Operational Notes
                            </label>
                            <Field 
                                as="textarea" 
                                name="operational_notes" 
                                placeholder="Equipment status, chemical dosing, maintenance issues, or any observations..."
                                style={{ 
                                    width: '100%', 
                                    padding: '12px', 
                                    border: '1px solid #d1e5f1', 
                                    borderRadius: '6px', 
                                    minHeight: '80px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit'
                                }}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="signature-area" style={{ 
                            display: 'flex', 
                            gap: '20px', 
                            marginTop: '30px', 
                            paddingTop: '20px', 
                            borderTop: '1px dashed #d1e5f1',
                            marginBottom: '25px'
                        }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    <i className="fas fa-user" style={{ marginRight: '8px', color: '#1a6fb0' }}></i>
                                    Operator
                                </label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value="Currently Logged-in User" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        background: '#e5e7eb', 
                                        border: '1px solid #d1e5f1', 
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        color: '#2c3e50'
                                    }} 
                                />
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#6b7280', 
                                    marginTop: '5px',
                                    fontStyle: 'italic'
                                }}>
                                    Operator will be automatically recorded
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            style={{ 
                                background: isOnline ? '#1a6fb0' : '#6c757d', 
                                color: 'white', 
                                border: 'none', 
                                padding: '12px 30px', 
                                borderRadius: '6px', 
                                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                fontSize: '15px', 
                                fontWeight: '600',
                                opacity: isSubmitting ? 0.7 : 1,
                                transition: 'background 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={(e) => {
                                if (!isSubmitting && isOnline) e.target.style.background = '#155d92';
                            }}
                            onMouseLeave={(e) => {
                                if (!isSubmitting && isOnline) e.target.style.background = '#1a6fb0';
                            }}
                        >
                            <i className={`fas ${
                                isSubmitting ? 'fa-spinner fa-spin' : 
                                isOnline ? 'fa-file-export' : 'fa-cloud-upload-alt'
                            }`}></i> 
                            {isSubmitting 
                                ? 'Saving...' 
                                : isOnline 
                                    ? 'Submit Daily Log' 
                                    : 'Save Offline'
                            }
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default TreatmentLogForm;