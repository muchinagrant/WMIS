import React, { useState, useContext } from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const TreatmentLogSchema = Yup.object().shape({
    report_date: Yup.date().required('Date is required'),
    shift: Yup.string().oneOf(['Day', 'Night']).required('Shift is required'),
    parameters: Yup.array().of(
        Yup.object().shape({
            parameter: Yup.string().required('Parameter name required'),
            influent_value: Yup.number().typeError('Must be a number').nullable(),
            effluent_value: Yup.number().typeError('Must be a number').nullable()
        })
    )
});

const TreatmentLogForm = () => {
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    const initialValues = {
        report_date: new Date().toISOString().split('T')[0],
        shift: 'Day',
        parameters: [
            { parameter: 'BOD (mg/l)', influent_value: '', effluent_value: '' },
            { parameter: 'TSS (mg/l)', influent_value: '', effluent_value: '' },
            { parameter: 'pH', influent_value: '', effluent_value: '' }
        ]
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setStatusMsg({ type: '', message: '' });

        const payload = {
            report_date: values.report_date,
            shift: values.shift,
            parameters: values.parameters
                .filter(p => p.influent_value !== '' || p.effluent_value !== '')
                .map(p => ({
                    parameter: p.parameter,
                    influent_value: p.influent_value || 0,
                    effluent_value: p.effluent_value || 0
                }))
        };

        try {
            if (isOnline) {
                const res = await api.post('/api/treatment-logs/', payload);
                if (res.status === 201) {
                    setStatusMsg({ type: 'success', message: 'Treatment Plant Efficiency log submitted successfully!' });
                    resetForm();
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/treatment-logs/', payload, 'POST', { isTreatmentLog: true, date: values.report_date, shift: values.shift });
                await refreshQueueCount();
                setStatusMsg({
                    type: 'info',
                    message: 'Treatment log saved offline and will sync when connection is restored.'
                });
                resetForm();
            } else {
                setStatusMsg({
                    type: 'error',
                    message: 'Failed to submit treatment log.'
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-leaf"></i> Treatment Plant Efficiency Log
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
                validationSchema={TreatmentLogSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values }) => (
                    <Form>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Report Date <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field type="date" name="report_date" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                                <ErrorMessage name="report_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Shift <span style={{ color: '#e11d48' }}>*</span></label>
                                <Field as="select" name="shift" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                                    <option value="Day">Day</option>
                                    <option value="Night">Night</option>
                                </Field>
                                <ErrorMessage name="shift" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '30px' }}>
                            <h3 style={{ margin: '0 0 20px', color: '#0369a1', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-chart-line"></i> Treatment Plant Parameters
                            </h3>

                            <div className="scrollable-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Parameter</th>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'center', fontWeight: '600' }}>Influent (mg/l)</th>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'center', fontWeight: '600' }}>Effluent (mg/l)</th>
                                            <th style={{ background: '#0369a1', color: 'white', padding: '12px', textAlign: 'center', fontWeight: '600' }}>Efficiency (%)</th>
                                        </tr>
                                    </thead>
                                    <FieldArray name="parameters">
                                        {() => (
                                            <tbody>
                                                {values.parameters.map((param, index) => {
                                                    const inf = parseFloat(values.parameters[index].influent_value);
                                                    const eff = parseFloat(values.parameters[index].effluent_value);
                                                    let liveEff = "—";
                                                    let effColor = "#64748b";
                                                    
                                                    if (inf && eff && !isNaN(inf) && !isNaN(eff) && inf > 0) {
                                                        const calc = ((inf - eff) / inf) * 100;
                                                        liveEff = `${calc.toFixed(2)}%`;
                                                        effColor = calc > 80 ? '#16a34a' : (calc > 60 ? '#ca8a04' : '#dc2626');
                                                    }

                                                    return (
                                                        <tr key={index} style={{ borderBottom: '1px solid #e0e7ff' }}>
                                                            <td style={{ padding: '12px', fontWeight: '600', color: '#1e293b' }}>{param.parameter}</td>
                                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                <Field
                                                                    type="number"
                                                                    step="0.1"
                                                                    name={`parameters.${index}.influent_value`}
                                                                    placeholder="0.0"
                                                                    style={{ width: '110px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                <Field
                                                                    type="number"
                                                                    step="0.1"
                                                                    name={`parameters.${index}.effluent_value`}
                                                                    placeholder="0.0"
                                                                    style={{ width: '110px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: effColor, fontSize: '0.95rem' }}>
                                                                {liveEff}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        )}
                                    </FieldArray>
                                </table>
                            </div>

                            <div style={{ marginTop: '15px', padding: '12px', background: '#dbeafe', borderRadius: '6px', fontSize: '0.9rem', color: '#0c4a6e' }}>
                                <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                                <strong>Compliance Status:</strong> Green (≥80% efficient), Yellow (60-79%), Red (&lt;60%)
                            </div>
                        </div>

                        <div className="signature-area" style={{ display: 'flex', gap: '20px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', marginBottom: '25px' }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Lab Technician / Operator</label>
                                <input type="text" disabled value={user?.full_name || 'Current User'} style={{ width: '100%', padding: '12px', background: '#f3f4f6', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
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
                            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Treatment Log' : 'Save Offline'}
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default TreatmentLogForm;