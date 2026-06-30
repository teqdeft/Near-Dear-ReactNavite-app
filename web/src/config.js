// Base URL of the NearDear backend API.
// The web panel runs in a desktop browser, so localhost reaches the backend directly.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
