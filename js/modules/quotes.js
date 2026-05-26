/**
 * js/modules/quotes.js
 * PCC CRM — Quote Builder Module
 *
 * Lets the admin build a line-item quote, apply frequency discounts
 * and add-ons, preview a subtotal, and mark quotes as sent/accepted/declined.
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccQuotes.render()          — list view into #quotes-root
 *   pccQuotes.renderNew(params) — blank quote builder (params: customerId, leadId)
 *   pccQuotes.renderDetail(id)  — view / edit one quote
 */

'use strict';

var pccQuotes = (function () {

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

  /* ── status badge ────────────────────────────────────────────────── */
  function _statusBadge(status) {
    var map = {
      draft:    { label: 'Draft',    cls: 'badge-gray'   },
      sent:     { label: 'Sent',     cls: 'badge-blue'   },
      accepted: { label: 'Accepted', cls: 'badge-green'  },
      declined: { label: 'Declined', cls: 'badge-red'    },
      expired:  { label: 'Expired',  cls: 'badge-orange' },
    };
    var s = map[status] || { label: status || 'Unknown', cls: 'badge-gray' };
    return '<span class="pcc-badge ' + s.cls + '">' + _esc(s.label) + '</span>';
  }

  /* ── filter state ────────────────────────────────────────────────── */
  var _filter = { q: '', status: '', sort: 'newest' };

  function _applyFilter(quotes) {
    var q   = (_filter.q || '').toLowerCase();
    var out = quotes.slice();
    if (q) {
      out = out.filter(function (qt) {
        return (qt.customerName || '').toLowerCase().includes(q) ||
               (qt.email        || '').toLowerCase().includes(q) ||
               (qt.id           || '').toLowerCase().includes(q);
      });
    }
    if (_filter.status) {
      out = out.filter(function (qt) { return qt.status === _filter.status; });
    }
    out.sort(function (a, b) {
      if (_filter.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (_filter.sort === 'value')  return (b.total || 0) - (a.total || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return out;
  }

  /* ── toolbar ─────────────────────────────────────────────────────── */
  function _buildToolbar(root) {
    var bar = _el('div', 'pcc-toolbar');
    bar.innerHTML =
      '<input class="pcc-search" type="search" placeholder="Search quotes..." value="' + _esc(_filter.q) + '">' +
      '<select class="pcc-filter-select" data-filter="status">' +
        '<option value="">All Statuses</option>' +
        ['draft','sent','accepted','declined','expired'].map(function (s) {
          return '<option value="' + s + '"' + (_filter.status === s ? ' selected' : '') + '>' + _esc(s) + '</option>';
        }).join('') +
      '</select>' +
      '<select class="pcc-filter-select" data-filter="sort">' +
        '<option value="newest"' + (_filter.sort==='newest'?' selected':'') + '>Newest First</option>' +
        '<option value="oldest"' + (_filter.sort==='oldest'?' selected':'') + '>Oldest First</option>' +
        '<option value="value"'  + (_filter.sort==='value' ?' selected':'') + '>Highest Value</option>' +
      '</select>' +
      '<a class="pcc-btn pcc-btn-primary pcc-btn-sm" href="#/quotes/new">+ New Quote</a>';

    bar.querySelector('.pcc-search').addEventListener('input', function (e) {
      _filter.q = e.target.value; _renderTable(root);
    });
    bar.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        _filter[e.target.dataset.filter] = e.target.value; _renderTable(root);
      });
    });
    return bar;
  }

  /* ── quotes table ────────────────────────────────────────────────── */
  function _renderTable(root) {
    var quotes   = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];
    var filtered = _applyFilter(quotes);

    var existing = root.querySelector('.pcc-quotes-table-wrap');
    if (existing) existing.remove();

    var wrap = _el('div', 'pcc-quotes-table-wrap');

    if (!filtered.length) {
      wrap.innerHTML = '<p class="pcc-empty">No quotes yet. <a href="#/quotes/new">Create one</a>.</p>';
      root.appendChild(wrap);
      return;
    }

    var table = _el('table', 'pcc-table');
    table.innerHTML =
      '<thead><tr><th>Customer</th><th>Service</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>';

    var tbody = _el('tbody');
    filtered.forEach(function (qt) {
      var tr = _el('tr');
      tr.innerHTML =
        '<td><strong>' + _esc(qt.customerName || '—') + '</strong>' +
          (qt.email ? '<br><small>' + _esc(qt.email) + '</small>' : '') +
        '</td>' +
        '<td>' + _esc(qt.serviceType || '—') + '</td>' +
        '<td>' + _fmtCurrency(qt.total) + '</td>' +
        '<td>' + _statusBadge(qt.status) + '</td>' +
        '<td>' + _fmtDate(qt.createdAt) + '</td>' +
        '<td class="pcc-td-actions">' +
          '<a class="pcc-btn pcc-btn-xs pcc-btn-outline" href="#/quotes/' + _esc(qt.id) + '">View</a> ' +
          '<button class="pcc-btn pcc-btn-xs pcc-btn-danger pcc-del-quote" data-id="' + _esc(qt.id) + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('.pcc-del-quote');
      if (!btn) return;
      if (!confirm('Delete this quote? This cannot be undone.')) return;
      pccDeleteQuote(btn.dataset.id);
      _renderTable(root);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.innerHTML += '<p class="pcc-table-count">' + filtered.length + ' of ' + quotes.length + ' quotes</p>';
    root.appendChild(wrap);
  }

  /* ── PUBLIC: render ──────────────────────────────────────────────── */
  function render() {
    var root = document.getElementById('quotes-root');
    if (!root) { console.warn('[PCC Quotes] #quotes-root not found'); return; }
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">Quotes</h2>';
    root.appendChild(header);
    root.appendChild(_buildToolbar(root));
    _renderTable(root);
    console.info('[PCC Quotes] List rendered.');
  }

  /* ── pricing engine ──────────────────────────────────────────────── */
  function _calcTotal(serviceType, sqft, bedrooms, bathrooms, frequency, addons) {
    var services = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.SERVICES      : {};
    var freqDisc = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.FREQ_DISCOUNTS : {};
    var addonCfg = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.ADDONS        : {};

    var svc      = services[serviceType] || {};
    var base     = parseFloat(svc.basePrice || 0);

    // square footage bump
    var sqftN = parseInt(sqft) || 0;
    if (sqftN > 1500) base += Math.round((sqftN - 1500) / 500) * (svc.sqftRate || 20);

    // bedroom / bathroom bump
    base += (parseInt(bedrooms)  || 0) * (svc.bedroomRate  || 10);
    base += (parseInt(bathrooms) || 0) * (svc.bathroomRate || 15);

    // frequency discount
    var discRate = freqDisc[frequency] ? (freqDisc[frequency].discount || 0) : 0;
    var discount = +(base * discRate).toFixed(2);
    var afterDisc = base - discount;

    // add-ons
    var addonTotal = 0;
    (addons || []).forEach(function (key) {
      addonTotal += parseFloat((addonCfg[key] || {}).price || 0);
    });

    var total = +(afterDisc + addonTotal).toFixed(2);
    return { base: base, discount: discount, addonTotal: addonTotal, total: total };
  }

  /* ── quote builder form ──────────────────────────────────────────── */
  function _buildQuoteForm(qt, isNew) {
    qt = qt || {};
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES)
      ? Object.keys(PCC_CONFIG.SERVICES) : ['house','carpet','tile','pressure','deep','moveinout'];
    var freqs = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.FREQ_DISCOUNTS)
      ? Object.keys(PCC_CONFIG.FREQ_DISCOUNTS) : ['one_time','monthly','bi_weekly','weekly'];
    var addonCfg = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.ADDONS : {};
    var statuses = ['draft','sent','accepted','declined','expired'];

    var selectedAddons = qt.addons || [];

    return '<form class="pcc-form" id="quote-form">' +
      '<div class="pcc-form-grid">' +

      '<div class="pcc-form-group">' +
        '<label>Customer Name *</label>' +
        '<input name="customerName" type="text" required value="' + _esc(qt.customerName) + '" placeholder="Jane Smith">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Email</label>' +
        '<input name="email" type="email" value="' + _esc(qt.email) + '" placeholder="jane@example.com">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Phone</label>' +
        '<input name="phone" type="tel" value="' + _esc(qt.phone) + '" placeholder="(239) 555-0123">' +
      '</div>' +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Service Address</label>' +
        '<input name="address" type="text" value="' + _esc(qt.address) + '" placeholder="123 Main St, Naples FL">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Service Type *</label>' +
        '<select name="serviceType" id="qt-service">' +
          services.map(function (s) {
            return '<option value="' + s + '"' + (qt.serviceType === s ? ' selected' : '') + '>' + _esc(s.replace(/_/g,' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Frequency</label>' +
        '<select name="frequency" id="qt-freq">' +
          freqs.map(function (f) {
            return '<option value="' + f + '"' + (qt.frequency === f ? ' selected' : '') + '>' + _esc(f.replace(/_/g,' ')) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Sq Footage</label>' +
        '<input name="sqft" type="number" min="0" value="' + _esc(qt.sqft) + '" placeholder="1500">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Bedrooms</label>' +
        '<input name="bedrooms" type="number" min="0" max="10" value="' + _esc(qt.bedrooms) + '" placeholder="3">' +
      '</div>' +

      '<div class="pcc-form-group">' +
        '<label>Bathrooms</label>' +
        '<input name="bathrooms" type="number" min="0" max="10" value="' + _esc(qt.bathrooms) + '" placeholder="2">' +
      '</div>' +

      (!isNew ? '<div class="pcc-form-group"><label>Status</label><select name="status">' +
        statuses.map(function (s) {
          return '<option value="' + s + '"' + (qt.status === s ? ' selected' : '') + '>' + _esc(s) + '</option>';
        }).join('') +
      '</select></div>' : '') +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Add-Ons</label>' +
        '<div class="pcc-addon-grid">' +
          Object.keys(addonCfg).map(function (key) {
            var a = addonCfg[key];
            var checked = selectedAddons.indexOf(key) !== -1 ? ' checked' : '';
            return '<label class="pcc-addon-item">' +
              '<input type="checkbox" name="addons" value="' + _esc(key) + '"' + checked + '> ' +
              _esc((a.label || key) + ' (+$' + (a.price || 0) + ')') +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="pcc-form-group pcc-form-wide">' +
        '<label>Notes</label>' +
        '<textarea name="notes" rows="3" placeholder="Special instructions...">' + _esc(qt.notes) + '</textarea>' +
      '</div>' +

      '</div>' +

      '<div class="pcc-price-preview" id="qt-preview">' +
        '<span class="pcc-preview-label">Estimated Total</span>' +
        '<span class="pcc-preview-total" id="qt-total-display">' + _fmtCurrency(qt.total) + '</span>' +
      '</div>' +

      '<div class="pcc-form-actions">' +
        '<button type="submit" class="pcc-btn pcc-btn-primary">' + (isNew ? 'Create Quote' : 'Save Quote') + '</button>' +
        (!isNew ? '<button type="button" class="pcc-btn pcc-btn-success" id="qt-accept-btn">Mark Accepted</button>' : '') +
        '<a href="#/quotes" class="pcc-btn pcc-btn-outline">Cancel</a>' +
      '</div>' +
    '</form>';
  }

  /* live price preview wiring */
  function _wirePreview(form) {
    var fields = ['qt-service','qt-freq'];
    var inputs = ['sqft','bedrooms','bathrooms'];

    function _update() {
      var serviceType = (form.querySelector('#qt-service') || {}).value || '';
      var frequency   = (form.querySelector('#qt-freq')   || {}).value || '';
      var sqft        = (form.querySelector('[name=sqft]')    || {}).value || 0;
      var beds        = (form.querySelector('[name=bedrooms]')  || {}).value || 0;
      var baths       = (form.querySelector('[name=bathrooms]') || {}).value || 0;
      var addons      = Array.from(form.querySelectorAll('[name=addons]:checked')).map(function (cb) { return cb.value; });
      var result      = _calcTotal(serviceType, sqft, beds, baths, frequency, addons);
      var disp        = form.querySelector('#qt-total-display');
      if (disp) disp.textContent = _fmtCurrency(result.total);
      form._lastTotal = result.total;
    }

    fields.forEach(function (id) {
      var el = form.querySelector('#' + id);
      if (el) el.addEventListener('change', _update);
    });
    inputs.forEach(function (name) {
      var el = form.querySelector('[name=' + name + ']');
      if (el) el.addEventListener('input', _update);
    });
    form.querySelectorAll('[name=addons]').forEach(function (cb) {
      cb.addEventListener('change', _update);
    });
    _update();
  }

  /* ── PUBLIC: renderNew ───────────────────────────────────────────── */
  function renderNew(params) {
    params = params || {};
    var root = document.getElementById('quotes-root');
    if (!root) return;
    root.innerHTML = '';

    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">New Quote</h2>' +
      '<a href="#/quotes" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);

    // pre-fill from customer if customerId passed
    var prefill = {};
    if (params.customerId) {
      var customers = (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [];
      var cust = customers.find(function (c) { return c.id === params.customerId; });
      if (cust) {
        prefill = { customerName: cust.name, email: cust.email, phone: cust.phone,
                    address: cust.address, serviceType: cust.serviceType, frequency: cust.frequency,
                    customerId: cust.id };
      }
    }

    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildQuoteForm(prefill, true);
    root.appendChild(card);

    var form = card.querySelector('#quote-form');
    _wirePreview(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd      = new FormData(e.target);
      var data    = Object.fromEntries(fd.entries());
      data.addons = fd.getAll('addons');
      data.total  = form._lastTotal || 0;
      data.status = 'draft';
      pccAddQuote(data);
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/quotes');
    });
  }

  /* ── PUBLIC: renderDetail ────────────────────────────────────────── */
  function renderDetail(id) {
    var root = document.getElementById('quotes-root');
    if (!root) return;

    var quotes = (typeof pccGetQuotes === 'function') ? pccGetQuotes() : [];
    var qt     = quotes.find(function (q) { return q.id === id; });

    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML =
      '<h2 class="pcc-module-title">' + _esc(qt ? ('Quote — ' + (qt.customerName || qt.id)) : 'Not Found') + '</h2>' +
      '<a href="#/quotes" class="pcc-btn pcc-btn-outline pcc-btn-sm">Back</a>';
    root.appendChild(header);

    if (!qt) {
      root.innerHTML += '<p class="pcc-empty">Quote not found.</p>';
      return;
    }

    var meta = _el('div', 'pcc-detail-meta');
    meta.innerHTML =
      '<span>Created: ' + _fmtDate(qt.createdAt) + '</span>' +
      '<span>Status: ' + _statusBadge(qt.status) + '</span>' +
      '<span>Total: <strong>' + _fmtCurrency(qt.total) + '</strong></span>';
    root.appendChild(meta);

    var card = _el('div', 'pcc-form-card');
    card.innerHTML = _buildQuoteForm(qt, false);
    root.appendChild(card);

    var form = card.querySelector('#quote-form');
    _wirePreview(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd      = new FormData(e.target);
      var data    = Object.fromEntries(fd.entries());
      data.addons = fd.getAll('addons');
      data.total  = form._lastTotal || qt.total || 0;
      pccUpdateQuote(id, data);
      var msg = _el('div', 'pcc-toast pcc-toast-success');
      msg.textContent = 'Quote saved.';
      root.prepend(msg);
      setTimeout(function () { msg.remove(); }, 3000);
    });

    var acceptBtn = card.querySelector('#qt-accept-btn');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        pccUpdateQuote(id, { status: 'accepted' });
        if (typeof pccRouter !== 'undefined') pccRouter.go('#/jobs/new?quoteId=' + id);
      });
    }
  }

  /* ── expose ──────────────────────────────────────────────────────── */
  return { render: render, renderNew: renderNew, renderDetail: renderDetail };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccQuotes; }
