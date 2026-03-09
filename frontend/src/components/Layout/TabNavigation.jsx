import React from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css';

const TabNavigation = () => {
    return (
        <div className="nav-tabs">
            <NavLink to="/incidence" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-exclamation-circle"></i> Incidence
            </NavLink>
            <NavLink to="/repairs" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-tools"></i> Repairs
            </NavLink>
            <NavLink to="/inspection" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-search"></i> Inspection
            </NavLink>
            <NavLink to="/treatment" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-industry"></i> Treatment
            </NavLink>
            <NavLink to="/sludge" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-truck"></i> Sludge
            </NavLink>
            <NavLink to="/connections" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-network-wired"></i> Connections
            </NavLink>
            <NavLink to="/summary" className={({ isActive }) => isActive ? "tab active" : "tab"}>
                <i className="fas fa-chart-pie"></i> Summary
            </NavLink>
        </div>
    );
};

export default TabNavigation;