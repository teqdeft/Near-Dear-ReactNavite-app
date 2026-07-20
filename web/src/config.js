// Base URL of the NearDear backend API.
// The web panel runs in a desktop browser, so localhost reaches the backend directly.

const DEV_API_BASE_URL = 'http://localhost:4000/api/v1';
const PROD_API_BASE_URL = 'https://neardear.studioubique-dev.com/near-dear/api/v1';

// VITE_API_BASE_URL overrides both — set it to point a local build at a
// different backend (e.g. staging) without touching this file.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? DEV_API_BASE_URL : PROD_API_BASE_URL);

export default { API_BASE_URL };
