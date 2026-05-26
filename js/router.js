/**
 * js/router.js
 * PCC CRM — hash-based client-side router
 *
 * Handles all navigation inside the single-page CRM.
 * Public pages (home, services, etc.) and admin pages (dashboard,
 * leads, customers, …) are both driven by window.location.hash.
 *
 * Load order:  config.js → storage.js → router.js → modules → app.js
 *
 * Usage:
 *   pccRouter.init()          — call once from app.js on DOMContentLoaded
 *   pccRouter.go('#/leads')   — programmatic navigation
 *   pccRouter.current()       — returns active route string
 */

'use strict';

var pccRouter = (function () {

  /* ─── private state ─────────────────────────────────────────────── */
  var _currentRoute = '';
  var _routes       = {};   // hash → { handler, requiresAuth }
  var _notFound     = null; // fallback handler

  /* ─── helpers ───────────────────────────────────────────────────── */

  /** Normalise a hash string — always starts with '#/' */
  function _norm(hash) {
    if (!hash || hash === '#' || hash === '#/') return '#/';
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    if (hash.charAt(1) !== '/') hash = '#/' + hash.slice(1);
    return hash;
  }

  /** Pull the first path segment after '#/' e.g. '#/leads/edit' → 'leads' */
  function _segment(hash) {
    return _norm(hash).replace('#/', '').split('/')[0] || '';
  }

  /** Resolve the handler for the given hash. Falls back to _notFound. */
  function _resolve(hash) {
    var norm = _norm(hash);
    // exact match first
    if (_routes[norm]) return { route: norm, def: _routes[norm] };
    // segment match (e.g. '#/leads/edit/123' → '#/leads')
    var seg = '#/' + _segment(norm);
    if (_routes[seg]) return { route: seg, def: _routes[seg] };
    return { route: norm, def: _notFound };
  }

  /* ─── public API ────────────────────────────────────────────────── */

  /**
   * Register a route.
   * @param {string}   hash         e.g. '#/leads'
   * @param {Function} handler      called with (hash, params) when route activates
   * @param {boolean}  requiresAuth guard — redirects to '#/login' if not authenticated
   */
  function register(hash, handler, requiresAuth) {
    _routes[_norm(hash)] = {
      handler:     handler,
      requiresAuth: !!requiresAuth,
    };
  }

  /** Register the 404 / fallback handler */
  function notFound(handler) {
    _notFound = { handler: handler, requiresAuth: false };
  }

  /**
   * Navigate programmatically.
   * Updates window.location.hash which triggers the hashchange listener.
   */
  function go(hash) {
    var norm = _norm(hash);
    if (window.location.hash === norm) {
      // Same route — force a re-render
      _dispatch(norm);
    } else {
      window.location.hash = norm;
    }
  }

  /** Returns the currently active route string */
  function current() { return _currentRoute; }

  /**
   * Dispatch: resolve + auth-guard + call handler.
   * @param {string} hash  raw window.location.hash value
   */
  function _dispatch(hash) {
    var resolved = _resolve(hash || '#/');
    var def      = resolved.def;

    if (!def || !def.handler) {
      console.warn('[PCC Router] No handler for:', hash);
      return;
    }

    // Auth guard
    if (def.requiresAuth && typeof pccIsAuthenticated === 'function') {
      if (!pccIsAuthenticated()) {
        console.info('[PCC Router] Auth required, redirecting to #/login');
        window.location.hash = '#/login';
        return;
      }
    }

    _currentRoute = resolved.route;

    // Parse simple query params from hash  e.g. #/leads?id=abc&tab=notes
    var params = {};
    var qIdx   = hash.indexOf('?');
    if (qIdx !== -1) {
      hash.slice(qIdx + 1).split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }

    try {
      def.handler(resolved.route, params);
    } catch (e) {
      console.error('[PCC Router] Handler error on route "' + resolved.route + '":', e);
    }

    // Scroll admin content pane to top on route change
    var mainEl = document.getElementById('main-content') ||
                 document.querySelector('.admin-content') ||
                 document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;

    // Update any active nav links
    _updateNavLinks(resolved.route);
  }

  /** Mark the matching nav link as active, clear others */
  function _updateNavLinks(activeRoute) {
    var seg = _segment(activeRoute);
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      var elSeg = _segment(el.getAttribute('data-nav') || '');
      el.classList.toggle('active', elSeg === seg && seg !== '');
    });
  }

  /**
   * Initialise the router.
   * Call once from app.js after all routes are registered.
   */
  function init() {
    // Handle browser back/forward and direct hash changes
    window.addEventListener('hashchange', function () {
      _dispatch(window.location.hash);
    });

    // Intercept <a href="#/..."> clicks (avoids full page scroll-to-top)
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      var href = anchor.getAttribute('href');
      if (href && href.startsWith('#/')) {
        e.preventDefault();
        go(href);
      }
    });

    // Dispatch the current hash on load (or default to '#/')
    _dispatch(window.location.hash || '#/');

    console.info('[PCC Router] Initialised. Active route:', _currentRoute);
  }

  /* ─── convenience: show / hide page sections ────────────────────── */

  /**
   * Helper used by handlers to show one section and hide the rest.
   * All sections should have the attribute  data-page="routeName".
   * e.g. <section data-page="leads"> … </section>
   */
  function showPage(name) {
    document.querySelectorAll('[data-page]').forEach(function (el) {
      var visible = el.getAttribute('data-page') === name;
      el.style.display = visible ? '' : 'none';
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  /**
   * Hide all public sections and show only the admin shell.
   * Useful when transitioning from public → admin view.
   */
  function showAdminShell() {
    var pub   = document.getElementById('public-site');
    var admin = document.getElementById('admin-shell');
    if (pub)   pub.style.display   = 'none';
    if (admin) admin.style.display = '';
  }

  /**
   * Hide admin shell, show public site.
   */
  function showPublicSite() {
    var pub   = document.getElementById('public-site');
    var admin = document.getElementById('admin-shell');
    if (pub)   pub.style.display   = '';
    if (admin) admin.style.display = 'none';
  }

  /* ─── expose ─────────────────────────────────────────────────────── */
  return {
    register:       register,
    notFound:       notFound,
    go:             go,
    current:        current,
    init:           init,
    showPage:       showPage,
    showAdminShell: showAdminShell,
    showPublicSite: showPublicSite,
    // expose internals for testing
    _norm:          _norm,
    _segment:       _segment,
  };

})();

/* ─────────────────────────────────────────────
   EXPORT (future Node / module compat)
   ───────────────────────────────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = pccRouter;
}
