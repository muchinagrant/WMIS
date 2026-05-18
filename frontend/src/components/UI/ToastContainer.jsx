import React, { useState, useCallback, useRef } from 'react';
import Toast from './Toast';
import './Toast.css';

/**
 * ToastContainer Component
 * Manages and displays toast notifications
 */
const ToastContainer = React.forwardRef((props, ref) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = toastIdRef.current++;
        const toast = { id, message, type };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration),
        info: (message, duration) => addToast(message, 'info', duration),
        warning: (message, duration) => addToast(message, 'warning', duration),
    }), [addToast]);

    return (
        <div className="toast-container fixed bottom-4 right-4 z-50 space-y-3 max-w-md pointer-events-none">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
});

ToastContainer.displayName = 'ToastContainer';

export default ToastContainer;
