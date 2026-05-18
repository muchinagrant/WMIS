import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';
import { SUMMARY_TABLE_COLS, isExceedance, REMOVAL_EFFICIENCY_TARGET } from '../config/labParameterConfig';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const PHYSICAL_CHEMICAL_ROWS = [
    { label: 'Volume (m³)', inflow: 'inflow_volume_m3', effluent: 'effluent_volume_m3' },
    { label: 'pH', inflow: 'inflow_ph', effluent: 'effluent_ph' },
    { label: 'BOD (mg/L)', inflow: 'inflow_bod', effluent: 'effluent_bod' },
    { label: 'COD (mg/L)', inflow: 'inflow_cod', effluent: 'effluent_cod' },
    { label: 'TSS (mg/L)', inflow: 'inflow_tss', effluent: 'effluent_tss' },
    { label: 'Temperature (°C)', inflow: 'inflow_temperature', effluent: 'effluent_temperature' },
    { label: 'Dissolved Oxygen (mg/L)', inflow: 'inflow_do', effluent: 'effluent_do' },
    { label: 'Turbidity (NTU)', inflow: 'inflow_turbidity', effluent: 'effluent_turbidity' },
    { label: 'Conductivity (µS/cm)', inflow: 'inflow_conductivity', effluent: 'effluent_conductivity' },
    { label: 'Nitrates (mg/L)', inflow: 'inflow_nitrates', effluent: 'effluent_nitrates' },
    { label: 'Phosphates (mg/L)', inflow: 'inflow_phosphates', effluent: 'effluent_phosphates' },
];

const BACTERIOLOGICAL_ROWS = [
    { label: 'Fecal Coliforms (MPN/100 mL)', key: 'effluent_fc' },
    { label: 'E.coli (CFU/100 mL)', key: 'effluent_ecoli' },
    { label: 'Total Coliforms (MPN/100 mL)', key: 'effluent_total_coliforms' },
];

const NUMERIC_FIELDS = [
    ...PHYSICAL_CHEMICAL_ROWS.flatMap((row) => [row.inflow, row.effluent]),
    ...BACTERIOLOGICAL_ROWS.map((row) => row.key),
    'sludge_volume_m3',
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => NUMERIC_FIELDS.reduce((acc, key) => {
    acc[key] = '';
    return acc;
}, { remarks: '' });

const recordToForm = (record) => {
    if (!record) {
        return emptyForm();
    }

    const form = emptyForm();
    form.remarks = record.remarks || '';
    NUMERIC_FIELDS.forEach((key) => {
        form[key] = record[key] !== null && record[key] !== undefined ? String(record[key]) : '';
    });
    return form;
};

const parseDay = (recordDate) => {
    if (!recordDate) return null;
    const parts = String(recordDate).split('-');
    return Number(parts[2] || null);
};

const efficiencyBand = (value) => {
    if (value === null || value === undefined || value === '') return 'none';
    const n = Number(value);
    if (Number.isNaN(n)) return 'none';
    if (n < 60) return 'red';
    if (n < REMOVAL_EFFICIENCY_TARGET) return 'amber';
    return 'green';
};

const bandStyles = {
    green: { background: '#dcfce7', color: '#166534' },
    amber: { background: '#fef3c7', color: '#92400e' },
    red: { background: '#fee2e2', color: '#991b1b' },
    none: { background: '#e2e8f0', color: '#475569' },
};

const numberOrEmpty = (value) => (value === '' || value === null || value === undefined ? '' : Number(value));

const LabTestForm = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const userRole = user?.role || 'lab_tech';
    const canVerify = ['admin', 'stp_superintendent', 'stp_supervisor'].includes(userRole);
    const isSupervisor = userRole === 'stp_supervisor';
    const [retestNote, setRetestNote] = useState('');
    const [retestOpen, setRetestOpen] = useState(false);

    const now = new Date();
    const focusToday = location.state?.focusToday;
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedDay, setSelectedDay] = useState(now.getDate());
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
    const [draft, setDraft] = useState(emptyForm());

    const daysInMonth = useMemo(() => new Date(selectedYear, selectedMonth, 0).getDate(), [selectedYear, selectedMonth]);
    const recordMap = useMemo(() => {
        const map = {};
        records.forEach((record) => {
            const day = parseDay(record.record_date);
            if (day) {
                map[day] = record;
            }
        });
        return map;
    }, [records]);

    const selectedRecord = recordMap[selectedDay] || null;
    const selectedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/lab-records/', { params: { year: selectedYear, month: selectedMonth } });
            const rows = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setRecords(rows);
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.error || 'Failed to load lab records.' });
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        if (focusToday) {
            setSelectedYear(now.getFullYear());
            setSelectedMonth(now.getMonth() + 1);
            setSelectedDay(now.getDate());
        }
    }, [focusToday, now]);

    useEffect(() => {
        if (selectedDay > daysInMonth) {
            setSelectedDay(daysInMonth);
        }
    }, [daysInMonth, selectedDay]);

    useEffect(() => {
        setDraft(recordToForm(selectedRecord));
    }, [selectedRecord?.id]);

    const openDay = (day) => setSelectedDay(day);
    const jumpToToday = () => {
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        setSelectedDay(now.getDate());
    };

    const prevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedYear((year) => year - 1);
            setSelectedMonth(12);
        } else {
            setSelectedMonth((month) => month - 1);
        }
    };

    const nextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedYear((year) => year + 1);
            setSelectedMonth(1);
        } else {
            setSelectedMonth((month) => month + 1);
        }
    };

    const updateDraft = (key, value) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const buildPayload = () => {
        const payload = {
            record_date: selectedDate,
            remarks: draft.remarks,
        };

        NUMERIC_FIELDS.forEach((key) => {
            if (draft[key] !== '' && draft[key] !== null && draft[key] !== undefined) {
                payload[key] = numberOrEmpty(draft[key]);
            }
        });

        return payload;
    };

    const handleSave = async () => {
        setSaving(true);
        setActionMsg({ type: '', text: '' });
        const payload = buildPayload();

        try {
            if (selectedRecord) {
                await api.patch(`/api/lab-records/${selectedRecord.id}/`, payload);
                setActionMsg({ type: 'success', text: `Day ${selectedDay} record updated.` });
            } else {
                await api.post('/api/lab-records/', payload);
                setActionMsg({ type: 'success', text: `Day ${selectedDay} record created.` });
            }
            await fetchRecords();
        } catch (error) {
            const detail = error.response?.data;
            const message = typeof detail === 'object' ? JSON.stringify(detail) : String(detail || 'Save failed.');
            setActionMsg({ type: 'error', text: message });
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async () => {
        if (!selectedRecord) return;
        setActionMsg({ type: '', text: '' });
        try {
            await api.patch(`/api/lab-records/${selectedRecord.id}/verify/`);
            setActionMsg({ type: 'success', text: `Day ${selectedDay} verified.` });
            await fetchRecords();
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.error || 'Verify failed.' });
        }
    };

    const handleRequestRetest = async () => {
        if (!selectedRecord) return;
        const note = retestNote.trim();
        if (!note) {
            setActionMsg({ type: 'error', text: 'Please describe why a retest is needed.' });
            return;
        }
        setActionMsg({ type: '', text: '' });
        try {
            await api.post(`/api/lab-records/${selectedRecord.id}/request_retest/`, { retest_note: note });
            setActionMsg({ type: 'success', text: 'Retest requested. Lab tech has been notified.' });
            setRetestNote('');
            setRetestOpen(false);
            await fetchRecords();
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.error || 'Retest request failed.' });
        }
    };

    const selectedBand = efficiencyBand(selectedRecord?.bod_removal_efficiency);
    const tssBand = efficiencyBand(selectedRecord?.tss_removal_efficiency);

    const formatValue = (value, digits = 1) => {
        if (value === null || value === undefined || value === '') return '—';
        const n = Number(value);
        return Number.isNaN(n) ? '—' : n.toFixed(digits);
    };

    const efficiencyPreview = (form) => {
        const inflowBod = Number(form.inflow_bod);
        const effluentBod = Number(form.effluent_bod);
        const inflowTss = Number(form.inflow_tss);
        const effluentTss = Number(form.effluent_tss);

        const bodEff = !Number.isNaN(inflowBod) && !Number.isNaN(effluentBod) && inflowBod > 0
            ? ((inflowBod - effluentBod) / inflowBod) * 100
            : null;
        const tssEff = !Number.isNaN(inflowTss) && !Number.isNaN(effluentTss) && inflowTss > 0
            ? ((inflowTss - effluentTss) / inflowTss) * 100
            : null;

        if (bodEff === null && tssEff === null) return null;

        return (
            <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', marginBottom: 10 }}>Auto-calculated efficiencies</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {bodEff !== null && (
                        <span style={{ ...badgeStyles(bodEff), padding: '6px 10px' }}>
                            BOD Removal: {bodEff.toFixed(1)}%
                        </span>
                    )}
                    {tssEff !== null && (
                        <span style={{ ...badgeStyles(tssEff), padding: '6px 10px' }}>
                            TSS Removal: {tssEff.toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="form-section active">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #e0f0fa' }}>
                <div>
                    <h2 style={{ color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-flask"></i> F203B Daily Lab Records
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.92rem' }}>
                        Click a day in the monthly overview to open the full daily entry panel.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={prevMonth} style={navBtnStyle}><i className="fas fa-chevron-left"></i></button>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b', minWidth: 180, textAlign: 'center' }}>
                        {MONTHS[selectedMonth - 1]} {selectedYear}
                    </span>
                    <button onClick={nextMonth} style={navBtnStyle}><i className="fas fa-chevron-right"></i></button>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={selectStyle}>
                        {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <button onClick={jumpToToday} style={{ ...navBtnStyle, background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                        Enter Today's Results
                    </button>
                </div>
            </div>

            {actionMsg.text && (
                <div style={{
                    padding: '12px 16px', borderRadius: 8, marginBottom: 16,
                    background: actionMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: actionMsg.type === 'success' ? '#065f46' : '#991b1b',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <i className={`fas ${actionMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                    {actionMsg.text}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <i className="fas fa-spinner fa-spin"></i> Loading…
                </div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th style={{ ...headerCell, textAlign: 'left', minWidth: 70 }}>DAY</th>
                                {SUMMARY_TABLE_COLS.map((column) => (
                                    <th key={column.key} style={headerCell}>
                                        {column.label}
                                        {column.unit ? <span style={{ fontWeight: 400, opacity: 0.8 }}> ({column.unit})</span> : null}
                                    </th>
                                ))}
                                <th style={headerCell}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                                const record = recordMap[day];
                                const isToday = isCurrentMonth && day === now.getDate();
                                const isSelected = day === selectedDay;
                                const rowBackground = isSelected ? '#eff6ff' : (isToday ? '#f0f9ff' : (day % 2 === 0 ? '#fafafa' : 'white'));

                                return (
                                    <tr
                                        key={day}
                                        onClick={() => openDay(day)}
                                        style={{ background: rowBackground, cursor: 'pointer' }}
                                        title="Open daily entry"
                                    >
                                        <td style={{ ...bodyCell, textAlign: 'left', fontWeight: 700, color: isToday ? '#0369a1' : '#334155' }}>
                                            {String(day).padStart(2, '0')}
                                            {isToday && <span style={{ marginLeft: 6, fontSize: '0.66rem', background: '#0369a1', color: 'white', borderRadius: 4, padding: '1px 5px' }}>Today</span>}
                                        </td>
                                        {SUMMARY_TABLE_COLS.map((column) => (
                                            <td key={column.key} style={bodyCell}>
                                                {renderSummaryCell(record, column.key)}
                                            </td>
                                        ))}
                                        <td style={bodyCell}>
                                            {record ? (
                                                <span style={recordStatusStyles(record.status)}>
                                                    {record.status === 'fully_signed' ? 'Fully Signed' : record.status === 'returned' ? 'Returned' : record.status === 'pending_operator' ? 'Pending Co-sign' : 'Draft'}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>No entry</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 18, marginTop: 18, alignItems: 'start' }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}>
                    <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#0f172a' }}>
                                Daily Entry Panel - {MONTHS[selectedMonth - 1]} {String(selectedDay).padStart(2, '0')}, {selectedYear}
                            </h3>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                Partial saves are allowed. Fill in what is available now and return later for the rest.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...badgeStyles(selectedRecord?.bod_removal_efficiency), padding: '6px 10px' }}>BOD</span>
                            <span style={{ ...badgeStyles(selectedRecord?.tss_removal_efficiency), padding: '6px 10px' }}>TSS</span>
                            <span style={recordStatusStyles(selectedRecord?.status)}>
                                {selectedRecord ? (selectedRecord.status === 'fully_signed' ? 'Read only' : 'Editable') : 'New entry'}
                            </span>
                        </div>
                    </div>

                    {selectedRecord?.status === 'fully_signed' && (
                        <div style={{ margin: '16px 20px 0', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', color: '#92400e', fontSize: '0.9rem' }}>
                            This day has been verified and is read-only.
                        </div>
                    )}

                    {selectedRecord?.retest_requested && (
                        <div style={{ margin: '16px 20px 0', background: '#fee2e2', border: '1px solid #f87171', borderRadius: 8, padding: '10px 12px', color: '#991b1b', fontSize: '0.9rem' }}>
                            <strong>Supervisor requested retest:</strong> {selectedRecord.retest_note || '—'}
                        </div>
                    )}

                    {isSupervisor && selectedRecord && retestOpen && (
                        <div style={{ margin: '16px 20px 0', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#334155' }}>Retest reason</label>
                            <textarea
                                rows={3}
                                value={retestNote}
                                onChange={(e) => setRetestNote(e.target.value)}
                                placeholder="Describe the concern and what should be re-sampled…"
                                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 10, boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={handleRequestRetest} style={{ ...primaryButtonStyle, background: '#dc2626' }}>
                                    Submit Retest Request
                                </button>
                                <button type="button" onClick={() => { setRetestOpen(false); setRetestNote(''); }} style={{ ...navBtnStyle }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ padding: 20 }}>
                        <SectionCard title="Section A - Physical / Chemical Parameters">
                            <div style={{ display: 'grid', gap: 10 }}>
                                {PHYSICAL_CHEMICAL_ROWS.map((row) => (
                                    <DualEntryRow
                                        key={row.label}
                                        label={row.label}
                                        inflowKey={row.inflow}
                                        effluentKey={row.effluent}
                                        form={draft}
                                        disabled={selectedRecord?.status === 'fully_signed'}
                                        onChange={updateDraft}
                                    />
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Section B - Bacteriological Parameters (Effluent only)" style={{ marginTop: 16 }}>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {BACTERIOLOGICAL_ROWS.map((row) => (
                                    <SingleEntryRow
                                        key={row.key}
                                        label={row.label}
                                        fieldKey={row.key}
                                        form={draft}
                                        disabled={selectedRecord?.status === 'fully_signed'}
                                        onChange={updateDraft}
                                    />
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Operational Notes" style={{ marginTop: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                <div>
                                    <label style={fieldLabelStyle}>Sludge Volume (m³)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={draft.sludge_volume_m3}
                                        onChange={(e) => updateDraft('sludge_volume_m3', e.target.value)}
                                        disabled={selectedRecord?.status === 'fully_signed'}
                                        style={inputStyle(selectedRecord?.status === 'fully_signed')}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={fieldLabelStyle}>Remarks</label>
                                    <textarea
                                        rows={4}
                                        value={draft.remarks}
                                        onChange={(e) => updateDraft('remarks', e.target.value)}
                                        disabled={selectedRecord?.status === 'fully_signed'}
                                        style={{ ...textareaStyle(selectedRecord?.status === 'fully_signed') }}
                                        placeholder="Add notes, observations, or flag context for the day."
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        {efficiencyPreview(draft)}
                    </div>

                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ color: '#64748b', fontSize: '0.88rem' }}>
                            Record date is fixed to {selectedDate}. Save again anytime to continue partial entry.
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {isSupervisor && selectedRecord && !retestOpen && (
                                <button type="button" onClick={() => setRetestOpen(true)} style={{ ...primaryButtonStyle, background: '#dc2626' }}>
                                    <i className="fas fa-redo" style={{ marginRight: 6 }}></i> Request Retest
                                </button>
                            )}
                            {canVerify && selectedRecord && selectedRecord.status !== 'fully_signed' && (
                                <button onClick={handleVerify} style={{ ...primaryButtonStyle, background: '#16a34a' }}>
                                    <i className="fas fa-check-double" style={{ marginRight: 6 }}></i> Verify
                                </button>
                            )}
                            {selectedRecord?.status !== 'fully_signed' && (
                                <button onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle, background: saving ? '#94a3b8' : '#0369a1' }}>
                                    <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ marginRight: 6 }}></i>
                                    {saving ? 'Saving…' : selectedRecord ? 'Update Record' : 'Create Record'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                    <InfoCard title="Selected Day Status" value={selectedRecord ? (selectedRecord.status === 'fully_signed' ? 'Fully signed' : selectedRecord.status === 'pending_operator' ? 'Pending co-sign' : selectedRecord.status === 'returned' ? 'Returned for correction' : 'Draft') : 'No saved record'} />
                    <InfoCard title="BOD Efficiency" value={formatValue(selectedRecord?.bod_removal_efficiency)} suffix="%" tone={selectedBand} />
                    <InfoCard title="TSS Efficiency" value={formatValue(selectedRecord?.tss_removal_efficiency)} suffix="%" tone={tssBand} />
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Compliance cues</div>
                        <div style={{ display: 'grid', gap: 8, fontSize: '0.88rem', color: '#334155' }}>
                            <div><span style={miniDot('#16a34a')}></span> Green: efficiency at or above 80%</div>
                            <div><span style={miniDot('#f59e0b')}></span> Amber: efficiency between 60% and 79%</div>
                            <div><span style={miniDot('#ef4444')}></span> Red: efficiency below 60%</div>
                            <div><span style={miniDot('#94a3b8')}></span> Empty cells can be saved later as partial entries</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const renderSummaryCell = (record, key) => {
    if (!record) return <span style={{ color: '#94a3b8' }}>—</span>;
    const value = record[key];
    if (value === null || value === undefined || value === '') return <span style={{ color: '#94a3b8' }}>—</span>;

    if (key === 'bod_removal_efficiency') {
        const n = Number(value);
        return <span style={badgeStyles(n)}>{Number.isNaN(n) ? '—' : `${n.toFixed(1)}%`}</span>;
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        const exc = isExceedance(key, numeric);
        const style = key === 'effluent_do'
            ? { color: numeric < 4 ? '#dc2626' : '#166534', fontWeight: 600 }
            : { color: exc ? '#dc2626' : '#1e293b', fontWeight: exc ? 700 : 400 };
        return <span style={style}>{numeric.toFixed(1)}</span>;
    }

    return String(value);
};

const badgeStyles = (value) => {
    const band = efficiencyBand(value);
    return {
        ...bandStyles[band],
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.77rem',
        fontWeight: 700,
        minWidth: 52,
    };
};

const recordStatusStyles = (status) => {
    const map = {
        fully_signed: { background: '#dcfce7', color: '#166534' },
        pending_operator: { background: '#fef3c7', color: '#92400e' },
        returned: { background: '#fee2e2', color: '#991b1b' },
        draft: { background: '#e2e8f0', color: '#475569' },
    };
    return {
        ...map[status] || map.draft,
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: '0.76rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
};

const SectionCard = ({ title, children, style }) => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#f8fafc', ...style }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</div>
        {children}
    </div>
);

const DualEntryRow = ({ label, inflowKey, effluentKey, form, disabled, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10, alignItems: 'center' }}>
        <div style={fieldLabelStyle}>{label}</div>
        <input type="number" step="0.01" value={form[inflowKey]} onChange={(e) => onChange(inflowKey, e.target.value)} disabled={disabled} style={inputStyle(disabled)} placeholder="Inflow" />
        <input type="number" step="0.01" value={form[effluentKey]} onChange={(e) => onChange(effluentKey, e.target.value)} disabled={disabled} style={inputStyle(disabled)} placeholder="Effluent" />
    </div>
);

const SingleEntryRow = ({ label, fieldKey, form, disabled, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 10, alignItems: 'center' }}>
        <div style={fieldLabelStyle}>{label}</div>
        <input type="number" step="0.01" value={form[fieldKey]} onChange={(e) => onChange(fieldKey, e.target.value)} disabled={disabled} style={inputStyle(disabled)} placeholder="Effluent" />
    </div>
);

const InfoCard = ({ title, value, suffix = '', tone = 'none' }) => (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tone === 'red' ? '#991b1b' : tone === 'amber' ? '#92400e' : tone === 'green' ? '#166534' : '#0f172a' }}>
            {value}{suffix}
        </div>
    </div>
);

const miniDot = (color) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color, marginRight: 8, verticalAlign: 'middle' });

const fieldLabelStyle = { display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.86rem' };
const selectStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' };
const navBtnStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', color: '#374151', fontSize: '0.85rem', lineHeight: 1 };
const primaryButtonStyle = { padding: '9px 18px', borderRadius: 6, border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700 };
const inputStyle = (disabled) => ({ width: '100%', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem', background: disabled ? '#f8fafc' : 'white', color: disabled ? '#94a3b8' : '#0f172a' });
const textareaStyle = (disabled) => ({ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical', fontSize: '0.9rem', background: disabled ? '#f8fafc' : 'white', color: disabled ? '#94a3b8' : '#0f172a' });
const headerCell = { padding: '10px 12px', background: '#0f4c81', color: 'white', fontSize: '0.78rem', whiteSpace: 'nowrap', textAlign: 'center', position: 'sticky', top: 0 };
const bodyCell = { padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', whiteSpace: 'nowrap' };

export default LabTestForm;
