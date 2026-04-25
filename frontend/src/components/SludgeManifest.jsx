import React, { useState, useEffect, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const ManifestSchema = Yup.object().shape({
    exhauster: Yup.number().required('Selecting an exhauster is required'),
    collection_date: Yup.date().required('Date is required'),
    source_name: Yup.string().required('Name of plot/institution is required'),
    area_ward: Yup.string().required('Area is required'),
    toilets_present: Yup.boolean().required('Specify if toilets are present'),
    source_type: Yup.string().required('Source type is required'),
    volume_m3: Yup.number().min(1, 'Volume must be at least 1 m3').required('Volume is required'),
});

const SludgeManifest = () => {
    const [exhausters, setExhausters] = useState([]);
    const [selectedExhauster, setSelectedExhauster] = useState(null);
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (isOnline) {
            api.get('/api/exhausters/')
                .then((res) => setExhausters(res.data.results || res.data))
                .catch((err) => console.error('Failed to load exhausters', err));
        }
    }, [isOnline]);

    const handleExhausterChange = (e, setFieldValue) => {
        const exId = parseInt(e.target.value, 10);
        setFieldValue('exhauster', Number.isNaN(exId) ? '' : exId);

        const exhauster = exhausters.find((ex) => ex.id === exId);
        setSelectedExhauster(exhauster || null);

        if (exhauster && !exhauster.has_valid_license) {
            setStatusMsg({
                type: 'error',
                message: `WARNING: ${exhauster.reg_no} does NOT have a valid license! Dumping prohibited.`
            });
        } else {
            setStatusMsg({ type: '', message: '' });
        }
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        if (selectedExhauster && !selectedExhauster.has_valid_license) {
            setStatusMsg({
                type: 'error',
                message: 'TRANSACTION BLOCKED: Cannot accept sludge from an unlicensed exhauster.'
            });
            setSubmitting(false);
            return;
        }

        setStatusMsg({ type: 'info', message: 'Processing sludge manifest...' });

        try {
            if (isOnline) {
                await api.post('/api/sludge-collections/', values);
                setStatusMsg({
                    type: 'success',
                    message: 'Manifest recorded successfully! Operator JWT logged as digital signature.'
                });
                resetForm();
                setSelectedExhauster(null);
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/sludge-collections/', values, 'POST');
                await refreshQueueCount();
                setStatusMsg({ type: 'info', message: 'Saved offline. Manifest will sync when connection returns.' });
                resetForm();
                setSelectedExhauster(null);
            } else {
                setStatusMsg({ type: 'error', message: 'Failed to submit manifest.' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-truck"></i> Exhauster Sludge Manifest
            </h2>

            {statusMsg.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', fontWeight: 'bold', backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#e0f2fe', color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#0284c7' }}>
                    <i className={`fas ${statusMsg.type === 'error' ? 'fa-ban' : 'fa-info-circle'}`} style={{ marginRight: '8px' }}></i>
                    {statusMsg.message}
                </div>
            )}

            <Formik
                initialValues={{
                    exhauster: '',
                    collection_date: new Date().toISOString().split('T')[0],
                    source_name: '', area_ward: '',
                    toilets_present: true, source_type: '', volume_m3: '',
                    receiving_notes: ''
                }}
                validationSchema={ManifestSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: selectedExhauster && !selectedExhauster.has_valid_license ? '2px solid #ef4444' : '1px solid #e2e8f0', marginBottom: '25px' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '15px' }}><i className="fas fa-id-card"></i> 1. Exhauster Details & License Check</h3>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Exhauster (Reg Number)</label>
                                <select
                                    name="exhauster"
                                    value={values.exhauster}
                                    onChange={(e) => handleExhausterChange(e, setFieldValue)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                                >
                                    <option value="">-- Scan or Select Exhauster --</option>
                                    {exhausters.map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                            {ex.reg_no} - {ex.owner}
                                        </option>
                                    ))}
                                </select>
                                <ErrorMessage name="exhauster" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '15px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>2. Origin of the Sludge</h3>
                            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold' }}>Date of Collection</label>
                                    <Field type="date" name="collection_date" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                    <ErrorMessage name="collection_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold' }}>Name of Plot / Institution</label>
                                    <Field type="text" name="source_name" placeholder="e.g. Kerugoya Boys High" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                    <ErrorMessage name="source_name" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                </div>
                            </div>

                            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '15px' }}>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold' }}>Area / Location</label>
                                    <Field type="text" name="area_ward" placeholder="e.g. Kutus Town" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                    <ErrorMessage name="area_ward" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Toilets Present?</label>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Field type="radio" name="toilets_present" value="true" checked={values.toilets_present === true} onChange={() => setFieldValue('toilets_present', true)} /> Yes
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Field type="radio" name="toilets_present" value="false" checked={values.toilets_present === false} onChange={() => setFieldValue('toilets_present', false)} /> No
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '15px' }}><i className="fas fa-filter"></i> 3. Waste Classification & Volume</h3>
                            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Source Category</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label><Field type="radio" name="source_type" value="residential" /> Residential (Household)</label>
                                        <label><Field type="radio" name="source_type" value="institutional" /> Institutional (Schools/Hospitals)</label>
                                        <label><Field type="radio" name="source_type" value="commercial" /> Commercial / Industrial</label>
                                    </div>
                                    <ErrorMessage name="source_type" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontWeight: 'bold', color: '#1a6fb0' }}>Total Volume Dumped (m3)</label>
                                    <Field type="number" step="0.1" name="volume_m3" placeholder="Volume in cubic meters" style={{ width: '100%', padding: '15px', borderRadius: '6px', border: '2px solid #1a6fb0', fontSize: '1.2rem', fontWeight: 'bold' }} />
                                    <ErrorMessage name="volume_m3" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                                </div>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Operator Notes</label>
                            <Field as="textarea" name="receiving_notes" placeholder="Optional receiving notes" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                        </div>

                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: '#475569', fontSize: '0.9rem' }}>
                                <strong>Operator Logged In:</strong> {user?.full_name || 'Current User'} <br />
                                <em>(Submission acts as official digital receipt)</em>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || (selectedExhauster && !selectedExhauster.has_valid_license)}
                                style={{ background: (selectedExhauster && !selectedExhauster.has_valid_license) ? '#94a3b8' : '#1a6fb0', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '6px', cursor: (selectedExhauster && !selectedExhauster.has_valid_license) ? 'not-allowed' : 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                            >
                                <i className="fas fa-check-circle"></i> Approve & Log Manifest
                            </button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default SludgeManifest;
