import React from 'react';
import './SkeletonLoader.css';

/**
 * SkeletonLoader Component
 * Displays a loading skeleton for data fetching states
 */
const SkeletonLoader = ({ 
    variant = 'card',
    count = 3,
    height = 'h-20'
}) => {
    if (variant === 'card') {
        return (
            <div className="space-y-4">
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className={`${height} bg-gray-200 rounded-lg skeleton-loader`}></div>
                ))}
            </div>
        );
    }

    if (variant === 'table') {
        return (
            <div className="space-y-3">
                {/* Header row */}
                <div className="grid grid-cols-5 gap-4 mb-4">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="h-6 bg-gray-200 rounded skeleton-loader"></div>
                    ))}
                </div>
                {/* Data rows */}
                {Array.from({ length: count }).map((_, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, colIdx) => (
                            <div key={colIdx} className="h-6 bg-gray-200 rounded skeleton-loader"></div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'profile') {
        return (
            <div className="space-y-6">
                {/* Header/Avatar */}
                <div className="flex items-center space-x-4">
                    <div className="w-24 h-24 bg-gray-200 rounded-full skeleton-loader"></div>
                    <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4 skeleton-loader"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 skeleton-loader"></div>
                    </div>
                </div>
                {/* Content rows */}
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4 skeleton-loader"></div>
                        <div className="h-8 bg-gray-200 rounded w-full skeleton-loader"></div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
};

export default SkeletonLoader;
