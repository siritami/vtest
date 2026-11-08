"""Rebuild the `Be Vietnam` family to match voz.vn exactly.

Background
----------
voz.vn renders body text in "Be Vietnam" served from Google's gstatic
(`fonts.gstatic.com/s/bevietnam/v10/…`) and declares it at **only weight 400**. Measured on
the live site at 32px for "Đặng Fioren ộữệĩ":

    400 = 500 = 255.12    (one face; `font-weight: 500` renders the plain 400 cut)
    600 = 700 = 265.78    (browser-synthesised bold from that same 400)
    italic    = 255.12    (fake oblique — there is no italic file)

The repo previously vendored the same family from the `bettergui/BeVietnam` project at
revision 2.000 with real 400/500/700 + a real italic. The family name matched but the
*design* did not — Google's v10 is revision 4.000:

    glyph     gstatic v10    our old 2.000 build
    Đ         714            786
    ạ         620            591

which is what made our text look different (and our real 500/700 look heavier than
voz.vn's synthesised bold). This script replaces our build with Google's own binaries so the
shapes, spacing and weight behaviour match the site the user is comparing against.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-be-vietnam-gstatic.py \
        --src vtest/_voz-font-probe --out vtest/public/assets/fonts

`--src` must hold the nine upstream files, downloaded from the two places voz.vn loads them:

    # Be Vietnam, 400 only, three unicode ranges (google/gstatic, bevietnam v10)
    https://fonts.gstatic.com/s/bevietnam/v10/FBVzdDflz-iPfoPuIC2iIqkn6H9k.woff2  -> voz-bevietnam-viet.woff2
    https://fonts.gstatic.com/s/bevietnam/v10/FBVzdDflz-iPfoPuIC2iIqgn6H9k.woff2  -> voz-bevietnam-latinext.woff2
    https://fonts.gstatic.com/s/bevietnam/v10/FBVzdDflz-iPfoPuIC2iIqYn6A.woff2    -> voz-bevietnam-latin.woff2

    # Be Vietnam Pro, 400/400italic/600/600italic, latin + vietnamese (self-hosted by voz.vn)
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-400-latin.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-400-vietnamese.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-400italic-latin.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-400italic-vietnamese.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-600-latin.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-600-vietnamese.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-600italic-latin.woff2
    https://voz.vn/styles/voz-xf-26/fonts/be-vietnam-pro/be-vietnam-pro-600italic-vietnamese.woff2

What it produces
----------------
    be-vietnam-400.woff2          one merged 400 face (voz.vn's only weight)
    be-vietnam-pro-400.woff2      merged latin + vietnamese
    be-vietnam-pro-500.woff2      NOT from voz.vn — see below
    be-vietnam-pro-600.woff2      voz.vn's bold; self-identifies as "… Pro SemiBold"
    be-vietnam-pro-400italic.woff2

Notes
-----
* The arrows, checkmarks and box-drawing characters (`↑ ↓ ✓ ✕ ▲ ▼ ‐ ‑`) are **not in any of
  these fonts** — not in voz.vn's copies either. Leaving them out is correct: they already
  fall through to the next family in the stack, exactly as they do on voz.vn. The old build
  script listed them in its subset ranges, which had no effect (subsetting keeps a codepoint
  only when the source actually has a glyph for it).
* The upstream `600` cuts self-identify as family **"Be Vietnam Pro SemiBold"** with
  subfamily `Regular`. Left alone, `font-weight: 600` on `"Be Vietnam Pro"` would never
  match them — the browser would go on to synthesise bold from the 400 face instead. This
  script normalises them back onto the real family.
* `be-vietnam-pro-500.woff2` is kept from the old google/fonts build: voz.vn has no 500, so
  there is nothing to copy, and dropping it would make `font-weight: 500` snap to 400.
"""

import argparse
import sys
from pathlib import Path

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

# fsSelection bits and macStyle bits.
FS_ITALIC = 0x0001
FS_BOLD = 0x0020
FS_REGULAR = 0x0040
MAC_BOLD = 1
MAC_ITALIC = 2

# The gstatic "Be Vietnam" faces, in merge order. `latin-ext` is listed before `latin` so
# its broader European coverage wins any overlapping codepoint.
BE_VIETNAM_PARTS = [
    "voz-bevietnam-viet.woff2",
    "voz-bevietnam-latinext.woff2",
    "voz-bevietnam-latin.woff2",
]

# voz.vn's self-hosted "Be Vietnam Pro" faces, latin + vietnamese pairs. (weight, italic)
BE_VIETNAM_PRO_PARTS = {
    (400, False): ["be-vietnam-pro-400-latin.woff2", "be-vietnam-pro-400-vietnamese.woff2"],
    (400, True): ["be-vietnam-pro-400italic-latin.woff2", "be-vietnam-pro-400italic-vietnamese.woff2"],
    (600, False): ["be-vietnam-pro-600-latin.woff2", "be-vietnam-pro-600-vietnamese.woff2"],
    (600, True): ["be-vietnam-pro-600italic-latin.woff2", "be-vietnam-pro-600italic-vietnamese.woff2"],
}

SUBFAMILY_PRO = {
    (400, False): "Regular",
    (400, True): "Italic",
    (600, False): "SemiBold",
    (600, True): "SemiBoldItalic",
}


def decompress(src: Path, work: Path, name: str) -> Path:
    """woff2 cannot be fed to Merger directly; write a plain TTF beside the output."""
    font = TTFont(str(src / name))
    font.flavor = None
    out = work / f"{Path(name).stem}.ttf"
    font.save(str(out))
    return out


def merge(parts: list[Path], out_path: Path) -> int:
    merged = Merger().merge([str(p) for p in parts])
    merged.flavor = "woff2"
    merged.save(str(out_path))
    return out_path.stat().st_size


def rewrite_names(font: TTFont, family: str, subfamily: str, weight: int, italic: bool) -> None:
    """Put the face on `family` at `weight` so the CSS can actually select it."""
    full = f"{family} {subfamily}" if subfamily != "Regular" else f"{family} Regular"
    ps = f"{family.replace(' ', '')}-{subfamily}"

    name = font["name"]
    for rec in list(name.names):
        if rec.nameID == 1:
            value = family
        elif rec.nameID == 2:
            value = subfamily
        elif rec.nameID == 4:
            value = full
        elif rec.nameID == 6:
            value = ps
        elif rec.nameID == 16:
            value = family
        elif rec.nameID == 17:
            value = subfamily
        else:
            continue
        name.setName(value, rec.nameID, rec.platformID, rec.platEncID, rec.langID)

    font["OS/2"].usWeightClass = weight
    font["head"].macStyle = (MAC_BOLD if weight >= 700 else 0) | (MAC_ITALIC if italic else 0)

    os2 = font["OS/2"]
    os2.fsSelection &= ~(FS_ITALIC | FS_BOLD | FS_REGULAR)
    if italic:
        os2.fsSelection |= FS_ITALIC
    if weight >= 700:
        os2.fsSelection |= FS_BOLD
    if weight == 400 and not italic:
        os2.fsSelection |= FS_REGULAR


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", required=True, help="directory holding the downloaded upstream files")
    parser.add_argument("--out", required=True, help="directory to write woff2 into")
    parser.add_argument("--work", help="scratch directory for the intermediate TTFs (default: <out>/../_font-work)")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    if not src.is_dir():
        print(f"not a directory: {src}", file=sys.stderr)
        return 1
    out.mkdir(parents=True, exist_ok=True)
    work = Path(args.work) if args.work else out.parent / "_font-work"
    work.mkdir(parents=True, exist_ok=True)

    total = 0

    # --- Be Vietnam: one merged 400 face, matching the single weight voz.vn declares --------
    missing = [n for n in BE_VIETNAM_PARTS if not (src / n).is_file()]
    if missing:
        print(f"missing Be Vietnam parts: {', '.join(missing)}", file=sys.stderr)
        return 1
    parts = [decompress(src, work, n) for n in BE_VIETNAM_PARTS]
    target = out / "be-vietnam-400.woff2"
    size = merge(parts, target)
    total += size
    print(f"{target.name:32} {size / 1024:8.1f}K  merged from {len(parts)} gstatic ranges")
    # The merged face keeps Google's name table ("Be Vietnam" / "Regular"), which is already
    # what the stylesheet declares, so no rewrite is needed here.

    # --- Be Vietnam Pro: voz.vn's 400 / 600 faces, re-homed onto the real family -----------
    for (weight, italic), names in BE_VIETNAM_PRO_PARTS.items():
        missing = [n for n in names if not (src / n).is_file()]
        if missing:
            print(f"missing Be Vietnam Pro parts: {', '.join(missing)}", file=sys.stderr)
            return 1
        parts = [decompress(src, work, n) for n in names]
        subfamily = SUBFAMILY_PRO[(weight, italic)]
        # Mirror the flat names css/fonts.css uses: `be-vietnam-pro-<weight>.woff2` and
        # `be-vietnam-pro-italic-<weight>.woff2` (the other families use the same shape).
        stem = f"be-vietnam-pro-{'italic-' if italic else ''}{weight}"
        target = out / f"{stem}.woff2"
        size = merge(parts, target)
        total += size

        # Merger keeps the first font's name table, and the 600 files call themselves
        # "Be Vietnam Pro SemiBold" — rewrite so `font-weight: 600` on "Be Vietnam Pro"
        # resolves to this face instead of synthesising bold from the 400.
        font = TTFont(str(target))
        rewrite_names(font, "Be Vietnam Pro", subfamily, weight, italic)
        font.flavor = "woff2"
        font.save(str(target))
        print(f"{target.name:32} {size / 1024:8.1f}K  from voz.vn {stem} pair")

    print(f"\ntotal {total / 1024:.1f} KB")
    print("kept as-is: be-vietnam-pro-500.woff2 (voz.vn has no medium; see the docstring)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
