import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Layout.css';

const TabNavigation = ({ orientation = 'horizontal' }) => {
    const { user } = useContext(AuthContext);
    const userRole = user?.role || 'line_attendant';

    const permissions = {
        profile: ['admin', 'stp_superintendent', 'stp_supervisor', 'lab_tech', 'stp_operator', 'stp_attendant', 'line_supervisor', 'line_attendant'],
        incidence: ['line_supervisor', 'line_attendant'],
        repairs: ['line_supervisor', 'line_attendant'],
        inspection: ['line_supervisor', 'line_attendant'],
        treatment: ['stp_supervisor', 'stp_operator', 'lab_tech'],
        inlet_works: ['stp_supervisor', 'stp_operator', 'stp_attendant'],
        flow_records: ['stp_supervisor', 'stp_operator', 'stp_attendant'],
        sludge: ['stp_supervisor', 'stp_operator', 'stp_attendant'],
        dispatch: ['line_supervisor', 'line_attendant'],
        lab_records: ['stp_supervisor', 'lab_tech', 'stp_operator'],
        pond_ops: ['stp_supervisor', 'stp_operator', 'stp_attendant', 'lab_tech'],
        alerts: ['stp_operator', 'stp_supervisor', 'lab_tech'],
        summary: ['admin', 'stp_superintendent', 'stp_supervisor'],
        team: ['stp_supervisor'],
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
            {hasAccess('alerts') && (
                <NavLink to="/alerts" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-bell"></i> Alerts
                </NavLink>
            )}
            {hasAccess('sludge') && (
                <NavLink to="/sludge" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-truck"></i> Sludge
                </NavLink>
            )}
            {hasAccess('dispatch') && (
                <NavLink to="/dispatch" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-tasks"></i> {userRole === 'line_attendant' ? 'My Tasks' : 'Dispatch'}
                </NavLink>
            )}
            {hasAccess('team') && (
                <NavLink to="/team" className={({ isActive }) => isActive ? 'tab active' : 'tab'}>
                    <i className="fas fa-users"></i> Team
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