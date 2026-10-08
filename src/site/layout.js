// Page shell: <head> (SEO, OG, preload, runtime config), header, footer, overlays and the page script.
import { esc } from '../scripts/ui/render.js';
import { header, footer } from './partials.js';
import { ld } from './schema.js';

export function layout(ctx, page, body) {
  const url = ctx.site.url + page.path;
  const title = page.title;
  const runtime = {
    api: ctx.site.apiUrl,
    env: ctx.env,
    build: ctx.buildId,
    gaId: ctx.site.gaId || '',
    assets: { icons: ctx.assets.icons, art: ctx.assets.art, snapshot: ctx.assets.snapshot }
  };
  const schema = (page.schema || []).map(ld).join('\n');
  const css = page.css || ctx.assets.css;
  const noChrome = page.chrome === false;
  return `<!doctype html>
<html lang="sr-Latn" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta name="theme-color" content="#1B4F8C">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(ctx.business.business_name)}">
<meta property="og:locale" content="sr_RS">
<meta property="og:title" content="${esc(page.ogTitle || title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ctx.site.url)}/assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-64.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/archivo-core.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${css}">
${page.headExtra || ''}
<script>document.documentElement.classList.add('js');window.GG=${JSON.stringify(runtime)};setTimeout(function(){if(!window.GG_READY)document.documentElement.classList.remove('js')},4000);</script>
<script type="module" src="${page.script}"></script>
${schema}
</head>
<body class="${esc(page.bodyClass || '')}"${page.headerFixed ? ' data-header-fixed' : ''}>
${noChrome ? '' : header(ctx)}
${body}
${noChrome ? '' : footer(ctx)}
</body>
</html>
`;
}
