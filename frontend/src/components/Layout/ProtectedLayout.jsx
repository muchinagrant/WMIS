import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import PWAInstallBanner from '../PWAInstallBanner';
import Header from './Header';
import TabNavigation from './TabNavigation';
import MobileBottomNav from './MobileBottomNav';
import './Layout.css';

const ProtectedLayout = () => {
    // Grab the current user from our AuthContext
    const { user } = useContext(AuthContext);

    // If no user is found, redirect them to the login page immediately
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If the user exists, render with responsive navigation
    return (
        <>
            <Header />
            <div className="global-layout-shell">
                {/* Desktop Sidebar - Hidden on mobile */}
                <aside className="global-sidebar hidden md:block">
                    <TabNavigation orientation="vertical" />
                </aside>
                <div className="content-wrapper">
                    <div className="content p-8 min-h-[600px]">
                        <PWAInstallBanner />
                        {/* <Outlet /> is where the specific tab components (like IncidenceForm) will render */}
                        <Outlet />
                    </div>
                </div>
            </div>
            {/* Mobile Bottom Navigation - Visible only on mobile */}
            <MobileBottomNav />
        </>
    );
};

export default ProtectedLayout;