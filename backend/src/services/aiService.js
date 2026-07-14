/**
 * AI parsing for ambulance booking (Google Gemini).
 *
 * Free-tier Gemini via plain HTTP — deliberately no SDK, so this feature adds
 * no dependency and can be removed by deleting three files.
 *
 * Emergency rule: if the AI is down, slow, or returns nonsense, the caller must
 * still be able to book by typing. Every failure path here returns "no fields
 * extracted" rather than throwing, so the form simply stays empty.
 *
 * Env:
 *   GEMINI_API_KEY   required — without it the feature reports itself disabled
 *   GEMINI_MODEL     optional — model IDs change often; override without a deploy
 */
const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || '';
// flash-lite parses these sentences in ~1.2s. The bigger flash models take ~12s
// for no gain in accuracy, which in an emergency reads as a hung app.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const AMBULANCE_TYPES = ['any', 'basic', 'oxygen', 'icu'];

// Gemini's schema dialect (an OpenAPI subset) — types are upper-case, and
// constraining the response this way is what guarantees we get parseable JSON
// back instead of prose wrapped in ```json fences.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    patient_name: { type: 'STRING', description: 'Name of the patient. Empty if not stated.' },
    contact_mobile: { type: 'STRING', description: '10-digit mobile if spoken. Empty otherwise.' },
    pickup_address: { type: 'STRING', description: 'Where the ambulance must come.' },
    drop_address: { type: 'STRING', description: 'Hospital or destination.' },
    city: { type: 'STRING', description: 'City name only.' },
    ambulance_type: { type: 'STRING', enum: AMBULANCE_TYPES },
    notes: { type: 'STRING', description: "Patient's condition, in English, a few words." },
  },
};

const SYSTEM_PROMPT = `You are taking an ambulance call in India. The caller is frightened
and in a hurry. Read what they said and fill in the booking form for them.

They may speak Hindi, English, or the two mixed — in Roman letters ("saans nahi aa raha")
or in Devanagari ("साँस नहीं आ रहा"). It reaches you through speech-to-text, so expect no
punctuation, stray filler ("umm", "jaldi", "please"), repeated words, and half-sentences.
Read past all of that.

===================================================================
THE ONE RULE: fill a field only from what they said. Never from what you assume.
===================================================================
An empty field costs the caller a few seconds of typing. A field you made up gets read,
believed, and booked on. When you are unsure, leave it empty — that is the safe answer,
not the lazy one.

Quote names and places back in the SAME script the caller used. If they wrote Devanagari,
answer in Devanagari — do not transliterate or translate them.
    "नाम रमेश कुमार"                      -> patient_name "रमेश कुमार", not "Ramesh Kumar"
    "सिटी हॉस्पिटल ले जाना है"              -> drop_address "सिटी हॉस्पिटल"

Two fields break that rule and are ALWAYS written in English:
  city   — drivers are matched to a request by city name, and they registered theirs
           in English. "गुड़गांव" must come back as "Gurgaon", or no driver is found.
  notes  — a driver anywhere in India has to be able to read it.

patient_name
  Only a name they actually spoke. Relationship words are not names.
    "papa ko saans nahi aa raha"          -> ""            (papa is not a name)
    "mere pita Ramesh Kumar ko"           -> "Ramesh Kumar"
    "patient ka naam Sunita Devi hai"     -> "Sunita Devi"
  Strip honorifics that are not part of the name: "Sharma ji" -> "Sharma".

contact_mobile
  A 10-digit Indian mobile only, digits alone. Drop +91, 0, spaces, dashes.
    "mera number 98765 43210"             -> "9876543210"
    "call kar lena"                       -> ""
  A number that is not 10 digits is not a phone number. Leave it empty.

pickup_address
  Where the ambulance must come — the locality, sector, street, building, landmark.
  Take the words as given; do not tidy them into a postal address.
    "Sector 22 Gurgaon mein hoon"         -> "Sector 22"
    "Chamba Chowgan me hu"                -> "Chowgan"
    "ghar pe hoon"                        -> ""            (that is not an address)

city
  Usually the caller names their locality and never their city. Making a panicking
  person type "Delhi" is absurd, so here — and ONLY here — you may work it out.
    said the city         "Sector 22 Gurgaon"    -> "Gurgaon"
    said only a locality  "Rohini mein hoon"     -> "Delhi"    (you are sure)
                          "Bandra me hoon"       -> "Mumbai"   (you are sure)
    not sure which city   "Shanti Nagar me hoon" -> ""         (there are many)
  The caller is shown any city you worked out, and can correct it. But a city you are
  merely guessing at sends the ambulance to another town — so if you are not sure,
  leave it empty. This licence covers city and nothing else.

drop_address
  The hospital or destination, only if they named one.
    "City Hospital le jaana hai"          -> "City Hospital"
    "AIIMS le chalo"                      -> "AIIMS"
    "koi bhi paas wala hospital"          -> ""            (they named none)
    "sabse acche hospital le chalo"       -> ""

===================================================================
The two fields where you SHOULD think — the caller describes a condition,
your job is to name it. Reading them wrong is the whole reason they called.
===================================================================
ambulance_type — one of: oxygen, icu, basic, any
  oxygen  breathing trouble: saans nahi aa rahi, dam ghut raha, chest tight,
          asthma attack, oxygen level gir gaya, choking, doob gaya (drowning)
  icu     life-threatening: heart attack, dil ka daura, chest pain, stroke, paralysis,
          behosh / unconscious, seizure / mirgi ka daura, severe bleeding, khoon bahut
          beh raha, major accident, badly burnt, critical, ventilator chahiye
  basic   stable but needs transport: fracture, haddi/paer/haath toot gaya, chot lagi,
          cut, fever, pet dard, delivery / labour pain, dialysis, hospital transfer,
          discharge, checkup
  any     they described no condition, or it is genuinely unclear
  If a case fits both oxygen and icu, choose icu — it carries oxygen too. Do not
  downgrade an emergency to save a resource.

notes — the condition in short plain English, two to five words. Always in English
  even when they spoke Hindi, because a driver anywhere in India must read it.
    "saans nahi aa raha"                  -> "Breathing difficulty"
    "behosh ho gayi hai"                  -> "Unconscious"
    "paer toot gaya cricket khelte time"  -> "Leg fracture"
    "dard ho raha hai seene mein"         -> "Chest pain"
  If they described no condition at all, leave notes empty. "Ambulance required" tells
  the driver nothing he does not already know.
  If more than one person is hurt, say so — he has to know before he loads the vehicle.
    "papa aur mummy dono ko chot lagi"    -> "Two injured in accident"

===================================================================
Worked examples
===================================================================
"papa ko saans nahi aa raha, main Sector 22 Gurgaon mein hoon, City Hospital le jaana
hai, unka naam Ramesh Kumar hai"
{"patient_name":"Ramesh Kumar","contact_mobile":"","pickup_address":"Sector 22",
 "drop_address":"City Hospital","city":"Gurgaon","ambulance_type":"oxygen",
 "notes":"Breathing difficulty"}

"dadi behosh ho gayi, Rohini mein hoon, jaldi bhejo"
{"patient_name":"","contact_mobile":"","pickup_address":"Rohini","drop_address":"",
 "city":"Delhi","ambulance_type":"icu","notes":"Unconscious"}
   — no name (dadi is a relation), no hospital named, city worked out from Rohini.

"ambulance chahiye Karol Bagh me"
{"patient_name":"","contact_mobile":"","pickup_address":"Karol Bagh","drop_address":"",
 "city":"Delhi","ambulance_type":"any","notes":""}
   — no condition described, so no type and no notes. Do not pad them.

Fill nothing you were not told. Then stop.`;

/** True when the feature is configured. Lets the API answer honestly instead of 500ing. */
function isEnabled() {
  return Boolean(API_KEY);
}

// Every failure — no key, rate limit, timeout, unparseable reply — lands here.
// The caller gets an empty form rather than an error, and books by typing.
const EMPTY = { fields: {}, inferred: [] };

/**
 * Turn a spoken/typed sentence into booking fields.
 * Returns { fields, inferred } — `inferred` lists fields worked out, not heard.
 */
async function parseAmbulanceRequest(transcript) {
  if (!isEnabled()) return EMPTY;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: transcript }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  };

  let raw;
  try {
    const { data } = await axios.post(ENDPOINT, body, {
      params: { key: API_KEY },
      timeout: 15000,
    });
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (err) {
    // Rate limit, network, bad key — all the same to the caller: no autofill.
    // eslint-disable-next-line no-console
    console.error('[ai] Gemini request failed:', err.response?.data?.error?.message || err.message);
    return EMPTY;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }

  return clean(parsed, transcript);
}

// Fields that must be quoted back from the caller, never deduced. A hallucinated
// name, phone number or hospital is worse than an empty box: the caller reads it,
// believes it, and books on it.
//
// city is deliberately absent. Callers name their locality, not their city, and
// deducing "Rohini -> Delhi" saves real seconds in an emergency. The deduction is
// returned flagged, so the caller sees which field was guessed and can fix it.
//
// ambulance_type and notes are absent for a different reason: reading a condition
// and naming it is the entire point of the feature.
const MUST_BE_SPOKEN = ['patient_name', 'contact_mobile', 'pickup_address', 'drop_address'];

// Unicode-aware, because Hindi voice typing produces Devanagari and an ASCII-only
// filter would reduce "रमेश कुमार" to nothing — reading a correctly-heard name as
// invented and throwing it away.
//
// \p{M} is not optional. Devanagari vowel signs are combining marks, not letters, so
// without it "रोहिणी" is shredded into "र ह ण" — three one-letter fragments that the
// length filter below then discards, and a locality the caller plainly said gets
// dropped as a hallucination. NFC for the same reason at the byte level.
const normalize = (s) =>
  s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

const digitsOnly = (s) => s.replace(/\D/g, '');

/**
 * Did the caller actually say this? Every meaningful word of the value must appear
 * in what they said.
 *
 * Asking the model not to guess is not the same as it not guessing — told only in
 * the prompt, it still turned "Rohini mein hoon" into city "Delhi". True, and still
 * wrong: a model confident about geography is equally confident when it is mistaken.
 * So the prompt asks, and this enforces.
 */
function wasSpoken(key, value, transcript) {
  // A phone number is one thing however it is spaced. "98765 43210" spoken and
  // "9876543210" written are the same number, and a word-by-word match would throw
  // the correct one away.
  if (key === 'contact_mobile') {
    const num = digitsOnly(value);
    return num.length === 10 && digitsOnly(transcript).includes(num);
  }

  const said = normalize(transcript);
  const words = normalize(value).split(' ').filter((w) => w.length > 1);
  if (!words.length) return false;
  return words.every((w) => said.includes(w));
}

/**
 * Keep what the model filled, drop what it invented, and report which surviving
 * fields it worked out rather than heard — the caller is shown those to check.
 *
 * Returns { fields, inferred } where inferred is a list of field names.
 */
function clean(parsed, transcript) {
  const fields = {};
  const inferred = [];

  for (const [key, value] of Object.entries(parsed || {})) {
    if (!RESPONSE_SCHEMA.properties[key]) continue;
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    if (key === 'ambulance_type' && !AMBULANCE_TYPES.includes(text)) continue;

    if (MUST_BE_SPOKEN.includes(key) && !wasSpoken(key, text, transcript)) {
      // eslint-disable-next-line no-console
      console.warn(`[ai] dropped invented ${key}: "${text}"`);
      continue;
    }

    // Kept, but the caller never said it — flag it so the UI can ask them to look.
    if (key === 'city' && !wasSpoken(key, text, transcript)) inferred.push('city');

    fields[key] = key === 'contact_mobile' ? digitsOnly(text) : text;
  }

  return { fields, inferred };
}

module.exports = { parseAmbulanceRequest, isEnabled };
