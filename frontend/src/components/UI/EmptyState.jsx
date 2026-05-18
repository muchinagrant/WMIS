import React from 'react';

/**
 * EmptyState Component
 * Displays a helpful empty state when no data is available
 */
const EmptyState = ({ 
    icon = 'fas fa-inbox',
    title = 'No Data Available',
    message = 'There are no items to display at this time.',
    action = null,
    size = 'medium'
}) => {
    const sizeClasses = {
        small: 'h-40',
        medium: 'h-64',
        large: 'h-96'
    };

    return (
        <div className={`flex flex-col items-center justify-center ${sizeClasses[size] || sizeClasses.medium} bg-gray-50 rounded-lg border border-gray-200`}>
            <i className={`${icon} text-gray-300 text-5xl mb-4`}></i>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs text-center">{message}</p>
            {action && (
                <button 
                    onClick={action.onClick}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
