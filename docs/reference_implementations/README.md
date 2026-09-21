# nanpa-linja-n

This repository contains the frozen **nanpa-linja-n Protocol v1.0.0** and eight reference implementations: JavaScript, TypeScript, Node.js, Python, Rust, Go, Dart, and Java.

This README is organized for application developers first. The language sections below show the shortest practical path from an extracted reference package to a working external consumer that parses a full document, serializes its AST with `astToText`, demonstrates the available numeric output forms, and renders a PNG. Detailed API behavior, parser/AST documentation, font-manifest details, protocol/specification material, and conformance information are collected later in the README.

All paths in the examples are generic. Replace `/absolute/path/to/...` with the path on your own system.

## JavaScript: first working browser application

The JavaScript reference is the canonical browser parser/renderer. A normal external browser application installs the extracted reference package locally and imports the facade from `node_modules`; the production fonts are supplied by the package.

### Requirements

- Node.js 20 or newer
- npm
- a modern browser
- Python 3 only if you use the simple static-server command shown below

A Chromium-family browser is additionally required for the reference package's own browser regression suite, but not specifically for the minimal consumer shown here.

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-javascript-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-javascript-reference
npm install
./tools/run_javascript_regression.sh
```

For the first external application, return to a separate directory rather than putting application files inside the reference package.

### 2. Create an external application

```bash
mkdir hello-nanpa-javascript
cd hello-nanpa-javascript
npm init -y
npm install /absolute/path/to/extracted-javascript-reference
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>nanpa-linja-n JavaScript Hello World</title>
  <script type="importmap">
  {
    "imports": {
      "nanpa-linja-n-browser-font-regression":
        "./node_modules/nanpa-linja-n-browser-font-regression/src/nanpa-linja-n.js"
    }
  }
  </script>
</head>
<body>
  <h1>nanpa-linja-n JavaScript</h1>
  <pre id="textOutput"></pre>
  <div id="output"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

Create `app.js`:

```js
import { NanpaLinjaN }
  from "nanpa-linja-n-browser-font-regression";

const nanpa = await NanpaLinjaN.create();

const text =
  "toki&pona 123 456 zz pi(telo lete) te tomo to";

const parserOptions = {
  abbreviateNumericCartouches: true,
  preserveNumericCartoucheBreaksInAbbreviation: true,
};

// Parse the full document once.
const parsed = await nanpa.parse(text, { parser: parserOptions });

// Serialize the same AST in each supported numeric-output form.
const outputs = {
  source: nanpa.astToText(parsed.ast, {
    numericOutput: "source",
    parser: parserOptions,
  }),
  properName: nanpa.astToText(parsed.ast, {
    numericOutput: "properName",
    parser: parserOptions,
  }),
  hashTilde: nanpa.astToText(parsed.ast, {
    numericOutput: "#~",
    parser: parserOptions,
  }),
  fullCartouche: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: {
      ...parserOptions,
      abbreviateNumericCartouches: false,
    },
  }),
  abbreviatedCartouche: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: {
      ...parserOptions,
      abbreviateNumericCartouches: true,
    },
  }),
  nasinNanpaPona: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: {
      ...parserOptions,
      nasinNanpaPona: true,
      abbreviateNumericCartouches: false,
    },
  }),
};

document.getElementById("textOutput").textContent =
  Object.entries(outputs)
    .map(([name, value]) => `${name}:\n${value}`)
    .join("\n\n");

// Rendering does not require a second parse call.
const result = await nanpa.renderToPng(text, {
  font: "linjaPona",
  fontSize: 56,
  paddingPx: 18,
  parser: parserOptions,
});

const image = document.createElement("img");
image.src = URL.createObjectURL(result.blob);
image.alt = text;
document.getElementById("output").append(image);
```

The example deliberately parses once and reuses the same AST. `numericOutput: "source"` reconstructs the source representation, `"properName"` writes recognized numbers as proper names, `"#~"` requests compact number-code output where one exists, and `"cartouche"` can produce either full or abbreviated numeric cartouche source depending on the parser options. Enabling `nasinNanpaPona` selects that textual number form.

### 3. Run it

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in the browser. A rendered image should appear. No system-wide installation of the production fonts and no `NANPA_FONT_DIR` setting are required for this normal package-consumer path.

---

## TypeScript: first working browser application

The TypeScript reference provides a typed facade over the bundled canonical JavaScript runtime. The supplied browser-consumer pattern uses the package's already-built `dist/index.js`, so **you do not compile the reference implementation or the browser demo before running this Hello World**.

### Requirements

- Node.js 18 or newer
- npm
- a modern browser
- Python 3 only if you use the simple static-server command shown below

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-typescript-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-typescript-reference
npm install
./tools/run_typescript_regression.sh
```

### 2. Create an external application

```bash
mkdir hello-nanpa-typescript
cd hello-nanpa-typescript
npm init -y
npm install /absolute/path/to/extracted-typescript-reference
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>nanpa-linja-n TypeScript Hello World</title>
  <script type="importmap">
  {
    "imports": {
      "nanpa-linja-n-typescript":
        "./node_modules/nanpa-linja-n-typescript/dist/index.js"
    }
  }
  </script>
</head>
<body>
  <h1>nanpa-linja-n TypeScript reference</h1>
  <pre id="textOutput"></pre>
  <div id="output"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

Create `app.js`:

```js
import { NanpaLinjaN } from "nanpa-linja-n-typescript";

const nanpa = await NanpaLinjaN.create();

const text =
  "toki&pona 123 456 zz pi(telo lete) te tomo to";

const parserOptions = {
  abbreviateNumericCartouches: true,
  preserveNumericCartoucheBreaksInAbbreviation: true,
};

const parsed = await nanpa.parse(text, { parser: parserOptions });

const outputs = {
  source: nanpa.astToText(parsed.ast, {
    numericOutput: "source", parser: parserOptions,
  }),
  properName: nanpa.astToText(parsed.ast, {
    numericOutput: "properName", parser: parserOptions,
  }),
  hashTilde: nanpa.astToText(parsed.ast, {
    numericOutput: "#~", parser: parserOptions,
  }),
  fullCartouche: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: { ...parserOptions, abbreviateNumericCartouches: false },
  }),
  abbreviatedCartouche: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: { ...parserOptions, abbreviateNumericCartouches: true },
  }),
  nasinNanpaPona: nanpa.astToText(parsed.ast, {
    numericOutput: "cartouche",
    parser: {
      ...parserOptions,
      nasinNanpaPona: true,
      abbreviateNumericCartouches: false,
    },
  }),
};

document.getElementById("textOutput").textContent =
  Object.entries(outputs)
    .map(([name, value]) => `${name}:\n${value}`)
    .join("\n\n");

const result = await nanpa.renderToPng(text, {
  font: "linjaPona",
  fontSize: 56,
  paddingPx: 18,
  parser: parserOptions,
});

const image = document.createElement("img");
image.src = URL.createObjectURL(result.blob);
image.alt = text;
document.getElementById("output").append(image);
```

This browser consumer uses the built TypeScript facade and demonstrates the same AST-to-text output modes as the canonical JavaScript reference. The code is JavaScript importing the compiled typed package; an application written in TypeScript can use the same methods with the package's exported types.

### 3. Run it

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The import map deliberately points at `dist/index.js`; there is no separate client-side TypeScript build step for this supplied browser-consumer pattern.

---

## Node.js: first working command-line application

The Node.js reference runs the canonical JavaScript parser/renderer directly under Node.js. Its production font and vector resources are bundled with the package.

### Requirements

- Node.js 20 or newer
- npm
- a platform supported by the package's `skia-canvas` dependency

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-nodejs-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-nodejs-reference
npm install
./tools/run_nodejs_regression.sh
```

### 2. Create an external application

```bash
mkdir hello-nanpa-node
cd hello-nanpa-node
npm init -y
npm install /absolute/path/to/extracted-nodejs-reference
```

Create `hello.mjs`:

```js
import { writeFile } from "node:fs/promises";
import { NanpaLinjaN }
  from "nanpa-linja-n-nodejs-reference";

const nanpa = await NanpaLinjaN.create();

try {
  const text =
    "toki&pona 123 456 zz pi(telo lete) te tomo to";

  const parserOptions = {
    abbreviateNumericCartouches: true,
    preserveNumericCartoucheBreaksInAbbreviation: true,
  };

  const parsed = await nanpa.parse(text, { parser: parserOptions });

  const modes = [
    ["source", { numericOutput: "source", parser: parserOptions }],
    ["properName", { numericOutput: "properName", parser: parserOptions }],
    ["#~", { numericOutput: "#~", parser: parserOptions }],
    ["full cartouche", {
      numericOutput: "cartouche",
      parser: { ...parserOptions, abbreviateNumericCartouches: false },
    }],
    ["abbreviated cartouche", {
      numericOutput: "cartouche",
      parser: { ...parserOptions, abbreviateNumericCartouches: true },
    }],
    ["nasin nanpa pona", {
      numericOutput: "cartouche",
      parser: {
        ...parserOptions,
        nasinNanpaPona: true,
        abbreviateNumericCartouches: false,
      },
    }],
  ];

  for (const [label, options] of modes) {
    console.log(`\n${label.toUpperCase()}`);
    console.log(nanpa.astToText(parsed.ast, options));
  }

  const png = await nanpa.renderToPng(text, {
    font: "linjaPona",
    fontSize: 56,
    paddingPx: 18,
    parser: parserOptions,
  });

  await writeFile("hello.png", png.bytes);
  console.log(`\nwrote hello.png (${png.bytes.length} bytes)`);
} finally {
  await nanpa.destroy();
}
```

The six `astToText` calls all reuse the same parsed document AST. This makes the example useful both as a first renderer program and as a quick demonstration of the alternate textual representations that the full-document API can emit.

### 3. Run it

```bash
node hello.mjs
```

Success creates `hello.png` in the current directory. No application-side font directory is required for the normal bundled-resource path.

---

## Python: first working application

The Python reference is a native Python implementation. Install the extracted reference as a normal local Python package; the installed package supplies its production font resources.

### Requirements

- Python 3.10 or newer
- the native/system libraries required by the Python rendering dependencies described later in this section and by the package regression suite

### 1. Extract the reference package

```bash
unzip nanpa-linja-n-python-reference-for-protocol-v1.0.0.zip
```

To validate the reference itself from its package directory:

```bash
cd /absolute/path/to/extracted-python-reference
python3 -m pip install -e .
./tools/run_python_regression.sh
```

### 2. Create an isolated external application

```bash
mkdir hello-nanpa-python
cd hello-nanpa-python
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install /absolute/path/to/extracted-python-reference
```

Create `hello.py`:

```python
from pathlib import Path
from nanpa_linja_n import NanpaLinjaN

nanpa = NanpaLinjaN.create()

text = "toki&pona 123 456 zz pi(telo lete) te tomo to"

parser_options = {
    "abbreviateNumericCartouches": True,
    "preserveNumericCartoucheBreaksInAbbreviation": True,
}

# Parse the full document once.
ast = nanpa.parse_input(text, {"parser": parser_options})

def show(label, options):
    print(f"\n{label}")
    print(nanpa.ast_to_text(ast, options))

show("SOURCE", {
    "numericOutput": "source",
    "parser": parser_options,
})
show("PROPER NAME", {
    "numericOutput": "properName",
    "parser": parser_options,
})
show("#~", {
    "numericOutput": "#~",
    "parser": parser_options,
})
show("FULL CARTOUCHE", {
    "numericOutput": "cartouche",
    "parser": {
        **parser_options,
        "abbreviateNumericCartouches": False,
    },
})
show("ABBREVIATED CARTOUCHE", {
    "numericOutput": "cartouche",
    "parser": {
        **parser_options,
        "abbreviateNumericCartouches": True,
    },
})
show("NASIN NANPA PONA", {
    "numericOutput": "cartouche",
    "parser": {
        **parser_options,
        "nasinNanpaPona": True,
        "abbreviateNumericCartouches": False,
    },
})

png = nanpa.render_full_to_png(
    text,
    {
        "font": "linjaPona",
        "fontSize": 56,
        "paddingPx": 18,
        "parser": parser_options,
    },
)

Path("hello.png").write_bytes(png)
print(f"\nwrote hello.png ({len(png)} bytes)")
```

Python's native names are `parse_input(...)` and `ast_to_text(...)`; JavaScript-style aliases such as `parseInput` and `astToText` are also available. The `numericOutput` values shown above have the same meaning as in the JavaScript facade.

### 3. Run it

```bash
python hello.py
```

Success creates `hello.png`. Normal installed-package use does not require `NANPA_FONT_DIR`; that environment variable is used by specific audit tooling, not by this basic consumer path.

---

## Rust: first working application

The Rust reference is a native Rust crate. Its production manifest and font bytes are embedded at compile time, so an external consumer only needs a Cargo dependency on the extracted reference package.

### Requirements

- a Rust toolchain with Cargo and Edition 2024 support

Python 3 is used by some reference-package integrity/regression helpers, but it is not required merely to compile the external Rust consumer below.

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-rust-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-rust-reference
./tools/run_rust_regression.sh
```

### 2. Create an external Cargo application

```bash
mkdir hello-nanpa-rust
cd hello-nanpa-rust
cargo init --bin .
```

Add the reference crate to `Cargo.toml`:

```toml
[dependencies]
nanpa-linja-n-rust = { path = "/absolute/path/to/extracted-rust-reference" }
```

Replace `src/main.rs` with:

```rust
use std::error::Error;
use std::fs;

use nanpa_linja_n_rust::facade::NanpaLinjaN;
use nanpa_linja_n_rust::{DocumentAst, FullRenderOptions};

fn print_mode(
    nanpa: &NanpaLinjaN,
    ast: &DocumentAst,
    base: &FullRenderOptions,
    label: &str,
    numeric_output: &str,
    abbreviate: bool,
    nasin_nanpa_pona: bool,
) -> Result<(), Box<dyn Error>> {
    let mut options = base.clone();
    options.numeric_output = numeric_output.to_string();
    options.parser.abbreviate_numeric_cartouches = abbreviate;
    options.parser.nasin_nanpa_pona = nasin_nanpa_pona;

    println!(
        "\n{label}\n{}",
        nanpa.ast_to_text_with_options(ast, &options)?
    );
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let nanpa = NanpaLinjaN::create()?;

    let text =
        "toki&pona 123 456 zz pi(telo lete) te tomo to";

    let mut base = FullRenderOptions::default();
    base.font = "linjaPona".to_string();
    base.font_size = 56.0;
    base.padding_px = 18;
    base.parser.abbreviate_numeric_cartouches = true;
    base.parser.preserve_numeric_cartouche_breaks = true;

    let ast = nanpa.parse_input(text, &base);

    print_mode(&nanpa, &ast, &base, "SOURCE", "source", true, false)?;
    print_mode(&nanpa, &ast, &base, "PROPER NAME", "properName", true, false)?;
    print_mode(&nanpa, &ast, &base, "#~", "#~", true, false)?;
    print_mode(&nanpa, &ast, &base, "FULL CARTOUCHE", "cartouche", false, false)?;
    print_mode(&nanpa, &ast, &base, "ABBREVIATED CARTOUCHE", "cartouche", true, false)?;
    print_mode(&nanpa, &ast, &base, "NASIN NANPA PONA", "cartouche", false, true)?;

    let png = nanpa.render_full_to_png(text, &base)?;
    fs::write("hello.png", &png)?;
    println!("\nwrote hello.png ({} bytes)", png.len());

    Ok(())
}
```

Rust uses `ast_to_text_with_options(...)` when the serialized numeric representation needs to be selected. The simpler `ast_to_text(...)`/`astToText(...)` aliases remain useful for ordinary source reconstruction.

### 3. Build and run it

```bash
cargo tree
cargo run --release
```

Success creates `hello.png`. Do not copy the font files into the consumer project and do not set `NANPA_FONT_DIR`; the Rust reference embeds them when the reference crate is built.

---

## Go: first working application

The Go reference uses module path `nanpa-linja-n.com`; application code imports the public package as `nanpa-linja-n.com/nanpa`. Production font resources are embedded in the reference module and materialized internally when needed by native rendering.

### Requirements

- Go 1.18 or newer
- for graphical PNG/SVG/PDF rendering on Linux: cgo plus Pango/PangoCairo, HarfBuzz, Cairo, Fontconfig, and GLib/GObject runtime/development libraries appropriate to the system

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-go-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-go-reference
./tools/run_go_regression.sh
```

### 2. Create an external Go module

```bash
mkdir hello-nanpa-go
cd hello-nanpa-go
go mod init hello-nanpa
go mod edit -require=nanpa-linja-n.com@v0.0.0
go mod edit -replace=nanpa-linja-n.com=/absolute/path/to/extracted-go-reference
```

Create `main.go`:

```go
package main

import (
    "fmt"
    "os"

    nanpa "nanpa-linja-n.com/nanpa"
)

func main() {
    renderer, err := nanpa.CreateNanpaLinjaN()
    if err != nil { panic(err) }
    defer renderer.Close()

    text := "toki&pona 123 456 zz pi(telo lete) te tomo to"

    base := nanpa.DefaultFullRenderOptions()
    base.Font = "linjaPona"
    base.FontSize = 56
    base.PaddingPx = 18
    base.Parser.AbbreviateNumericCartouches = true
    base.Parser.PreserveNumericCartoucheBreaks = true

    ast := renderer.ParseInput(text, base)

    printMode := func(label, mode string, mutate func(*nanpa.FullRenderOptions)) {
        opts := base
        opts.NumericOutput = mode
        if mutate != nil { mutate(&opts) }

        value, err := renderer.AstToText(ast, opts)
        if err != nil { panic(err) }
        fmt.Printf("\n%s\n%s\n", label, value)
    }

    printMode("SOURCE", "source", nil)
    printMode("PROPER NAME", "properName", nil)
    printMode("#~", "#~", nil)
    printMode("FULL CARTOUCHE", "cartouche", func(o *nanpa.FullRenderOptions) {
        o.Parser.AbbreviateNumericCartouches = false
    })
    printMode("ABBREVIATED CARTOUCHE", "cartouche", func(o *nanpa.FullRenderOptions) {
        o.Parser.AbbreviateNumericCartouches = true
    })
    printMode("NASIN NANPA PONA", "cartouche", func(o *nanpa.FullRenderOptions) {
        o.Parser.NasinNanpaPona = true
        o.Parser.AbbreviateNumericCartouches = false
    })

    png, err := renderer.RenderFullToPNG(text, base)
    if err != nil { panic(err) }

    if err := os.WriteFile("hello.png", png, 0644); err != nil {
        panic(err)
    }
    fmt.Printf("\nwrote hello.png (%d bytes)\n", len(png))
}
```

Go stores the requested AST serialization mode in `FullRenderOptions.NumericOutput`; the parser fields determine whether `cartouche` output is full, abbreviated, or converted through `nasinNanpaPona`.

### 3. Run it

```bash
go mod tidy
go run .
```

You can also verify that the consumer builds as a standalone executable:

```bash
go build -o hello-nanpa .
```

Success creates `hello.png`. No `NANPA_FONT_DIR` setting is used by the Go reference.

---

## Dart: first working application

The Dart reference is a native Dart package. Core parsing is pure Dart; production graphical rendering uses the native Pango/HarfBuzz/Cairo/Fontconfig stack. Flutter is not required.

### Requirements

- Dart SDK 3.3 or newer
- Pango/HarfBuzz, Cairo, and Fontconfig runtime libraries for production graphical rendering

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-dart-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-dart-reference
dart pub get
./tools/run_dart_regression.sh
```

### 2. Create an external Dart application

```bash
mkdir -p hello-nanpa-dart/bin
cd hello-nanpa-dart
```

Create `pubspec.yaml`:

```yaml
name: hello_nanpa
environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  nanpa_linja_n:
    path: /absolute/path/to/extracted-dart-reference
```

Create `bin/main.dart`:

```dart
import 'dart:io';
import 'package:nanpa_linja_n/nanpa_linja_n.dart';

void main() {
  final nanpa = NanpaLinjaN.create();

  const text =
      'toki&pona 123 456 zz pi(telo lete) te tomo to';

  const baseParser = FullParserOptions(
    abbreviateNumericCartouches: true,
    preserveNumericCartoucheBreaks: true,
  );

  final ast = nanpa.parseInput(
    text,
    options: const FullRenderOptions(parser: baseParser),
  );

  void show(String label, FullRenderOptions options) {
    print('\n$label');
    print(nanpa.astToText(ast, options: options));
  }

  show('SOURCE', const FullRenderOptions(
    numericOutput: 'source', parser: baseParser,
  ));
  show('PROPER NAME', const FullRenderOptions(
    numericOutput: 'properName', parser: baseParser,
  ));
  show('#~', const FullRenderOptions(
    numericOutput: '#~', parser: baseParser,
  ));
  show('FULL CARTOUCHE', const FullRenderOptions(
    numericOutput: 'cartouche',
    parser: FullParserOptions(
      abbreviateNumericCartouches: false,
      preserveNumericCartoucheBreaks: true,
    ),
  ));
  show('ABBREVIATED CARTOUCHE', const FullRenderOptions(
    numericOutput: 'cartouche',
    parser: FullParserOptions(
      abbreviateNumericCartouches: true,
      preserveNumericCartoucheBreaks: true,
    ),
  ));
  show('NASIN NANPA PONA', const FullRenderOptions(
    numericOutput: 'cartouche',
    parser: FullParserOptions(nasinNanpaPona: true),
  ));

  final png = nanpa.renderFullToPng(
    text,
    options: const FullRenderOptions(
      font: 'linjaPona',
      fontSize: 56,
      paddingPx: 18,
      parser: baseParser,
    ),
  );

  File('hello.png').writeAsBytesSync(png);
  print('\nwrote hello.png (${png.length} bytes)');
}
```

Dart's `FullRenderOptions.numericOutput` selects the AST serialization form. Its AST values are immutable, but the same parsed AST can be serialized repeatedly with different option objects as shown above.

### 3. Resolve the local dependency and run it

```bash
dart pub get
dart run bin/main.dart
```

Success creates `hello.png`. The reference discovers its packaged production assets; no `NANPA_FONT_DIR` setting is required for this consumer path.

---

## Java: first working application

The Java reference targets Java 21. For an external standalone consumer, build the reference classes into a JAR and include the package's `resources/fonts.zip` as `com/nanpalinjan/fonts.zip` inside that JAR. The supplied `HelloWorld` pattern can then call `NanpaLinjaN.create()` without a machine-specific font path.

### Requirements

- JDK 21
- a POSIX-like shell for the exact commands below

Maven is optional; the following path uses `javac`, `jar`, and `java` directly so that every required step is explicit.

### 1. Extract and optionally validate the reference package

```bash
unzip nanpa-linja-n-java-reference-for-protocol-v1.0.0.zip
cd /absolute/path/to/extracted-java-reference
./tools/run_java_regression.sh
```

### 2. Build a reusable reference JAR

From any working directory:

```bash
REF=/absolute/path/to/extracted-java-reference
BUILD=/tmp/nanpa-java-build

rm -rf "$BUILD"
mkdir -p "$BUILD/classes/com/nanpalinjan"

find "$REF/src/main/java" -name '*.java' -print0 \
  | xargs -0 javac --release 21 -d "$BUILD/classes"

cp "$REF/resources/fonts.zip" \
  "$BUILD/classes/com/nanpalinjan/fonts.zip"

jar --create \
  --file "$BUILD/nanpa-linja-n-java-1.0.0.jar" \
  -C "$BUILD/classes" .
```

The important resource rule is that `fonts.zip` must be stored in the JAR at:

```text
com/nanpalinjan/fonts.zip
```

### 3. Create the external Hello World

```bash
mkdir hello-nanpa-java
cd hello-nanpa-java
```

Create `HelloWorld.java`:

```java
import com.nanpalinjan.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class HelloWorld {
    public static void main(String[] args) throws Exception {
        String text =
            "toki&pona 123 456 zz pi(telo lete) te tomo to";

        ParseOptions parserOptions = ParseOptions.fromMap(Map.of(
            "abbreviateNumericCartouches", true,
            "preserveNumericCartoucheBreaksInAbbreviation", true
        ));

        RenderOptions renderOptions = new RenderOptions()
            .withFont("linjaPona")
            .withFontSize(56)
            .withPaddingPx(18)
            .withParser(parserOptions);

        try (NanpaLinjaN nanpa = NanpaLinjaN.create()) {
            // Parse the complete document and reconstruct its source.
            DocumentAst ast = nanpa.parseInput(text, renderOptions);
            String source = nanpa.astToText(ast);

            System.out.println("\nSOURCE");
            System.out.println(source);

            // The numeric parser exposes the alternate representations for
            // an individual recognized number.
            FacadeParseResult number = nanpa.parse("123");
            System.out.println("\nPARSE 123");
            System.out.println(number);

            // Render the original full document to PNG.
            PngRenderResult png = nanpa.renderToPng(text, renderOptions);
            Files.write(Path.of("hello.png"), png.bytes());

            System.out.println(
                "\nwrote hello.png (" + png.bytes().length + " bytes)"
            );
        }
    }
}
```

The supplied Java consumer establishes `parseInput(...) -> DocumentAst -> astToText(...)` source reconstruction and the Java numeric parse result. The uploaded Java example does not establish the Java call signature for selecting `properName`, `#~`, full-cartouche, abbreviated-cartouche, or `nasin nanpa pona` directly through `astToText`; those signatures are therefore not invented in this README. When the Java consumer example is updated to exercise those modes, this section should mirror that tested syntax just as the other language sections do.

### 4. Compile and run the external application

```bash
JAR=/tmp/nanpa-java-build/nanpa-linja-n-java-1.0.0.jar

javac --release 21 -cp "$JAR" HelloWorld.java
java -Djava.awt.headless=true -cp ".:$JAR" HelloWorld
```

Success creates `hello.png`. With `fonts.zip` embedded as shown above, this Hello World does not need `NANPA_FONT_DIR` or a system-installed font family.

## `astToText` output modes used in the examples

The language examples above deliberately use one full-document AST and then serialize it in multiple ways. The canonical modes demonstrated by the bindings that expose the current option surface are:

| `numericOutput` / mode | Result |
| --- | --- |
| `source` | Preserve/reconstruct the source representation retained by the AST. |
| `properName` | Replace recognized numeric structures with their nanpa-linja-n proper-name representation. |
| `#~` | Replace recognized numeric structures with their compact `#~` number-code representation where one exists; unsupported forms preserve/fall back according to the binding/profile. |
| `cartouche` + abbreviation off | Emit full numeric-cartouche source. |
| `cartouche` + abbreviation on | Emit abbreviated numeric-cartouche source. |
| `cartouche` + `nasinNanpaPona` | Emit the nasin nanpa pona textual representation selected by that parser option. |

These operations serialize the AST back to text; they are not separate rendering engines. The resulting text can be inspected, edited, stored, or passed back into the normal renderer.

## Repository structure

```text
nanpa-linja-n_reference_libraries_v1.0.0/
├── protocol/
│   └── nanpa-linja-n-protocol-v1.0.0.zip
└── reference_implementations/
    ├── javascript/
    │   └── nanpa-linja-n-javascript-reference-for-protocol-v1.0.0.zip
    ├── typescript/
    │   └── nanpa-linja-n-typescript-reference-for-protocol-v1.0.0.zip
    ├── nodejs/
    │   └── nanpa-linja-n-nodejs-reference-for-protocol-v1.0.0.zip
    ├── python/
    │   └── nanpa-linja-n-python-reference-for-protocol-v1.0.0.zip
    ├── rust/
    │   └── nanpa-linja-n-rust-reference-for-protocol-v1.0.0.zip
    ├── go/
    │   └── nanpa-linja-n-go-reference-for-protocol-v1.0.0.zip
    ├── dart/
    │   └── nanpa-linja-n-dart-reference-for-protocol-v1.0.0.zip
    └── java/
        └── nanpa-linja-n-java-reference-for-protocol-v1.0.0.zip
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

The physical source of those font files differs by language. Some packages load files from a bundled asset directory, Rust and Go embed them into the compiled program, Dart discovers its packaged asset directory at runtime, and Java deliberately keeps the font binaries external. **For that reason the exact font-path setup is summarized in every language section above.**

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

The ordinary audit uses `[jan pona]` and `[jan pona,,]`. For the five manual-tally configurations, visually confirm that:

- tally X positions do not move when halo is enabled;
- the foreground tally strokes remain aligned with the non-halo version;
- the halo does not overwrite the cartouche bottom rule;
- the halo is a backing around the tally group rather than a replacement tally glyph;
- U+F199E is not shaped for a manual-tally font.

The visual exporters are inspection tools. They do not replace the automated protocol/full-renderer regression suite.

## Release qualification checklist

Before calling a reference archive release-ready:

1. Run its `./tools/run_<language>_regression.sh` wrapper and require a clean PASS.
2. Run `./tools/export_visual_pngs.sh` and inspect the numeric production-font matrix.
3. Run `./tools/export_cartouche_audit.sh` and inspect all eight ordinary-cartouche contact sheets.
4. Pay particular attention to the five renderer-manual tally fonts and compare halo/non-halo placement.
5. Do not substitute the visual exporters for the automated regression suite, and do not treat a partial/core-only test as a complete production/full-renderer qualification.

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

## Parser and renderer input reference

This section is intended as the practical starting point for application authors. All examples below use the **uniform numeric format**, which is the default and the recommended format going forward. The older traditional/uniform mode-selection properties are intentionally not documented here.

The exact method/property spelling is idiomatic to each binding: JavaScript/TypeScript/Node generally use `camelCase`, Python uses `snake_case` in its native facade while also providing JavaScript-style aliases for the full renderer, and Rust/Go/Dart/Java expose typed fields/builders. The semantics below are common to the reference profile; use the language section above for the concrete call syntax.

### Input text accepted by the numeric parser

The frozen protocol/conformance corpus defines the exact validity rules. The following are the main source forms an application can pass to `parse`/the numeric parser:

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
| Hexadecimal | `#0`, `#A`, `#A:F` | Hexadecimal namespace; opens/closes with `nasa` in cartouche/proper-name representation. |
| Binary | `0b0`, `0b10101`, `0b1010:0101` | Binary namespace; opens/closes with `noka`. Prefix is lowercase `0b` in the frozen grammar. |
| Encoded proper name | `Nanpa Wan`, `Tenpo Watun Eke Senin`, `Suno Watun Eke Senin`, `Toki ...` | Proper-name representation of a numeric value. Dates/times/telephone forms may carry semantic/start-glyph information. |
| Numeric cartouche source | `[nanpa : wan nanpa]`, `[tenpo : ... nanpa]`, `[suno : ... nanpa]`, `[toki : ... nanpa]` | Decimal cartouche source. Decimal forms always close with `nanpa`. |
| Hex/binary cartouche source | `[nasa : ... nasa]`, `[noka : ... noka]` | Explicit hexadecimal/binary cartouche source with namespace-specific closer. |
| Number-code/identifier forms | examples such as `#~W`, `#~T`, `NEWEN` | Protocol-defined compact identifier/number-code forms. Exact accepted forms are frozen by the conformance corpus. |

If an input looks date/time-like but fails the protocol's semantic recognition rules, it may either be rejected or fall through to another numeric grammar exactly as specified by the frozen corpus. Applications should therefore use the library parser rather than pre-classifying these strings themselves.

### Full-document renderer input syntax

The full renderer accepts ordinary document text in addition to standalone numeric strings:

| Source form | Example | Renderer behavior |
| --- | --- | --- |
| Ordinary sitelen pona text | `mi toki e ni` | Parsed using the selected font pair's manifest `parserMode` and rendered with the base face. |
| Numeric text in a sentence | `tenpo ni li 12:30` | Numeric spans are recognized and rendered with the numeric companion face/cartouche rules. |
| Ordinary cartouche | `[jan pona]` | Renders an ordinary cartouche using the selected base font/adaptation rules. |
| Ordinary cartouche with tallies | `[jan pona,,]` | Commas request tally marks for the owning glyph when comma-tally parsing is enabled. Manual/UCSUR behavior comes from the selected font manifest. |
| Exact literal cartouche | `["HELLO"]` | Renders literal Latin content in a cartouche using the literal-cartouche role. There must be no padding spaces between `[` and `"` or between `"` and `]`. |
| Quoted literal text | `"Hello"` or `“Hello”` | Renders quoted literal text by default; `interpretDoubleQuotesAsTeTo` can instead interpret quotes as the `te`/`to` sitelen behavior. |
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
| `enableHexParsing` | `true` | Enables hexadecimal source recognition (`#...` and hexadecimal cartouche/proper-name forms). |
| `enableBinaryParsing` | `true` | Enables binary source recognition (`0b...` and binary cartouche/proper-name forms). |
| `mixedStyle` | `short` | Selects `short` or `long` mixed-fraction textual representation where the protocol offers both. |
| `abbreviateNumericCartouches` | `false` | Requests the abbreviated numeric-cartouche representation. |
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

1. make the production font assets available using that language's documented mechanism;
2. create the `NanpaLinjaN` facade;
3. optionally call `listFonts()`/the typed equivalent to inspect available `fontKey` values;
4. if the application needs numeric semantics, parse a value such as `"12:30"` and inspect fields such as its date/time classification, proper name, Toki Pona words, and code points;
5. if the application needs document editing/tooling, parse full renderer source to a `DocumentAst`, modify the relevant content fields, and call `astToText`/the idiomatic equivalent;
6. render `"123.45"`, `"[jan pona,,]"`, or the source returned by `astToText` with `font = "nasinNanpa"` or another production key;
7. write/display the returned PNG/SVG/PDF/canvas result.

If the application only needs rendering, skip steps 4 and 5: rendering methods parse their input internally. The language-specific Hello World sections above show the appropriate package/import syntax and font-discovery mechanism.

## Fonts: required files, manifest and directory layout

A first-time user does **not** select a font by `.ttf`/`.otf` filename and does not need an operating-system font family called `nasinNanpa`, `linjaPona`, and so on. The public `font` option is a logical **manifest `fontKey`**. The manifest tells the renderer which real files, font families, adapters and tally rules belong to that key.

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

### What one manifest entry means

A production manifest entry normally defines these roles:

| Manifest field | Purpose |
| --- | --- |
| `fontKey` | Public logical name passed to the library, for example `nasinNanpa`. |
| `baseFamily` / `baseFilename` | Main sitelen pona face used for ordinary glyph text and ordinary cartouches. |
| `companionFamily` / `companionFilename` | nanpa-linja-n companion face used for numeric cartouches. |
| `literalCartoucheFamily` | Face used for exact literal/Latin cartouche content such as `["HELLO"]`. |
| `literalCartoucheFilename` / `literalCartoucheUrl` | Optional separate file for that literal-cartouche face. |
| `parserMode` | Text grammar appropriate for the selected font. Normally selected automatically with the font pair. |
| `renderAdapterId` / `renderAdapterSettings` | Font-specific translation needed before shaping, for fonts whose native encoding differs from canonical UCSUR input. |
| `settings` | Font-specific renderer settings, including manual-vs-UCSUR tally behavior and cartouche adjustments. |

A call such as:

```text
font = nasinNanpa
```

therefore means: **find the manifest record whose `fontKey` is `nasinNanpa`, then load/use the faces and renderer settings named by that record**.

### What happens when `literalCartoucheFilename` is not defined

A separate literal-cartouche font file is **optional**.

The production behavior is:

1. If `literalCartoucheFilename`/`literalCartoucheUrl` is supplied, load that separate face and use `literalCartoucheFamily` for literal cartouches.
2. If no separate literal file is supplied but `literalCartoucheFamily` names the same family as the base face, reuse the already-loaded base font. No third file is required.
3. If `literalCartoucheFamily` itself is omitted, the renderer falls back to the base/text family for literal cartouches.

For a **custom manifest**, do not name a different `literalCartoucheFamily` unless that family is otherwise available to the renderer. The portable approach is either to reuse the base family or provide an explicit literal-cartouche file/URL.

The current production set uses these rules:

| `fontKey` | Base file | Numeric companion file | Literal-cartouche source |
| --- | --- | --- | --- |
| `nasinNanpa` | `nasin-nanpa-5.0.0-beta.3-UCSUR-v5-ascii-ligatures.otf` | `nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.otf` | separate `nasin-nanpa-4.0.2-Helvetica.otf` |
| `sitelenSeliKiwen` | `sitelenselikiwenjuniko-latin-ligatures.ttf` | `sitelenselikiwenjuniko-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf` | reuses base family `SSK-Juniko` |
| `fairfaxHd` | `FairfaxHD.ttf` | `FairfaxHD-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf` | reuses base family `fairfaxHd` |
| `fairfaxPonaHd` | `FairfaxPonaHD.ttf` | `FairfaxPonaHD-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf` | reuses base family `fairfaxPonaHd` |
| `linjaPona` | `linja-pona.otf` | `linja-pona-nanpa-linja-n-nasin-e-en-ss1223.otf` | separate `nasin-nanpa-4.0.2-Helvetica.otf` |
| `linjaSike` | `linja-sike-5-cartouche-fix.otf` | `linja-sike-5-nanpa-linja-n-nasin-e-en-ss1223.otf` | separate `nasin-nanpa-4.0.2-Helvetica.otf` |
| `nasinSitelenPuMono` | `NasinSitelenPuMono.otf` | `NasinSitelenPuMono-nanpa-linja-n-nasin-e-en-ss1223.otf` | separate `nasin-nanpa-4.0.2-Helvetica.otf` |
| `linjaLipamanka` | `linjalipamanka-normal-cartouche-fix.otf` | `linjalipamanka-normal-nanpa-linja-n-nasin-e-en-ss1223.otf` | separate `nasin-nanpa-4.0.2-Helvetica.otf` |

Because the same literal face is shared, the complete eight-font production profile requires **17 distinct manifest-referenced font binaries**, not 24.

### Expected portable `fonts/` directory

For packages/tools that load production fonts from a filesystem directory, a complete canonical font directory can be laid out as follows:

```text
fonts/
├── preloaded-font-pairs.manifest.json
├── nasin-nanpa-5.0.0-beta.3-UCSUR-v5-ascii-ligatures.otf
├── nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.otf
├── nasin-nanpa-4.0.2-Helvetica.otf
├── sitelenselikiwenjuniko-latin-ligatures.ttf
├── sitelenselikiwenjuniko-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf
├── FairfaxHD.ttf
├── FairfaxHD-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf
├── FairfaxPonaHD.ttf
├── FairfaxPonaHD-nanpa-linja-n-good-kasi-nasin-e-en-ss1223.ttf
├── linja-pona.otf
├── linja-pona-nanpa-linja-n-nasin-e-en-ss1223.otf
├── linja-sike-5-cartouche-fix.otf
├── linja-sike-5-nanpa-linja-n-nasin-e-en-ss1223.otf
├── NasinSitelenPuMono.otf
├── NasinSitelenPuMono-nanpa-linja-n-nasin-e-en-ss1223.otf
├── linjalipamanka-normal-cartouche-fix.otf
└── linjalipamanka-normal-nanpa-linja-n-nasin-e-en-ss1223.otf
```

Some packages call the manifest `production-font-pairs.manifest.json` instead of `preloaded-font-pairs.manifest.json`; use the filename expected by that package. Rust and Go embed the equivalent manifest and font bytes at build time, and Java bundles the manifest but expects the actual font binaries from the configured font directory. Each language section above states its exact consumer behavior.

### Additional support fonts

The canonical browser/vector asset set also contains these support faces:

```text
PatrickHand-Regular.ttf
LiberationSans-Regular.ttf
LiberationSerif-Regular.ttf
LiberationMono-Regular.ttf
```

They are **not additional production `fontKey` pairs**. `PatrickHand-Regular.ttf` is used by the canonical/full renderer for literal or unknown Latin text where that role is required. The Liberation faces provide deterministic vector-export substitutes for common Latin/system families such as Arial/system-ui, Times New Roman and Courier New.

When copying the canonical JavaScript/Node/Python font asset directory wholesale, keep these files with it. Native implementations that do not use those browser/vector fallback roles do not necessarily require all four support faces; their language sections and regression scripts are authoritative for their runtime requirements.

### Manual-tally versus font-glyph tally configurations

Five production configurations use **renderer-drawn manual tallies**:

```text
nasinNanpa
linjaPona
linjaSike
nasinSitelenPuMono
linjaLipamanka
```

For those five configurations, **U+F199E must not be inserted into the shaped font run**. The renderer owns the tally geometry. When halo is enabled, the tally-group halo backing is painted first and the normal foreground tally strokes are painted on top.

The other three production configurations use their native UCSUR U+F199E tally glyph.

### First-time setup rule

For a basic application, do not manually choose `baseFilename`, `companionFilename`, or tally mode. Do this instead:

1. create/open the language facade;
2. make sure that implementation can find its production manifest and font assets as described in its language section;
3. pass one of the eight `fontKey` values, for example `nasinNanpa`;
4. parse or render text.

The manifest is the configuration contract between the font key and the renderer.

## Protocol v1.0.0

Extract the protocol release and verify it before using a reference implementation as a compatibility target:

```bash
unzip nanpa-linja-n-protocol-v1.0.0.zip
cd nanpa-linja-n-protocol-v1.0.0
python verify_release.py
```

Primary protocol documents:

```text
SPEC.md
API.md
CONFORMANCE.md
RENDERING-PROFILE.md
VERSIONING.md
README.md
```

Use `SPEC.md` as the primary protocol specification. The bundled language-neutral conformance corpus is the compatibility target.

Current reference packages target:

```text
nanpa-linja-n Protocol v1.0.0
Conformance corpus v1.0.2
1017 frozen protocol regression checks
```

## Implementing nanpa-linja-n in another language

Use the protocol, not a reference implementation, as the definition of expected behavior.

Start with:

```text
protocol/nanpa-linja-n-protocol-v1.0.0.zip
```

Read at minimum:

```text
SPEC.md
CONFORMANCE.md
API.md
RENDERING-PROFILE.md
```

Use the bundled conformance corpus as the compatibility target. Reference implementations are useful for implementation details, diagnostics and differential testing, but they do not override the protocol.

For full-document rendering compatibility, preserve the semantic distinctions used by the reference profile, including font-specific render adapters and the manual-vs-UCSUR tally routing defined by the production font manifest.

## Canonical JavaScript reference

The canonical JavaScript renderer filename used for cross-reference and maintenance is:

```text
renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

## Disclaimer

These reference implementations and associated tools are provided **“as is”**, with no claim, guarantee, or warranty that their output is correct, complete, or suitable for any purpose. You are responsible for verifying results.
