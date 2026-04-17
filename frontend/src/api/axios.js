import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://kicowasco-backend.onrender.com',
  timeout: 60000
});

instance.interceptors.request.use(config => {
  const authTokens = JSON.parse(localStorage.getItem('authTokens'));

  if (authTokens && authTokens.access) {
    config.headers.Authorization = `Bearer ${authTokens.access}`;
  }
  return config;
});

export const wakeUpServer = async () => {
  try {
    await instance.get('/api/incidents/', { timeout: 5000 });
    console.log('Backend server is awake.');
  } catch (error) {
    console.log('Backend server is waking up...');
  }
};

export default instance;