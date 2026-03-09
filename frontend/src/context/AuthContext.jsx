import React, { createContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {
    const [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens')
            ? JSON.parse(localStorage.getItem('authTokens'))
            : null
    );

    const [user, setUser] = useState(() => {
        const storedTokens = localStorage.getItem('authTokens');
        if (!storedTokens) return null;

        try {
            const parsedTokens = JSON.parse(storedTokens);
            return parsedTokens.access ? jwtDecode(parsedTokens.access) : null;
        } catch (error) {
            return null;
        }
    });

    const navigate = useNavigate();

    const loginUser = async (username, password) => {
        try {
            const response = await api.post('/api/auth/token/', { username, password });
            const data = response.data;

            setAuthTokens(data);
            setUser(jwtDecode(data.access));
            localStorage.setItem('authTokens', JSON.stringify(data));
            navigate('/incidence');

            return { success: true };
        } catch (error) {
            return {
                success: false,
                message:
                    error.response?.data?.detail ||
                    'Invalid credentials or server error. Please try again.'
            };
        }
    };

    const logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        navigate('/login');
    };

    const contextData = {
        user,
        authTokens,
        loginUser,
        logoutUser
    };

    return (
        <AuthContext.Provider value={contextData}>
            {children}
        </AuthContext.Provider>
    );
};