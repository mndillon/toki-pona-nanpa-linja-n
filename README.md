# nanpa-linja-n — A Simple, Easy Way to Communicate Decimal Numbers in Toki Pona

## TL;DR:
**nanpa-linja-n** explained on a napkin:

<img src="images/TLDR Explained On Napkin.png" width="384"/>

**nanpa-linja-n** motivation:

<img src="images/Phone Number Conversation v1.png" width="384"/>

## Overview
**nanpa-linja-n** is a fully structured numeric system designed to integrate seamlessly with Toki Pona phonology, grammar, and semantics while providing a full-featured representation of numbers including integers, decimals, fractions, negatives, and large values.

This system emphasizes:
- digit-block compression
- concatenated number construction
- phonotactically valid roots
- compatibility with the Toki Pona lexicon


Toki Pona’s vocabulary is small, but not too small.
It’s big enough to be functional while still keeping the language simple.
This number system aims to follow that same idea: staying as simple as possible while still being practical for everyday use.
It’s not meant to replace anything—just to offer a tool that fits naturally into the language’s minimal design.


## Digit Words (0–9)
Each digit uses a distinct, single syllable, CVN form and does not conflict with any Toki Pona words:

```
0  non
1  wan
2  tun
3  ton
4  pon
5  lun
6  jun
7  pen
8  win
9  nen

10 = ten (if used by itself or wanon for digit-emphasis)
```

---

## Internal Digit-Block Rule
Inside a digit block (no separator present):

**Concatenate digit names and drop the final -n from every digit name except the last.**


### Examples

- 10 → wan non → **wanon**
- 46 → pon jun → **pojun**
- 70 → pen non → **penon**
- 100 → wan non non → **wanonon**
- 567 → lun jun pen → **lujupen**
- 234 → tun ton pon → **tutopon**
- 801 → win non wan → **winowan**
- 950 → nen lun non → **nelunon**


---

## Large Number Units

### Standard Units
Used when non-zero digits follow the block:

```
tasa = thousand
masa = million
wasa = billion
```

### Zero-Block Units  
Used only when *everything after* the block is zero:

```
tasan = exactly X thousand
masan = exactly X million
wasan = exactly X billion
```


### Any number of blocks
Used for any number of blocks, these separators have no specific values:

```
pasa  = more than one part of number to follow
pasan = last part of number follows
```


### Examples
```
1,234       → wan tasa tutopon
12,000      → watun tasan
3,000,000   → ton masan
30,000,000  → tonon masan
300,000,000 → tononon masan
3,000,000,000 → ton wasan
7,321,900   → pen masa totuwan tasa nenonon
123456789   → watutopolujupewinen (using block words is optional, but often very helpful for understanding)
123456789   → watun pasa topolun pasan jupewinen (pasa and pasan can be used anywhere to break up large numbers)
123456789   → watutopolun pasan jupewinen
123456789   → watuton pasa polun pasa jupewin pasan nen
2025        → tunotulun
2025        → tun tasa tulun
2025        → tunon pasan tulun
2025        → tun pasa non pasa tun pasan lun
3.141592    → ton pokala wapowalunetun
```

---

## Decimal Separator — pokala
**pokala** separates whole and decimal parts.

Rules:

- Whole part ends in full -n form
- Decimal block follows the digit-block rule

Examples:

```
0.5    → non pokala lun
3.75   → ton pokala pelun
12.04  → watun pokala nopon
37.9   → topen pokala nen
0.125  → non pokala watulun
```

---

## Fractions — kipisi
**kipisi** expresses fractions “over / divided by”.

Rule:

- Both numerator and denominator use full final -n
- Internal block compression applies

Examples:

```
1/2                 → wan kipisi tun
3/4                 → ton kipisi pon
5/8                 → lun kipisi win
567/890             → lujupen kipisi winenon
1,234 / 56          → wan tasa tutopon kipisi lujun
3 / 1,000,000,000   → ton kipisi wan wasan
```

---

## Negative Numbers — ike
Prefix **ike** before any number:

```
−5         → ike lun
−12        → ike watun
−0.4       → ike non pokala pon
−30,000    → ike tonon tasan
```

---

## Mixed Expressions

```
(3.75) / 4   → ton pokala pelun kipisi pon
3 / 4.75     → ton kipisi pon pokala pelun
1,234.567    → wan tasa tutopon pokala lujupen
0.5          → non pokala lun
1/2          → wan kipisi tun
5:38         → tenpo lun pokala towin
19:46:27     → tenpo wanen pokala pojun pokala tupen
```

---

## Design Rationale

### Digit Roots
- Unique syllables
- Easy to remember and use
- Very useful when speaking and hearing the digits of long values ( 5201 → lutunowan → 5201 )
- End in **-n** for structural consistency, for long digit sequences the end is clearly signaled
  - This works with the language syntax to enhance communication
    - Say "2010": "tun tasa wanon"
    - Say "2001" followed by "0": "tun tasa wan non"
    - Say "243-555-0169": "tupoton pasa lululun pasan nowajunen"
    - Screen readers for visually impaired users can communicate larger numbers with less cognitive load
    - Automated text-to-speech systems can communicate larger numbers with less cognitive load
  - The speaker wants to communicate **"1 2 3 4 5"**:
    - for counting,
      - might say: **"wan tun ton pon lun"**
    - for value 12,345,
      - might say: **"watun tasa topolun"**
    - for sequence of numbers, like an id,
      - might say: **"watutopolun"**
    - for 1-2-3-4-5 digit emphasis,
      - might say: **"wan pasa tun pasa ton pasa pon pasan lun"**
    - for breaking up long sequences with no change in value, (pasa/pasan can be used anywhere)
      - might say: **"watuton pasan polun"**
    - In all cases the listener has understood the speaker as communicating **"12345"**
- No conflict with Toki Pona vocabulary
- Where possible, respects the first syllable of existing Toki Pona digit names (from pu)
- Avoids using **k**, **m** and **s** in digit names to reduce overlap with delimiters (and other words)
- By avoiding using **k**, **m** and **s**, words are more easily identified as **nanpa-linja-n** numeric ( petuton → 723 )
- Respects the speaker’s freedom to choose how to express numbers:
  - Additive (**pu** style) numerals:
    - The speaker uses **pu** names ala, wan, tu, luka, mute, ale
    - The speaker thinks: 78 = 20 add 20 and 20 and 5 and 5 and 5 and 2 and 1
    - The speaker says (the way they think): mute mute mute luka luka luka tu wan
    - The listener recognises **pu** semantics
    - The listener understands: 78
  - Positional decimal (**nanpa-linja-n** style) numerals:
    - The speaker uses **nanpa-linja-n** digit names with concatenation and **-n** signalling the end of the number
    - The speaker thinks: 78 = 7 followed by 8
    - The speaker says (the way they think): pewin
    - The listener recognises **nanpa-linja-n** semantics (since no word collision and syntax is consistent)
    - The listener understands: 78
  - Any system that groups digits before speaking adds cognitive load for the speaker, because they must pre-determine consistent groupings before saying anything.  **nanpa-linja-n** works with the conventional digital markers using tasa/tasan
  - By contrast, speaking one digit at a time lets the speaker break long sequences anywhere without losing meaning.  **nanpa-linja-n** can break large numbers up using pasa/pasan
- Can be used as a drop-in replacement for (base 10) digits in dates, times, phone numbers, codes, and any context where precise numeric information is needed
- (Can be easily parsed with lex/yacc)
- (Yet another humble attempt at simply being functional, avoiding copy and paste and cognitive load)


### pokala / pakala
- Contain **k**, which no digit word has
- Do not end in **-n** signalling more of the number to follow
- Meaning evokes “next section/context” (poka la)
- Meaning evokes “broken” (at decimal point) (pakala)
- Can be used with tenpo for hour and minute delimiter

### kipisi
- Contains **k**, which no digit word has
- Does not end in **-n** signalling more of the number to follow
- Meaning evokes “division”
- Can use **kipisi ala** for multiply without getting confused with divide by zero

### ike
- Contains **k**, which no digit word has
- Does not end in **-n** signalling more of the number to follow
- Meaning evokes "negative"

### tasa / masa / wasa
- Contain **s**, which no digit word has
- Does not end in **-n** signalling more of the number to follow

### tasan / masan / wasan
- Contain **s**, which no digit word has
- All end in **-n** to signal end of number description
- Zero-block shortcuts for clear large numbers

### pasa / pasan
- Contain **s**, which no digit word has
- Meaning inspired by pana but with an **s**
- A bridge joining different parts of the whole numeric value
- pasa does not end in **-n** signalling more of the number to follow
- pasan ends in **-n** to signal that the last part of the number follows
- Have no value, only used to break up long sequences of digits

### sitelen pona (only suggestions)
- Could pragmatically use arabic numerals as numeric glyphs with a horizontal straight line at top and bottom of each glyph
- This alligns glyphs for numbers with the rectangular box used for proper names
- Glyphs for numerals should be distinct and not rely on observing subtle changes in the glyphs.
- Examples:
- <img src="images/0.png" width="32"/>&nbsp;<img src="images/1.png" width="32"/>&nbsp;<img src="images/2.png" width="32"/>&nbsp;<img src="images/3.png" width="32"/>&nbsp;<img src="images/4.png" width="32"/>&nbsp;<img src="images/5.png" width="32"/>&nbsp;<img src="images/6.png" width="32"/>&nbsp;<img src="images/7.png" width="32"/>&nbsp;<img src="images/8.png" width="32"/>&nbsp;<img src="images/9.png" width="32"/>&nbsp;
- <img src="images/horizontal 0.png" width="32"/>&nbsp;<img src="images/horizontal 1.png" width="32"/>&nbsp;<img src="images/horizontal 2 revised.png" width="32"/>&nbsp;<img src="images/horizontal 3 revised.png" width="32"/>&nbsp;<img src="images/horizontal 4.png" width="32"/>&nbsp;<img src="images/horizontal 5.png" width="32"/>&nbsp;<img src="images/horizontal 6.png" width="32"/>&nbsp;<img src="images/horizontal 7.png" width="32"/>&nbsp;<img src="images/horizontal 8.png" width="32"/>&nbsp;<img src="images/horizontal 9.png" width="32"/>&nbsp;
- The straight lines at the top and bottom of each glyph could be replaced with vertical lines at the left and right of each glyph to stack them vertically.
- So might have this glyph for 42,386.75 (numeric glyphs starting with nanpa surrounded in a rectangular box like a proper name and re-purposing poki and meso glyphs for separators):
- <img src="images/number 42386_75 glyph.png" width="320"/>

---

## Arithmetic Operations
Here we are moving away from describing numbers to describing simple arithmetic expressions.
This is not the main focus of this proposal.
Some of the suggestions below are inspired by [seximal] nasin nanpa suli, tan jan Emalan

### Equals: sama
- Contains **s**, which no digit word has
- Good candidate

### Addition: kepeken
- Contains **k**, which no digit word has
- Good candidate
- ton kepeken tun li sama lun

### Subtract: kepeken ala
- Contains **k**, which no digit word has
- Good candidate
- ton kepeken ala ike tun li sama lun

### Multiply: kipisi ala
- Contains **k**, which no digit word has
- Good candidate
- ton kipisi ala tun li sama jun

### Division: kipisi
- Contains **k**, which no digit word has
- Good candidate
- win kipisi ike tun li sama ike pon

### Power: sewi
- Contains **s**, which no digit word has
- Good candidate
- tun sewi ton li sama win
- pen tasan li sama pen kipisi ala ten sewi ton

Other mathematical expressions like log, ln, exp, roots, cos, pi (and maybe even powers) are better left in mathematical notation:

cos(2π) = 1

then described: tan nasin pi ilo nanpa la, cos(tun kipisi ala π) li sama wan

√9 = 3

tan nasin pi ilo nanpa la,  √nen li sama ton

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

- On https://sona.pona.la/wiki/nasin_nanpa_ali_ike list, **nanpa-linja-n** looks most closest to (at first glance):

  - [decimal] [humorous] kijetesantakalu polinpin, tan jan Kita (shameless self-promotion)

  - [decimal] nasin nanpa nimi, tan kijetesantakalu Iwan

  - [decimal] lojban, tan jan Tepo

  - how **nanpa-linja-n** compares to these (at first glance):

    - it uses the first syllable of the pu words for digits for better compatability (where possible), reducing cognative load

    - it uses less letters to describe digits, this leaves more letters for delimiters and also there is less chance of clashing with other vocabulary, so words can be immediately identified as describing numbers

    - it uses **-n** at the end of the base name for the digits (CVN format), so that single digit names are consistent with the descriptions of other numbers

    - it consistently uses the **-n** to indicate the end of numbers

    - it consistently uses **-n** to indicate the end of numerical structures that end with delimiters (tasan/masan/wasan)

    - its consistent use of **-n** makes it immediately clear when a numeric description ends, no matter how large the number. The listener spends little mental effort deciding whether the number is complete

    - while using similar principles, it provides a more consistent way to express numbers — including large ones — reducing learning effort and cognitive load on both speaker and listener


