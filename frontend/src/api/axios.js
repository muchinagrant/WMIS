import axios from 'axios';

// Create instance with a 60-second timeout to survive Render's cold starts
const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://kicowasco-backend.onrender.com',
  timeout: 60000
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

// A heartbeat function to wake up the Render server in the background
export const wakeUpServer = async () => {
  try {
    await instance.get('/api/incidents/', { timeout: 5000 });
    console.log('Backend server is awake.');
  } catch (error) {
    console.log('Backend server is waking up...');
  }
};

export default instance;