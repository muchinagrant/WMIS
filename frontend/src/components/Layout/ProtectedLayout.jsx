import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Header from './Header';
import TabNavigation from './TabNavigation';
import './Layout.css';

const ProtectedLayout = () => {
    // Grab the current user from our AuthContext
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const isInspectionRoute = location.pathname.startsWith('/inspection');

    // If no user is found, redirect them to the login page immediately
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If the user exists, render the Header, Navigation, and the nested Route (<Outlet />)
    return (
        <>
            <Header />
            {isInspectionRoute ? (
                <div className="inspection-shell">
                    <aside className="inspection-sidebar">
                        <TabNavigation orientation="vertical" />
                    </aside>
                    <div className="content p-8 min-h-[600px] inspection-content">
                        <Outlet />
                    </div>
                </div>
            ) : (
                <>
                    <TabNavigation />
                    <div className="content p-8 min-h-[600px]">
                        {/* <Outlet /> is where the specific tab components (like IncidenceForm) will render */}
                        <Outlet />
                    </div>
                </>
            )}
        </>
    );
};

export default ProtectedLayout;