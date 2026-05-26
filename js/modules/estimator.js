/**
 * js/modules/estimator.js
 * PCC CRM -- On-Site Estimator Module
 *
 * Interactive price calculator used during on-site visits or phone quotes.
 * Renders a step-by-step form: service type -> property details -> add-ons ->
 * frequency -> live price breakdown -> save as quote or lead.
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 *
 * Public API:
 *   pccEstimator.render()   -- render estimator into #estimator-root
 *   pccEstimator.reset()    -- clear all inputs and restart
 */

'use strict';

var pccEstimator = (function () {

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
  function _fmtCurrency(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }


  /* == PHOTO UPLOAD (Step 6 addition) == */
  var _MAX_PHOTOS    = 6;
  var _MAX_MB        = 5;
  var _ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  var _THUMB_MAX_PX  = 200;
  var _THUMB_QUALITY = 0.35;

  function _compressThumb(file, cb) {
    var r = new FileReader();
    r.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        var ratio = Math.min(_THUMB_MAX_PX / img.width, _THUMB_MAX_PX / img.height, 1);
        cv.width = Math.round(img.width * ratio); cv.height = Math.round(img.height * ratio);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', _THUMB_QUALITY));
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    r.onerror = function () { cb(null); };
    r.readAsDataURL(file);
  }

  function _getPhotoMeta() {
    return _state.photos.map(function (p) {
      return { name: p.name, type: p.type, size: p.size, timestamp: p.timestamp, caption: p.caption || '' };
    });
  }

  function _saveThumbs() {
    try {
      localStorage.setItem('pcc_photo_thumbs_session',
        JSON.stringify(_state.photos.map(function (p) { return { thumb: p.thumb || null }; })));
    } catch (e) {
      console.warn('[PCC Estimator] Thumb save failed - continuing without persistence.');
    }
  }

  function _renderThumbs(sec) {
    var grid = sec.querySelector('.pest-thumb-grid');
    if (!grid) return;
    grid.innerHTML = '';
    _state.photos.forEach(function (ph, idx) {
      var card = _el('div', 'pest-thumb-card');
      if (ph.thumb) {
        var img = document.createElement('img');
        img.src = ph.thumb; img.className = 'pest-thumb-img'; img.alt = _esc(ph.name);
        card.appendChild(img);
      } else { card.appendChild(_el('div', 'pest-thumb-placeholder', '&#128444;')); }
      card.appendChild(_el('div', 'pest-thumb-name', _esc(ph.name)));
      var cap = document.createElement('input');
      cap.type = 'text'; cap.className = 'pest-thumb-caption';
      cap.placeholder = 'Add caption...'; cap.value = ph.caption || '';
      cap.setAttribute('data-idx', idx);
      cap.addEventListener('input', function (e) {
        var i = parseInt(e.target.getAttribute('data-idx'));
        if (_state.photos[i]) _state.photos[i].caption = e.target.value;
      });
      card.appendChild(cap);
      var rb = _el('button', 'pest-thumb-remove', '&times;');
      rb.title = 'Remove'; rb.setAttribute('data-idx', idx);
      rb.addEventListener('click', function (e) {
        _state.photos.splice(parseInt(e.target.getAttribute('data-idx')), 1);
        _saveThumbs(); _renderThumbs(sec); _updatePhotoCount(sec);
      });
      card.appendChild(rb);
      grid.appendChild(card);
    });
  }

  function _updatePhotoCount(sec) {
    var c = sec.querySelector('.pest-count');
    if (c) c.textContent = _state.photos.length + ' / ' + _MAX_PHOTOS + ' photos';
    var dz = sec.querySelector('.pest-dropzone');
    if (dz) dz.style.display = _state.photos.length >= _MAX_PHOTOS ? 'none' : '';
  }

  function _photoError(sec, msg) {
    var err = sec.querySelector('.pest-error');
    if (!err) return;
    err.textContent = msg; err.style.display = 'block';
    clearTimeout(err._t);
    err._t = setTimeout(function () { err.style.display = 'none'; err.textContent = ''; }, 4500);
  }

  function _handlePhotoFiles(files, sec) {
    var err = sec.querySelector('.pest-error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    var remaining = _MAX_PHOTOS - _state.photos.length;
    if (remaining <= 0) { _photoError(sec, 'Max ' + _MAX_PHOTOS + ' photos. Remove one first.'); return; }
    var toProcess = Array.prototype.slice.call(files, 0, remaining);
    if (files.length > remaining) _photoError(sec, 'Only ' + remaining + ' more added. Extra ignored.');
    toProcess.forEach(function (file) {
      if (_ALLOWED_TYPES.indexOf(file.type) === -1) {
        _photoError(sec, '"' + file.name + '" not supported. Use JPG, PNG, or WEBP.'); return;
      }
      if (file.size > _MAX_MB * 1024 * 1024) {
        _photoError(sec, '"' + file.name + '" over ' + _MAX_MB + 'MB limit.'); return;
      }
      _compressThumb(file, function (thumb) {
        _state.photos.push({ name: file.name, type: file.type, size: file.size,
          timestamp: new Date().toISOString(), caption: '', thumb: thumb });
        _saveThumbs(); _renderThumbs(sec); _updatePhotoCount(sec);
      });
    });
  }

  function _buildPhotoSection() {
    var sec = _el('div', 'pest-photo-section');
    var hdr = _el('div', 'pest-photo-header');
    hdr.innerHTML = '<h4 class="pest-photo-title">&#128247; Site Photos <span class="pest-photo-optional">(optional)</span></h4>';
    sec.appendChild(hdr);
    sec.appendChild(_el('div', 'pest-disclaimer',
      'ⓘ Photos are stored locally in this browser for prototype use. ' +
      'Production storage will require private cloud storage.'));
    sec.appendChild(_el('div', 'pest-count', '0 / ' + _MAX_PHOTOS + ' photos'));
    var errEl = _el('div', 'pest-error'); errEl.style.display = 'none';
    sec.appendChild(errEl);
    sec.appendChild(_el('div', 'pest-thumb-grid'));
    var dz = _el('div', 'pest-dropzone');
    dz.setAttribute('tabindex', '0'); dz.setAttribute('role', 'button');
    dz.setAttribute('aria-label', 'Upload site photos');
    dz.innerHTML =
      '<div class="pest-drop-icon">&#128444;</div>' +
      '<div class="pest-drop-text">Click or drag photos here</div>' +
      '<div class="pest-drop-sub">JPG, PNG, WEBP • max ' + _MAX_MB + 'MB • up to ' + _MAX_PHOTOS + ' photos</div>';
    var fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/jpeg,image/jpg,image/png,image/webp';
    fi.multiple = true; fi.className = 'pest-file-input'; fi.setAttribute('aria-hidden', 'true');
    dz.appendChild(fi);
    dz.addEventListener('click', function (e) { if (e.target !== fi) fi.click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
    });
    fi.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) _handlePhotoFiles(e.target.files, sec);
      e.target.value = '';
    });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('pest-drag-over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('pest-drag-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('pest-drag-over');
      if (e.dataTransfer && e.dataTransfer.files.length) _handlePhotoFiles(e.dataTransfer.files, sec);
    });
    sec.appendChild(dz);
    return sec;
  }
  /* == END PHOTO UPLOAD == */
  /* state */
  var _state = {
    step: 1,
    serviceType: '',
    sqft: 0,
    bedrooms: 0,
    bathrooms: 0,
    frequency: 'one_time',
    addons: [],
    customerName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    photos: [],
  };

  /* pricing engine -- mirrors quotes.js _calcTotal */
  function _calc() {
    var services = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.SERVICES       : {};
    var freqDisc = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.FREQ_DISCOUNTS  : {};
    var addonCfg = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.ADDONS          : {};

    var svc      = services[_state.serviceType] || {};
    var base     = parseFloat(svc.basePrice || 0);
    var sqftN    = parseInt(_state.sqft) || 0;
    if (sqftN > 1500) base += Math.round((sqftN - 1500) / 500) * (svc.sqftRate || 20);
    base += (parseInt(_state.bedrooms)  || 0) * (svc.bedroomRate  || 10);
    base += (parseInt(_state.bathrooms) || 0) * (svc.bathroomRate || 15);

    var freqEntry = freqDisc[_state.frequency] || {};
    var discRate  = freqEntry.discount || 0;
    var discount  = +(base * discRate).toFixed(2);
    var afterDisc = +(base - discount).toFixed(2);

    var addonTotal = 0;
    _state.addons.forEach(function (key) {
      addonTotal += parseFloat((addonCfg[key] || {}).price || 0);
    });

    return {
      base:       +base.toFixed(2),
      discount:   discount,
      discPct:    Math.round(discRate * 100),
      afterDisc:  afterDisc,
      addonTotal: +addonTotal.toFixed(2),
      total:      +(afterDisc + addonTotal).toFixed(2),
      freqLabel:  freqEntry.label || _state.frequency,
    };
  }

  /* step rendering */
  function _renderStep(root) {
    var existing = root.querySelector('.pcc-est-body');
    if (existing) existing.remove();

    var body = _el('div', 'pcc-est-body');

    /* progress bar */
    var steps   = ['Service', 'Property', 'Add-Ons', 'Frequency', 'Customer', 'Summary'];
    var progBar = _el('div', 'pcc-est-progress');
    steps.forEach(function (label, i) {
      var dot = _el('div', 'pcc-est-dot' + (i + 1 === _state.step ? ' active' : '') + (i + 1 < _state.step ? ' done' : ''));
      dot.innerHTML = '<span class="pcc-est-dot-n">' + (i + 1) + '</span><span class="pcc-est-dot-l">' + label + '</span>';
      progBar.appendChild(dot);
    });
    body.appendChild(progBar);

    /* step content */
    var content = _el('div', 'pcc-est-step');

    if (_state.step === 1) content.appendChild(_buildStep1());
    if (_state.step === 2) content.appendChild(_buildStep2());
    if (_state.step === 3) content.appendChild(_buildStep3());
    if (_state.step === 4) content.appendChild(_buildStep4());
    if (_state.step === 5) content.appendChild(_buildStep5());
    if (_state.step === 6) content.appendChild(_buildStep6(root));

    /* nav buttons */
    if (_state.step < 6) {
      var nav = _el('div', 'pcc-est-nav');
      if (_state.step > 1) {
        var back = _el('button', 'pcc-btn pcc-btn-outline');
        back.textContent = 'Back';
        back.addEventListener('click', function () { _state.step--; _renderStep(root); });
        nav.appendChild(back);
      }
      var next = _el('button', 'pcc-btn pcc-btn-primary');
      next.textContent = _state.step === 5 ? 'See Summary' : 'Next';
      next.addEventListener('click', function () {
        if (_state.step === 1 && !_state.serviceType) { alert('Please select a service type.'); return; }
        _state.step++;
        _renderStep(root);
      });
      nav.appendChild(next);
      content.appendChild(nav);
    }

    body.appendChild(content);
    root.appendChild(body);
  }

  /* Step 1: Service Type */
  function _buildStep1() {
    var wrap = _el('div', 'pcc-est-s1');
    wrap.innerHTML = '<h3 class="pcc-est-step-title">What type of cleaning?</h3>';
    var services = (typeof PCC_CONFIG !== 'undefined' && PCC_CONFIG.SERVICES) ? PCC_CONFIG.SERVICES : {};
    var grid = _el('div', 'pcc-service-grid');

    var icons = { house: '🏠', carpet: '🪣', tile: '🧹', pressure: '💦', deep: '✨', moveinout: '📦' };
    var labels = { house: 'House Cleaning', carpet: 'Carpet Cleaning', tile: 'Tile & Grout',
                   pressure: 'Pressure Wash', deep: 'Deep Clean', moveinout: 'Move In/Out' };

    Object.keys(services).length
      ? Object.keys(services).forEach(_addServiceCard)
      : Object.keys(icons).forEach(_addServiceCard);

    function _addServiceCard(key) {
      var svc  = (services[key] || {});
      var card = _el('div', 'pcc-svc-card' + (_state.serviceType === key ? ' selected' : ''));
      card.innerHTML =
        '<div class="pcc-svc-icon">' + (icons[key] || '🧽') + '</div>' +
        '<div class="pcc-svc-name">' + _esc(svc.label || labels[key] || key) + '</div>' +
        '<div class="pcc-svc-from">from ' + _fmtCurrency(svc.basePrice || 0) + '</div>';
      card.addEventListener('click', function () {
        _state.serviceType = key;
        wrap.querySelectorAll('.pcc-svc-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
      });
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /* Step 2: Property Details */
  function _buildStep2() {
    var wrap = _el('div', 'pcc-est-s2');
    wrap.innerHTML = '<h3 class="pcc-est-step-title">Property details</h3>';
    var form = _el('div', 'pcc-est-form-grid');
    form.innerHTML =
      '<div class="pcc-form-group"><label>Square Footage</label>' +
        '<input type="number" id="est-sqft" min="0" placeholder="1500" value="' + (_state.sqft || '') + '"></div>' +
      '<div class="pcc-form-group"><label>Bedrooms</label>' +
        '<input type="number" id="est-beds" min="0" max="10" placeholder="3" value="' + (_state.bedrooms || '') + '"></div>' +
      '<div class="pcc-form-group"><label>Bathrooms</label>' +
        '<input type="number" id="est-baths" min="0" max="10" placeholder="2" value="' + (_state.bathrooms || '') + '"></div>' +
      '<div class="pcc-form-group pcc-form-wide"><label>Service Address</label>' +
        '<input type="text" id="est-address" placeholder="123 Main St, Naples FL 34102" value="' + _esc(_state.address) + '"></div>';
    wrap.appendChild(form);

    wrap.querySelector('#est-sqft').addEventListener('input',   function (e) { _state.sqft     = e.target.value; });
    wrap.querySelector('#est-beds').addEventListener('input',   function (e) { _state.bedrooms  = e.target.value; });
    wrap.querySelector('#est-baths').addEventListener('input',  function (e) { _state.bathrooms = e.target.value; });
    wrap.querySelector('#est-address').addEventListener('input',function (e) { _state.address   = e.target.value; });
    return wrap;
  }

  /* Step 3: Add-Ons */
  function _buildStep3() {
    var wrap = _el('div', 'pcc-est-s3');
    wrap.innerHTML = '<h3 class="pcc-est-step-title">Any add-ons?</h3><p class="pcc-est-sub">Optional extras added to your base price.</p>';
    var addonCfg = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.ADDONS : {};
    var grid = _el('div', 'pcc-addon-grid');

    Object.keys(addonCfg).forEach(function (key) {
      var a       = addonCfg[key];
      var checked = _state.addons.indexOf(key) !== -1;
      var card    = _el('label', 'pcc-addon-card' + (checked ? ' selected' : ''));
      card.innerHTML =
        '<input type="checkbox" value="' + _esc(key) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="pcc-addon-label">' + _esc(a.label || key) + '</span>' +
        '<span class="pcc-addon-price">+' + _fmtCurrency(a.price || 0) + '</span>';
      card.querySelector('input').addEventListener('change', function (e) {
        if (e.target.checked) {
          if (_state.addons.indexOf(key) === -1) _state.addons.push(key);
          card.classList.add('selected');
        } else {
          _state.addons = _state.addons.filter(function (k) { return k !== key; });
          card.classList.remove('selected');
        }
      });
      grid.appendChild(card);
    });

    if (!Object.keys(addonCfg).length) {
      grid.innerHTML = '<p class="pcc-empty">No add-ons configured in PCC_CONFIG.</p>';
    }

    wrap.appendChild(grid);
    return wrap;
  }

  /* Step 4: Frequency */
  function _buildStep4() {
    var wrap = _el('div', 'pcc-est-s4');
    wrap.innerHTML = '<h3 class="pcc-est-step-title">How often?</h3><p class="pcc-est-sub">Recurring services get a discount.</p>';
    var freqDisc = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.FREQ_DISCOUNTS : {};
    var grid = _el('div', 'pcc-freq-grid');

    var fallback = [
      { key: 'one_time',  label: 'One Time',   discount: 0    },
      { key: 'monthly',   label: 'Monthly',    discount: 0.10 },
      { key: 'bi_weekly', label: 'Bi-Weekly',  discount: 0.15 },
      { key: 'weekly',    label: 'Weekly',     discount: 0.20 },
    ];
    var entries = Object.keys(freqDisc).length
      ? Object.keys(freqDisc).map(function (k) { return Object.assign({ key: k }, freqDisc[k]); })
      : fallback;

    entries.forEach(function (f) {
      var card = _el('div', 'pcc-freq-card' + (_state.frequency === f.key ? ' selected' : ''));
      var discPct = Math.round((f.discount || 0) * 100);
      card.innerHTML =
        '<div class="pcc-freq-label">' + _esc(f.label || f.key) + '</div>' +
        '<div class="pcc-freq-disc">' + (discPct > 0 ? discPct + '% off' : 'No discount') + '</div>';
      card.addEventListener('click', function () {
        _state.frequency = f.key;
        wrap.querySelectorAll('.pcc-freq-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
      });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /* Step 5: Customer Info */
  function _buildStep5() {
    var wrap = _el('div', 'pcc-est-s5');
    wrap.innerHTML = '<h3 class="pcc-est-step-title">Customer details</h3><p class="pcc-est-sub">Optional -- skip to go straight to the summary.</p>';
    var form = _el('div', 'pcc-est-form-grid');
    form.innerHTML =
      '<div class="pcc-form-group"><label>Full Name</label>' +
        '<input type="text" id="est-name" placeholder="Jane Smith" value="' + _esc(_state.customerName) + '"></div>' +
      '<div class="pcc-form-group"><label>Email</label>' +
        '<input type="email" id="est-email" placeholder="jane@example.com" value="' + _esc(_state.email) + '"></div>' +
      '<div class="pcc-form-group"><label>Phone</label>' +
        '<input type="tel" id="est-phone" placeholder="(239) 555-0123" value="' + _esc(_state.phone) + '"></div>' +
      '<div class="pcc-form-group pcc-form-wide"><label>Notes</label>' +
        '<textarea id="est-notes" rows="2" placeholder="Any special instructions...">' + _esc(_state.notes) + '</textarea></div>';
    wrap.appendChild(form);

    wrap.querySelector('#est-name').addEventListener('input',  function (e) { _state.customerName = e.target.value; });
    wrap.querySelector('#est-email').addEventListener('input', function (e) { _state.email         = e.target.value; });
    wrap.querySelector('#est-phone').addEventListener('input', function (e) { _state.phone         = e.target.value; });
    wrap.querySelector('#est-notes').addEventListener('input', function (e) { _state.notes         = e.target.value; });

    /* == Photo Upload Section (Step 6) == */
    var photoSec = _buildPhotoSection();
    _renderThumbs(photoSec);
    _updatePhotoCount(photoSec);
    wrap.appendChild(photoSec);

    return wrap;
  }

  /* Step 6: Summary */
  function _buildStep6(root) {
    var wrap = _el('div', 'pcc-est-s6');
    var p    = _calc();

    wrap.innerHTML = '<h3 class="pcc-est-step-title">Price Summary</h3>';

    /* breakdown card */
    var breakdown = _el('div', 'pcc-est-breakdown');
    var addonCfg  = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.ADDONS : {};
    var services  = (typeof PCC_CONFIG !== 'undefined') ? PCC_CONFIG.SERVICES : {};
    var svcLabel  = (services[_state.serviceType] || {}).label || _state.serviceType;

    breakdown.innerHTML =
      '<div class="pcc-bd-row"><span>Service</span><span>' + _esc(svcLabel) + '</span></div>' +
      '<div class="pcc-bd-row"><span>Base Price</span><span>' + _fmtCurrency(p.base) + '</span></div>' +
      (_state.sqft  ? '<div class="pcc-bd-row"><span>Sq Ft (' + _esc(_state.sqft)  + ')</span><span>included</span></div>' : '') +
      (_state.bedrooms  ? '<div class="pcc-bd-row"><span>Bedrooms (' + _esc(_state.bedrooms)  + ')</span><span>included</span></div>' : '') +
      (_state.bathrooms ? '<div class="pcc-bd-row"><span>Bathrooms (' + _esc(_state.bathrooms) + ')</span><span>included</span></div>' : '') +
      (p.discount > 0 ?
        '<div class="pcc-bd-row pcc-bd-discount"><span>' + _esc(p.freqLabel) + ' discount (' + p.discPct + '%)</span><span>-' + _fmtCurrency(p.discount) + '</span></div>' : '') +
      (_state.addons.length ?
        _state.addons.map(function (k) {
          var a = addonCfg[k] || {};
          return '<div class="pcc-bd-row"><span>' + _esc(a.label || k) + '</span><span>+' + _fmtCurrency(a.price || 0) + '</span></div>';
        }).join('') : '') +
      '<div class="pcc-bd-total"><span>TOTAL</span><span>' + _fmtCurrency(p.total) + '</span></div>';

    wrap.appendChild(breakdown);

    /* customer info summary */
    if (_state.customerName || _state.email) {
      var custInfo = _el('div', 'pcc-est-cust-summary');
      custInfo.innerHTML =
        '<h4>Customer</h4>' +
        (_state.customerName ? '<p>' + _esc(_state.customerName) + '</p>' : '') +
        (_state.email  ? '<p>' + _esc(_state.email)  + '</p>' : '') +
        (_state.phone  ? '<p>' + _esc(_state.phone)  + '</p>' : '') +
        (_state.address? '<p>' + _esc(_state.address) + '</p>' : '');
      wrap.appendChild(custInfo);
    }

    /* action buttons */
    var actions = _el('div', 'pcc-est-actions');

    /* Save as Quote */
    var saveQuoteBtn = _el('button', 'pcc-btn pcc-btn-primary');
    saveQuoteBtn.textContent = 'Save as Quote';
    saveQuoteBtn.addEventListener('click', function () {
      var quoteData = {
        customerName: _state.customerName,
        email:        _state.email,
        phone:        _state.phone,
        address:      _state.address,
        serviceType:  _state.serviceType,
        frequency:    _state.frequency,
        sqft:         _state.sqft,
        bedrooms:     _state.bedrooms,
        bathrooms:    _state.bathrooms,
        addons:       _state.addons,
        notes:        _state.notes,
        total:        p.total,
        status:       'draft',
        source:       'estimator',
        photos:       _getPhotoMeta(),
      };
      pccAddQuote(quoteData);
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/quotes');
    });

    /* Save as Lead */
    var saveLeadBtn = _el('button', 'pcc-btn pcc-btn-success');
    saveLeadBtn.textContent = 'Save as Lead';
    saveLeadBtn.addEventListener('click', function () {
      pccAddLead({
        name:        _state.customerName,
        email:       _state.email,
        phone:       _state.phone,
        address:     _state.address,
        serviceType: _state.serviceType,
        notes:       'Estimated total: ' + _fmtCurrency(p.total) + '. ' + _state.notes,
        status:      'new',
        source:      'estimator',
      });
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/leads');
    });

    /* Schedule Job directly */
    var scheduleBtn = _el('button', 'pcc-btn pcc-btn-warning');
    scheduleBtn.textContent = 'Schedule Job';
    scheduleBtn.addEventListener('click', function () {
      if (typeof pccSaveDraft === 'function') {
        pccSaveDraft({ estimatorState: _state, total: p.total });
      }
      if (typeof pccRouter !== 'undefined') pccRouter.go('#/jobs/new');
    });

    /* Reset */
    var resetBtn = _el('button', 'pcc-btn pcc-btn-outline');
    resetBtn.textContent = 'Start Over';
    resetBtn.addEventListener('click', function () { reset(); render(); });

    actions.appendChild(saveQuoteBtn);
    actions.appendChild(saveLeadBtn);
    actions.appendChild(scheduleBtn);
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  /* PUBLIC: reset */
  function reset() {
    _state = {
      step: 1, serviceType: '', sqft: 0, bedrooms: 0, bathrooms: 0,
      frequency: 'one_time', addons: [],
      customerName: '', email: '', phone: '', address: '', notes: '',
      photos: [],
    };
    try { localStorage.removeItem('pcc_photo_thumbs_session'); } catch (e) {}
  }

  /* PUBLIC: render */
  function render() {
    var root = document.getElementById('estimator-root');
    if (!root) { console.warn('[PCC Estimator] #estimator-root not found'); return; }
    root.innerHTML = '';
    var header = _el('div', 'pcc-module-header');
    header.innerHTML = '<h2 class="pcc-module-title">On-Site Estimator</h2>' +
      '<button class="pcc-btn pcc-btn-outline pcc-btn-sm" id="est-reset-btn">Reset</button>';
    root.appendChild(header);
    header.querySelector('#est-reset-btn').addEventListener('click', function () { reset(); render(); });
    _renderStep(root);
    console.info('[PCC Estimator] Rendered. Step:', _state.step);
  }

  return { render: render, reset: reset };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = pccEstimator; }
