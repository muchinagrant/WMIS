import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Layout.css';

const TabNavigation = () => {
    const { user } = useContext(AuthContext);
    
    // Default to attendant if no role is found (safest restriction)
    const userRole = user?.role || 'attendant';

    // RBAC Permissions Map based on KICOWASCO Organogram
    const permissions = {
        incidence: ['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator', 'attendant'],
        repairs: ['admin', 'superintendent', 'supervisor', 'operator', 'attendant'],
        inspection: ['admin', 'superintendent', 'supervisor', 'attendant'], // Field Ops
        treatment: ['admin', 'superintendent', 'supervisor', 'lab_tech', 'operator'], // Plant Ops
        sludge: ['admin', 'superintendent', 'supervisor', 'operator'], // Logistics
        connections: ['admin', 'superintendent', 'supervisor'], // Admin/Management
        summary: ['admin', 'superintendent'] // Executive view only
    };

    const hasAccess = (tab) => permissions[tab].includes(userRole);

    return (
        <div className="nav-tabs">
            {hasAccess('incidence') && (
                <NavLink to="/incidence" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-exclamation-circle"></i> Incidence
                </NavLink>
            )}
            
            {hasAccess('repairs') && (
                <NavLink to="/repairs" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-tools"></i> Repairs
                </NavLink>
            )}
            
            {hasAccess('inspection') && (
                <NavLink to="/inspection" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-search"></i> Inspection
                </NavLink>
            )}
            
            {hasAccess('treatment') && (
                <NavLink to="/treatment" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-industry"></i> Treatment
                </NavLink>
            )}
            
            {hasAccess('sludge') && (
                <NavLink to="/sludge" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-truck"></i> Sludge
                </NavLink>
            )}
            
            {hasAccess('connections') && (
                <NavLink to="/connections" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-network-wired"></i> Connections
                </NavLink>
            )}
            
            {hasAccess('summary') && (
                <NavLink to="/summary" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                    <i className="fas fa-chart-pie"></i> Summary
                </NavLink>
            )}
        </div>
    );
};

export default TabNavigation;