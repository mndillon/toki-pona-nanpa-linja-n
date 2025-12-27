# Thoughts on Unicode, Toki Pona, and *nanpa-linja-n*

## 1. Motivation

Toki Pona is a small, minimalist language, but it lives inside a large technical ecosystem: Unicode, ASCII, UTF-8, and so on. If we want Toki Pona to interact smoothly with that ecosystem, we need a clear way to **talk about characters themselves** (letters, digits, punctuation), not just the words they form.

Two related ideas come together here:

1. Giving **Unicode-style names** to characters in a way that fits Toki Pona.
2. Using the **nanpa-linja-n** system to describe **numeric characters** in a compositional way.

This document collects those ideas and makes them a bit more systematic.

---

## 2. *sitelen pona* and Unicode

As of this writing, the Toki Pona *sitelen* glyphs (e.g. *sitelen pona*) **do not yet have a permanent home in the Unicode character set**.

- There is an active desire to eventually have these glyphs encoded.
- One reason to publish texts in *sitelen* is to create **citable material** that can support a Unicode proposal.

It’s reasonable to assume that **when** these sitelen glyphs are finally encoded:

- The **standard Unicode names** for those code points will align with the **Toki Pona words** they represent (e.g. a glyph for *jan* would have a name corresponding to *jan*).

This raises a natural follow-up question:

> What about the other important characters that Toki Pona already uses—especially the basic Latin characters and digits that are **already** in Unicode?

If we care about Toki Pona-friendly names for sitelen glyphs, we can also care about Toki Pona-friendly names for the existing characters we type every day.

---

## 3. Using the Unicode table (ASCII 32–126)

To explore this, we look at the standard Unicode / UTF-8 table for basic Latin characters, for example via:

- the decimal range **32–126**, which corresponds to the **printable ASCII** characters.



| Dec | Char        | Name                     | proposed TP name             |
|-----|-------------|--------------------------|------------------------------|
|  32 | (space)     | space                    | sitlen weka                  |
|  33 | !           | exclamation mark         | sitlen a                     |
|  34 | "           | quotation mark           | sitlen nimi                  |
|  35 | #           | number sign              | sitlen nanpa                 |
|  36 | $           | dollar sign              | sitlen mani                  |
|  37 | %           | percent sign             | sitlen nanpa mute            |
|  38 | &           | ampersand                | sitlen en                    |
|  39 | '           | apostrophe               | sitlen nimi lili             |
|  40 | (           | left parenthesis         | sitlen open                  |
|  41 | )           | right parenthesis        | sitlen pini                  |
|  42 | *           | asterisk                 | sitlen mun                   |
|  43 | +           | plus sign                | sitlen kama                  |
|  44 | ,           | comma                    | sitlen awen lili             |
|  45 | -           | hyphen-minus             | sitlen linja                 |
|  46 | .           | full stop / period       | sitlen pini lili             |
|  47 | /           | slash                    | sitlen linja anpa            |
|  48 | 0           | digit zero               | nenin                        |
|  49 | 1           | digit one                | newen                        |
|  50 | 2           | digit two                | neten                        |
|  51 | 3           | digit three              | nesen                        |
|  52 | 4           | digit four               | nenan                        |
|  53 | 5           | digit five               | nelen                        |
|  54 | 6           | digit six                | nenun                        |
|  55 | 7           | digit seven              | nemen                        |
|  56 | 8           | digit eight              | nepen                        |
|  57 | 9           | digit nine               | nejen                        |
|  58 | :           | colon                    | sitlen tenpo                 |
|  59 | ;           | semicolon                | sitlen tenpo lili            |
|  60 | <           | less-than sign           | sitlen lili                  |
|  61 | =           | equals sign              | sitlen sama                  |
|  62 | >           | greater-than sign        | sitlen suli                  |
|  63 | ?           | question mark            | sitlen seme                  |
|  64 | @           | at sign                  | sitlen poka                  |
|  65 | A           | capital letter A         | sitlen suli A                |
|  66 | B           | capital letter B         | sitlen suli B                |
|  67 | C           | capital letter C         | sitlen suli C                |
|  68 | D           | capital letter D         | sitlen suli D                |
|  69 | E           | capital letter E         | sitlen suli E                |
|  70 | F           | capital letter F         | sitlen suli F                |
|  71 | G           | capital letter G         | sitlen suli G                |
|  72 | H           | capital letter H         | sitlen suli H                |
|  73 | I           | capital letter I         | sitlen suli I                |
|  74 | J           | capital letter J         | sitlen suli J                |
|  75 | K           | capital letter K         | sitlen suli K                |
|  76 | L           | capital letter L         | sitlen suli L                |
|  77 | M           | capital letter M         | sitlen suli M                |
|  78 | N           | capital letter N         | sitlen suli N                |
|  79 | O           | capital letter O         | sitlen suli O                |
|  80 | P           | capital letter P         | sitlen suli P                |
|  81 | Q           | capital letter Q         | sitlen suli Q                |
|  82 | R           | capital letter R         | sitlen suli R                |
|  83 | S           | capital letter S         | sitlen suli S                |
|  84 | T           | capital letter T         | sitlen suli T                |
|  85 | U           | capital letter U         | sitlen suli U                |
|  86 | V           | capital letter V         | sitlen suli V                |
|  87 | W           | capital letter W         | sitlen suli W                |
|  88 | X           | capital letter X         | sitlen suli X                |
|  89 | Y           | capital letter Y         | sitlen suli Y                |
|  90 | Z           | capital letter Z         | sitlen suli Z                |
|  91 | [           | left square bracket      | sitlen open pi poki          |
|  92 | \           | backslash                | sitlen linja anpa            |
|  93 | ]           | right square bracket     | sitlen pini pi poki          |
|  94 | ^           | caret                    | sitlen sewi                  |
|  95 | _           | underscore               | sitlen anpa                  |
|  96 | `           | grave accent / backtick  | sitlen anpa poka             |
|  97 | a           | small letter a           | sitlen lili a                |
|  98 | b           | small letter b           | sitlen lili b                |
|  99 | c           | small letter c           | sitlen lili c                |
| 100 | d           | small letter d           | sitlen lili d                |
| 101 | e           | small letter e           | sitlen lili e                |
| 102 | f           | small letter f           | sitlen lili f                |
| 103 | g           | small letter g           | sitlen lili g                |
| 104 | h           | small letter h           | sitlen lili h                |
| 105 | i           | small letter i           | sitlen lili i                |
| 106 | j           | small letter j           | sitlen lili j                |
| 107 | k           | small letter k           | sitlen lili k                |
| 108 | l           | small letter l           | sitlen lili l                |
| 109 | m           | small letter m           | sitlen lili m                |
| 110 | n           | small letter n           | sitlen lili n                |
| 111 | o           | small letter o           | sitlen lili o                |
| 112 | p           | small letter p           | sitlen lili p                |
| 113 | q           | small letter q           | sitlen lili q                |
| 114 | r           | small letter r           | sitlen lili r                |
| 115 | s           | small letter s           | sitlen lili s                |
| 116 | t           | small letter t           | sitlen lili t                |
| 117 | u           | small letter u           | sitlen lili u                |
| 118 | v           | small letter v           | sitlen lili v                |
| 119 | w           | small letter w           | sitlen lili w                |
| 120 | x           | small letter x           | sitlen lili x                |
| 121 | y           | small letter y           | sitlen lili y                |
| 122 | z           | small letter z           | sitlen lili z                |
| 123 | {           | left curly bracket       | sitlen open pi poki suli     |
| 124 | \|          | vertical bar / pipe      | sitlen linja sewi            |
| 125 | }           | right curly bracket      | sitlen pini pi poki suli     |
| 126 | ~           | tilde                    | sitlen linja telo            |

From that table, we can:

1. List each character (`" "`, `"!"`, `"A"`, `"a"`, digits, punctuation, etc.).
2. Give it a **reasonable English name** (“exclamation mark”, “capital letter A”, “tilde”, …).
3. Assign a **Toki Pona-style name** to the **character itself**, not its semantic meaning in text.
4. The full Unicode character set is vast, there may be other characters that we may want to name.
5. Table source: [https://www.utf8-chartable.de/unicode-utf8-table.pl?utf8=dec&unicodeinhtml=dec](https://www.utf8-chartable.de/unicode-utf8-table.pl?utf8=dec&unicodeinhtml=dec)

### 3.1. General naming pattern

For non-digit characters (letters, punctuation, symbols), we use a pattern like:

> **sitelen …**

where:

- `sitelen` indicates “written character / glyph”.
- The rest is a short descriptive phrase in Toki Pona.

Examples (for non-digit characters):

- `!` → `sitelen a` (exclamation mark; *a* is the interjection).
- `@` → `sitelen poka` (“at”; proximity).
- `$` → `sitelen mani` (money symbol).
- `?` → `sitelen seme` (question mark).
- `~` → `sitelen linja telo` (a wavy line, like flowing water).

### 3.2. Avoiding number words in the main table

An important design choice:

> **We do not want any Toki Pona number words (ala, wan, tu, luka, etc.) in the names of non-digit characters.**

Number words are **reserved** for the **digit characters themselves**, in the nanpa-linja-n system. This keeps the design clean and prevents confusion between:

- “This is the character that *means* something about numbers”
- vs.
- “This *is* a specific digit character like `"3"`”.

This rule applies to all characters in the 32–126 range **except** the digit characters `"0"`–`"9"`, which are handled separately.

---

## 4. The digit characters and *nanpa-linja-n*

Now we zoom in on the **digit characters**:

- `0 1 2 3 4 5 6 7 8 9`

The **central purpose** of *nanpa-linja-n* is:

> It is **not** about changing the traditional Toki Pona names of the numeric values 0–9;
> it **is** about assigning systematic, pronounceable Toki Pona names to the **Unicode characters**
> `"0"` through `"9"`, in a way that can be manipulated by **concatenation**.

### 4.1. CVN constraint and concatenation

Each digit character gets a **CVN-shaped** (consonant-vowel-nasal) Toki Pona-style name:

- short
- easily pronounceable
- ends with `-n`, which can act as a phonetic end of digit sequence marker

The advantage of keeping these digit names in **CVN** format is that they can be easily **concatenated** into longer words that represent multi-digit sequences.

- The idea is:
  write the digit names in sequence and then **compress** them slightly (by dropping every `n` at the end of each digit name, except the last).

Example:

- `"9"` → `nejen`
- `"8"` → `nepen`

So `"98"` can be represented as **nejepen**, a single word derived from the digit character names and still ending in `-n`.

### 4.2. Mapping table for digit characters

Here is a compact table for decimal codes 48–57, which correspond to the ASCII digits:


| Dec | Char | Name        | TP name |
|-----|------|-------------|---------|
|  48 | 0    | digit zero  | nenin   |
|  49 | 1    | digit one   | newen   |
|  50 | 2    | digit two   | neten   |
|  51 | 3    | digit three | nesen   |
|  52 | 4    | digit four  | nenan   |
|  53 | 5    | digit five  | nelen   |
|  54 | 6    | digit six   | nenun   |
|  55 | 7    | digit seven | nemen   |
|  56 | 8    | digit eight | nepen   |
|  57 | 9    | digit nine  | nejen   |


Notes:

The English name for character "9" is "digit nine" and **not** the value 9, the name of the character code is completely different from any value that might be associated to the character.

The Toki Pona nanpa-linja-n names (nenin, newen, neten, nesen, nenan, nelen, nenun, nemen, nepen, nejen) are names for the Unicode characters "0"–"9", **not** names for the values of the numbers themselves.

In communications, if the context determines that the digit sequence is communicating a numeric value, then the decimal numeric value can be very easily determined from the sequence of the character code names.
This is a key advantage of using the Hindu-Arabic positional decimal system for expressing numeric values.

---

## 5. Concatenation in practice: password examples

One practical use of this system is reading out or describing passwords and identifiers, where you often want to distinguish clearly between:

letters,

punctuation,

and digit sequences.

The rule we use:

Consecutive digit characters are grouped together and rendered as a single concatenated nanpa-linja-n word.

Non-digit characters are named individually using the sitelen … pattern.


### 5.1. Example: Consider a randomly chosen password: "F9q!27m$k30Z&b4?"

Group digits and name:

| Segment | Chars | Explanation                                              | proposed TP name|
|---------|-------|----------------------------------------------------------|-----------------|
| 1       | F     | capital letter F                                         | sitelen suli F  |
| 2       | 9     | digit 9 → nejen                                          | nejen           |
| 3       | q     | small letter q                                           | sitelen lili q  |
| 4       | !     | exclamation mark                                         | sitelen a       |
| 5       | 27    | 2 = neten, 7 = nemen → (compressed) netemen              | netemen         |
| 6       | m     | small letter m                                           | sitelen lili m  |
| 7       | $     | dollar sign                                              | sitelen mani    |
| 8       | k     | small letter k                                           | sitelen lili k  |
| 9       | 30    | 3 = nesen, 0 = nenin → (compressed) nesenin              | nesenin         |
| 10      | Z     | capital letter Z                                         | sitelen suli Z  |
| 11      | &     | ampersand                                                | sitelen en      |
| 12      | b     | small letter b                                           | sitelen lili b  |
| 13      | 4     | digit 4 → nenan                                          | nenan           |
| 14      | ?     | question mark                                            | sitelen seme    |


So the whole password can be described as:

sitelen suli F, nejen, sitelen lili q, sitelen a, netemen, sitelen lili m, sitelen mani, sitelen lili k, nesenin, sitelen suli Z, sitelen en, sitelen lili b, nenan, sitelen seme.

---

## 6. nanpa-linja-n
Reference: [nanpa-linja-n](README.md)
