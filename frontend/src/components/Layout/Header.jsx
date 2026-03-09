import React, { useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import './Layout.css';

const Header = () => {
    // Bring in user state and logout function from context
    const { user, logoutUser } = useContext(AuthContext);

    return (
        <>
            <header className="kicowasco-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ textAlign: 'left' }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Kirinyaga County Water & Sanitation PLC</h1>
                    <p className="subtitle" style={{ margin: 0, opacity: 0.9 }}>Integrated Wastewater Management System</p>
                </div>

                {/* Profile & Logout Section - Only renders if user is logged in */}
                {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.15)', padding: '8px 15px', borderRadius: '8px' }}>
                        <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                            {/* Assuming the token decodes to include 'username', adjust if your model uses 'email' */}
                            <span style={{ display: 'block', fontWeight: 'bold' }}>
                                <i className="fas fa-user-circle" style={{ marginRight: '5px' }}></i> 
                                {user.username || 'System User'}
                            </span>
                        </div>
                        
                        <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.3)' }}></div>

                        <button 
                            onClick={logoutUser}
                            style={{ 
                                background: 'transparent', 
                                color: 'white', 
                                border: '1px solid rgba(255,255,255,0.6)', 
                                padding: '6px 12px', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                e.currentTarget.style.borderColor = 'white';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                            }}
                        >
                            <i className="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                )}
            </header>
            
            <div className="official-branding">
                <h3>KIRINYAGA COUNTY WATER & SANITATION PLC</h3>
                <p>P.O BOX 360-10300, KERUGOYA | Tel: 0746555368 | Customer Care: 0715413591</p>
                <p>Email: managingdirector@kicowasco.co.ke | Website: www.kicowasco.co.ke</p>
            </div>
        </>
    );
};

export default Header;