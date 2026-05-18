import React from 'react';

/**
 * Badge Component
 * Displays status, priority, and count badges with consistent styling
 */
const Badge = ({ 
    variant = 'primary',
    label,
    icon = null,
    size = 'medium'
}) => {
    const variants = {
        // Status badges
        'new': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
        'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
        'in_progress': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
        'pending_certification': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
        'closed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
        
        // Priority badges
        'critical': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
        'high': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
        'medium': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
        'low': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },

        // Count badges
        'primary': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
        'secondary': { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-500' },
        'success': { bg: 'bg-green-600', text: 'text-white', border: 'border-green-700' },
        'danger': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
        'warning': { bg: 'bg-yellow-600', text: 'text-white', border: 'border-yellow-700' },
        'info': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
    };

    const sizeClasses = {
        small: 'px-2 py-0.5 text-xs',
        medium: 'px-3 py-1 text-sm',
        large: 'px-4 py-2 text-base'
    };

    const style = variants[variant] || variants.primary;
    const sizeClass = sizeClasses[size] || sizeClasses.medium;

    return (
        <span className={`inline-flex items-center gap-1 ${sizeClass} font-medium rounded-full border ${style.bg} ${style.text} ${style.border}`}>
            {icon && <i className={`${icon} text-xs`}></i>}
            {label}
        </span>
    );
};

export default Badge;
