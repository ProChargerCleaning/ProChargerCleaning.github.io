/**
 * js/modules/customers.js
 * PCC CRM — Customer Management Module
 *
 * Displays the full customer list with job history, lifetime value,
 * contact details, and an edit form. Customers are created either
 * by converting a lead (leads.js) or directly from this module.
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccCustomers.render()          — list view into #customers-root
 *   pccCustomers.renderDetail(id)  — detail/edit panel
 *   pccCustomers.renderNew()       — blank new-customer form
 */

'use strict';

var pccCustomers = (function () {

  /* ── helpers ─────────────────────────────────────────────────────── */
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
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function _fmtCurrency(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ── filter state ────────────────────────────────────────────────── */
  var _filter = { q: '', sort: 'newest' };

  function _applyFilter(customers) {
    var q   = (_filter.q || '').toLowerCase();
    var out = customers.slice();
    if (q) {
      out = out.filter(function (c) {
        return (c.name    || '').toLowerCase().includes(q) ||
               (c.email   || '').toLowerCase().includes(q) ||
               (c.phone   || '').toLowerCase().includes(q) ||
               (c.address || '').toLowerCase().includes(q);
      });
    }
    out.sort(function (a, b) {
      if (_filter.sort === 'oldest')  return new Date(a.createdAt) - new Date(b.createdAt);
      if (_filter.sort === 'name')    return (a.name || '').localeCompare(b.name || '');
      if (_filter.sort === 'value')   return (b.totalSpent || 0) - (a.totalSpent || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return out;
  }

  /* ── toolbar ─────────────────────────────────────────────────────── */
  function _buildToolbar(root) {
    var bar = _el('div', 'pcc-toolbar');
    bar.innerHTML =
      '<input class="pcc-search" type="search" placeholder="Search customers..." value="' + _esc(_filter.q) + '">' +
      '<select class="pcc-filter-select" data-filter="sort">' +
        '<option value="newest"' + (_filter.sort==='newest'?' selected':'') + '>Newest First</option>' +
        '<option value="oldest"' + (_filter.sort==='oldest'?' selected':'') + '>Oldest First</option>' +
        '<option value="name"'  + (_filter.sort==='name'  ?' selected':'') + '>Name A-Z</option>' +
        '<option value="value"' + (_filter.sort==='value' ?' selected':'') + '>Highest Value</option>' +
      '</select>' +
      '<a class="pcc-btn pcc-btn-primary pcc-btn-sm" href="#/customers/new">+ New Customer</a>';

    bar.querySelector('.pcc-search').addEventListener('input', function (e) {
      _filter.q = e.target.value;
      _renderTable(root);
    });
    bar.querySelector('[data-filter]').addEventListener('change', function (e) {
      _filter.sort = e.target.value;
      _renderTable(root);
    });
    return bar;
  }

  /* ── customer table ──────────────────────────────────────────────── */
  function _jobsForCustomer(custId) {
    var jobs = (typeof pccGetJobs === 'function') ? pccGetJobs() : [];
    return jobs.filter(function (j) { return j.customerId === custId; });
  }

  function _renderTable(root) {
    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var filtered  = _applyFilter(customers);

    var existing = root.querySelector('.pcc-customers-table-wrap');
    if (existing) existing.remove();

    var wrap = _el('div', 'pcc-customers-table-wrap');

    if (!filtered.length) {
      wrap.innerHTML = '<p class="pcc-empty">No customers yet. <a href="#/customers/new">Add one</a> or <a href="#/leads">convert a lead</a>.</p>';
      root.appendChild(wrap);
      return;
    }

    var table = _el('table', 'pcc-table');
    table.innerHTML =
      '<thead><tr>' +
        '<th>Name</th><th>Contact</th><th>Address</th>' +
        '<th>Jobs</th><th>Lifetime Value</th><th>Since</th><th>Actions</th>' +
      '</tr></thead>';

    var tbody = _el('tbody');
    filtered.forEach(function (cust) {
      var custJobs = _jobsForCustomer(cust.id);
      var jobCount = custJobs.length;
      var spent    = custJobs.filter(function (j) { return j.status === 'completed'; })
                             .reduce(function (s, j) { return s + (parseFloat(j.price) || 0); }, 0);

      var tr = _el('tr');
      tr.innerHTML =
        '<td><strong>' + _esc(cust.name || '—') + '</strong></td>' +
        '<td>' + _esc(cust.email || '') + (cust.phone ? '<br>' + _esc(cust.phone) : '') + '</td>' +
        '<td>' + _esc(cust.address || '—') + '</td>' +
        '<td class="pcc-td-center">' + jobCount + '</td>' +
        '<td class="pcc-td-center">' + _fmtCurrency(spent) + '</td>' +
        '<td>' + _fmtDate(cust.createdAt) + '</td>' +
        '<td class="pcc-td-actions">' +
          '<a class="pcc-btn pcc-btn-xs pcc-btn-outline" href="#/customers/' + _esc(cust.id) + '">View</a> ' +
          '<a class="pcc-btn pcc-btn-xs pcc-btn-success"  href="#/jobs/new?customerId=' + _esc(cust.id) + '">+ Job</a> ' +
          '<button class="pcc-btn pcc-btn-xs pcc-btn-danger pcc-del-cust" data-id="' + _esc(cust.id) + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('.pcc-del-cust');
      if (!btn) return;
      if (!confirm('Delete this customer? Their job history will remain. This cannot be undone.')) return;
      pccDeleteCustomer(btn.dataset.id);
      _renderTable(root);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.innerHTML += '<p class="pcc-table-count">' + filtered.length + ' of ' + customers.length + ' customers</p>';
    root.appendChild(wrap);
  }

  /* ── PUBLIC: render ──────────────────────────────────────────────── */
  function render() {
    var root = document.getElementById('customers-root');
    if (!root) { console.warn('[PCC Customers] #customers-root not found'); return; }

    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">Customers</h2>';
    root.appendChild(header);

    root.appendChild(_buildToolbar(root));
    _renderTable(root);
    console.info('[PCC Customers] List rendered.');
  }

  /* ── customer form ───────────────────────────────────────────────── */
  function _buildForm(cust, isNew) {
    cust = cust || {};
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
      ? Object.keys(PCC_CONFIG.SERVICES)
      : ['house','carpet','tile','pressure','deep','moveinout'];
    var freqs = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.FREQ_DISCOUNTS)
      ? Object.keys(PCC_CONFIG.FREQ_DISCOUNTS)
      : ['one_time','monthly','bi_weekly','weekly'];

    return '<form class="pcc-form" id="cust-form">' +
      '<div class="pcc-form-grid">' +

      '<div class="pcc-form-group">' +
        '<label>Full Name *</label>' +
        '<input name="name" type="text" required value="' + _esc(cust.name) + '" placeholder="Jane Smith">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Email</label>' +
        '<input name="email" type="email" value="' + _esc(cust.email) + '" placeholder="jane@example.com">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Phone</label>' +
        '<input name="phone" type="tel" value="' + _esc(cust.phone) + '" placeholder="(239) 555-0123">' +
      '</div>' +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Service Address</label>' +
        '<input name="address" type="text" value="' + _esc(cust.address) + '" placeholder="123 Main St, Naples FL 34102">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Primary Service</label>' +
        '<select name="serviceType">' +
          '<option value="">— Select —</option>' +
          services.map(function (s) {
            return '<option value="' + s + '"' + (cust.serviceType === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Frequency</label>' +
        '<select name="frequency">' +
          '<option value="">— Select —</option>' +
          freqs.map(function (f) {
            return '<option value="' + f + '"' + (cust.frequency === f ? ' selected' : '') + '>' + _esc(f.replace(/_/g,' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Gate / Access Code</label>' +
        '<input name="accessCode" type="text" value="' + _esc(cust.accessCode) + '" placeholder="Gate code or key info">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Preferred Day</label>' +
        '<select name="preferredDay">' +
          '<option value="">— Any —</option>' +
          ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(function (d) {
            return '<option value="' + d + '"' + (cust.preferredDay === d ? ' selected' : '') + '>' + d + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Notes / Special Instructions</label>' +
        '<textarea name="notes" rows="4" placeholder="Pets, allergies, access instructions...">' + _esc(cust.notes) + '</textarea>' +
      '</div>' +

      '</div>' +
      '<div class="pcc-form-actions">' +
        '<button type="submit" class="pcc-btn pcc-btn-primary">' + (isNew ? 'Add Customer' : 'Save Changes') + '</button>' +
        (!isNew ? '<a class="pcc-btn pcc-btn-success" href="#/jobs/new?customerId=' + _esc(cust.id) + '">+ Schedule Job</a>' : '') +
        '<a href="#/customers" class="pcc-btn pcc-btn-outline">Cancel</a>' +
      '</div>' +
    '</form>';
  }

  /* ── PUBLIC: renderNew ───────────────────────────────────────────── */
  function renderNew() {
    var root = document.getElementById('customers-root');
    if (!root) return;
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">New Customer</h2>' +
      '<a href="#/customers" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);

    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildForm(null, true);
    root.appendChild(card);

    card.querySelector('#cust-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      pccAddCustomer(data);
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/customers');
    });
  }

  /* ── PUBLIC: renderDetail ────────────────────────────────────────── */
  function renderDetail(id) {
    var root = document.getElementById('customers-root');
    if (!root) return;

    var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
    var cust      = customers.find(function (c) { return c.id === id; });

    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">' + _esc(cust ? (cust.name || 'Customer') : 'Not Found') + '</h2>' +
      '<a href="#/customers" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);

    if (!cust) {
      root.innerHTML += '<p class="pcc-empty">Customer not found.</p>';
      return;
    }

    /* ── stats strip ── */
    var custJobs  = _jobsForCustomer(id);
    var completed = custJobs.filter(function (j) { return j.status === 'completed'; });
    var spent     = completed.reduce(function (s, j) { return s + (parseFloat(j.price) || 0); }, 0);

    var stats = _el('div', 'pcc-detail-meta');
    stats.innerHTML =
      '<span>Customer since: ' + _fmtDate(cust.createdAt) + '</span>' +
      '<span>Total jobs: ' + custJobs.length + '</span>' +
      '<span>Completed: ' + completed.length + '</span>' +
      '<span>Lifetime value: ' + _fmtCurrency(spent) + '</span>';
    root.appendChild(stats);

    /* ── edit form ── */
    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildForm(cust, false);
    root.appendChild(card);

    card.querySelector('#cust-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      pccUpdateCustomer(id, data);
      var msg = _el('div', 'pcc-toast pcc-toast-success');
      msg.textContent = 'Customer saved.';
      root.prepend(msg);
      setTimeout(function () { msg.remove(); }, 3000);
    });

    /* ── job history table ── */
    if (custJobs.length) {
      var histSection = _el('div', 'pcc-job-history');
      histSection.innerHTML = '<h3 class="pcc-section-title">Job History</h3>';
      var htable = _el('table', 'pcc-table');
      htable.innerHTML =
        '<thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Price</th><th></th></tr></thead>';
      var hbody = _el('tbody');
      custJobs.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
        .forEach(function (j) {
          var tr = _el('tr');
          tr.innerHTML =
            '<td>' + _fmtDate(j.scheduledDate || j.createdAt) + '</td>' +
            '<td>' + _esc(j.serviceType || '—') + '</td>' +
            '<td><span class="pcc-badge badge-blue">' + _esc(j.status || '—') + '</span></td>' +
            '<td>' + _fmtCurrency(j.price) + '</td>' +
            '<td><a class="pcc-btn pcc-btn-xs pcc-btn-outline" href="#/jobs/' + _esc(j.id) + '">View</a></td>';
          hbody.appendChild(tr);
        });
      htable.appendChild(hbody);
      histSection.appendChild(htable);
      root.appendChild(histSection);
    }
  }

  /* ── expose ──────────────────────────────────────────────────────── */
  return { render: render, renderNew: renderNew, renderDetail: renderDetail };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccCustomers; }
