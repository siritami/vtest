"""Build the plain `Be Vietnam` webfonts from the upstream beVietnam project sources.

This family is separate from the Be Vietnam Pro pipeline in build-fonts.py:

  * Upstream is `github.com/bettergui/BeVietnam` v2.000 — 7 weights plus italics as static
    TTFs under `ttf/`. It is the *predecessor* of Be Vietnam Pro and the family the browser
    userscripts on voz.vn style with.
  * Google's CDN ships only ONE weight (400) of it, split into three unicode-range files.
    That is what the settings page originally vendored, which is why bold text was being
    synthetic-stretched and italic was a fake oblique. This script builds the real cuts.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-be-vietnam.py --src "C:/path/to/BeVietnam-master/ttf" \
        --out vtest/public/assets/fonts

Output: be-vietnam-{400,500,700}.woff2 and be-vietnam-italic-400.woff2, subset to the same
latin + vietnamese ranges as the Roboto / Be Vietnam Pro files so a page never has to pull
two different coverage sets.

Two upstream quirks this handles
--------------------------------
1. Only `Regular`, `Bold` and `Italic` declare the family as plain `"Be Vietnam"`. The other
   cuts self-identify as their own family — `Medium` is `"Be Vietnam Medium"` *and* its
   Windows nameID 2 (subfamily) is `Regular`, so a browser sees a second regular, not a
   weight. `rewrite_names()` normalises every cut to family `"Be Vietnam"` with a real
   subfamily, then we also write the flat `be-vietnam-<weight>.woff2` names used by
   `css/fonts.css` (family names are never parsed out of a filename, only read from the
   name table, so this is purely for humans).
2. The flat names deliberately overwrite the old gstatic-derived `be-vietnam-400-*.woff2`
   files. `css/fonts.css` declares one `Be Vietnam` face at weight 400 without a
   `unicode-range`, which is a strict superset of those three range-split faces; leaving the
   old files behind would let a stale `unicode-range` block shadow the real 400 for part of
   the text. `--prune-legacy` (default on) deletes them.

The upstream files are OFL-licensed; OFL.txt is copied as OFL-BeVietnam.txt so it sits next
to OFL.txt (Be Vietnam Pro) without either clobbering the other.
"""

import argparse
import io
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# (upstream stem, output weight, italic, flat filename)
VARIANTS = [
    ("BeVietnam-Regular", 400, False, "be-vietnam-400.woff2"),
    ("BeVietnam-Medium", 500, False, "be-vietnam-500.woff2"),
    ("BeVietnam-Bold", 700, False, "be-vietnam-700.woff2"),
    ("BeVietnam-Italic", 400, True, "be-vietnam-italic-400.woff2"),
]

FAMILY = "Be Vietnam"

# Subfamily names, and the same thing spaced for nameID 4 ("Be Vietnam Bold").
SUB_FAMILY = {
    (400, False): "Regular",
    (500, False): "Medium",
    (700, False): "Bold",
    (400, True): "Italic",
}

# Same coverage the other vendored families use (see build-fonts.py).
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
    "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)
VIETNAMESE = (
    "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,"
    "U+0301,U+0300,U+0309,U+0303,U+0323,U+0327,U+2010,U+2011,U+00D7,U+2190-2193,"
    "U+25B2,U+25BC,U+21E3,U+2715,U+2713,"
    "U+1EA0-1EF9,U+20AB"
)

# Windows fsSelection bits.
FS_ITALIC = 0x0001
FS_BOLD = 0x0020
FS_REGULAR = 0x0040

# Overwrite (rather than skip) these: they are the superseded gstatic-derived files.
LEGACY_PREFIXES = ("be-vietnam-400-",)


def rewrite_names(font: TTFont, weight: int, italic: bool) -> None:
    """Force family `Be Vietnam` with a real subfamily, and fix the style bits.

    Without this, `BeVietnam-Medium.ttf` stays family `"Be Vietnam Medium"` / subfamily
    `"Regular"`, which a browser matches to weight 400 of a *different* family — so
    `font-weight: 500` would fall through to the 400 cut instead of this one.
    """
    sub = SUB_FAMILY[(weight, italic)]
    full = f"{FAMILY} {sub}" if sub != "Regular" else f"{FAMILY} Regular"
    ps = f"BeVietnam-{sub}"

    name = font["name"]
    for rec in list(name.names):
        if rec.nameID == 1:
            value = FAMILY
        elif rec.nameID == 2:
            value = sub
        elif rec.nameID == 4:
            value = full
        elif rec.nameID == 6:
            value = ps
        elif rec.nameID == 16:
            value = FAMILY
        elif rec.nameID == 17:
            value = sub
        else:
            continue
        name.setName(value, rec.nameID, rec.platformID, rec.platEncID, rec.langID)

    font["OS/2"].usWeightClass = weight
    head = font["head"]
    head.macStyle = (1 if weight >= 700 else 0) | (2 if italic else 0)

    os2 = font["OS/2"]
    os2.fsSelection &= ~(FS_ITALIC | FS_BOLD | FS_REGULAR)
    if italic:
        os2.fsSelection |= FS_ITALIC
    if weight >= 700:
        os2.fsSelection |= FS_BOLD
    if weight == 400 and not italic:
        os2.fsSelection |= FS_REGULAR


def build(src: Path, stem: str, weight: int, italic: bool, out_path: Path) -> tuple[int, int]:
    ttf = src / f"{stem}.ttf"
    if not ttf.is_file():
        raise SystemExit(f"missing {ttf}")

    font = TTFont(str(ttf))
    raw = ttf.stat().st_size
    rewrite_names(font, weight, italic)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables += ["DSIG"]
    options.ignore_missing_unicodes = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(f"{LATIN},{VIETNAMESE}"))
    subsetter.subset(font)

    # Re-apply the metrics: subsetting can drop the OS/2 weight class on some builds.
    font["OS/2"].usWeightClass = weight
    font.flavor = "woff2"
    font.save(str(out_path))
    return raw, out_path.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", required=True, help="the upstream `ttf` directory")
    parser.add_argument("--out", required=True, help="directory to write woff2 into")
    parser.add_argument("--no-prune-legacy", action="store_true",
                        help="keep the superseded be-vietnam-400-<range>.woff2 files")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    if not src.is_dir():
        print(f"not a directory: {src}", file=sys.stderr)
        return 1
    out.mkdir(parents=True, exist_ok=True)

    total_raw = total_out = 0
    print(f"{'output':28} {'upstream':>10} {'woff2':>10}  weight italic")
    for stem, weight, italic, filename in VARIANTS:
        raw, size = build(src, stem, weight, italic, out / filename)
        total_raw += raw
        total_out += size
        print(f"{filename:28} {raw / 1024:8.1f}K {size / 1024:8.1f}K  {weight:6} {str(italic):>5}")

    if not args.no_prune_legacy:
        for stale in sorted(p for prefix in LEGACY_PREFIXES for p in out.glob(f"{prefix}*.woff2")):
            stale.unlink()
            print(f"removed superseded {stale.name}")

    license_src = src.parent / "OFL.txt"
    if license_src.is_file():
        shutil.copyfile(license_src, out / "OFL-BeVietnam.txt")
        print("copied OFL-BeVietnam.txt")

    print(f"\ntotal {total_out / 1024:.1f} KB across {len(VARIANTS)} files "
          f"(from {total_raw / 1024:.1f} KB upstream)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
