// /posao/: job application, the only form on the site. No field is required; the CV (PDF, Word, JPG/PNG up to 4 MB) is optional.
import Validation from '../shared/validation.cjs';
import { $, on, esc, icon } from '../core/dom.js';
import { bootCommon } from './common.js';
import { bindForm, setError } from '../ui/forms.js';

const MAX = 4 * 1024 * 1024;
const TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function init() {
  await bootCommon();
  const form = $('[data-job-form]');
  if (!form) return;
  const fileInput = form.querySelector('[name="cv"]');
  const fileLabel = form.querySelector('[data-file-name]');
  on(form, 'change', '[name="cv"]', () => {
    const f = fileInput.files[0];
    setError(form, 'cv', '');
    if (!f) {
      fileLabel.textContent = 'Nije izabran fajl';
      return;
    }
    if (!TYPES.includes(f.type)) setError(form, 'cv', 'CV može biti PDF, Word ili slika (JPG, PNG).');
    else if (f.size > MAX) setError(form, 'cv', 'CV je veći od 4 MB.');
    else if (!f.size) setError(form, 'cv', 'CV fajl je prazan. Izaberite drugi fajl.');
    fileLabel.textContent = `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`;
  });
  bindForm(form, {
    action: 'jobs.submit',
    collect: async (f, opts = {}) => {
      const file = f.cv.files[0];
      const payload = { name: f.name.value, phone: f.phone.value, email: f.email.value, position: f.position.value, message: f.message.value };
      if (!opts.lite && file && TYPES.includes(file.type) && file.size <= MAX) payload.cv = { name: file.name, type: file.type, data: await readFile(file) };
      payload._file = file || null;
      return payload;
    },
    validate: (p) => {
      const v = Validation.validateJobForm(p);
      if (p._file && !TYPES.includes(p._file.type)) v.errors.cv = 'CV može biti PDF, Word ili slika (JPG, PNG).';
      else if (p._file && p._file.size > MAX) v.errors.cv = 'CV je veći od 4 MB.';
      else if (p._file && !p._file.size) v.errors.cv = 'CV fajl je prazan. Izaberite drugi fajl.';
      v.ok = Object.keys(v.errors).length === 0;
      delete p._file;
      return v;
    },
    successHtml: (p) => {
      const first = p.name.trim().split(' ')[0];
      const reach = p.phone.trim() ? ` Vlasnik vam se javlja na ${esc(p.phone.trim())} u najkraćem roku.` : p.email.trim() ? ' Vlasnik vam se javlja emailom u najkraćem roku.' : '';
      return `<div class="form-success" data-success tabindex="-1">${icon('check-circle')}<h3 class="h3">Prijava je stigla.</h3><p>Hvala${first ? `, ${esc(first)}` : ''}.${reach}${p.email.trim() ? ' Potvrdu smo poslali i na email.' : ''}</p></div>`;
    }
  });
}

init();
