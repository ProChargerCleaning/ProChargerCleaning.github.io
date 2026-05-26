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
    return '<a class="pcc-kpi-card" href="' + (href || '#') + '" style="border-top:3px solid ' + color + '">' +
      '<div class="pcc-kpi-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="pcc-kpi-body">' +
        '<div class="pcc-kpi-value">' + value + '</div>' +
        '<div class="pcc-kpi-label">' + label + '</div>' +
        (sub ? '<div class="pcc-kpi-sub">' + sub + '</div>' : '') +
      '</div></a>';
  }

  function _buildKPIGrid(kpis) {
    var grid = _el('div', 'pcc-kpi-grid');
    var c    = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.COLORS : {};
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

    var feed = _el('div', 'pcc-activity-feed');
    feed.innerHTML = '<h3 class="pcc-section-title">Recent Activity</h3>';

    if (!items.length) {
      feed.innerHTML += '<p class="pcc-empty">No activity yet. Add a lead or job to get started.</p>';
      return feed;
    }

    var icons = { lead: '👥', job: '🏠', quote: '📋', customer: '👤' };
    var list  = _el('ul', 'pcc-activity-list');
    items.forEach(function (item) {
      var d    = item.ts ? new Date(item.ts) : null;
      var time = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      var li   = _el('li', 'pcc-activity-item');
      li.innerHTML =
        '<span class="pcc-act-icon">' + (icons[item.type] || '📌') + '</span>' +
        '<span class="pcc-act-label">' + item.label + '</span>' +
        '<span class="pcc-act-time">'  + time + '</span>';
      list.appendChild(li);
    });
    feed.appendChild(list);
    return feed;
  }

  /* Quick actions */
  function _buildQuickActions() {
    var wrap = _el('div', 'pcc-quick-actions');
    wrap.innerHTML = '<h3 class="pcc-section-title">Quick Actions</h3>';
    var btns = _el('div', 'pcc-qa-buttons');
    [
      { label: '+ Add Lead',     href: '#/leads/new',     cls: 'pcc-btn pcc-btn-primary' },
      { label: 'Schedule Job',   href: '#/jobs/new',      cls: 'pcc-btn pcc-btn-success' },
      { label: 'New Quote',      href: '#/quotes/new',    cls: 'pcc-btn pcc-btn-warning' },
      { label: 'Estimator',      href: '#/estimator',     cls: 'pcc-btn pcc-btn-purple'  },
      { label: '+ Add Customer', href: '#/customers/new', cls: 'pcc-btn pcc-btn-danger'  },
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
    var bar = _el('div', 'pcc-stats-bar');
    bar.innerHTML =
      '<div class="pcc-stat"><span class="pcc-stat-n">' + _fmt(kpis.totalLeads)     + '</span><span class="pcc-stat-l">Total Leads</span></div>'  +
      '<div class="pcc-stat"><span class="pcc-stat-n">' + _fmt(kpis.completedJobs)  + '</span><span class="pcc-stat-l">Jobs Done</span></div>'    +
      '<div class="pcc-stat"><span class="pcc-stat-n">' + _fmt(kpis.totalCustomers) + '</span><span class="pcc-stat-l">Customers</span></div>'    +
      '<div class="pcc-stat"><span class="pcc-stat-n">' + _fmt(kpis.totalQuotes)    + '</span><span class="pcc-stat-l">Quotes Sent</span></div>';
    return bar;
  }

  /* PUBLIC: render */
  function render() {
    var root = document.getElementById('dashboard-root');
    if (!root) { console.warn('[PCC Dashboard] #dashboard-root not found'); return; }

    root.innerHTML = '';
    var kpis = _calcKPIs();

    var header = _el('div', 'pcc-dash-header');
    var now    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    header.innerHTML =
      '<h2 class="pcc-dash-title">Dashboard</h2>' +
      '<span class="pcc-dash-date">' + now + '</span>';
    root.appendChild(header);

    root.appendChild(_buildStatsBar(kpis));
    root.appendChild(_buildKPIGrid(kpis));

    var lower = _el('div', 'pcc-dash-lower');
    lower.appendChild(_buildActivityFeed());
    lower.appendChild(_buildQuickActions());
    root.appendChild(lower);

    console.info('[PCC Dashboard] Rendered.', kpis);
  }

  /* PUBLIC: refresh (KPI + stats bar only) */
  function refresh() {
    var root = document.getElementById('dashboard-root');
    if (!root) return;
    var existing = root.querySelector('.pcc-kpi-grid');
    if (!existing) { render(); return; }
    var kpis = _calcKPIs();
    existing.replaceWith(_buildKPIGrid(kpis));
    var sb = root.querySelector('.pcc-stats-bar');
    if (sb) sb.replaceWith(_buildStatsBar(kpis));
  }

  return { render: render, refresh: refresh };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccDashboard; }
