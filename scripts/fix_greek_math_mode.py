#!/usr/bin/env python3
"""
Fix bare Greek mathematical symbols in pandoc-compiled .md files.
Wraps any Greek letter used in a mathematical context in $...$ so XeLaTeX
renders it via its math font instead of falling back on the body font (DejaVu
Serif), which lacks most Greek glyphs.
"""

import re
import sys
from pathlib import Path

# Map bare Unicode Greek -> LaTeX command (double backslash = literal backslash)
GREEK_MAP = {
    '\u03bb': '\\lambda',
    '\u03c6': '\\varphi',
    '\u03c4': '\\tau',
    '\u03b2': '\\beta',
    '\u03b1': '\\alpha',
    '\u03b5': '\\varepsilon',
    '\u0394': '\\Delta',
    '\u03c1': '\\rho',
    '\u03bc': '\\mu',
    '\u03c3': '\\sigma',
    '\u03b8': '\\theta',
    '\u03c0': '\\pi',
    '\u03b7': '\\eta',
    '\u03b3': '\\gamma',
    '\u03c9': '\\omega',
    '\u03c7': '\\chi',
    '\u03c8': '\\psi',
    '\u03be': '\\xi',
    '\u03ba': '\\kappa',
    '\u03bd': '\\nu',
    '\u03b6': '\\zeta',
    '\u03b9': '\\iota',
    '\u03a6': '\\Phi',
    '\u039b': '\\Lambda',
    '\u03a3': '\\Sigma',
    '\u03a9': '\\Omega',
    '\u0393': '\\Gamma',
    '\u0398': '\\Theta',
    '\u039e': '\\Xi',
    '\u03a0': '\\Pi',
    '\u03a8': '\\Psi',
}

# Unicode subscript digit map
SUB_DIGITS = {
    '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
    '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
}
SUP_DIGITS = {
    '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4',
    '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
}

GREEK_CHARS = set(GREEK_MAP.keys())
ALL_MATH_UNICODE = GREEK_CHARS | set(SUB_DIGITS) | set(SUP_DIGITS)

# Match existing math spans so we don't touch them
MATH_TOKEN_RE = re.compile(r'(\$\$[^$]*?\$\$|\$[^$\n]+?\$)', re.DOTALL)


def split_line(line):
    """Return list of (text, is_math) tuples."""
    parts = []
    last = 0
    for m in MATH_TOKEN_RE.finditer(line):
        if m.start() > last:
            parts.append((line[last:m.start()], False))
        parts.append((m.group(), True))
        last = m.end()
    if last < len(line):
        parts.append((line[last:], False))
    return parts


def fix_plain(text):
    """Wrap bare Greek letters (and attached sub/superscripts) in $...$."""
    if not any(c in text for c in ALL_MATH_UNICODE):
        return text

    result = []
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]

        if ch in GREEK_CHARS:
            # Check for a leading pipe that should be inside the math token
            leading = ''
            if result and result[-1] == '|':
                leading = '|'
                result.pop()

            latex = GREEK_MAP[ch]
            i += 1

            # Collect Unicode subscript digits
            sub = ''
            while i < n and text[i] in SUB_DIGITS:
                sub += SUB_DIGITS[text[i]]
                i += 1

            # Collect Unicode superscript digits
            sup = ''
            while i < n and text[i] in SUP_DIGITS:
                sup += SUP_DIGITS[text[i]]
                i += 1

            # Absorb known single-letter ASCII subscripts (e.g. tau_c)
            ascii_sub = ''
            if not sub and i < n and text[i] in ('c', 'n', 'm', 'i', 'j', 'k', 'p', 'q'):
                ascii_sub = text[i]
                i += 1

            # Trailing pipe
            trailing = ''
            if i < n and text[i] == '|':
                trailing = '|'
                i += 1

            inner = latex
            if sub:
                inner += '_{' + sub + '}'
            elif ascii_sub:
                inner += '_{' + ascii_sub + '}'
            if sup:
                inner += '^{' + sup + '}'

            result.append('$' + leading + inner + trailing + '$')

        else:
            result.append(ch)
            i += 1

    return ''.join(result)


def fix_line(line):
    parts = split_line(line)
    return ''.join(fix_plain(text) if not is_math else text
                   for text, is_math in parts)


def fix_file(path):
    original = path.read_text(encoding='utf-8')
    lines = original.splitlines(keepends=True)
    fixed_lines = [fix_line(l) for l in lines]
    fixed = ''.join(fixed_lines)
    if fixed != original:
        path.write_text(fixed, encoding='utf-8')
        changed = sum(1 for a, b in zip(lines, fixed_lines) if a != b)
        print('  FIXED  {}  ({} lines changed)'.format(path, changed))
        return True
    else:
        print('  ok     {}'.format(path))
        return False


def main():
    targets = sys.argv[1:]
    if not targets:
        print('Usage: fix_greek_math_mode.py <file1.md> [file2.md ...]')
        sys.exit(1)

    changed = 0
    for t in targets:
        p = Path(t)
        if not p.exists():
            print('  SKIP   {} (not found)'.format(t))
            continue
        if fix_file(p):
            changed += 1

    print('\n{}/{} files modified.'.format(changed, len(targets)))


if __name__ == '__main__':
    main()
