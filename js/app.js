/**
 * js/app.js -- PCC CRM Application Bootstrap (v2 -- regex fix)
 * Load order: config -> storage -> router -> modules/* -> app.js
 */
'use strict';
(function () {

  var ADMIN_PIN_HASH_KEY = 'pcc_pin_hash';

  function _hashPin(pin) {
    var h = 0;
    for (var i = 0; i < pin.length; i++) h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
    return 'pcc_' + Math.abs(h).toString(16);
  }

  function _verifyPin(pin) {
    var stored = localStorage.getItem(ADMIN_PIN_HASH_KEY);
    if (!stored) { localStorage.setItem(ADMIN_PIN_HASH_KEY, _hashPin(pin)); return true; }
    return stored === _hashPin(pin);
  }

  function _renderLogin(msg) {
    var root = document.getElementById('admin-shell');
    if (!root) return;
    root.querySelectorAll('[data-page]').forEach(function (el) { el.style.display = 'none'; });
    var existing = document.getElementById('padmin-login-screen');
    if (existing) existing.remove();
    var panel = document.createElement('div');
    panel.id = 'padmin-login-screen';
    panel.className = 'padmin-login-screen';
    panel.innerHTML =
      '<div class="padmin-login-card">' +
        '<div class="padmin-login-logo">ProCharger<span>CRM</span></div>' +
        '<h2 class="padmin-login-title">Admin Login</h2>' +
        (msg ? '<p class="padmin-pin-error">' + msg + '</p>' : '') +
        '<form id="pcc-login-form">' +
          '<input id="pcc-pin-input" type="password" maxlength="12" placeholder="Enter PIN" autocomplete="current-password">' +
          '<button type="submit" class="pbtn pbtn-primary pbtn-full">Unlock</button>' +
        '</form></div>';
    root.appendChild(panel);
    document.getElementById('pcc-login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = document.getElementById('pcc-pin-input').value.trim();
      if (!pin) return;
      if (_verifyPin(pin)) {
        if (typeof pccSetSession === 'function') pccSetSession();
        panel.remove();
        pccRouter.go('#/dashboard');
      } else { _renderLogin('Incorrect PIN. Try again.'); }
    });
    setTimeout(function () { var inp = document.getElementById('pcc-pin-input'); if (inp) inp.focus(); }, 50);
  }

  function _requireAuth() {
    if (typeof pccIsAuthenticated === 'function' && pccIsAuthenticated()) return true;
    _renderLogin(); return false;
  }

  function _wireNavToggle() {
    var toggle = document.getElementById('nav-toggle');
    var sidebar = document.getElementById('admin-sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', function () { sidebar.classList.toggle('open'); });
    sidebar.addEventListener('click', function (e) { if (e.target.closest('a')) sidebar.classList.remove('open'); });
  }

  function _wireLogout() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('#logout-btn') || e.target.closest('[data-action="logout"]')) {
        if (typeof pccClearSession === 'function') pccClearSession();
        pccRouter.showPublicSite();
        window.location.hash = '#/';
      }
    });
  }

  function _wirePublicNav() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.length > 1 && href.charAt(1) !== '/') {
        var target = document.querySelector(href);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
      }
    });
  }

  function _wirePortalEntry() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="open-admin"]');
      if (!btn) return;
      e.preventDefault();
      pccRouter.showAdminShell();
      if (_requireAuth()) pccRouter.go('#/dashboard');
    });
  }

  function _registerRoutes() {
    pccRouter.register('#/', function () { pccRouter.showPublicSite(); });
    pccRouter.register('#/login', function () { pccRouter.showAdminShell(); _renderLogin(); });

    pccRouter.register('#/dashboard', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('dashboard');
      if (typeof pccDashboard !== 'undefined') pccDashboard.render();
    }, true);

    pccRouter.register('#/leads', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('leads');
      if (typeof pccLeads !== 'undefined') pccLeads.render();
    }, true);

    pccRouter.register('#/leads/new', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('leads');
      if (typeof pccLeads !== 'undefined') pccLeads.renderNew();
    }, true);

    pccRouter.register('#/customers', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('customers');
      if (typeof pccCustomers !== 'undefined') pccCustomers.render();
    }, true);

    pccRouter.register('#/customers/new', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('customers');
      if (typeof pccCustomers !== 'undefined') pccCustomers.renderNew();
    }, true);

    pccRouter.register('#/quotes', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('quotes');
      if (typeof pccQuotes !== 'undefined') pccQuotes.render();
    }, true);

    pccRouter.register('#/quotes/new', function (route, params) {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('quotes');
      if (typeof pccQuotes !== 'undefined') pccQuotes.renderNew(params);
    }, true);

    pccRouter.register('#/jobs', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('jobs');
      if (typeof pccJobs !== 'undefined') pccJobs.render();
    }, true);

    pccRouter.register('#/jobs/new', function (route, params) {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('jobs');
      if (typeof pccJobs !== 'undefined') pccJobs.renderNew(params);
    }, true);

    pccRouter.register('#/estimator', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell(); pccRouter.showPage('estimator');
      if (typeof pccEstimator !== 'undefined') pccEstimator.render();
    }, true);

pccRouter.register('#/settings', function () {
if (!_requireAuth()) return;
pccRouter.showAdminShell(); pccRouter.showPage('settings');
if (typeof pccSettings !== 'undefined') pccSettings.render();
}, true);

    /* Fallback detail routes -- string split only, no regex flags */
    pccRouter.notFound(function () {
      var hash  = window.location.hash;
      var parts = hash.replace('#/', '').split('/');
      var sec   = parts[0] || '';
      var id    = parts[1] ? parts[1].split('?')[0] : '';
      if (!id || id === 'new') { pccRouter.go('#/'); return; }
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      if      (sec === 'leads')     { pccRouter.showPage('leads');     if (typeof pccLeads     !== 'undefined') pccLeads.renderDetail(id);     }
      else if (sec === 'customers') { pccRouter.showPage('customers'); if (typeof pccCustomers !== 'undefined') pccCustomers.renderDetail(id); }
      else if (sec === 'quotes')    { pccRouter.showPage('quotes');    if (typeof pccQuotes    !== 'undefined') pccQuotes.renderDetail(id);    }
      else if (sec === 'jobs')      { pccRouter.showPage('jobs');      if (typeof pccJobs      !== 'undefined') pccJobs.renderDetail(id);      }
      else pccRouter.go('#/');
    });
  }

  function _wireAdminNav() {
    var links = document.querySelectorAll('#admin-sidebar a[data-nav]');
    window.addEventListener('hashchange', function () {
      var seg = (window.location.hash.replace('#/','').split('/')[0]) || '';
      links.forEach(function (a) {
        var ns = (a.getAttribute('data-nav') || '').replace('#/','').split('/')[0];
        a.classList.toggle('active', ns === seg);
      });
    });
  }

  function _wireTitleUpdater() {
    var titles = { '':'ProCharger Cleaning | SW Florida', 'dashboard':'Dashboard | PCC CRM',
      'leads':'Leads | PCC CRM', 'customers':'Customers | PCC CRM', 'quotes':'Quotes | PCC CRM',
      'jobs':'Jobs | PCC CRM', 'estimator':'Estimator | PCC CRM', 'settings':'Settings | PCC CRM', 'documents':'Documents | PCC CRM', 'compliance':'Compliance | PCC CRM', 'login':'Login | PCC CRM' };
    window.addEventListener('hashchange', function () {
      var seg = (window.location.hash.replace('#/','').split('/')[0]) || '';
      document.title = titles[seg] || 'PCC CRM';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    console.info('[PCC App] Booting...');
    if (typeof pccInitStorage === 'function') pccInitStorage();
    _registerRoutes();
    _wireNavToggle(); _wireLogout(); _wirePublicNav(); _wirePortalEntry();
    _wireAdminNav(); _wireTitleUpdater();
    pccRouter.init();
    console.info('[PCC App] Boot complete. Route:', pccRouter.current());
  });

  pccRouter.register('#/documents', function () {
    pccRouter.showAdminShell();
    pccRouter.showPage('documents');
    if (typeof pccDocuments !== 'undefined') { pccDocuments.render(); }
  });

  pccRouter.register('#/compliance', function () {
      if (!_requireAuth()) return;
      pccRouter.showAdminShell();
      pccRouter.showPage('compliance');
      if (typeof pccCompliance !== 'undefined') { pccCompliance.render(); }
  });

})();
