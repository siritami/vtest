"""Build the vendored `Segoe UI` webfonts.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-segoe-ui.py --src "C:/Windows/Fonts" --out vtest/public/assets/fonts

Why this script exists rather than reusing build-fonts.py
---------------------------------------------------------
1. **The source is TrueType CFF-less `glyf`, with heavy hinting and a large cmap.** Segoe UI
   ships ~5400 glyphs / ~4000 codepoints, so it must be subset like the others instead of being
   shipped whole (975 KB per cut).

2. **There is no Medium or Semibold cut installed.** Windows ships Regular / Bold / Italic /
   Bold Italic (plus Light and Semilight under their own family names). The UI asks for
   `font-weight: 600` far more often than 700 and this family has no real 600, so the **Bold**
   cut is built into the 600 slot: `600` selects a real face and `700` reuses it, rather than
   the browser snapping 600 to a heavier face or synthesising from Regular. This mirrors what
   css/fonts.css does for Roboto and SF Pro Display (see the notes at the top of that file).

3. **The licence is not OFL.** Segoe UI is Microsoft proprietary. The installed files carry
   `fsType = 8` (editable embedding — the most restrictive tier) and a licence string that
   permits embedding only as those restrictions allow. No OFL.txt is copied or generated, and
   css/fonts.css records this next to the face declarations. Confirm your own use is covered
   before redistributing the output.

Do not build from the "Segoe UI" repack floating around font-download sites: those are ~34 KB
stripped Latin-only subsets (199 glyphs, cmap capped at U+02FF) with **zero Vietnamese
diacritics**, which would break mid-word on almost every line of this forum. The real file in
C:/Windows/Fonts has all of them.
"""

import argparse
import hashlib
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# (installed file name, weight to declare, italic, output name)
#
# The 700 file is written to the **600** output name on purpose: see point 2 in the module
# docstring. Keep the output name in step with css/fonts.css.
VARIANTS = [
    ("segoeui.ttf", 400, False, "segoe-ui-400.woff2"),
    ("segoeuib.ttf", 600, False, "segoe-ui-600.woff2"),
    ("segoeuii.ttf", 400, True, "segoe-ui-italic-400.woff2"),
    ("segoeuiz.ttf", 600, True, "segoe-ui-italic-600.woff2"),
]

FAMILY = "Segoe UI"

SUB_FAMILY = {
    (400, False): "Regular",
    (600, False): "SemiBold",
    (400, True): "Italic",
    (600, True): "SemiBoldItalic",
}

# Same coverage as the other vendored families (see build-fonts.py) so a page never pulls two
# different unicode-range sets. Unlike Be Vietnam, Segoe UI genuinely has glyphs for most of
# the symbols the UI uses (↑ ↓ ▲ ▼ ‐ ‑ × − € ™) — but not ✓ or ✕, which fall through to the
# next family in the stack exactly as they do today.
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
    """Move the face onto family `Segoe UI` at the weight the stylesheet declares.

    The installed Bold cut identifies as `Segoe UI` / `Bold` at 700; it is emitted as the 600
    slot, so the subfamily has to be rewritten too or a browser would match it as bold 700 and
    still synthesise for 600.
    """
    sub = SUB_FAMILY[(weight, italic)]
    full = f"{FAMILY} {sub}" if sub != "Regular" else f"{FAMILY} Regular"
    ps = f"SegoeUI-{sub.replace(' ', '')}"

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


def build(src: Path, filename: str, weight: int, italic: bool, out_path: Path) -> tuple[int, int]:
    ttf = src / filename
    if not ttf.is_file():
        raise SystemExit(f"missing {ttf}")

    font = TTFont(str(ttf), fontNumber=0)
    raw = ttf.stat().st_size
    rewrite_names(font, weight, italic)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    # Segoe UI carries `FFTM` (FontForge timestamps) and heavy hinting tables; the timestamps
    # are noise and the hinting is dropped for woff2 by the encoder anyway.
    options.drop_tables += ["DSIG", "FFTM"]
    options.ignore_missing_unicodes = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(f"{LATIN},{VIETNAMESE}"))
    subsetter.subset(font)

    # Subsetting can drop the weight class again, so re-apply it before saving.
    font["OS/2"].usWeightClass = weight
    font.flavor = "woff2"
    font.save(str(out_path))
    return raw, out_path.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", required=True, help="directory holding the installed Segoe UI TTFs (C:/Windows/Fonts)")
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
    print(f"{'output':30} {'upstream':>10} {'woff2':>10}  weight italic")
    for filename, weight, italic, out_name in VARIANTS:
        raw, size = build(src, filename, weight, italic, out / out_name)
        total_raw += raw
        total_out += size
        manifest.append((out_name, weight, italic))
        print(f"{out_name:30} {raw / 1024:8.1f}K {size / 1024:8.1f}K  {weight:6} {str(italic):>5}")

    print(f"\ntotal {total_out / 1024:.1f} KB across {len(VARIANTS)} files "
          f"(from {total_raw / 1024:.1f} KB upstream)")
    for name, weight, italic in manifest:
        digest = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
        print(f"  {name} w={weight} italic={italic} sha256={digest}")
    print("\nNo OFL file is copied: Segoe UI is Microsoft proprietary (fsType 8).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
