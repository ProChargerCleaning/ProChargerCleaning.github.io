// ============================================================
// js/calendar.js - Google Calendar Integration Bridge
// ProCharger Cleaning CRM
// Bridges the CRM job system -> Apps Script webhook -> Google Calendar
// Webhook: scheduleCalendar action on doPost
// ============================================================

var PCC_CAL = (function () {

  // ── Webhook URL ────────────────────────────────────────────
  // This calls the deployed Apps Script web app which writes
  // to the ProCharger Cleaning Google Calendar.
  // To update: Deploy > Manage deployments > copy Web app URL
  var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwOPKeWf1rD71Y_7SGZTllajBxpFSco776y1mJNRDjgRMO7-SMdYDa118OgELca7ZMj/exec';

  // ── Enabled flag ───────────────────────────────────────────
  // Set to false to disable all calendar syncing without
  // removing the integration.
  var ENABLED = true;

  // ── Internal: POST to webhook ──────────────────────────────
  function _post(action, payload) {
    if (!ENABLED) {
      console.log('[PCC Cal] Calendar sync disabled – skipping', action);
      return Promise.resolve({ ok: false, reason: 'disabled' });
    }
    return fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',          // Apps Script requires no-cors from browser
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, event: payload })
    })
    .then(function () {
      // no-cors means we can't read the response body, so we
      // optimistically assume success and log it.
      console.log('[PCC Cal] Synced to Google Calendar:', action, payload.title || payload.eventId || '');
      return { ok: true };
    })
    .catch(function (err) {
      console.warn('[PCC Cal] Calendar sync failed (non-blocking):', err);
      return { ok: false, reason: err.message };
    });
  }

  // ── Format a CRM job into a Google Calendar event payload ──
  function _buildEventPayload(job) {
    // Resolve customer name for event title
    var customerName = job.customerName || job.customer || 'Client';
    if (!customerName || customerName === 'undefined') {
      // Try to look up from storage
      try {
        var custs = pccGetCustomers ? pccGetCustomers() : [];
        var found = custs.find(function (c) { return c.id === job.customerId; });
        if (found) customerName = found.name || found.firstName + ' ' + (found.lastName || '');
      } catch (e) { /* storage may not be ready */ }
    }

    // Build service label
    var serviceLabel = '';
    try {
      if (Array.isArray(job.services) && job.services.length) {
        serviceLabel = job.services.map(function (s) {
          return (typeof s === 'object' ? s.name : s) || '';
        }).filter(Boolean).join(', ');
      } else if (typeof job.service === 'string') {
        serviceLabel = job.service;
      }
    } catch (e) { serviceLabel = ''; }

    var title = 'PCC: ' + customerName + (serviceLabel ? ' – ' + serviceLabel : '');

    // Date/time handling
    var dateStr = job.date || job.scheduledDate || '';
    var timeStr = job.time || job.scheduledTime || '09:00';

    // Build ISO start time  (assumes local time input)
    var startISO = '';
    var endISO = '';
    try {
      if (dateStr) {
        var startDt = new Date(dateStr + 'T' + timeStr);
        if (isNaN(startDt.getTime())) {
          startDt = new Date(dateStr);
        }
        var endDt = new Date(startDt.getTime() + (Number(job.durationHours || 2) * 3600000));
        startISO = startDt.toISOString();
        endISO = endDt.toISOString();
      }
    } catch (e) { /* leave empty */ }

    var description = [
      'Job ID: ' + (job.id || 'N/A'),
      'Customer: ' + customerName,
      'Address: ' + (job.address || job.serviceAddress || 'N/A'),
      'Phone: ' + (job.phone || job.customerPhone || 'N/A'),
      'Services: ' + (serviceLabel || 'N/A'),
      'Crew: ' + (job.crew || job.assignedCrew || job.tech || 'Unassigned'),
      'Status: ' + (job.status || 'scheduled').toUpperCase(),
      'Total: $' + (job.total || job.price || 0),
      '',
      'Managed via ProCharger Cleaning CRM'
    ].join('\n');

    return {
      title: title,
      startTime: startISO,
      endTime: endISO,
      description: description,
      location: job.address || job.serviceAddress || '',
      customer: customerName,
      phone: job.phone || job.customerPhone || '',
      email: job.email || job.customerEmail || '',
      address: job.address || job.serviceAddress || '',
      services: serviceLabel,
      tech: job.crew || job.assignedCrew || job.tech || '',
      status: (job.status || 'scheduled').toUpperCase(),
      total: Number(job.total || job.price || 0),
      paid: Number(job.paid || 0),
      date: dateStr,
      time: timeStr,
      jobId: job.id || '',
      calendarEventId: job.calendarEventId || ''
    };
  }

  // ── Public: Sync a job (create or update) ─────────────────
  // Call this from pccAddJob() and pccUpdateJob() in storage.js
  function syncJob(job) {
    if (!job) return;
    // Skip cancelled/draft jobs – remove them from calendar instead
    if (job.status === 'cancelled' || job.status === 'canceled') {
      return removeJob(job);
    }
    var payload = _buildEventPayload(job);
    return _post('scheduleCalendar', payload);
  }

  // ── Public: Remove a job from calendar ────────────────────
  // Call this from pccDeleteJob() or when status -> cancelled
  function removeJob(job) {
    if (!job) return;
    if (!job.calendarEventId && !job.id) return;
    return _post('removeCalendar', {
      eventId: job.calendarEventId || '',
      jobId: job.id || ''
    });
  }

  // ── Public: Bulk sync all jobs ─────────────────────────────
  // Useful for initial setup or after import
  function syncAllJobs() {
    if (!ENABLED) return;
    try {
      var jobs = pccGetJobs ? pccGetJobs() : [];
      var active = jobs.filter(function (j) {
        return j.status !== 'cancelled' && j.status !== 'canceled';
      });
      console.log('[PCC Cal] Bulk syncing', active.length, 'jobs to Google Calendar...');
      // Stagger requests to avoid rate limiting
      active.forEach(function (job, idx) {
        setTimeout(function () { syncJob(job); }, idx * 300);
      });
    } catch (e) {
      console.warn('[PCC Cal] Bulk sync error:', e);
    }
  }

  // ── Public: Enable/disable calendar integration ───────────
  function setEnabled(val) {
    ENABLED = Boolean(val);
    console.log('[PCC Cal] Calendar sync', ENABLED ? 'ENABLED' : 'DISABLED');
  }

  function isEnabled() { return ENABLED; }

  // ── Public API ─────────────────────────────────────────────
  return {
    syncJob: syncJob,
    removeJob: removeJob,
    syncAllJobs: syncAllJobs,
    setEnabled: setEnabled,
    isEnabled: isEnabled
  };

})();

console.log('[PCC Cal] calendar.js loaded');
