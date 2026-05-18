import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Breadcrumbs Component
 * Provides navigation context with breadcrumb trail
 */
const Breadcrumbs = ({ items = [] }) => {
    if (items.length === 0) return null;

    return (
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-gray-600">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center">
                        {item.href ? (
                            <>
                                <Link 
                                    to={item.href}
                                    className="text-blue-500 hover:text-blue-700 transition"
                                >
                                    {item.label}
                                </Link>
                                {index < items.length - 1 && (
                                    <i className="fas fa-chevron-right mx-2 text-gray-400"></i>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="text-gray-700 font-medium">{item.label}</span>
                                {index < items.length - 1 && (
                                    <i className="fas fa-chevron-right mx-2 text-gray-400"></i>
                                )}
                            </>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
