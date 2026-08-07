import SitelenRenderer, { NanpaParser } from "./renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=223";
import { buildSitelenAudioPlan } from "./sitelen-audio-plan.js?v=40";
import { createTokiPonaVoice } from "./toki-pona-voice-api.js?v=40";
import { REFERENCE_AUDIO_MANIFEST } from "./audio-manifest.js?v=22";
import {
  createSitelenFontPairController,
  TEXT_FONT_OPTION_SITELEN,
  TEXT_FONT_OPTION_NANPA_LINJA_N,
} from "./sitelen-font-pair-controller-merged-updated-font-label.js?v=20";
import { CartoucheApi } from "./cartouche-api-v3-previewdesc.js";
import {
  canvasToPngBlob,
  createZipBlob,
  downloadBlob,
  encodeUtf8,
} from "./simple-zip.js";

const APP_SCHEMA_VERSION = 2;
const STORAGE_KEY = "tp_nln_anki_builder_project_v1";
const MEDIA_PREFIX = "tp_nln_";
const DEFAULT_TEXT_FAMILY = "TP-Nasin-Nanpa-Font";
const DEFAULT_NUMBER_FAMILY = "TP-Cartouche-Font";
const DEFAULT_LITERAL_FAMILY = "system-ui";

const CARD_TYPE_DEFINITIONS = Object.freeze({
  "abbreviated-to-number": { settingKey: "abbreviatedToNumber", label: "Abbreviated cartouche → number", defaultFront: "Read this cartouche", defaultBack: note => note.source },
  "number-to-proper-name": { settingKey: "numberToProperName", label: "Number → proper name", defaultFront: "Give the relaxed nanpa-linja-n proper name", defaultBack: note => note.properNameRelaxed || note.validation?.parsed?.properName || "" },
  "audio-to-number": { settingKey: "audioToNumber", label: "Audio → number", defaultFront: "Listen and identify the value", defaultBack: note => note.source },
  "proper-name-to-number": { settingKey: "properNameToNumber", label: "Proper name → number", defaultFront: "Decode this proper name", defaultBack: note => note.source },
  "full-cartouche-to-number": { settingKey: "fullToNumber", label: "Full cartouche → number", defaultFront: "Read this full cartouche", defaultBack: note => note.source },
});

const FONT_PRESETS = {
  nasinNanpa: {
    key: "nasinNanpa",
    label: "nasin nanpa predefined",
    parserMode: "sitelen-seli-kiwen",
    textFamily: DEFAULT_TEXT_FAMILY,
    cartoucheFamily: DEFAULT_NUMBER_FAMILY,
    literalFamily: DEFAULT_LITERAL_FAMILY,
    literalCartoucheFamily: DEFAULT_TEXT_FAMILY,
    settings: {
      literalCartoucheRuleClipScale: 0.24985,
      literalCartoucheRuleClipStrategy: "leftCap",
      literalCartoucheLeftCapClipRatio: 0.90,
    },
    literalOptions: [
      [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
      [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
      [DEFAULT_LITERAL_FAMILY, "system-ui"],
    ],
    faces: [
      {
        family: DEFAULT_TEXT_FAMILY,
        url: "./fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf",
        format: "opentype",
        sample: String.fromCodePoint(0xF196C),
      },
      {
        family: DEFAULT_NUMBER_FAMILY,
        url: "./fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf",
        format: "opentype",
        sample: String.fromCodePoint(0xF1990),
      },
    ],
  },
};

const SAMPLE_CSV = `Prompt,Answer,Extra,Category,Decimal,ProperNameRelaxed,StrictRecognition,Tags
Read this abbreviated cartouche,125,Relaxed proper name: Newatulun,Conversion practice,125,Newatulun,Newetelen,conversion integer
Read this abbreviated cartouche,2.5,The decimal point creates a natural word boundary.,Conversion practice,2.5,Netun One Lun,Nete One Len,conversion decimal
Read this abbreviated cartouche,-42,Negative values begin with no after the opening ne.,Conversion practice,-42,Neno Nan Tun,Neno Nan Ten,conversion negative
Read this abbreviated cartouche,03:05,Leading zeros are preserved.,Dates and times,03:05,Nenin Sen Eke Ninin Lun,Nenin Sen Eke Ninin Len,time leading_zero
Read this abbreviated cartouche,2026-07-28,Date notation is preserved as a date cartouche.,Dates and times,2026-07-28,, ,date
`;

const state = {
  project: null,
  selectedNoteId: null,
  editingNoteId: null,
  rendererBySignature: new Map(),
  mediaCache: new Map(),
  previewUrls: new Set(),
  pageMap: new Map(),
  voice: null,
  fontController: null,
  cancelRequested: false,
  exportRunning: false,
  previewRequestId: 0,
  previewCards: [],
  previewMedia: null,
  previewCardType: "",
  editorCardTextOverrides: {},
  editorCardType: "",
};

const $ = id => document.getElementById(id);

const el = {
  loadingVeil: $("loadingVeil"),
  statusText: $("statusText"),
  summary: $("summary"),
  notesBody: $("notesBody"),
  selectAll: $("selectAll"),
  progressWrap: $("progressWrap"),
  progress: $("progress"),
  progressText: $("progressText"),
  fileCsv: $("fileCsv"),
  fileProject: $("fileProject"),
  btnNew: $("btnNew"),
  btnImportCsv: $("btnImportCsv"),
  btnSample: $("btnSample"),
  btnImportProject: $("btnImportProject"),
  btnExportProject: $("btnExportProject"),
  btnAdd: $("btnAdd"),
  btnValidate: $("btnValidate"),
  btnGenerate: $("btnGenerate"),
  btnCancel: $("btnCancel"),
  previewEmpty: $("previewEmpty"),
  previewCardArea: $("previewCardArea"),
  previewNoteTitle: $("previewNoteTitle"),
  previewTabs: $("previewTabs"),
  previewProblem: $("previewProblem"),
  previewFront: $("previewFront"),
  previewBack: $("previewBack"),
  editorOverlay: $("editorOverlay"),
  btnEditorClose: $("btnEditorClose"),
  btnEditorCancel: $("btnEditorCancel"),
  btnEditorSave: $("btnEditorSave"),
};

function nowIso() {
  return new Date().toISOString();
}

function timestampFile() {
  const d = new Date();
  const p = value => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultProject() {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    projectId: `anki_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deck: {
      name: "nanpa-linja-n practice",
      description: "Practice reading and recognising relaxed nanpa-linja-n numeric cartouches.",
      author: "",
      tags: "toki_pona nanpa_linja_n",
    },
    settings: {
      relaxedMode: true,
      nasinNanpaPonaMediaFormatting: false,
      generateAbbreviated: true,
      showSpacers: true,
      generateFull: true,
      generateAudio: true,
      includeNasinNanpaPonaEquivalent: false,
      fontPx: 120,
      nnpFontScale: 0.25,
      renderScale: 2,
      foreground: "#111111",
      audioSpeed: 1,
      cardTypes: {
        abbreviatedToNumber: true,
        numberToProperName: true,
        audioToNumber: true,
        properNameToNumber: false,
        fullToNumber: false,
      },
    },
    notes: [],
  };
}

function normalizeProject(project) {
  const base = createDefaultProject();
  const value = project && typeof project === "object" ? project : {};
  const output = {
    ...base,
    ...value,
    schemaVersion: APP_SCHEMA_VERSION,
    deck: { ...base.deck, ...(value.deck || {}) },
    settings: {
      ...base.settings,
      ...(value.settings || {}),
      relaxedMode: true,
      nasinNanpaPonaMediaFormatting: false,
      cardTypes: {
        ...base.settings.cardTypes,
        ...(value.settings?.cardTypes || {}),
      },
    },
    notes: Array.isArray(value.notes) ? value.notes.map(normalizeNote) : [],
  };
  output.settings.fontPx = clampNumber(output.settings.fontPx, 32, 512, 120);
  output.settings.nnpFontScale = clampNumber(output.settings.nnpFontScale, 0.10, 1, 0.25);
  output.settings.renderScale = clampNumber(output.settings.renderScale, 1, 4, 2);
  output.settings.foreground = normalizeHex(output.settings.foreground, "#111111");
  const types = output.settings.cardTypes;
  output.settings.generateAbbreviated = Object.values(types).some(Boolean);
  output.settings.generateFull = !!types.fullToNumber;
  output.settings.generateAudio = !!types.audioToNumber;
  output.updatedAt = nowIso();
  return output;
}

function normalizeCardTextOverrides(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const output = {};
  for (const type of Object.keys(CARD_TYPE_DEFINITIONS)) {
    const entry = source[type] && typeof source[type] === "object" ? source[type] : {};
    output[type] = {
      frontPrompt: String(entry.frontPrompt ?? "").trim(),
      backAnswer: String(entry.backAnswer ?? "").trim(),
    };
  }
  return output;
}

function normalizeNote(note = {}) {
  const source = String(note.source ?? note.Decimal ?? note.decimal ?? "").trim();
  const prompt = String(note.prompt ?? note.Prompt ?? "").trim();
  const answer = String(note.answer ?? note.Answer ?? "").trim();
  const cardTextOverrides = normalizeCardTextOverrides(note.cardTextOverrides);
  if (!cardTextOverrides["abbreviated-to-number"].frontPrompt && prompt) cardTextOverrides["abbreviated-to-number"].frontPrompt = prompt;
  if (!cardTextOverrides["abbreviated-to-number"].backAnswer && answer) cardTextOverrides["abbreviated-to-number"].backAnswer = answer;
  return {
    id: String(note.id || `note_${fnv1a(`${source}|${note.prompt || ""}|${Math.random()}`)}`),
    enabled: note.enabled !== false,
    source,
    prompt,
    answer,
    cardTextOverrides,
    extra: String(note.extra ?? note.Extra ?? "").trim(),
    category: String(note.category ?? note.Category ?? "Uncategorised").trim() || "Uncategorised",
    properNameRelaxed: String(note.properNameRelaxed ?? note.ProperNameRelaxed ?? "").trim(),
    strictRecognition: String(note.strictRecognition ?? note.StrictRecognition ?? "").trim(),
    fullCartoucheWords: String(note.fullCartoucheWords ?? note.FullCartoucheWords ?? "").trim(),
    abbreviatedCartoucheWords: String(note.abbreviatedCartoucheWords ?? note.AbbreviatedCartoucheWords ?? "").trim(),
    hashAbbreviation: String(note.hashAbbreviation ?? note.HashAbbreviation ?? "").trim(),
    context: String(note.context ?? note.Context ?? "").trim(),
    tags: String(note.tags ?? note.Tags ?? "").trim(),
    createdAt: String(note.createdAt || nowIso()),
    updatedAt: nowIso(),
    validation: null,
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(value, fallback = "#111111") {
  const text = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : fallback;
}

function setStatus(message) {
  el.statusText.textContent = String(message || "");
}

function fnv1a(value) {
  const text = String(value ?? "");
  let hash = 0x811C9DC5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function cleanTsvField(value) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\t/g, " ");
}

function tagString(...parts) {
  const values = parts
    .flatMap(part => String(part || "").split(/[\s,;]+/))
    .map(tag => tag.trim().replace(/[^A-Za-z0-9_:-]+/g, "_"))
    .filter(Boolean);
  return Array.from(new Set(values)).join(" ");
}

function parseRelaxedNumber(source) {
  if (!source) return null;
  return NanpaParser.parseNumber(source, {
    mode: "uniform",
    numericMode: "uniform",
    mixedStyle: "short",
    relaxedNanpaLinjanParsing: true,
    relaxedNanpaLinjanRendering: true,
  });
}

function validationForNote(note, duplicateCount = 1) {
  const errors = [];
  const warnings = [];
  let parsed = null;
  if (note.source) {
    parsed = parseRelaxedNumber(note.source);
    if (!parsed) errors.push("The source is not a valid nanpa-linja-n numeric expression.");
  } else if (!note.prompt || !note.answer) {
    errors.push("Provide a numeric source or both a prompt and answer.");
  }
  if (duplicateCount > 1 && note.source) warnings.push("Another enabled note uses the same source expression.");
  if (parsed && note.properNameRelaxed && note.properNameRelaxed !== parsed.properName) {
    warnings.push(`Proper-name override differs from parser output: ${parsed.properName}`);
  }
  if (parsed && !note.properNameRelaxed) note.properNameRelaxed = parsed.properName;
  return {
    ok: errors.length === 0,
    level: errors.length ? "bad" : warnings.length ? "warn" : "ok",
    errors,
    warnings,
    parsed,
  };
}

function validateAllNotes({ render = true } = {}) {
  const counts = new Map();
  for (const note of state.project.notes.filter(item => item.enabled && item.source)) {
    counts.set(note.source, (counts.get(note.source) || 0) + 1);
  }
  for (const note of state.project.notes) {
    note.validation = validationForNote(note, counts.get(note.source) || 1);
  }
  state.project.updatedAt = nowIso();
  saveProject();
  if (render) renderAll();
  return state.project.notes.every(note => !note.enabled || note.validation?.ok);
}

function saveProject() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
  } catch (error) {
    console.warn("Could not save builder project", error);
  }
}

function loadStoredProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProject(JSON.parse(raw)) : createDefaultProject();
  } catch {
    return createDefaultProject();
  }
}

function deriveRequiredMediaSettings() {
  const settings = state.project.settings;
  const types = settings.cardTypes;
  const anyNumericCard = Object.values(types).some(Boolean);
  settings.generateAbbreviated = anyNumericCard;
  settings.generateFull = !!types.fullToNumber;
  settings.generateAudio = !!types.audioToNumber;
}

function readSettingsFromUi() {
  const p = state.project;
  p.deck.name = $("deckName").value.trim();
  p.deck.description = $("deckDescription").value.trim();
  p.deck.author = $("deckAuthor").value.trim();
  p.deck.tags = $("deckTags").value.trim();
  p.settings.showSpacers = $("showSpacers").checked;
  p.settings.includeNasinNanpaPonaEquivalent = $("includeNnp").checked;
  p.settings.fontPx = clampNumber($("fontPx").value, 32, 512, 120);
  p.settings.nnpFontScale = clampNumber(Number($("nnpFontPercent").value) / 100, 0.10, 1, 0.25);
  p.settings.renderScale = clampNumber($("renderScale").value, 1, 4, 2);
  p.settings.foreground = normalizeHex($("foreground").value, "#111111");
  p.settings.cardTypes.abbreviatedToNumber = $("cardAbbrNumber").checked;
  p.settings.cardTypes.numberToProperName = $("cardNumberProper").checked;
  p.settings.cardTypes.audioToNumber = $("cardAudioNumber").checked;
  p.settings.cardTypes.properNameToNumber = $("cardProperNumber").checked;
  p.settings.cardTypes.fullToNumber = $("cardFullNumber").checked;
  deriveRequiredMediaSettings();
  p.settings.relaxedMode = true;
  p.settings.nasinNanpaPonaMediaFormatting = false;
  p.updatedAt = nowIso();
  state.rendererBySignature.clear();
  saveProject();
}

function writeSettingsToUi() {
  const p = state.project;
  deriveRequiredMediaSettings();
  $("deckName").value = p.deck.name;
  $("deckDescription").value = p.deck.description;
  $("deckAuthor").value = p.deck.author;
  $("deckTags").value = p.deck.tags;
  $("showSpacers").checked = !!p.settings.showSpacers;
  $("includeNnp").checked = !!p.settings.includeNasinNanpaPonaEquivalent;
  $("fontPx").value = String(p.settings.fontPx);
  $("nnpFontPercent").value = String(Math.round(p.settings.nnpFontScale * 100));
  $("renderScale").value = String(p.settings.renderScale);
  $("foreground").value = p.settings.foreground;
  $("cardAbbrNumber").checked = !!p.settings.cardTypes.abbreviatedToNumber;
  $("cardNumberProper").checked = !!p.settings.cardTypes.numberToProperName;
  $("cardAudioNumber").checked = !!p.settings.cardTypes.audioToNumber;
  $("cardProperNumber").checked = !!p.settings.cardTypes.properNameToNumber;
  $("cardFullNumber").checked = !!p.settings.cardTypes.fullToNumber;
}

function renderSummary() {
  const enabled = state.project.notes.filter(note => note.enabled);
  const valid = enabled.filter(note => note.validation?.ok);
  const warning = enabled.filter(note => note.validation?.level === "warn");
  const invalid = enabled.filter(note => note.validation?.level === "bad");
  const mediaCount = Array.from(state.mediaCache.values()).filter(item => item instanceof Blob).length;
  const cardTypeCount = Object.values(state.project.settings.cardTypes).filter(Boolean).length;
  el.summary.innerHTML = [
    `<span class="pill">${cardTypeCount} card type${cardTypeCount === 1 ? "" : "s"}</span>`,
    `<span class="pill">${state.project.notes.length} notes</span>`,
    `<span class="pill ok">${valid.length} valid</span>`,
    warning.length ? `<span class="pill warn">${warning.length} warning</span>` : "",
    invalid.length ? `<span class="pill bad">${invalid.length} invalid</span>` : "",
    `<span class="pill">${mediaCount} cached media files</span>`,
    `<span class="pill">prefix: <span class="mono">${MEDIA_PREFIX}</span></span>`,
  ].join("");
}

function mediaLabel(note) {
  const files = mediaFilenamesForNote(note);
  const ready = Object.values(files).filter(Boolean).filter(name => state.mediaCache.has(name)).length;
  const total = Object.values(files).filter(Boolean).length;
  return total ? `${ready}/${total}` : "—";
}

function renderNotesTable() {
  el.notesBody.textContent = "";
  for (const note of state.project.notes) {
    const validation = note.validation || validationForNote(note);
    note.validation = validation;
    const row = document.createElement("tr");
    row.dataset.noteId = note.id;
    if (note.id === state.selectedNoteId) row.classList.add("selected");
    const proper = note.properNameRelaxed || validation.parsed?.properName || "";
    const messages = [...validation.errors, ...validation.warnings].join(" ");
    row.innerHTML = `
      <td><input type="checkbox" class="noteEnabled" ${note.enabled ? "checked" : ""} aria-label="Include note"></td>
      <td><strong>${escapeHtml(note.source || note.prompt || "(text note)")}</strong></td>
      <td>${escapeHtml(proper || "—")}</td>
      <td>${escapeHtml(note.category)}</td>
      <td title="${escapeHtml(messages)}"><span class="statusDot ${validation.level}"></span>${validation.level === "ok" ? "Valid" : validation.level === "warn" ? "Warning" : "Invalid"}</td>
      <td class="mono">${mediaLabel(note)}</td>
      <td><div class="rowBtns"><button type="button" data-action="preview">View cards</button><button type="button" data-action="edit">Edit</button><button type="button" data-action="delete" class="danger">Delete</button></div></td>`;
    row.addEventListener("click", event => {
      if (event.target.closest("button,input")) return;
      selectNote(note.id);
    });
    row.querySelector(".noteEnabled").addEventListener("change", event => {
      note.enabled = event.target.checked;
      validateAllNotes();
    });
    row.querySelector('[data-action="preview"]').addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void selectNote(note.id, { generate: true });
    });
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(note.id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteNote(note.id));
    el.notesBody.appendChild(row);
  }
  const enabled = state.project.notes.filter(note => note.enabled).length;
  el.selectAll.checked = state.project.notes.length > 0 && enabled === state.project.notes.length;
  el.selectAll.indeterminate = enabled > 0 && enabled < state.project.notes.length;
}

function renderAll() {
  writeSettingsToUi();
  renderSummary();
  renderNotesTable();
}

function clearPreviewUrls() {
  for (const url of state.previewUrls) URL.revokeObjectURL(url);
  state.previewUrls.clear();
}

function previewImage(container, blob, alt) {
  container.textContent = "";
  if (!blob) {
    container.innerHTML = '<span class="hint">Not generated.</span>';
    return;
  }
  const url = URL.createObjectURL(blob);
  state.previewUrls.add(url);
  const image = document.createElement("img");
  image.src = url;
  image.alt = alt;
  container.appendChild(image);
}

function showPreviewProblem(message = "") {
  el.previewProblem.textContent = String(message || "");
}

async function renderNasinNanpaPonaBlob(text) {
  if (!text) throw new Error("No nasin nanpa pona equivalent was supplied.");
  const nnpFontPx = Math.max(8, Math.round(state.project.settings.fontPx * state.project.settings.nnpFontScale));
  const { renderer } = await getRenderer({ abbreviated: false, nasinNanpaPona: false, fontPx: nnpFontPx });
  const rendered = await renderer.renderTextToNewCanvas({
    input: text,
    supersampleScale: state.project.settings.renderScale,
    downsample: false,
  });
  return await canvasToPngBlob(rendered.canvas || rendered);
}

function previewMediaUrl(filename) {
  if (!filename) return "";
  const blob = state.mediaCache.get(filename);
  if (!(blob instanceof Blob)) return "";
  const url = URL.createObjectURL(blob);
  state.previewUrls.add(url);
  return url;
}

function renderCardHtml(container, html) {
  const soundPattern = /\[sound:([^\]]+)\]/g;
  const soundFiles = [];
  const withSoundSlots = String(html || "").replace(soundPattern, (_, filename) => {
    const index = soundFiles.push(filename) - 1;
    return `<span data-preview-sound="${index}"></span>`;
  });
  container.innerHTML = withSoundSlots;
  for (const image of container.querySelectorAll("img[src]")) {
    const filename = image.getAttribute("src") || "";
    const url = previewMediaUrl(filename);
    if (url) image.src = url;
    else image.replaceWith(Object.assign(document.createElement("span"), { className: "hint", textContent: `Image unavailable: ${filename}` }));
  }
  for (const slot of container.querySelectorAll("[data-preview-sound]")) {
    const filename = soundFiles[Number(slot.dataset.previewSound)] || "";
    const url = previewMediaUrl(filename);
    if (url) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = url;
      slot.replaceWith(audio);
    } else {
      slot.replaceWith(Object.assign(document.createElement("span"), { className: "hint", textContent: `Audio unavailable: ${filename}` }));
    }
  }
}

function renderSelectedPreviewCard() {
  const cards = state.previewCards || [];
  if (!cards.length) return;
  let card = cards.find(item => item.type === state.previewCardType) || cards[0];
  state.previewCardType = card.type;
  for (const button of el.previewTabs.querySelectorAll("button[data-card-type]")) {
    button.classList.toggle("active", button.dataset.cardType === card.type);
  }
  clearPreviewUrls();
  renderCardHtml(el.previewFront, card.front);
  el.previewBack.textContent = "";
  const repeatedFront = document.createElement("div");
  renderCardHtml(repeatedFront, card.front);
  el.previewBack.appendChild(repeatedFront);
  const divider = document.createElement("hr");
  divider.id = "answer";
  el.previewBack.appendChild(divider);
  const answer = document.createElement("div");
  renderCardHtml(answer, card.back);
  el.previewBack.appendChild(answer);
}

function renderPreviewTabs(cards) {
  el.previewTabs.textContent = "";
  for (const card of cards) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.cardType = card.type;
    button.textContent = card.label;
    button.addEventListener("click", () => {
      state.previewCardType = card.type;
      renderSelectedPreviewCard();
    });
    el.previewTabs.appendChild(button);
  }
}

async function selectNote(noteId, { generate = true } = {}) {
  const requestId = ++state.previewRequestId;
  state.selectedNoteId = noteId;
  renderNotesTable();
  const note = state.project.notes.find(item => item.id === noteId);
  if (!note) return;
  const isCurrentRequest = () => requestId === state.previewRequestId && state.selectedNoteId === noteId;
  const validation = note.validation || validationForNote(note);
  note.validation = validation;
  el.previewEmpty.hidden = true;
  el.previewCardArea.hidden = false;
  el.previewNoteTitle.textContent = note.source || note.prompt || "Selected note";
  el.previewTabs.textContent = "";
  el.previewFront.innerHTML = '<span class="hint">Preparing preview…</span>';
  el.previewBack.innerHTML = '<span class="hint">Preparing preview…</span>';
  showPreviewProblem("");
  clearPreviewUrls();

  if (!generate) {
    el.previewFront.innerHTML = '<span class="hint">Choose View cards to generate this preview.</span>';
    el.previewBack.innerHTML = '<span class="hint">The complete answer side will appear here.</span>';
    return;
  }
  if (!validation.ok) {
    const message = validation.errors.join(" ") || "This note is invalid.";
    showPreviewProblem(message);
    el.previewFront.innerHTML = `<span class="hint">${escapeHtml(message)}</span>`;
    el.previewBack.innerHTML = `<span class="hint">${escapeHtml(message)}</span>`;
    setStatus(`Card preview unavailable: ${message}`);
    return;
  }
  if (!Object.values(state.project.settings.cardTypes).some(Boolean)) {
    const message = "Choose at least one card type in step 1.";
    showPreviewProblem(message);
    el.previewFront.innerHTML = `<span class="hint">${escapeHtml(message)}</span>`;
    el.previewBack.innerHTML = `<span class="hint">${escapeHtml(message)}</span>`;
    return;
  }

  setStatus(`Generating Anki card preview for ${note.source || note.prompt}…`);
  try {
    const media = note.source ? await generateNoteMedia(note, { previewOnly: true }) : { filenames: {} };
    if (!isCurrentRequest()) return;
    const cards = buildCardDefinitionsForNote(note, media);
    state.previewMedia = media;
    state.previewCards = cards;
    if (!cards.length) throw new Error("The selected card types do not produce a card for this note.");
    if (!cards.some(card => card.type === state.previewCardType)) state.previewCardType = cards[0].type;
    renderPreviewTabs(cards);
    renderSelectedPreviewCard();
    const problems = Array.isArray(media.errors) ? media.errors : [];
    showPreviewProblem(problems.length ? `Some media could not be generated: ${problems.join("; ")}` : "This preview uses the same card HTML and cached media that will be exported.");
    renderSummary();
    renderNotesTable();
    setStatus(problems.length ? `Preview completed with ${problems.length} media problem${problems.length === 1 ? "" : "s"}.` : `Previewed ${note.source || note.prompt}.`);
  } catch (error) {
    if (!isCurrentRequest()) return;
    console.error("Card preview failed", error);
    showPreviewProblem(error.message);
    el.previewFront.innerHTML = `<span class="hint">Preview failed: ${escapeHtml(error.message)}</span>`;
    el.previewBack.innerHTML = `<span class="hint">Preview failed: ${escapeHtml(error.message)}</span>`;
    setStatus(`Preview failed: ${error.message}`);
  }
}

function deleteNote(noteId) {
  const note = state.project.notes.find(item => item.id === noteId);
  if (!note) return;
  if (!confirm(`Delete note ${note.source || note.prompt || ""}?`)) return;
  state.project.notes = state.project.notes.filter(item => item.id !== noteId);
  if (state.selectedNoteId === noteId) state.selectedNoteId = null;
  validateAllNotes();
  resetPreview();
}

function resetPreview() {
  clearPreviewUrls();
  state.previewCards = [];
  state.previewMedia = null;
  state.previewCardType = "";
  el.previewEmpty.hidden = false;
  el.previewCardArea.hidden = true;
  el.previewTabs.textContent = "";
  el.previewFront.textContent = "";
  el.previewBack.textContent = "";
  showPreviewProblem("");
}

function enabledCardTypesForEditor() {
  const enabled = Object.entries(CARD_TYPE_DEFINITIONS)
    .filter(([, definition]) => !!state.project.settings.cardTypes[definition.settingKey])
    .map(([type]) => type);
  return enabled.length ? enabled : Object.keys(CARD_TYPE_DEFINITIONS);
}

function saveCurrentEditorCardText() {
  const type = state.editorCardType;
  if (!type) return;
  state.editorCardTextOverrides[type] = {
    frontPrompt: $("editFrontPrompt").value.trim(),
    backAnswer: $("editBackAnswer").value.trim(),
  };
}

function loadEditorCardText(type) {
  state.editorCardType = type;
  const note = state.editingNoteId ? state.project.notes.find(item => item.id === state.editingNoteId) : normalizeNote({});
  const entry = state.editorCardTextOverrides[type] || { frontPrompt: "", backAnswer: "" };
  const definition = CARD_TYPE_DEFINITIONS[type];
  $("editFrontPrompt").value = entry.frontPrompt || "";
  $("editBackAnswer").value = entry.backAnswer || "";
  $("editFrontDefault").textContent = `Default: ${definition?.defaultFront || "(none)"}`;
  const defaultBack = definition?.defaultBack(note) || "(none)";
  $("editBackDefault").textContent = `Default: ${defaultBack}`;
}

function populateEditorCardTypes() {
  const select = $("editCardType");
  select.textContent = "";
  for (const type of enabledCardTypesForEditor()) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = CARD_TYPE_DEFINITIONS[type].label;
    select.appendChild(option);
  }
  const first = select.options[0]?.value || "abbreviated-to-number";
  select.value = first;
  loadEditorCardText(first);
}

function openEditor(noteId = null) {
  state.editingNoteId = noteId;
  const note = noteId ? state.project.notes.find(item => item.id === noteId) : normalizeNote({});
  $("editSource").value = note?.source || "";
  $("editCategory").value = note?.category || "Uncategorised";
  $("editExtra").value = note?.extra || "";
  $("editProper").value = note?.properNameRelaxed || "";
  $("editContext").value = note?.context || "";
  $("editTags").value = note?.tags || "";
  state.editorCardTextOverrides = normalizeCardTextOverrides(note?.cardTextOverrides);
  populateEditorCardTypes();
  el.editorOverlay.classList.add("open");
  $("editSource").focus();
}

function closeEditor() {
  el.editorOverlay.classList.remove("open");
  state.editingNoteId = null;
  state.editorCardTextOverrides = {};
  state.editorCardType = "";
}

function saveEditor() {
  saveCurrentEditorCardText();
  const existing = state.editingNoteId
    ? state.project.notes.find(item => item.id === state.editingNoteId)
    : normalizeNote({});
  const patch = normalizeNote({
    ...existing,
    source: $("editSource").value,
    category: $("editCategory").value,
    cardTextOverrides: state.editorCardTextOverrides,
    prompt: state.editorCardTextOverrides["abbreviated-to-number"]?.frontPrompt || "",
    answer: state.editorCardTextOverrides["abbreviated-to-number"]?.backAnswer || "",
    extra: $("editExtra").value,
    properNameRelaxed: $("editProper").value,
    context: $("editContext").value,
    tags: $("editTags").value,
  });
  if (state.editingNoteId) {
    const index = state.project.notes.findIndex(item => item.id === state.editingNoteId);
    if (index >= 0) state.project.notes[index] = { ...state.project.notes[index], ...patch, id: state.editingNoteId, updatedAt: nowIso() };
  } else {
    state.project.notes.push(patch);
    state.selectedNoteId = patch.id;
  }
  state.mediaCache.clear();
  closeEditor();
  validateAllNotes();
  if (state.selectedNoteId) void selectNote(state.selectedNoteId);
}

function parseCsv(text) {
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter(values => values.some(value => String(value).trim() !== ""));
}

function canonicalHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function notesFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const known = new Set([
    "prompt", "answer", "extra", "category", "decimal", "source", "number", "input",
    "propernamerelaxed", "strictrecognition", "fullcartouchewords", "abbreviatedcartouchewords",
    "hashabbreviation", "tags", "context",
  ]);
  const firstCanonical = rows[0].map(canonicalHeader);
  const hasHeader = firstCanonical.some(value => known.has(value));
  const headers = hasHeader ? firstCanonical : ["prompt", "answer"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map(values => {
    const record = {};
    headers.forEach((header, index) => { record[header] = values[index] ?? ""; });
    return normalizeNote({
      source: record.decimal || record.source || record.number || record.input || "",
      prompt: record.prompt || "",
      answer: record.answer || "",
      extra: record.extra || "",
      category: record.category || "Uncategorised",
      properNameRelaxed: record.propernamerelaxed || "",
      strictRecognition: record.strictrecognition || "",
      fullCartoucheWords: record.fullcartouchewords || "",
      abbreviatedCartoucheWords: record.abbreviatedcartouchewords || "",
      hashAbbreviation: record.hashabbreviation || "",
      tags: record.tags || "",
      context: record.context || "",
    });
  });
}

function importCsvText(text, { replace = false } = {}) {
  const notes = notesFromCsv(text);
  if (!notes.length) throw new Error("The CSV did not contain any notes.");
  if (replace) state.project.notes = notes;
  else state.project.notes.push(...notes);
  state.mediaCache.clear();
  state.selectedNoteId = notes[0]?.id || null;
  validateAllNotes();
  setStatus(`Imported ${notes.length} note${notes.length === 1 ? "" : "s"}.`);
  if (state.selectedNoteId) void selectNote(state.selectedNoteId);
}

function buildBaseRendererConfig({ abbreviated = false, nasinNanpaPona = false, fontPx = null } = {}) {
  const settings = state.project.settings;
  const preset = state.fontController.getActivePreset();
  const effectiveFontPx = fontPx == null ? settings.fontPx : clampNumber(fontPx, 8, 512, settings.fontPx);
  const baseConfig = {
    layout: {
      fontPx: effectiveFontPx,
      align: "center",
      spacingPreset: "default",
      paddingPx: 18,
    },
    paint: {
      fillStyle: settings.foreground,
      halo: { enabled: false, color: "#FFFFFF", widthPx: 0 },
      unknownText: { style: "outline-box", colorMode: "auto", lineWidthPx: 1.5, paddingPx: 2, dash: false },
    },
    parser: {
      mode: preset.parserMode,
      literalStyle: "double-quote",
      extensionStyle: "ssk",
      cartoucheStyle: "ssk",
      numericMode: "compat",
      mixedStyle: "short",
      showUnknownText: true,
      abbreviateNumericCartouches: abbreviated,
      preserveNumericCartoucheBreaksInAbbreviation: abbreviated && settings.showSpacers,
      relaxedNanpaLinjanParsing: true,
      relaxedNanpaLinjanRendering: true,
      nasinNanpaPona: !!nasinNanpaPona,
    },
    fonts: {
      roles: state.fontController.buildFontRoles({ preset }),
      settings: preset.settings || {},
    },
  };
  return state.fontController.buildRendererConfig({ preset, baseConfig });
}

async function getRenderer(options = {}) {
  const config = buildBaseRendererConfig(options);
  const signature = JSON.stringify(config);
  if (!state.rendererBySignature.has(signature)) {
    await state.fontController.ensureFamiliesLoaded(config.layout.fontPx);
    state.rendererBySignature.set(signature, await SitelenRenderer.create(config));
  }
  return { renderer: state.rendererBySignature.get(signature), config };
}

function findNumericCartoucheRun(plan) {
  const runs = (plan?.lines || []).flatMap(line => line.runs || []);
  return runs.find(run => run.kind === "cartouche" && ["number", "date", "time"].includes(run.fontRole))
    || runs.find(run => run.kind === "cartouche" && run.fontFamily === DEFAULT_NUMBER_FAMILY)
    || runs.find(run => run.kind === "cartouche")
    || null;
}

async function renderNumericCartoucheBlob(source, { abbreviated }) {
  const { renderer, config } = await getRenderer({ abbreviated, nasinNanpaPona: false });
  // The media path always forces nasin nanpa pona conversion off.
  config.parser.nasinNanpaPona = false;
  const plan = await renderer.buildRenderPlan({ input: source, ...config });
  const run = findNumericCartoucheRun(plan);
  if (!run) throw new Error(`No numeric cartouche was produced for “${source}”.`);
  const canvas = await renderer.renderRunToNewCanvas({
    run,
    supersampleScale: state.project.settings.renderScale,
    downsample: false,
  });
  return await canvasToPngBlob(canvas);
}

async function nasinNanpaPonaEquivalent(source) {
  if (!state.project.settings.includeNasinNanpaPonaEquivalent) return "";
  const { renderer, config } = await getRenderer({ abbreviated: false, nasinNanpaPona: true });
  const plan = await renderer.buildRenderPlan({ input: source, ...config });
  const words = (plan?.lines || [])
    .flatMap(line => line.runs || [])
    .filter(run => run.sourceTransform === "nasinNanpaPona" && run.audioText)
    .map(run => String(run.audioText).trim())
    .filter(Boolean);
  return words.join(" ");
}

async function getVoice() {
  if (!state.voice) {
    state.voice = await createTokiPonaVoice({
      manifest: REFERENCE_AUDIO_MANIFEST,
      audioBaseUrl: new URL("../audio/", import.meta.url).href,
    });
  }
  return state.voice;
}

async function renderAudioBlob(source) {
  const { renderer, config } = await getRenderer({ abbreviated: false, nasinNanpaPona: false });
  config.parser.nasinNanpaPona = false;
  const audioPlan = await buildSitelenAudioPlan({
    rawText: source,
    pageMap: state.pageMap,
    renderer,
    rendererConfig: config,
    CartoucheApi,
    NanpaParser,
    nanpaLinjanMode: "uniform",
    mixedStyle: "short",
    relaxedNanpaLinjanParsing: true,
    relaxedNanpaLinjanRendering: true,
    normalizeNonDrawableSourceTokens: true,
  });
  const speech = (audioPlan.speechLines || []).join(". ").trim();
  if (!speech) throw new Error(`No speech text was produced for “${source}”.`);
  const voice = await getVoice();
  return await voice.renderWavBlob(speech, {
    alreadyPreprocessed: true,
    synthesis_mode: "reference_audio",
    speed: state.project.settings.audioSpeed,
    sample_rate: 48000,
  });
}

function noteStableBase(note) {
  return fnv1a(JSON.stringify({
    source: note.source,
    prompt: note.prompt,
    category: note.category,
    properName: note.properNameRelaxed,
  }));
}

function nasinNanpaPonaFilenameForNote(note, equivalent) {
  const settings = state.project.settings;
  const base = noteStableBase(note);
  const signature = fnv1a(JSON.stringify({
    equivalent,
    font: "nasinNanpa",
    fontPx: Math.max(8, Math.round(settings.fontPx * settings.nnpFontScale)),
    nnpFontScale: settings.nnpFontScale,
    scale: settings.renderScale,
    foreground: settings.foreground,
    mediaType: "nasinNanpaPonaSitelenPona",
  })).slice(0, 6);
  return `${MEDIA_PREFIX}${base}_${signature}_nnp.png`;
}

async function generateNasinNanpaPonaMedia(note) {
  if (!state.project.settings.includeNasinNanpaPonaEquivalent || !note?.source) {
    return { equivalent: "", filename: "", blob: null };
  }
  const equivalent = await nasinNanpaPonaEquivalent(note.source);
  if (!equivalent) return { equivalent: "", filename: "", blob: null };
  const filename = nasinNanpaPonaFilenameForNote(note, equivalent);
  if (!state.mediaCache.has(filename)) {
    state.mediaCache.set(filename, await renderNasinNanpaPonaBlob(equivalent));
  }
  return { equivalent, filename, blob: state.mediaCache.get(filename) };
}

function mediaFilenamesForNote(note) {
  if (!note.source || !note.validation?.ok) return {};
  const settings = state.project.settings;
  const base = noteStableBase(note);
  const imageSignature = fnv1a(JSON.stringify({
    font: "nasinNanpa",
    fontPx: settings.fontPx,
    scale: settings.renderScale,
    foreground: settings.foreground,
    relaxed: true,
  })).slice(0, 6);
  const audioSignature = fnv1a(JSON.stringify({ speed: settings.audioSpeed, voice: "reference_audio", relaxed: true })).slice(0, 6);
  return {
    abbreviated: settings.generateAbbreviated
      ? `${MEDIA_PREFIX}${base}_${imageSignature}_abbr${settings.showSpacers ? "_spacer" : ""}.png`
      : "",
    full: settings.generateFull
      ? `${MEDIA_PREFIX}${base}_${imageSignature}_full.png`
      : "",
    audio: settings.generateAudio
      ? `${MEDIA_PREFIX}${base}_${audioSignature}_audio_normal.wav`
      : "",
  };
}

async function generateNoteMedia(note, { previewOnly = false } = {}) {
  if (!note.validation?.ok || !note.source) return {};
  const filenames = mediaFilenamesForNote(note);
  const result = { filenames, errors: [] };
  const attempt = async (label, filename, generator, blobKey) => {
    if (!filename) return;
    try {
      if (!state.mediaCache.has(filename)) state.mediaCache.set(filename, await generator());
      result[blobKey] = state.mediaCache.get(filename);
    } catch (error) {
      if (!previewOnly) throw error;
      result.errors.push(`${label}: ${error.message}`);
      const key = blobKey === "abbreviatedBlob" ? "abbreviated" : blobKey === "fullBlob" ? "full" : blobKey === "audioBlob" ? "audio" : "";
      if (key) result.filenames[key] = "";
    }
  };
  await attempt("abbreviated cartouche", filenames.abbreviated, () => renderNumericCartoucheBlob(note.source, { abbreviated: true }), "abbreviatedBlob");
  await attempt("full cartouche", filenames.full, () => renderNumericCartoucheBlob(note.source, { abbreviated: false }), "fullBlob");
  await attempt("audio", filenames.audio, () => renderAudioBlob(note.source), "audioBlob");
  if (state.project.settings.includeNasinNanpaPonaEquivalent) {
    try {
      const nnpMedia = await generateNasinNanpaPonaMedia(note);
      result.nasinNanpaPona = nnpMedia.equivalent;
      if (nnpMedia.filename) {
        result.filenames.nasinNanpaPona = nnpMedia.filename;
        result.nasinNanpaPonaBlob = nnpMedia.blob;
      }
    } catch (error) {
      if (!previewOnly) throw error;
      result.errors.push(`nasin nanpa pona: ${error.message}`);
    }
  }
  if (!previewOnly) note.nasinNanpaPonaEquivalent = result.nasinNanpaPona || "";
  return result;
}

function nasinNanpaPonaAnswerHtml(media) {
  const filename = media?.filenames?.nasinNanpaPona || "";
  return filename
    ? `<div class="nnp"><strong>nasin nanpa pona:</strong><div><img src="${escapeHtml(filename)}" alt="nasin nanpa pona sitelen pona equivalent"></div></div>`
    : "";
}

function cardTextOverride(note, type) {
  return normalizeCardTextOverrides(note?.cardTextOverrides)[type] || { frontPrompt: "", backAnswer: "" };
}

function cardFrontPromptHtml(note, type) {
  const definition = CARD_TYPE_DEFINITIONS[type];
  const override = cardTextOverride(note, type).frontPrompt;
  const text = override || definition?.defaultFront || "";
  return text ? `<div class="prompt">${text}</div>` : "";
}

function cardMainAnswerHtml(note, type, defaultHtml) {
  const override = cardTextOverride(note, type).backAnswer;
  return override ? `<div class="customAnswer">${override}</div>` : defaultHtml;
}

function cardBack(note, media, { includeProper = true, type = "abbreviated-to-number" } = {}) {
  const parsed = note.validation?.parsed;
  const proper = note.properNameRelaxed || parsed?.properName || "";
  const image = media.filenames?.abbreviated || media.filenames?.full || "";
  const pieces = [
    cardMainAnswerHtml(note, type, `<div class="answerNumber">${escapeHtml(note.source)}</div>`),
    includeProper && proper ? `<div class="properName">${escapeHtml(proper)}</div>` : "",
    image ? `<div class="cartouche"><img src="${escapeHtml(image)}"></div>` : "",
    nasinNanpaPonaAnswerHtml(media),
    note.extra ? `<div class="extra">${escapeHtml(note.extra)}</div>` : "",
    note.context ? `<div class="context">${escapeHtml(note.context)}</div>` : "",
  ];
  return pieces.filter(Boolean).join("");
}

function buildTsvFile(rows) {
  const lines = [
    "#separator:tab",
    "#html:true",
    "#columns:Front\tBack\tTags",
    ...rows.map(row => [row.front, row.back, row.tags].map(cleanTsvField).join("\t")),
  ];
  return lines.join("\n") + "\n";
}

function buildCardDefinitionsForNote(note, media) {
  const types = state.project.settings.cardTypes;
  const names = media?.filenames || {};
  const proper = note.properNameRelaxed || note.validation?.parsed?.properName || "";
  const cards = [];
  const add = (type, label, front, back) => cards.push({ type, label, front, back });
  if (types.abbreviatedToNumber && names.abbreviated) {
    const type = "abbreviated-to-number";
    add(type, CARD_TYPE_DEFINITIONS[type].label,
      `${cardFrontPromptHtml(note, type)}<img src="${escapeHtml(names.abbreviated)}">`,
      cardBack(note, media, { type }));
  }
  if (types.numberToProperName && proper) {
    const type = "number-to-proper-name";
    add(type, CARD_TYPE_DEFINITIONS[type].label,
      `${cardFrontPromptHtml(note, type)}<div class="sourceNumber">${escapeHtml(note.source)}</div>`,
      `${cardMainAnswerHtml(note, type, `<div class="properName answer">${escapeHtml(proper)}</div>`)}${names.abbreviated ? `<img src="${escapeHtml(names.abbreviated)}">` : ""}${nasinNanpaPonaAnswerHtml(media)}${note.extra ? `<div class="extra">${escapeHtml(note.extra)}</div>` : ""}`);
  }
  if (types.audioToNumber && names.audio) {
    const type = "audio-to-number";
    add(type, CARD_TYPE_DEFINITIONS[type].label,
      `${cardFrontPromptHtml(note, type)}[sound:${escapeHtml(names.audio)}]`,
      cardBack(note, media, { type }));
  }
  if (types.properNameToNumber && proper) {
    const type = "proper-name-to-number";
    add(type, CARD_TYPE_DEFINITIONS[type].label,
      `${cardFrontPromptHtml(note, type)}<div class="properName">${escapeHtml(proper)}</div>`,
      cardBack(note, media, { includeProper: false, type }));
  }
  if (types.fullToNumber && names.full) {
    const type = "full-cartouche-to-number";
    add(type, CARD_TYPE_DEFINITIONS[type].label,
      `${cardFrontPromptHtml(note, type)}<img src="${escapeHtml(names.full)}">`,
      cardBack(note, media, { type }));
  }
  if (!note.source && note.prompt && note.answer) {
    add("general", "General text card", note.prompt, `${note.answer}${note.extra ? `<div class="extra">${escapeHtml(note.extra)}</div>` : ""}`);
  }
  return cards;
}

function buildCardFiles(notes, mediaByNoteId) {
  const files = [];
  const deckTags = state.project.deck.tags;
  const rowsByType = new Map();
  for (const note of notes) {
    const media = mediaByNoteId.get(note.id) || { filenames: mediaFilenamesForNote(note) };
    for (const card of buildCardDefinitionsForNote(note, media)) {
      if (!rowsByType.has(card.type)) rowsByType.set(card.type, []);
      rowsByType.get(card.type).push({
        front: card.front,
        back: card.back,
        tags: tagString(deckTags, note.tags, note.category, `card_${card.type}`),
      });
    }
  }
  for (const [type, rows] of rowsByType.entries()) {
    if (rows.length) files.push({ name: `cards/${type}.tsv`, data: encodeUtf8(buildTsvFile(rows)), count: rows.length });
  }
  return files;
}

function importReadme(cardFiles) {
  const list = cardFiles.map(file => `- ${file.name} (${file.count} rows)`).join("\n");
  return `nanpa-linja-n Anki export\n============================\n\nDeck: ${state.project.deck.name}\nGenerated: ${nowIso()}\n\nThis export uses Anki's flat collection media namespace. The media files are\norganised in the ZIP's media/ folder for convenience, but card fields refer to\nfilenames only, such as tp_nln_...png and tp_nln_...wav.\n\nImport procedure\n----------------\n1. Extract this ZIP.\n2. Copy every file inside media/ into Anki's collection.media directory.\n3. Import each desired TSV file into Anki using a Basic note type.\n4. Use tab as the separator and allow HTML in fields.\n5. Map the three columns to Front, Back and Tags.\n\nTSV files\n---------\n${list || "No card TSV files were generated."}\n\nMedia naming\n------------\nAll generated media use the fixed tp_nln_ prefix for namespace isolation.\nDo not add media/ to references in Anki fields; Anki media names are flat.\n\nRendering rules\n---------------\n- nanpa-linja-n mode: relaxed\n- automatic nasin nanpa pona conversion remains disabled for nanpa-linja-n cartouche and audio media\n- eligible optional nasin nanpa pona equivalents are exported as separate sitelen pona PNG media\n- nasin nanpa pona glyph size: ${Math.round(state.project.settings.nnpFontScale * 100)}% of the nanpa-linja-n cartouche font size\n- abbreviated cartouche spacers: ${state.project.settings.showSpacers ? "shown" : "hidden"}\n\nVerify the generated deck before relying on it.\n`;
}

const CARD_CSS = `.card {
  font-family: Arial, sans-serif;
  font-size: 22px;
  text-align: center;
  color: #1f1a14;
  background: #fffaf2;
}
img { max-width: 94%; max-height: 45vh; object-fit: contain; }
.prompt { color: #6d6256; font-size: .72em; margin-bottom: 1em; }
.sourceNumber, .answerNumber { font-size: 1.8em; font-weight: 700; }
.properName { font-size: 1.25em; margin: .6em 0; }
.extra, .context, .nnp { font-size: .72em; color: #6d6256; margin-top: .8em; }
.customAnswer { font-size: 1.35em; font-weight: 650; margin: .35em 0; }
`;

function audioAttribution() {
  return `Audio attribution\n=================\n\n${REFERENCE_AUDIO_MANIFEST.license_note || "No licence note was supplied."}\n\nThe generated WAV files are assembled from the project's reference audio assets.\nManifest version: ${REFERENCE_AUDIO_MANIFEST.version || "unknown"}\nManifest sample rate: ${REFERENCE_AUDIO_MANIFEST.sample_rate || "unknown"}\n`;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      if (state.cancelRequested) throw new Error("Export cancelled.");
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function setProgress(done, total, message) {
  el.progressWrap.classList.add("active");
  el.progress.max = Math.max(1, total);
  el.progress.value = done;
  el.progressText.textContent = message;
}

async function generateExportZip() {
  if (state.exportRunning) return;
  readSettingsFromUi();
  validateAllNotes({ render: false });
  const notes = state.project.notes.filter(note => note.enabled && note.validation?.ok);
  if (!notes.length) throw new Error("There are no enabled valid notes to export.");
  const selectedCardType = Object.values(state.project.settings.cardTypes).some(Boolean);
  if (!selectedCardType) throw new Error("Select at least one card type.");

  state.exportRunning = true;
  state.cancelRequested = false;
  el.btnGenerate.disabled = true;
  el.btnCancel.disabled = false;
  setProgress(0, notes.length + 1, "Preparing media…");

  try {
    const mediaByNoteId = new Map();
    let completed = 0;
    await mapWithConcurrency(notes, 2, async note => {
      const media = note.source ? await generateNoteMedia(note) : { filenames: {} };
      mediaByNoteId.set(note.id, media);
      completed += 1;
      setProgress(completed, notes.length + 1, `Generated media for ${completed} of ${notes.length} notes.`);
      return media;
    });

    if (state.cancelRequested) throw new Error("Export cancelled.");
    setProgress(notes.length, notes.length + 1, "Building TSV files and ZIP…");
    const cardFiles = buildCardFiles(notes, mediaByNoteId);
    if (!cardFiles.length) throw new Error("The selected card types did not produce any rows.");

    const zipEntries = [...cardFiles];
    const includedMedia = new Set();
    for (const media of mediaByNoteId.values()) {
      for (const filename of Object.values(media.filenames || {}).filter(Boolean)) {
        if (includedMedia.has(filename)) continue;
        const blob = state.mediaCache.get(filename);
        if (!blob) throw new Error(`Generated media is missing: ${filename}`);
        includedMedia.add(filename);
        zipEntries.push({ name: `media/${filename}`, data: blob });
      }
    }

    const mediaManifest = {
      schemaVersion: 1,
      prefix: MEDIA_PREFIX,
      generatedAt: nowIso(),
      flatAnkiMediaNames: true,
      files: Array.from(includedMedia).sort(),
    };
    zipEntries.push(
      { name: "project.json", data: encodeUtf8(JSON.stringify({ project: state.project }, null, 2)) },
      { name: "media-manifest.json", data: encodeUtf8(JSON.stringify(mediaManifest, null, 2)) },
      { name: "README-import.txt", data: encodeUtf8(importReadme(cardFiles)) },
      { name: "ATTRIBUTION.txt", data: encodeUtf8(audioAttribution()) },
      { name: "card-templates/front.html", data: encodeUtf8("{{Front}}") },
      { name: "card-templates/back.html", data: encodeUtf8("{{FrontSide}}<hr id=answer>{{Back}}") },
      { name: "card-templates/styling.css", data: encodeUtf8(CARD_CSS) },
    );

    const zip = await createZipBlob(zipEntries);
    const safeDeck = (state.project.deck.name || "nanpa-linja-n").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "nanpa-linja-n";
    downloadBlob(zip, `${safeDeck}-anki-${timestampFile()}.zip`);
    setProgress(notes.length + 1, notes.length + 1, `Exported ${cardFiles.reduce((n, file) => n + file.count, 0)} cards and ${includedMedia.size} media files.`);
    setStatus("Anki ZIP exported.");
    saveProject();
  } finally {
    state.exportRunning = false;
    el.btnGenerate.disabled = false;
    el.btnCancel.disabled = true;
    renderAll();
  }
}

function exportProjectJson() {
  readSettingsFromUi();
  const blob = new Blob([JSON.stringify({ project: state.project }, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `nanpa-linja-n-anki-project-${timestampFile()}.json`);
  setStatus("Project JSON exported.");
}

async function importProjectFile(file) {
  const parsed = JSON.parse(await file.text());
  const project = parsed?.project || parsed;
  state.project = normalizeProject(project);
  state.mediaCache.clear();
  state.rendererBySignature.clear();
  state.selectedNoteId = state.project.notes[0]?.id || null;
  validateAllNotes();
  resetPreview();
  if (state.selectedNoteId) void selectNote(state.selectedNoteId);
  setStatus("Project JSON imported.");
}

function wireUi() {
  el.btnNew.addEventListener("click", () => {
    if (!confirm("Create a new project and replace the current in-browser project?")) return;
    state.project = createDefaultProject();
    state.mediaCache.clear();
    state.rendererBySignature.clear();
    state.selectedNoteId = null;
    saveProject();
    validateAllNotes();
    resetPreview();
    setStatus("New project created.");
  });
  el.btnImportCsv.addEventListener("click", () => el.fileCsv.click());
  el.fileCsv.addEventListener("change", async () => {
    const file = el.fileCsv.files?.[0];
    el.fileCsv.value = "";
    if (!file) return;
    try { importCsvText(await file.text()); }
    catch (error) { setStatus(`CSV import failed: ${error.message}`); }
  });
  el.btnSample.addEventListener("click", () => {
    importCsvText(SAMPLE_CSV, { replace: state.project.notes.length === 0 });
  });
  el.btnImportProject.addEventListener("click", () => el.fileProject.click());
  el.fileProject.addEventListener("change", async () => {
    const file = el.fileProject.files?.[0];
    el.fileProject.value = "";
    if (!file) return;
    try { await importProjectFile(file); }
    catch (error) { setStatus(`Project import failed: ${error.message}`); }
  });
  el.btnExportProject.addEventListener("click", exportProjectJson);
  el.btnAdd.addEventListener("click", () => openEditor());
  el.btnValidate.addEventListener("click", () => {
    const allValid = validateAllNotes();
    setStatus(allValid ? "All enabled notes are valid." : "Validation found errors.");
  });
  el.btnGenerate.addEventListener("click", () => generateExportZip().catch(error => {
    console.error(error);
    setStatus(error.message);
    el.progressText.textContent = error.message;
  }));
  el.btnCancel.addEventListener("click", () => {
    state.cancelRequested = true;
    el.btnCancel.disabled = true;
    setStatus("Cancelling after the current media item finishes.");
  });
  el.selectAll.addEventListener("change", () => {
    for (const note of state.project.notes) note.enabled = el.selectAll.checked;
    validateAllNotes();
  });
  el.btnEditorClose.addEventListener("click", closeEditor);
  el.btnEditorCancel.addEventListener("click", closeEditor);
  el.btnEditorSave.addEventListener("click", saveEditor);
  $("editCardType").addEventListener("change", () => {
    saveCurrentEditorCardText();
    loadEditorCardText($("editCardType").value);
  });
  el.editorOverlay.addEventListener("click", event => { if (event.target === el.editorOverlay) closeEditor(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && el.editorOverlay.classList.contains("open")) closeEditor(); });

  const settingIds = [
    "deckName", "deckDescription", "deckAuthor", "deckTags", "showSpacers", "includeNnp",
    "fontPx", "nnpFontPercent", "renderScale", "foreground", "cardAbbrNumber", "cardNumberProper",
    "cardAudioNumber", "cardProperNumber", "cardFullNumber",
  ];
  for (const id of settingIds) {
    $(id).addEventListener("change", () => {
      readSettingsFromUi();
      state.mediaCache.clear();
      renderAll();
      if (state.selectedNoteId) void selectNote(state.selectedNoteId);
    });
  }
}

async function init() {
  wireUi();
  state.project = loadStoredProject();
  writeSettingsToUi();
  setStatus("Loading font controller.");

  state.fontController = createSitelenFontPairController({
    registry: FONT_PRESETS,
    storageKeyPrefix: "tpNlnAnkiBuilderFont",
    defaultPresetKey: "nasinNanpa",
    defaultTextFontOption: DEFAULT_LITERAL_FAMILY,
    onInvalidate: () => state.rendererBySignature.clear(),
  });
  await state.fontController.ready;
  await state.fontController.ensureFamiliesLoaded(state.project.settings.fontPx);
  state.fontController.warmUpCanvasFontsOnce(state.project.settings.fontPx);

  try {
    const cartoucheDb = await CartoucheApi.open({ lookup: true, nanpaParser: NanpaParser });
    state.pageMap = await cartoucheDb.resolvePageMap();
  } catch (error) {
    console.warn("Cartouche database unavailable; number-only cards still work.", error);
    state.pageMap = new Map();
  }

  validateAllNotes({ render: false });
  renderAll();
  if (state.project.notes.length) {
    state.selectedNoteId = state.project.notes[0].id;
    void selectNote(state.selectedNoteId, { generate: false });
  }
  el.loadingVeil.style.display = "none";
  setStatus("Ready. Shared renderer and audio libraries were loaded without modification.");
}

init().catch(error => {
  console.error(error);
  el.loadingVeil.innerHTML = `<strong>Initialisation failed</strong><span>${escapeHtml(error.message)}</span>`;
  setStatus(`Initialisation failed: ${error.message}`);
});
