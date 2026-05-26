(function () {
  'use strict';

  function _setStatus(msg, type) {
    var el = document.getElementById('pcc-sync-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'pdash-sync-status' + (type ? ' sync-' + type : '');
  }

  function _buildPayload() {
    return {
      action: 'syncAll',
      leads:     (typeof pccGetLeads     === 'function') ? pccGetLeads()     : [],
      customers: (typeof pccGetCustomers === 'function') ? pccGetCustomers() : [],
      quotes:    (typeof pccGetQuotes    === 'function') ? pccGetQuotes()    : [],
      jobs:      (typeof pccGetJobs      === 'function') ? pccGetJobs()      : []
    };
  }

  function _sendToSheets(url, payload) {
    _setStatus('Syncing...', 'sending');
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
    .then(function () {
      _setStatus('Sync request sent', 'ok');
    })
    .catch(function () {
      _setStatus('Sync failed - check connection', 'error');
    });
  }

  function triggerSync() {
    var settings = (typeof pccGetSettings === 'function') ? pccGetSettings() : {};
    var url = (settings && settings.sheetsUrl) ? settings.sheetsUrl.trim() : '';

    if (!url || url.indexOf('https://') !== 0) {
      _setStatus('No Sheets URL set - add it in Settings', 'warn');
      return;
    }

    _sendToSheets(url, _buildPayload());
  }

  window.pccSync = { triggerSync: triggerSync };

})();
