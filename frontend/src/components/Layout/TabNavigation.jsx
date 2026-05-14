import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Layout.css';

const TabNavigation = ({ orientation = 'horizontal' }) => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'line_attendant';

    const permissions = {
        profile: ['admin', 'stp_superintendent', 'stp_supervisor', 'lab_tech', 'stp_operator', 'line_supervisor', 'line_attendant', 'sewer_line_officer'],
        incidence: ['admin', 'stp_superintendent', 'line_supervisor', 'line_attendant', 'sewer_line_officer'],
        repairs: ['admin', 'stp_superintendent', 'line_supervisor', 'line_attendant'],
        inspection: ['admin', 'stp_superintendent', 'line_supervisor', 'line_attendant', 'sewer_line_officer'],
        treatment: ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'],
        inlet_works: ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'],
        flow_records: ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'],
        sludge: ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'],
        connections: ['admin', 'stp_superintendent', 'line_supervisor', 'sewer_line_officer'],
        dispatch: ['admin', 'stp_superintendent', 'line_supervisor', 'line_attendant'],
        lab_records: ['admin', 'stp_superintendent', 'stp_supervisor', 'lab_tech'],
        pond_ops: ['admin', 'stp_superintendent', 'stp_supervisor', 'stp_operator'],
        summary: ['admin', 'stp_superintendent']
    };

    const hasAccess = (tab) => permissions[tab].includes(userRole);
    const navClass = orientation === 'vertical' ? 'nav-tabs vertical' : 'nav-tabs';

    return (
        <div className={navClass}>
            {hasAccess('incidence') && (
                <NavLink to="/incidence" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-exclamation-circle"></i> Incidence
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
            {hasAccess('inlet_works') && (
                <NavLink to="/f203a" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-filter"></i> Inlet Works
                </NavLink>
            )}
            {hasAccess('flow_records') && (
                <NavLink to="/flow-records" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-water"></i> Flow Records
                </NavLink>
            )}
            {hasAccess('lab_records') && (
                <NavLink to="/lab-records" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-flask"></i> Lab Records
                </NavLink>
            )}
            {hasAccess('pond_ops') && (
                <NavLink to="/ponds" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-tint"></i> Ponds
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
            {hasAccess('dispatch') && (
                <NavLink to="/dispatch" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-tasks"></i> {userRole === 'line_attendant' ? 'My Tasks' : 'Dispatch'}
                </NavLink>
            )}
            {hasAccess('summary') && (
                <NavLink to="/summary" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-chart-pie"></i> Summary
                </NavLink>
            )}
            {hasAccess('profile') && (
                <NavLink to="/profile" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-id-badge"></i> Profile
                </NavLink>
            )}
        </div>
    );
};

export default TabNavigation;