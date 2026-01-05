# nanpa-linja-n — A Simple, Easy Way to Communicate a String of Decimal Digits in Toki Pona

o weka e nimi ike.

## TL;DR:

**nanpa-linja-n** motivation:

<img src="images/Phone Number Conversation v1.png" width="384"/>


### Saying the number "23,645":

| Language                 | Spoken number phrase                                 | Feels                     |
|--------------------------|------------------------------------------------------|---------------------------|
| English                  | twenty three thousand six hundred (and) forty five   | natural                   |
| French                   | vingt trois mille six cent quarante cinq             | natural                   |
| Esperanto                | dudek tri mil sescent kvardek kvin                   | natural                   |
| Lojban                   | (li) re ci xa vo mu (boi)                            | functional, sterile       |
| Toki Pona (pu)           | mute                                                 | useless                   |
| Toki Pona (nanpa pona)   | tu ale mute luka luka luka wan ale mute mute luka    | contrived, error prone    |
| Toki Pona (nanpa-linja-n)| **netesen eke nunalen**                              | natural                   |

### Interactive decimal cartouche renderer:

https://mndillon.github.io/toki-pona-nanpa-linja-n/renderer.html



## Overview
**nanpa-linja-n** in sitelen pona is written using cartouches. The cartouche content is a pure encoding: it defines a unique, reversible mapping from decimal digits (and delimiters such as the decimal point) to designated sitelen pona glyphs and corresponding Latin letters, so the original decimal sequence can be reconstructed exactly.


This does **NOT** introduce any new Toki Pona words or lexicon; it is notation-only. Any “words” discussed below refer only to identifier strings / proper-name labels derived from the cartouche encoding.


Toki Pona’s vocabulary is small, but not too small.
It’s big enough to be functional while still keeping the language simple.
This system aims to follow that same idea: staying as simple as possible while still being practical for everyday use.
It’s not meant to replace anything—just to offer a tool that fits naturally into the language’s minimal design.


## Digit Symbol Words (0–9)
Each digit symbol uses a distinct, CVN form word and does not conflict with any Toki Pona words.
The digit words all start with 'ne' and have been carefully picked, so that they align with the corresponding glyphs (see below).
If we ignore 'n' and ignore 'e' in the words, then each digit word maps to a different, unique letter:

```
"0"  nenin  I
"1"  newen  W
"2"  neten  T
"3"  nesen  S
"4"  nenan  A
"5"  nelen  L
"6"  nenun  U
"7"  nemen  M
"8"  nepen  P
"9"  nejen  J
```

---

## sitelen pona digit cartouches

| Glyph                                                             | Letter       | #~n Cartouche                                                               | #~n Proper Name | Design Rationale               |
|-------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------|-----------------|--------------------------------|
| <img src="images/horizontal 0 nasin nanpa.png" width="32"/>       | I            | <img src="images/horizontal 0 nasin nanpa cartouche.png" width="64"/>       | Nenin           | round like zero                |
| <img src="images/horizontal 1 nasin nanpa.png" width="32"/>       | W            | <img src="images/horizontal 1 nasin nanpa cartouche.png" width="64"/>       | Newen           | wan                            |
| <img src="images/horizontal 2 nasin nanpa v2.png" width="32"/>    | T            | <img src="images/horizontal 2 nasin nanpa cartouche.png" width="64"/>       | Neten           | tu                             |
| <img src="images/horizontal 3 nasin nanpa v3.png" width="32"/>    | S            | <img src="images/horizontal 3 nasin nanpa cartouche v2.png" width="64"/>    | Nesen           | has three lines                |
| <img src="images/horizontal 4 nasin nanpa v3.png" width="32"/>    | A            | <img src="images/horizontal 4 nasin nanpa cartouche v2.png" width="64"/>    | Nenan           | has four lines                 |
| <img src="images/horizontal 5 nasin nanpa.png" width="32"/>       | L            | <img src="images/horizontal 5 nasin nanpa cartouche.png" width="64"/>       | Nelen           | luka                           |
| <img src="images/horizontal 6 nasin nanpa v2.png" width="32"/>    | U            | <img src="images/horizontal 6 nasin nanpa cartouche.png" width="64"/>       | Nenun           | has six short lines            |
| <img src="images/horizontal 7 nasin nanpa v3.png" width="32"/>    | M            | <img src="images/horizontal 7 nasin nanpa cartouche.png" width="64"/>       | Nemen           | seven days in week             |
| <img src="images/horizontal 8 nasin nanpa v3.png" width="32"/>    | P            | <img src="images/horizontal 8 nasin nanpa cartouche.png" width="64"/>       | Nepen           | spiders have eight legs        |
| <img src="images/horizontal 9 nasin nanpa v2.png" width="32"/>    | J            | <img src="images/horizontal 9 nasin nanpa cartouche.png" width="64"/>       | Nejen           | nine months to carry pregnancy |

Sitelen Cartouche Summary:

<img src="images/nanpa_linja_n_examples_with_rationale_fact_sheet.png" width="760"/>

---

## General Number Rule
Applies to all numbers no matter what form they take:

**All number proper names start with ne- and end with -n**

---

## Internal Digit-Block Rule
Inside a digit block (no separator present):

**Concatenate digit names by dropping starting ne- and dropping ending -n from every digit name, and start final number word with ne- and end with -n.**


### Examples

- 10 → newen nenin → **newenin**
- 46 → nenan nenun → **nenanun**
- 78 → nemen nepen → **nemepen**
- 100 → newen nenin nenin → **neweninin**
- 567 → nelen nenun nemen → **nelenumen**
- 234 → neten nesen nenan → **netesenan**
- 801 → nepen nenin newen → **nepeniwen**
- 950 → nejen nelen nenin → **nejelenin**


---

## Large Number Units

### Standard Units
Used when non-zero digits follow the block.

```
neke     = more parts after ISO block marker to follow
```

- 2,534 → **neten eke lesenan**

### Zero-Block Units  
Used only when *everything after* the ISO block is zero, used at the end of a number.

Adds more context, makes the assumption that the string of digits represents a numeric value:

Join naturally to the -n at the end of numbers, since they are only allowed to appear at the end of numbers.

```
neken     = exactly X thousand
nekeken   = exactly X million
nekekeken = exactly X billion
```

- 2,000,000 → **neten ekeken**

### Any number of blocks
Used for any number of blocks, this separator has no specific value.  It can be used to split up long digit sequences.

Does not add more context, makes no assumption that the string of digits represents a numeric value:

```
nene  = more parts of digit sequence to follow
```

- 123-4567 → **newetesen ene nalenumen**


### Examples
```
1           → newen
08          → nenipen
23          → netesen
679         → nenumejen
1,234       → newen eke tesenan
12,000      → neweten eken
12000       → newetenininin
3,000,000   → nesen ekeken
30,000,000  → nesenin ekeken
300,000,000 → neseninin ekeken
3,000,000,000 → nesen ekekeken
7,321,900   → nemen eke setewen eke jeninin
64.5M       → nenunan one len ekeken
64.5B       → nenunan one len ekekeken
0123456789  → neniwetesenalenumepejen (using block words is optional, but often very helpful for understanding)
012-3456789 → neniweten ene senalenumepejen (nene can be used anywhere to break up large numbers)
012-3456-789 → neniweten ene senalenun ene mepejen
2025        → netenitelen
2,025       → neten eke nitelen
20-25       → netenin ene telen
2-0-2-5     → neten ene nin ene ten ene len
3.141592    → nesen one wenawelejeten
```

---

## Decimal Separator — none
**none** separates whole and decimal parts.

Rules:

- Can split "none" into "n one " to split up long sequences
- Adds more context, makes the assumption that the strings of digits represent numeric values


Examples:

```
0.5       → nenin one len
3.75      → nesen one melen
12.04     → neweten one ninan
37.9      → nesemen one jen
0.125     → nenin one wetelen
3.141592  → nesen one wenawen ene lejeten
```

---

## Fractions — nono
**nono** expresses fractions “over / divided by”.

Rule:

- Can split "nono" into "n ono " to split up long sequences
- Adds more context, makes the assumption that the strings of digits represent numeric values


Examples:

```
1/2                 → newen ono ten
3/4                 → nesen ono nan
5/8                 → nelen ono pen
9¾                  → nejen onono sen ono nan
567/890             → nelenumen ono pejenin
1,234 / 56          → newen eke tesenan ono lenun
3 / 1,000,000,000   → nesen ono wen ekekeken
```

---

## Negative Numbers — no
Prefix **no** before any digits, must only appear at the start of a digit sequence:

Rule:

- Can add a space to "no" to get "no " to split up long sequences
- Adds more context, makes the assumption that the string of digits represents a numeric value


Examples:

```
−5         → neno len
−12        → neno weten
−0.4       → neno nin one nan
−30,000    → neno senin eken
```

---

## Mixed Expressions

```
(3.75) / 4   → nesen one melen ono nan
3 / 4.75     → nesen ono nan one melen
1,234.567    → newen eke tesenan one lenumen
0.5          → nenin one len
1/2          → newen ono ten
5:38         → tenpo nelen one sepen
19:46:27     → tenpo newejen one nanun one temen
```

---

## Design Rationale

### Digit Roots
- Unique syllables
- Easy to remember and use
- Very useful when speaking and hearing long sequences of digits ( 5201 → neleteniwen → 5201 )
- End in **-n** for structural consistency, for long digit sequences the end is clearly signaled
  - This works with the Toki Pona language syntax to enhance communication
    - Say "2,010": "neten eke niwenin"
    - Say "2,000" followed by "10": "neten eken newenin"
    - Say "2,001" followed by "0": "neten eke niniwen nenin"
    - Say "2,001.0": "neten eke niniwen one nin"
    - Say "243-555-0169": "netenasen ene lelelen ene niwenujen"
    - The **ne-** and **-n** are morphological markers, indicating the start and end of a digit sequence
    - Screen readers can communicate longer digit sequences with less cognitive load
    - Automated text-to-speech systems can communicate longer digit sequences with less cognitive load
    - Can enhance compatability with [WCAG 2.2](WCAG%202.2%20compliance%20claims.md)
  - The speaker wants to communicate **"1 2 3 4 5"**:
    - for counting,
      - might say: **"newen neten nesen nenan nelen"**
    - for value 12,345,
      - might say: **"neweten eke senalen"**
    - for sequence of digits, like an id,
      - might say: **"newetesenalen"**
    - for 1-2-3-4-5 digit emphasis,
      - might say: **"newen ene ten ene sen ene nan ene len"**
    - for breaking up long sequences with no change in value, (nene can be used anywhere)
      - might say: **"neweten ene senalen"**
    - In all cases the listener has understood the speaker as communicating **"12345"**
- No conflict with Toki Pona vocabulary
- Where possible, respects the first letter of existing Toki Pona digit names (from pu)
- By starting digit sequences with **ne-** and ending digit sequences with **-n**, words are more easily identified as **nanpa-linja-n** digit strings ( nemetesen → 723 )
- Respects the speaker’s freedom to choose how to express numbers:
  - Additive (**pu** style) numerals:
    - The speaker uses **pu** names ala, wan, tu, luka, mute, ale
    - The speaker thinks: 78 = 20 add 20 and 20 and 5 and 5 and 5 and 2 and 1
    - The speaker says (the way they think): mute mute mute luka luka luka tu wan
    - The listener recognises **pu** semantics
    - The listener understands: 78
  - Positional decimal (**nanpa-linja-n** style) strings:
    - The speaker uses **nanpa-linja-n** digit names with concatenation and **ne-** signalling the start and **-n** signalling the end of the string of digits
    - The speaker thinks: 78 = 7 followed by 8
    - The speaker says (the way they think): nemepen
    - The listener recognises **nanpa-linja-n** semantics (since no word collision and syntax is consistent)
    - The listener understands: "78"
    - The listener may understand that "78" represents a numeric value, but that understanding is determined by context
  - Any system that groups digits before speaking adds cognitive load for the speaker, because they must pre-determine consistent groupings before saying anything.  **nanpa-linja-n** works with the ISO conventional digit separators using eke/eken
  - By contrast, speaking one digit at a time lets the speaker break long sequences anywhere without losing meaning.  **nanpa-linja-n** can break large strings of digits up using ene, without assuming that the string of digits represents a numeric value
- Can be used as a drop-in replacement for (base 10) digits in dates, times, phone numbers, codes, and any context where precise digit information is needed
- (Can be easily parsed with lex/yacc)
- (Yet another humble attempt at simply being functional, avoiding copy and paste and cognitive load)


### none
- Contain **o**, which no digit word has
- Do not end in **-n** signalling more of the number to follow
- Can be used with tenpo for hour and minute delimiter
- Can be split as "n one ", to split up long sequences
- Adds more context, makes the assumption that the strings of digits represent numeric values

### nono
- Contains **o**, which no digit word has
- Does not end in **-n** signalling more of the number to follow
- Can be split as "n ono ", to split up long sequences
- Adds more context, makes the assumption that the strings of digits represent numeric values

### no
- Contains **o**, which no digit word has
- Does not end in **-n** signalling more of the number to follow
- Always occurs at the start of a numeric expression (after ne-)
- Can be written as "no ", to split up long sequences
- Adds more context, makes the assumption that the string of digits represents a numeric value

### neke / nekeke / nekekeke
- Contain **k**, which no digit word has
- Does not end in **-n** signalling more of the number to follow
- Can be used as ISO-block narker in large numbers, can only appear when other digits follow block marker
- Never appears in decimal part of number, only in the integer part
- Can be split as "n eke ", to split up long sequences
- Adds more context, makes the assumption that the string of digits represents a numeric value

### neken / nekeken / nekekeken
- Contain **k**, which no digit word has
- Zero-block shortcuts for clear large numbers, can only appear at the end of large numbers
- Naturally join with the **-n** at the end of numbers to signal end of numeric description
- Never appears in decimal part of number, only in the integer part
- Adds more context, makes the assumption that the string of digits represents a numeric value
- can repeat ke letter group any number of times to express more ISO 000 block groupings at the end of numbers (e.g. ekeken ekekeken ekekeken )

### nene
- Contains **nene**, which no digit word has
- A bridge joining different parts of the whole string of digits
- Have no value, only used to break up long sequences of digits
- Can appear in decimal part and in the integer part of large numbers
- Can be split as "n ene ", to split up long sequences
- Never occurs at the start of a numeric expression or after a decimal point
- Does not add more context, makes no assumption that the string of digits represents a numeric value

### sitelen pona
- **nanpa-linja-n** numeric glyphs are always presented inside a cartouche and always starting with the nanpa glyph
- the digit names were selected so that the glyphs would suggest the decimal value and so that all digits map to distinct unique letters
- there is a **UNIQUE** one-to-one mapping from numbers to cartouche proper names
  - all the digits and delimiters are mapped to separate letters
  - when writing down the proper name from the cartouche, we will add spaces at decimal delimiters, for ease of reading long proper names
    - the proper name of **Neno Nin One Wetesen Ene Nalenun Ene Mepejen**, can be decoded as **-0.123456789**
      - <img src="images/number_negative_decimal_digits_glyph.png" width="320"/>
    - the proper name of **Nejen Onono Sen Ono Nan**, can be decoded as **9¾**
      - <img src="images/number_9_fraction_three_quarters_glyph.png" width="160"/>
    - the proper name of **Nenaten Eke Sepenun One Melen**, can be decoded as **42,386.75**
      - <img src="images/number_42386_75_glyph_v8.png" width="320"/>
    - the proper name of **Nenunan One Len Ekeken**, can be decoded as **64.5M**
      - <img src="images/number_64_5_M_glyph_v9.png" width="160"/>
- can be displayed horizontally or vertically

| Glyph                                                             | Letter       | #~n Cartouche                                                               | #~n Proper Name | Design Rationale               |
|-------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------|-----------------|--------------------------------|
| <img src="images/horizontal 0 nasin nanpa.png" width="32"/>       | I            | <img src="images/horizontal 0 nasin nanpa cartouche.png" width="64"/>       | Nenin           | round like zero                |
| <img src="images/horizontal 1 nasin nanpa.png" width="32"/>       | W            | <img src="images/horizontal 1 nasin nanpa cartouche.png" width="64"/>       | Newen           | wan                            |
| <img src="images/horizontal 2 nasin nanpa v2.png" width="32"/>    | T            | <img src="images/horizontal 2 nasin nanpa cartouche.png" width="64"/>       | Neten           | tu                             |
| <img src="images/horizontal 3 nasin nanpa v3.png" width="32"/>    | S            | <img src="images/horizontal 3 nasin nanpa cartouche v2.png" width="64"/>    | Nesen           | has three lines                |
| <img src="images/horizontal 4 nasin nanpa v3.png" width="32"/>    | A            | <img src="images/horizontal 4 nasin nanpa cartouche v2.png" width="64"/>    | Nenan           | has four lines                 |
| <img src="images/horizontal 5 nasin nanpa.png" width="32"/>       | L            | <img src="images/horizontal 5 nasin nanpa cartouche.png" width="64"/>       | Nelen           | luka                           |
| <img src="images/horizontal 6 nasin nanpa v2.png" width="32"/>    | U            | <img src="images/horizontal 6 nasin nanpa cartouche.png" width="64"/>       | Nenun           | has six short lines            |
| <img src="images/horizontal 7 nasin nanpa v3.png" width="32"/>    | M            | <img src="images/horizontal 7 nasin nanpa cartouche.png" width="64"/>       | Nemen           | seven days in week             |
| <img src="images/horizontal 8 nasin nanpa v3.png" width="32"/>    | P            | <img src="images/horizontal 8 nasin nanpa cartouche.png" width="64"/>       | Nepen           | spiders have eight legs        |
| <img src="images/horizontal 9 nasin nanpa v2.png" width="32"/>    | J            | <img src="images/horizontal 9 nasin nanpa cartouche.png" width="64"/>       | Nejen           | nine months to carry pregnancy |


- the table below has some other delimiters used in numeric expressions inside cartouches:
- the table has some repeating letters, but the letter placements will determine how the letter is interpreted:
  - N is repeated
    - ne at start is always nanpa
    - no after Ne (depicted with ni) represents negative
    - ene after anything else (depicted with ni) represents an ISO break
  - K is repeated
    - ke can repeat but that maps to repeated kulupu representing thousands, millions, billions
    - ke can be repeated many times to show any number of 000 groups at the end of a number
  - O is repeated
    - one by itself represents the decimal point
    - ono doubled represents the delimiter between numerator and denominator of a fraction
    - onono tripled represents the delimiter between integer part and fraction part of a number (when integers have additional fraction parts)

| Glyph                                                                                          | Letter(s)    |  #~n Name                 | Design Rationale                                      |
|------------------------------------------------------------------------------------------------|--------------|---------------------------|-------------------------------------------------------|
| <img src="images/horizontal Decimal Delimiter nasin nanpa v2.png" width="16"/>                 | O            | none                      | decimal point, has small circle at the bottom         |
| <img src="images/horizontal Fraction Delimiter nasin nanpa v4.png" width="32"/>                | OO           | nono                      | needed to split numerator and denominator of fraction |
| <img src="images/horizontal Fraction From_Integer_Delimiter nasin nanpa v2.png" width="48"/>   | OOO          | nonono                    | needed to split integer from fraction part            |
| <img src="images/horizontal Tasan nasin nanpa.png" width="16"/>                                | K            | neke                      | kulupu has three circles, thousands                   |
| <img src="images/horizontal Masan nasin nanpa.png" width="32"/>                                | KK           | nekeke                    | millions                                              |
| <img src="images/horizontal Wasan nasin nanpa.png" width="48"/>                                | KKK          | nekekeke                  | billions                                              |
| <img src="images/horizontal Thousands Delimiter nasin nanpa v2.png" width="16"/>               | N            | nene                      | natural break                                         |
| <img src="images/horizontal Negative nasin nanpa v3.png" width="16"/>                          | N            | no                        | downwards suggests negative (always after ne-)        |
| <img src="images/horizontal Number Symbol nasin nanpa.png" width="16"/>                        | N            | ne                        | nanpa, always at start and end of numeric description |






---

## Arithmetic Operations
Here we are moving away from describing numbers to describing simple arithmetic expressions.
This is not the main focus of this proposal.
Some of the suggestions below are inspired by [seximal] nasin nanpa suli, tan jan Emalan.
They never appear in a numeric cartouche.
Words primarialy chosen for the shape of their sitelen pona glyphs.

### Equals: sama
- Shape of sitelen pona glyph (looks like equals)
- Good candidate
- Never appears in a numeric cartouche
- nenin one len li sama newen ono ten

### Addition: en
- Shape of sitelen pona glyph (looks like plus)
- Good candidate
- Adds more context, makes the assumption that the strings of digits represent numeric values
- Never appears in a numeric cartouche
- newen en neten en nesen li sama nenun
- o pana e nejen tawa nesen

### Subtract: lape
- Shape of sitelen pona glyph (looks like subtract)
- Good candidate
- Adds more context, makes the assumption that the strings of digits represent numeric values
- Never appears in a numeric cartouche (but negative symbol can appear in a numeric cartouche)
- nesen lape nenoten li sama nelen

### Multiply: lete
- Shape of sitelen pona glyph (looks like multiply in ascii)
- Good candidate
- Adds more context, makes the assumption that the strings of digits represent numeric values
- Never appears in a numeric cartouche
- nesen lete neten li sama nenun

### Division: kipisi
- Shape of sitelen pona glyph (looks like divide)
- Good candidate
- Adds more context, makes the assumption that the strings of digits represent numeric values
- Never appears in a numeric cartouche (but fraction symbol can appear in a numeric cartouche)
- nepen kipisi nenoten li sama nenonan

### Power: sewi
- Shape of sitelen pona glyph (looks like rising up)
- Good candidate
- Adds more context, makes the assumption that the strings of digits represent numeric values
- Never appears in a numeric cartouche
- neten sewi nesen li sama nepen
- nemen eken li sama nemen lete newenin sewi nesen

Other mathematical expressions like log, ln, exp, roots, cos, pi (and maybe even powers) are better left in mathematical notation:

cos(2π) = 1

√9 = 3

and have the community calque what are useful ways to describe these expressions


---

## License
This project is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0).

See the LICENSE file for details.

---

## Exercises
Have someone read the nanpa-linja-n sentences in the [examples](examples.md), and check how many of them you can correctly understand.

This demonstrates the motivation behind this number system.

Use other Toki Pona number systems, that you know, to expresss the sentences in the [examples](examples.md) and compare with **nanpa-linja-n** for ease of listening effort and understanding.  When seeing a (decimal) number for the first time, how much mental effort does the speaker have to exert in order to determine what the numeric description will be?  Do the number descriptions make the sentence harder to understand?  This feedback would be appreciated.

Use the [nanpa_linja_n_anki_examples.csv](nanpa_linja_n_anki_examples.csv) to build an Anki deck.

---

## Community & Contributions
Discussion welcome via:

- The 'Discussions' tab on this Github repository

- https://sona.pona.la/wiki/nasin_nanpa_linja_n (you need an account on sona pona to view this page)

- Comments on tokipona channel on Reddit (mention nanpa-linja-n in your posts, so its clear what subject your post is about)

- kama sano Discord: https://discord.com/channels/969386329513295872/1442150091816440000

- On [https://sona.pona.la/wiki/nasin_nanpa_ali_ike](https://sona.pona.la/wiki/nasin_nanpa_ali_ike#[decimal]_nanpa-linja-n) list, **nanpa-linja-n** looks most closest to (at first glance):

  - [decimal] socks numeral (based on cantonese), tan socks

  - [decimal] [humorous] kijetesantakalu polinpin, tan jan Kita (shameless self-promotion)

  - [decimal] nasin nanpa nimi, tan kijetesantakalu Iwan

  - [decimal] lojban, tan jan Tepo

  - Esperanto and Lojban

  - how **nanpa-linja-n** compares to these (at first glance):

    - it describes a string of digits, the context will determine if the string of digits represents a numeric value

    - it uses **ne-** at the start and **-n** at the end of the base name for the digits (CVN format), so that single digit names are consistent with the descriptions of other digit strings

    - it consistently uses **ne-** at the start and **-n** at the end of digit strings

    - it consistently uses **ne-** at the start and **-n** at the end of numerical structures that end with delimiters (eken/ekeken/ekekeken)

    - the consistent use of **ne-** at the start and **-n** at the end as morphological markers is original

    - the consistent use of **ne-** at the start and **-n** at the end makes it immediately clear when a string of digits stops, no matter how long the sequence of digits. The listener spends little mental effort deciding whether the digit sequence is complete, and context will determine if the digit sequence represents a numeric value

    - while using similar principles, it provides a more consistent way to express numbers — including large ones — reducing learning effort and cognitive load on both speaker and listener

---

## Bigger Picture

**nanpa-linja-n** can be considered part of a bigger Unicode project described here: [Unicode Discussion](toki%20pona%20bigger%20unicode%20picture.md)


---


## Paying the lexical price: indexed families with nanpa-linja-n

If we accept the cost of adding the **nanpa-linja-n** digit roots to the language, we can use them for more than just the great advantage of reading raw digits. They give us a clean, reusable structure for talking about **indices in ordered families**:

> **`[FAMILY] sike nanpa [nanpa-linja-n]` = the N-th member of that family**

- `[FAMILY] sike` names some ordered cycle or sequence (weekdays, months, levels, modes, etc.).
- `nanpa` marks that what follows is an index.
- `[nanpa-linja-n]` is a digit or digit-string name (with compression) that corresponds exactly to the written index.


This pattern lets us talk about positions in a family in a way that:

- reuses the same lexical machinery across many domains
- avoids inventing separate lexical items like “Sunday”, “March”, “Level 05” in every case
- zero based indexing (where appropriate) is possible and naturally addressed with **nenin**
- can also easily reference expressions that start with zero: 'musi utala sike nanpa nenilen'
- sike nanpa (cycle number) usage is not the same as tenpo X nanpa Y
  - relative index: tenpo suno nanpa newen → the first day
  - absolute index: (tenpo) suno sike nanpa newen → Monday

Below are two practical examples.

---

### Example 1: Weekdays (`suno sike`, Monday = 1, ISO Standard)

Define the ordered family of weekdays as:

- `suno sike` = “cycle of suns” → the weekly cycle.

We choose a **Monday-first, 1-based** convention:

> `suno sike nanpa X` = weekday with index X in this cycle
> `newen = Monday, neten = Tuesday, …, nemen = Sunday`

Using nanpa-linja-n digit names:

- suno sike nanpa **newen** = weekday 1 = Monday
- suno sike nanpa **neten** = weekday 2 = Tuesday
- suno sike nanpa **nesen** = weekday 3 = Wednesday
- suno sike nanpa **nenan** = weekday 4 = Thursday
- suno sike nanpa **nelen** = weekday 5 = Friday
- suno sike nanpa **nenun** = weekday 6 = Saturday
- suno sike nanpa **nemen** = weekday 7 = Sunday


Usage:

```
suno sike nanpa nemen la mi awen tomo.
= On weekday 7 (Sunday) I stay home.

suno sike nanpa neten la mi pali.
= On weekday 2 (Tuesday) I work.

suno sike nanpa nelen la mi tawa utala.
= On weekday 5 (Friday) I go to sport.
```


### Example 2: Months of the year (mun sike)
Define the ordered family of months as:

- `mun sike` = “cycle of moons” → the 12 Gregorian months.

We use a 1-based convention:

- mun sike nanpa X = month with index X in the year (1 = January … 12 = December)

Using digit name compression for multi-digit indices:

- mun sike nanpa **newen** = month 1 = January

- mun sike nanpa **neten** = month 2 = February

- mun sike nanpa **nesen** = month 3 = March

- mun sike nanpa **nenan** = month 4 = April

- mun sike nanpa **nelen** = month 5 = May

- mun sike nanpa **nenun** = month 6 = June

- mun sike nanpa **nemen** = month 7 = July

- mun sike nanpa **nepen** = month 8 = August

- mun sike nanpa **nejen** = month 9 = September

- mun sike nanpa **newenin** = month 10 = October (compressed wen+nin → “10”)

- mun sike nanpa **newewen** = month 11 = November (compressed wen+wen → “11”)

- mun sike nanpa **neweten** = month 12 = December (compressed wen+ten → “12”)

Usage:

```
tenpo suno nanpa tu lon mun sike nanpa nesen la mi tawa.
= On day 2 of month 3 (2 March) I travel.

mi pali mute lon mun sike nanpa newewen.
= I work a lot in month 11 (November).

suno sike nanpa pen lon mun sike nanpa neweten la mi kama tomo mama.
= On a Sunday in month 12 (a Sunday in December) I go to my parents' house.
```

### Families that naturally start at zero
Most human-facing families (weekdays, months, school years) are easiest to understand with 1-based indexing, and nanpa-linja-n supports that directly, as shown above.

However, some families naturally start at zero in the outside world:

- programming arrays and lists (item 0, item 1, …),

- test or trial runs (run 0, run 1, …),

- floor systems or counters that label the street level as 0,

- any API or protocol that is explicitly 0-based.

nanpa-linja-n includes a dedicated root for the digit 0:

- nenin = 0

So the same pattern works immediately for 0-based sequences:

- [FAMILY] sike nanpa **nenin** = the member at index 0 of that sequence
- [FAMILY] sike nanpa **newen** = the member at index 1 of that sequence, and so on.

Examples:

```
pali alasa sike nanpa nenin  = test run #0
pali alasa sike nanpa newen  = test run #1

supa tomo sike nanpa nenin   = floor index 0 (ground floor, in a 0-based system)
supa tomo sike nanpa newen   = floor index 1 (first floor above ground)

ijo sike nanpa nenin         = element at index 0 in a list/array
ijo sike nanpa neten         = element at index 2
```

The recommendation is:

- Use 1-based indexing for ordinary human concepts (weekdays, months, “Round 2”, etc.).

- Use 0-based indexing only where the external system is already 0-based and that convention is important (code examples, APIs, certain building standards, trial numbers).

Within a given [FAMILY] sike, the choice (0-based or 1-based) should be stated once (or naturally assumed) and kept consistent. nanpa-linja-n’s **nenin** makes it easy to support 0-based indexing when it is appropriate, without changing the general pattern.

### Why this justifies the lexical cost
Once the digit roots exist, we get a general template:

- suno sike nanpa … → weekdays

- mun sike nanpa … → months

- musi sike nanpa … → game levels

- pali sike nanpa … → steps in a process

- lipu sike nanpa … → pages or slides

- musi utala sike nanpa … → competition rounds

- pali alasa sike nanpa nenin/newen/neten… → 0- or 1-based test runs

- ijo sike nanpa nenin/newen/neten… → 0- or 1-based indices in lists/arrays

All reuse the same **[family] sike nanpa [nanpa-linja-n]** structure.

So the argument is:

> If we pay the one-time price of adding **nanpa-linja-n** digit roots to the language, we not only get a precise way to name digit strings, but also gain a uniform, compact pattern for talking about positions in any ordered family (days, months, levels, modes, etc.) that already use numeric labels in the wider world. When those families are 1-based, we can match them directly; and when they are naturally 0-based, we can use **nenin** to match that convention just as cleanly. We can also put 'nenin' at the start of any index name (for example: 'musi utala sike nanpa nenilen'). The index labels are consistently single-word forms, which makes them predictable to read, say, and parse (all practical index labels are treated the same).


---

## toki musi pona

### musi nanpa

musi pi nanpa:

<img src="images/sitelen_multi_line_guess_number_with_modified_font.png" width="384"/>

o lukin sona e nanpa:

<img src="images/pi_e_phi_custom_digits_v4.png" width="384"/>

### musi sitelen

<img src="images/cartouche calculator 2026.png" width="768"/>

<img src="images/render_restaurant_menu.png" width="768"/>

<img src="images/toki pona bingo in real time.png" width="384"/>

\#~n


