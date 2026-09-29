// Posao — PDF sekcija 7: prodavac-kuvar, dve smene, CV neobavezan, prijave na dva emaila (iz SETTINGS).
import { esc, iconSvg } from '../../scripts/ui/render.js';
import { jobPosting, breadcrumbs } from '../schema.js';

export const meta = {
  path: '/posao/',
  out: 'posao/index.html',
  script: 'jobs',
  title: 'Posao: prodavac-kuvar, Novi Sad | Grčki Giros',
  description: 'Grčki Giros traži prodavca-kuvara u Novom Sadu. Dve smene, priprema girosa i usluživanje gostiju. Prijava preko sajta, CV nije obavezan.',
  bodyClass: 'page-jobs',
  schema: (ctx) => (String(ctx.business.job_active).toUpperCase() === 'TRUE' ? [jobPosting(ctx), breadcrumbs(ctx, [{ name: 'Posao', path: '/posao/' }])] : [])
};

function field(name, label, { type = 'text', autocomplete = '', inputmode = '', optional = false, textarea = false, placeholder = '' } = {}) {
  const id = `j-${name}`;
  const control = textarea
    ? `<textarea class="input" id="${id}" name="${name}" rows="4" maxlength="2000" placeholder="${esc(placeholder)}" aria-describedby="${id}-err"></textarea>`
    : `<input class="input" id="${id}" name="${name}" type="${type}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}" aria-describedby="${id}-err">`;
  return `<div class="field" data-field="${name}"><label class="field__label" for="${id}">${label}${optional ? '<span class="optional">opciono</span>' : ''}</label>${control}<p class="field__error" id="${id}-err" role="alert"></p></div>`;
}

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const active = String(b.job_active).toUpperCase() === 'TRUE';
  const title = b.job_title || 'Prodavac-kuvar';
  if (!active) {
    return `<main id="main"><section class="page-hero"><div class="container"><p class="kicker">Posao</p><h1 class="h1" style="margin-top:0.8rem">Trenutno ne tražimo nove ljude.</h1><p class="lead" style="margin-top:1rem">Pratite nas na Instagramu — tamo prvo objavljujemo oglase.</p></div></section></main>`;
  }
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Posao · Novi Sad</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>${esc(title)}. <span>Tražimo vas.</span></h1>
    </div>
    <p class="lead">Dve smene, svakodnevno pravite pravi giros — od mesa do pite. Nema čudnih zahteva. Ima dobre atmosfere.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container split-2" style="align-items:start">
    <article class="info-card" data-reveal>
      <h2>${iconSvg(a, 'user')}Posao</h2>
      <dl class="facts">
        <div><dt>Pozicija</dt><dd>${esc(title)}</dd></div>
        <div><dt>Smene</dt><dd>prva i druga</dd></div>
        <div><dt>Posao</dt><dd>priprema girosa i usluživanje gostiju, priprema salate, sečenje mesa, pečenje pita i pomfrita</dd></div>
        ${b.job_salary ? `<div><dt>Plata</dt><dd>${esc(b.job_salary)}</dd></div>` : ''}
        <div><dt>Lokacija</dt><dd>${esc(b.address_street)}, ${esc(b.address_city)}</dd></div>
        <div><dt>Šta sledi</dt><dd>vlasnik vas zove u najkraćem roku</dd></div>
        ${b.job_phone_display ? `<div><dt>Telefon za posao</dt><dd><a href="tel:${esc(b.job_phone_e164 || b.job_phone_display)}">${esc(b.job_phone_display)}</a></dd></div>` : ''}
      </dl>
    </article>
    <form class="form-card" data-job-form novalidate>
      <h2 class="h3">Prijava</h2>
      ${field('name', 'Ime i prezime', { autocomplete: 'name' })}
      ${field('phone', 'Telefon', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '06x xxx xxxx' })}
      ${field('email', 'Email', { type: 'email', autocomplete: 'email', inputmode: 'email', optional: true, placeholder: 'za potvrdu prijave' })}
      <div class="field-row" style="grid-template-columns:1fr 1fr">
        <div class="field" data-field="experience"><label class="field__label" for="j-experience">Iskustvo<span class="optional">opciono</span></label>
          <select class="input" id="j-experience" name="experience"><option value="">Izaberite</option><option>Bez iskustva</option><option>Do 1 godine</option><option>1–3 godine</option><option>Više od 3 godine</option></select></div>
        <div class="field" data-field="shift"><label class="field__label" for="j-shift">Smena<span class="optional">opciono</span></label>
          <select class="input" id="j-shift" name="shift"><option value="">Svejedno</option><option>Prva smena</option><option>Druga smena</option><option>Obe smene</option></select></div>
      </div>
      ${field('message', 'Nešto o vama', { textarea: true, optional: true, placeholder: 'Gde ste radili, kada možete da počnete…' })}
      <div class="field" data-field="cv">
        <span class="field__label">CV<span class="optional">opciono · PDF, Word, JPG · do 4 MB</span></span>
        <label class="file">${iconSvg(a, 'note')}<span class="file__name" data-file-name>Nije izabran fajl</span><span class="btn btn--sm btn--ghost"><span class="btn__label">Izaberi</span></span>
          <input type="file" name="cv" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" aria-label="CV fajl">
        </label>
        <p class="field__error" role="alert"></p>
      </div>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <p class="notice" data-form-status hidden></p>
      <button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">Pošalji prijavu</span>${iconSvg(a, 'arrow', 'btn__icon')}</button>
      <p class="small muted">Podatke iz prijave vidi samo vlasnik. <a href="/privatnost/">Privatnost</a>.</p>
    </form>
  </div>
</section>
</main>`;
}
