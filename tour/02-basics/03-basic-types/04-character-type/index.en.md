# Character Type

Cangjie uses the `Rune` type to represent characters, supporting all characters in the Unicode character set.

Character literals start with `r` followed by a character in single or double quotes, e.g. `r'A'` or `r"B"`.

Escape characters are supported, such as `r'\n'` (newline), `r'\t'` (tab), `r'\\'` (backslash). You can also use `\u{...}` to specify Unicode code points.
