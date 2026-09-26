# nanpa-linja-n

This repository contains the frozen **nanpa-linja-n Protocol v1.1.0** and eight reference implementations:

- JavaScript
- TypeScript
- Node.js
- Python
- Rust
- Go
- Dart
- Java

The protocol is normative. The reference implementations demonstrate conformance with the protocol and provide platform-appropriate parsing and production/full-rendering APIs.

## Repository structure

```text
nanpa-linja-n_reference_libraries_v1.1.0/
├── protocol/
│   └── nanpa-linja-n-protocol-v1.1.0.zip
└── reference_implementations/
    ├── javascript/
    │   └── nanpa-linja-n-javascript-reference-for-protocol-v1.1.0.zip
    ├── typescript/
    │   └── nanpa-linja-n-typescript-reference-for-protocol-v1.1.0.zip
    ├── nodejs/
    │   └── nanpa-linja-n-nodejs-reference-for-protocol-v1.1.0.zip
    ├── python/
    │   └── nanpa-linja-n-python-reference-for-protocol-v1.1.0.zip
    ├── rust/
    │   └── nanpa-linja-n-rust-reference-for-protocol-v1.1.0.zip
    ├── go/
    │   └── nanpa-linja-n-go-reference-for-protocol-v1.1.0.zip
    ├── dart/
    │   └── nanpa-linja-n-dart-reference-for-protocol-v1.1.0.zip
    └── java/
        └── nanpa-linja-n-java-reference-for-protocol-v1.1.0.zip
```

## Reference implementations at a glance

| Reference | Implementation model | Main test command |
| --- | --- | --- |
| JavaScript | Canonical browser JavaScript reference | `./tools/run_javascript_regression.sh` |
| TypeScript | Strongly typed facade over the bundled canonical JavaScript runtime | `./tools/run_typescript_regression.sh` |
| Node.js | Canonical JavaScript runtime hosted directly under Node.js | `./tools/run_nodejs_regression.sh` |
| Python | Native Python implementation | `./tools/run_python_regression.sh` |
| Rust | Native Rust implementation | `./tools/run_rust_regression.sh` |
| Go | Native Go implementation | `./tools/run_go_regression.sh` |
| Dart | Native Dart implementation | `./tools/run_dart_regression.sh` |
| Java | Native Java 21 implementation | `./tools/run_java_regression.sh` |

The native implementations reproduce protocol and rendering behavior using platform-appropriate graphics/text APIs. They are not expected to have source-code structure identical to JavaScript, but their observable parser, render-plan, cartouche/tally, and output behavior is qualified against the protocol and the frozen JavaScript-derived renderer profile.

## Protocol v1.1.0

Extract the protocol release and verify it before using a reference implementation as a compatibility target:

```bash
unzip nanpa-linja-n-protocol-v1.1.0.zip
cd nanpa-linja-n-protocol-v1.1.0
python verify_release.py
```

Primary protocol documents:

```text
SPEC.md
API.md
CONFORMANCE.md
RENDERING-PROFILE.md
PARSER-RENDERER-PROFILE.md
VERSIONING.md
CHANGELOG.md
README.md
```

Use `SPEC.md` as the primary protocol specification. `PARSER-RENDERER-PROFILE.md` records the current v1.1 parser/renderer behavior layered on the retained Core-v1 corpus. The bundled language-neutral conformance material is the compatibility target.

Current v1.1 qualification authority includes:

```text
nanpa-linja-n Protocol v1.1.0
Core-v1 corpus: 320 parser / 15 renderer / 9 API / 8 equivalence groups
1030 frozen Core-v1 checks
Parser/Renderer Profile v1.1: 16 NanpaParser smoke cases
Canonical syntax: 28 cases + 5 production-adapter cases
Canonical full renderer: 254 cases
Production render-plan oracle: 16 logical cases × 8 fonts = 128 expectations
```

Protocol v1.1.0 retains the frozen Core-v1 source authority while adding the current parser/renderer profile, production-font manifest, public v1.1 numeric facade behavior, and vector-output requirements.

## Fonts: required files, manifest and directory layout

A first-time user does **not** select a font by `.ttf`/`.otf` filename and does not need an operating-system font family called `nasinNanpa`, `linjaPona`, and so on. The public `font` option is a logical **manifest `fontKey`**. The manifest tells the renderer which real file/family, parser mode, render adapter, literal-cartouche role, tally mode, and cartouche settings belong to that key.

The eight production font keys are:

```text
nasinNanpa
sitelenSeliKiwen
fairfaxHd
fairfaxPonaHd
linjaPona
linjaSike
nasinSitelenPuMono
linjaLipamanka
```

### The v1.1 font authority

Protocol v1.1 reference packages use the current production-font manifest together with the supplied `fonts.zip`/equivalent packaged font assets. **Do not hard-code old companion filenames.** The manifest and bundled font archive are authoritative.

The v1.1 profile has:

```text
8 production font records
5 production render-adapter IDs
4 UCSUR-tally configurations
4 renderer-manual-tally configurations
inline vulgar-fraction/cartouche scaling enabled
legacy ss12/ss13/ss14 production scaling disabled
```

There must be no active production dependency on OpenType `ss12`, `ss13`, or `ss14`. Inline cartouche scaling uses the accepted fraction controls `¼`, `⅓`, `½`, `⅔`, and `¾`; ordinary cartouches also support the approved ASCII aliases `1/4`, `1/3`, `1/2`, `2/3`, and `3/4`.

### What one manifest entry means

A production manifest entry normally defines these roles:

| Manifest field | Purpose |
| --- | --- |
| `fontKey` | Public logical name passed to the library, for example `nasinNanpa`. |
| `baseFamily` / `baseFilename` | Main sitelen pona face/file for ordinary glyph text and ordinary cartouches. |
| `companionFamily` / `companionFilename` | Numeric-cartouche role. In the current v1.1 set the base and companion roles may intentionally reference the same updated font file. |
| `literalCartoucheFamily` | Face used for exact literal/Latin cartouche content such as `["HELLO"]`. |
| `literalCartoucheFilename` / `literalCartoucheUrl` | Optional separate file for that literal-cartouche face. |
| `parserMode` | Text grammar appropriate for the selected font. Normally selected automatically with the font record. |
| `renderAdapterId` / `renderAdapterSettings` | Font-specific translation needed before shaping for fonts whose native behavior differs from canonical UCSUR input. |
| `settings.cartoucheTallyMode` | Chooses native UCSUR tally handling or renderer-owned manual tallies. |
| `settings.cartoucheVulgarFractions` | Enables the current inline vulgar-fraction/cartouche scale controls. |
| `settings.emulateLegacyCartoucheScaling` | Must be `false` for the v1.1 production profile; legacy `ss12`/`ss13`/`ss14` scaling is not used. |

A call such as:

```text
font = nasinNanpa
```

means: **find the manifest record whose `fontKey` is `nasinNanpa`, then use the faces, adapter, tally mode, and renderer settings named by that record**.

### Current production font files

The current v1.1 production manifest resolves the eight keys as follows. Base and companion roles intentionally use the same updated file in the current profile:

| `fontKey` | Base/companion file | Tally mode | Literal-cartouche source |
| --- | --- | --- | --- |
| `nasinNanpa` | `nanpa-linja-n-nasin-nanpa-liberation-sans-punctuation-mapping-fixed-ascii-vulgar-cartouche-only.ttf` | UCSUR | separate `nanpa-linja-n-nasin-nanpa-liberation-sans-literal.ttf` |
| `sitelenSeliKiwen` | `sitelenselikiwenjuniko-latin-ligatures-compatible-punctuation-mapping-fixed-ascii-vulgar-cartouche-only-state-continuity-fixed.ttf` | UCSUR | reuses `SSK-Juniko` |
| `fairfaxHd` | `FairfaxHD-compatible-punctuation-mapping-fixed.ttf` | UCSUR | reuses `fairfaxHd` |
| `fairfaxPonaHd` | `FairfaxPonaHD-compatible-punctuation-mapping-fixed-ascii-fraction-cartouche-aliases.ttf` | UCSUR | reuses `fairfaxPonaHd` |
| `linjaPona` | `linja-pona-n-epiku-majuna-fixed-corrected.otf` | manual | separate `nanpa-linja-n-nasin-nanpa-liberation-sans-literal.ttf` |
| `linjaSike` | `linja-sike-5-epiku-fixed.otf` | manual | separate `nanpa-linja-n-nasin-nanpa-liberation-sans-literal.ttf` |
| `nasinSitelenPuMono` | `NasinSitelenPuMono-majuna-fixed.otf` | manual | separate `nanpa-linja-n-nasin-nanpa-liberation-sans-literal.ttf` |
| `linjaLipamanka` | `linjalipamanka-epiku-fixed.otf` | manual | separate `nanpa-linja-n-nasin-nanpa-liberation-sans-literal.ttf` |

For release packaging, use the manifest shipped with that release rather than copying this table into application logic; the manifest is the machine-readable authority.

### Additional support fonts

The canonical browser/vector asset set also contains support faces such as:

```text
PatrickHand-Regular.ttf
LiberationSans-Regular.ttf
LiberationSerif-Regular.ttf
LiberationMono-Regular.ttf
```

They are **not additional production `fontKey` records**. They provide literal-text and deterministic vector-export roles. Keep the support assets when copying a packaged font set wholesale.

### Manual-tally versus font-glyph tally configurations

The four renderer-manual configurations are:

```text
linjaPona
linjaSike
nasinSitelenPuMono
linjaLipamanka
```

For those configurations, U+F199E must not be inserted as the tally into the shaped font run. The renderer owns tally geometry and halo backing. The other four production configurations use their native UCSUR tally behavior as directed by the manifest.

### First-time setup rule

For a basic application, do not manually choose `baseFilename`, `companionFilename`, or tally mode. Do this instead:

1. create/open the language facade;
2. let the implementation discover or unpack its packaged v1.1 font assets;
3. pass one of the eight `fontKey` values, for example `nasinNanpa`;
4. parse or render text.

The manifest is the configuration contract between the font key and the renderer.

## Common regression and visual-audit workflow

Every reference package includes a language-specific regression wrapper and the same two top-level visual audit commands:

```bash
./tools/run_<language>_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

The exact regression command is listed in the table above.

The `font` option used throughout the APIs is a **production font key**, not a filesystem path and not necessarily the font's internal family name. The eight valid canonical keys are the names listed above, such as `nasinNanpa` and `linjaPona`. Each reference implementation reads the production font manifest and resolves that key to the complete font configuration for the selected style.

For example, the manifest entry for `nasinNanpa` associates that key with its base face, numeric-cartouche companion face, optional literal-cartouche face, parser mode, render adapter, and renderer settings such as manual-tally behavior. A call such as:

```text
font = nasinNanpa
```

therefore means “use the production manifest entry whose `fontKey` is `nasinNanpa`”; it does **not** mean “ask the operating system for a font family named `nasinNanpa`”. The renderer then uses the manifest's `baseFilename`/`baseFamily` for normal sitelen pona text and ordinary-cartouche work, the `companionFilename`/`companionFamily` for nanpa-linja-n numeric cartouches, and any additional manifest settings required by that font pair.

The physical form of the packaged font assets differs by binding: some use an asset directory directly, Rust and Go embed or materialize packaged bytes, Dart discovers its packaged assets, and Java v1.1 uses the bundled `resources/fonts.zip`. **Normal Java v1.1 use does not require `NANPA_FONT_DIR`.** The language sections below describe any audit-only or development overrides.

### Numeric visual audit

`./tools/export_visual_pngs.sh` writes numeric-cartouche audit images under `test-output/`. For each of the eight production fonts it writes:

```text
<font>-full.png
<font>-full-white.png
<font>-abbreviated.png
<font>-abbreviated-white.png
```

That is **32 numeric PNGs** in total.

### Ordinary-cartouche/tally visual audit

`./tools/export_cartouche_audit.sh` writes the ordinary-cartouche audit under `test-output/cartouche-audit/`. For each production font it writes:

```text
<font>--ordinary-cartouche.png
<font>--ordinary-cartouche-halo-red.png
<font>--ordinary-cartouche-tallies.png
<font>--ordinary-cartouche-tallies-halo-red.png
<font>--ordinary-cartouche-contact.png
```

That is **40 ordinary-cartouche PNGs** in total. Running both visual exporters therefore produces **72 PNGs**.

The ordinary audit uses `[jan pona]` and `[jan pona,,]`. For the four manifest-designated manual-tally configurations, visually confirm that:

- tally X positions do not move when halo is enabled;
- the foreground tally strokes remain aligned with the non-halo version;
- the halo does not overwrite the cartouche bottom rule;
- the halo is a backing around the tally group rather than a replacement tally glyph;
- U+F199E is not shaped for a manual-tally font.

The visual exporters are inspection tools. They do not replace the automated protocol/full-renderer regression suite.

## Parsing, document ASTs, and `astToText`

Rendering does **not** require a separate parse call. The normal `render...()` methods accept source text and parse it internally. Call a parser when the application needs information *about* the source before rendering, or when it needs to inspect or edit the document structure.

There are two parser roles in the reference implementations:

1. **Core numeric/semantic parsing** — answers questions such as “is this a time or date?”, “what proper name does it encode?”, “what Toki Pona words/code points represent it?”, and “what is the canonical display/number-code form?”
2. **Full-document AST parsing** — splits renderer source into document lines and segments such as ordinary text, `[ ... ]` cartouches, quoted text, and `img(...)` descriptors. This is the AST used by `astToText`.

The concrete method names differ slightly by language:

| Reference | Numeric/semantic parser | Full-document AST parser | AST back to source |
| --- | --- | --- | --- |
| JavaScript | `NanpaParser.parseNumber(...)` | `await nanpa.parse(...)` | `nanpa.astToText(ast)` |
| TypeScript | bundled `parser.parseNumber(...)` | `await nanpa.parse(...)` | `nanpa.astToText(ast)` |
| Node.js | `NanpaParser.parseNumber(...)` | `await nanpa.parse(...)` | `nanpa.astToText(ast)` |
| Python | `nanpa.parse(...)` / `NanpaParser.parseNumber(...)` | `nanpa.parse_input(...)` / `parseInput(...)` | `nanpa.ast_to_text(ast)` / `astToText(ast)` |
| Rust | `nanpa.parse(...)` | `nanpa.parse_input(...)` | `nanpa.ast_to_text(...)` / `astToText(...)` |
| Go | `renderer.Parse(...)` | `renderer.ParseInput(...)` | `renderer.AstToText(...)` |
| Dart | `nanpa.parse(...)` / `parseNumber(...)` | `nanpa.parseInput(...)` | `nanpa.astToText(...)` |
| Java | `nanpa.parse(...)` | `nanpa.parseInput(...)` | `nanpa.astToText(...)` |

Protocol v1.1 also standardizes the public numeric-conversion surface. `parseNumber`/the idiomatic equivalent returns the parsed numeric structure together with representation alternatives. `astToText` supports these `numericOutput` targets where exposed by the binding:

```text
source
properName
#~
fullCartouche
abbreviatedCartouche
```

`nnpPonaFormat` is an optional output flag for emitting ordinary nasin nanpa pona forms where possible. These are additive conversion APIs; the normal renderer still accepts source text directly.

### A useful numeric-parser example

For numeric input, the parser is most useful when the application reads the semantic fields rather than merely printing the entire result object. The canonical JavaScript parser, for example, can be used like this:

```js
import { NanpaParser } from './src/nanpa-linja-n.js';

const value = NanpaParser.parseNumber('12:30', {
  numericMode: 'uniform',
  relaxedNanpaLinjanParsing: true,
  relaxedNanpaLinjanRendering: true,
  nanpaColonParsing: true,
  nanpaColonRendering: true,
});

if (!value) throw new Error('Invalid nanpa-linja-n numeric input');

console.log('display:', value.displayValue);
console.log('semantic kind:', value.semanticKind); // "time"
console.log('is time:', value.isTime);
console.log('is date:', value.isDate);
console.log('proper name:', value.properName);
console.log('Toki Pona words:', value.tpWords);
console.log(
  'UCSUR:',
  value.ucsurCodepoints.map(cp => `U+${cp.toString(16).toUpperCase()}`)
);
```

The exact return type is language-specific, but the purpose is the same: use the parser when the program needs the interpreted numeric structure, canonical representation, words/code points, date/time classification, validation result, or related metadata. Rendering the same source does not require this preliminary parse.

### A useful full-document parser example

The full-document parser is useful when the program needs to understand the *structure* of renderer source:

```js
const parsed = await nanpa.parse(
  'mi toki e ni: [jan pona,,] "Hello"'
);

for (const [lineIndex, line] of parsed.ast.lines.entries()) {
  console.log(`line ${lineIndex}`);

  for (const segment of line.children) {
    console.log({
      kind: segment.kind,
      value: segment.value,
      sourceStart: segment.sourceStart,
      sourceEnd: segment.sourceEnd,
    });
  }
}
```

That lets an editor, syntax-aware UI, validator, search tool, or transformation program distinguish ordinary text from a cartouche or quote without trying to rediscover the renderer grammar itself.

### Editing an AST with `astToText`

`astToText` is the reverse bridge from the full-document AST back to renderer source. It is intentionally **not** a second rendering path. The workflow is:

```text
source text
    -> full-document parser
    -> inspect/edit DocumentAst
    -> astToText
    -> edited source text
    -> existing renderToCanvas/Png/Svg/Pdf path
```

For example, in JavaScript:

```js
const parsed = await nanpa.parse(
  'jan   pona [ jan  pona,, ]'
);

const bracket = parsed.ast.lines
  .flatMap(line => line.children)
  .find(segment => segment.kind === 'bracket');

if (!bracket) throw new Error('No bracket/cartouche segment found');

bracket.value = ' jan  suno,, ';

const editedSource = nanpa.astToText(parsed.ast);
console.log(editedSource);
// jan   pona [ jan  suno,, ]

const png = await nanpa.renderToPng(editedSource, {
  font: 'linjaPona',
  fontSize: 56,
});
```

The normal editable content is:

| AST segment | Normally editable content |
| --- | --- |
| `text` | its text/value, including spaces and tabs |
| `bracket` | the contents inside `[ ... ]`, including internal spacing and tally commas |
| `quote` | quoted value plus its opening/closing quote delimiters |
| `image` | descriptor fields such as `src`, `w`, `h`, `alt`, `valign`, `wriggle`, and `transparent` |
| raw UCSUR, where exposed | the stored code-point sequence |

Structural/source metadata such as node `kind`/`type`, indexes, `sourceStart`, `sourceEnd`, `sourceText`, `normalizedInput`, and sentence indexes should normally be treated as parser metadata rather than editable content. `sourceLineIndex` is retained because `astToText` uses it to reconstruct physical source lines when `breakLinesAtFullStops` split one original line into several AST lines.

JavaScript, TypeScript, Node.js, Rust, and Go expose AST values that can be edited directly where their type system permits. Python uses its dataclass replacement pattern, while Java and Dart use replacement immutable records/objects. The language package README shows the idiomatic edit pattern for that binding.

### What `astToText` preserves

`astToText` aims to preserve the source layout that is retained by the AST:

- multiple spaces and tabs in text segments;
- blank physical lines;
- spaces inside `[ ... ]`;
- tally commas stored inside bracket content;
- straight or curly quote delimiters;
- physical line boundaries, including reconstruction after `breakLinesAtFullStops`.

It is **not** a promise of byte-for-byte reproduction of the original file. In particular:

- CRLF input is normalized to LF by the parser;
- aliases or other parser normalization may already have changed the retained source representation;
- `img(...)` is stored as a structured descriptor, so it is serialized back in a canonical valid form rather than preserving the exact original argument spacing/quoting.

After an AST has been edited, original source offsets may be stale. If an application needs fresh `sourceStart`/`sourceEnd` mappings for the edited source, serialize and parse again:

```js
const editedSource = nanpa.astToText(parsed.ast);
const reparsed = await nanpa.parse(editedSource);
```

This API is deliberately additive: existing applications that render source text directly do not need to use `astToText`, and the existing rendering path does not round-trip through it internally.

---

## JavaScript reference implementation

The JavaScript package is the canonical browser renderer/parser reference.

### Requirements

- Node.js 20 or newer
- npm
- a Chromium-family browser for browser/rendering regression

Set `NANPA_CHROMIUM=/absolute/path/to/browser` when the browser is not discoverable automatically.

### Install and test

```bash
unzip nanpa-linja-n-javascript-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-browser-font-regression-v0.1.3-reference
npm install

# The browser regression uses the bundled assets directly. The two visual
# exporters require NANPA_FONT_DIR, so point it at this package's bundled set.
export NANPA_FONT_DIR="$PWD/assets/fonts"

./tools/run_javascript_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

The regression wrapper runs `npm test`. Useful lower-level checks include:

```bash
npm run verify:references
npm run browser:which
npm run test:browser
npm run test:assets
npm run test:svg
```

The canonical JavaScript renderer/parser source remains:

```text
reference/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

Do not rename that file when comparing or maintaining reference implementations.

### Font files and font-key resolution

The JavaScript archive contains the production font files under `assets/fonts/` together with `assets/fonts/preloaded-font-pairs.manifest.json`. `NanpaLinjaN.create()` uses that manifest by default, relative to the module. The browser font-pair controller turns each manifest record into a preset and registers the referenced base/companion/literal faces with the browser `FontFace` API.

When code specifies:

```js
{ font: 'nasinNanpa' }
```

the facade looks up the manifest record whose `fontKey` is `nasinNanpa`. The manifest then supplies the actual font families and files; the application does not need those fonts installed system-wide. The same applies to `linjaPona`, `linjaSike`, and the other production keys.

For the supplied visual-audit scripts, `NANPA_FONT_DIR` is an explicit filesystem source for the same files. When testing the untouched archive, use:

```bash
export NANPA_FONT_DIR="$PWD/assets/fonts"
```

### Basic usage

```js
import { NanpaLinjaN } from './src/nanpa-linja-n.js';

const nanpa = await NanpaLinjaN.create();

// Parse when the application needs the document structure.
const parsed = await nanpa.parse(
  'mi toki e ni: [jan pona,,] "Hello"'
);
for (const line of parsed.ast.lines) {
  console.log(line.children.map(segment => ({
    kind: segment.kind,
    value: segment.value,
  })));
}

// Rendering itself does not require a separate parse call.
const canvas = await nanpa.renderToCanvas('[jan pona,,]', {
  font: 'linjaPona',
  fontSize: 56,
});
document.body.append(canvas.canvas);

const png = await nanpa.renderToPng('123.45', {
  font: 'linjaPona',
});
console.log(png.width, png.height, png.bytes);
```

Main facade methods include:

```text
NanpaLinjaN.create()
parse()
astToText()
buildRenderPlan()
render()
renderToCanvas()
renderToPng()
renderToSvg()
renderToPdf()
listFonts()
getFontInfo()
```

---

## TypeScript reference implementation

The TypeScript package is a strongly typed facade around the bundled canonical JavaScript production runtime. It does not independently reinterpret the renderer algorithms.

### Requirements

- Node.js 18 or newer
- npm
- a Chromium-family browser for graphical regression

### Install and test

```bash
unzip nanpa-linja-n-typescript-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-typescript-reference-for-protocol-v1.1.0
npm install

# The visual exporters require an explicit font directory.
export NANPA_FONT_DIR="$PWD/runtime/assets/fonts"

./tools/run_typescript_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

The regression wrapper runs `npm test`, which includes build/type checks, bundled-runtime integrity checks, protocol tests, export-parity tests and browser rendering tests.

Useful individual commands:

```bash
npm run build
npm run typecheck
npm run verify:runtime
npm run test:protocol
npm run test:browser
```

### Font files and font-key resolution

The TypeScript package carries the canonical runtime assets under `runtime/assets/fonts/`, including `preloaded-font-pairs.manifest.json`. Its typed facade delegates font selection to the bundled canonical JavaScript runtime, so `font: 'nasinNanpa'` is resolved through the same manifest `fontKey` mechanism as JavaScript.

The manifest maps the key to the real base, companion and optional literal-cartouche files/families plus adapter and tally settings. The caller therefore selects a logical production font key, not a `.ttf`/`.otf` filename.

For the supplied visual exporters use the bundled directory explicitly:

```bash
export NANPA_FONT_DIR="$PWD/runtime/assets/fonts"
```

No system-wide installation of the production fonts is required.

### Basic usage

```ts
import { NanpaLinjaN } from 'nanpa-linja-n-typescript';

const nanpa = await NanpaLinjaN.create();

const parsed = await nanpa.parse(
  'mi toki e ni: [jan pona,,] "Hello"'
);

for (const line of parsed.ast.lines) {
  console.log(line.children?.map(segment => ({
    kind: segment.kind,
    value: 'value' in segment ? segment.value : undefined,
  })));
}

// A parsed AST can be serialized back to valid renderer source.
console.log(nanpa.astToText(parsed.ast));

const png = await nanpa.renderToPng('[jan pona,,]', {
  font: 'linjaPona',
  fontSize: 56,
});

console.log(png.bytes);

const svg = await nanpa.renderToSvg('2026-09-13', {
  font: 'linjaSike',
});
console.log(svg.svg);
```

Advanced typed exports are available from `nanpa-linja-n-typescript/runtime`, `/advanced`, and the typed `/reference/...` subpaths.

---

## Node.js reference implementation

The Node.js package runs the canonical JavaScript parser, renderer, font-pair controller, facade and vector exporter directly under Node.js without Chromium. Node-specific code is confined to the platform adapter.

### Requirements

- Node.js 20 or newer
- npm
- a platform supported by `skia-canvas` 3.0.8

The production fonts and vector WASM are bundled. `NANPA_FONT_DIR` is optional unless you deliberately want to audit an external font copy.

### Install and test

```bash
unzip nanpa-linja-n-nodejs-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-nodejs-reference-for-protocol-v1.1.0
npm install

# Optional for normal use, but setting it makes the tested font source explicit.
export NANPA_FONT_DIR="$PWD/assets/fonts"

./tools/run_nodejs_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

`run_nodejs_regression.sh` also installs the declared Node dependency automatically when necessary. It does not launch Chromium; browser parity is checked against the frozen canonical browser oracle.

### Font files and font-key resolution

The Node.js archive bundles `assets/fonts/preloaded-font-pairs.manifest.json` and the production font binaries. The Node platform adapter defaults to that directory. If `NANPA_FONT_DIR` is set, it uses that directory instead; if the external directory does not contain its own manifest, the bundled manifest is retained and its filenames are resolved against the external directory.

For the archive itself, the explicit test setting is:

```bash
export NANPA_FONT_DIR="$PWD/assets/fonts"
```

`font: 'nasinNanpa'` is still a manifest `fontKey`. The Node adapter resolves the manifest's actual font filenames and registers/loads those files for the canonical renderer; `nasinNanpa` is not treated as an operating-system font-family name.

### Basic usage

```js
import { writeFile } from 'node:fs/promises';
import { NanpaLinjaN } from './src/node.js';

const nanpa = await NanpaLinjaN.create();

const parsed = await nanpa.parse(
  'mi toki e ni: [jan pona,,] "Hello"'
);
for (const line of parsed.ast.lines) {
  console.log(line.children.map(segment => ({
    kind: segment.kind,
    value: segment.value,
  })));
}

const roundTripSource = nanpa.astToText(parsed.ast);
console.log(roundTripSource);

const plan = await nanpa.buildRenderPlan('[jan pona,,]');
console.log(plan.plan);

const png = await nanpa.renderToPng('[jan pona,,]', {
  font: 'nasinNanpa',
  fontSize: 56,
  paddingPx: 18,
});
await writeFile('cartouche.png', png.bytes);

const svg = await nanpa.renderToSvg('2026-09-13', {
  font: 'linjaSike',
});
await writeFile('date.svg', svg.svg);

const pdf = await nanpa.renderToPdf('123.45');
await writeFile('number.pdf', pdf.bytes);

await nanpa.destroy();
```

Parser-only use is also available:

```js
import { NanpaParser } from './src/node.js';

console.log(NanpaParser.parseNumber('123.45', {
  numericMode: 'uniform',
  relaxedNanpaLinjanParsing: true,
}));
```

---

## Python reference implementation

The Python package is a native Python implementation. It does not execute JavaScript at runtime; the canonical JavaScript material is retained as qualification evidence/oracle data.

### Requirements

- Python 3.10 or newer
- Pillow 9+ with RAQM/HarfBuzz support
- fontTools 4.40+
- CairoSVG 2.7+ for vector PDF output
- system HarfBuzz (`libharfbuzz`) for complete-run shaping/caret geometry

### Install and test

```bash
unzip nanpa-linja-n-python-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-python-reference-for-protocol-v1.1.0
python -m pip install .

# The regression suite has bundled/package assets; the visual exporters require
# NANPA_FONT_DIR explicitly. In the source archive use the top-level fonts/.
export NANPA_FONT_DIR="$PWD/fonts"

./tools/run_python_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

The regression wrapper runs the complete configured Python gate, including the retained 1030-check Core-v1 corpus, unit tests, differential checks, production-font goldens and Full Renderer Profile qualification.

The underlying commands can also be run directly:

```bash
python scripts/run_all.py
python scripts/run_full_renderer_profile.py
```

### Font files and font-key resolution

The Python distribution includes its production assets inside `nanpa_linja_n/assets/fonts/`. `NanpaLinjaN.create()` with no arguments loads the packaged `preloaded-font-pairs.manifest.json` and resolves the font files from that package asset directory. The source archive also contains a top-level `fonts/` copy used by regression/audit tooling.

For the supplied visual exporters, set:

```bash
export NANPA_FONT_DIR="$PWD/fonts"
```

That environment variable is for the audit helper; the normal high-level Python facade does **not** need it when using the packaged assets. In application code, `font="nasinNanpa"` is looked up in the manifest. Python then obtains the real base/companion/literal file paths from that record and passes those files to its shaping/raster/vector backends.

Advanced callers can override the source-tree asset root through `project_root`/`manifest_path`, but normal callers should use the bundled package assets.

### Basic usage

```python
from pathlib import Path
from nanpa_linja_n import NanpaLinjaN

nanpa = NanpaLinjaN.create()

parsed = nanpa.parse("12:30")
print("display:", parsed["displayValue"])
print("semantic kind:", parsed["semanticKind"])
print("proper name:", parsed["properName"])
print("Toki Pona words:", parsed["tpWords"])
print("UCSUR code points:", parsed["ucsurCodepoints"])

# Stable numeric facade.
Path("number.png").write_bytes(
    nanpa.render_to_png("123.45", font="linjaPona")
)

# Full-document renderer: ordinary text/cartouches + numeric content.
text = 'mi toki e ni: [jan pona,,] 123.45 "Hello"'
plan = nanpa.build_full_render_plan(text)
print(plan)

Path("mixed.png").write_bytes(nanpa.render_full_to_png(text))
Path("mixed.svg").write_text(nanpa.render_to_svg(text), encoding="utf-8")
Path("mixed.pdf").write_bytes(nanpa.render_to_pdf(text))
```

For document editing, use `parse_input(...)` to obtain the full `DocumentAst`, edit/replace the relevant segment records, then call `ast_to_text(...)` before using the existing renderer. `astToText(...)` is also provided as the JavaScript-style alias.

The full-document API also exposes JavaScript-style aliases such as `parseInput`, `astToText`, `buildRenderPlan`, `renderToCanvas`, `renderToPng`, `renderToSvg` and `renderToPdf`.

---

## Rust reference implementation

The Rust package is a native Rust implementation with the frozen Core-v1 parser/API plus production and full-document rendering.

### Requirements

- Rust toolchain with Cargo and Edition 2024 support
- Python 3 for the source/integrity helper checks used by the regression wrapper

### Build and test

```bash
unzip nanpa-linja-n-rust-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-rust-reference-for-protocol-v1.1.0

# No NANPA_FONT_DIR export is used by the Rust reference. The manifest and
# production font bytes are compile-time embedded from $PWD/fonts/.
./tools/run_rust_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

The regression wrapper forces a clean package rebuild, runs source/integrity checks, Cargo checks/tests, the 64 semantic diagnostics and the Full Renderer Profile gate.

### Font files and font-key resolution

Rust deliberately does **not** use `NANPA_FONT_DIR`. `fonts/preloaded-font-pairs.manifest.json` is included with `include_str!`, and the production `.ttf`/`.otf` files are included with `include_bytes!`. They therefore become compile-time assets in the Rust binary.

The source assets live at:

```text
fonts/
fonts/preloaded-font-pairs.manifest.json
```

`font: "nasinNanpa"` selects the corresponding embedded manifest record. The registry then selects the embedded base/companion/literal bytes and that record's renderer settings. There is no runtime filesystem font lookup and no requirement to install the production fonts into the operating system. If the files under `fonts/` are changed, rebuild the Rust program so the new bytes are embedded.

### Basic usage

```rust
use nanpa_linja_n_rust::facade::{NanpaLinjaN, RenderOptions};
use nanpa_linja_n_rust::options::ParseOptions;
use nanpa_linja_n_rust::FullRenderOptions;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let nanpa = NanpaLinjaN::create()?;

    let parsed = nanpa.parse("12:30", &ParseOptions::default())?;
    println!("{parsed:?}");

    let options = RenderOptions {
        font: "linjaPona".into(),
        ..RenderOptions::default()
    };
    let png = nanpa.render_to_png("123.45", &options)?;
    std::fs::write("number.png", png)?;

    let full = FullRenderOptions {
        font: "nasinNanpa".into(),
        ..FullRenderOptions::default()
    };
    let mixed = nanpa.render_full_to_png(
        "mi toki e ni: [jan pona,,] 123.45",
        &full,
    )?;
    std::fs::write("mixed.png", mixed)?;

    Ok(())
}
```

For full-document inspection/editing, use `nanpa.parse_input(...)`. The returned `DocumentAst` can be edited (for example, change a bracket segment's `value`) and serialized with `nanpa.ast_to_text(&ast)`; the cross-language alias `nanpa.astToText(&ast)` is equivalent. Feed the resulting text to the existing `render_full_to_...` methods.See the package's `RENDERING-FACADE.md` and Rust source API for the complete facade surface.

---

## Go reference implementation

The Go package is a native Go implementation. Its module path is `nanpa-linja-n.com`; the public library package remains `nanpa`, so consumers import it as `nanpa-linja-n.com/nanpa`. Core parsing/render-plan construction builds without cgo; native graphical rendering currently targets Linux with cgo and the system text/vector libraries.

### Requirements

- Go 1.18 or newer
- a POSIX shell for the supplied regression wrapper
- `sha256sum`
- for PNG/SVG/PDF qualification on Linux: cgo plus Pango/PangoCairo, HarfBuzz, Cairo, Fontconfig and GLib/GObject runtime libraries

### Build and test

```bash
unzip nanpa-linja-n-go-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-go-reference-for-protocol-v1.1.0

# No NANPA_FONT_DIR export is used by the Go reference. assets/fonts/* is
# compiled into the assets package through go:embed.
./tools/run_go_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

Additional Go checks:

```bash
go test ./... -count=1
go vet ./...
./tools/run_full_renderer_profile.sh
```

### Font files and font-key resolution

Go deliberately does **not** use `NANPA_FONT_DIR`. The `assets` package contains a `//go:embed fonts/*` declaration, so `assets/fonts/preloaded-font-pairs.manifest.json` and the production font binaries are compiled into the Go program.

`CreateNanpaLinjaN()` reads the embedded manifest. When code sets:

```go
opts.Font = "nasinNanpa"
```

the production registry resolves that manifest `fontKey` (or a recognized alias) to its base/companion filenames and renderer settings. For native graphical rendering, the implementation materializes the required embedded font bytes into its private temporary font directory; callers do not provide a font path and do not need to install the fonts system-wide. `renderer.Close()` removes that temporary directory.

### Basic usage

```go
package main

import (
    "fmt"
    "os"

    nanpa "nanpa-linja-n.com/nanpa"
)

func main() {
    renderer, err := nanpa.CreateNanpaLinjaN()
    if err != nil {
        panic(err)
    }
    defer renderer.Close()

    parsed, err := renderer.Parse("12:30", nanpa.DefaultProductionOptions())
    if err != nil {
        panic(err)
    }
    fmt.Println(parsed)

    opts := nanpa.DefaultRenderOptions()
    opts.Font = "linjaPona"
    png, err := renderer.RenderToPNG("123.45", opts)
    if err != nil {
        panic(err)
    }
    if err := os.WriteFile("number.png", png, 0644); err != nil {
        panic(err)
    }

    full := nanpa.DefaultFullRenderOptions()
    full.Font = "nasinNanpa"
    mixed, err := renderer.RenderFullToPNG(
        `mi toki e ni: [jan pona,,] 123.45 "Hello"`,
        full,
    )
    if err != nil {
        panic(err)
    }
    if err := os.WriteFile("mixed.png", mixed, 0644); err != nil {
        panic(err)
    }
}
```

For full-document inspection/editing, call `renderer.ParseInput(...)`, modify the returned `DocumentAST` content fields, then call `renderer.AstToText(ast)` (or package-level `nanpa.AstToText(ast)`) and pass the resulting text to the existing full renderer.

Because Go cannot overload the frozen numeric facade methods by option type, full-document methods use explicit names such as `ParseInput`, `AstToText`, `BuildFullRenderPlan`, `RenderFullToPNG`, `RenderFullToSVG` and `RenderFullToPDF`.

---

## Dart reference implementation

The Dart package is a native Dart implementation. Core-v1 parsing/logical rendering remains pure Dart; production graphical rendering uses the native Pango/HarfBuzz/Cairo/Fontconfig stack.

### Requirements

- Dart SDK 3.3 or newer
- no third-party Dart package dependencies
- Pango/HarfBuzz, Cairo and Fontconfig runtime libraries for production graphical rendering

Flutter is not required.

### Build and test

```bash
unzip nanpa-linja-n-dart-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-dart-reference-for-protocol-v1.1.0

# No NANPA_FONT_DIR export is used by the Dart reference. Its normal package
# asset root is $PWD/assets/fonts/. Run these commands from the package root.
dart pub get
./tools/run_dart_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

`run_dart_regression.sh` itself performs `dart pub get`, compiler checks, Core/API regression, production rendering and the Full Renderer Profile gate, so running `dart pub get` separately is optional.

### Font files and font-key resolution

Dart does **not** use `NANPA_FONT_DIR`. The package ships the production files under `assets/fonts/` with `assets/fonts/production-font-pairs.manifest.json`. `NanpaLinjaN.create()` discovers that asset directory by walking from the current/script location and, when applicable, through Dart package configuration. Running the supplied tools from the package root therefore uses `$PWD/assets/fonts`.

`font: 'nasinNanpa'` is resolved against the manifest's `fontKey`; the resulting `ProductionFontInfo` contains the concrete base, companion and optional literal-cartouche paths and renderer settings. The native renderer uses those paths with the Pango/HarfBuzz/Cairo/Fontconfig stack.

If automatic discovery is inappropriate for an application, pass the directory containing `production-font-pairs.manifest.json` and the font files explicitly:

```dart
final nanpa = NanpaLinjaN.create(assetRoot: '/absolute/path/to/fonts');
```

### Basic usage

```dart
import 'dart:io';
import 'package:nanpa_linja_n/nanpa_linja_n.dart';

void main() {
  final nanpa = NanpaLinjaN.create();

  final parsed = nanpa.parse('12:30');
  print(parsed.toJson());

  final png = nanpa.renderToPng(
    '123.45',
    font: 'linjaPona',
    fontSize: 56,
  );
  File('number.png').writeAsBytesSync(png);

  final full = FullRenderOptions(font: 'nasinNanpa');
  final mixed = nanpa.renderFullToPng(
    'mi toki e ni: [jan pona,,] 123.45 "Hello"',
    options: full,
  );
  File('mixed.png').writeAsBytesSync(mixed);
}
```

The production facade provides `parse`, `buildRenderPlan`, `render`, `renderToPng`, `renderToSvg`, `renderToPdf`, `listFonts` and `getFontInfo`. The additive full-document surface provides `parseInput`, `astToText`, `buildFullRenderPlan`, `renderFull`, `renderFullToPng`, `renderFullToSvg` and `renderFullToPdf`.

Dart's document AST objects are immutable. To edit parsed source, construct replacement `DocumentSegment`/`DocumentLine`/`DocumentAst` objects, call `nanpa.astToText(editedAst)`, then render the returned source text through the normal full-document renderer.

---

## Java reference implementation

The Java package is an independent Java 21 implementation of Protocol v1.1.0 and its Parser/Renderer Profile. Its Java namespace is `com.nanpalinjan`.

### Requirements

- JDK 21
- Maven 3.9+ is optional; the primary regression script uses `javac` and `java` directly

The v1.1 distribution includes the production font payload in `resources/fonts.zip`. Normal use and the supplied regression runner do **not** require `NANPA_FONT_DIR`.

### Build and test

```bash
unzip nanpa-linja-n-java-reference-for-protocol-v1.1.0.zip
cd nanpa-linja-n-java

./tools/run_java_regression.sh
./tools/export_visual_pngs.sh
./tools/export_cartouche_audit.sh
```

To keep a terminal copy of the consolidated regression output:

```bash
./tools/run_java_regression.sh 2>&1 | tee java-regression-report.txt
```

Optional Maven entry point:

```bash
mvn test
```

### Font files and font-key resolution

Java v1.1 carries `resources/fonts.zip` with the distribution. `NanpaLinjaN.create()` uses the packaged production font authority; applications do not need to install the fonts system-wide and do not need to point the library at an external font directory for normal use.

When Java code specifies `.withFont("nasinNanpa")`, the value is resolved as a manifest `fontKey`. The manifest selects the concrete packaged font file, adapter, tally mode, literal-cartouche role, and scale settings.

This also means an external consumer can run from a directory separate from the extracted reference package. The library JAR remains on the classpath while `NanpaLinjaN.create()` resolves the bundled resources rather than depending on the consumer's current working directory.

### Basic usage

```java
import java.nio.file.Files;
import java.nio.file.Path;
import com.nanpalinjan.*;

public class Example {
    public static void main(String[] args) throws Exception {
        String text = "toki&pona 123 456 zz pi(telo lete) te tomo to";

        ParseOptions parserOptions = ParseOptions.fromMap(java.util.Map.of(
            "abbreviateNumericCartouches", true,
            "preserveNumericCartoucheBreaksInAbbreviation", false
        ));

        RenderOptions options = new RenderOptions()
            .withFont("linjaPona")
            .withFontSize(56)
            .withParser(parserOptions);

        try (NanpaLinjaN nanpa = NanpaLinjaN.create()) {
            DocumentAst ast = nanpa.parseInput(text, options);
            System.out.println(nanpa.astToText(ast));

            PngRenderResult png = nanpa.renderToPng(text, options);
            Files.write(Path.of("hello.png"), png.bytes());
        }
    }
}
```

The Java facade also provides `parseNumber`, `parseInput`, `astToText`, Java-native canvas/image output, SVG, PDF, low-level text/UCSUR drawing, vector-document conversion, and runtime render-adapter registration.

For v1.1 qualification, generated numeric-cartouche SVG must remain true vector output with no raster `<image>`/`data:image` fallback, and generated PDF cartouche/text content must not be replaced by raster Image XObjects.

## Release qualification checklist

Before calling a reference archive release-ready:

1. Run its `./tools/run_<language>_regression.sh` wrapper and require a clean PASS.
2. Run `./tools/export_visual_pngs.sh` and inspect the numeric production-font matrix.
3. Run `./tools/export_cartouche_audit.sh` and inspect all eight ordinary-cartouche contact sheets.
4. Pay particular attention to the four renderer-manual tally fonts and compare halo/non-halo placement.
5. Do not substitute the visual exporters for the automated regression suite, and do not treat a partial/core-only test as a complete production/full-renderer qualification.

## Implementing nanpa-linja-n in another language

Use the protocol, not a reference implementation, as the definition of expected behavior.

Start with:

```text
protocol/nanpa-linja-n-protocol-v1.1.0.zip
```

Read at minimum:

```text
SPEC.md
CONFORMANCE.md
API.md
RENDERING-PROFILE.md
PARSER-RENDERER-PROFILE.md
```

Use the bundled conformance corpus as the compatibility target. Reference implementations are useful for implementation details, diagnostics and differential testing, but they do not override the protocol.

For full-document rendering compatibility, preserve the semantic distinctions used by the reference profile, including font-specific render adapters and the manual-vs-UCSUR tally routing defined by the production font manifest.

## Canonical JavaScript reference

The canonical JavaScript renderer filename used for cross-reference and maintenance is:

```text
renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

## Parser and renderer input reference

This section is intended as the practical starting point for application authors. All examples below use the **uniform numeric format**, which is the default and the recommended format going forward. The older traditional/uniform mode-selection properties are intentionally not documented here.

The exact method/property spelling is idiomatic to each binding: JavaScript/TypeScript/Node generally use `camelCase`, Python uses `snake_case` in its native facade while also providing JavaScript-style aliases for the full renderer, and Rust/Go/Dart/Java expose typed fields/builders. The semantics below are common to the reference profile; use the language section above for the concrete call syntax.

### Input text accepted by the numeric parser

The retained Core-v1 corpus together with the v1.1 Parser/Renderer Profile defines the exact validity rules. The following are the main source forms an application can pass to `parse`/the numeric parser:

| Input kind | Examples | Meaning |
| --- | --- | --- |
| Decimal integer | `0`, `42`, `123579`, `007`, `-42`, `+42` | Ordinary decimal numeric value. |
| Decimal fraction | `0.75`, `.75`, `-0.5`, `3.141592` | Decimal point representation. |
| Grouped decimal | `1,234`, `3,000,000`, `-12,340` | Thousands grouping. |
| Magnitude suffix | `1K`, `64.5M`, `3.5B`, `1T` | K/M/B/T magnitude notation supported by the protocol. |
| ASCII fraction | `1/2`, `567/890`, `-7/9` | Numerator/denominator fraction. |
| Mixed ASCII fraction | `8+1/2` | Whole-number plus fractional part. |
| Unicode vulgar fraction | `½`, `¾`, `⅐`, `9½`, `-⅔` | Unicode fraction forms covered by the corpus. |
| Percent | `5%`, `10.5%`, `2,000%` | Percentage representation. |
| Scientific | `4.5e3`, `4.5E+3`, `4.5*10^3`, `4.5*10^-3` | Scientific notation; supported Unicode minus variants are also covered by the corpus. |
| Full date | `2026-09-13`, `2026/09/13` | Recognized semantic date when the protocol's validation rules match. |
| Yearless date | `--02-29`, `XXXX-12-31` | Date without a year. `XXXX` is uppercase in the frozen grammar. |
| Two-field clock time | `12:30`, `09:05`, `59:59` | Recognized semantic time when valid under the protocol rules. |
| Three/four-field duration/time form | `1:02:03`, `123:04:05`, `1:02:03:04.5` | Duration/time forms defined by the corpus. Do not substitute a generic external time grammar. |
| Grouped/telephone-like number | `321-555-6789`, `+1-321-555-6789` | Grouped numeric representation used by the protocol's telephone/grouped-number path. |
| Hexadecimal | `#0`, `#A`, `#A:F` | Hexadecimal namespace; opens/closes with `nasa`. **Opt-in in v1.1:** enable hexadecimal parsing before using these source forms. |
| Binary | `0b0`, `0b10101`, `0b1010:0101` | Binary namespace; opens/closes with `noka`. Prefix is lowercase `0b`. **Opt-in in v1.1:** enable binary parsing before using these source forms. |
| Encoded proper name | `Nanpa ...`, `Tenpo ...`, `Suno ...`, `Toki ...` | Proper-name representation of a numeric value. Dates/times/telephone forms may carry semantic/start-glyph information. |
| Numeric cartouche source | `[nanpa : wa nanpa]`, `[tenpo : ... nanpa]`, `[suno : ... nanpa]`, `[toki : ... nanpa]` | Decimal cartouche source using the relaxed/default digit vocabulary. Decimal forms always close with `nanpa`. |
| Hex/binary cartouche source | `[nasa : ... nasa]`, `[noka : ... noka]` | Explicit hexadecimal/binary cartouche source with namespace-specific closer. These namespaces are opt-in under the v1.1 defaults. |
| Number-code/identifier forms | examples such as `#~W`, `#~T`, `#~WTS` | Protocol-defined compact abbreviated forms. Exact accepted forms are defined by the v1.1 profile and retained conformance material. |

If an input looks date/time-like but fails the protocol's semantic recognition rules, it may either be rejected or fall through to another numeric grammar exactly as specified by the retained Core-v1 corpus and v1.1 profile. Applications should therefore use the library parser rather than pre-classifying these strings themselves.

Protocol v1.1 applies a strict whitespace boundary to decimal-digit numeric constructs: any whitespace ends the current decimal numeric construct. Thus `1 2 3` is three numbers, `1 1/2` is two numbers, and only `1+1/2` is the mixed fraction. This whitespace rule does not apply to numeric proper names or numeric cartouches.

For yearless dates, use the explicit yearless form such as `--02-29` (or another profile-supported explicit year placeholder). Bare `02-29` is not a yearless-date input.

### Full-document renderer input syntax

The full renderer accepts ordinary document text in addition to standalone numeric strings:

| Source form | Example | Renderer behavior |
| --- | --- | --- |
| Ordinary sitelen pona text | `mi toki e ni` | Parsed using the selected font pair's manifest `parserMode` and rendered with the base face. |
| Compound joiners | `toki&pona`, plus the canonical `+`/`-` forms where defined | `&` is part of canonical compound parsing and represents the ZWJ compound path alongside the other supported compound operators. |
| Numeric text in a sentence | `tenpo ni li 12:30` | Numeric spans are recognized and rendered with the numeric companion face/cartouche rules. |
| Ordinary cartouche | `[jan pona]` | Renders an ordinary cartouche using the selected base font/adaptation rules. |
| Ordinary cartouche with tallies | `[jan pona,,]` | Commas request tally marks for the owning glyph when comma-tally parsing is enabled. Manual/UCSUR behavior comes from the selected font manifest. |
| Exact literal cartouche | `["HELLO"]` | Renders literal Latin content in a cartouche using the literal-cartouche role. There must be no padding spaces between `[` and `"` or between `"` and `]`. |
| Quoted literal text | `"Hello"` or `“Hello”` | Renders quoted literal text by default; `interpretDoubleQuotesAsTeTo` can instead interpret quotes as the `te`/`to` sitelen behavior. |
| Non-breaking-space alias | `zz` | Produces the renderer's blank one-em/non-breaking-space cell. It does not introduce `te`/`to`, even when quote interpretation is available. |
| Raw Unicode code points | `U+F1900 U+F1901` | Explicit Unicode scalar/codepoint sequence. Whitespace between consecutive `U+...` tokens is syntax, not emitted text. |
| Image segment | `img(src="picture.png", h="1em", alt="example")` | Inserts an image element into a full-renderer line. Supported descriptor keys are `src`, `w`, `h`, `alt`, `valign`, `wriggle`, and `transparent`. Availability depends on the output/backend. |
| Newline | an actual `\n` in the input | Starts a new physical renderer line. |

The extended renderer also recognizes the convenience aliases used by the canonical renderer, such as `'cartouche-start'`, `'cartouche-end'`, `'stack-joiner'`, `'nesting-joiner'`, `'long-start'`, `'long-end'`, `'left-bracket'`, `'right-bracket'`, `'middle-dot'`, `'colon'`, and `'tally'`. The strict standard ASCII core mode intentionally does not preprocess these aliases.

### Parser options

For normal use, start with defaults. The production font manifest supplies the appropriate font-specific parser mode and tally configuration. Override the following only when the application actually needs the behavior.

| Canonical option name | Default | Effect |
| --- | --- | --- |
| `relaxedNanpaLinjanParsing` | `true` | Accepts the protocol-defined relaxed nanpa-linja-n aliases while parsing. Set `false` for strict syllable acceptance. |
| `relaxedNanpaLinjanRendering` | `true` | Emits relaxed-form syllables where the representation requires textual nanpa-linja-n output. |
| `nanpaColonParsing` | `true` | Accepts colon-bearing/typed nanpa cartouche syntax such as the explicit `nanpa : ...`, `tenpo : ...`, `suno : ...`, and `toki : ...` forms defined by the protocol. |
| `nanpaColonRendering` | `true` | Emits the colon form where applicable in rendered textual/cartouche representations. |
| `enableHexParsing` | `false` | Opts into hexadecimal source recognition (`#...` and hexadecimal cartouche/proper-name forms). |
| `enableBinaryParsing` | `false` | Opts into binary source recognition (`0b...` and binary cartouche/proper-name forms). |
| `mixedStyle` | `short` | Selects `short` or `long` mixed-fraction textual representation where the protocol offers both. |
| `abbreviateNumericCartouches` | `true` | Uses the v1.1 abbreviated numeric-cartouche representation by default. Set `false` when the full cartouche form is required. |
| `preserveNumericCartoucheBreaksInAbbreviation` | `false` | Preserves protocol-defined numeric cartouche breaks when abbreviation is enabled. |
| `numericCartoucheStartGlyph` | unset | Explicitly overrides the decimal starting glyph with `nanpa`, `tenpo`, `suno`, or `toki`. When unset, source metadata/semantic date-time defaults determine the head. |
| `breakLinesAtFullStops` | `false` | In full-document parsing, splits physical source lines at sentence full stops while avoiding decimal points and protected bracket/quote/image content. |
| `showUnknownText` | `false` | Requests visible rendering/diagnostics for otherwise unrecognized text instead of silently omitting it. |
| `autoCartoucheStandaloneProperNames` | `true` | Automatically treats supported standalone proper-name forms as cartouche/proper-name content. |
| `interpretDoubleQuotesAsTeTo` | `false` | When `true`, double-quoted segments are interpreted through `te`/`to` sitelen semantics instead of as literal quoted text. |
| `cartoucheCommaTallyMarks` | `true` | Enables comma-requested tally marks in ordinary cartouches. |
| `cartoucheTallyMode` | manifest-driven | Advanced override for tally handling (`manual`, `comma`, or `ucsur` where supported). Normally leave unset so the font manifest controls this. |
| `manualTallySmallFontLiftPx` | manifest-driven | Advanced manual-tally vertical adjustment for small font sizes. Normally supplied by the selected font record. |
| `manualTallySmallFontMaxPx` | manifest-driven | Upper font-size threshold for the small-font manual-tally lift. Normally supplied by the selected font record. |
| `nasinNanpaPona` | `false` | Enables the optional nasin nanpa pona conversion/rendering path for qualifying numeric text. |

The renderer text grammar itself is also font/configuration dependent. Production manifests currently select the appropriate grammar automatically. Advanced implementations expose grammars corresponding to `standard-sitelen-pona-ascii-core`, `sitelen-pona-ascii-extended`, and `sitelen-seli-kiwen`; ordinary application code should normally select a production `fontKey` and let its manifest choose this.

### Top-level render options

These are the options an application is most likely to set:

| Canonical option | Typical default | Effect |
| --- | --- | --- |
| `font` / `fontKey` | `nasinNanpa` | Selects one of the production manifest font keys. It is not a filename. |
| `fontSize` | `56` px | Logical font size. Native bindings may expose the same value through a typed render-options field. |
| `paddingPx` | implementation/profile default | Transparent/outer padding around the rendered result. |
| `format` | method-dependent | Generic `render()` dispatch value such as `canvas`, `png`, `svg`, or `pdf`. Dedicated `renderTo...` methods do not need it. |
| `includePlan` | `true` where supported | Includes the semantic/layout render plan in the returned result. Disable when only the output bytes/image are needed. |
| `quality` | backend-dependent | Optional raster/blob quality parameter where the selected output backend uses one. PNG itself is lossless. |
| `parser` | defaults above | Nested parser-option object/typed parser options applied during this render. |
| `layout` | defaults below | Nested layout controls. |
| `paint` | defaults below | Foreground/halo/unknown-text styling. |

For Protocol v1.1 production output, PNG is raster by design. Numeric-cartouche SVG must remain true vector output without raster `<image>`/`data:image` fallback. PDF cartouche/text output must remain resolution-independent vector content and must not use raster Image XObjects as a substitute for generated cartouche content.

### Layout options

| Canonical option | Meaning |
| --- | --- |
| `fontPx` | Font size when supplied inside `layout`; top-level `fontSize` is the convenient facade equivalent. |
| `paddingPx` | Outer render padding when exposed inside the layout object. |
| `align` | `left`, `center`, or `right` line alignment. |
| `spacingPreset` | `default`, `compact`, or `comfortable`. Sets a coherent group of glyph/cartouche/line spacing values. |
| `glyphGapScale` | Gap between ordinary glyph runs as a scale of font size. |
| `glyphGapMinPx` / `glyphGapMaxPx` | Minimum/maximum clamp for glyph gaps. |
| `cartoucheLeadGapScale` | Gap before cartouche runs as a scale of font size. |
| `cartouchePadScale` | Internal/adjacent cartouche padding scale used by the renderer. |
| `cartouchePadMinPx` | Minimum cartouche padding in pixels. |
| `lineGapScale` | Line gap as a scale of font size in implementations exposing the canonical spacing model. |
| `lineGapMinPx` / `lineGapMaxPx` | Clamp for scaled line gaps. |
| `lineGapPx` | Explicit line-gap override. |
| `forceLineGapPx` / exact line-gap mode | Forces an explicit `lineGapPx` even when a non-default spacing preset would otherwise choose its own line spacing. |

Not every native binding exposes every low-level spacing scalar as a public field; all expose the profile behavior required by their conformance surface. Prefer `fontSize`, `paddingPx`, `align`, and `spacingPreset` unless an application needs precise layout tuning.

### Paint options

| Canonical option | Default | Effect |
| --- | --- | --- |
| `fillStyle` | `#000000` | Foreground glyph/cartouche/tally color. |
| `halo.enabled` | `false` | Enables the contrasting backing/halo pass. |
| `halo.color` | `#FFFFFF` | Halo color. |
| `halo.widthPx` | renderer default when zero/unset | Requested halo extent. Manual tally fonts use a renderer-owned tally-group backing rather than inserting a tally glyph. |
| `unknownText.style` | `outline-box` in native full-renderer profiles | Presentation style for visible unknown text. |
| `unknownText.color` | `#000000` | Unknown-text decoration color. |
| `unknownText.lineWidthPx` | `1.5` where exposed | Unknown-text outline width. |
| `unknownText.paddingPx` | `2` where exposed | Padding around unknown-text decoration. |
| `unknownText.dash` | empty/disabled | Optional dash pattern or dash enablement, depending on the binding. |

### Font overrides inside renderer configuration

Advanced renderer APIs may expose a nested `fonts` object containing role families, render-adapter settings, or manual-tally tuning. **Normal applications should not populate this manually.** Selecting `font: 'nasinNanpa'` (or another production `fontKey`) causes the library to build these values from the production manifest. Manual role overrides are primarily for renderer development, custom manifests, and conformance diagnostics.

### Minimal application recipe

For a first application in any language, the recommended flow is:

1. use the production font assets packaged with that binding (or its documented development override);
2. create the `NanpaLinjaN` facade;
3. optionally call `listFonts()`/the typed equivalent to inspect available `fontKey` values;
4. if the application needs numeric semantics, parse a value such as `"12:30"` and inspect fields such as its date/time classification, proper name, Toki Pona words, and code points;
5. if the application needs document editing/tooling, parse full renderer source to a `DocumentAst`, modify the relevant content fields, and call `astToText`/the idiomatic equivalent;
6. render `"123.45"`, `"[jan pona,,]"`, or the source returned by `astToText` with `font = "nasinNanpa"` or another production key;
7. write/display the returned PNG/SVG/PDF/canvas result.

If the application only needs rendering, skip steps 4 and 5: rendering methods parse their input internally. The language-specific **Basic usage** sections above show the appropriate package/import syntax and font-discovery mechanism.

## Disclaimer

These reference implementations and associated tools are provided **“as is”**, with no claim, guarantee, or warranty that their output is correct, complete, or suitable for any purpose. You are responsible for verifying results.
