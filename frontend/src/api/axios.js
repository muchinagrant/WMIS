import axios from 'axios';

const instance = axios.create({ 
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000' 
});

instance.interceptors.request.use(config => {
  // Grab the parsed token object from local storage
  const authTokens = JSON.parse(localStorage.getItem('authTokens'));
  
  // If the tokens exist and we have an access token, attach it to the header
  if (authTokens && authTokens.access) {
    config.headers.Authorization = `Bearer ${authTokens.access}`;
  }
  return config;
});

export default instance;