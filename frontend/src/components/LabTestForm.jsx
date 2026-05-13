import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';
import {
    INFLOW_PARAMS, EFFLUENT_PARAMS, OPS_PARAMS, ALL_PARAMS,
    SUMMARY_TABLE_COLS, isExceedance, REMOVAL_EFFICIENCY_TARGET,
} from '../config/labParameterConfig';

const FREQ_COLORS = { D: '#0369a1', '2W': '#7c3aed', W: '#059669', M: '#d97706' };

const FreqBadge = ({ freq }) => (
    <span style={{
        fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
        background: FREQ_COLORS[freq] || '#6b7280', color: 'white', marginLeft: 4,
    }}>{freq}</span>
);

const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];

const isBODExceedance  = (r) => isExceedance('effluent_bod', r?.effluent_bod);
const isTSSExceedance  = (r) => isExceedance('effluent_tss', r?.effluent_tss);
const isTurbExceedance = (r) => isExceedance('effluent_turbidity', r?.effluent_turbidity);

const emptyForm = () => {
    const o = { remarks: '' };
    ALL_PARAMS.forEach(p => { o[p.key] = ''; });
    return o;
};

const recordToForm = (rec) => {
    if (!rec) return emptyForm();
    const o = { remarks: rec.remarks || '' };
    ALL_PARAMS.forEach(p => { o[p.key] = rec[p.key] !== null && rec[p.key] !== undefined ? String(rec[p.key]) : ''; });
    return o;
};

// --- Main Component ---
const LabTestForm = () => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'lab_tech';
    const canVerify = ['admin', 'stp_superintendent', 'stp_supervisor'].includes(userRole);

    const today = new Date();
    const [selectedYear,  setSelectedYear]  = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [records, setRecords]   = useState([]);   // Array of DailyLabRecord
    const [loading, setLoading]   = useState(false);
    const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

    // Modal state
    const [modal, setModal]       = useState(null);  // { day, record|null, form }
    const [saving, setSaving]     = useState(false);
    const [activeSection, setActiveSection] = useState('inflow');

    // --- Fetch records for selected month ---
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/lab-records/', { params: { year: selectedYear, month: selectedMonth } });
            setRecords(res.data);
        } catch {
            setActionMsg({ type: 'error', text: 'Failed to load records.' });
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    // --- Build day map ---
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const recordMap = {};
    records.forEach(r => {
        const d = parseInt(r.record_date.split('-')[2], 10);
        recordMap[d] = r;
    });

    // --- Open modal for a day ---
    const openModal = (day) => {
        const record = recordMap[day] || null;
        setActiveSection('inflow');
        setModal({ day, record, form: recordToForm(record) });
    };

    const closeModal = () => setModal(null);

    // --- Save (POST or PATCH) ---
    const handleSave = async () => {
        if (!modal) return;
        setSaving(true);
        setActionMsg({ type: '', text: '' });

        const padded = String(selectedMonth).padStart(2, '0');
        const dayPad = String(modal.day).padStart(2, '0');
        const dateStr = `${selectedYear}-${padded}-${dayPad}`;

        const payload = { record_date: dateStr, remarks: modal.form.remarks };
        ALL_PARAMS.forEach(p => {
            const v = modal.form[p.key];
            if (v !== '' && v !== null && v !== undefined) {
                payload[p.key] = Number(v);
            }
        });

        try {
            if (modal.record) {
                await api.patch(`/api/lab-records/${modal.record.id}/`, payload);
                setActionMsg({ type: 'success', text: `Day ${modal.day} record updated.` });
            } else {
                await api.post('/api/lab-records/', payload);
                setActionMsg({ type: 'success', text: `Day ${modal.day} record created.` });
            }
            await fetchRecords();
            closeModal();
        } catch (err) {
            const detail = err.response?.data;
            const msg = typeof detail === 'object' ? JSON.stringify(detail) : String(detail || 'Save failed.');
            setActionMsg({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    // --- Verify ---
    const handleVerify = async (record) => {
        setActionMsg({ type: '', text: '' });
        try {
            await api.patch(`/api/lab-records/${record.id}/verify/`);
            setActionMsg({ type: 'success', text: `Day ${record.record_date.split('-')[2]} verified.` });
            await fetchRecords();
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.error || 'Verify failed.' });
        }
    };

    // --- Prev / Next month ---
    const prevMonth = () => {
        if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
        else setSelectedMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
        else setSelectedMonth(m => m + 1);
    };

    // --- Efficiency cell ---
    const EffCell = ({ record, field }) => {
        const val = record?.[field];
        if (val === null || val === undefined) return <span style={{ color: '#94a3b8' }}>—</span>;
        const n = Number(val);
        const isExc = field === 'effluent_bod' ? isBODExceedance(record) : (field === 'effluent_tss' ? isTSSExceedance(record) : (field === 'effluent_turbidity' ? isTurbExceedance(record) : false));
        return <span style={{ color: isExc ? '#dc2626' : '#166534', fontWeight: isExc ? 700 : 400 }}>{n.toFixed(1)}</span>;
    };

    const sS = { padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', whiteSpace: 'nowrap' };
    const hS = { padding: '10px 12px', background: '#0f4c81', color: 'white', fontSize: '0.78rem', whiteSpace: 'nowrap', textAlign: 'center', position: 'sticky', top: 0 };

    return (
        <div className="form-section active">
            {/* Header */}
            <h2 style={{ color: '#0369a1', marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-flask"></i> F203B Daily Lab Records
            </h2>

            {/* Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={prevMonth} style={navBtnStyle}><i className="fas fa-chevron-left"></i></button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b', minWidth: 180, textAlign: 'center' }}>
                    {MONTHS[selectedMonth - 1]} {selectedYear}
                </span>
                <button onClick={nextMonth} style={navBtnStyle}><i className="fas fa-chevron-right"></i></button>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                    style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}>
                    {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 4 }}>Red = exceedance (&gt;30 mg/L BOD/TSS, &gt;5 NTU Turbidity)</span>
                </div>
            </div>

            {/* Status Message */}
            {actionMsg.text && (
                <div style={{
                    padding: '12px 16px', borderRadius: '6px', marginBottom: '16px',
                    background: actionMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: actionMsg.type === 'success' ? '#065f46' : '#991b1b',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <i className={`fas ${actionMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                    {actionMsg.text}
                </div>
            )}

            {/* Main Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><i className="fas fa-spinner fa-spin"></i> Loading…</div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th style={{ ...hS, textAlign: 'left', minWidth: 60 }}>Day</th>
                                {SUMMARY_TABLE_COLS.map(c => (
                                    <th key={c.key} style={hS}>{c.label}{c.unit ? <span style={{ fontWeight: 400, opacity: 0.8 }}> ({c.unit})</span> : ''}</th>
                                ))}
                                <th style={{ ...hS, minWidth: 70 }}>BOD Eff%</th>
                                <th style={{ ...hS, minWidth: 70 }}>TSS Eff%</th>
                                <th style={{ ...hS, minWidth: 80 }}>Status</th>
                                <th style={{ ...hS, minWidth: 120 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const rec = recordMap[day];
                                const isToday = day === today.getDate() && selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear();
                                const rowBg = isToday ? '#f0f9ff' : (day % 2 === 0 ? '#fafafa' : 'white');
                                return (
                                    <tr key={day} style={{ background: rowBg, transition: 'background 0.15s' }}>
                                        <td style={{ ...sS, textAlign: 'left', fontWeight: 700, color: isToday ? '#0369a1' : '#374151' }}>
                                            {String(day).padStart(2, '0')}
                                            {isToday && <span style={{ fontSize: '0.65rem', background: '#0369a1', color: 'white', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>Today</span>}
                                        </td>
                                        {SUMMARY_TABLE_COLS.map(c => (
                                            <td key={c.key} style={sS}><EffCell record={rec} field={c.key} /></td>
                                        ))}
                                        <td style={sS}>
                                            {rec?.bod_removal_efficiency != null
                                                ? <span style={{ color: rec.bod_removal_efficiency < REMOVAL_EFFICIENCY_TARGET ? '#dc2626' : '#166534', fontWeight: 600 }}>{rec.bod_removal_efficiency}%</span>
                                                : <span style={{ color: '#94a3b8' }}>—</span>}
                                        </td>
                                        <td style={sS}>
                                            {rec?.tss_removal_efficiency != null
                                                ? <span style={{ color: rec.tss_removal_efficiency < REMOVAL_EFFICIENCY_TARGET ? '#dc2626' : '#166534', fontWeight: 600 }}>{rec.tss_removal_efficiency}%</span>
                                                : <span style={{ color: '#94a3b8' }}>—</span>}
                                        </td>
                                        <td style={sS}>
                                            {rec ? (
                                                <span style={{
                                                    padding: '3px 8px', borderRadius: 12, fontSize: '0.73rem', fontWeight: 600,
                                                    background: rec.status === 'verified' ? '#d1fae5' : '#fef3c7',
                                                    color: rec.status === 'verified' ? '#065f46' : '#92400e',
                                                }}>
                                                    {rec.status === 'verified' ? '✓ Verified' : 'Submitted'}
                                                </span>
                                            ) : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No entry</span>}
                                        </td>
                                        <td style={sS}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => openModal(day)}
                                                    disabled={rec?.status === 'verified'}
                                                    title={rec ? 'Edit entry' : 'Add entry'}
                                                    style={{
                                                        padding: '4px 10px', borderRadius: 5, border: 'none', cursor: rec?.status === 'verified' ? 'not-allowed' : 'pointer',
                                                        background: rec ? '#e0f2fe' : '#dcfce7', color: rec ? '#0369a1' : '#166534',
                                                        fontSize: '0.78rem', fontWeight: 600, opacity: rec?.status === 'verified' ? 0.5 : 1,
                                                    }}
                                                >
                                                    <i className={`fas ${rec ? 'fa-edit' : 'fa-plus'}`}></i> {rec ? 'Edit' : 'Add'}
                                                </button>
                                                {canVerify && rec && rec.status !== 'verified' && (
                                                    <button
                                                        onClick={() => handleVerify(rec)}
                                                        title="Verify & lock"
                                                        style={{ padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#d1fae5', color: '#065f46', fontSize: '0.78rem', fontWeight: 600 }}
                                                    >
                                                        <i className="fas fa-check-double"></i> Verify
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Entry Modal */}
            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#0f4c81', fontSize: '1.1rem' }}>
                                <i className="fas fa-flask" style={{ marginRight: 8 }}></i>
                                Lab Entry — {MONTHS[selectedMonth - 1]} {String(modal.day).padStart(2, '0')}, {selectedYear}
                                {modal.record?.status === 'verified' && <span style={{ marginLeft: 10, fontSize: '0.75rem', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10 }}>Verified</span>}
                            </h3>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                        </div>

                        {/* Section Tabs */}
                        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', paddingLeft: 24 }}>
                            {[['inflow','Inflow'],['effluent','Effluent'],['ops','Operations']].map(([k, label]) => (
                                <button key={k} onClick={() => setActiveSection(k)} style={{
                                    padding: '10px 18px', border: 'none', borderBottom: activeSection === k ? '3px solid #0369a1' : '3px solid transparent',
                                    background: 'none', color: activeSection === k ? '#0369a1' : '#64748b', fontWeight: activeSection === k ? 700 : 400,
                                    cursor: 'pointer', fontSize: '0.88rem', marginBottom: -2,
                                }}>{label}</button>
                            ))}
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px' }}>
                            <ParamSection
                                params={activeSection === 'inflow' ? INFLOW_PARAMS : activeSection === 'effluent' ? EFFLUENT_PARAMS : OPS_PARAMS}
                                form={modal.form}
                                onChange={(key, val) => setModal(m => ({ ...m, form: { ...m.form, [key]: val } }))}
                                locked={modal.record?.status === 'verified'}
                            />
                            {activeSection === 'ops' && (
                                <div style={{ marginTop: 20 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151' }}>Remarks</label>
                                    <textarea
                                        value={modal.form.remarks}
                                        onChange={e => setModal(m => ({ ...m, form: { ...m.form, remarks: e.target.value } }))}
                                        disabled={modal.record?.status === 'verified'}
                                        rows={3}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical', fontSize: '0.9rem' }}
                                        placeholder="Optional notes…"
                                    />
                                </div>
                            )}

                            {/* Computed Efficiencies preview */}
                            {activeSection === 'effluent' && (
                                <EfficiencyPreview form={modal.form} />
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={closeModal} style={{ padding: '9px 20px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', color: '#374151' }}>Cancel</button>
                            {modal.record?.status !== 'verified' && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{ padding: '9px 22px', borderRadius: 6, border: 'none', background: saving ? '#94a3b8' : '#0369a1', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                                >
                                    <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ marginRight: 6 }}></i>
                                    {saving ? 'Saving…' : modal.record ? 'Update Record' : 'Create Record'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-components ---

const ParamSection = ({ params, form, onChange, locked }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {params.map(p => (
            <div key={p.key}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: 5, fontWeight: 600, color: '#374151', fontSize: '0.85rem' }}>
                    {p.label}{p.unit ? <span style={{ marginLeft: 4, color: '#94a3b8', fontWeight: 400 }}>({p.unit})</span> : ''}
                    <FreqBadge freq={p.freq} />
                </label>
                <input
                    type="number"
                    step="0.01"
                    value={form[p.key]}
                    onChange={e => onChange(p.key, e.target.value)}
                    disabled={locked}
                    placeholder="—"
                    style={{
                        width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 6,
                        fontSize: '0.9rem', background: locked ? '#f8fafc' : 'white',
                        color: locked ? '#94a3b8' : '#1e293b',
                    }}
                />
            </div>
        ))}
    </div>
);

const EfficiencyPreview = ({ form }) => {
    const inflowBOD  = parseFloat(form.inflow_bod);
    const efflBOD    = parseFloat(form.effluent_bod);
    const inflowTSS  = parseFloat(form.inflow_tss);
    const efflTSS    = parseFloat(form.effluent_tss);

    const bodEff = (!isNaN(inflowBOD) && !isNaN(efflBOD) && inflowBOD > 0)
        ? ((inflowBOD - efflBOD) / inflowBOD * 100).toFixed(1)
        : null;
    const tssEff = (!isNaN(inflowTSS) && !isNaN(efflTSS) && inflowTSS > 0)
        ? ((inflowTSS - efflTSS) / inflowTSS * 100).toFixed(1)
        : null;

    if (!bodEff && !tssEff) return null;

    return (
        <div style={{ marginTop: 16, background: '#f0f9ff', borderRadius: 8, padding: '12px 16px', border: '1px solid #bae6fd', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: 600 }}><i className="fas fa-chart-line" style={{ marginRight: 5 }}></i>Preview:</span>
            {bodEff && (
                <span style={{ fontSize: '0.85rem', color: parseFloat(bodEff) < REMOVAL_EFFICIENCY_TARGET ? '#dc2626' : '#166534', fontWeight: 600 }}>
                    BOD Removal: {bodEff}% {parseFloat(bodEff) < REMOVAL_EFFICIENCY_TARGET && `⚠ Below ${REMOVAL_EFFICIENCY_TARGET}%`}
                </span>
            )}
            {tssEff && (
                <span style={{ fontSize: '0.85rem', color: parseFloat(tssEff) < REMOVAL_EFFICIENCY_TARGET ? '#dc2626' : '#166534', fontWeight: 600 }}>
                    TSS Removal: {tssEff}% {parseFloat(tssEff) < REMOVAL_EFFICIENCY_TARGET && `⚠ Below ${REMOVAL_EFFICIENCY_TARGET}%`}
                </span>
            )}
        </div>
    );
};

const navBtnStyle = {
    padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
    background: 'white', cursor: 'pointer', color: '#374151',
    fontSize: '0.85rem', lineHeight: 1,
};

export default LabTestForm;
