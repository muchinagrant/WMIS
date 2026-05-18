import React, { useState, useEffect } from 'react';

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) {
      return;
    }

    // Check localStorage for dismissal
    const dismissedAt = localStorage.getItem('pwa_install_dismissed_at');
    if (dismissedAt) {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (parseInt(dismissedAt) > sevenDaysAgo) {
        setShowBanner(false);
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also show banner on first visit/login if no dismissal
    if (!dismissedAt) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        localStorage.removeItem('pwa_install_dismissed_at');
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed_at', Date.now().toString());
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '16px',
      marginBottom: '16px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        <span style={{ fontSize: '24px', marginRight: '12px' }}>📱</span>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            Install KICOWASCO on your device
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Get the best experience with offline access and quick access from your home screen.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            background: 'white',
            color: '#667eea',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontSize: '14px'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Install App
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            color: 'white',
            border: '1px solid white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontSize: '14px'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.8'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
