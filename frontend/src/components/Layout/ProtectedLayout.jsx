import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Header from './Header';
import TabNavigation from './TabNavigation';

const ProtectedLayout = () => {
    // Grab the current user from our AuthContext
    const { user } = useContext(AuthContext);

    // If no user is found, redirect them to the login page immediately
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If the user exists, render the Header, Navigation, and the nested Route (<Outlet />)
    return (
        <>
            <Header />
            <TabNavigation />
            <div className="content p-8 min-h-[600px]">
                {/* <Outlet /> is where the specific tab components (like IncidenceForm) will render */}
                <Outlet />
            </div>
        </>
    );
};

export default ProtectedLayout;