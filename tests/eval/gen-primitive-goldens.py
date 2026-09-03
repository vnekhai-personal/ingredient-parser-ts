#!/usr/bin/env python3
"""Generate CPython/pint ground truth for the TS-native primitives in src/_py.ts, src/fraction.ts
and src/en/_utils.ts (fuzz inputs, seeded and deterministic).

Run from the repo root with the training venv (needs pint + ingredient_parser at the pin):

    ip-repo/venv/bin/python tests/eval/gen-primitive-goldens.py

Writes tests/eval/goldens/<primitive>.json (canonical JSON: compact separators, raw unicode).
Consumed by tests/eval/primitives.test.ts. Floats are exchanged as big-endian IEEE-754 hex bit
patterns so NaN sign/payload and -0.0 survive the trip. Invisible characters in this file are mostly
written as Python escapes (a few format characters are literal inside string lists).
"""

from __future__ import annotations

import html
import json
import logging
import math
import random
import re
import statistics
import struct
import sys
import unicodedata
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "goldens"
OUT.mkdir(parents=True, exist_ok=True)

logging.disable(logging.CRITICAL)  # pint logs on odd unit strings
sys.set_int_max_str_digits(0)  # str() of Fraction('1e9999').numerator must not raise
sys.path.insert(0, str(ROOT / "ip-repo"))

from ingredient_parser.en._constants import UNITS  # noqa: E402
from ingredient_parser.en._utils import UREG, convert_to_pint_unit, tokenize  # noqa: E402
import io  # noqa: E402
import tokenize as pytokenize  # noqa: E402
from pint.util import string_preprocessor  # noqa: E402


def bits(x: float) -> str:
    return struct.pack(">d", x).hex()


def dump(name: str, obj: object) -> None:
    path = OUT / f"{name}.json"
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    # Lone surrogates (an input the port must reject like CPython does) cannot be written as UTF-8: escape them.
    text = re.sub(r"[\ud800-\udfff]", lambda m: "\\u%04x" % ord(m.group()), text)
    with path.open("w", encoding="utf-8") as f:
        f.write(text)
    print(f"{name:20s} {len(obj):6d} cases {path.stat().st_size / 1024:8.1f} KB")


def rand_string(rng: random.Random, alphabet: list[str], max_tokens: int, min_tokens: int = 0) -> str:
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(min_tokens, max_tokens)))


def uniq(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


# All code points CPython's str.isspace() accepts — the reference for pyStrip / \S.
PY_SPACES = [chr(c) for c in range(0x110000) if chr(c).isspace()]
# Look-alikes that are NOT whitespace for CPython (some are for JS `\s`).
NOT_SPACES_LOOKALIKE = ["​", "‌", "‍", "﻿", "᠎", "⁠", "­"]

# Unicode 15.1 / 16.0 / 17.0 additions: unassigned (Cn) for CPython 3.12 (Unicode 15.0),
# assigned for Node 22 (Unicode 17.0). Used to probe \p{L}/\p{N}/printable divergences.
NEW_CPS = ["⿼", "⿿", "㇯", "\U0002ebf0", "\U0002ee5d",  # 15.1
           "Ɤ", "ꟍ", "\U0001cc00", "\U0001ccf9", "\U0001fadc", "\U0001fa89", "\U00016ea0", "\U0001e5d0",  # 16.0
           "\U00011db0", "\U0001b300", "\U00013460", "\U000143fa",  # 16.0 / 17.0
           "෇", "Ᲊ", "ᲊ", "ꟑ", "\U00010570", "\U00010597"]

NUM_ALPHABET = (
    list("0123456789") * 3
    + list("._eE+-")
    + [" ", "\t", "\x1c", "\x85", "﻿", "\xa0", " ", "　", "\n"]
    + ["inf", "nan", "Infinity", "iNfInItY", "NaN", "0x", "0b", "0o"]
    + ["١", "٢", "٣", "１", "２", "०", "९", "\U0001d7d8", "\U0001d7e1", "߀", "௧"]
    + ["²", "³", "½", "¼", "⅓", "Ⅻ", "〇", "i", "n", "f", "a", "I", "N", "y", "t", "x", "j"]
)

FLOAT_EDGE = [
    "", " ", "\t", " ", "1", "-1", "+1", "1.", ".1", "1.5", "-.5", "+.5e-3", ".", "..", ".e1", "1e", "e1", "1e+",
    "1e-", "1e5", "1E5", "1e+05", "1e-05", "1_000", "1__0", "_1", "1_", "1_e5", "1e_5", "1e5_", "1.5_", "1._5",
    "1_.5", "1.e5", "1e5.", "1e5e5", "--1", "+-1", "-+1", "++1", "inf", "-inf", "+inf", "Inf", "INF", "iNF",
    "infinity", "-Infinity", "+INFINITY", "infinit", "infinityy", "nan", "-nan", "+nan", "NaN", "NAN", "nAn", "nans",
    "1e400", "-1e400", "1e-400", "4.9e-324", "2.4703282292062327e-324", "2.4703282292062328e-324",
    "2.470328229206232e-324", "0.5e-323", "1e309", "1.7976931348623157e308", "1.7976931348623158e308",
    "1.7976931348623159e308", "1.797693134862315808e308", "9" * 400, "0." + "0" * 400 + "1", "1" * 20 + "e-5",
    "0.1", "0.2", "0.3", "1.0000000000000002", "1.00000000000000011102230246251565404236316680908203125",
    "1.000000000000000111022302462515654042363166809082031249", "9007199254740993", "9007199254740992.5",
    "0.30000000000000004", "123456789012345678901234567890", "1e23", "8.5e-324", "5e-324", "2.5e-324",
    "١٢", "١٢.٣", "١_٢", "-١", "١e٢", "1e٥", "١.", ".١",
    "１２", "１.５", "０x10", "٠", "\U0001d7d9\U0001d7da", "½", "²", "1½", "Ⅻ",
    "  1  ", "\x1c1", "1\x85", "﻿1", "1﻿", "\xa01", "　1", "1\n", "\n1", "1\r\n", "1 2", "1\x001",
    "0x10", "0X10", "0b1", "0o7", "1j", "1i", "true", "None", "1,5", "1'000", "1e5 ", " -1e-5 ", "-0", "-0.0",
    "+0", "0e0", "0e-0", "00", "007", "1e0000000005", "1e-0000000005", "1e00000000000000000000000000005",
    "123456789e-100", "1e-1000000", "1e1000000", "1e99999999999999999999", "0e99999999999999999999",
    "1.5E+3", "1.5e+3", "1.5e-3", "1.5E-3", "٫", "1٫5", "1．5", "1．", "１e５", "1E", "1e+_5",
    "+", "-", "e", "i", "in", "n", "na", "-i", "infin", "in f", "nan ", " nan", "nan\x1c", "\x85nan", "inf﻿",
    "1​", "​1", "1᠎", "⁠1", "1\xad",
]

INT_EDGE = [
    "", " ", "0", "-0", "+0", "12", " 12 ", "+12", "-12", "012", "0012", "0_1", "1_2", "1__2", "_1", "1_", "1.0",
    "1e3", "0x10", "0b1", "0o7", "١٢", "１２", "\U0001d7d9\U0001d7da", "-١٢", "²",
    "½", "Ⅻ", "1 2", "\x1c12", "12\x85", "﻿12", "12﻿", "\xa012", "12\n", "\n12", "12\r\n",
    "9" * 60, "-" + "9" * 60, "1" + "0" * 40, "1,000", "+-1", "--1", "1_000_000", "1_000_", "_1_000", "1e", "٠",
    "٠٠٧", "-٠", "+", "-", "١_٢", "1\x001", "12 ", " 12", "\t12\t", "12​", "​12",
]

FRAC_ALPHABET = NUM_ALPHABET + list("/////")

FRAC_EDGE = [
    "1/2", " 1 / 2 ", "1/ 2", "1 /2", "-1/2", "+1/2", "+1/-2", "1/+2", "1/0", "0/0", "-0/5", "1/2/3", "1/2.0",
    "1.5/2", "3/", "/3", ".5", "5.", ".", "1e3", "1E-3", "1.5e2", "1e", "1_0/2_0", "1__0", "_1", "1_", "1/2_",
    "1/_2", "1 e3", "1e 3", "1.e3", ".e3", "1.5.", "١/٢", "١/２", "1/２", "0x10", "inf", "nan",
    "-inf", "1/2\n", "\n1/2", "1/2 \n ", "1/2\x1c", "\x85 1/2", "\x1c1/2", "﻿1/2", "1/2﻿", "1﻿/2",
    "3/-4", "3/+4", "1e+2", "1e-0", "1e0", "00012", "1/0012", "0.000", "-0", "-0.0", "0.", "-.0", "1.", "1_.5",
    "1._5", "1.5_", "1e5_", "1e_5", "1_e5", "1/2e3", "1e3/2", "1.5e-3", "1.5E+3", "1.50", "0.125", "-0.125", "3/6",
    "6/3", "1e-4", "1e-5", "1e-6", "1e-9", "1e-99", "1e-999", "1e999", "1e-9999", "1e9999", "123456789e-10",
    "9" * 40 + "/" + "7" * 40, "1/" + "9" * 50, "1.5e", "1.5e+", "1.5e-", "e5", "1e+2.5", "1½", "½",
    "²/4", "1/²", "1\x0b/2", "1　/　2", "　1/2", " / ", "/", "1 / ", "1/2 3", "1 2/3", "2/3/",
    "1//2", "1/ /2", "-", "+", "+-", " ", "", "1 e 3", "1 .5", "1. 5", "١.٥", "١e١", "1E1",
    "1e١", "1٫5", "1．5", "1/2​", "​1/2", "1/2᠎", "1/2 ", " 1/2", "1/2\x1f",
]

HTML_ENTITY_NAMES = [
    "amp", "lt", "gt", "quot", "apos", "nbsp", "deg", "eacute", "AMP", "ndash", "mdash", "copy", "reg", "times",
    "not", "notin", "frac12", "frac14", "frac34", "frac13", "frac23", "frac15", "frac16", "frac18", "frac35",
    "hellip", "rsquo", "lsquo", "ldquo", "rdquo", "half", "sup2", "sup3", "micro", "middot", "bull", "trade",
    "euro", "pound", "cent", "yen", "sect", "para", "plusmn", "divide", "iexcl", "laquo", "raquo", "ccedil",
    "ntilde", "uuml", "Uuml", "szlig", "aelig", "AElig", "oslash", "thorn", "eth", "alpha", "beta", "Alpha",
    "acE", "acute", "ac", "notinva", "notindot", "angst", "Aacute", "aacute", "AA", "af", "Afr", "afr",
    "LT", "GT", "COPY", "REG", "QUOT", "fjlig", "ThickSpace", "zwj", "zwnj", "lrm", "rlm", "shy", "ensp", "emsp",
]
HTML_TRUNC = ["fra", "frac1", "frac", "am", "a", "n", "no", "notit", "notinvb", "ampx", "copy2", "lt2", "gtgt",
              "ltlt", "nbsp2", "degC", "degF", "timess", "notx"]
HTML_TOKENS = (
    ["&"] * 6 + ["#"] * 2 + ["x", "X", ";", ";"] + list("0123456789") + list("abcdefABCDEF") + list("ghijklmnop")
    + ["&" + n + ";" for n in HTML_ENTITY_NAMES] + ["&" + n for n in HTML_ENTITY_NAMES]
    + ["&" + n for n in HTML_TRUNC] + ["&" + n + ";" for n in HTML_TRUNC]
    + ["&#0;", "&#128;", "&#x80;", "&#x9F;", "&#159;", "&#xD800;", "&#xDFFF;", "&#1114112;", "&#x110000;", "&#11;",
       "&#xFDD0;", "&#x1FFFE;", "&#xFFFF;", "&#x1;", "&#13;", "&#x0d;", "&#160;", "&#65;", "&#x41;", "&#x41", "&#65",
       "&#x00000041;", "&#0000065;", "&#99999999999999999999;", "&#xFFFFFFFFFFFFFFFFFFFF;", "&#;", "&#x;", "&#xZ;",
       "&# 1;", "&#-1;", "&#+1;", "&#1.5;", "&#x1F34E;", "&#127822;", "&#x2028;", "&#173;", "&#x1F600", "&#38;",
       "&#x26;", "&#60;", "&#x3c;", "&#;;", "&#65;;", "&amp;;", "&amp;amp;", "&&amp;", "&;", "&&", "& amp;", "&\tamp;",
       "&\namp;", "&\x0camp;", "&<amp;", "&amp<", "&am p;", "&" + "a" * 31, "&" + "a" * 32, "&" + "a" * 33,
       "&" + "a" * 32 + ";", "&" + "a" * 33 + ";", "&" + "\U0001f34e" * 17 + ";", "&" + "\U0001f34e" * 16 + "amp;",
       "&" + "é" * 30 + "amp;", "&" + "\U0001f34e" * 30 + "amp;", "&" + "\U0001f34e" * 31 + "amp;",
       "&" + "\U0001f34e" * 32 + "amp;", "&" + "\U0001f34e" * 33 + "amp;", "&" + "\U0001f34e" * 32 + ";",
       "&frac12", "&frac12;", "&frac12x", "&frac1;", "&frac1", "&fra;", "&fracaaa", "&frac12;frac12", "&#189;",
       "&#xBD;", "&#x00bd;", "&#00189;", "&amp", "&ampamp;", "&AMP", "&AMP;", "&Amp;", "&aMp;", "&ampp", "&am",
       "&notin;x", "&notinx", "&notinxx;", "&notx;", "&notxx", "&copy2024", "&copyright", "&reg;istered", "&ltx",
       "&gt;lt;", "&#x1F34E", "&#x1f34e;", "&#X1F34E;", "&#X41;", "&#x41;x", "&#65x", "&#65;x", "&#065;", "&#0065;",
       "&#x0;", "&#x00;", "&#0", "&#00;", "&#x110000", "&#1114111;", "&#x10FFFF;", "&#x10FFFE;", "&#xFFFE;",
       "&#xE000;", "&#xF8FF;", "&#x7F;", "&#127;", "&#x9;", "&#9;", "&#10;", "&#x0A;", "&#32;", "&#x20;",
       "&#١;", "&#xＡ;", "&#١٢;", "&é;", "&½;", "&amp ;", "&nbsp "]
    + ["½", "é", "\U0001f34e", " ", "\t", "\n", "<", ">", '"', "'", "="]
)

TOKENIZE_ALPHABET = (
    list("abcdefghijklmnopqrstuvwxyz") * 2 + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + list("0123456789") * 2
    + list("()[]{},/:;?!*~") * 2 + list(".....") + list("-'\"&#$%+=@_^|\\`<>")
    + ["½", "¼", "¾", "×", "é", "ñ", "ü", "ß", "°", "—", "–",
       "…", "“", "”", "’", "‘", "·", "•", "€", "£", "中", "三",
       "ア", "\U0001f34e", "́", "‍", "​", "﻿", "­", "²", "٣", "Ⅻ",
       "ǅ", "İ", "ı"]
    + NEW_CPS
    + [" "] * 8 + ["\t", "\n", "\r", "\x0b", "\x0c", "\x1c", "\x1d", "\x1f", "\x85", "\xa0", " ", " ",
       " ", "　", " ", " ", " ", " ", " "]
    + ["and", "or", "and/or", "and/", "/or", "and /", "/ or", "e.g.", "U.S.", "1.5", "2.", "oz.", "..", "...", "a."]
)

TOKENIZE_EDGE = [
    "", " ", "\t\n", "2 cups (500 ml) milk", "1-2 mashed bananas: as ripe as possible", "1.5 kg bananas, mashed",
    "Freshly grated Parmesan cheese, for garnish.", "2 onions, finely chopped*", "2 cups beef and/or chicken stock",
    "beef and / or chicken", "beef and/ or chicken", "beef and //or chicken", "AND/OR", "and/or.", "and/or/and/or",
    "and/or/or", "and / or / and", "and/", "/or", "e.g.", "x.", "1.5.", "..", "...", "a.b.", "U.S.", ".", "a..", "x.\n",
    "abc.\n", "abc.\n\n", "abc.\r\n", "abc.\r", "1.", "½.", "é.", "١.", "_.", "a_.", "三.",
    "x².", "ǅ.", "á.", "a‍.", "a​.", "a﻿.", "a\xad.", ".⿼.", "a.⿼.",
    "a.\U0001cc00.", "a.Ɤ.", "a.\U0001fadc.", "a.\U00011db0.", "a.\U00016ea0.", "a.\U0001f600.", "a.é.",
    "a.1.", "a._.", "a.-.", "a. .", "(.)", "[.]", ",.", ".,", "a,b.", "a.,b", "a\x1cb", "a\x85b", "a﻿b",
    "a\xa0b", "a b", "a b", "a　b", "a\x1fb", "a\x0bb", "a\x0cb", "a᠎b", "a​b", "a⁠b",
    "a\xadb", "a\x00b", "a\x7fb", "ab", "a b", "a b", "a b", "a b", "a b",
    "(1) [2] {3}, 4/5: 6; 7? 8! 9* ~10", "1/2 cup", "1 / 2", "//", "(())", "a(b)c", "a/b/c", "and/or/", "/and/or",
    "andx/or", "and/orx", "and/ora", "*and/or*", "(and/or)", "and/or,", "and,/or", "And/Or", "and/OR", "1½ cups",
    "2½.", "10°C.", "$1.50.", "5%.", "a.b.c.", "..a", "a...", "....", "a.b..", "..b.", "\U0001f34e.",
    "\U0001f34e\U0001f34e.", "a.\U0001f34e.", "\U0001f34e.a.", "中.", "中文。", "アイ.",
    "ﬁ.", "ß.", "Æ.", "①.", "Ⅻ.", "㊀.", "\U0001d7d8.", "\U0001d7d8", "a.\U0001d7d8.",
    "a.①.", "a.Ⅻ.", "a.½.", "a.².", "a.٣.", "a.́.", "á.b́.",
    ".\x1c.", ".\x85.", ".﻿.", "﻿", "﻿﻿", "\x1c", "\x85", "\x1c\x85", "a.෇.", "a.Ᲊ.",
] + [f"a.{c}." for c in NEW_CPS] + [f"x{c}y" for c in NEW_CPS]

REPR_ALPHABET = (
    list("abcXYZ019 ") + ["'", '"', "\\", "\t", "\n", "\r", "\x00", "\x07", "\x1b", "\x7f", "\x80", "\x85", "\x9f",
    "\xa0", "\xad", "é", "ñ", "́", "​", "‍", " ", " ", "　", " ",
    " ", "\U0001f600", "\U0001f34e", "﻿", "", "", "￿", "￾", "�", "͸",
    "\U0010ffff", "\U000e0001", "\U000e007f", "\U000e0100", "퟿", "豈", "\U0001f1e6", "\U0001f3fb",
    "\U0001f9b0", "\U0001fac8", "\U000323af", "\U000323b0", "\U00031350", "\U000323b1", "\U0001d16a", "؀",
    "܏", "᠎", "᠏", "￹", "￻", "͏", "ᅟ", "ㅤ", "ﾠ", " ", " ",
    " ", "⁡", "⁤", "⁪", "؜", "‪", "‮", "⁦", "⁩", " ", " ",
    "⠀", "　", "෇", "Ᲊ", "ᲊ", "ꟑ", "\U00013460", "\U000143fa", "\U0001e5d0",
    "\U0002ebf0", "\U0002ee5d", "\U0001b300", "\U00011db0", "\U00016ea0", "\U0001ccf9", "\U0001cc00", "ꟍ",
    "Ɤ", "\U0001fa89", "\U0001fadc", "㇯", "⿿", "⿼"]
)

CAP_ALPHABET = (
    list("aBcDz 19") + ["ß", "ǆ", "ǅ", "Ǆ", "ǉ", "ǈ", "ǲ", "ﬁ", "ﬀ", "ﬃ",
    "İ", "ı", "Σ", "σ", "ς", "ŉ", "ΐ", "ΰ", "ᾀ", "ᾈ", "ᾳ",
    "ᾼ", "ῳ", "ᾴ", "ῗ", "ẞ", "é", "É", "́", "\U0001f600", "ǰ", "ẖ",
    "ẗ", "ẘ", "ẙ", "ẚ", "ⅰ", "Ⅰ", "ⓐ", "Ⓐ", "ա", "Ա", "և",
    "ﬓ", "ⓝ", "ꙋ", "Ꙋ", "ꞵ", "µ", "Μ", "μ", "ſ", "ﬆ", "ﬅ",
    "K", "Å", "Ω", "ϴ", "θ", "ϑ", "\U00010400", "\U00010428", "\U0001e900",
    "\U0001e922", "ꟈ", "Ꟈ", "Ᲊ", "ᲊ", "ꟑ", "Ɤ", "Ꟍ", "ꟍ", "ᲀ", "ꭰ",
    "Ꭰ", "\U00010570", "\U00010597", "\U0001df00", "ẛ", "ι", "ͅ", "ς", "ὐ", "ᾶ"]
)

PINT_CURATED = [
    "", " ", "cup", "cups", "Cup", "CUP", "cup ", " cup", "c", "C", "cc", "CC", "cL", "Cl", "cl", "CL", "G", "g", "gs",
    "Gs", "Tb", "Tbs", "Tbsp", "TBSP", "tbsp", "tbsps", "T", "t", "ts", "Ts", "tsp", "Tsp", "TSP", "tsps", "Pt", "pt",
    "PT", "pts", "Pts", "qt", "Qt", "QT", "qts", "fl", "Fl", "FL", "oz", "Oz", "OZ", "ozs", "Ozs", "floz", "Floz",
    "fl oz", "Fl oz", "FL OZ", "Fl Oz", "fl Oz", "FL oz", "fl OZ", "fl. oz", "fl.oz", "fl.oz.", "fl oz.", "floz.",
    "fluid oz", "fl ounce", "fluid ounce", "fluid ounces", "fl ounces", "Fluid Ounce", "fluid  oz", "fl  oz",
    "oz can", "cup c", "cup cup", "large can", "small bunch", "oz. can", "lb bag", "g pack", "ml bottle", "cup C",
    "ml", "mL", "Ml", "ML", "mls", "l", "L", "ls", "litre", "liter", "litres", "liters", "dl", "dL", "cm", "mm", "Mm",
    "MM", "m", "M", "km", "Km", "KM", "inch", "in", "In", "IN", "inches", "feet", "ft", "foot", "yard", "mile", "hour",
    "hr", "hrs", "min", "mins", "minute", "sec", "s", "S", "ss", "sss", "day", "days", "week", "°F", "°C",
    "°", "degF", "degC", "degrees", "degree", "deg", "K", "k", "u", "n", "p", "f", "a", "E", "P", "Y", "Z", "y",
    "z", "q", "Q", "R", "r", "d", "da", "h", "kg", "Kg", "KG", "kgs", "gm", "gms", "grams", "gram", "gramme",
    "grammes", "mg", "Mg", "MG", "mcg", "µg", "μg", "ug", "µl", "μl", "ul", "lb", "Lb", "LB",
    "lbs", "Lbs", "LBS", "pound", "pounds", "ounce", "ounces", "ouncess", "cupss", "teaspoon", "teaspoons",
    "tablespoon", "Tablespoon", "TABLESPOON", "tablespoons", "pinch", "Pinch", "PINCH", "pinches", "bar", "bars",
    "link", "links", "shake", "shakes", "tin", "tins", "unit", "units", "fat", "Fat", "kcup", "mcup", "dcup", "Mcup",
    "ncup", "cupcup", "pint", "Pint", "pints", "quart", "quarts", "gallon", "gal", "gallons", "shot", "shots", "each",
    "ea", "clove", "cloves", "piece", "pieces", "slice", "slices", "sprig", "sprigs", "head", "heads", "stalk",
    "stalks", "can", "cans", "jar", "jars", "packet", "package", "pkg", "pkt", "stick", "sticks", "dash", "dashes",
    "drop", "drops", "handful", "knob", "bottle", "glass", "cube", "cubes", "square", "squares", "block", "sheet",
    "sheets", "leaf", "leaves", "ear", "ears", "rack", "fillet", "carton", "box", "bag", "bunch", "bunches", "ball",
    "wedge", "envelope", "loaf", "loaves", "ring", "round", "slab", "strip", "rib", "ribs", "bit", "bits", "batch",
    "part", "parts", "portion", "scoop", "spray", "splash", "squeeze", "twist", "dollop", "smidgen", "pat", "fifth",
    "nip", "peck", "bushel", "gill", "dram", "grain", "scruple", "stone", "ton", "tonne", "carat", "point", "pt.",
    "oz.", "lb.", "tsp.", "c.", "T.", "g.", "kg.", "ml.", "l.", "cm.", "in.", "ft.", "Oz.", "1-2", "2 cups", "cup2",
    "3", "1", "0", "-", "+", "cup+", "cup*2", "cup/2", "(", ")", "cup)", "(cup)", "1/2", "cup^2", "cup**2",
    "cup squared", "square cup", "cubic cm", "sq in", "cup cubed", "%", "ppm", "percent", "cup.", "cup,", "cup;",
    "cup:", "cup!", "cup?", "cup's", "cups'", "cup-", "-cup", "cup_", "_cup", "cup/", "/cup", "cup*", "*cup", "cup**",
    "cup^", "cup=", "cup<", "cup>", "cup|", "cup&", "cup#", "cup@", "cup$", "cup~", "cup`", "cup\\", "cup'", 'cup"',
    "cup\t", "cup\n", "cup\xa0", "cúp", "café", "½", "½ cup", "1½", "²", "cup²",
    "cup³", "cup⁻¹", "cup·g", "cup•g", "cup×g", "cup÷g", "cup g", "g cup",
    "cup  g", "cup\tg", "pi", "e", "inf", "nan", "infinity", "None", "True", "dimensionless", "radian", "count",
    "item", "items", "dozen", "pair", "pairs", "gross", "score", "hundred", "thousand", "million", "billion",
    "‰", "cup per g", "cup/g", "g/cup", "per", "of", "the", "an", "and", "or", "and/or", "as", "is", "to", "x",
    "X", "xx", "i", "I", "ii", "V", "v", "Ø", "ø", "Å", "å", "Ω", "ohm", "Hz", "hz", "N", "J",
    "W", "A", "B", "D", "F", "H", "O", "U", "delta", "Delta", "µ", "μ", "mu", "mc", "deca", "deka", "hecto",
    "kilo", "mega", "giga", "milli", "centi", "deci", "micro", "nano", "pico", "yocto", "quecto", "kibi", "Ki", "Mi",
    "meter", "metre", "meters", "metres", "second", "seconds", "ampere", "candela", "mole", "mol", "kelvin",
    "Kelvin", "coulomb", "joule", "watt", "volt", "farad", "siemens", "weber", "tesla", "henry", "lumen", "lux",
    "becquerel", "gray", "sievert", "katal", "atm", "psi", "torr", "cal", "kcal", "Cal", "calorie", "calories",
    "Calorie", "Calories", "kcalorie", "btu", "BTU", "erg", "eV", "hp", "knot", "ct", "kt", "au", "AU", "ly", "pc",
    "b", "byte", "kB", "KB", "MB", "GB", "kib", "Kib", "pica", "px", "pixel", "dpi", "ppi", "rpm", "cps", "Bd",
    "baud", "cd", "lm", "lx", "molar", "ph", "pH", "pk", "fluidounce", "fluid_ounce", "imperial_cup", "metric_cup",
    "jp_cup", "aus_pint", "aus_tablespoon", "metric_tablespoon", "imperial_fluid_ounce", "imperial_gallon", "us_cup",
    "US_cup", "uscup", "fl oz", "fl oz", "fl　oz", "fl​oz", "cup​", "​cup", "cup﻿",
    "﻿cup", "Cups", "CUPS", "cUp", "TABLESPOONS", "Tablespoons", "Teaspoons", "TEASPOONS", "Ounces", "OUNCES",
    "Pounds", "POUNDS", "Grams", "GRAMS", "Kilograms", "Milliliters", "Liters", "Litres", "Pints", "Quarts",
    "Gallons", "Inches", "Cloves", "Pinches", "Tins", "Bars", "Links", "Shakes", "Units", "FAT", "fat.", "fats",
]


def gen_float(rng: random.Random, n: int) -> None:
    inputs = uniq(FLOAT_EDGE + [rand_string(rng, NUM_ALPHABET, 12) for _ in range(n)])
    cases = []
    for s in inputs:
        try:
            cases.append([s, bits(float(s))])
        except ValueError:
            cases.append([s, None])
    dump("float", cases)


def gen_int(rng: random.Random, n: int) -> None:
    alphabet = (list("0123456789") * 3 + list("_+-")
                + [" ", "\t", "\x1c", "\x85", "﻿", "\xa0", "　", "\n", "١", "２", "\U0001d7d8",
                   "²", "½", "e", ".", "x", "0x", "​"])
    inputs = uniq(INT_EDGE + [rand_string(rng, alphabet, 12) for _ in range(n)])
    cases = []
    for s in inputs:
        try:
            cases.append([s, str(int(s))])
        except ValueError:
            cases.append([s, None])
    dump("int", cases)


def gen_fraction_str(rng: random.Random, n: int) -> None:
    inputs = uniq(FRAC_EDGE + [rand_string(rng, FRAC_ALPHABET, 12) for _ in range(n)])
    cases = []
    for s in inputs:
        # keep 10**exp tractable on both sides
        t = "".join(str(unicodedata.decimal(c)) if unicodedata.category(c) == "Nd" else c for c in s)
        if any(len(run) > 4 for run in re.findall(r"[eE][-+]?(\d+)", t)):
            continue
        try:
            fr = Fraction(s)
            cases.append([s, [str(fr.numerator), str(fr.denominator), str(fr)]])
        except ValueError:
            cases.append([s, "ValueError"])
        except ZeroDivisionError:
            cases.append([s, "ZeroDivisionError"])
    dump("fraction_str", cases)


def random_double(rng: random.Random) -> float:
    while True:
        x = struct.unpack(">d", struct.pack(">Q", rng.getrandbits(64)))[0]
        if math.isfinite(x):
            return x


def gen_fraction_float(rng: random.Random, n: int) -> None:
    xs = [0.0, -0.0, 1.0, -1.0, 0.1, 0.5, 1.5, 2.5, 1e308, -1e308, 1.7976931348623157e308, 5e-324, -5e-324,
          2.2250738585072014e-308, 2.225073858507201e-308, 1e-320, 9007199254740992.0, 9007199254740993.0,
          4503599627370496.5, 0.30000000000000004, 1e22, 1e23, 123456789.123456789, 2.0 ** 1023, 2.0 ** -1022,
          2.0 ** -1074]
    for _ in range(n):
        r = rng.random()
        if r < 0.5:
            xs.append(random_double(rng))
        elif r < 0.65:  # subnormal
            xs.append(struct.unpack(">d", struct.pack(">Q", rng.getrandbits(52) | (rng.getrandbits(1) << 63)))[0])
        elif r < 0.8:
            xs.append(rng.uniform(-1e6, 1e6))
        elif r < 0.9:
            xs.append(rng.random())
        else:
            xs.append(float(rng.randint(-(2 ** 62), 2 ** 62)))
    cases = [[bits(x), str(Fraction(x).numerator), str(Fraction(x).denominator)] for x in xs]
    dump("fraction_float", cases)


def gen_fraction_tofloat(rng: random.Random, n: int) -> None:
    pairs: list[tuple[int, int]] = [
        (1, 3), (2, 3), (1, 10), (-1, 10), (0, 7), (2 ** 53 + 1, 1), (2 ** 53 + 3, 1), (2 ** 54 + 2, 2),
        (2 ** 60 + 2 ** 7, 1), (2 ** 60 + 2 ** 7 + 1, 1), (2 ** 60 + 3 * 2 ** 7, 1), (2 * 2 ** 53 + 1, 2),
        (2 ** 1023, 1), (2 ** 1024 - 2 ** 970, 1), (2 ** 1024 - 2 ** 971, 1), (2 ** 1024, 1), (-(2 ** 1024), 1),
        (2 ** 1030, 3), (2 ** 900, 1), (2 ** 896, 1), (2 ** 896 + 1, 1), (2 ** 897, 3), (3 ** 600, 1), (3 ** 600, 7),
        (1, 2 ** 1022), (1, 2 ** 1023), (1, 2 ** 1074), (1, 2 ** 1075), (3, 2 ** 1075), (1, 2 ** 1076), (1, 2 ** 1100),
        (3 ** 100, 2 ** 1200), (-(3 ** 100), 2 ** 1200), (2 ** 100 + 1, 2 ** 1150), (1, 3 ** 700), (1, 10 ** 320),
        (1, 10 ** 400), (10 ** 400, 1), (10 ** 308, 1), (10 ** 309, 1), (10 ** 200 + 1, 10 ** 200), (1, 3 * 2 ** 1073),
        (5, 2 ** 1076), (7, 2 ** 1077), (2 ** 1074 + 1, 2 ** 2148), (2 ** 53, 2 ** 1075), (2 ** 53 + 1, 2 ** 1075),
        (2 ** 53 + 2, 2 ** 1075), (2 ** 52 * 3, 2 ** 1076), (1, 2 ** 1080), (2 ** 60 + 1, 2 ** 1080),
        (2 ** 53 + 1, 2 ** 1024), (2 ** 54 + 1, 2 ** 1025), (2 ** 200 + 1, 2 ** 1171), (2 ** 200 + 2 ** 147, 2 ** 1200),
    ]
    for _ in range(n):
        r = rng.random()
        if r < 0.6:
            a = rng.getrandbits(rng.randint(1, 200))
            b = rng.getrandbits(rng.randint(1, 200)) or 1
        elif r < 0.7:  # big values near/over the double range
            a = rng.getrandbits(rng.randint(900, 1100))
            b = rng.getrandbits(rng.randint(1, 120)) or 1
        elif r < 0.8:  # subnormal / underflow results
            a = rng.getrandbits(rng.randint(1, 80))
            b = rng.getrandbits(rng.randint(1040, 1160)) or 1
        elif r < 0.9:  # near halfway between doubles: (2^53 k + 1/2) scaled
            k = rng.getrandbits(rng.randint(1, 60)) | 1
            a = 2 * k * 2 ** 53 + (1 if rng.random() < 0.7 else 3) * 2 ** rng.randint(0, 3)
            b = 2 ** rng.randint(1, 90)
        else:
            a = rng.getrandbits(rng.randint(54, 120))
            b = rng.getrandbits(rng.randint(54, 120)) or 1
        if rng.random() < 0.4:
            a = -a
        pairs.append((a, b))
    cases = []
    for a, b in pairs:
        fr = Fraction(a, b)
        try:
            cases.append([str(fr.numerator), str(fr.denominator), bits(float(fr))])
        except OverflowError:
            cases.append([str(fr.numerator), str(fr.denominator), "OverflowError"])
    dump("fraction_tofloat", cases)


def gen_round(rng: random.Random, n: int) -> None:
    xs = [0.0, -0.0, 0.5, 1.5, 2.5, 0.0000005, 0.0000015, 0.0000025, 5e-7, 1.5e-6, 2.5e-6, 4.5e-7, 0.1234565,
          0.1234575, 1e-7, 9.9999995e-7, 0.9999995, 0.99999949999, 1e15 + 0.5, 1e16, 1e22, 1e300, -1e300, 5e-324,
          2.0 ** 53 + 0.5, 4503599627370496.5, 123456.7890125, 0.3, 0.7, 1.005, 2.675, 1.0000005, 100.0000005,
          -0.0000005, -0.0000015, -2.5e-7, 1e-323, -5e-324, 2.2250738585072014e-308]
    xs += [k / 128 for k in range(-40, 41)] + [k / 64 for k in range(1, 20)] + [k / 1024 for k in range(1, 30, 3)]
    for _ in range(n):
        r = rng.random()
        if r < 0.3:
            xs.append(rng.random())
        elif r < 0.45:
            xs.append(rng.uniform(0, 1e6))
        elif r < 0.55:
            xs.append(10 ** rng.uniform(-12, -3))
        elif r < 0.65:
            xs.append(-rng.random() * 10 ** rng.randint(-8, 6))
        elif r < 0.8:  # decimal strings with 7 fraction digits ending in 5 (halfway-looking)
            xs.append(float(f"{rng.randint(0, 999)}.{rng.randint(0, 999999):06d}5"))
        elif r < 0.9:  # exact dyadic halves at the 6th decimal: odd / 2^7 scaled by powers of ten
            xs.append((2 * rng.randint(0, 100000) + 1) / 128 / 10 ** rng.randint(0, 4))
        else:
            xs.append(random_double(rng))
    cases = [[bits(x), bits(round(x, 6))] for x in xs]
    dump("round", cases)


def gen_mean(rng: random.Random, n: int) -> None:
    lists: list[list[float]] = [
        [0.5], [0.1, 0.2], [0.1, 0.2, 0.3], [1e16, 1.0, -1e16], [1e308, 1e308], [1e308, -1e308, 1.0], [0.1] * 10,
        [1 / 3] * 3, [5e-324] * 3, [1.0, 2.0 ** 53], [2.0 ** 53, 1.0, 1.0], [-0.0], [-0.0, 0.0], [1e-320] * 3,
        [1e300] * 4, [float("inf"), 1.0], [float("nan")], [1.0, float("inf"), float("-inf")], [1.0, float("nan"), 2.0],
        [1e308, 1e308, 1e308, -1e308], [5e-324, 0.0], [5e-324, 5e-324], [5e-324, 1e-323, 0.0], [2.0 ** 1023, 2.0 ** 1023],
    ]
    for _ in range(n):
        ln = rng.randint(1, 60)
        r = rng.random()
        if r < 0.5:  # confidence-like values (the real use)
            lists.append([round(rng.random(), rng.randint(2, 6)) if rng.random() < 0.5 else rng.random() for _ in range(ln)])
        elif r < 0.8:
            lists.append([rng.choice([-1, 1]) * rng.random() * 10 ** rng.randint(-8, 8) for _ in range(ln)])
        elif r < 0.9:
            lists.append([float(rng.randint(-(2 ** 60), 2 ** 60)) for _ in range(ln)])
        else:
            lists.append([random_double(rng) for _ in range(ln)])
    cases = []
    for xs in lists:
        try:
            cases.append([[bits(x) for x in xs], bits(statistics.mean(xs))])
        except Exception as e:  # noqa: BLE001
            cases.append([[bits(x) for x in xs], "raise:" + type(e).__name__])
    dump("mean", cases)


def gen_floatfmt(rng: random.Random, n: int) -> None:
    xs = [0.0, -0.0, 1.0, -1.0, 0.5, 1.5, 2.5, 2.5e-5, 0.1, 0.25, 100.0, 1e5, 1e6, 1e7, 123456.0, 1234567.0, 12345678.0,
          999999.0, 9999995.0, 999999.5, 9999994.999, 1234565.0, 1000005.0, 2345675.0, 12345650.0, 1234575.0,
          1000015.0, 123456.5, 12345.65, 1.234565, 0.0001, 0.00001, 0.000123456, 0.0001234565, 1e-4, 9.99999e-5,
          9.999995e-5, 0.00009999995, 1e15, 1e16, 1e17, 1e21, 1e22, 1e23, 1e-5, 1e-7, 5e-324, 2.2250738585072014e-308,
          1.7976931348623157e308, 123456789.0, 0.30000000000000004, 1 / 3, 2 / 3, 1e100, 1e-100, 3.14159265358979,
          2.718281828459045, 1234567890123456789.0, 0.000001, 0.0000001, 100000.0, 999999.4, 999999.6, 1e-30, 1e30,
          float("inf"), float("-inf"), float("nan"), 65535.0, 65536.0, 1048576.0, 4.5, 5.5, 6.5, 7.5, 0.5e-6, 1.5e-6,
          2.5e-6, 3.5e-6, 4.5e-6, 5e-5, 1.5e-5, 2.5e-5, 3.5e-5, 9999995e-3, 99999.95, 9999.995, 999.9995,
          99.99995, 9.999995, 0.9999995, 0.09999995, 1.0000005, 10.000005, 100.00005, 1000.0005, 10000.005, 100000.05,
          1000000.5, 10000005.0, 100000050.0, 1e6 + 0.5, 1e6 - 0.5, 15.0, 125.0, 1250.0, 12500.0, 125000.0, 1250000.0,
          999999.5, 9999995.0, 99999950.0, 999999500.0, 0.09999995, 999999.25, 999999.75, 1234562.5, 1234567.5]
    xs += [float(k) for k in [1234565, 1234575, 1234585, 1234595, 2345655, 3456765, 9999995, 1000005, 1000015,
                              1000025, 1000035, 5000005, 5000015, 10000050, 12345650, 12345750, 100000500, 100001500,
                              1234565000, 1000005000]]
    xs += [k / 2 for k in range(1, 40)] + [k / 4 for k in range(1, 40)] + [k / 8 for k in range(1, 40)]
    xs += [k / 1024 for k in range(1, 40)] + [k / 16 * 1e6 for k in range(1, 40)] + [k / 32 * 1e6 for k in range(1, 64)]
    for _ in range(n):
        r = rng.random()
        if r < 0.35:
            xs.append(rng.choice([-1, 1]) * 10 ** rng.uniform(-30, 30))
        elif r < 0.5:
            xs.append(float(rng.randint(-(10 ** rng.randint(1, 12)), 10 ** rng.randint(1, 12))))
        elif r < 0.6:  # exactly 6 significant digits
            xs.append(float(f"{rng.randint(100000, 999999)}e{rng.randint(-12, 12)}"))
        elif r < 0.7:  # exactly 7 significant digits, often ending in 5
            last = 5 if rng.random() < 0.6 else rng.randint(0, 9)
            xs.append(float(f"{rng.randint(100000, 999999)}{last}e{rng.randint(-12, 12)}"))
        elif r < 0.8:  # integers with 7-9 digits ending in 5 (exact ties for %g)
            xs.append(float(rng.randint(100000, 99999999) * 10 + 5))
        elif r < 0.9:
            xs.append(random_double(rng))
        else:
            xs.append(rng.random() * 10 ** rng.randint(-8, 8))
    cases = [[bits(x), repr(x), "%g" % x] for x in xs]
    dump("floatfmt", cases)


def gen_html(rng: random.Random, n: int) -> None:
    inputs = uniq([t for t in HTML_TOKENS if "&" in t] + [rand_string(rng, HTML_TOKENS, 6, 1) for _ in range(n)])
    cases = [[s, html.unescape(s)] for s in inputs]
    dump("html", cases)


def gen_reprstr(rng: random.Random, n: int) -> None:
    inputs = ["", "'", '"', "'\"", "\"'", "\\", "'\\'", "a'b", 'a"b', "a'b\"c", "\t\n\r", "\x00", "\x7f", "\x80\x9f",
              "\xa0", "　", " ", " ", "\x85", "\x0b", "\x0c", "\x1c"]
    inputs += [rand_string(rng, REPR_ALPHABET, 10) for _ in range(n)]
    # random code points from every plane (no surrogates) for category coverage
    for _ in range(n // 2):
        cps = []
        for _ in range(rng.randint(1, 4)):
            r = rng.random()
            if r < 0.5:
                cp = rng.randint(0, 0xFFFF)
            elif r < 0.8:
                cp = rng.randint(0x10000, 0x3FFFF)
            else:
                cp = rng.randint(0x40000, 0x10FFFF)
            if 0xD800 <= cp <= 0xDFFF:
                cp = 0x41
            cps.append(chr(cp))
        inputs.append("".join(cps))
    # every code point Python considers unprintable in the BMP+SMP that Node might print (and vice versa)
    # is too many to ship; sample every 97th code point instead for a deterministic sweep.
    inputs += [chr(cp) for cp in range(0, 0x30000, 97) if not 0xD800 <= cp <= 0xDFFF]
    cases = [[s, repr(s)] for s in uniq(inputs)]
    dump("reprstr", cases)


def gen_capstrip(rng: random.Random, n: int) -> None:
    inputs = ["", "a", "A", "ab", "aB", "AB", "hello world", "ß", "ßa", "aß", "ǆ", "ǅ",
              "Ǆ", "ǆa", "ﬁ", "ﬁsh", "İ", "İa", "ı", "ıa", "ΣΑΣ",
              "σας", "Σ", "ς", "ŉ", "ΐ", "aΣ", "aΣb", "ΑΣ ",
              "é", "É", "ée", "́a", "á", "\U0001f600a", "a\U0001f600", "1a", " a", "a ",
              "\t a b ", "µ", "Μ", "ϴ", "K", "Å", "ﬆ", "ᾈ", "ᾀ", "ᾳ",
              "ᾼ", "ẞ", "ẞa", "\U00010428", "\U00010400a", "\U0001e922", "ꟈ", "ᲊ", "ꟑ",
              "Ɤ", "ꟍ", "ᲀ", "\U00010597", "\U0001df00", "\U00010570a", "ǈ", "ǉ", "ǲ",
              "ǳ", "Ǳ", "ͅ", "ͅa", "ι", "ẛ", "ſ", "ſa", "ŉa", "և",
              "ևa", "ﬓ", "ﬀ", "ﬃa"]
    inputs += [rand_string(rng, CAP_ALPHABET, 8) for _ in range(n)]
    strip_alpha = PY_SPACES + NOT_SPACES_LOOKALIKE + list("ab1") * 4
    inputs += [rand_string(rng, strip_alpha, 8) for _ in range(n)]
    inputs += [c + "a" + c + "b" + c for c in PY_SPACES + NOT_SPACES_LOOKALIKE] + PY_SPACES + [c + c for c in PY_SPACES]
    cases = [[s, s.capitalize(), s.strip()] for s in uniq(inputs)]
    dump("capstrip", cases)


def pint_result(fn):
    try:
        r = fn()
        if isinstance(r, str):
            return {"k": "str", "v": r}
        return {"k": "unit", "v": str(r), "r": repr(r)}
    except Exception as e:  # noqa: BLE001
        return {"k": "raise", "v": type(e).__name__, "m": str(e)[:80]}


# Hand-picked unit strings: every unit-string case from docs/VERIFICATION.md §7 (pint front end), pint's word forms, pretty
# exponents, stray punctuation, Python-tokenizer edge cases (strings, f-strings, numbers, brackets,
# newlines/indentation, coding cookies), and the registry preprocessors.
PINT_EDGE = [
    "µg", "μg", "µl", "°F", "°", "%", "‰", "Å", "Ω", "cup²", "cup squared", "square cup", "sq in", "cubic cm",
    "cup cubed", "°C", "éteaspoon", "\u200bcup", "cup\u200b", "\ufeffcup", "cup\ufeff", "\ufeff", "cup's", "cups'",
    '"1 c', "oz'", "cup+", "cup/", "cup*", "/cup", "*cup", "(", "cup)", "cup\\", "²", "nan", "+", ".", "/", "1oz",
    "2cups", "oz oz", "oz  g", "oz.", ".oz", "oz!", "oz;", "g,", "(oz)", "{oz}", "oz#", "oz$", "oz~", "oz|", "oz=",
    "oz<", "oz>", "", " ", "  ", "oz\n", "oz\t", "oz\r", "cup ml", "1", "1.5", "0", "0.5cup", "cup**2", "cup^2",
    "cup**-1", "cup**(2)", "-cup", "cup-", "oz per g", "inf", "infinity", "NaN", "dimensionless", "1e3", "1e3g",
    "2e", "0x1", "1_000", "1j", "oz:", "oz?", "oz@", "oz`", "oz[", "oz]", "[oz]", "oz²³", "oz⁻¹", "oz·g", "oz×g",
    "10oz", "cup 2", "cup ** 2 ** 3", "((oz))", "oz//g", "oz%g", "oz % g", "°cup", "degree", "1cup", "cup1",
    "cup_1", "_cup", "__cup", "cup__", "_1", "_", "oz    g", "oz\u3000g", "oz\xa0g", "ª", "º", "ℓ", "ﬁ", "oz’",
    "oz‘", "“oz”", "oz…", "oz–g", "oz—g", "a b c", "a*b/c**2", "1/2", "1/oz", "oz/2", "2/oz", "oz**0", "oz**0.5",
    "oz**2.0", "oz**1", "oz**(1/2)", "not", "cup**", "cup**cup", "2**cup", "(cup", "cup(", "()", "cup()", "oz -",
    "oz +", "oz *", "oz **", "**oz", "oz 2", "oz 2 g", "2 oz", "oz 1", "1 1", "cup)(", "oz\\\ng", "oz\\g", "#oz",
    "oz # g", "'", '"', "'" * 3, '"' * 3, "oz\x00", "oz\x0c", "\x0coz", "oz\x0b", "oz \x0c g", "\tcup", "\ncup",
    "cup\n\n", "cup\n g", "cup\n\tg", "  cup  ", "cup\x85g", "cup\u2028g", "1.", ".5", "1.5.5", "1..", "1e",
    "1e+", "1e+3", "1_", "1__0", "01", "00", "0b1", "0o7", "1.5e", "1E3", "١", "١cup", "cup١", "x²", "²x", "cup⁻²",
    "cup²⁻", "cup⁻", "cup⁽", "cup·", "·", "⁻", "cup².⁵", "cup².", "cup².⁵⁵", "cup ^ 2", "cup^", "^", "cup^^2",
    "cup^2^2", "cup ² ", "cup squaredx", "xcup squared", "cup squared squared", "cup  squared", "sq  in", "sqin",
    "cubic", "square", "sq", "squared", "cubed", "cup cubed cubed", "cubic cubic cm", "1 squared", "1sq in", "sq 2",
    "cubic 2", "cup sq in", "degree_Celsius", "degC", "°c", "°f", "°K", "°R", "Δ°C", "delta_degC", "degC*2",
    "degC**2", "degC degC", "degC/g", "oz degC", "%%", "% %", "oz%", "%oz", "‰oz", "oz‰", "‰‰", "×", "oz×", "×oz",
    "oz per", "per oz", "oz per per g", "per", " per ", "oz  per  g", "oz per  g", "oz,g", "oz, g", ",", ",,",
    "o,z", "cups,", "µ", "μ", "µµg", "mµg", "µs", "µm", "u", "ug", "uL", "mcg", "mcl", "mu", "mug", "kcup", "Mcup",
    "semicup", "demicup", "sesquicup", "kibicup", "Kicup", "cupss", "s", "ss", "ozs", "ozes", "cs", "ms", "as",
    "is", "us", "Ts", "Tss", "l", "L", "ls", "c", "C", "t", "T", "fl oz", "fl. oz", "fl.oz", "fl.oz.", "floz",
    "fluid ounce", "fluid_ounce", "fluid-ounce", "fluid ounces", "oz fl", "in", "cal", "kcal", "Cal", "J", "kJ",
    "W", "V", "A", "ohm", "F", "N", "Pa", "bar", "psi", "K", "cd", "dB", "dBm", "dB+dB", "dBm + dBm", "dB + dBm",
    "dBm - dBW", "dB dB", "dB*2", "dB**2", "dB/g", "oz+oz", "oz+g", "oz-oz", "oz - g", "1+1", "1-1", "oz+1",
    "1+oz", "0+oz", "oz+0", "oz*0", "0*oz", "1/(0*oz)", "(0*oz)**-1", "oz**-0", "oz**1e300", "oz**1234567",
    "oz**1234567.0", "oz**-1e-7", "oz**2.5e6", "(-1)**0.5", "((-1)**0.5)*oz", "oz**((-1)**0.5)", "(-oz)**0.5",
    "10**400", "10.0**400", "2**-1", "2**1000", "oz**1000", "oz**nan", "nan*oz", "nan/nan", "oz nan", "oz**inf",
    "inf oz", "oz/inf", "percent", "percent**2", "oz**percent", "oz**(percent)", "2**percent", "oz//percent",
    "percent//2", "2//percent", "oz//2", "2//oz", "oz//oz", "oz//g", "5//2", "5.0//2", "-oz", "--oz", "+oz",
    "-1", "-1.0", "+1", "-(oz)", "-oz**2", "(-oz)**2", "(-oz)**3", "oz**-2", "1/oz**2", "oz/oz", "oz/ounce",
    "oz ounce", "oz*oz/oz", "g/mL", "g/cm³", "kg/m³", "kg/m^3", "lb bag", "bag lb", "1/(lb bag)", "m/s/kg",
    "m**2 kg", "kg m**-2", "1/m", "m**0.5/s", 'f"{oz}"', "f'oz'", 'f"', 'f"{"', 'f"}"', 'f"{oz!r}"',
    'f"{oz:>{g}}"', 'rf"{oz}"', "bf'x'", 'f"{{oz}}"', 'f"{oz"', 'f"{\'oz\'}"', 'f"{"oz"}"', 'f"{oz}g"',
    "f'{oz}'g", 'f"{}"', 'f"{oz=}"', 'f"{oz:}"', 'f"{oz}}"', 'f"{{oz}"', "f'''{oz}'''", 'f"{oz\n}"', 'f"{#}"',
    'f"{(oz)}"', 'f"{oz:{g}}"', 'f"{oz:{g:{h}}}"', 'f"{oz:{g:{h:{i}}}}"', "f'{a)}'", "f'{(a}'", "f'\\N{a}'",
    "f'{a:\\'}'", "'oz'", '"oz"', "'''oz'''", "'oz\\'", "b'oz'", "u'oz'", "r'oz'", "br'oz'", "ub'oz'", "'a''b'",
    "'''a'''b", "0x", "0xg", "0x_1", "0b2", "0o8", "0_", "1e_1", "1e1_", "1.e5", "1..5", "1.5j", "1jj", "1e5e5",
    "0e", "0j", "1_j", "1 .5", "0x1p3", "cup\n  g\n h", "cup\n\tg\n        h", "  cup\n g", " cup\n\tg",
    "(cup\n g)", "cup\\\n g", "\\\ncup", "\\ cup", "cup\\", "cup #g\ng", "cup\r\ng", "cup\rg", "cup\r",
    "\rcup", "cup\r5", "cup\r'x'", "cup\r(", "\r\r\n", "a\r\n\rb", "\r", "a \r b", "(\r)", "a\\\rb",
    "\x0c cup\n g", "cup\n\x0c g", "(]", "([)]", "(\n)", "))", ")(", "(" * 200, "(" * 199 + ")" * 199,
    "**=", "...", "..", "//=", "->", ":=", "<>", "!=", "!", "oz...", "a....b", "# coding: xyz\ncup",
    "#coding=latin-1\ncup é", "\n# coding: xyz\ncup", "cup\n# coding: xyz\n", "#coding:utf-8\ncup",
    "# coding: ascii\ncup é", "# coding: cp1252\ncup", "# coding: cp1252\ncup é", "# coding: utf-16\ncup",
    "\ufeff# coding: latin-1\ncup", "\ufeff# coding: utf-8\ncup", "# coding: xyz", "#coding: xy-z.9_",
    "# coding: u8\ncup", "# coding: latin1\ncup é", "# coding: base64\ncup", "# coding: rot13\ncup",
    "# coding: idna\ncup", "é\n# coding: xyz\ncup", "oz\ud800", "async", "await", "lambda", "oz€", "🍅", "oz½",
    "½oz", "oz\x01", "oz\x7f", "\x1coz", "oz\xad", "\u200b", "\ufeff\ufeffcup", " \ufeffcup", "1/🍅3", "°500g",
    "cup\ufeff\r", "cup\n\n\ng", "\n\ncup", "cup\n g\n\n h", "cup\n#x\n g", "cup\n  g\n    h\n  i\nj",
    "cup\n\t g\n \th", "  \tcup", "\t  cup", "'a\rb'", "'a\r\nb'", "'a\\\r\nb'", 'f"{a\r}"', 'f"a\rb"',
    "cup\n\r", "cup\x0c\ng",
]

NONASCII_LETTERS = ["é", "ñ", "ü", "ß", "µ", "μ", "Ω", "Å", "ℓ", "ª", "º", "ﬁ", "Δ", "π", "中", "ア", "٣", "١", "½", "²",
                    "³", "⁻", "⁰", "¹", "⁵", "·", "×", "°", "‰", "€", "’", "“", "”", "—", "–", "…", "\u200b", "\ufeff",
                    "\xa0", "\u3000", "\xad", "\x85", "\u2028", "🍅", "\U0001f34e", "́", "‍"]
PUNCT = list("+-*/()[]{}^.,;:!?'\"#$%&@`~|<>=\\_") + ["**", "//", "..."]
WORDS = ["oz", "g", "cup", "cups", "ml", "tsp", "tbsp", "lb", "kg", "l", "in", "ft", "°C", "°F", "degC", "percent",
         "squared", "cubed", "cubic", "square", "sq", "per", "nan", "inf", "dimensionless", "delta_degC", "dB", "dBm",
         "f", "r", "b", "u", "rf", "fr", "e", "j", "x", "o", "s", "a", "c", "T", "1", "2", "0", "10", "1.5", "0.5",
         "1e3", "1_0", "01", "00", "1j", ".5", "1."]
SPACES = [" ", "  ", "\t", "\n", "\r\n", "\r", "\x0c", "\xa0", "\u3000"]


def rand_unit_string(rng: random.Random) -> str:
    parts: list[str] = []
    for _ in range(rng.randint(1, 5)):
        r = rng.random()
        if r < 0.45:
            parts.append(rng.choice(WORDS))
        elif r < 0.65:
            parts.append(rng.choice(PUNCT))
        elif r < 0.8:
            parts.append(rng.choice(NONASCII_LETTERS))
        elif r < 0.9:
            parts.append(rng.choice(SPACES))
        else:
            parts.append(rng.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"))
    return "".join(parts)


def gen_pint(rng: random.Random, n: int) -> None:
    words = list(UNITS.keys()) + list(UNITS.values()) + PINT_CURATED
    letters = "abcdefghijklmnopqrstuvwxyz"
    for _ in range(n):
        w = "".join(rng.choice(letters) for _ in range(rng.randint(1, 8)))
        r = rng.random()
        if r < 0.15:
            w = w.upper()
        elif r < 0.35:
            w = w.capitalize()
        elif r < 0.45:
            w = "".join(c.upper() if rng.random() < 0.5 else c for c in w)
        if rng.random() < 0.3:
            w += "s"
        words.append(w)
    # single letters and prefix+unit two-letter combos (where pint gets creative)
    words += list(letters) + [c.upper() for c in letters]
    words += [a + b for a in letters for b in "glmsTtCcz"] + [a.upper() + b for a in letters for b in "glmsTtCc"]
    # real UNIT tokens from the held-out feature dump, when present
    feats = ROOT / "features-test.jsonl"
    unit_tokens: set[str] = set()
    if feats.exists():
        with feats.open(encoding="utf-8") as f:
            next(f)
            for line in f:
                d = json.loads(line)
                toks = tokenize(d["sentence"])
                for key in ("truth", "labels"):
                    labs = d.get(key) or []
                    if len(labs) == len(toks):
                        unit_tokens.update(t for t, lab in zip(toks, labs) if lab == "UNIT")
    words += sorted(unit_tokens)
    words += PINT_EDGE
    words += [rand_unit_string(rng) for _ in range(n * 4)]
    words = uniq(words)
    cases = []
    for w in words:
        c: dict[str, object] = {
            "u": w,
            "conv": pint_result(lambda: convert_to_pint_unit(w)),
            "imp": pint_result(lambda: convert_to_pint_unit(w, "imperial")),
            "units": pint_result(lambda: UREG(w).units),
        }
        try:
            c["has"] = w in UREG
        except Exception as e:  # noqa: BLE001
            c["has"] = "raise:" + type(e).__name__
        cases.append(c)
    print(f"  pint words: {len(words)} (UNIT tokens from features-test.jsonl: {len(unit_tokens)})")
    dump("pint", cases)


def py_tokenize_result(text: str) -> dict[str, object]:
    try:
        toks = [[pytokenize.tok_name[t.type], t.string]
                for t in pytokenize.tokenize(io.BytesIO(text.encode("utf-8")).readline) if t.type != pytokenize.ENCODING]
        return {"toks": toks}
    except Exception as e:  # noqa: BLE001
        return {"raise": type(e).__name__, "m": str(e)[:100]}


def gen_pytokenize(rng: random.Random, n: int) -> None:
    """CPython `tokenize.tokenize` (the tokenizer pint drives) over the pint inputs plus dense random fuzz."""
    inputs = list(PINT_EDGE) + [rand_unit_string(rng) for _ in range(n)]
    tok_alpha = (list("abfruxoeFRBU0123456789_") + list("'\"") * 4 + list("{}") * 3 + list("()[]:!=.#\\+-*/,;^%<>@~|$?`")
                 + [" ", "\t", "\n", "\r", "\r\n", "\x0c", "\x0b", "\x00", "\x01", "é", "​", "﻿", "🍅", "²", "°", "N", "j", "e"])
    inputs += [rand_string(rng, tok_alpha, 12, 1) for _ in range(n * 3)]
    cases = [{"s": x, **py_tokenize_result(x)} for x in uniq(inputs)]
    dump("pytokenize", cases)


def gen_pypreprocess(rng: random.Random, n: int) -> None:
    """pint's registry preprocessors + `pint.util.string_preprocessor`."""
    def pre(x: str) -> str:
        for p in UREG.preprocessors:
            x = p(x)
        return string_preprocessor(x)
    inputs = list(PINT_EDGE) + [rand_unit_string(rng) for _ in range(n)]
    cases = [[x, pre(x)] for x in uniq(inputs)]
    dump("pypreprocess", cases)


def gen_tokenize(rng: random.Random, n: int) -> None:
    inputs = list(TOKENIZE_EDGE)
    word_alpha = list("abcdefghijklmnopqrstuvwxyz0123456789") + ["and", "or", "½", "é", "."]
    seps = [" ", "  ", ", ", "/", ".", ". ", " / ", "(", ")", "-", "\t", "\n", ";", ":", "!", "?", "*", "~", "\xa0",
            " ", "\x1c", "\x85", "﻿", "and/or", " and/or ", " and / or ", ".\n", "\n.", " . "]
    for _ in range(n):
        r = rng.random()
        if r < 0.7:
            inputs.append(rand_string(rng, TOKENIZE_ALPHABET, 16))
        else:  # word-ish: random words joined by random separators
            parts = []
            for _ in range(rng.randint(1, 5)):
                parts.append(rand_string(rng, word_alpha, 5, 1))
                parts.append(rng.choice(seps))
            inputs.append("".join(parts))
    cases = [[s, tokenize(s)] for s in uniq(inputs)]
    dump("tokenize", cases)


def main() -> None:
    # Sample sizes are tuned to keep the goldens under ~2 MB in total.
    gen_float(random.Random(1), 8000)
    gen_int(random.Random(2), 3500)
    gen_fraction_str(random.Random(3), 6000)
    gen_fraction_float(random.Random(4), 900)
    gen_fraction_tofloat(random.Random(5), 900)
    gen_round(random.Random(6), 3000)
    gen_mean(random.Random(7), 250)
    gen_floatfmt(random.Random(8), 3000)
    gen_html(random.Random(9), 4000)
    gen_reprstr(random.Random(10), 1400)
    gen_capstrip(random.Random(11), 900)
    gen_pint(random.Random(12), 1200)
    gen_tokenize(random.Random(13), 6000)
    gen_pytokenize(random.Random(14), 3000)
    gen_pypreprocess(random.Random(15), 3000)
    total = sum(p.stat().st_size for p in OUT.glob("*.json"))
    print(f"total {total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
