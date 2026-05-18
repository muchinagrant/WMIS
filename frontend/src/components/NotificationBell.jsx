import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const NotificationBell = () => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await api.get('/api/notifications/', {
        params: { limit: 20 }
      });
      const notifs = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setNotifications(notifs);
      
      // Count unread notifications
      const unread = notifs.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for notifications every 60 seconds (as fallback for push notifications)
  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(fetchNotifications, 60000);
    
    return () => clearInterval(interval);
  }, [user]);

  // Mark notification as read when clicked
  const handleNotificationClick = async (notificationId, linkUrl) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/`, { is_read: true });
      
      // Update local state
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
      
      // Navigate if link provided
      if (linkUrl) {
        window.location.href = linkUrl;
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications/mark_all_read/', {});
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Format time ago
  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Get notification icon color based on type
  const getNotificationColor = (type) => {
    switch (type) {
      case 'incident_critical':
        return '#DC2626'; // red
      case 'task_assigned':
        return '#3B82F6'; // blue
      case 'approval':
        return '#F59E0B'; // amber
      default:
        return '#6B7280'; // grey
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          padding: '8px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              background: '#DC2626',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              minWidth: '20px'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            width: '360px',
            maxHeight: '500px',
            overflowY: 'auto',
            zIndex: 1000,
            marginTop: '8px'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3B82F6',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification.id, notification.link_url)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  background: notification.is_read ? '#ffffff' : '#f0f9ff',
                  transition: 'background-color 0.2s',
                  ':hover': { background: '#f3f4f6' }
                }}
                onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.background = notification.is_read ? '#ffffff' : '#f0f9ff'}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getNotificationColor(notification.notification_type),
                      marginTop: '6px',
                      flexShrink: 0
                    }}
                  />
                  
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: notification.is_read ? '400' : '600',
                        color: '#1f2937',
                        marginBottom: '4px',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word'
                      }}
                    >
                      {notification.title}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#6B7280',
                        marginBottom: '4px',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word'
                      }}
                    >
                      {notification.message}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#9CA3AF'
                      }}
                    >
                      {timeAgo(notification.created_at)}
                    </div>
                  </div>

                  {/* Unread Badge */}
                  {!notification.is_read && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#3B82F6',
                        marginTop: '6px',
                        flexShrink: 0
                      }}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Close when clicking outside */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
    </div>
  );
};

export default NotificationBell;
