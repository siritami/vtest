"""Build the vendored `Cantarell` webfonts.

Run from the repo root (the parent of `vtest`):

    python vtest/tools/build-cantarell.py --out vtest/public/assets/fonts

This family is separate from the build-fonts.py pipeline (Roboto + Be Vietnam Pro) and from
build-sf-pro-display.py / build-segoe-ui.py, and needs its own script for three reasons:

1. **The Google Fonts build has no Vietnamese and must not be used.** Cantarell is on
   fonts.google.com, and the obvious move is to copy the woff2 files that
   `https://fonts.googleapis.com/css2?family=Cantarell` points at. Those files cannot render
   this UI. Measured on `cantarell-*-latin.woff2` / `*-latin-ext.woff2` (v18):

     * `U+01A0/01A1/01AF/01B0` (`Ơ ơ Ư ư`) are absent from *every* file;
     * all 90 stacked forms `U+1EA0-1EF9` (`ấ ầ ắ ằ ệ ộ` …) are absent from *every* file;
     * the 6 combining marks (`U+0300/0301/0303/0309/0323/0327`) are absent;
     * there is no `GSUB`, `GPOS`, `GDEF` or `kern` table at all.

   Only `ă`/`đ` survive, and only in the `latin-ext` slice. Google splits by `unicode-range`
   and its Cantarell source simply never mapped those codepoints — so the browser falls back
   to *synthesising* the accents from an unrelated system font. The result is Vietnamese that
   renders as a base letter with a mismatched accent: visually wrong and it reflows mid-word.
   This is the same class of defect build-segoe-ui.py warns about for stripped Latin-only
   "Segoe UI" repacks.

2. **Upstream (GNOME/cantarell-fonts) does have them, but ships sources, not fonts.** The
   release tarball contains three `.ufo` masters and a `.designspace`; `prebuilt/` only holds
   a `meson.build`. So this script *builds* the fonts with fontmake first, then subsets them.
   Its `Cantarell-Regular.ttf` maps 1223 codepoints including `ohorn`, `uhorn`,
   `acircumflexacute`, `abreveacute`, `ocircumflexdotbelow`, `ihookabove` and the
   `ccmp`/`locl`/`mark`/`mkmk` features that position them — i.e. real Vietnamese.

3. **Upstream is a 3-master variable design** (Light 100 → Bold 700, plus Extra Bold 800).
   The UI asks for 400/500/600 and 700, and this family has no 500 or 600 cut, so — exactly
   as the other vendored families do — the 700 face is declared in the **600** slot and 700
   reuses it. The 400 face is the `Regular` master and the 600 slot is the `Bold` master.

The upstream project is OFL-licensed; OFL.txt is copied next to the output.

Not vendored: the `Light`/`Thin` masters and the `Extra Bold` instance. No CSS rule can reach
them, and shipping them would add ~60 KB of unreachable binaries.
"""

import argparse
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# Upstream tag to build. The UFO masters are stable; bump this to refresh the binaries.
UPSTREAM_ZIP = "https://github.com/GNOME/cantarell-fonts/archive/refs/tags/v0.303.zip"
UPSTREAM_DIR = "cantarell-fonts-0.303"

# The two masters the stylesheet needs. `Regular` lands in the 400 slot, `Bold` in 600; the
# UI's `font-weight: 700` then reuses the 600 face rather than being synthesised.
#
# Only 400/600 are declared because the upstream design has no 500 or 600 master: a
# `font-weight: 600` used to snap to the 700 face and every heading came out a grade heavier
# than intended. See the weight-slot note at the top of css/fonts.css.
VARIANTS = [
    ("Cantarell-Regular", 400, "cantarell-400.woff2"),
    ("Cantarell-Bold", 600, "cantarell-600.woff2"),
]

FAMILY = "Cantarell"

SUB_FAMILY = {400: "Regular", 600: "SemiBold"}

# Same coverage as the other vendored families (see build-fonts.py), so a page never pulls two
# different unicode-range sets. The Vietnamese slice is the whole point of this script.
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

# Guard against a silent regression to a Latin-only build. `Ơ ơ Ư ư` plus a spread of stacked
# forms; if any is missing the subset is unusable for this UI and the script fails loudly.
REQUIRED_VIETNAMESE = [0x01A0, 0x01A1, 0x01AF, 0x01B0, 0x1EA5, 0x1EAF, 0x1EC7, 0x1ED9, 0x1EC9]


def fetch_and_build(work: Path) -> Path:
    """Download the upstream sources and build the TTF masters with fontmake."""
    zip_path = work / "cantarell.zip"
    print(f"downloading {UPSTREAM_ZIP}")
    subprocess.run(["curl", "-sL", "-o", str(zip_path), UPSTREAM_ZIP], check=True)

    extract = work / "src"
    extract.mkdir(parents=True, exist_ok=True)
    shutil.unpack_archive(str(zip_path), str(extract))

    ufo_dir = extract / UPSTREAM_DIR / "src"
    if not ufo_dir.is_dir():
        raise SystemExit(f"unexpected archive layout, no {ufo_dir}")

    ufos = [ufo_dir / f"{stem}.ufo" for stem, _, _ in VARIANTS]
    for ufo in ufos:
        if not ufo.is_dir():
            raise SystemExit(f"missing master {ufo}")

    out_dir = work / "ttf"
    out_dir.mkdir(parents=True, exist_ok=True)
    # fontmake is required only for the build step; it is not a runtime dependency of the app.
    cmd = [sys.executable, "-m", "fontmake", "-u", *[str(u) for u in ufos], "-o", "ttf",
           "--output-dir", str(out_dir)]
    print("building: " + " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stdout[-2000:])
        sys.stderr.write(result.stderr[-4000:])
        raise SystemExit("fontmake failed — is it installed? `pip install fontmake`")
    return out_dir


def rewrite_names(font: TTFont, weight: int) -> None:
    """Normalise the family/subfamily and force the weight class the CSS asks for."""
    sub = SUB_FAMILY[weight]
    full = f"{FAMILY} {sub}" if sub != "Regular" else f"{FAMILY} Regular"
    ps = f"Cantarell-{sub}"

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
    font["head"].macStyle = 1 if weight >= 700 else 0

    os2 = font["OS/2"]
    os2.fsSelection &= ~(FS_ITALIC | FS_BOLD | FS_REGULAR)
    if weight >= 700:
        os2.fsSelection |= FS_BOLD
    if weight == 400:
        os2.fsSelection |= FS_REGULAR


def build(ttf_dir: Path, stem: str, weight: int, out_path: Path) -> tuple[int, int]:
    ttf = ttf_dir / f"{stem}.ttf"
    if not ttf.is_file():
        raise SystemExit(f"missing built master {ttf}")

    font = TTFont(str(ttf))
    raw = ttf.stat().st_size
    rewrite_names(font, weight)

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

    cmap = font.getBestCmap()
    missing = [f"U+{cp:04X}" for cp in REQUIRED_VIETNAMESE if cp not in cmap]
    if missing:
        raise SystemExit(
            f"{out_path.name}: subset lost required Vietnamese codepoints {missing}. "
            "This is the defect the module docstring describes — do not ship it."
        )

    # Subsetting can drop the OS/2 weight class again, so re-apply it before saving.
    font["OS/2"].usWeightClass = weight
    # fontTools stamps `head.modified` with the current time on save, so two builds of the
    # same sources would otherwise differ and the sha256 in the summary below would be
    # meaningless as a check. `recalcTimestamp = False` keeps the value from the source, and
    # pinning `modified` to `created` makes the output byte-for-byte reproducible.
    font.recalcTimestamp = False
    font["head"].modified = font["head"].created
    font.flavor = "woff2"
    font.save(str(out_path))
    return raw, out_path.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", required=True, help="directory to write woff2 into")
    parser.add_argument("--keep", help="keep the downloaded sources and built TTFs here")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(args.keep) if args.keep else Path(tmp)
        work.mkdir(parents=True, exist_ok=True)
        ttf_dir = fetch_and_build(work)

        total_raw = total_out = 0
        manifest = []
        print(f"\n{'output':26} {'upstream':>10} {'woff2':>10}  weight")
        for stem, weight, filename in VARIANTS:
            raw, size = build(ttf_dir, stem, weight, out / filename)
            total_raw += raw
            total_out += size
            manifest.append((filename, weight))
            print(f"{filename:26} {raw / 1024:8.1f}K {size / 1024:8.1f}K  {weight}")

        # The upstream licence travels with the binaries, as for the other OFL families.
        license_src = work / "src" / UPSTREAM_DIR / "COPYING"
        if license_src.is_file():
            shutil.copyfile(license_src, out / "OFL-Cantarell.txt")
            print("\ncopied COPYING -> OFL-Cantarell.txt")

    print(f"\ntotal {total_out / 1024:.1f} KB across {len(VARIANTS)} files "
          f"(from {total_raw / 1024:.1f} KB built)")
    for name, weight in manifest:
        digest = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
        print(f"  {name} w={weight} sha256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
