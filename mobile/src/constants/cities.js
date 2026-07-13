/**
 * Canonical city list, with the centre of each city.
 *
 * Two jobs, and it is important not to confuse them:
 *
 * 1. SPELLING. Donor / driver / pharmacy matching is done on the city NAME (see
 *    backend cityMatch.js) — there is no GPS radius there. A typo is therefore
 *    not cosmetic: a donor who saved "Mohaali" is invisible to every request in
 *    Mohali, and nobody finds out. Both sides pick from this one list so the
 *    spellings line up.
 *
 * 2. MAP START POINT. The coordinates are only where the map JUMPS TO when the
 *    user picks a city, so they drag a few hundred metres to their house instead
 *    of dragging across the country from a map centred on India. They are city
 *    centres, not addresses. What gets SAVED is always the user's own pin.
 *
 * Bundled rather than geocoded: no API key, no billing, no network, and it works
 * on every phone. The list is NOT exhaustive and isn't meant to be — free text
 * is always accepted, and two people who both type the same unlisted town still
 * match each other.
 */
const CITY_DATA = {
  // ---- Chandigarh tricity (listed in full: this is where the neighbouring-city
  // problem actually bites — these are all a few km apart) ----
  Chandigarh: [30.7333, 76.7794],
  Mohali: [30.7046, 76.7179],
  Kharar: [30.7460, 76.6469],
  Zirakpur: [30.6425, 76.8173],
  Panchkula: [30.6942, 76.8606],
  'Dera Bassi': [30.5892, 76.8434],
  Banur: [30.5551, 76.7185],
  Landran: [30.6889, 76.6589],
  'New Chandigarh': [30.7833, 76.7000],
  Kurali: [30.8318, 76.5735],
  Morinda: [30.7906, 76.4977],
  Lalru: [30.4939, 76.8033],

  // ---- Punjab ----
  Amritsar: [31.6340, 74.8723],
  Ludhiana: [30.9010, 75.8573],
  Jalandhar: [31.3260, 75.5762],
  Patiala: [30.3398, 76.3869],
  Bathinda: [30.2110, 74.9455],
  Pathankot: [32.2643, 75.6421],
  Hoshiarpur: [31.5322, 75.9119],
  Moga: [30.8158, 75.1717],
  Firozpur: [30.9331, 74.6225],
  Rupnagar: [30.9661, 76.5231],
  Sangrur: [30.2458, 75.8421],
  Barnala: [30.3745, 75.5462],
  'Fatehgarh Sahib': [30.6435, 76.3925],
  Phagwara: [31.2240, 75.7739],
  Nangal: [31.3900, 76.3750],
  Khanna: [30.7050, 76.2222],
  Malerkotla: [30.5252, 75.8792],
  Kapurthala: [31.3800, 75.3800],
  Muktsar: [30.4762, 74.5122],
  Faridkot: [30.6742, 74.7550],
  Mansa: [29.9988, 75.3933],
  Gurdaspur: [32.0417, 75.4053],
  Batala: [31.8186, 75.2028],
  Abohar: [30.1445, 74.1993],
  Malout: [30.2110, 74.4980],
  Rajpura: [30.4842, 76.5947],
  Nabha: [30.3752, 76.1500],
  Samana: [30.1520, 76.1930],
  Sunam: [30.1290, 75.7990],
  Jagraon: [30.7890, 75.4740],
  Nawanshahr: [31.1250, 76.1180],
  'Tarn Taran': [31.4520, 74.9280],
  Zira: [30.9680, 74.9910],
  Dhuri: [30.3680, 75.8680],
  // "Ropar" is the old name for Rupnagar. Only ONE spelling can be canonical:
  // matching is by name, so listing both would split the town in half — a donor
  // who picked "Ropar" would never match a request that said "Rupnagar".

  // ---- Haryana ----
  Ambala: [30.3782, 76.7767],
  Karnal: [29.6857, 76.9905],
  Kurukshetra: [29.9695, 76.8783],
  Yamunanagar: [30.1290, 77.2674],
  Panipat: [29.3909, 76.9635],
  Sonipat: [28.9931, 77.0151],
  Rohtak: [28.8955, 76.6066],
  Hisar: [29.1492, 75.7217],
  Gurugram: [28.4595, 77.0266],
  Faridabad: [28.4089, 77.3178],
  Sirsa: [29.5349, 75.0280],
  Kaithal: [29.8015, 76.3995],
  Jind: [29.3159, 76.3146],
  Bhiwani: [28.7930, 76.1397],
  Rewari: [28.1990, 76.6170],
  Palwal: [28.1447, 77.3260],
  Jhajjar: [28.6060, 76.6570],
  Fatehabad: [29.5150, 75.4550],
  Narnaul: [28.0440, 76.1060],
  Bahadurgarh: [28.6920, 76.9350],
  Pehowa: [29.9800, 76.5820],
  Pinjore: [30.7970, 76.9170],
  Kalka: [30.8400, 76.9370],

  // ---- Himachal Pradesh / J&K / Uttarakhand ----
  Shimla: [31.1048, 77.1734],
  Solan: [30.9045, 77.0967],
  Baddi: [30.9578, 76.7914],
  Nalagarh: [31.0490, 76.7220],
  Parwanoo: [30.8370, 76.9610],
  Dharamshala: [32.2190, 76.3234],
  Mandi: [31.7080, 76.9318],
  Kullu: [31.9576, 77.1095],
  Manali: [32.2432, 77.1892],
  Una: [31.4680, 76.2690],
  // Himachal's Hamirpur. There is another in Uttar Pradesh — one name can only
  // point at one place here, and this is the one in our service belt.
  Hamirpur: [31.6840, 76.5220],
  Chamba: [32.5560, 76.1260],
  Kangra: [32.0990, 76.2690],
  Jammu: [32.7266, 74.8570],
  Srinagar: [34.0837, 74.7973],
  Udhampur: [32.9159, 75.1416],
  Kathua: [32.3700, 75.5170],
  Dehradun: [30.3165, 78.0322],
  Haridwar: [29.9457, 78.1642],
  Rishikesh: [30.0869, 78.2676],
  Roorkee: [29.8543, 77.8880],
  Haldwani: [29.2183, 79.5130],
  Rudrapur: [28.9840, 79.4000],
  Kashipur: [29.2140, 78.9560],
  Nainital: [29.3803, 79.4636],
  Mussoorie: [30.4599, 78.0664],

  // ---- Delhi NCR ----
  Delhi: [28.7041, 77.1025],
  'New Delhi': [28.6139, 77.2090],
  Noida: [28.5355, 77.3910],
  'Greater Noida': [28.4744, 77.5040],
  Ghaziabad: [28.6692, 77.4538],

  // ---- Uttar Pradesh ----
  Lucknow: [26.8467, 80.9462],
  Kanpur: [26.4499, 80.3319],
  Varanasi: [25.3176, 82.9739],
  Agra: [27.1767, 78.0081],
  Meerut: [28.9845, 77.7064],
  Prayagraj: [25.4358, 81.8463],
  Bareilly: [28.3670, 79.4304],
  Aligarh: [27.8974, 78.0880],
  Gorakhpur: [26.7606, 83.3732],
  Jhansi: [25.4484, 78.5685],
  Moradabad: [28.8386, 78.7733],
  Saharanpur: [29.9640, 77.5460],
  Muzaffarnagar: [29.4727, 77.7085],
  Mathura: [27.4924, 77.6737],
  Firozabad: [27.1591, 78.3958],
  Ayodhya: [26.7922, 82.1998],
  Rampur: [28.8155, 79.0250],
  Shahjahanpur: [27.8815, 79.9100],
  Etawah: [26.7855, 79.0150],
  Mirzapur: [25.1460, 82.5690],
  Bulandshahr: [28.4030, 77.8580],
  Hapur: [28.7300, 77.7760],

  // ---- Rajasthan ----
  Jaipur: [26.9124, 75.7873],
  Jodhpur: [26.2389, 73.0243],
  Udaipur: [24.5854, 73.7125],
  Kota: [25.2138, 75.8648],
  Ajmer: [26.4499, 74.6399],
  Bikaner: [28.0229, 73.3119],
  Alwar: [27.5530, 76.6346],
  Bhilwara: [25.3470, 74.6350],
  Sikar: [27.6094, 75.1399],
  'Sri Ganganagar': [29.9038, 73.8772],
  Pali: [25.7720, 73.3230],
  Bharatpur: [27.2170, 77.4900],
  'Mount Abu': [24.5925, 72.7156],

  // ---- Gujarat ----
  Ahmedabad: [23.0225, 72.5714],
  Surat: [21.1702, 72.8311],
  Vadodara: [22.3072, 73.1812],
  Rajkot: [22.3039, 70.8022],
  Bhavnagar: [21.7645, 72.1519],
  Jamnagar: [22.4707, 70.0577],
  Gandhinagar: [23.2156, 72.6369],
  Junagadh: [21.5222, 70.4579],
  Anand: [22.5645, 72.9289],
  Bharuch: [21.7051, 72.9959],
  Nadiad: [22.6939, 72.8616],
  Bhuj: [23.2419, 69.6669],

  // ---- Maharashtra ----
  Mumbai: [19.0760, 72.8777],
  'Navi Mumbai': [19.0330, 73.0297],
  Thane: [19.2183, 72.9781],
  Pune: [18.5204, 73.8567],
  Nagpur: [21.1458, 79.0882],
  Nashik: [19.9975, 73.7898],
  Aurangabad: [19.8762, 75.3433],
  Amravati: [20.9320, 77.7523],
  Solapur: [17.6599, 75.9064],
  Kolhapur: [16.7050, 74.2433],
  Sangli: [16.8524, 74.5815],
  Jalgaon: [21.0077, 75.5626],
  Akola: [20.7002, 77.0082],
  Nanded: [19.1383, 77.3210],
  Latur: [18.4088, 76.5604],
  Ahmednagar: [19.0948, 74.7480],
  Satara: [17.6805, 74.0183],
  Chandrapur: [19.9615, 79.2961],
  Ratnagiri: [16.9902, 73.3120],

  // ---- Madhya Pradesh / Chhattisgarh ----
  Indore: [22.7196, 75.8577],
  Bhopal: [23.2599, 77.4126],
  Jabalpur: [23.1815, 79.9864],
  Gwalior: [26.2183, 78.1828],
  Ujjain: [23.1765, 75.7885],
  Sagar: [23.8388, 78.7378],
  Dewas: [22.9676, 76.0534],
  Ratlam: [23.3315, 75.0367],
  Rewa: [24.5373, 81.3042],
  Satna: [24.5700, 80.8320],
  Raipur: [21.2514, 81.6296],
  Bhilai: [21.2090, 81.4285],
  Korba: [22.3595, 82.7501],
  // Chhattisgarh's Bilaspur (the larger one). Himachal also has a Bilaspur —
  // a user there must type it as free text rather than pick this, or the map
  // would jump 1,000 km. Ambiguous names are the cost of matching on a name.
  Bilaspur: [22.0797, 82.1409],

  // ---- Karnataka / Telangana / Andhra ----
  Bengaluru: [12.9716, 77.5946],
  Mysuru: [12.2958, 76.6394],
  Mangaluru: [12.9141, 74.8560],
  Hubballi: [15.3647, 75.1240],
  Belagavi: [15.8497, 74.4977],
  Davangere: [14.4644, 75.9218],
  Ballari: [15.1394, 76.9214],
  Shivamogga: [13.9299, 75.5681],
  Hyderabad: [17.3850, 78.4867],
  Warangal: [17.9689, 79.5941],
  Karimnagar: [18.4386, 79.1288],
  Nizamabad: [18.6725, 78.0941],
  Visakhapatnam: [17.6868, 83.2185],
  Vijayawada: [16.5062, 80.6480],
  Guntur: [16.3067, 80.4365],
  Tirupati: [13.6288, 79.4192],
  Nellore: [14.4426, 79.9865],
  Kurnool: [15.8281, 78.0373],
  Rajahmundry: [17.0005, 81.8040],

  // ---- Tamil Nadu / Kerala / Puducherry / Goa ----
  Chennai: [13.0827, 80.2707],
  Coimbatore: [11.0168, 76.9558],
  Madurai: [9.9252, 78.1198],
  Tiruchirappalli: [10.7905, 78.7047],
  Salem: [11.6643, 78.1460],
  Tirunelveli: [8.7139, 77.7567],
  Erode: [11.3410, 77.7172],
  Vellore: [12.9165, 79.1325],
  Thoothukudi: [8.7642, 78.1348],
  Kochi: [9.9312, 76.2673],
  Thiruvananthapuram: [8.5241, 76.9366],
  Kozhikode: [11.2588, 75.7804],
  Thrissur: [10.5276, 76.2144],
  Kollam: [8.8932, 76.6141],
  Kannur: [11.8745, 75.3704],
  Alappuzha: [9.4981, 76.3388],
  Kottayam: [9.5916, 76.5222],
  Palakkad: [10.7867, 76.6548],
  Puducherry: [11.9416, 79.8083],
  Panaji: [15.4909, 73.8278],
  'Vasco da Gama': [15.3860, 73.8157],
  Margao: [15.2832, 73.9862],

  // ---- West Bengal / Odisha / Bihar / Jharkhand / North-East ----
  Kolkata: [22.5726, 88.3639],
  Howrah: [22.5958, 88.2636],
  Siliguri: [26.7271, 88.3953],
  Durgapur: [23.5204, 87.3119],
  Asansol: [23.6739, 86.9524],
  Darjeeling: [27.0360, 88.2627],
  Kharagpur: [22.3460, 87.2320],
  Bhubaneswar: [20.2961, 85.8245],
  Cuttack: [20.4625, 85.8830],
  Rourkela: [22.2604, 84.8536],
  Puri: [19.8135, 85.8312],
  Sambalpur: [21.4669, 83.9812],
  Patna: [25.5941, 85.1376],
  Gaya: [24.7955, 85.0002],
  Muzaffarpur: [26.1209, 85.3647],
  Bhagalpur: [25.2425, 86.9842],
  Darbhanga: [26.1542, 85.8918],
  Ranchi: [23.3441, 85.3096],
  Jamshedpur: [22.8046, 86.2029],
  Dhanbad: [23.7957, 86.4304],
  Bokaro: [23.6693, 86.1511],
  Guwahati: [26.1445, 91.7362],
  Dibrugarh: [27.4728, 94.9120],
  Silchar: [24.8333, 92.7789],
  Shillong: [25.5788, 91.8933],
  Agartala: [23.8315, 91.2868],
  Imphal: [24.8170, 93.9368],
  Aizawl: [23.7271, 92.7176],
  Itanagar: [27.0844, 93.6053],
  Kohima: [25.6751, 94.1086],
  Gangtok: [27.3314, 88.6138],
};

export const CITIES = Object.keys(CITY_DATA);

// Lowercased lookups: "is this a city we know?" and "where is it?".
const CITY_SET = new Set(CITIES.map((c) => c.toLowerCase()));
const COORDS_BY_LOWER = new Map(
  Object.entries(CITY_DATA).map(([name, [lat, lng]]) => [
    name.toLowerCase(), { latitude: lat, longitude: lng },
  ])
);

// True when `name` is a city we ship — one whose spelling we can trust to match
// what the other side typed.
export function isKnownCity(name) {
  return CITY_SET.has(String(name || '').trim().toLowerCase());
}

/**
 * Centre of a known city, or null.
 *
 * ONLY for moving the map to the right part of the country. Never treat this as
 * the user's address: it is a city centre and can be several km from where they
 * actually live. The saved pin must always be the one they placed themselves.
 */
export function cityCoords(name) {
  return COORDS_BY_LOWER.get(String(name || '').trim().toLowerCase()) || null;
}

/**
 * Autocomplete: cities matching `query`, prefix matches first (people type the
 * start of a name), then substring matches. `exclude` drops already-picked ones.
 */
export function suggestCities(query, { exclude = [], limit = 6 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const skip = new Set(exclude.map((c) => String(c).trim().toLowerCase()));

  const prefix = [];
  const substring = [];
  for (const city of CITIES) {
    const lc = city.toLowerCase();
    if (skip.has(lc)) continue;
    if (lc.startsWith(q)) prefix.push(city);
    else if (lc.includes(q)) substring.push(city);
    // Enough prefix hits to fill the list — nothing below can rank higher.
    if (prefix.length >= limit) break;
  }
  return prefix.concat(substring).slice(0, limit);
}
