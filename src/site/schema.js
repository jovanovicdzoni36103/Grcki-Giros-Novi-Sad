// schema.org JSON-LD (PDF: Restaurant, FoodEstablishment, Menu, FAQPage, JobPosting).
import Scheduling from '../scripts/shared/scheduling.cjs';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function openingHours(hours) {
  const out = [];
  hours.forEach((h) => {
    if (h.closed || !h.open || !h.close) return;
    const open = Scheduling.parseHM(h.open);
    const close = Scheduling.parseHM(h.close);
    if (close > open) {
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[h.dow], opens: h.open, closes: h.close });
    } else {
      // Crosses midnight: schema.org wants the close on the same row with a closes value past midnight semantics.
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[h.dow], opens: h.open, closes: '23:59' });
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[(h.dow % 7) + 1], opens: '00:00', closes: h.close });
    }
  });
  return out;
}

export function restaurant(ctx) {
  const b = ctx.business;
  return {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FoodEstablishment'],
    '@id': `${ctx.site.url}/#restaurant`,
    name: b.business_name,
    description: 'Pravi grčki giros sa originalnim grčkim začinima. Novi Sad, Dimitrija Tucovića 3, od 2021.',
    url: ctx.site.url + '/',
    telephone: b.phone_e164,
    image: `${ctx.site.url}/assets/img/og.png`,
    servesCuisine: ['Greek', 'Gyros', 'Fast food'],
    priceRange: 'RSD 200–3.300',
    paymentAccepted: 'Cash',
    currenciesAccepted: 'RSD',
    acceptsReservations: false,
    hasMenu: `${ctx.site.url}/meni/`,
    ...(b.map_url ? { hasMap: b.map_url } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address_street,
      addressLocality: b.address_city,
      postalCode: b.postal_code,
      addressCountry: 'RS'
    },
    sameAs: [b.instagram_url].filter(Boolean),
    openingHoursSpecification: openingHours(ctx.hours)
  };
}

export function menu(ctx) {
  const c = ctx.catalog;
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: `Meni, ${ctx.business.business_name}`,
    url: `${ctx.site.url}/meni/`,
    inLanguage: 'sr-Latn',
    hasMenuSection: c.categories
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((cat) => ({
        '@type': 'MenuSection',
        name: cat.name,
        description: cat.description || undefined,
        hasMenuItem: c.products
          .filter((p) => p.categoryId === cat.id)
          .sort((a, b) => a.sort - b.sort)
          .map((p) => ({
            '@type': 'MenuItem',
            name: p.name,
            description: p.description || undefined,
            suitableForDiet: (p.tags || []).includes('vegetarian') ? 'https://schema.org/VegetarianDiet' : undefined,
            offers: { '@type': 'Offer', price: String(p.price), priceCurrency: 'RSD', availability: p.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' }
          }))
      }))
  };
}

export function faq(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
  };
}

export function jobPosting(ctx) {
  const b = ctx.business;
  const posted = ctx.buildDate;
  const valid = new Date(Date.parse(posted) + 90 * 86400000).toISOString().slice(0, 10);
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: b.job_title || 'Prodavac-kuvar',
    description:
      '<p>Rad u dve smene (prva i druga). Priprema girosa i usluživanje gostiju, priprema salate, sečenje mesa, pečenje pita i pomfrita.</p><p>Prijava preko sajta, nijedno polje nije obavezno, CV nije obavezan. Vlasnik se javlja kandidatima u najkraćem roku.</p>',
    datePosted: posted,
    validThrough: valid,
    employmentType: 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: b.business_name, sameAs: ctx.site.url },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', streetAddress: b.address_street, addressLocality: b.address_city, postalCode: b.postal_code, addressCountry: 'RS' }
    }
  };
}

export function breadcrumbs(ctx, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Početna', path: '/' }, ...trail].map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: ctx.site.url + t.path }))
  };
}

export function ld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}
