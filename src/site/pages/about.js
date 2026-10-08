// O nama: autentičnost i poverenje (grčki začini, od 2021.). Only facts the client confirmed.
import { iconSvg } from '../../scripts/ui/render.js';
import { breadcrumbs, restaurant } from '../schema.js';
import { stamp } from './home.js';

export const meta = {
  path: '/o-nama/',
  out: 'o-nama/index.html',
  script: 'basic',
  title: 'O nama | Grčki Giros Novi Sad, pravi giros od 2021.',
  description: 'Grčki Giros u Novom Sadu od 2021: originalni začini iz Grčke, premazi po receptima grčkih kuvara i isti ukus svaki put. Grčki, ali domaćinski.',
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
    <p class="lead">Grčki Giros radi od 2021. Sve ove godine držimo isti kvalitet i isti ukus, a usluga nam je jednako važna kao ono što je u piti.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container pillars">
    <article class="pillar" data-reveal><span class="pillar__n">01</span><h3>Začini iz Grčke</h3><p>Začini koje koristimo su originalni grčki. Zato naš giros ima ukus po kome ga prepoznajete.</p></article>
    <article class="pillar" data-reveal style="--i:1"><span class="pillar__n">02</span><h3>Premazi iz naše kuhinje</h3><p>Tzatziki, tirokafteri i urnebes pravimo sveže, po receptima grčkih kuvara. Uz njih grčki origano, morska so, crni biber i tucana ljuta paprika.</p></article>
    <article class="pillar" data-reveal style="--i:2"><span class="pillar__n">03</span><h3>Meso i povrće</h3><p>Na kvalitet mesa i povrća posebno pazimo. A kad je malo, tu je Extra meso: još 100 g mesa uz vaš giros.</p></article>
  </div>
</section>

<section class="section section--blue on-blue" aria-labelledby="how-title">
  <div class="container story">
    <div>
      <p class="kicker" style="color:var(--gold)">Kako nastaje naš giros</p>
      <h2 class="h2" id="how-title" data-split style="margin-top:0.8rem">Korak po korak.</h2>
      <ol class="process" role="list" style="margin-top:2rem">
        <li>Meso se seče sa ražnja kad poručite.</li>
        <li>Pita se peče, a pomfrit se prži.</li>
        <li>Salate se spremaju u lokalu, a premaze birate po ukusu.</li>
        <li>Giros slažemo onako kako ste izabrali, bez onoga što ne volite.</li>
      </ol>
    </div>
    <div class="story__art" data-reveal>
      <div class="art-frame art-live" style="--art-bg:#F2EBDD"><svg class="art" viewBox="0 0 200 220" aria-hidden="true"><use href="${a.art}#wrap"/></svg></div>
      ${stamp('stamp-about')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container final">
    <h2 class="final__title" data-split>Grčki Giros može!</h2>
    <p class="lead" style="text-align:center">Dođite u ${ctx.business.address_street} i probajte giros pripremljen sa istom pažnjom svaki put.</p>
    <a class="btn btn--gold btn--lg" href="/meni/" data-magnetic><span class="btn__label">Pogledaj meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
  </div>
</section>
</main>`;
}
