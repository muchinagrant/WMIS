import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './MobileBottomNav.css';

/**
 * MobileBottomNav Component
 * Bottom navigation bar for mobile devices (< 768px)
 */
const MobileBottomNav = () => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'line_attendant';

    const permissions = {
        profile: ['admin', 'stp_superintendent', 'stp_supervisor', 'lab_tech', 'stp_operator', 'stp_attendant', 'line_supervisor', 'line_attendant'],
        incidence: ['line_supervisor', 'line_attendant'],
        inspection: ['line_supervisor', 'line_attendant'],
        dispatch: ['line_supervisor', 'line_attendant'],
        summary: ['admin', 'stp_superintendent', 'stp_supervisor'],
        treatment: ['stp_supervisor', 'stp_operator', 'stp_attendant'],
    };

    const hasAccess = (tab) => permissions[tab]?.includes(userRole) || false;

    // Build dynamic navigation items based on role
    const getNavItems = () => {
        const items = [];

        // Line Attendant / Line Supervisor
        if (hasAccess('incidence')) {
            items.push({
                path: '/incidence',
                label: 'Report',
                icon: 'fas fa-exclamation-circle'
            });
        }

        if (hasAccess('inspection')) {
            items.push({
                path: '/inspection',
                label: 'Patrol',
                icon: 'fas fa-search'
            });
        }

        if (hasAccess('dispatch')) {
            items.push({
                path: userRole === 'line_attendant' ? '/my-tasks' : '/dispatch',
                label: userRole === 'line_attendant' ? 'Tasks' : 'Dispatch',
                icon: 'fas fa-tasks'
            });
        }

        // STP Operations
        if (hasAccess('treatment')) {
            items.push({
                path: '/treatment',
                label: 'Treatment',
                icon: 'fas fa-industry'
            });
        }

        // Summary for admins/supervisors
        if (hasAccess('summary')) {
            items.push({
                path: '/summary',
                label: 'Summary',
                icon: 'fas fa-chart-pie'
            });
        }

        // Profile (always last, available to all)
        if (hasAccess('profile')) {
            items.push({
                path: '/profile',
                label: 'Profile',
                icon: 'fas fa-id-badge'
            });
        }

        return items;
    };

    const navItems = getNavItems();

    return (
        <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
            <div className="flex justify-around">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center py-3 px-2 flex-1 text-center transition ${
                                isActive
                                    ? 'text-blue-600 border-t-2 border-blue-600 -mt-[2px]'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`
                        }
                    >
                        <i className={`${item.icon} text-lg mb-1`}></i>
                        <span className="text-xs font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
