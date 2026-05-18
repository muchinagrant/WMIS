import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SupervisorDashboard = ({ defaultTab = 'overview' }) => {
    const navigate = useNavigate();
    const [flags, setFlags] = useState([]);
    const [ponds, setPonds] = useState([]);
    const [tlogs, setTlogs] = useState([]);
    const [f203a, setF203a] = useState([]);
    const [labRecords, setLabRecords] = useState([]);
    const [flowRecords, setFlowRecords] = useState([]);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [tab, setTab] = useState(defaultTab); // 'overview' | 'team' | 'treatment'

    const load = useCallback(async () => {
        try {
            const [fl, p, t, a, lr, fr] = await Promise.all([
                api.get('/api/lab-flags/'),
                api.get('/api/pond-logs/'),
                api.get('/api/treatment-logs/'),
                api.get('/api/f203a/'),
                api.get('/api/lab-records/?status=pending_operator'),
                api.get('/api/flow-records/?status=pending_operator'),
            ]);
            setFlags(fl.data?.results || fl.data || []);
            setPonds(p.data?.results || p.data || []);
            setTlogs(t.data?.results || t.data || []);
            setF203a(a.data?.results || a.data || []);
            setLabRecords(lr.data?.results || lr.data || []);
            setFlowRecords(fr.data?.results || fr.data || []);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const pondPending = ponds.filter((x) => x.status === 'pending_supervisor');
    const openFlags = flags.filter((x) => x.status === 'open' || x.status === 'resolved');
    const redFlags = openFlags.filter((x) => x.severity === 'red');

    const now = new Date();
    const monthLogs = tlogs.filter((x) => {
        const d = new Date(x.report_date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Team workload aggregation
    const f203aPending = f203a.filter((x) => x.status === 'pending_operator').length;
    const pondLogsPending = ponds.filter((x) => x.status === 'pending_second_sign').length;
    const labPending = labRecords.length;
    const flowPending = flowRecords.length;
    const totalPendingCoSigns = f203aPending + pondLogsPending + labPending + flowPending;

    // Treatment logs with alerts
    const tlogsWithAlerts = tlogs.filter((x) => x.alert === true).slice(0, 10);

    const escalate = async () => {
        const note = window.prompt('Escalation note to superintendent:');
        if (!note) return;
        try {
            await api.post('/api/notifications/escalate_superintendent/', { note });
            setMsg({ type: 'success', text: 'Escalation sent.' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to escalate.' });
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: 18, borderBottom: '2px solid #e0f0fa', paddingBottom: 10 }}>
                <i className="fas fa-user-shield" style={{ marginRight: 8 }}></i>Supervisor Dashboard
            </h2>

            {msg.text && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 6, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {msg.text}
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
                {[['overview', 'Overview'], ['team', 'Team Workload'], ['treatment', 'Treatment Review']].map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        style={{
                            padding: '10px 18px',
                            border: 'none',
                            borderBottom: tab === k ? '3px solid #0369a1' : '3px solid transparent',
                            background: 'none',
                            fontWeight: tab === k ? 700 : 400,
                            color: tab === k ? '#0369a1' : '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            marginBottom: '-2px',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ─── OVERVIEW TAB ─── */}
            {tab === 'overview' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                            <h3 style={{ margin: '0 0 8px' }}>Alerts Panel</h3>
                            {openFlags.length === 0 ? <div style={{ color: '#64748b' }}>No active alerts.</div> : openFlags.slice(0, 6).map((f) => (
                                <div key={f.id} style={{ marginBottom: 6, fontSize: '0.86rem', color: f.severity === 'red' ? '#b91c1c' : '#92400e' }}>
                                    {f.lab_record_date} • {f.parameter_key} • {f.severity}
                                </div>
                            ))}
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                            <h3 style={{ margin: '0 0 8px' }}>Pond Sign-offs Pending</h3>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{pondPending.length}</div>
                            <button onClick={() => navigate('/ponds')} style={btn('#1e40af')}>Open Pond Queue</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                        <div style={card}>
                            <h3 style={{ margin: '0 0 8px' }}>Lab Compliance Summary</h3>
                            <div>Open flags: <strong>{openFlags.length}</strong></div>
                            <div>Red flags: <strong style={{ color: '#b91c1c' }}>{redFlags.length}</strong></div>
                            <button onClick={() => navigate('/alerts')} style={btn('#dc2626')}>Open Lab Flags</button>
                        </div>
                        <div style={card}>
                            <h3 style={{ margin: '0 0 8px' }}>Treatment Log Status</h3>
                            <div>{monthLogs.length}/{daysInMonth} submitted this month</div>
                            <button onClick={() => navigate('/treatment')} style={btn('#0369a1')}>Review Treatment</button>
                        </div>
                        <div style={card}>
                            <h3 style={{ margin: '0 0 8px' }}>Inlet Works Review</h3>
                            <div>Records: {f203a.length}</div>
                            <button onClick={() => navigate('/f203a')} style={btn('#334155')}>Review F203A</button>
                        </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <button onClick={escalate} style={{ background: '#b91c1c', color: 'white', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}>
                            Escalate to Superintendent
                        </button>
                    </div>
                </>
            )}

            {/* ─── TEAM WORKLOAD TAB ─── */}
            {tab === 'team' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, marginBottom: 6 }}>F203A Inlet Works</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0369a1' }}>{f203aPending}</div>
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 4 }}>awaiting co-sign</div>
                        </div>
                        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600, marginBottom: 6 }}>Pond Operations</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#92400e' }}>{pondLogsPending}</div>
                            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: 4 }}>awaiting co-sign</div>
                        </div>
                        <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: '#6b21a8', fontWeight: 600, marginBottom: 6 }}>Lab Records</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#6b21a8' }}>{labPending}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: 4 }}>awaiting co-sign</div>
                        </div>
                        <div style={{ background: '#dbeafe', border: '1px solid #7dd3fc', borderRadius: 8, padding: 14 }}>
                            <div style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, marginBottom: 6 }}>Flow Records</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0369a1' }}>{flowPending}</div>
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 4 }}>awaiting co-sign</div>
                        </div>
                    </div>

                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 12px', color: '#0369a1', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className="fas fa-users"></i> Total Pending Co-Signatures: <strong style={{ color: '#0369a1', fontSize: '1.2rem' }}>{totalPendingCoSigns}</strong>
                        </h3>
                        <div style={{ fontSize: '0.9rem', color: '#0369a1' }}>
                            These records are waiting for operator or lab tech co-signatures before they can be fully verified.
                        </div>
                    </div>

                    {/* F203A Pending List */}
                    {f203aPending > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', color: '#0369a1', fontSize: '1rem' }}>F203A Inlet Works - Pending ({f203aPending})</h3>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {f203a.filter(x => x.status === 'pending_operator').slice(0, 5).map((record) => (
                                    <div key={record.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.date}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Submitted by: {record.submitted_by_name || 'Unknown'}</div>
                                        </div>
                                        <button onClick={() => navigate('/f203a')} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Review
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lab Records Pending List */}
                    {labPending > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', color: '#6b21a8', fontSize: '1rem' }}>Lab Records - Pending ({labPending})</h3>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {labRecords.slice(0, 5).map((record) => (
                                    <div key={record.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.record_date}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Submitted by: {record.attendant || 'Unknown'}</div>
                                        </div>
                                        <button onClick={() => navigate('/lab-records')} style={{ background: '#6b21a8', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Review
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pond Logs Pending List */}
                    {pondLogsPending > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', color: '#92400e', fontSize: '1rem' }}>Pond Logs - Pending ({pondLogsPending})</h3>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {ponds.filter(x => x.status === 'pending_second_sign').slice(0, 5).map((record) => (
                                    <div key={record.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.pond_code} — {record.log_date}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Submitted by: {record.submitted_by_name || 'Unknown'}</div>
                                        </div>
                                        <button onClick={() => navigate('/ponds')} style={{ background: '#92400e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Review
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── TREATMENT REVIEW TAB ─── */}
            {tab === 'treatment' && (
                <>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 8px', color: '#0369a1', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className="fas fa-chart-line"></i> Treatment Logs with Alerts
                        </h3>
                        <div style={{ fontSize: '0.9rem', color: '#0369a1' }}>
                            Showing {tlogsWithAlerts.length} logs with parameter exceedances or operational alerts
                        </div>
                    </div>

                    {tlogsWithAlerts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', marginBottom: 12, display: 'block', color: '#059669' }}></i>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>All treatment logs nominal</div>
                            <div style={{ fontSize: '0.9rem', marginTop: 8 }}>No alerts detected in current treatment operations.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {tlogsWithAlerts.map((tlog) => (
                                <div key={tlog.id} style={{ background: '#fff', border: '2px solid #fecaca', borderRadius: 8, padding: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '1rem' }}>
                                                <i className="fas fa-exclamation-triangle"></i> {tlog.report_date}
                                            </div>
                                            {tlog.operator && <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>Operator: {tlog.operator}</div>}
                                            {tlog.shift && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Shift: {tlog.shift}</div>}
                                        </div>
                                        <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600 }}>
                                            ⚠ ALERT
                                        </span>
                                    </div>
                                    {tlog.operational_notes && (
                                        <div style={{ fontSize: '0.9rem', color: '#374151', marginTop: 8, padding: '8px', background: '#fafafa', borderRadius: 4, borderLeft: '3px solid #dc2626' }}>
                                            {tlog.operational_notes}
                                        </div>
                                    )}
                                    <button onClick={() => navigate('/treatment')} style={{ marginTop: 10, background: '#dc2626', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                        Review Details
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                        <button onClick={() => navigate('/treatment')} style={{ background: '#0369a1', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                            <i className="fas fa-arrow-right" style={{ marginRight: 8 }}></i>View All Treatment Logs
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 };
const btn = (bg) => ({ marginTop: 8, background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' });

export default SupervisorDashboard;
