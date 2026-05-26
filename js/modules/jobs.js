/**
 * js/modules/jobs.js
 * PCC CRM -- Jobs & Scheduling Module
 *
 * Storage field mapping (actual pcc_jobs records):
 *   job.date     -- scheduled date YYYY-MM-DD
 *   job.time     -- scheduled time HH:MM
 *   job.customer -- customer name string
 *   job.total    -- price/total number
 *   job.services -- array of service strings (or job.serviceType string)
 */

'use strict';

var pccJobs = (function () {

function _el(tag, cls, html) {
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}
function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Safe local date parser - no timezone shift on YYYY-MM-DD strings */
function _parseDate(iso) {
  if (!iso) return null;
  var parts = String(iso).slice(0,10).split('-');
  if (parts.length < 3) return null;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

function _fmtDate(iso) {
  if (!iso) return '--';
  var dt = _parseDate(iso);
  if (!dt) return '--';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function _fmtCurrency(n) {
  return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* status badge - uses existing pstatus-* classes from stylesheet */
function _statusBadge(status) {
  var map = {
    scheduled:   'pstatus-scheduled',
    in_progress: 'pstatus-in_progress',
    completed:   'pstatus-complete',
    invoiced:    'pstatus-invoiced',
    cancelled:   'pstatus-cancelled',
    no_show:     'pstatus-noshow',
  };
  var label = {
    scheduled:   'Scheduled',
    in_progress: 'In Progress',
    completed:   'Completed',
    invoiced:    'Invoiced',
    cancelled:   'Cancelled',
    no_show:     'No Show',
  };
  var cls = map[status] || 'pstatus-badge';
  var lbl = label[status] || (status ? String(status).replace(/_/g,' ') : 'Unknown');
  return '<span class="pstatus-badge ' + cls + '">' + _esc(lbl) + '</span>';
}

/* filter state - persists across re-renders */
var _filter = { q: '', status: '', service: '', sort: 'date_asc' };
var _viewMode = 'list';

function _applyFilter(jobs) {
  var q = (_filter.q || '').toLowerCase();
  var out = jobs.slice();
  if (q) {
    out = out.filter(function (j) {
      return (j.customer || '').toLowerCase().indexOf(q) !== -1 ||
             (j.address  || '').toLowerCase().indexOf(q) !== -1 ||
             String(j.id || '').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (_filter.status)  out = out.filter(function (j) { return j.status      === _filter.status;  });
  if (_filter.service) out = out.filter(function (j) {
    if (Array.isArray(j.services)) return j.services.indexOf(_filter.service) !== -1;
    return j.serviceType === _filter.service;
  });
  out.sort(function (a, b) {
    var da = _parseDate(a.date) || new Date(a.created || 0);
    var db = _parseDate(b.date) || new Date(b.created || 0);
    if (_filter.sort === 'date_desc') return db - da;
    if (_filter.sort === 'newest')    return new Date(b.created || 0) - new Date(a.created || 0);
    if (_filter.sort === 'value')     return (b.total || 0) - (a.total || 0);
    return da - db;
  });
  return out;
}

/* toolbar - built fresh on each render, no duplicate handlers */
function _buildToolbar(root) {
  var statuses = ['scheduled','in_progress','completed','invoiced','cancelled','no_show'];
  var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
    ? Object.keys(PCC_CONFIG.SERVICES)
    : ['house','carpet','tile','pressure','deep','moveinout'];

  var bar = _el('div', 'pjobs-toolbar');

  var srch = document.createElement('input');
  srch.className = 'pjobs-search';
  srch.type = 'search';
  srch.placeholder = 'Search jobs...';
  srch.value = _filter.q || '';
  bar.appendChild(srch);

  var stSel = document.createElement('select');
  stSel.className = 'pjobs-filter-select';
  stSel.dataset.filter = 'status';
  [['', 'All Statuses']].concat(statuses.map(function(s){ return [s, s.replace(/_/g,' ')]; })).forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0]; opt.textContent = pair[1];
    if (_filter.status === pair[0]) opt.selected = true;
    stSel.appendChild(opt);
  });
  bar.appendChild(stSel);

  var svSel = document.createElement('select');
  svSel.className = 'pjobs-filter-select';
  svSel.dataset.filter = 'service';
  [['', 'All Services']].concat(services.map(function(s){ return [s, s.replace(/_/g,' ')]; })).forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0]; opt.textContent = pair[1];
    if (_filter.service === pair[0]) opt.selected = true;
    svSel.appendChild(opt);
  });
  bar.appendChild(svSel);

  var sortSel = document.createElement('select');
  sortSel.className = 'pjobs-filter-select';
  sortSel.dataset.filter = 'sort';
  [['date_asc','Date: Soonest'],['date_desc','Date: Latest'],['newest','Created: Newest'],['value','Highest Value']].forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0]; opt.textContent = pair[1];
    if (_filter.sort === pair[0]) opt.selected = true;
    sortSel.appendChild(opt);
  });
  bar.appendChild(sortSel);

  /* Invoiced quick-filter tabs */
  var quickWrap = _el('span', 'pjobs-quick-tabs');
  var allTab = _el('button', 'pjobs-tab' + (_filter.status === '' ? ' pjobs-tab-active' : ''));
  allTab.type = 'button'; allTab.textContent = 'All';
  var invTab = _el('button', 'pjobs-tab' + (_filter.status === 'invoiced' ? ' pjobs-tab-active' : ''));
  invTab.type = 'button'; invTab.textContent = 'Invoiced';
  quickWrap.appendChild(allTab);
  quickWrap.appendChild(invTab);
  bar.appendChild(quickWrap);

  var togBtn = _el('button', 'pbtn pbtn-sm');
  togBtn.type = 'button';
  togBtn.textContent = (_viewMode === 'list') ? 'Calendar' : 'List';
  bar.appendChild(togBtn);

  var newLink = document.createElement('a');
  newLink.className = 'pbtn pbtn-primary';
  newLink.href = '#/jobs/new';
  newLink.textContent = '+ New Job';
  bar.appendChild(newLink);

  srch.addEventListener('input', function (e) { _filter.q = e.target.value; _renderContent(root); });
  bar.querySelectorAll('[data-filter]').forEach(function (sel) {
    sel.addEventListener('change', function (e) { _filter[e.target.dataset.filter] = e.target.value; _renderContent(root); });
  });
  allTab.addEventListener('click', function () {
    _filter.status = ''; stSel.value = ''; _renderContent(root);
    allTab.className = 'pjobs-tab pjobs-tab-active'; invTab.className = 'pjobs-tab';
  });
  invTab.addEventListener('click', function () {
    _filter.status = 'invoiced'; stSel.value = 'invoiced'; _renderContent(root);
    allTab.className = 'pjobs-tab'; invTab.className = 'pjobs-tab pjobs-tab-active';
  });
  togBtn.addEventListener('click', function () {
    _viewMode = (_viewMode === 'list') ? 'calendar' : 'list'; render();
  });

  return bar;
}

/* list view */
function _renderList(jobs, wrap) {
  if (!jobs.length) {
    var empty = _el('p', 'pjobs-empty');
    empty.innerHTML = 'No jobs found. <a href="#/jobs/new">Schedule one</a>.';
    wrap.appendChild(empty);
    return;
  }
  var todayStr = new Date().toDateString();
  var todayJobs = jobs.filter(function (j) {
    var dt = _parseDate(j.date);
    return dt && dt.toDateString() === todayStr;
  });
  if (todayJobs.length) {
    var banner = _el('div', 'pjobs-today-banner');
    banner.innerHTML = '<strong>Today (' + todayJobs.length + ' job' + (todayJobs.length > 1 ? 's' : '') + ')</strong>: ' +
      todayJobs.map(function (j) { return _esc(j.customer || String(j.id)); }).join(', ');
    wrap.appendChild(banner);
  }
  var table = _el('table', 'pdata-table');
  table.innerHTML = '<thead><tr><th>Date</th><th>Customer</th><th>Service</th><th>Address</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>';
  var tbody = _el('tbody');
  jobs.forEach(function (job) {
    var dt = _parseDate(job.date);
    var isToday = dt && dt.toDateString() === todayStr;
    var tr = _el('tr', isToday ? 'pjobs-row-today' : '');
    var svcLabel = Array.isArray(job.services)
      ? job.services.map(function(s){ return _esc(String(s)); }).join(', ')
      : _esc((job.serviceType || '--').replace(/_/g,' '));
    tr.innerHTML =
      '<td>' + _fmtDate(job.date) + (job.time ? '<br><small>' + _esc(job.time) + '</small>' : '') + '</td>' +
      '<td><strong>' + _esc(job.customer || '--') + '</strong>' + (job.phone ? '<br><small>' + _esc(job.phone) + '</small>' : '') + '</td>' +
      '<td>' + svcLabel + '</td>' +
      '<td>' + _esc(job.address || '--') + '</td>' +
      '<td>' + _fmtCurrency(job.total) + '</td>' +
      '<td>' + _statusBadge(job.status) + '</td>' +
      '<td>' +
      '<a class="pbtn pbtn-sm" href="#/jobs/' + _esc(String(job.id)) + '">View</a> ' +
      '<button class="pbtn pbtn-green pbtn-sm pjobs-done-btn" data-id="' + _esc(String(job.id)) + '"' +
        (job.status === 'completed' || job.status === 'invoiced' ? ' disabled' : '') + '>Done</button> ' +
      '<button class="pbtn pbtn-sm pjobs-del-btn" data-id="' + _esc(String(job.id)) + '">Del</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', function (e) {
    var cb = e.target.closest('.pjobs-done-btn');
    if (cb && !cb.disabled) {
      pccUpdateJob(cb.dataset.id, { status: 'completed', completedAt: new Date().toISOString() });
      render(); return;
    }
    var db = e.target.closest('.pjobs-del-btn');
    if (db && confirm('Delete this job?')) { pccDeleteJob(db.dataset.id); render(); }
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  var count = _el('p', 'pjobs-count');
  count.textContent = jobs.length + ' of ' + ((typeof pccGetJobs === 'function') ? pccGetJobs().length : jobs.length) + ' jobs';
  wrap.appendChild(count);
}

/* calendar view - uses existing pcal-* / pcalendar-* classes from stylesheet */
function _renderCalendar(jobs, wrap) {
  var now = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth();
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  var cal = _el('div', 'pjobs-calendar-wrap');

  var hdr = _el('div', 'pcalendar-nav');
  var hdrSpan = document.createElement('span');
  hdrSpan.textContent = months[month] + ' ' + year;
  var hdrSmall = document.createElement('small');
  hdrSmall.textContent = 'Scheduled jobs this month';
  hdr.appendChild(hdrSpan);
  hdr.appendChild(hdrSmall);
  cal.appendChild(hdr);

  var grid = _el('div', 'pcalendar-grid');
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function (d) {
    var dh = _el('div', 'pcal-day-header');
    dh.textContent = d;
    grid.appendChild(dh);
  });

  var firstDay    = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var todayNum    = now.getDate();

  for (var i = 0; i < firstDay; i++) {
    grid.appendChild(_el('div', 'pcal-day other-month'));
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var cell = _el('div', 'pcal-day' + (day === todayNum ? ' today' : ''));
    var dayStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    var numSpan = _el('span', 'pcal-day-num');
    numSpan.textContent = String(day);
    cell.appendChild(numSpan);
    jobs.forEach(function (j) {
      if (!j.date) return;
      if (String(j.date).slice(0,10) !== dayStr) return;
      var chip = document.createElement('a');
      chip.className = 'pcal-job-chip';
      chip.href = '#/jobs/' + String(j.id);
      chip.textContent = String(j.customer || j.id).slice(0, 14);
      chip.title = _esc(j.customer || '') + ' -- ' +
        (Array.isArray(j.services) ? j.services[0] : (j.serviceType || '')) +
        ' -- ' + _fmtCurrency(j.total);
      cell.appendChild(chip);
    });
    grid.appendChild(cell);
  }
  cal.appendChild(grid);
  wrap.appendChild(cal);
}

function _renderContent(root) {
  var jobs = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
  var filtered = _applyFilter(jobs);
  var existing = root.querySelector('.pjobs-content');
  if (existing) existing.remove();
  var wrap = _el('div', 'pjobs-content');
  if (_viewMode === 'calendar') {
    _renderCalendar(filtered, wrap);
  } else {
    _renderList(filtered, wrap);
  }
  root.appendChild(wrap);
}

function render() {
  var root = document.getElementById('jobs-root');
  if (!root) { console.warn('[PCC Jobs] #jobs-root not found'); return; }
  root.innerHTML = '';
  var header = _el('div', 'padmin-topbar');
  header.innerHTML = '<h2>Jobs &amp; Schedule</h2>';
  root.appendChild(header);
  root.appendChild(_buildToolbar(root));
  _renderContent(root);
  console.info('[PCC Jobs] Rendered. Mode:', _viewMode);
}

function _buildJobForm(job, isNew) {
  job = job || {};
  var statuses = ['scheduled','in_progress','completed','invoiced','cancelled','no_show'];
  var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
    ? Object.keys(PCC_CONFIG.SERVICES)
    : ['house','carpet','tile','pressure','deep','moveinout'];
  var freqs = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.FREQ_DISCOUNTS)
    ? Object.keys(PCC_CONFIG.FREQ_DISCOUNTS)
    : ['one_time','monthly','bi_weekly','weekly'];
  var crew = ['Crew A','Crew B','Crew C','Solo - Maria','Solo - Jose','Solo - Ana'];
  return '<form class="pjobs-form" id="job-form"><div class="pform-grid">' +
    '<div><label>Customer Name *</label><input name="customer" type="text" required value="' + _esc(job.customer) + '" placeholder="Jane Smith"></div>' +
    '<div><label>Phone</label><input name="phone" type="tel" value="' + _esc(job.phone) + '" placeholder="(239) 555-0123"></div>' +
    '<div style="grid-column:span 2"><label>Service Address *</label><input name="address" type="text" required value="' + _esc(job.address) + '" placeholder="123 Main St, Naples FL 34102"></div>' +
    '<div><label>Service Type</label><select name="serviceType">' +
    services.map(function (s) { return '<option value="' + s + '"' + (job.serviceType === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label>Frequency</label><select name="frequency"><option value="">-- One time --</option>' +
    freqs.map(function (f) { return '<option value="' + f + '"' + (job.frequency === f ? ' selected' : '') + '>' + _esc(f.replace(/_/g,' ')) + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label>Scheduled Date *</label><input name="date" type="date" required value="' + _esc(String(job.date || '').slice(0,10)) + '"></div>' +
    '<div><label>Scheduled Time</label><input name="time" type="time" value="' + _esc(job.time) + '"></div>' +
    '<div><label>Duration (hrs)</label><input name="duration" type="number" min="0.5" step="0.5" value="' + _esc(job.duration || '2') + '"></div>' +
    '<div><label>Assigned Crew</label><select name="crew"><option value="">-- Unassigned --</option>' +
    crew.map(function (t) { return '<option value="' + _esc(t) + '"' + (job.crew === t ? ' selected' : '') + '>' + _esc(t) + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label>Price ($)</label><input name="total" type="number" min="0" step="0.01" value="' + _esc(job.total) + '" placeholder="0.00"></div>' +
    (!isNew ? '<div><label>Status</label><select name="status">' +
    statuses.map(function (s) { return '<option value="' + s + '"' + (job.status === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>'; }).join('') +
    '</select></div>' : '') +
    '<div><label>Gate / Access Code</label><input name="accessCode" type="text" value="' + _esc(job.accessCode) + '" placeholder="Gate code"></div>' +
    '<div style="grid-column:span 2"><label>Notes</label><textarea name="notes" rows="3" placeholder="Pets, allergies, parking...">' + _esc(job.notes) + '</textarea></div>' +
    '</div><div class="pjobs-form-actions">' +
    '<button type="submit" class="pbtn pbtn-primary">' + (isNew ? 'Schedule Job' : 'Save Changes') + '</button>' +
    (!isNew && job.status !== 'completed' && job.status !== 'invoiced' ? '<button type="button" class="pbtn pbtn-green" id="mark-complete-btn">Mark Completed</button>' : '') +
    (!isNew && job.status === 'completed' ? '<button type="button" class="pbtn pbtn-cyan" id="mark-invoiced-btn">Mark Invoiced</button>' : '') +
    '<a href="#/jobs" class="pbtn">Cancel</a>' +
    '</div></form>';
}

function renderNew(params) {
  params = params || {};
  var root = document.getElementById('jobs-root');
  if (!root) return;
  root.innerHTML = '';
  var header = _el('div', 'padmin-topbar');
  header.innerHTML = '<h2>Schedule New Job</h2><a href="#/jobs" class="pbtn">Back</a>';
  root.appendChild(header);
  var prefill = {};
  if (params.customerId) {
    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var cust = customers.find(function (c) { return c.id === params.customerId; });
    if (cust) prefill = { customer: cust.name || cust.customer, phone: cust.phone,
      address: cust.address, serviceType: cust.serviceType, frequency: cust.frequency,
      accessCode: cust.accessCode, notes: cust.notes, customerId: cust.id };
  }
  if (params.quoteId) {
    var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];
    var qt = quotes.find(function (q) { return q.id === params.quoteId; });
    if (qt) prefill = Object.assign({}, prefill, { customer: qt.customerName || qt.customer,
      phone: qt.phone, address: qt.address, serviceType: qt.serviceType,
      frequency: qt.frequency, total: qt.total, quoteId: qt.id });
  }
  var card = _el('div', 'pjobs-form-card');
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

function renderDetail(id) {
  var root = document.getElementById('jobs-root');
  if (!root) return;
  var jobs = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
  var job = jobs.find(function (j) { return String(j.id) === String(id); });
  root.innerHTML = '';
  var header = _el('div', 'padmin-topbar');
  header.innerHTML = '<h2>' + _esc(job ? 'Job - ' + (job.customer || String(job.id)) : 'Not Found') + '</h2>' +
    '<a href="#/jobs" class="pbtn">Back</a>';
  root.appendChild(header);
  if (!job) {
    var notFound = _el('p', 'pjobs-empty'); notFound.textContent = 'Job not found.';
    root.appendChild(notFound); return;
  }
  var meta = _el('div', 'pjobs-detail-meta');
  meta.innerHTML =
    '<span>Scheduled: ' + _fmtDate(job.date) + (job.time ? ' at ' + _esc(job.time) : '') + '</span>' +
    '<span>Status: ' + _statusBadge(job.status) + '</span>' +
    '<span>Price: <strong>' + _fmtCurrency(job.total) + '</strong></span>' +
    (job.crew ? '<span>Crew: ' + _esc(job.crew) + '</span>' : '') +
    (job.completedAt ? '<span>Completed: ' + new Date(job.completedAt).toLocaleString() + '</span>' : '');
  root.appendChild(meta);
  var card = _el('div', 'pjobs-form-card');
  card.innerHTML = _buildJobForm(job, false);
  root.appendChild(card);
  card.querySelector('#job-form').addEventListener('submit', function (e) {
    e.preventDefault();
    pccUpdateJob(id, Object.fromEntries(new FormData(e.target).entries()));
    var msg = _el('div', 'pjobs-toast'); msg.textContent = 'Job saved.';
    root.prepend(msg); setTimeout(function () { msg.remove(); }, 3000);
  });
  var cb = card.querySelector('#mark-complete-btn');
  if (cb) cb.addEventListener('click', function () {
    pccUpdateJob(id, { status: 'completed', completedAt: new Date().toISOString() });
    renderDetail(id);
  });
  var ib = card.querySelector('#mark-invoiced-btn');
  if (ib) ib.addEventListener('click', function () {
    pccUpdateJob(id, { status: 'invoiced', invoicedAt: new Date().toISOString() });
    renderDetail(id);
  });
}

return { render: render, renderNew: renderNew, renderDetail: renderDetail };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccJobs; }
