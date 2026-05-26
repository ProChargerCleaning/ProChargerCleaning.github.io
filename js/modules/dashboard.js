/**
 * js/modules/dashboard.js
 * PCC CRM — Admin Dashboard Module
 *
 * Renders the KPI summary cards, Today's Schedule, recent lists,
 * and quick-action buttons for the admin dashboard (#/dashboard).
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccDashboard.render()  -- full render into #dashboard-root
 *   pccDashboard.refresh() -- re-fetch data and update KPI cards only
 */

'use strict';

var pccDashboard = (function () {

  /* -- Helpers ----------------------------------------------- */
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
  /* Safe date formatter: handles ISO timestamps, YYYY-MM-DD, M/D/YYYY */
  function _fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d;
      if (dateStr.indexOf('T') !== -1 || dateStr.indexOf('/') !== -1) {
        d = new Date(dateStr);
      } else {
        d = new Date(dateStr + 'T00:00:00');
      }
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  /* Correction 1: local-date helpers -- no UTC shift */
  function _todayLocalKey() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }
  function _monthLocalKey() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return d.getFullYear() + '-' + mm;
  }

  /* Correction 5: safe date sort helper */
  function _sortByDateDesc(arr, field) {
    return arr.slice().sort(function (a, b) {
      var da = a[field] ? new Date(a[field]).getTime() : 0;
      var db = b[field] ? new Date(b[field]).getTime() : 0;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
  }

  /* -- KPI Calculation --------------------------------------- */
  function _calcKPIs() {
    var leads     = (typeof pccGetLeads     === 'function') ? pccGetLeads()     : [];
    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var jobs      = (typeof pccGetJobs      === 'function') ? pccGetJobs()      : [];
    var quotes    = (typeof pccGetQuotes    === 'function') ? pccGetQuotes()    : [];
    var month = _monthLocalKey();
    var openLeads      = leads.filter(function (l) { return l.status !== 'closed' && l.status !== 'converted'; });
    var scheduledJobs  = jobs.filter(function (j) { return j.status === 'scheduled'; });
    var inProgressJobs = jobs.filter(function (j) { return j.status === 'in_progress'; });
    var completedJobs  = jobs.filter(function (j) { return j.status === 'completed'; });
    var invoicedJobs   = jobs.filter(function (j) { return j.status === 'invoiced'; });
    var pendingQuotes  = quotes.filter(function (q) { return q.status === 'draft' || q.status === 'pending' || q.status === 'sent'; });
    var monthlyJobs = jobs.filter(function (j) {
      return (j.status === 'completed' || j.status === 'invoiced') &&
             typeof j.date === 'string' && j.date.slice(0, 7) === month;
    });
    var monthlyRevenue = monthlyJobs.reduce(function (sum, j) { return sum + (parseFloat(j.total) || 0); }, 0);
    var avgTicket = monthlyJobs.length > 0 ? monthlyRevenue / monthlyJobs.length : 0;
    return {
      totalLeads:     leads.length,
      openLeads:      openLeads.length,
      totalCustomers: customers.length,
      scheduledJobs:  scheduledJobs.length,
      inProgressJobs: inProgressJobs.length,
      completedJobs:  completedJobs.length,
      invoicedJobs:   invoicedJobs.length,
      pendingQuotes:  pendingQuotes.length,
      totalQuotes:    quotes.length,
      monthlyRevenue: monthlyRevenue,
      avgTicket:      avgTicket,
      totalJobsDone:  completedJobs.length + invoicedJobs.length
    };
  }

  /* -- KPI Card ---------------------------------------------- */
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
    var cfg = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.COLORS) ? PCC_CONFIG.COLORS : {};
    var cyan   = cfg.PRIMARY || '#0ea5e9';
    var green  = cfg.SUCCESS || '#22c55e';
    var orange = cfg.WARNING || '#f59e0b';
    var red    = cfg.DANGER  || '#ef4444';
    grid.innerHTML =
      _kpiCard('👥', 'Open Leads',      _fmt(kpis.openLeads),      kpis.totalLeads + ' total',               cyan,      '#/leads')    +
      _kpiCard('📅', 'Scheduled Jobs',  _fmt(kpis.scheduledJobs),  kpis.inProgressJobs + ' in progress',     green,     '#/jobs')     +
      _kpiCard('✅', 'Completed Jobs',  _fmt(kpis.completedJobs),  kpis.totalJobsDone + ' done total',       '#14b8a6', '#/jobs')     +
      _kpiCard('🧾', 'Invoiced Jobs',   _fmt(kpis.invoicedJobs),   'ready to collect',                       orange,    '#/jobs')     +
      _kpiCard('💰', 'Monthly Revenue', _fmtCurrency(kpis.monthlyRevenue), 'completed + invoiced this month', '#8b5cf6', '#/jobs')   +
      _kpiCard('🎯', 'Avg Ticket',      _fmtCurrency(kpis.avgTicket),      'this month avg',                  '#eab308', '#/jobs')   +
      _kpiCard('📋', 'Pending Quotes',  _fmt(kpis.pendingQuotes),  kpis.totalQuotes + ' total',              '#ec4899', '#/quotes')  +
      _kpiCard('👤', 'Total Customers', _fmt(kpis.totalCustomers), 'all time',                               red,       '#/customers');
    return grid;
  }

  /* -- Stats Bar --------------------------------------------- */
  function _buildStatsBar(kpis) {
    var bar = _el('div', 'pstat-bar');
    bar.innerHTML =
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalLeads)             + '</span><span class="pstat-l">Total Leads</span></div>'  +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalJobsDone)          + '</span><span class="pstat-l">Jobs Done</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.invoicedJobs)           + '</span><span class="pstat-l">Invoiced</span></div>'     +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalCustomers)         + '</span><span class="pstat-l">Customers</span></div>'    +
      '<div class="pstat"><span class="pstat-n">' + _fmt(kpis.totalQuotes)            + '</span><span class="pstat-l">Quotes Sent</span></div>'  +
      '<div class="pstat"><span class="pstat-n">' + _fmtCurrency(kpis.monthlyRevenue) + '</span><span class="pstat-l">This Month</span></div>';
    return bar;
  }

  /* -- Today's Schedule -------------------------------------- */
  function _buildTodaySchedule() {
    var jobs  = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
    var today = _todayLocalKey();
    var todayJobs = jobs.filter(function (j) {
      return typeof j.date === 'string' && j.date.slice(0, 10) === today;
    });
    todayJobs.sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    var wrap = _el('div', 'pdash-today');
    wrap.innerHTML = '<h3 class="pdash-section-title">Today\'s Schedule</h3>';
    if (!todayJobs.length) {
      wrap.innerHTML += '<p class="pdash-empty">No jobs scheduled for today.</p>';
      return wrap;
    }
    var list = _el('ul', 'pdash-list');
    todayJobs.forEach(function (j) {
      var li = _el('li', 'pdash-row');
      var sc = 'pstatus-badge pstatus-' + (j.status || 'scheduled').replace('_', '-');
      li.innerHTML =
        '<span class="pdash-row-name">' + (j.customer || 'Unknown') + '</span>' +
        '<span class="pdash-row-addr">' + (j.address  || '') + '</span>' +
        '<span class="pdash-row-meta">' +
          (j.time ? '<span class="pdash-row-time">' + j.time + '</span>' : '') +
          '<span class="' + sc + '">' + (j.status || 'scheduled') + '</span>' +
        '</span>';
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* -- Recent Leads ------------------------------------------ */
  function _buildRecentLeads() {
    var leads  = (typeof pccGetLeads === 'function') ? pccGetLeads() : [];
    var recent = _sortByDateDesc(leads, 'date').slice(0, 5);
    var wrap = _el('div', 'pdash-section');
    wrap.innerHTML = '<h3 class="pdash-section-title">Recent Leads</h3>';
    if (!recent.length) {
      wrap.innerHTML += '<p class="pdash-empty">No leads yet. Add your first lead to get started.</p>';
      return wrap;
    }
    var list = _el('ul', 'pdash-list');
    recent.forEach(function (l) {
      var li = _el('li', 'pdash-row');
      var sc = 'pstatus-badge pstatus-' + (l.status || 'new').replace('_', '-');
      li.innerHTML =
        '<span class="pdash-row-name">' + (l.name || l.email || 'Unknown') + '</span>' +
        '<span class="pdash-row-sub">'  + (l.service || '') + '</span>' +
        '<span class="pdash-row-meta">' +
          '<span class="' + sc + '">' + (l.status || 'new') + '</span>' +
          (_fmtDate(l.date) ? '<span class="pdash-time">' + _fmtDate(l.date) + '</span>' : '') +
        '</span>';
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* -- Recent Jobs ------------------------------------------- */
  function _buildRecentJobs() {
    var jobs   = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
    var recent = _sortByDateDesc(jobs, 'date').slice(0, 5);
    var wrap = _el('div', 'pdash-section');
    wrap.innerHTML = '<h3 class="pdash-section-title">Recent Jobs</h3>';
    if (!recent.length) {
      wrap.innerHTML += '<p class="pdash-empty">No jobs yet. Schedule your first job.</p>';
      return wrap;
    }
    var list = _el('ul', 'pdash-list');
    recent.forEach(function (j) {
      var li = _el('li', 'pdash-row');
      var sc = 'pstatus-badge pstatus-' + (j.status || 'scheduled').replace('_', '-');
      li.innerHTML =
        '<span class="pdash-row-name">' + (j.customer || 'Unknown') + '</span>' +
        '<span class="pdash-row-sub">'  + (j.address  || '') + '</span>' +
        '<span class="pdash-row-meta">' +
          '<span class="' + sc + '">' + (j.status || 'scheduled') + '</span>' +
          (_fmtDate(j.date) ? '<span class="pdash-time">' + _fmtDate(j.date) + '</span>' : '') +
          (j.total ? '<span class="pdash-row-price">' + _fmtCurrency(parseFloat(j.total) || 0) + '</span>' : '') +
        '</span>';
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* -- Recent Quotes ----------------------------------------- */
  function _buildRecentQuotes() {
    var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];
    var recent = _sortByDateDesc(quotes, 'date').slice(0, 5);
    var wrap = _el('div', 'pdash-section');
    wrap.innerHTML = '<h3 class="pdash-section-title">Recent Quotes</h3>';
    if (!recent.length) {
      wrap.innerHTML += '<p class="pdash-empty">No quotes yet. Create a quote to get started.</p>';
      return wrap;
    }
    var list = _el('ul', 'pdash-list');
    recent.forEach(function (q) {
      var li = _el('li', 'pdash-row');
      var sc = 'pstatus-badge pstatus-' + (q.status || 'draft').replace('_', '-');
      li.innerHTML =
        '<span class="pdash-row-name">' + (q.customer || 'Unknown') + '</span>' +
        '<span class="pdash-row-sub">'  + (q.address  || '') + '</span>' +
        '<span class="pdash-row-meta">' +
          '<span class="' + sc + '">' + (q.status || 'draft') + '</span>' +
          (_fmtDate(q.date) ? '<span class="pdash-time">' + _fmtDate(q.date) + '</span>' : '') +
          (q.total ? '<span class="pdash-row-price">' + _fmtCurrency(parseFloat(q.total) || 0) + '</span>' : '') +
        '</span>';
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* -- Quick Actions ----------------------------------------- */
  function _buildQuickActions() {
    var wrap = _el('div', 'pdash-qa');
    wrap.innerHTML = '<h3 class="pdash-section-title">Quick Actions</h3>';
    var btns = _el('div', 'pdash-qa-btns');
    [
      { label: '+ Add Lead',     href: '#/leads',     cls: 'pbtn pbtn-primary' },
      { label: 'Schedule Job',   href: '#/jobs',      cls: 'pbtn pbtn-success' },
      { label: 'New Quote',      href: '#/quotes',    cls: 'pbtn' },
      { label: 'Estimator',      href: '#/estimator', cls: 'pbtn' },
      { label: '+ Add Customer', href: '#/customers', cls: 'pbtn' }
    ].forEach(function (a) {
      var btn = _el('a', a.cls);
      btn.href = a.href;
      btn.textContent = a.label;
      btns.appendChild(btn);
    });
    wrap.appendChild(btns);
    return wrap;
  }

  /* -- PUBLIC: render ---------------------------------------- */
  function render() {
    var root = document.getElementById('dashboard-root');
    if (!root) { console.warn('[PCC Dashboard] #dashboard-root not found'); return; }
    root.innerHTML = '';
    var kpis = _calcKPIs();
    var header = _el('div', 'pdash-header');
    var now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    header.innerHTML = '<h2 class="pdash-title">Dashboard</h2><span class="pdash-date">' + now + '</span>';
    var syncBtn = _el('button', 'pdash-sync-btn', 'Sync to Sheets');
    syncBtn.id = 'pcc-sync-btn';
    header.appendChild(syncBtn);
    var syncStatus = _el('span', 'pdash-sync-status', '');
    syncStatus.id = 'pcc-sync-status';
    header.appendChild(syncStatus);
    root.appendChild(header);
    (function () {
      var btn = document.getElementById('pcc-sync-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          if (window.pccSync && window.pccSync.triggerSync) {
            window.pccSync.triggerSync();
          } else {
            var st = document.getElementById('pcc-sync-status');
            if (st) { st.textContent = 'Sync module unavailable'; st.className = 'pdash-sync-status sync-warn'; }
          }
        });
      }
    }());
    root.appendChild(_buildStatsBar(kpis));
    root.appendChild(_buildKPIGrid(kpis));
    var lower   = _el('div', 'pdash-lower');
    var leftCol = _el('div', 'pdash-col-left');
    leftCol.appendChild(_buildTodaySchedule());
    leftCol.appendChild(_buildQuickActions());
    var rightCol = _el('div', 'pdash-col-right');
    rightCol.appendChild(_buildRecentLeads());
    rightCol.appendChild(_buildRecentJobs());
    rightCol.appendChild(_buildRecentQuotes());
    lower.appendChild(leftCol);
    lower.appendChild(rightCol);
    root.appendChild(lower);
    console.info('[PCC Dashboard] Rendered.', kpis);
  }

  /* -- PUBLIC: refresh --------------------------------------- */
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

}());

if (typeof module !== 'undefined' && module.exports) { module.exports = pccDashboard; }
