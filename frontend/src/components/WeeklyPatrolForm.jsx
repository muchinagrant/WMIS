import React, { useContext, useEffect, useState } from 'react';
import { FieldArray, Form, Formik, Field } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { addToQueue } from '../api/offlineQueue';
import AuthContext from '../context/AuthContext';

const createRow = () => ({
    time: new Date().toTimeString().slice(0, 5),
    sectionSearch: '',
    sewer_line_section: '',
    sewer_line_ref_text: '',
    abnormality_observed: 'none',
    abnormality_details: '',
    new_main_connections: 0,
    new_branch_connections: 0,
    immediate_action_taken: '',
    further_action_required: '',
    photo: null,
    photoPreview: null,
});

const PatrolRowSchema = Yup.object().shape({
    time: Yup.string().required('Time is required'),
    sewer_line_section: Yup.number().typeError('Select a sewer line section').required('Section is required'),
    sewer_line_ref_text: Yup.string().required('Reference text is required'),
    abnormality_observed: Yup.string().required('Select an abnormality status'),
    abnormality_details: Yup.string(),
    new_main_connections: Yup.number().min(0, 'Cannot be negative').integer('Must be a whole number').required(),
    new_branch_connections: Yup.number().min(0, 'Cannot be negative').integer('Must be a whole number').required(),
    immediate_action_taken: Yup.string(),
    further_action_required: Yup.string(),
    sectionSearch: Yup.string(),
    photo: Yup.mixed().nullable(),
});

const PatrolSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    zone: Yup.number().typeError('Select a zone').required('Zone is required'),
    rows: Yup.array().of(PatrolRowSchema).min(1, 'Add at least one patrol row').required('Add at least one patrol row'),
});

const WeeklyPatrolForm = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    const [zones, setZones] = useState([]);
    const [sewerLines, setSewerLines] = useState([]);
    const [submittedPatrol, setSubmittedPatrol] = useState(null);
    const [draftPatrol, setDraftPatrol] = useState(null);
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);

    // Load zones on mount
    useEffect(() => {
        let isActive = true;

        const loadZones = async () => {
            try {
                const response = await api.get('/api/zones/');
                if (isActive) {
                    const zoneList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
                    setZones(zoneList);
                }
            } catch (error) {
                if (isActive) {
                    setZones([]);
                }
            }
        };

        const loadDraft = async () => {
            try {
                // Try to load the current week's draft for this user
                const today = new Date();
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                const dateStr = startOfWeek.toISOString().split('T')[0];
                
                const response = await api.get(`/api/patrols/?attendant=${user.id}&date__gte=${dateStr}&status=draft`);
                if (isActive && response.data && response.data.results && response.data.results.length > 0) {
                    setDraftPatrol(response.data.results[0]);
                }
            } catch (error) {
                // No draft found - that's OK
            }
        };

        loadZones();
        if (user?.id) loadDraft();

        return () => {
            isActive = false;
        };
    }, [user?.id]);

    // Load sewer lines when zone is selected
    const loadSewerLines = async (zoneId) => {
        if (!zoneId) {
            setSewerLines([]);
            return;
        }
        try {
            const response = await api.get(`/api/sewer-lines/?zone=${zoneId}&is_active=true`);
            const linesList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setSewerLines(linesList);
        } catch (error) {
            setSewerLines([]);
        }
    };

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });

        const formData = new FormData();
        formData.append('date', values.date);
        formData.append('zone', values.zone);
        formData.append('status', 'submitted'); // Always submit as submitted (not draft)

        // Create rows array with file uploads handled separately
        const rows = values.rows.map((row, idx) => ({
            ...row,
            photo: row.photo instanceof File ? `row_${idx}_photo` : null,
        }));

        // Add rows to form data
        rows.forEach((row, idx) => {
            Object.keys(row).forEach(key => {
                if (key === 'photo') {
                    if (values.rows[idx].photo instanceof File) {
                        formData.append(`rows[${idx}][photo]`, values.rows[idx].photo);
                    }
                } else if (key !== 'photoPreview' && key !== 'sectionSearch') {
                    formData.append(`rows[${idx}][${key}]`, row[key] ?? '');
                }
            });
        });

        try {
            if (isOnline) {
                const response = await api.post('/api/patrols/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                if (response.status === 201 || response.status === 200) {
                    setSubmitStatus({ type: 'success', message: 'Patrol session submitted successfully!' });
                    setSubmittedPatrol(response.data);
                    setDraftPatrol(null);
                    resetForm({ values: { date: new Date().toISOString().split('T')[0], zone: '', rows: [createRow()] } });
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/patrols/', formData, 'POST', {
                    isPatrol: true,
                    timestamp: new Date().toISOString(),
                });

                await refreshQueueCount();

                setSubmitStatus({
                    type: 'info',
                    message: 'Saved offline. Record will sync automatically when connection is restored.',
                });
                setDraftPatrol(null);
                resetForm({ values: { date: new Date().toISOString().split('T')[0], zone: '', rows: [createRow()] } });
            } else {
                setSubmitStatus({
                    type: 'error',
                    message: error.response?.data?.detail || 'Failed to submit patrol record. Please try again.',
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = async (values) => {
        const formData = new FormData();
        formData.append('date', values.date);
        formData.append('zone', values.zone);
        formData.append('status', 'draft');

        const rows = values.rows.map((row, idx) => ({
            ...row,
            photo: row.photo instanceof File ? `row_${idx}_photo` : null,
        }));

        rows.forEach((row, idx) => {
            Object.keys(row).forEach(key => {
                if (key === 'photo') {
                    if (values.rows[idx].photo instanceof File) {
                        formData.append(`rows[${idx}][photo]`, values.rows[idx].photo);
                    }
                } else if (key !== 'photoPreview' && key !== 'sectionSearch') {
                    formData.append(`rows[${idx}][${key}]`, row[key] ?? '');
                }
            });
        });

        try {
            const response = await api.post('/api/patrols/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSubmitStatus({ type: 'success', message: 'Draft saved successfully!' });
            setDraftPatrol(response.data);
        } catch (error) {
            setSubmitStatus({
                type: 'error',
                message: error.response?.data?.detail || 'Failed to save draft. Please try again.',
            });
        }
    };

    const getSectionByRef = (refCode) => sewerLines.find((line) => String(line.reference_code) === String(refCode));

    const zoneForDraft = draftPatrol?.zone;
    const draftZoneName = zones.find(z => z.id === zoneForDraft)?.name || '';

    return (
        <div className="form-section active">
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: '#1a6fb0', marginBottom: '8px', paddingBottom: '0' }}>
                    <i className="fas fa-map-location"></i> Weekly Line Patrol Log
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Form F201</p>
            </div>

            {submitStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: submitStatus.type === 'success' ? '#d1fae5' : submitStatus.type === 'error' ? '#fee2e2' : '#e0f2fe', color: submitStatus.type === 'success' ? '#065f46' : submitStatus.type === 'error' ? '#991b1b' : '#0284c7' }}>
                    {submitStatus.message}
                </div>
            )}

            {draftPatrol && (
                <div style={{ background: '#fef8e7', border: '2px solid #f59e0b', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#92400e' }}>
                            <i className="fas fa-draft" style={{ marginRight: 6 }}></i>
                            Unsaved Draft — {draftPatrol.date} ({draftZoneName})
                        </strong>
                        <button onClick={() => setDraftPatrol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '1.2rem' }}>✕</button>
                    </div>
                    <p style={{ color: '#92400e', fontSize: '0.9rem', margin: '8px 0' }}>Continue editing or start a new patrol log.</p>
                </div>
            )}

            {submittedPatrol && submittedPatrol.rows?.length > 0 && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#0369a1' }}>
                            <i className="fas fa-clipboard-check" style={{ marginRight: 6 }}></i>
                            Submitted Patrol — {submittedPatrol.date}
                        </strong>
                        <button onClick={() => setSubmittedPatrol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1rem' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {submittedPatrol.rows.map((row) => {
                            const line = sewerLines.find(s => s.id === row.sewer_line_section);
                            const hasAbnormality = row.abnormality_observed && row.abnormality_observed !== 'none';
                            return (
                                <div key={row.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                                    padding: '8px 10px', borderRadius: '6px', background: 'white',
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.82rem' }}>{row.time}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{line?.reference_code || `Line ${row.sewer_line_section}`}</span>
                                    {hasAbnormality && (
                                        <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 4 }}>
                                            {row.abnormality_observed.replace(/_/g, ' ')}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <Formik
                initialValues={draftPatrol ? {
                    date: draftPatrol.date,
                    zone: draftPatrol.zone,
                    rows: draftPatrol.rows.map(r => ({ ...r, photoPreview: r.photo_url, sectionSearch: '' })),
                } : {
                    date: new Date().toISOString().split('T')[0],
                    zone: '',
                    rows: [createRow()],
                }}
                validationSchema={PatrolSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values, setFieldValue, errors, touched }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Date <span style={{ color: '#dc2626' }}>*</span></label>
                                <Field type="date" name="date" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                {touched.date && errors.date && <div style={{ color: '#b91c1c', marginTop: '6px' }}>{errors.date}</div>}
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Zone / Drainage Area <span style={{ color: '#dc2626' }}>*</span></label>
                                <Field
                                    as="select"
                                    name="zone"
                                    onChange={(e) => {
                                        setFieldValue('zone', e.target.value);
                                        loadSewerLines(e.target.value || null);
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                >
                                    <option value="">Select a zone...</option>
                                    {zones.map((z) => (
                                        <option key={z.id} value={z.id}>
                                            {z.name}
                                        </option>
                                    ))}
                                </Field>
                                {touched.zone && errors.zone && <div style={{ color: '#b91c1c', marginTop: '6px' }}>{errors.zone}</div>}
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1rem', color: '#0f172a', marginBottom: '15px' }}>
                                <i className="fas fa-map-marked-alt" style={{ color: '#0369a1' }}></i> Patrol Rows
                            </h3>
                            {typeof errors.rows === 'string' && <div style={{ color: '#b91c1c', marginBottom: '12px' }}>{errors.rows}</div>}

                            <FieldArray name="rows">
                                {({ push, remove }) => (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        {values.rows.map((row, index) => {
                                            const searchText = row.sectionSearch || '';
                                            const filteredSections = sewerLines
                                                .filter((line) => line.reference_code.toLowerCase().includes(searchText.toLowerCase()))
                                                .slice(0, 6);
                                            const selectedLine = getSectionByRef(row.sewer_line_section);
                                            const showAbnormalityDetails = row.abnormality_observed !== 'none';
                                            const showFurtherAction = row.further_action_required && row.further_action_required.trim().length > 0;

                                            return (
                                                <div key={index} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', background: '#fff' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <strong style={{ color: '#0f172a' }}>Row {index + 1}</strong>
                                                        {values.rows.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(index)}
                                                                style={{ border: 'none', background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                                                            >
                                                                <i className="fas fa-trash" style={{ marginRight: 4 }}></i>Remove
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Time */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Time</label>
                                                        <Field type="time" name={`rows.${index}.time`} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        {touched.rows?.[index]?.time && errors.rows?.[index]?.time && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '4px' }}>{errors.rows[index].time}</div>}
                                                    </div>

                                                    {/* Sewer Line Section (Typeahead) */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Sewer Line Section <span style={{ color: '#dc2626' }}>*</span></label>
                                                        <Field
                                                            type="text"
                                                            name={`rows.${index}.sectionSearch`}
                                                            placeholder="Search by reference code..."
                                                            onChange={(e) => setFieldValue(`rows.${index}.sectionSearch`, e.target.value)}
                                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '6px' }}
                                                        />
                                                        {filteredSections.length > 0 && (
                                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', background: '#f9fafb' }}>
                                                                {filteredSections.map((line) => (
                                                                    <div
                                                                        key={line.id}
                                                                        onClick={() => {
                                                                            setFieldValue(`rows.${index}.sewer_line_section`, line.reference_code);
                                                                            setFieldValue(`rows.${index}.sectionSearch`, '');
                                                                            setFieldValue(`rows.${index}.sewer_line_ref_text`, line.description || line.reference_code);
                                                                        }}
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            borderBottom: '1px solid #e2e8f0',
                                                                            ':hover': { background: '#f3f4f6' },
                                                                        }}
                                                                    >
                                                                        <strong>{line.reference_code}</strong> — {line.description || 'No description'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {row.sewer_line_section && selectedLine && (
                                                            <div style={{ fontSize: '0.85rem', color: '#059669', background: '#d1fae5', padding: '6px 8px', borderRadius: '4px', marginTop: '6px' }}>
                                                                ✓ {selectedLine.reference_code}
                                                            </div>
                                                        )}
                                                        {touched.rows?.[index]?.sewer_line_section && errors.rows?.[index]?.sewer_line_section && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '4px' }}>{errors.rows[index].sewer_line_section}</div>}
                                                    </div>

                                                    {/* New Main Connections (renamed from new_mother_connections) */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                                                            New Main Connections Found
                                                            <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '6px' }}>(main line connection)</span>
                                                        </label>
                                                        <Field type="number" name={`rows.${index}.new_main_connections`} min="0" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        {touched.rows?.[index]?.new_main_connections && errors.rows?.[index]?.new_main_connections && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '4px' }}>{errors.rows[index].new_main_connections}</div>}
                                                    </div>

                                                    {/* New Branch Connections (renamed from new_child_connections) */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                                                            New Branch Connections Found
                                                            <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '6px' }}>(branch connection from main)</span>
                                                        </label>
                                                        <Field type="number" name={`rows.${index}.new_branch_connections`} min="0" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        {touched.rows?.[index]?.new_branch_connections && errors.rows?.[index]?.new_branch_connections && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '4px' }}>{errors.rows[index].new_branch_connections}</div>}
                                                    </div>

                                                    {/* Abnormality Observed */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Abnormality Observed</label>
                                                        <Field
                                                            as="select"
                                                            name={`rows.${index}.abnormality_observed`}
                                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                        >
                                                            <option value="none">None</option>
                                                            <option value="erosion">Erosion along lines</option>
                                                            <option value="missing_cover">Broken/Missing Manhole Cover</option>
                                                            <option value="blockage">Blockage</option>
                                                            <option value="overflow">Overflow/Spillage</option>
                                                            <option value="other">Other (Specify in details)</option>
                                                        </Field>
                                                    </div>

                                                    {/* Abnormality Details (conditional) */}
                                                    {showAbnormalityDetails && (
                                                        <div style={{ marginBottom: '12px', padding: '10px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Abnormality Details</label>
                                                            <Field
                                                                as="textarea"
                                                                name={`rows.${index}.abnormality_details`}
                                                                placeholder="Describe the abnormality..."
                                                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #fcd34d', minHeight: '80px' }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Immediate Action Taken */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Immediate Action Taken</label>
                                                        <Field
                                                            as="textarea"
                                                            name={`rows.${index}.immediate_action_taken`}
                                                            placeholder="What action was taken immediately..."
                                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }}
                                                        />
                                                    </div>

                                                    {/* Further Action Required (conditional visibility) */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Further Action Required</label>
                                                        <Field
                                                            as="textarea"
                                                            name={`rows.${index}.further_action_required`}
                                                            placeholder="Leave blank if no further action needed..."
                                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }}
                                                        />
                                                        {showFurtherAction && (
                                                            <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '4px', fontWeight: 600 }}>
                                                                <i className="fas fa-exclamation-circle" style={{ marginRight: 4 }}></i>Follow-up required
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Photo Upload (Section 5.6) */}
                                                    <div style={{ marginBottom: '0' }}>
                                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Photo Attachment (Optional)</label>
                                                        <div style={{ position: 'relative', border: '2px dashed #cbd5e1', borderRadius: '4px', padding: '12px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb', transition: 'all 0.3s' }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => {
                                                                    const file = e.currentTarget.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            setFieldValue(`rows.${index}.photo`, file);
                                                                            setFieldValue(`rows.${index}.photoPreview`, reader.result);
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                                style={{ display: 'none' }}
                                                                id={`photo-input-${index}`}
                                                            />
                                                            <label htmlFor={`photo-input-${index}`} style={{ cursor: 'pointer', display: 'block' }}>
                                                                {row.photoPreview ? (
                                                                    <div>
                                                                        <img src={row.photoPreview} alt="preview" style={{ maxHeight: '100px', marginBottom: '8px', borderRadius: '4px' }} />
                                                                        <div style={{ fontSize: '0.85rem', color: '#059669' }}>Click to replace</div>
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.5rem', color: '#9ca3af', marginBottom: '8px', display: 'block' }}></i>
                                                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Click to upload or drag image</div>
                                                                    </div>
                                                                )}
                                                            </label>
                                                            {row.photoPreview && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFieldValue(`rows.${index}.photo`, null);
                                                                        setFieldValue(`rows.${index}.photoPreview`, null);
                                                                    }}
                                                                    style={{ position: 'absolute', top: '4px', right: '4px', background: '#fee2e2', border: 'none', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                >
                                                                    ✕ Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Sticky Add Row Button (mobile) */}
                                        <button
                                            type="button"
                                            onClick={() => push(createRow())}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                marginTop: '8px',
                                            }}
                                        >
                                            <i className="fas fa-plus" style={{ marginRight: 6 }}></i> Add Patrol Row
                                        </button>
                                    </div>
                                )}
                            </FieldArray>
                        </div>

                        {/* Form Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <button
                                type="button"
                                onClick={() => handleSaveDraft(values)}
                                disabled={isSubmitting}
                                style={{
                                    padding: '12px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: isSubmitting ? 0.6 : 1,
                                }}
                            >
                                <i className="fas fa-save" style={{ marginRight: 6 }}></i> Save Draft
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{
                                    padding: '12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: isSubmitting ? 0.6 : 1,
                                }}
                            >
                                <i className="fas fa-check-circle" style={{ marginRight: 6 }}></i> Submit Patrol Log
                            </button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default WeeklyPatrolForm;
