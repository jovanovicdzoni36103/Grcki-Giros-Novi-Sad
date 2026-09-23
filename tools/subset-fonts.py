"""Builds the two self-hosted Archivo subsets used by the site.

Archivo (SIL OFL) variable font from @fontsource-variable/archivo, axes limited to what the design uses
(wght 400-900, wdth 62-100) and glyphs limited to Serbian Latin + punctuation.
Run once after changing the character set:  python tools/subset-fonts.py
Requires: fonttools, brotli.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "node_modules/@fontsource-variable/archivo/files"
OUT = ROOT / "src/assets/fonts"

CORE = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2032, 0x2033, 0x20AC, 0x2192, 0x2190, 0x2212,
]
SERBIAN = [0x0106, 0x0107, 0x010C, 0x010D, 0x0110, 0x0111, 0x0160, 0x0161, 0x017D, 0x017E]


def build(source: Path, codepoints: list[int], target: Path) -> tuple[int, list[str]]:
    font = TTFont(source)
    cmap = font.getBestCmap()
    present = [c for c in codepoints if c in cmap]
    missing = [f"U+{c:04X}" for c in codepoints if c not in cmap]
    font = instancer.instantiateVariableFont(font, {"wght": (400, 900), "wdth": (62, 100)})
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt", "tnum", "lnum", "case"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=present)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(target)
    return target.stat().st_size, missing


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src, cps in [
        ("archivo-core.woff2", SRC / "archivo-latin-wdth-normal.woff2", CORE),
        ("archivo-sr.woff2", SRC / "archivo-latin-ext-wdth-normal.woff2", SERBIAN),
    ]:
        size, missing = build(src, cps, OUT / name)
        print(f"{name}: {size / 1024:.1f} KB, missing: {', '.join(missing) or 'none'}")
