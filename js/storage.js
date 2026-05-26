/**
 * js/storage.js
 * PCC CRM — localStorage wrapper layer
 *
 * All reads and writes to localStorage go through these functions.
 * This makes it trivial to swap the back-end (e.g. Supabase) later —
 * just replace the bodies without touching any module that calls them.
 *
 * Keys are centralised in PCC_CONFIG.STORAGE_KEYS (js/config.js).
 * Import order:  config.js → storage.js → everything else
 */

'use strict';

/* ─────────────────────────────────────────────
   GENERIC HELPERS
   ───────────────────────────────────────────── */

/**
 * Safe JSON parse.  Returns fallback on any error.
 * @param {string} raw   - raw string from localStorage
 * @param {*}      fb    - fallback value (default [])
 */
function pccParse(raw, fb = []) {
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fb;
  } catch (e) {
    console.warn('[PCC Storage] JSON parse error:', e.message);
    return fb;
  }
}

/**
 * Safe JSON stringify + localStorage.setItem.
 * Returns true on success, false on failure (e.g. quota exceeded).
 * @param {string} key
 * @param {*}      value
 */
function pccStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[PCC Storage] Write error for key "' + key + '":', e.message);
    return false;
  }
}

/* ─────────────────────────────────────────────
   LEADS
   ───────────────────────────────────────────── */

/** @returns {Array} array of lead objects */
function pccGetLeads() {
  const key = 'pcc_leads';
  return pccParse(localStorage.getItem(key), []);
}

/** @param {Array} leads - full leads array to persist */
function pccSaveLeads(leads) {
  const key = 'pcc_leads';
  return pccStore(key, leads);
}

/** Append a single lead and persist. Returns the updated array. */
function pccAddLead(lead) {
  const leads = pccGetLeads();
  lead.id = lead.id || ('lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  lead.createdAt = lead.createdAt || new Date().toISOString();
  lead.status = lead.status || 'new';
  leads.push(lead);
  pccSaveLeads(leads);
  return leads;
}

/** Update a lead by id. Returns updated array or null if not found. */
function pccUpdateLead(id, changes) {
  const leads = pccGetLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) { console.warn('[PCC Storage] Lead not found:', id); return null; }
  leads[idx] = Object.assign({}, leads[idx], changes, { updatedAt: new Date().toISOString() });
  pccSaveLeads(leads);
  return leads;
}

/** Delete a lead by id. Returns updated array. */
function pccDeleteLead(id) {
  const leads = pccGetLeads().filter(l => l.id !== id);
  pccSaveLeads(leads);
  return leads;
}

/* ─────────────────────────────────────────────
   CUSTOMERS
   ───────────────────────────────────────────── */

function pccGetCustomers() {
  const key = 'pcc_customers';
  return pccParse(localStorage.getItem(key), []);
}

function pccSaveCustomers(customers) {
  const key = 'pcc_customers';
  return pccStore(key, customers);
}

function pccAddCustomer(customer) {
  const customers = pccGetCustomers();
  customer.id = customer.id || ('cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  customer.createdAt = customer.createdAt || new Date().toISOString();
  customer.jobCount = customer.jobCount || 0;
  customer.totalSpent = customer.totalSpent || 0;
  customers.push(customer);
  pccSaveCustomers(customers);
  return customers;
}

function pccUpdateCustomer(id, changes) {
  const customers = pccGetCustomers();
  const idx = customers.findIndex(c => c.id === id);
  if (idx === -1) { console.warn('[PCC Storage] Customer not found:', id); return null; }
  customers[idx] = Object.assign({}, customers[idx], changes, { updatedAt: new Date().toISOString() });
  pccSaveCustomers(customers);
  return customers;
}

function pccDeleteCustomer(id) {
  const customers = pccGetCustomers().filter(c => c.id !== id);
  pccSaveCustomers(customers);
  return customers;
}

/* ─────────────────────────────────────────────
   JOBS
   ───────────────────────────────────────────── */

function pccGetJobs() {
  const key = 'pcc_jobs';
  return pccParse(localStorage.getItem(key), []);
}

function pccSaveJobs(jobs) {
  const key = 'pcc_jobs';
  return pccStore(key, jobs);
}

function pccAddJob(job) {
  const jobs = pccGetJobs();
  job.id = job.id || ('job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  job.createdAt = job.createdAt || new Date().toISOString();
  job.status = job.status || 'scheduled';
  jobs.push(job);
  pccSaveJobs(jobs);
  return jobs;
}

function pccUpdateJob(id, changes) {
  const jobs = pccGetJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx === -1) { console.warn('[PCC Storage] Job not found:', id); return null; }
  jobs[idx] = Object.assign({}, jobs[idx], changes, { updatedAt: new Date().toISOString() });
  pccSaveJobs(jobs);
  return jobs;
}

function pccDeleteJob(id) {
  const jobs = pccGetJobs().filter(j => j.id !== id);
  pccSaveJobs(jobs);
  return jobs;
}

/* ─────────────────────────────────────────────
   QUOTES
   ───────────────────────────────────────────── */

function pccGetQuotes() {
  const key = 'pcc_quotes';
  return pccParse(localStorage.getItem(key), []);
}

function pccSaveQuotes(quotes) {
  const key = 'pcc_quotes';
  return pccStore(key, quotes);
}

function pccAddQuote(quote) {
  const quotes = pccGetQuotes();
  quote.id = quote.id || ('quote_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  quote.createdAt = quote.createdAt || new Date().toISOString();
  quote.status = quote.status || 'draft';
  quotes.push(quote);
  pccSaveQuotes(quotes);
  return quotes;
}

function pccUpdateQuote(id, changes) {
  const quotes = pccGetQuotes();
  const idx = quotes.findIndex(q => q.id === id);
  if (idx === -1) { console.warn('[PCC Storage] Quote not found:', id); return null; }
  quotes[idx] = Object.assign({}, quotes[idx], changes, { updatedAt: new Date().toISOString() });
  pccSaveQuotes(quotes);
  return quotes;
}

function pccDeleteQuote(id) {
  const quotes = pccGetQuotes().filter(q => q.id !== id);
  pccSaveQuotes(quotes);
  return quotes;
}

/* ─────────────────────────────────────────────
   REVIEWS
   ───────────────────────────────────────────── */

function pccGetReviews() {
  const key = 'pcc_reviews';
  return pccParse(localStorage.getItem(key), []);
}

function pccSaveReviews(reviews) {
  const key = 'pcc_reviews';
  return pccStore(key, reviews);
}

function pccAddReview(review) {
  const reviews = pccGetReviews();
  review.id = review.id || ('rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  review.createdAt = review.createdAt || new Date().toISOString();
  review.approved = review.approved !== undefined ? review.approved : false;
  reviews.push(review);
  pccSaveReviews(reviews);
  return reviews;
}

function pccUpdateReview(id, changes) {
  const reviews = pccGetReviews();
  const idx = reviews.findIndex(r => r.id === id);
  if (idx === -1) { console.warn('[PCC Storage] Review not found:', id); return null; }
  reviews[idx] = Object.assign({}, reviews[idx], changes, { updatedAt: new Date().toISOString() });
  pccSaveReviews(reviews);
  return reviews;
}

/* ─────────────────────────────────────────────
   SETTINGS
   ───────────────────────────────────────────── */

/** Returns the full settings object */
function pccGetSettings() {
  const key = 'pcc_settings';
  return pccParse(localStorage.getItem(key), {});
}

/** Merge partial changes into existing settings and persist */
function pccSaveSettings(changes) {
  const key = 'pcc_settings';
  const current = pccGetSettings();
  const merged = Object.assign({}, current, changes);
  return pccStore(key, merged);
}

/* ─────────────────────────────────────────────
   SESSION / AUTH
   ───────────────────────────────────────────── */

/** Returns true if an admin session is currently active */
function pccIsAuthenticated() {
  const key = 'pcc_admin_session';
  const session = pccParse(localStorage.getItem(key), null);
  if (!session || !session.loggedInAt) return false;
  // Sessions expire after 8 hours
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  return (Date.now() - new Date(session.loggedInAt).getTime()) < EIGHT_HOURS;
}

/** Persist a new admin session timestamp */
function pccSetSession() {
  const key = 'pcc_admin_session';
  return pccStore(key, { loggedInAt: new Date().toISOString() });
}

/** Clear the admin session (logout) */
function pccClearSession() {
  const key = 'pcc_admin_session';
  localStorage.removeItem(key);
}

/* ─────────────────────────────────────────────
   DRAFT (estimator / quote builder temp state)
   ───────────────────────────────────────────── */

function pccGetDraft() {
  const key = 'pcc_draft';
  return pccParse(localStorage.getItem(key), null);
}

function pccSaveDraft(draft) {
  const key = 'pcc_draft';
  return pccStore(key, draft);
}

function pccClearDraft() {
  const key = 'pcc_draft';
  localStorage.removeItem(key);
}

/* ─────────────────────────────────────────────
   DATA MIGRATION / INIT
   ───────────────────────────────────────────── */

/**
 * One-time migration: rename legacy flat keys to the namespaced keys
 * used by PCC_CONFIG.STORAGE_KEYS.  Safe to call on every app start.
 */
function pccMigrateStorageKeys() {
  const legacyMap = {
    leads:     'pcc_leads',
    customers: 'pcc_customers',
    jobs:      'pcc_jobs',
    quotes:    'pcc_quotes',
    reviews:   'pcc_reviews',
    settings:  'pcc_settings',
  };

  Object.entries(legacyMap).forEach(([legacyKey, newKey]) => {
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, legacyData);
      localStorage.removeItem(legacyKey);
      console.info('[PCC Storage] Migrated "' + legacyKey + '" → "' + newKey + '"');
    }
  });
}

/**
 * Seed empty arrays for all collections if they don't exist yet.
 * Prevents null-check boilerplate throughout the app.
 */
function pccInitStorage() {
  pccMigrateStorageKeys();
  if (!localStorage.getItem('pcc_leads'))     pccSaveLeads([]);
  if (!localStorage.getItem('pcc_customers')) pccSaveCustomers([]);
  if (!localStorage.getItem('pcc_jobs'))      pccSaveJobs([]);
  if (!localStorage.getItem('pcc_quotes'))    pccSaveQuotes([]);
  if (!localStorage.getItem('pcc_reviews'))   pccSaveReviews([]);
  console.info('[PCC Storage] Initialised.');
}

/* ─────────────────────────────────────────────
   EXPORT (future Node / module compat)
   ───────────────────────────────────────────── */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pccParse, pccStore,
    pccGetLeads, pccSaveLeads, pccAddLead, pccUpdateLead, pccDeleteLead,
    pccGetCustomers, pccSaveCustomers, pccAddCustomer, pccUpdateCustomer, pccDeleteCustomer,
    pccGetJobs, pccSaveJobs, pccAddJob, pccUpdateJob, pccDeleteJob,
    pccGetQuotes, pccSaveQuotes, pccAddQuote, pccUpdateQuote, pccDeleteQuote,
    pccGetReviews, pccSaveReviews, pccAddReview, pccUpdateReview,
    pccGetSettings, pccSaveSettings,
    pccIsAuthenticated, pccSetSession, pccClearSession,
    pccGetDraft, pccSaveDraft, pccClearDraft,
    pccMigrateStorageKeys, pccInitStorage,
  };
}
