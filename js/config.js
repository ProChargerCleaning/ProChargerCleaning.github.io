// ============================================================
// js/config.js — ProCharger Cleaning — Site Constants
// Phase 0: Extracted from index.html
// ============================================================

// --- COMPANY INFO ---
var PCC_CONFIG = {
  siteName:    'ProCharger Cleaning',
  sitePhone:   '(239) 887-7024',
  siteEmail:   'Info@prochargercleaning.com',
  siteAddress: 'Lehigh Acres, FL',
  serviceRadius: '60 miles',
  hours:       'Mon–Sat 7am–7pm | Sun: By Appointment',
  license:     '',
  insurer:     '',

  // Brand colors (matches CSS :root)
  colorCyan:   '#00BFFF',
  colorRed:    '#CC1111',
  colorGold:   '#FFD700',
  colorBg:     '#060810',
  colorBg2:    '#0a0f1e',
  colorBg3:    '#0d1525',
  colorText:   '#e8eaf0',
  colorMuted:  '#7a8090',

  // LocalStorage key for admin PIN
  adminPinKey: 'pcc_admin_pin',
  adminPinDefault: '****', // DO NOT store real PIN here

  // Apps Script web app URL (set in CRM Settings tab)
  appsScriptKey: 'pcc_apps_script_url',

  // Google Review link (set in CRM Settings tab)
  reviewUrlKey: 'pcc_review_url',
};

// --- SERVICE DEFINITIONS ---
var PCC_SERVICES = [
  {
    id:       'house',
    name:     'House Cleaning',
    icon:     '🏠',
    slug:     'house-cleaning',
    basePricePerSqft: 0.04,
    basePrice: 80,
    minPrice:  120,
    desc:     'Routine, deep clean, and move-in/move-out. Custom frequency options.',
    includes: [
      'Vacuum all floors & carpets',
      'Mop hard floors',
      'Dust all surfaces',
      'Clean bathrooms top-to-bottom',
      'Wipe kitchen surfaces',
      'Clean exterior of appliances',
      'Empty trash cans',
      'Sanitize high-touch areas',
    ],
  },
  {
    id:       'carpet',
    name:     'Carpet Cleaning',
    icon:     '🌀',
    slug:     'carpet-cleaning',
    basePricePerSqft: 0.20,
    basePrice: 60,
    minPrice:  80,
    desc:     'Hot-water extraction, stain treatment, pet odor elimination.',
    includes: [
      'Hot-water extraction',
      'Pre-treatment of stains',
      'Pet odor treatment',
      'Deodorizing application',
      'Edge & corner cleaning',
      'Fast-dry technique',
    ],
  },
  {
    id:       'tile',
    name:     'Tile & Grout',
    icon:     '🔲',
    slug:     'tile-grout',
    basePricePerSqft: 0.35,
    basePrice: 80,
    minPrice:  100,
    desc:     'Deep cleaning and sealing for tile floors, showers, backsplashes.',
    includes: [
      'High-pressure grout cleaning',
      'Tile surface scrubbing',
      'Grout sealing (optional)',
      'Shower & bath tile',
      'Kitchen backsplash',
      'Pool deck tile',
    ],
  },
  {
    id:       'pressure',
    name:     'Pressure Washing',
    icon:     '💦',
    slug:     'pressure-washing',
    basePricePerSqft: 0.03,
    basePrice: 100,
    minPrice:  80,
    desc:     'Exterior concrete, driveways, pool decks, roofs, fences.',
    includes: [
      'Driveways & walkways',
      'Pool decks',
      'Exterior walls',
      'Fences & gates',
      'Soft-wash for painted surfaces',
      'Roof cleaning available',
    ],
  },
  {
    id:       'deep',
    name:     'Deep Cleaning',
    icon:     '🧹',
    slug:     'deep-cleaning',
    basePricePerSqft: 0.06,
    basePrice: 120,
    minPrice:  200,
    desc:     'Full detail — inside appliances, baseboards, vents.',
    includes: [],
  },
  {
    id:       'moveinout',
    name:     'Move In / Move Out',
    icon:     '📦',
    slug:     'move-in-out',
    basePricePerSqft: 0.07,
    basePrice: 150,
    minPrice:  280,
    desc:     'Rental ready in one visit. Deposit-safe.',
    includes: [],
  },
];

// --- FREQUENCY DISCOUNTS ---
var PCC_FREQ_DISCOUNTS = {
  one:       { label: 'One-Time',            discount: 0.00 },
  monthly:   { label: 'Monthly (5% off)',     discount: 0.05 },
  biweekly:  { label: 'Bi-Weekly (10% off)', discount: 0.10 },
  weekly:    { label: 'Weekly (15% off)',     discount: 0.15 },
};

// --- ADD-ON PRICING ---
var PCC_ADDONS = [
  { id: 'oven',    label: 'Inside Oven',    price: 40 },
  { id: 'fridge',  label: 'Inside Fridge',  price: 35 },
  { id: 'windows', label: 'Windows',        price: 50 },
  { id: 'laundry', label: 'Laundry',        price: 25 },
  { id: 'pet',     label: 'Pet Treatment',  price: 60 },
  { id: 'garage',  label: 'Garage',         price: 45 },
];

// --- STATUS LABELS ---
var PCC_LEAD_STATUSES   = ['new', 'contacted', 'quoted', 'booked', 'lost'];
var PCC_JOB_STATUSES    = ['scheduled', 'in-progress', 'complete', 'invoiced', 'cancelled'];
var PCC_QUOTE_STATUSES  = ['pending', 'approved', 'invoiced', 'lost'];

// --- SERVICE AREA ---
var PCC_SERVICE_AREAS = [
  'Lehigh Acres',
  'Fort Myers',
  'Cape Coral',
  'Bonita Springs',
  'Naples',
  'Estero',
  'Port Charlotte',
  'Punta Gorda',
  'Marco Island',
  'Immokalee',
  'Sanibel/Captiva',
  'Sarasota area',
];

// --- NAV ROUTES ---
var PCC_ROUTES = [
  { id: 'home',             label: 'Home',          public: true  },
  { id: 'services',         label: 'Services',      public: true  },
  { id: 'quote',            label: 'Get Quote',     public: true  },
  { id: 'booking',          label: 'Book Now',      public: true  },
  { id: 'gallery',          label: 'Gallery',       public: true  },
  { id: 'about',            label: 'About',         public: true  },
  { id: 'portal',           label: 'Portal',        public: true  },
  { id: 'contact',          label: 'Contact',       public: true  },
  { id: 'admin',            label: 'Admin CRM',     public: false },
  { id: 'house-cleaning',   label: 'House Cleaning',public: true  },
  { id: 'carpet-cleaning',  label: 'Carpet',        public: true  },
  { id: 'tile-grout',       label: 'Tile & Grout',  public: true  },
  { id: 'pressure-washing', label: 'Pressure Wash', public: true  },
];

// --- EXPORT (for modules, no-op in browser) ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PCC_CONFIG, PCC_SERVICES, PCC_FREQ_DISCOUNTS, PCC_ADDONS, PCC_LEAD_STATUSES, PCC_JOB_STATUSES, PCC_QUOTE_STATUSES, PCC_SERVICE_AREAS, PCC_ROUTES };
}
