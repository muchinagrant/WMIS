import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Header from './Header';
import TabNavigation from './TabNavigation';
import './Layout.css';

const ProtectedLayout = () => {
    // Grab the current user from our AuthContext
    const { user } = useContext(AuthContext);

    // If no user is found, redirect them to the login page immediately
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If the user exists, render with global side navigation
    return (
        <>
            <Header />
            <div className="global-layout-shell">
                <aside className="global-sidebar">
                    <TabNavigation orientation="vertical" />
                </aside>
                <div className="content-wrapper">
                    <div className="content p-8 min-h-[600px]">
                        {/* <Outlet /> is where the specific tab components (like IncidenceForm) will render */}
                        <Outlet />
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProtectedLayout;