#!/usr/bin/env python3
"""Convert Simplified Chinese text nodes to Traditional (Taiwan phrases)."""
import re
import sys

from opencc import OpenCC

TAG = re.compile(r"(<[^>]+>)")
cc = OpenCC("s2twp")


def convert_html(html: str) -> str:
    parts = TAG.split(html)
    out = []
    for part in parts:
        if part.startswith("<"):
            out.append(part)
        else:
            out.append(cc.convert(part))
    return "".join(out)


if __name__ == "__main__":
    sys.stdout.write(convert_html(sys.stdin.read()))
