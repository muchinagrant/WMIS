import React, { useState, useEffect, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// 1. Validation Schema
const SummarySchema = Yup.object().shape({
    month: Yup.string().required('Month is required'),
    year: Yup.number()
        .min(2020, 'Year must be 2020 or later')
        .max(2030, 'Year must be 2030 or earlier')
        .required('Year is required'),
    performance_summary: Yup.string().required('Please provide a narrative summary'),
});

const MonthlySummary = () => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
    const [isFetching, setIsFetching] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { isOnline } = useContext(SyncContext);

    // Initial structure mapping to the HTML prototype
    const [summaryData, setSummaryData] = useState({
        collection: {
            inspection_incidences: 0,
            spillage_incidences: 0,
            repairs_completed: 0,
            new_connections: 0,
            total_incidents: 0,
            resolved_incidents: 0,
        },
        treatment: {
            total_influent: 0,
            total_effluent: 0,
            avg_bod_removal: 0,
            avg_tss_removal: 0,
            avg_bod_removal_percent: 0,
            avg_tss_removal_percent: 0,
            days_with_alerts: 0,
        },
        sludge: {
            total_volume_m3: 0,
            breakdown: {
                residential: 0,
                institutional: 0,
                commercial: 0,
            },
            collections_count: 0,
            active_exhausters: 0,
        }
    });

    // Fetch monthly data from API
    const fetchMonthlyData = async (month, year) => {
        if (!month || !year) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'Please select both month and year.' 
            });
            return;
        }

        setIsFetching(true);
        setLoading(true);
        setError('');
        setSubmitStatus({ type: '', message: '' });

        try {
            // Actual API call to the backend
            const response = await api.get(`/api/monthly-summary/?year=${year}&month=${month}`);
            const data = response.data;
            
            // Transform backend data to match frontend structure
            const transformedData = {
                collection: {
                    inspection_incidences: data.collection?.inspection_incidences || 0,
                    spillage_incidences: data.collection?.spillage_incidences || 0,
                    repairs_completed: data.collection?.repairs_completed || 0,
                    new_connections: data.collection?.new_connections || 0,
                    total_incidents: data.collection?.total_incidents || 0,
                    resolved_incidents: data.collection?.resolved_incidents || 0,
                },
                treatment: {
                    total_influent: data.treatment?.total_influent || 0,
                    total_effluent: data.treatment?.total_effluent || 0,
                    avg_bod_removal: data.treatment?.avg_bod_removal || 0,
                    avg_tss_removal: data.treatment?.avg_tss_removal || 0,
                    avg_bod_removal_percent: data.treatment?.avg_bod_removal_percent || 0,
                    avg_tss_removal_percent: data.treatment?.avg_tss_removal_percent || 0,
                    days_with_alerts: data.treatment?.days_with_alerts || 0,
                },
                sludge: {
                    total_volume_m3: data.sludge?.total_volume_m3 || 0,
                    breakdown: {
                        residential: data.sludge?.breakdown?.residential || 0,
                        institutional: data.sludge?.breakdown?.institutional || 0,
                        commercial: data.sludge?.breakdown?.commercial || 0,
                    },
                    collections_count: data.sludge?.collections_count || 0,
                    active_exhausters: data.sludge?.active_exhausters || 0,
                }
            };

            setSummaryData(transformedData);
            setSelectedMonth(month);
            setSelectedYear(year);
            setSubmitStatus({ 
                type: 'success', 
                message: 'Monthly data loaded successfully!' 
            });
        } catch (error) {
            setError('Failed to load monthly summary data.');
            setSubmitStatus({ 
                type: 'error', 
                message: error.response?.data?.detail || 'Failed to fetch monthly data from server.' 
            });
        } finally {
            setIsFetching(false);
            setLoading(false);
        }
    };

    // Handle report generation (saving narrative)
    const handleGenerateReport = async (values, { setSubmitting, resetForm }) => {
        setSubmitStatus({ type: '', message: '' });
        
        if (!isOnline) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'You are offline. Please connect to the internet to generate reports.' 
            });
            setSubmitting(false);
            return;
        }
        
        try {
            // Combine the narrative with the fetched aggregates
            const payload = { 
                ...values, 
                ...summaryData,
                period: `${selectedYear}-${selectedMonth}`,
                generated_at: new Date().toISOString(),
                generated_by: 'Current User' // This would come from auth context
            };
            
            // Save the report to backend
            const response = await api.post('/api/monthly-summary/generate-report/', payload);
            
            setSubmitStatus({ 
                type: 'success', 
                message: 'Monthly report generated and saved successfully!' 
            });
            
            // Optionally reset form or keep values
            // resetForm();
        } catch (error) {
            setSubmitStatus({ 
                type: 'error', 
                message: error.response?.data?.detail || 'Failed to generate report.' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    // --- EXPORT TO CSV (Backend generated) ---
    const handleExportCSV = async () => {
        if (!selectedMonth || !selectedYear) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'Please fetch data for a month first.' 
            });
            return;
        }

        if (!isOnline) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'You are offline. Please connect to the internet to export CSV.' 
            });
            return;
        }

        setIsExporting(true);
        try {
            // Fetch the CSV as a blob from backend
            const response = await api.get(
                `/api/monthly-summary/?year=${selectedYear}&month=${selectedMonth}&export=csv`,
                { responseType: 'blob' }
            );
            
            // Create a temporary link to download the file
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `KICOWASCO_Summary_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            setSubmitStatus({ 
                type: 'success', 
                message: 'CSV exported successfully!' 
            });
        } catch (err) {
            console.error("CSV Export failed", err);
            setSubmitStatus({ 
                type: 'error', 
                message: 'Failed to export CSV. Please try again.' 
            });
        } finally {
            setIsExporting(false);
        }
    };

    // --- EXPORT TO PDF (Client-side generated) ---
    const handleExportPDF = () => {
        if (!selectedMonth || !selectedYear) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'Please fetch data for a month first.' 
            });
            return;
        }

        if (!summaryData || summaryData.sludge.total_volume_m3 === 0) {
            setSubmitStatus({ 
                type: 'error', 
                message: 'No data available to export. Please fetch data first.' 
            });
            return;
        }

        setIsExporting(true);
        try {
            const doc = new jsPDF();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[parseInt(selectedMonth) - 1];
            
            // Header with KICOWASCO branding
            doc.setFontSize(20);
            doc.setTextColor(26, 111, 176); // KICOWASCO Blue
            doc.text('KICOWASCO', 105, 20, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setTextColor(26, 111, 176);
            doc.text('Kirinyaga County Water & Sanitation PLC', 105, 28, { align: 'center' });
            
            doc.setFontSize(14);
            doc.setTextColor(50, 50, 50);
            doc.text(`Monthly Wastewater Summary: ${monthName} ${selectedYear}`, 105, 38, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 48);
            doc.text(`Generated by: Current User`, 14, 54);
            
            // Collection System Table
            doc.autoTable({
                startY: 60,
                head: [['Collection System Metrics', 'Value']],
                body: [
                    ['Inspection Incidences', summaryData.collection.inspection_incidences],
                    ['Spillage Incidences', summaryData.collection.spillage_incidences],
                    ['Repairs Completed', summaryData.collection.repairs_completed],
                    ['New Connections', summaryData.collection.new_connections],
                    ['Total Incidents Reported', summaryData.collection.total_incidents],
                    ['Resolved Incidents', summaryData.collection.resolved_incidents],
                ],
                theme: 'grid',
                headStyles: { fillColor: [26, 111, 176], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [240, 248, 255] },
            });

            // Treatment Plant Table
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Treatment Plant Performance', 'Value']],
                body: [
                    ['Total Influent (m³)', summaryData.treatment.total_influent.toFixed(2)],
                    ['Total Effluent (m³)', summaryData.treatment.total_effluent.toFixed(2)],
                    ['BOD Removal (%)', summaryData.treatment.avg_bod_removal_percent.toFixed(1) + '%'],
                    ['TSS Removal (%)', summaryData.treatment.avg_tss_removal_percent.toFixed(1) + '%'],
                    ['Days with Alerts', summaryData.treatment.days_with_alerts],
                ],
                theme: 'grid',
                headStyles: { fillColor: [26, 111, 176], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [240, 248, 255] },
            });

            // Sludge Management Table
            const totalVolume = summaryData.sludge.total_volume_m3;
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Sludge Collection Source', 'Volume (m³)', 'Percentage']],
                body: [
                    ['Residential', 
                     summaryData.sludge.breakdown.residential.toFixed(2), 
                     totalVolume > 0 ? `${((summaryData.sludge.breakdown.residential / totalVolume) * 100).toFixed(1)}%` : '0%'
                    ],
                    ['Institutional', 
                     summaryData.sludge.breakdown.institutional.toFixed(2), 
                     totalVolume > 0 ? `${((summaryData.sludge.breakdown.institutional / totalVolume) * 100).toFixed(1)}%` : '0%'
                    ],
                    ['Commercial/Industrial', 
                     summaryData.sludge.breakdown.commercial.toFixed(2), 
                     totalVolume > 0 ? `${((summaryData.sludge.breakdown.commercial / totalVolume) * 100).toFixed(1)}%` : '0%'
                    ],
                ],
                foot: [[
                    'Total Collected', 
                    totalVolume.toFixed(2), 
                    '100%'
                ]],
                theme: 'grid',
                headStyles: { fillColor: [26, 111, 176], textColor: [255, 255, 255] },
                footStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [240, 248, 255] },
            });

            // Add summary metrics
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Summary Metrics', 'Value']],
                body: [
                    ['Total Collections', summaryData.sludge.collections_count],
                    ['Active Exhausters', summaryData.sludge.active_exhausters],
                    ['Average Volume per Collection', 
                     summaryData.sludge.collections_count > 0 
                        ? (totalVolume / summaryData.sludge.collections_count).toFixed(2) + ' m³' 
                        : '0 m³'
                    ],
                ],
                theme: 'grid',
                headStyles: { fillColor: [26, 111, 176], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [240, 248, 255] },
            });

            // Footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    'Kirinyaga County Water & Sanitation PLC - Official Monthly Report', 
                    105, 
                    doc.internal.pageSize.height - 10, 
                    { align: 'center' }
                );
            }

            // Save the PDF
            doc.save(`KICOWASCO_Report_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.pdf`);
            
            setSubmitStatus({ 
                type: 'success', 
                message: 'PDF exported successfully!' 
            });
        } catch (err) {
            console.error("PDF Export failed", err);
            setSubmitStatus({ 
                type: 'error', 
                message: 'Failed to export PDF. Please try again.' 
            });
        } finally {
            setIsExporting(false);
        }
    };

    // Configure Chart Data
    const sludgeChartData = {
        labels: ['Residential', 'Institutional', 'Commercial/Industrial'],
        datasets: [
            {
                data: summaryData ? [
                    summaryData.sludge.breakdown.residential,
                    summaryData.sludge.breakdown.institutional,
                    summaryData.sludge.breakdown.commercial
                ] : [0, 0, 0],
                backgroundColor: ['#1a6fb0', '#2c9cd4', '#7fc1e8'],
                hoverBackgroundColor: ['#155d92', '#2383b5', '#6aa9d1'],
                borderWidth: 1,
            },
        ],
    };

    const treatmentChartData = {
        labels: ['BOD Removal', 'TSS Removal'],
        datasets: [
            {
                label: 'Removal Efficiency (%)',
                data: summaryData ? [
                    summaryData.treatment.avg_bod_removal_percent,
                    summaryData.treatment.avg_tss_removal_percent
                ] : [0, 0],
                backgroundColor: ['#1a6fb0', '#2c9cd4'],
                borderRadius: 6,
            },
        ],
    };

    return (
        <div className="form-section active">
            <h2 style={{ 
                color: '#1a6fb0', 
                marginBottom: '25px', 
                paddingBottom: '15px', 
                borderBottom: '2px solid #e0f0fa', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px' 
            }}>
                <i className="fas fa-chart-pie"></i> Monthly Summary Report
            </h2>

            {/* Offline indicator */}
            {!isOnline && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className="fas fa-wifi-slash" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                        <strong>You are currently offline.</strong> You can view previously loaded data but exports and report generation require an internet connection.
                    </div>
                </div>
            )}

            {submitStatus.message && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: submitStatus.type === 'success' ? '#d1fae5' : 
                                   submitStatus.type === 'error' ? '#fee2e2' : '#fff3cd',
                    color: submitStatus.type === 'success' ? '#065f46' : 
                           submitStatus.type === 'error' ? '#991b1b' : '#856404',
                    border: submitStatus.type === 'success' ? '1px solid #a7f3d0' : 
                           submitStatus.type === 'error' ? '1px solid #fecaca' : '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <i className={`fas ${
                        submitStatus.type === 'success' ? 'fa-check-circle' : 
                        submitStatus.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
                    }`} style={{ fontSize: '1.2rem' }}></i>
                    <div>{submitStatus.message}</div>
                </div>
            )}

            {error && (
                <div style={{
                    padding: '15px', 
                    marginBottom: '20px', 
                    borderRadius: '6px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fecaca'
                }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
                    {error}
                </div>
            )}

            <Formik
                initialValues={{ 
                    month: selectedMonth, 
                    year: selectedYear, 
                    performance_summary: '' 
                }}
                validationSchema={SummarySchema}
                onSubmit={handleGenerateReport}
                enableReinitialize
            >
                {({ values, isSubmitting, setFieldValue }) => (
                    <Form>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr auto', 
                            gap: '20px', 
                            marginBottom: '25px', 
                            alignItems: 'end' 
                        }}>
                            <div className="form-group">
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    Reporting Month <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <Field 
                                    as="select" 
                                    name="month" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        border: '1px solid #d1e5f1', 
                                        borderRadius: '6px', 
                                        background: 'white',
                                        fontSize: '14px'
                                    }}
                                    onChange={(e) => {
                                        setFieldValue('month', e.target.value);
                                        setMonth(parseInt(e.target.value));
                                    }}
                                >
                                    <option value="">Select Month...</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </Field>
                                <ErrorMessage name="month" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>
                            
                            <div className="form-group">
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    Year <span style={{ color: '#e11d48' }}>*</span>
                                </label>
                                <Field 
                                    type="number" 
                                    name="year" 
                                    min="2020"
                                    max="2030"
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        border: '1px solid #d1e5f1', 
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }} 
                                    onChange={(e) => {
                                        setFieldValue('year', e.target.value);
                                        setYear(parseInt(e.target.value));
                                    }}
                                />
                                <ErrorMessage name="year" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                            </div>

                            <button 
                                type="button"
                                onClick={() => fetchMonthlyData(values.month, values.year)}
                                disabled={!values.month || !values.year || isFetching || loading || !isOnline}
                                style={{ 
                                    background: '#2c9cd4', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '12px 25px', 
                                    borderRadius: '6px', 
                                    cursor: (!values.month || !values.year || isFetching || loading || !isOnline) ? 'not-allowed' : 'pointer', 
                                    fontWeight: '600', 
                                    height: '46px', 
                                    opacity: (!values.month || !values.year || isFetching || loading || !isOnline) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <i className={`fas ${isFetching || loading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                                {isFetching || loading ? 'Loading...' : 'Fetch Data'}
                            </button>
                        </div>

                        {loading && (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <i className="fas fa-spinner fa-spin" style={{ color: '#1a6fb0', fontSize: '2rem' }}></i>
                                <p>Loading dashboard data...</p>
                            </div>
                        )}

                        {summaryData && !loading && summaryData.sludge.total_volume_m3 > 0 && (
                            <>
                                {/* KPI Cards */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', 
                                    gap: '20px', 
                                    marginBottom: '30px' 
                                }}>
                                    <div style={{ 
                                        background: '#f8f9fa', 
                                        padding: '20px', 
                                        borderRadius: '8px', 
                                        borderLeft: '5px solid #e74c3c',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}>
                                        <h4 style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>Total Incidents</h4>
                                        <h2 style={{ margin: '10px 0 0', color: '#2c3e50', fontSize: '2rem' }}>
                                            {summaryData.collection.total_incidents}
                                        </h2>
                                    </div>
                                    <div style={{ 
                                        background: '#f8f9fa', 
                                        padding: '20px', 
                                        borderRadius: '8px', 
                                        borderLeft: '5px solid #2ecc71',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}>
                                        <h4 style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>Repairs Completed</h4>
                                        <h2 style={{ margin: '10px 0 0', color: '#2c3e50', fontSize: '2rem' }}>
                                            {summaryData.collection.repairs_completed}
                                        </h2>
                                    </div>
                                    <div style={{ 
                                        background: '#f8f9fa', 
                                        padding: '20px', 
                                        borderRadius: '8px', 
                                        borderLeft: '5px solid #3498db',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}>
                                        <h4 style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>Avg. BOD Removal</h4>
                                        <h2 style={{ margin: '10px 0 0', color: '#2c3e50', fontSize: '2rem' }}>
                                            {summaryData.treatment.avg_bod_removal_percent}%
                                        </h2>
                                    </div>
                                </div>

                                {/* Charts Area */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr 1fr', 
                                    gap: '20px', 
                                    marginBottom: '30px' 
                                }}>
                                    <div style={{ 
                                        background: 'white', 
                                        padding: '20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #eef5fb',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: '20px', 
                                            color: '#1a6fb0',
                                            fontSize: '1.1rem',
                                            borderBottom: '1px solid #eef5fb',
                                            paddingBottom: '10px'
                                        }}>
                                            <i className="fas fa-chart-pie" style={{ marginRight: '8px' }}></i>
                                            Sludge Collection Sources
                                        </h3>
                                        <div style={{ maxWidth: '300px', margin: '0 auto', height: '250px' }}>
                                            <Pie data={sludgeChartData} options={{
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                    legend: {
                                                        position: 'bottom',
                                                    },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: (context) => {
                                                                const label = context.label || '';
                                                                const value = context.raw || 0;
                                                                const total = summaryData.sludge.total_volume_m3;
                                                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                                                return `${label}: ${value.toFixed(2)} m³ (${percentage}%)`;
                                                            }
                                                        }
                                                    }
                                                }
                                            }} />
                                        </div>
                                        <p style={{ 
                                            textAlign: 'center', 
                                            marginTop: '15px', 
                                            fontWeight: 'bold',
                                            color: '#2c3e50'
                                        }}>
                                            Total Volume: {summaryData.sludge.total_volume_m3.toFixed(2)} m³
                                        </p>
                                    </div>
                                    
                                    <div style={{ 
                                        background: 'white', 
                                        padding: '20px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #eef5fb',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: '20px', 
                                            color: '#1a6fb0',
                                            fontSize: '1.1rem',
                                            borderBottom: '1px solid #eef5fb',
                                            paddingBottom: '10px'
                                        }}>
                                            <i className="fas fa-chart-bar" style={{ marginRight: '8px' }}></i>
                                            Treatment Performance
                                        </h3>
                                        <div style={{ height: '250px' }}>
                                            <Bar 
                                                data={treatmentChartData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        y: {
                                                            beginAtZero: true,
                                                            max: 100,
                                                            title: {
                                                                display: true,
                                                                text: 'Removal Efficiency (%)'
                                                            }
                                                        }
                                                    },
                                                    plugins: {
                                                        legend: {
                                                            display: false,
                                                        },
                                                        tooltip: {
                                                            callbacks: {
                                                                label: (context) => {
                                                                    return `${context.raw.toFixed(1)}% removal`;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Aggregated Data Sections (Read Only) */}
                        <div style={{ opacity: isFetching ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                            <h3 style={{ 
                                margin: '20px 0 15px', 
                                color: '#1a6fb0', 
                                fontSize: '1.2rem', 
                                borderBottom: '1px solid #eef5fb', 
                                paddingBottom: '8px' 
                            }}>
                                <i className="fas fa-map-marked-alt" style={{ marginRight: '8px' }}></i>
                                Collection System
                            </h3>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(4, 1fr)', 
                                gap: '15px', 
                                marginBottom: '20px' 
                            }}>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Inspection Incidences</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.collection.inspection_incidences}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Spillage Incidences</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.collection.spillage_incidences}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Repairs Completed</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.collection.repairs_completed}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>New Connections</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.collection.new_connections}</div>
                                </div>
                            </div>

                            <h3 style={{ 
                                margin: '20px 0 15px', 
                                color: '#1a6fb0', 
                                fontSize: '1.2rem', 
                                borderBottom: '1px solid #eef5fb', 
                                paddingBottom: '8px' 
                            }}>
                                <i className="fas fa-water" style={{ marginRight: '8px' }}></i>
                                Treatment Plant
                            </h3>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(4, 1fr)', 
                                gap: '15px', 
                                marginBottom: '20px' 
                            }}>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Total Influent (m³)</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.treatment.total_influent.toFixed(1)}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Total Effluent (m³)</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.treatment.total_effluent.toFixed(1)}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Avg BOD Removal (%)</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.treatment.avg_bod_removal_percent.toFixed(1)}%</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Avg TSS Removal (%)</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.treatment.avg_tss_removal_percent.toFixed(1)}%</div>
                                </div>
                            </div>

                            <h3 style={{ 
                                margin: '20px 0 15px', 
                                color: '#1a6fb0', 
                                fontSize: '1.2rem', 
                                borderBottom: '1px solid #eef5fb', 
                                paddingBottom: '8px' 
                            }}>
                                <i className="fas fa-truck" style={{ marginRight: '8px' }}></i>
                                Sludge Management
                            </h3>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(4, 1fr)', 
                                gap: '15px', 
                                marginBottom: '25px' 
                            }}>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Total Volume (m³)</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.sludge.total_volume_m3.toFixed(1)}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Residential</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.sludge.breakdown.residential.toFixed(1)}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Institutional</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.sludge.breakdown.institutional.toFixed(1)}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#555', display: 'block', marginBottom: '5px' }}>Commercial</label>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a6fb0' }}>{summaryData.sludge.breakdown.commercial.toFixed(1)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '8px', 
                                fontWeight: '600',
                                color: '#2c3e50'
                            }}>
                                Monthly Performance Summary <span style={{ color: '#e11d48' }}>*</span>
                            </label>
                            <Field 
                                as="textarea" 
                                name="performance_summary" 
                                placeholder="Key achievements, challenges, recommendations for the month..."
                                style={{ 
                                    width: '100%', 
                                    padding: '12px', 
                                    border: '1px solid #d1e5f1', 
                                    borderRadius: '6px', 
                                    minHeight: '120px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit'
                                }} 
                            />
                            <ErrorMessage name="performance_summary" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
                        </div>

                        <div className="signature-area" style={{ 
                            display: 'flex', 
                            gap: '20px', 
                            marginTop: '30px', 
                            paddingTop: '20px', 
                            borderTop: '1px dashed #d1e5f1',
                            marginBottom: '25px'
                        }}>
                            <div className="signature-box" style={{ flex: 1 }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontWeight: '600',
                                    color: '#2c3e50'
                                }}>
                                    <i className="fas fa-user" style={{ marginRight: '8px', color: '#1a6fb0' }}></i>
                                    Prepared By
                                </label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value="Current User" // This would come from auth context
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        background: '#e5e7eb', 
                                        border: '1px solid #d1e5f1', 
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        color: '#2c3e50'
                                    }} 
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || summaryData.sludge.total_volume_m3 === 0 || !isOnline}
                                style={{ 
                                    background: '#1a6fb0', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '12px 25px', 
                                    borderRadius: '6px', 
                                    cursor: (isSubmitting || summaryData.sludge.total_volume_m3 === 0 || !isOnline) ? 'not-allowed' : 'pointer', 
                                    fontSize: '15px', 
                                    fontWeight: '600',
                                    opacity: (isSubmitting || summaryData.sludge.total_volume_m3 === 0 || !isOnline) ? 0.7 : 1,
                                    transition: 'background 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSubmitting && summaryData.sludge.total_volume_m3 > 0 && isOnline) {
                                        e.target.style.background = '#155d92';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSubmitting && summaryData.sludge.total_volume_m3 > 0 && isOnline) {
                                        e.target.style.background = '#1a6fb0';
                                    }
                                }}
                            >
                                <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                                {isSubmitting ? 'Generating...' : 'Generate Monthly Report'}
                            </button>

                            <button 
                                type="button"
                                onClick={handleExportCSV}
                                disabled={isExporting || summaryData.sludge.total_volume_m3 === 0 || !isOnline}
                                style={{ 
                                    background: '#27ae60', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '12px 25px', 
                                    borderRadius: '6px', 
                                    cursor: (isExporting || summaryData.sludge.total_volume_m3 === 0 || !isOnline) ? 'not-allowed' : 'pointer', 
                                    fontSize: '15px', 
                                    fontWeight: '600',
                                    opacity: (isExporting || summaryData.sludge.total_volume_m3 === 0 || !isOnline) ? 0.7 : 1,
                                    transition: 'background 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isExporting && summaryData.sludge.total_volume_m3 > 0 && isOnline) {
                                        e.target.style.background = '#219a52';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isExporting && summaryData.sludge.total_volume_m3 > 0 && isOnline) {
                                        e.target.style.background = '#27ae60';
                                    }
                                }}
                            >
                                <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-csv'}`}></i>
                                {isExporting ? 'Exporting...' : 'Export CSV'}
                            </button>

                            <button 
                                type="button"
                                onClick={handleExportPDF}
                                disabled={isExporting || summaryData.sludge.total_volume_m3 === 0}
                                style={{ 
                                    background: '#c0392b', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '12px 25px', 
                                    borderRadius: '6px', 
                                    cursor: (isExporting || summaryData.sludge.total_volume_m3 === 0) ? 'not-allowed' : 'pointer', 
                                    fontSize: '15px', 
                                    fontWeight: '600',
                                    opacity: (isExporting || summaryData.sludge.total_volume_m3 === 0) ? 0.7 : 1,
                                    transition: 'background 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isExporting && summaryData.sludge.total_volume_m3 > 0) {
                                        e.target.style.background = '#a03224';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isExporting && summaryData.sludge.total_volume_m3 > 0) {
                                        e.target.style.background = '#c0392b';
                                    }
                                }}
                            >
                                <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                                {isExporting ? 'Exporting...' : 'Download PDF'}
                            </button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default MonthlySummary;