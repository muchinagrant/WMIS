import React from 'react';

/**
 * Toast Component
 * Individual notification toast
 */
const Toast = ({ message, type = 'info', onClose }) => {
    const typeConfig = {
        success: {
            icon: 'fas fa-check-circle',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            textColor: 'text-green-800',
            iconColor: 'text-green-600'
        },
        error: {
            icon: 'fas fa-exclamation-circle',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            textColor: 'text-red-800',
            iconColor: 'text-red-600'
        },
        info: {
            icon: 'fas fa-info-circle',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            textColor: 'text-blue-800',
            iconColor: 'text-blue-600'
        },
        warning: {
            icon: 'fas fa-exclamation-triangle',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            textColor: 'text-yellow-800',
            iconColor: 'text-yellow-600'
        }
    };

    const config = typeConfig[type] || typeConfig.info;

    return (
        <div 
            className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex items-center space-x-3 shadow-lg pointer-events-auto`}
            role="alert"
        >
            <i className={`${config.icon} ${config.iconColor} text-lg flex-shrink-0`}></i>
            <p className={`${config.textColor} text-sm flex-1`}>{message}</p>
            <button
                onClick={onClose}
                className={`flex-shrink-0 ${config.textColor} hover:opacity-70 transition ml-2`}
                aria-label="Close"
            >
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

export default Toast;
