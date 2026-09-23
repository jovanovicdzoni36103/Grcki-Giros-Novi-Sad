// O nama — PDF: autentičnost i poverenje (pita iz Atine, od 2021.). Only facts the client confirmed.
import { iconSvg } from '../../scripts/ui/render.js';
import { breadcrumbs, restaurant } from '../schema.js';
import { stamp } from './home.js';

export const meta = {
  path: '/o-nama/',
  out: 'o-nama/index.html',
  script: 'basic',
  title: 'O nama | Grčki Giros Novi Sad — pravi giros od 2021.',
  description: 'Grčki Giros u Novom Sadu od 2021. pravi jednu stvar: pravi grčki giros u piti koja stiže iz Atine, sa grčkim začinima i velikim porcijama.',
  bodyClass: 'page-about',
  schema: (ctx) => [restaurant(ctx), breadcrumbs(ctx, [{ name: 'O nama', path: '/o-nama/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">O nama · od 2021.</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>Giros kakav se jede <span>u Atini.</span></h1>
    </div>
    <p class="lead">Grčki Giros postoji od 2021. U Novom Sadu pravimo jednu stvar i trudimo se da je pravimo bolje od svih: pravi grčki giros.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container pillars">
    <article class="pillar" data-reveal><span class="pillar__n">01</span><h3>Pita iz Atine</h3><p>Pite naručujemo direktno iz Atine. To nije marketinška priča nego razlog zbog kog giros ima pravi ukus i ne raspada se u ruci.</p></article>
    <article class="pillar" data-reveal style="--i:1"><span class="pillar__n">02</span><h3>Grčki začini</h3><p>Origano, morska so, biber, tucana ljuta paprika. Jednostavno, kao u Grčkoj — da se oseti meso, a ne sos preko svega.</p></article>
    <article class="pillar" data-reveal style="--i:2"><span class="pillar__n">03</span><h3>Velike porcije</h3><p>Porcije su — pa, videćete sami. Ako je i to malo, tu je Giros MAX sa duplim mesom.</p></article>
  </div>
</section>

<section class="section section--blue on-blue" aria-labelledby="how-title">
  <div class="container story">
    <div>
      <p class="kicker" style="color:var(--gold)">Kako nastaje vaš giros</p>
      <h2 class="h2" id="how-title" data-split style="margin-top:0.8rem">Bez prečica.</h2>
      <ol class="process" role="list" style="margin-top:2rem">
        <li>Meso se seče sa ražnja kad stigne porudžbina.</li>
        <li>Pita se peče, pomfrit se prži — sveže, ne unapred.</li>
        <li>Salata se sprema u lokalu, sosevi idu koliko želite.</li>
        <li>Slažemo tačno onako kako ste izabrali, sa porukom „BEZ“ ako nešto ne volite.</li>
      </ol>
    </div>
    <div class="story__art" data-reveal>
      <div class="art-frame" style="--art-bg:#F2EBDD"><svg class="art" viewBox="0 0 200 220" aria-hidden="true"><use href="${a.art}#wrap"/></svg></div>
      ${stamp(ctx, 'stamp-about', 'Grčki Giros • Novi Sad • od 2021. • ')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container final">
    <h2 class="final__title" data-split>Probajte.</h2>
    <p class="lead" style="text-align:center">Dođite u ${ctx.business.address_street} ili naručite dostavu — ista pita, isti ukus.</p>
    <a class="btn btn--gold btn--lg" href="/meni/" data-magnetic><span class="btn__label">Naruči online</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
  </div>
</section>
</main>`;
}
