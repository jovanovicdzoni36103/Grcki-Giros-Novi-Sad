/**
 * Grčki Giros — contact form and job applications.
 */

var CV_MAX_BYTES = 4 * 1024 * 1024;
var CV_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

function fieldError_(errors) {
  var field = Object.keys(errors)[0];
  return apiError_('VALIDATION', errors[field], { field: field, fields: errors });
}

function submitContact_(payload, ctx) {
  var p = payload || {};
  checkBot_(p.meta);
  return onceForRequest_('contact', p.requestId, function () {
    var v = GG_Validation.validateContactForm(p);
    if (!v.ok) throw fieldError_(v.errors);
    if (!hitRateLimit_('contact:' + (v.value.phone || v.value.email), 3, 600) || !hitRateLimit_('contact:global', 15, 600)) {
      throw apiError_('RATE_LIMITED', 'Primili smo više poruka zaredom. Pokušajte ponovo kasnije ili nas pozovite.');
    }
    appendObjects_(SHEETS.CONTACT, [
      { Timestamp: now_(), Name: v.value.name, Phone: v.value.phone, Email: v.value.email, Topic: v.value.topic, Message: v.value.message, Status: 'NEW', 'Request ID': p.requestId || '' }
    ]);
    var settings = getSettings_();
    var html = simpleCard_('Nova poruka sa sajta', [
      ['Ime', esc_(v.value.name)],
      ['Telefon', v.value.phone ? '<a href="tel:' + esc_(v.value.phone) + '">' + esc_(v.value.phone) + '</a>' : '—'],
      ['Email', v.value.email ? esc_(v.value.email) : '—'],
      ['Tema', esc_(v.value.topic || '—')],
      ['Poruka', esc_(v.value.message).replace(/\n/g, '<br>')]
    ], 'Odgovor na ovaj email ide direktno pošiljaocu' + (v.value.email ? '.' : ' (nije ostavio email, pozovite ga).'));
    var text = 'Nova poruka sa sajta\nIme: ' + v.value.name + '\nTelefon: ' + v.value.phone + '\nEmail: ' + v.value.email + '\nTema: ' + v.value.topic + '\n\n' + v.value.message;
    var staff = notificationRecipients_(settings);
    var res = deliverEmail_(staff, 'Poruka sa sajta: ' + (v.value.topic || v.value.name), html, text, {
      priorityFirst: true,
      replyTo: v.value.email || undefined
    });
    log_('INFO', 'contact.submit', 'OK', v.value.name + ' → ' + emailStatusOf_(res, staff.length));
    return { ok: true };
  });
}

function cvFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CV_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (ignored) {}
  }
  var folder = DriveApp.createFolder('Grčki Giros — CV prijave');
  props.setProperty('CV_FOLDER_ID', folder.getId());
  return folder;
}

function saveCv_(cv, applicantName) {
  if (!cv) return null;
  // A picked but empty file must not silently turn into "CV nije priložen".
  if (!cv.data) throw apiError_('VALIDATION', 'CV fajl je prazan. Izaberite drugi fajl.', { field: 'cv' });
  var type = String(cv.type || '');
  var ext = CV_TYPES[type];
  if (!ext) throw apiError_('VALIDATION', 'CV može biti PDF, Word ili slika (JPG, PNG).', { field: 'cv' });
  var bytes;
  try {
    bytes = Utilities.base64Decode(String(cv.data).replace(/^data:[^,]+,/, ''));
  } catch (err) {
    throw apiError_('VALIDATION', 'CV fajl nije ispravan.', { field: 'cv' });
  }
  if (bytes.length > CV_MAX_BYTES) throw apiError_('VALIDATION', 'CV je veći od 4 MB.', { field: 'cv' });
  var safeName = GG_Validation.clean(applicantName, 40).replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_') || 'kandidat';
  var fileName = 'CV_' + safeName + '_' + fmt_(now_(), 'yyyyMMdd-HHmm') + '.' + ext;
  var blob = Utilities.newBlob(bytes, type, fileName);
  var file = cvFolder_().createFile(blob);
  return { url: file.getUrl(), blob: blob, name: fileName };
}

function submitJob_(payload, ctx) {
  var p = payload || {};
  checkBot_(p.meta);
  return onceForRequest_('job', p.requestId, function () {
    var v = GG_Validation.validateJobForm(p);
    if (!v.ok) throw fieldError_(v.errors);
    // No field is required: the per-sender limit keys on whatever contact was given, the global one always applies.
    var sender = v.value.phone || v.value.email;
    if ((sender && !hitRateLimit_('job:' + sender, 2, 3600)) || !hitRateLimit_('job:global', 20, 3600)) {
      throw apiError_('RATE_LIMITED', 'Vaša prijava je već stigla. Hvala!');
    }
    var settings = getSettings_();
    var position = v.value.position || settings.job_title || 'Prodavac-kuvar';
    var applicant = v.value.name || 'kandidat bez imena';
    var cv = saveCv_(p.cv, v.value.name);
    appendObjects_(SHEETS.JOBS, [
      {
        Timestamp: now_(),
        Name: v.value.name,
        Phone: v.value.phone,
        Email: v.value.email,
        Position: position,
        Message: v.value.message,
        CV: cv ? cv.url : '',
        Status: 'NEW',
        'Request ID': p.requestId || ''
      }
    ]);
    var recipients = notificationRecipients_(settings);
    var html = simpleCard_('Nova prijava: ' + position, [
      ['Ime', '<b>' + esc_(v.value.name || 'nije upisano') + '</b>'],
      ['Telefon', v.value.phone ? '<a href="tel:' + esc_(v.value.phone) + '" style="font-size:18px;font-weight:bold">' + esc_(v.value.phone) + '</a>' : 'nije upisan'],
      ['Email', esc_(v.value.email || 'nije upisan')],
      ['Pozicija', esc_(position)],
      ['Poruka', esc_(v.value.message || 'nema').replace(/\n/g, '<br>')],
      ['CV', cv ? '<a href="' + esc_(cv.url) + '">' + esc_(cv.name) + '</a> (i u prilogu)' : 'nije priložen']
    ], v.value.phone || v.value.email ? 'Kandidat je dobio poruku da mu se vlasnik javlja u najkraćem roku.' : 'Kandidat nije ostavio ni telefon ni email.');
    var text = 'Nova prijava: ' + position + '\n' + applicant + '\n' + (v.value.phone || 'telefon nije upisan') + '\n' + (v.value.email || 'email nije upisan') + '\n\n' + v.value.message + (cv ? '\nCV: ' + cv.url : '');
    var res = deliverEmail_(recipients, 'Prijava za posao: ' + applicant, html, text, { priorityFirst: true, attachments: cv ? [cv.blob] : undefined, replyTo: v.value.email || undefined });
    if (v.value.email) {
      var confirm = simpleCard_('Hvala, prijava je stigla.', [
        ['Pozicija', esc_(position)],
        ['Šta sledi', 'Vlasnik vam se javlja ' + (v.value.phone ? 'na ' + esc_(v.value.phone) : 'emailom') + ' u najkraćem roku.']
      ], esc_(settings.business_name) + ' · ' + esc_(settings.address_street) + ', ' + esc_(settings.address_city));
      deliverEmail_([v.value.email], 'Prijava je stigla: ' + (settings.business_name || 'Grčki Giros'), confirm, 'Hvala, prijava je stigla. Vlasnik vam se javlja u najkraćem roku.', {});
    }
    log_('INFO', 'jobs.submit', 'OK', applicant + ' → ' + emailStatusOf_(res, recipients.length));
    return { ok: true };
  });
}
