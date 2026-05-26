/**
 * js/modules/dashboard.js
 * PCC CRM — Admin Dashboard Module
 *
 * Renders the KPI summary cards, recent-activity feed, and quick-action
 * buttons that appear when the admin lands on #/dashboard.
 *
 * Depends on:  config.js  ->  storage.js  ->  router.js  ->  this file
 *
 * Public API:
 *   pccDashboard.render()   — full render into #dashboard-root
 *   pccDashboard.refresh()  — re-fetch data and update KPI cards only
 */

'use strict';

var pccDashboard = (function () {

  /* helpers */
  function _el(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  }
  function _fmt(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function _fmtCurrency(n) {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _recent(arr, days) {
    var cutoff = Date.now() - days * 864e5;
    return arr.filter(function (item) {
      return new Date(item.createdAt || 0).getTime() >= cutoff;
    });
  }

  /* KPI calculation */
  function _calcKPIs() {
    var leads     = (typeof pccGetLeads     === 'function') ? pccGetLeads()     : [];
    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var jobs      = (typeof pccGetJobs      === 'function') ? pccGetJobs()      : [];
    var quotes    = (typeof pccGetQuotes    === 'function') ? pccGetQuotes()    : [];

    var openLeads     = leads.filter(function (l) { return l.status !== 'closed' && l.status !== 'converted'; });
    var activeJobs    = jobs.filter(function (j)  { return j.status === 'scheduled' || j.status === 'in_progress'; });
    var completedJobs = jobs.filter(function (j)  { return j.status === 'completed'; });
    var revenue       = completedJobs.reduce(function (sum, j) { return sum + (parseFloat(j.price) || 0); }, 0);
    var pendingQuotes = quotes.filter(function (q) { return q.status === 'sent' || q.status === 'draft'; });

    return {
      totalLeads:     leads.length,
      openLeads:      openLeads.length,
      newLeads7d:     _recent(leads, 7).length,
      totalCustomers: customers.length,
      activeJobs:     activeJobs.length,
      completedJobs:  completedJobs.length,
      newJobs7d:      _recent(jobs, 7).length,
      totalRevenue:   revenue,
      pendingQuotes:  pendingQuotes.length,
      totalQuotes:    quotes.length,
    };
  }

  /* KPI card */
  function _kpiCard(icon, label, value, sub, color, href) {
    return '<a class="pkpi-card" href="' + (href || '#') + '" style="border-top:3px solid ' + color + '">' +
      '<div class="pkpi-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="pkpi-body">' +
        '<div class="pkpi-value">' + value + '</div>' +
        '<div class="pkpi-label">' + label + '</div>' +
        (sub ? '<div class="pkpi-sub">' + sub + '</div>' : '') +
      '</div></a>';
  }

  function _buildKPIGrid(kpis) {
    var grid = _el('div', 'pkpi-grid');
    var cfg  = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.COLORS) ? PCC_CONFIG.COLORS : {};
    var c    = { PRIMARY: cfg.PRIMARY || '#0ea5e9', SUCCESS: cfg.SUCCESS || '#22c55e', WARNING: cfg.WARNING || '#f59e0b', DANGER: cfg.DANGER || '#ef4444' };
    var teal   = c.PRIMARY  || '#0ea5e9';
    var green  = c.SUCCESS  || '#22c55e';
    var orange = c.WARNING  || '#f59e0b';
    var purple = '#8b5cf6';
    var red    = c.DANGER   || '#ef4444';

    grid.innerHTML =
      _kpiCard('👥', 'Open Leads',    _fmt(kpis.openLeads),    '+' + kpis.newLeads7d + ' this week',              teal,   '#/leads')    +
      _kpiCard('🏠', 'Active Jobs',   _fmt(kpis.activeJobs),   _fmt(kpis.newJobs7d) + ' new (7d)',               green,  '#/jobs')     +
      _kpiCard('💰', 'Revenue (All)', _fmtCurrency(kpis.totalRevenue), _fmt(kpis.completedJobs) + ' jobs done', purple, '#/jobs')     +
      _kpiCard('📋', 'Pending Quotes',_fmt(kpis.pendingQuotes),_fmt(kpis.totalQuotes) + ' total',               orange, '#/quotes')   +
      _kpiCard('👤', 'Customers',     _fmt(kpis.totalCustomers),'all time',                                      red,    '#/customers');
    return grid;
  }

  /* Activity feed */
  function _buildActivityFeed() {
    var leads  = (typeof pccGetLeads  === 'function') ? pccGetLeads()  : [];
    var jobs   = (typeof pccGetJobs   === 'function') ? pccGetJobs()   : [];
    var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];

    var items = [];
    leads.slice(-5).forEach(function (l) {
      items.push({ type: 'lead',  label: 'New lead: '  + (l.name || l.email || 'Unknown'), ts: l.createdAt });
    });
    jobs.slice(-5).forEach(function (j) {
      items.push({ type: 'job',   label: 'Job ' + j.status + ': ' + (j.customerName || j.address || j.id), ts: j.createdAt });
    });
    quotes.slice(-5).forEach(function (q) {
      items.push({ type: 'quote', label: 'Quote ' + q.status + ' — ' + (q.customerName || q.id), ts: q.createdAt });
    });

    items.sort(function (a, b) { return new Date(b.ts || 0) - new Date(a.ts || 0); });
    items = items.slice(0, 10);

    var feed = _el('div', 'pdash-feed');
    feed.innerHTML = '<h3 class="psection-label">Recent Activity</h3>';

    if (!items.length) {
      feed.innerHTML += '<p class="pdash-empty">No activity yet. Add a lead or job to get started.</p>';
      return feed;
    }

    var icons = { lead: '👥', job: '🏠', quote: '📋', customer: '👤' };
    var list  = _el('ul', 'pdash-list');
    items.forEach(function (item) {
      var d    = item.ts ? new Date(item.ts) : null;
      var time = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      var li   = _el('li', 'pdash-item');
      li.innerHTML =
        '<span class="pdash-icon">' + (icons[item.type] || '📌') + '</span>' +
        '<span class="pdash-label">' + item.label + '</span>' +
        '<span class="pdash-time">'  + time + '</span>';
      list.appendChild(li);
    });
    feed.appendChild(list);
    return feed;
  }

  /* Quick actions */
  function _buildQuickActions() {
    var wrap = _el('div', 'pdash-qa');
    wrap.innerHTML = '<h3 class="psection-label">Quick Actions</h3>';
    var btns = _el('div', 'pdash-qa-btns');
    [
      { label: '+ Add Lead',     href: '#/leads/new',     cls: 'pbtn-primary' },
      { label: 'Schedule Job',   href: '#/jobs/new',      cls: 'pbtn-success' },
      { label: 'New Quote',      href: '#/quotes/new',    cls: 'pbtn-warning' },
      { label: 'Estimator',      href: '#/estimator',     cls: 'pbtn-purple'  },
      { label: '+ Add Customer', href: '#/customers/new', cls: 'pbtn-danger'  },
    ].forEach(function (a) {
      var btn = _el('a', a.cls);
      btn.href = a.href;
      btn.textContent = a.label;
      btns.appendChild(btn);
    });
    wrap.appendChild(btns);
    return wrap;
  }

  /* Stats bar */
  function _buildStatsBar(kpis) {
    var bar = _el('div', 'pstat-bar');
    bar.innerHTML =
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalLeads)     + '</span><span class="pstat-l">Total Leads</span></div>'  +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.completedJobs)  + '</span><span class="pstat-l">Jobs Done</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalCustomers) + '</span><span class="pstat-l">Customers</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalQuotes)    + '</span><span class="pstat-l">Quotes Sent</span></div>';
    return bar;
  }

  /* PUBLIC: render */
  function render() {
    var root = document.getElementById('dashboard-root');
    if (!root) { console.warn('[PCC Dashboard] #dashboard-root not found'); return; }

    root.innerHTML = '';
    var kpis = _calcKPIs();

    var header = _el('div', 'pdash-header');
    var now    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    header.innerHTML =
      '<h2 class="pdash-title">Dashboard</h2>' +
      '<span class="pdash-date">' + now + '</span>';
    
    var syncBtn = _el('button', 'pdash-sync-btn', 'Sync to Sheets');
    syncBtn.id = 'pcc-sync-btn';
    header.appendChild(syncBtn);
    var syncStatus = _el('span', 'pdash-sync-status', '');
    syncStatus.id = 'pcc-sync-status';
    header.appendChild(syncStatus);
    root.appendChild(header);
    (function() {
      var syncBtnEl = document.getElementById('pcc-sync-btn');
      if (syncBtnEl) {
        syncBtnEl.addEventListener('click', function() {
          if (window.pccSync && window.pccSync.triggerSync) {
            window.pccSync.triggerSync();
          } else {
            var statusEl = document.getElementById('pcc-sync-status');
            if (statusEl) { statusEl.textContent = 'Sync module unavailable'; statusEl.className = 'pdash-sync-status sync-warn'; }
          }
        });
      }
    })();

    root.appendChild(_buildStatsBar(kpis));
    root.appendChild(_buildKPIGrid(kpis));

    var lower = _el('div', 'pdash-lower');
    lower.appendChild(_buildActivityFeed());
    lower.appendChild(_buildQuickActions());
    root.appendChild(lower);

    console.info('[PCC Dashboard] Rendered.', kpis);
  }

  /* PUBLIC: refresh (KPI + stats bar only) */
  function refresh() {
    var root = document.getElementById('dashboard-root');
    if (!root) return;
    var existing = root.querySelector('.pkpi-grid');
    if (!existing) { render(); return; }
    var kpis = _calcKPIs();
    existing.replaceWith(_buildKPIGrid(kpis));
    var sb = root.querySelector('.pstat-bar');
    if (sb) sb.replaceWith(_buildStatsBar(kpis));
  }

  return { render: render, refresh: refresh };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccDashboard; }
/**
 * js/modules/dashboard.js
 * PCC CRM — Admin Dashboard Module
 *
 * Renders the KPI summary cards, recent-activity feed, and quick-action
 * buttons that appear when the admin lands on #/dashboard.
 *
 * Depends on:  config.js  ->  storage.js  ->  router.js  ->  this file
 *
 * Public API:
 *   pccDashboard.render()   — full render into #dashboard-root
 *   pccDashboard.refresh()  — re-fetch data and update KPI cards only
 */

'use strict';

var pccDashboard = (function () {

  /* helpers */
  function _el(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  }
  function _fmt(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function _fmtCurrency(n) {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _recent(arr, days) {
    var cutoff = Date.now() - days * 864e5;
    return arr.filter(function (item) {
      return new Date(item.createdAt || 0).getTime() >= cutoff;
    });
  }

  /* KPI calculation */
  function _calcKPIs() {
    var leads     = (typeof pccGetLeads     === 'function') ? pccGetLeads()     : [];
    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var jobs      = (typeof pccGetJobs      === 'function') ? pccGetJobs()      : [];
    var quotes    = (typeof pccGetQuotes    === 'function') ? pccGetQuotes()    : [];

    var openLeads     = leads.filter(function (l) { return l.status !== 'closed' && l.status !== 'converted'; });
    var activeJobs    = jobs.filter(function (j)  { return j.status === 'scheduled' || j.status === 'in_progress'; });
    var completedJobs = jobs.filter(function (j)  { return j.status === 'completed'; });
    var revenue       = completedJobs.reduce(function (sum, j) { return sum + (parseFloat(j.price) || 0); }, 0);
    var pendingQuotes = quotes.filter(function (q) { return q.status === 'sent' || q.status === 'draft'; });

    return {
      totalLeads:     leads.length,
      openLeads:      openLeads.length,
      newLeads7d:     _recent(leads, 7).length,
      totalCustomers: customers.length,
      activeJobs:     activeJobs.length,
      completedJobs:  completedJobs.length,
      newJobs7d:      _recent(jobs, 7).length,
      totalRevenue:   revenue,
      pendingQuotes:  pendingQuotes.length,
      totalQuotes:    quotes.length,
    };
  }

  /* KPI card */
  function _kpiCard(icon, label, value, sub, color, href) {
    return '<a class="pkpi-card" href="' + (href || '#') + '" style="border-top:3px solid ' + color + '">' +
      '<div class="pkpi-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="pkpi-body">' +
        '<div class="pkpi-value">' + value + '</div>' +
        '<div class="pkpi-label">' + label + '</div>' +
        (sub ? '<div class="pkpi-sub">' + sub + '</div>' : '') +
      '</div></a>';
  }

  function _buildKPIGrid(kpis) {
    var grid = _el('div', 'pkpi-grid');
    var cfg  = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.COLORS) ? PCC_CONFIG.COLORS : {};
    var c    = { PRIMARY: cfg.PRIMARY || '#0ea5e9', SUCCESS: cfg.SUCCESS || '#22c55e', WARNING: cfg.WARNING || '#f59e0b', DANGER: cfg.DANGER || '#ef4444' };
    var teal   = c.PRIMARY  || '#0ea5e9';
    var green  = c.SUCCESS  || '#22c55e';
    var orange = c.WARNING  || '#f59e0b';
    var purple = '#8b5cf6';
    var red    = c.DANGER   || '#ef4444';

    grid.innerHTML =
      _kpiCard('👥', 'Open Leads',    _fmt(kpis.openLeads),    '+' + kpis.newLeads7d + ' this week',              teal,   '#/leads')    +
      _kpiCard('🏠', 'Active Jobs',   _fmt(kpis.activeJobs),   _fmt(kpis.newJobs7d) + ' new (7d)',               green,  '#/jobs')     +
      _kpiCard('💰', 'Revenue (All)', _fmtCurrency(kpis.totalRevenue), _fmt(kpis.completedJobs) + ' jobs done', purple, '#/jobs')     +
      _kpiCard('📋', 'Pending Quotes',_fmt(kpis.pendingQuotes),_fmt(kpis.totalQuotes) + ' total',               orange, '#/quotes')   +
      _kpiCard('👤', 'Customers',     _fmt(kpis.totalCustomers),'all time',                                      red,    '#/customers');
    return grid;
  }

  /* Activity feed */
  function _buildActivityFeed() {
    var leads  = (typeof pccGetLeads  === 'function') ? pccGetLeads()  : [];
    var jobs   = (typeof pccGetJobs   === 'function') ? pccGetJobs()   : [];
    var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];

    var items = [];
    leads.slice(-5).forEach(function (l) {
      items.push({ type: 'lead',  label: 'New lead: '  + (l.name || l.email || 'Unknown'), ts: l.createdAt });
    });
    jobs.slice(-5).forEach(function (j) {
      items.push({ type: 'job',   label: 'Job ' + j.status + ': ' + (j.customerName || j.address || j.id), ts: j.createdAt });
    });
    quotes.slice(-5).forEach(function (q) {
      items.push({ type: 'quote', label: 'Quote ' + q.status + ' — ' + (q.customerName || q.id), ts: q.createdAt });
    });

    items.sort(function (a, b) { return new Date(b.ts || 0) - new Date(a.ts || 0); });
    items = items.slice(0, 10);

    var feed = _el('div', 'pdash-feed');
    feed.innerHTML = '<h3 class="psection-label">Recent Activity</h3>';

    if (!items.length) {
      feed.innerHTML += '<p class="pdash-empty">No activity yet. Add a lead or job to get started.</p>';
      return feed;
    }

    var icons = { lead: '👥', job: '🏠', quote: '📋', customer: '👤' };
    var list  = _el('ul', 'pdash-list');
    items.forEach(function (item) {
      var d    = item.ts ? new Date(item.ts) : null;
      var time = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      var li   = _el('li', 'pdash-item');
      li.innerHTML =
        '<span class="pdash-icon">' + (icons[item.type] || '📌') + '</span>' +
        '<span class="pdash-label">' + item.label + '</span>' +
        '<span class="pdash-time">'  + time + '</span>';
      list.appendChild(li);
    });
    feed.appendChild(list);
    return feed;
  }

  /* Quick actions */
  function _buildQuickActions() {
    var wrap = _el('div', 'pdash-qa');
    wrap.innerHTML = '<h3 class="psection-label">Quick Actions</h3>';
    var btns = _el('div', 'pdash-qa-btns');
    [
      { label: '+ Add Lead',     href: '#/leads/new',     cls: 'pbtn-primary' },
      { label: 'Schedule Job',   href: '#/jobs/new',      cls: 'pbtn-success' },
      { label: 'New Quote',      href: '#/quotes/new',    cls: 'pbtn-warning' },
      { label: 'Estimator',      href: '#/estimator',     cls: 'pbtn-purple'  },
      { label: '+ Add Customer', href: '#/customers/new', cls: 'pbtn-danger'  },
    ].forEach(function (a) {
      var btn = _el('a', a.cls);
      btn.href = a.href;
      btn.textContent = a.label;
      btns.appendChild(btn);
    });
    wrap.appendChild(btns);
    return wrap;
  }

  /* Stats bar */
  function _buildStatsBar(kpis) {
    var bar = _el('div', 'pstat-bar');
    bar.innerHTML =
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalLeads)     + '</span><span class="pstat-l">Total Leads</span></div>'  +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.completedJobs)  + '</span><span class="pstat-l">Jobs Done</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalCustomers) + '</span><span class="pstat-l">Customers</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalQuotes)    + '</span><span class="pstat-l">Quotes Sent</span></div>';
    return bar;
  }

  /* PUBLIC: render */
  function render() {
    var root = document.getElementById('dashboard-root');
    if (!root) { console.warn('[PCC Dashboard] #dashboard-root not found'); return; }

    root.innerHTML = '';
    var kpis = _calcKPIs();

    var header = _el('div', 'pdash-header');
    var now    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    header.innerHTML =
      '<h2 class="pdash-title">Dashboard</h2>' +
      '<span class="pdash-date">' + now + '</span>';
    root.appendChild(header);

    root.appendChild(_buildStatsBar(kpis));
    root.appendChild(_buildKPIGrid(kpis));

    var lower = _el('div', 'pdash-lower');
    lower.appendChild(_buildActivityFeed());
    lower.appendChild(_buildQuickActions());
    root.appendChild(lower);

    console.info('[PCC Dashboard] Rendered.', kpis);
  }

  /* PUBLIC: refresh (KPI + stats bar only) */
  function refresh() {
    var root = document.getElementById('dashboard-root');
    if (!root) return;
    var existing = root.querySelector('.pkpi-grid');
    if (!existing) { render(); return; }
    var kpis = _calcKPIs();
    existing.replaceWith(_buildKPIGrid(kpis));
    var sb = root.querySelector('.pstat-bar');
    if (sb) sb.replaceWith(_buildStatsBar(kpis));
  }

  return { render: render, refresh: refresh };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccDashboard; }
