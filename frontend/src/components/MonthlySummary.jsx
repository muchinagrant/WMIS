import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const MonthlySummary = () => {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

    const { user } = useContext(AuthContext);
    const userRole = user?.role || '';
    const canLock = ['admin', 'stp_superintendent'].includes(userRole);
    const [lockMsg, setLockMsg] = useState({ type: '', text: '' });
    const [locking, setLocking] = useState(false);

    const handleLockMonth = async () => {
        if (!window.confirm(`Lock ${new Date(0, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}? This cannot be undone.`)) return;
        setLocking(true);
        setLockMsg({ type: '', text: '' });
        try {
            await api.post('/api/summary/lock_month/', { year: selectedYear, month: selectedMonth });
            setLockMsg({ type: 'success', text: `${new Date(0, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear} is now locked.` });
            fetchSummaryData();
        } catch (err) {
            setLockMsg({ type: 'error', text: err.response?.data?.error || 'Lock failed.' });
        } finally {
            setLocking(false);
        }
    };

    const fetchSummaryData = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await api.get(`/api/summary/?year=${selectedYear}&month=${selectedMonth}`);
            setSummaryData(res.data);
        } catch (err) {
            console.error('Failed to fetch summary', err);
            setErrorMsg('Failed to load executive summary. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        fetchSummaryData();
    }, [fetchSummaryData]);

    const handleExport = () => {
        window.open(`${api.defaults.baseURL}/api/summary/?year=${selectedYear}&month=${selectedMonth}&export=csv`, '_blank');
    };

    const KPICard = ({ title, value, icon, color, subtitle }) => (
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', borderLeft: `5px solid ${color}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>{title}</p>
                    <h3 style={{ color: '#0f172a', fontSize: '1.8rem', margin: '0' }}>{value}</h3>
                    {subtitle && <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '5px' }}>{subtitle}</p>}
                </div>
                <div style={{ background: `${color}20`, padding: '12px', borderRadius: '50%', color: color }}>
                    <i className={`fas ${icon} fa-lg`}></i>
                </div>
            </div>
        </div>
    );

    const formatPercent = (value) => (value === null || value === undefined ? 'N/A' : `${value}%`);
    const getThresholdColor = (value) => (value !== null && value !== undefined && value >= 80 ? '#16a34a' : '#ca8a04');

    return (
        <div className="form-section active" style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}><i className="fas fa-chart-line" style={{ color: '#1a6fb0', marginRight: '10px' }}></i> Executive Operations Summary</h2>
                    <p style={{ color: '#64748b', margin: '0', fontSize: '0.95rem' }}>Confidential Management Dashboard • {user?.full_name}</p>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                    >
                        {[currentDate.getFullYear(), currentDate.getFullYear() - 1].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={handleExport} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <i className="fas fa-file-csv"></i> Export CSV
                    </button>
                    {canLock && summaryData && !summaryData.is_locked && (
                        <button
                            onClick={handleLockMonth}
                            disabled={locking}
                            style={{ background: locking ? '#94a3b8' : '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: locking ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                        >
                            <i className={`fas ${locking ? 'fa-spinner fa-spin' : 'fa-lock'}`}></i> Lock Month
                        </button>
                    )}
                </div>
            </div>

            {summaryData?.is_locked && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fas fa-lock" style={{ color: '#d97706' }}></i>
                    <span style={{ fontWeight: 600, color: '#92400e' }}>Locked snapshot</span>
                    <span style={{ color: '#78350f', fontSize: '0.88rem' }}>
                        — Frozen by {summaryData.locked_by} on {new Date(summaryData.locked_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Data reflects the state at lock time.
                    </span>
                </div>
            )}

            {lockMsg.text && (
                <div style={{ padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', background: lockMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: lockMsg.type === 'success' ? '#065f46' : '#991b1b' }}>
                    <i className={`fas ${lockMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: 6 }}></i>
                    {lockMsg.text}
                </div>
            )}

            {errorMsg && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>{errorMsg}</div>}

            {loading || !summaryData ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                    <i className="fas fa-circle-notch fa-spin fa-3x mb-3"></i>
                    <p>Aggregating monthly operational data...</p>
                </div>
            ) : (
                <>
                    <h3 style={{ color: '#334155', marginBottom: '15px', fontSize: '1.2rem' }}>Network Maintenance & Revenue</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '35px' }}>
                        <KPICard
                            title="Total Incidents Reported"
                            value={summaryData.collection.total_incidents}
                            icon="fa-exclamation-triangle"
                            color="#eab308"
                            subtitle={`${summaryData.collection.spillage_incidences} sewer spillages logged`}
                        />
                        <KPICard
                            title="Repairs Certified (SLA Closed)"
                            value={summaryData.collection.resolved_incidents}
                            icon="fa-tools"
                            color="#1a6fb0"
                            subtitle={`${summaryData.collection.total_incidents - summaryData.collection.resolved_incidents} pending resolution`}
                        />
                        <KPICard
                            title="New Unmetered Connections"
                            value={summaryData.collection.new_connections}
                            icon="fa-coins"
                            color="#ef4444"
                            subtitle="F201 Patrol Discoveries (Revenue Leak)"
                        />
                    </div>

                    <h3 style={{ color: '#334155', marginBottom: '15px', fontSize: '1.2rem' }}>Treatment Plant Operations (F203 Lab Data)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '35px' }}>
                        <KPICard
                            title="Avg BOD Removal Efficiency"
                            value={formatPercent(summaryData.treatment.avg_bod_removal)}
                            icon="fa-flask"
                            color={getThresholdColor(summaryData.treatment.avg_bod_removal)}
                            subtitle={summaryData.treatment.data_available ? 'Regulatory Target: > 80%' : 'No lab efficiency data for selected month'}
                        />
                        <KPICard
                            title="Avg TSS Removal Efficiency"
                            value={formatPercent(summaryData.treatment.avg_tss_removal)}
                            icon="fa-filter"
                            color={getThresholdColor(summaryData.treatment.avg_tss_removal)}
                            subtitle={summaryData.treatment.data_available ? 'Regulatory Target: > 80%' : 'No lab efficiency data for selected month'}
                        />
                        <KPICard
                            title="Compliance Alerts"
                            value={summaryData.treatment.days_with_alerts}
                            icon="fa-exclamation-circle"
                            color={summaryData.treatment.days_with_alerts === 0 ? '#16a34a' : '#ef4444'}
                            subtitle="Days with parameters exceeding NEMA limits"
                        />
                    </div>

                    <h3 style={{ color: '#334155', marginBottom: '15px', fontSize: '1.2rem' }}>Private Exhauster Intake</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        <KPICard
                            title="Total Sludge Volume Dumped"
                            value={`${summaryData.sludge.total_volume_m3.toLocaleString()} m3`}
                            icon="fa-truck"
                            color="#8b5cf6"
                            subtitle={`Across ${summaryData.sludge.collections_count} approved manifests`}
                        />
                        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', borderLeft: '5px solid #64748b', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', gridColumn: 'span 2' }}>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '15px' }}>Intake Demographics</p>
                            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                                <div>
                                    <h4 style={{ fontSize: '1.5rem', margin: '0', color: '#0f172a' }}>{summaryData.sludge.breakdown.residential} m3</h4>
                                    <p style={{ margin: '0', color: '#64748b', fontSize: '0.85rem' }}>Residential</p>
                                </div>
                                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
                                    <h4 style={{ fontSize: '1.5rem', margin: '0', color: '#0f172a' }}>{summaryData.sludge.breakdown.institutional} m3</h4>
                                    <p style={{ margin: '0', color: '#64748b', fontSize: '0.85rem' }}>Institutional</p>
                                </div>
                                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
                                    <h4 style={{ fontSize: '1.5rem', margin: '0', color: '#0f172a' }}>{summaryData.sludge.breakdown.commercial} m3</h4>
                                    <p style={{ margin: '0', color: '#64748b', fontSize: '0.85rem' }}>Commercial</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MonthlySummary;
