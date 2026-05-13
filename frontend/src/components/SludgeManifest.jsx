import React, { useState, useEffect, useContext, useCallback } from 'react';
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

const statusBadge = (s) => {
    const map = {
        pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
        received: { bg: '#d1fae5', color: '#065f46', label: 'Received' },
        rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
    };
    const st = map[s] || { bg: '#f1f5f9', color: '#475569', label: s };
    return (
        <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '0.8rem' }}>
            {st.label}
        </span>
    );
};

const ManifestCard = ({ manifest, canReceive, canReject, onReceive, onRejectStart }) => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{manifest.source_name || '—'}</strong>
                <span style={{ color: '#64748b', marginLeft: '10px', fontSize: '0.9rem' }}>{manifest.area_ward}</span>
            </div>
            {statusBadge(manifest.manifest_status)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.85rem', color: '#475569' }}>
            <span><strong>Date:</strong> {manifest.collection_date}</span>
            <span><strong>Volume:</strong> {manifest.volume_m3} m³</span>
            <span><strong>Type:</strong> {manifest.source_type}</span>
            {manifest.exhauster_reg_no && <span><strong>Exhauster:</strong> {manifest.exhauster_reg_no}</span>}
            {manifest.driver_name && <span><strong>Driver:</strong> {manifest.driver_name}</span>}
            {manifest.received_by_name && <span><strong>Received by:</strong> {manifest.received_by_name}</span>}
        </div>
        {manifest.manifest_status === 'rejected' && manifest.rejection_reason && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#fee2e2', borderRadius: '6px', fontSize: '0.9rem', color: '#991b1b' }}>
                <strong>Rejection Reason:</strong> {manifest.rejection_reason}
            </div>
        )}
        {manifest.manifest_status === 'pending' && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {canReceive && (
                    <button
                        onClick={() => onReceive(manifest.id)}
                        style={{ background: '#059669', color: 'white', border: 'none', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                        <i className="fas fa-check" style={{ marginRight: '6px' }}></i>Mark Received
                    </button>
                )}
                {canReject && (
                    <button
                        onClick={() => onRejectStart(manifest.id)}
                        style={{ background: '#dc2626', color: 'white', border: 'none', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                        <i className="fas fa-ban" style={{ marginRight: '6px' }}></i>Reject
                    </button>
                )}
            </div>
        )}
    </div>
);

const SludgeManifest = () => {
    const [exhausters, setExhausters] = useState([]);
    const [manifests, setManifests] = useState([]);
    const [selectedExhauster, setSelectedExhauster] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [showForm, setShowForm] = useState(false);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    const canReceive = ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'].includes(user?.role);
    const canReject = ['admin', 'stp_superintendent', 'stp_supervisor'].includes(user?.role);

    const loadManifests = useCallback(async () => {
        if (!isOnline) return;
        try {
            const res = await api.get('/api/sludge/');
            setManifests(res.data.results || res.data);
        } catch (err) {
            console.error('Failed to load manifests', err);
        }
    }, [isOnline]);

    useEffect(() => {
        if (isOnline) {
            api.get('/api/exhausters/')
                .then((res) => setExhausters(res.data.results || res.data))
                .catch((err) => console.error('Failed to load exhausters', err));
            loadManifests();
        }
    }, [isOnline, loadManifests]);

    const flash = (type, message) => {
        setStatusMsg({ type, message });
        setTimeout(() => setStatusMsg({ type: '', message: '' }), 5000);
    };

    const handleExhausterChange = (e, setFieldValue) => {
        const exId = parseInt(e.target.value, 10);
        setFieldValue('exhauster', Number.isNaN(exId) ? '' : exId);
        const ex = exhausters.find((x) => x.id === exId);
        setSelectedExhauster(ex || null);
        if (ex && !ex.has_valid_license) {
            flash('error', `WARNING: ${ex.reg_no} does NOT have a valid license. Dumping prohibited.`);
        } else {
            setStatusMsg({ type: '', message: '' });
        }
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        if (selectedExhauster && !selectedExhauster.has_valid_license) {
            flash('error', 'TRANSACTION BLOCKED: Cannot accept sludge from an unlicensed exhauster.');
            setSubmitting(false);
            return;
        }
        try {
            if (isOnline) {
                await api.post('/api/sludge/', values);
                flash('success', 'Manifest submitted successfully.');
                resetForm();
                setSelectedExhauster(null);
                setShowForm(false);
                loadManifests();
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/sludge/', values, 'POST');
                await refreshQueueCount();
                flash('info', 'Saved offline. Manifest will sync when connection returns.');
                resetForm();
                setSelectedExhauster(null);
                setShowForm(false);
            } else {
                flash('error', error.response?.data?.detail || 'Failed to submit manifest.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleReceive = async (id) => {
        try {
            await api.patch(`/api/sludge/${id}/receive/`);
            flash('success', 'Manifest marked as received.');
            loadManifests();
        } catch (err) {
            flash('error', err.response?.data?.error || 'Failed to receive manifest.');
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectionReason.trim()) {
            flash('error', 'Rejection reason is required.');
            return;
        }
        try {
            await api.patch(`/api/sludge/${rejectingId}/reject/`, { rejection_reason: rejectionReason });
            flash('success', 'Manifest rejected.');
            setRejectingId(null);
            setRejectionReason('');
            loadManifests();
        } catch (err) {
            flash('error', err.response?.data?.rejection_reason || err.response?.data?.error || 'Failed to reject manifest.');
        }
    };

    const pendingManifests = manifests.filter((m) => m.manifest_status === 'pending');
    const receivedManifests = manifests.filter((m) => m.manifest_status === 'received');
    const rejectedManifests = manifests.filter((m) => m.manifest_status === 'rejected');

    const tabData = [
        { key: 'pending', label: `Pending (${pendingManifests.length})` },
        { key: 'received', label: `Received (${receivedManifests.length})` },
        { key: 'rejected', label: `Rejected (${rejectedManifests.length})` },
    ];

    const tabManifests = { pending: pendingManifests, received: receivedManifests, rejected: rejectedManifests };

    const fieldStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' };

    return (
        <div className="form-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <h2 style={{ color: '#1a6fb0', margin: 0 }}>
                    <i className="fas fa-truck"></i> Exhauster Sludge Manifest
                </h2>
                <button
                    onClick={() => setShowForm((v) => !v)}
                    style={{ background: showForm ? '#64748b' : '#1a6fb0', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                    <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'}`} style={{ marginRight: '6px' }}></i>
                    {showForm ? 'Cancel' : 'New Manifest'}
                </button>
            </div>

            {statusMsg.message && (
                <div style={{ padding: '12px 15px', marginBottom: '18px', borderRadius: '6px', fontWeight: 600, backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#e0f2fe', color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#0284c7' }}>
                    <i className={`fas ${statusMsg.type === 'error' ? 'fa-ban' : 'fa-info-circle'}`} style={{ marginRight: '8px' }}></i>
                    {statusMsg.message}
                </div>
            )}

            {rejectingId && (
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '16px', marginBottom: '18px' }}>
                    <h4 style={{ color: '#9a3412', margin: '0 0 10px' }}><i className="fas fa-ban"></i> Reject Manifest #{rejectingId}</h4>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="State the reason for rejection (mandatory)"
                        rows={3}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #fdba74', marginBottom: '10px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleRejectSubmit} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                            Confirm Rejection
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showForm && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                    <h3 style={{ color: '#0f172a', marginTop: 0, marginBottom: '16px' }}>New Sludge Manifest</h3>
                    <Formik
                        initialValues={{ exhauster: '', collection_date: new Date().toISOString().split('T')[0], source_name: '', area_ward: '', toilets_present: true, source_type: '', volume_m3: '', driver_name: '', receiving_notes: '' }}
                        validationSchema={ManifestSchema}
                        onSubmit={handleSubmit}
                    >
                        {({ isSubmitting, values, setFieldValue }) => (
                            <Form>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Exhauster (Reg No)</label>
                                        <select name="exhauster" value={values.exhauster} onChange={(e) => handleExhausterChange(e, setFieldValue)} style={{ ...fieldStyle, border: selectedExhauster && !selectedExhauster.has_valid_license ? '2px solid #ef4444' : '1px solid #cbd5e1' }}>
                                            <option value="">-- Select Exhauster --</option>
                                            {exhausters.map((ex) => (
                                                <option key={ex.id} value={ex.id}>{ex.reg_no} — {ex.owner}</option>
                                            ))}
                                        </select>
                                        <ErrorMessage name="exhauster" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Driver Name</label>
                                        <Field type="text" name="driver_name" placeholder="Truck driver's full name" style={fieldStyle} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Date of Collection</label>
                                        <Field type="date" name="collection_date" style={fieldStyle} />
                                        <ErrorMessage name="collection_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Name of Plot / Institution</label>
                                        <Field type="text" name="source_name" placeholder="e.g. Kerugoya Boys High" style={fieldStyle} />
                                        <ErrorMessage name="source_name" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Area / Location</label>
                                        <Field type="text" name="area_ward" placeholder="e.g. Kutus Town" style={fieldStyle} />
                                        <ErrorMessage name="area_ward" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Volume (m³)</label>
                                        <Field type="number" step="0.1" name="volume_m3" placeholder="Cubic meters" style={{ ...fieldStyle, border: '2px solid #1a6fb0', fontWeight: 'bold', fontSize: '1.1rem' }} />
                                        <ErrorMessage name="volume_m3" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Source Category</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label><Field type="radio" name="source_type" value="residential" /> Residential</label>
                                            <label><Field type="radio" name="source_type" value="institutional" /> Institutional</label>
                                            <label><Field type="radio" name="source_type" value="commercial" /> Commercial / Industrial</label>
                                        </div>
                                        <ErrorMessage name="source_type" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '4px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Toilets Present?</label>
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
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Notes</label>
                                    <Field as="textarea" name="receiving_notes" placeholder="Optional notes" style={{ ...fieldStyle, minHeight: '60px' }} />
                                </div>
                                <button type="submit" disabled={isSubmitting || (selectedExhauster && !selectedExhauster.has_valid_license)} style={{ background: (selectedExhauster && !selectedExhauster.has_valid_license) ? '#94a3b8' : '#1a6fb0', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: (selectedExhauster && !selectedExhauster.has_valid_license) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                                    <i className="fas fa-paper-plane" style={{ marginRight: '6px' }}></i>Submit Manifest
                                </button>
                            </Form>
                        )}
                    </Formik>
                </div>
            )}

            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '16px' }}>
                {tabData.map((t) => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '9px 18px', border: 'none', borderBottom: activeTab === t.key ? '3px solid #1a6fb0' : '3px solid transparent', background: 'none', fontWeight: activeTab === t.key ? 700 : 400, color: activeTab === t.key ? '#1a6fb0' : '#64748b', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '-2px' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tabManifests[activeTab].length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                    <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                    No {activeTab} manifests.
                </div>
            ) : (
                tabManifests[activeTab].map((m) => (
                    <ManifestCard
                        key={m.id}
                        manifest={m}
                        canReceive={canReceive}
                        canReject={canReject}
                        onReceive={handleReceive}
                        onRejectStart={(id) => { setRejectingId(id); setRejectionReason(''); }}
                    />
                ))
            )}
        </div>
    );
};

export default SludgeManifest;
