// ============================================================
// js/modules/documents.js
// Step 4: Documents Module
// Provides: pccDocuments.render()
// Depends on: pccGetJobs, pccGetCustomers, pccGetSettings, pccUpdateJob (storage.js)
// No new storage keys. No PDF library. No email sending.
// Completion Form saves completed_at and completion_notes only.
// Does NOT auto-change job status.
// ============================================================

var pccDocuments = (function () {
  'use strict';

  // -----------------------------------------------------------
  // _pccDocEscape: XSS-safe HTML escape for all user data
  // -----------------------------------------------------------
  function _pccDocEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -----------------------------------------------------------
  // _pccDocGetJob: fetch a single job plus its customer record
  // -----------------------------------------------------------
  function _pccDocGetJob(jobId) {
    var jobs = pccGetJobs();
    var job = null;
    for (var i = 0; i < jobs.length; i++) {
      if (String(jobs[i].id) === String(jobId)) { job = jobs[i]; break; }
    }
    if (!job) return null;
    var customers = pccGetCustomers();
    var customer = null;
    for (var j = 0; j < customers.length; j++) {
      if (String(customers[j].id) === String(job.customerId)) { customer = customers[j]; break; }
    }
    return { job: job, customer: customer || {} };
  }

  // -----------------------------------------------------------
  // _pccDocCompanyInfo: get company info from settings
  // -----------------------------------------------------------
  function _pccDocCompanyInfo() {
    var s = pccGetSettings();
    return {
      name: (s && s.companyName) ? s.companyName : 'ProCharger Cleaning',
      phone: (s && s.phone) ? s.phone : '(239) 887-7024',
      email: (s && s.email) ? s.email : 'info@prochargercleaning.com'
    };
  }

  // -----------------------------------------------------------
  // _pccDocPrint: open print window from a direct user click
  // -----------------------------------------------------------
  function _pccDocPrint(htmlContent) {
    var pw = window.open('', '_blank', 'width=800,height=600');
    if (!pw || pw.closed || typeof pw.closed === 'undefined') {
      alert('Print window was blocked. Please allow popups for this site and try again.');
      return;
    }
    pw.document.open();
    pw.document.write(htmlContent);
    pw.document.close();
    pw.focus();
    pw.print();
  }

  // -----------------------------------------------------------
  // _pccDocGenInvoice: build invoice HTML string
  // -----------------------------------------------------------
  function _pccDocGenInvoice(job, customer) {
    var co = _pccDocCompanyInfo();
    var custName = _pccDocEscape(customer.name || customer.firstName || 'Customer');
    var custPhone = _pccDocEscape(customer.phone || '');
    var custEmail = _pccDocEscape(customer.email || '');
    var custAddr = _pccDocEscape(customer.address || job.address || '');
    var service = _pccDocEscape(job.service || job.serviceType || '');
    var price = _pccDocEscape(job.price || job.total || '');
    var jobDate = _pccDocEscape(job.date || job.scheduledDate || '');
    var notes = _pccDocEscape(job.notes || '');
    var coName = _pccDocEscape(co.name);
    var coPhone = _pccDocEscape(co.phone);
    var coEmail = _pccDocEscape(co.email);
    var invNum = 'INV-' + String(job.id).toUpperCase().substring(0, 8);
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ' + invNum + '</title>'
      + '<style>body{font-family:Arial,sans-serif;margin:40px;color:#111;}'
      + 'h1{color:#0077cc;}'
      + '.header{display:flex;justify-content:space-between;margin-bottom:30px;}'
      + '.section{margin-bottom:20px;}'
      + '.label{font-weight:bold;display:inline-block;width:120px;}'
      + 'table{width:100%;border-collapse:collapse;margin-top:20px;}'
      + 'th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;}'
      + 'th{background:#f0f0f0;}'
      + '.total{font-size:1.2em;font-weight:bold;text-align:right;margin-top:20px;}'
      + '.footer{margin-top:40px;font-size:0.85em;color:#555;border-top:1px solid #ccc;padding-top:10px;}'
      + '@media print{button{display:none;}}'
      + '</style></head><body>'
      + '<div class="header"><div><h1>' + coName + '</h1><p>' + coPhone + '<br>' + coEmail + '</p></div>'
      + '<div style="text-align:right"><h2>INVOICE</h2><p><strong>' + invNum + '</strong><br>Date: ' + jobDate + '</p></div></div>'
      + '<div class="section"><h3>Bill To:</h3><p>'
      + custName + '<br>' + custAddr + '<br>' + custPhone + '<br>' + custEmail
      + '</p></div>'
      + '<table><thead><tr><th>Description</th><th>Date</th><th>Amount</th></tr></thead>'
      + '<tbody><tr><td>' + service + '</td><td>' + jobDate + '</td><td>$' + price + '</td></tr></tbody></table>'
      + '<div class="total">Total Due: $' + price + '</div>'
      + (notes ? '<div class="section"><strong>Notes:</strong> ' + notes + '</div>' : '')
      + '<div class="footer">Thank you for choosing ' + coName + '. Payment due upon receipt.</div>'
      + '</body></html>';
  }

  // -----------------------------------------------------------
  // _pccDocGenWorkOrder: build work order HTML string
  // -----------------------------------------------------------
  function _pccDocGenWorkOrder(job, customer) {
    var co = _pccDocCompanyInfo();
    var custName = _pccDocEscape(customer.name || customer.firstName || 'Customer');
    var custPhone = _pccDocEscape(customer.phone || '');
    var custAddr = _pccDocEscape(customer.address || job.address || '');
    var service = _pccDocEscape(job.service || job.serviceType || '');
    var price = _pccDocEscape(job.price || job.total || '');
    var jobDate = _pccDocEscape(job.date || job.scheduledDate || '');
    var jobTime = _pccDocEscape(job.time || '');
    var notes = _pccDocEscape(job.notes || '');
    var coName = _pccDocEscape(co.name);
    var coPhone = _pccDocEscape(co.phone);
    var woNum = 'WO-' + String(job.id).toUpperCase().substring(0, 8);
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Work Order ' + woNum + '</title>'
      + '<style>body{font-family:Arial,sans-serif;margin:40px;color:#111;}'
      + 'h1{color:#0077cc;}'
      + '.row{display:flex;gap:40px;margin-bottom:20px;}'
      + '.col{flex:1;}'
      + '.field{border-bottom:1px solid #999;min-height:28px;margin-bottom:12px;padding:2px 4px;}'
      + '.label{font-weight:bold;font-size:0.85em;color:#555;display:block;}'
      + '.section{margin-bottom:20px;}'
      + '.checklist{list-style:none;padding:0;}'
      + '.checklist li::before{content:"[ ] ";font-family:monospace;}'
      + '@media print{button{display:none;}}'
      + '</style></head><body>'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:30px;">'
      + '<div><h1>' + coName + '</h1><p>' + coPhone + '</p></div>'
      + '<div style="text-align:right"><h2>WORK ORDER</h2><p><strong>' + woNum + '</strong></p></div></div>'
      + '<div class="row">'
      + '<div class="col"><span class="label">Customer Name</span><div class="field">' + custName + '</div>'
      + '<span class="label">Address</span><div class="field">' + custAddr + '</div>'
      + '<span class="label">Phone</span><div class="field">' + custPhone + '</div></div>'
      + '<div class="col"><span class="label">Service Date</span><div class="field">' + jobDate + '</div>'
      + '<span class="label">Time</span><div class="field">' + jobTime + '</div>'
      + '<span class="label">Service Type</span><div class="field">' + service + '</div>'
      + '<span class="label">Price</span><div class="field">$' + price + '</div></div></div>'
      + '<div class="section"><strong>Job Notes / Special Instructions:</strong>'
      + '<div class="field" style="min-height:60px;">' + notes + '</div></div>'
      + '<div class="section"><strong>Tasks Completed:</strong>'
      + '<ul class="checklist"><li>Arrived on time and introduced team</li>'
      + '<li>Reviewed scope of work with customer</li>'
      + '<li>Completed all services as described</li>'
      + '<li>Final walkthrough completed</li>'
      + '<li>Customer satisfied and signed off</li></ul></div>'
      + '<div class="section" style="margin-top:40px;">'
      + '<div style="display:flex;gap:60px;">'
      + '<div><span class="label">Tech Signature</span><div class="field" style="width:200px;">&nbsp;</div></div>'
      + '<div><span class="label">Customer Signature</span><div class="field" style="width:200px;">&nbsp;</div></div>'
      + '</div></div>'
      + '</body></html>';
  }

  // -----------------------------------------------------------
  // _pccDocGenCompletionForm: build completion form HTML
  // On submit: calls _pccDocSaveCompletion (saves completed_at + notes only)
  // Does NOT change job status automatically
  // -----------------------------------------------------------
  function _pccDocGenCompletionForm(jobId, job, customer) {
    var custName = _pccDocEscape(customer.name || customer.firstName || 'Customer');
    var service = _pccDocEscape(job.service || job.serviceType || '');
    var jobDate = _pccDocEscape(job.date || job.scheduledDate || '');
    var custAddr = _pccDocEscape(customer.address || job.address || '');
    var existing_notes = _pccDocEscape(job.completion_notes || '');
    var existing_date = _pccDocEscape(job.completed_at || '');
    var root = document.querySelector('[data-page="documents"]');
    if (!root) return;
    var formHtml = '<div class="pcc-doc-completion-wrap">'
      + '<h2 class="pcc-doc-section-title">Completion Form</h2>'
      + '<div class="pcc-doc-info-block">'
      + '<div class="pcc-doc-info-row"><span class="pcc-doc-info-label">Customer:</span> <span>' + custName + '</span></div>'
      + '<div class="pcc-doc-info-row"><span class="pcc-doc-info-label">Address:</span> <span>' + custAddr + '</span></div>'
      + '<div class="pcc-doc-info-row"><span class="pcc-doc-info-label">Service:</span> <span>' + service + '</span></div>'
      + '<div class="pcc-doc-info-row"><span class="pcc-doc-info-label">Scheduled:</span> <span>' + jobDate + '</span></div>'
      + '</div>'
      + '<div class="pcc-form-group" style="margin-top:16px;">'
      + '<label class="pcc-doc-info-label" for="doc-completed-at">Completion Date/Time</label>'
      + '<input type="datetime-local" id="doc-completed-at" class="pcc-input" value="' + existing_date + '">'
      + '</div>'
      + '<div class="pcc-form-group" style="margin-top:12px;">'
      + '<label class="pcc-doc-info-label" for="doc-completion-notes">Completion Notes</label>'
      + '<textarea id="doc-completion-notes" class="pcc-input" rows="4" style="width:100%;resize:vertical;">' + existing_notes + '</textarea>'
      + '</div>'
      + '<div style="margin-top:16px;display:flex;gap:10px;">'
      + '<button class="pcc-btn pcc-btn-primary" id="doc-save-completion">Save Completion Record</button>'
      + '<button class="pcc-btn pcc-btn-outline" id="doc-back-from-completion">Back</button>'
      + '</div>'
      + '<p id="doc-completion-status" style="margin-top:10px;color:#0af;"></p>'
      + '</div>';
    root.innerHTML = formHtml;
    document.getElementById('doc-save-completion').addEventListener('click', function () {
      var completedAt = document.getElementById('doc-completed-at').value;
      var completionNotes = document.getElementById('doc-completion-notes').value;
      _pccDocSaveCompletion(jobId, completedAt, completionNotes);
      document.getElementById('doc-completion-status').textContent = 'Saved.';
    });
    document.getElementById('doc-back-from-completion').addEventListener('click', function () {
      pccDocuments.render();
    });
  }

  // -----------------------------------------------------------
  // _pccDocSaveCompletion: save completed_at + completion_notes only
  // Does NOT change job status
  // -----------------------------------------------------------
  function _pccDocSaveCompletion(jobId, completedAt, completionNotes) {
    pccUpdateJob(jobId, {
      completed_at: completedAt,
      completion_notes: completionNotes
    });
  }

  // -----------------------------------------------------------
  // _pccDocGenWaiver: build waiver HTML string
  // waiverType: 'general' | 'carpet' | 'pressure'
  // -----------------------------------------------------------
  function _pccDocGenWaiver(job, customer, waiverType) {
    var co = _pccDocCompanyInfo();
    var custName = _pccDocEscape(customer.name || customer.firstName || 'Customer');
    var custAddr = _pccDocEscape(customer.address || job.address || '');
    var jobDate = _pccDocEscape(job.date || job.scheduledDate || '');
    var coName = _pccDocEscape(co.name);
    var titles = {
      general: 'General Service Waiver',
      carpet: 'Carpet Cleaning Waiver',
      pressure: 'Pressure Washing Waiver'
    };
    var bodies = {
      general: 'I understand and agree that ' + coName + ' will provide cleaning services at the above address. I acknowledge that pre-existing conditions, stains, or damage may not be fully remedied by standard cleaning. I release ' + coName + ' from liability for pre-existing damage, personal property not disclosed prior to service, and normal wear that may be revealed during cleaning.',
      carpet: 'I understand that carpet cleaning services provided by ' + coName + ' may not remove all stains, particularly permanent stains, bleach spots, or damage caused by prior treatments. I acknowledge that some carpets may shrink, show wicking, or have color changes due to pre-existing conditions unrelated to the cleaning service. I release ' + coName + ' from liability for such pre-existing conditions.',
      pressure: 'I understand that pressure washing services provided by ' + coName + ' involve high-pressure water that may reveal or worsen pre-existing cracks, loose paint, deteriorated caulking, or other damage. I confirm that all windows, vents, and openings have been disclosed. I release ' + coName + ' from liability for damage resulting from pre-existing conditions or undisclosed vulnerabilities.'
    };
    var title = titles[waiverType] || titles.general;
    var body = bodies[waiverType] || bodies.general;
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>'
      + '<style>body{font-family:Arial,sans-serif;margin:40px;color:#111;max-width:700px;}'
      + 'h1{color:#0077cc;font-size:1.4em;}'
      + '.field{border-bottom:1px solid #999;min-height:28px;margin:4px 0 16px;padding:2px 4px;}'
      + '.label{font-weight:bold;font-size:0.85em;color:#555;}'
      + '.body-text{line-height:1.7;margin:20px 0;}'
      + '.sig-row{display:flex;gap:60px;margin-top:40px;}'
      + '.sig-col{flex:1;}'
      + '@media print{button{display:none;}}'
      + '</style></head><body>'
      + '<h1>' + _pccDocEscape(coName) + '</h1>'
      + '<h2>' + _pccDocEscape(title) + '</h2>'
      + '<div><span class="label">Customer Name:</span><div class="field">' + custName + '</div></div>'
      + '<div><span class="label">Service Address:</span><div class="field">' + custAddr + '</div></div>'
      + '<div><span class="label">Service Date:</span><div class="field">' + jobDate + '</div></div>'
      + '<p class="body-text">' + _pccDocEscape(body) + '</p>'
      + '<div class="sig-row">'
      + '<div class="sig-col"><span class="label">Customer Signature</span><div class="field" style="height:50px;">&nbsp;</div><span class="label">Date</span><div class="field">&nbsp;</div></div>'
      + '<div class="sig-col"><span class="label">Company Representative</span><div class="field" style="height:50px;">&nbsp;</div><span class="label">Date</span><div class="field">&nbsp;</div></div>'
      + '</div>'
      + '</body></html>';
  }

  // -----------------------------------------------------------
  // _pccDocSelectType: show document type selector for a job
  // -----------------------------------------------------------
  function _pccDocSelectType(jobId) {
    var data = _pccDocGetJob(jobId);
    if (!data) {
      alert('Job not found.');
      return;
    }
    var job = data.job;
    var customer = data.customer;
    var custName = _pccDocEscape(customer.name || customer.firstName || 'Customer');
    var service = _pccDocEscape(job.service || job.serviceType || '');
    var root = document.querySelector('[data-page="documents"]');
    if (!root) return;
    root.innerHTML = '<div class="pcc-doc-selector">'
      + '<div class="pcc-module-header"><h1 class="pcc-module-title">Generate Document</h1></div>'
      + '<p style="margin-bottom:16px;">Job: <strong>' + custName + '</strong> &mdash; ' + service + '</p>'
      + '<div class="pcc-doc-type-grid">'
      + '<button class="pcc-btn pcc-btn-primary pcc-doc-type-btn" data-type="invoice">Invoice</button>'
      + '<button class="pcc-btn pcc-btn-primary pcc-doc-type-btn" data-type="workorder">Work Order</button>'
      + '<button class="pcc-btn pcc-btn-primary pcc-doc-type-btn" data-type="completion">Completion Form</button>'
      + '<button class="pcc-btn pcc-doc-type-btn" data-type="waiver-general">Waiver (General)</button>'
      + '<button class="pcc-btn pcc-doc-type-btn" data-type="waiver-carpet">Waiver (Carpet)</button>'
      + '<button class="pcc-btn pcc-doc-type-btn" data-type="waiver-pressure">Waiver (Pressure Washing)</button>'
      + '</div>'
      + '<button class="pcc-btn pcc-btn-outline" id="doc-back-btn" style="margin-top:20px;">Back to Jobs</button>'
      + '</div>';
    root.querySelectorAll('.pcc-doc-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type');
        if (type === 'invoice') {
          _pccDocPrint(_pccDocGenInvoice(job, customer));
        } else if (type === 'workorder') {
          _pccDocPrint(_pccDocGenWorkOrder(job, customer));
        } else if (type === 'completion') {
          _pccDocGenCompletionForm(jobId, job, customer);
        } else if (type === 'waiver-general') {
          _pccDocPrint(_pccDocGenWaiver(job, customer, 'general'));
        } else if (type === 'waiver-carpet') {
          _pccDocPrint(_pccDocGenWaiver(job, customer, 'carpet'));
        } else if (type === 'waiver-pressure') {
          _pccDocPrint(_pccDocGenWaiver(job, customer, 'pressure'));
        }
      });
    });
    document.getElementById('doc-back-btn').addEventListener('click', function () {
      pccDocuments.render();
    });
  }

  // -----------------------------------------------------------
  // _pccDocRenderList: render job list view
  // -----------------------------------------------------------
  function _pccDocRenderList() {
    var jobs = pccGetJobs();
    var customers = pccGetCustomers();
    var root = document.querySelector('[data-page="documents"]');
    if (!root) return;
    var custMap = {};
    customers.forEach(function (c) { custMap[String(c.id)] = c; });
    var rowsHtml = '';
    if (!jobs || jobs.length === 0) {
      rowsHtml = '<tr><td colspan="5" style="text-align:center;padding:24px;">No jobs found. Add jobs first.</td></tr>';
    } else {
      jobs.forEach(function (job) {
        var cust = custMap[String(job.customerId)] || {};
        var custName = _pccDocEscape(cust.name || cust.firstName || '—');
        var service = _pccDocEscape(job.service || job.serviceType || '—');
        var jobDate = _pccDocEscape(job.date || job.scheduledDate || '—');
        var status = _pccDocEscape(job.status || '—');
        var jobId = _pccDocEscape(String(job.id));
        rowsHtml += '<tr>'
          + '<td>' + custName + '</td>'
          + '<td>' + service + '</td>'
          + '<td>' + jobDate + '</td>'
          + '<td>' + status + '</td>'
          + '<td><button class="pcc-btn pcc-btn-sm pcc-btn-primary pcc-doc-gen-btn" data-jobid="' + jobId + '">Generate Doc</button></td>'
          + '</tr>';
      });
    }
    root.innerHTML = '<div class="pcc-module-header">'
      + '<h1 class="pcc-module-title">DOCUMENTS</h1>'
      + '</div>'
      + '<div class="pcc-doc-list">'
      + '<table class="pcc-table">'
      + '<thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>'
      + '<tbody>' + rowsHtml + '</tbody>'
      + '</table></div>';
    root.querySelectorAll('.pcc-doc-gen-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _pccDocSelectType(btn.getAttribute('data-jobid'));
      });
    });
  }

  // -----------------------------------------------------------
  // render: public entry point called by app.js
  // -----------------------------------------------------------
  function render() {
    var root = document.querySelector('[data-page="documents"]');
    if (!root) return;
    _pccDocRenderList();
  }

  return { render: render };

}());
