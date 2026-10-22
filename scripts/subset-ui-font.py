"""Regenerate the checked-in UI font after changing translations or examples.

Requires fonttools[woff]==4.62.1; normal builds use the checked-in WOFF2 and
do not need Python. Run from any directory: python scripts/subset-ui-font.py.
Characters outside this subset fall back to the original full font.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "src" / "app" / "fonts"


def main():
    codepoints = set(range(0x20, 0x7F))
    sources = sorted((ROOT / "src" / "locales").glob("*/messages.po"))
    sources += sorted((ROOT / "src" / "examples").glob("*.cj"))
    for source in sources:
        codepoints.update(map(ord, source.read_text(encoding="utf-8")))

    font = TTFont(FONT_DIR / "HarmonyOS_Sans.woff2", recalcTimestamp=False)
    options = subset.Options()
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    output = FONT_DIR / "HarmonyOS_Sans_UI.woff2"
    font.save(output)
    print(f"{output.name}: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
