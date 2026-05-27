/**
 * js/modules/routeplanner.js -- PCC CRM Route Planner Module (Step 8)
 * Internal dispatch/scheduling helper only.
 * NOT GPS, NOT live tracking, NOT a routing API.
 * Reads from existing pcc_jobs localStorage key only.
 * No new localStorage keys created.
 */
'use strict';

var pccRoutePlanner = (function () {

  // ---- SAFE STORAGE READ ----
  function _getJobs() {
    try {
      var raw = localStorage.getItem('pcc_jobs');
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[RoutePlanner] pcc_jobs parse error:', e);
      return [];
    }
  }

  // ---- SAFE STORAGE WRITE (update area/zone inside existing job records) ----
  function _saveJobs(jobs) {
    try {
      localStorage.setItem('pcc_jobs', JSON.stringify(jobs));
    } catch (e) {
      console.warn('[RoutePlanner] pcc_jobs save error:', e);
    }
  }

  // ---- HELPERS ----
  function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _today() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function _formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      var parts = dateStr.split('-');
      if (parts.length === 3) {
        return parts[1] + '/' + parts[2] + '/' + parts[0];
      }
    } catch (e) { /* ignore */ }
    return dateStr;
  }

  function _statusLabel(status) {
    var map = {
      'scheduled':   'Scheduled',
      'in_progress': 'In Progress',
      'completed':   'Completed',
      'invoiced':    'Invoiced',
      'cancelled':   'Cancelled'
    };
    return map[status] || (status ? String(status) : 'Unknown');
  }

  function _statusClass(status) {
    var map = {
      'scheduled':   'prp-status-scheduled',
      'in_progress': 'prp-status-inprogress',
      'completed':   'prp-status-completed',
      'invoiced':    'prp-status-invoiced',
      'cancelled':   'prp-status-cancelled'
    };
    return map[status] || 'prp-status-unknown';
  }

  // ---- STATE ----
  var _state = {
    filterDate:   '',
    filterStatus: 'all',
    filterArea:   '',
    jobs:         [],
    order:        []   // array of job indices reflecting manual reorder
  };

  // ---- RENDER ----
  function render() {
    var root = document.getElementById('admin-shell');
    if (!root) return;
    var el = document.getElementById('routeplanner-root');
    if (!el) return;

    _state.jobs = _getJobs();

    // Build order array if empty or stale
    if (_state.order.length !== _state.jobs.length) {
      _state.order = _state.jobs.map(function (_, i) { return i; });
    }

    el.innerHTML = _buildHTML();
    _bindEvents(el);
  }

  function _buildHTML() {
    var jobs = _state.jobs;
    var filtered = _applyFilters(jobs);

    var cards = filtered.length === 0
      ? '<p class="prp-empty">No jobs match the selected filters.</p>'
      : filtered.map(function (item, pos) {
          return _buildCard(item.job, item.originalIndex, pos, filtered.length);
        }).join('');

    return `<div class="prp-wrap">
  <div class="prp-disclaimer">
    &#9432; Internal dispatch helper only. This is not GPS, live tracking, or a routing system.
  </div>

  <div class="prp-header">
    <h2 class="prp-title">Route Planner</h2>
    <span class="prp-count">\${filtered.length} job\${filtered.length !== 1 ? 's' : ''} shown</span>
  </div>

  <div class="prp-filters">
    <div class="prp-filter-group">
      <label class="prp-filter-label" for="prp-filter-date">Date</label>
      <input type="date" id="prp-filter-date" class="prp-filter-input" value="\${_esc(_state.filterDate)}">
    </div>
    <div class="prp-filter-group">
      <label class="prp-filter-label" for="prp-filter-status">Status</label>
      <select id="prp-filter-status" class="prp-filter-select">
        <option value="all"\${_state.filterStatus==='all'?' selected':''}>All Statuses</option>
        <option value="scheduled"\${_state.filterStatus==='scheduled'?' selected':''}>Scheduled</option>
        <option value="in_progress"\${_state.filterStatus==='in_progress'?' selected':''}>In Progress</option>
        <option value="completed"\${_state.filterStatus==='completed'?' selected':''}>Completed</option>
        <option value="invoiced"\${_state.filterStatus==='invoiced'?' selected':''}>Invoiced</option>
        <option value="cancelled"\${_state.filterStatus==='cancelled'?' selected':''}>Cancelled</option>
      </select>
    </div>
    <div class="prp-filter-group">
      <label class="prp-filter-label" for="prp-filter-area">Area/Zone</label>
      <input type="text" id="prp-filter-area" class="prp-filter-input" placeholder="Filter by area..." value="\${_esc(_state.filterArea)}">
    </div>
    <button id="prp-btn-today" class="prp-btn-today" type="button">Today</button>
    <button id="prp-btn-clear" class="prp-btn-clear" type="button">Clear Filters</button>
  </div>

  <div class="prp-cards" id="prp-cards-list">
    \${cards}
  </div>
</div>`;
  }

  function _buildCard(job, origIdx, pos, total) {
    var name      = _esc(job.customerName || job.name || 'Unnamed Job');
    var address   = _esc(job.address || job.city || '');
    var phone     = _esc(job.phone || '');
    var status    = job.status || 'scheduled';
    var date      = _esc(job.scheduledDate || job.date || '');
    var time      = _esc(job.scheduledTime || job.time || '');
    var area      = _esc(job.routeArea || '');
    var notes     = _esc(job.routeNotes || '');
    var sClass    = _statusClass(status);
    var sLabel    = _statusLabel(status);
    var upDis     = pos === 0 ? ' disabled' : '';
    var downDis   = pos === total - 1 ? ' disabled' : '';

    return `<div class="prp-card" data-orig-idx="\${origIdx}">
  <div class="prp-card-top">
    <div class="prp-card-order">
      <button class="prp-move-up" data-orig-idx="\${origIdx}" type="button"\${upDis} title="Move up">&#9650;</button>
      <span class="prp-order-num">\${pos + 1}</span>
      <button class="prp-move-down" data-orig-idx="\${origIdx}" type="button"\${downDis} title="Move down">&#9660;</button>
    </div>
    <div class="prp-card-info">
      <div class="prp-card-name">\${name}</div>
      \${address ? \`<div class="prp-card-address">&#128205; \${address}</div>\` : ''}
      \${phone ? \`<div class="prp-card-phone">&#128222; \${phone}</div>\` : ''}
      <div class="prp-card-datetime">
        \${date ? '&#128197; ' + _formatDate(date) : ''}
        \${time ? '&#128336; ' + time : ''}
        \${!date && !time ? '<span class="prp-no-date">No date/time set</span>' : ''}
      </div>
    </div>
    <div class="prp-card-right">
      <span class="prp-status-badge \${sClass}">\${sLabel}</span>
    </div>
  </div>
  <div class="prp-card-bottom">
    <div class="prp-field-group">
      <label class="prp-field-label" for="prp-area-\${origIdx}">Area / Zone</label>
      <input type="text"
             id="prp-area-\${origIdx}"
             class="prp-area-input"
             data-orig-idx="\${origIdx}"
             placeholder="e.g. North Cape Coral, Route A..."
             value="\${area}">
    </div>
    <div class="prp-field-group">
      <label class="prp-field-label" for="prp-notes-\${origIdx}">Dispatch Notes</label>
      <input type="text"
             id="prp-notes-\${origIdx}"
             class="prp-notes-input"
             data-orig-idx="\${origIdx}"
             placeholder="Optional notes..."
             value="\${notes}">
    </div>
  </div>
</div>`;
  }

  // ---- FILTERING ----
  function _applyFilters(jobs) {
    var result = [];
    // Apply manual order
    var ordered = _state.order
      .filter(function (i) { return i < jobs.length; })
      .map(function (i) { return { job: jobs[i], originalIndex: i }; });

    ordered.forEach(function (item) {
      var job = item.job;
      // Date filter
      if (_state.filterDate) {
        var jobDate = job.scheduledDate || job.date || '';
        if (!jobDate || jobDate.indexOf(_state.filterDate) === -1) return;
      }
      // Status filter
      if (_state.filterStatus !== 'all') {
        if ((job.status || 'scheduled') !== _state.filterStatus) return;
      }
      // Area filter
      if (_state.filterArea) {
        var area = (job.routeArea || '').toLowerCase();
        var city = (job.city || job.address || '').toLowerCase();
        var needle = _state.filterArea.toLowerCase();
        if (area.indexOf(needle) === -1 && city.indexOf(needle) === -1) return;
      }
      result.push(item);
    });
    return result;
  }

  // ---- EVENTS ----
  function _bindEvents(el) {
    // Date filter
    var dateInput = el.querySelector('#prp-filter-date');
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        _state.filterDate = this.value;
        _rerender(el);
      });
    }

    // Status filter
    var statusSel = el.querySelector('#prp-filter-status');
    if (statusSel) {
      statusSel.addEventListener('change', function () {
        _state.filterStatus = this.value;
        _rerender(el);
      });
    }

    // Area filter
    var areaInput = el.querySelector('#prp-filter-area');
    if (areaInput) {
      areaInput.addEventListener('input', function () {
        _state.filterArea = this.value;
        _rerender(el);
      });
    }

    // Today button
    var todayBtn = el.querySelector('#prp-btn-today');
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        _state.filterDate = _today();
        _rerender(el);
      });
    }

    // Clear filters button
    var clearBtn = el.querySelector('#prp-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        _state.filterDate   = '';
        _state.filterStatus = 'all';
        _state.filterArea   = '';
        _rerender(el);
      });
    }

    // Move up/down buttons (delegated)
    var cardsList = el.querySelector('#prp-cards-list');
    if (cardsList) {
      cardsList.addEventListener('click', function (e) {
        var upBtn   = e.target.closest('.prp-move-up');
        var downBtn = e.target.closest('.prp-move-down');
        if (!upBtn && !downBtn) return;

        var btn = upBtn || downBtn;
        if (btn.disabled) return;
        var origIdx = parseInt(btn.dataset.origIdx, 10);

        // Find position of this origIdx in current order
        var posInOrder = _state.order.indexOf(origIdx);
        if (posInOrder === -1) return;

        if (upBtn && posInOrder > 0) {
          // Swap with previous
          var tmp = _state.order[posInOrder - 1];
          _state.order[posInOrder - 1] = _state.order[posInOrder];
          _state.order[posInOrder] = tmp;
        } else if (downBtn && posInOrder < _state.order.length - 1) {
          // Swap with next
          var tmp2 = _state.order[posInOrder + 1];
          _state.order[posInOrder + 1] = _state.order[posInOrder];
          _state.order[posInOrder] = tmp2;
        }
        _rerender(el);
      });

      // Area input save (on blur)
      cardsList.addEventListener('blur', function (e) {
        var areaInput2 = e.target.closest('.prp-area-input');
        var notesInput = e.target.closest('.prp-notes-input');
        var target = areaInput2 || notesInput;
        if (!target) return;

        var origIdx = parseInt(target.dataset.origIdx, 10);
        if (isNaN(origIdx) || origIdx >= _state.jobs.length) return;

        if (areaInput2) {
          _state.jobs[origIdx].routeArea = target.value.trim();
        } else {
          _state.jobs[origIdx].routeNotes = target.value.trim();
        }
        _saveJobs(_state.jobs);
      }, true); // use capture for blur
    }
  }

  function _rerender(el) {
    // Preserve filter input focus
    var activeId = document.activeElement ? document.activeElement.id : null;
    el.innerHTML = _buildHTML();
    _bindEvents(el);
    if (activeId) {
      var refocus = el.querySelector('#' + activeId);
      if (refocus) refocus.focus();
    }
  }

  return { render: render };

})();
