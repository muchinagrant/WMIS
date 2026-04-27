import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '../context/AuthContext';
import api from '../api/axios';

const Profile = () => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState({
        active: 0,
        pendingReview: 0,
        completed: 0
    });
    const [loading, setLoading] = useState(true);

    const isSupervisor = ['admin', 'superintendent', 'supervisor'].includes(user?.role);

    useEffect(() => {
        const fetchUserStats = async () => {
            try {
                const res = await api.get('/api/incidents/');
                const incidents = res.data.results || res.data;

                let myIncidents = incidents;

                // If they are a technician, only calculate stats for tasks assigned to them
                if (!isSupervisor) {
                    myIncidents = incidents.filter(inc => inc.assigned_to === user?.user_id);
                }

                // Calculate KPI buckets based on the state machine
                const activeCount = myIncidents.filter(inc => ['new', 'assigned', 'in_progress', 'on_hold_materials', 'on_hold_equipment'].includes(inc.status)).length;
                const pendingCount = myIncidents.filter(inc => inc.status === 'pending_certification').length;
                const completedCount = myIncidents.filter(inc => ['resolved', 'closed'].includes(inc.status)).length;

                setStats({ active: activeCount, pendingReview: pendingCount, completed: completedCount });
            } catch (error) {
                console.error('Failed to load profile stats', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchUserStats();
        }
    }, [user, isSupervisor]);

    // Format the role for display
    const formatRole = (roleStr) => {
        if (!roleStr) return 'Staff';
        const roles = {
            superintendent: 'Superintendent (Grade 3)',
            supervisor: 'Supervisor (Grade 4)',
            lab_tech: 'Lab Technologist (Grade 4)',
            operator: 'Operator (Grade 5)',
            attendant: 'Attendant / Plumber (Grade 6)',
            admin: 'System Administrator'
        };
        return roles[roleStr] || roleStr.replace('_', ' ').toUpperCase();
    };

    return (
        <div className="form-section active" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-id-badge"></i> My Digital Profile
            </h2>

            {/* IDENTITY CARD */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '30px', display: 'flex', alignItems: 'center', gap: '25px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #eef5fb', marginBottom: '30px' }}>
                <div style={{ background: '#e0f2fe', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', fontSize: '2rem' }}>
                    <i className="fas fa-user-circle"></i>
                </div>
                <div>
                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', textTransform: 'capitalize' }}>{user?.username || 'System User'}</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-briefcase"></i> {formatRole(user?.role)}
                    </p>
                </div>
            </div>

            {/* PERFORMANCE KPIs */}
            <h3 style={{ color: '#334155', marginBottom: '15px', fontSize: '1.2rem' }}>
                <i className="fas fa-chart-line"></i> {isSupervisor ? 'Team Overview' : 'My Performance Tracker'}
            </h3>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><i className="fas fa-spinner fa-spin"></i> Loading stats...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {isSupervisor ? 'Total Active / Unassigned' : 'My Active Tasks'}
                        </p>
                        <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '2rem' }}>{stats.active}</h2>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {isSupervisor ? 'Pending My Certification' : 'Awaiting Certification'}
                        </p>
                        <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '2rem' }}>{stats.pendingReview}</h2>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #10b981', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {isSupervisor ? 'Team Completed Tasks' : 'My Completed Tasks'}
                        </p>
                        <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '2rem' }}>{stats.completed}</h2>
                    </div>
                </div>
            )}

            {/* RELOCATED OFFICIAL BRANDING */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '25px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                <img src="/logo512.png" alt="KICOWASCO Logo" style={{ width: '80px', height: '80px', marginBottom: '15px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                <h3 style={{ color: '#1a6fb0', margin: '0 0 10px 0', fontSize: '1.3rem' }}>KIRINYAGA COUNTY WATER & SANITATION PLC</h3>
                <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.8' }}>
                    <p style={{ margin: 0 }}><i className="fas fa-map-marker-alt" style={{ width: '20px' }}></i> P.O BOX 360-10300, KERUGOYA</p>
                    <p style={{ margin: 0 }}><i className="fas fa-phone-alt" style={{ width: '20px' }}></i> Official Tel: 0746555368 | Customer Care: 0715413591</p>
                    <p style={{ margin: 0 }}><i className="fas fa-envelope" style={{ width: '20px' }}></i> managingdirector@kicowasco.co.ke | info@kicowasco.co.ke</p>
                    <p style={{ margin: 0 }}><i className="fas fa-globe" style={{ width: '20px' }}></i> www.kicowasco.co.ke</p>
                </div>
            </div>
        </div>
    );
};

export default Profile;
