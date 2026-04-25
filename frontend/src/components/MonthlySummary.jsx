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

    const fetchSummaryData = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await api.get(`/api/monthly-summary/?year=${selectedYear}&month=${selectedMonth}`);
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
        window.open(`${api.defaults.baseURL}/api/monthly-summary/?year=${selectedYear}&month=${selectedMonth}&export=csv`, '_blank');
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
                </div>
            </div>

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
                            subtitle={`${summaryData.collection.spillage_incidences} spillages, ${summaryData.collection.inspection_incidences} blockages`}
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
                            value={`${summaryData.treatment.avg_bod_removal}%`}
                            icon="fa-flask"
                            color={summaryData.treatment.avg_bod_removal >= 80 ? '#16a34a' : '#ca8a04'}
                            subtitle="Regulatory Target: > 80%"
                        />
                        <KPICard
                            title="Avg TSS Removal Efficiency"
                            value={`${summaryData.treatment.avg_tss_removal}%`}
                            icon="fa-filter"
                            color={summaryData.treatment.avg_tss_removal >= 80 ? '#16a34a' : '#ca8a04'}
                            subtitle="Regulatory Target: > 80%"
                        />
                        <KPICard
                            title="Total Treated Volume"
                            value={`${summaryData.treatment.total_effluent.toLocaleString()} m3`}
                            icon="fa-water"
                            color="#0ea5e9"
                            subtitle={`From ${summaryData.treatment.total_influent.toLocaleString()} m3 influent`}
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
