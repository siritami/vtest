"""Build the vendored `SF Pro Display` webfonts.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-sf-pro-display.py \
        --src "D:/Downloads/SF Pro Display/SF Pro Display/SF-Pro-Display" \
        --out vtest/public/assets/fonts

This family is separate from the build-fonts.py pipeline (Roboto + Be Vietnam Pro) and from
build-be-vietnam.py, and needs its own script for three reasons:

1. **Upstream is CFF/OpenType (.otf), not TrueType.** The other two families are `glyf`
   fonts; this one is `CFF `. Subsetting and woff2 encoding both work, but nothing may
   assume `glyf`/`loca` exist.

2. **The declared weight classes do not match the style names.** Upstream ships
   `SF-Pro-Display-Bold.otf` as `usWeightClass 600` (it is a Semibold-grade cut; Apple's
   `Semibold` is also 600, `Heavy` is 800). The UI asks for `font-weight: 600` in far more
   places than 700, and this family has no real 700, so the Bold cut is built into the **600**
   slot: `font-weight: 600` selects it directly and `font-weight: 700` reuses it, instead of
   the browser synthesising a bold from the 400 face. Each shipped cut is rewritten to the
   weight the stylesheet declares (400 / 500 / 600 / 400 italic).

3. **Upstream carries 18 cuts** (Thin → Black, plus italics). The UI only ever asks for
   400/500/600 and a 400 italic, so only those four are built; copying the rest would add
   ~40 MB of binaries that no rule can reach.

Licence
-------
The San Francisco font is Apple proprietary and is **not** OFL. Its embedded licence
(name ID 13) restricts use to "creating mock-ups of user interfaces to be used in software
products running on Apple's iOS, iPadOS, macOS or tvOS operating systems". Unlike the other
vendored families there is no OFL.txt to copy, and none is generated here — check that your
own use is covered before redistributing the output. See the header of css/fonts.css.
"""

import argparse
import hashlib
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# The cut to build per (weight, italic) slot the stylesheet asks for. The upstream file is
# chosen for its *appearance*, and its declared weight is replaced below.
#
#   400 upright  <- Regular
#   500 upright  <- Medium
#   600 upright  <- Bold     (Apple declares this cut at 600; it is a Semibold grade)
#   400 italic   <- RegularItalic
#
# The UI asks for `font-weight: 600` far more often than 700 (headings, usernames, buttons),
# and this family has no real 700, so the Bold cut is declared in the 600 slot: 600 lands on a
# real face and 700 reuses it instead of the browser synthesising one. See css/fonts.css.
VARIANTS = [
    ("SF-Pro-Display-Regular", 400, False, "sf-pro-display-400.woff2"),
    ("SF-Pro-Display-Medium", 500, False, "sf-pro-display-500.woff2"),
    ("SF-Pro-Display-Bold", 600, False, "sf-pro-display-600.woff2"),
    ("SF-Pro-Display-RegularItalic", 400, True, "sf-pro-display-italic-400.woff2"),
]

FAMILY = "SF Pro Display"

SUB_FAMILY = {
    (400, False): "Regular",
    (500, False): "Medium",
    (600, False): "SemiBold",
    (400, True): "Italic",
}

# Same coverage as the other vendored families (see build-fonts.py) so a page never pulls two
# different unicode-range sets.
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

FS_ITALIC = 0x0001
FS_BOLD = 0x0020
FS_REGULAR = 0x0040


def rewrite_names(font: TTFont, weight: int, italic: bool) -> None:
    """Normalise the family/subfamily and force the weight class the CSS asks for."""
    sub = SUB_FAMILY[(weight, italic)]
    full = f"{FAMILY} {sub}" if sub != "Regular" else f"{FAMILY} Regular"
    ps = f"SFProDisplay-{sub}"

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
    font["head"].macStyle = (1 if weight >= 700 else 0) | (2 if italic else 0)

    os2 = font["OS/2"]
    os2.fsSelection &= ~(FS_ITALIC | FS_BOLD | FS_REGULAR)
    if italic:
        os2.fsSelection |= FS_ITALIC
    if weight >= 700:
        os2.fsSelection |= FS_BOLD
    if weight == 400 and not italic:
        os2.fsSelection |= FS_REGULAR


def build(src: Path, stem: str, weight: int, italic: bool, out_path: Path) -> tuple[int, int]:
    otf = src / f"{stem}.otf"
    if not otf.is_file():
        raise SystemExit(f"missing {otf}")

    font = TTFont(str(otf))
    raw = otf.stat().st_size
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

    # Subsetting can drop the OS/2 weight class again, so re-apply it before saving.
    font["OS/2"].usWeightClass = weight
    font.flavor = "woff2"
    font.save(str(out_path))
    return raw, out_path.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", required=True, help="the upstream SF-Pro-Display directory")
    parser.add_argument("--out", required=True, help="directory to write woff2 into")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    if not src.is_dir():
        print(f"not a directory: {src}", file=sys.stderr)
        return 1
    out.mkdir(parents=True, exist_ok=True)

    total_raw = total_out = 0
    manifest = []
    print(f"{'output':32} {'upstream':>10} {'woff2':>10}  weight italic")
    for stem, weight, italic, filename in VARIANTS:
        raw, size = build(src, stem, weight, italic, out / filename)
        total_raw += raw
        total_out += size
        manifest.append((filename, weight, italic))
        print(f"{filename:32} {raw / 1024:8.1f}K {size / 1024:8.1f}K  {weight:6} {str(italic):>5}")

    print(f"\ntotal {total_out / 1024:.1f} KB across {len(VARIANTS)} files "
          f"(from {total_raw / 1024:.1f} KB upstream)")
    for name, weight, italic in manifest:
        digest = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
        print(f"  {name} w={weight} italic={italic} sha256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
