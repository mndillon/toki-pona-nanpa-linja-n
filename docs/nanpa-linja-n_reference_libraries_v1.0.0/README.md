# nanpa-linja-n

This repository contains the frozen **nanpa-linja-n Protocol v1.0.0** and its JavaScript, TypeScript, and Python reference implementations.

The protocol is the normative definition of nanpa-linja-n. The reference implementations demonstrate conformance with the protocol.

## Repository structure

```text
nanpa-linja-n_reference_libraries_v1.0.0/
├── protocol/
│   └── nanpa-linja-n-protocol-v1.0.0.zip
│
└── reference_implementations/
    ├── javascript/
    │   └── nanpa-linja-n-javascript-reference-for-protocol-v1.0.0.zip
    │
    ├── typescript/
    │   └── nanpa-linja-n-typescript-reference-for-protocol-v1.0.0.zip
    │
    └── python/
        └── nanpa-linja-n-python-reference-for-protocol-v1.0.0.zip
```

## Protocol v1.0.0

Download:

```text
protocol/nanpa-linja-n-protocol-v1.0.0.zip
```

Extract it:

```bash
unzip nanpa-linja-n-protocol-v1.0.0.zip
cd nanpa-linja-n-protocol-v1.0.0
```

Verify the frozen release:

```bash
python verify_release.py
```

The verification must complete successfully.

The main protocol documents are:

```text
SPEC.md
API.md
CONFORMANCE.md
RENDERING-PROFILE.md
VERSIONING.md
README.md
```

Use `SPEC.md` as the primary protocol specification.

The protocol includes the language-neutral conformance corpus used by the reference implementations.

---

## JavaScript reference implementation

Download:

```text
reference_implementations/javascript/nanpa-linja-n-javascript-reference-for-protocol-v1.0.0.zip
```

Extract it:

```bash
unzip nanpa-linja-n-javascript-reference-for-protocol-v1.0.0.zip
cd nanpa-linja-n-browser-font-regression-v0.1.3-reference
```

Install the Node.js dependencies:

```bash
npm install
```

Run the complete JavaScript reference test suite:

```bash
npm test
```

A conforming reference run includes:

```text
1017 protocol regression checks
94 browser-core checks
90 production-font checks
128 SVG golden artifacts
64 full cartouches
64 abbreviated cartouches
```

The complete test run must finish with:

```text
ALL CONFIGURED TESTS PASS
```

The canonical JavaScript renderer/parser reference file is:

```text
reference/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

Do not rename this file when comparing or maintaining reference implementations.

---

## TypeScript reference implementation

Download:

```text
reference_implementations/typescript/nanpa-linja-n-typescript-reference-for-protocol-v1.0.0.zip
```

Extract it:

```bash
unzip nanpa-linja-n-typescript-reference-for-protocol-v1.0.0.zip
cd nanpa-linja-n-typescript-v0.1.2-reference
```

Install the Node.js dependencies:

```bash
npm install
```

Build and test the TypeScript reference binding:

```bash
npm test
```

The test must finish with:

```text
facade frozen-runtime tests: PASS
```

Run the protocol conformance regression:

```bash
npm run regression -- ./reference/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

The expected result is:

```text
nanpa-linja-n regression checks: 1017
failures: 0
PASS
```

The TypeScript implementation is a typed binding around the canonical JavaScript implementation. The protocol remains the normative definition.

---

## Python reference implementation

Download:

```text
reference_implementations/python/nanpa-linja-n-python-reference-for-protocol-v1.0.0.zip
```

Extract it:

```bash
unzip nanpa-linja-n-python-reference-for-protocol-v1.0.0.zip
cd nanpa-linja-n-python-v0.1.1-reference
```

Install the Python package from the extracted directory:

```bash
python -m pip install .
```

Run the protocol regression:

```bash
python scripts/run_regression.py
```

The expected result is:

```text
nanpa-linja-n regression checks: 1017
failures: 0
```

Run the Python-to-JavaScript differential test:

```bash
python scripts/run_differential.py \
  ./reference/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```

The expected result is:

```text
differential API invocations: 335
mismatches: 0
```

Run the complete Python test suite:

```bash
python scripts/run_all.py
```

A successful run includes:

```text
golden baseline: 128 approved, 128 current, 128 matched
Python font goldens: 128 artifact(s) (64 full + 64 abbreviated) PASS
ALL CONFIGURED PYTHON TESTS PASS
```

---

## Implementing nanpa-linja-n in another language

Use the protocol, not one of the reference implementations, as the definition of expected behaviour.

Start with:

```text
protocol/nanpa-linja-n-protocol-v1.0.0.zip
```

Extract it and read:

```text
SPEC.md
CONFORMANCE.md
API.md
```

Use the bundled conformance corpus as the compatibility target.

The JavaScript, TypeScript, and Python implementations can be used to compare results and investigate implementation details, but they do not override the protocol.

## Protocol compatibility

The reference implementations in this repository target:

```text
nanpa-linja-n Protocol v1.0.0
Conformance corpus v1.0.2
1017 protocol regression checks
```

The canonical renderer filename used by the reference implementations is:

```text
renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js
```
