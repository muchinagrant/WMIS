import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const todayStr = () => new Date().toISOString().split('T')[0];

const LabDashboard = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [flags, setFlags] = useState([]);
    const [ponds, setPonds] = useState([]);

    const load = useCallback(async () => {
        const [r, f, p] = await Promise.all([
            api.get('/api/lab-records/'),
            api.get('/api/lab-flags/'),
            api.get('/api/pond-logs/'),
        ]);
        setRecords(r.data?.results || r.data || []);
        setFlags(f.data?.results || f.data || []);
        setPonds(p.data?.results || p.data || []);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const today = todayStr();
    const todayRecord = records.find((x) => x.record_date === today);
    const activeFlags = flags.filter((x) => x.status === 'open' || x.status === 'escalated');
    const pondPending = ponds.filter((x) => x.status === 'pending_second_sign');
    const trend = records.slice().sort((a, b) => (a.record_date < b.record_date ? 1 : -1)).slice(0, 7);

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: 18, borderBottom: '2px solid #e0f0fa', paddingBottom: 10 }}>
                <i className="fas fa-flask" style={{ marginRight: 8 }}></i>Lab Technician Dashboard
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <Card title="Today's Lab Entry" value={todayRecord ? 'Submitted' : 'Pending'} cta="Enter Today's Results" onClick={() => navigate('/lab-records', { state: { focusToday: true } })} />
                <Card title="Pending Verifications" value={records.filter((r) => r.status !== 'fully_signed').length} cta="Open Treatment" onClick={() => navigate('/treatment')} />
                <Card title="Active Flags" value={activeFlags.length} cta="Open Alerts" onClick={() => navigate('/alerts')} />
                <Card title="Pond Co-signs Pending" value={pondPending.length} cta="Open Ponds" onClick={() => navigate('/ponds')} />
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 12 }}>
                <h3 style={{ margin: '0 0 8px' }}>Recent BOD Efficiency Trend (7 days)</h3>
                {trend.length === 0 ? <div style={{ color: '#64748b' }}>No recent records.</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={th}>Date</th>
                                <th style={th}>BOD Eff%</th>
                                <th style={th}>TSS Eff%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trend.map((r) => (
                                <tr key={r.id}>
                                    <td style={td}>{r.record_date}</td>
                                    <td style={td}>{r.bod_removal_efficiency ?? '—'}</td>
                                    <td style={td}>{r.tss_removal_efficiency ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const Card = ({ title, value, cta, onClick }) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{title}</div>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', margin: '6px 0 8px' }}>{value}</div>
        <button onClick={onClick} style={{ background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>{cta}</button>
    </div>
);

const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem' };
const td = { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.84rem' };

export default LabDashboard;
