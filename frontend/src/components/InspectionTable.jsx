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
    new_mother_connections: 0,
    new_child_connections: 0,
    immediate_action_taken: '',
    further_action_required: '',
});

const PatrolRowSchema = Yup.object().shape({
    time: Yup.string().required('Time is required'),
    sewer_line_section: Yup.number().typeError('Select a sewer line section').required('Section is required'),
    sewer_line_ref_text: Yup.string().required('Reference text is required'),
    abnormality_observed: Yup.string().required('Select an abnormality status'),
    abnormality_details: Yup.string(),
    new_mother_connections: Yup.number().min(0, 'Cannot be negative').integer('Must be a whole number').required(),
    new_child_connections: Yup.number().min(0, 'Cannot be negative').integer('Must be a whole number').required(),
    immediate_action_taken: Yup.string(),
    further_action_required: Yup.string(),
    sectionSearch: Yup.string(),
});

const PatrolSchema = Yup.object().shape({
    date: Yup.date().required('Date is required'),
    drainage_area: Yup.string().required('Drainage area/estate is required'),
    rows: Yup.array().of(PatrolRowSchema).min(1, 'Add at least one patrol row').required('Add at least one patrol row'),
});

const InspectionTable = () => {
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    const [sections, setSections] = useState([]);
    const [submittedPatrol, setSubmittedPatrol] = useState(null);
    const { isOnline, refreshQueueCount } = useContext(SyncContext);
    const { user } = useContext(AuthContext);
    const isReadOnly = user?.role === 'sewer_line_officer';
    const userRole = user?.role || '';
    const canEscalate = ['admin','stp_superintendent','line_supervisor'].includes(userRole);

    useEffect(() => {
        let isActive = true;

        const loadSections = async () => {
            try {
                const response = await api.get('/api/sewer-line-sections/');
                if (isActive) {
                    const sectionRows = Array.isArray(response.data)
                        ? response.data
                        : (response.data?.results || []);
                    setSections(sectionRows);
                }
            } catch (error) {
                if (isActive) {
                    setSections([]);
                }
            }
        };

        loadSections();

        return () => {
            isActive = false;
        };
    }, []);

    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });

        const cleanedPayload = {
            date: values.date,
            drainage_area: values.drainage_area,
            rows: values.rows.map((row) => ({
                time: row.time,
                sewer_line_section: Number(row.sewer_line_section),
                sewer_line_ref_text: row.sewer_line_ref_text,
                abnormality_observed: row.abnormality_observed,
                abnormality_details: row.abnormality_details,
                new_mother_connections: row.new_mother_connections === '' ? 0 : parseInt(row.new_mother_connections, 10),
                new_child_connections: row.new_child_connections === '' ? 0 : parseInt(row.new_child_connections, 10),
                immediate_action_taken: row.immediate_action_taken,
                further_action_required: row.further_action_required,
            })),
        };

        try {
            if (isOnline) {
                const response = await api.post('/api/patrols/', cleanedPayload);

                if (response.status === 201 || response.status === 200) {
                    setSubmitStatus({ type: 'success', message: 'Patrol session submitted successfully!' });
                    setSubmittedPatrol(response.data);
                    resetForm({ values: { date: values.date, drainage_area: '', rows: [createRow()] } });
                }
            } else {
                throw new Error('Network offline');
            }
        } catch (error) {
            if (!navigator.onLine || error.message === 'Network Error' || error.message === 'Network offline' || error.code === 'ERR_NETWORK') {
                await addToQueue('/api/patrols/', cleanedPayload, 'POST', {
                    isPatrol: true,
                    area: cleanedPayload.drainage_area,
                    timestamp: new Date().toISOString(),
                });

                await refreshQueueCount();

                setSubmitStatus({
                    type: 'info',
                    message: 'Saved offline. Record will sync automatically when connection is restored.',
                });
                resetForm({ values: { date: values.date, drainage_area: '', rows: [createRow()] } });
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

    const getSectionById = (sectionId) => sections.find((section) => String(section.id) === String(sectionId));

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-search-location"></i> F201 Weekly Line Patrol
            </h2>

            {submitStatus.message && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: submitStatus.type === 'success' ? '#d1fae5' : submitStatus.type === 'error' ? '#fee2e2' : '#e0f2fe', color: submitStatus.type === 'success' ? '#065f46' : submitStatus.type === 'error' ? '#991b1b' : '#0284c7' }}>
                    {submitStatus.message}
                </div>
            )}

            {submittedPatrol && submittedPatrol.rows?.length > 0 && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#0369a1' }}>
                            <i className="fas fa-clipboard-check" style={{ marginRight: 6 }}></i>
                            Submitted Patrol — {submittedPatrol.date} ({submittedPatrol.drainage_area})
                        </strong>
                        <button onClick={() => setSubmittedPatrol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1rem' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {submittedPatrol.rows.map((row) => {
                            const sec = sections.find(s => s.id === row.sewer_line_section);
                            const hasAbnormality = row.abnormality_observed && row.abnormality_observed !== 'none';
                            return (
                                <div key={row.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                                    padding: '8px 10px', borderRadius: '6px',
                                    background: row.incident_id ? '#fef2f2' : 'white',
                                    border: `1px solid ${row.incident_id ? '#fca5a5' : '#e2e8f0'}`,
                                }}>
                                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.82rem' }}>{row.time}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{sec?.code || `Section ${row.sewer_line_section}`}</span>
                                    {hasAbnormality && (
                                        <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 4 }}>
                                            {row.abnormality_observed.replace(/_/g,' ')}
                                        </span>
                                    )}
                                    {row.incident_id && (
                                        <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                                            <i className="fas fa-link" style={{ marginRight: 4 }}></i>Incident #{row.incident_id}
                                        </span>
                                    )}
                                    {canEscalate && !row.incident_id && hasAbnormality && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post(`/api/patrol-rows/${row.id}/escalate/`);
                                                    setSubmittedPatrol(prev => ({
                                                        ...prev,
                                                        rows: prev.rows.map(r => r.id === row.id ? res.data : r)
                                                    }));
                                                } catch (err) {
                                                    setSubmitStatus({ type: 'error', message: err.response?.data?.error || 'Escalation failed.' });
                                                }
                                            }}
                                            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '3px 9px', borderRadius: 5, border: 'none', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }}></i>Escalate
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {isReadOnly && (
                <div style={{ padding: '15px', marginBottom: '20px', borderRadius: '6px', backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}>
                    Read-only access: sewer line officers cannot submit patrol records.
                </div>
            )}

            <Formik
                initialValues={{
                    date: new Date().toISOString().split('T')[0],
                    drainage_area: '',
                    rows: [createRow()],
                }}
                validationSchema={PatrolSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, values, setFieldValue, errors, touched }) => (
                    <Form>
                        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Date</label>
                                <Field disabled={isReadOnly} type="date" name="date" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                {touched.date && errors.date && <div style={{ color: '#b91c1c', marginTop: '6px' }}>{errors.date}</div>}
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 'bold' }}>Drainage Area / Estate</label>
                                <Field disabled={isReadOnly} type="text" name="drainage_area" placeholder="e.g. Kerugoya Central" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                {touched.drainage_area && errors.drainage_area && <div style={{ color: '#b91c1c', marginTop: '6px' }}>{errors.drainage_area}</div>}
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1rem', color: '#0f172a', marginBottom: '15px' }}><i className="fas fa-map-marked-alt" style={{color: '#0369a1'}}></i> Patrol Rows</h3>
                            {typeof errors.rows === 'string' && <div style={{ color: '#b91c1c', marginBottom: '12px' }}>{errors.rows}</div>}

                            <FieldArray name="rows">
                                {({ push, remove }) => (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        {values.rows.map((row, index) => {
                                            const searchText = row.sectionSearch || '';
                                            const filteredSections = sections.filter((section) => section.code.toLowerCase().includes(searchText.toLowerCase())).slice(0, 6);
                                            const selectedSection = getSectionById(row.sewer_line_section);

                                            return (
                                                <div key={index} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', background: '#fff' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <strong style={{ color: '#0f172a' }}>Row {index + 1}</strong>
                                                        {!isReadOnly && values.rows.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(index)}
                                                                style={{ border: 'none', background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
                                                            >
                                                                Remove Row
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>Time</label>
                                                            <Field disabled={isReadOnly} type="time" name={`rows.${index}.time`} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        </div>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>Sewer Line Ref Text</label>
                                                            <Field disabled={isReadOnly} type="text" name={`rows.${index}.sewer_line_ref_text`} placeholder="e.g. SL-104" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        </div>
                                                        <div className="form-group" style={{ position: 'relative' }}>
                                                            <label style={{ fontWeight: 'bold' }}>Sewer Line Section</label>
                                                            <input
                                                                disabled={isReadOnly}
                                                                type="text"
                                                                value={row.sectionSearch || (selectedSection?.code || '')}
                                                                onChange={(event) => {
                                                                    const nextValue = event.target.value;
                                                                    setFieldValue(`rows.${index}.sectionSearch`, nextValue);
                                                                    setFieldValue(`rows.${index}.sewer_line_section`, nextValue ? row.sewer_line_section : '');
                                                                }}
                                                                placeholder="Start typing a section code"
                                                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                            />
                                                            {selectedSection && (
                                                                <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#0f172a' }}>
                                                                    Selected: {selectedSection.code} {selectedSection.is_confirmed ? '(confirmed)' : '(unconfirmed)'}
                                                                </div>
                                                            )}
                                                            {!isReadOnly && searchText && filteredSections.length > 0 && (
                                                                <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0 0 8px 8px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)' }}>
                                                                    {filteredSections.map((section) => (
                                                                        <button
                                                                            key={section.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setFieldValue(`rows.${index}.sewer_line_section`, section.id);
                                                                                setFieldValue(`rows.${index}.sectionSearch`, section.code);
                                                                            }}
                                                                            style={{
                                                                                width: '100%',
                                                                                textAlign: 'left',
                                                                                padding: '10px 12px',
                                                                                border: 'none',
                                                                                background: 'white',
                                                                                cursor: 'pointer',
                                                                                fontWeight: section.is_confirmed ? 700 : 500,
                                                                                fontStyle: section.is_confirmed ? 'normal' : 'italic',
                                                                            }}
                                                                        >
                                                                            {section.code} {section.is_confirmed ? '(confirmed)' : '(unconfirmed)'}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>Abnormality Observed</label>
                                                            <Field disabled={isReadOnly} as="select" name={`rows.${index}.abnormality_observed`} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                                <option value="none">None (Line Clear)</option>
                                                                <option value="erosion">Erosion along lines</option>
                                                                <option value="missing_cover">Broken/Missing Manhole Cover</option>
                                                                <option value="blockage">Blockage</option>
                                                                <option value="overflow">Overflow/Spillage</option>
                                                                <option value="other">Other (Specify below)</option>
                                                            </Field>
                                                        </div>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>Abnormality Details</label>
                                                            <Field disabled={isReadOnly} type="text" name={`rows.${index}.abnormality_details`} placeholder="Specify details..." style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        </div>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>New Mother Connections</label>
                                                            <Field disabled={isReadOnly} type="number" min="0" name={`rows.${index}.new_mother_connections`} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        </div>
                                                        <div className="form-group">
                                                            <label style={{ fontWeight: 'bold' }}>New Child Connections</label>
                                                            <Field disabled={isReadOnly} type="number" min="0" name={`rows.${index}.new_child_connections`} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                                        </div>
                                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ fontWeight: 'bold' }}>Immediate Action Taken</label>
                                                            <Field disabled={isReadOnly} as="textarea" name={`rows.${index}.immediate_action_taken`} placeholder="What was done on site?" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }} />
                                                        </div>
                                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ fontWeight: 'bold' }}>Further Action Required</label>
                                                            <Field disabled={isReadOnly} as="textarea" name={`rows.${index}.further_action_required`} placeholder="Any follow-up needed?" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', minHeight: '60px' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={() => push(createRow())}
                                                style={{ width: 'fit-content', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                + Add Patrol Row
                                            </button>
                                        )}
                                    </div>
                                )}
                            </FieldArray>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || isReadOnly}
                            style={{ background: '#1a6fb0', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '6px', cursor: isSubmitting || isReadOnly ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isSubmitting || isReadOnly ? 0.6 : 1 }}
                        >
                            <i className="fas fa-save"></i> Save Patrol Log
                        </button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default InspectionTable;
