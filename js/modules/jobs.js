/**
 * js/modules/jobs.js
 * PCC CRM — Jobs & Scheduling Module
 *
 * Manages the full job lifecycle: scheduling, status updates (scheduled ->
 * in_progress -> completed -> invoiced), calendar-style date view, and
 * linking jobs back to customers and quotes.
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccJobs.render()          -- list/calendar view into #jobs-root
 *   pccJobs.renderNew(params) -- new job form (params: customerId, quoteId)
 *   pccJobs.renderDetail(id)  -- detail / status-update panel
 */

'use strict';

var pccJobs = (function () {

  /* helpers */
  function _el(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  }
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _fmtDate(iso) {
    if (!iso) return '--';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function _fmtDateTime(iso) {
    if (!iso) return '--';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function _fmtCurrency(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* status badge */
  function _statusBadge(status) {
    var map = {
      scheduled:   { label: 'Scheduled',   cls: 'badge-blue'   },
      in_progress: { label: 'In Progress', cls: 'badge-yellow' },
      completed:   { label: 'Completed',   cls: 'badge-green'  },
      invoiced:    { label: 'Invoiced',    cls: 'badge-purple' },
      cancelled:   { label: 'Cancelled',   cls: 'badge-gray'   },
      no_show:     { label: 'No Show',     cls: 'badge-red'    },
    };
    var s = map[status] || { label: status || 'Unknown', cls: 'badge-gray' };
    return '<span class="pcc-badge ' + s.cls + '">' + _esc(s.label) + '</span>';
  }

  /* filter state */
  var _filter   = { q: '', status: '', service: '', sort: 'date_asc' };
  var _viewMode = 'list';

  function _applyFilter(jobs) {
    var q   = (_filter.q || '').toLowerCase();
    var out = jobs.slice();
    if (q) {
      out = out.filter(function (j) {
        return (j.customerName || '').toLowerCase().includes(q) ||
               (j.address      || '').toLowerCase().includes(q) ||
               (j.id           || '').toLowerCase().includes(q);
      });
    }
    if (_filter.status)  out = out.filter(function (j) { return j.status      === _filter.status;  });
    if (_filter.service) out = out.filter(function (j) { return j.serviceType === _filter.service; });
    out.sort(function (a, b) {
      var da = new Date(a.scheduledDate || a.createdAt);
      var db = new Date(b.scheduledDate || b.createdAt);
      if (_filter.sort === 'date_desc') return db - da;
      if (_filter.sort === 'newest')    return new Date(b.createdAt) - new Date(a.createdAt);
      if (_filter.sort === 'value')     return (b.price || 0) - (a.price || 0);
      return da - db;
    });
    return out;
  }

  /* toolbar */
  function _buildToolbar(root) {
    var statuses = ['scheduled','in_progress','completed','invoiced','cancelled','no_show'];
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
      ? Object.keys(PCC_CONFIG.SERVICES) : ['house','carpet','tile','pressure','deep','moveinout'];
    var bar = _el('div', 'pcc-toolbar');
    bar.innerHTML =
      '<input class="pcc-search" type="search" placeholder="Search jobs..." value="' + _esc(_filter.q) + '">' +
      '<select class="pcc-filter-select" data-filter="status">' +
        '<option value="">All Statuses</option>' +
        statuses.map(function (s) {
          return '<option value="' + s + '"' + (_filter.status === s ? ' selected' : '') + '>' + _esc(s.replace('_',' ')) + '</option>';
        }).join('') +
      '</select>' +
      '<select class="pcc-filter-select" data-filter="service">' +
        '<option value="">All Services</option>' +
        services.map(function (s) {
          return '<option value="' + s + '"' + (_filter.service === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>';
        }).join('') +
      '</select>' +
      '<select class="pcc-filter-select" data-filter="sort">' +
        '<option value="date_asc"'  + (_filter.sort==='date_asc' ?' selected':'') + '>Date: Soonest</option>' +
        '<option value="date_desc"' + (_filter.sort==='date_desc'?' selected':'') + '>Date: Latest</option>' +
        '<option value="newest"'    + (_filter.sort==='newest'   ?' selected':'') + '>Created: Newest</option>' +
        '<option value="value"'     + (_filter.sort==='value'    ?' selected':'') + '>Highest Value</option>' +
      '</select>' +
      '<button class="pcc-btn pcc-btn-outline pcc-btn-sm" id="toggle-view">' + (_viewMode === 'list' ? 'Calendar' : 'List') + '</button>' +
      '<a class="pcc-btn pcc-btn-primary pcc-btn-sm" href="#/jobs/new">+ New Job</a>';
    bar.querySelector('.pcc-search').addEventListener('input', function (e) { _filter.q = e.target.value; _renderContent(root); });
    bar.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.addEventListener('change', function (e) { _filter[e.target.dataset.filter] = e.target.value; _renderContent(root); });
    });
    bar.querySelector('#toggle-view').addEventListener('click', function () {
      _viewMode = _viewMode === 'list' ? 'calendar' : 'list'; render();
    });
    return bar;
  }

  /* list view */
  function _renderList(jobs, wrap) {
    if (!jobs.length) {
      wrap.innerHTML = '<p class="pcc-empty">No jobs found. <a href="#/jobs/new">Schedule one</a>.</p>';
      return;
    }
    var today = new Date().toDateString();
    var todayJobs = jobs.filter(function (j) { return j.scheduledDate && new Date(j.scheduledDate).toDateString() === today; });
    if (todayJobs.length) {
      var banner = _el('div', 'pcc-today-banner');
      banner.innerHTML = '<strong>Today (' + todayJobs.length + ' job' + (todayJobs.length > 1 ? 's' : '') + ')</strong>: ' +
        todayJobs.map(function (j) { return _esc(j.customerName || j.id); }).join(', ');
      wrap.appendChild(banner);
    }
    var table = _el('table', 'pcc-table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Customer</th><th>Service</th><th>Address</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>';
    var tbody = _el('tbody');
    jobs.forEach(function (job) {
      var isToday = job.scheduledDate && new Date(job.scheduledDate).toDateString() === today;
      var tr = _el('tr', isToday ? 'pcc-row-today' : '');
      tr.innerHTML =
        '<td>' + _fmtDate(job.scheduledDate) + (job.scheduledTime ? '<br><small>' + _esc(job.scheduledTime) + '</small>' : '') + '</td>' +
        '<td><strong>' + _esc(job.customerName || '--') + '</strong>' + (job.phone ? '<br><small>' + _esc(job.phone) + '</small>' : '') + '</td>' +
        '<td>' + _esc((job.serviceType || '--').replace(/_/g,' ')) + '</td>' +
        '<td>' + _esc(job.address || '--') + '</td>' +
        '<td>' + _fmtCurrency(job.price) + '</td>' +
        '<td>' + _statusBadge(job.status) + '</td>' +
        '<td class="pcc-td-actions">' +
          '<a class="pcc-btn pcc-btn-xs pcc-btn-outline" href="#/jobs/' + _esc(job.id) + '">View</a> ' +
          '<button class="pcc-btn pcc-btn-xs pcc-btn-success pcc-complete-job" data-id="' + _esc(job.id) + '"' +
            (job.status === 'completed' || job.status === 'invoiced' ? ' disabled' : '') + '>Done</button> ' +
          '<button class="pcc-btn pcc-btn-xs pcc-btn-danger pcc-del-job" data-id="' + _esc(job.id) + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.addEventListener('click', function (e) {
      var cb = e.target.closest('.pcc-complete-job');
      if (cb) { pccUpdateJob(cb.dataset.id, { status: 'completed', completedAt: new Date().toISOString() }); render(); return; }
      var db = e.target.closest('.pcc-del-job');
      if (db && confirm('Delete this job?')) { pccDeleteJob(db.dataset.id); render(); }
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  /* calendar view */
  function _renderCalendar(jobs, wrap) {
    var now = new Date();
    var year = now.getFullYear(); var month = now.getMonth();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var cal = _el('div', 'pcc-calendar');
    var hdr = _el('div', 'pcc-cal-header');
    hdr.innerHTML = '<h3>' + months[month] + ' ' + year + '</h3><small>Scheduled jobs this month</small>';
    cal.appendChild(hdr);
    var grid = _el('div', 'pcc-cal-grid');
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function (d) {
      var dh = _el('div', 'pcc-cal-dayname'); dh.textContent = d; grid.appendChild(dh);
    });
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = now.getDate();
    for (var i = 0; i < firstDay; i++) grid.appendChild(_el('div', 'pcc-cal-cell pcc-cal-empty'));
    for (var day = 1; day <= daysInMonth; day++) {
      var cell = _el('div', 'pcc-cal-cell' + (day === today ? ' pcc-cal-today' : ''));
      var ds = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
      cell.innerHTML = '<span class="pcc-cal-day-num">' + day + '</span>';
      jobs.filter(function (j) { return j.scheduledDate && j.scheduledDate.startsWith(ds); })
        .forEach(function (j) {
          var chip = _el('a', 'pcc-cal-chip pcc-status-' + (j.status || 'scheduled'));
          chip.href = '#/jobs/' + j.id;
          chip.textContent = (j.customerName || j.id).slice(0, 14);
          chip.title = (j.customerName || '') + ' -- ' + (j.serviceType || '') + ' -- ' + _fmtCurrency(j.price);
          cell.appendChild(chip);
        });
      grid.appendChild(cell);
    }
    cal.appendChild(grid);
    wrap.appendChild(cal);
  }

  /* content renderer */
  function _renderContent(root) {
    var jobs = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
    var filtered = _applyFilter(jobs);
    var existing = root.querySelector('.pcc-jobs-content');
    if (existing) existing.remove();
    var wrap = _el('div', 'pcc-jobs-content');
    if (_viewMode === 'calendar') {
      _renderCalendar(filtered, wrap);
    } else {
      _renderList(filtered, wrap);
      if (filtered.length) wrap.innerHTML += '<p class="pcc-table-count">' + filtered.length + ' of ' + jobs.length + ' jobs</p>';
    }
    root.appendChild(wrap);
  }

  /* PUBLIC: render */
  function render() {
    var root = document.getElementById('jobs-root');
    if (!root) { console.warn('[PCC Jobs] #jobs-root not found'); return; }
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">Jobs & Schedule</h2>';
    root.appendChild(header);
    root.appendChild(_buildToolbar(root));
    _renderContent(root);
    console.info('[PCC Jobs] Rendered. Mode:', _viewMode);
  }

  /* job form */
  function _buildJobForm(job, isNew) {
    job = job || {};
    var statuses = ['scheduled','in_progress','completed','invoiced','cancelled','no_show'];
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
      ? Object.keys(PCC_CONFIG.SERVICES) : ['house','carpet','tile','pressure','deep','moveinout'];
    var freqs = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.FREQ_DISCOUNTS)
      ? Object.keys(PCC_CONFIG.FREQ_DISCOUNTS) : ['one_time','monthly','bi_weekly','weekly'];
    var crew = ['Crew A','Crew B','Crew C','Solo -- Maria','Solo -- Jose','Solo -- Ana'];
    return '<form class="pcc-form" id="job-form"><div class="pcc-form-grid">' +
      '<div class="pcc-form-group"><label>Customer Name *</label><input name="customerName" type="text" required value="' + _esc(job.customerName) + '" placeholder="Jane Smith"></div>' +
      '<div class="pcc-form-group"><label>Phone</label><input name="phone" type="tel" value="' + _esc(job.phone) + '" placeholder="(239) 555-0123"></div>' +
      '<div class="pcc-form-group pcc-form-wide"><label>Service Address *</label><input name="address" type="text" required value="' + _esc(job.address) + '" placeholder="123 Main St, Naples FL 34102"></div>' +
      '<div class="pcc-form-group"><label>Service Type *</label><select name="serviceType">' +
        services.map(function (s) { return '<option value="' + s + '"' + (job.serviceType === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="pcc-form-group"><label>Frequency</label><select name="frequency"><option value="">-- One time --</option>' +
        freqs.map(function (f) { return '<option value="' + f + '"' + (job.frequency === f ? ' selected' : '') + '>' + _esc(f.replace(/_/g,' ')) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="pcc-form-group"><label>Scheduled Date *</label><input name="scheduledDate" type="date" required value="' + _esc((job.scheduledDate || '').slice(0,10)) + '"></div>' +
      '<div class="pcc-form-group"><label>Scheduled Time</label><input name="scheduledTime" type="time" value="' + _esc(job.scheduledTime) + '"></div>' +
      '<div class="pcc-form-group"><label>Duration (hrs)</label><input name="duration" type="number" min="0.5" step="0.5" value="' + _esc(job.duration || '2') + '"></div>' +
      '<div class="pcc-form-group"><label>Assigned Crew</label><select name="crew"><option value="">-- Unassigned --</option>' +
        crew.map(function (t) { return '<option value="' + _esc(t) + '"' + (job.crew === t ? ' selected' : '') + '>' + _esc(t) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="pcc-form-group"><label>Price ($)</label><input name="price" type="number" min="0" step="0.01" value="' + _esc(job.price) + '" placeholder="0.00"></div>' +
      (!isNew ? '<div class="pcc-form-group"><label>Status</label><select name="status">' +
        statuses.map(function (s) { return '<option value="' + s + '"' + (job.status === s ? ' selected' : '') + '>' + _esc(s.replace('_',' ')) + '</option>'; }).join('') +
      '</select></div>' : '') +
      '<div class="pcc-form-group"><label>Gate / Access Code</label><input name="accessCode" type="text" value="' + _esc(job.accessCode) + '" placeholder="Gate code or key info"></div>' +
      '<div class="pcc-form-group pcc-form-wide"><label>Notes</label><textarea name="notes" rows="3" placeholder="Pets, allergies, parking...">' + _esc(job.notes) + '</textarea></div>' +
      '</div><div class="pcc-form-actions">' +
        '<button type="submit" class="pcc-btn pcc-btn-primary">' + (isNew ? 'Schedule Job' : 'Save Changes') + '</button>' +
        (!isNew && job.status !== 'completed' && job.status !== 'invoiced' ? '<button type="button" class="pcc-btn pcc-btn-success" id="mark-complete-btn">Mark Completed</button>' : '') +
        (!isNew && job.status === 'completed' ? '<button type="button" class="pcc-btn pcc-btn-purple" id="mark-invoiced-btn">Mark Invoiced</button>' : '') +
        '<a href="#/jobs" class="pcc-btn pcc-btn-outline">Cancel</a>' +
      '</div></form>';
  }

  /* PUBLIC: renderNew */
  function renderNew(params) {
    params = params || {};
    var root = document.getElementById('jobs-root');
    if (!root) return;
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">Schedule New Job</h2><a href="#/jobs" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);
    var prefill = {};
    if (params.customerId) {
      var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
      var cust = customers.find(function (c) { return c.id === params.customerId; });
      if (cust) prefill = { customerName: cust.name, phone: cust.phone, address: cust.address,
                            serviceType: cust.serviceType, frequency: cust.frequency,
                            accessCode: cust.accessCode, notes: cust.notes, customerId: cust.id };
    }
    if (params.quoteId) {
      var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];
      var qt = quotes.find(function (q) { return q.id === params.quoteId; });
      if (qt) prefill = Object.assign({}, prefill, { customerName: qt.customerName, phone: qt.phone,
                         address: qt.address, serviceType: qt.serviceType, frequency: qt.frequency,
                         price: qt.total, quoteId: qt.id });
    }
    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildJobForm(prefill, true);
    root.appendChild(card);
    card.querySelector('#job-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      data.status = 'scheduled';
      pccAddJob(data);
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/jobs');
    });
  }

  /* PUBLIC: renderDetail */
  function renderDetail(id) {
    var root = document.getElementById('jobs-root');
    if (!root) return;
    var jobs = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
    var job  = jobs.find(function (j) { return j.id === id; });
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">' + _esc(job ? ('Job -- ' + (job.customerName || job.id)) : 'Not Found') + '</h2>' +
      '<a href="#/jobs" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);
    if (!job) { root.innerHTML += '<p class="pcc-empty">Job not found.</p>'; return; }
    var meta = _el('div', 'pcc-detail-meta');
    meta.innerHTML =
      '<span>Scheduled: ' + _fmtDate(job.scheduledDate) + (job.scheduledTime ? ' at ' + _esc(job.scheduledTime) : '') + '</span>' +
      '<span>Status: ' + _statusBadge(job.status) + '</span>' +
      '<span>Price: <strong>' + _fmtCurrency(job.price) + '</strong></span>' +
      (job.crew ? '<span>Crew: ' + _esc(job.crew) + '</span>' : '') +
      (job.completedAt ? '<span>Completed: ' + _fmtDateTime(job.completedAt) + '</span>' : '');
    root.appendChild(meta);
    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildJobForm(job, false);
    root.appendChild(card);
    card.querySelector('#job-form').addEventListener('submit', function (e) {
      e.preventDefault();
      pccUpdateJob(id, Object.fromEntries(new FormData(e.target).entries()));
      var msg = _el('div', 'pcc-toast pcc-toast-success'); msg.textContent = 'Job saved.';
      root.prepend(msg); setTimeout(function () { msg.remove(); }, 3000);
    });
    var cb = card.querySelector('#mark-complete-btn');
    if (cb) cb.addEventListener('click', function () {
      pccUpdateJob(id, { status: 'completed', completedAt: new Date().toISOString() }); renderDetail(id);
    });
    var ib = card.querySelector('#mark-invoiced-btn');
    if (ib) ib.addEventListener('click', function () {
      pccUpdateJob(id, { status: 'invoiced', invoicedAt: new Date().toISOString() }); renderDetail(id);
    });
  }

  return { render: render, renderNew: renderNew, renderDetail: renderDetail };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccJobs; }
