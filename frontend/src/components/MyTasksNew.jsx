import React, { useContext, useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const MyTasksNew = () => {
    const [activeTab, setActiveTab] = useState('active');
    const [tasks, setTasks] = useState({
        active: [],
        awaiting_certification: [],
        history: [],
    });
    const [loading, setLoading] = useState(false);
    const [workingOnTask, setWorkingOnTask] = useState(null);
    const [completingTask, setCompletingTask] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useContext(AuthContext);

    const priorityColors = {
        high: '#DC2626',
        medium: '#CA8A04',
        low: '#16A34A',
    };

    const statusBadgeColors = {
        assigned: '#3B82F6',
        in_progress: '#F59E0B',
        pending_certification: '#8B5CF6',
        closed: '#10B981',
    };

    // Load user's tasks
    useEffect(() => {
        loadTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const loadTasks = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [myTasksResponse, historyResponse] = await Promise.all([
                api.get('/api/incidents/my_tasks/'),
                api.get(`/api/incidents/?assigned_to=${user.id}&status=closed`),
            ]);

            const myTasksList = Array.isArray(myTasksResponse.data) ? myTasksResponse.data : (myTasksResponse.data?.results || []);
            const assignedList = myTasksList.filter((t) => t.status === 'assigned');
            const inProgressList = myTasksList.filter((t) => t.status === 'in_progress');
            const certificationList = myTasksList.filter((t) => t.status === 'pending_certification' || t.status === 'completed');
            const historyList = Array.isArray(historyResponse.data) ? historyResponse.data : (historyResponse.data?.results || []);

            setTasks({
                active: [...assignedList, ...inProgressList],
                awaiting_certification: certificationList,
                history: historyList,
            });

            // Calculate unread count (active + awaiting cert)
            setUnreadCount(assignedList.length + inProgressList.length + certificationList.length);
        } catch (error) {
            console.error('Failed to load tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartWork = async (taskId) => {
        try {
            await api.patch(`/api/incidents/${taskId}/`, {
                status: 'in_progress',
                in_progress_at: new Date().toISOString(),
            });
            loadTasks();
            setWorkingOnTask(null);
        } catch (error) {
            console.error('Failed to start work:', error);
        }
    };

    const handleMarkComplete = async (taskId, values) => {
        try {
            const formData = new FormData();
            formData.append('status', 'pending_certification');
            formData.append('resolved_at', new Date().toISOString());
            // Add completion details to description/notes if needed
            if (values.work_performed) {
                formData.append('work_performed', values.work_performed);
            }

            // Handle photo uploads
            if (values.photos && values.photos.length > 0) {
                values.photos.forEach((file, idx) => {
                    formData.append(`photo_${idx}`, file);
                });
            }

            await api.patch(`/api/incidents/${taskId}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            loadTasks();
            setCompletingTask(null);
        } catch (error) {
            console.error('Failed to mark task complete:', error);
        }
    };

    const TaskCard = ({ task, tabName }) => {
        return (
            <div
                style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    borderLeft: `4px solid ${priorityColors[task.severity] || '#6b7280'}`,
                }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'start' }}>
                    <div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{task.incident_number}</strong>
                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    background: priorityColors[task.severity],
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                {task.severity.charAt(0).toUpperCase() + task.severity.slice(1)}
                            </span>
                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    background: statusBadgeColors[task.status],
                                    color: 'white',
                                    fontWeight: 600,
                                }}
                            >
                                {task.status.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '6px' }}>
                            <strong>{task.category}</strong> — {task.description?.substring(0, 100)}...
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        fontSize: '0.9rem',
                        color: '#64748b',
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #e2e8f0',
                    }}
                >
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date Reported</div>
                        <div>{new Date(task.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Zone</div>
                        <div>{task.zone_name || 'N/A'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Location</div>
                        <div>{task.location_text?.substring(0, 30)}...</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reported By</div>
                        <div>{task.reported_by_name || 'N/A'}</div>
                    </div>
                </div>

                {task.assignment_instructions && (
                    <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '4px', fontSize: '0.9rem', color: '#065f46', marginBottom: '12px' }}>
                        <strong>📋 Instructions:</strong> {task.assignment_instructions}
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tabName === 'active' && task.status === 'assigned' && (
                        <button
                            onClick={() => setWorkingOnTask(task.id)}
                            style={{
                                flex: 1,
                                minWidth: '120px',
                                padding: '8px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                            }}
                        >
                            <i className="fas fa-play-circle" style={{ marginRight: '4px' }}></i>Start Work
                        </button>
                    )}
                    {tabName === 'active' && task.status === 'in_progress' && (
                        <button
                            onClick={() => setCompletingTask(task.id)}
                            style={{
                                flex: 1,
                                minWidth: '120px',
                                padding: '8px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                            }}
                        >
                            <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>Mark Complete
                        </button>
                    )}
                </div>

                {/* Start Work Confirmation */}
                {workingOnTask === task.id && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', background: '#fef3c7', padding: '12px', borderRadius: '4px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#92400e', marginBottom: '10px' }}>
                            <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                            Start work on this task?
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button
                                onClick={() => setWorkingOnTask(null)}
                                style={{
                                    padding: '8px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleStartWork(task.id)}
                                style={{
                                    padding: '8px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                }}
                            >
                                <i className="fas fa-play" style={{ marginRight: '4px' }}></i>Start
                            </button>
                        </div>
                    </div>
                )}

                {/* Mark Complete Form */}
                {completingTask === task.id && (
                    <CompletionForm
                        taskId={task.id}
                        onSubmit={(values) => handleMarkComplete(task.id, values)}
                        onCancel={() => setCompletingTask(null)}
                    />
                )}
            </div>
        );
    };

    const CompletionForm = ({ taskId, onSubmit, onCancel }) => {
        const completionSchema = Yup.object().shape({
            work_performed: Yup.string().required('Work performed description is required'),
            photos: Yup.array(),
        });

        return (
            <Formik
                initialValues={{
                    work_performed: '',
                    photos: [],
                }}
                validationSchema={completionSchema}
                onSubmit={onSubmit}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', background: '#f0fdf4', padding: '12px', borderRadius: '4px' }}>
                            <h4 style={{ color: '#065f46', marginBottom: '12px' }}>
                                <i className="fas fa-clipboard-check" style={{ marginRight: '8px' }}></i>Mark Task Complete
                            </h4>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: '#065f46' }}>
                                    Work Performed <span style={{ color: '#dc2626' }}>*</span>
                                </label>
                                <Field
                                    as="textarea"
                                    name="work_performed"
                                    placeholder="Describe the work completed, any issues found, and actions taken..."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #86efac',
                                        minHeight: '80px',
                                        fontFamily: 'inherit',
                                        fontSize: '0.9rem',
                                    }}
                                />
                                <ErrorMessage name="work_performed" render={(msg) => <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '4px' }}>{msg}</div>} />
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: '#065f46' }}>
                                    Attach Photos (Optional)
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(event) => {
                                        const files = Array.from(event.currentTarget.files || []);
                                        setFieldValue('photos', files);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px dashed #86efac',
                                        background: '#f0fdf4',
                                    }}
                                />
                                {values.photos.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#065f46' }}>
                                        <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>
                                        {values.photos.length} file(s) selected
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    style={{
                                        padding: '8px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        padding: '8px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        opacity: isSubmitting ? 0.7 : 1,
                                    }}
                                >
                                    <i className="fas fa-paper-plane" style={{ marginRight: '4px' }}></i>
                                    {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                                </button>
                            </div>
                        </div>
                    </Form>
                )}
            </Formik>
        );
    };

    const renderTabContent = () => {
        const tabTasks = tasks[activeTab];
        if (loading) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Loading tasks...
                </div>
            );
        }

        if (!tabTasks || tabTasks.length === 0) {
            const emptyMessages = {
                active: 'No active tasks. You\'re all caught up! 🎉',
                awaiting_certification: 'No tasks awaiting certification.',
                history: 'No completed tasks yet.',
            };
            return (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <i className="fas fa-inbox" style={{ fontSize: '2.5rem', marginBottom: '12px', display: 'block', color: '#cbd5e1' }}></i>
                    <p style={{ fontSize: '1.05rem' }}>{emptyMessages[activeTab] || 'No tasks found'}</p>
                </div>
            );
        }

        return (
            <div style={{ display: 'grid', gap: '15px' }}>
                {tabTasks.map((task) => (
                    <TaskCard key={task.id} task={task} tabName={activeTab} />
                ))}
            </div>
        );
    };

    return (
        <div className="form-section active">
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa' }}>
                <i className="fas fa-tasks"></i> My Tasks
                {unreadCount > 0 && (
                    <span
                        style={{
                            marginLeft: '12px',
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            background: '#dc2626',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                        }}
                    >
                        {unreadCount} pending
                    </span>
                )}
            </h2>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                {[
                    { id: 'active', label: 'Active', icon: 'fa-circle-play' },
                    { id: 'awaiting_certification', label: 'Awaiting Certification', icon: 'fa-clipboard-check' },
                    { id: 'history', label: 'My History', icon: 'fa-history' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 16px',
                            background: activeTab === tab.id ? '#1a6fb0' : 'transparent',
                            color: activeTab === tab.id ? 'white' : '#64748b',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '3px solid #1a6fb0' : 'none',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 600 : 500,
                            fontSize: '0.95rem',
                            transition: 'all 0.3s',
                        }}
                    >
                        <i className={`fas ${tab.icon}`} style={{ marginRight: '6px' }}></i>
                        {tab.label}
                        {tab.id === 'active' && unreadCount > 0 && (
                            <span style={{ marginLeft: '6px', fontSize: '0.8rem', background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : '#dc2626', color: activeTab === tab.id ? 'white' : 'white', padding: '2px 6px', borderRadius: '10px' }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};

export default MyTasksNew;
