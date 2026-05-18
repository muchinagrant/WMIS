import React, { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

const todayStr = () => new Date().toISOString().split('T')[0];

const AttendantDashboard = () => {
    const [f203a, setF203a] = useState([]);
    const [flow, setFlow] = useState([]);
    const [ponds, setPonds] = useState([]);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [flagForm, setFlagForm] = useState({ form: 'F203A', description: '' });

    const load = useCallback(async () => {
        try {
            const [a, f, p] = await Promise.all([
                api.get('/api/f203a/'),
                api.get('/api/flow-records/'),
                api.get('/api/pond-logs/'),
            ]);
            setF203a(a.data?.results || a.data || []);
            setFlow(f.data?.results || f.data || []);
            setPonds(p.data?.results || p.data || []);
        } catch {
            setMsg({ type: 'error', text: 'Failed to load dashboard.' });
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const today = todayStr();
    const todayF203A = f203a.find((r) => r.date === today);
    const todayFlow = flow.find((r) => r.date === today);
    const todayPond = ponds.find((r) => r.log_date === today);

    const readingDone = (slot) => {
        const row = (todayFlow?.readings || []).find((r) => r.time_slot === slot);
        return !!row && (row.meter_1 !== null || row.meter_2 !== null);
    };

    const checklist = [
        ['F203A: Morning raking (T1)', !!todayF203A?.raking_t1],
        ['F203A: Midday raking (T2)', !!todayF203A?.raking_t2],
        ['F203A: Afternoon raking (T3)', !!todayF203A?.raking_t3],
        ['F203A: Screenings burial', !!todayF203A?.screenings_burial],
        ['F203A: Grit scooping', !!todayF203A?.grit_scooping],
        ['F203A: Grit burial', !!todayF203A?.grit_burial],
        ['F203C: 9am flow reading', readingDone('09:00')],
        ['F203C: 12pm flow reading', readingDone('12:00')],
        ['F203C: 3pm flow reading', readingDone('15:00')],
        ['F203C: 6pm flow reading', readingDone('18:00')],
        ['Pond inspection', !!todayPond],
    ];

    const awaiting = [
        ...f203a.filter((r) => ['pending_operator', 'returned'].includes(r.status)).map((r) => ({
            id: `f203a-${r.id}`,
            type: 'F203A',
            date: r.date,
            status: r.status,
        })),
        ...ponds.filter((r) => r.status === 'pending_second_sign').map((r) => ({
            id: `pond-${r.id}`,
            type: 'Pond',
            date: r.log_date,
            status: r.status,
        })),
    ];

    const submissions = [
        ...f203a.map((r) => ({ id: `f203a-${r.id}`, type: 'F203A', date: r.date, status: r.status })),
        ...flow.map((r) => ({ id: `flow-${r.id}`, type: 'F203C', date: r.date, status: 'submitted' })),
        ...ponds.map((r) => ({ id: `pond-${r.id}`, type: 'Pond', date: r.log_date, status: r.status })),
    ]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 5);

    const submitQuickFlag = async () => {
        if (!flagForm.description.trim()) return;
        try {
            await api.post('/api/notifications/quick_flag/', flagForm);
            setMsg({ type: 'success', text: 'Abnormality sent to supervisor.' });
            setFlagForm({ ...flagForm, description: '' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to send abnormality.' });
        }
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#0369a1', marginBottom: 18, borderBottom: '2px solid #e0f0fa', paddingBottom: 10 }}>
                <i className="fas fa-clipboard-list" style={{ marginRight: 8 }}></i>Attendant Daily Dashboard
            </h2>

            {msg.text && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 6, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
                    {msg.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 10px', color: '#1e293b' }}>Today's Task Checklist ({today})</h3>
                    <div style={{ display: 'grid', gap: 6 }}>
                        {checklist.map(([label, done]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                                <span>{label}</span>
                                <strong style={{ color: done ? '#16a34a' : '#dc2626' }}>{done ? '✓' : '✗'}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 10px', color: '#1e293b' }}>Quick Flag Abnormality</h3>
                    <select value={flagForm.form} onChange={(e) => setFlagForm({ ...flagForm, form: e.target.value })} style={{ width: '100%', marginBottom: 8, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
                        <option>F203A</option>
                        <option>Ponds</option>
                        <option>Other</option>
                    </select>
                    <textarea rows={3} value={flagForm.description} onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })} placeholder="Describe abnormality..." style={{ width: '100%', marginBottom: 8, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
                    <button onClick={submitQuickFlag} style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer' }}>Submit Flag</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 10px', color: '#1e293b' }}>Awaiting Co-sign</h3>
                    {awaiting.length === 0 ? <div style={{ color: '#64748b' }}>No pending co-signs.</div> : awaiting.map((a) => (
                        <div key={a.id} style={{ fontSize: '0.86rem', marginBottom: 6 }}>{a.type} • {a.date} • {a.status}</div>
                    ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 10px', color: '#1e293b' }}>Recent Submissions</h3>
                    {submissions.length === 0 ? <div style={{ color: '#64748b' }}>No submissions yet.</div> : submissions.map((s) => (
                        <div key={s.id} style={{ fontSize: '0.86rem', marginBottom: 6 }}>{s.type} • {s.date} • {s.status}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AttendantDashboard;
