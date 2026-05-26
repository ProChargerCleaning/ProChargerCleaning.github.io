/**
 * js/app.js
 * PCC CRM -- Application Bootstrap
 *
 * This is the single entry point. It runs after all other scripts are
 * loaded and does four things:
 *
 *   1. Initialises localStorage (pccInitStorage)
 *   2. Registers every route with pccRouter
 *   3. Wires up the admin login / logout flow
 *   4. Calls pccRouter.init() to dispatch the current URL hash
 *
 * Load order in index.html:
 *   config.js -> storage.js -> router.js ->
 *   modules/dashboard.js -> modules/leads.js -> modules/customers.js ->
 *   modules/quotes.js -> modules/jobs.js -> modules/estimator.js ->
 *   app.js  (this file, last)
 */

'use strict';

(function () {

  /* ── PIN auth (no plaintext PIN stored here -- checked against hash) ── */
  var ADMIN_PIN_HASH_KEY = 'pcc_pin_hash';

  function _hashPin(pin) {
    /* Simple deterministic hash -- good enough for a local CRM.
       Phase 1 will replace this with Supabase Auth. */
    var h = 0;
    for (var i = 0; i < pin.length; i++) {
      h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
    }
    return 'pcc_' + Math.abs(h).toString(16);
  }

  function _verifyPin(pin) {
    var stored = localStorage.getItem(ADMIN_PIN_HASH_KEY);
    if (!stored) {
      /* First run: no PIN set -- accept and store */
      localStorage.setItem(ADMIN_PIN_HASH_KEY, _hashPin(pin));
      return true;
    }
    return stored === _hashPin(pin);
  }

  /* ── Login form ──────────────────────────────────────────────────── */
  function _renderLogin(msg) {
    var root = document.getElementById('admin-shell');
    if (!root) return;

    /* Hide all admin pages, show login panel */
    root.querySelectorAll('[data-page]').forEach(function (el) { el.style.display = 'none'; });

    var existing = document.getElementById('pcc-login-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'pcc-login-panel';
    panel.className = 'pcc-login-panel';
    panel.innerHTML =
      '<div class="pcc-login-card">' +
        '<div class="pcc-login-logo">ProCharger<span>CRM</span></div>' +
        '<h2 class="pcc-login-title">Admin Login</h2>' +
        (msg ? '<p class="pcc-login-error">' + msg + '</p>' : '') +
        '<form id="pcc-login-form">' +
          '<input id="pcc-pin-input" type="password" maxlength="12" placeholder="Enter PIN" autocomplete="current-password">' +
          '<button type="submit" class="pcc-btn pcc-btn-primary pcc-btn-full">Unlock</button>' +
        '</form>' +
      '</div>';

    root.appendChild(panel);

    document.getElementById('pcc-login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = document.getElementById('pcc-pin-input').value.trim();
      if (!pin) return;
      if (_verifyPin(pin)) {
        if (typeof pccSetSession === 'function') pccSetSession();
        panel.remove();
        pccRouter.go('#/dashboard');
      } else {
        _renderLogin('Incorrect PIN. Try again.');
      }
    });

    /* Focus PIN input */
    setTimeout(function () {
      var inp = document.getElementById('pcc-pin-input');
      if (inp) inp.focus();
    }, 50);
  }

  /* ── Auth guard helper ───────────────────────────────────────────── */
  function _requireAuth() {
    if (typeof pccIsAuthenticated === 'function' && pccIsAuthenticated()) return true;
    _renderLogin();
    return false;
  }

  /* ── Admin nav sidebar toggle (mobile) ───────────────────────────── */
  function _wireNavToggle() {
    var toggle = document.getElementById('nav-toggle');
    var sidebar = document.getElementById('admin-sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    /* Close sidebar when a nav link is clicked on mobile */
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a')) sidebar.classList.remove('open');
    });
  }

  /* ── Logout ──────────────────────────────────────────────────────── */
  function _wireLogout() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('#logout-btn')) {
        if (typeof pccClearSession === 'function') pccClearSession();
        pccRouter.showPublicSite();
        window.location.hash = '#/';
      }
    });
  }

  /* ── Public-site nav (smooth scroll) ────────────────────────────── */
  function _wirePublicNav() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]:not([href^="#/"])');
      if (!a) return;
      var target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  }

  /* ── Admin portal entry (the "Admin" link on the public site) ────── */
  function _wirePortalEntry() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="open-admin"]');
      if (!btn) return;
      e.preventDefault();
      pccRouter.showAdminShell();
      if (_requireAuth()) pccRouter.go('#/dashboard');
    });
  }

  /* ── Register all routes ─────────────────────────────────────────── */
  function _registerRoutes() {

    /* ── Public routes ── */
    pccRouter.register('#/', function () {
      pccRouter.showPublicSite();
    });

    /* ── Admin auth ── */
    pccRouter.register('#/login', function () {
      pccRouter.showAdminShell();
      _renderLogin();
    });

    /* ── Dashboard ── */
    pccRouter.register('#/dashboard', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('dashboard');
      if (typeof pccDashboard !== 'undefined') pccDashboard.render();
    }, true);

    /* ── Leads ── */
    pccRouter.register('#/leads', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('leads');
      if (typeof pccLeads !== 'undefined') pccLeads.render();
    }, true);

    pccRouter.register('#/leads/new', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('leads');
      if (typeof pccLeads !== 'undefined') pccLeads.renderNew();
    }, true);

    /* leads/:id handled via segment match + params below */
    pccRouter.register('#/leads', function (route, params) {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('leads');
      var id = window.location.hash.replace('#/leads/', '').split('?')[0];
      if (id && id !== 'new' && typeof pccLeads !== 'undefined') pccLeads.renderDetail(id);
    }, true);

    /* ── Customers ── */
    pccRouter.register('#/customers', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('customers');
      if (typeof pccCustomers !== 'undefined') pccCustomers.render();
    }, true);

    pccRouter.register('#/customers/new', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('customers');
      if (typeof pccCustomers !== 'undefined') pccCustomers.renderNew();
    }, true);

    /* ── Quotes ── */
    pccRouter.register('#/quotes', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('quotes');
      if (typeof pccQuotes !== 'undefined') pccQuotes.render();
    }, true);

    pccRouter.register('#/quotes/new', function (route, params) {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('quotes');
      if (typeof pccQuotes !== 'undefined') pccQuotes.renderNew(params);
    }, true);

    /* ── Jobs ── */
    pccRouter.register('#/jobs', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('jobs');
      if (typeof pccJobs !== 'undefined') pccJobs.render();
    }, true);

    pccRouter.register('#/jobs/new', function (route, params) {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('jobs');
      if (typeof pccJobs !== 'undefined') pccJobs.renderNew(params);
    }, true);

    /* ── Estimator ── */
    pccRouter.register('#/estimator', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('estimator');
      if (typeof pccEstimator !== 'undefined') pccEstimator.render();
    }, true);

    /* ── Fallback: deep detail routes (/:id) ─────────────────────── */
    pccRouter.notFound(function () {
      var hash = window.location.hash;

      /* /leads/:id */
      if (/^#/leads/[^/]+$/.test(hash) && hash !== '#/leads/new') {
        if (!_requireAuth()) return;
        pccRouter.showAdminShell(); pccRouter.showPage('leads');
        var lid = hash.replace('#/leads/', '').split('?')[0];
        if (typeof pccLeads !== 'undefined') pccLeads.renderDetail(lid);
        return;
      }
      /* /customers/:id */
      if (/^#/customers/[^/]+$/.test(hash) && hash !== '#/customers/new') {
        if (!_requireAuth()) return;
        pccRouter.showAdminShell(); pccRouter.showPage('customers');
        var cid = hash.replace('#/customers/', '').split('?')[0];
        if (typeof pccCustomers !== 'undefined') pccCustomers.renderDetail(cid);
        return;
      }
      /* /quotes/:id */
      if (/^#/quotes/[^/]+$/.test(hash) && hash !== '#/quotes/new') {
        if (!_requireAuth()) return;
        pccRouter.showAdminShell(); pccRouter.showPage('quotes');
        var qid = hash.replace('#/quotes/', '').split('?')[0];
        if (typeof pccQuotes !== 'undefined') pccQuotes.renderDetail(qid);
        return;
      }
      /* /jobs/:id */
      if (/^#/jobs/[^/]+$/.test(hash) && hash !== '#/jobs/new') {
        if (!_requireAuth()) return;
        pccRouter.showAdminShell(); pccRouter.showPage('jobs');
        var jid = hash.replace('#/jobs/', '').split('?')[0];
        if (typeof pccJobs !== 'undefined') pccJobs.renderDetail(jid);
        return;
      }

      /* True 404 -- go home */
      console.warn('[PCC App] Unknown route:', hash);
      pccRouter.go('#/');
    });
  }

  /* ── Admin nav active-link highlight ─────────────────────────────── */
  function _wireAdminNav() {
    var links = document.querySelectorAll('#admin-sidebar a[data-nav]');
    window.addEventListener('hashchange', function () {
      var seg = window.location.hash.split('/')[1] || '';
      links.forEach(function (a) {
        var navSeg = (a.getAttribute('data-nav') || '').replace('#/','').split('/')[0];
        a.classList.toggle('active', navSeg === seg);
      });
    });
  }

  /* ── Page title updater ──────────────────────────────────────────── */
  function _wireTitleUpdater() {
    var titles = {
      '':           'ProCharger Cleaning | SW Florida',
      'dashboard':  'Dashboard | PCC CRM',
      'leads':      'Leads | PCC CRM',
      'customers':  'Customers | PCC CRM',
      'quotes':     'Quotes | PCC CRM',
      'jobs':       'Jobs | PCC CRM',
      'estimator':  'Estimator | PCC CRM',
      'login':      'Login | PCC CRM',
    };
    window.addEventListener('hashchange', function () {
      var seg   = (window.location.hash.replace('#/','').split('/')[0]) || '';
      document.title = titles[seg] || 'PCC CRM';
    });
  }

  /* ── BOOT ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    console.info('[PCC App] Booting...');

    /* 1. Init storage (seed empty arrays, run migrations) */
    if (typeof pccInitStorage === 'function') pccInitStorage();

    /* 2. Register routes */
    _registerRoutes();

    /* 3. Wire UI helpers */
    _wireNavToggle();
    _wireLogout();
    _wirePublicNav();
    _wirePortalEntry();
    _wireAdminNav();
    _wireTitleUpdater();

    /* 4. Start the router -- dispatches current hash */
    pccRouter.init();

    console.info('[PCC App] Boot complete. Route:', pccRouter.current());
  });

})();
