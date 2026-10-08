// Maps PRODUCTS.art keys to a sprite symbol + color variables + frame background.
// Owners can reuse any key in the sheet; unknown keys fall back to the category default.

export const ART_VARIANTS = {
  wrap: { symbol: 'wrap', bg: '#F2EBDD' },
  'wrap-spicy': { symbol: 'wrap', bg: '#FBE4DF', style: '--sauce:#EE7B4F;--fleck:#C92F1B;--chili:1;--veg-a:#C92F1B' },
  'wrap-atina': { symbol: 'wrap', bg: '#E3EBF6', style: '--veg-b:#8DBF55;--fleck:#4C7A3A' },
  'wrap-custom': { symbol: 'wrap', bg: '#FDF0D8', style: '--q:1' },
  'wrap-max': { symbol: 'wrap', bg: '#E5EEDD', style: '--max:1;--x2:1' },
  'wrap-mali': { symbol: 'wrap', bg: '#E3EBF6', style: '--art-scale:0.84' },
  'wrap-veg': { symbol: 'wrap', bg: '#E5EEDD', style: '--meat:#F7C84A;--meat-2:#D69A1E;--veg-b:#8DBF55' },
  plate: { symbol: 'plate', bg: '#E3EBF6' },
  pljeskavica: { symbol: 'pljeskavica', bg: '#FDF0D8' },
  cevapi: { symbol: 'cevapi', bg: '#F2EBDD', style: '--art-scale:1.15' },
  kobasica: { symbol: 'kobasica', bg: '#FBE4DF', style: '--art-scale:1.15' },
  meat: { symbol: 'meat', bg: '#E3EBF6' },
  raznj: { symbol: 'raznj', bg: '#F2EBDD' },
  box: { symbol: 'box', bg: '#F2EBDD' },
  'bundle-1': { symbol: 'bundle-1', bg: '#FDF0D8' },
  'bundle-2': { symbol: 'bundle-2', bg: '#E3EBF6' },
  'bundle-4': { symbol: 'bundle-4', bg: '#F2EBDD' },
  fries: { symbol: 'fries', bg: '#FDF0D8' },
  'fries-feta': { symbol: 'fries', bg: '#E5EEDD', style: '--feta:1' },
  pita: { symbol: 'pita', bg: '#F2EBDD' },
  salad: { symbol: 'salad', bg: '#E5EEDD' },
  'salad-cabbage': { symbol: 'slaw', bg: '#F2EBDD' },
  'sauce-white': { symbol: 'sauce', bg: '#E3EBF6' },
  'sauce-red': { symbol: 'sauce', bg: '#FBE4DF', style: '--sauce:#EE7B4F;--fleck:#C92F1B' },
  'sauce-orange': { symbol: 'sauce', bg: '#FDF0D8', style: '--sauce:#F2A65A;--fleck:#C92F1B' },
  'can-red': { symbol: 'can', bg: '#FBE4DF', style: '--can:#D72B2B' },
  'can-black': { symbol: 'can', bg: '#E6E0D2', style: '--can:#1E1E1E' },
  'can-orange': { symbol: 'can', bg: '#FDF0D8', style: '--can:#F28C1B' },
  'can-green': { symbol: 'can', bg: '#E5EEDD', style: '--can:#2E9E4F' },
  bottle: { symbol: 'bottle', bg: '#E3EBF6' },
  'bottle-sparkling': { symbol: 'bottle', bg: '#E3EBF6', style: '--bubbles:1;--label:#123A6B;--cap:#D1432B' },
  bag: { symbol: 'bag', bg: '#F2EBDD' }
};

const CATEGORY_FALLBACK = { giros: 'wrap', porcije: 'plate', paketi: 'bundle-1', akcije: 'bundle-1', rostilj: 'pljeskavica', prilozi: 'fries', salate: 'salad', sosovi: 'sauce-white', pice: 'can-red' };

export function artFor(product) {
  return ART_VARIANTS[product.art] || ART_VARIANTS[CATEGORY_FALLBACK[product.categoryId]] || ART_VARIANTS.bag;
}
