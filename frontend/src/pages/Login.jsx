import React, { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';

const Login = () => {
    // Bring in the loginUser function from our context
    const { loginUser } = useContext(AuthContext);
    
    // Local state for the form inputs and UI feedback
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // Call the login function
        const result = await loginUser(username, password);
        
        // If login fails, display the error message
        if (!result.success) {
            setError(result.message);
        }
        
        setIsLoading(false);
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '30px', background: '#f9fbfd', borderRadius: '8px', border: '1px solid #d1e5f1' }}>
            <h2 style={{ color: '#1a6fb0', marginBottom: '25px', textAlign: 'center', borderBottom: 'none' }}>
                <i className="fas fa-lock" style={{ marginRight: '10px' }}></i>
                System Login
            </h2>
            
            {error && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
                        Username
                    </label>
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required 
                        placeholder="Enter your username"
                        style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                    />
                </div>
                
                <div className="form-group" style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
                        Password
                    </label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        placeholder="Enter your password"
                        style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                    />
                </div>
                
                <button 
                    type="submit" 
                    className="btn" 
                    disabled={isLoading}
                    style={{ width: '100%', justifyContent: 'center', opacity: isLoading ? 0.7 : 1 }}
                >
                    {isLoading ? 'Authenticating...' : 'Log In'}
                </button>
            </form>
        </div>
    );
};

export default Login;