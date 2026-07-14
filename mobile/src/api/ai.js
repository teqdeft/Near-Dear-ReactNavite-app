/**
 * AI endpoints. Kept out of api/index.js so the whole feature can be removed
 * by deleting files rather than unpicking edits.
 */
import client from './client';

export const AiApi = {
  // -> { fields: { patient_name?, pickup_address?, ... }, enabled: boolean }
  parseAmbulance: (transcript) =>
    client.post('/ai/parse-ambulance', { transcript }).then((r) => r.data?.data),
};

export default AiApi;
