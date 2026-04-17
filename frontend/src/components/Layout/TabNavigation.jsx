import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Layout.css';

const TabNavigation = () => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'attendant';

    const permissions = {
        incidence: ['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator', 'attendant'],
        repairs: ['admin', 'superintendent', 'supervisor', 'operator', 'attendant'],
        inspection: ['admin', 'superintendent', 'supervisor', 'attendant'],
        treatment: ['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator'],
        sludge: ['admin', 'superintendent', 'supervisor', 'operator'],
        connections: ['admin', 'superintendent', 'supervisor'],
        summary: ['admin', 'superintendent']
    };

    const hasAccess = (tab) => permissions[tab].includes(userRole);

    return (
        <div className="nav-tabs">
            {hasAccess('incidence') && (
                <NavLink to="/incidence" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-exclamation-circle"></i> Incidence
                </NavLink>
            )}
            {hasAccess('repairs') && (
                <NavLink to="/repairs" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-tools"></i> Repairs
                </NavLink>
            )}
            {hasAccess('inspection') && (
                <NavLink to="/inspection" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-search"></i> Inspection
                </NavLink>
            )}
            {hasAccess('treatment') && (
                <NavLink to="/treatment" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-industry"></i> Treatment
                </NavLink>
            )}
            {hasAccess('sludge') && (
                <NavLink to="/sludge" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-truck"></i> Sludge
                </NavLink>
            )}
            {hasAccess('connections') && (
                <NavLink to="/connections" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-network-wired"></i> Connections
                </NavLink>
            )}
            {hasAccess('summary') && (
                <NavLink to="/summary" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-chart-pie"></i> Summary
                </NavLink>
            )}
        </div>
    );
};

export default TabNavigation;