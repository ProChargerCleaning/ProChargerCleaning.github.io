/**
 * js/modules/leads.js
 * PCC CRM — Lead Management Module
 *
 * Handles the full lead pipeline: list view, detail/edit panel,
 * status transitions, search/filter, and conversion to customer.
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccLeads.render()          — render list into #leads-root
 *   pccLeads.renderDetail(id)  — open detail/edit panel for one lead
 *   pccLeads.renderNew()       — open blank new-lead form
 */

'use strict';

var pccLeads = (function () {

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

  function _statusBadge(status) {
    var map = {
      new:        { label: 'New',        cls: 'badge-blue'   },
      contacted:  { label: 'Contacted',  cls: 'badge-yellow' },
      quoted:     { label: 'Quoted',     cls: 'badge-purple' },
      follow_up:  { label: 'Follow-Up',  cls: 'badge-orange' },
      converted:  { label: 'Converted',  cls: 'badge-green'  },
      closed:     { label: 'Closed',     cls: 'badge-gray'   },
    };
    var s = map[status] || { label: status || 'Unknown', cls: 'badge-gray' };
    return '<span class="pcc-badge ' + s.cls + '">' + _esc(s.label) + '</span>';
  }

  function _sourceLabel(src) {
    var map = {
      website: 'Website Form', google: 'Google', referral: 'Referral',
      facebook: 'Facebook', instagram: 'Instagram', phone: 'Phone Call',
      walkin: 'Walk-In', other: 'Other'
    };
    return map[src] || src || '—';
  }

  /* ── filter / search state ───────────────────────────────────────── */
  var _filter = { q: '', status: '', source: '', sort: 'newest' };

  function _applyFilter(leads) {
    var q   = (_filter.q || '').toLowerCase();
    var out = leads.slice();

    if (q) {
      out = out.filter(function (l) {
        return (l.name    || '').toLowerCase().includes(q) ||
               (l.email   || '').toLowerCase().includes(q) ||
               (l.phone   || '').toLowerCase().includes(q) ||
               (l.address || '').toLowerCase().includes(q) ||
               (l.notes   || '').toLowerCase().includes(q);
      });
    }
    if (_filter.status) {
      out = out.filter(function (l) { return l.status === _filter.status; });
    }
    if (_filter.source) {
      out = out.filter(function (l) { return l.source === _filter.source; });
    }

    out.sort(function (a, b) {
      if (_filter.sort === 'oldest')  return new Date(a.createdAt) - new Date(b.createdAt);
      if (_filter.sort === 'name')    return (a.name || '').localeCompare(b.name || '');
      return new Date(b.createdAt) - new Date(a.createdAt); // newest
    });

    return out;
  }

  /* ── toolbar (search + filters) ─────────────────────────────────── */
  function _buildToolbar(root) {
    var bar = _el('div', 'pcc-toolbar');

    var statuses = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.LEAD_STATUSES)
      ? PCC_CONFIG.LEAD_STATUSES
      : ['new','contacted','quoted','follow_up','converted','closed'];

    bar.innerHTML =
      '<input class="pcc-search" type="search" placeholder="Search leads..." value="' + _esc(_filter.q) + '">' +
      '<select class="pcc-filter-select" data-filter="status">' +
        '<option value="">All Statuses</option>' +
        statuses.map(function (s) {
          return '<option value="' + s + '"' + (_filter.status === s ? ' selected' : '') + '>' + _esc(s.replace('_',' ')) + '</option>';
        }).join('') +
      '</select>' +
      '<select class="pcc-filter-select" data-filter="sort">' +
        '<option value="newest"' + (_filter.sort==='newest'?' selected':'') + '>Newest First</option>' +
        '<option value="oldest"' + (_filter.sort==='oldest'?' selected':'') + '>Oldest First</option>' +
        '<option value="name"'  + (_filter.sort==='name'  ?' selected':'') + '>Name A-Z</option>' +
      '</select>' +
      '<a class="pcc-btn pcc-btn-primary pcc-btn-sm" href="#/leads/new">+ New Lead</a>';

    bar.querySelector('.pcc-search').addEventListener('input', function (e) {
      _filter.q = e.target.value;
      _renderTable(root);
    });
    bar.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        _filter[e.target.dataset.filter] = e.target.value;
        _renderTable(root);
      });
    });

    return bar;
  }

  /* ── leads table ─────────────────────────────────────────────────── */
  function _renderTable(root) {
    var leads    = (typeof pccGetLeads === 'function') ? pccGetLeads() : [];
    var filtered = _applyFilter(leads);

    var existing = root.querySelector('.pcc-leads-table-wrap');
    if (existing) existing.remove();

    var wrap = _el('div', 'pcc-leads-table-wrap');

    if (!filtered.length) {
      wrap.innerHTML = '<p class="pcc-empty">No leads found. Try adjusting your search or <a href="#/leads/new">add a new lead</a>.</p>';
      root.appendChild(wrap);
      return;
    }

    var table = _el('table', 'pcc-table');
    table.innerHTML =
      '<thead><tr>' +
        '<th>Name</th><th>Contact</th><th>Service</th>' +
        '<th>Status</th><th>Source</th><th>Date</th><th>Actions</th>' +
      '</tr></thead>';

    var tbody = _el('tbody');
    filtered.forEach(function (lead) {
      var tr = _el('tr');
      tr.innerHTML =
        '<td class="pcc-td-name"><strong>' + _esc(lead.name || '—') + '</strong>' +
          (lead.address ? '<br><small>' + _esc(lead.address) + '</small>' : '') +
        '</td>' +
        '<td>' + _esc(lead.email || '') + (lead.phone ? '<br>' + _esc(lead.phone) : '') + '</td>' +
        '<td>' + _esc(lead.serviceType || '—') + '</td>' +
        '<td>' + _statusBadge(lead.status) + '</td>' +
        '<td>' + _esc(_sourceLabel(lead.source)) + '</td>' +
        '<td>' + _fmtDate(lead.createdAt) + '</td>' +
        '<td class="pcc-td-actions">' +
          '<a class="pcc-btn pcc-btn-xs pcc-btn-outline" href="#/leads/' + _esc(lead.id) + '">View</a> ' +
          '<button class="pcc-btn pcc-btn-xs pcc-btn-danger pcc-del-lead" data-id="' + _esc(lead.id) + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Delete handlers
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('.pcc-del-lead');
      if (!btn) return;
      if (!confirm('Delete this lead? This cannot be undone.')) return;
      pccDeleteLead(btn.dataset.id);
      _renderTable(root);
    });

    wrap.appendChild(table);
    wrap.innerHTML += '<p class="pcc-table-count">' + filtered.length + ' of ' + leads.length + ' leads</p>';
    root.appendChild(wrap);
  }

  /* ── PUBLIC: render (list view) ──────────────────────────────────── */
  function render() {
    var root = document.getElementById('leads-root');
    if (!root) { console.warn('[PCC Leads] #leads-root not found'); return; }

    root.innerHTML = '';

    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">Leads</h2>';
    root.appendChild(header);

    root.appendChild(_buildToolbar(root));
    _renderTable(root);

    console.info('[PCC Leads] List rendered.');
  }

  /* ── lead detail / edit form ─────────────────────────────────────── */
  function _buildForm(lead, isNew) {
    lead = lead || {};
    var statuses = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.LEAD_STATUSES)
      ? PCC_CONFIG.LEAD_STATUSES
      : ['new','contacted','quoted','follow_up','converted','closed'];
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
      ? Object.keys(PCC_CONFIG.SERVICES)
      : ['house','carpet','tile','pressure','deep','moveinout'];
    var sources = ['website','google','referral','facebook','instagram','phone','walkin','other'];

    return '<form class="pcc-form" id="lead-form">' +
      '<div class="pcc-form-grid">' +

      '<div class="pcc-form-group">' +
        '<label>Full Name *</label>' +
        '<input name="name" type="text" required value="' + _esc(lead.name) + '" placeholder="Jane Smith">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Email</label>' +
        '<input name="email" type="email" value="' + _esc(lead.email) + '" placeholder="jane@example.com">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Phone</label>' +
        '<input name="phone" type="tel" value="' + _esc(lead.phone) + '" placeholder="(239) 555-0123">' +
      '</div>' +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Address</label>' +
        '<input name="address" type="text" value="' + _esc(lead.address) + '" placeholder="123 Main St, Naples FL 34102">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Service Interest</label>' +
        '<select name="serviceType">' +
          '<option value="">— Select —</option>' +
          services.map(function (s) {
            return '<option value="' + s + '"' + (lead.serviceType === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Source</label>' +
        '<select name="source">' +
          sources.map(function (s) {
            return '<option value="' + s + '"' + (lead.source === s ? ' selected' : '') + '>' + _esc(_sourceLabel(s)) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      (isNew ? '' :
      '<div class="pcc-form-group">' +
        '<label>Status</label>' +
        '<select name="status">' +
          statuses.map(function (s) {
            return '<option value="' + s + '"' + (lead.status === s ? ' selected' : '') + '>' + _esc(s.replace('_',' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>') +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Notes</label>' +
        '<textarea name="notes" rows="4" placeholder="Any details about the request...">' + _esc(lead.notes) + '</textarea>' +
      '</div>' +

      '</div>' +
      '<div class="pcc-form-actions">' +
        '<button type="submit" class="pcc-btn pcc-btn-primary">' + (isNew ? 'Add Lead' : 'Save Changes') + '</button>' +
        (isNew ? '' : '<button type="button" class="pcc-btn pcc-btn-success" id="lead-convert-btn">Convert to Customer</button>') +
        '<a href="#/leads" class="pcc-btn pcc-btn-outline">Cancel</a>' +
      '</div>' +
    '</form>';
  }

  /* ── PUBLIC: renderNew ───────────────────────────────────────────── */
  function renderNew() {
    var root = document.getElementById('leads-root');
    if (!root) return;

    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">New Lead</h2>' +
      '<a href="#/leads" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back to Leads</a>';
    root.appendChild(header);

    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildForm(null, true);
    root.appendChild(card);

    card.querySelector('#lead-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      pccAddLead(data);
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/leads');
    });
  }

  /* ── PUBLIC: renderDetail ────────────────────────────────────────── */
  function renderDetail(id) {
    var root = document.getElementById('leads-root');
    if (!root) return;

    var leads = (typeof pccGetLeads === 'function') ? pccGetLeads() : [];
    var lead  = leads.find(function (l) { return l.id === id; });

    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">' + _esc(lead ? (lead.name || 'Lead Detail') : 'Lead Not Found') + '</h2>' +
      '<a href="#/leads" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back to Leads</a>';
    root.appendChild(header);

    if (!lead) {
      root.innerHTML += '<p class="pcc-empty">Lead not found. It may have been deleted.</p>';
      return;
    }

    // Meta strip
    var meta = _el('div', 'pcc-detail-meta');
    meta.innerHTML =
      '<span>Created: ' + _fmtDate(lead.createdAt) + '</span>' +
      (lead.updatedAt ? '<span>Updated: ' + _fmtDate(lead.updatedAt) + '</span>' : '') +
      '<span>Status: ' + _statusBadge(lead.status) + '</span>' +
      '<span>Source: ' + _esc(_sourceLabel(lead.source)) + '</span>';
    root.appendChild(meta);

    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildForm(lead, false);
    root.appendChild(card);

    // Save handler
    card.querySelector('#lead-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      pccUpdateLead(id, data);
      var msg = _el('div', 'pcc-toast pcc-toast-success');
      msg.textContent = 'Lead saved.';
      root.prepend(msg);
      setTimeout(function () { msg.remove(); }, 3000);
    });

    // Convert to customer
    var convertBtn = card.querySelector('#lead-convert-btn');
    if (convertBtn) {
      convertBtn.addEventListener('click', function () {
        if (!confirm('Convert this lead to a customer? The lead status will be set to Converted.')) return;
        pccUpdateLead(id, { status: 'converted' });
        pccAddCustomer({
          name:        lead.name,
          email:       lead.email,
          phone:       lead.phone,
          address:     lead.address,
          serviceType: lead.serviceType,
          notes:       lead.notes,
          sourceLeadId: id,
        });
        if (typeof pccRouter !== 'undefined') pccRouter.go('#/customers');
      });
    }
  }

  /* ── expose ──────────────────────────────────────────────────────── */
  return { render: render, renderNew: renderNew, renderDetail: renderDetail };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccLeads; }
