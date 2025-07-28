import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL;

export const fetchLayer = (layer) => axios.get(`${API_URL}/geo/${layer}`);
