import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];

const STATUS_LABELS = {
    pending_second_sign: { label: 'Pending 2nd Sign', bg: '#fef3c7', color: '#92400e' },
    pending_supervisor:  { label: 'Pending Supervisor', bg: '#dbeafe', color: '#1e40af' },
    fully_signed:        { label: 'Fully Signed', bg: '#d1fae5', color: '#065f46' },
};

const emptyForm = () => ({
    pond: '',
    log_date: new Date().toISOString().split('T')[0],
    ph: '', temperature: '', do_level: '',
    surface_scum: false, odour_complaint: false,
    colour: '', remarks: '',
    daily_inspection_done: false,
    valves_hand_stops_ok: '',
    inspection_incidences: '',
    spillage_incidences: '',
    new_mother_connections: '',
    new_child_connections: '',
    repairs_completed: '',
    bod_incidences: '',
    exhauster_volume_m3: '',
    effluent_volume_m3: '',
    yearly_desludging: '',
    yearly_rust_removal: '',
    yearly_painting: '',
    yearly_grease_paint_valves: '',
    intermittent_grass_cutting: '',
    intermittent_floating_material: '',
});

const isFirstWeekOfMonth = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDate() <= 7;
};

const isDecember = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getMonth() === 11;
};

const YnSelect = ({ label, value, onChange }) => (
    <div>
        <label style={lblS}>{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inpS}>
            <option value="">—</option>
            <option value="Y">Y — Done</option>
            <option value="N">N — Not done</option>
        </select>
    </div>
);

const COLOUR_OPTIONS = ['Grey', 'Dark Grey', 'Brown', 'Black', 'Green', 'Clear'];

// ─── Date Utilities ───────────────────────────────────────────────────────────
const isFrequencyAllowed = (frequency, dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (dateStr > todayStr) return false;

    switch (frequency) {
        case 'daily':
            return true;
        case 'twice_weekly':
            return [1, 3, 5].includes(dayOfWeek);
        case 'weekly':
            return dayOfWeek === 5;
        case 'monthly':
            return dayOfMonth <= 7;
        default:
            return false;
    }
};

const getFrequencyLabel = (freq) => {
    const labels = {
        'daily': 'Daily',
        'twice_weekly': 'Twice Weekly (Mon/Wed/Fri)',
        'weekly': 'Weekly (Friday)',
        'monthly': 'Monthly (First Week)',
    };
    return labels[freq] || freq;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PondMaintenanceLogs = () => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || '';
    const canCosign  = ['stp_operator', 'lab_tech'].includes(userRole);
    const canVerify  = ['stp_supervisor'].includes(userRole);
    const canEscalate = ['stp_supervisor'].includes(userRole);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const [tab, setTab] = useState('daily');           // 'daily' | 'monthly' | 'tasks'
    const [ponds, setPonds] = useState([]);
    const [logs, setLogs] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

    // Monthly view filter
    const [selYear,  setSelYear]  = useState(today.getFullYear());
    const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
    const [selPond,  setSelPond]  = useState('');

    // New log form
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);

    // Escalate modal
    const [escalateModal, setEscalateModal] = useState(null);
    const [escDesc, setEscDesc] = useState('');

    const selectedPond = ponds.find((p) => p.id === Number(form.pond));
    const frequencyAllowed = selectedPond ? isFrequencyAllowed(selectedPond.frequency, form.log_date) : true;

    // ── Fetchers ──────────────────────────────────────────────────────────────
    const fetchPonds = useCallback(async () => {
        try {
            const r = await api.get('/api/ponds/');
            setPonds(Array.isArray(r.data) ? r.data : (r.data?.results || []));
        } catch {}
    }, []);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { year: selYear, month: selMonth };
            if (selPond) params.pond = selPond;
            const r = await api.get('/api/pond-logs/', { params });
            setLogs(Array.isArray(r.data) ? r.data : (r.data?.results || []));
        } catch { setActionMsg({ type: 'error', text: 'Failed to load logs.' }); }
        finally { setLoading(false); }
    }, [selYear, selMonth, selPond]);

    const fetchTasks = useCallback(async () => {
        try {
            const params = { year: selYear };
            if (selPond) params.pond = selPond;
            const r = await api.get('/api/pond-tasks/', { params });
            setTasks(Array.isArray(r.data) ? r.data : (r.data?.results || []));
        } catch {}
    }, [selYear, selPond]);

    useEffect(() => { fetchPonds(); }, [fetchPonds]);
    useEffect(() => { if (tab === 'monthly') { fetchLogs(); fetchTasks(); } }, [tab, fetchLogs, fetchTasks]);

    // ── Submit new log ────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.pond || !form.log_date) {
            setActionMsg({ type: 'error', text: 'Pond and date are required.' });
            return;
        }
        setSaving(true);
        setActionMsg({ type: '', text: '' });
        const numOrNull = (v) => (v !== '' && v != null ? Number(v) : null);
        const boolOrNull = (v) => (v === '' ? null : v === true || v === 'true');
        const payload = {
            pond: Number(form.pond),
            log_date: form.log_date,
            ph: numOrNull(form.ph),
            temperature: numOrNull(form.temperature),
            do_level: numOrNull(form.do_level),
            surface_scum: form.surface_scum,
            odour_complaint: form.odour_complaint,
            colour: form.colour,
            remarks: form.remarks,
            daily_inspection_done: form.daily_inspection_done,
            valves_hand_stops_ok: boolOrNull(form.valves_hand_stops_ok),
            inspection_incidences: numOrNull(form.inspection_incidences),
            spillage_incidences: numOrNull(form.spillage_incidences),
            new_mother_connections: numOrNull(form.new_mother_connections),
            new_child_connections: numOrNull(form.new_child_connections),
            repairs_completed: numOrNull(form.repairs_completed),
            bod_incidences: numOrNull(form.bod_incidences),
            exhauster_volume_m3: numOrNull(form.exhauster_volume_m3),
            effluent_volume_m3: numOrNull(form.effluent_volume_m3),
            yearly_desludging: form.yearly_desludging,
            yearly_rust_removal: form.yearly_rust_removal,
            yearly_painting: form.yearly_painting,
            yearly_grease_paint_valves: form.yearly_grease_paint_valves,
            intermittent_grass_cutting: form.intermittent_grass_cutting,
            intermittent_floating_material: form.intermittent_floating_material,
        };
        try {
            await api.post('/api/pond-logs/', payload);
            setActionMsg({ type: 'success', text: 'Log submitted.' });
            setForm(emptyForm());
            if (tab === 'monthly') fetchLogs();
        } catch (err) {
            const detail = err.response?.data;
            const msg = typeof detail === 'object'
                ? Object.entries(detail).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
                : String(detail || 'Submit failed.');
            setActionMsg({ type: 'error', text: msg });
        } finally { setSaving(false); }
    };

    // ── Sign-off actions ──────────────────────────────────────────────────────
    const doAction = async (logId, action) => {
        setActionMsg({ type: '', text: '' });
        try {
            await api.patch(`/api/pond-logs/${logId}/${action}/`);
            setActionMsg({ type: 'success', text: `${action === 'cosign' ? 'Second sign captured' : 'Supervisor sign captured'} successfully.` });
            fetchLogs();
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.error || `${action} failed.` });
        }
    };

    const doEscalate = async () => {
        if (!escalateModal) return;
        setActionMsg({ type: '', text: '' });
        try {
            await api.post(`/api/pond-logs/${escalateModal.id}/escalate/`, { description: escDesc });
            setActionMsg({ type: 'success', text: `Incident created for ${escalateModal.pond_code}.` });
            setEscalateModal(null);
            setEscDesc('');
            fetchLogs();
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.error || 'Escalation failed.' });
        }
    };

    // ── Monthly aggregation ───────────────────────────────────────────────────
    const pondAgg = ponds.reduce((acc, p) => {
        const pondLogs = logs.filter(l => l.pond === p.id);
        if (pondLogs.length === 0) return acc;
        const avg = (field) => {
            const vals = pondLogs.map(l => parseFloat(l[field])).filter(v => !isNaN(v));
            return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '—';
        };
        acc[p.id] = {
            total: pondLogs.length,
            verified: pondLogs.filter(l => l.status === 'fully_signed').length,
            scum_days: pondLogs.filter(l => l.surface_scum).length,
            odour_days: pondLogs.filter(l => l.odour_complaint).length,
            avg_ph: avg('ph'),
            avg_do: avg('do_level'),
            avg_temp: avg('temperature'),
        };
        return acc;
    }, {});

    // ── Styles ────────────────────────────────────────────────────────────────
    const hS = { padding:'10px 12px', background:'#0f4c81', color:'white', fontSize:'0.78rem', textAlign:'center', whiteSpace:'nowrap' };
    const cS = { padding:'8px 10px', fontSize:'0.82rem', textAlign:'center', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' };

    return (
        <div className="form-section active">
            {/* Header */}
            <h2 style={{ color:'#0369a1', marginBottom:'20px', paddingBottom:'15px', borderBottom:'2px solid #e0f0fa', display:'flex', alignItems:'center', gap:10 }}>
                <i className="fas fa-water"></i> Anaerobic Pond Operations
            </h2>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:'24px' }}>
                {[['daily','Daily Entry'],['monthly','Monthly View'],['tasks','Yearly Tasks']].map(([k,label]) => (
                    <button key={k} onClick={() => setTab(k)} style={{
                        padding:'10px 22px', border:'none', borderBottom: tab===k ? '3px solid #0369a1' : '3px solid transparent',
                        background:'none', color: tab===k ? '#0369a1' : '#64748b', fontWeight: tab===k ? 700 : 400,
                        cursor:'pointer', fontSize:'0.9rem', marginBottom:-2,
                    }}>{label}</button>
                ))}
            </div>

            {/* Status Message */}
            {actionMsg.text && (
                <div style={{
                    padding:'12px 16px', borderRadius:6, marginBottom:16,
                    background: actionMsg.type==='success' ? '#d1fae5' : '#fee2e2',
                    color: actionMsg.type==='success' ? '#065f46' : '#991b1b',
                    display:'flex', alignItems:'center', gap:8,
                }}>
                    <i className={`fas ${actionMsg.type==='success'?'fa-check-circle':'fa-exclamation-circle'}`}></i>
                    {actionMsg.text}
                    <button onClick={()=>setActionMsg({type:'',text:''})} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',color:'inherit'}}>✕</button>
                </div>
            )}

            {/* ── TAB: DAILY ENTRY ── */}
            {tab === 'daily' && (
                <form onSubmit={handleSubmit}>
                    {/* Header Section */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18, marginBottom:24 }}>
                        <div>
                            <label style={lblS}>Pond <span style={{color:'#dc2626'}}>*</span></label>
                            <select value={form.pond} onChange={e=>setForm(f=>({...f,pond:e.target.value}))} required style={inpS}>
                                <option value="">— Select pond —</option>
                                {ponds.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lblS}>Date <span style={{color:'#dc2626'}}>*</span></label>
                            <input type="date" value={form.log_date} onChange={e=>setForm(f=>({...f,log_date:e.target.value}))} max={todayStr} required style={inpS} />
                        </div>
                        <div>
                            <label style={lblS}>Frequency Allowed</label>
                            <div style={{ padding:'9px', background: frequencyAllowed ? '#dcfce7' : '#fee2e2', color: frequencyAllowed ? '#166534' : '#991b1b', borderRadius:6, fontWeight:600, fontSize:'0.9rem', textAlign:'center' }}>
                                {selectedPond ? (frequencyAllowed ? '✓ Enabled' : '✗ Not due') : '—'}
                            </div>
                        </div>
                    </div>

                    {!frequencyAllowed && selectedPond && (
                        <div style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:'0.9rem' }}>
                            <i className="fas fa-exclamation-circle" style={{marginRight:8}}></i>
                            This pond (<strong>{selectedPond.code}</strong>) is scheduled for <strong>{getFrequencyLabel(selectedPond.frequency)}</strong> monitoring. Please select a valid date.
                        </div>
                    )}

                    {/* Physical Observations Section */}
                    <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:16, marginBottom:20 }}>
                        <h3 style={{ margin:'0 0 14px', color:'#0369a1', fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
                            <i className="fas fa-water"></i> Physical Observations
                        </h3>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14 }}>
                            <div>
                                <label style={lblS}>pH</label>
                                <input type="number" step="0.01" value={form.ph} onChange={e=>setForm(f=>({...f,ph:e.target.value}))} disabled={!frequencyAllowed} placeholder="6.5 – 8.5" style={{...inpS, background: !frequencyAllowed ? '#f8fafc' : 'white', opacity: !frequencyAllowed ? 0.6 : 1 }} />
                            </div>
                            <div>
                                <label style={lblS}>Temperature (°C)</label>
                                <input type="number" step="0.1" value={form.temperature} onChange={e=>setForm(f=>({...f,temperature:e.target.value}))} disabled={!frequencyAllowed} placeholder="20 – 35" style={{...inpS, background: !frequencyAllowed ? '#f8fafc' : 'white', opacity: !frequencyAllowed ? 0.6 : 1 }} />
                            </div>
                            <div>
                                <label style={lblS}>DO (mg/L)</label>
                                <input type="number" step="0.01" value={form.do_level} onChange={e=>setForm(f=>({...f,do_level:e.target.value}))} disabled={!frequencyAllowed} placeholder="0.0 – 2.0" style={{...inpS, background: !frequencyAllowed ? '#f8fafc' : 'white', opacity: !frequencyAllowed ? 0.6 : 1 }} />
                            </div>
                            <div>
                                <label style={lblS}>Colour</label>
                                <select value={form.colour} onChange={e=>setForm(f=>({...f,colour:e.target.value}))} disabled={!frequencyAllowed} style={{...inpS, background: !frequencyAllowed ? '#f8fafc' : 'white', opacity: !frequencyAllowed ? 0.6 : 1 }}>
                                    <option value="">— Select —</option>
                                    {COLOUR_OPTIONS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display:'flex', gap:32, marginTop:14, flexWrap:'wrap' }}>
                            <label style={{ display:'flex', alignItems:'center', gap:8, cursor: !frequencyAllowed ? 'not-allowed' : 'pointer', fontWeight:600, color: !frequencyAllowed ? '#cbd5e1' : '#374151', opacity: !frequencyAllowed ? 0.5 : 1 }}>
                                <input type="checkbox" checked={form.surface_scum} onChange={e=>setForm(f=>({...f,surface_scum:e.target.checked}))} disabled={!frequencyAllowed} />
                                Surface Scum Observed
                            </label>
                            <label style={{ display:'flex', alignItems:'center', gap:8, cursor: !frequencyAllowed ? 'not-allowed' : 'pointer', fontWeight:600, color: !frequencyAllowed ? '#cbd5e1' : '#374151', opacity: !frequencyAllowed ? 0.5 : 1 }}>
                                <input type="checkbox" checked={form.odour_complaint} onChange={e=>setForm(f=>({...f,odour_complaint:e.target.checked}))} disabled={!frequencyAllowed} />
                                Odour Complaint
                            </label>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontWeight: 600 }}>
                            <input type="checkbox" checked={form.daily_inspection_done} onChange={(e) => setForm((f) => ({ ...f, daily_inspection_done: e.target.checked }))} disabled={!frequencyAllowed} />
                            Daily: Inspect ponds and record abnormalities
                        </label>
                    </div>

                    {isFirstWeekOfMonth(form.log_date) && (
                        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 14px', color: '#854d0e' }}>Monthly Tasks</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                                <div>
                                    <label style={lblS}>Valves / hand stop frames OK?</label>
                                    <select value={form.valves_hand_stops_ok} onChange={(e) => setForm((f) => ({ ...f, valves_hand_stops_ok: e.target.value }))} style={inpS}>
                                        <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                                    </select>
                                </div>
                                {[['inspection_incidences','Inspection incidences'],['spillage_incidences','Spillage'],['new_mother_connections','Mother conn.'],['new_child_connections','Child conn.'],['repairs_completed','Repairs'],['bod_incidences','BOD incid.']].map(([key, label]) => (
                                    <div key={key}><label style={lblS}>{label}</label><input type="number" min="0" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={inpS} /></div>
                                ))}
                                <div><label style={lblS}>Exhauster vol (m³)</label><input type="number" step="0.001" value={form.exhauster_volume_m3} onChange={(e) => setForm((f) => ({ ...f, exhauster_volume_m3: e.target.value }))} style={inpS} /></div>
                                <div><label style={lblS}>Effluent vol (m³)</label><input type="number" step="0.001" value={form.effluent_volume_m3} onChange={(e) => setForm((f) => ({ ...f, effluent_volume_m3: e.target.value }))} style={inpS} /></div>
                            </div>
                        </div>
                    )}

                    {isDecember(form.log_date) && (
                        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 14px', color: '#5b21b6' }}>Yearly Tasks</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                <YnSelect label="Desludging" value={form.yearly_desludging} onChange={(v) => setForm((f) => ({ ...f, yearly_desludging: v }))} />
                                <YnSelect label="Rust removal" value={form.yearly_rust_removal} onChange={(v) => setForm((f) => ({ ...f, yearly_rust_removal: v }))} />
                                <YnSelect label="Painting" value={form.yearly_painting} onChange={(v) => setForm((f) => ({ ...f, yearly_painting: v }))} />
                                <YnSelect label="Grease & paint valves" value={form.yearly_grease_paint_valves} onChange={(v) => setForm((f) => ({ ...f, yearly_grease_paint_valves: v }))} />
                            </div>
                        </div>
                    )}

                    <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 14px', color: '#047857' }}>Intermittent Tasks</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <YnSelect label="Grass cutting" value={form.intermittent_grass_cutting} onChange={(v) => setForm((f) => ({ ...f, intermittent_grass_cutting: v }))} />
                            <YnSelect label="Floating material" value={form.intermittent_floating_material} onChange={(v) => setForm((f) => ({ ...f, intermittent_floating_material: v }))} />
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div style={{ marginBottom:20 }}>
                        <label style={lblS}>Remarks</label>
                        <textarea value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} disabled={!frequencyAllowed} rows={3}
                            style={{ width:'100%', padding:'10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:'0.9rem', resize:'vertical', background: !frequencyAllowed ? '#f8fafc' : 'white', opacity: !frequencyAllowed ? 0.6 : 1 }}
                            placeholder="Observations, abnormalities, etc." />
                    </div>

                    <button type="submit" disabled={saving || !frequencyAllowed} style={{
                        background: saving || !frequencyAllowed ? '#94a3b8' : '#0369a1', color:'white', border:'none',
                        padding:'10px 24px', borderRadius:6, fontWeight:600, cursor: saving || !frequencyAllowed ? 'not-allowed' : 'pointer',
                    }}>
                        <i className={`fas ${saving?'fa-spinner fa-spin':'fa-paper-plane'}`} style={{marginRight:7}}></i>
                        {saving ? 'Submitting…' : !frequencyAllowed ? 'Date Not Due' : 'Submit Log'}
                    </button>
                </form>
            )}

            {/* ── TAB: MONTHLY VIEW ── */}
            {tab === 'monthly' && (
                <>
                    {/* Filters */}
                    <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                        <select value={selMonth} onChange={e=>{setSelMonth(Number(e.target.value));}} style={filterS}>
                            {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                        </select>
                        <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={filterS}>
                            {[today.getFullYear()-1, today.getFullYear()].map(y=><option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={selPond} onChange={e=>setSelPond(e.target.value)} style={filterS}>
                            <option value="">All Ponds</option>
                            {ponds.map(p=><option key={p.id} value={p.code}>{p.code}</option>)}
                        </select>
                        <button onClick={fetchLogs} style={{ padding:'8px 16px', borderRadius:6, border:'1px solid #0369a1', background:'white', color:'#0369a1', cursor:'pointer', fontWeight:600 }}>
                            <i className="fas fa-sync-alt" style={{marginRight:6}}></i>Refresh
                        </button>
                    </div>

                    {/* Monthly Aggregation Cards */}
                    {ponds.filter(p => !selPond || p.code === selPond).map(p => {
                        const agg = pondAgg[p.id];
                        if (!agg) return (
                            <div key={p.id} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'14px 18px', marginBottom:12, color:'#94a3b8' }}>
                                <strong>{p.code}</strong> — No logs for {MONTHS[selMonth-1]} {selYear}
                            </div>
                        );
                        return (
                            <div key={p.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, padding:'14px 18px', marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                                    <span style={{ fontWeight:700, color:'#0f4c81', fontSize:'1rem' }}>{p.code} — {p.name}</span>
                                    <span style={{ fontSize:'0.8rem', color:'#64748b' }}>{agg.verified}/{agg.total} verified</span>
                                </div>
                                <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                                    {[
                                        ['Avg pH', agg.avg_ph],
                                        ['Avg DO (mg/L)', agg.avg_do],
                                        ['Avg Temp (°C)', agg.avg_temp],
                                        ['Scum Days', agg.scum_days, agg.scum_days > 5 ? '#dc2626' : '#166534'],
                                        ['Odour Days', agg.odour_days, agg.odour_days > 3 ? '#dc2626' : '#166534'],
                                    ].map(([lbl, val, clr]) => (
                                        <div key={lbl} style={{ textAlign:'center', minWidth:80 }}>
                                            <div style={{ fontSize:'1.1rem', fontWeight:700, color: clr || '#1e293b' }}>{val}</div>
                                            <div style={{ fontSize:'0.72rem', color:'#64748b' }}>{lbl}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Detailed Log Table */}
                    {loading ? (
                        <div style={{ textAlign:'center', padding:40, color:'#64748b' }}><i className="fas fa-spinner fa-spin"></i> Loading…</div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No logs found for this period.</div>
                    ) : (
                        <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid #e2e8f0', marginTop:16 }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', background:'white', fontSize:'0.82rem' }}>
                                <thead>
                                    <tr>
                                        {['Date','Pond','pH','Temp','DO','Scum','Odour','Status','Actions'].map(h=>(
                                            <th key={h} style={hS}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log, idx) => {
                                        const st = STATUS_LABELS[log.status] || STATUS_LABELS.submitted;
                                        return (
                                            <tr key={log.id} style={{ background: idx%2===0?'white':'#fafafa' }}>
                                                <td style={{...cS, fontWeight:600}}>{log.log_date}</td>
                                                <td style={cS}>{log.pond_code}</td>
                                                <td style={cS}>{log.ph ?? '—'}</td>
                                                <td style={cS}>{log.temperature ?? '—'}</td>
                                                <td style={cS}>{log.do_level ?? '—'}</td>
                                                <td style={cS}>{log.surface_scum ? <span style={{color:'#d97706'}}>⚠ Yes</span> : 'No'}</td>
                                                <td style={cS}>{log.odour_complaint ? <span style={{color:'#dc2626'}}>⚠ Yes</span> : 'No'}</td>
                                                <td style={cS}>
                                                    <span style={{ padding:'3px 8px', borderRadius:10, fontSize:'0.72rem', fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span>
                                                </td>
                                                <td style={{...cS, padding:'6px 8px'}}>
                                                    <div style={{ display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
                                                        {canCosign && log.status === 'pending_second_sign' && (
                                                            <button onClick={()=>doAction(log.id,'cosign')} style={actionBtnStyle('#dbeafe','#1e40af')} title="Co-sign">
                                                                <i className="fas fa-pen-nib"></i> Co-sign
                                                            </button>
                                                        )}
                                                        {canVerify && log.status === 'pending_supervisor' && (
                                                            <button onClick={()=>doAction(log.id,'verify')} style={actionBtnStyle('#d1fae5','#065f46')} title="Verify">
                                                                <i className="fas fa-check-double"></i> Verify
                                                            </button>
                                                        )}
                                                        {canEscalate && !log.incident_created && (log.surface_scum || log.odour_complaint || (log.do_level !== null && Number(log.do_level) < 0.5)) && (
                                                            <button onClick={()=>{ setEscalateModal(log); setEscDesc(''); }} style={actionBtnStyle('#fee2e2','#991b1b')} title="Escalate to incident">
                                                                <i className="fas fa-exclamation-triangle"></i>
                                                            </button>
                                                        )}
                                                        {log.incident_number && (
                                                            <span style={{ fontSize:'0.7rem', color:'#dc2626', fontWeight:600 }} title={`Incident: ${log.incident_number}`}>
                                                                <i className="fas fa-link"></i> {log.incident_number}
                                                            </span>
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
                </>
            )}

            {/* ── TAB: YEARLY TASKS ── */}
            {tab === 'tasks' && (
                <>
                    <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                        <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} style={filterS}>
                            {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y=><option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={selPond} onChange={e=>setSelPond(e.target.value)} style={filterS}>
                            <option value="">All Ponds</option>
                            {ponds.map(p=><option key={p.id} value={p.code}>{p.code}</option>)}
                        </select>
                        <button onClick={fetchTasks} style={{ padding:'8px 16px', borderRadius:6, border:'1px solid #0369a1', background:'white', color:'#0369a1', cursor:'pointer', fontWeight:600 }}>
                            <i className="fas fa-sync-alt" style={{marginRight:6}}></i>Refresh
                        </button>
                    </div>

                    {tasks.length === 0 ? (
                        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>No yearly tasks found for {selYear}.</div>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {tasks.map(task => {
                                const TASK_STATUS_STYLES = {
                                    pending:     { bg:'#fef3c7', color:'#92400e' },
                                    in_progress: { bg:'#dbeafe', color:'#1e40af' },
                                    completed:   { bg:'#d1fae5', color:'#065f46' },
                                    deferred:    { bg:'#f1f5f9', color:'#475569' },
                                };
                                const ts = TASK_STATUS_STYLES[task.status] || TASK_STATUS_STYLES.pending;
                                return (
                                    <div key={task.id} style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:8, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:16, boxShadow:'0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <span style={{ padding:'3px 10px', borderRadius:10, fontSize:'0.73rem', fontWeight:600, background:ts.bg, color:ts.color, whiteSpace:'nowrap', marginTop:2 }}>
                                            {task.status.replace('_',' ')}
                                        </span>
                                        <div style={{ flex:1 }}>
                                            <div style={{ fontWeight:700, color:'#1e293b', marginBottom:3 }}>
                                                <span style={{ color:'#0369a1', marginRight:8 }}>{task.pond_code}</span>
                                                {task.task_name}
                                            </div>
                                            {task.description && <div style={{ color:'#64748b', fontSize:'0.83rem', marginBottom:3 }}>{task.description}</div>}
                                            {task.assigned_name && <div style={{ color:'#94a3b8', fontSize:'0.78rem' }}>Assigned to: {task.assigned_name}</div>}
                                        </div>
                                        {task.due_date && (
                                            <div style={{ textAlign:'right', fontSize:'0.78rem', color: new Date(task.due_date) < today && task.status !== 'completed' ? '#dc2626' : '#64748b', whiteSpace:'nowrap' }}>
                                                <i className="fas fa-calendar-alt" style={{marginRight:4}}></i>
                                                {task.due_date}
                                                {new Date(task.due_date) < today && task.status !== 'completed' && <div style={{ color:'#dc2626', fontWeight:600 }}>Overdue</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Escalate Modal */}
            {escalateModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                    <div style={{ background:'white', borderRadius:10, width:'100%', maxWidth:480, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ margin:'0 0 12px', color:'#dc2626' }}><i className="fas fa-exclamation-triangle" style={{marginRight:8}}></i>Escalate Pond Alert</h3>
                        <p style={{ color:'#64748b', fontSize:'0.88rem', marginBottom:16 }}>
                            Creating an incident for <strong>{escalateModal.pond_code}</strong> on <strong>{escalateModal.log_date}</strong>.
                        </p>
                        <div style={{ marginBottom:16 }}>
                            <label style={lblS}>Description (optional)</label>
                            <textarea value={escDesc} onChange={e=>setEscDesc(e.target.value)} rows={3}
                                style={{ width:'100%', padding:'10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:'0.9rem', resize:'vertical' }}
                                placeholder="Describe the abnormality requiring action…" />
                        </div>
                        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                            <button onClick={()=>setEscalateModal(null)} style={{ padding:'8px 18px', borderRadius:6, border:'1px solid #cbd5e1', background:'white', cursor:'pointer' }}>Cancel</button>
                            <button onClick={doEscalate} style={{ padding:'8px 18px', borderRadius:6, border:'none', background:'#dc2626', color:'white', fontWeight:600, cursor:'pointer' }}>
                                <i className="fas fa-exclamation-triangle" style={{marginRight:6}}></i>Create Incident
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const lblS = { display:'block', marginBottom:5, fontWeight:600, color:'#374151', fontSize:'0.85rem' };
const inpS = { width:'100%', padding:'9px 10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:'0.9rem', background:'white' };
const filterS = { padding:'8px 12px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:'0.88rem' };
const actionBtnStyle = (bg, color) => ({
    padding:'4px 9px', borderRadius:5, border:'none', cursor:'pointer',
    background:bg, color:color, fontSize:'0.75rem', fontWeight:600,
});

export default PondMaintenanceLogs;
