import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sendMessage = async (message, sessionId, attachments = []) => {
  const response = await apiClient.post('/chat', { 
    message, 
    session_id: sessionId,
    attachments 
  });
  return response.data;
};

export const getSessions = async () => {
  const response = await apiClient.get('/sessions');
  return response.data;
};

export const getSessionHistory = async (sessionId) => {
  const response = await apiClient.get(`/history/${sessionId}`);
  return response.data;
};

export const updateSessionTitle = async (sessionId, newTitle) => {
  const response = await apiClient.patch(`/sessions/${sessionId}`, { title: newTitle });
  return response.data;
};
