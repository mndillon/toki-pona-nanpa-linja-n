# nanpa-linja-n and WCAG 2.2 Compatibility

## 1. What the claim is

The [README](README.md) claims that nanpa-linja-n can “enhance compatibility with WCAG 2.2.”

This is not a claim of formal conformance to a specific success criterion. It is a design claim:

- nanpa-linja-n makes long digit strings easier to perceive and understand via screen readers and text-to-speech (TTS)
- this directly supports [WCAG 2.2](https://www.w3.org/TR/WCAG22/)'s increased focus on cognitive accessibility and clear structure in content

In other words: the numeric notation is designed so assistive technologies can present it clearly, with less mental effort for the listener, particularly when the rest of the content is in Toki Pona.

---

## 2. What WCAG 2.2 is trying to improve

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) is an incremental update to the Web Content Accessibility Guidelines that adds nine new success criteria and strengthens accessibility for people with visual, mobility, and cognitive or learning disabilities, including in mobile contexts. For example, the W3C announcement and various overviews emphasise that the new criteria are meant to:

- Improve accessibility for users with cognitive and learning disabilities, as well as those with low vision and mobility impairments
- Reduce cognitive load in critical tasks such as authentication and navigation
- Make it easier to find, understand, and operate web content consistently

See, for example:

- W3C’s “WCAG 2.2 is a W3C Recommendation” news item
- High-level summaries of “What’s new in WCAG 2.2” from accessibility vendors and explainers

Taken together, these documents present WCAG 2.2 as primarily focused on:

- Users with cognitive, learning, and language impairments
- Mobile and low-vision users
- Reducing cognitive load in tasks, especially those involving numbers (authentication codes, forms, IDs, etc.)
- Making structure explicit in content so assistive technologies can convey it reliably
- Ensuring content is understandable and predictable in its language and patterns

nanpa-linja-n specifically targets numeric content in Toki Pona, which is a known weak spot for accessibility.

---

## 3. Accessibility problems without nanpa-linja-n

If you want WCAG-friendly Toki Pona content today, you essentially have two unsatisfactory options for “serious” numbers.

### 3.1 Raw Hindu-Arabic numerals

Using plain digits:

- Modern screen readers can read Hindu-Arabic numerals perfectly well, typically either:
  - as a cardinal number in the UI language (e.g. “two hundred forty-three”), or
  - as individual digits, depending on settings and context.
- However, in a Toki Pona context this can still cause issues:
  - the number words will usually be in another language (e.g. English), creating a language mismatch in the audio stream,
  - there is no explicit signal of whether a sequence is meant as a *quantity* or as an *identifier* (phone number, code, account ID, etc.),
  - listeners may have to infer grouping and semantics from context rather than from the text itself.

So the issue is not basic legibility. The issue is that raw digits provide very little structural or semantic guidance beyond “here is a number,” and screen readers will default to whatever reading model their locale and configuration dictate, which may not align well with a Toki Pona–first design.

### 3.2 Pure pu-style additive numerals

Using only traditional additive numerals, e.g.:

- `78` as “mute mute mute luka luka luka tu wan”

Problems:

- Very long in syllable count
- Encodes an additive decomposition (20+20+20+5+5+5+2+1), not a positional “7–8”
- Highly impractical for IDs, account numbers, coordinates, OTPs, etc.

For a screen-reader user, this is a long, conceptually heavy phrase that must be mentally converted back into digits. That is exactly the kind of unnecessary cognitive burden WCAG 2.2 and related cognitive accessibility guidance are trying to reduce (see, for instance, [Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/)).

---

## 4. How nanpa-linja-n helps screen readers and TTS

nanpa-linja-n redesigns numeric expression to be more accessible in audio.

### 4.1 One short, regular CVN root per digit

- Ten digit roots: `non, wan, tun, ton, pon, lun, jun, pen, win, nen`
- All are short, phonotactically regular, and easy to distinguish by ear
- For audio users, this is far easier to keep in working memory than long additive phrases

This aligns with cognitive accessibility recommendations that emphasise short, regular patterns and predictable structures in language and notation.

### 4.2 Digit-block compression with an audible terminator

- Inside a digit block, internal `-n` endings are dropped
- Only the final digit in the block keeps its `-n`
- That final nasal sound functions as an *audible terminator* for the digit string

For listeners:

- When they hear the final `-n`, they know “the sequence of digits ends here”
- This solves a frequent screen-reader problem: where does the number stop and the next word begin?

By providing this explicit, regular end-marker for a digit sequence, nanpa-linja-n supports the kind of clear information and relationships that WCAG requires to be programmatically determinable rather than only visually implied (see [Understanding SC 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)).

### 4.3 Dedicated separators and markers for numeric structure

nanpa-linja-n introduces specific tokens for structure:

- Group markers: `tasa/tasan`, `masa/masan`, `wasa/wasan`
- Block continuation vs final block: `pasa`, `pasan`
- Decimal marker: `pokala`
- Fraction marker: `kipisi`
- Negative sign: `ike`

All of these are ordinary Toki Pona–style words. A speech engine can read them as normal text, but their presence makes the *structure* of the number explicit:

- Grouping and hierarchy (thousands, millions, etc.)
- Where more digits follow vs where the last block ends
- Where the decimal point is
- How to correctly interpret sign and fractions

This structural information is directly available in the plain text, which is what assistive tech actually sees and exposes to users. This is in the spirit of SC 1.3.1, which requires information and relationships to be available beyond purely visual presentation.

---

## 5. Mapping nanpa-linja-n to WCAG 2.2 goals

### 5.1 Reduced cognitive load for numeric tasks

WCAG 2.2 introduces new criteria aimed at reducing mental effort for users, particularly in authentication and error-prone tasks. For example:

- [SC 3.3.8 Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum) explicitly aims to “make logins possible with less mental effort” and avoid requiring users to “solve, recall, or transcribe” complex information.
- The WCAG 2.2 updates are widely described as strengthening accessibility for people with cognitive and learning disabilities, in part by reducing “cognitive function tests” such as tricky captchas, complex passwords, and difficult one-time codes.

nanpa-linja-n supports this by:

- Encoding one-time codes, IDs, and other digit strings in a compact, regular audio form
- Providing a clear terminator and explicit structure so the listener:
  - hears a predictable pattern,
  - can map each syllable directly to one digit,
  - does not have to re-assemble an additive expression in their head.

Result: fewer steps in working memory and less chance of error for blind, low-vision, or cognitively impaired users. That is directly in line with the intent of SC 3.3.8 and related guidance around cognitive load.

### 5.2 Clear, machine-readable structure

WCAG requires that information and relationships not be conveyed by visual formatting alone (SC 1.3.1 “Info and Relationships”). The criterion states that relationships such as lists, headings, and groups must be programmatically determinable so that assistive technology can present them appropriately.

nanpa-linja-n:

- Encodes grouping and hierarchy using specific words (`tasa`, `masa`, `wasa`)
- Marks decimal points, fractions, and sign with unambiguous tokens (`pokala`, `kipisi`, `ike`)
- Uses the final `-n` as a consistent, phonological “end of digits” marker

This means:

- Assistive technologies can infer structure directly from the text, without guessing
- Screen readers can pause or change intonation exactly at logical boundaries
- Numeric information becomes more robust, predictable, and easier to interpret

That is exactly the kind of structured, non-visual encoding of relationships that SC 1.3.1 is about.

### 5.3 Language-appropriate, predictable reading

Because nanpa-linja-n is expressed entirely in Toki Pona–style words (with some new lexicon):

- A Toki Pona voice or TTS profile can read numbers without switching to another language
- Users get a consistent dialect, rhythm, and sound pattern across the whole page
- The numeric system feels native to the language instead of bolted on

This aligns with the WCAG principle of “Understandable”, which (as summarised in various explainers) is about clear language, predictable behavior, and guidance that supports users with cognitive, language, and learning disabilities. Predictability of notation and language helps these users understand and operate content without surprises.

---

## 6. Summary: why the WCAG 2.2 claim is reasonable

In one concise statement:

> **nanpa-linja-n** enhances WCAG 2.2 compatibility because it encodes digit strings in a phonologically regular, structurally explicit, and unambiguous way that is tuned for Toki Pona speech, and that can in many real-world Toki Pona contexts be easier for screen-reader and text-to-speech users to interpret than either traditional additive Toki Pona numerals or raw Hindu-Arabic numerals read in a different language with no explicit structural cues. By reducing cognitive load, exposing number structure directly in the text, and keeping numeric expressions in the same language and rhythm as the rest of the content, nanpa-linja-n supports the accessibility goals that WCAG 2.2 is designed to advance, especially for users with visual, cognitive, or language impairments.
