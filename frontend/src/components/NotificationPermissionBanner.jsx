import React, { useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const NotificationPermissionBanner = () => {
  const { user } = useContext(AuthContext);
  const [showPrompt, setShowPrompt] = useState(false);
  const [iosStandaloneMessage, setIosStandaloneMessage] = useState(false);

  useEffect(() => {
    if (!user) return;

    const isIos = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isIos && !isStandalone) {
      setIosStandaloneMessage(true);
      return;
    }

    if (!('Notification' in window)) {
      return;
    }

    const hasDismissed = localStorage.getItem('notification_permission_dismissed') === '1';
    if (Notification.permission === 'default' && !hasDismissed) {
      setShowPrompt(true);
    }
  }, [user]);

  const saveToken = async (token) => {
    try {
      await api.post('/api/users/fcm_token/', { token });
    } catch {
      // token save failures should not block UX
    }
  };

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const fallbackToken = `web-notification:${user?.id || 'anonymous'}:${Date.now()}`;
        await saveToken(fallbackToken);
      }
      setShowPrompt(false);
      localStorage.setItem('notification_permission_dismissed', '1');
    } catch {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification_permission_dismissed', '1');
    setShowPrompt(false);
  };

  if (iosStandaloneMessage) {
    return (
      <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
        To receive push notifications on iPhone, first install this app to your Home Screen using the Share button.
      </div>
    );
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div style={{ background: '#0f766e', color: 'white', padding: '14px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <div style={{ fontSize: '0.92rem' }}>
        Enable notifications to receive task assignments and critical incident alerts instantly.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleEnable} style={{ background: 'white', color: '#0f766e', border: 'none', borderRadius: '6px', padding: '8px 12px', fontWeight: 600, cursor: 'pointer' }}>
          Enable
        </button>
        <button onClick={handleDismiss} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.7)', borderRadius: '6px', padding: '8px 12px', fontWeight: 600, cursor: 'pointer' }}>
          Later
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
