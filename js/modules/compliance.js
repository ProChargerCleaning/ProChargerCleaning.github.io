/**
 * js/modules/compliance.js -- PCC CRM Compliance Module (Step 7)
 * Internal business-operations checklist only.
 * NOT legal certification, NOT regulatory certification,
 * NOT insurance proof, NOT a public trust claim, NOT a guarantee.
 */
'use strict';

var pccCompliance = (function () {

  var STORAGE_KEY = 'pcc_compliance';

  /* -- Default checklist data -- */
  var CATEGORIES = [
    {
      id: 'licensing',
      title: 'Licensing & Registration',
      items: [
        { id: 'lic_1', text: 'Florida business license current and on file' },
        { id: 'lic_2', text: 'State sales tax / service registration up to date' },
        { id: 'lic_3', text: 'Business name registered (DBA or LLC)' },
        { id: 'lic_4', text: 'Contractor / occupational license (if required)' }
      ]
    },
    {
      id: 'insurance',
      title: 'Insurance & Financials',
      items: [
        { id: 'ins_1', text: 'General liability insurance policy active' },
        { id: 'ins_2', text: 'Workers comp policy active (or sole-proprietor exemption filed)' },
        { id: 'ins_3', text: 'Business bank account separate from personal' },
        { id: 'ins_4', text: 'Quarterly estimated taxes scheduled / paid' },
        { id: 'ins_5', text: 'Bookkeeping / accounting up to date (monthly)' }
      ]
    },
    {
      id: 'environmental',
      title: 'Environmental & Chemical Safety',
      items: [
        { id: 'env_1', text: 'SDS sheets on file for all cleaning chemicals' },
        { id: 'env_2', text: 'Chemical storage meets safety requirements' },
        { id: 'env_3', text: 'Proper disposal procedure for chemical waste documented' },
        { id: 'env_4', text: 'Eco-friendly / low-VOC product list reviewed this quarter' },
        { id: 'env_5', text: 'Vehicle chemical transport compliant with DOT guidelines' }
      ]
    },
    {
      id: 'hr',
      title: 'HR & Staff',
      items: [
        { id: 'hr_1', text: 'W-9 or I-9 on file for all contractors / employees' },
        { id: 'hr_2', text: 'Background checks completed for all field staff' },
        { id: 'hr_3', text: 'Employee handbook / contractor agreement signed' },
        { id: 'hr_4', text: 'Payroll records up to date' },
        { id: 'hr_5', text: 'OSHA safety training completed for new hires' }
      ]
    },
    {
      id: 'policies',
      title: 'Policies & SOPs',
      items: [
        { id: 'pol_1', text: 'Customer service policy documented' },
        { id: 'pol_2', text: 'Cancellation / rescheduling policy documented' },
        { id: 'pol_3', text: 'Damage claim / liability waiver process documented' },
        { id: 'pol_4', text: 'Privacy policy for customer data in place' }
      ]
    }
  ];

  /* -- Safe localStorage helpers -- */
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return _defaultState();
      var parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return _defaultState();
      var def = _defaultState();
      if (!parsed.checks || typeof parsed.checks !== 'object') parsed.checks = def.checks;
      if (typeof parsed.notes !== 'string') parsed.notes = def.notes;
      return parsed;
    } catch (e) {
      console.warn('[PCC Compliance] localStorage parse error - using defaults', e);
      return _defaultState();
    }
  }

  function _save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[PCC Compliance] localStorage save error', e);
    }
  }

  function _defaultState() {
    var checks = {};
    CATEGORIES.forEach(function (cat) {
      cat.items.forEach(function (item) {
        checks[item.id] = false;
      });
    });
    return { checks: checks, notes: '' };
  }

  /* -- Score calculation -- */
  function _calcScore(checks) {
    var total = 0, done = 0;
    CATEGORIES.forEach(function (cat) {
      cat.items.forEach(function (item) {
        total++;
        if (checks[item.id]) done++;
      });
    });
    return { done: done, total: total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  /* -- Main render -- */
  function render() {
    var root = document.getElementById('compliance-root');
    if (!root) return;

    var state = _load();
    var score = _calcScore(state.checks);
    var barColor = score.pct >= 80 ? '#4caf50' : score.pct >= 50 ? '#ff9800' : '#f44336';

    var catHTML = CATEGORIES.map(function (cat) {
      var itemsHTML = cat.items.map(function (item) {
        var chk = state.checks[item.id] ? 'checked' : '';
        return '<label class="pcomp-item">' +
          '<input type="checkbox" data-item-id="' + item.id + '" ' + chk + '/>' +
          '<span class="pcomp-item-text">' + _esc(item.text) + '</span>' +
          '</label>';
      }).join('');
      return '<div class="pcomp-section">' +
        '<h3 class="pcomp-section-title">' + _esc(cat.title) + '</h3>' +
        '<div class="pcomp-checklist">' + itemsHTML + '</div>' +
        '</div>';
    }).join('');

    root.innerHTML =
      '<div class="pcc-module-header">' +
        '<h2 class="pcc-module-title">Compliance Checklist</h2>' +
      '</div>' +
      '<div class="pcomp-disclaimer">' +
        '<strong>Internal checklist only.</strong> ' +
        'This does not verify legal, insurance, licensing, or regulatory compliance.' +
      '</div>' +
      '<div class="pcomp-score-wrap pcard" style="margin-bottom:16px">' +
        '<div class="pcomp-score-header">' +
          '<span class="pcomp-score-label">Completion Score</span>' +
          '<span class="pcomp-score-nums">' +
            '<strong id="comp-done">' + score.done + '</strong> / ' +
            '<strong id="comp-total">' + score.total + '</strong>' +
            ' &nbsp;|&nbsp; ' +
            '<strong id="comp-pct" style="color:' + barColor + '">' + score.pct + '%</strong>' +
          '</span>' +
        '</div>' +
        '<div class="pcomp-bar-wrap">' +
          '<div class="pcomp-bar">' +
            '<div class="pcomp-fill" id="comp-fill" style="width:' + score.pct + '%;background:' + barColor + '"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pcomp-grid" id="comp-grid">' + catHTML + '</div>' +
      '<div class="pcard" style="margin-top:16px">' +
        '<div class="pcomp-notes-header">Internal Notes</div>' +
        '<textarea id="comp-notes" class="pinput pcomp-notes-area" rows="4" ' +
        'placeholder="Internal compliance notes, renewal dates, action items...">' +
        _esc(state.notes) + '</textarea>' +
        '<div style="margin-top:6px;font-size:11px;color:var(--muted)">Notes save automatically.</div>' +
      '</div>';

    /* -- Wire checkbox events -- */
    var grid = document.getElementById('comp-grid');
    if (grid) {
      grid.addEventListener('change', function (e) {
        if (e.target && e.target.type === 'checkbox' && e.target.dataset.itemId) {
          var st = _load();
          st.checks[e.target.dataset.itemId] = e.target.checked;
          _save(st);
          _updateScore(st.checks);
        }
      });
    }

    /* -- Wire notes event -- */
    var notesEl = document.getElementById('comp-notes');
    if (notesEl) {
      notesEl.addEventListener('input', function () {
        var st = _load();
        st.notes = notesEl.value;
        _save(st);
      });
    }
  }

  /* -- Live score update (no re-render) -- */
  function _updateScore(checks) {
    var score = _calcScore(checks);
    var barColor = score.pct >= 80 ? '#4caf50' : score.pct >= 50 ? '#ff9800' : '#f44336';
    var doneEl  = document.getElementById('comp-done');
    var totalEl = document.getElementById('comp-total');
    var pctEl   = document.getElementById('comp-pct');
    var fillEl  = document.getElementById('comp-fill');
    if (doneEl)  doneEl.textContent  = score.done;
    if (totalEl) totalEl.textContent = score.total;
    if (pctEl)   { pctEl.textContent = score.pct + '%'; pctEl.style.color = barColor; }
    if (fillEl)  { fillEl.style.width = score.pct + '%'; fillEl.style.background = barColor; }
  }

  /* -- HTML escape helper -- */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render: render };

})();
