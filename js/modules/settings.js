/**
 * js/modules/settings.js
 * PCC CRM — Settings Module
 *
 * Manages CRM configuration: Google Sheets URL, Review Link URL,
 * PIN change, and company info. All data stored via pccGetSettings /
 * pccSaveSettings (js/storage.js). PIN stored as a hash via the same
 * _hashPin mechanism used in app.js (key: pcc_pin_hash).
 *
 * Public API:
 *   pccSettings.render() — render settings panel into #settings-root
 *
 * Depends on: config.js -> storage.js -> router.js -> this file
 */

'use strict';

var pccSettings = (function () {

  /* ── PIN hash (mirrors app.js _hashPin — must stay in sync) ── */
  var PIN_HASH_KEY = 'pcc_pin_hash';

  function _hashPin(pin) {
    var h = 0;
    for (var i = 0; i < pin.length; i++) {
      h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
    }
    return 'pcc_' + Math.abs(h).toString(16);
  }

  function _verifyPin(pin) {
    var stored = localStorage.getItem(PIN_HASH_KEY);
    if (!stored) return false;
    return stored === _hashPin(pin);
  }

  function _updatePin(pin) {
    localStorage.setItem(PIN_HASH_KEY, _hashPin(pin));
  }

  /* ── Helpers ── */
  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _showMsg(id, text, isError) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'psettings-msg ' + (isError ? 'psettings-msg-error' : 'psettings-msg-ok');
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  /* ── Render ── */
  function render() {
    var root = document.getElementById('settings-root');
    if (!root) return;

    var s = pccGetSettings();

    root.innerHTML =
      '<div class="ppage-header">' +
        '<h1 class="ppage-title">⚙️ Settings</h1>' +
      '</div>' +

      /* ── Section: Integrations ── */
      '<div class="psettings-section">' +
        '<h2 class="psettings-section-title">Integrations</h2>' +

        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-sheets-url">Google Sheets URL</label>' +
          '<p class="psettings-hint">Paste the URL of your Google Sheet for Sync to Sheets.</p>' +
          '<input id="settings-sheets-url" class="pinput pinput-full" type="url"' +
            ' placeholder="https://docs.google.com/spreadsheets/d/..."' +
            ' value="' + _esc(s.sheetsUrl || '') + '">' +
          '<button class="pbtn pbtn-sm psettings-save-btn" onclick="pccSettings._saveSheetsUrl()">Save</button>' +
          '<span id="settings-sheets-msg" class="psettings-msg" style="display:none"></span>' +
        '</div>' +

        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-review-url">Google Review Link</label>' +
          '<p class="psettings-hint">Link to your Google Business review page for the review request flow.</p>' +
          '<input id="settings-review-url" class="pinput pinput-full" type="url"' +
            ' placeholder="https://g.page/r/..."' +
            ' value="' + _esc(s.reviewUrl || '') + '">' +
          '<button class="pbtn pbtn-sm psettings-save-btn" onclick="pccSettings._saveReviewUrl()">Save</button>' +
          '<span id="settings-review-msg" class="psettings-msg" style="display:none"></span>' +
        '</div>' +
      '</div>' +

      /* ── Section: Security ── */
      '<div class="psettings-section">' +
        '<h2 class="psettings-section-title">Security</h2>' +
        '<p class="psettings-hint">Change the admin PIN used to unlock the CRM. PIN must be at least 4 characters.</p>' +

        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-old-pin">Current PIN</label>' +
          '<input id="settings-old-pin" class="pinput psettings-pin-input" type="password"' +
            ' maxlength="12" autocomplete="current-password" placeholder="Current PIN">' +
        '</div>' +
        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-new-pin">New PIN</label>' +
          '<input id="settings-new-pin" class="pinput psettings-pin-input" type="password"' +
            ' maxlength="12" autocomplete="new-password" placeholder="New PIN">' +
        '</div>' +
        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-confirm-pin">Confirm New PIN</label>' +
          '<input id="settings-confirm-pin" class="pinput psettings-pin-input" type="password"' +
            ' maxlength="12" autocomplete="new-password" placeholder="Confirm New PIN">' +
        '</div>' +
        '<div class="psettings-row">' +
          '<button class="pbtn pbtn-primary" onclick="pccSettings._changePin()">Change PIN</button>' +
          '<span id="settings-pin-msg" class="psettings-msg" style="display:none"></span>' +
        '</div>' +
      '</div>' +

      /* ── Section: Company Info ── */
      '<div class="psettings-section">' +
        '<h2 class="psettings-section-title">Company Info</h2>' +

        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-company-name">Company Name</label>' +
          '<input id="settings-company-name" class="pinput pinput-full" type="text"' +
            ' placeholder="ProCharger Cleaning"' +
            ' value="' + _esc(s.companyName || '') + '">' +
        '</div>' +
        '<div class="psettings-row">' +
          '<label class="psettings-label" for="settings-company-phone">Phone Number</label>' +
          '<input id="settings-company-phone" class="pinput" type="tel"' +
            ' placeholder="(239) 887-7024"' +
            ' value="' + _esc(s.companyPhone || '') + '">' +
        '</div>' +
        '<div class="psettings-row">' +
          '<button class="pbtn pbtn-sm psettings-save-btn" onclick="pccSettings._saveCompanyInfo()">Save Company Info</button>' +
          '<span id="settings-company-msg" class="psettings-msg" style="display:none"></span>' +
        '</div>' +
      '</div>';
  }

  /* ── Save handlers (called from inline onclick) ── */

  function _saveSheetsUrl() {
    var val = (document.getElementById('settings-sheets-url') || {}).value || '';
    val = val.trim();
    pccSaveSettings({ sheetsUrl: val });
    _showMsg('settings-sheets-msg', '✅ Saved', false);
  }

  function _saveReviewUrl() {
    var val = (document.getElementById('settings-review-url') || {}).value || '';
    val = val.trim();
    pccSaveSettings({ reviewUrl: val });
    _showMsg('settings-review-msg', '✅ Saved', false);
  }

  function _changePin() {
    var oldVal = (document.getElementById('settings-old-pin') || {}).value || '';
    var newVal = (document.getElementById('settings-new-pin') || {}).value || '';
    var confVal = (document.getElementById('settings-confirm-pin') || {}).value || '';

    if (!oldVal || !newVal || !confVal) {
      _showMsg('settings-pin-msg', '❌ All three PIN fields are required.', true);
      return;
    }
    if (!_verifyPin(oldVal)) {
      _showMsg('settings-pin-msg', '❌ Current PIN is incorrect.', true);
      return;
    }
    if (newVal.length < 4) {
      _showMsg('settings-pin-msg', '❌ New PIN must be at least 4 characters.', true);
      return;
    }
    if (newVal !== confVal) {
      _showMsg('settings-pin-msg', '❌ New PIN and confirmation do not match.', true);
      return;
    }
    _updatePin(newVal);
    /* Clear fields after success */
    ['settings-old-pin', 'settings-new-pin', 'settings-confirm-pin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    _showMsg('settings-pin-msg', '✅ PIN changed successfully.', false);
  }

  function _saveCompanyInfo() {
    var name = (document.getElementById('settings-company-name') || {}).value || '';
    var phone = (document.getElementById('settings-company-phone') || {}).value || '';
    pccSaveSettings({ companyName: name.trim(), companyPhone: phone.trim() });
    _showMsg('settings-company-msg', '✅ Saved', false);
  }

  /* ── Public API ── */
  return {
    render: render,
    _saveSheetsUrl: _saveSheetsUrl,
    _saveReviewUrl: _saveReviewUrl,
    _changePin: _changePin,
    _saveCompanyInfo: _saveCompanyInfo,
  };

})();
