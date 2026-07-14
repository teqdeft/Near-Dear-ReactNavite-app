const { ok } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');

// POST /ai/parse-ambulance  { transcript }
//
// Returns the fields the AI could pull out of what the caller said. It never
// creates the request — the user reviews the pre-filled form and submits it
// through the normal booking endpoint. In an emergency, a machine's reading of
// "City Hospital" is a suggestion, not a decision.
const parseAmbulance = asyncHandler(async (req, res) => {
  const transcript = String(req.body?.transcript || '').trim();
  if (!transcript) throw ApiError.badRequest('Nothing was said — please speak or type first.');
  if (transcript.length > 1000) throw ApiError.badRequest('That is too long. Please keep it short.');

  const { fields, inferred } = await aiService.parseAmbulanceRequest(transcript);
  return ok(res, { fields, inferred, enabled: aiService.isEnabled() });
});

module.exports = { parseAmbulance };
