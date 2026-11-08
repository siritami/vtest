"""Build the vendored webfonts for the VOZ web client.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-fonts.py --src <dir with the upstream .ttf> --out vtest/public/assets/fonts

What it does
------------
Roboto ships as a variable font upstream (wght 100-900, wdth 75-100); Be Vietnam Pro ships
as static per-weight files. Both are reduced to the three weights the CSS actually uses
(400/500/700) and subset to the `latin` + `vietnamese` ranges, then written as woff2. That
keeps each file a few tens of KB instead of ~130-490 KB, and Vietnamese diacritics — which
this UI is full of — stay in a range that is always kept.

The upstream files are OFL-licensed. OFL.txt is copied next to the output so the licence
travels with the binaries.

Not covered here: the plain `Be Vietnam` family (assets/fonts/be-vietnam-400-*.woff2). Its
upstream project publishes a single 400 weight and Google already ships it pre-split into
three unicode-range files, so those are copied from fonts.gstatic.com verbatim — see
css/fonts.css. Re-running this script leaves them alone.
"""

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Weights the stylesheet uses. Roboto is instantiated at these values; Be Vietnam Pro
# picks the matching static file.
#
# Roboto's 700 cut is written into the 600 slot: the UI asks for `font-weight: 600` far more
# often than 700 and this family has no real 600, so without this the browser would snap 600
# to the 700 face and every heading would render a full bold heavier than intended. 700 then
# reuses the same file. See css/fonts.css.
WEIGHTS = {
    400: "Regular",
    500: "Medium",
    600: "Bold",
}

# Unicode ranges mirroring Google Fonts' `latin` and `vietnamese` subsets, plus the
# punctuation and symbols the UI renders literally (arrows, box drawing for the caret,
# the multiplication sign in the sticker-download list).
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


def subset_font(font: TTFont, out_path: Path) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    # Drop the signature table; woff2 is re-signed anyway.
    options.drop_tables += ["DSIG"]
    options.ignore_missing_unicodes = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(f"{LATIN},{VIETNAMESE}"))
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out_path)
    return out_path.stat().st_size


def instantiate(vf_path: Path, weight: int) -> TTFont:
    font = TTFont(vf_path)
    axes = {axis.axisTag: axis for axis in font["fvar"].axes}
    location = {"wght": weight}
    if "wdth" in axes:
        location["wdth"] = axes["wdth"].defaultValue
    return instancer.instantiateVariableFont(font, location, inplace=False, updateFontNames=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", required=True, help="directory holding the upstream .ttf files")
    parser.add_argument("--out", required=True, help="directory to write woff2 into")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    roboto_vf = src / "Roboto-VF.ttf"
    if not roboto_vf.is_file():
        print(f"missing {roboto_vf}", file=sys.stderr)
        return 1

    total = 0
    manifest = []

    for weight in WEIGHTS:
        # Roboto: instantiate the variable font at the requested weight.
        font = instantiate(roboto_vf, weight)
        name = f"roboto-{weight}.woff2"
        size = subset_font(font, out / name)
        manifest.append((name, weight, size))
        total += size
        print(f"roboto-{weight}.woff2  {size / 1024:7.1f} KB")

    for weight, suffix in WEIGHTS.items():
        static = src / f"BeVietnamPro-{suffix}.ttf"
        if not static.is_file():
            print(f"missing {static}", file=sys.stderr)
            return 1
        font = TTFont(static)
        name = f"be-vietnam-pro-{weight}.woff2"
        size = subset_font(font, out / name)
        manifest.append((name, weight, size))
        total += size
        print(f"be-vietnam-pro-{weight}.woff2  {size / 1024:7.1f} KB")

    license_src = src / "OFL.txt"
    if license_src.is_file():
        shutil.copyfile(license_src, out / "OFL.txt")

    print(f"\ntotal {total / 1024:.1f} KB across {len(manifest)} files")
    for name, weight, size in manifest:
        digest = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
        print(f"  {name} w={weight} sha256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
