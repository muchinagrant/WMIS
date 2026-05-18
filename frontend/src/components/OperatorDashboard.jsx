import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const todayStr = () => new Date().toISOString().split('T')[0];

const OperatorDashboard = () => {
    const navigate = useNavigate();
    const [tlogs, setTlogs] = useState([]);
    const [f203a, setF203a] = useState([]);
    const [flags, setFlags] = useState([]);
    const [sludge, setSludge] = useState([]);
    const [ponds, setPonds] = useState([]);

    const load = useCallback(async () => {
        const [t, a, f, s, p] = await Promise.all([
            api.get('/api/treatment-logs/'),
            api.get('/api/f203a/'),
            api.get('/api/lab-flags/'),
            api.get('/api/sludge/'),
            api.get('/api/pond-logs/'),
        ]);
        setTlogs(t.data?.results || t.data || []);
        setF203a(a.data?.results || a.data || []);
        setFlags((f.data?.results || f.data || []).filter((x) => x.status === 'open'));
        setSludge(s.data?.results || s.data || []);
        setPonds(p.data?.results || p.data || []);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const today = todayStr();
    const todayLog = tlogs.find((x) => x.report_date === today);
    const pendingCosigns = f203a.filter((x) => ['pending_operator', 'returned'].includes(x.status));
    const pendingSludge = sludge.filter((x) => x.manifest_status === 'pending');
    const pondPending = ponds.filter((x) => x.status === 'pending_second_sign');

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: 18, borderBottom: '2px solid #e0f0fa', paddingBottom: 10 }}>
                <i className="fas fa-cogs" style={{ marginRight: 8 }}></i>Operator Work Dashboard
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Today's Treatment Log</h3>
                    {!todayLog ? (
                        <>
                            <div style={{ color: '#92400e', marginBottom: 8 }}>Not submitted yet.</div>
                            <button onClick={() => navigate('/treatment')} style={{ background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>Enter Today's Readings</button>
                        </>
                    ) : (
                        <div style={{ color: '#065f46' }}>Submitted for {today}.</div>
                    )}
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Pending Co-signs</h3>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#92400e' }}>{pendingCosigns.length}</div>
                    <button onClick={() => navigate('/f203a')} style={{ marginTop: 8, background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Review & Sign</button>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Lab Flags</h3>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: flags.some((f) => f.severity === 'red') ? '#b91c1c' : '#92400e' }}>{flags.length}</div>
                    <button onClick={() => navigate('/alerts')} style={{ marginTop: 8, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Open Alerts</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Pending F203A Items</h3>
                    {pendingCosigns.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.88rem' }}>No F203A co-sign requests.</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {pendingCosigns.slice(0, 5).map((item) => (
                                <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{item.date}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 2 }}>
                                        Attendant: {item.attendant_name || '—'}
                                    </div>
                                    <button onClick={() => navigate('/f203a')} style={{ marginTop: 8, background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                        Review & Sign
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Sludge Pending Approvals</h3>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{pendingSludge.length}</div>
                    <button onClick={() => navigate('/sludge')} style={{ marginTop: 8, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Open Sludge Queue</button>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 8px' }}>Pond Co-signs Pending</h3>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{pondPending.length}</div>
                    <button onClick={() => navigate('/ponds')} style={{ marginTop: 8, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Open Ponds</button>
                </div>
            </div>
        </div>
    );
};

export default OperatorDashboard;
