import React, { useContext, useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const ProfileNew = () => {
    const { user } = useContext(AuthContext);
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editingAccount, setEditingAccount] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [teamData, setTeamData] = useState([]);
    const [stats, setStats] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Load profile data
    useEffect(() => {
        if (user?.id) {
            loadProfileData();
            loadStats();
        }
    }, [user?.id]);

    const loadProfileData = async () => {
        try {
            const response = await api.get(`/api/users/${user.id}/`);
            setProfileData(response.data);
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    };

    const loadStats = async () => {
        try {
            if (user?.role === 'line_attendant') {
                // Load attendant stats
                const [activeResponse, awaitingResponse, completedResponse] = await Promise.all([
                    api.get(`/api/incidents/?assigned_to=${user.id}&status=assigned`),
                    api.get(`/api/incidents/?assigned_to=${user.id}&status=pending_certification`),
                    api.get(`/api/incidents/?assigned_to=${user.id}&status=closed`),
                ]);

                const activeCount = Array.isArray(activeResponse.data) ? activeResponse.data.length : (activeResponse.data?.results?.length || 0);
                const awaitingCount = Array.isArray(awaitingResponse.data) ? awaitingResponse.data.length : (awaitingResponse.data?.results?.length || 0);
                const closedList = Array.isArray(completedResponse.data) ? completedResponse.data : (completedResponse.data?.results || []);

                // Filter last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const completedCount = closedList.filter(
                    (incident) => new Date(incident.completed_at) >= thirtyDaysAgo
                ).length;

                // Calculate average resolution time (in days)
                const resolutionTimes = closedList
                    .filter((incident) => incident.completed_at && incident.created_at)
                    .map((incident) => {
                        const created = new Date(incident.created_at);
                        const completed = new Date(incident.completed_at);
                        return (completed - created) / (1000 * 60 * 60 * 24); // Convert to days
                    });
                const avgResolutionTime = resolutionTimes.length > 0
                    ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1)
                    : 0;

                // Recent activity (last 5 incidents)
                const recentActivity = closedList.slice(0, 5);

                setStats({
                    activeTasks: activeCount,
                    awaitingCert: awaitingCount,
                    completedThirtyDays: completedCount,
                    avgResolutionTime,
                    recentActivity,
                });
            } else if (user?.role === 'line_supervisor') {
                // Load team data
                const teamsResponse = await api.get('/api/users/?role=line_attendant');
                const teamList = Array.isArray(teamsResponse.data) ? teamsResponse.data : (teamsResponse.data?.results || []);

                // For each team member, load their incident stats
                const enrichedTeam = await Promise.all(
                    teamList.map(async (member) => {
                        try {
                            const [assigned, completed] = await Promise.all([
                                api.get(`/api/incidents/?assigned_to=${member.id}&status=assigned`),
                                api.get(`/api/incidents/?assigned_to=${member.id}&status=closed`),
                            ]);

                            const assignedCount = Array.isArray(assigned.data) ? assigned.data.length : (assigned.data?.results?.length || 0);
                            const closedList = Array.isArray(completed.data) ? completed.data : (completed.data?.results || []);

                            // Calculate avg resolution time
                            const resolutionTimes = closedList
                                .filter((incident) => incident.completed_at && incident.created_at)
                                .map((incident) => {
                                    const created = new Date(incident.created_at);
                                    const comp = new Date(incident.completed_at);
                                    return (comp - created) / (1000 * 60 * 60 * 24);
                                });
                            const avgTime = resolutionTimes.length > 0
                                ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1)
                                : 0;

                            return {
                                ...member,
                                assigned_task_count: assignedCount,
                                completed_count: closedList.length,
                                avg_resolution_time: avgTime,
                            };
                        } catch (error) {
                            console.error(`Failed to load stats for ${member.id}:`, error);
                            return member;
                        }
                    })
                );

                setTeamData(enrichedTeam);

                // Load supervisor overview stats
                const [unassigned, inProgress, pendingCert, closed] = await Promise.all([
                    api.get('/api/incidents/?status=new'),
                    api.get('/api/incidents/?status=assigned'),
                    api.get('/api/incidents/?status=pending_certification'),
                    api.get('/api/incidents/?status=closed'),
                ]);

                setStats({
                    unassignedCount: Array.isArray(unassigned.data) ? unassigned.data.length : (unassigned.data?.results?.length || 0),
                    inProgressCount: Array.isArray(inProgress.data) ? inProgress.data.length : (inProgress.data?.results?.length || 0),
                    pendingCertCount: Array.isArray(pendingCert.data) ? pendingCert.data.length : (pendingCert.data?.results?.length || 0),
                    totalCompleted: Array.isArray(closed.data) ? closed.data.length : (closed.data?.results?.length || 0),
                });
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const handleUpdateProfile = async (values) => {
        try {
            await api.patch(`/api/users/${user.id}/`, {
                phone_number: values.phone,
                email: values.email,
            });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setEditingAccount(false);
            loadProfileData();
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        }
    };

    const handleChangePassword = async (values) => {
        try {
            await api.post('/api/change-password/', {
                old_password: values.oldPassword,
                new_password: values.newPassword,
            });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setChangingPassword(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to change password. Please check your old password.' });
        }
    };

    if (!profileData && !user?.id) {
        return <div style={{ textAlign: 'center', padding: '40px' }}>Loading profile...</div>;
    }

    // Line Attendant Profile
    if (user?.role === 'line_attendant') {
        return <LineAttendantProfile user={user} stats={stats} profileData={profileData} editingAccount={editingAccount} setEditingAccount={setEditingAccount} changingPassword={changingPassword} setChangingPassword={setChangingPassword} message={message} setMessage={setMessage} onUpdateProfile={handleUpdateProfile} onChangePassword={handleChangePassword} />;
    }

    // Line Supervisor Profile
    if (user?.role === 'line_supervisor') {
        return <LineSupervisorProfile user={user} stats={stats} teamData={teamData} profileData={profileData} editingAccount={editingAccount} setEditingAccount={setEditingAccount} changingPassword={changingPassword} setChangingPassword={setChangingPassword} message={message} setMessage={setMessage} onUpdateProfile={handleUpdateProfile} onChangePassword={handleChangePassword} />;
    }

    // Default fallback
    return <DefaultProfile user={user} profileData={profileData} editingAccount={editingAccount} setEditingAccount={setEditingAccount} changingPassword={changingPassword} setChangingPassword={setChangingPassword} message={message} setMessage={setMessage} onUpdateProfile={handleUpdateProfile} onChangePassword={handleChangePassword} />;
};

// Line Attendant Profile Component
const LineAttendantProfile = ({
    user,
    stats,
    profileData,
    editingAccount,
    setEditingAccount,
    changingPassword,
    setChangingPassword,
    message,
    setMessage,
    onUpdateProfile,
    onChangePassword,
}) => {
    const accountSchema = Yup.object().shape({
        phone: Yup.string().required('Phone number is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
    });

    const passwordSchema = Yup.object().shape({
        oldPassword: Yup.string().required('Current password is required'),
        newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
        confirmPassword: Yup.string()
            .oneOf([Yup.ref('newPassword')], 'Passwords must match')
            .required('Confirm password is required'),
    });

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            {/* Message Display */}
            {message.text && (
                <div
                    style={{
                        padding: '12px 16px',
                        marginBottom: '20px',
                        borderRadius: '6px',
                        background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
                        color: message.type === 'success' ? '#065f46' : '#7f1d1d',
                        border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
                    }}
                >
                    <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`} style={{ marginRight: '8px' }}></i>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {/* Identity Card */}
                <div style={{ background: 'linear-gradient(135deg, #1a6fb0 0%, #0f5a9e 100%)', color: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '20px', alignItems: 'center' }}>
                        <div style={{ width: '120px', height: '120px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fas fa-user" style={{ fontSize: '3rem', color: 'white', opacity: 0.8 }}></i>
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem' }}>{user?.full_name || 'Unknown'}</h2>
                            <div style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
                                <strong>Role:</strong> Line Attendant
                            </div>
                            <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
                                <div style={{ marginBottom: '6px' }}>
                                    <strong>Employee ID:</strong> {user?.id}
                                </div>
                                <div style={{ marginBottom: '6px' }}>
                                    <strong>Zones:</strong> {user?.assigned_zones?.length > 0 ? user.assigned_zones.join(', ') : 'Not assigned'}
                                </div>
                                <div>
                                    <strong>Supervisor:</strong> TBD
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Tiles */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                        <PerformanceTile label="Active Tasks" value={stats.activeTasks} icon="fa-circle-play" color="#3B82F6" />
                        <PerformanceTile label="Awaiting Cert" value={stats.awaitingCert} icon="fa-clipboard-check" color="#8B5CF6" />
                        <PerformanceTile label="Completed (30d)" value={stats.completedThirtyDays} icon="fa-check-circle" color="#10B981" />
                        <PerformanceTile label="Avg Resolution" value={`${stats.avgResolutionTime}d`} icon="fa-hourglass-end" color="#F59E0B" />
                    </div>
                )}

                {/* Recent Activity */}
                {stats?.recentActivity && (
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                        <h3 style={{ color: '#1a6fb0', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                            <i className="fas fa-history" style={{ marginRight: '8px' }}></i>Recent Activity (Last 5 Completed)
                        </h3>
                        {stats.recentActivity.length > 0 ? (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {stats.recentActivity.map((incident) => (
                                    <div
                                        key={incident.id}
                                        style={{
                                            padding: '12px',
                                            background: '#f8fafc',
                                            borderRadius: '6px',
                                            borderLeft: '4px solid #1a6fb0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{incident.incident_number}</div>
                                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{incident.category}</div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {incident.completed_at ? new Date(incident.completed_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No recent activity</div>
                        )}
                    </div>
                )}

                {/* Account Section */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <h3 style={{ color: '#1a6fb0', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                        <i className="fas fa-gear" style={{ marginRight: '8px' }}></i>Account Settings
                    </h3>

                    {/* Edit Account */}
                    {!editingAccount && !changingPassword && (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>Phone Number</div>
                                    <div style={{ fontSize: '0.95rem', color: '#64748b' }}>{profileData?.phone_number || 'Not provided'}</div>
                                </div>
                                <button
                                    onClick={() => setEditingAccount(true)}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Edit
                                </button>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>Email Address</div>
                                    <div style={{ fontSize: '0.95rem', color: '#64748b' }}>{profileData?.email || 'Not provided'}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setChangingPassword(true)}
                                style={{
                                    padding: '10px',
                                    background: '#f97316',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    marginTop: '12px',
                                }}
                            >
                                <i className="fas fa-lock" style={{ marginRight: '6px' }}></i>Change Password
                            </button>
                        </div>
                    )}

                    {/* Edit Account Form */}
                    {editingAccount && (
                        <Formik
                            initialValues={{
                                phone: profileData?.phone_number || '',
                                email: profileData?.email || '',
                            }}
                            validationSchema={accountSchema}
                            onSubmit={(values) => onUpdateProfile(values)}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Phone Number</label>
                                        <Field
                                            type="tel"
                                            name="phone"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="phone" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Email Address</label>
                                        <Field
                                            type="email"
                                            name="email"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="email" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setEditingAccount(false)}
                                            style={{
                                                padding: '10px',
                                                background: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '10px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                fontWeight: 600,
                                                opacity: isSubmitting ? 0.7 : 1,
                                            }}
                                        >
                                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    )}

                    {/* Change Password Form */}
                    {changingPassword && (
                        <Formik
                            initialValues={{
                                oldPassword: '',
                                newPassword: '',
                                confirmPassword: '',
                            }}
                            validationSchema={passwordSchema}
                            onSubmit={(values) => onChangePassword(values)}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Current Password</label>
                                        <Field
                                            type="password"
                                            name="oldPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="oldPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>New Password</label>
                                        <Field
                                            type="password"
                                            name="newPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="newPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Confirm Password</label>
                                        <Field
                                            type="password"
                                            name="confirmPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="confirmPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setChangingPassword(false)}
                                            style={{
                                                padding: '10px',
                                                background: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '10px',
                                                background: '#f97316',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                fontWeight: 600,
                                                opacity: isSubmitting ? 0.7 : 1,
                                            }}
                                        >
                                            {isSubmitting ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    )}
                </div>
            </div>
        </div>
    );
};

// Line Supervisor Profile Component
const LineSupervisorProfile = ({
    user,
    stats,
    teamData,
    profileData,
    editingAccount,
    setEditingAccount,
    changingPassword,
    setChangingPassword,
    message,
    setMessage,
    onUpdateProfile,
    onChangePassword,
}) => {
    const accountSchema = Yup.object().shape({
        phone: Yup.string().required('Phone number is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
    });

    const passwordSchema = Yup.object().shape({
        oldPassword: Yup.string().required('Current password is required'),
        newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
        confirmPassword: Yup.string()
            .oneOf([Yup.ref('newPassword')], 'Passwords must match')
            .required('Confirm password is required'),
    });

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            {/* Message Display */}
            {message.text && (
                <div
                    style={{
                        padding: '12px 16px',
                        marginBottom: '20px',
                        borderRadius: '6px',
                        background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
                        color: message.type === 'success' ? '#065f46' : '#7f1d1d',
                        border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
                    }}
                >
                    <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`} style={{ marginRight: '8px' }}></i>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {/* Header */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <h2 style={{ color: '#1a6fb0', marginBottom: '12px' }}>
                        <i className="fas fa-user-tie" style={{ marginRight: '8px' }}></i>
                        {user?.full_name}
                    </h2>
                    <div style={{ fontSize: '0.95rem', color: '#64748b' }}>
                        <strong>Role:</strong> Line Supervisor | <strong>ID:</strong> {user?.id}
                    </div>
                </div>

                {/* Team Overview Stats */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                        <PerformanceTile label="Unassigned" value={stats.unassignedCount} icon="fa-inbox" color="#6B7280" />
                        <PerformanceTile label="In Progress" value={stats.inProgressCount} icon="fa-hourglass-half" color="#3B82F6" />
                        <PerformanceTile label="Pending Cert" value={stats.pendingCertCount} icon="fa-clipboard-check" color="#8B5CF6" />
                        <PerformanceTile label="Total Completed" value={stats.totalCompleted} icon="fa-check-circle" color="#10B981" />
                    </div>
                )}

                {/* My Team */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <h3 style={{ color: '#1a6fb0', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                        <i className="fas fa-people-group" style={{ marginRight: '8px' }}></i>My Team ({teamData.length} members)
                    </h3>

                    {teamData.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#0f172a' }}>Name</th>
                                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#0f172a' }}>Assigned Tasks</th>
                                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#0f172a' }}>Completed (Total)</th>
                                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#0f172a' }}>Avg Resolution Time</th>
                                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#0f172a' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamData.map((member) => (
                                        <tr key={member.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px', color: '#0f172a' }}>{member.full_name}</td>
                                            <td style={{ padding: '12px', color: '#64748b' }}>
                                                {member.assigned_task_count || 0}
                                                {member.assigned_task_count > 0 && (
                                                    <span
                                                        style={{
                                                            marginLeft: '6px',
                                                            display: 'inline-block',
                                                            padding: '2px 6px',
                                                            background: '#fee2e2',
                                                            color: '#7f1d1d',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {member.assigned_task_count} active
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', color: '#64748b' }}>{member.completed_count || 0}</td>
                                            <td style={{ padding: '12px', color: '#64748b' }}>{member.avg_resolution_time || 'N/A'} days</td>
                                            <td style={{ padding: '12px' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        background: member.assigned_task_count > 0 ? '#fef3c7' : '#d1fae5',
                                                        color: member.assigned_task_count > 0 ? '#92400e' : '#065f46',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {member.assigned_task_count > 0 ? 'Busy' : 'Available'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }}></i>
                            No team members assigned yet
                        </div>
                    )}
                </div>

                {/* Account Section */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <h3 style={{ color: '#1a6fb0', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                        <i className="fas fa-gear" style={{ marginRight: '8px' }}></i>Account Settings
                    </h3>

                    {!editingAccount && !changingPassword && (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>Phone Number</div>
                                    <div style={{ fontSize: '0.95rem', color: '#64748b' }}>{profileData?.phone_number || 'Not provided'}</div>
                                </div>
                                <button
                                    onClick={() => setEditingAccount(true)}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Edit
                                </button>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>Email Address</div>
                                    <div style={{ fontSize: '0.95rem', color: '#64748b' }}>{profileData?.email || 'Not provided'}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setChangingPassword(true)}
                                style={{
                                    padding: '10px',
                                    background: '#f97316',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    marginTop: '12px',
                                }}
                            >
                                <i className="fas fa-lock" style={{ marginRight: '6px' }}></i>Change Password
                            </button>
                        </div>
                    )}

                    {editingAccount && (
                        <Formik
                            initialValues={{
                                phone: profileData?.phone_number || '',
                                email: profileData?.email || '',
                            }}
                            validationSchema={accountSchema}
                            onSubmit={(values) => onUpdateProfile(values)}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Phone Number</label>
                                        <Field
                                            type="tel"
                                            name="phone"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="phone" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Email Address</label>
                                        <Field
                                            type="email"
                                            name="email"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="email" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setEditingAccount(false)}
                                            style={{
                                                padding: '10px',
                                                background: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '10px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                fontWeight: 600,
                                                opacity: isSubmitting ? 0.7 : 1,
                                            }}
                                        >
                                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    )}

                    {changingPassword && (
                        <Formik
                            initialValues={{
                                oldPassword: '',
                                newPassword: '',
                                confirmPassword: '',
                            }}
                            validationSchema={passwordSchema}
                            onSubmit={(values) => onChangePassword(values)}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Current Password</label>
                                        <Field
                                            type="password"
                                            name="oldPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="oldPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>New Password</label>
                                        <Field
                                            type="password"
                                            name="newPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="newPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Confirm Password</label>
                                        <Field
                                            type="password"
                                            name="confirmPassword"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                            }}
                                        />
                                        <ErrorMessage name="confirmPassword" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setChangingPassword(false)}
                                            style={{
                                                padding: '10px',
                                                background: '#f3f4f6',
                                                color: '#374151',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '10px',
                                                background: '#f97316',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                fontWeight: 600,
                                                opacity: isSubmitting ? 0.7 : 1,
                                            }}
                                        >
                                            {isSubmitting ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    )}
                </div>
            </div>
        </div>
    );
};

// Performance Tile Component
const PerformanceTile = ({ label, value, icon, color }) => {
    return (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color, marginBottom: '8px' }}>
                <i className={`fas ${icon}`}></i>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{label}</div>
        </div>
    );
};

// Default Profile Component (for other roles)
const DefaultProfile = ({
    user,
    profileData,
    editingAccount,
    setEditingAccount,
    changingPassword,
    setChangingPassword,
    message,
    setMessage,
    onUpdateProfile,
    onChangePassword,
}) => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                <h2 style={{ color: '#1a6fb0', marginBottom: '16px' }}>
                    <i className="fas fa-user" style={{ marginRight: '8px' }}></i>
                    {user?.full_name}
                </h2>
                <div style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '6px' }}>
                        <strong>Role:</strong> {user?.role}
                    </div>
                    <div>
                        <strong>Email:</strong> {profileData?.email || 'Not provided'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileNew;
