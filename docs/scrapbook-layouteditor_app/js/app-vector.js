import {
  createSitelenFontPairController,
  TEXT_FONT_OPTION_SITELEN,
  TEXT_FONT_OPTION_NANPA_LINJA_N
} from "../../js/sitelen-font-pair-controller-merged-updated-font-label.js?v=14";
import {
  CartoucheApi,
  buildEntryRendererInput,
  buildRandomDescForLetters,
  segmentLetters,
  segmentWords
} from '../../js/cartouche-api-v3-previewdesc.js?v=21';
import SitelenVectorExporter from '../../js/sitelen-vector-exporter.js?v=143';

(() => {
  "use strict";

  // The global cartouche DB and scrapbook-local proper names are deliberately
  // kept as separate maps, then merged into pageMap for every sitelen render.
  // pageMap is therefore the active render-time lookup map. Scrapbook-local
  // entries override global entries with the same key/alias.
  let globalCartouchePageMap = new Map();
  let pageMap = new Map();
  const SCRAPBOOK_CARTOUCHE_DB_DEBUG = !!globalThis.SCRAPBOOK_CARTOUCHE_DB_DEBUG;
  const APP_VECTOR_DEBUG = !!globalThis.SCRAPBOOK_LAYOUT_EDITOR_DEBUG;
  function scrapbookCartoucheDebugWarn(...args){
    if (SCRAPBOOK_CARTOUCHE_DB_DEBUG) console.warn(...args);
  }
  let cartouchePageMapRevision = 0;

  const SCRAPBOOK_CARTOUCHE_DB_DEFAULT = Object.freeze({
    type: 'scrapbook-cartouche-db',
    version: 1,
    entries: []
  });

  const SCRAPBOOK_CARTOUCHE_TP_KNOWN_WORDS = new Set([
    'a','akesi','ala','alasa','ale','ali','anpa','ante','anu','awen',
    'e','en','epiku','esun','ijo','ike','ilo','insa',
    'jaki','jan','jasima','jelo','jo',
    'kala','kalama','kama','kasi','ken','kepeken','kijetesantakalu','kili','kin','kipisi',
    'kiwen','ko','kokosila','kon','ku','kule','kulupu','kute',
    'la','lanpan','lape','laso','lawa','leko','len','lete','li','lili',
    'linja','linluwi','lipu','loje','lon','luka','lukin','lupa',
    'ma','majuna','mama','mani','meli','meso','mi','mije','misikeke',
    'moku','moli','monsi','monsuta','mu','mun','musi','mute',
    'n','namako','nanpa','nasa','nasin','nena','ni','nimi','noka',
    'o','oko','olin','ona','open',
    'pakala','pake','pali','palisa','pan','pana','pi','pilin','pimeja',
    'pini','pipi','poka','poki','pona','powe','pu',
    'sama','seli','selo','seme','sewi','sijelo','sike','sin','sina',
    'sinpin','sitelen','soko','sona','soweli','su','suli','suno','supa','suwi',
    'tan','taso','tawa','telo','tenpo','toki','tomo','tonsi','tu',
    'unpa','uta','utala','walo','wan','waso','wawa','weka','wile',
  ]);

  function cloneCartoucheJson(value){
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return null; }
  }

  function normalizeScrapbookCartoucheDb(rawDb){
    const db = (rawDb && typeof rawDb === 'object' && !Array.isArray(rawDb))
      ? cloneCartoucheJson(rawDb) || {}
      : {};
    db.type = SCRAPBOOK_CARTOUCHE_DB_DEFAULT.type;
    db.version = Math.max(1, Math.round(Number(db.version) || SCRAPBOOK_CARTOUCHE_DB_DEFAULT.version));
    db.entries = Array.isArray(db.entries)
      ? db.entries
          .filter(e => e && typeof e === 'object' && typeof e.key === 'string' && Array.isArray(e.words) && e.words.length)
          .map(e => ({
            ...e,
            key: String(e.key),
            words: e.words.map(w => String(w)),
            merge: e.merge !== false,
            mode: ['random','preferred','literal','ignore'].includes(String(e.mode || '')) ? String(e.mode) : 'random',
            cartoucheMap: (e.cartoucheMap && typeof e.cartoucheMap === 'object' && !Array.isArray(e.cartoucheMap)) ? e.cartoucheMap : {},
            tallyMap: (e.tallyMap && typeof e.tallyMap === 'object' && !Array.isArray(e.tallyMap)) ? e.tallyMap : {},
            forceNormal: true,
            literalText: String(e.literalText || e.key || '')
          }))
      : [];
    return db;
  }

  function scrapbookCartoucheMergedLettersToWord(words){
    return segmentLetters(words).letters.join('');
  }

  function scrapbookCartoucheWordsLookLikeNanpaRun(words){
    if (!Array.isArray(words) || !words.length) return false;
    try {
      const parser = globalThis.NanpaParser || null;
      return !!(parser && typeof parser.isValidCaps === 'function' && parser.isValidCaps(words.map(w => String(w).toUpperCase()).join('')));
    } catch {
      return false;
    }
  }

  function scrapbookCartoucheEntryRequiresAtDb(entry){
    if (!entry || !Array.isArray(entry.words) || !entry.words.length) return false;
    const segs = segmentWords(entry.words);

    // Match standalone cartouche-db.html: any nanpa-linja-n segment requires
    // explicit @db to use the saved proper-name override.  The extra direct
    // parser check covers startup order where scrapbook-cartouche-db-bootstrap
    // may run before app-vector has opened CartoucheApi with NanpaParser.
    if (segs.some(seg => seg && seg.type === 'nanpa') || scrapbookCartoucheWordsLookLikeNanpaRun(entry.words)) return true;

    for (const seg of segs) {
      if (seg.type !== 'normal') continue;
      if (entry.merge) {
        const merged = scrapbookCartoucheMergedLettersToWord(seg.words);
        if (SCRAPBOOK_CARTOUCHE_TP_KNOWN_WORDS.has(merged)) return true;
      } else {
        for (const w of seg.words) {
          if (SCRAPBOOK_CARTOUCHE_TP_KNOWN_WORDS.has(String(w).toLowerCase())) return true;
        }
      }
    }
    return false;
  }

  function scrapbookCartoucheEntryLookupAliases(entry){
    const aliases = new Set();
    if (!entry || !Array.isArray(entry.words) || !entry.words.length) return aliases;
    aliases.add(entry.key);
    if (entry.merge) {
      const segs = segmentWords(entry.words);
      for (const seg of segs) {
        if (seg.type !== 'normal') continue;
        const merged = segmentLetters(seg.words).letters.join('');
        if (merged) aliases.add(merged.charAt(0).toUpperCase() + merged.slice(1));
      }
    }
    return aliases;
  }

  function scrapbookCartoucheEntryHasAnyDescription(entry){
    const cm = entry && entry.cartoucheMap && typeof entry.cartoucheMap === 'object'
      ? entry.cartoucheMap
      : {};
    return Object.values(cm).some(value => String(value || '').trim());
  }

  function shouldGenerateScrapbookCartoucheDescriptions(entry){
    if (!entry) return false;
    if (entry.mode === 'random') return true;
    if (entry.mode === 'preferred' && !scrapbookCartoucheEntryHasAnyDescription(entry)) return true;
    return false;
  }

function scrapbookCartoucheEntryHasNanpaSegment(entry){
    if (!entry || !Array.isArray(entry.words) || !entry.words.length) return false;
    try {
      return segmentWords(entry.words).some(seg => seg && seg.type === 'nanpa');
    } catch {
      return false;
    }
  }

  function shouldForceNormalForScrapbookCartoucheRender(entry){
    if (!entry || entry.mode === 'literal' || entry.mode === 'ignore') return false;
    // Match the standalone cartouche DB page: nanpa-linja-n proper names render
    // as numeric cartouches by default.  Only an explicit @db/forceNormal override
    // should make a numeric-looking proper name use the saved glyph description.
    return !!entry.forceNormal;
  }

  function scrapbookCartoucheEntryForRender(entry){
    return shouldForceNormalForScrapbookCartoucheRender(entry)
      ? { ...entry, forceNormal: true }
      : entry;
  }

    function buildEffectiveScrapbookCartoucheEntryForRender(entry){
    if (!shouldGenerateScrapbookCartoucheDescriptions(entry)) return entry;

    const segs = segmentWords(entry.words);
    const cm = {};

    segs.forEach((seg, si) => {
      if (seg.type === 'nanpa' && !entry.forceNormal) return;

      if (seg.type === 'nanpa' && entry.forceNormal) {
        const letters = seg.words.join('').toLowerCase().split('');
        cm[si] = buildRandomDescForLetters(letters, { excludeNanpaAtEnds: true });
        return;
      }

      if (entry.merge) {
        const { letters } = segmentLetters(seg.words);
        cm[si] = buildRandomDescForLetters(letters);
      } else {
        seg.words.forEach((w, wi) => {
          cm[`${si}_${wi}`] = buildRandomDescForLetters(String(w).toLowerCase().split(''));
        });
      }
    });

    return { ...entry, cartoucheMap: cm };
  }

  function buildScrapbookCartouchePageMapFromEntries(entries){
    const map = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || !entry.key || !Array.isArray(entry.words) || !entry.words.length) continue;

      if (entry.mode === 'ignore') {
        for (const alias of scrapbookCartoucheEntryLookupAliases(entry)) map.set(alias, null);
        continue;
      }

      let rendererInput;
      if (entry.mode === 'literal') {
        const literal = String(entry.literalText || entry.key || '')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\"')
          .trim();
        rendererInput = `["${literal}"]`;
      } else {
        rendererInput = buildEntryRendererInput(buildEffectiveScrapbookCartoucheEntryForRender(scrapbookCartoucheEntryForRender(entry)));
      }

      let inputForceNormal = rendererInput;
      if (entry.forceNormal && entry.mode !== 'literal') {
        const entryNormal = { ...entry, forceNormal: false };
        inputForceNormal = rendererInput;
        rendererInput = buildEntryRendererInput(buildEffectiveScrapbookCartoucheEntryForRender(entryNormal));
      }

      const mapValue = {
        input: rendererInput,
        inputForceNormal,
        forceNormal: !!entry.forceNormal,
        requiresAtDb: scrapbookCartoucheEntryRequiresAtDb(entry),
      };

      for (const alias of scrapbookCartoucheEntryLookupAliases(entry)) map.set(alias, mapValue);
    }
    return map;
  }

  function getCurrentScrapbookCartoucheDb(){
    const doc = (typeof ScrapbookState !== 'undefined') ? ScrapbookState?.doc : null;
    if (!doc || typeof doc !== 'object') return normalizeScrapbookCartoucheDb(null);
    doc.cartoucheDb = normalizeScrapbookCartoucheDb(doc.cartoucheDb);
    return doc.cartoucheDb;
  }

  function rebuildActiveCartouchePageMap(){
    const merged = new Map(globalCartouchePageMap instanceof Map ? globalCartouchePageMap : new Map());
    try {
      const localMap = buildScrapbookCartouchePageMapFromEntries(getCurrentScrapbookCartoucheDb().entries);
      for (const [key, value] of localMap.entries()) merged.set(key, value);
      window.scrapbookLocalCartouchePageMap = localMap;
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] failed to build local page map', err);
    }
    pageMap = merged;
    cartouchePageMapRevision += 1;
    window.globalCartouchePageMap = globalCartouchePageMap;
    window.cartouchePageMap = pageMap;
    window.scrapbookCartouchePageMap = pageMap;
    return pageMap;
  }

  function prepareSitelenInputWithActiveCartoucheDb(rawText){
    return CartoucheApi.prepareInput(String(rawText ?? ''), pageMap);
  }

  function refreshAllSitelenAfterCartoucheDbChange(){
    try { rebuildActiveCartouchePageMap(); } catch {}
    try { sitelenCache?.clear?.(); } catch {}
    try { sitelenRasterJobs?.clear?.(); } catch {}
    try { clearSvgVectorElementCache?.(); } catch {}
    try {
      for (const el of (Scene?.elements || [])) {
        if (el?.type === ElementType.Sitelen || el?.type === 'sitelen') {
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, sitelenLayoutOptsForElement(el), true);
        }
      }
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] failed to queue sitelen refresh', err);
    }
    try { render(); } catch {}
  }

  function bindScrapbookCartoucheDbDocumentToApp(){
    const doc = (typeof ScrapbookState !== 'undefined') ? ScrapbookState?.doc : null;
    if (!doc || typeof doc !== 'object') return;
    doc.cartoucheDb = normalizeScrapbookCartoucheDb(doc.cartoucheDb);
    rebuildActiveCartouchePageMap();
    window.currentScrapbookDocument = doc;
    window.getCurrentScrapbookDocument = () => ScrapbookState?.doc || null;
    window.prepareScrapbookCartoucheInput = prepareSitelenInputWithActiveCartoucheDb;
    window.invalidateSitelenElementCaches = refreshAllSitelenAfterCartoucheDbChange;
    window.scheduleRenderAll = refreshAllSitelenAfterCartoucheDbChange;
    if (typeof window.registerScrapbookCartoucheDbDocument === 'function') {
      window.registerScrapbookCartoucheDbDocument(doc, {
        setDocumentDirty: () => {
          if (ScrapbookState?.doc) ScrapbookState.doc.cartoucheDb = normalizeScrapbookCartoucheDb(ScrapbookState.doc.cartoucheDb);
          refreshAllSitelenAfterCartoucheDbChange();
          try { debounceScrapbookSave(); } catch {}
        },
        requestRenderAll: refreshAllSitelenAfterCartoucheDbChange,
        getGlobalPageMap: () => globalCartouchePageMap,
      });
    }
  }


  /* ============================================================
     CHANGE HERE: Sitelen rendering hook
     ------------------------------------------------------------
     For Sitelen elements you said: “use a different rendering function than plain text”.
     This editor includes a hook that you can replace with your own implementation.

     - Return a string to render for a single line (e.g., convert Latin TP to UCSUR glyphs).
     - Default: identity (renders the same text).
     ============================================================ */
  function renderSitelenLineToCanvasText(line) {
    // Replace this with your own:
    //   return renderSitelenSourceToUcsur(line);
    return String(line ?? "");
  }

  /* ============================================================
     Constants and utilities
     ============================================================ */
  const $ = (id) => document.getElementById(id);

  /* ============================================================
     I18N (English / Toki Pona)
     ------------------------------------------------------------
     UI strings only. No functional logic changes.
     ============================================================ */
  const LS_KEY_LANG = "layout_editor_lang"; // "en" | "tp"
  const LS_KEY_TEXT_EDITOR_OPEN = "layout_editor_text_open"; // "1" | "0"
  const LS_KEY_TEXT_EDITOR_GEOMETRY = "layout_editor_text_geometry_v1"; // persisted floating editor rect
  const LS_KEY_MEDIA_EDITOR_OPEN = "layout_editor_media_open"; // "1" | "0"
  const LS_KEY_MEDIA_EDITOR_GEOMETRY = "layout_editor_media_geometry_v1"; // persisted floating editor rect
  const LS_KEY_TOOLBAR_LAYOUT = "scrapbook_toolbar_layout_v1"; // original | compact
  const LS_KEY_DOCUMENT_PROPS_GEOMETRY = "scrapbook_document_properties_geometry_v1";
  const LS_KEY_CURRENT_PAGE_PROPS_GEOMETRY = "scrapbook_current_page_properties_geometry_v1";

  function loadLang(){
    try{
      const v = localStorage.getItem(LS_KEY_LANG);
      if (v === "en" || v === "tp") return v;
    } catch {}
    return "en";
  }
  function saveLang(lang){
    try{ localStorage.setItem(LS_KEY_LANG, String(lang)); } catch {}
  }

  let DEV_LANG = loadLang();

  const STRINGS = {
    en: {
      title: "Static Canvas Layout Editor (no dependencies)",
      lbl_lang: "Language",
      lang_en: "English",
      lang_tp: "toki pona",

      // Topbar
      btn_new: "New / Clear",
      btn_export_json: "Export page JSON",
      btn_import_json: "Import page JSON",
      btn_export_png: "Export page PNG",
      btn_group: "Group",
      btn_ungroup: "Ungroup",

      tool_select: "Select",
      tool_text: "Text",
      tool_sitelen: "Sitelen",
      tool_glyph: "Glyph",
      tool_rect: "Rectangle",
      tool_image: "Image",
      tool_audio: "Audio",
      tool_video: "Video",
      tool_url: "URL",
      tool_delete: "Delete",
      tool_pan: "Pan",

      btn_undo: "Undo",
      btn_redo: "Redo",
      btn_copy: "Copy",
      btn_cut: "Cut",
      btn_paste: "Paste",
      btn_media_editor: "Media Editor",
      sb_btn_goto_page: "Go to page",
      sb_btn_go: "Go",
      sb_ph_page_number: "Page #",

      tip_undo: "Undo (Ctrl/Cmd+Z)",
      tip_redo: "Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)",
      tip_copy: "Copy (Ctrl/Cmd+C)",
      tip_cut: "Cut (Ctrl/Cmd+X)",
      tip_paste: "Paste (Ctrl/Cmd+V)",

      // Sidebar headings
      hdr_stage: "Stage",
      hdr_properties: "Properties",

      // Stage buttons
      btn_snap_grid: "Snap: Grid",
      btn_snap_objs: "Snap: Objects",
      btn_grid: "Grid",

      // Stage fields
      lbl_width: "Width",
      lbl_height: "Height",
      lbl_grid_size: "Grid size",
      lbl_snap_tol: "Snap tolerance",
      lbl_export_stage_bg: "Export stage background",
      lbl_stage_bg: "Stage background",
      lbl_default_render_font: "Default script family",
      lbl_default_text_font: "Default text font",
      lbl_default_abbrev_numeric_cartouches: "Default abbreviate numeric cartouche output",
      lbl_default_preserve_center_auto_resize: "Default preserve center on auto resize",
      lbl_default_spacing: "Default sitelen spacing",
      lbl_default_text: "Default text",
      lbl_default_fill_enabled: "Default allow fill",
      lbl_default_fill: "Default fill",
      lbl_default_stroke: "Default stroke",
      lbl_default_stroke_w: "Default stroke width",

      // Properties panel
      btn_bring_forward: "Bring Forward",
      btn_send_backward: "Send Backward",
      props_hint: "Select an element to edit its properties.",

      // Properties panel / element inspector
      sec_appearance: "Appearance",
      sec_geometry: "Geometry",
      sec_glyph: "Glyph",
      sec_group: "Group",
      sec_image: "Image",
      sec_shape: "Shape",
      sec_sitelen: "Sitelen",
      sec_halo: "Halo",

      props_halo_enabled: "Halo enabled",
      props_halo_color: "Halo color",
      props_halo_thickness: "Halo thickness (px) — 0 = auto",
      sec_text: "Text",

      etype_text: "Text",
      etype_sitelen: "Sitelen",
      etype_glyph: "Glyph",
      etype_rect: "Rectangle",
      etype_image: "Image",

      props_header_single: (typeLabel, id) => `Selected: ${typeLabel} (${id})`,
      props_header_group: (n, gid) => `Selected: group (${n} items)  [${gid}]`,
      props_header_multi: (n) => `Selected: ${n} items`,

      props_allow_fill: "Allow fill",
      props_fill: "Fill",
      props_stroke: "Stroke",
      props_foreground_group: "Foreground (group)",
      props_stroke_width: "Stroke width",
      props_opacity: "Opacity (0..1)",
      props_mixed: "Mixed",
      props_edit_mixed_text: "Edit mixed text",
      props_keep_aspect: "Keep aspect ratio",
      props_preserve_center_auto_resize: "Preserve center on auto resize",
      props_abbrev_numeric_cartouches: "Abbreviate numeric cartouche output",
      props_scale_font_box: "Scale font with box",
      props_render_font_family: "Sitelen font family",
      props_font_family: "Quoted text font",
      props_font_size: "Font size",
      props_align: "Align",
      props_align_left: "Left",
      props_align_center: "Center",
      props_align_right: "Right",
      props_spacing: "Spacing",
      props_text: "Text",
      props_text_color: "Text color",
      props_line_height: "Line height",
      props_glyph_color: "Glyph color",
      props_ignore_unknown_text: "Ignore unknown text",
      props_image_embedded: (mime, w, h) => `Embedded image: ${mime}, ${w}×${h}`,
      props_image_none: "No image loaded. Images are embedded (no external links).",
      props_color_key_transparency: "Color-key transparency (use top-left pixel)",
      props_loaded_intrinsic_size: "Loaded (intrinsic) size",
      props_rendered_intrinsic_size: "Rendered (intrinsic) size",
      props_original_box_size: "Original box size",
      props_corner_radius: "Corner radius",
      props_x: "X",
      props_y: "Y",
      props_w: "W",
      props_h: "H",
      props_rotation_deg: "Rotation (deg)",

      sitelen_placeholder:
        "mi kama sona e toki&pona.\n" +
        ": sewi^ ni ni^ ni> ni< .\n" +
        "pi(telo lete).\n" +
        "{pona}ala(pona).\n" +
        "[ ota  kolon en ]\n" +
        "\"Hello World!\".\n" +
        "nanpa -12,340.57.\n" +
        "nanpa 5%.\n" +
        "nanpa #~IIM.\n" +
        "nanpa Newenin One Len Oken.\n" +
        "tenpo 15:27:49.\n" +
        "tenpo suno 2026-03-17.\n" +
        "Unknown words ignored without double quotes.\n",

      // Footer
      lbl_disclaimer: "Disclaimer:",
      txt_disclaimer: "This tool is provided “as is”, with no claim, guarantee, or warranty that the output is correct, complete, or suitable for any purpose. You are responsible for verifying results.",
      lnk_back: "Back to index",

      // View controls
      btn_fit: "Fit",
      btn_zoom_in: "Zoom +",
      btn_zoom_out: "Zoom -",
      btn_reset_view: "Reset View",

      // Common UI atoms
      toggle_on: "On",
      toggle_off: "Off",
      locked: "Locked",
      msg_locked_selection: "This selection contains locked element(s). Unlock to edit or transform.",
      img_load: "Load image…",
      img_replace: "Replace image…",
      img_clear: "Clear image",
      opt_custom: "Custom",
      tip_current_colour: "Current colour (click to open picker)",

      // Alerts / confirms
      alert_cut_locked: "This selection contains locked element(s). Unlock before cutting.",
      alert_delete_locked: "This element cannot be deleted because it is locked. Unlock it first.",
      confirm_delete: (n) => `Delete ${n} element${n === 1 ? "" : "s"}?`,
      confirm_clear: "This will clear the current canvas. Continue?",

      // Default content for new elements
      default_text_multiline: "Text\n(multiline)",

      // Status messages
      status_tool: (toolLabel) => `Tool: ${toolLabel}`,
      status_grouped: (n) => `Grouped (${n}).`,
      status_copied: (n) => `Copied ${n} element${n === 1 ? "" : "s"}.`,
      status_pasted: (n) => `Pasted ${n} element${n === 1 ? "" : "s"}.`,
      status_selected: (n) => `Selected: ${n}`,
      status_import_failed: (msg) => `Import failed: ${msg}`,
      status_autosaved: "Autosaved",
      status_autosave_failed: "Autosave failed (IndexedDB).",
      status_undo: "Undo.",
      status_redo: "Redo.",
      status_ungrouped: "Ungrouped.",
      status_copy_none: "Copy: nothing selected.",
      status_cut_none: "Cut: nothing selected.",
      status_cut_blocked_locked: "Cut blocked: locked element(s).",
      status_cut_done: "Cut.",
      status_paste_empty: "Paste: clipboard empty.",
      status_delete_blocked_locked: "Delete blocked: locked element(s).",
      status_deleted: "Deleted.",
      status_panning: "Panning…",
      status_click_create: "Click inside the stage to create elements.",
      status_locked_unlock_edit: "Locked element(s): unlock to move/resize/rotate.",
      status_locked_unlock_move: "Locked element(s): unlock to move.",
      status_move: "Move…",
      status_marquee: "Marquee select…",
      status_ready: "Ready.",
      status_cancelled: "Cancelled.",
      status_selection_cleared: "Selection cleared.",
      status_nudged: "Nudged.",
      status_image_embedded: "Image embedded.",
      status_exported_json: "Exported JSON.",
      status_imported_json_db_fail: "Imported JSON, but failed to save to local DB.",
      status_imported_json: "Imported JSON.",
      status_exported_png: "Exported PNG (transparent).",
      status_cleared: "Cleared.",
      status_default_fill_enabled_updated: "Default background color fill enabled updated (affects new elements).",
      status_default_text_updated: "Default text color updated (affects new elements).",
      status_default_fill_updated: "Default background color fill updated (affects new elements).",
      status_default_stroke_updated: "Default stroke color updated (affects new elements).",
      status_default_stroke_w_updated: "Default stroke width updated (affects new elements).",
      status_loading: "Loading…",
      status_loaded: "Loaded.",
      status_no_saved_scene: "No saved scene. Ready.",
      status_idb_unavailable: "IndexedDB unavailable. Running without autosave.",

      // Scrapbook shell — document buttons (topbar)
      sb_btn_new_doc:        "New scrapbook document",
      sb_btn_import_doc:     "Import document JSON",
      sb_btn_export_doc:     "Export document JSON",
      sb_btn_export_zip:     "Export all pages PNG ZIP",
      sb_btn_export_svg_zip: "Export all pages SVG ZIP",
      sb_btn_export_print:   "Export printable HTML",
      sb_btn_present:        "Pages as slides",
      sb_btn_search:         "Search",
      // Scrapbook shell — page buttons (topbar)
      sb_btn_new_page:       "New page",
      sb_btn_dup_page:       "Duplicate page",
      sb_btn_del_page:       "Delete page",
      sb_btn_move_up:        "Move page up",
      sb_btn_move_down:      "Move page down",
      sb_btn_prev_page:      "Previous page",
      sb_btn_next_page:      "Next page",
      // Scrapbook sidebar — section headings
      sb_hdr_document:       "Document",
      sb_hdr_pages:          "Pages",
      sb_hdr_current_page:   "Current page",
      // Scrapbook sidebar — document fields
      sb_lbl_title:          "Title",
      sb_lbl_subtitle:       "Subtitle",
      sb_lbl_doc_type:       "Document type",
      sb_lbl_theme:          "Theme",
      sb_lbl_page_template:  "New page template",
      sb_lbl_page_w:         "Default page width",
      sb_lbl_page_h:         "Default page height",
      sb_lbl_page_count:     "Page count",
      sb_lbl_doc_notes:      "Document notes",
      sb_placeholder_doc_notes: "Document notes",
      sb_btn_doc_properties: "Properties",
      sb_btn_page_properties: "Page properties",
      sb_hdr_page_properties: "Page properties",
      sb_hdr_doc_properties: "Document properties",
      sb_hdr_doc_specific_properties: "Document",
      sb_hdr_doc_scene_defaults: "Defaults for new pages",
      sb_lbl_include_cover_page: "Include cover page in document export",
      sb_lbl_cover_date_abbrev: "Use abbreviated numeric cartouche date on cover page",
      sb_btn_load_doc_bg: "Load default background image…",
      sb_btn_clear_doc_bg: "Clear default background image",
      // Scrapbook sidebar — page buttons
      sb_btn_add_page:       "New page",
      sb_btn_dup_page_sm:    "Duplicate",
      sb_btn_del_page_sm:    "Delete",
      sb_btn_prev_sm:        "Previous",
      sb_btn_next_sm:        "Next",
      // Scrapbook sidebar — page fields
      sb_lbl_page_name:      "Page name",
      sb_lbl_page_tags:      "Tags",
      sb_lbl_page_size:      "Page size",
      sb_lbl_page_notes:     "Notes",
      sb_placeholder_page_notes: "Page notes",
      sb_btn_apply_template: "Replace current page with template",
      sb_btn_export_pdf:     "Export document PDF",
    },
    tp: {
      title: "ilo pi sitelen lon supa sitelen (kepeken ala e ijo ante)",
      lbl_lang: "toki",
      lang_en: "toki Inli",
      lang_tp: "toki pona",

      btn_new: "o sin / o weka",
      btn_export_json: "o pana e JSON pi lipu ni",
      btn_import_json: "o kama jo e JSON pi lipu ni",
      btn_export_png: "o pana e PNG pi lipu ni",
      btn_group: "o kulupu",
      btn_ungroup: "o tu e kulupu",

      tool_select: "alasa",
      tool_text: "sitelen Lasina",
      tool_sitelen: "sitelen pona",
      tool_glyph: "sitelen wan",
      tool_rect: "leko",
      tool_image: "sitelen",
      tool_audio: "kalama",
      tool_video: "sitelen tawa",
      tool_url: "URL",
      tool_delete: "weka",
      tool_pan: "tawa",

      btn_undo: "pini ala",
      btn_redo: "pali sin",
      btn_copy: "kopi",
      btn_cut: "kipisi",
      btn_paste: "pana sin",
      btn_media_editor: "ilo media",
      sb_btn_goto_page: "o tawa lipu nanpa",
      sb_btn_go: "o tawa",
      sb_ph_page_number: "nanpa lipu",

      tip_undo: "pini ala (Ctrl/Cmd+Z)",
      tip_redo: "pali sin (Ctrl/Cmd+Y anu Ctrl/Cmd+Shift+Z)",
      tip_copy: "kopi (Ctrl/Cmd+C)",
      tip_cut: "kipisi (Ctrl/Cmd+X)",
      tip_paste: "pana sin (Ctrl/Cmd+V)",

      hdr_stage: "supa",
      hdr_properties: "sona ijo",

      btn_snap_grid: "tawa leko",
      btn_snap_objs: "tawa ijo",
      btn_grid: "leko",

      lbl_width: "suli",
      lbl_height: "suli sewi",
      lbl_grid_size: "suli pi leko",
      lbl_snap_tol: "tawa leko: weka",
      lbl_export_stage_bg: "pana la monsi lon",
      lbl_stage_bg: "monsi pi supa",
      lbl_default_render_font: "kulupu sitelen pona open",
      lbl_default_text_font: "kulupu sitelen Lasina open",
      lbl_default_abbrev_numeric_cartouches: "o lili e poki sitelen pi nanpa",
      lbl_default_preserve_center_auto_resize: "ante suli la insa li awen",
      lbl_default_spacing: "weka pi sitelen pona open",
      lbl_default_text: "kule sitelen open",
      lbl_default_fill_enabled: "pana kule: ken",
      lbl_default_fill: "kule insa open",
      lbl_default_stroke: "kule linja open",
      lbl_default_stroke_w: "suli linja open",

      btn_bring_forward: "o tawa sinpin",
      btn_send_backward: "o tawa monsi",
      props_hint: "o alasa e ijo la sina ken ante e ona.",

      // Properties panel / element inspector
      sec_appearance: "lukin",
      sec_geometry: "nasin sijelo",
      sec_glyph: "sitelen wan",
      sec_group: "kulupu",
      sec_image: "sitelen",
      sec_shape: "sijelo",
      sec_sitelen: "sitelen pona",
      sec_halo: "poka walo",

      props_halo_enabled: "poka walo li lon",
      props_halo_color: "kule poka walo",
      props_halo_thickness: "suli poka walo (px) — 0 la ona li kama tan suli pi sitelen",
      sec_text: "sitelen",

      etype_text: "sitelen Lasina",
      etype_sitelen: "sitelen pona",
      etype_glyph: "sitelen wan",
      etype_rect: "leko",
      etype_image: "sitelen",

      props_header_single: (typeLabel, id) => `mi alasa e ijo: ${typeLabel} (${id})`,
      props_header_group: (n, gid) => `mi alasa e kulupu (${n} ijo)  [${gid}]`,
      props_header_multi: (n) => `mi alasa e ijo ${n}`,

      props_allow_fill: "pana kule insa",
      props_fill: "kule insa",
      props_stroke: "kule linja",
      props_foreground_group: "kule sinpin (kulupu)",
      props_stroke_width: "suli linja",
      props_opacity: "ken lukin (0..1)",
      props_mixed: "ante",
      props_edit_mixed_text: "ken ante e toki pi mute",
      props_keep_aspect: "awen sama pi suli",
      props_preserve_center_auto_resize: "ante suli la insa li awen",
      props_abbrev_numeric_cartouches: "o lili e poki sitelen pi nanpa",
      props_scale_font_box: "suli sitelen li sama poki",
      props_render_font_family: "kulupu sitelen pi sitelen pona",
      props_font_family: "kulupu sitelen pi sitelen Lasina",
      props_font_size: "suli sitelen",
      props_align: "poka",
      props_align_left: "poka open",
      props_align_center: "insa",
      props_align_right: "poka pini",
      props_spacing: "weka",
      props_text: "sitelen",
      props_text_color: "kule sitelen",
      props_line_height: "suli pi linja",
      props_glyph_color: "kule sitelen wan",
      props_ignore_unknown_text: "o lukin ala e nimi sona ala",
      props_image_embedded: (mime, w, h) => `sitelen li lon insa: ${mime}, ${w}×${h}`,
      props_image_none: "sitelen li lon ala. sitelen li lon insa (kepeken ala e link).",
      props_color_key_transparency: "weka lukin kepeken kule (kepeken pixel pi poka sewi open)",
      props_loaded_intrinsic_size: "suli pi sitelen kama jo",
      props_rendered_intrinsic_size: "suli pi sitelen kama",
      props_original_box_size: "suli pi poki open",
      props_corner_radius: "sike pi poki",
      props_x: "X",
      props_y: "Y",
      props_w: "W",
      props_h: "H",
      props_rotation_deg: "tawa sike (deg)",

      sitelen_placeholder:
        "mi kama sona e toki pona.\n" +
        ": sewi^ ni ni^ ni> ni< .\n" +
        "[ ota  kolon en ]\n" +
        "nanpa -12,340.57.\n" +
        "nanpa #~IIM.\n" +
        "nanpa Newenin One Len Oken.\n" +
        "pi {telo lete}.\n" +
        "tenpo 15:27:49.\n" +
        "tenpo suno 2026-03-17.\n" +
        "\"Hello World!\".\n" +
        "nimi pi sona ala li weka; nimi lon poki \"...\" la ona li awen.\n",

      lbl_disclaimer: "toki awen:",
      txt_disclaimer: "ilo ni li lon taso. mi toki ala e ni: ona li pona, ona li lon ale, anu ona li ken tawa wile sina. sina o sona pona e ni: sina taso li jo e pilin pi lon/pona pi pali ni.",
      lnk_back: "o tawa lipu open",

      btn_fit: "pona tawa lukin",
      btn_zoom_in: "lukin suli +",
      btn_zoom_out: "lukin lili -",
      btn_reset_view: "o sin e lukin",

      toggle_on: "lon",
      toggle_off: "ala",
      locked: "awen",
      msg_locked_selection: "ijo awen li lon. o weka e awen la sina ken ante e ijo.",
      img_load: "o kama jo e sitelen…",
      img_replace: "o ante e sitelen…",
      img_clear: "o weka e sitelen",
      opt_custom: "sina wile",
      tip_current_colour: "kule lon tenpo ni (o pilin la ona li open)",

      alert_cut_locked: "ijo awen li lon. o weka e awen la sina ken kipisi.",
      alert_delete_locked: "sina ken ala weka e ijo ni tan ni: ona li awen. o weka e awen ona.",
      confirm_delete: (n) => `sina wile weka e ijo ${n} anu seme?`,
      confirm_clear: "ni li weka e supa sitelen ni. sina wile awen anu seme?",

      default_text_multiline: "sitelen\n(mute linja)",

      status_tool: (toolLabel) => `ilo: ${toolLabel}`,
      status_grouped: (n) => `mi kulupu e ijo (${n}).`,
      status_copied: (n) => `mi kopi e ijo ${n}.`,
      status_pasted: (n) => `mi pana sin e ijo ${n}.`,
      status_selected: (n) => `mi alasa e ijo: ${n}`,
      status_import_failed: (msg) => `mi kama jo ala: ${msg}`,
      status_autosaved: "mi awen e lipu",
      status_autosave_failed: "mi ken ala awen e lipu (IndexedDB).",
      status_undo: "mi pini ala.",
      status_redo: "mi pali sin.",
      status_ungrouped: "mi tu e kulupu.",
      status_copy_none: "kopi la: ijo li lon ala.",
      status_cut_none: "kipisi la: ijo li lon ala.",
      status_cut_blocked_locked: "mi ken ala kipisi tan ijo awen.",
      status_cut_done: "mi kipisi.",
      status_paste_empty: "pana sin la: poki kopi li jo e ala.",
      status_delete_blocked_locked: "mi ken ala weka tan ijo awen.",
      status_deleted: "mi weka.",
      status_panning: "mi tawa…",
      status_click_create: "o pilin lon supa la sina kama pali e ijo sin.",
      status_locked_unlock_edit: "ijo awen li lon: o weka e awen la sina ken tawa/ante.",
      status_locked_unlock_move: "ijo awen li lon: o weka e awen la sina ken tawa.",
      status_move: "mi tawa…",
      status_marquee: "mi alasa lon ma suli…",
      status_ready: "mi awen.",
      status_cancelled: "mi pini e ni.",
      status_selection_cleared: "mi weka e alasa.",
      status_nudged: "mi tawa lili.",
      status_image_embedded: "sitelen li lon insa.",
      status_exported_json: "mi pana e JSON.",
      status_imported_json_db_fail: "mi kama jo e JSON. taso mi ken ala awen e ona lon DB.",
      status_imported_json: "mi kama jo e JSON.",
      status_exported_png: "mi pana e PNG (monsi li ken lukin ala).",
      status_cleared: "mi weka.",
      status_default_fill_enabled_updated: "mi ante e ken pi pana kule monsi (tawa ijo sin).",
      status_default_text_updated: "mi ante e kule sitelen (tawa ijo sin).",
      status_default_fill_updated: "mi ante e kule insa (tawa ijo sin).",
      status_default_stroke_updated: "mi ante e kule linja (tawa ijo sin).",
      status_default_stroke_w_updated: "mi ante e suli linja (tawa ijo sin).",
      status_loading: "mi kama jo…",
      status_loaded: "mi kama jo.",
      status_no_saved_scene: "mi jo ala e lipu awen. mi awen.",
      status_idb_unavailable: "IndexedDB li lon ala. mi pali taso; mi awen ala e lipu.",

      // Scrapbook shell — document buttons (topbar)
      sb_btn_new_doc:        "o pali e lipu sin",
      sb_btn_import_doc:     "o kama jo e lipu JSON",
      sb_btn_export_doc:     "o pana e lipu JSON",
      sb_btn_export_zip:     "o pana e sitelen PNG pi lipu ale",
      sb_btn_export_svg_zip: "o pana e sitelen SVG pi lipu ale",
      sb_btn_export_print:   "o pana e HTML",
      sb_btn_present:        "o lukin e lipu",
      sb_btn_search:         "o alasa",
      // Scrapbook shell — page buttons (topbar)
      sb_btn_new_page:       "lipu sin",
      sb_btn_dup_page:       "o ante e lipu",
      sb_btn_del_page:       "o weka e lipu",
      sb_btn_move_up:        "o tawa sewi e lipu",
      sb_btn_move_down:      "o tawa anpa e lipu",
      sb_btn_prev_page:      "lipu pini",
      sb_btn_next_page:      "lipu kama",
      // Scrapbook sidebar — section headings
      sb_hdr_document:       "lipu",
      sb_hdr_pages:          "lipu mute",
      sb_hdr_current_page:   "lipu ni",
      // Scrapbook sidebar — document fields
      sb_lbl_title:          "nimi",
      sb_lbl_subtitle:       "nimi lili",
      sb_lbl_doc_type:       "ale pi lipu",
      sb_lbl_theme:          "nasin sitelen",
      sb_lbl_page_template:  "nasin pi lipu sin",
      sb_lbl_page_w:         "suli pi lipu (poka)",
      sb_lbl_page_h:         "suli pi lipu (sewi)",
      sb_lbl_page_count:     "nanpa lipu",
      sb_lbl_doc_notes:      "toki pi lipu",
      sb_placeholder_doc_notes: "toki pi lipu",
      sb_btn_doc_properties: "sona",
      sb_btn_page_properties: "sona lipu",
      sb_hdr_page_properties: "sona lipu",
      sb_hdr_doc_properties: "sona pi lipu",
      sb_hdr_doc_specific_properties: "lipu",
      sb_hdr_doc_scene_defaults: "open pi lipu sin",
      sb_lbl_include_cover_page: "o pana e lipu open lon pana lipu",
      sb_lbl_cover_date_abbrev: "o lili e poki sitelen pi tenpo lon lipu open",
      sb_btn_load_doc_bg: "o kama jo e sitelen monsi open…",
      sb_btn_clear_doc_bg: "o weka e sitelen monsi open",
      // Scrapbook sidebar — page buttons
      sb_btn_add_page:       "lipu sin",
      sb_btn_dup_page_sm:    "o ante",
      sb_btn_del_page_sm:    "o weka",
      sb_btn_prev_sm:        "pini",
      sb_btn_next_sm:        "kama",
      // Scrapbook sidebar — page fields
      sb_lbl_page_name:      "nimi lipu",
      sb_lbl_page_tags:      "nimi lili",
      sb_lbl_page_size:      "suli lipu",
      sb_lbl_page_notes:     "toki",
      sb_placeholder_page_notes: "toki pi lipu ni",
      sb_btn_apply_template: "o ante e lipu kepeken nasin",
      sb_btn_export_pdf:     "o pana e lipu PDF",
    }
  };

  function tr(key, ...args){
    const pack = STRINGS[DEV_LANG] || STRINGS.en;
    const v = (pack && (key in pack)) ? pack[key] : (STRINGS.en[key] ?? key);
    return (typeof v === "function") ? v(...args) : v;
  }

  function applyUiText(){
    document.title = tr("title");

    // Language selector
    const lblLang = $("lblLang");
    if (lblLang) lblLang.textContent = tr("lbl_lang");
    const langSel = $("langSel");
    if (langSel){
      const optEn = langSel.querySelector('option[value="en"]');
      const optTp = langSel.querySelector('option[value="tp"]');
      if (optEn) optEn.textContent = tr("lang_en");
      if (optTp) optTp.textContent = tr("lang_tp");
      langSel.value = DEV_LANG;
      langSel.setAttribute("aria-label", tr("lbl_lang"));
    }

    // Topbar action buttons
    const mapButtons = [
      ["btnNew", "btn_new"],
      ["btnExportJson", "btn_export_json"],
      ["btnImportJson", "btn_import_json"],
      ["btnExportPng", "btn_export_png"],
      ["btnGroup", "btn_group"],
      ["btnUngroup", "btn_ungroup"],

      ["toolSelect", "tool_select"],
      ["toolText", "tool_text"],
      ["toolSitelen", "tool_sitelen"],
      ["toolGlyph", "tool_glyph"],
      ["toolRect", "tool_rect"],
      ["toolImage", "tool_image"],
      ["toolAudio", "tool_audio"],
      ["toolVideo", "tool_video"],
      ["toolUrl", "tool_url"],
      ["toolDelete", "tool_delete"],
      ["toolPan", "tool_pan"],

      ["btnUndo", "btn_undo"],
      ["btnRedo", "btn_redo"],
      ["btnCopy", "btn_copy"],
      ["btnCut", "btn_cut"],
      ["btnPaste", "btn_paste"],
      ["btnToggleMediaEditor", "btn_media_editor"],
      ["btnTopbarZoomIn", "btn_zoom_in"],
      ["btnTopbarZoomOut", "btn_zoom_out"],

      ["btnSnapGrid", "btn_snap_grid"],
      ["btnSnapObjs", "btn_snap_objs"],
      ["btnGrid", "btn_grid"],

      ["btnBringFwd", "btn_bring_forward"],
      ["btnSendBack", "btn_send_backward"],

      ["btnFit", "btn_fit"],
      ["btnZoomIn", "btn_zoom_in"],
      ["btnZoomOut", "btn_zoom_out"],
      ["btnResetView", "btn_reset_view"],
    ];
    for (const [id, key] of mapButtons){
      const el = $(id);
      if (el) el.textContent = tr(key);
    }

    // Scrapbook shell buttons (topbar — created dynamically by installScrapbookChrome)
    const sbBtnMap = [
      ["sbBtnNewDoc",      "sb_btn_new_doc"],
      ["sbBtnImportDoc",   "sb_btn_import_doc"],
      ["sbBtnExportDoc",   "sb_btn_export_doc"],
      ["sbBtnExportAllPng","sb_btn_export_zip"],
      ["sbBtnExportAllSvg","sb_btn_export_svg_zip"],
      ["sbBtnExportPrint", "sb_btn_export_print"],
      ["sbBtnExportPdf",   "sb_btn_export_pdf"],
      ["sbBtnPresent",     "sb_btn_present"],
      ["sbBtnSearch",      "sb_btn_search"],
      ["sbBtnNewPage",     "sb_btn_new_page"],
      ["sbBtnDupPage",     "sb_btn_dup_page"],
      ["sbBtnDeletePage",  "sb_btn_del_page"],
      ["sbBtnMovePageUp",  "sb_btn_move_up"],
      ["sbBtnMovePageDown","sb_btn_move_down"],
      ["sbBtnPrevPage",    "sb_btn_prev_page"],
      ["sbBtnNextPage",    "sb_btn_next_page"],
    ];
    for (const [id, key] of sbBtnMap){
      const el = $(id);
      if (el) el.textContent = tr(key);
    }
    const sbGotoPageInput = $('sbGotoPageInput');
    if (sbGotoPageInput){
      sbGotoPageInput.placeholder = tr('sb_ph_page_number');
      sbGotoPageInput.title = tr('sb_btn_goto_page');
      sbGotoPageInput.setAttribute('aria-label', tr('sb_btn_goto_page'));
    }
    // Re-render the scrapbook sidebar so all labels update
    try { renderScrapbookSidebar(); } catch {}

    // Tooltips
    const undo = $("btnUndo"); if (undo) undo.title = tr("tip_undo");
    const redo = $("btnRedo"); if (redo) redo.title = tr("tip_redo");
    const copy = $("btnCopy"); if (copy) copy.title = tr("tip_copy");
    const cut  = $("btnCut");  if (cut)  cut.title  = tr("tip_cut");
    const paste= $("btnPaste");if (paste)paste.title= tr("tip_paste");
    installCompactToolbar();

    // Sidebar headings
    const hs = $("hdrStage"); if (hs) hs.textContent = tr("hdr_stage");
    const hp = $("hdrProps"); if (hp) hp.textContent = tr("hdr_properties");

    // Stage labels
    const setLabel = (forId, key) => {
      const l = document.querySelector(`label[for="${forId}"]`);
      if (l) l.textContent = tr(key);
    };
    setLabel("stageW", "lbl_width");
    setLabel("stageH", "lbl_height");
    setLabel("gridSize", "lbl_grid_size");
    setLabel("snapTol", "lbl_snap_tol");
    setLabel("exportStageBackground", "lbl_export_stage_bg");
    setLabel("stageBg", "lbl_stage_bg");
    setLabel("defRenderFontPreset", "lbl_default_render_font");
    setLabel("defTextFontOption", "lbl_default_text_font");
    setLabel("defAbbreviateNumericCartouches", "lbl_default_abbrev_numeric_cartouches");
    setLabel("defPreserveCenterOnAutoResize", "lbl_default_preserve_center_auto_resize");
    setLabel("defSpacingPreset", "lbl_default_spacing");
    setLabel("defTextColor", "lbl_default_text");
    setLabel("defaultFillEnabled", "lbl_default_fill_enabled");
    setLabel("defaultFill", "lbl_default_fill");
    setLabel("defaultStroke", "lbl_default_stroke");
    setLabel("defaultStrokeW", "lbl_default_stroke_w");

    // Properties hint (static HTML)
    const hint = $("propsHint");
    if (hint) hint.textContent = tr("props_hint");

    // Footer
    const d1 = $("lblDisclaimer"); if (d1) d1.textContent = tr("lbl_disclaimer");
    const d2 = $("txtDisclaimer"); if (d2) d2.textContent = tr("txt_disclaimer");
    const back = $("lnkBack"); if (back) back.textContent = tr("lnk_back");
  }

  function loadToolbarLayoutMode(){
    try{ return localStorage.getItem(LS_KEY_TOOLBAR_LAYOUT) === 'original' ? 'original' : 'compact'; } catch {}
    return 'compact';
  }
  function saveToolbarLayoutMode(mode){
    try{ localStorage.setItem(LS_KEY_TOOLBAR_LAYOUT, mode === 'compact' ? 'compact' : 'original'); } catch {}
  }
  function setToolbarLayoutMode(mode){
    const compact = mode === 'compact';
    document.body.classList.toggle('toolbarCompactMode', compact);
    saveToolbarLayoutMode(compact ? 'compact' : 'original');
    const btn1 = $('btnToggleToolbarLayout');
    const btn2 = $('btnToggleToolbarLayoutCompact');
    if (btn1) btn1.setAttribute('aria-pressed', compact ? 'true' : 'false');
    if (btn2) btn2.setAttribute('aria-pressed', compact ? 'true' : 'false');
    syncCompactToolbarState();
  }
  function toggleToolbarLayoutMode(){
    setToolbarLayoutMode(document.body.classList.contains('toolbarCompactMode') ? 'original' : 'compact');
  }
  function closeCompactMenus(except = null){
    document.querySelectorAll('#topbar .topbarMenu[open]').forEach((menu) => {
      if (except && menu === except) return;
      menu.removeAttribute('open');
    });
  }
  function makeProxyButton(targetId, label){
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const target = $(targetId);
      if (target) target.click();
      closeCompactMenus();
      syncCompactToolbarState();
    });
    return btn;
  }
  function populateCompactMenu(panelId, items){
    const panel = $(panelId);
    if (!panel) return;
    panel.innerHTML = '';
    for (const item of items){
      panel.appendChild(makeProxyButton(item.id, item.label));
    }
  }
  function syncCompactToolbarState(){
    const compactStatus = $('compactStatus');
    if (compactStatus && $('status')) compactStatus.textContent = $('status').textContent || '';
    const compactLangSel = $('compactLangSel');
    const langSel = $('langSel');
    if (compactLangSel && langSel && compactLangSel.value !== langSel.value) compactLangSel.value = langSel.value;

    const mapDisabled = [
      ['btnUndo','compactBtnUndo'],['btnRedo','compactBtnRedo'],['btnCopy','compactBtnCopy'],['btnCut','compactBtnCut'],['btnPaste','compactBtnPaste']
    ];
    for (const [srcId,dstId] of mapDisabled){
      const src = $(srcId), dst = $(dstId);
      if (src && dst) dst.disabled = !!src.disabled;
    }
  }
  function installCompactToolbar(){
    const compactLangSel = $('compactLangSel');
    const langSel = $('langSel');
    if (compactLangSel && langSel && !compactLangSel.__wired){
      compactLangSel.__wired = true;
      compactLangSel.innerHTML = langSel.innerHTML;
      compactLangSel.value = langSel.value;
      compactLangSel.addEventListener('change', () => { langSel.value = compactLangSel.value; langSel.dispatchEvent(new Event('change')); });
    }
    const bindClick = (compactId, targetId) => {
      const btn = $(compactId);
      if (btn && !btn.__wired){
        btn.__wired = true;
        btn.addEventListener('click', () => { const t = $(targetId); if (t) t.click(); syncCompactToolbarState(); });
      }
    };
    bindClick('compactToolSelect','toolSelect');
    bindClick('compactToolText','toolText');
    bindClick('compactToolSitelen','toolSitelen');
    bindClick('compactToolImage','toolImage');
    bindClick('compactToolDelete','toolDelete');
    bindClick('compactToolPan','toolPan');
    bindClick('compactBtnUndo','btnUndo');
    bindClick('compactBtnRedo','btnRedo');
    bindClick('compactBtnCopy','btnCopy');
    bindClick('compactBtnCut','btnCut');
    bindClick('compactBtnPaste','btnPaste');
    bindClick('compactBtnTextEditor','btnToggleTextEditor');
    bindClick('compactBtnMediaEditor','btnToggleMediaEditor');
    bindClick('compactBtnZoomIn','btnTopbarZoomIn');
    bindClick('compactBtnZoomOut','btnTopbarZoomOut');
    bindClick('compactBtnSearch','sbBtnSearch');

    const compactGotoBtn = $('compactBtnGotoPage');
    if (compactGotoBtn && !compactGotoBtn.__wired){
      compactGotoBtn.__wired = true;
      compactGotoBtn.addEventListener('click', () => {
        const src = $('compactGotoPageInput');
        const dst = $('sbGotoPageInput');
        if (src && dst) dst.value = src.value;
        const go = $('sbBtnGotoPage');
        if (go) go.click();
      });
    }

    populateCompactMenu('compactMenuFilePanel', [
      { id:'sbBtnNewDoc', label: tr('sb_btn_new_doc') },
      { id:'sbBtnImportDoc', label: tr('sb_btn_import_doc') }
    ]);
    populateCompactMenu('compactMenuPagePanel', [
      { id:'sbBtnNewPage', label: tr('sb_btn_new_page') },
      { id:'sbBtnDupPage', label: tr('sb_btn_dup_page') },
      { id:'sbBtnDeletePage', label: tr('sb_btn_del_page') },
      { id:'sbBtnMovePageUp', label: tr('sb_btn_move_up') },
      { id:'sbBtnMovePageDown', label: tr('sb_btn_move_down') },
      { id:'sbBtnPrevPage', label: tr('sb_btn_prev_page') },
      { id:'sbBtnNextPage', label: tr('sb_btn_next_page') },
      { id:'btnExportJson', label: tr('btn_export_json') },
      { id:'btnImportJson', label: tr('btn_import_json') },
      { id:'btnExportPng', label: tr('btn_export_png') }
    ]);
    populateCompactMenu('compactMenuInsertPanel', [
      { id:'toolGlyph', label: tr('tool_glyph') },
      { id:'toolRect', label: tr('tool_rect') },
      { id:'toolAudio', label: tr('tool_audio') },
      { id:'toolVideo', label: tr('tool_video') },
      { id:'toolUrl', label: tr('tool_url') }
    ]);
    populateCompactMenu('compactMenuArrangePanel', [
      { id:'btnGroup', label: tr('btn_group') },
      { id:'btnUngroup', label: tr('btn_ungroup') }
    ]);
    populateCompactMenu('compactMenuViewPanel', [
      { id:'btnFit', label: tr('btn_fit') },
      { id:'btnResetView', label: tr('btn_reset_view') }
    ]);
    populateCompactMenu('compactMenuExportPanel', [
      { id:'sbBtnExportDoc', label: tr('sb_btn_export_doc') },
      { id:'sbBtnExportAllPng', label: tr('sb_btn_export_zip') },
      { id:'sbBtnExportAllSvg', label: tr('sb_btn_export_svg_zip') },
      { id:'sbBtnExportPrint', label: tr('sb_btn_export_print') },
      { id:'sbBtnExportPdf', label: tr('sb_btn_export_pdf') },
      { id:'sbBtnPresent', label: tr('sb_btn_present') }
    ]);

    const lbl = $('compactLblLang');
    if (lbl) lbl.textContent = tr('lbl_lang');
    const cGoto = $('compactGotoPageInput');
    if (cGoto){
      cGoto.placeholder = tr('sb_ph_page_number');
      cGoto.title = tr('sb_btn_goto_page');
    }
    const cGo = $('compactBtnGotoPage'); if (cGo) cGo.textContent = tr('sb_btn_go');

    const toggle1 = $('btnToggleToolbarLayout');
    const toggle2 = $('btnToggleToolbarLayoutCompact');
    if (toggle1 && !toggle1.__wired){ toggle1.__wired = true; toggle1.addEventListener('click', toggleToolbarLayoutMode); }
    if (toggle2 && !toggle2.__wired){ toggle2.__wired = true; toggle2.addEventListener('click', toggleToolbarLayoutMode); }

    document.querySelectorAll('#topbar .topbarMenu > summary').forEach((summary) => {
      if (summary.__wired) return;
      summary.__wired = true;
      summary.addEventListener('click', () => {
        const menu = summary.parentElement;
        if (menu && !menu.open) closeCompactMenus(menu);
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#topbar .topbarMenu')) closeCompactMenus();
    }, { capture:true });

    syncCompactToolbarState();
  }

  function wireLangSelector(){
    const langSel = $("langSel");
    if (!langSel) return;
    langSel.addEventListener("change", () => {
      const v = (langSel.value === "tp") ? "tp" : "en";
      if (v === DEV_LANG) return;
      DEV_LANG = v;
      saveLang(DEV_LANG);
      applyUiText();
      try { renderPropsPanel(); } catch {}
    });
  }




  // Use scrapbook-specific IndexedDB storage so it does not clash with layout-editor autosaves.
  const DB_NAME = "scrapbook_layout_editor_shell_db";
  const DB_STORE = "scrapbook_scenes";
  const DB_KEY = "scrapbook_scene_v1";

  const Tool = Object.freeze({
    Select: "select",
    Text: "text",
    Sitelen: "sitelen",
    Glyph: "glyph",
    Rect: "rect",
    Image: "image",
    Audio: "audio",
    Video: "video",
    Url: "url",
    Delete: "delete",
    Pan: "pan",
  });

  const ElementType = Object.freeze({
    Text: "text",
    Sitelen: "sitelen",
    Glyph: "glyph",
    Rect: "rect",
    Image: "image",
    Audio: "audio",
    Video: "video",
    Url: "url",
  });

  // Layout-editor-vector compatibility constants.
  // These are used by normalizeScene() to detect imported StaticCanvasLayout
  // scenes that already use the layout editor vector box/placement contract.
  // They must be defined before normalizeScene() can run during scrapbook
  // startup/document normalization.
  const VECTOR_SCENE_EDITOR_ID = "layout-editor-vector";
  const VECTOR_BOX_MODEL_VERSION = "glyph-canvas-middle-font-roles-v6";

const FONT_FAMILY_TEXT = "TP-Nasin-Nanpa-Font";
const FONT_FAMILY_CARTOUCHE = "TP-Cartouche-Font";
const FONT_FAMILY_LITERAL = "Patrick-Head-Font";
const FONT_FAMILY_LITERAL_CARTOUCHE = "TP-Nasin-Nanpa-Literal-Cartouche-Font";
const FONT_FAMILY_LIBERATION_SANS = "TP-Vector-Liberation-Sans-Font";
const FONT_FAMILY_LIBERATION_SERIF = "TP-Vector-Liberation-Serif-Font";
const FONT_FAMILY_LIBERATION_MONO = "TP-Vector-Liberation-Mono-Font";
const FONT_URL_LIBERATION_SANS = "../../fonts/LiberationSans-Regular.ttf";
const FONT_URL_LIBERATION_SERIF = "../../fonts/LiberationSerif-Regular.ttf";
const FONT_URL_LIBERATION_MONO = "../../fonts/LiberationMono-Regular.ttf";

  const DEFAULTS = Object.freeze({
    stageW: 1280,
    stageH: 800,
    gridSize: 20,
    snapTol: 6,
    showGrid: true,
    snapGrid: true,
    snapObjects: false,
    viewZoom: 1.0,

    // NEW: stage + default styling
    stageBg: "#FFFFFF", //"#F3DFC0",                 // stage background color
    exportStageBackground: false,
    defaultRenderFontPreset: "nasinNanpa", // default sitelen/glyph preset
    defaultTextFontOption: FONT_FAMILY_LITERAL,
    defaultAbbreviateNumericCartouches: false,
    defaultPreserveCenterOnAutoResize: false,
    defaultSpacingPreset: "default",
    defaultTextColor: "#000000",        // default text color (Text/Sitelen/Glyph)
    defaultFill: "#111111",// default fill for shapes/boxes
    defaultFillEnabled: false,
    defaultStroke: "#111111",// default stroke
    defaultStrokeW: 2,                  // default stroke width

    // NEW: halo defaults
    defaultHaloEnabled: false,
    defaultHaloColor: "#FFFFFF",
    // Stored value if you switch to manual; auto derives from element font size.
    defaultHaloThicknessPx: 0,
    defaultHaloThicknessMode: "auto",
    defaultIgnoreUnknownText: false,

    // NEW: background image (scene property)
    bgImgEnabled: false,
    bgImgAssetId: null,
    bgImgKeepAspect: true,
    bgImgStretch: false,
  });

  const SPACING_PRESETS = Object.freeze(["default", "compact", "comfortable"]);

  function normalizeSpacingPreset(value){
    const v = String(value ?? "").trim().toLowerCase();
    return SPACING_PRESETS.includes(v) ? v : "default";
  }

  function getSceneDefaultSpacingPreset(){
    return normalizeSpacingPreset(Scene?.stage?.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);
  }

  function getSceneDefaultAbbreviateNumericCartouches(){
    return !!(Scene?.stage?.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches);
  }

  function getElementAbbreviateNumericCartouches(el){
    return !!(el?.abbreviateNumericCartouches ?? false);
  }

  function getSceneDefaultPreserveCenterOnAutoResize(){
    return !!(Scene?.stage?.defaultPreserveCenterOnAutoResize ?? DEFAULTS.defaultPreserveCenterOnAutoResize);
  }

  function getElementPreserveCenterOnAutoResize(el){
    return !!(el?.preserveCenterOnAutoResize ?? false);
  }

  function getElementSpacingPreset(el){
    return normalizeSpacingPreset(
      el?.spacingPreset ??
      Scene?.stage?.defaultSpacingPreset ??
      DEFAULTS.defaultSpacingPreset
    );
  }

  function spacingPresetSelectOptions(){
    return [
      ["default", "Default"],
      ["compact", "Compact"],
      ["comfortable", "Comfortable"],
    ];
  }


    const RENDER_FONT_PRESETS = {
      nasinNanpa: {
        key: "nasinNanpa",
        label: "nasin nanpa predefined",
        parserMode: "sitelen-seli-kiwen",
        textFamily: FONT_FAMILY_TEXT,
        cartoucheFamily: FONT_FAMILY_CARTOUCHE,
        literalFamily: FONT_FAMILY_LITERAL,
        literalCartoucheFamily: FONT_FAMILY_LITERAL_CARTOUCHE,
        settings: { literalCartoucheRuleClipScale: 0.24985, literalCartoucheRuleClipStrategy: "leftCap", literalCartoucheLeftCapClipRatio: 0.90 },
        literalOptions: [
          [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
          [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
          [FONT_FAMILY_LITERAL, "Patrick Hand"],
          ["Arial", "Arial"],
          ["Times New Roman", "Times New Roman"],
          ["Courier New", "Courier New"],
          ["system-ui", "system-ui"],
        ],
        pdfTextFontUrl: "../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf",
        pdfCartoucheFontUrl: "../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf",
        faces: [
          {
            family: FONT_FAMILY_TEXT,
            url: "../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf",
            format: "opentype",
            sample: String.fromCodePoint(0xF196C)
          },
          {
            family: FONT_FAMILY_CARTOUCHE,
            url: "../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf",
            format: "opentype",
            sample: String.fromCodePoint(0xF1990)
          },
          {
            family: FONT_FAMILY_LITERAL,
            url: "../../fonts/PatrickHand-Regular.ttf",
            format: "truetype",
            sample: "Hello"
          },
          {
            family: FONT_FAMILY_LITERAL_CARTOUCHE,
            url: "../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf",
            format: "opentype",
            sample: "Hello"
          }
        ]
      },
      sitelenSeliKiwen: {
        key: "sitelenSeliKiwen",
        label: "sitelen seli kiwen predefined",
        parserMode: "sitelen-seli-kiwen",
        textFamily: "SSK-Juniko",
        cartoucheFamily: "SSK-Juniko-Cartouche",
        literalFamily: FONT_FAMILY_LITERAL,
        literalCartoucheFamily: "SSK-Juniko",
        settings: {
          literalCartoucheRuleClipScale: 0.0,
          literalCartoucheRuleClipStrategy: "none",
          conditionalLiteralCartoucheClips: [
            {
              id: "ssk-juniko-lowercase-i-j-l-left-overhang",
              enabled: true,
              fontRole: "literalCartouche",
              fontFamily: "SSK-Juniko",
              sourceTextStartsWithRegex: "^[ijl]",
              patch: {
                literalCartoucheRuleClipStrategy: "leftCap",
                literalCartoucheRuleClipScale: 0.24985,
                literalCartoucheLeftCapClipRatio: 0.8
              }
            }
          ]
        },
        literalOptions: [
          [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
          [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
          [FONT_FAMILY_LITERAL, "Patrick Hand"],
          ["Arial", "Arial"],
          ["Times New Roman", "Times New Roman"],
          ["Courier New", "Courier New"],
          ["system-ui", "system-ui"],
        ],
        pdfTextFontUrl: "../../fonts/sitelenselikiwenjuniko.ttf",
        pdfCartoucheFontUrl: "../../fonts/sitelenselikiwenjuniko-nanpa-linja-n-good-kasi.ttf",
        faces: [
          {
            family: "SSK-Juniko",
            url: "../../fonts/sitelenselikiwenjuniko.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF196C)
          },
          {
            family: "SSK-Juniko-Cartouche",
            url: "../../fonts/sitelenselikiwenjuniko-nanpa-linja-n-good-kasi.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF1990)
          },
          {
            family: FONT_FAMILY_LITERAL,
            url: "../../fonts/PatrickHand-Regular.ttf",
            format: "truetype",
            sample: "Hello"
          }
        ]
      },
      fairfaxHd: {
        key: "fairfaxHd",
        label: "FairfaxHD predefined",
        parserMode: "sitelen-seli-kiwen",
        textFamily: "fairfaxHd",
        cartoucheFamily: "fairfaxHd-Cartouche",
        literalFamily: FONT_FAMILY_LITERAL,
        literalCartoucheFamily: "fairfaxHd",
        settings: { literalCartoucheRuleClipScale: 0.9, literalCartoucheRuleClipStrategy: "compound" },
        literalOptions: [
          [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
          [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
          [FONT_FAMILY_LITERAL, "Patrick Hand"],
          ["Arial", "Arial"],
          ["Times New Roman", "Times New Roman"],
          ["Courier New", "Courier New"],
          ["system-ui", "system-ui"],
        ],
        pdfTextFontUrl: "../../fonts/FairfaxHD.ttf",
        pdfCartoucheFontUrl: "../../fonts/FairfaxHD-nanpa-linja-n-good-kasi.ttf",
        faces: [
          {
            family: "fairfaxHd",
            url: "../../fonts/FairfaxHD.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF196C)
          },
          {
            family: "fairfaxHd-Cartouche",
            url: "../../fonts/FairfaxHD-nanpa-linja-n-good-kasi.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF1990)
          },
          {
            family: FONT_FAMILY_LITERAL,
            url: "../../fonts/PatrickHand-Regular.ttf",
            format: "truetype",
            sample: "Hello"
          }
        ]
      },
      fairfaxPonaHd: {
        key: "fairfaxPonaHd",
        label: "FairfaxPonaHD predefined",
        parserMode: "sitelen-seli-kiwen",
        textFamily: "fairfaxPonaHd",
        cartoucheFamily: "fairfaxPonaHd-Cartouche",
        literalFamily: FONT_FAMILY_LITERAL,
        literalCartoucheFamily: "fairfaxPonaHd",
        settings: { literalCartoucheRuleClipScale: 0.9, literalCartoucheRuleClipStrategy: "compound" },
        literalOptions: [
          [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
          [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
          [FONT_FAMILY_LITERAL, "Patrick Hand"],
          ["Arial", "Arial"],
          ["Times New Roman", "Times New Roman"],
          ["Courier New", "Courier New"],
          ["system-ui", "system-ui"],
        ],
        pdfTextFontUrl: "../../fonts/FairfaxPonaHD.ttf",
        pdfCartoucheFontUrl: "../../fonts/FairfaxPonaHD-nanpa-linja-n-good-kasi.ttf",
        faces: [
          {
            family: "fairfaxPonaHd",
            url: "../../fonts/FairfaxPonaHD.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF196C)
          },
          {
            family: "fairfaxPonaHd-Cartouche",
            url: "../../fonts/FairfaxPonaHD-nanpa-linja-n-good-kasi.ttf",
            format: "truetype",
            sample: String.fromCodePoint(0xF1990)
          },
          {
            family: FONT_FAMILY_LITERAL,
            url: "../../fonts/PatrickHand-Regular.ttf",
            format: "truetype",
            sample: "Hello"
          }
        ]
      }
    };




function normalizeRenderFontPresetKey(key){
  const raw = String(key || "").trim();
  if (typeof stageFontPairController !== "undefined" && stageFontPairController?.hasPresetKey?.(raw)) return raw;
  return Object.prototype.hasOwnProperty.call(RENDER_FONT_PRESETS, raw) ? raw : DEFAULTS.defaultRenderFontPreset;
}
function getRenderFontPreset(key){
  if (typeof stageFontPairController !== "undefined") {
    const preset = stageFontPairController?.getPresetByKey?.(key);
    if (preset) return preset;
  }
  return RENDER_FONT_PRESETS[normalizeRenderFontPresetKey(key)] || RENDER_FONT_PRESETS[DEFAULTS.defaultRenderFontPreset];
}
function getElementRenderFontPresetKey(el){
  return normalizeRenderFontPresetKey(el?.renderFontPreset || Scene?.stage?.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
}
function getTextFontOptionsForPresetKey(presetKey){
  const preset = getRenderFontPreset(presetKey);
  if (typeof stageFontPairController !== "undefined" && stageFontPairController?.getTextFontOptionsForPreset) {
    return stageFontPairController.getTextFontOptionsForPreset(preset);
  }
  return Array.isArray(preset?.literalOptions) ? preset.literalOptions : [];
}
function normalizeTextFontOptionKeyForPreset(key, presetKey){
  const raw = String(key ?? "").trim();
  const opts = new Set(getTextFontOptionsForPresetKey(presetKey).map(([value]) => String(value)));
  const fallback = String(getRenderFontPreset(presetKey)?.literalFamily || FONT_FAMILY_LITERAL);
  return opts.has(raw) ? raw : fallback;
}
function getDefaultQuotedTextFontOptionForPreset(presetKey){
  return normalizeTextFontOptionKeyForPreset(
    FONT_FAMILY_LITERAL,
    normalizeRenderFontPresetKey(presetKey || DEFAULTS.defaultRenderFontPreset)
  );
}
function resolveTextFontFamilyForPreset(optionKey, presetKey){
  const preset = getRenderFontPreset(presetKey);
  const normalized = normalizeTextFontOptionKeyForPreset(optionKey, presetKey);
  if (normalized === TEXT_FONT_OPTION_SITELEN) return String(preset?.textFamily || FONT_FAMILY_TEXT);
  if (normalized === TEXT_FONT_OPTION_NANPA_LINJA_N) return String(preset?.cartoucheFamily || FONT_FAMILY_CARTOUCHE);
  return normalized;
}
function normalizeLegacyRenderFontPresetKey(keyOrFamily){
  const raw = String(keyOrFamily ?? "").trim();
  if (!raw) return DEFAULTS.defaultRenderFontPreset;
  if (typeof stageFontPairController !== "undefined" && stageFontPairController?.hasPresetKey?.(raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(RENDER_FONT_PRESETS, raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes("ssk") || lower.includes("sitelen seli kiwen")) return "sitelenSeliKiwen";
  if (
    lower.includes("nasinnanpa") || lower.includes("nasin nanpa") ||
    lower.includes("tp-cartouche-font") || lower.includes("tp-nasin-nanpa-font")
  ) return "nasinNanpa";
  return DEFAULTS.defaultRenderFontPreset;
}
function normalizeLegacyTextFontOptionKey(rawValue, presetKey){
  const raw = String(rawValue ?? "").trim();

  if (!raw) {
    return getDefaultQuotedTextFontOptionForPreset(presetKey);
  }
  if (raw === TEXT_FONT_OPTION_SITELEN || raw === TEXT_FONT_OPTION_NANPA_LINJA_N) return normalizeTextFontOptionKeyForPreset(raw, presetKey);
  const lower = raw.toLowerCase();
  if (lower === "patrickhand" || lower === "patrick hand" || lower === "patrick-head-font") return FONT_FAMILY_LITERAL;
  if (lower.includes("tp-cartouche-font") || lower.includes("nanpa-linja-n") || lower.includes("cartouche")) return TEXT_FONT_OPTION_NANPA_LINJA_N;
  if (
    lower.includes("tp-nasin-nanpa-font") || lower.includes("ssk-juniko") ||
    lower.includes("sitelen") || lower.includes("nasinnanpa")
  ) return TEXT_FONT_OPTION_SITELEN;
  if (lower.startsWith("arial")) return "Arial";
  if (lower.startsWith("times new roman")) return "Times New Roman";
  if (lower.startsWith("courier new")) return "Courier New";
  if (lower.startsWith("system-ui")) return "system-ui";
  return normalizeTextFontOptionKeyForPreset(raw, presetKey);
}
function plainTextLiteralFallbackOptionForPreset(presetKey){
  return normalizeTextFontOptionKeyForPreset(
    getRenderFontPreset(presetKey)?.literalFamily || FONT_FAMILY_LITERAL,
    presetKey
  );
}

function isSitelenOrCartoucheTextFontOption(optionKey, rawValue = optionKey){
  const raw = String(rawValue ?? "").trim().toLowerCase();
  const opt = String(optionKey ?? "").trim();
  return (
    opt === TEXT_FONT_OPTION_SITELEN ||
    opt === TEXT_FONT_OPTION_NANPA_LINJA_N ||
    raw === "__active_text_family__" ||
    raw === "__active_cartouche_family__" ||
    raw.includes("tp-nasin-nanpa-font") ||
    raw.includes("tp-cartouche-font") ||
    raw.includes("nanpa-linja-n") ||
    raw.includes("cartouche") ||
    raw.includes("ssk-juniko") ||
    raw.includes("sitelen") ||
    raw.includes("nasinnanpa")
  );
}

function normalizePlainTextFontOptionKey(rawValue, presetKey){
  const raw = String(rawValue ?? "").trim();
  const fallback = plainTextLiteralFallbackOptionForPreset(presetKey);
  if (!raw) return fallback;

  const normalized = normalizeTextFontOptionKeyForPreset(raw, presetKey);
  if (isSitelenOrCartoucheTextFontOption(normalized, raw)) return fallback;
  return normalized || fallback;
}

function getElementTextFontOptionKey(el){
  const presetKey = getElementRenderFontPresetKey(el);
  if (el?.type === ElementType.Glyph) return TEXT_FONT_OPTION_SITELEN;

  // Plain Text elements are literal Unicode containers.  Legacy scrapbook files
  // may contain fontFamily values such as __active_text_family__,
  // __active_cartouche_family__, TP-Nasin-Nanpa-Font, or TP-Cartouche-Font
  // because older UI presets reused the same font selectors.  For Text elements
  // those values must not activate sitelen/GSUB/cartouche rendering.  Coerce
  // any sitelen/cartouche option to the preset literal font while preserving
  // normal literal/system choices such as Patrick Hand, Arial, Times, etc.
  if (el?.type === ElementType.Text || el?.type === "text") {
    const raw = el?.fontFamily || Scene?.stage?.defaultTextFontOption || getRenderFontPreset(presetKey).literalFamily || FONT_FAMILY_LITERAL;
    return normalizePlainTextFontOptionKey(raw, presetKey);
  }

  const fallback = Scene?.stage?.defaultTextFontOption || getRenderFontPreset(presetKey).literalFamily || FONT_FAMILY_LITERAL;
  return normalizeTextFontOptionKeyForPreset(el?.fontFamily || fallback, presetKey);
}

function isInvalidSitelenQuotedTextFontOption(optionKey){
  // Sitelen and nanpa-linja-n are valid explicit quoted-text choices.  They may
  // not be good Latin fonts for ordinary quoted text, but the selector must not
  // silently rewrite a user-selected option.
  return false;
}

function normalizeValidQuotedTextFontOptionForSitelen(optionKey, presetKey){
  return normalizeTextFontOptionKeyForPreset(optionKey || "", presetKey);
}

function getSceneDefaultQuotedTextFontOptionForPreset(presetKey){
  return normalizeValidQuotedTextFontOptionForSitelen(Scene?.stage?.defaultTextFontOption || "", presetKey) ||
    getDefaultQuotedTextFontOptionForPreset(presetKey);
}

function sanitizeSitelenQuotedTextFontOption(el){
  const presetKey = getElementRenderFontPresetKey(el);
  const explicit = normalizeValidQuotedTextFontOptionForSitelen(el?.quotedTextFontOption || "", presetKey);
  const resolved = explicit || getSceneDefaultQuotedTextFontOptionForPreset(presetKey);
  if (el && (el.type === ElementType.Sitelen || el.type === "sitelen")) {
    el.quotedTextFontOption = resolved;
    // Keep the legacy/JSON field synchronized, but do not use this field as the
    // script font for sitelen rendering.  The script font is renderFontPreset.
    el.fontFamily = resolved;
  }
  return resolved;
}

function getElementQuotedTextFontOptionKey(el){
  const presetKey = getElementRenderFontPresetKey(el);
  const preset = getRenderFontPreset(presetKey);
  const sceneDefault = getSceneDefaultQuotedTextFontOptionForPreset(presetKey);

  // Sitelen elements have two separate font concepts:
  //   renderFontPreset -> sitelen words / ordinary cartouches / numeric cartouches
  //   quotedTextFontOption -> normal quoted text / unknown text
  // For sitelen, resolve quoted text only from the quoted-text font setting
  // or the scene quoted-text default. Never use el.fontFamily as a fallback
  // because older builds used that field for the sitelen script font and it
  // can contaminate quoted Latin text with missing-glyph boxes.
  if (el?.type === ElementType.Sitelen || el?.type === "sitelen") {
    return normalizeValidQuotedTextFontOptionForSitelen(el?.quotedTextFontOption || "", presetKey) || sceneDefault;
  }

  return normalizeTextFontOptionKeyForPreset(
    el?.quotedTextFontOption || el?.fontFamily || sceneDefault || preset?.literalFamily || FONT_FAMILY_LITERAL,
    presetKey
  );
}

function getElementResolvedTextFontFamily(el){
  return resolveTextFontFamilyForPreset(getElementTextFontOptionKey(el), getElementRenderFontPresetKey(el));
}

function getElementResolvedQuotedTextFontFamily(el){
  if (el?.type === ElementType.Sitelen || el?.type === "sitelen") {
    // Make the quoted-text setting authoritative before buildRenderPlan() runs.
    sanitizeSitelenQuotedTextFontOption(el);
  }
  return resolveTextFontFamilyForPreset(getElementQuotedTextFontOptionKey(el), getElementRenderFontPresetKey(el));
}
function resolveLiteralCartoucheFontFamilyForPreset(preset){
  return String(
    preset?.literalCartoucheFamily ||
    preset?.literalCartoucheFontFamily ||
    preset?.textFamily ||
    FONT_FAMILY_TEXT
  );
}

function getElementLiteralCartoucheFontFamily(el){
  return resolveLiteralCartoucheFontFamilyForPreset(getRenderFontPreset(getElementRenderFontPresetKey(el)));
}

function getElementFontPairSettings(el){
  if (el && el.literalCartoucheSettingsOverride && typeof el.literalCartoucheSettingsOverride === "object") {
    const preset = getRenderFontPreset(getElementRenderFontPresetKey(el));
    const baseSettings = (preset && typeof preset === "object" && preset.settings && typeof preset.settings === "object")
      ? preset.settings
      : {};

    return {
      ...baseSettings,
      ...el.literalCartoucheSettingsOverride
    };
  }

  const preset = getRenderFontPreset(getElementRenderFontPresetKey(el));
  return (preset && typeof preset === "object" && preset.settings && typeof preset.settings === "object")
    ? preset.settings
    : {};
}

function getElementLiteralCartoucheSettings(el){
  return getElementFontPairSettings(el);
}


const VECTOR_FONT_DEBUG = false;
function vectorFontDebug(label, data = {}){
  if (!VECTOR_FONT_DEBUG) return;
  try {
    console.info(`[layout-vector-font-debug] ${label}`, data);
  } catch (_) {}
}
function summarizeVectorFontRun(run){
  if (!run) return null;
  const el = run._element || run.element || null;
  return {
    id: run.id || null,
    kind: run.kind || null,
    renderMode: run.renderMode || null,
    sourceKind: run.sourceKind || null,
    fontRole: run.fontRole || null,
    fontFamily: run.fontFamily || null,
    encodedText: typeof run.encodedText === "string" ? run.encodedText : null,
    sourceText: typeof run.sourceText === "string" ? run.sourceText : null,
    isQuoted: !!(run.isQuoted || el?.isQuoted),
    isUnrecognized: !!(run.isUnrecognized || el?.isUnrecognized),
    isLiteralCartouche: !!(run.fontRole === "literalCartouche" || el?.isLiteralCartouche),
    elementType: el?.type || null,
    elementFontFamily: el?.fontFamily || null
  };
}
function summarizeVectorFontPlan(plan){
  const rows = [];
  for (const line of (plan?.lines || [])) {
    for (const run of (line?.runs || [])) {
      const row = summarizeVectorFontRun(run);
      if (!row) continue;
      if (
        row.fontRole === "literal" ||
        row.fontRole === "unknown" ||
        row.fontRole === "literalCartouche" ||
        row.kind === "text" ||
        row.isQuoted ||
        row.isUnrecognized ||
        row.isLiteralCartouche ||
        row.sourceKind === "quote"
      ) rows.push(row);
    }
  }
  return rows;
}

function buildRendererFontRolesForElement(el){
  if (el?.type === ElementType.Sitelen || el?.type === "sitelen") {
    sanitizeSitelenQuotedTextFontOption(el);
  }
  const presetKey = getElementRenderFontPresetKey(el);
  const preset = getRenderFontPreset(presetKey);
  const literalCartoucheFamily = resolveLiteralCartoucheFontFamilyForPreset(preset);
  const quotedTextFontOption = getElementQuotedTextFontOptionKey(el);
  const quotedLiteralFamily = getElementResolvedQuotedTextFontFamily(el) || preset.literalFamily || FONT_FAMILY_LITERAL;

  const roles = {
    // Normal sitelen words/runs use the selected script/text font.
    word: preset.textFamily,
    text: preset.textFamily,

    // Ordinary non-numeric cartouches, for example [toki pona], use the
    // ordinary sitelen/text font.  Numeric/date/time cartouches use the
    // nanpa-linja-n companion cartouche font through the number/date/time roles.
    cartouche: preset.textFamily,
    number: preset.cartoucheFamily,
    date: preset.cartoucheFamily,
    time: preset.cartoucheFamily,

    // Normal quoted text, for example "abc", uses the quoted/literal font.
    // Do not derive this from the sitelen render font.
    literal: quotedLiteralFamily,
    unknown: quotedLiteralFamily,

    // Literal cartouches, for example ["ABC"], use the separate
    // literalCartouche role.  This must not affect normal quoted text.
    literalCartouche: literalCartoucheFamily,
    literalCartoucheFamily: literalCartoucheFamily
  };

  if (el?.type === ElementType.Sitelen || el?.type === "sitelen") {
    vectorFontDebug("buildRendererFontRolesForElement", {
      elementId: el?.id || null,
      elementType: el?.type || null,
      renderFontPreset: presetKey,
      quotedTextFontOption,
      resolvedQuotedLiteralFamily: quotedLiteralFamily,
      literalCartoucheFamily,
      elementFontFamily: el?.fontFamily || null,
      elementQuotedTextFontOption: el?.quotedTextFontOption || null,
      stageDefaultTextFontOption: Scene?.stage?.defaultTextFontOption || null,
      presetSummary: {
        key: preset?.key || presetKey,
        textFamily: preset?.textFamily || null,
        cartoucheFamily: preset?.cartoucheFamily || null,
        literalFamily: preset?.literalFamily || null,
        literalCartoucheFamily: preset?.literalCartoucheFamily || null
      },
      roles
    });
  }

  return roles;
}
let sitelenRendererModulePromise = null;
const sitelenRendererInstancePromises = new Map();
const sitelenRasterJobs = new Map();
const glyphRasterJobs = new Map();
const glyphCache = new Map();
const stageFontPairController = createSitelenFontPairController({
  registry: RENDER_FONT_PRESETS,
  scriptSelect: "defRenderFontPreset",
  textFontSelect: "defTextFontOption",
  storageKeyPrefix: "layoutEditorSceneDefaults",
  defaultPresetKey: DEFAULTS.defaultRenderFontPreset,
  defaultTextFontOption: DEFAULTS.defaultTextFontOption,
  dynamicLiteralOptions: [
    [TEXT_FONT_OPTION_SITELEN, "sitelen font"],
    [TEXT_FONT_OPTION_NANPA_LINJA_N, "nanpa-linja-n"],
    [FONT_FAMILY_LITERAL, "Patrick Hand"],
    ["Arial", "Arial"],
    ["Times New Roman", "Times New Roman"],
    ["Courier New", "Courier New"],
    ["system-ui", "system-ui"],
  ],
  dynamicTextFontOption: FONT_FAMILY_LITERAL,
  dynamicLiteralFace: {
    family: FONT_FAMILY_LITERAL,
    url: "../../fonts/PatrickHand-Regular.ttf",
    format: "truetype",
    sample: "Hello"
  },
  onInvalidate: () => {}
});


function ensureSitelenRendererModule(){
  if (!sitelenRendererModulePromise){
    sitelenRendererModulePromise = import('../../js/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=56').then((mod) => mod?.default || mod?.SitelenRenderer || mod);
  }
  return sitelenRendererModulePromise;
}



const runtimeRegisteredFontFaces = new Set();
const runtimeFontFacePromises = new Map();

function getAllRenderFontFaces() {
  const out = [];
  const registry = (typeof stageFontPairController !== "undefined" && stageFontPairController?.getCombinedRegistrySnapshot)
    ? stageFontPairController.getCombinedRegistrySnapshot()
    : (RENDER_FONT_PRESETS || {});
  for (const preset of Object.values(registry || {})) {
    for (const face of (preset?.faces || [])) out.push(face);
  }
  return out;
}

function findRenderFontFaceByFamily(family) {
  const want = String(family || "").trim();
  if (!want) return null;
  for (const face of getAllRenderFontFaces()) {
    if (String(face?.family || "").trim() === want) return face;
  }
  return null;
}

async function ensureRuntimeFontFaceLoaded(face) {
  if (!face?.family || !face?.url || !document.fonts) return;

  const family = String(face.family).trim();
  const url = String(face.url).trim();
  const format = String(face.format || "truetype").trim();
  const key = `${family}::${url}`;

  if (runtimeRegisteredFontFaces.has(key)) return;
  if (runtimeFontFacePromises.has(key)) {
    await runtimeFontFacePromises.get(key);
    return;
  }

  const promise = (async () => {
    const source = `url("${url.replace(/"/g, '\\"')}") format("${format}")`;
    const fontFace = new FontFace(family, source, face.descriptors || {});
    await fontFace.load();
    document.fonts.add(fontFace);
    runtimeRegisteredFontFaces.add(key);
  })();

  runtimeFontFacePromises.set(key, promise);
  try {
    await promise;
  } finally {
    runtimeFontFacePromises.delete(key);
  }
}
async function waitForRenderPresetFonts(presetKey, fontPx = 56, literalFamily = null, extraFamilies = []){
  if (!document.fonts || typeof document.fonts.load !== 'function') return;

  const preset = getRenderFontPreset(presetKey);
  const px = Math.max(8, Number(fontPx || 56));

  const families = Array.from(new Set([
    preset.textFamily,
    preset.cartoucheFamily,
    literalFamily || preset.literalFamily,
    ...(Array.isArray(extraFamilies) ? extraFamilies : [extraFamilies])
  ].filter(Boolean)));

  const faces = families
    .map(findRenderFontFaceByFamily)
    .filter(Boolean);

  await Promise.all(faces.map(ensureRuntimeFontFaceLoaded));
  await document.fonts.ready;

  await Promise.all(families.map((family) =>
    document.fonts.load(
      `${px}px "${String(family).replace(/"/g, '\\"')}"`,
      String.fromCodePoint(0xF196C, 0xF1954, 0xF1990) + " Hello"
    )
  ));

  await document.fonts.ready;
}

function buildCartoucheTallyParserConfig(el){
  const preset = getRenderFontPreset(getElementRenderFontPresetKey(el));
  const settings = (preset && typeof preset === 'object') ? (preset.settings || preset) : {};
  const rawMode = String(settings.cartoucheTallyMode || 'ucsur').trim().toLowerCase();
  const tallyMode = (['comma','manual','ucsur'].includes(rawMode) ? rawMode : 'ucsur');
  return {
    cartoucheCommaTallyMarks: settings.cartoucheCommaTallyMarks !== false,
    cartoucheTallyMode: tallyMode
  };
}
function buildRendererInitConfigForElement(el){
  const preset = getRenderFontPreset(getElementRenderFontPresetKey(el));
  return {
    parser: {
      mode: preset.parserMode,
      literalStyle: 'double-quote',
      extensionStyle: 'ssk',
      cartoucheStyle: 'ssk',
      numericMode: 'compat',
      mixedStyle: 'short',
      abbreviateNumericCartouches: !!(el?.type === ElementType.Sitelen && getElementAbbreviateNumericCartouches(el)),
      ...buildCartoucheTallyParserConfig(el)
    },
    fonts: {
      roles: buildRendererFontRolesForElement(el),
      settings: getElementFontPairSettings(el)
    }
  };
}
function buildRendererCallConfigForElement(el){
  const fontPx = Math.max(6, Number(el?.fontSize ?? 44));
  const haloWidth = (!!el?.haloEnabled)
    ? ((el?.haloThicknessMode === 'manual' && Number.isFinite(el?.haloThickness) && el.haloThickness > 0)
      ? clampHaloThicknessPx(el.haloThickness)
      : defaultHaloThicknessForFontPx(fontPx))
    : 0;
  const isGlyph = !!el && el.type === ElementType.Glyph;
  const spacingPreset = getElementSpacingPreset(el);
  const layout = {
    fontPx,
    align: String(el?.align ?? 'left'),
    spacingPreset,
    paddingPx: (isGlyph ? 0 : DEFAULT_PAD_PX) + haloWidth
  };
  if (spacingPreset === "default") layout.lineGapPx = lineGapForPx(fontPx);
  return {
    layout,
    paint: {
      fillStyle: el?.color || '#111111',
      halo: {
        enabled: !!el?.haloEnabled,
        color: rgbaOrHexToHex(el?.haloColor, '#FFFFFF'),
        widthPx: haloWidth
      },
      unknownText: {
        style: 'outline-box',
        colorMode: 'auto',
        color: null,
        lineWidthPx: 1.5,
        paddingPx: 2,
        dash: false
      }
    },
    parser: {
      mode: getRenderFontPreset(getElementRenderFontPresetKey(el)).parserMode,
      literalStyle: 'double-quote',
      extensionStyle: 'ssk',
      cartoucheStyle: 'ssk',
      numericMode: 'compat',
      mixedStyle: 'short',
      abbreviateNumericCartouches: !!(el?.type === ElementType.Sitelen && getElementAbbreviateNumericCartouches(el)),
      showUnknownText: !!(el?.type === ElementType.Sitelen && !el?.ignoreUnknownText),
      ...buildCartoucheTallyParserConfig(el)
    },
    fonts: {
      roles: {
        ...buildRendererFontRolesForElement(el)
      },
      settings: getElementFontPairSettings(el)
    }
  };
}
async function getSitelenRendererForElement(el){
  const presetKey = getElementRenderFontPresetKey(el);
  const literalFamily = getElementResolvedQuotedTextFontFamily(el) || getRenderFontPreset(presetKey).literalFamily;
  const literalCartoucheFamily = getElementLiteralCartoucheFontFamily(el);
  const extraFamilies = [];
  if (el?.type === ElementType.Glyph && el?.fontFamily) extraFamilies.push(String(el.fontFamily));
  const fontPairSettingsSig = JSON.stringify(getElementFontPairSettings(el) || {});
  const cacheKey = `${presetKey}|literal:${literalFamily}|literalCartouche:${literalCartoucheFamily}|settings:${fontPairSettingsSig}|extra:${extraFamilies.join('|')}`;
  vectorFontDebug("getSitelenRendererForElement", {
    elementId: el?.id || null,
    elementType: el?.type || null,
    presetKey,
    literalFamily,
    literalCartoucheFamily,
    quotedTextFontOption: el?.quotedTextFontOption || null,
    elementFontFamily: el?.fontFamily || null,
    extraFamilies,
    cacheKey,
    cacheHit: sitelenRendererInstancePromises.has(cacheKey)
  });
  if (!sitelenRendererInstancePromises.has(cacheKey)){
    sitelenRendererInstancePromises.set(cacheKey, (async () => {
      const SitelenRenderer = await ensureSitelenRendererModule();
      await waitForRenderPresetFonts(presetKey, Math.max(16, Number(el?.fontSize ?? 44)), literalFamily, [literalCartoucheFamily, ...extraFamilies]);
      return SitelenRenderer.create(buildRendererInitConfigForElement(el));
    })());
  }
  return sitelenRendererInstancePromises.get(cacheKey);
}

function tintRasterCanvasToColor(sourceCanvas, cssColor){
  if (!sourceCanvas) return sourceCanvas;
  const fill = rgbaOrHexToHex(cssColor || '#111111', '#111111');
  const out = document.createElement('canvas');
  out.width = Math.max(1, sourceCanvas.width || 1);
  out.height = Math.max(1, sourceCanvas.height || 1);
  const octx = out.getContext('2d', { alpha: true });
  octx.clearRect(0, 0, out.width, out.height);
  octx.drawImage(sourceCanvas, 0, 0);
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = fill;
  octx.fillRect(0, 0, out.width, out.height);
  octx.globalCompositeOperation = 'source-over';
  return out;
}


const SITELEN_BOUNDS_GUARD_VERSION = 47;

function sitelenBoundsGuardPx(el){
  // Keep exported sitelen vector output inside the element box. This mirrors the
  // layout-editor vector placement contract: renderer output gets symmetric
  // guard padding because some glyphs/cartouches have ink outside their advance box.
  const fontPx = Math.max(6, Number(el?.fontSize ?? 44));
  const haloPx = el?.haloEnabled
    ? Math.max(0, Number(el?.haloThickness ?? 0))
    : 0;
  const unknownTextPadPx = el?.ignoreUnknownText ? 0 : Math.max(2, Math.ceil(fontPx * 0.04));
  return Math.max(16, Math.ceil(fontPx * 0.30 + haloPx + unknownTextPadPx + 4));
}

function makeGuardedSitelenCanvas(sourceCanvas, guardPx){
  const src = sourceCanvas || document.createElement('canvas');
  const guard = Math.max(0, Math.ceil(Number(guardPx) || 0));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.ceil(Number(src.width || 0) + guard * 2));
  out.height = Math.max(1, Math.ceil(Number(src.height || 0) + guard * 2));
  const octx = out.getContext('2d', { alpha: true });
  octx.clearRect(0, 0, out.width, out.height);
  if (src.width > 0 && src.height > 0) octx.drawImage(src, guard, guard);
  return out;
}

function guardedSitelenViewBox(viewBox, el){
  const fallbackW = Math.max(1, Number(el?.sitelen?.sourceNaturalW ?? el?.sitelen?.origW ?? el?.w ?? 1));
  const fallbackH = Math.max(1, Number(el?.sitelen?.sourceNaturalH ?? el?.sitelen?.origH ?? el?.h ?? 1));
  const vb = parseSvgViewBoxString(viewBox, fallbackW, fallbackH);
  const guard = Math.max(0, Number(el?.sitelen?.boundsGuardPx ?? sitelenBoundsGuardPx(el)) || 0);
  return {
    x: vb.x - guard,
    y: vb.y - guard,
    w: vb.w + guard * 2,
    h: vb.h + guard * 2,
  };
}

function applySitelenAutoResizeAnchor(el, oldX, oldY, oldW, oldH, newW, newH, options = {}){
  const cx = Number(oldX) + Number(oldW) / 2;
  const cy = Number(oldY) + Number(oldH) / 2;
  const oldRight = Number(oldX) + Number(oldW);
  const align = String(el?.align || 'left').trim().toLowerCase();

  el.w = Math.max(8, Number(newW) || 8);
  el.h = Math.max(8, Number(newH) || 8);

  if (options.preserveCenter || getElementPreserveCenterOnAutoResize(el)) {
    el.x = cx - el.w / 2;
    el.y = cy - el.h / 2;
  } else if (align === 'right') {
    el.x = oldRight - el.w;
    el.y = oldY;
  } else if (align === 'center') {
    el.x = cx - el.w / 2;
    el.y = oldY;
  } else {
    el.x = oldX;
    el.y = oldY;
  }
}

function getElementRendererSignature(el){
  return JSON.stringify({
    text: String(el?.text ?? ''),
    cartouchePageMapRevision,
    codepoint: String(el?.codepoint ?? ''),
    align: String(el?.align ?? 'left'),
    spacingPreset: getElementSpacingPreset(el),
    fontPx: Math.max(6, Number(el?.fontSize ?? 44)),
    color: String(el?.color ?? '#111111'),
    preset: getElementRenderFontPresetKey(el),
    fontPairSettings: getElementFontPairSettings(el),
    fontFamily: (el?.type === ElementType.Sitelen) ? '' : String(el?.fontFamily ?? ''),
    quotedTextFontOption: (el?.type === ElementType.Sitelen) ? getElementQuotedTextFontOptionKey(el) : '',
    literalFamily: sitelenLiteralFontFamilyForElement(el),
    literalCartoucheFamily: (el?.type === ElementType.Sitelen) ? getElementLiteralCartoucheFontFamily(el) : '',
    haloEnabled: !!el?.haloEnabled,
    haloColor: rgbaOrHexToHex(el?.haloColor, '#FFFFFF'),
    haloMode: String(el?.haloThicknessMode ?? 'auto'),
    haloThickness: Number(el?.haloThickness ?? 0),
    ignoreUnknownText: !!el?.ignoreUnknownText,
    abbreviateNumericCartouches: !!(el?.type === ElementType.Sitelen && getElementAbbreviateNumericCartouches(el)),
    preserveCenterOnAutoResize: !!getElementPreserveCenterOnAutoResize(el),
    sitelenBoundsGuardVersion: (el?.type === ElementType.Sitelen) ? SITELEN_BOUNDS_GUARD_VERSION : 0
  });
}
async function rebuildSitelenRasterWithRenderer(el, opts = {}){
  if (!el || el.type !== ElementType.Sitelen) return null;
  const options = Object.assign({ preserveCenter: false }, opts || {});
  const sig = getElementRendererSignature(el);
  const existing = sitelenCache.get(el.id);
  if (existing && existing.sig === sig && existing.canvas) return existing;

  const hasInsertAnchor =
    !!el.__lockInsertAnchor &&
    Number.isFinite(el.__insertAnchorX) &&
    Number.isFinite(el.__insertAnchorY);

  const jobKey =
    `${el.id}|${sig}|${options.preserveCenter ? 1 : 0}|${options.preserveTopLeft ? 1 : 0}|${options.fixedBox ? 1 : 0}|${hasInsertAnchor ? 1 : 0}`;

  if (sitelenRasterJobs.has(jobKey)) return sitelenRasterJobs.get(jobKey);

  const job = (async () => {
    const oldX = el.x;
    const oldY = el.y;
    const oldW = Number(el.w || 8);
    const oldH = Number(el.h || 8);

    const anchorX = Number(el.__insertAnchorX);
    const anchorY = Number(el.__insertAnchorY);

    const renderer = await getSitelenRendererForElement(el);
    const result = await renderer.renderTextToNewCanvas(
      Object.assign(
        { input: prepareSitelenInputWithActiveCartoucheDb(String(el.text ?? '')) },
        buildRendererCallConfigForElement(el)
      )
    );

    const rawCanvas = result?.canvas || document.createElement('canvas');
    const guardPx = sitelenBoundsGuardPx(el);
    const canvas = makeGuardedSitelenCanvas(rawCanvas, guardPx);
    const entry = {
      sig,
      canvas,
      rawCanvas,
      guardPx,
      sourceNaturalW: rawCanvas.width || 8,
      sourceNaturalH: rawCanvas.height || 8,
      naturalW: canvas.width || 8,
      naturalH: canvas.height || 8
    };

    if (!el.sitelen || typeof el.sitelen !== 'object') el.sitelen = {};
    el.sitelen.boundsGuardVersion = SITELEN_BOUNDS_GUARD_VERSION;
    el.sitelen.boundsGuardPx = guardPx;
    el.sitelen.sourceNaturalW = entry.sourceNaturalW;
    el.sitelen.sourceNaturalH = entry.sourceNaturalH;
    el.sitelen.naturalW = entry.naturalW;
    el.sitelen.naturalH = entry.naturalH;
    el.sitelen.origW = entry.naturalW;
    el.sitelen.origH = entry.naturalH;

    const newW = Math.max(8, entry.naturalW);
    const newH = Math.max(8, entry.naturalH);

    if (!options.fixedBox) {
      if (hasInsertAnchor) {
        el.w = newW;
        el.h = newH;
        el.x = anchorX;
        el.y = anchorY;
        delete el.__insertAnchorX;
        delete el.__insertAnchorY;
        delete el.__lockInsertAnchor;
      } else if (options.preserveTopLeft) {
        el.w = newW;
        el.h = newH;
        el.x = oldX;
        el.y = oldY;
      } else {
        applySitelenAutoResizeAnchor(el, oldX, oldY, oldW, oldH, newW, newH, options);
      }
    } else {
      // Fixed box mode: the user-defined element box is the placement box.
      el.x = oldX;
      el.y = oldY;
      el.w = oldW;
      el.h = oldH;
      if (hasInsertAnchor) {
        delete el.__insertAnchorX;
        delete el.__insertAnchorY;
        delete el.__lockInsertAnchor;
      }
    }

    sitelenCache.set(el.id, entry);
    scheduleAutosave();
    if (!sceneHydrating) render();
    return entry;
  })().finally(() => sitelenRasterJobs.delete(jobKey));

  sitelenRasterJobs.set(jobKey, job);
  return job;
}
function queueSitelenRasterRebuild(el, opts = {}){
  rebuildSitelenRasterWithRenderer(el, opts).catch((err) => console.warn('Sitelen raster rebuild failed:', err));
}
async function rebuildGlyphRasterWithRenderer(el){
  if (!el || el.type !== ElementType.Glyph) return null;
  const sig = getElementRendererSignature(el);
  const existing = glyphCache.get(el.id);
  if (existing && existing.sig === sig && existing.canvas) return existing;
  const jobKey = `${el.id}|${sig}`;
  if (glyphRasterJobs.has(jobKey)) return glyphRasterJobs.get(jobKey);
  const job = (async () => {
    const renderer = await getSitelenRendererForElement(el);
    const cp = parseCodepointInput(el.codepoint);
    const glyphFontFamily = String(getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT);
    const lines = [[{ kind: 'rawUcsur', cps: (typeof cp === 'number') ? [cp] : [0x003F], fontFamily: glyphFontFamily }]];
    const result = await renderer.renderUcsurToNewCanvas(Object.assign({ lines }, buildRendererCallConfigForElement(el)));
    const rawCanvas = result?.canvas || document.createElement('canvas');
    const canvas = tintRasterCanvasToColor(rawCanvas, el?.color || '#111111');
    const entry = { sig, canvas, naturalW: canvas.width || 8, naturalH: canvas.height || 8 };
    glyphCache.set(el.id, entry);
    if (!sceneHydrating) render();
    return entry;
  })().finally(() => glyphRasterJobs.delete(jobKey));
  glyphRasterJobs.set(jobKey, job);
  return job;
}
function queueGlyphRasterRebuild(el){
  rebuildGlyphRasterWithRenderer(el).catch((err) => console.warn('Glyph raster rebuild failed:', err));
}
async function awaitAllRendererRastersReady(){
  const jobs = [
    ...Array.from(sitelenRasterJobs.values()), 
    ...Array.from(glyphRasterJobs.values())
  ];
  if (jobs.length) await Promise.allSettled(jobs);
}

/* ============================================================
   WORDS / UCSUR (your provided set)
   ============================================================ */
const WORD_TO_UCSUR_CP = {
  "nanpa": 0xF193D,
  "esun":  0xF190B,
  "en":    0xF190A,
  "e":     0xF1909,
  "nasa":  0xF193E,
 
  "nena":  0xF1940,
  "o":     0xF1944,
  "kulupu":0xF191F,
  "ijo":   0xF190C,
  "wan":   0xF1973,
  "tu":    0xF196E,
  "sijelo":0xF195B,
  "awen":  0xF1908,
  "luka":  0xF192D,
  "utala": 0xF1971,
  "mun":   0xF193A,
  "pipi":  0xF1951,
  "jo":    0xF1913,

  "a": 0xF1900,
  "akesi": 0xF1901,
  "ala": 0xF1902,
  "alasa": 0xF1903,
  "ale": 0xF1904,
  "ali": 0xF1904,
  "anpa": 0xF1905,
  "ante": 0xF1906,
  "anu": 0xF1907,
  "ike": 0xF190D,
  "ilo": 0xF190E,
  "insa": 0xF190F,
  "jaki": 0xF1910,
  "jan": 0xF1911,
  "jelo": 0xF1912,
  "kala": 0xF1914,
  "kalama": 0xF1915,
  "kama": 0xF1916,
  "kasi": 0xF1917,
  "ken": 0xF1918,
  "kepeken": 0xF1919,
  "kili": 0xF191A,
  "kiwen": 0xF191B,
  "ko": 0xF191C,
  "kon": 0xF191D,
  "kule": 0xF191E,
  "kute": 0xF1920,
  "la": 0xF1921,
  "lape": 0xF1922,
  "laso": 0xF1923,
  "lawa": 0xF1924,
  "len": 0xF1925,
  "lete": 0xF1926,
  "li": 0xF1927,
  "lili": 0xF1928,
  "linja": 0xF1929,
  "lipu": 0xF192A,
  "loje": 0xF192B,
  "lon": 0xF192C,
  "lukin": 0xF192E,
  "lupa": 0xF192F,
  "ma": 0xF1930,
  "mama": 0xF1931,
  "mani": 0xF1932,
  "meli": 0xF1933,
  "mi": 0xF1934,
  "mije": 0xF1935,
  "moku": 0xF1936,
  "moli": 0xF1937,
  "monsi": 0xF1938,
  "mu": 0xF1939,
  "musi": 0xF193B,
  "mute": 0xF193C,
  "nasin": 0xF193F,
  "nimi": 0xF1942,
  "noka": 0xF1943,
  "olin": 0xF1945,
  "ona": 0xF1946,
  "open": 0xF1947,
  "pakala": 0xF1948,
  "pali": 0xF1949,
  "palisa": 0xF194A,
  "pan":    0xF194B,
  "pana":   0xF194C,
  "pi":     0xF194D,
  "pilin":  0xF194E,
  "pimeja": 0xF194F,
  "pini": 0xF1950,
  "poka": 0xF1952,
  "poki": 0xF1953,
  "pona": 0xF1954,
  "pu": 0xF1955,
  "sama": 0xF1956,
  "seli": 0xF1957,
  "selo": 0xF1958,
  "seme": 0xF1959,

  "sike": 0xF195C,
  "sin": 0xF195D,
  "sina": 0xF195E,
  "sinpin": 0xF195F,
  "sitelen": 0xF1960,
  "sona": 0xF1961,
  "soweli": 0xF1962,
  "suli": 0xF1963,
  "suno": 0xF1964,
  "supa": 0xF1965,
  "suwi": 0xF1966,
  "tan": 0xF1967,
  "taso": 0xF1968,
  "tawa": 0xF1969,
  "telo": 0xF196A,
  "tenpo": 0xF196B,
  "toki": 0xF196C,
  "tomo": 0xF196D,
  "unpa": 0xF196F,
  "uta": 0xF1970,
  "walo": 0xF1972,
  "waso": 0xF1974,
  "wawa": 0xF1975,
  "weka": 0xF1976,
  "wile": 0xF1977,
  "namako": 0xF1978,
  "kin": 0xF1979,
  "oko": 0xF197A,
  "kipisi": 0xF197B,
  "leko": 0xF197C,
  "monsuta": 0xF197D,
  "tonsi": 0xF197E,
  "jasima": 0xF197F,
  "kijetesantakalu": 0xF1980,
  "soko": 0xF1981,
  "meso": 0xF1982,
  "epiku": 0xF1983,
 
  "lanpan": 0xF1985,
  "n": 0xF1986,
  "misikeke": 0xF1987,
  "ku": 0xF1988,

  "majuna": 0xF19A2,
  "su": 0xF19A6,
  "linluwi":0xF19A4,

   "ni":    0xF1941,

  "sewi": 0xF195A,

           "sewi^": 0xF198C,
  "ni>": 0xF198B,
      "ni^": 0xF198A,
      "ni<": 0xF1989


};// "kokosila": 0xF1984,


function migrateLegacyImagePayloadToAssetId(el){
  if (!el || el.type !== ElementType.Image) return;

  if (!el.image || typeof el.image !== "object") return;
  if (el.image.assetId) return; // already modern

  // Accept either legacy formats:
  //  1) { dataUrl: "data:image/png;base64,..." }
  //  2) { mime: "image/png", b64: "..." }
  let dataUrl = "";

  if (el.image.dataUrl && String(el.image.dataUrl).startsWith("data:")){
    dataUrl = String(el.image.dataUrl);
  } else if (el.image.mime && el.image.b64){
    dataUrl = `data:${String(el.image.mime)};base64,${String(el.image.b64)}`;
  }

  if (!dataUrl) return;

  const assetId = addImageAssetFromDataUrl(dataUrl);
  el.image.assetId = assetId;

  // Remove legacy fields so history snapshots and future exports don't keep base64 in-scene
  delete el.image.b64;
  delete el.image.mime;
  delete el.image.dataUrl;
}

function sceneJsonHasAnyHaloFields(rawScene){
  if (!rawScene || typeof rawScene !== "object") return false;

  const st = rawScene.stage;
  const stageHasHalo =
    st && typeof st === "object" && (
      ("defaultHaloEnabled" in st) ||
      ("defaultHaloColor" in st) ||
      ("defaultHaloThicknessPx" in st) ||
      ("defaultHaloThicknessMode" in st)
    );

  if (stageHasHalo) return true;

  const els = rawScene.elements;
  if (!Array.isArray(els)) return false;

  for (const el of els){
    if (!el || typeof el !== "object") continue;
    if (
      ("haloEnabled" in el) ||
      ("haloColor" in el) ||
      ("haloThickness" in el) ||
      ("haloThicknessMode" in el)
    ){
      return true;
    }
  }
  return false;
}

  // CHANGE HERE: normalize imported scenes (defaults + backwards compat)
function normalizeScene(parsed){
  const out = (parsed && typeof parsed === "object") ? parsed : {};

  out.meta = out.meta || {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  out.stage = Object.assign({
    w: DEFAULTS.stageW,
    h: DEFAULTS.stageH,
    showGrid: DEFAULTS.showGrid,
    gridSize: DEFAULTS.gridSize,
    snapGrid: DEFAULTS.snapGrid,
    snapObjects: DEFAULTS.snapObjects,
    snapTol: DEFAULTS.snapTol,

    // NEW
    bg: DEFAULTS.stageBg,
    exportStageBackground: DEFAULTS.exportStageBackground,
    defaultRenderFontPreset: DEFAULTS.defaultRenderFontPreset,
    defaultTextFontOption: DEFAULTS.defaultTextFontOption,
    defaultAbbreviateNumericCartouches: DEFAULTS.defaultAbbreviateNumericCartouches,
    defaultPreserveCenterOnAutoResize: DEFAULTS.defaultPreserveCenterOnAutoResize,
    defaultSpacingPreset: DEFAULTS.defaultSpacingPreset,
    defaultTextColor: DEFAULTS.defaultTextColor,
    defaultFill: DEFAULTS.defaultFill,
    defaultFillEnabled: DEFAULTS.defaultFillEnabled,
    defaultStroke: DEFAULTS.defaultStroke,
    defaultStrokeW: DEFAULTS.defaultStrokeW,
    // NEW: halo defaults
    defaultHaloEnabled: DEFAULTS.defaultHaloEnabled,
    defaultHaloColor: DEFAULTS.defaultHaloColor,
    defaultHaloThicknessPx: DEFAULTS.defaultHaloThicknessPx,
    defaultHaloThicknessMode: DEFAULTS.defaultHaloThicknessMode,
    defaultIgnoreUnknownText: DEFAULTS.defaultIgnoreUnknownText,

    // NEW: background image (scene property)
    bgImgEnabled: DEFAULTS.bgImgEnabled,
    bgImgAssetId: DEFAULTS.bgImgAssetId,
    bgImgKeepAspect: DEFAULTS.bgImgKeepAspect,
    bgImgStretch: DEFAULTS.bgImgStretch,
    vectorDisplayOffsets: DEFAULTS.vectorDisplayOffsets,
  }, out.stage || {});

  if (!out.stage.vectorDisplayOffsets || typeof out.stage.vectorDisplayOffsets !== "object" || Array.isArray(out.stage.vectorDisplayOffsets)) {
    out.stage.vectorDisplayOffsets = {};
  }

  // Legacy import behavior: if the JSON contains no halo fields anywhere,
  // force scene default halo OFF so old files don't unexpectedly inherit halo-on defaults.
  if (!sceneJsonHasAnyHaloFields(parsed)) {
    out.stage.defaultHaloEnabled = false;
  }

  if (!("defaultFillEnabled" in out.stage)) out.stage.defaultFillEnabled = true;
  if (!("exportStageBackground" in out.stage)) out.stage.exportStageBackground = false;


  // NEW: background image defaults on legacy import
  if (typeof out.stage.bgImgEnabled !== "boolean") out.stage.bgImgEnabled = false;
  if (typeof out.stage.bgImgKeepAspect !== "boolean") out.stage.bgImgKeepAspect = true;
  if (typeof out.stage.bgImgStretch !== "boolean") out.stage.bgImgStretch = false;

  if (out.stage.bgImgAssetId != null) out.stage.bgImgAssetId = String(out.stage.bgImgAssetId);
  out.stage.defaultRenderFontPreset = normalizeLegacyRenderFontPresetKey(out.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
  out.stage.defaultTextFontOption = normalizeLegacyTextFontOptionKey(out.stage.defaultTextFontOption || DEFAULTS.defaultTextFontOption, out.stage.defaultRenderFontPreset);
  out.stage.defaultSpacingPreset = normalizeSpacingPreset(out.stage.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);
  out.stage.defaultAbbreviateNumericCartouches = !!(out.stage.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches);
  out.stage.defaultPreserveCenterOnAutoResize = !!(out.stage.defaultPreserveCenterOnAutoResize ?? DEFAULTS.defaultPreserveCenterOnAutoResize);
  out.stage.defaultIgnoreUnknownText = !!(out.stage.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText);

  if (!out.stage.bgImgAssetId){
    out.stage.bgImgAssetId = null;
    out.stage.bgImgEnabled = false;
  }

  out.view = Object.assign({
    zoom: DEFAULTS.viewZoom,
    offsetX: 0,
    offsetY: 0,
  }, out.view || {});

  out.elements = Array.isArray(out.elements) ? out.elements : [];

  for (const el of out.elements){
    // Required-ish fields
    el.id = String(el.id || uid("el"));
    el.type = String(el.type || "");

    el.x = Number.isFinite(el.x) ? el.x : 0;
    el.y = Number.isFinite(el.y) ? el.y : 0;
    el.w = Number.isFinite(el.w) ? Math.max(8, el.w) : 240;
    el.h = Number.isFinite(el.h) ? Math.max(8, el.h) : 120;

    el.rotationDeg = Number.isFinite(el.rotationDeg) ? el.rotationDeg : 0;
    el.opacity = Number.isFinite(el.opacity) ? clamp(el.opacity, 0, 1) : 1;

    el.fill = rgbaOrHexToHex(el.fill || "#FFFFFF", "#FFFFFF");

    if (typeof el.fillEnabled !== "boolean") el.fillEnabled = false;

    el.stroke = rgbaOrHexToHex(el.stroke || "#111111", "#111111");
  
    const defSW = Number.isFinite(out.stage?.defaultStrokeW) ? out.stage.defaultStrokeW : 2;
    if (!Number.isFinite(el.strokeW)) {
      // Text-like elements default to no stroke; shapes default to the stage's stroke width.
      el.strokeW = (el.type === ElementType.Text || el.type === ElementType.Sitelen || el.type === ElementType.Glyph) ? 0 : defSW;
    }
    el.strokeW = Number.isFinite(el.strokeW) ? Math.max(0, el.strokeW) : 0;

    // NEW: halo defaults + backward compatibility
    ensureHaloFields(el, out.stage);

    el.groupId = el.groupId ?? null;

    // CHANGE HERE: lock flag (default false on import if missing)
    el.isLocked = !!el.isLocked;

    // NEW: default false on import if missing (Text + Glyph only)
    if (el.type === ElementType.Text || el.type === ElementType.Glyph){
      el.scaleFontWithBox = (el.scaleFontWithBox == null) ? false : !!el.scaleFontWithBox;
    }

    if (el.type === ElementType.Text || el.type === ElementType.Sitelen || el.type === ElementType.Glyph){
      el.preserveCenterOnAutoResize = (el.preserveCenterOnAutoResize == null) ? false : !!el.preserveCenterOnAutoResize;
    }


    // Remove transient drag fields if present in older exports
    delete el._startX; delete el._startY;
    delete el._startW; delete el._startH;
    delete el._startRot; delete el._startFontSize;
    delete el._startRadius;

    // Type-specific defaults
    if (el.type === ElementType.Text || el.type === ElementType.Sitelen){
      el.text = String(el.text ?? "");
      el.renderFontPreset = normalizeLegacyRenderFontPresetKey(
        el.renderFontPreset || el.fontFamily || out.stage?.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
      );
      el.fontFamily = normalizeLegacyTextFontOptionKey(
        el.fontFamily || out.stage?.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
        el.renderFontPreset
      );
      el.fontSize = Number.isFinite(el.fontSize) ? el.fontSize : (el.type === ElementType.Sitelen ? 44 : 28);
      el.align = el.align || "left";
      const elColor = rgbaOrHexToHex(el.color ||  "#111111", "#111111");

      el.color = elColor;
      el.lineHeight = Number.isFinite(el.lineHeight) ? el.lineHeight : 1.15;

      if (el.type === ElementType.Sitelen){
        el.keepAspect = (el.keepAspect == null) ? true : !!el.keepAspect;
        el.ignoreUnknownText = (el.ignoreUnknownText == null)
          ? !!(out.stage?.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText)
          : !!el.ignoreUnknownText;
        el.abbreviateNumericCartouches = (el.abbreviateNumericCartouches == null) ? false : !!el.abbreviateNumericCartouches;
        el.spacingPreset = normalizeSpacingPreset(el.spacingPreset ?? out.stage?.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);
        el.quotedTextFontOption = normalizeValidQuotedTextFontOptionForSitelen(
          el.quotedTextFontOption || el.fontFamily || out.stage?.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
          el.renderFontPreset
        );
        el.fontFamily = el.quotedTextFontOption;
        if (!el.sitelen || typeof el.sitelen !== "object") el.sitelen = {};

        // Layout-editor-vector JSON already stores vector-native placement boxes
        // and guarded sitelen metrics. When importing such a page into scrapbook,
        // preserve the existing x/y/w/h exactly instead of recomputing the box
        // through scrapbook auto-resize rules during hydration.
        const isLayoutVectorNativeScene =
          out?.meta?.editor === VECTOR_SCENE_EDITOR_ID &&
          (out?.meta?.vectorBoxModel === VECTOR_BOX_MODEL_VERSION || out?.meta?.vectorPlacementModel === VECTOR_BOX_MODEL_VERSION);
        if (isLayoutVectorNativeScene && !el.sitelenResizeAnchor && el.vectorPlacementMode) {
          el.sitelenResizeAnchor = "fixed";
        }

        // Migrate sitelenResizeAnchor for existing elements that predate this property.
        // If already set, leave it alone.
        if (!el.sitelenResizeAnchor){
          // keepAspect off → was free-drag mode → treat as "fixed"
          // keepAspect on  → was auto-resize mode → default to "topLeft"
          el.sitelenResizeAnchor = el.keepAspect ? "topLeft" : "fixed";
        }
        // For normal scrapbook-created sitelen elements, the resize anchor controls
        // whether the element keeps aspect. For imported layout-editor-vector
        // scenes, keepAspect is part of the saved vector placement contract and
        // must not be rewritten just because we use fixedBox hydration.
        if (!isLayoutVectorNativeScene) {
          el.keepAspect = (el.sitelenResizeAnchor !== "fixed");
        }
      }
    }

    if (el.type === ElementType.Glyph){
      el.codepoint = String(el.codepoint ?? "U+F1934");
      el.renderFontPreset = normalizeLegacyRenderFontPresetKey(
        el.renderFontPreset || el.fontFamily || out.stage?.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
      );
      el.fontFamily = TEXT_FONT_OPTION_SITELEN;
      el.fontSize = Number.isFinite(el.fontSize) ? el.fontSize : 92;
      el.align = el.align || "center";
      el.color = rgbaOrHexToHex(el.color || "#111111", "#111111");
    }

    if (el.type === ElementType.Rect){
      el.radius = Number.isFinite(el.radius) ? Math.max(0, el.radius) : 18;
    }

    if (el.type === ElementType.Image){
      // keep as-is; may be null
      el.image = el.image ?? null;

      // CHANGE HERE: default keepAspect true for old JSON
      el.keepAspect = (el.keepAspect == null) ? true : !!el.keepAspect;

      // CHANGE HERE: if old JSON has an embedded image but no origW/origH, capture current box as “original”
      if (el.image && typeof el.image === "object"){
        if (!Number.isFinite(el.image.origW)) el.image.origW = el.w;
        if (!Number.isFinite(el.image.origH)) el.image.origH = el.h;
      }

       // ADD THIS: color-key flag defaults false if missing
      el.colorKeyTransparent = (el.colorKeyTransparent == null) ? false : !!el.colorKeyTransparent;
    }

    if (el.type === ElementType.Audio){
      el.audio = (el.audio && typeof el.audio === "object") ? el.audio : {};
      el.posterAssetId = el.posterAssetId ? String(el.posterAssetId) : null;
      el.sourceUrl = String(el.sourceUrl || "");
      el.title = String(el.title || (el.audio && el.audio.origName) || "");
      el.searchTag = String(el.searchTag || "");
      el.audio.playbackPositionSec = Math.max(0, Number(el.audio.playbackPositionSec || 0) || 0);
      el.audio.muted = !!el.audio.muted;
      el.audio.duration = Math.max(0, Number(el.audio.duration || 0) || 0);
      // exportVisible: false by default for audio (hidden in PNG export)
      el.exportVisible = (el.exportVisible == null) ? false : !!el.exportVisible;
    }

    if (el.type === ElementType.Video){
      el.video = (el.video && typeof el.video === "object") ? el.video : null;
      el.posterAssetId = el.posterAssetId ? String(el.posterAssetId) : null;
      el.sourceUrl = String(el.sourceUrl || "");
      el.title = String(el.title || (el.video && el.video.origName) || "");
      el.searchTag = String(el.searchTag || "");
      el.keepAspect = (el.keepAspect == null) ? true : !!el.keepAspect;
      el.video.playbackPositionSec = Math.max(0, Number(el.video.playbackPositionSec || 0) || 0);
      el.video.muted = !!el.video.muted;
      // exportVisible: true by default for video (poster shown in PNG export)
      el.exportVisible = (el.exportVisible == null) ? true : !!el.exportVisible;
    }

    if (el.type === ElementType.Url){
      el.url = (el.url && typeof el.url === "object") ? el.url : { href: String(el.href || ""), detectedKind: "link", title: "", posterAssetId: null, posterRemoteHref: "", mimeHint: "", posterAttempted: false };
      el.url.href = String(el.url.href || "");
      const detected = detectUrlKindFromHref(el.url.href || "");
      el.url.detectedKind = String(el.url.detectedKind || detected.kind || "link");
      el.url.title = String(el.url.title || "");
      el.url.posterAssetId = el.url.posterAssetId ? String(el.url.posterAssetId) : null;
      el.url.posterRemoteHref = String(el.url.posterRemoteHref || "");
      el.url.mimeHint = String(el.url.mimeHint || detected.mimeHint || "");
      el.url.posterAttempted = !!el.url.posterAttempted;
      el.keepAspect = (el.keepAspect == null) ? true : !!el.keepAspect;
      el.url.playbackPositionSec = Math.max(0, Number(el.url.playbackPositionSec || 0) || 0);
      el.url.muted = !!el.url.muted;
      el.searchTag = String(el.searchTag || "");
      // exportVisible: true by default for url (poster/thumbnail shown in PNG export)
      el.exportVisible = (el.exportVisible == null) ? true : !!el.exportVisible;
    }

  }

  for (const el of out.elements){
  migrateLegacyImagePayloadToAssetId(el);
}


out.groups = (out.groups && typeof out.groups === "object") ? out.groups : {};

// Ensure group records have defaults
for (const [gid, g] of Object.entries(out.groups)){
  if (!g || typeof g !== "object") out.groups[gid] = { id: gid };
  if (!out.groups[gid].id) out.groups[gid].id = gid;
  if (!out.groups[gid].createdAt) out.groups[gid].createdAt = new Date().toISOString();
  if (!out.groups[gid].foreground) out.groups[gid].foreground = "#111111";
}

return out;

}

  const HANDLE = Object.freeze({
    None: "none",
    Move: "move",
    Marquee: "marquee",
    ResizeNW: "resize_nw",
    ResizeN: "resize_n",
    ResizeNE: "resize_ne",
    ResizeE: "resize_e",
    ResizeSE: "resize_se",
    ResizeS: "resize_s",
    ResizeSW: "resize_sw",
    ResizeW: "resize_w",
    Rotate: "rotate",
    Pan: "pan",
  });



function clamp(n, lo, hi){
  return Math.min(hi, Math.max(lo, n));
}





  function roundTo(v, step){ return Math.round(v / step) * step; }
  function rad(deg){ return deg * Math.PI / 180; }
  function deg(r){ return r * 180 / Math.PI; }

  // CHANGE HERE: build a correct CSS font-family string for canvas
function cssFontFamily(family){
  const f = String(family ?? "").trim();
  if (!f) return `"PatrickHand", system-ui, sans-serif`;

  // If user already supplied a full family list (contains comma), use as-is.
  if (f.includes(",")) return f;

  // If already quoted, use as-is.
  if ((f.startsWith('"') && f.endsWith('"')) || (f.startsWith("'") && f.endsWith("'"))) return f;

  // Otherwise quote a single family name safely.
  return `"${f}"`;
}

function sitelenLiteralFontFamilyForElement(el){
  return getElementResolvedTextFontFamily(el);
}

function sitelenLiteralFontAlignmentForElement(el){
  // Use the element’s align to determine line alignment
  // Fall back to left if empty.
  const f = String(el.align ?? "").trim();
  return f ? f : "left";
}


  function uid(prefix="id"){
    return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function deepClone(obj){
  try{
    if (typeof structuredClone === "function") return structuredClone(obj);
  }catch(_){}
  return JSON.parse(JSON.stringify(obj));
}

  function toBase64FromArrayBuffer(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i=0; i<bytes.length; i+=CHUNK){
      bin += String.fromCharCode(...bytes.subarray(i, i+CHUNK));
    }
    return btoa(bin);
  }

  function arrayBufferFromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }


// ---------------------------------------------------------------------------
// Asset Management (dedupe + keep base64 out of history snapshots)
// ---------------------------------------------------------------------------
const Assets = {
  byId: new Map(),   // id -> asset
  byHash: new Map()  // hash -> id
};

function makeAssetId(prefix="img"){
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// Fast-ish hash for dataUrls (not cryptographic; good for dedupe)
function hashStringFNV1a(str){
  let h = 0x811c9dc5;
  for (let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function addImageAssetFromDataUrl(dataUrl){
  const hash = hashStringFNV1a(dataUrl);
  const existingId = Assets.byHash.get(hash);
  if (existingId) return existingId;

  const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

  const id = makeAssetId("img");
  const asset = { id, kind: "image", dataUrl, mime, hash };
  Assets.byId.set(id, asset);
  Assets.byHash.set(hash, id);
  return id;
}

function getImageAssetDataUrl(assetId){
  const a = Assets.byId.get(assetId);
  return (a && a.kind === "image") ? a.dataUrl : null;
}

function addBinaryAssetFromDataUrl(kind, dataUrl){
  const hash = hashStringFNV1a(`${kind}::${dataUrl}`);
  const existingId = Assets.byHash.get(hash);
  if (existingId) return existingId;
  const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const id = makeAssetId(kind || "asset");
  const asset = { id, kind: String(kind || "asset"), dataUrl, mime, hash };
  Assets.byId.set(id, asset);
  Assets.byHash.set(hash, id);
  return id;
}

function getAssetDataUrl(assetId){
  const a = Assets.byId.get(String(assetId || ""));
  return a ? String(a.dataUrl || "") : null;
}

// NEW: turn a picked file into a data URL using your existing base64 helper
async function dataUrlFromBlob(blob){
  const ab = await blob.arrayBuffer();
  const b64 = toBase64FromArrayBuffer(ab);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

// NEW: persistence helpers
function serializeAssets(){
  return { byId: Array.from(Assets.byId.values()) };
}

function deserializeAssets(serialized){
  Assets.byId.clear();
  Assets.byHash.clear();
  if (!serialized) return;

  const list = Array.isArray(serialized.byId) ? serialized.byId
            : Array.isArray(serialized) ? serialized
            : [];

  for (const a of list){
    if (!a || typeof a !== "object") continue;
    // Accept all asset kinds: image, audio, video, etc.
    if (!a.id || !a.kind || !a.dataUrl) continue;

    const id = String(a.id);
    const dataUrl = String(a.dataUrl);
    const hash = String(a.hash || hashStringFNV1a(dataUrl));
    const mime = String(a.mime || "application/octet-stream");

    const asset = { id, kind: String(a.kind), dataUrl, mime, hash };
    Assets.byId.set(id, asset);
    Assets.byHash.set(hash, id);
  }
}






  function downloadBlob(blob, filename){
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function nowIso(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }





  /* ============================================================
     Scene model
     ============================================================ */
  const Scene = {
    meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    stage: {
      w: DEFAULTS.stageW,
      h: DEFAULTS.stageH,
      showGrid: DEFAULTS.showGrid,
      gridSize: DEFAULTS.gridSize,
      snapGrid: DEFAULTS.snapGrid,
      snapObjects: DEFAULTS.snapObjects,
      snapTol: DEFAULTS.snapTol,

      // NEW
      bg: DEFAULTS.stageBg,
      exportStageBackground: DEFAULTS.exportStageBackground,
      defaultRenderFontPreset: DEFAULTS.defaultRenderFontPreset,
      defaultTextFontOption: DEFAULTS.defaultTextFontOption,
      defaultAbbreviateNumericCartouches: DEFAULTS.defaultAbbreviateNumericCartouches,
      defaultPreserveCenterOnAutoResize: DEFAULTS.defaultPreserveCenterOnAutoResize,
      defaultSpacingPreset: DEFAULTS.defaultSpacingPreset,
      defaultTextColor: DEFAULTS.defaultTextColor,
      defaultFill: DEFAULTS.defaultFill,
      defaultStroke: DEFAULTS.defaultStroke,
      defaultStrokeW: DEFAULTS.defaultStrokeW,
      // NEW: halo defaults (apply to newly created elements)
      defaultHaloEnabled: DEFAULTS.defaultHaloEnabled,
      defaultHaloColor: DEFAULTS.defaultHaloColor,
      defaultHaloThicknessPx: DEFAULTS.defaultHaloThicknessPx,
      defaultHaloThicknessMode: DEFAULTS.defaultHaloThicknessMode,
      defaultIgnoreUnknownText: DEFAULTS.defaultIgnoreUnknownText,
    },
    view: {
      zoom: DEFAULTS.viewZoom,
      offsetX: 0,
      offsetY: 0,
    },
    elements: /** @type {any[]} */ ([]),
    groups: /** @type {Record<string, any>} */ ({}),
  };

  /* Each element:
     {
       id, type,
       x,y,w,h, rotationDeg,
       fill, stroke, strokeW, opacity,
       radius, // rect
       text, fontFamily, fontSize, align, color, lineHeight,
       codepoint, // glyph
       image: { mime, b64, naturalW, naturalH } // image
       groupId: string|null
     }
  */

  function defaultElementBase(type, x, y){

    return {
      id: uid("el"),
      type,
      x, y,
      w: 240,
      h: 120,
      rotationDeg: 0,
      opacity: 1.0,

        // NEW: pull defaults from stage
      fill: Scene.stage.defaultFill ?? DEFAULTS.defaultFill,
      fillEnabled : Scene.stage.defaultFillEnabled ?? DEFAULTS.defaultFillEnabled,
      stroke: Scene.stage.defaultStroke ?? DEFAULTS.defaultStroke,
      strokeW: Number.isFinite(Scene.stage.defaultStrokeW) ? Scene.stage.defaultStrokeW : DEFAULTS.defaultStrokeW,


      groupId: null,
      // CHANGE HERE: lock flag
      isLocked: false,
      // NEW: when true, bbox resize scales fontSize; when false, fontSize stays fixed
      scaleFontWithBox: false,
      preserveCenterOnAutoResize: getSceneDefaultPreserveCenterOnAutoResize(),

      // NEW: halo defaults (per-element; may be auto-recomputed when font changes)
      haloEnabled: !!(Scene.stage.defaultHaloEnabled ?? DEFAULTS.defaultHaloEnabled),
      haloColor: rgbaOrHexToHex(Scene.stage.defaultHaloColor ?? DEFAULTS.defaultHaloColor, "#FFFFFF"),
      haloThicknessMode: (Scene.stage.defaultHaloThicknessMode === "manual") ? "manual" : "auto",
      haloThickness: Number.isFinite(Scene.stage.defaultHaloThicknessPx) ? Scene.stage.defaultHaloThicknessPx : DEFAULTS.defaultHaloThicknessPx,
    };
  }

  function newTextElement(x,y){
    const el = defaultElementBase(ElementType.Text, x, y);
    el.w = 320; el.h = 140;
    el.text = tr("default_text_multiline");
    el.renderFontPreset = normalizeRenderFontPresetKey(Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
    el.fontFamily = normalizeTextFontOptionKeyForPreset(Scene.stage.defaultTextFontOption || DEFAULTS.defaultTextFontOption, el.renderFontPreset);
    el.fontSize = 28;
    el.align = "left";
   el.color = Scene.stage.defaultTextColor ?? DEFAULTS.defaultTextColor;
    el.lineHeight = 1.15;
//    el.fill = "rgba(255,255,255,0.0)"; // default: no background
    el.strokeW = 0;
    el.scaleFontWithBox = false; // NEW (explicit)
    el.preserveCenterOnAutoResize = getSceneDefaultPreserveCenterOnAutoResize();
    ensureHaloFields(el);
    return el;
  }

  function newSitelenElement(x,y){
    const el = defaultElementBase(ElementType.Sitelen, x, y);
    el.w = 420;
    el.h = 160;
    el.text = "toki&pona";
    el.renderFontPreset = normalizeRenderFontPresetKey(
      Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
    );
    // Sitelen's main font is controlled by renderFontPreset. Its normal
    // quoted-text font is separate and must default to the literal font, not to
    // active sitelen/cartouche aliases.
    el.quotedTextFontOption = getDefaultQuotedTextFontOptionForPreset(el.renderFontPreset);
    el.fontFamily = el.quotedTextFontOption;
    el.fontSize = 44;
    el.align = "left";
    el.color = Scene.stage.defaultTextColor ?? DEFAULTS.defaultTextColor;
    el.lineHeight = 1.05;
    el.strokeW = 0;
    el.keepAspect = true;
    el.ignoreUnknownText = !!(Scene.stage.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText);
    el.abbreviateNumericCartouches = getSceneDefaultAbbreviateNumericCartouches();
    el.preserveCenterOnAutoResize = getSceneDefaultPreserveCenterOnAutoResize();
    el.spacingPreset = getSceneDefaultSpacingPreset();
    el.sitelenResizeAnchor = el.preserveCenterOnAutoResize ? "centre" : "topLeft"; // new elements default to top-left anchor unless scene default preserves centre

    ensureHaloFields(el);

    // Keep the original click point as the permanent top-left anchor
    // for the very first raster rebuild.
    el.__insertAnchorX = x;
    el.__insertAnchorY = y;
    el.__lockInsertAnchor = true;

    updateSitelenLayout(el, { preserveCenter: false });
    return el;
  }

  function newGlyphElement(x,y){
    const el = defaultElementBase(ElementType.Glyph, x, y);
    el.w = 120; el.h = 120;
    el.codepoint = "U+F1934"; // default example (mi) – user can change
    el.renderFontPreset = normalizeRenderFontPresetKey(Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
    el.fontFamily = TEXT_FONT_OPTION_SITELEN;
    el.fontSize = 92;
    el.align = "center";
   el.color = Scene.stage.defaultTextColor ?? DEFAULTS.defaultTextColor;
//    el.fill = "rgba(255,255,255,0.0)";
    el.strokeW = 0;
    el.scaleFontWithBox = false; // NEW (explicit)
    el.preserveCenterOnAutoResize = getSceneDefaultPreserveCenterOnAutoResize();
    ensureHaloFields(el);
    return el;
  }

  function newRectElement(x,y){
    const el = defaultElementBase(ElementType.Rect, x, y);
    el.w = 260; el.h = 160;
    el.radius = 18;
   // el.fill = "rgba(255,255,255,0.65)";
    el.opacity = 1.0;
    ensureHaloFields(el);
    return el;
  }

function newImageElement(x,y){
  const el = defaultElementBase(ElementType.Image, x, y);
  el.w = 320; el.h = 220;
  el.fill = "#FFFFFF";
  el.image = null; // assigned after file pick
  el.keepAspect = true; // CHANGE HERE: default true
  // ADD THIS: default off
  el.colorKeyTransparent = false;
 // el.stroke = "rgba(17,17,17,0.35)";
 // el.strokeW = 2;
  return el;
}

function newAudioElement(x,y){
  const el = defaultElementBase(ElementType.Audio, x, y);
  el.w = 320; el.h = 96;
  el.fill = "#FFFFFF";
  el.audio = null;
  el.posterAssetId = null;
  el.sourceUrl = "";
  el.title = "";
  el.searchTag = "";
  el.exportVisible = false; // audio hidden in PNG export by default
  return el;
}

function newVideoElement(x,y){
  const el = defaultElementBase(ElementType.Video, x, y);
  el.w = 320; el.h = 220;
  el.fill = "#FFFFFF";
  el.video = null;
  el.posterAssetId = null;
  el.keepAspect = true;
  el.sourceUrl = "";
  el.title = "";
  el.searchTag = "";
  el.exportVisible = true; // video poster shown in PNG export by default
  return el;
}

function newUrlElement(x,y){
  const el = defaultElementBase(ElementType.Url, x, y);
  el.w = 320; el.h = 120;
  el.fill = "#FFFFFF";
  el.url = { href: '', detectedKind: 'link', title: '', posterAssetId: null, posterRemoteHref: '', mimeHint: '' };
  el.keepAspect = true;
  el.searchTag = "";
  el.exportVisible = true; // url thumbnail shown in PNG export by default
  return el;
}


  /* ============================================================
     IndexedDB
     ============================================================ */
  let dbPromise = null;

  function openDb(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function dbPut(key, value){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(key){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  let saveTimer = null;
  function scheduleAutosave(){
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try{
        Scene.meta.updatedAt = new Date().toISOString();

        await dbPut(DB_KEY, {
          scene: deepClone(Scene),
          assets: serializeAssets()
        });

        setStatus(tr("status_autosaved"));
      }catch(err){
        console.warn(err);
        setStatus(tr("status_autosave_failed"));
      }
    }, 350);
  }

  /* ============================================================
     Canvas setup and view transforms
     ============================================================ */
  const canvas = $("c");
  const ctx = canvas.getContext("2d");

  const wrap = $("canvasWrap");
  const hud = $("hud");

function setStatus(msg){
  const s = $("status");
  if (s) s.textContent = msg;
  const cs = $("compactStatus");
  if (cs) cs.textContent = msg;
  hud.textContent = msg;
}

const EXPORT_BUTTON_IDS = [
  'btnExportJson',
  'btnExportPng',
  'sbBtnExportDoc',
  'sbBtnExportAllPng',
  'sbBtnExportAllSvg',
  'sbBtnExportPrint',
  'sbBtnExportPdf'
];
let exportGuardToken = 0;
let exportGuardActive = false;

function applyExportGuardUi(){
  for (const id of EXPORT_BUTTON_IDS){
    const btn = $(id);
    if (btn) btn.disabled = !!exportGuardActive;
  }
  // Also lock/unlock the compact Export dropdown so it can't be opened mid-export
  const compactExportDetails = $('compactMenuExport');
  const compactExportSummary = compactExportDetails
    ? compactExportDetails.querySelector('summary')
    : null;
  if (compactExportDetails && compactExportSummary) {
    if (exportGuardActive) {
      compactExportDetails.removeAttribute('open'); // close if open
      compactExportSummary.style.pointerEvents = 'none';
      compactExportSummary.style.opacity = '0.55';
      compactExportSummary.style.cursor = 'not-allowed';
    } else {
      compactExportSummary.style.pointerEvents = '';
      compactExportSummary.style.opacity = '';
      compactExportSummary.style.cursor = '';
    }
  }
}

function clearExportGuard(){
  exportGuardActive = false;
  exportGuardToken += 1;
  applyExportGuardUi();
}

async function runExportGuarded(label, fn){
  if (exportGuardActive) return false;
  exportGuardActive = true;
  const myToken = ++exportGuardToken;

  // v31: document/page exports temporarily swap many page payloads through the
  // global Scene/Assets objects. Those swaps must never leak into the visible
  // live editor. Reuse the same atomic live-scene lock used by page navigation:
  // the current complete scene stays on screen until the export is finished.
  const atomicToken = beginAtomicLiveSceneUpdate();

  applyExportGuardUi();
  try {
    return await fn();
  } finally {
    endAtomicLiveSceneUpdate(atomicToken);

    // Do not rebuild/swap the live SVG here. Export is read-only from the
    // user's perspective, so the existing visible SVG should remain exactly as
    // it was before export. Redraw only the transparent interaction overlay
    // after the global Scene has been restored by export helpers.
    try { renderInteractionOverlay(); } catch (_) {}

    if (exportGuardActive && exportGuardToken === myToken){
      exportGuardActive = false;
      applyExportGuardUi();
    }
  }
}


  function resizeCanvasToDisplay(){
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width));
    const h = Math.max(2, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

//  window.addEventListener("resize", resizeCanvasToDisplay);
window.addEventListener("resize", () => render());

  function stageToScreen(pt){
    return {
      x: (pt.x + Scene.view.offsetX) * Scene.view.zoom,
      y: (pt.y + Scene.view.offsetY) * Scene.view.zoom,
    };
  }
  function screenToStage(pt){
    return {
      x: pt.x / Scene.view.zoom - Scene.view.offsetX,
      y: pt.y / Scene.view.zoom - Scene.view.offsetY,
    };
  }

function fitStageToView(options = {}){
  const opts = options || {};
  const rect = wrap.getBoundingClientRect();

  // CHANGE HERE: smaller pad, and anchor stage to top-left instead of centering
  const pad = 8;

  const vw = rect.width - pad * 2;
  const vh = rect.height - pad * 2;

  const sx = vw / Scene.stage.w;
  const sy = vh / Scene.stage.h;
  const z = clamp(Math.min(sx, sy), 0.1, 8);

  Scene.view.zoom = z;

  // CHANGE HERE: anchor stage origin at (pad, pad) in screen/CSS pixels
  Scene.view.offsetX = pad / z;
  Scene.view.offsetY = pad / z;

  if (opts.autosave !== false) scheduleAutosave();
  if (opts.renderNow !== false) render();
}


  /* ============================================================
     Image cache (for drawing)
     ============================================================ */
  const imageCache = new Map(); // el.id -> { img: HTMLImageElement, ready: bool }
  const remotePosterImageCache = new Map(); // href -> { img, ready }

  function invalidateImageCache(elId){
    imageCache.delete(elId);
  }

// Keyed cache for poster images on URL/Video elements (asset ID -> {img,ready,assetId})
const posterAssetImageCache = new Map();
const POSTER_IMAGE_DECODE_TIMEOUT_MS = 4000;
function ensureImageLoadedFromDataUrl(dataUrl, cacheKey){
  const clean = String(dataUrl || '').trim();
  if (!clean) return null;
  const key = String(cacheKey || clean);
  let entry = posterAssetImageCache.get(key);
  if (!entry){
    entry = { img: new Image(), ready: false, assetId: '', decodePromise: null };
    posterAssetImageCache.set(key, entry);
  }

  if (entry.assetId === clean){
    if (!entry.ready && entry.img && entry.img.complete && (entry.img.naturalWidth || entry.img.width || 0) > 0){
      entry.ready = true;
      entry.decodePromise = null;
    }
    if (entry.ready) return entry.img;
  }

  if (entry.assetId !== clean){
    entry.ready = false;
    entry.assetId = clean;
    entry.decodePromise = new Promise((resolve) => {
      let settled = false;
      const finish = (imgOrNull) => {
        if (settled) return;
        settled = true;
        entry.decodePromise = null;
        resolve(imgOrNull);
      };
      entry.img.onload = () => {
        entry.ready = true;
        render();
        finish(entry.img);
      };
      entry.img.onerror = () => {
        entry.ready = false;
        finish(null);
      };
      entry.img.src = clean;
      if (entry.img.complete && (entry.img.naturalWidth || entry.img.width || 0) > 0){
        entry.ready = true;
        finish(entry.img);
      }
    });
  }
  return entry.ready ? entry.img : null;
}
async function awaitImageLoadedFromDataUrl(dataUrl, cacheKey, timeoutMs = POSTER_IMAGE_DECODE_TIMEOUT_MS){
  const clean = String(dataUrl || '').trim();
  if (!clean) return null;
  const key = String(cacheKey || clean);
  const img = ensureImageLoadedFromDataUrl(clean, key);
  if (img) return img;
  const entry = posterAssetImageCache.get(key);
  if (!entry) return null;
  if (!entry.ready && entry.img && entry.img.complete && (entry.img.naturalWidth || entry.img.width || 0) > 0){
    entry.ready = true;
    entry.decodePromise = null;
    return entry.img;
  }
  if (entry.ready) return entry.img;
  if (!entry.decodePromise) return null;
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      if (!entry.ready && entry.img && entry.img.complete && (entry.img.naturalWidth || entry.img.width || 0) > 0){
        entry.ready = true;
      }
      resolve(entry.ready ? entry.img : null);
    }, Math.max(250, Number(timeoutMs) || POSTER_IMAGE_DECODE_TIMEOUT_MS));
  });
  return await Promise.race([entry.decodePromise, timeoutPromise]);
}
function ensureImageLoadedFromAssetId(assetId, cacheKey){
  if (!assetId) return null;
  const dataUrl = getImageAssetDataUrl(assetId);
  if (!dataUrl) return null;
  return ensureImageLoadedFromDataUrl(dataUrl, cacheKey || assetId);
}
async function awaitImageLoadedFromAssetId(assetId, cacheKey){
  if (!assetId) return null;
  const dataUrl = getImageAssetDataUrl(assetId);
  if (!dataUrl) return null;
  return await awaitImageLoadedFromDataUrl(dataUrl, cacheKey || assetId);
}

function ensureImageLoadedForElement(el){
  if (el.type !== ElementType.Image) return null;
  if (!el.image || typeof el.image !== "object") return null;

  // Legacy migration: older scenes may still have {mime,b64} or {dataUrl}
  if (!el.image.assetId){
    const dataUrl = (el.image.dataUrl && String(el.image.dataUrl).startsWith("data:"))
      ? String(el.image.dataUrl)
      : (el.image.mime && el.image.b64)
        ? `data:${String(el.image.mime)};base64,${String(el.image.b64)}`
        : "";

    if (dataUrl){
      try {
        el.image.assetId = addImageAssetFromDataUrl(dataUrl);
        delete el.image.b64;
        delete el.image.dataUrl;
        delete el.image.mime;
        scheduleAutosave();
      } catch {}
    }
  }

  const assetId = el.image.assetId ? String(el.image.assetId) : "";
  if (!assetId) return null;

  const dataUrl = getImageAssetDataUrl(assetId);
  if (!dataUrl) return null;

  let entry = imageCache.get(el.id);
  if (entry && entry.ready && entry.assetId === assetId) return entry.img;

  if (!entry){
    entry = { img: new Image(), ready: false, assetId: "" };
    imageCache.set(el.id, entry);
    entry.img.onload = () => { entry.ready = true; render(); };
    entry.img.onerror = () => { entry.ready = false; };
  }

  if (entry.assetId !== assetId){
    entry.ready = false;
    entry.assetId = assetId;
    entry.img.src = dataUrl;
  }

  return entry.ready ? entry.img : null;
}



function buildRemotePosterCandidates(href){
  const clean = String(href || '').trim();
  if (!clean) return [];
  const out = [];
  const seen = new Set();
  const push = (u) => { const v = String(u || '').trim(); if (v && !seen.has(v)) { seen.add(v); out.push(v); } };
  push(clean);
  const m = clean.match(/^https:\/\/i\.ytimg\.com\/vi\/([^\/]+)\/([a-z0-9_]+)\.jpg(?:[?#].*)?$/i);
  if (m){
    const vid = m[1];
    push(`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`);
    push(`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`);
    push(`https://i.ytimg.com/vi/${vid}/sddefault.jpg`);
    push(`https://i.ytimg.com/vi/${vid}/default.jpg`);
    push(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`);
    push(`https://img.youtube.com/vi/${vid}/mqdefault.jpg`);
    push(`https://img.youtube.com/vi/${vid}/sddefault.jpg`);
    push(`https://img.youtube.com/vi/${vid}/default.jpg`);
  }
  return out;
}
function ensureRemotePosterImageLoaded(href){
  const candidates = buildRemotePosterCandidates(href);
  if (!candidates.length) return null;
  const key = candidates.join('|');
  let entry = remotePosterImageCache.get(key);
  if (entry && entry.ready) return entry.img;
  if (!entry){
    const img = new Image();
    // Do NOT set crossOrigin here — i.ytimg.com does not send CORS headers,
    // so setting crossOrigin would cause the load to fail entirely.
    // This means the image can display on the live canvas but CANNOT be drawn
    // onto an export canvas (toBlob/toDataURL would throw SecurityError).
    // For export we only use the locally-saved posterAssetId path.
    img.referrerPolicy = 'no-referrer';
    entry = { img, ready: false, idx: 0 };
    remotePosterImageCache.set(key, entry);
    const tryNext = () => {
      if (entry.idx >= candidates.length) {
        entry.ready = false;
        return;
      }
      const nextSrc = candidates[entry.idx++];
      try { entry.img.decoding = 'async'; } catch {}
      entry.img.onload = () => {
        entry.ready = true;
        render();
      };
      entry.img.onerror = () => { tryNext(); };
      entry.img.src = nextSrc;
    };
    tryNext();
  }
  return entry.ready ? entry.img : null;
}

// YouTube thumbnails (i.ytimg.com) have no CORS headers — remote images can be
// displayed via <img> on the live canvas, but cannot be drawn onto an export canvas
// (toBlob/toDataURL would throw SecurityError). For PDF/export/slideshow, only the
// locally-saved posterAssetId asset is used. No canvas capture is attempted.

// NEW: background image cache (stage.bgImgAssetId)
const bgImageCache = { img: null, ready: false, assetId: "" };

function invalidateBackgroundImageCache(){
  bgImageCache.img = null;
  bgImageCache.ready = false;
  bgImageCache.assetId = "";
}

function ensureBackgroundImageLoadedForStage(){
  const st = Scene.stage || {};
  if (!st.bgImgAssetId) return null;

  const assetId = String(st.bgImgAssetId);
  const dataUrl = getImageAssetDataUrl(assetId);
  if (!dataUrl) return null;

  if (bgImageCache.ready && bgImageCache.assetId === assetId && bgImageCache.img){
    return bgImageCache.img;
  }

  if (!bgImageCache.img){
    bgImageCache.img = new Image();
    bgImageCache.ready = false;
    bgImageCache.assetId = "";
    bgImageCache.img.onload = () => { bgImageCache.ready = true; try{ syncBackgroundResizeButtonState(); }catch(_){ } render(); };
    bgImageCache.img.onerror = () => { bgImageCache.ready = false; try{ syncBackgroundResizeButtonState(); }catch(_){ } };
  }

  if (bgImageCache.assetId !== assetId){
    bgImageCache.ready = false;
    bgImageCache.assetId = assetId;
    bgImageCache.img.src = dataUrl;
  }

  return bgImageCache.ready ? bgImageCache.img : null;
}

function syncBackgroundResizeButtonState(){
  const btn = document.getElementById("btnResizeStageToBg");
  if (!btn) return;

  const st = Scene.stage || {};
  const hasBg = !!st.bgImgAssetId;

  if (!hasBg){
    btn.style.display = "none";
    btn.disabled = true;
    return;
  }

  // Show once an image is selected; enable only once it has loaded and has dimensions.
  btn.style.display = "";
  const img = ensureBackgroundImageLoadedForStage();
  const ready = !!(img && (img.naturalWidth || img.width) && (img.naturalHeight || img.height));
  btn.disabled = !ready;
}

function computeBackgroundImageDestRect({stageW, stageH, natW, natH, stretch, keepAspect}){
  const sw = Math.max(1, Number(stageW) || 1);
  const sh = Math.max(1, Number(stageH) || 1);
  const iw = Math.max(1, Number(natW) || 1);
  const ih = Math.max(1, Number(natH) || 1);

  if (!stretch){
    return { x: (sw - iw)/2, y: (sh - ih)/2, w: iw, h: ih };
  }
  if (keepAspect){
    const s = Math.min(sw/iw, sh/ih);
    const w = iw * s, h = ih * s;
    return { x: (sw - w)/2, y: (sh - h)/2, w, h };
  }
  return { x: 0, y: 0, w: sw, h: sh };
}



/* ============================================================
   Color-key transparency cache (Image -> processed offscreen canvas)
   ------------------------------------------------------------
   If el.colorKeyTransparent is true:
   - sample top-left pixel from the loaded image
   - pixels within tolerance become transparent (alpha = 0)
   ============================================================ */

const colorKeyCache = new Map(); // el.id -> { sig, canvas, naturalW, naturalH }

function invalidateColorKeyCache(elId){
  colorKeyCache.delete(elId);
}

// CHANGE HERE if you want more/less "jitter"
const DEFAULT_COLOR_KEY_TOL = 12;

/**
 * Build/return a processed canvas for an image element that has color-key enabled.
 * Returns {canvas, naturalW, naturalH} or null.
 */
function ensureColorKeyRaster(el, alreadyLoadedImg){
  if (!el || el.type !== ElementType.Image) return null;
  if (!el.colorKeyTransparent) return null;

  const img = alreadyLoadedImg || ensureImageLoadedForElement(el);
  if (!img) return null;

  const assetId = (el.image && el.image.assetId) ? String(el.image.assetId) : "";
  if (!assetId) return null;

  const tol = DEFAULT_COLOR_KEY_TOL;

  // Signature: reprocess only if the underlying asset changes
  const sig = `${assetId}|tol:${tol}|w:${img.naturalWidth}|h:${img.naturalHeight}`;

  const existing = colorKeyCache.get(el.id);
  if (existing && existing.sig === sig) return existing;

  // Build fresh processed raster at intrinsic size
  const off = document.createElement("canvas");
  off.width = Math.max(1, img.naturalWidth || img.width || 1);
  off.height = Math.max(1, img.naturalHeight || img.height || 1);

  const c = off.getContext("2d", { willReadFrequently: true });
  c.clearRect(0, 0, off.width, off.height);
  c.drawImage(img, 0, 0);

  let data;
  try {
    data = c.getImageData(0, 0, off.width, off.height);
  } catch (e) {
    // If the canvas is tainted (shouldn't happen with data URLs), fail safely.
    return null;
  }

  const d = data.data;
  const keyR = d[0], keyG = d[1], keyB = d[2];

  for (let i = 0; i < d.length; i += 4){
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (
      Math.abs(r - keyR) <= tol &&
      Math.abs(g - keyG) <= tol &&
      Math.abs(b - keyB) <= tol
    ){
      d[i + 3] = 0; // transparent
    }
  }

  c.putImageData(data, 0, 0);

  const entry = { sig, canvas: off, naturalW: off.width, naturalH: off.height };
  colorKeyCache.set(el.id, entry);
  return entry;
}





//******* new code for displaying sitelen elements




/* ============================================================
   Multiline text → elements → bounding box → draw-to-canvas
   Extracted/minimized from your page: includes parsing + measuring + rendering.
   You can paste this into another HTML page and call:

     const linesEls = parseMultilineToElements(inputText, { fontPx, mode });
     const box = measureMultiline(linesEls, { fontPx, padPx: 18, lineGapPx: 18 });
     renderMultilineToCanvas(canvas, linesEls, { fontPx, fgCss: "000", padPx: 18, lineGapPx: 18 });

   CHANGE HERE blocks indicate where to paste your existing maps and font names.
   ============================================================ */

/* ============================
   CHANGE HERE: font family names used by canvas ctx.font
   ============================ */

/* ============================
   Layout constants used by bbox + draw
   ============================ */
const WORD_GAP_PX = 12;
const LINE_GAP_PX = 18;   // can override via options
const DEFAULT_PAD_PX = 18;

function wordGapForPx(px){
  const p = Math.max(8, Number(px ?? 56));
  return Math.max(2, Math.min(24, Math.round(p * 0.22)));  // ~22% of font size
}

function cartoucheLeadGapForPx(fontPx){
  // smaller than normal word gap; tune these
  const p = Math.max(8, Number(fontPx ?? 56));
  return Math.max(0, Math.round(p * 0.08)); // e.g. ~8% of font size
}

function lineGapForPx(px){
  const p = Math.max(8, Number(px ?? 56));
  return Math.max(4, Math.min(40, Math.round(p * 0.32)));  // ~32% of font size
}

/* ============================
   Cartouche and long-pi codepoints
   ============================ */
const CARTOUCHE_START_CP = 0xF1990;
const CARTOUCHE_END_CP   = 0xF1991;

// Long "pi { ... }" container glyphs
const LONG_PI_START_CP = 0xF1993;   // START OF LONG PI
const LONG_PI_EXT_CP   = 0xF1994;   // COMBINING LONG PI EXTENSION

/* ============================
   CHANGE HERE: word → UCSUR codepoint map
   - Paste your full MULTI_LINE_WORD_TO_UCSUR_CP object here (including punctuation keys).
   - This is required for parsing and rendering known words and punctuation.
   ============================ */
const MULTI_LINE_WORD_TO_UCSUR_CP = {
  /* PASTE YOUR EXISTING MULTI_LINE_WORD_TO_UCSUR_CP HERE */
  // Example minimal placeholders:
  ...WORD_TO_UCSUR_CP,
  ":": 0xF199D,
  "·": 0xF199C,
  ",": 0xF199E,
  ".": 0xF199C,

  "kolon": 0xF199D,
  "ota": 0xF199C,
  "koma": 0xF199E
};

function isKnownTpWordKey(k) {
  return MULTI_LINE_WORD_TO_UCSUR_CP[k] != null;
}

/* ============================
   CHANGE HERE: nanpa-linja-n TP word → CP map
   - Paste your full NANPA_LINJA_N_WORD_TO_CP here if you want cartouches.
   - If you do not need number cartouches on the new page, you can keep a minimal map
     and skip using nanpa-linja-n features.
   ============================ */
const NANPA_LINJA_N_WORD_TO_CP = {
  /* PASTE YOUR EXISTING NANPA_LINJA_N_WORD_TO_CP HERE */
  "nanpa": 0xF193D,
  "en":    0xF190A,
  "esun":  0xF190B,
  "e":     0xF1909,
  "nena":  0xF1940,
  "nasa":  0xF193E,
  "ni":    0xF1941,
  "o":     0xF1944,
  "ona":   0xF1946,
  "kulupu":0xF191F,
  "ijo":   0xF190C,
  "wan":   0xF1973,
  "tu":    0xF196E,
  "seli":  0xF1957,
  "awen":  0xF1908,
  "luka":  0xF192D,
  "utala": 0xF1971,
  "mun":   0xF193A,
  "pipi":  0xF1951,
  "jo":    0xF1913,
  "open":   0xF1947,
  "kipisi": 0xF197B,
  "kasi":   0xF1917,
  // time/date delimiter support (cartouche path): default to kasi for numeric cartouches.
  "kolon": 0xF199D,
  ":":     0xF199D
};

const CP_NANPA = NANPA_LINJA_N_WORD_TO_CP["nanpa"];
const CP_NENA  = NANPA_LINJA_N_WORD_TO_CP["nena"];
const CP_EN    = NANPA_LINJA_N_WORD_TO_CP["en"];

const UNIFORM_TO_NENA = new Set([
  NANPA_LINJA_N_WORD_TO_CP["nasa"],
  NANPA_LINJA_N_WORD_TO_CP["nasin"],
  NANPA_LINJA_N_WORD_TO_CP["ni"],
  NANPA_LINJA_N_WORD_TO_CP["nimi"],
  NANPA_LINJA_N_WORD_TO_CP["noka"],
  NANPA_LINJA_N_WORD_TO_CP["nena"]
]);

const UNIFORM_TO_EN = new Set([
  NANPA_LINJA_N_WORD_TO_CP["e"],
  NANPA_LINJA_N_WORD_TO_CP["en"],
  NANPA_LINJA_N_WORD_TO_CP["esun"]
]);

function uniformizeNanpaLinjanCartoucheCps(cps) {
  const a = Array.from(cps ?? []);
  if (a.length === 0) return a;

  for (let i = 0; i < a.length; i++) {
    const cp = a[i];

    if (cp === CP_NANPA) {
      if (i !== 0 && i !== a.length - 1) a[i] = CP_NENA;
      continue;
    }
    if (UNIFORM_TO_NENA.has(cp)) { a[i] = CP_NENA; continue; }
    if (UNIFORM_TO_EN.has(cp))   { a[i] = CP_EN; continue; }
  }
  return a;
}

/* ============================
   Common helpers
   ============================ */

function hexToRgba(hex, a = 1){
  const h = String(hex || "").trim().replace("#","");
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function rgbaOrHexToHex(value, fallback="#FFFFFF"){
  if(value === null) return fallback.toUpperCase();
  const s = String(value || "").trim();
  if (s.startsWith("#") && (s.length === 7)) return s;
  // parse rgba(r,g,b,a) -> hex (drop alpha)
  const m = s.match(/rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (!m) return fallback.toUpperCase();
  const r = clamp(parseInt(m[1],10),0,255).toString(16).padStart(2,"0");
  const g = clamp(parseInt(m[2],10),0,255).toString(16).padStart(2,"0");
  const b = clamp(parseInt(m[3],10),0,255).toString(16).padStart(2,"0");
  return `#${r}${g}${b}`.toUpperCase();
}

function setTextQuality(ctx) {
  try { ctx.textRendering = "optimizeLegibility"; } catch (_) {}
  try { ctx.fontKerning = "normal"; } catch (_) {}
}

// ============================================================
// Halo helpers (per-element + scene defaults)
// ============================================================
function elementSupportsHalo(el){
  const t = el?.type;
  return t === ElementType.Text || t === ElementType.Sitelen || t === ElementType.Glyph || t === ElementType.Rect;
}

function clampHaloThicknessPx(px){
  // Keep halo sane; values are in "element font px" units (pre-zoom)
  const v = Math.round(Number(px) || 0);
  return clamp(v, 0, 48);
}

function defaultHaloThicknessForFontPx(fontPx){
  const p = Math.max(6, Number(fontPx || 24));
  // ~10% of font size; clamp to sane minimum/maximum
  return clamp(Math.round(p * 0.10), 2, 24);
}

function ensureHaloFields(el, stageOverride){
  if (!el || !elementSupportsHalo(el)) return;
  const st = stageOverride || Scene.stage || {};

  if (typeof el.haloEnabled !== "boolean") el.haloEnabled = !!(st.defaultHaloEnabled ?? DEFAULTS.defaultHaloEnabled);
  if (typeof el.haloColor !== "string") el.haloColor = rgbaOrHexToHex(st.defaultHaloColor ?? DEFAULTS.defaultHaloColor, "#FFFFFF");

  if (el.haloThicknessMode !== "manual" && el.haloThicknessMode !== "auto"){
    el.haloThicknessMode = (st.defaultHaloThicknessMode === "manual") ? "manual" : "auto";
  }

  const basisFontPx = (el.type === ElementType.Rect)
    ? 28
    : Math.max(6, Number(el.fontSize ?? 24));

  if (!Number.isFinite(el.haloThickness) || el.haloThickness < 0){
    if (el.haloThicknessMode === "manual"){
      const defManual = Number.isFinite(st.defaultHaloThicknessPx) ? st.defaultHaloThicknessPx : DEFAULTS.defaultHaloThicknessPx;
      el.haloThickness = clampHaloThicknessPx(defManual || defaultHaloThicknessForFontPx(basisFontPx));
    } else {
      el.haloThickness = defaultHaloThicknessForFontPx(basisFontPx);
    }
  } else {
    el.haloThickness = clampHaloThicknessPx(el.haloThickness);
  }
}

function effectiveHaloThicknessForElement(el){
  if (!el || !elementSupportsHalo(el) || !el.haloEnabled) return 0;

  const basisFontPx = (el.type === ElementType.Rect)
    ? 28
    : Math.max(6, Number(el.fontSize ?? 24));

  const basePx = (el.haloThicknessMode === "manual")
    ? clampHaloThicknessPx(el.haloThickness)
    : defaultHaloThicknessForFontPx(basisFontPx);

  // Scale with zoom so what you see is what you export
  return basePx * (Scene.view?.zoom ?? 1);
}

function effectiveHaloThicknessForElementExport(el){
  if (!el || !elementSupportsHalo(el) || !el.haloEnabled) return 0;

  const basisFontPx = (el.type === ElementType.Rect)
    ? 28
    : Math.max(6, Number(el.fontSize ?? 24));

  const basePx = (el.haloThicknessMode === "manual")
    ? clampHaloThicknessPx(el.haloThickness)
    : defaultHaloThicknessForFontPx(basisFontPx);

  // IMPORTANT: export is in stage coords (zoom = 1)
  return basePx;
}

// Active halo options for sitelen raster parsing/cartouches (set by renderTextToCanvas)
let ACTIVE_SITELEN_HALO = { enabled: false, css: "#FFFFFF", mode: "auto", thickness: 0 };

function normalizeTpWord(raw) {
  return String(raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

// Glyph-key normalization for MULTI_LINE_WORD_TO_UCSUR_CP lookups
// Keeps: a-z plus ^ < > : , . and middle dot ·
function normalizeTpGlyphKey(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z^<>:,.·]/g, "");
}

function normalizeTpGlyphToken(raw) {
  const s0 = String(raw ?? "").trim().toLowerCase();
  if (!s0) return "";
  if (s0 === ":" || s0 === "·" || s0 === "," || s0 === ".") return s0;

  const stripped = s0.replace(/^[^a-z^<>:,.·]+|[^a-z^<>:,.·]+$/g, "");
  if (!stripped) return "";
  return normalizeTpGlyphKey(stripped);
}

/* ============================
   Long pi helpers
   ============================ */
function tokenHasOpenCurly(tok) { return String(tok ?? "").includes("{"); }
function tokenHasCloseCurly(tok){ return String(tok ?? "").includes("}"); }

function extractCurlyContentFromTokens(tokens, startIdx) {
  let j = startIdx;
  while (j < tokens.length && !tokenHasCloseCurly(tokens[j])) j++;
  if (j >= tokens.length) return null;

  const joined = tokens.slice(startIdx, j + 1).join(" ");
  const open = joined.indexOf("{");
  const close = joined.lastIndexOf("}");
  if (open < 0 || close < 0 || close <= open) return null;

  const inner = joined.slice(open + 1, close).trim();
  return { inner, endIndex: j };
}

function parseKnownTpWords(innerText) {
  const raw = String(innerText ?? "");
  const parts = raw.split(/\s+/).map(normalizeTpGlyphKey).filter(Boolean);
  const known = parts.filter(w => MULTI_LINE_WORD_TO_UCSUR_CP[w] != null);
  return known;
}

/* ============================
   Random letters → glyphs (used in [ ... ] cartouches when unknown words exist)
   - Optional. Remove if you do not need random mapping behaviour.
   ============================ */
function buildLetterBuckets() {
  const buckets = new Map();
  for (const w of Object.keys(MULTI_LINE_WORD_TO_UCSUR_CP)) {
    const k = String(w);
    if (!k) continue;
    const first = k[0].toLowerCase();
    if (!/^[a-z]$/.test(first)) continue;
    if (!buckets.has(first)) buckets.set(first, []);
    buckets.get(first).push(k);
  }
  return buckets;
}
const LETTER_BUCKETS = buildLetterBuckets();

function randInt(n) {
  if (n <= 0) return 0;
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

function randomGlyphCpForLetter(letter) {
  const l = String(letter ?? "").toLowerCase();
  const arr = LETTER_BUCKETS.get(l);
  if (!arr || arr.length === 0) return null;

  // Exclude convenience punctuation-words from random output (matches your current behavior)
  const banned = new Set(["ota", "kolon", "koma"]);
  const filtered = arr.filter(w => !banned.has(w));
  if (filtered.length === 0) return null;

  const word = filtered[randInt(filtered.length)];
  return MULTI_LINE_WORD_TO_UCSUR_CP[word] ?? null;
}

function lettersToRandomGlyphCps(letters) {
  const cps = [];
  const s = String(letters ?? "").toLowerCase().replace(/[^a-z]/g, "");
  for (const ch of s) {
    const cp = randomGlyphCpForLetter(ch);
    if (cp != null) cps.push(cp);
  }
  return cps;
}

/* ============================================================
   nanpa-linja-n tokenization + conversions (needed for cartouches)
   (This is the minimal dependency set for the cartouche parser in your pipeline.)
   ============================================================ */
const DIGIT_TOKENS = new Set(["NI","WE","TE","SE","NA","LE","NU","ME","PE","JE"]);
const TOKEN_PREFIXES = ["KEKEKE","KEKE","KE","NONONO","NONO","OK","NE","NO"];

function nanpaCapsHasAtLeastOneDigitToken(tokens) {
  for (const t of (tokens ?? [])) if (DIGIT_TOKENS.has(t)) return true;
  return false;
}

function tokenizeNanpaCaps(caps) {
  const s = String(caps ?? "").trim().toUpperCase();
  if (!s) throw new Error("caps is empty");
  if (!s.endsWith("N")) throw new Error("nanpa-caps must end with final terminator 'N'");
  if (!s.startsWith("NE")) throw new Error("nanpa-caps must start with 'NE'");

  const tokens = [];
  let i = 0;
  const end = s.length;

  while (i < end - 1) {
    let matched = null;
    for (const pref of TOKEN_PREFIXES) {
      if (s.startsWith(pref, i)) { matched = pref; break; }
    }
    if (matched != null) { tokens.push(matched); i += matched.length; continue; }

    if (i + 2 <= end - 1) {
      const two = s.slice(i, i + 2);
      if (DIGIT_TOKENS.has(two)) { tokens.push(two); i += 2; continue; }
    }

    throw new Error(`Invalid tokenization at position ${i} in caps string "${caps}"`);
  }

  tokens.push("N");
  return tokens;
}

function isValidNanpaLinjanProperName(raw) {
  const s = String(raw ?? "").replace(/\s+/g, "");
  if (!s) return false;
  if (!/^[a-zA-Z]+$/.test(s)) return false;
  if (!/[nN]$/.test(s)) return false;

  const core = s.slice(0, -1);
  if (core.length < 2 || (core.length % 2) !== 0) return false;

  const caps = core.toUpperCase() + "N";
  if (!caps.startsWith("NE")) return false;

  try { tokenizeNanpaCaps(caps); return true; }
  catch { return false; }
}

const NUMBER_CODE_LETTER_TO_PAIR = {
  "I":"NI","W":"WE","T":"TE","S":"SE","A":"NA",
  "L":"LE","U":"NU","M":"ME","P":"PE","J":"JE"
};

function tryParseNanpaLinjanNumberCodeToCaps(raw) {
  const s0 = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s0) return null;
  if (!s0.toUpperCase().startsWith("#~")) return null;

  let body = s0.slice(2).toUpperCase();

  // NEW: treat trailing OK as a percent marker token, not operators
  let hasPercent = false;
  if (body.endsWith("OK")) {
    hasPercent = true;
    body = body.slice(0, -2);
    if (!body) throw new Error("Number code '#~' must have letters before trailing OK.");
  }

  if (!body) throw new Error("Number code '#~' must have letters after it.");
  if (!/^[A-Z]+$/.test(body)) throw new Error("Number code may only contain letters A–Z after '#~'.");

  const tokens = ["NE"];
  let i = 0;

  function ensureNEBeforeOperatorRun() {
    if (tokens[tokens.length - 1] !== "NE") tokens.push("NE");
  }

  while (i < body.length) {
    const ch = body[i];

    if (ch === "O") {
      let j = i;
      while (j < body.length && body[j] === "O") j++;
      const count = j - i;
      if (count < 1 || count > 3) throw new Error("Invalid run of 'O' in number code (max 3).");

      if (count === 1) {
        if (i === 0) tokens.push("NO");
        else tokens.push("NO", "NE");
      } else {
        tokens.push("NO".repeat(count)); // NONO / NONONO
      }

      i = j;
      continue;
    }

    if (ch === "K") {
      let j = i;
      while (j < body.length && body[j] === "K") j++;
      const count = j - i;
      if (count < 1 || count > 3) throw new Error("Invalid run of 'K' in number code (max 3).");

      ensureNEBeforeOperatorRun();
      tokens.push("KE".repeat(count)); // KE / KEKE / KEKEKE
      i = j;
      continue;
    }

    const pair = NUMBER_CODE_LETTER_TO_PAIR[ch];
    if (!pair) throw new Error(`Invalid letter '${ch}' in number code.`);
    tokens.push(pair);
    i += 1;
  }

  // NEW: insert OK *before* final N terminator
  if (hasPercent) tokens.push("OK");

  tokens.push("N");
  const caps = tokens.join("");
  tokenizeNanpaCaps(caps);
  return { caps };
}

const TOKEN_TO_DIGIT_CHAR = {
  "NI":"0","WE":"1","TE":"2","SE":"3","NA":"4",
  "LE":"5","NU":"6","ME":"7","PE":"8","JE":"9"
};

const TOKEN_TO_DIGIT_WORD = {
  "NI":"ijo","WE":"wan","TE":"tu","SE":"seli","NA":"awen",
  "LE":"luka","NU":"utala","ME":"mun","PE":"pipi","JE":"jo"
};
const WORD_FOR_NEGATIVE_SIGN = "ona";

function nanpaCapsTokensToTpWords(tokens, { mode = "uniform" } = {}) {
  if (!tokens || tokens.length === 0) return [];

  const uniform = (mode === "uniform");
  const out = [];

  const E_WORD = uniform ? "en" : "esun";
  const E_WORD_FOR_NE_AFTER_START = uniform ? "en" : "e";
  const N_WORD = uniform ? "nena" : "nasa";

  const N_WORD_DECIMAL_POINT = uniform ? "nena" : "ni";
  const N_END_WORD = "nanpa";

  let afterStartingNe = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === "OK") {
      out.push("open", "kipisi", E_WORD_FOR_NE_AFTER_START);
      afterStartingNe = false;
      continue;
    }


    if (t === "NE") {
      if (out.length === 0) {
        out.push("nanpa", E_WORD);
        afterStartingNe = true;
      } else {
        out.push(N_WORD, E_WORD_FOR_NE_AFTER_START);
        afterStartingNe = false;
      }
      continue;
    }

    if (DIGIT_TOKENS.has(t)) {
      afterStartingNe = false;
      const digitWord = TOKEN_TO_DIGIT_WORD[t];
      if (t === "NI" || t === "NA" || t === "NU") out.push(N_WORD, digitWord);
      else out.push(digitWord, E_WORD);
      continue;
    }

    if (t === "NO") {
      if (afterStartingNe) {
        out.push(N_WORD, WORD_FOR_NEGATIVE_SIGN);
        afterStartingNe = false;
        continue;
      }

      const nxt = (i + 1 < tokens.length) ? tokens[i + 1] : null;
      if (nxt === "NE") {
        out.push(N_WORD_DECIMAL_POINT, "o", N_WORD, E_WORD_FOR_NE_AFTER_START);
        afterStartingNe = false;
        i += 1;
        continue;
      }

      out.push(N_WORD_DECIMAL_POINT, "o");
      afterStartingNe = false;
      continue;
    }

    if (t === "NONO") { out.push("nena","o","nena","o"); afterStartingNe=false; continue; }
    if (t === "NONONO") { out.push(N_WORD,"o",N_WORD,"o",N_WORD,"o"); afterStartingNe=false; continue; }

    if (t === "KE")     { out.push("kulupu", E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
    if (t === "KEKE")   { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
    if (t === "KEKEKE") { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }

    if (t === "N") { out.push(N_END_WORD); afterStartingNe=false; continue; }

    throw new Error(`Unknown token "${t}"`);
  }

  return out;
}

const NANPA_DATE_TIME_SEPARATOR_WORD = "kasi";

// Date/time cartouches: rewrite the NE+KE delimiter expansion so the glyph uses
// kasi, not kolon. This keeps the whole static page aligned with the
// good-kasi nanpa-linja-n companion fonts.
function replaceTimeSeparatorsTpWords(tpWords, mode) {
  const join = (mode === "uniform") ? "en" : "e";
  const nWord = (mode === "uniform") ? "nena" : "nasa";
  const pattern = [nWord, join, "kulupu", join];

  const out = [];
  for (let i = 0; i < tpWords.length; ) {
    const isMatch =
      i + pattern.length <= tpWords.length &&
      pattern.every((w, k) => tpWords[i + k] === w);

    if (isMatch) {
      out.push(nWord, join, NANPA_DATE_TIME_SEPARATOR_WORD, join); // nena en kasi en
      i += pattern.length;
    } else {
      out.push(tpWords[i]);
      i += 1;
    }
  }
  return out;
}


function nanpaCapsToNanpaLinjanCodepoints(caps, { mode = "uniform",  isTime = false } = {}) {
  const tokens = tokenizeNanpaCaps(caps);
  if (!nanpaCapsHasAtLeastOneDigitToken(tokens)) return null;

  // Consume OK as a flag
  let hasPercent = false;
  const tokensNoOk = [];
  for (const t of tokens) {
    if (t === "OK") { hasPercent = true; continue; }
    tokensNoOk.push(t);
  }

  const tpWords = nanpaCapsTokensToTpWords(tokensNoOk, { mode });
  const tpWordsFinal = isTime ? replaceTimeSeparatorsTpWords(tpWords, mode) : tpWords;

  const cps = [];
  for (const w of tpWordsFinal) {
    const cp = NANPA_LINJA_N_WORD_TO_CP[w];
    if (cp == null) return null;
    cps.push(cp);
  }

  // Preserve existing uniformization behavior
  const out = (mode === "uniform") ? uniformizeNanpaLinjanCartoucheCps(cps) : cps;

  // Percent marker: insert BEFORE the closing nanpa glyph
  if (hasPercent) {
    const suffixWords = (mode === "uniform")
      ? ["nena", "open", "kipisi", "en"]
      : ["noka", "open", "kipisi", "e"];

    const suffixCps = [];
    for (const w of suffixWords) {
      const cp = NANPA_LINJA_N_WORD_TO_CP[w];
      if (cp == null) return null;
      suffixCps.push(cp);
    }

    const lastNanpaIdx = out.lastIndexOf(CP_NANPA);
    if (lastNanpaIdx >= 0) out.splice(lastNanpaIdx, 0, ...suffixCps);
    else out.push(...suffixCps);
  }

  return out;
}


function tryDecodeNanpaLinjanIdentifierToCodepoints(rawText, { mode = "uniform" } = {}) {
  const s = String(rawText ?? "").trim();
  if (!s) return null;

  try {
    const parsed = tryParseNanpaLinjanNumberCodeToCaps(s);
    if (parsed?.caps) {
      const isTime = nanpaCapsIsValidTimeOrDate(parsed.caps);
      return nanpaCapsToNanpaLinjanCodepoints(parsed.caps, { mode, isTime });
    }
  } catch {
    return null;
  }

  if (!isValidNanpaLinjanProperName(s)) return null;

  const compact = s.replace(/\s+/g, "");
  const core = compact.slice(0, -1);

  const coreUpper = core.toUpperCase();
  let caps;

  // NEW: trailing NOKE => OKN
  if (coreUpper.endsWith("NOKE")) {
    const base = coreUpper.slice(0, -4);
    if (!base) return null;
    caps = base + "OKN";
  } else {
    caps = coreUpper + "N";
  }

  const isTime = nanpaCapsIsValidTimeOrDate(caps);
  return nanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime });

}

/* ============================================================
   Minimal scanners for cartouche triggers in plain text:
   - Decimals: findDecimalSequencesWithCaps
   - #~ code:  findNumberCodeSequencesWithCaps
   - Proper:   findNanpaLinjanProperNameSequencesWithCaps
   - TP phrase:findNanpaLinjanTpPhraseSequences
   NOTE: These are the same style as your page; if you want a smaller feature set,
         delete what you do not need and remove callers in parseTextSegmentToElements.
   ============================================================ */
const VULGAR_FRACTIONS = new Map([
  ["¼", [1, 4]], ["½", [1, 2]], ["¾", [3, 4]],
  ["⅐", [1, 7]], ["⅑", [1, 9]], ["⅒", [1, 10]],
  ["⅓", [1, 3]], ["⅔", [2, 3]],
  ["⅕", [1, 5]], ["⅖", [2, 5]], ["⅗", [3, 5]], ["⅘", [4, 5]],
  ["⅙", [1, 6]], ["⅚", [5, 6]],
  ["⅛", [1, 8]], ["⅜", [3, 8]], ["⅝", [5, 8]], ["⅞", [7, 8]],
  ["↉", [0, 3]],
]);

function normalizeVulgarFractionInput(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return s;

  s = s.replace(/\u2044/g, "/");

  let found = null;
  for (const ch of s) {
    if (VULGAR_FRACTIONS.has(ch)) { found = ch; break; }
  }
  if (!found) return s;

  const lastChar = s.slice(-1);
  if (!VULGAR_FRACTIONS.has(lastChar)) {
    throw new Error("Vulgar fraction characters must appear at the end (e.g., 9¾ or ¾).");
  }

  const [num, den] = VULGAR_FRACTIONS.get(lastChar);
  const prefixRaw = s.slice(0, -1).trim();

  if (!prefixRaw) return `${num}/${den}`;

  const isNeg = prefixRaw.startsWith("-");
  const prefix = isNeg ? prefixRaw.slice(1).trim() : prefixRaw;
  if (!prefix) return `-${num}/${den}`;

  return isNeg ? `-${prefix}+${num}/${den}` : `${prefix}+${num}/${den}`;
}

function looksLikeNanpaCaps(s) {
  const t = String(s ?? "").trim();
  if (!t) return false;
  if (!/^[A-Za-z]+[Nn]$/.test(t)) return false;
  return t.slice(0, 2).toUpperCase() === "NE";
}

function groupFractionDigitsOnly(s, decimalChar=".", groupSize=3, sepChar="_") {
  const str = String(s);
  const idx = str.indexOf(decimalChar);
  if (idx < 0) return str;

  const left = str.slice(0, idx);
  const right = str.slice(idx + 1);

  let i = 0;
  while (i < right.length && /[0-9]/.test(right[i])) i++;
  const fracDigits = right.slice(0, i);
  const suffix = right.slice(i);

  if (fracDigits.length <= groupSize) return str;
  if (sepChar && fracDigits.includes(sepChar)) return str;

  const groups = [];
  for (let j = 0; j < fracDigits.length; j += groupSize) {
    groups.push(fracDigits.slice(j, j + groupSize));
  }
  return `${left}${decimalChar}${groups.join(sepChar)}${suffix}`;
}

function normalizeLooseSeparators(raw) {
  if (raw == null) return "";
  let s = String(raw);
  s = s.replace(/[−‒–—]/g, "-");
  const isNeg = s.startsWith("-");
  const head = isNeg ? "-" : "";
  const rest = isNeg ? s.slice(1) : s;
  let r = rest.replace(/\s+/g, " ");
  r = r.replace(/-+/g, "-");
  return (head + r).trim();
}

const DEC_DIGIT_TO_TOKEN = {
  "0": "NI", "1": "WE", "2": "TE", "3": "SE", "4": "NA",
  "5": "LE", "6": "NU", "7": "ME", "8": "PE", "9": "JE",
};

function normalizeDateTimeInput(raw) {
  let s = String(raw ?? "").trim();

  // dates/times: remove internal whitespace
  s = s.replace(/\s+/g, "");

  // Normalize common unicode variants (copy/paste-safe)
  // Hyphen/minus variants -> "-"
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, "-");
  // Slash variants -> "/"
  s = s.replace(/[\u2044\u2215\uFF0F]/g, "/");
  // Fullwidth colon -> ":"
  s = s.replace(/[\uFF1A]/g, ":");

  return s;
}

/* ============================================================
   Time recognizer (HH:MM[:SS]) + caps encoder
   ============================================================ */
function tryParseTimeParts(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;

  const hhStr = m[1];
  const mmStr = m[2];
  const ssStr = (m[3] != null) ? m[3] : null;

  const hh = parseInt(hhStr, 10);
  if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;

  return { hhStr, mmStr, ssStr };
}

function encodeDigitsOnly(digits) {
  const s = String(digits ?? "");
  if (!/^\d+$/.test(s)) throw new Error(`Expected only digits, got "${digits}"`);
  let out = "";
  for (const ch of s) {
    const tok = DEC_DIGIT_TO_TOKEN[ch];
    if (!tok) throw new Error(`Unsupported digit "${ch}"`);
    out += tok;
  }
  return out;
}

// ============================
// Date support (YYYY{sep}MM{sep}DD)
// ============================
// Valid formats:
// - YYYY-MM-DD, YYYY/MM/DD, YYYY:MM:DD
// Constraints:
// - YYYY exactly 4 digits (0000-9999 allowed)
// - MM 01-12
// - DD 01-31
function tryParseDateParts(raw) {
  const s = normalizeDateTimeInput(raw);
  const m = s.match(/^(\d{4})([:\/-])(\d{2})\2(\d{2})$/);
  if (!m) return null;

  const yyyyStr = m[1];
  const mmStr = m[3];
  const ddStr = m[4];

  const mm = parseInt(mmStr, 10);
  const dd = parseInt(ddStr, 10);

  if (!(mm >= 1 && mm <= 12)) return null;
  if (!(dd >= 1 && dd <= 31)) return null;

  return { yyyyStr, mmStr, ddStr };
}

function dateStrToNanpaCaps(raw) {
  const parts = tryParseDateParts(raw);
  if (!parts) return null;

  let caps = "NE";
  caps += encodeDigitsOnly(parts.yyyyStr);
  caps += "NEKE";
  caps += encodeDigitsOnly(parts.mmStr);
  caps += "NEKE";
  caps += encodeDigitsOnly(parts.ddStr);
  caps += "N";

  tokenizeNanpaCaps(caps); // sanity-check
  return caps;
}

function timeStrToNanpaCaps(raw) {
  const parts = tryParseTimeParts(raw);
  if (!parts) return null;

  let caps = "NE";
  caps += encodeDigitsOnly(parts.hhStr);
  caps += "NEKE";
  caps += encodeDigitsOnly(parts.mmStr);

  if (parts.ssStr != null) {
    caps += "NEKE";
    caps += encodeDigitsOnly(parts.ssStr);
  }

  caps += "N";
  tokenizeNanpaCaps(caps); // sanity-check
  return caps;
}

function nanpaCapsLooksLikeTime(caps){
  let tokens;
  try { tokens = tokenizeNanpaCaps(caps); } catch { return false; }
  if (!tokens || tokens.length < 1) return false;

  // Must start NE ... end N
  if (tokens[0] !== "NE") return false;
  if (tokens[tokens.length - 1] !== "N") return false;

  // Disallow operators that cannot appear in time encoding
  for (const t of tokens){
    if (t === "NO" || t === "NONO" || t === "NONONO" || t === "OK") return false;
    if (t === "KEKE" || t === "KEKEKE") return false;
  }

  // Parse pattern:
  // NE  (H digits: 1–2 digit tokens)
  // NE KE (delimiter)
  // (MM digits: exactly 2 digit tokens)
  // [ NE KE (delimiter) (SS digits: exactly 2 digit tokens) ]
  // N
  let i = 1;

  // hours digits: 1 or 2 digit tokens
  let hCount = 0;
  while (i < tokens.length && DIGIT_TOKENS.has(tokens[i]) && hCount < 2){
    hCount++; i++;
  }
  if (hCount < 1) return false;

  // delimiter 1
  if (tokens[i] !== "NE") return false; i++;
  if (tokens[i] !== "KE") return false; i++;

  // minutes: exactly 2 digit tokens
  if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
  if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;

  // optional seconds
  if (tokens[i] === "NE"){
    i++;
    if (tokens[i] !== "KE") return false; i++;
    if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
    if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
  }

  // must now be at final N
  return i === tokens.length - 1;
}

function nanpaCapsDecodeTimeStrict(caps) {
  let tokens;
  try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
  catch { return null; }

  if (tokens[0] !== "NE") return null;
  if (tokens[tokens.length - 1] !== "N") return null;

  let i = 1;

  function readDigitChar() {
    const t = tokens[i];
    const w = TOKEN_TO_DIGIT_WORD[t];
    if (!w) return null;

    // Reverse map: token -> digit char
    // NI 0, WE 1, TE 2, SE 3, NA 4, LE 5, NU 6, ME 7, PE 8, JE 9
    const map = { NI:"0", WE:"1", TE:"2", SE:"3", NA:"4", LE:"5", NU:"6", ME:"7", PE:"8", JE:"9" };
    const ch = map[t];
    if (!ch) return null;

    i += 1;
    return ch;
  }

  // HH: 1–2 digits
  const h1 = readDigitChar(); if (h1 == null) return null;
  let h2 = null;
  if (i < tokens.length && DIGIT_TOKENS.has(tokens[i])) h2 = readDigitChar();
  const hhStr = (h2 == null) ? h1 : (h1 + h2);

  // delimiter 1
  if (tokens[i] !== "NE") return null; i++;
  if (tokens[i] !== "KE") return null; i++;

  // MM: exactly 2 digits
  const m1 = readDigitChar(); if (m1 == null) return null;
  const m2 = readDigitChar(); if (m2 == null) return null;
  const mmStr = m1 + m2;

  // optional seconds
  let ssStr = null;
  if (tokens[i] === "NE") {
    i++;
    if (tokens[i] !== "KE") return null; i++;
    const s1 = readDigitChar(); if (s1 == null) return null;
    const s2 = readDigitChar(); if (s2 == null) return null;
    ssStr = s1 + s2;
  }

  // must end at final N
  if (i !== tokens.length - 1) return null;

  // Range check
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  const ss = (ssStr == null) ? null : parseInt(ssStr, 10);

  if (!(hh >= 0 && hh <= 59)) return null;
  if (!(mm >= 0 && mm <= 59)) return null;
  if (ss != null && !(ss >= 0 && ss <= 59)) return null;

  return { hh, mm, ss };
}

function nanpaCapsIsValidTime(caps) {
  return nanpaCapsDecodeTimeStrict(caps) != null;
}

function nanpaCapsDecodeDateStrict(caps) {
  let tokens;
  try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
  catch { return null; }

  if (tokens[0] !== "NE") return null;
  if (tokens[tokens.length - 1] !== "N") return null;

  // Pattern:
  // NE (YYYY digits: 4) NE KE (MM digits: 2) NE KE (DD digits: 2) N
  let i = 1;

  function readDigit() {
    const t = tokens[i];
    const ch = TOKEN_TO_DIGIT_CHAR[t];
    if (ch == null) return null;
    i += 1;
    return ch;
  }

  // YYYY: exactly 4 digits
  const y1 = readDigit(); if (y1 == null) return null;
  const y2 = readDigit(); if (y2 == null) return null;
  const y3 = readDigit(); if (y3 == null) return null;
  const y4 = readDigit(); if (y4 == null) return null;

  // delimiter 1
  if (tokens[i] !== "NE") return null; i++;
  if (tokens[i] !== "KE") return null; i++;

  // MM: exactly 2 digits
  const m1 = readDigit(); if (m1 == null) return null;
  const m2 = readDigit(); if (m2 == null) return null;
  const mmStr = m1 + m2;

  // delimiter 2
  if (tokens[i] !== "NE") return null; i++;
  if (tokens[i] !== "KE") return null; i++;

  // DD: exactly 2 digits
  const d1 = readDigit(); if (d1 == null) return null;
  const d2 = readDigit(); if (d2 == null) return null;
  const ddStr = d1 + d2;

  // must end at final N
  if (i !== tokens.length - 1) return null;

  const mm = parseInt(mmStr, 10);
  const dd = parseInt(ddStr, 10);

  if (!(mm >= 1 && mm <= 12)) return null;
  if (!(dd >= 1 && dd <= 31)) return null;

  return { mm, dd };
}

function nanpaCapsIsValidDate(caps) {
  return nanpaCapsDecodeDateStrict(caps) != null;
}

function nanpaCapsIsValidTimeOrDate(caps) {
  return nanpaCapsIsValidTime(caps) || nanpaCapsIsValidDate(caps);
}

function findTimeSequencesWithCaps(text) {
  const s = String(text ?? "");
  if (!s) return [];

  // No lookbehind: boundary is group 1, time is group 2
  const re = /(^|[^0-9])(\d{1,2}:[0-5]\d(?::[0-5]\d)?)(?!\d)/g;

  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const lead = m[1] ?? "";
    const raw = m[2];
    if (!raw) continue;

    const start = (m.index | 0) + String(lead).length;
    const end = start + raw.length;

    const caps = timeStrToNanpaCaps(raw);
    if (caps != null) out.push({ kind: "time", match: raw, index: start, end, caps });
  }
  return out;
}

function findDateSequencesWithCaps(text) {
  const s = String(text ?? "");
  if (!s) return [];

  // No lookbehind: boundary in group 1, date in group 2.
  // Accept "-", "/", ":" (and unicode variants after normalization occurs inside dateStrToNanpaCaps).
  const re = /(^|[^0-9])(\d{4}[:\/-]\d{2}[:\/-]\d{2})(?!\d)/g;

  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const lead = m[1] ?? "";
    const raw = m[2];
    if (!raw) continue;

    const start = (m.index | 0) + String(lead).length;
    const end = start + raw.length;

    const caps = dateStrToNanpaCaps(raw);
    if (caps != null) out.push({ kind: "date", match: raw, index: start, end, caps });
  }
  return out;
}


function numberStrToNanpaCaps(
      s,
      { thousandsChar = ",", groupFractionTriplets = true, fractionGroupSize = 3 } = {}
    ) {
      if (s == null) throw new Error("s must be a string");
      let raw = normalizeLooseSeparators(String(s));
      if (!raw) throw new Error("Empty value cannot be encoded");

      if (groupFractionTriplets) {
        raw = groupFractionDigitsOnly(raw, ".", fractionGroupSize, "_");
      }

      function stripFinalTerminator(segCaps) {
        if (!segCaps) return segCaps;
        if (!segCaps.endsWith("N")) throw new Error(`Segment caps did not end with 'N': ${segCaps}`);
        return segCaps.slice(0, -1);
      }

      function encodeSingleNumberSegment(segment, includeInitialNe) {
        let seg = String(segment).trim();
        if (seg === "") throw new Error(`Empty numeric segment in ${s}`);

        if (seg.slice(0, 1).toUpperCase() === "N") {
          seg = seg.slice(1).trim();
          if (seg === "") throw new Error(`Missing numeric part after leading 'N' prefix in ${s}`);
        }

        const out = [];
        if (includeInitialNe) out.push("NE");

        function pushNene() {
          const L = out.length;
          if (L >= 2 && out[L-2] === "NE" && out[L-1] === "NE") return;
          out.push("NE", "NE");
        }

        if (seg.startsWith("-")) {
          if (seg.startsWith("-.")) seg = "-0." + seg.slice(2);
          out.push("NO");
          seg = seg.slice(1).trim();
        }

        let magnitudeSuffixKeCount = 0;
        if (seg.length > 0) {
          const last = seg.slice(-1).toUpperCase();
          if (last === "K" || last === "T" || last === "M" || last === "B") {
            magnitudeSuffixKeCount =
              (last === "K" || last === "T") ? 1 :
              (last === "M") ? 2 : 3;
            seg = seg.slice(0, -1).trim();
            if (!seg) throw new Error(`Missing numeric part before magnitude suffix ${last} in ${s}`);
          }
        }

        if ((seg.match(/\./g) || []).length > 1) {
          throw new Error(`Invalid numeric segment with multiple decimals: ${segment}`);
        }

        let intPart = seg;
        let fracPart = "";
        let hasDecimal = false;
        if (seg.includes(".")) {
          [intPart, fracPart] = seg.split(".", 2);
          hasDecimal = true;
        }

        let ip = String(intPart ?? "").trim();
        if (ip === "") ip = "0";

        const intHasThousandsComma = (thousandsChar && ip.includes(thousandsChar));
        const hasLooseSep = /[ -]/.test(ip);

        if (hasLooseSep) {
          let ip2 = String(ip)
            .replace(/\s+/g, " ")
            .replace(/-+/g, "-")
            .trim();

          ip2 = ip2.replace(/^[ -]+/, "").replace(/[ -]+$/, "");
          if (ip2 === "") ip2 = "0";

          for (const ch of ip2) {
            if (/\d/.test(ch)) { out.push(DEC_DIGIT_TO_TOKEN[ch]); continue; }
            if (ch === " " || ch === "-") { pushNene(); continue; }
            if (thousandsChar && ch === thousandsChar) { out.push("NE","KE"); continue; }
            throw new Error(`Unsupported character "${ch}" in integer part of "${s}"`);
          }
        } else {
          const groups = thousandsChar ? ip.split(thousandsChar) : [ip];
          for (const g of groups) {
            if (g === "" || !/^\d+$/.test(g)) throw new Error(`Invalid integer group "${g}" in "${s}"`);
          }

          let trailingZeroGroups = 0;
          for (let k = groups.length - 1; k >= 1; k--) {
            const g = groups[k];
            if (g.length === 3 && g === "000") trailingZeroGroups += 1;
            else break;
          }

          for (const d of groups[0]) out.push(DEC_DIGIT_TO_TOKEN[d]);

          const nGroups = groups.length;
          const lastNonTrailingIdx = nGroups - trailingZeroGroups;

          for (let idx = 1; idx < lastNonTrailingIdx; idx++) {
            out.push("NE","KE");
            for (const d of groups[idx]) out.push(DEC_DIGIT_TO_TOKEN[d]);
          }

          if (trailingZeroGroups > 0) {
            out.push("NE");
            let remaining = trailingZeroGroups;
            while (remaining > 0) {
              const chunk = Math.min(3, remaining);
              if (out[out.length - 1] !== "NE") out.push("NE");
              out.push("KE".repeat(chunk));
              remaining -= chunk;
              if (remaining > 0) out.push("NE");
            }
          }
        }

        if (hasDecimal) {
          out.push("NO","NE");

          if (!fracPart) throw new Error(`Missing fraction digits after '.' in "${s}"`);

          for (const ch of fracPart) {
            if (/\d/.test(ch)) { out.push(DEC_DIGIT_TO_TOKEN[ch]); continue; }
            if (ch === "_") { pushNene(); continue; }
            if (ch === ",") { pushNene(); continue; }
            if (ch === " " || ch === "-") { pushNene(); continue; }
            throw new Error(`Unsupported character "${ch}" in fraction part of "${s}"`);
          }
        }

        if (magnitudeSuffixKeCount > 0) {
          out.push("NE");
          let remaining = magnitudeSuffixKeCount;
          while (remaining > 0) {
            const chunk = Math.min(3, remaining);
            if (out[out.length - 1] !== "NE") out.push("NE");
            out.push("KE".repeat(chunk));
            remaining -= chunk;
            if (remaining > 0) out.push("NE");
          }
        }

        out.push("N");
        return out.join("");
      }

      if (raw.includes("+")) {
        const [left, right] = raw.split("+", 2);
        let leftCaps = encodeSingleNumberSegment(left, true);

        if (!right.includes("/")) throw new Error(`Mixed number must contain '/' after '+': ${s}`);
        const [num, den] = right.split("/", 2);

        let numCaps = encodeSingleNumberSegment(num, false);
        let denCaps = encodeSingleNumberSegment(den, false);

        leftCaps = stripFinalTerminator(leftCaps);
        numCaps = stripFinalTerminator(numCaps);

        return leftCaps + "NONONO" + numCaps + "NONO" + denCaps;
      }

      if (raw.includes("/")) {
        const [num, den] = raw.split("/", 2);
        let numCaps = encodeSingleNumberSegment(num, true);
        let denCaps = encodeSingleNumberSegment(den, false);
        numCaps = stripFinalTerminator(numCaps);
        return numCaps + "NONO" + denCaps;
      }

      return encodeSingleNumberSegment(raw, true);
}

function decimalStringToCaps(rawDecimal, opts = {}) {
  let s = String(rawDecimal ?? "").trim();
  if (!s) throw new Error("Empty decimal.");

  // NEW: allow trailing percent sign
  let hasPercent = false;
  if (/%\s*$/.test(s)) {
    hasPercent = true;
    s = s.replace(/%\s*$/, "").trim();
  }

  const normalized = normalizeVulgarFractionInput(s);

  const capsCore = looksLikeNanpaCaps(normalized)
    ? normalized.toUpperCase()
    : numberStrToNanpaCaps(normalized, opts);

  // Ensure valid caps before we tack on OK
  tokenizeNanpaCaps(capsCore);

  if (!hasPercent) return capsCore;

  // Insert OK before final N (terminator)
  if (!capsCore.endsWith("N")) throw new Error("Nanpa caps must end in N.");
  const caps = capsCore.slice(0, -1) + "OKN";

  tokenizeNanpaCaps(caps);
  return caps;
}


function findDecimalSequencesWithCaps(text, opts = {}) {
  const original = String(text ?? "");
  if (!original) return [];

  const s = original.replace(/[−‒–—]/g, "-");

  const vulgarChars = "¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞↉";
  const re = new RegExp(
    String.raw`(?<![A-Za-z])` +
    String.raw`(` +
      String.raw`-?\s*\d*\s*[${vulgarChars}]` +
      "|" +
      String.raw`-?\s*\d[\d, _-]*\s*\+\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
      "|" +
      String.raw`-?\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
      "|" +
      String.raw`-?\s*(?:\d[\d, _-]*|\.\d+)(?:\.\d[\d, _-]*)?(?:\s*[kKtTmMbB])?` +
    String.raw`)` +
    String.raw`(?:\s*%)?` +          // NEW: allow trailing %
    String.raw`(?![A-Za-z])`,
    "g"
  );

  const results = [];
  let m;

  while ((m = re.exec(s)) !== null) {
    const rawMatch = m[0]; // includes optional trailing %
    if (!rawMatch) continue;

    let candidate = rawMatch.trim().replace(/[)\]}.,;:!?]+$/g, "").trim();
    if (!candidate) continue;
    if (candidate === "-" || candidate === "+") continue;

    const rel = rawMatch.indexOf(candidate);
    const start = (rel >= 0) ? (m.index + rel) : m.index;
    const end = start + candidate.length;

    try {
      const hasPercent = /%\s*$/.test(candidate);
      const candidateNoPct = hasPercent ? candidate.replace(/%\s*$/, "").trim() : candidate;

      let caps = decimalStringToCaps(candidateNoPct, {
        thousandsChar: ",",
        groupFractionTriplets: true,
        fractionGroupSize: 3,
        ...opts,
      });

      // Append OK before the terminator N
      if (hasPercent) {
        if (!caps.endsWith("N")) throw new Error("decimalStringToCaps must end with N");
        caps = caps.slice(0, -1) + "OKN";
      }

      results.push({ kind: "decimal", match: candidate, index: start, end, caps });

    } catch {
      // ignore
    }
  }

  results.sort((a, b) => a.index - b.index || b.end - a.end);
  const filtered = [];
  let lastEnd = -1;
  for (const r of results) {
    if (r.index < lastEnd) continue;
    filtered.push(r);
    lastEnd = r.end;
  }
  return filtered;
}


function findNumberCodeSequencesWithCaps(text) {
  const s = String(text ?? "");
  if (!s) return [];

  const re = /#~[A-Za-z]+/g;
  const out = [];
  let m;

  while ((m = re.exec(s)) !== null) {
    const raw = m[0];
    if (!raw) continue;

    const start = m.index | 0;
    const end = start + raw.length;

    try {
      const parsed = tryParseNanpaLinjanNumberCodeToCaps(raw);
      if (parsed?.caps) out.push({ kind: "code", index: start, end, caps: parsed.caps });
    } catch {
      // ignore
    }
  }

  return out;
}

function findNanpaLinjanProperNameSequencesWithCaps(text) {
  const s = String(text ?? "");
  if (!s) return [];

  const re = /(^|[^A-Za-z])((?:ne)[A-Za-z]*(?:\s+[A-Za-z]{2,}){0,20}[A-Za-z]*[nN])(?![A-Za-z])/gi;

  const hits = [];
  let m;

  while ((m = re.exec(s)) !== null) {
    const lead = m[1] ?? "";
    const rawMatch = m[2] ?? "";
    if (!rawMatch) continue;

    const start = (m.index | 0) + lead.length;
    const end = start + rawMatch.length;

    const compact = rawMatch.replace(/\s+/g, "");
    if (compact.length < 5) continue;
    if (!isValidNanpaLinjanProperName(compact)) continue;

    const core = compact.slice(0, -1); // drop final N

    let caps;
    const coreUpper = core.toUpperCase();

    // NEW: treat trailing NOKE as percent marker -> OK before final N
    if (coreUpper.endsWith("NOKE")) {
      const base = coreUpper.slice(0, -4);
      if (!base) continue;
      caps = base + "OKN";
    } else {
      caps = coreUpper + "N";
    }

    hits.push({ kind: "name", index: start, end, caps });

  }

  return hits;
}

function findNanpaLinjanTpPhraseSequences(text) {
  const s = String(text ?? "");
  if (!s) return [];

  const tokens = [];
  const reTok = /\S+/g;
  let m;
  while ((m = reTok.exec(s)) !== null) {
    const raw = m[0];
    tokens.push({
      raw,
      norm: normalizeTpWord(raw),
      start: m.index,
      end: (m.index + raw.length)
    });
  }
  if (tokens.length < 3) return [];

  const digitWords = new Set(Object.values(TOKEN_TO_DIGIT_WORD));
  const hits = [];

  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].norm !== "nanpa") continue;
    const n1 = tokens[i + 1]?.norm;
    if (!(n1 === "esun" || n1 === "en")) continue;

    let bestJ = -1;
    let bestWords = null;

    for (let j = i + 2; j < tokens.length; j++) {
      if (tokens[j].norm !== "nanpa") continue;

      const words = [];
      let allOk = true;
      let hasDigit = false;

      for (let k = i; k <= j; k++) {
        const w = tokens[k].norm;
        if (!w) { allOk = false; break; }
        if (NANPA_LINJA_N_WORD_TO_CP[w] == null) { allOk = false; break; }
        if (k >= i + 2 && k <= j - 1 && digitWords.has(w)) hasDigit = true;
        words.push(w);
      }

      if (!allOk || !hasDigit) continue;

      bestJ = j;
      bestWords = words;
    }

    if (bestJ >= 0 && bestWords) {
      hits.push({
        kind: "tpPhrase",
        index: tokens[i].start,
        end: tokens[bestJ].end,
        words: bestWords
      });
      i = bestJ;
    }
  }

  return hits;
}

function mergeAndGreedyFilterHits(allHits) {
  const hits = Array.from(allHits ?? []).filter(h =>
    h &&
    Number.isFinite(h.index) &&
    Number.isFinite(h.end) &&
    h.end > h.index &&
    (h.caps || (Array.isArray(h.words) && h.words.length > 0))
  );

  function priority(kind) {
    if (kind === "decimal") return 4;
    if (kind === "time") return 4;
    if (kind === "date") return 4;
    if (kind === "tpPhrase") return 3;
    if (kind === "code") return 2;
    return 1; // proper name
  }

  hits.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    const la = (a.end - a.index);
    const lb = (b.end - b.index);
    if (la !== lb) return lb - la;
    return priority(b.kind) - priority(a.kind);
  });

  const out = [];
  let lastEnd = -1;

  for (const h of hits) {
    if (h.index < lastEnd) continue;
    out.push(h);
    lastEnd = h.end;
  }

  return out;
}

function nanpaLinjanWordsToCodepoints(words, { mode = "uniform" } = {}) {
  const cps = [];
  for (const w0 of (words ?? [])) {
    const w = normalizeTpWord(w0);
    const cp = NANPA_LINJA_N_WORD_TO_CP[w];
    if (cp == null) return null;
    cps.push(cp);
  }
  if (mode === "uniform") return uniformizeNanpaLinjanCartoucheCps(cps);
  return cps;
}

function tpWordsToCodepoints(wordsOrTokens) {
  const cps = [];
  for (const w of (wordsOrTokens ?? [])) {
    const cp = MULTI_LINE_WORD_TO_UCSUR_CP[w];
    if (cp != null) cps.push(cp);
  }
  return cps;
}

/* ============================================================
   Segment splitting: plain text, [bracket], "quote"
   ============================================================ */
function splitLineIntoSegments(line) {
  const s = String(line ?? "");
  const out = [];

  let i = 0;
  function pushTextSegment(txt) { if (txt) out.push({ kind: "text", value: txt }); }

  while (i < s.length) {
    const ch = s[i];

    if (ch === "[") {
      const j = s.indexOf("]", i + 1);
      if (j < 0) { pushTextSegment(s.slice(i)); break; }
      pushTextSegment(s.slice(i, i)); // no-op, kept from your structure
      out.push({ kind: "bracket", value: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let found = false;
      while (j < s.length) {
        if (s[j] === '"' && s[j - 1] !== "\\") { found = true; break; }
        j++;
      }
      if (!found) { pushTextSegment(s.slice(i)); break; }
      out.push({ kind: "quote", value: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    let j = i;
    while (j < s.length && s[j] !== "[" && s[j] !== '"') j++;
    pushTextSegment(s.slice(i, j));
    i = j;
  }

  return out;
}

/* ============================================================
   Elements model + builders
   ============================================================ */
function pushGapIfNeeded(elements, px) {
  if (elements.length === 0) return;
  const last = elements[elements.length - 1];
  if (last && last.type === "gap") return;
  elements.push({ type: "gap", px: px });
}

function renderFontCartoucheToCanvas(
  canvas,
  innerCps,
  {
    fontPx,
    padPx,
    fontFamily,
    fgCss,

    // NEW: halo (optional)
    haloEnabled = false,
    haloCss = "#FFFFFF",
    haloThicknessMode = "auto",
    haloThickness = 0,
  } = {}
) {
  if (!canvas) throw new Error("renderFontCartoucheToCanvas: canvas missing");
  if (!innerCps || innerCps.length === 0) return { w: 0, h: 0, baselineY: 0 };

  const px = fontPx;
  const pad = padPx;
  const fam = fontFamily || FONT_FAMILY_TEXT;

  const run =
    String.fromCodePoint(CARTOUCHE_START_CP) +
    innerCps.map(cp => String.fromCodePoint(cp)).join("") +
    String.fromCodePoint(CARTOUCHE_END_CP);

  // Decide halo width in *cartouche canvas pixels*
  let haloW = 0;
  if (haloEnabled) {
    haloW =
      (haloThicknessMode === "manual" && Number.isFinite(haloThickness) && haloThickness > 0)
        ? clampHaloThicknessPx(haloThickness)
        : defaultHaloThicknessForFontPx(px);
  }

  // Measure
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  ctx.font = `${px}px "${fam}"`;
  setTextQuality(ctx);
  const m = ctx.measureText(run);

  const ascent  = (m.actualBoundingBoxAscent  != null) ? m.actualBoundingBoxAscent  : Math.ceil(px * 0.95);
  const descent = (m.actualBoundingBoxDescent != null) ? m.actualBoundingBoxDescent : Math.ceil(px * 0.35);

  const left  = (m.actualBoundingBoxLeft  != null) ? m.actualBoundingBoxLeft  : 0;
  const right = (m.actualBoundingBoxRight != null) ? m.actualBoundingBoxRight : Math.ceil(m.width);

  // IMPORTANT: expand canvas for halo so it won't clip
  const w = Math.max(1, Math.ceil(left + right + pad * 2 + haloW * 2));
  const h = Math.max(1, Math.ceil(ascent + descent + pad * 2 + haloW * 2));

  canvas.width = w;
  canvas.height = h;

  const ctx2 = canvas.getContext("2d", { alpha: true });
  ctx2.clearRect(0, 0, w, h);
  ctx2.textBaseline = "alphabetic";
  ctx2.font = `${px}px "${fam}"`;
  setTextQuality(ctx2);

  const x = pad + left + haloW;
  const baselineY = pad + ascent + haloW;

  // NEW: halo behind fill
  if (haloW > 0) {
    ctx2.strokeStyle = haloCss || "#FFFFFF";
    ctx2.lineWidth = haloW;
    ctx2.lineJoin = "round";
    ctx2.miterLimit = 2;
    ctx2.strokeText(run, x, baselineY);
  }

  ctx2.fillStyle = fgCss || "#111";
  ctx2.fillText(run, x, baselineY);

  return { w, h, baselineY, inkAscent: Math.ceil(ascent), inkDescent: Math.ceil(descent), haloW, pad};
}

function makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily, fgCss, 
  // IMPORTANT: do NOT default these to "false"/"#fff"/"auto"/0
    // Leave them undefined so we can inherit ACTIVE_SITELEN_HALO.
    haloEnabled,
    haloCss,
    haloThicknessMode,
    haloThickness, 
  } = {}) {
  if (!cps || cps.length === 0) return;
  pushGapIfNeeded(elements, cartoucheLeadGapForPx(fontPx));

  // If caller didn’t pass halo options, inherit from the current sitelen render
 const _he = (haloEnabled === undefined || haloEnabled === null)
  ? !!ACTIVE_SITELEN_HALO.enabled
  : !!haloEnabled;

  const _hc = (haloCss === undefined || haloCss === null)
    ? ACTIVE_SITELEN_HALO.css
    : haloCss;

  const _hm = (haloThicknessMode === undefined || haloThicknessMode === null)
    ? ACTIVE_SITELEN_HALO.mode
    : haloThicknessMode;

  const _ht = (haloThickness === undefined || haloThickness === null)
    ? ACTIVE_SITELEN_HALO.thickness
    : haloThickness;

  const cart = document.createElement("canvas");
  const padPx = Math.max(4, Math.round(fontPx * 0.11));

  const r = renderFontCartoucheToCanvas(cart, cps, { fontPx, padPx, fontFamily, fgCss, haloEnabled: _he, haloCss: _hc, haloThicknessMode: _hm, haloThickness: _ht });
  if ((r.w | 0) <= 0 || (r.h | 0) <= 0) return;

  const baselineY = r.baselineY | 0;

  //const ascent = baselineY;
  //const descent = (r.h | 0) - baselineY;
  const ascent = r.inkAscent ?? baselineY;
  const descent = r.inkDescent ?? ((r.h | 0) - baselineY);

  elements.push({
    type: "cartouche",
    cps: Array.from(cps),   // <-- ADD THIS
    canvas: cart,
    w: r.w,
    h: r.h,
    baselineY,
    ascent,
    descent,
    fontFamily: fontFamily || FONT_FAMILY_TEXT
  });
}

function makeRunElementFromCodepoints(elements, cps, { fontPx, fontFamily }) {
  if (!cps || cps.length === 0) return;
  pushGapIfNeeded(elements, wordGapForPx(fontPx));
  elements.push({
    type: "run",
    cps: Array.from(cps),
    px: fontPx,
    fontFamily: fontFamily || FONT_FAMILY_TEXT
  });
}

function makeLiteralTextElement(elements, text, { fontPx, fontFamily }) {
  const s = String(text ?? "");
  if (!s) return;
  pushGapIfNeeded(elements, wordGapForPx(fontPx));
  elements.push({
    type: "text",
    text: s,
    px: fontPx,
    fontFamily: fontFamily || FONT_FAMILY_LITERAL
  });
}

/* ============================================================
   Token rendering for plain text segments (words + punctuation)
   ============================================================ */
function renderTpWordsFromText(text, elements, { fontPx, mode }) {
  const rawTokens = String(text ?? "").trim().split(/\s+/).filter(Boolean);

  function emitPunctGlyph(ch) {
    if (ch !== ":" && ch !== "·" && ch !== "," && ch !== ".") return false;
    const cp = MULTI_LINE_WORD_TO_UCSUR_CP[ch];
    if (cp == null) return false;
    pushGapIfNeeded(elements, wordGapForPx(fontPx));
    elements.push({ type: "glyph", cp, px: fontPx, fontFamily: FONT_FAMILY_TEXT });
    return true;
  }

  function splitTokenPunct(tok) {
    const s = String(tok ?? "");
    if (!s) return { lead: "", core: "", trail: "" };

    const numericLike =
      /[0-9]/.test(s) ||
      /^-?\.\d/.test(s) ||
      /^-?\d/.test(s);

    const coreChar = numericLike
      ? /[#~A-Za-z0-9^<>.,_-]/
      : /[#~A-Za-z0-9^<>]/;

    let a = 0;
    let b = s.length;

    while (a < b && !coreChar.test(s[a])) a++;
    while (b > a && !coreChar.test(s[b - 1])) b--;

    // strip typical sentence punctuation at end of token
    while (b > a && /[)\]}.,;:!?]+$/.test(s.slice(b - 1, b))) b--;

    return { lead: s.slice(0, a), core: s.slice(a, b), trail: s.slice(b) };
  }

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    const normTok = normalizeTpWord(tok);

    // long pi: pi { ... }
    if (normTok === "pi") {
      const nextTok = rawTokens[i + 1];
      if (nextTok != null && tokenHasOpenCurly(nextTok)) {
        const extracted = extractCurlyContentFromTokens(rawTokens, i + 1);
        if (extracted && extracted.inner != null) {
          const innerWords = parseKnownTpWords(extracted.inner);
          if (innerWords.length >= 2) {
            const cps = [];
            cps.push(LONG_PI_START_CP);
            cps.push(MULTI_LINE_WORD_TO_UCSUR_CP[innerWords[0]]);
            for (let k = 1; k < innerWords.length; k++) {
              cps.push(LONG_PI_EXT_CP);
              cps.push(MULTI_LINE_WORD_TO_UCSUR_CP[innerWords[k]]);
            }
            makeRunElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_TEXT });
            i = extracted.endIndex;
            continue;
          }
        }
      }
    }

    const { lead, core, trail } = splitTokenPunct(tok);
    for (const ch of lead) emitPunctGlyph(ch);

    const trimmed = core;

    // identifier cartouche: #~... or NE...n proper-name
    if (trimmed) {
      const idCps =
        tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed, { mode }) ??
        tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed.replace(/\s+/g, ""), { mode });

      if (idCps && idCps.length) {
        makeCartoucheElementFromCodepoints(elements, idCps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE });
        for (const ch of trail) emitPunctGlyph(ch);
        continue;
      }
    }

    // numeric/time cartouche fallback:
    // If the token contains digits, try to render it as a nanpa-linja-n cartouche
    // before falling back to glyph-key normalization (which strips digits).
    if (trimmed && /[0-9]/.test(trimmed)) {
      // 1) Time-like: allow optional quotes around ':' so 23":"45 => 23:45
      const timeCandidate = trimmed.replace(/"\s*:\s*"/g, ":").replace(/"\s*:\s*/g, ":").replace(/\s*:\s*"/g, ":");
      const timeCaps = (typeof timeStrToNanpaCaps === "function") ? timeStrToNanpaCaps(timeCandidate) : null;

      if (timeCaps) {
        const cps = nanpaCapsToNanpaLinjanCodepoints(timeCaps, { mode, isTime: true });
        if (cps && cps.length) {
          makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE });
          for (const ch of trail) emitPunctGlyph(ch);
          continue;
        }
      }

      // 2) Decimal/integer-like: try the existing decimal parser (it already accepts integers)
      try {
        const caps = decimalStringToCaps(trimmed, {
          thousandsChar: ",",
          groupFractionTriplets: true,
          fractionGroupSize: 3
        });
        const cps = nanpaCapsToNanpaLinjanCodepoints(caps, { mode });
        if (cps && cps.length) {
          makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE });
          for (const ch of trail) emitPunctGlyph(ch);
          continue;
        }
      } catch {
        // not a valid numeric; fall through to normal glyph handling
      }
    }

    // normal word glyph
    const glyphKey = normalizeTpGlyphKey(trimmed);
    if (glyphKey && MULTI_LINE_WORD_TO_UCSUR_CP[glyphKey] != null) {
      pushGapIfNeeded(elements, wordGapForPx(fontPx));
      elements.push({ type: "glyph", cp: MULTI_LINE_WORD_TO_UCSUR_CP[glyphKey], px: fontPx, fontFamily: FONT_FAMILY_TEXT });
    }

    for (const ch of trail) emitPunctGlyph(ch);
  }
}

/* ============================================================
   Segment parsers: text / bracket / quote
   ============================================================ */
function parseTextSegmentToElements(segmentText, elements, { fontPx, mode, fgCss = "#000111" ,literalFontFamily}) {
  const s = String(segmentText ?? "");
  if (!s.trim()) return;

  const timeHits   = findTimeSequencesWithCaps(s);
  const dateHits = findDateSequencesWithCaps(s);
  const decHits    = findDecimalSequencesWithCaps(s);
  const codeHits   = findNumberCodeSequencesWithCaps(s);
  const nameHits   = findNanpaLinjanProperNameSequencesWithCaps(s);
  const phraseHits = findNanpaLinjanTpPhraseSequences(s);

  const hits = mergeAndGreedyFilterHits([...timeHits, ...dateHits, ...decHits, ...phraseHits, ...codeHits, ...nameHits]);

  if (!hits || hits.length === 0) {
    renderTpWordsFromText(s, elements, { fontPx, mode });
    return;
  }

  let pos = 0;

  for (const h of hits) {
    const a = Math.max(0, h.index | 0);
    const b = Math.max(a, h.end | 0);

    if (a > pos) {
      renderTpWordsFromText(s.slice(pos, a), elements, { fontPx, mode });
    }

    if (h.kind === "tpPhrase") {
      const cps = nanpaLinjanWordsToCodepoints(h.words, { mode });
      if (cps && cps.length) {
        makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, fgCss });
      } else {
        renderTpWordsFromText(s.slice(a, b), elements, { fontPx, mode });
      }
    } else {
      const isTimeLike = (h.kind === "time") || (h.kind === "date") || nanpaCapsIsValidTimeOrDate(h.caps);
      const cps = nanpaCapsToNanpaLinjanCodepoints(h.caps, { mode, isTime: isTimeLike });
      if (cps && cps.length) {
        makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, fgCss });
      } else {
        renderTpWordsFromText(s.slice(a, b), elements, { fontPx, mode });
      }
    }

    pos = b;
  }

  if (pos < s.length) {
    renderTpWordsFromText(s.slice(pos), elements, { fontPx, mode });
  }
}

function parseQuoteSegmentToElements(quoteContent, elements, { fontPx, literalFontFamily } = {}) {
  const raw = String(quoteContent ?? "");
  let literal = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  literal = literal.replace(/\t/g, "    ");
  if (literal.length === 0) return;

  const fam = String(literalFontFamily ?? "").trim() || FONT_FAMILY_LITERAL;
  makeLiteralTextElement(elements, literal, { fontPx, fontFamily: fam });
}


function parseBracketSegmentToElements(bracketContent, elements, { fontPx, mode, fgCss = "#000111", literalFontFamily }) {
  const content = String(bracketContent ?? "").trim();
  if (!content) return;

  // Use the same scanners as plain text, but require a FULL-CONTENT hit.
  const timeHits = findTimeSequencesWithCaps(content);
  const dateHits = findDateSequencesWithCaps(content);
  const decHits    = findDecimalSequencesWithCaps(content);
  const codeHits   = findNumberCodeSequencesWithCaps(content);
  const nameHits   = findNanpaLinjanProperNameSequencesWithCaps(content);
  const phraseHits = findNanpaLinjanTpPhraseSequences(content);

  const hits = mergeAndGreedyFilterHits([...timeHits, ...dateHits, ...decHits, ...phraseHits, ...codeHits, ...nameHits]);
  const full = (hits || []).find(h => (h.index|0) === 0 && (h.end|0) === content.length);

  if (full) {
    if (full.kind === "tpPhrase") {
      const cps = nanpaLinjanWordsToCodepoints(full.words, { mode });
      if (cps && cps.length) {
        makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, fgCss });
        return;
      }
    } else {
      const isTimeLike = (full.kind === "time") || (full.kind === "date") || nanpaCapsIsValidTimeOrDate(full.caps);
      const cps = nanpaCapsToNanpaLinjanCodepoints(full.caps, { mode, isTime: isTimeLike });
      if (cps && cps.length) {
        makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, fgCss });
        return;
      }
    }
    // If scanner matched but conversion failed, fall through to legacy behavior.
  }

  // Legacy behavior (unchanged):
  const idCps =
    tryDecodeNanpaLinjanIdentifierToCodepoints(content, { mode }) ??
    tryDecodeNanpaLinjanIdentifierToCodepoints(content.replace(/\s+/g, ""), { mode });

  if (idCps && idCps.length) {
    makeCartoucheElementFromCodepoints(elements, idCps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, fgCss });
    return;
  }

  const wordsRaw = content.split(/\s+/).filter(Boolean);
  const glyphTokens = wordsRaw.map(normalizeTpGlyphToken).filter(Boolean);
  if (glyphTokens.length >= 1 && glyphTokens.every(isKnownTpWordKey)) {
    makeCartoucheElementFromCodepoints(elements, tpWordsToCodepoints(glyphTokens), { fontPx, fontFamily: FONT_FAMILY_TEXT, fgCss });
    return;
  }

  makeCartoucheElementFromCodepoints(elements, lettersToRandomGlyphCps(content), { fontPx, fontFamily: FONT_FAMILY_TEXT, fgCss });
}


/* ============================================================
   Line parsing: line → elements
   ============================================================ */
function lineToElements(line, { fontPx, mode = "uniform", fgCss = "#000111", literalFontFamily } = {}) {
  const segs = splitLineIntoSegments(line);
  const elements = [];

  for (const seg of segs) {
    if (seg.kind === "text") {
      parseTextSegmentToElements(seg.value, elements, { fontPx, mode, fgCss, literalFontFamily });
    } else if (seg.kind === "bracket") {
      parseBracketSegmentToElements(seg.value, elements, { fontPx, mode, fgCss, literalFontFamily });
    } else if (seg.kind === "quote") {
      parseQuoteSegmentToElements(seg.value, elements, { fontPx, literalFontFamily });
    }
  }

  while (elements.length > 0 && elements[elements.length - 1].type === "gap") elements.pop();
  return elements;
}

function parseMultilineToElements(multilineText, { fontPx, mode = "uniform", fgCss = "#000111", literalFontFamily } = {}) {
  const raw = String(multilineText ?? "");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  return lines.map(line => lineToElements(line, { fontPx, mode, fgCss, literalFontFamily }));
}

/* ============================================================
   Measuring primitives (used by bounding box and rendering)
   ============================================================ */
function measureTextRun(ctx, text, px, fontFamily) {
  const chars = String(text ?? "");
  ctx.font = `${px}px "${fontFamily}"`;
  setTextQuality(ctx);
  const m = ctx.measureText(chars);

  const ascent  = (m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8));
  const descent = (m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2));
  const w = Math.ceil(m.width);

  return { chars, ascent, descent, left: 0, w, h: Math.ceil(ascent + descent), px, fontFamily };
}

function measureGlyph(ctx, cp, px, fontFamily) {
  const ch = String.fromCodePoint(cp);
  ctx.font = `${px}px "${fontFamily}"`;
  setTextQuality(ctx);
  const m = ctx.measureText(ch);

  const ascent  = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
  const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

  const left = m.actualBoundingBoxLeft ?? 0;
  const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
  const tightW = Math.ceil(left + right);

  return { ch, ascent, descent, left, w: tightW, h: Math.ceil(ascent + descent), px, fontFamily };
}

function measureRun(ctx, cps, px, fontFamily) {
  const chars = (cps ?? []).map(cp => String.fromCodePoint(cp)).join("");
  ctx.font = `${px}px "${fontFamily}"`;
  setTextQuality(ctx);
  const m = ctx.measureText(chars);

  const ascent  = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
  const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

  const left = m.actualBoundingBoxLeft ?? 0;
  const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
  const tightW = Math.ceil(left + right);

  return { chars, ascent, descent, left, w: tightW, h: Math.ceil(ascent + descent), px, fontFamily };
}

/* ============================================================
   BOUNDING BOX: measure multi-line before drawing
   Returns: { width, height, padPx, lineGapPx, lines:[...lineMetrics...] }
   ============================================================ */
function measureMultiline(linesElements, { fontPx, padPx = DEFAULT_PAD_PX, lineGapPx = lineGapForPx(fontPx) } = {}) {
  const tmp = document.createElement("canvas");
  const ctx = tmp.getContext("2d");
  ctx.textBaseline = "alphabetic";

  const measuredLines = [];
  let maxLineW = 0;
  let totalH = 0;

  for (const lineEls of (linesElements ?? [])) {
    let w = 0;
    let maxAscent = 0;
    let maxDescent = 0;

    const measuredEls = [];

    for (const el of lineEls) {
      if (el.type === "text") {
        const fam = el.fontFamily || FONT_FAMILY_LITERAL;
        const r = measureTextRun(ctx, el.text, el.px ?? fontPx, fam);
        measuredEls.push({ ...el, m: r });
        w += r.w;
        if (r.ascent > maxAscent) maxAscent = r.ascent;
        if (r.descent > maxDescent) maxDescent = r.descent;
        continue;
      }

      if (el.type === "gap") {
        measuredEls.push(el);
        w += Math.max(0, el.px | 0);
        continue;
      }

      if (el.type === "glyph") {
        const fam = el.fontFamily || FONT_FAMILY_TEXT;
        const g = measureGlyph(ctx, el.cp, el.px ?? fontPx, fam);
        measuredEls.push({ ...el, m: g });
        w += g.w;
        if (g.ascent > maxAscent) maxAscent = g.ascent;
        if (g.descent > maxDescent) maxDescent = g.descent;
        continue;
      }

      if (el.type === "run") {
        const fam = el.fontFamily || FONT_FAMILY_TEXT;
        const r = measureRun(ctx, el.cps, el.px ?? fontPx, fam);
        measuredEls.push({ ...el, m: r });
        w += r.w;
        if (r.ascent > maxAscent) maxAscent = r.ascent;
        if (r.descent > maxDescent) maxDescent = r.descent;
        continue;
      }

      if (el.type === "cartouche") {
        measuredEls.push(el);
        w += (el.w | 0);

        const a = el.ascent ?? Math.ceil((el.h | 0) * 0.7);
        const d = el.descent ?? Math.ceil((el.h | 0) * 0.3);

        if (a > maxAscent) maxAscent = a;
        if (d > maxDescent) maxDescent = d;
        continue;
      }
    }

    const lineBoxH = Math.max(maxAscent + maxDescent, fontPx);
    measuredLines.push({ measuredEls, w, lineBoxH, maxAscent, maxDescent });

    if (w > maxLineW) maxLineW = w;
    totalH += lineBoxH;
  }

  totalH += Math.max(0, (measuredLines.length - 1) * lineGapPx);

  const width  = Math.max(1, Math.ceil(maxLineW + padPx * 2));
  const height = Math.max(1, Math.ceil(totalH  + padPx * 2));

  return { width, height, padPx, lineGapPx, lines: measuredLines };
}


/* ============================================================
   DRAW: render multi-line to a canvas (also computes bounding box)
   ============================================================ */
function renderMultilineToCanvas(outCanvas, linesElements, { fontPx, fgCss = "#000111", padPx = DEFAULT_PAD_PX, lineGapPx = lineGapForPx(fontPx), literalFontAlignment = "left", haloEnabled = false, haloCss = "#FFFFFF", haloThicknessMode = "auto", haloThickness = 0 } = {}) {
  if (!outCanvas) throw new Error("renderMultilineToCanvas: outCanvas missing");

  const box = measureMultiline(linesElements, { fontPx, padPx, lineGapPx });
  outCanvas.width = box.width;
  outCanvas.height = box.height;

  const outCtx = outCanvas.getContext("2d", { alpha: true });
  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  outCtx.textBaseline = "alphabetic";
  outCtx.fillStyle = fgCss;
  setTextQuality(outCtx);

  const _haloOn = !!haloEnabled;
  const _haloBasePx = _haloOn ? ((haloThicknessMode === "manual" && Number.isFinite(haloThickness) && haloThickness > 0)
    ? clampHaloThicknessPx(haloThickness)
    : defaultHaloThicknessForFontPx(fontPx)) : 0;
  if (_haloBasePx > 0){
    outCtx.strokeStyle = rgbaOrHexToHex(haloCss, "#FFFFFF");
    outCtx.lineWidth = _haloBasePx;
    outCtx.lineJoin = "round";
    outCtx.miterLimit = 2;
  }

  let y = box.padPx;

  for (let li = 0; li < box.lines.length; li++) {
    const L = box.lines[li];
    let x = box.padPx;

    //we can use alignment here to push x to the right  ??????????????
    //we get the line width from L
    const lineWidth = L.w;
    //we calculate extra space on this line
    const extraSpaceOnLine = Math.max( 0, box.width - lineWidth - box.padPx * 2 );
    //we push the starting x over depending on alignment
    if (literalFontAlignment === "center") x = x + extraSpaceOnLine / 2;
    if (literalFontAlignment === "right")  x = x + extraSpaceOnLine;


    const glyphBaseline = y + L.maxAscent;

    for (const el of L.measuredEls) {
      if (el.type === "text") {
        const m = el.m;
        const fam = el.fontFamily || FONT_FAMILY_LITERAL;
        outCtx.font = `${(el.px ?? fontPx)}px "${fam}"`;
        if (_haloBasePx > 0) outCtx.strokeText(m.chars, x, glyphBaseline);
        outCtx.fillText(m.chars, x, glyphBaseline);
        x += m.w;
        continue;
      }

      if (el.type === "gap") { x += Math.max(0, el.px | 0); continue; }

      if (el.type === "glyph") {
        const m = el.m;
        const fam = el.fontFamily || FONT_FAMILY_TEXT;
        outCtx.font = `${(el.px ?? fontPx)}px "${fam}"`;
        const drawX = x + (m.left ?? 0);
        if (_haloBasePx > 0) outCtx.strokeText(m.ch, drawX, glyphBaseline);
        outCtx.fillText(m.ch, drawX, glyphBaseline);
        x += m.w;
        continue;
      }

      if (el.type === "run") {
        const m = el.m;
        const fam = el.fontFamily || FONT_FAMILY_TEXT;
        outCtx.font = `${(el.px ?? fontPx)}px "${fam}"`;
        const drawX = x + (m.left ?? 0);
        if (_haloBasePx > 0) outCtx.strokeText(m.chars, drawX, glyphBaseline);
        outCtx.fillText(m.chars, drawX, glyphBaseline);
        x += m.w;
        continue;
      }

      if (el.type === "cartouche") {
        const by = (el.baselineY != null) ? (el.baselineY | 0) : Math.floor((el.h | 0) * 0.75);
        const drawY = glyphBaseline - by;
        outCtx.drawImage(el.canvas, x, drawY);
        x += el.w;
        continue;
      }
    }

    y += L.lineBoxH;
    if (li < box.lines.length - 1) y += box.lineGapPx;
  }

  return box; // return measured bbox/metrics for callers that want it
}

/* ============================================================
   Convenience: parse + measure + draw in one call
   ============================================================ */
function renderTextToCanvas(
  outCanvas,
  multilineText,
  {
    fontPx,
    mode = "uniform",
    fgCss = "#000111",
    padPx = DEFAULT_PAD_PX,
    lineGapPx = lineGapForPx(fontPx),
    literalFontFamily,            // NEW: accept it
    literalFontAlignment,   //New accept alignment

    // NEW: halo
    haloEnabled = false,
    haloCss = "#FFFFFF",
    haloThicknessMode = "auto",
    haloThickness = 0,
  } = {}
) {
  // NEW: forward literalFontFamily into the parser so "..." segments use the element’s font
  ACTIVE_SITELEN_HALO = { enabled: !!haloEnabled, css: haloCss, mode: haloThicknessMode, thickness: haloThickness };

  const linesEls = parseMultilineToElements(multilineText, {
    fontPx,
    mode,
    fgCss,
    literalFontFamily,
  });

  return renderMultilineToCanvas(outCanvas, linesEls, {
    fontPx,
    fgCss,
    padPx,
    lineGapPx,
    literalFontAlignment,

    haloEnabled,
    haloCss,
    haloThicknessMode,
    haloThickness,
  });
}






//******* end of new code for displaying sitelen elements

/* ============================================================
   Sitelen raster cache (text -> offscreen canvas)
   ------------------------------------------------------------
   This is the hook layer you requested.
   - Measure bbox for sitelen text (dummy now)
   - Allocate offscreen canvas
   - Draw sitelen onto offscreen (dummy now)
   - Resize element box to measured size
   - Draw like an image (drawImage), allowing rotate/stretch
   ============================================================ */

const sitelenCache = new Map(); // el.id -> { sig, canvas, naturalW, naturalH }
let sceneHydrating = false;


/** Build a signature so we only rebuild when relevant props change */
function sitelenSignature(el){
  return getElementRendererSignature(el);
}



function sitelenMeasureBBox(el){
  const cached = sitelenCache.get(el.id);
  if (cached && cached.canvas) return { w: Math.max(8, cached.naturalW), h: Math.max(8, cached.naturalH) };
  if (!sceneHydrating) queueSitelenRasterRebuild(el, sitelenLayoutOptsForElement(el));
  return { w: Math.max(8, Number(el.w ?? 8)), h: Math.max(8, Number(el.h ?? 8)) };
}



function sitelenRenderToOffscreen(el,w,h){
  const cached = sitelenCache.get(el.id);
  if (cached && cached.canvas) return cached.canvas;
  if (!sceneHydrating) queueSitelenRasterRebuild(el, sitelenLayoutOptsForElement(el));
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(w || el.w || 8));
  off.height = Math.max(1, Math.round(h || el.h || 8));
  return off;
}


/**
 * Ensure sitelen raster exists and is current.
 * Returns {canvas, naturalW, naturalH}
 */
function ensureSitelenRaster(el){
  if (el.type !== ElementType.Sitelen) return null;
  const sig = sitelenSignature(el);
  const existing = sitelenCache.get(el.id);
  if (existing && existing.sig === sig && existing.canvas) return existing;
  if (!sceneHydrating) queueSitelenRasterRebuild(el, sitelenLayoutOptsForElement(el));
  return existing || null;
}



/**
 * Recompute sitelen bbox + raster, and resize element box to match.
 * Call this whenever sitelen text/font settings change.
 */
// Resolve layout rebuild options from el.sitelenResizeAnchor.
// isTextEdit=true signals the call comes from typing (text content changed).
// isTextEdit=false means a style/property change — anchor behaviour still applies
// but "fixed" mode skips the w/h resize.
function sitelenLayoutOptsForElement(el, callerOpts, isTextEdit){
  const anchor = el.sitelenResizeAnchor || "topLeft"; // default for new elements
  if (anchor === "fixed"){
    // Fixed box: never resize w/h, never reposition.
    return { preserveTopLeft: true, fixedBox: true };
  }
  // The explicit preserve-center flag is authoritative for auto-resize anchoring.
  // When it is false, content/property-driven raster rebuilds keep x/y fixed.
  if (getElementPreserveCenterOnAutoResize(el)){
    return { preserveCenter: true };
  }
  return { preserveTopLeft: true };
}

function updateSitelenLayout(el, opts, isTextEdit){
  if (!el || el.type !== ElementType.Sitelen) return;
  const resolvedOpts = sitelenLayoutOptsForElement(el, opts, !!isTextEdit);
  queueSitelenRasterRebuild(el, resolvedOpts);
}


/** Clear sitelen cache for a single element (call when you replace your renderer) */
function invalidateSitelenCache(elId){
  sitelenCache.delete(elId);
}
function invalidateGlyphCache(elId){
  glyphCache.delete(elId);
}

function refreshAllSitelenElementsPreserveCenter(){
  for (const el of Scene.elements){
    if (el.type === ElementType.Sitelen){
      invalidateSitelenCache(el.id);
      updateSitelenLayout(el, { preserveCenter: true });
    }
  }
}

//clipboard:
/* ============================================================
   Copy / Cut / Paste clipboard
   ============================================================ */
const CLIPBOARD = {
  elements: null,          // deep-cloned element snapshots
  groups: null,            // deep-cloned group records (optional)
  hadSingleGroup: false,   // whether the selection was a single group
  sourceGroupId: null,     // original group id if selection was a single group
  pasteIndex: 0,           // increments each paste (for repeated offset)
  sourcePageId: null,      // page id at time of copy (for cross-page zero-offset first paste)
  lastPastePageId: null,   // page id of the most recent paste (resets offset counter on page change)
};

function selectionIdsArray(){
  return [...selectedIds];
}

function selectionIsEmpty(){
  return selectedIds.size === 0;
}

function cleanupGroupsAfterElementRemoval(){
  const used = new Set(Scene.elements.map(e => e.groupId).filter(Boolean));
  for (const gid of Object.keys(Scene.groups)){
    if (!used.has(gid)) delete Scene.groups[gid];
  }
}

function removeElementsByIds(idsSet){
  Scene.elements = Scene.elements.filter(e => !idsSet.has(e.id));
  cleanupGroupsAfterElementRemoval();
}




  /* ============================================================
     Selection, hit testing, handles
     ============================================================ */
  let activeTool = Tool.Select;

  /** @type {Set<string>} */
  let selectedIds = new Set(); // selected elements (or elements in selected group)

  // Last stage-space click point when a group was selected — used by the floating
  // editor to find the topmost text-like element whose bounding box contains the click.
  let _lastGroupClickPt = null;


//history undo/redo
/* ============================================================
   Undo / Redo (history)
   ------------------------------------------------------------
   - We snapshot the *model* (Scene + selection + active tool).
   - Commits happen on discrete actions (add/delete/paste/group),
     at end of drags, and on committed inspector edits.
   ============================================================ */

const History = {
  max: 40,
  undo: /** @type {Array<{snap:any, reason:string, ts:number}>} */([]),
  redo: /** @type {Array<{snap:any, reason:string, ts:number}>} */([]),
  lastSig: "",
  isRestoring: false
};



function snapshotForHistory(){
  if (ScrapbookState?.doc){
    return {
      kind: 'scrapbook-document',
      document: buildDocumentSnapshotForHistory(),
      currentPageId: ScrapbookState.currentPageId,
      selectionIds: Array.from(selectedIds),
      activeTool
    };
  }
  return {
    kind: 'scene',
    scene: deepClone({ stage: Scene.stage, view: Scene.view, elements: Scene.elements, groups: Scene.groups, meta: Scene.meta }),
    selectionIds: Array.from(selectedIds),
    activeTool
  };
}

function signatureForHistory(snap){
  const stable = deepClone(snap);
  if (stable?.kind === 'scrapbook-document' && stable.document){
    const doc = stable.document;
    if (Array.isArray(doc.pages)){
      for (const page of doc.pages){
        if (page && 'thumbnail' in page) page.thumbnail = '';
      }
    }
  }
  return JSON.stringify(stable);
}

function updateUndoRedoUi(){
  const btnUndo = $("btnUndo");
  const btnRedo = $("btnRedo");
  if (!btnUndo || !btnRedo) return;

  // Undo stack always contains the current state at the top.
  btnUndo.disabled = (History.undo.length <= 1);
  btnRedo.disabled = (History.redo.length === 0);

  const undoTop = History.undo.length > 0 ? History.undo[History.undo.length-1] : null;
  const redoTop = History.redo.length > 0 ? History.redo[History.redo.length-1] : null;

  btnUndo.title = undoTop ? `Undo (Ctrl/Cmd+Z)\nLast: ${undoTop.reason}` : "Undo (Ctrl/Cmd+Z)";
  btnRedo.title = redoTop ? `Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)\nNext: ${redoTop.reason}` : "Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)";
}

function historyReset(reason="Reset"){
  clearTimeout(_historyCommitTimer);
  History.undo.length = 0;
  History.redo.length = 0;

  const snap = snapshotForHistory();
  const sig = signatureForHistory(snap);
  History.lastSig = sig;

  History.undo.push({ snap, reason, ts: Date.now() });
  updateUndoRedoUi();
}

function historyCommit(reason){
  if (History.isRestoring) return;

  const snap = snapshotForHistory();
  const sig = signatureForHistory(snap);
  if (sig === History.lastSig) return;

  History.lastSig = sig;
  History.undo.push({ snap, reason, ts: Date.now() });

  if (History.undo.length > History.max) History.undo.shift();
  History.redo.length = 0;

  updateUndoRedoUi();
}

let _historyCommitTimer = null;
function historyCommitDebounced(reason, ms=250){
  if (History.isRestoring) return;
  clearTimeout(_historyCommitTimer);
  _historyCommitTimer = setTimeout(() => historyCommit(reason), ms);
}

async function applyHistorySnapshot(snap){
  History.isRestoring = true;
  try{
    History.lastSig = signatureForHistory(snap);

    if (snap?.kind === 'scrapbook-document' && ScrapbookState?.doc){
      await loadDocumentSnapshotIntoEditor(snap.document, 'History restore');
      selectedIds = new Set(Array.isArray(snap.selectionIds) ? snap.selectionIds : []);
      setTool(snap.activeTool || Tool.Select);
      updateUiForSelection();
      render();
      return;
    }

    const sceneSnap = snap?.scene || {};
    Scene.meta = deepClone(sceneSnap.meta || {});
    Scene.stage = deepClone(sceneSnap.stage || Scene.stage);
    Scene.view  = deepClone(sceneSnap.view || Scene.view);
    Scene.elements = deepClone(sceneSnap.elements || []);
    Scene.groups = deepClone(sceneSnap.groups || []);

    selectedIds = new Set(Array.isArray(snap.selectionIds) ? snap.selectionIds : []);
    setTool(snap.activeTool || Tool.Select);

    try{ clearAllSitelenCache && clearAllSitelenCache(); }catch(_){}
    try{ clearAllImageCache && clearAllImageCache(); }catch(_){}

    updateUiForSelection();
    render();
    scheduleAutosave();
  }finally{
    History.isRestoring = false;
    updateUndoRedoUi();
  }
}

async function syncCurrentStateIntoHistory(reason = 'Sync current state'){
  if (History.isRestoring) return;
  clearTimeout(_historyCommitTimer);
  if (ScrapbookState?.doc){
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(false);
  }
  const snap = snapshotForHistory();
  const sig = signatureForHistory(snap);
  if (sig === History.lastSig) return;
  History.lastSig = sig;
  History.undo.push({ snap, reason, ts: Date.now() });
  if (History.undo.length > History.max) History.undo.shift();
  History.redo.length = 0;
  updateUndoRedoUi();
}

async function historyUndo(){
  clearTimeout(_historyCommitTimer);
  if (ScrapbookState?.doc){
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(false);

    const currentSnap = snapshotForHistory();
    const currentSig = signatureForHistory(currentSnap);
    const top = History.undo.length ? History.undo[History.undo.length - 1] : null;
    const topSig = top ? signatureForHistory(top.snap) : "";

    if (!top) return;

    if (currentSig !== topSig){
      History.redo.push({ snap: currentSnap, reason: 'Live state before undo', ts: Date.now() });
      if (History.redo.length > History.max) History.redo.shift();

      if (History.undo.length <= 1){
        await applyHistorySnapshot(top.snap);
        setStatus(tr("status_undo"));
        return;
      }

      const currentCommitted = History.undo.pop();
      History.redo.push(currentCommitted);
      if (History.redo.length > History.max) History.redo.shift();
      const prev = History.undo[History.undo.length - 1];
      await applyHistorySnapshot(prev.snap);
      setStatus(tr("status_undo"));
      return;
    }

    if (History.undo.length <= 1) return;
    const current = History.undo.pop();
    History.redo.push(current);
    if (History.redo.length > History.max) History.redo.shift();
    const prev = History.undo[History.undo.length-1];
    await applyHistorySnapshot(prev.snap);
    setStatus(tr("status_undo"));
    return;
  }

  await syncCurrentStateIntoHistory('Sync before undo');
  if (History.undo.length <= 1) return;
  const current = History.undo.pop();
  History.redo.push(current);
  const prev = History.undo[History.undo.length-1];
  await applyHistorySnapshot(prev.snap);
  setStatus(tr("status_undo"));
}

async function historyRedo(){
  clearTimeout(_historyCommitTimer);
  if (History.redo.length === 0) return;
  if (ScrapbookState?.doc){
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(false);

    const currentSnap = snapshotForHistory();
    const currentSig = signatureForHistory(currentSnap);
    const top = History.undo.length ? History.undo[History.undo.length - 1] : null;
    const topSig = top ? signatureForHistory(top.snap) : "";

    const next = History.redo.pop();
    if (currentSig !== topSig){
      History.undo.push({ snap: currentSnap, reason: 'Live state before redo', ts: Date.now() });
    }
    History.undo.push(next);
    if (History.undo.length > History.max) History.undo.shift();
    await applyHistorySnapshot(next.snap);
    setStatus(tr("status_redo"));
    return;
  }

  const next = History.redo.pop();
  History.undo.push(next);
  await applyHistorySnapshot(next.snap);
  setStatus(tr("status_redo"));
}
//history undo/redo end





  function isSelected(elId){ return selectedIds.has(elId); }

  function getElementById(id){
    return Scene.elements.find(e => e.id === id) || null;
  }

  function selectionHasLocked(){
  for (const id of selectedIds){
    const el = getElementById(id);
    if (el && el.isLocked) return true;
  }
  return false;
}

  function getSelectedElements(){
    const out = [];
    for (const id of selectedIds){
      const el = getElementById(id);
      if (el) out.push(el);
    }
    return out;
  }

const MediaSession = {
  currentElementId: "", currentType: "", mediaEl: null, sourceUrl: "", pendingToken: 0,
  overlayHost: null, overlayNode: null, overlayInner: null, overlayKind: "", overlayYouTubeId: "", overlayRect: null,
  youtubeCurrentTime: 0, youtubePaused: true, overlayMuted: false, youtubePollTimer: 0,
  youtubePlayer: null, youtubeDuration: 0, youtubeResumeTimers: [], youtubePlayerReady: false
};

function getMediaRememberedPositionSec(el){
  if (!el) return 0;
  if (el.type === ElementType.Audio){
    if (!el.audio || typeof el.audio !== 'object') el.audio = {};
    return Math.max(0, Number(el.audio.playbackPositionSec || 0) || 0);
  }
  if (el.type === ElementType.Video){
    if (!el.video || typeof el.video !== 'object') el.video = {};
    return Math.max(0, Number(el.video.playbackPositionSec || 0) || 0);
  }
  if (el.type === ElementType.Url){
    if (!el.url || typeof el.url !== 'object') el.url = {};
    return Math.max(0, Number(el.url.playbackPositionSec || 0) || 0);
  }
  return 0;
}
function setMediaRememberedPositionSec(el, sec){
  if (!el) return;
  const safe = Math.max(0, Number(sec || 0) || 0);
  if (el.type === ElementType.Audio){
    if (!el.audio || typeof el.audio !== 'object') el.audio = {};
    el.audio.playbackPositionSec = safe;
  } else if (el.type === ElementType.Video){
    if (!el.video || typeof el.video !== 'object') el.video = {};
    el.video.playbackPositionSec = safe;
  } else if (el.type === ElementType.Url){
    if (!el.url || typeof el.url !== 'object') el.url = {};
    el.url.playbackPositionSec = safe;
  }
}
function getMediaRememberedMuted(el){
  if (!el) return false;
  if (el.type === ElementType.Audio){
    if (!el.audio || typeof el.audio !== 'object') el.audio = {};
    return !!el.audio.muted;
  }
  if (el.type === ElementType.Video){
    if (!el.video || typeof el.video !== 'object') el.video = {};
    return !!el.video.muted;
  }
  if (el.type === ElementType.Url){
    if (!el.url || typeof el.url !== 'object') el.url = {};
    return !!el.url.muted;
  }
  return false;
}
function setMediaRememberedMuted(el, muted){
  if (!el) return;
  const val = !!muted;
  if (el.type === ElementType.Audio){
    if (!el.audio || typeof el.audio !== 'object') el.audio = {};
    el.audio.muted = val;
  } else if (el.type === ElementType.Video){
    if (!el.video || typeof el.video !== 'object') el.video = {};
    el.video.muted = val;
  } else if (el.type === ElementType.Url){
    if (!el.url || typeof el.url !== 'object') el.url = {};
    el.url.muted = val;
  }
}
function persistActiveMediaState(){
  try { refreshFloatingEditorMediaControls(); } catch {}
  const el = getCurrentMediaElement();
  if (!el) return;
  if (MediaSession.overlayKind === 'youtube'){
    setMediaRememberedPositionSec(el, MediaSession.youtubeCurrentTime || 0);
    setMediaRememberedMuted(el, MediaSession.overlayMuted);
    const dur = Math.max(0, Number(MediaSession.youtubeDuration || 0) || 0);
    if (dur > 0){
      if (el.type === ElementType.Video){
        if (!el.video || typeof el.video !== 'object') el.video = {};
        el.video.duration = dur;
      } else if (el.type === ElementType.Url){
        if (!el.url || typeof el.url !== 'object') el.url = {};
        el.url.duration = dur;
      }
    }
  } else if (MediaSession.overlayKind === 'video'){
    const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
    if (v){
      setMediaRememberedPositionSec(el, Number(v.currentTime || 0) || 0);
      setMediaRememberedMuted(el, !!v.muted);
      if (el.type === ElementType.Video){
        if (!el.video || typeof el.video !== 'object') el.video = {};
        const dur = Math.max(0, Number(v.duration || 0) || 0);
        if (dur > 0) el.video.duration = dur;
      } else if (el.type === ElementType.Url){
        if (!el.url || typeof el.url !== 'object') el.url = {};
        const dur = Math.max(0, Number(v.duration || 0) || 0);
        if (dur > 0) el.url.duration = dur;
      }
    }
  } else if (MediaSession.mediaEl){
    setMediaRememberedPositionSec(el, Number(MediaSession.mediaEl.currentTime || 0) || 0);
    setMediaRememberedMuted(el, !!MediaSession.mediaEl.muted);
    if (el.type === ElementType.Audio){
      if (!el.audio || typeof el.audio !== 'object') el.audio = {};
      const dur = Math.max(0, Number(MediaSession.mediaEl.duration || 0) || 0);
      if (dur > 0) el.audio.duration = dur;
    }
  }
}
function isMediaCurrentlyPausedForElement(el){
  if (!el || MediaSession.currentElementId !== el.id) return true;
  if (MediaSession.overlayKind === 'youtube') return !!MediaSession.youtubePaused;
  if (MediaSession.overlayKind === 'video'){
    const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
    return !v || !!v.paused;
  }
  return !MediaSession.mediaEl || !!MediaSession.mediaEl.paused;
}
function stopYouTubePolling(){
  if (MediaSession.youtubePollTimer){
    clearInterval(MediaSession.youtubePollTimer);
    MediaSession.youtubePollTimer = 0;
  }
  if (Array.isArray(MediaSession.youtubeResumeTimers) && MediaSession.youtubeResumeTimers.length){
    for (const timer of MediaSession.youtubeResumeTimers){
      try { clearTimeout(timer); } catch {}
    }
    MediaSession.youtubeResumeTimers.length = 0;
  }
}
let _youtubeIframeApiPromise = null;
function ensureYouTubeIframeApi(){
  if (_youtubeIframeApiPromise) return _youtubeIframeApiPromise;
  _youtubeIframeApiPromise = new Promise((resolve, reject) => {
    if (globalThis.YT && typeof globalThis.YT.Player === 'function') { resolve(globalThis.YT); return; }
    const prev = globalThis.onYouTubeIframeAPIReady;
    globalThis.onYouTubeIframeAPIReady = function(){
      try { if (typeof prev === 'function') prev(); } catch {}
      resolve(globalThis.YT);
    };
    const existing = document.querySelector('script[data-scrapbook-youtube-api="1"]');
    if (existing) return;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.dataset.scrapbookYoutubeApi = '1';
    s.onerror = () => reject(new Error('Failed to load YouTube iframe API.'));
    document.head.appendChild(s);
  });
  return _youtubeIframeApiPromise;
}
function ensureYouTubePlayerDestroyed(){
  const p = MediaSession.youtubePlayer;
  MediaSession.youtubePlayer = null;
  MediaSession.youtubePlayerReady = false;
  MediaSession.youtubeDuration = 0;
  if (p && typeof p.destroy === 'function') {
    try { p.destroy(); } catch {}
  }
}
function ensureYouTubeStateFromPlayer(){
  const p = MediaSession.youtubePlayer;
  if (!p) return;
  try {
    const t = Number(p.getCurrentTime?.() || 0) || 0;
    if (Number.isFinite(t) && t >= 0) MediaSession.youtubeCurrentTime = t;
  } catch {}
  try {
    const d = Number(p.getDuration?.() || 0) || 0;
    if (Number.isFinite(d) && d >= 0) MediaSession.youtubeDuration = d;
  } catch {}
  try {
    MediaSession.overlayMuted = !!p.isMuted?.();
  } catch {}
  try {
    MediaSession.youtubePaused = !(Number(p.getPlayerState?.()) === 1);
  } catch {}
}
function ensureMediaOverlayHost(){
  if (MediaSession.overlayHost && MediaSession.overlayHost.isConnected) return MediaSession.overlayHost;
  const host = document.createElement('div');
  host.id = 'mediaPlaybackOverlayHost';
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.overflow = 'hidden';
  host.style.zIndex = '8';
  const wrapEl = $('canvasWrap') || wrap;
  wrapEl.appendChild(host);
  MediaSession.overlayHost = host;
  return host;
}
function clearMediaOverlay(){
  stopYouTubePolling();
  ensureYouTubePlayerDestroyed();
  const node = MediaSession.overlayNode;
  if (node){
    try {
      const vids = node.querySelectorAll('video');
      vids.forEach((v) => { try { v.pause(); } catch {} v.removeAttribute('src'); try { v.load(); } catch {} v.remove(); });
      const iframes = node.querySelectorAll('iframe');
      iframes.forEach((fr) => { try { fr.remove(); } catch {} try { fr.src = 'about:blank'; } catch {} });
    } catch {}
    node.remove();
  }
  MediaSession.overlayNode = null;
  MediaSession.overlayInner = null;
  MediaSession.overlayKind = '';
  MediaSession.overlayYouTubeId = '';
  MediaSession.overlayRect = null;
  MediaSession.youtubeCurrentTime = 0;
  MediaSession.youtubePaused = true;
  MediaSession.overlayMuted = false;
}
function buildYouTubeEmbedUrl(videoId, autoplay = true, startSec = 0){
  const p = new URLSearchParams();
  p.set('autoplay', autoplay ? '1' : '0');
  p.set('playsinline', '1');
  p.set('rel', '0');
  p.set('modestbranding', '1');
  p.set('enablejsapi', '1');
  p.set('controls', '1');
  p.set('origin', window.location.origin);
  if (startSec > 0) p.set('start', String(Math.max(0, Math.floor(startSec))));
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${p.toString()}`;
}
function createStageMediaOverlayNode(kind){
  const host = ensureMediaOverlayHost();
  clearMediaOverlay();
  const node = document.createElement('div');
  node.style.position = 'absolute';
  node.style.left = '0';
  node.style.top = '0';
  node.style.transformOrigin = '50% 50%';
  node.style.background = 'transparent';
  node.style.boxShadow = 'none';
  node.style.border = 'none';
  node.style.padding = '0';
  node.style.margin = '0';
  node.style.pointerEvents = 'none';
  node.style.overflow = 'hidden';
  node.style.clipPath = 'inset(0 0 0 0)';
  node.style.contain = 'paint';
  node.style.willChange = 'transform';
  const inner = document.createElement('div');
  inner.style.position = 'absolute';
  inner.style.left = '0';
  inner.style.top = '0';
  inner.style.width = '100%';
  inner.style.height = '100%';
  inner.style.background = 'transparent';
  inner.style.overflow = 'hidden';
  inner.style.clipPath = 'inset(0 0 0 0)';
  inner.style.contain = 'paint';
  inner.style.pointerEvents = (kind === 'youtube') ? 'auto' : 'none';
  if (kind === 'youtube'){
    ['pointerdown','mousedown','click','dblclick'].forEach((evt) => inner.addEventListener(evt, (e) => { e.stopPropagation(); }, true));
  }
  node.appendChild(inner);
  host.appendChild(node);
  MediaSession.overlayNode = node;
  MediaSession.overlayInner = inner;
  MediaSession.overlayKind = kind;
  return { node, inner };
}
function getCurrentMediaElement(){
  return MediaSession.currentElementId ? getElementById(MediaSession.currentElementId) : null;
}
function updateMediaOverlayPosition(){
  if (!MediaSession.overlayNode || !MediaSession.currentElementId) return;
  const el = getCurrentMediaElement();
  if (!el) return;
  const cxStage = el.x + el.w / 2;
  const cyStage = el.y + el.h / 2;
  const c = stageToScreen({ x: cxStage, y: cyStage });
  const w = Math.max(1, el.w * Scene.view.zoom);
  const h = Math.max(1, el.h * Scene.view.zoom);
  const x = c.x - (w / 2);
  const y = c.y - (h / 2);
  MediaSession.overlayRect = { x, y, w, h, angle: Number(el.rotationDeg || 0) };
  const node = MediaSession.overlayNode;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  node.style.transform = `rotate(${Number(el.rotationDeg || 0)}deg)`;
}
function sendYouTubeCommand(func, args = []){
  if (MediaSession.overlayKind !== 'youtube') return;

  const p = MediaSession.youtubePlayer;
  if (p){
    try {
      if (func === 'seekTo') { p.seekTo?.(Number(args[0] || 0) || 0, !!args[1]); ensureYouTubeStateFromPlayer(); return; }
      if (func === 'playVideo') { p.playVideo?.(); ensureYouTubeStateFromPlayer(); return; }
      if (func === 'pauseVideo') { p.pauseVideo?.(); ensureYouTubeStateFromPlayer(); return; }
      if (func === 'mute') { p.mute?.(); MediaSession.overlayMuted = true; return; }
      if (func === 'unMute') { p.unMute?.(); MediaSession.overlayMuted = false; return; }
      if (func === 'getCurrentTime') { ensureYouTubeStateFromPlayer(); return; }
      if (func === 'getDuration') { ensureYouTubeStateFromPlayer(); return; }
      if (func === 'isMuted') { ensureYouTubeStateFromPlayer(); return; }
      if (func === 'getPlayerState') { ensureYouTubeStateFromPlayer(); return; }
    } catch {}
  }

  const frame = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('iframe');
  if (!frame || !frame.contentWindow) return;

  let u;
  try { u = new URL(frame.src, window.location.href); } catch { return; }

  const host = (u.hostname || '').toLowerCase();
  const isYouTubeFrame =
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'www.youtube-nocookie.com' ||
    host === 'youtube-nocookie.com';

  if (!isYouTubeFrame) return;

  try {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      u.origin
    );
  } catch {}
}
function syncYouTubeResumeState(el, opts = {}){
  if (!el || MediaSession.overlayKind !== 'youtube' || MediaSession.currentElementId !== el.id) return;
  const remembered = Math.max(0, Number(opts.positionSec != null ? opts.positionSec : getMediaRememberedPositionSec(el)) || 0);
  const muted = !!(opts.muted != null ? opts.muted : getMediaRememberedMuted(el));
  const wantsPlay = opts.play !== false;
  const preserveIfClose = !!opts.preserveIfClose;
  stopYouTubePolling();

  let liveTime = Math.max(0, Number(MediaSession.youtubeCurrentTime || 0) || 0);
  if (MediaSession.youtubePlayerReady) {
    try { ensureYouTubeStateFromPlayer(); } catch {}
    liveTime = Math.max(0, Number(MediaSession.youtubeCurrentTime || 0) || 0);
  }

  const drift = Math.abs(liveTime - remembered);
  const shouldSeekNow = !preserveIfClose || drift > 1.25;

  if (MediaSession.overlayKind === 'youtube' && MediaSession.currentElementId === el.id) {
    sendYouTubeCommand(muted ? 'mute' : 'unMute', []);
    if (shouldSeekNow) {
      sendYouTubeCommand('seekTo', [remembered, true]);
      MediaSession.youtubeCurrentTime = remembered;
    }
    sendYouTubeCommand(wantsPlay ? 'playVideo' : 'pauseVideo', []);
    ensureYouTubeStateFromPlayer();
    persistActiveMediaState();
    try { refreshFloatingEditorMediaControls(); } catch {}
  }

  MediaSession.youtubeResumeTimers = [window.setTimeout(() => {
    if (MediaSession.overlayKind !== 'youtube' || MediaSession.currentElementId !== el.id) return;
    sendYouTubeCommand(muted ? 'mute' : 'unMute', []);
    ensureYouTubeStateFromPlayer();
    const current = Math.max(0, Number(MediaSession.youtubeCurrentTime || 0) || 0);
    const currentDrift = Math.abs(current - remembered);
    if (currentDrift > 2.0 && (!preserveIfClose || current < Math.max(0, remembered - 1.0))) {
      sendYouTubeCommand('seekTo', [remembered, true]);
      MediaSession.youtubeCurrentTime = remembered;
      ensureYouTubeStateFromPlayer();
    }
    persistActiveMediaState();
    try { refreshFloatingEditorMediaControls(); } catch {}
  }, 650)];
  MediaSession.youtubePollTimer = window.setInterval(() => {
    if (MediaSession.overlayKind !== 'youtube' || MediaSession.currentElementId !== el.id) return;
    ensureYouTubeStateFromPlayer();
    persistActiveMediaState();
    try { refreshFloatingEditorMediaControls(); } catch {}
  }, 250);
}
function stopActiveMediaPlayback(){
  persistActiveMediaState();
  scheduleAutosave();
  MediaSession.pendingToken += 1;
  const m = MediaSession.mediaEl;
  if (m){
    try { m.pause(); } catch {}
    try { m.removeAttribute('src'); } catch {}
    try { m.load(); } catch {}
    try { m.remove(); } catch {}
    MediaSession.mediaEl = null;
  }
  if (MediaSession.overlayKind === 'youtube') sendYouTubeCommand('pauseVideo', []);
  clearMediaOverlay();
  MediaSession.currentElementId = ""; MediaSession.currentType = ""; MediaSession.sourceUrl = "";
}
function stopMediaPlaybackIfSelectionLost(){ if (MediaSession.currentElementId && !selectedIds.has(MediaSession.currentElementId)) stopActiveMediaPlayback(); }
function getPlayableSourceForElement(el){ if (!el) return ""; if (el.type === ElementType.Audio) return el.audio && el.audio.assetId ? (getAssetDataUrl(el.audio.assetId) || "") : String(el.sourceUrl || ""); if (el.type === ElementType.Video) return el.video && el.video.assetId ? (getAssetDataUrl(el.video.assetId) || "") : String(el.sourceUrl || ""); return ""; }
function ensureMediaElementForType(type){
  let m = MediaSession.mediaEl;
  if (m && ((type === ElementType.Audio && m.tagName.toLowerCase() !== "audio") || (type === ElementType.Video && m.tagName.toLowerCase() !== "video"))){
    try { m.pause(); } catch {}
    try { m.removeAttribute('src'); } catch {}
    try { m.load(); } catch {}
    m.remove();
    m = null;
    MediaSession.mediaEl = null;
  }
  if (!m){
    m = document.createElement(type === ElementType.Video ? "video" : "audio");
    m.preload = "metadata";
    m.style.display = "none";
    document.body.appendChild(m);
    MediaSession.mediaEl = m;
  }
  return m;
}
function playVideoOverlayFromSource(el, src, token){
  if (!src || token !== MediaSession.pendingToken) return;
  const { inner } = createStageMediaOverlayNode('video');
  const v = document.createElement('video');
  v.playsInline = true;
  v.autoplay = false;
  v.muted = getMediaRememberedMuted(el);
  v.loop = false;
  v.controls = true;
  v.preload = 'metadata';
  v.style.position = 'absolute';
  v.style.left = '0';
  v.style.top = '0';
  v.style.width = '100%';
  v.style.height = '100%';
  v.style.objectFit = (el.keepAspect === false) ? 'fill' : 'contain';
  v.style.background = 'transparent';
  const sync = () => { persistActiveMediaState(); scheduleAutosave(); };
  let resumeApplied = false;
  let playRequested = false;
  const playAfterResume = () => {
    if (playRequested) return;
    playRequested = true;
    if (token !== MediaSession.pendingToken || MediaSession.currentElementId !== el.id) return;
    v.play().catch(() => {});
  };
  const applyRememberedTime = () => {
    if (resumeApplied) return;
    resumeApplied = true;
    const remembered = getMediaRememberedPositionSec(el);
    if (remembered > 0) {
      const dur = Math.max(0, Number(v.duration || 0) || 0);
      const target = dur > 0 ? Math.min(remembered, dur) : remembered;
      try { v.currentTime = target; } catch {}
    }
    sync();
  };
  v.addEventListener('loadedmetadata', () => {
    applyRememberedTime();
    if (Number(getMediaRememberedPositionSec(el) || 0) > 0) return;
    playAfterResume();
  }, { once: true });
  v.addEventListener('seeked', () => {
    if (!playRequested) playAfterResume();
  }, { once: true });
  v.addEventListener('canplay', () => {
    if (!playRequested) playAfterResume();
  }, { once: true });
  v.addEventListener('timeupdate', sync, { passive: true });
  v.addEventListener('play', sync, { passive: true });
  v.addEventListener('pause', sync, { passive: true });
  v.addEventListener('volumechange', sync, { passive: true });
  inner.appendChild(v);
  if (token !== MediaSession.pendingToken) return;
  v.src = src;
  MediaSession.currentElementId = el.id;
  MediaSession.currentType = el.type;
  MediaSession.sourceUrl = src;
  MediaSession.overlayMuted = !!v.muted;
  updateMediaOverlayPosition();
}
async function playYouTubeOverlay(el, href, token){
  const videoId = extractYouTubeVideoId(href);
  if (!videoId || token !== MediaSession.pendingToken) return;
  const remembered = getMediaRememberedPositionSec(el);
  const muted = getMediaRememberedMuted(el);
  const { inner } = createStageMediaOverlayNode('youtube');
  const mount = document.createElement('div');
  mount.style.position = 'absolute';
  mount.style.left = '0';
  mount.style.top = '0';
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.border = '0';
  mount.style.background = 'transparent';
  mount.style.display = 'block';
  inner.appendChild(mount);
  MediaSession.currentElementId = el.id;
  MediaSession.currentType = el.type;
  MediaSession.sourceUrl = href;
  MediaSession.overlayYouTubeId = videoId;
  MediaSession.youtubeCurrentTime = remembered;
  MediaSession.overlayMuted = muted;
  MediaSession.youtubePaused = false;
  updateMediaOverlayPosition();
  try {
    const YT = await ensureYouTubeIframeApi();
    if (token !== MediaSession.pendingToken || MediaSession.currentElementId !== el.id || MediaSession.overlayKind !== 'youtube') return;
    ensureYouTubePlayerDestroyed();
    MediaSession.youtubePlayer = new YT.Player(mount, {
      videoId,
      playerVars: {
        autoplay: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        controls: 1,
        enablejsapi: 1,
        origin: window.location.origin,
        start: Math.max(0, Math.floor(remembered || 0))
      },
      events: {
        onReady: () => {
          if (token !== MediaSession.pendingToken || MediaSession.currentElementId !== el.id || MediaSession.overlayKind !== 'youtube') return;
          MediaSession.youtubePlayerReady = true;
          ensureYouTubeStateFromPlayer();
          syncYouTubeResumeState(el, { positionSec: remembered, muted, play: true });
        },
        onStateChange: () => {
          ensureYouTubeStateFromPlayer();
          persistActiveMediaState();
          try { refreshFloatingEditorMediaControls(); } catch {}
        },
        onError: () => {
          MediaSession.youtubePaused = true;
          try { refreshFloatingEditorMediaControls(); } catch {}
        }
      }
    });
  } catch (err) {
    console.warn('YouTube overlay init failed', err);
  }
}
function playMediaElementNow(el, token){
  if (!el || token !== MediaSession.pendingToken) return;
  const isVideoLike = el.type === ElementType.Video || ((el.type === ElementType.Url) && (el.url && el.url.detectedKind) === 'video');
  if (isVideoLike){
    const href = (el.type === ElementType.Url) ? String(el.url && el.url.href || '') : getPlayableSourceForElement(el);
    const ytId = extractYouTubeVideoId(href);
    if (ytId){
      if (MediaSession.currentElementId === el.id && MediaSession.overlayKind === 'youtube' && MediaSession.overlayYouTubeId === ytId) {
        syncYouTubeResumeState(el, { play: true, preserveIfClose: true });
        MediaSession.youtubePaused = false;
        return;
      }
      void playYouTubeOverlay(el, href, token);
      return;
    }
    if (href){
      if (MediaSession.currentElementId === el.id && MediaSession.overlayKind === 'video') {
        const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
        if (v) {
          v.muted = getMediaRememberedMuted(el);
          const remembered = getMediaRememberedPositionSec(el);
          if (Math.abs((Number(v.currentTime || 0) || 0) - remembered) > 1.0) { try { v.currentTime = remembered; } catch {} }
          v.play().catch(() => {});
          return;
        }
      }
      playVideoOverlayFromSource(el, href, token);
      return;
    }
  }
  const src = getPlayableSourceForElement(el);
  if (!src) return;
  const m = ensureMediaElementForType(el.type);
  if (token !== MediaSession.pendingToken) return;

  const remembered = getMediaRememberedPositionSec(el);
  const muted = getMediaRememberedMuted(el);
  const isSameSource = (MediaSession.currentElementId === el.id && MediaSession.sourceUrl === src);

  if (isSameSource){
    m.muted = muted;
    if (Math.abs((Number(m.currentTime || 0) || 0) - remembered) > 0.75) {
      try { m.currentTime = remembered; } catch {}
    }
    m.play().catch(() => {});
    return;
  }

  try { m.pause(); } catch {}

  let playRequested = false;
  let resumeApplied = false;
  const finishPlay = () => {
    if (playRequested) return;
    playRequested = true;
    if (token !== MediaSession.pendingToken || MediaSession.currentElementId !== el.id || MediaSession.sourceUrl !== src) return;
    m.play().catch(() => {});
  };
  const applyRememberedTime = () => {
    if (resumeApplied) return;
    resumeApplied = true;
    if (token !== MediaSession.pendingToken || MediaSession.currentElementId !== el.id || MediaSession.sourceUrl !== src) return;
    if (remembered > 0) {
      const dur = Math.max(0, Number(m.duration || 0) || 0);
      const target = dur > 0 ? Math.min(remembered, dur) : remembered;
      try { m.currentTime = target; } catch {}
    }
    persistActiveMediaState();
    try { refreshFloatingEditorMediaControls(); } catch {}
  };

  m.onloadedmetadata = () => {
    applyRememberedTime();
    if (remembered <= 0) finishPlay();
  };
  m.onseeked = () => {
    applyRememberedTime();
    finishPlay();
  };
  m.oncanplay = () => {
    applyRememberedTime();
    finishPlay();
  };

  m.muted = muted;
  m.src = src;
  m.load();
  MediaSession.currentElementId = el.id;
  MediaSession.currentType = el.type;
  MediaSession.sourceUrl = src;
  MediaSession.overlayMuted = !!muted;
}
function playMediaElement(el){
  try { refreshFloatingEditorMediaControls(); } catch {}
  if (!el) return;
  const token = ++MediaSession.pendingToken;
  setStatus('Starting media…');
  window.setTimeout(() => playMediaElementNow(el, token), 0);
}
function pauseMediaElement(){
  try { refreshFloatingEditorMediaControls(); } catch {}
  persistActiveMediaState();
  scheduleAutosave();
  MediaSession.pendingToken += 1;
  if (MediaSession.overlayKind === 'youtube') { MediaSession.youtubePaused = true; sendYouTubeCommand('pauseVideo', []); return; }
  if (MediaSession.overlayKind === 'video') {
    const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
    if (v) { try { v.pause(); } catch {} return; }
  }
  try { MediaSession.mediaEl && MediaSession.mediaEl.pause(); } catch {}
}
function toggleMediaPlayPause(el){
  if (el && MediaSession.currentElementId === el.id && !isMediaCurrentlyPausedForElement(el)) pauseMediaElement();
  else playMediaElement(el || getCurrentMediaElement());
}
function rewindMediaElement(seconds = 5){
  try { refreshFloatingEditorMediaControls(); } catch {}
  if (MediaSession.overlayKind === 'youtube') {
    const el = getCurrentMediaElement();
    const next = Math.max(0, (Number(MediaSession.youtubeCurrentTime || 0) || 0) - Number(seconds || 5));
    MediaSession.youtubeCurrentTime = next;
    if (el) setMediaRememberedPositionSec(el, next);
    scheduleAutosave();
    sendYouTubeCommand('seekTo', [next, true]);
    return;
  }
  if (MediaSession.overlayKind === 'video') {
    const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
    if (v) { try { v.currentTime = Math.max(0, (Number(v.currentTime)||0) - Number(seconds||5)); } catch {} persistActiveMediaState(); scheduleAutosave(); return; }
  }
  const m = MediaSession.mediaEl; if (!m) return; try { m.currentTime = Math.max(0, (Number(m.currentTime)||0) - Number(seconds||5)); } catch {}
  persistActiveMediaState();
  scheduleAutosave();
}
window.addEventListener('message', (ev) => {
  if (MediaSession.overlayKind !== 'youtube') return;
  const origin = String(ev.origin || '');
  if (!/youtube(?:-nocookie)?\.com$/i.test(origin) && !/youtube\.com$/i.test(origin)) return;
  let data = ev.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return; }
  }
  if (!data || typeof data !== 'object') return;
  if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
    if (data.info.currentTime != null) MediaSession.youtubeCurrentTime = Math.max(0, Number(data.info.currentTime || 0) || 0);
    if (data.info.playerState != null) MediaSession.youtubePaused = !(Number(data.info.playerState) === 1);
    if (data.info.muted != null) MediaSession.overlayMuted = !!data.info.muted;
    ensureYouTubeStateFromPlayer();
    persistActiveMediaState();
    scheduleAutosave();
    try { refreshFloatingEditorMediaControls(); } catch {}
  }
});
function openUrlExternal(href){ const url = String(href || "").trim(); if (!url) return; window.open(url, "_blank", "noopener,noreferrer"); }
function extractYouTubeVideoId(href){
  try {
    const u = new URL(String(href || '').trim());
    const host = (u.hostname || '').toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = (u.pathname || '').replace(/^\/+/, '').split('/')[0] || '';
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v') || '';
        return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
      }
      const parts = (u.pathname || '').split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live')) {
        const id = parts[1] || '';
        return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
      }
    }
  } catch {}
  return '';
}
function getBestEffortPosterUrlsForExternalVideo(href){
  const ytId = extractYouTubeVideoId(href);
  if (ytId) {
    return [
      `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${ytId}/default.jpg`
    ];
  }
  return [];
}
function getBestEffortPosterUrlForExternalVideo(href){
  const urls = getBestEffortPosterUrlsForExternalVideo(href);
  return urls.length ? urls[0] : '';
}
function detectUrlKindFromHref(href){
  const raw = String(href || '').trim();
  const s = raw.toLowerCase();
  if (!s) return { kind: 'link', mimeHint: '' };
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(s)) return { kind: 'image', mimeHint: 'image/*' };
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(s)) return { kind: 'video', mimeHint: 'video/*' };
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/.test(s)) return { kind: 'audio', mimeHint: 'audio/*' };
  if (extractYouTubeVideoId(raw)) return { kind: 'video', mimeHint: 'video/youtube' };
  return { kind: 'link', mimeHint: '' };
}
function drawMediaCardLocal(el, x, y, w, h, label, sublabel = ""){ if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){ ctx.save(); ctx.fillStyle = el.fill; ctx.fillRect(x, y, w, h); ctx.restore(); } ctx.save(); ctx.strokeStyle = "rgba(17,17,17,0.22)"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); ctx.fillStyle = el.color || "#111111"; ctx.font = `${Math.max(14, 16 * Scene.view.zoom)}px ${cssFontFamily(FONT_FAMILY_LITERAL)}, system-ui, sans-serif`; ctx.textBaseline = "top"; ctx.fillText(label, x + 12, y + 12); if (sublabel){ ctx.fillStyle = "rgba(17,17,17,0.62)"; ctx.font = `${Math.max(12, 13 * Scene.view.zoom)}px system-ui, sans-serif`; let ty = y + 38; for (const ln of wrapLine(ctx, sublabel, Math.max(40, w - 24)).slice(0,3)){ ctx.fillText(ln, x + 12, ty); ty += Math.max(14, 15 * Scene.view.zoom); } } ctx.restore(); }
function drawMediaCardOffscreen(octx, el, x, y, w, h, label, sublabel = ""){ if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){ octx.fillStyle = el.fill; octx.fillRect(x, y, w, h); } octx.save(); octx.strokeStyle = "rgba(17,17,17,0.22)"; octx.lineWidth = 1.5; octx.strokeRect(x, y, w, h); octx.fillStyle = el.color || "#111111"; octx.font = `16px ${cssFontFamily(FONT_FAMILY_LITERAL)}, system-ui, sans-serif`; octx.textBaseline = "top"; octx.fillText(label, x + 12, y + 12); if (sublabel){ octx.fillStyle = "rgba(17,17,17,0.62)"; octx.font = "13px system-ui, sans-serif"; let ty = y + 38; for (const ln of wrapLine(octx, sublabel, Math.max(40, w - 24)).slice(0,3)){ octx.fillText(ln, x + 12, ty); ty += 15; } } octx.restore(); }

  function clearSelection(){
    stopActiveMediaPlayback();
    selectedIds.clear();
    updateUiForSelection();
    render();
  }

  function toggleSelectElement(elId){
    if (selectedIds.has(elId)) selectedIds.delete(elId);
    else selectedIds.add(elId);
    updateUiForSelection();
    render();
  }

  function selectOnlyElements(ids){
    selectedIds = new Set(ids);
    updateUiForSelection();
    render();
  }

  function selectWholeGroupIfApplicable(clickedEl, originalEvent){
  if (!clickedEl) return;

  // Do not auto-expand when user is intentionally multi-selecting
  const multi = !!(originalEvent && (originalEvent.shiftKey || originalEvent.ctrlKey || originalEvent.metaKey));
  if (multi) return;

  const gid = clickedEl.groupId;
  if (!gid) return;

  const members = getElementsInGroup(gid);
  if (members.length > 0){
    selectOnlyElements(members.map(e => e.id));
  }
}

  function anySelected(){
    return selectedIds.size > 0;
  }

  function getGroupIdFromSelection(){
    // If all selected elements share same non-null groupId, return it.
    const sels = getSelectedElements();
    if (!sels.length) return null;
    const gid = sels[0].groupId || null;
    if (!gid) return null;
    for (const el of sels) if (el.groupId !== gid) return null;
    return gid;
  }

  function getElementsInGroup(groupId){
    return Scene.elements.filter(e => e.groupId === groupId);
  }

  function isTextLikeElement(el){
  return el && (
    el.type === ElementType.Text ||
    el.type === ElementType.Sitelen ||
    el.type === ElementType.Glyph
  );
}

function moveSelectionZ(delta){
  // delta: +1 = bring forward (towards end), -1 = send backward (towards start)
  if (!selectedIds || selectedIds.size === 0) return;

  // If anything locked is selected, do nothing (matches your UI disable intent)
  if (selectionHasLocked()) return;

if (APP_VECTOR_DEBUG) console.log("moveSelectionZ");

  const n = Scene.elements.length;
  if (n <= 1) return;

  // Indices of selected elements in Scene.elements order
  const selectedIdx = [];
  for (let i = 0; i < n; i++){
    if (selectedIds.has(Scene.elements[i].id)) selectedIdx.push(i);
  }
  if (selectedIdx.length === 0) return;

  // Treat selection as a single block:
  // remove selected elements, then reinsert them shifted by delta.
  const minIdx = selectedIdx[0];
  const maxIdx = selectedIdx[selectedIdx.length - 1];

  // Boundary checks: if block is already at the edge, nothing to do
  if (delta < 0 && minIdx === 0) return;
  if (delta > 0 && maxIdx === n - 1) return;

  // Extract selected elements in draw order (preserve relative order)
  const selectedEls = [];
  const remaining = [];
  for (const el of Scene.elements){
    if (selectedIds.has(el.id)) selectedEls.push(el);
    else remaining.push(el);
  }

  // Compute insertion index in the remaining array.
  // Original block started at minIdx in the original array.
  // After removing selectedEls, everything before minIdx is still before.
  let insertAt = minIdx;

  // Shift by one "slot" in the final array.
  // For forward: insert after the next unselected element.
  // For backward: insert before the previous unselected element.
  if (delta > 0){
    insertAt = minIdx + 1; // move block one step towards end
  } else if (delta < 0){
    insertAt = minIdx - 1; // move block one step towards start
  }

  // Clamp insertAt to remaining bounds
  insertAt = Math.max(0, Math.min(insertAt, remaining.length));

  // But: insertAt is expressed in terms of the final array positions.
  // Since remaining is missing selectedEls, we must ensure the “step” is relative to unselected neighbors.
  // Adjust by counting how many selected indices were before the target position.
  // A simple robust way: simulate one-step swap with neighbor.
  if (delta > 0){
    // Swap block with the first unselected element immediately after it (if any)
    // Find first unselected element after maxIdx in original:
    const neighbor = Scene.elements[maxIdx + 1];
    if (!neighbor || selectedIds.has(neighbor.id)) return;

    // In remaining, neighbor sits at position: (maxIdx + 1) - (#selected before it)
    let selectedBeforeNeighbor = 0;
    for (const idx of selectedIdx) if (idx < (maxIdx + 1)) selectedBeforeNeighbor++;
    const neighborPos = (maxIdx + 1) - selectedBeforeNeighbor;

    // Put block after neighbor
    insertAt = neighborPos + 1;
  } else {
    // Swap block with the unselected element immediately before it
    const neighbor = Scene.elements[minIdx - 1];
    if (!neighbor || selectedIds.has(neighbor.id)) return;

    let selectedBeforeNeighbor = 0;
    for (const idx of selectedIdx) if (idx < (minIdx - 1)) selectedBeforeNeighbor++;
    const neighborPos = (minIdx - 1) - selectedBeforeNeighbor;

    // Put block before neighbor
    insertAt = neighborPos;
  }

  // Rebuild Scene.elements with the moved block
  const next = remaining.slice(0, insertAt)
    .concat(selectedEls)
    .concat(remaining.slice(insertAt));

  //Scene.elements = next;
  // IMPORTANT: mutate in-place so any cached refs see it
  Scene.elements.splice(0, Scene.elements.length, ...next);

  //console.log("draw order:", Scene.elements.map(e => e.id).join(","));

}

function applyGroupForeground(groupId, cssColor){
  if (!groupId) return;
  if (!Scene.groups[groupId]) Scene.groups[groupId] = { id: groupId, createdAt: new Date().toISOString() };

  Scene.groups[groupId].foreground = cssColor;

  const els = getElementsInGroup(groupId);
  for (const el of els){
    if (!isTextLikeElement(el)) continue;

    el.color =  rgbaOrHexToHex( cssColor , "~111111");

    // Sitelen needs raster/layout refresh because color is baked into the offscreen canvas
    if (el.type === ElementType.Sitelen){
      invalidateSitelenCache(el.id);
      updateSitelenLayout(el, { preserveCenter: true });
    }
  }
}

  // ===============================
// Arrow-key nudge (fixes snap bounce)
// ===============================
function wireArrowKeyNudge(){
  window.addEventListener("keydown", (e) => {
// Ignore typing inside inputs/textareas/selects/contenteditable
    if (isTypingContext(e.target)) return;

    // Only when something is selected
    if (!selectedIds || selectedIds.size === 0) return;

    // Block nudging locked selection
    if (selectionHasLocked()){
      // optional: silent ignore instead of alert
      return;
    }

    const key = e.key;

    // Only arrow keys
    const isArrow =
      key === "ArrowLeft" || key === "ArrowRight" ||
      key === "ArrowUp"   || key === "ArrowDown";
    if (!isArrow) return;

    e.preventDefault();

    // Base nudge in STAGE units (not screen px)
    // Normal: 1, Shift: 10, Alt: gridSize (optional)
    let step = 1;
    if (e.shiftKey) step = 10;

    // If grid snap is enabled, make arrow nudges actually move.
    // Option A (recommended): nudge by grid size when snapGrid is ON.
    if (Scene.stage.snapGrid){
      const gs = Math.max(1, Number(Scene.stage.gridSize || 20));
      step = gs;

      // If you still want Shift to be "bigger", multiply:
      if (e.shiftKey) step = gs * 5; // tweak as you like
    }

    // Optional: Alt forces grid size even if snapGrid is off
    if (e.altKey){
      const gs = Math.max(1, Number(Scene.stage.gridSize || 20));
      step = gs;
    }

    let dx = 0, dy = 0;
    if (key === "ArrowLeft")  dx = -step;
    if (key === "ArrowRight") dx =  step;
    if (key === "ArrowUp")    dy = -step;
    if (key === "ArrowDown")  dy =  step;

    // Apply move directly in stage space
    const sels = getSelectedElements();

    for (const el of sels){
      el.x += dx;
      el.y += dy;
    }

    // If you want object snapping even on arrow moves, you can apply it here.
    // But DO NOT re-round to grid again because step already accounts for it.
    // If you DO want object snap only:
    if (!Scene.stage.snapGrid && Scene.stage.snapObjects){
      const ids = sels.map(e => e.id);
      // Use your existing snap logic without grid rounding:
      const snapped = applySnapMove(dx, dy, ids);
      // applySnapMove assumes _startX/_startY; easiest is:
      // (skip, unless you refactor applySnapMove to be "pure" over current positions)
    }

    scheduleAutosave();
    updateUiForSelection();
    render();
    historyCommitDebounced("Nudge");

  });
}


  function pickTopmostElementAtStagePoint(ptStage){
    // Iterate from topmost (end of array) to bottom.
    for (let i = Scene.elements.length - 1; i >= 0; i--){
      const el = Scene.elements[i];
      if (pointInElement(ptStage, el)) return el;
    }
    return null;
  }

  function pointInElement(pt, el){
    // Treat element bounds as rotated rectangle about its center.
    const cx = el.x + el.w/2;
    const cy = el.y + el.h/2;
    const a = -rad(el.rotationDeg || 0);

    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);

    return (Math.abs(rx) <= el.w/2) && (Math.abs(ry) <= el.h/2);
  }

  function elementCorners(el){
    const cx = el.x + el.w/2, cy = el.y + el.h/2;
    const a = rad(el.rotationDeg || 0);
    const hw = el.w/2, hh = el.h/2;
    const pts = [
      {x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}
    ].map(p => ({
      x: cx + p.x * Math.cos(a) - p.y * Math.sin(a),
      y: cy + p.x * Math.sin(a) + p.y * Math.cos(a),
    }));
    return pts;
  }

  function aabbOfElements(els){
    if (!els.length) return { x:0, y:0, w:0, h:0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els){
      const cs = elementCorners(el);
      for (const p of cs){
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function getSelectionAabb(){
    return aabbOfElements(getSelectedElements());
  }

  function handlesForAabb(aabb){
    const s = 8 / Scene.view.zoom; // handle size in stage units
    const x = aabb.x, y = aabb.y, w = aabb.w, h = aabb.h;
    const cx = x + w/2, cy = y + h/2;

    const pts = {
      nw: {x:x, y:y},
      n:  {x:cx, y:y},
      ne: {x:x+w, y:y},
      e:  {x:x+w, y:cy},
      se: {x:x+w, y:y+h},
      s:  {x:cx, y:y+h},
      sw: {x:x, y:y+h},
      w:  {x:x, y:cy},
      rot:{x:cx, y:y - 24/Scene.view.zoom}, // rotate handle above
    };

    function box(p){ return { x: p.x - s, y: p.y - s, w: s*2, h: s*2 }; }

    return {
      ResizeNW: box(pts.nw),
      ResizeN:  box(pts.n),
      ResizeNE: box(pts.ne),
      ResizeE:  box(pts.e),
      ResizeSE: box(pts.se),
      ResizeS:  box(pts.s),
      ResizeSW: box(pts.sw),
      ResizeW:  box(pts.w),
      Rotate:   box(pts.rot),
      rotPt: pts.rot,
      center: {x:cx, y:cy},
    };
  }

  function pointInAabb(pt, box){
    return pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;
  }

  function hitTestSelectionHandles(ptStage){
    if (!anySelected()) return HANDLE.None;
    const aabb = getSelectionAabb();
    if (aabb.w < 1 || aabb.h < 1) return HANDLE.None;

    const hs = handlesForAabb(aabb);
    if (pointInAabb(ptStage, hs.Rotate)) return HANDLE.Rotate;
    if (pointInAabb(ptStage, hs.ResizeNW)) return HANDLE.ResizeNW;
    if (pointInAabb(ptStage, hs.ResizeN))  return HANDLE.ResizeN;
    if (pointInAabb(ptStage, hs.ResizeNE)) return HANDLE.ResizeNE;
    if (pointInAabb(ptStage, hs.ResizeE))  return HANDLE.ResizeE;
    if (pointInAabb(ptStage, hs.ResizeSE)) return HANDLE.ResizeSE;
    if (pointInAabb(ptStage, hs.ResizeS))  return HANDLE.ResizeS;
    if (pointInAabb(ptStage, hs.ResizeSW)) return HANDLE.ResizeSW;
    if (pointInAabb(ptStage, hs.ResizeW))  return HANDLE.ResizeW;

    // Move: click inside selection aabb (after handles checked)
    if (pointInAabb(ptStage, aabb)) return HANDLE.Move;
    return HANDLE.None;
  }

  /* ============================================================
     Drag state and gestures
     ============================================================ */
  const drag = {
    active: false,
    pointerId: null,
    mode: HANDLE.None,
    startScreen: {x:0,y:0},
    startStage: {x:0,y:0},
    startAabb: null,
    startElsSnapshot: null, // array of {id, x,y,w,h,rotationDeg,fontSize}
    startAngle: 0,
    marquee: null, // {x0,y0,x1,y1}
    panStartView: null,
  };

  function isTypingContext(node){
    // Treat any focused form control / contenteditable region as "typing" so global
    // shortcuts like Backspace/Delete don't act on the selection.
    const el = (node && node.nodeType === 1) ? node
      : (document.activeElement && document.activeElement.nodeType === 1 ? document.activeElement : null);
    if (!el) return false;

    if (el.isContentEditable) return true;

    const tag = (el.tagName || "").toUpperCase();
    if (tag === "TEXTAREA" || tag === "SELECT") return true;

    if (tag === "INPUT"){
      const t = (el.type || "").toLowerCase();
      // Non-typing inputs
      if (["button","checkbox","radio","range","color","file","submit","reset"].includes(t)) return false;
      return true;
    }

    // If the event target is inside an editor control, treat it as typing context.
    return !!el.closest("textarea, input, select, [contenteditable='true']");
  }

  function getPointerScreen(e){
    const r = wrap.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startPointerCapture(e){
    wrap.setPointerCapture(e.pointerId);
    drag.active = true;
    drag.pointerId = e.pointerId;
  }

  function endPointerCapture(){
    drag.active = false;
    drag.pointerId = null;
    drag.mode = HANDLE.None;
    drag.startAabb = null;
    drag.startElsSnapshot = null;
    drag.startAngle = 0;
    drag.marquee = null;
    drag.panStartView = null;
    drag._groupRefreshClickPt = null;
    drag._groupRefreshHitId = null;
  }

  function snapshotSelected(){
    const sels = getSelectedElements();
    return sels.map(el => ({
      id: el.id,
      x: el.x, y: el.y, w: el.w, h: el.h,
      rotationDeg: el.rotationDeg || 0,
      fontSize: el.fontSize ?? null,
      radius: el.radius ?? null,
    }));
  }

  function applySnapMove(dx, dy, movingElIds){
    const tol = Scene.stage.snapTol;
    if (!Scene.stage.snapGrid && !Scene.stage.snapObjects) return {dx,dy};

    // Compute candidate snaps on aabb of moving selection (before move)
    const sels = movingElIds.map(id => getElementById(id)).filter(Boolean);
    const aabb0 = aabbOfElements(sels);
    let ndx = dx, ndy = dy;

    if (Scene.stage.snapGrid){
      const gs = Math.max(2, Scene.stage.gridSize|0);
      const tx = roundTo(aabb0.x + dx, gs) - aabb0.x;
      const ty = roundTo(aabb0.y + dy, gs) - aabb0.y;
      if (Math.abs(tx - dx) <= tol) ndx = tx;
      if (Math.abs(ty - dy) <= tol) ndy = ty;
    }

    if (Scene.stage.snapObjects){
      // Simple snapping: align selection aabb edges/center with other elements' aabb edges/center.
      const others = Scene.elements.filter(e => !movingElIds.includes(e.id));
      const linesX = [];
      const linesY = [];
      for (const o of others){
        const b = aabbOfElements([o]);
        linesX.push(b.x, b.x + b.w, b.x + b.w/2);
        linesY.push(b.y, b.y + b.h, b.y + b.h/2);
      }

      const bx = aabb0.x + ndx, by = aabb0.y + ndy, bw = aabb0.w, bh = aabb0.h;
      const candX = [bx, bx + bw, bx + bw/2];
      const candY = [by, by + bh, by + bh/2];

      // find closest within tolerance
      for (const cx of candX){
        for (const lx of linesX){
          const d = lx - cx;
          if (Math.abs(d) <= tol){
            ndx += d;
            break;
          }
        }
      }
      for (const cy of candY){
        for (const ly of linesY){
          const d = ly - cy;
          if (Math.abs(d) <= tol){
            ndy += d;
            break;
          }
        }
      }
    }

    return {dx: ndx, dy: ndy};
  }

  function applyMoveToSelection(dx, dy){
    const ids = [...selectedIds];
    const snapped = applySnapMove(dx, dy, ids);

    for (const id of ids){
      const el = getElementById(id);
      if (!el) continue;
      el.x = el._startX + snapped.dx;
      el.y = el._startY + snapped.dy;

      if (Scene.stage.snapGrid){
        const gs = Math.max(2, Scene.stage.gridSize|0);
        el.x = roundTo(el.x, gs);
        el.y = roundTo(el.y, gs);
      }
    }
  }

  function applyRotateToSelection(deltaDeg){
    const ids = [...selectedIds];
    const aabb = drag.startAabb;
    const cx = aabb.x + aabb.w/2;
    const cy = aabb.y + aabb.h/2;

    for (const id of ids){
      const el = getElementById(id);
      if (!el) continue;
      const sx = el._startX + el.w/2;
      const sy = el._startY + el.h/2;

      const r0 = rad(0);
      const a = rad(deltaDeg);

      // rotate element center around selection center
      const dx = sx - cx;
      const dy = sy - cy;
      const nx = dx * Math.cos(a) - dy * Math.sin(a);
      const ny = dx * Math.sin(a) + dy * Math.cos(a);
      const newCx = cx + nx;
      const newCy = cy + ny;

      el.x = newCx - el.w/2;
      el.y = newCy - el.h/2;

      el.rotationDeg = (el._startRot + deltaDeg);
    }
  }

  function applyScaleToSelection(handleMode, currPtStage, keepAspect){
    const ids = [...selectedIds];
    const a0 = drag.startAabb;
    const cx = a0.x + a0.w/2;
    const cy = a0.y + a0.h/2;

    // Determine anchor point opposite handle
    let ax = cx, ay = cy;
    let hx = currPtStage.x, hy = currPtStage.y;

    const left = a0.x, right = a0.x + a0.w, top = a0.y, bottom = a0.y + a0.h;

    switch(handleMode){
      case HANDLE.ResizeNW: ax = right; ay = bottom; break;
      case HANDLE.ResizeN:  ax = cx;    ay = bottom; break;
      case HANDLE.ResizeNE: ax = left;  ay = bottom; break;
      case HANDLE.ResizeE:  ax = left;  ay = cy; break;
      case HANDLE.ResizeSE: ax = left;  ay = top; break;
      case HANDLE.ResizeS:  ax = cx;    ay = top; break;
      case HANDLE.ResizeSW: ax = right; ay = top; break;
      case HANDLE.ResizeW:  ax = right; ay = cy; break;
    }

    // Old handle reference point (based on start aabb)
    let ox = cx, oy = cy;
    switch(handleMode){
      case HANDLE.ResizeNW: ox = left;  oy = top; break;
      case HANDLE.ResizeN:  ox = cx;    oy = top; break;
      case HANDLE.ResizeNE: ox = right; oy = top; break;
      case HANDLE.ResizeE:  ox = right; oy = cy; break;
      case HANDLE.ResizeSE: ox = right; oy = bottom; break;
      case HANDLE.ResizeS:  ox = cx;    oy = bottom; break;
      case HANDLE.ResizeSW: ox = left;  oy = bottom; break;
      case HANDLE.ResizeW:  ox = left;  oy = cy; break;
    }

    const v0x = ox - ax, v0y = oy - ay;
    const v1x = hx - ax, v1y = hy - ay;

    const sx = (Math.abs(v0x) < 1e-6) ? 1 : (v1x / v0x);
    const sy = (Math.abs(v0y) < 1e-6) ? 1 : (v1y / v0y);

    let ssx = sx, ssy = sy;
    if (keepAspect){
      const s = (Math.abs(ssx) < Math.abs(ssy)) ? ssx : ssy;
      ssx = s; ssy = s;
    }

    // Clamp scaling
    ssx = clamp(ssx, 0.1, 10);
    ssy = clamp(ssy, 0.1, 10);

    for (const id of ids){
      const el = getElementById(id);
      if (!el) continue;

      // Scale element center relative to anchor
      const c0x = (el._startX + el._startW/2);
      const c0y = (el._startY + el._startH/2);

      const dcx = c0x - ax;
      const dcy = c0y - ay;

      const c1x = ax + dcx * ssx;
      const c1y = ay + dcy * ssy;

      let nw = Math.max(8, el._startW * ssx);
let nh = Math.max(8, el._startH * ssy);

let x1 = c1x - nw/2;
let y1 = c1y - nh/2;

// CHANGE HERE: aspect lock for images when keepAspect is true
// CHANGE HERE: aspect lock for images + sitelen when keepAspect is true
if (
  (el.type === ElementType.Image || el.type === ElementType.Sitelen) &&
  ((el.keepAspect == null) ? true : !!el.keepAspect)
){

    // Aspect ratio source:
  // - Image: intrinsic (naturalW/H) or stored origW/H
  // - Sitelen: raster intrinsic (sitelenCache) or stored sitelen.origW/H
  let aspect = null;

  if (el.type === ElementType.Image){
    if (el.image && el.image.naturalW > 0 && el.image.naturalH > 0){
      aspect = el.image.naturalW / el.image.naturalH;
    } else if (el.image && Number.isFinite(el.image.origW) && Number.isFinite(el.image.origH) && el.image.origH > 0){
      aspect = el.image.origW / el.image.origH;
    }
  } else if (el.type === ElementType.Sitelen){
    const r = ensureSitelenRaster(el); // safe: cached unless text/font /align changed
    if (r && r.naturalW > 0 && r.naturalH > 0){
      aspect = r.naturalW / r.naturalH;
    } else if (el.sitelen && Number.isFinite(el.sitelen.origW) && Number.isFinite(el.sitelen.origH) && el.sitelen.origH > 0){
      aspect = el.sitelen.origW / el.sitelen.origH;
    }
  }

  if (aspect && isFinite(aspect) && aspect > 0){
    // Preserve the “opposite side/corner” feel of the handle by pinning the appropriate edges
    const left0 = x1;
    const right0 = x1 + nw;
    const top0 = y1;
    const bottom0 = y1 + nh;
    const cy0 = y1 + nh/2;
    const cx0 = x1 + nw/2;

    // Choose whether width or height is the driver based on handle direction
    const usesHeightAsDriver =
      (handleMode === HANDLE.ResizeN || handleMode === HANDLE.ResizeS);

    if (usesHeightAsDriver){
      nh = Math.max(8, nh);
      nw = Math.max(8, nh * aspect);
    } else {
      nw = Math.max(8, nw);
      nh = Math.max(8, nw / aspect);
    }

    // Now place box based on handle
    switch(handleMode){
      case HANDLE.ResizeE:
        x1 = left0;
        y1 = cy0 - nh/2;
        break;
      case HANDLE.ResizeW:
        x1 = right0 - nw;
        y1 = cy0 - nh/2;
        break;
      case HANDLE.ResizeS:
        x1 = cx0 - nw/2;
        y1 = top0;
        break;
      case HANDLE.ResizeN:
        x1 = cx0 - nw/2;
        y1 = bottom0 - nh;
        break;

      case HANDLE.ResizeNE: // opposite is bottom-left
        x1 = left0;
        y1 = bottom0 - nh;
        break;
      case HANDLE.ResizeNW: // opposite is bottom-right
        x1 = right0 - nw;
        y1 = bottom0 - nh;
        break;
      case HANDLE.ResizeSE: // opposite is top-left
        x1 = left0;
        y1 = top0;
        break;
      case HANDLE.ResizeSW: // opposite is top-right
        x1 = right0 - nw;
        y1 = top0;
        break;

      default:
        // fallback: keep center stable
        x1 = cx0 - nw/2;
        y1 = cy0 - nh/2;
        break;
    }
  }
}

el.w = nw;
el.h = nh;
el.x = x1;
el.y = y1;


      // Scale font size for text-like elements
      // Scale font size ONLY when enabled (Text + Glyph)
      const canScaleFont =
        (el.type === ElementType.Text || el.type === ElementType.Glyph) &&
        !!el.scaleFontWithBox;

      if (canScaleFont && typeof el._startFontSize === "number"){
        const s = Math.max(0.2, (Math.abs(ssx) + Math.abs(ssy)) / 2);
        el.fontSize = Math.max(6, el._startFontSize * s);
      }


      // Scale rect radius
      if (el.type === ElementType.Rect && typeof el._startRadius === "number"){
        const s = Math.max(0.2, (Math.abs(ssx)+Math.abs(ssy))/2);
        el.radius = Math.max(0, el._startRadius * s);
      }
    }
  }

  function beginDragSelectionMode(mode, ptScreen, ptStage){
    drag.mode = mode;
    drag.startScreen = ptScreen;
    drag.startStage = ptStage;

    drag.startAabb = getSelectionAabb();
    drag.startElsSnapshot = snapshotSelected();

    // store start values on elements for simpler apply
    for (const s of drag.startElsSnapshot){
      const el = getElementById(s.id);
      if (!el) continue;
      el._startX = s.x; el._startY = s.y;
      el._startW = s.w; el._startH = s.h;
      el._startRot = s.rotationDeg;
      el._startFontSize = s.fontSize;
      el._startRadius = s.radius;
    }

    if (mode === HANDLE.Rotate){
      const aabb = drag.startAabb;
      const cx = aabb.x + aabb.w/2;
      const cy = aabb.y + aabb.h/2;
      drag.startAngle = Math.atan2(ptStage.y - cy, ptStage.x - cx);
    }
  }

  function finalizeDrag(){
    let changed = false;

    for (const el of Scene.elements){
      if (el._startX !== undefined){
        if (
          el.x !== el._startX || el.y !== el._startY ||
          el.w !== el._startW || el.h !== el._startH ||
          el.rot !== el._startRot ||
          el.fontSize !== el._startFontSize ||
          el.radius !== el._startRadius
        ){
          changed = true;
          break;
        }
      }
    }

    // clean temp fields
    for (const el of Scene.elements){
      delete el._startX; delete el._startY;
      delete el._startW; delete el._startH;
      delete el._startRot;
      delete el._startFontSize;
      delete el._startRadius;
    }
    scheduleAutosave();
    updateUiForSelection();
    render();
    if (changed) historyCommit("Transform");
  }

  /* ============================================================
     Tools
     ============================================================ */
  function setTool(t){
    activeTool = t;
    // update tool button states
    const map = [
      [Tool.Select, "toolSelect"],
      [Tool.Text, "toolText"],
      [Tool.Sitelen, "toolSitelen"],
      [Tool.Glyph, "toolGlyph"],
      [Tool.Rect, "toolRect"],
      [Tool.Image, "toolImage"],
      [Tool.Audio, "toolAudio"],
      [Tool.Video, "toolVideo"],
      [Tool.Url, "toolUrl"],
      [Tool.Delete, "toolDelete"],
      [Tool.Pan, "toolPan"],
    ];
    for (const [tool, id] of map){
      const b = $(id);
      b.setAttribute("aria-pressed", (tool === activeTool) ? "true" : "false");
    }
    setStatus(tr("status_tool", tr("tool_"+activeTool)));
  }

  function addElement(el){
    Scene.elements.push(el);
    selectOnlyElements([el.id]);
    scheduleAutosave();
    render();
    historyCommit("Add element");

  }

function resizeCanvasToDisplaySize(){
  const dpr = window.devicePixelRatio || 1;

  // Use the container box (more stable than <canvas> rect in some browsers)
  const rect = wrap.getBoundingClientRect();

  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== w || canvas.height !== h){
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}


  /* ============================================================
     Rendering
     ============================================================ */
  function positionLiveSvgElement(svgEl){
    if (!svgEl) return;

    // The live SVG root can be taller than the logical stage because canonical
    // SVG export adds a bottom bleed for sitelen/vector ink.  The selection
    // canvas, pointer hit testing, and element boxes all use stage coordinates
    // with one scale: Scene.view.zoom.  Therefore the live SVG must be sized
    // from its own root viewBox/width/height, not squeezed into Scene.stage.h.
    // Squeezing the bleed-height SVG into the stage height makes the visible
    // scene use a different Y scale from the interaction overlay, which causes
    // selection boxes and handles to drift away from the visible elements.
    const stageTL = stageToScreen({x:0,y:0});

    const rootWidth = (() => {
      const attr = Number(svgEl.getAttribute('width'));
      if (Number.isFinite(attr) && attr > 0) return attr;
      const vb = parseSvgViewBoxString(svgEl.getAttribute('viewBox'), Scene.stage.w, Scene.stage.h);
      return Math.max(1, Number(vb.w) || Number(Scene.stage.w) || 1);
    })();

    const rootHeight = (() => {
      const attr = Number(svgEl.getAttribute('height'));
      if (Number.isFinite(attr) && attr > 0) return attr;
      const vb = parseSvgViewBoxString(svgEl.getAttribute('viewBox'), Scene.stage.w, Scene.stage.h);
      return Math.max(1, Number(vb.h) || Number(Scene.stage.h) || 1);
    })();

    svgEl.style.left = `${stageTL.x}px`;
    svgEl.style.top = `${stageTL.y}px`;
    svgEl.style.width = `${rootWidth * Scene.view.zoom}px`;
    svgEl.style.height = `${rootHeight * Scene.view.zoom}px`;
    svgEl.style.overflow = 'visible';
  }

  function liveSvgBuildOptions(){
    return {
      includeEditorGrid: true,
      forceStageBackground: true,
      useRasterPreviewForUnselected: true
    };
  }

  async function buildAndSwapLiveSvgScene(){
    const host = document.getElementById("svgStageHost");
    if (!host) return false;
    const seq = ++liveSvgRenderSeq;
    const svgText = await buildSceneSvgText(liveSvgBuildOptions());
    if (seq !== liveSvgRenderSeq) return false;
    host.innerHTML = String(svgText || "").replace(/^<\?xml[^>]*>\s*/i, "");
    positionLiveSvgElement(host.querySelector("svg"));
    return true;
  }

  function renderLiveSvgScene(){
    const host = document.getElementById("svgStageHost");
    if (!host) return;
    if (liveSvgRenderSuspended) return;

    // Keep the previous SVG aligned immediately while the async vector rebuild
    // completes during ordinary pan/zoom/edit rendering.  Page switches suspend
    // this step so the old page is never shown under the new page transform.
    positionLiveSvgElement(host.querySelector("svg"));

    buildAndSwapLiveSvgScene().catch((err) => {
      console.error("Live SVG scene render failed", err);
      setStatus("Live SVG render failed: " + (err?.message || err));
    });
  }

function renderInteractionOverlay(){
  resizeCanvasToDisplaySize();

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // selection overlays
  drawSelectionOverlay();

  // marquee overlay
  if (drag.marquee){
    drawMarquee(drag.marquee);
  }

  updateMediaOverlayPosition();
}

function render(){
  // v30: during page navigation/import atomic swaps, do not touch either the
  // visible SVG stage or the transparent interaction overlay.  The old complete
  // page remains visible until the new complete page SVG has been built off-DOM
  // and swapped in once.  This prevents old-page/new-transform and
  // new-page/old-transform intermediate states from flashing on screen.
  if (liveSceneAtomicDepth > 0) return;

  // v28+: the live scene display uses the same canonical SVG compositor as
  // SVG/PNG/PDF/HTML export. The canvas is only the transparent interaction
  // and selection overlay.
  renderInteractionOverlay();
  renderLiveSvgScene();
}


  function drawGrid(){
    const gs = Math.max(2, Scene.stage.gridSize|0);
    const tl = stageToScreen({x:0,y:0});
    const br = stageToScreen({x:Scene.stage.w,y:Scene.stage.h});
    const sx = tl.x, sy = tl.y, sw = br.x - tl.x, sh = br.y - tl.y;

    const step = gs * Scene.view.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(17,17,17,0.10)";

    // vertical
    for (let x = sx; x <= sx + sw + 0.5; x += step){
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x, sy + sh);
      ctx.stroke();
    }
    // horizontal
    for (let y = sy; y <= sy + sh + 0.5; y += step){
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + sw, y);
      ctx.stroke();
    }

    ctx.restore();

    // stage outline
    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.restore();
  }

  function drawElement(el){
    // Apply view transform: stage->screen
    const p0 = stageToScreen({x: el.x, y: el.y});
    const scale = Scene.view.zoom;

    const cxStage = el.x + el.w/2;
    const cyStage = el.y + el.h/2;
    const c = stageToScreen({x: cxStage, y: cyStage});

    const w = el.w * scale;
    const h = el.h * scale;

    ctx.save();
    ctx.globalAlpha = clamp(el.opacity ?? 1, 0, 1);

    // rotate about center
    ctx.translate(c.x, c.y);
    ctx.rotate(rad(el.rotationDeg || 0));

    // local top-left in screen coords around center
    const lx = -w/2;
    const ly = -h/2;

    // draw by type
    if (el.type === ElementType.Rect){
      drawRectLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Text){
      drawTextLocal(el, lx, ly, w, h, false);
    } else if (el.type === ElementType.Sitelen){
      drawSitelenRasterLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Glyph){
      drawGlyphLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Image){
      drawImageLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Audio){
      drawAudioLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Video){
      drawVideoLocal(el, lx, ly, w, h);
    } else if (el.type === ElementType.Url){
      drawUrlLocal(el, lx, ly, w, h);
    }

    ctx.restore();
  }

  function drawRoundedRectPath(x,y,w,h,r){
    const rr = Math.max(0, Math.min(r, w/2, h/2));
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function snapToDevicePx(v) {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(v * dpr) / dpr;
  }

  function strokePhaseOffsetCssPx(lineWidthCssPx){
    const dpr = window.devicePixelRatio || 1;
    const lwDev = Math.round(lineWidthCssPx * dpr);
    return (lwDev % 2 === 1) ? (0.5 / dpr) : 0;
  }

  function drawRectLocal(el, x,y,w,h){
    const r = el.radius ?? 0;
    const rs = r * Scene.view.zoom;

    // fill (unchanged)
    if (el.fillEnabled && el.fill && el.fill !== "transparent"){
      ctx.save();
      ctx.fillStyle = el.fill;
      drawRoundedRectPath(x,y,w,h, rs);
      ctx.fill();
      ctx.restore();
    }

    // halo
    const haloW = effectiveHaloThicknessForElement(el);
    if (haloW > 0){
      const off = strokePhaseOffsetCssPx(haloW);

      ctx.save();
      if (off) ctx.translate(off, off);
      ctx.lineWidth = haloW;
      ctx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      drawRoundedRectPath(x, y, w, h, rs);
      ctx.stroke();
      ctx.restore();
    }

    // normal stroke
    const strokeW = (el.strokeW ?? 0);
    if (strokeW > 0){
      const swCss = Math.max(1, strokeW) * Scene.view.zoom; // (match your existing scaling if different)
      const off = strokePhaseOffsetCssPx(swCss);

      ctx.save();
      if (off) ctx.translate(off, off);
      ctx.lineWidth = swCss;
      ctx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      drawRoundedRectPath(x, y, w, h, rs);
      ctx.stroke();
      ctx.restore();
    }
  }

  function splitLinesForBox(text){
    return String(text ?? "").replace(/\r\n?/g,"\n").split("\n");
  }


  function measurePlainTextElementBox(el){
    const fontSize = Math.max(6, Number(el?.fontSize ?? 24));
    const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
    const lineHeight = Math.max(0.8, Number(el?.lineHeight ?? 1.15));
    const pad = 8;
    const c = document.createElement("canvas");
    const mctx = c.getContext("2d");
    mctx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
    try { setTextQuality(mctx); } catch {}

    const lines = splitLinesForBox(String(el?.text ?? ""));
    const logicalLines = lines.length ? lines : [""];
    let maxW = 0;
    for (const line of logicalLines){
      const m = mctx.measureText(String(line ?? ""));
      maxW = Math.max(maxW, Number(m.width || 0));
    }

    const naturalW = Math.max(8, Math.ceil(maxW + pad * 2));
    const naturalH = Math.max(8, Math.ceil(logicalLines.length * fontSize * lineHeight + pad * 2));
    return { naturalW, naturalH, pad, fontSize, lineHeight, lineCount: logicalLines.length };
  }

  function updateTextLayout(el, opts = {}){
    if (!el || el.type !== ElementType.Text) return null;
    const m = measurePlainTextElementBox(el);
    const oldX = Number(el.x || 0);
    const oldY = Number(el.y || 0);
    const oldW = Math.max(8, Number(el.w || 8));
    const oldH = Math.max(8, Number(el.h || 8));
    const newW = Math.max(8, Number(m.naturalW || oldW));
    const newH = Math.max(8, Number(m.naturalH || oldH));

    el.textNaturalW = newW;
    el.textNaturalH = newH;
    el.textBoxModelVersion = 1;

    if (Math.abs(oldW - newW) < 0.01 && Math.abs(oldH - newH) < 0.01) return m;

    const preserveCenter = (opts && Object.prototype.hasOwnProperty.call(opts, "preserveCenter"))
      ? !!opts.preserveCenter
      : getElementPreserveCenterOnAutoResize(el);

    if (preserveCenter){
      const cx = oldX + oldW / 2;
      const cy = oldY + oldH / 2;
      el.w = newW;
      el.h = newH;
      el.x = cx - newW / 2;
      el.y = cy - newH / 2;
    } else {
      el.w = newW;
      el.h = newH;
      el.x = oldX;
      el.y = oldY;
    }
    return m;
  }

  function wrapLine(ctx, text, maxWidth){
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words){
      const test = cur ? (cur + " " + w) : w;
      const m = ctx.measureText(test).width;
      if (m <= maxWidth || !cur){
        cur = test;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawTextLocal(el, x,y,w,h, isSitelen){
    // Optional background box if fill/stroke present
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      ctx.save();
      ctx.fillStyle = el.fill;
      ctx.fillRect(x,y,w,h);
      ctx.restore();
    }
    if ((el.strokeW ?? 0) > 0){
      ctx.save();
      ctx.lineWidth = (el.strokeW ?? 1);
      ctx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    }

    const pad = 8 * Scene.view.zoom;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = Math.max(0, w - pad*2);
    const innerH = Math.max(0, h - pad*2);

    const fontSize = Math.max(6, (el.fontSize ?? 24) * Scene.view.zoom);
    const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
    const lineHeight = Math.max(0.8, el.lineHeight ?? 1.15);

    ctx.save();
    ctx.fillStyle = el.color || "#111";
    ctx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;

    // NEW: halo (stroke behind fill) for text-like elements
    const _haloW = effectiveHaloThicknessForElement(el);
    if (_haloW > 0){
      ctx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
      ctx.lineWidth = _haloW;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
    }

    ctx.textBaseline = "top";

    // alignment
    let textAlign = (el.align || "left");
    if (textAlign !== "left" && textAlign !== "center" && textAlign !== "right") textAlign = "left";
    ctx.textAlign = textAlign;

    const rawLines = splitLinesForBox(isSitelen ? prepareSitelenInputWithActiveCartoucheDb(el.text) : el.text);
    const allLines = [];

    for (const ln0 of rawLines){
      const ln = isSitelen ? renderSitelenLineToCanvasText(ln0) : String(ln0 ?? "");
      const wrapped = wrapLine(ctx, ln, innerW);
      for (const wln of wrapped) allLines.push(wln);
    }

    const lhPx = fontSize * lineHeight;
    let ty = innerY;
    for (const ln of allLines){
      if (ty + lhPx > innerY + innerH + 0.5) break;

      let tx = innerX;
      if (textAlign === "center") tx = innerX + innerW/2;
      if (textAlign === "right") tx = innerX + innerW;

      if (_haloW > 0) ctx.strokeText(ln, tx, ty);
      ctx.fillText(ln, tx, ty);
      ty += lhPx;
    }

    ctx.restore();
  }

  function parseCodepointInput(s){
    const raw = String(s ?? "").trim();
    if (!raw) return null;
    // Accept: "U+F1934" or "0xF1934" or a literal character
    if (/^U\+[0-9A-Fa-f]+$/.test(raw)){
      return parseInt(raw.slice(2), 16);
    }
    if (/^0x[0-9A-Fa-f]+$/.test(raw)){
      return parseInt(raw.slice(2), 16);
    }
    if (raw.length === 1){
      return raw.codePointAt(0);
    }
    return null;
  }



// CHANGE HERE: build reverse map (codepoint -> word)
const CP_TO_WORD = (() => {
  const m = new Map();
  for (const [w, cp] of Object.entries(WORD_TO_UCSUR_CP)){
    if (typeof cp === "number") m.set(cp, w);
  }
  return m;
})();

function codepointToWord(cp){
  if (typeof cp !== "number") return null;
  return CP_TO_WORD.get(cp) || null;
}

function codepointToFirstLetter(cp){
  const w = codepointToWord(cp);
  if (!w || !w.length) return null;
  return w[0].toLowerCase();
}

function firstLetterOfWord(w){
  const s = String(w ?? "").trim().toLowerCase();
  return s ? s[0] : null;
}

function makeGlyphPicker(el){
  // Determine currently selected word (by cp)
  const currentCp = parseCodepointInput(el.codepoint);
  const currentWord = codepointToWord(currentCp);

  // Letters present in the map
  const letters = Array.from(new Set(
    Object.keys(WORD_TO_UCSUR_CP).map(firstLetterOfWord).filter(Boolean)
  )).sort();

  // Default letter: from current glyph word, else first in list
  let selectedLetter = currentWord ? firstLetterOfWord(currentWord) : (letters[0] || "a");

  const root = document.createElement("div");
  root.className = "glyphPicker";

  // Letter buttons row
  const lettersRow = document.createElement("div");
  lettersRow.className = "glyphLetters";

  // Words buttons container
  const wordsBox = document.createElement("div");
  wordsBox.className = "glyphWords";

  function renderWords(){
    wordsBox.innerHTML = "";

    const words = Object.keys(WORD_TO_UCSUR_CP)
      .filter(w => firstLetterOfWord(w) === selectedLetter)
      .sort();

    for (const w of words){
      const cp = WORD_TO_UCSUR_CP[w];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "glyphWordBtn";

      const pressed = (currentWord === w);
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");

      // preview glyph + word label
      const preview = document.createElement("span");
      preview.className = "glyphPreview";
      preview.textContent = String.fromCodePoint(cp);

      const label = document.createElement("span");
      label.textContent = w;

      btn.appendChild(preview);
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        // set codepoint in the same format you already accept
        el.codepoint = "U+" + cp.toString(16).toUpperCase();
        scheduleAutosave();
        updateUiForSelection(); // re-render properties so pressed states update
        render();
      });

      wordsBox.appendChild(btn);
    }
  }

  function renderLetters(){
    lettersRow.innerHTML = "";
    for (const L of letters){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "glyphLetterBtn";
      b.textContent = L.toUpperCase();
      b.setAttribute("aria-pressed", (L === selectedLetter) ? "true" : "false");
      b.addEventListener("click", () => {
        selectedLetter = L;
        renderLetters();
        renderWords();
      });
      lettersRow.appendChild(b);
    }
  }

  renderLetters();
  renderWords();

  root.appendChild(lettersRow);
  root.appendChild(wordsBox);
  return root;
}


function drawSitelenRasterLocal(el, x, y, w, h){
  // Optional background box if fill/stroke present (same logic as your text)
  if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
    ctx.save();
    ctx.fillStyle = el.fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if ((el.strokeW ?? 0) > 0){
    ctx.save();
    ctx.lineWidth = (el.strokeW ?? 1);
    ctx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  // Ensure raster exists
  const entry = ensureSitelenRaster(el);
  if (entry && entry.canvas){
    // Draw like image: rotate/stretch handled by caller transform and drawImage scaling
    ctx.drawImage(entry.canvas, x, y, w, h);
  } else {
    // placeholder
    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(x+1, y+1, w-2, h-2);
    ctx.setLineDash([]);
    ctx.restore();
  }
}



  function drawGlyphLocal(el, x,y,w,h){
    // Keep glyph placement consistent with the original layout editor:
    // draw directly from font metrics, centered in the element box.
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      ctx.save();
      ctx.fillStyle = el.fill;
      ctx.fillRect(x,y,w,h);
      ctx.restore();
    }

    const cp = parseCodepointInput(el.codepoint);
    const ch = (typeof cp === "number") ? String.fromCodePoint(cp) : "?";
    const fontSize = Math.max(6, (el.fontSize ?? 64) * Scene.view.zoom);
    const fontFamily = getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT;

    ctx.save();
    ctx.fillStyle = el.color || "#111";
    ctx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;

    const _haloW = effectiveHaloThicknessForElement(el);
    if (_haloW > 0){
      ctx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
      ctx.lineWidth = _haloW;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
    }

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const cx = x + w/2;
    const cy = y + h/2;

    if (_haloW > 0) ctx.strokeText(ch, cx, cy);
    ctx.fillText(ch, cx, cy);

    if ((el.strokeW ?? 0) > 0){
      ctx.save();
      ctx.lineWidth = (el.strokeW ?? 1);
      ctx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawImageLocal(el, x,y,w,h){
    // CHANGE HERE: Image background is always transparent when an image is loaded
    const hasImage = !!(el.image && el.image.assetId && getImageAssetDataUrl(el.image.assetId));

    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      ctx.save();
      ctx.fillStyle = el.fill;
      ctx.fillRect(x,y,w,h);
      ctx.restore();
    }

    const img = ensureImageLoadedForElement(el);
    if (img){
      //ctx.drawImage(img, x, y, w, h);

      const ck = ensureColorKeyRaster(el, img);
      const drawable = (ck && ck.canvas) ? ck.canvas : img;
      ctx.drawImage(drawable, x, y, w, h);
    } else {
      // placeholder
      ctx.save();
      ctx.strokeStyle = "rgba(17,17,17,0.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6,4]);
      ctx.strokeRect(x+1,y+1,w-2,h-2);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(17,17,17,0.55)";
      ctx.font = `${Math.max(12, 16*Scene.view.zoom)}px "PatrickHand", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Image (embedded)", x+w/2, y+h/2);
      ctx.restore();
    }

    if ((el.strokeW ?? 0) > 0){
      ctx.save();
      ctx.lineWidth = (el.strokeW ?? 1);
      ctx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    }
  }

  function drawSelectionOverlay(){
    const sels = getSelectedElements();
    if (!sels.length) return;

    // highlight each selected element outline
    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.65)";
    ctx.lineWidth = 2;

    for (const el of sels){
      const cs = elementCorners(el).map(stageToScreen);
      ctx.beginPath();
      ctx.moveTo(cs[0].x, cs[0].y);
      for (let i=1;i<cs.length;i++) ctx.lineTo(cs[i].x, cs[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // union AABB + handles
    const aabb = getSelectionAabb();
    const tl = stageToScreen({x:aabb.x, y:aabb.y});
    const br = stageToScreen({x:aabb.x + aabb.w, y:aabb.y + aabb.h});
    const x = tl.x, y = tl.y, w = br.x - tl.x, h = br.y - tl.y;

    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.35)";
    ctx.setLineDash([6,4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(x,y,w,h);
    ctx.setLineDash([]);
    ctx.restore();

    const hs = handlesForAabb(aabb);

    // draw handles
    function drawHandle(box, fill){
      const p = stageToScreen({x:box.x, y:box.y});
      const q = stageToScreen({x:box.x+box.w, y:box.y+box.h});
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(17,17,17,0.55)";
      ctx.lineWidth = 1;
      ctx.fillRect(p.x, p.y, q.x - p.x, q.y - p.y);
      ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y);
      ctx.restore();
    }

    const fill = "rgba(255,255,255,0.85)";
    drawHandle(hs.ResizeNW, fill);
    drawHandle(hs.ResizeN, fill);
    drawHandle(hs.ResizeNE, fill);
    drawHandle(hs.ResizeE, fill);
    drawHandle(hs.ResizeSE, fill);
    drawHandle(hs.ResizeS, fill);
    drawHandle(hs.ResizeSW, fill);
    drawHandle(hs.ResizeW, fill);
    drawHandle(hs.Rotate, "rgba(255,255,255,0.95)");

    // draw line to rotate handle
    const c = stageToScreen(hs.center);
    const r = stageToScreen(hs.rotPt);
    ctx.save();
    ctx.strokeStyle = "rgba(17,17,17,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, y);
    ctx.lineTo(r.x, r.y + 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawMarquee(mq){
    const p0 = stageToScreen({x:mq.x0, y:mq.y0});
    const p1 = stageToScreen({x:mq.x1, y:mq.y1});
    const x = Math.min(p0.x,p1.x);
    const y = Math.min(p0.y,p1.y);
    const w = Math.abs(p1.x-p0.x);
    const h = Math.abs(p1.y-p0.y);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.strokeStyle = "rgba(17,17,17,0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x,y,w,h);
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ============================================================
     UI: Properties panel
     ============================================================ */
  const propsBody = $("propsBody");

  function setDisabled(id, v){
    $(id).disabled = !!v;
  }

  function updateUiForSelection(){
    stopMediaPlaybackIfSelectionLost();
    const sels = getSelectedElements();
    const has = sels.length > 0;

    const locked = sels.some(e => !!e.isLocked);

    setDisabled("btnBringFwd", !has || locked);
    setDisabled("btnSendBack", !has || locked);

    // group buttons
    setDisabled("btnGroup", locked || !(sels.length >= 2 && !getGroupIdFromSelection()));
    setDisabled("btnUngroup", locked || !getGroupIdFromSelection());


    renderPropsPanel();
    updateClipboardButtons();

    // Always refresh the persistent floating text editor to reflect current selection
    try { refreshFloatingEditorForSelection(); } catch(e) { console.warn("refreshFloatingEditorForSelection error", e); }

  }

  function commonValue(els, getter){
    if (!els.length) return null;
    const v0 = getter(els[0]);
    for (const e of els){
      if (getter(e) !== v0) return null;
    }
    return v0;
  }

function makeSearchTagField(el, isLocked){
  const f = document.createElement('div');
  f.className = 'field';
  const l = document.createElement('label');
  l.textContent = 'Search tag';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = String(el.searchTag || '');
  inp.placeholder = 'Tag for document search…';
  inp.disabled = !!isLocked;
  if (!isLocked){
    inp.addEventListener('input', () => {
      el.searchTag = inp.value;
      scheduleAutosave();
      try { refreshScrapbookSearchResults(true); } catch {}
    });
  }
  f.appendChild(l);
  f.appendChild(inp);
  return f;
}

function makeReadOnlyRow(label, value){
  const f = document.createElement("div");
  f.className = "field";
  const l = document.createElement("label");
  l.textContent = label;
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = String(value ?? "");
  inp.disabled = true;
  f.appendChild(l);
  f.appendChild(inp);
  return f;
}

function makeLockCheckbox(sels){
  const f = document.createElement("div");
  f.className = "field";

  const l = document.createElement("label");
  l.textContent = tr("locked");

  const cb = document.createElement("input");
  cb.type = "checkbox";

  const any = sels.some(e => !!e.isLocked);
  const all = sels.every(e => !!e.isLocked);

  cb.checked = all;
  cb.indeterminate = (!all && any); // mixed state

  cb.addEventListener("change", () => {
    const v = !!cb.checked;
    for (const e of sels) e.isLocked = v;
    scheduleAutosave();
    updateUiForSelection(); // re-render props + buttons
    render();
    historyCommit("Edit properties");
  });

  f.appendChild(l);
  f.appendChild(cb);
  return f;
}


function makeCheckbox(label, checked, onChange, opts = null){
  const row = document.createElement("div");
  row.className = "row";

  const f = document.createElement("div");
  f.className = "field";

  const l = document.createElement("label");
  l.textContent = label;
  if (opts && opts.mixedLabel){
    const tag = document.createElement("span");
    tag.className = "mixedTag";
    tag.textContent = opts.mixedLabel;
    l.appendChild(tag);
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "10px";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!checked;
  if (opts && opts.indeterminate) cb.indeterminate = true;
  cb.addEventListener("change", () => { onChange(cb.checked); historyCommit("Edit properties"); });

  const txt = document.createElement("div");
  txt.style.fontSize = "13px";
  txt.style.color = "var(--muted)";
  txt.textContent = cb.checked ? tr("toggle_on") : tr("toggle_off");

  cb.addEventListener("change", () => { txt.textContent = cb.checked ? tr("toggle_on") : tr("toggle_off"); historyCommit("Edit properties"); });

  wrap.appendChild(cb);
  wrap.appendChild(txt);

  f.appendChild(l);
  f.appendChild(wrap);
  row.appendChild(f);
  return row;
}

const FloatingTextEditor = {
  root: null,
  header: null,
  title: null,
  ta: null,
  closeBtn: null,
  isOpen: true,
  elementId: null,
  sourceTextarea: null,
  onChange: null,
  _boundElId: null,
  _boundElType: null,
  dragging: false,
  dragPointerId: null,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  suppressSync: false,
  resizeObserver: null,
  storageOpenKey: LS_KEY_TEXT_EDITOR_OPEN,
  storageGeometryKey: LS_KEY_TEXT_EDITOR_GEOMETRY,
  defaultTitle: "Text Editor",
  defaultPlaceholder: "Select a text, sitelen, or glyph element to edit…",
};

const FloatingMediaEditor = {
  root: null,
  header: null,
  title: null,
  ta: null,
  closeBtn: null,
  isOpen: true,
  elementId: null,
  sourceTextarea: null,
  onChange: null,
  _boundElId: null,
  _boundElType: null,
  dragging: false,
  dragPointerId: null,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  suppressSync: false,
  mediaControls: null,
  mediaToggleBtn: null,
  mediaMuteBtn: null,
  mediaRewindBtn: null,
  mediaSlider: null,
  mediaTimeNow: null,
  mediaTimeDur: null,
  mediaHint: null,
  mediaUiTimer: 0,
  resizeObserver: null,
  storageOpenKey: LS_KEY_MEDIA_EDITOR_OPEN,
  storageGeometryKey: LS_KEY_MEDIA_EDITOR_GEOMETRY,
  defaultTitle: "Media Editor",
  defaultPlaceholder: "Select an audio, video, or URL element to edit or control…",
};

const FloatingSitelenEditor = FloatingTextEditor;
const FLOATING_EDITOR_BASE_Z = 11000;
const CONFIRM_DIALOG_TOP_Z = 2147482000;
let floatingEditorZCounter = FLOATING_EDITOR_BASE_Z;


function _floatingEditorViewportLimits(){
  const root = FloatingSitelenEditor.root;
  const minW = Math.max(320, Number(root?.style.minWidth?.replace('px','') || 320) || 320);
  const minH = Math.max(220, Number(root?.style.minHeight?.replace('px','') || 220) || 220);
  const margin = 12;
  const hardMaxW = Math.max(minW, window.innerWidth - margin * 2);
  const hardMaxH = Math.max(minH, window.innerHeight - margin * 2);
  const softMaxW = Math.max(minW, Math.round(window.innerWidth * 0.78));
  const softMaxH = Math.max(minH, Math.round(window.innerHeight * 0.72));
  return {
    margin,
    minW,
    minH,
    maxW: Math.max(minW, Math.min(hardMaxW, softMaxW)),
    maxH: Math.max(minH, Math.min(hardMaxH, softMaxH))
  };
}
function _normalizeFloatingEditorRect(rect, fallbackRect = null){
  const lim = _floatingEditorViewportLimits();
  const base = (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && Number.isFinite(rect.width) && Number.isFinite(rect.height))
    ? rect
    : (fallbackRect || { left: lim.margin, top: lim.margin, width: lim.minW, height: lim.minH });

  let width = Math.max(lim.minW, Math.min(Number(base.width) || lim.minW, lim.maxW));
  let height = Math.max(lim.minH, Math.min(Number(base.height) || lim.minH, lim.maxH));
  let left = Number(base.left);
  let top = Number(base.top);
  if (!Number.isFinite(left)) left = lim.margin;
  if (!Number.isFinite(top)) top = lim.margin;

  const maxLeft = Math.max(0, window.innerWidth - width - lim.margin);
  const maxTop = Math.max(0, window.innerHeight - height - lim.margin);
  left = Math.max(0, Math.min(left, maxLeft));
  top = Math.max(0, Math.min(top, maxTop));

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height)
  };
}
function _floatingEditorDefaultRectFor(editor){
  const stagePanel = document.querySelector('.stagePanel');
  const stageRect = stagePanel ? stagePanel.getBoundingClientRect() : null;
  const lim = _floatingEditorViewportLimits();
  const isMedia = editor === FloatingMediaEditor;
  const fallback = {
    left: isMedia ? 420 : 360,
    top: isMedia ? 180 : 120,
    width: Math.min(isMedia ? 680 : 720, lim.maxW),
    height: Math.min(isMedia ? 320 : 420, lim.maxH)
  };
  if (!stageRect) return _normalizeFloatingEditorRect(fallback, fallback);
  const rect = {
    left: Math.round(stageRect.left + 18 + (isMedia ? 56 : 0)),
    top: Math.round(stageRect.top + 18 + (isMedia ? 56 : 0)),
    width: Math.round(Math.min(isMedia ? 680 : 720, Math.max(lim.minW, stageRect.width - 36))),
    height: Math.round(Math.min(isMedia ? 320 : 420, Math.max(lim.minH, stageRect.height - 36)))
  };
  return _normalizeFloatingEditorRect(rect, fallback);
}
function _getFloatingEditorRect(editor){
  const root = editor && editor.root;
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}
function _isFloatingEditorRectUsable(rect){
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return false;
  const lim = _floatingEditorViewportLimits();
  const margin = 24;
  if (rect.width < lim.minW || rect.height < lim.minH) return false;
  if (rect.width > lim.maxW + 4 || rect.height > lim.maxH + 4) return false;
  if (rect.left > window.innerWidth - margin) return false;
  if (rect.top > window.innerHeight - margin) return false;
  if (rect.left + rect.width < margin) return false;
  if (rect.top + rect.height < margin) return false;
  return true;
}
function persistFloatingEditorGeometryFor(editor){
  const rect = _getFloatingEditorRect(editor);
  if (!rect || !editor?.storageGeometryKey) return;
  const normalized = _normalizeFloatingEditorRect(rect, _floatingEditorDefaultRectFor(editor));
  try { localStorage.setItem(editor.storageGeometryKey, JSON.stringify(normalized)); } catch {}
}
function restoreFloatingEditorGeometryFor(editor, forceStageDefault = false){
  const root = editor && editor.root;
  if (!root) return;
  let rect = null;
  if (!forceStageDefault){
    try {
      const raw = localStorage.getItem(editor.storageGeometryKey);
      if (raw) rect = JSON.parse(raw);
    } catch {}
  }
  if (!_isFloatingEditorRectUsable(rect)) rect = _floatingEditorDefaultRectFor(editor);
  if (!rect) return;
  rect = _normalizeFloatingEditorRect(rect, _floatingEditorDefaultRectFor(editor));
  root.style.left = `${Math.round(rect.left)}px`;
  root.style.top = `${Math.round(rect.top)}px`;
  root.style.width = `${Math.round(rect.width)}px`;
  root.style.height = `${Math.round(rect.height)}px`;
  clampFloatingEditorToViewport(editor);
}
function clampFloatingEditorToViewport(editor){
  const root = editor && editor.root;
  if (!root) return;
  const lim = _floatingEditorViewportLimits();
  const rect = root.getBoundingClientRect();
  let width = Number.isFinite(rect.width) ? rect.width : parseFloat(root.style.width || '0');
  let height = Number.isFinite(rect.height) ? rect.height : parseFloat(root.style.height || '0');
  if (!Number.isFinite(width) || width <= 0) width = lim.minW;
  if (!Number.isFinite(height) || height <= 0) height = lim.minH;
  if (width > lim.maxW) {
    width = lim.maxW;
    root.style.width = `${Math.round(width)}px`;
  }
  if (height > lim.maxH) {
    height = lim.maxH;
    root.style.height = `${Math.round(height)}px`;
  }
  const maxLeft = Math.max(0, window.innerWidth - width - lim.margin);
  const maxTop  = Math.max(0, window.innerHeight - height - lim.margin);
  const curLeft = parseFloat(root.style.left || String(rect.left || 0));
  const curTop  = parseFloat(root.style.top || String(rect.top || 0));
  root.style.left = `${Math.max(0, Math.min(curLeft, maxLeft))}px`;
  root.style.top  = `${Math.max(0, Math.min(curTop, maxTop))}px`;
}
function bringFloatingEditorToFront(editor){
  if (!editor?.root) return;
  floatingEditorZCounter = Math.max(floatingEditorZCounter + 1, FLOATING_EDITOR_BASE_Z + 1);
  editor.root.style.zIndex = String(floatingEditorZCounter);
}
function syncFloatingEditorFromSource(editor, value){
  if (!editor?.ta) return;
  if (editor.suppressSync) return;
  if (editor.ta.value === String(value ?? "")) return;
  editor.suppressSync = true;
  editor.ta.value = String(value ?? "");
  editor.suppressSync = false;
}
function syncFloatingSitelenEditorFromSource(value){
  syncFloatingEditorFromSource(FloatingTextEditor, value);
}

function formatMediaClock(sec){
  const total = Math.max(0, Number(sec || 0) || 0);
  const s = Math.floor(total % 60);
  const m = Math.floor((total / 60) % 60);
  const h = Math.floor(total / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function getMediaDurationSec(el){
  if (!el) return 0;

  if (MediaSession.currentElementId === el.id){
    if (MediaSession.overlayKind === 'video'){
      const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
      return Math.max(0, Number(v && v.duration || 0) || 0);
    }

    if (MediaSession.overlayKind === 'youtube'){
      const liveDur = Math.max(0, Number(MediaSession.youtubeDuration || 0) || 0);
      if (liveDur > 0) return liveDur;

      if (el.type === ElementType.Video){
        return Math.max(0, Number(el.video && el.video.duration || 0) || 0);
      }
      if (el.type === ElementType.Url){
        return Math.max(0, Number(el.url && el.url.duration || 0) || 0);
      }
    }

    if (MediaSession.mediaEl){
      return Math.max(0, Number(MediaSession.mediaEl.duration || 0) || 0);
    }
  }

  if (el.type === ElementType.Audio){
    return Math.max(0, Number(el.audio && el.audio.duration || 0) || 0);
  }
  if (el.type === ElementType.Video){
    return Math.max(0, Number(el.video && el.video.duration || 0) || 0);
  }
  if (el.type === ElementType.Url){
    return Math.max(0, Number(el.url && el.url.duration || 0) || 0);
  }

  return 0;
}
function getMediaCurrentTimeSec(el){
  if (!el) return 0;
  if (MediaSession.currentElementId === el.id){
    if (MediaSession.overlayKind === 'youtube') { ensureYouTubeStateFromPlayer(); return Math.max(0, Number(MediaSession.youtubeCurrentTime || 0) || 0); }
    if (MediaSession.overlayKind === 'video'){
      const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
      return Math.max(0, Number(v && v.currentTime || 0) || 0);
    }
    if (MediaSession.mediaEl) return Math.max(0, Number(MediaSession.mediaEl.currentTime || 0) || 0);
  }
  return getMediaRememberedPositionSec(el);
}
function getMediaMutedForElement(el){
  if (!el) return false;
  if (MediaSession.currentElementId === el.id){
    if (MediaSession.overlayKind === 'youtube') return !!MediaSession.overlayMuted;
    if (MediaSession.overlayKind === 'video'){
      const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
      return !!(v && v.muted);
    }
    if (MediaSession.mediaEl) return !!MediaSession.mediaEl.muted;
  }
  return getMediaRememberedMuted(el);
}
function seekMediaElementTo(el, sec){
  if (!el) return;
  const next = Math.max(0, Number(sec || 0) || 0);
  setMediaRememberedPositionSec(el, next);
  if (MediaSession.currentElementId === el.id){
    if (MediaSession.overlayKind === 'youtube'){
      MediaSession.youtubeCurrentTime = next;
      sendYouTubeCommand('seekTo', [next, true]);
      persistActiveMediaState();
      try { refreshFloatingEditorMediaControls(); } catch {}
    } else if (MediaSession.overlayKind === 'video'){
      const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
      if (v) { try { v.currentTime = next; } catch {} }
    } else if (MediaSession.mediaEl) {
      try { MediaSession.mediaEl.currentTime = next; } catch {}
    }
  }
  scheduleAutosave();
}
function setMediaMutedForElement(el, muted){
  if (!el) return;
  const val = !!muted;
  setMediaRememberedMuted(el, val);
  if (MediaSession.currentElementId === el.id){
    if (MediaSession.overlayKind === 'youtube'){
      MediaSession.overlayMuted = val;
      sendYouTubeCommand(val ? 'mute' : 'unMute', []);
    } else if (MediaSession.overlayKind === 'video'){
      const v = MediaSession.overlayInner && MediaSession.overlayInner.querySelector('video');
      if (v) v.muted = val;
    } else if (MediaSession.mediaEl) {
      MediaSession.mediaEl.muted = val;
    }
  }
  scheduleAutosave();
}
function refreshFloatingMediaEditorControls(){
  const S = FloatingMediaEditor;
  if (!S || !S.mediaControls || !S.mediaSlider) return;
  const el = S._boundElId ? getElementById(S._boundElId) : null;
  const isAudioMedia = !!el && (
    el.type === ElementType.Audio ||
    (el.type === ElementType.Url && el.url && el.url.detectedKind === 'audio')
  );
  const isVideoMedia = !!el && (
    el.type === ElementType.Video ||
    (el.type === ElementType.Url && el.url && el.url.detectedKind === 'video')
  );
  const isPlayableMedia = isAudioMedia || isVideoMedia;
  if (!isPlayableMedia){
    S.mediaControls.classList.add('hidden');
    return;
  }
  S.mediaControls.classList.remove('hidden');
  const current = getMediaCurrentTimeSec(el);
  const duration = Math.max(current, getMediaDurationSec(el), 0);
  S.mediaSlider.max = String(Math.max(duration, 0));
  S.mediaSlider.value = String(Math.min(current, Math.max(duration, current, 0)));
  S.mediaTimeNow.textContent = formatMediaClock(current);
  S.mediaTimeDur.textContent = formatMediaClock(duration);
  S.mediaToggleBtn.textContent = isMediaCurrentlyPausedForElement(el) ? 'Play' : 'Pause';
  S.mediaMuteBtn.textContent = getMediaMutedForElement(el) ? 'Unmute' : 'Mute';
  if (el.type === ElementType.Url){
    S.mediaHint.textContent = isAudioMedia
      ? 'URL audio controls and URL text are both available here.'
      : 'URL video controls and URL text are both available here.';
  } else {
    S.mediaHint.textContent = isAudioMedia
      ? 'Embedded audio controls. Playback resumes from the remembered position.'
      : 'Embedded video controls. Playback resumes from the remembered position.';
  }
}
function refreshFloatingEditorMediaControls(){
  refreshFloatingMediaEditorControls();
}
function closeFloatingTextEditor(){
  const S = FloatingTextEditor;
  if (!S.root) return;
  if (S.root.contains(document.activeElement)) document.activeElement.blur();
  persistFloatingEditorGeometryFor(S);
  S.root.classList.add("hidden");
  S.root.setAttribute("aria-hidden", "true");
  S.isOpen = false;
  S.elementId = null;
  S.sourceTextarea = null;
  S.onChange = null;
  try { localStorage.setItem(S.storageOpenKey, "0"); } catch {}
  syncTextEditorToggleBtn();
}
function closeFloatingMediaEditor(){
  const S = FloatingMediaEditor;
  if (!S.root) return;
  if (S.root.contains(document.activeElement)) document.activeElement.blur();
  persistFloatingEditorGeometryFor(S);
  S.root.classList.add("hidden");
  S.root.setAttribute("aria-hidden", "true");
  S.isOpen = false;
  try { localStorage.setItem(S.storageOpenKey, "0"); } catch {}
  syncMediaEditorToggleBtn();
}
function closeFloatingSitelenEditor(){ closeFloatingTextEditor(); }
function showFloatingTextEditor(){
  const S = FloatingTextEditor;
  if (!S.root) return;
  S.root.classList.remove("hidden");
  S.root.classList.remove("show");
  S.root.setAttribute("aria-hidden", "false");
  S.isOpen = true;
  restoreFloatingEditorGeometryFor(S, false);
  clampFloatingEditorToViewport(S);
  bringFloatingEditorToFront(S);
  try { localStorage.setItem(S.storageOpenKey, "1"); } catch {}
  syncTextEditorToggleBtn();
}
function showFloatingMediaEditor(){
  const S = FloatingMediaEditor;
  if (!S.root) return;
  S.root.classList.remove("hidden");
  S.root.classList.remove("show");
  S.root.setAttribute("aria-hidden", "false");
  S.isOpen = true;
  restoreFloatingEditorGeometryFor(S, false);
  clampFloatingEditorToViewport(S);
  bringFloatingEditorToFront(S);
  try { localStorage.setItem(S.storageOpenKey, "1"); } catch {}
  syncMediaEditorToggleBtn();
}
function showFloatingSitelenEditor(){ showFloatingTextEditor(); }
function syncTextEditorToggleBtn(){
  const btn = document.getElementById("btnToggleTextEditor");
  if (!btn) return;
  const open = !!(FloatingTextEditor && FloatingTextEditor.isOpen);
  btn.setAttribute("aria-pressed", open ? "true" : "false");
}
function syncMediaEditorToggleBtn(){
  const btn = document.getElementById("btnToggleMediaEditor");
  if (!btn) return;
  const open = !!(FloatingMediaEditor && FloatingMediaEditor.isOpen);
  btn.setAttribute("aria-pressed", open ? "true" : "false");
}
function openFloatingTextEditor({ title, elementId, sourceTextarea, onChange }){
  const S = FloatingTextEditor;
  if (!S.root || !S.ta) return;
  S.elementId = elementId || null;
  S.sourceTextarea = sourceTextarea || null;
  S.onChange = onChange || null;
  if (S.title) S.title.textContent = String(title || "Text");
  if (sourceTextarea) S.ta.value = String(sourceTextarea.value || "");
  showFloatingTextEditor();
  if (!S.ta.disabled) S.ta.focus();
}
function openFloatingSitelenEditor(args){ openFloatingTextEditor(args); }
function rebindFloatingSitelenEditorToTextarea(elementId, textareaEl, onChange){
  const S = FloatingTextEditor;
  if (!S.elementId || S.elementId !== elementId) return;
  if (!textareaEl) return;
  S.sourceTextarea = textareaEl;
  S.onChange = onChange;
  if (textareaEl.value !== S.ta.value) textareaEl.value = S.ta.value;
}
function _setTextEditorActionButtons(enabled){
  const expBtn = document.getElementById("btnTextEditorExport");
  const impBtn = document.getElementById("btnTextEditorImport");
  if (expBtn) expBtn.disabled = !enabled;
  if (impBtn) impBtn.disabled = !enabled;
}
function _setFloatEditorActionButtons(enabled){ _setTextEditorActionButtons(enabled); }
function refreshFloatingTextEditorForSelection(forceLeaderId){
  const S = FloatingTextEditor;
  if (!S.root || !S.ta || !S.isOpen) return;
  const sels = getSelectedElements();
  let leader = null;
  if (sels.length === 1){
    leader = sels[0];
  } else if (sels.length > 1){
    const selIdSet = new Set(sels.map(e => e.id));
    if (forceLeaderId) leader = Scene.elements.find(e => e && e.id === forceLeaderId && selIdSet.has(e.id)) || null;
    if (!leader) {
      const clickPt = _lastGroupClickPt;
      let spatialMatch = null;
      let zorderMatch = null;
      for (let i = Scene.elements.length - 1; i >= 0; i--){
        const e = Scene.elements[i];
        if (!e || !selIdSet.has(e.id)) continue;
        const isTextLike = e.type === ElementType.Text || e.type === ElementType.Sitelen || e.type === ElementType.Glyph;
        if (!isTextLike) continue;
        if (!zorderMatch) zorderMatch = e;
        if (clickPt && !spatialMatch && pointInElement(clickPt, e)) spatialMatch = e;
        if (zorderMatch && (spatialMatch || !clickPt)) break;
      }
      leader = spatialMatch || zorderMatch;
    }
  }
  const leaderType = leader ? leader.type : null;
  const isTextable = leaderType === ElementType.Text || leaderType === ElementType.Sitelen || leaderType === ElementType.Glyph;
  if (!leader || !isTextable){
    // Keep the text popout bound to its last text-like element when the user
    // selects a non-text element or interacts with the media popout. Only
    // clear if the currently bound element no longer exists.
    const boundEl = S._boundElId ? getElementById(S._boundElId) : null;
    if (boundEl && (boundEl.type === ElementType.Text || boundEl.type === ElementType.Sitelen || boundEl.type === ElementType.Glyph)){
      return;
    }
    S._boundElId = null; S._boundElType = null; S.elementId = null; S.sourceTextarea = null; S.onChange = null;
    S.suppressSync = true; S.ta.value = ""; S.suppressSync = false;
    S.ta.disabled = true; S.ta.placeholder = S.defaultPlaceholder;
    if (S.title) S.title.textContent = S.defaultTitle;
    _setTextEditorActionButtons(false);
    return;
  }
  const wasEditingThisElement = (
    document.activeElement === S.ta &&
    S._boundElId === leader.id &&
    !S.ta.disabled
  );

  S._boundElId = leader.id; S._boundElType = leaderType; S.ta.disabled = false; _setTextEditorActionButtons(true);
  let displayText = ""; let titleStr = "";
  if (leaderType === ElementType.Text){ displayText = String(leader.text ?? ""); titleStr = "Text"; }
  else if (leaderType === ElementType.Sitelen){ displayText = String(leader.text ?? ""); titleStr = "Sitelen"; }
  else if (leaderType === ElementType.Glyph){
    const cp = parseCodepointInput(leader.codepoint);
    const word = (typeof cp === "number") ? codepointToWord(cp) : null;
    displayText = word || String(leader.codepoint ?? "");
    titleStr = "Glyph";
  }
  if (S.title) S.title.textContent = titleStr;

  // Do not overwrite the floating text editor while the user is actively typing
  // into the same selected element. Scene redraws and async sitelen raster
  // rebuilds can refresh selection state; this guard keeps raw sitelen source
  // editable instead of resetting the textarea on every render/update.
  if (!wasEditingThisElement) {
    S.suppressSync = true;
    if (S.ta.value !== displayText) S.ta.value = displayText;
    S.suppressSync = false;
  }

  S.ta.disabled = false;
  S.ta.placeholder = "";
  S.elementId = leader.id;
  S.sourceTextarea = null;
  const elId = leader.id;
  S.onChange = (v) => {
    const el = getElementById(elId);
    if (!el) return;
    if (el.type === ElementType.Text){
      el.text = v; updateTextLayout(el); scheduleAutosave(); render();
    } else if (el.type === ElementType.Sitelen){
      el.text = v; invalidateSitelenCache(el.id); updateSitelenLayout(el, { preserveCenter: true }, true); scheduleAutosave(); render();
    } else if (el.type === ElementType.Glyph){
      const trimmed = String(v || "").trim().toLowerCase();
      const cp = WORD_TO_UCSUR_CP[trimmed];
      if (cp != null){
        el.codepoint = "U+" + cp.toString(16).toUpperCase();
        invalidateGlyphCache(el.id); scheduleAutosave(); render(); updateUiForSelection();
      }
    }
  };
}
function refreshFloatingMediaEditorForSelection(forceLeaderId){
  const S = FloatingMediaEditor;
  if (!S.root || !S.ta) return;
  const sels = getSelectedElements();
  let leader = null;
  if (sels.length === 1){
    leader = sels[0];
  } else if (sels.length > 1){
    const selIdSet = new Set(sels.map(e => e.id));
    if (forceLeaderId) leader = Scene.elements.find(e => e && e.id === forceLeaderId && selIdSet.has(e.id)) || null;
    if (!leader) {
      const clickPt = _lastGroupClickPt;
      let spatialMatch = null;
      let zorderMatch = null;
      for (let i = Scene.elements.length - 1; i >= 0; i--){
        const e = Scene.elements[i];
        if (!e || !selIdSet.has(e.id)) continue;
        const isMediaLike = e.type === ElementType.Audio || e.type === ElementType.Video || e.type === ElementType.Url;
        if (!isMediaLike) continue;
        if (!zorderMatch) zorderMatch = e;
        if (clickPt && !spatialMatch && pointInElement(clickPt, e)) spatialMatch = e;
        if (zorderMatch && (spatialMatch || !clickPt)) break;
      }
      leader = spatialMatch || zorderMatch;
    }
  }
  const leaderType = leader ? leader.type : null;
  const isMediaLike = leaderType === ElementType.Audio || leaderType === ElementType.Video || leaderType === ElementType.Url;
  if (!leader || !isMediaLike){
    // Keep the media popout bound to its last media element when the user
    // selects a non-media element. Only clear if the currently bound element
    // no longer exists.
    const boundEl = S._boundElId ? getElementById(S._boundElId) : null;
    if (boundEl && (boundEl.type === ElementType.Audio || boundEl.type === ElementType.Video || boundEl.type === ElementType.Url)){
      refreshFloatingMediaEditorControls();
      return;
    }
    S._boundElId = null; S._boundElType = null; S.elementId = null; S.sourceTextarea = null; S.onChange = null;
    S.suppressSync = true; S.ta.value = ""; S.suppressSync = false;
    S.ta.disabled = true; S.ta.placeholder = S.defaultPlaceholder;
    if (S.title) S.title.textContent = S.defaultTitle;
    S.mediaControls.classList.add('hidden');
    return;
  }
  S._boundElId = leader.id; S._boundElType = leaderType; S.elementId = leader.id;
  let displayText = ""; let titleStr = "";
  if (leaderType === ElementType.Url){ displayText = String(leader.url && leader.url.href || ""); titleStr = "URL"; }
  else if (leaderType === ElementType.Audio){ displayText = ""; titleStr = "Audio"; }
  else if (leaderType === ElementType.Video){ displayText = ""; titleStr = "Video"; }
  if (S.title) S.title.textContent = titleStr;
  S.suppressSync = true;
  if (S.ta.value !== displayText) S.ta.value = displayText;
  S.suppressSync = false;
  if (leaderType === ElementType.Url){ S.ta.disabled = false; S.ta.placeholder = ''; }
  else { S.ta.disabled = true; S.ta.placeholder = leaderType === ElementType.Audio ? 'Embedded audio has playback controls below.' : 'Embedded video has playback controls below.'; }
  refreshFloatingMediaEditorControls();
  const elId = leader.id;
  S.onChange = (v) => {
    const el = getElementById(elId);
    if (!el || el.type !== ElementType.Url) return;
    const clean = String(v || '').trim();
    const det = detectUrlKindFromHref(clean);
    if (!el.url || typeof el.url !== 'object') el.url = {};
    const prevHref = String(el.url.href || '');
    const prevKind = String(el.url.detectedKind || 'link');
    el.url.href = clean;
    el.url.detectedKind = det.kind;
    el.url.title = clean;
    el.url.mimeHint = det.mimeHint;
    if (!clean){
      el.url.posterAssetId = null; el.url.posterRemoteHref = ''; el.url.posterAttempted = false;
    } else if (clean !== prevHref || det.kind !== prevKind){
      el.url.posterAssetId = null; el.url.posterRemoteHref = ''; el.url.posterAttempted = false;
      ensureImmediateRemotePosterHint(el);
      const defer = globalThis.requestIdleCallback ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 1500 }) : (fn) => window.setTimeout(fn, 0);
      defer(async () => {
        try {
          const did = await maybePopulatePosterForUrlElement(el, { force: true });
          scheduleAutosave();
          if (did) { try { renderScrapbookSidebar(); } catch {} }
          updateUiForSelection(); render();
        } catch (err) {
          console.warn('Deferred URL poster population failed', err);
          scheduleAutosave(); updateUiForSelection(); render();
        }
      });
    }
    el.title = clean; scheduleAutosave();
    try { renderScrapbookSidebar(); } catch {}
    updateUiForSelection(); render();
  };
}
function refreshFloatingEditorForSelection(forceLeaderId){
  refreshFloatingTextEditorForSelection(forceLeaderId);
  refreshFloatingMediaEditorForSelection(forceLeaderId);
}
function initSingleFloatingEditor(S, ids){
  S.root = $(ids.root); S.header = $(ids.header); S.title = $(ids.title); S.ta = $(ids.ta); S.closeBtn = $(ids.closeBtn);
  if (ids.mediaControls){
    S.mediaControls = $(ids.mediaControls); S.mediaToggleBtn = $(ids.mediaToggleBtn); S.mediaMuteBtn = $(ids.mediaMuteBtn); S.mediaRewindBtn = $(ids.mediaRewindBtn); S.mediaSlider = $(ids.mediaSlider); S.mediaTimeNow = $(ids.mediaTimeNow); S.mediaTimeDur = $(ids.mediaTimeDur); S.mediaHint = $(ids.mediaHint);
  }
  if (!S.root || !S.header || !S.ta) return;
  let wasOpen = false;
  try { wasOpen = localStorage.getItem(S.storageOpenKey) === '1'; } catch {}
  restoreFloatingEditorGeometryFor(S, !wasOpen);
  if (wasOpen){
    if (S === FloatingTextEditor) showFloatingTextEditor(); else showFloatingMediaEditor();
  } else {
    S.root.classList.add('hidden'); S.root.setAttribute('aria-hidden', 'true'); S.isOpen = false;
  }
  S.ta.disabled = true;
  if (S === FloatingTextEditor) _setTextEditorActionButtons(false);
  const bring = () => bringFloatingEditorToFront(S);
  ['pointerdown','mousedown','focusin'].forEach(evt => S.root.addEventListener(evt, bring, true));
  if (S.closeBtn){
    S.closeBtn.addEventListener('click', () => {
      if (S === FloatingTextEditor) closeFloatingTextEditor(); else closeFloatingMediaEditor();
    });
  }
  S.ta.addEventListener('input', () => {
    bring();
    if (S.suppressSync) return;
    const v = S.ta.value;
    if (S.sourceTextarea && S.sourceTextarea.value !== v){ S.suppressSync = true; S.sourceTextarea.value = v; S.suppressSync = false; }
    if (typeof S.onChange === 'function') S.onChange(v);
  });
  S.ta.addEventListener('blur', () => {
    if (typeof S.onChange === 'function' && !S.suppressSync) S.onChange(S.ta.value);
    try { historyCommit(S === FloatingTextEditor ? 'Edit text' : 'Edit media'); } catch {}
  });
  S.header.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest('button')) return;
    bring();
    const rect = S.root.getBoundingClientRect();
    S.dragging = true; S.dragPointerId = e.pointerId; S.startX = e.clientX; S.startY = e.clientY; S.startLeft = rect.left; S.startTop = rect.top;
    S.header.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  S.header.addEventListener('pointermove', (e) => {
    if (!S.dragging || S.dragPointerId !== e.pointerId) return;
    const dx = e.clientX - S.startX; const dy = e.clientY - S.startY;
    S.root.style.left = `${S.startLeft + dx}px`; S.root.style.top = `${S.startTop + dy}px`;
    clampFloatingEditorToViewport(S);
  });
  function stopDrag(e){
    if (!S.dragging) return;
    if (e && S.dragPointerId != null && e.pointerId !== S.dragPointerId) return;
    S.dragging = false; if (S.dragPointerId != null) S.header.releasePointerCapture?.(S.dragPointerId); S.dragPointerId = null; persistFloatingEditorGeometryFor(S);
  }
  S.header.addEventListener('pointerup', stopDrag); S.header.addEventListener('pointercancel', stopDrag);
  if (typeof ResizeObserver === 'function'){
    if (S.resizeObserver) { try { S.resizeObserver.disconnect(); } catch {} }
    S.resizeObserver = new ResizeObserver(() => { clampFloatingEditorToViewport(S); if (S.isOpen) persistFloatingEditorGeometryFor(S); });
    S.resizeObserver.observe(S.root);
  }
  window.addEventListener('pointerup', () => { if (!S.root || !S.isOpen) return; clampFloatingEditorToViewport(S); persistFloatingEditorGeometryFor(S); }, true);
  window.addEventListener('resize', () => { clampFloatingEditorToViewport(S); });
}
function initFloatingTextEditor(){
  const S = FloatingTextEditor;
  initSingleFloatingEditor(S, { root:'floatingTextEditor', header:'floatingTextEditorHeader', title:'floatingTextEditorTitle', ta:'floatingTextEditorTextarea', closeBtn:'btnCloseFloatingTextEditor' });
  try { syncTextEditorToggleBtn(); } catch {}
  const exportBtn = $('btnTextEditorExport');
  if (exportBtn){
    exportBtn.addEventListener('click', () => {
      if (S.ta.disabled || !S._boundElId) return;
      const txt = S.ta.value;
      const typeLabel = (S._boundElType || 'text').toLowerCase();
      const elId = String(S._boundElId || 'element').replace(/[^a-z0-9_-]/gi, '_').slice(0, 24);
      const filename = `${typeLabel}-${elId}.txt`;
      try {
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (err) { alert('Export failed: ' + (err.message || String(err))); }
    });
  }
  const importBtn = $('btnTextEditorImport'); const filePick = $('floatTextEditorFilePick');
  if (importBtn && filePick){
    importBtn.addEventListener('click', () => {
      if (S.ta.disabled || !S._boundElId){ alert('Select a text, sitelen, or glyph element first.'); return; }
      const cur = String(S.ta.value ?? '');
      if (cur.trim().length > 0 && !confirm('Replace the current element text with the contents of a .txt file?')) return;
      filePick.value = ''; filePick.click();
    });
    filePick.addEventListener('change', async () => {
      try {
        const f = filePick.files && filePick.files[0]; if (!f) return;
        const txt = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read file.')); reader.readAsText(f, 'utf-8'); });
        if (S.ta.disabled || !S._boundElId){ alert('No editable element is currently selected.'); return; }
        if (S._boundElType === ElementType.Glyph){
          const trimmed = String(txt ?? '').trim().toLowerCase();
          const cp = WORD_TO_UCSUR_CP[trimmed];
          if (cp == null){ alert(`"${trimmed}" is not a recognised toki pona word. The glyph was not changed.`); return; }
        }
        S.suppressSync = true; S.ta.value = txt; S.suppressSync = false; S.ta.dispatchEvent(new Event('input', { bubbles: true }));
        try { historyCommit('Import text'); } catch {}
      } catch (err) { alert('Import failed: ' + (err.message || String(err))); }
      finally { filePick.value = ''; }
    });
  }
  document.addEventListener('pointerdown', (e) => {
    if (document.activeElement !== S.ta) return;
    const canvasWrap = document.getElementById('canvasWrap');
    if (!canvasWrap || !canvasWrap.contains(e.target)) return;
    if (!selectedIds || selectedIds.size <= 1) return;
    const r = canvasWrap.getBoundingClientRect();
    const screenPt = { x: e.clientX - r.left, y: e.clientY - r.top };
    const stagePt = screenToStage(screenPt);
    const hitEl = pickTopmostElementAtStagePoint(stagePt);
    if (!hitEl) return;
    if (!(hitEl.type === ElementType.Text || hitEl.type === ElementType.Sitelen || hitEl.type === ElementType.Glyph)) return;
    if (hitEl.id !== S._boundElId) { _lastGroupClickPt = stagePt; try { renderPropsPanel(); } catch(err) { console.warn(err); } refreshFloatingTextEditorForSelection(hitEl.id); }
  }, true);
}
function initFloatingMediaEditor(){
  const S = FloatingMediaEditor;
  initSingleFloatingEditor(S, { root:'floatingMediaEditor', header:'floatingMediaEditorHeader', title:'floatingMediaEditorTitle', ta:'floatingMediaEditorTextarea', closeBtn:'btnCloseFloatingMediaEditor', mediaControls:'floatingMediaEditorControls', mediaToggleBtn:'btnFloatingMediaEditorToggle', mediaMuteBtn:'btnFloatingMediaEditorMute', mediaRewindBtn:'btnFloatingMediaEditorRewind', mediaSlider:'floatingMediaEditorSlider', mediaTimeNow:'floatingMediaEditorTimeNow', mediaTimeDur:'floatingMediaEditorTimeDur', mediaHint:'floatingMediaEditorHint' });
  if (S.mediaToggleBtn){ S.mediaToggleBtn.addEventListener('click', () => { bringFloatingEditorToFront(S); const el = S._boundElId ? getElementById(S._boundElId) : null; if (!el) return; toggleMediaPlayPause(el); window.setTimeout(refreshFloatingMediaEditorControls, 60); }); }
  if (S.mediaMuteBtn){ S.mediaMuteBtn.addEventListener('click', () => { bringFloatingEditorToFront(S); const el = S._boundElId ? getElementById(S._boundElId) : null; if (!el) return; setMediaMutedForElement(el, !getMediaMutedForElement(el)); refreshFloatingMediaEditorControls(); }); }
  if (S.mediaRewindBtn){ S.mediaRewindBtn.addEventListener('click', () => { bringFloatingEditorToFront(S); const el = S._boundElId ? getElementById(S._boundElId) : null; if (!el) return; if (MediaSession.currentElementId === el.id) rewindMediaElement(5); else seekMediaElementTo(el, Math.max(0, getMediaCurrentTimeSec(el) - 5)); window.setTimeout(refreshFloatingMediaEditorControls, 60); }); }
  if (S.mediaSlider){
    const onSeek = () => { const el = S._boundElId ? getElementById(S._boundElId) : null; if (!el) return; seekMediaElementTo(el, Number(S.mediaSlider.value || 0) || 0); refreshFloatingMediaEditorControls(); };
    S.mediaSlider.addEventListener('input', onSeek, { passive: true }); S.mediaSlider.addEventListener('change', onSeek, { passive: true });
  }
  if (S.mediaUiTimer) clearInterval(S.mediaUiTimer);
  S.mediaUiTimer = window.setInterval(() => { if (S.isOpen && S._boundElId) refreshFloatingMediaEditorControls(); }, 350);
}
function initFloatingSitelenEditor(){ initFloatingTextEditor(); initFloatingMediaEditor(); }


let allowMixedTextEdit = false; // multi-select text editing gate

function renderPropsPanel(){
  propsBody.innerHTML = "";

  const sels = getSelectedElements();

  if (!sels.length){
    propsBody.innerHTML = `<div class="hint">${tr("props_hint")}</div>`;
    return;
  }

  const single = sels.length === 1;

  // “Active” group if either:
  // - multi-select where all selected share the same groupId, OR
  // - single-select where the element belongs to a group
  const groupId = getGroupIdFromSelection() || (single ? (sels[0].groupId || null) : null);


  // Small section divider
  function addSection(title){
    const d = document.createElement("div");
    d.className = "hint";
    d.style.background = "rgba(255,255,255,0.22)";
    d.style.borderStyle = "dashed";
    d.style.padding = "8px 10px";
    d.style.fontSize = "13px";
    d.textContent = title;
    propsBody.appendChild(d);
  }

  // Header
  const header = document.createElement("div");
  header.className = "hint";
  function labelForElementType(type){
    const k = "etype_" + String(type || "").toLowerCase();
    const v = tr(k);
    return (v && v !== k) ? v : String(type || "");
  }

  header.textContent = single
    ? tr("props_header_single", labelForElementType(sels[0].type), sels[0].id)
    : (groupId
        ? tr("props_header_group", sels.length, groupId)
        : tr("props_header_multi", sels.length)
      );
  propsBody.appendChild(header);


    // CHANGE HERE: isLocked is always the first editable property
  propsBody.appendChild(makeLockCheckbox(sels));

  // CHANGE HERE: if ANY selected element is locked, block normal editing, but still allow media/link usage for a single selected media/link element.
  if (sels.some(e => !!e.isLocked)){
    const msg = document.createElement("div");
    msg.className = "hint";
    msg.textContent = tr("msg_locked_selection");
    propsBody.appendChild(msg);
    if (sels.length === 1 && (sels[0].type === ElementType.Audio || sels[0].type === ElementType.Video || sels[0].type === ElementType.Url)){
      const el = sels[0];
      addSection('Media / Link');
      const row = document.createElement('div'); row.className = 'row';
      const mkBtn = (label, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
      if (el.type === ElementType.Audio || el.type === ElementType.Video){
        row.appendChild(mkBtn('Play', () => playMediaElement(el)));
        row.appendChild(mkBtn('Play/Pause', () => toggleMediaPlayPause(el)));
        row.appendChild(mkBtn('Rewind 5s', () => rewindMediaElement(5)));
      }
      if (el.type === ElementType.Url) row.appendChild(mkBtn('Open link', () => openUrlExternal(el.url && el.url.href || '')));
      else if (el.sourceUrl) row.appendChild(mkBtn('Open source', () => openUrlExternal(el.sourceUrl)));
      propsBody.appendChild(row);
    }
    return;
  }

  // Common values for multi or single
  const commonFill = commonValue(sels, e => e.fill);
  const commonFillEnabled = commonValue(sels, e => e.fillEnabled);
  const commonStroke = commonValue(sels, e => e.stroke);
  const commonOpacity = commonValue(sels, e => String(e.opacity ?? 1));
  const commonStrokeW = commonValue(sels, e => String(e.strokeW ?? 0));

  // Helper: common appearance block (useful for both single and multi)
  function addAppearanceBlock(){
    addSection(tr("sec_appearance"));

    propsBody.appendChild(makeCheckbox(tr("props_allow_fill"), (commonFillEnabled ?? sels[0].fillEnabled) || false, (v) => {
      for (const e of sels) e.fillEnabled = !!v; // if multi-select supported
      scheduleAutosave();
      render();
    }));

    propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_fill"),
      (commonFill ?? sels[0].fill) || "#FFFFFF",
      (v) => {
        // LIVE preview only
        for (const e of sels) {
          if (APP_VECTOR_DEBUG) console.log("Live fill :" + v);
          e.fill = v;

          if (e.type === ElementType.Sitelen){
            invalidateSitelenCache(e.id);
            updateSitelenLayout(e, { preserveCenter: true });
          }
        }

        render();
      },
      (v) => {
        // COMMIT
        for (const e of sels) {
          if (APP_VECTOR_DEBUG) console.log("Commit fill :" + v);
          e.fill = v;

          if (e.type === ElementType.Sitelen){
            invalidateSitelenCache(e.id);
            updateSitelenLayout(e, { preserveCenter: true });
          }
        }

        scheduleAutosave();
        render();
        //renderPropsPanel(); // safe now
      }
    ));




    propsBody.appendChild(makeColorPickerWithSwatch(
       tr("props_stroke"),
     (commonStroke ?? sels[0].stroke) || "#111111",
      (v) => {
        // LIVE preview only
        for (const e of sels) {
          if (APP_VECTOR_DEBUG) console.log("Live stroke :" + v);
          e.stroke = v;

          if (e.type === ElementType.Sitelen){
            invalidateSitelenCache(e.id);
            updateSitelenLayout(e, { preserveCenter: true });
          }
        }

        render();
      },
      (v) => {
        // COMMIT
        for (const e of sels) {
          if (APP_VECTOR_DEBUG) console.log("Commit stroke :" + v);
          e.stroke = v;

          if (e.type === ElementType.Sitelen){
            invalidateSitelenCache(e.id);
            updateSitelenLayout(e, { preserveCenter: true });
          }
        }

        scheduleAutosave();
        render();
        //renderPropsPanel(); // safe now
      }
    ));

    propsBody.appendChild(makeNumberRow(
      "strokeW",
      tr("props_stroke_width"),
      Number(commonStrokeW ?? sels[0].strokeW ?? 0),
      1,
      (v) => { for (const e of sels) e.strokeW = Math.max(0, v); scheduleAutosave(); render(); },
      (commonStrokeW === null && !single) ? tr("props_mixed") : null
    ));

    propsBody.appendChild(makeNumberRow(
      "opacity",
      tr("props_opacity"),
      Number(commonOpacity ?? (sels[0].opacity ?? 1)),
      0.05,
      (v) => { for (const e of sels) e.opacity = clamp(v, 0, 1); scheduleAutosave(); render(); },
      (commonOpacity === null && !single) ? tr("props_mixed") : null,
      0,
      1
    ));
  }

  // Group-level controls (show whenever we have a groupId)
  if (groupId){
    addSection(tr("sec_group"));

    const g = Scene.groups[groupId] || (Scene.groups[groupId] = {
      id: groupId,
      createdAt: new Date().toISOString(),
      foreground: "#111111"
    });

    const fg = rgbaOrHexToHex(g.foreground || "#111111", "#111111");

    propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_foreground_group"),
      fg,
      (v) => {            // LIVE preview only
        if (APP_VECTOR_DEBUG) console.log("Live group foreground :" + v);
        applyGroupForeground(groupId, v);
        render();
      },
      (v) => {            // COMMIT
        if (APP_VECTOR_DEBUG) console.log("Commit group foreground :" + v);
        applyGroupForeground(groupId, v);
        scheduleAutosave();
        render();
        //renderPropsPanel();
      }
    ));
  }


  // Multi-select: show union of supported controls.
  // Values are taken from the *topmost* selected element that supports that property.
  if (!single){
    // ---- Helpers (local) ----
    const selIdSet = new Set(sels.map(e => e.id));

    function topmostSelectedWhere(pred){
      const clickPt = _lastGroupClickPt;
      let zorderMatch = null;
      for (let i = (Scene.elements.length - 1); i >= 0; i--){
        const e = Scene.elements[i];
        if (!e || !selIdSet.has(e.id)) continue;
        if (!pred(e)) continue;
        if (!zorderMatch) zorderMatch = e;
        if (clickPt && pointInElement(clickPt, e)) return e;
      }
      return zorderMatch;
    }

    function distinctValues(arr){
      const out = [];
      for (const v of arr){
        const s = (v == null) ? "__NULL__" : String(v);
        if (!out.includes(s)) out.push(s);
      }
      return out;
    }

    function isTextLike(e){ return e && (e.type === ElementType.Text || e.type === ElementType.Sitelen || e.type === ElementType.Glyph); }
    function supportsTextBlock(e){ return e && (e.type === ElementType.Text || e.type === ElementType.Sitelen); }
    function supportsGlyphBlock(e){ return e && (e.type === ElementType.Glyph); }
    function supportsRect(e){ return e && (e.type === ElementType.Rect); }
    function supportsImage(e){ return e && (e.type === ElementType.Image); }
    function supportsHalo(e){ return e && elementSupportsHalo(e); } // existing helper

    function mixedLabelIfMixed(values){
      const d = distinctValues(values);
      return (d.length > 1) ? tr("props_mixed") : null;
    }

    function applyToAllWhere(pred, fn){
      for (const e of sels){
        if (!pred(e)) continue;
        fn(e);
      }
    }

    // ---- Blocks ----

    // Text/Sitelen shared block
    const anyTextLike = sels.some(supportsTextBlock);
    if (anyTextLike){
      addSection(tr("sec_text"));

      // Text
      const leaderText = topmostSelectedWhere(supportsTextBlock);
const textEls = sels.filter(supportsTextBlock);
const textVals = textEls.map(e => String(e.text ?? ""));
const textMixed = mixedLabelIfMixed(textVals);

// When multiple text-like elements are selected and their text differs, lock editing by default.
// User can explicitly enable "Edit mixed text" to bulk-apply a new value.
if (textEls.length > 1 && textMixed){
  propsBody.appendChild(makeCheckbox(
    tr("props_edit_mixed_text"),
    !!allowMixedTextEdit,
    (checked) => {
      allowMixedTextEdit = !!checked;
      // No side effects until text is actually edited.
      renderPropsPanel();
    }
  ));
} else {
  // Reset gate when it is not applicable (keeps UX predictable).
  allowMixedTextEdit = false;
}

const placeholder = tr("sitelen_placeholder");
const textField = makeTextarea(
  tr("props_text") + (textMixed ? " (" + textMixed + ")" : ""),
  leaderText ? (leaderText.text ?? "") : "",
  placeholder,
  (v) => {
    applyToAllWhere(supportsTextBlock, (e) => {
      e.text = v;
      if (e.type === ElementType.Text){
        updateTextLayout(e);
      } else if (e.type === ElementType.Sitelen){
        invalidateSitelenCache(e.id);
        updateSitelenLayout(e, { preserveCenter: true }, true);
      }
    });
    scheduleAutosave();
    render();
    // IMPORTANT: do not call updateUiForSelection() on every keystroke,
    // because it re-renders the properties panel and steals focus.
  },
  (() => {
    const disabled = (textEls.length > 1 && textMixed && !allowMixedTextEdit);

    // Show pop-out button when multiple Sitelen elements are selected AND text editing is allowed.
    const sitelenIds = sels.filter(e => e && e.type === ElementType.Sitelen).map(e => String(e.id)).sort();
    const enablePopout = (!disabled) && (sitelenIds.length >= 2);

    return {
      enablePopout,
      popoutTitle: "Sitelen",
      popoutElementId: enablePopout ? ("multi:sitelen:" + sitelenIds.join(",")) : null,
      disabled
    };
  })()
);
propsBody.appendChild(textField);

const autoResizeTextLikeEls = sels.filter(isTextLike);
if (autoResizeTextLikeEls.length){
  const preserveVals = autoResizeTextLikeEls.map(e => String(!!getElementPreserveCenterOnAutoResize(e)));
  const preserveMixed = mixedLabelIfMixed(preserveVals);
  const preserveLeader = topmostSelectedWhere(isTextLike) || autoResizeTextLikeEls[0];
  propsBody.appendChild(makeCheckbox(
    tr("props_preserve_center_auto_resize"),
    !!getElementPreserveCenterOnAutoResize(preserveLeader),
    (checked) => {
      applyToAllWhere(isTextLike, (e) => {
        e.preserveCenterOnAutoResize = !!checked;
        if (e.type === ElementType.Sitelen){
          if (e.sitelenResizeAnchor !== "fixed") e.sitelenResizeAnchor = checked ? "centre" : "topLeft";
          invalidateSitelenCache(e.id);
          updateSitelenLayout(e);
        }
        if (e.type === ElementType.Glyph){
          invalidateGlyphCache(e.id);
          queueGlyphRasterRebuild(e);
        }
      });
      scheduleAutosave();
      render();
      updateUiForSelection();
    },
    { mixedLabel: preserveMixed, indeterminate: !!preserveMixed }
  ));
}

const sitelenOnlyEls = sels.filter(e => e && e.type === ElementType.Sitelen);
if (sitelenOnlyEls.length){
  const abbrevVals = sitelenOnlyEls.map(e => String(!!getElementAbbreviateNumericCartouches(e)));
  const abbrevMixed = mixedLabelIfMixed(abbrevVals);
  propsBody.appendChild(makeCheckbox(
    tr("props_abbrev_numeric_cartouches"),
    !!getElementAbbreviateNumericCartouches(sitelenOnlyEls[0]),
    (checked) => {
      applyToAllWhere(e => e && e.type === ElementType.Sitelen, (e) => {
        e.abbreviateNumericCartouches = !!checked;
        invalidateSitelenCache(e.id);
        updateSitelenLayout(e);
      });
      scheduleAutosave();
      render();
    },
    { mixedLabel: abbrevMixed, indeterminate: !!abbrevMixed }
  ));

  const ignoreVals = sitelenOnlyEls.map(e => !!e.ignoreUnknownText);
  const ignoreMixed = (new Set(ignoreVals.map(v => String(v))).size > 1);
  propsBody.appendChild(makeCheckbox(
    tr("props_ignore_unknown_text"),
    !!sitelenOnlyEls[0].ignoreUnknownText,
    (checked) => {
      applyToAllWhere(e => e && e.type === ElementType.Sitelen, (e) => {
        e.ignoreUnknownText = !!checked;
        invalidateSitelenCache(e.id);
        updateSitelenLayout(e, { preserveCenter: true });
      });
      scheduleAutosave();
      render();
    },
    { mixedLabel: ignoreMixed ? tr("props_mixed") : null, indeterminate: ignoreMixed }
  ));

  const spacingVals = sitelenOnlyEls.map(e => getElementSpacingPreset(e));
  const spacingMixed = mixedLabelIfMixed(spacingVals);
  propsBody.appendChild(makeSelect(
    tr("props_spacing"),
    getElementSpacingPreset(sitelenOnlyEls[0]),
    spacingPresetSelectOptions(),
    (v) => {
      applyToAllWhere(e => e && e.type === ElementType.Sitelen, (e) => {
        e.spacingPreset = normalizeSpacingPreset(v);
        invalidateSitelenCache(e.id);
        updateSitelenLayout(e, { preserveCenter: true });
      });
      scheduleAutosave();
      render();
    },
    spacingMixed
  ));
}

// If the floating editor is open for this same multi-sitelen selection, rebind it to the new textarea node.
if (textField && textField._popoutElementId){
  rebindFloatingSitelenEditorToTextarea(
    textField._popoutElementId,
    textField._textarea,
    (v) => {
      applyToAllWhere(supportsTextBlock, (e) => {
        e.text = v;
        if (e.type === ElementType.Sitelen){
          invalidateSitelenCache(e.id);
          updateSitelenLayout(e, { preserveCenter: true });
        }
      });
      scheduleAutosave();
      render();
    }
  );
}

      if (sels.some(supportsTextBlock)){
        const leaderTextLike = topmostSelectedWhere(supportsTextBlock);
        const presetVals = sels.filter(supportsTextBlock).map(e => getElementRenderFontPresetKey(e));
        const presetMixed = mixedLabelIfMixed(presetVals);
        propsBody.appendChild(makeSelect(
          tr("props_render_font_family"),
          getElementRenderFontPresetKey(leaderTextLike),
          Object.values(stageFontPairController.getCombinedRegistrySnapshot()).map(p => [p.key, p.label]),
          async (v) => {
            const jobs = [];
            applyToAllWhere(supportsTextBlock, (e) => {
              e.renderFontPreset = normalizeRenderFontPresetKey(v);
              e.fontFamily = normalizeTextFontOptionKeyForPreset(e.fontFamily, e.renderFontPreset);
              jobs.push(waitForRenderPresetFonts(
                e.renderFontPreset,
                e.fontSize || 56,
                resolveTextFontFamilyForPreset(e.fontFamily, e.renderFontPreset)
              ));
            });
            await Promise.allSettled(jobs);
            applyToAllWhere(supportsTextBlock, (e) => {
              if (e.type === ElementType.Text){
                updateTextLayout(e);
              } else if (e.type === ElementType.Sitelen){
                invalidateSitelenCache(e.id);
                updateSitelenLayout(e, { preserveCenter: true });
              }
            });
            scheduleAutosave();
            render();
            updateUiForSelection();
          },
          presetMixed
        ));

        const leaderFont = topmostSelectedWhere(supportsTextBlock);
        const leaderPresetKey = getElementRenderFontPresetKey(leaderFont);
        const fontVals = sels.filter(supportsTextBlock).map(e => getElementTextFontOptionKey(e));
        const fontMixed = mixedLabelIfMixed(fontVals);
        const currentFont = getElementTextFontOptionKey(leaderFont);

        propsBody.appendChild(makeSelect(
          tr("props_font_family"),
          currentFont,
          getTextFontOptionsForPresetKey(leaderPresetKey),
          async (v) => {
            const jobs = [];
            applyToAllWhere(supportsTextBlock, (e) => {
              e.fontFamily = normalizeTextFontOptionKeyForPreset(v, getElementRenderFontPresetKey(e));
              jobs.push(waitForRenderPresetFonts(
                getElementRenderFontPresetKey(e),
                e.fontSize || 56,
                resolveTextFontFamilyForPreset(e.fontFamily, getElementRenderFontPresetKey(e))
              ));
            });
            await Promise.allSettled(jobs);
            applyToAllWhere(supportsTextBlock, (e) => {
              if (e.type === ElementType.Text){
                updateTextLayout(e);
              } else if (e.type === ElementType.Sitelen){
                invalidateSitelenCache(e.id);
                updateSitelenLayout(e, { preserveCenter: true });
              }
            });
            scheduleAutosave();
            render();
          },
          fontMixed
        ));
      }

      // Font size
      const leaderFs = topmostSelectedWhere(supportsTextBlock);
      const fsVals = sels.filter(supportsTextBlock).map(e => String(Number(e.fontSize ?? 24)));
      const fsMixed = mixedLabelIfMixed(fsVals);
      propsBody.appendChild(makeNumberRowWithPresets(
        "fontSize",
        tr("props_font_size"),
        Number(leaderFs?.fontSize ?? 24),
        1,
        FONT_SIZE_PRESETS,
        (v) => {
          applyToAllWhere(supportsTextBlock, (e) => {
            e.fontSize = Math.max(6, v);
            if (e.haloThicknessMode !== "manual") e.haloThickness = defaultHaloThicknessForFontPx(e.fontSize);
            if (e.type === ElementType.Text){
              updateTextLayout(e);
            } else if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
        },
        null,
        null,
        null,
        fsMixed
      ));

      // Align
      const leaderAlign = topmostSelectedWhere(supportsTextBlock);
      const alignVals = sels.filter(supportsTextBlock).map(e => String(e.align ?? "left"));
      const alignMixed = mixedLabelIfMixed(alignVals);
      propsBody.appendChild(makeSelect(
        tr("props_align"),
        String(leaderAlign?.align ?? "left"),
        [["left", tr("props_align_left")],["center", tr("props_align_center")],["right", tr("props_align_right")]],
        (v) => {
          applyToAllWhere(supportsTextBlock, (e) => {
            e.align = v;
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
          updateUiForSelection();
        },
        alignMixed
      ));

      // Text colour
      const leaderColor = topmostSelectedWhere(supportsTextBlock);
      const colorVals = sels.filter(supportsTextBlock).map(e => rgbaOrHexToHex(e.color ?? "#111111", "#111111"));
      const colorMixed = mixedLabelIfMixed(colorVals);
      propsBody.appendChild(makeColorPickerWithSwatch(
        tr("props_text_color"),
        rgbaOrHexToHex(leaderColor?.color ?? "#111111", "#111111"),
        (v) => {
          applyToAllWhere(supportsTextBlock, (e) => {
            e.color = v;
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          render();
        },
        (v) => {
          applyToAllWhere(supportsTextBlock, (e) => {
            e.color = v;
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
        },
        colorMixed
      ));
    }

    // Glyph block (color + font size only; family fixed)
    if (sels.some(supportsGlyphBlock)){
      addSection(tr("sec_glyph"));

      const leaderG = topmostSelectedWhere(supportsGlyphBlock);

      const glyphPresetVals = sels.filter(supportsGlyphBlock).map(e => getElementRenderFontPresetKey(e));
      const glyphPresetMixed = mixedLabelIfMixed(glyphPresetVals);
      propsBody.appendChild(makeSelect(
        tr("props_render_font_family"),
        getElementRenderFontPresetKey(leaderG),
        Object.values(stageFontPairController.getCombinedRegistrySnapshot()).map(p => [p.key, p.label]),
        async (v) => {
          const jobs = [];
          applyToAllWhere(supportsGlyphBlock, (e) => {
            e.renderFontPreset = normalizeRenderFontPresetKey(v);
            e.fontFamily = TEXT_FONT_OPTION_SITELEN;
            jobs.push(waitForRenderPresetFonts(e.renderFontPreset, e.fontSize || 56));
          });
          await Promise.allSettled(jobs);
          applyToAllWhere(supportsGlyphBlock, (e) => {
            invalidateGlyphCache(e.id);
            queueGlyphRasterRebuild(e);
          });
          scheduleAutosave();
          render();
        },
        glyphPresetMixed
      ));

      // font size
      const gfsVals = sels.filter(supportsGlyphBlock).map(e => String(Number(e.fontSize ?? 64)));
      const gfsMixed = mixedLabelIfMixed(gfsVals);
      propsBody.appendChild(makeNumberRowWithPresets(
        "glyphFontSize",
        tr("props_font_size"),
        Number(leaderG?.fontSize ?? 64),
        1,
        FONT_SIZE_PRESETS,
        (v) => {
          applyToAllWhere(supportsGlyphBlock, (e) => {
            e.fontSize = Math.max(6, v);
            if (e.haloThicknessMode !== "manual") e.haloThickness = defaultHaloThicknessForFontPx(e.fontSize);
            invalidateGlyphCache(e.id);
            queueGlyphRasterRebuild(e);
          });
          scheduleAutosave();
          render();
        },
        null,
        null,
        null,
        gfsMixed
      ));

      // color
      const gcolVals = sels.filter(supportsGlyphBlock).map(e => rgbaOrHexToHex(e.color ?? "#111111", "#111111"));
      const gcolMixed = mixedLabelIfMixed(gcolVals);
      propsBody.appendChild(makeColorPickerWithSwatch(
        tr("props_glyph_color"),
        rgbaOrHexToHex(leaderG?.color ?? "#111111", "#111111"),
        (v) => { applyToAllWhere(supportsGlyphBlock, (e) => { e.color = v; invalidateGlyphCache(e.id); queueGlyphRasterRebuild(e); }); render(); },
        (v) => { applyToAllWhere(supportsGlyphBlock, (e) => { e.color = v; invalidateGlyphCache(e.id); queueGlyphRasterRebuild(e); }); scheduleAutosave(); render(); },
        gcolMixed
      ));
    }

    // Image block (keepAspect + color key)
    if (sels.some(supportsImage)){
      addSection(tr("sec_image"));

      const leaderI = topmostSelectedWhere(supportsImage);

      // keep aspect (tri-state)
      const keepVals = sels.filter(supportsImage).map(e => String((e.keepAspect == null) ? true : !!e.keepAspect));
      const keepMixed = (distinctValues(keepVals).length > 1);
      const keepLeader = (leaderI?.keepAspect == null) ? true : !!leaderI.keepAspect;

      propsBody.appendChild(makeCheckbox(
        tr("props_keep_aspect"),
        keepLeader,
        (checked) => {
          applyToAllWhere(supportsImage, (e) => {
            const prev = (e.keepAspect == null) ? true : !!e.keepAspect;
            e.keepAspect = !!checked;
            if (!prev && e.keepAspect && e.image && Number.isFinite(e.image.origW) && Number.isFinite(e.image.origH)){
              const cx = e.x + e.w/2;
              const cy = e.y + e.h/2;
              e.w = Math.max(8, e.image.origW);
              e.h = Math.max(8, e.image.origH);
              e.x = cx - e.w/2;
              e.y = cy - e.h/2;
            }
          });
          scheduleAutosave();
          render();
          updateUiForSelection();
        },
        { mixedLabel: keepMixed ? tr("props_mixed") : null, indeterminate: keepMixed }
      ));

      // color key transparency (tri-state)
      const ckVals = sels.filter(supportsImage).map(e => String(!!e.colorKeyTransparent));
      const ckMixed = (distinctValues(ckVals).length > 1);
      const ckLeader = !!leaderI?.colorKeyTransparent;

      propsBody.appendChild(makeCheckbox(
        tr("props_color_key_transparency"),
        ckLeader,
        (checked) => {
          applyToAllWhere(supportsImage, (e) => {
            e.colorKeyTransparent = !!checked;
            invalidateColorKeyCache(e.id);
          });
          scheduleAutosave();
          render();
          updateUiForSelection();
        },
        { mixedLabel: ckMixed ? tr("props_mixed") : null, indeterminate: ckMixed }
      ));
    }

    // Shape (corner radius) for rects only
    if (sels.some(supportsRect)){
      addSection(tr("sec_shape"));
      const leaderR = topmostSelectedWhere(supportsRect);
      const radVals = sels.filter(supportsRect).map(e => String(Number(e.radius ?? 0)));
      const radMixed = mixedLabelIfMixed(radVals);
      propsBody.appendChild(makeNumberRow(
        "radius",
        tr("props_corner_radius"),
        Number(leaderR?.radius ?? 0),
        1,
        (v) => { applyToAllWhere(supportsRect, (e) => { e.radius = Math.max(0, v); }); scheduleAutosave(); render(); },
        null,
        null,
        null,
        radMixed
      ));
    }

    // Halo block (any element that supports it)
    if (sels.some(supportsHalo)){
      addSection(tr("sec_halo"));

      const leaderH = topmostSelectedWhere(supportsHalo);

      // enabled (tri-state)
      const heVals = sels.filter(supportsHalo).map(e => String(!!e.haloEnabled));
      const heMixed = (distinctValues(heVals).length > 1);
      propsBody.appendChild(makeCheckbox(
        tr("props_halo_enabled"),
        !!leaderH?.haloEnabled,
        (checked) => {
          applyToAllWhere(supportsHalo, (e) => {
            e.haloEnabled = !!checked;
            ensureHaloFields(e);
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
        },
        { mixedLabel: heMixed ? tr("props_mixed") : null, indeterminate: heMixed }
      ));

      // color
      const hcVals = sels.filter(supportsHalo).map(e => rgbaOrHexToHex(e.haloColor, "#FFFFFF"));
      const hcMixed = mixedLabelIfMixed(hcVals);
      propsBody.appendChild(makeColorPickerWithSwatch(
        tr("props_halo_color"),
        rgbaOrHexToHex(leaderH?.haloColor, "#FFFFFF"),
        (v) => {
          applyToAllWhere(supportsHalo, (e) => {
            e.haloColor = v;
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          render();
        },
        (v) => {
          applyToAllWhere(supportsHalo, (e) => {
            e.haloColor = v;
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
        },
        hcMixed
      ));

      // thickness (use leader basis; apply raw to all, auto/manual behaviour preserved)
      const htVals = sels.filter(supportsHalo).map(e => String(Number(e.haloThickness ?? 0)));
      const htMixed = mixedLabelIfMixed(htVals);
      propsBody.appendChild(makeNumberRow(
        "haloThickness",
        tr("props_halo_thickness"),
        Number(leaderH?.haloThickness ?? 0),
        1,
        (v) => {
          const vv = clampHaloThicknessPx(v);
          applyToAllWhere(supportsHalo, (e) => {
            if (vv <= 0){
              e.haloThicknessMode = "auto";
              const basis = (e.type === ElementType.Rect) ? 28 : Math.max(6, Number(e.fontSize ?? 24));
              e.haloThickness = defaultHaloThicknessForFontPx(basis);
            } else {
              e.haloThicknessMode = "manual";
              e.haloThickness = vv;
            }
            if (e.type === ElementType.Sitelen){
              invalidateSitelenCache(e.id);
              updateSitelenLayout(e, { preserveCenter: true });
            }
          });
          scheduleAutosave();
          render();
        },
        null,
        0,
        48,
        htMixed
      ));
    }

    // Always include appearance block (common already handles mixed)
    addAppearanceBlock();

    // Geometry block: editing X/Y/W/H/Rot across mixed types is still useful (applies to all)
    addSection(tr("sec_geometry"));
    const leaderG = topmostSelectedWhere(() => true) || sels[sels.length - 1];
    propsBody.appendChild(makeNumberRow("x", tr("props_x"), leaderG.x, 1, (v) => { for (const e of sels) e.x = v; scheduleAutosave(); render(); }, mixedLabelIfMixed(sels.map(e=>String(e.x)))));
    propsBody.appendChild(makeNumberRow("y", tr("props_y"), leaderG.y, 1, (v) => { for (const e of sels) e.y = v; scheduleAutosave(); render(); }, mixedLabelIfMixed(sels.map(e=>String(e.y)))));
    propsBody.appendChild(makeNumberRow("w", tr("props_w"), leaderG.w, 1, (v) => { for (const e of sels) e.w = Math.max(8, v); scheduleAutosave(); render(); }, mixedLabelIfMixed(sels.map(e=>String(e.w)))));
    propsBody.appendChild(makeNumberRow("h", tr("props_h"), leaderG.h, 1, (v) => { for (const e of sels) e.h = Math.max(8, v); scheduleAutosave(); render(); }, mixedLabelIfMixed(sels.map(e=>String(e.h)))));
    propsBody.appendChild(makeNumberRow("rot", tr("props_rotation_deg"), leaderG.rotationDeg || 0, 1, (v) => { for (const e of sels) e.rotationDeg = v; scheduleAutosave(); render(); }, mixedLabelIfMixed(sels.map(e=>String(e.rotationDeg||0)))));

    return;
  }



  // Single selection: type-specific “useful first”
  const el = sels[0];

  if (el.type === ElementType.Text || el.type === ElementType.Sitelen){
    addSection( el.type === ElementType.Sitelen ? tr("sec_sitelen") : tr("sec_text"));

    //used for text placeholder
    let placeholder = "";

        // ADD: Sitelen keepAspect (same behavior as Image)
    if (el.type === ElementType.Sitelen){
      //set the sitelen placeholder text
      //placeholder = "toki pona";
      placeholder = tr("sitelen_placeholder");

      // Resize anchor dropdown — replaces the old keepAspect checkbox
      propsBody.appendChild(makeSelect(
        "Resize anchor",
        el.sitelenResizeAnchor || "topLeft",
        [
          ["topLeft", "Resize from top-left"],
          ["centre",  "Resize from centre"],
          ["fixed",   "Fixed box (scale to fit)"],
        ],
        (v) => {
          el.sitelenResizeAnchor = v;
          if (v !== "fixed") el.preserveCenterOnAutoResize = (v === "centre");
          // keepAspect drives drag-resize handle locking; fixed = free drag
          el.keepAspect = (v !== "fixed");
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
          scheduleAutosave();
          render();
          updateUiForSelection();
        }
      ));

      propsBody.appendChild(makeCheckbox(
        tr("props_preserve_center_auto_resize"),
        !!getElementPreserveCenterOnAutoResize(el),
        (checked) => {
          el.preserveCenterOnAutoResize = !!checked;
          if (el.sitelenResizeAnchor !== "fixed") el.sitelenResizeAnchor = checked ? "centre" : "topLeft";
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el);
          scheduleAutosave();
          render();
          updateUiForSelection();
        }
      ));

      // ADD: read-only sizes (parallel to Image panel)
      const r = ensureSitelenRaster(el);
      const natW = (el.sitelen && Number.isFinite(el.sitelen.naturalW)) ? el.sitelen.naturalW : (r ? r.naturalW : null);
      const natH = (el.sitelen && Number.isFinite(el.sitelen.naturalH)) ? el.sitelen.naturalH : (r ? r.naturalH : null);

      if (natW && natH){
        propsBody.appendChild(makeReadOnlyRow(tr("props_rendered_intrinsic_size"), `${natW} × ${natH}`));
      } else {
        propsBody.appendChild(makeReadOnlyRow(tr("props_rendered_intrinsic_size"), "—"));
      }

      const origW = (el.sitelen && Number.isFinite(el.sitelen.origW)) ? el.sitelen.origW : el.w;
      const origH = (el.sitelen && Number.isFinite(el.sitelen.origH)) ? el.sitelen.origH : el.h;
      propsBody.appendChild(makeReadOnlyRow(tr("props_original_box_size"), `${Number(origW)} × ${Number(origH)}`));
    }

    

   const textField = makeTextarea(
      tr("props_text"),
      el.text ?? "",
      placeholder,
      (v) => {
        el.text = v;

        if (el.type === ElementType.Text){
          updateTextLayout(el);
        } else if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true }, true);
        }

        scheduleAutosave();
        render();
      },
      {
        enablePopout: el.type === ElementType.Sitelen,
        popoutTitle: el.type === ElementType.Sitelen ? "Sitelen" : "Text",
        popoutElementId: el.id
      }
    );

    propsBody.appendChild(textField);

    if (el.type === ElementType.Sitelen){
      propsBody.appendChild(makeCheckbox(
        tr("props_ignore_unknown_text"),
        !!el.ignoreUnknownText,
        (checked) => {
          el.ignoreUnknownText = !!checked;
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
          scheduleAutosave();
          render();
        }
      ));
      propsBody.appendChild(makeSelect(
        tr("props_spacing"),
        getElementSpacingPreset(el),
        spacingPresetSelectOptions(),
        (v) => {
          el.spacingPreset = normalizeSpacingPreset(v);
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
          scheduleAutosave();
          render();
          updateUiForSelection();
        }
      ));
    }

    // If the floating editor is already open for this same sitelen element,
    // rebind it to the freshly re-rendered textarea in the properties panel.
    if (el.type === ElementType.Sitelen){
      rebindFloatingSitelenEditorToTextarea(
        el.id,
        textField._textarea,
        (v) => {
          el.text = v;

          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true }, true);

          scheduleAutosave();
          render();
        }
      );
    }


    if (el.type === ElementType.Text){
      propsBody.appendChild(makeCheckbox(
        tr("props_scale_font_box"),
        !!el.scaleFontWithBox,
        (checked) => {
          el.scaleFontWithBox = !!checked;
          scheduleAutosave();
          render();
          updateUiForSelection();
        }
      ));
    }

    if (el.type === ElementType.Text){
      propsBody.appendChild(makeCheckbox(
        tr("props_preserve_center_auto_resize"),
        !!getElementPreserveCenterOnAutoResize(el),
        (checked) => {
          el.preserveCenterOnAutoResize = !!checked;
          scheduleAutosave();
          render();
          updateUiForSelection();
        }
      ));
    }

    propsBody.appendChild(makeSelect(
      tr("props_render_font_family"),
      getElementRenderFontPresetKey(el),
      Object.values(stageFontPairController.getCombinedRegistrySnapshot()).map(p => [p.key, p.label]),
      async (v) => {
        el.renderFontPreset = normalizeRenderFontPresetKey(v);
        el.fontFamily = normalizeTextFontOptionKeyForPreset(el.fontFamily, el.renderFontPreset);
        await waitForRenderPresetFonts(
          el.renderFontPreset,
          el.fontSize || 56,
          resolveTextFontFamilyForPreset(el.fontFamily, el.renderFontPreset)
        );
        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }
        scheduleAutosave();
        render();
        updateUiForSelection();
      }
    ));

    const currentFont = getElementTextFontOptionKey(el);

    propsBody.appendChild(makeSelect(tr("props_font_family"), currentFont, getTextFontOptionsForPresetKey(getElementRenderFontPresetKey(el)), async (v) => {
        el.fontFamily = normalizeTextFontOptionKeyForPreset(v, getElementRenderFontPresetKey(el));

        await waitForRenderPresetFonts(
          getElementRenderFontPresetKey(el),
          el.fontSize || 56,
          resolveTextFontFamilyForPreset(el.fontFamily, getElementRenderFontPresetKey(el))
        );

        if (el.type === ElementType.Text){
          updateTextLayout(el);
        } else if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }

        scheduleAutosave();
        render();
    }));

    if (el.type === ElementType.Sitelen){
      propsBody.appendChild(makeCheckbox(
        tr("props_abbrev_numeric_cartouches"),
        !!getElementAbbreviateNumericCartouches(el),
        (checked) => {
          el.abbreviateNumericCartouches = !!checked;
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el);
          scheduleAutosave();
          render();
        }
      ));
    }


    propsBody.appendChild(makeNumberRowWithPresets(
  "fontSize",
  tr("props_font_size"),
  Number(el.fontSize ?? 24),
  1,
  FONT_SIZE_PRESETS,
  (v) => {
    el.fontSize = Math.max(6, v);

    // NEW: if halo thickness is auto, recompute from new font size
    if (el.haloThicknessMode !== "manual") el.haloThickness = defaultHaloThicknessForFontPx(el.fontSize);

    if (el.type === ElementType.Text){
      updateTextLayout(el);
    } else if (el.type === ElementType.Sitelen){
      invalidateSitelenCache(el.id);
      updateSitelenLayout(el, { preserveCenter: true });
    }

    scheduleAutosave();
    render();
  },
  null,
  6,
  9999
));


    propsBody.appendChild(makeSelect(tr("props_align"), el.align ?? "left", [
      ["left", tr("props_align_left")],["center", tr("props_align_center")],["right", tr("props_align_right")]
    ], (v) => {
  el.align = v;

  if (el.type === ElementType.Sitelen){
    invalidateSitelenCache(el.id);
    updateSitelenLayout(el, { preserveCenter: true });
  }

  scheduleAutosave();
  render();
  updateUiForSelection();
}));

   propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_text_color"),
      el.color ?? "#111111",
      (v) => {
        // LIVE preview only
        if (APP_VECTOR_DEBUG) console.log("Live text colour :" + v);
        el.color =  v;

        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }

        render();
      },
      (v) => {
        // COMMIT
        if (APP_VECTOR_DEBUG) console.log("Commit text colour :" + v);
        el.color =  v;

        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }

        scheduleAutosave();
        render();
        //renderPropsPanel(); // safe now
      }
    ));



    // NEW: halo controls (text/sitelen)
    addSection(tr("sec_halo"));

    propsBody.appendChild(makeCheckbox(
      tr("props_halo_enabled"),
      !!el.haloEnabled,
      (checked) => {
        el.haloEnabled = !!checked;
        ensureHaloFields(el);
        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }
        scheduleAutosave();
        render();
      }
    ));

    propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_halo_color"),
      rgbaOrHexToHex(el.haloColor, "#FFFFFF"),
      (v) => {
        el.haloColor = v;
        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }
        render();
      },
      (v) => {
        el.haloColor = v;
        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }
        scheduleAutosave();
        render();
      }
    ));

    propsBody.appendChild(makeNumberRow(
      "haloThickness",
      tr("props_halo_thickness"),
      Number(el.haloThickness ?? defaultHaloThicknessForFontPx(el.fontSize ?? 24)),
      1,
      (v) => {
        const vv = clampHaloThicknessPx(v);
        if (vv <= 0){
          el.haloThicknessMode = "auto";
          el.haloThickness = defaultHaloThicknessForFontPx(el.fontSize ?? 24);
        } else {
          el.haloThicknessMode = "manual";
          el.haloThickness = vv;
        }
        if (el.type === ElementType.Sitelen){
          invalidateSitelenCache(el.id);
          updateSitelenLayout(el, { preserveCenter: true });
        }
        scheduleAutosave();
        render();
      },
      null,
      0,
      48
    ));

    propsBody.appendChild(makeNumberRow("lineHeight", tr("props_line_height"), Number(el.lineHeight ?? 1.15), 0.05, (v) => {
      el.lineHeight = clamp(v, 0.8, 3.0);
      if (el.type === ElementType.Text){
        updateTextLayout(el);
      } else if (el.type === ElementType.Sitelen){
        invalidateSitelenCache(el.id);
        updateSitelenLayout(el, { preserveCenter: true });
      }
      scheduleAutosave();
      render();
    }, null, 0.8, 3.0));

    // Then appearance (background/stroke/opacity)
    addAppearanceBlock();

  } else if (el.type === ElementType.Glyph){
    addSection(tr("sec_glyph"));



    propsBody.appendChild(makeSelect(
      tr("props_render_font_family"),
      getElementRenderFontPresetKey(el),
      Object.values(stageFontPairController.getCombinedRegistrySnapshot()).map(p => [p.key, p.label]),
      async (v) => {
        el.renderFontPreset = normalizeRenderFontPresetKey(v);
        el.fontFamily = TEXT_FONT_OPTION_SITELEN;
        await waitForRenderPresetFonts(el.renderFontPreset, el.fontSize || 56);
        invalidateGlyphCache(el.id);
        queueGlyphRasterRebuild(el);
        scheduleAutosave();
        render();
      }
    ));

    //propsBody.appendChild(makeTextRow("Code point (U+.... or 0x.... or single char)", el.codepoint ?? "", (v) => {
    //  el.codepoint = v; scheduleAutosave(); render();
    //}));
    // CHANGE HERE: 2-step glyph picker (letter -> words)
propsBody.appendChild(makeGlyphPicker(el));
    queueGlyphRasterRebuild(el);


    propsBody.appendChild(makeCheckbox(
      tr("props_scale_font_box"),
      !!el.scaleFontWithBox,
      (checked) => {
        el.scaleFontWithBox = !!checked;
        scheduleAutosave();
        render();
        updateUiForSelection();
      }
    ));

    propsBody.appendChild(makeCheckbox(
      tr("props_preserve_center_auto_resize"),
      !!getElementPreserveCenterOnAutoResize(el),
      (checked) => {
        el.preserveCenterOnAutoResize = !!checked;
        invalidateGlyphCache(el.id);
        queueGlyphRasterRebuild(el);
        scheduleAutosave();
        render();
        updateUiForSelection();
      }
    ));

 propsBody.appendChild(makeNumberRowWithPresets(
  "fontSize",
  tr("props_font_size"),
  Number(el.fontSize ?? 64),
  1,
  FONT_SIZE_PRESETS,
  (v) => { el.fontSize = Math.max(6, v); if (el.haloThicknessMode !== "manual") el.haloThickness = defaultHaloThicknessForFontPx(el.fontSize); invalidateGlyphCache(el.id); queueGlyphRasterRebuild(el); scheduleAutosave(); render(); },
  null,
  6,
  9999
));


propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_glyph_color"),
      el.color ?? "#111111",
      (v) => {
        // LIVE preview only
        if (APP_VECTOR_DEBUG) console.log("Live glyph colour :" + v);
        el.color =  v;
        invalidateGlyphCache(el.id);
        queueGlyphRasterRebuild(el);
        render();
      },
      (v) => {
        // COMMIT
        if (APP_VECTOR_DEBUG) console.log("Commit glyph colour :" + v);
        el.color = v;
        invalidateGlyphCache(el.id);
        queueGlyphRasterRebuild(el);

        scheduleAutosave();
        render();
        //renderPropsPanel(); // safe now
      }
    ));




    // NEW: halo controls (glyph)
    addSection(tr("sec_halo"));

    propsBody.appendChild(makeCheckbox(
      tr("props_halo_enabled"),
      !!el.haloEnabled,
      (checked) => { el.haloEnabled = !!checked; ensureHaloFields(el); scheduleAutosave(); render(); }
    ));

    propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_halo_color"),
      rgbaOrHexToHex(el.haloColor, "#FFFFFF"),
      (v) => { el.haloColor = v; render(); },
      (v) => { el.haloColor = v; scheduleAutosave(); render(); }
    ));

    propsBody.appendChild(makeNumberRow(
      "haloThickness",
      tr("props_halo_thickness"),
      Number(el.haloThickness ?? defaultHaloThicknessForFontPx(el.fontSize ?? 64)),
      1,
      (v) => {
        const vv = clampHaloThicknessPx(v);
        if (vv <= 0){
          el.haloThicknessMode = "auto";
          el.haloThickness = defaultHaloThicknessForFontPx(el.fontSize ?? 64);
        } else {
          el.haloThicknessMode = "manual";
          el.haloThickness = vv;
        }
        scheduleAutosave();
        render();
      },
      null,
      0,
      48
    ));

    addAppearanceBlock();

  } else if (el.type === ElementType.Image){
    addSection(tr("sec_image"));

    const row = document.createElement("div");
    row.className = "row";

    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = el.image ? tr("img_replace") : tr("img_load");
    b.addEventListener("click", () => pickImageForElement(el));
    row.appendChild(b);

    const b2 = document.createElement("button");
    b2.className = "btn";
    b2.type = "button";
    b2.textContent = tr("img_clear");
    b2.disabled = !el.image;
    b2.addEventListener("click", () => {
      el.image = null;
      invalidateImageCache(el.id);
      invalidateColorKeyCache(el.id);
      scheduleAutosave(); render(); updateUiForSelection();
    });
    row.appendChild(b2);

    propsBody.appendChild(row);

    const note = document.createElement("div");
    note.className = "hint";
    note.textContent = el.image
      ? tr("props_image_embedded", el.image.mime, el.image.naturalW, el.image.naturalH)
      : tr("props_image_none");
    propsBody.appendChild(note);




  // CHANGE HERE: keepAspect checkbox (default true)
  propsBody.appendChild(makeCheckbox(tr("props_keep_aspect"), (el.keepAspect == null) ? true : !!el.keepAspect, (checked) => {
    const prev = (el.keepAspect == null) ? true : !!el.keepAspect;
    el.keepAspect = !!checked;

    // If turning OFF -> ON: revert to original loaded box size (keep rotation; keep center stable)
    if (!prev && el.keepAspect && el.image && Number.isFinite(el.image.origW) && Number.isFinite(el.image.origH)){
      const cx = el.x + el.w/2;
      const cy = el.y + el.h/2;
      el.w = Math.max(8, el.image.origW);
      el.h = Math.max(8, el.image.origH);
      el.x = cx - el.w/2;
      el.y = cy - el.h/2;
    }

    scheduleAutosave();
    render();
    updateUiForSelection();
  }));

      //make imported image backgrounf transparent
propsBody.appendChild(makeCheckbox(
  tr("props_color_key_transparency"),
  !!el.colorKeyTransparent,
  (checked) => {
    el.colorKeyTransparent = !!checked;
    invalidateColorKeyCache(el.id);
    scheduleAutosave();
    render();
    updateUiForSelection();
  }
));

// CHANGE HERE: read-only sizes
  if (el.image){
    propsBody.appendChild(makeReadOnlyRow(tr("props_loaded_intrinsic_size"), `${el.image.naturalW} × ${el.image.naturalH}`));
    propsBody.appendChild(makeReadOnlyRow(tr("props_original_box_size"), `${Number(el.image.origW ?? el.w)} × ${Number(el.image.origH ?? el.h)}`));
  } else {
    propsBody.appendChild(makeReadOnlyRow(tr("props_loaded_intrinsic_size"), "—"));
    propsBody.appendChild(makeReadOnlyRow(tr("props_original_box_size"), "—"));
  }

    addAppearanceBlock();

  } else if (el.type === ElementType.Audio){
    addSection('Audio');
    propsBody.appendChild(makeReadOnlyRow('Title', el.title || (el.audio && el.audio.origName) || 'Audio'));
    propsBody.appendChild(makeReadOnlyRow('Source', (el.audio && el.audio.origName) || el.sourceUrl || 'Embedded audio'));
    const row = document.createElement('div'); row.className = 'row';
    const mkBtn = (label, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
    row.appendChild(mkBtn('Play', () => playMediaElement(el)));
    row.appendChild(mkBtn('Play/Pause', () => toggleMediaPlayPause(el)));
    row.appendChild(mkBtn('Rewind 5s', () => rewindMediaElement(5)));
    if (el.sourceUrl) row.appendChild(mkBtn('Open source', () => openUrlExternal(el.sourceUrl)));
    propsBody.appendChild(row);
    propsBody.appendChild(makeSearchTagField(el, !!el.isLocked));
    propsBody.appendChild(makeCheckbox('Show in PNG export', !!el.exportVisible, (checked) => { el.exportVisible = !!checked; scheduleAutosave(); }));
    addAppearanceBlock();

  } else if (el.type === ElementType.Video){
    addSection('Video');
    propsBody.appendChild(makeReadOnlyRow('Title', el.title || (el.video && el.video.origName) || 'Video'));
    propsBody.appendChild(makeReadOnlyRow('Source', (el.video && el.video.origName) || el.sourceUrl || 'Embedded video'));
    propsBody.appendChild(makeCheckbox(tr('props_keep_aspect'), !!el.keepAspect, (checked) => { el.keepAspect = !!checked; scheduleAutosave(); render(); }));
    const row = document.createElement('div'); row.className = 'row';
    const mkBtn = (label, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
    row.appendChild(mkBtn('Play', () => playMediaElement(el)));
    row.appendChild(mkBtn('Play/Pause', () => toggleMediaPlayPause(el)));
    row.appendChild(mkBtn('Rewind 5s', () => rewindMediaElement(5)));
    if (el.sourceUrl) row.appendChild(mkBtn('Open source', () => openUrlExternal(el.sourceUrl)));
    propsBody.appendChild(row);
    propsBody.appendChild(makeSearchTagField(el, !!el.isLocked));
    propsBody.appendChild(makeCheckbox('Show in PNG export', !!el.exportVisible, (checked) => { el.exportVisible = !!checked; scheduleAutosave(); }));
    addAppearanceBlock();

  } else if (el.type === ElementType.Url){
    addSection('URL');
    propsBody.appendChild(makeReadOnlyRow('Kind', String(el.url && el.url.detectedKind || 'link')));
    propsBody.appendChild(makeTextarea('URL', String(el.url && el.url.href || ''), 'https://...', (v) => {
      const clean = String(v || '').trim();
      const det = detectUrlKindFromHref(clean);
      if (!el.url || typeof el.url !== 'object') el.url = {};
      const prevHref = String(el.url.href || '');
      const prevKind = String(el.url.detectedKind || 'link');
      el.url.href = clean;
      el.url.detectedKind = det.kind;
      el.url.title = clean;
      el.url.mimeHint = det.mimeHint;
      el.title = clean;
      if (!clean){
        el.url.posterAssetId = null;
        el.url.posterRemoteHref = '';
        el.url.posterAttempted = false;
        scheduleAutosave();
        try { renderScrapbookSidebar(); } catch {}
        updateUiForSelection();
        render();
        return;
      }
      if (clean !== prevHref || det.kind !== prevKind){
        el.url.posterAssetId = null;
        el.url.posterRemoteHref = '';
        el.url.posterAttempted = false;
        ensureImmediateRemotePosterHint(el);
        const defer = globalThis.requestIdleCallback
          ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 1500 })
          : (fn) => window.setTimeout(fn, 0);
        defer(async () => {
          try {
            const did = await maybePopulatePosterForUrlElement(el, { force: true });
            scheduleAutosave();
            if (did) { try { renderScrapbookSidebar(); } catch {} }
            updateUiForSelection();
            render();
          } catch (err) {
            console.warn('Deferred URL poster population failed', err);
            scheduleAutosave();
            updateUiForSelection();
            render();
          }
        });
      }
      scheduleAutosave();
      try { renderScrapbookSidebar(); } catch {}
      updateUiForSelection();
      render();
    }, { enablePopout: true, popoutTitle: 'URL', popoutElementId: el.id }));
    const row = document.createElement('div'); row.className = 'row';
    const mkBtn = (label, fn, disabled=false) => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = label; b.disabled = !!disabled; b.onclick = fn; return b; };
    const href = String(el.url && el.url.href || '').trim();
    row.appendChild(mkBtn('Open link', () => openUrlExternal(href), !href));
    if ((el.url && el.url.detectedKind) === 'audio' || (el.url && el.url.detectedKind) === 'video'){
      row.appendChild(mkBtn('Play', () => playMediaElement({ id: el.id, type: (el.url && el.url.detectedKind) === 'audio' ? ElementType.Audio : ElementType.Video, sourceUrl: href }), !href));
      row.appendChild(mkBtn('Play/Pause', () => toggleMediaPlayPause(el)));
      row.appendChild(mkBtn('Rewind 5s', () => rewindMediaElement(5)));
    }
    propsBody.appendChild(row);
    if ((el.url && el.url.detectedKind) === 'image' || (el.url && el.url.detectedKind) === 'video') propsBody.appendChild(makeCheckbox(tr('props_keep_aspect'), !!el.keepAspect, (checked) => { el.keepAspect = !!checked; scheduleAutosave(); render(); }));
    propsBody.appendChild(makeSearchTagField(el, !!el.isLocked));
    propsBody.appendChild(makeCheckbox('Show in PNG export', !!el.exportVisible, (checked) => { el.exportVisible = !!checked; scheduleAutosave(); }));
    addAppearanceBlock();

  } else if (el.type === ElementType.Rect){
    addSection(tr("sec_shape"));

    // For rectangles, appearance is often first
    addAppearanceBlock();

    // NEW: halo controls (rectangle)
    addSection(tr("sec_halo"));

    propsBody.appendChild(makeCheckbox(
      tr("props_halo_enabled"),
      !!el.haloEnabled,
      (checked) => { el.haloEnabled = !!checked; ensureHaloFields(el); scheduleAutosave(); render(); }
    ));

    propsBody.appendChild(makeColorPickerWithSwatch(
      tr("props_halo_color"),
      rgbaOrHexToHex(el.haloColor, "#FFFFFF"),
      (v) => { el.haloColor = v; render(); },
      (v) => { el.haloColor = v; scheduleAutosave(); render(); }
    ));

    propsBody.appendChild(makeNumberRow(
      "haloThickness",
      tr("props_halo_thickness"),
      Number(el.haloThickness ?? defaultHaloThicknessForFontPx(28)),
      1,
      (v) => {
        const vv = clampHaloThicknessPx(v);
        if (vv <= 0){
          el.haloThicknessMode = "auto";
          el.haloThickness = defaultHaloThicknessForFontPx(28);
        } else {
          el.haloThicknessMode = "manual";
          el.haloThickness = vv;
        }
        scheduleAutosave();
        render();
      },
      null,
      0,
      48
    ));

    propsBody.appendChild(makeNumberRow("radius", tr("props_corner_radius"), Number(el.radius ?? 0), 1, (v) => {
      el.radius = Math.max(0, v); scheduleAutosave(); render();
    }));
  } else {
    // Fallback: still give appearance controls
    addAppearanceBlock();
  }

  // Geometry last (because user can drag on canvas)
  addSection(tr("sec_geometry"));

  propsBody.appendChild(makeNumberRow("x", tr("props_x"), el.x, 1, (v) => { el.x = v; scheduleAutosave(); render(); }));
  propsBody.appendChild(makeNumberRow("y", tr("props_y"), el.y, 1, (v) => { el.y = v; scheduleAutosave(); render(); }));
  propsBody.appendChild(makeNumberRow("w", tr("props_w"), el.w, 1, (v) => { el.w = Math.max(8, v); scheduleAutosave(); render(); }));
  propsBody.appendChild(makeNumberRow("h", tr("props_h"), el.h, 1, (v) => { el.h = Math.max(8, v); scheduleAutosave(); render(); }));
  propsBody.appendChild(makeNumberRow("rot", tr("props_rotation_deg"), el.rotationDeg || 0, 1, (v) => { el.rotationDeg = v; scheduleAutosave(); render(); }));
}

// CHANGE HERE: static font options for dropdown
const FONT_OPTIONS = [
  [FONT_FAMILY_LITERAL, "Patrick Hand"],
  ["Arial", "Arial"],
  ["Times New Roman", "Times New Roman"],
  ["Courier New", "Courier New"],
  ["system-ui", "system-ui"],
];

// CHANGE HERE: preset sizes shown in the dropdown
const FONT_SIZE_PRESETS = [8,10,12,14,16,18,20,22,24,28,32,36,40,44,48,56,64,72,80,88,92,96,104,120,144];


function coerceFontValueToOption(v, fallback){
  const raw = String(v ?? "").trim();
  const vals = new Set(FONT_OPTIONS.map(([val]) => val));
  return vals.has(raw) ? raw : fallback;
}

// CHANGE HERE: number row with a preset dropdown to the right
function makeNumberRowWithPresets(
  id,
  label,
  value,
  step,
  presets,
  onChange,
  placeholder = null,
  min = null,
  max = null
, mixedLabel=null){
  const row = document.createElement("div");
  row.className = "row";

  const f = document.createElement("div");
  f.className = "field";

  const l = document.createElement("label");
  l.textContent = label;

  
    
  if (mixedLabel){
    const tag = document.createElement("span");
    tag.className = "mixedTag";
    tag.textContent = mixedLabel;
    l.appendChild(tag);
  }
if (mixedLabel){
      const tag = document.createElement("span");
      tag.className = "mixedTag";
      tag.textContent = mixedLabel;
      l.appendChild(tag);
    }
// Inline container: number input + select
  const inline = document.createElement("div");
  inline.className = "propInlineRow";

  const inp = document.createElement("input");
  inp.type = "number";
  inp.step = String(step ?? 1);
  if (min != null) inp.min = String(min);
  if (max != null) inp.max = String(max);
  if (placeholder != null) inp.placeholder = String(placeholder);
  inp.value = (value == null) ? "" : String(value);

  const sel = document.createElement("select");

  // First option = "Custom" (blank value)
  const optCustom = document.createElement("option");
  optCustom.value = "";
  optCustom.textContent = tr("opt_custom");
  sel.appendChild(optCustom);

  // Preset options
  const presetNums = Array.from(presets ?? []).map(n => Number(n)).filter(n => Number.isFinite(n)).sort((a,b)=>a-b);
  for (const n of presetNums){
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    sel.appendChild(o);
  }

  function syncSelectFromInput(){
    const n = Number(inp.value);
    if (!Number.isFinite(n)) { sel.value = ""; return; }
    const match = presetNums.includes(n) ? String(n) : "";
    sel.value = match;
  }

  // Initialize select state
  syncSelectFromInput();

  // Typing in the number box
  inp.addEventListener("input", () => {
    syncSelectFromInput();
    const n = Number(inp.value);
    if (!Number.isFinite(n)) return;
    onChange(n);
  });
  inp.addEventListener("change", () => {
    syncSelectFromInput();
    const n = Number(inp.value);
    if (!Number.isFinite(n)) return;
    onChange(n);
    historyCommit("Edit properties");
  });

  // Choosing a preset
  sel.addEventListener("change", () => {
    if (!sel.value){
      // "Custom" selected: do nothing, user types a value
      return;
    }
    const n = Number(sel.value);
    if (!Number.isFinite(n)) return;
    inp.value = String(n);
    onChange(n);
    historyCommit("Edit properties");
  });

  inline.appendChild(inp);
  inline.appendChild(sel);

  f.appendChild(l);
  f.appendChild(inline);

  row.appendChild(f);
  return row;
}



  function makeNumberRow(id, label, value, step, onChange, placeholder=null, min=null, max=null, mixedLabel=null){
    const row = document.createElement("div");
    row.className = "row";
    const f = document.createElement("div");
    f.className = "field";
    const l = document.createElement("label");
    l.textContent = label;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = String(step ?? 1);
    inp.value = String(Number.isFinite(value) ? value : 0);
    if (placeholder) inp.placeholder = placeholder;
    if (min != null) inp.min = String(min);
    if (max != null) inp.max = String(max);
    inp.addEventListener("input", () => {
      const v = Number(inp.value);
      if (!Number.isFinite(v)) return;
      onChange(v);
    });
    
    inp.addEventListener("change", () => {
      const v = Number(inp.value);
      if (!Number.isFinite(v)) return;
      onChange(v);
      historyCommit("Edit properties");
    });
f.appendChild(l); f.appendChild(inp);
    row.appendChild(f);
    return row;
  }

  function makeTextRow(label, value, onChange){
    const row = document.createElement("div");
    row.className = "row";
    const f = document.createElement("div");
    f.className = "field";
    const l = document.createElement("label");
    l.textContent = label;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = String(value ?? "");
    inp.addEventListener("input", () => onChange(inp.value));
    f.appendChild(l); f.appendChild(inp);
    row.appendChild(f);
    return row;
  }

  function makeTextarea(label, value, placeholder, onChange, opts = {}){
    const f = document.createElement("div");
    f.className = "field";

    const labelRow = document.createElement("div");
    labelRow.className = "fieldLabelRow";

    const l = document.createElement("label");
    l.textContent = label;
    labelRow.appendChild(l);

    const ta = document.createElement("textarea");
    ta.value = String(value ?? "");
    ta.placeholder = placeholder || "";

    if (opts && opts.readOnly) ta.readOnly = true;
    if (opts && opts.disabled) ta.disabled = true;

    const enablePopout = !!opts.enablePopout;
    const popoutTitle = String(opts.popoutTitle || label);
    const popoutElementId = opts.popoutElementId || null;

    if (enablePopout){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "popoutIconBtn";
      btn.title = "Open pop-out editor";
      btn.setAttribute("aria-label", "Open pop-out editor");
      btn.textContent = "↗";
      btn.addEventListener("click", () => {
        openFloatingSitelenEditor({
          title: popoutTitle,
          elementId: popoutElementId,
          sourceTextarea: ta,
          onChange
        });
      });
      labelRow.appendChild(btn);
      f._popoutButton = btn;
    }

    ta.addEventListener("input", () => {
      onChange(ta.value);

      // Keep floating editor synced if it is open for this same element
      if (
        FloatingSitelenEditor.isOpen &&
        FloatingSitelenEditor.elementId &&
        FloatingSitelenEditor.elementId === popoutElementId &&
        FloatingSitelenEditor.sourceTextarea === ta
      ){
        syncFloatingSitelenEditorFromSource(ta.value);
      }
    });

    ta.addEventListener("change", () => {
      historyCommit("Edit properties");
    });
    ta.addEventListener("blur", () => {
      historyCommit("Edit properties");
    });

    f.appendChild(labelRow);
    f.appendChild(ta);

    // Expose textarea so renderPropsPanel can re-bind after rerender
    f._textarea = ta;
    f._popoutElementId = popoutElementId;

    return f;
  }

  function makeSelect(label, value, options, onChange, mixedLabel=null){
    const f = document.createElement("div");
    f.className = "field";
    const l = document.createElement("label");
    l.textContent = label;
    if (mixedLabel){
      const tag = document.createElement("span");
      tag.className = "mixedTag";
      tag.textContent = mixedLabel;
      l.appendChild(tag);
    }
    const sel = document.createElement("select");
    for (const [val, txt] of options){
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = txt;
      if (val === value) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () =>  { onChange(sel.value); historyCommit("Edit properties"); });
    f.appendChild(l); f.appendChild(sel);
    return f;
  }

/* ============================================================
   Color swatches helper (reusable for Stage + Properties)
   ============================================================ */

// A compact “good defaults” palette. Edit to taste.
const DEFAULT_COLOR_SWATCHES_LESS = [
  "#FFFFFF", "#E0E0E0", "#C0C0C0", "#808080", "#606060", "#111111", "#000000",
  "#FF4000", "#FF8000", "#FFC000", "#FFFF00",
  "#80FF00", "#00FF00", "#00FF80", "#00FFFF",
  "#0000FF", "#8000FF", "#FF00FF", "#FF0000"
];

const DEFAULT_COLOR_SWATCHES = [
  // Keep the original small palette exactly as-is
  ...DEFAULT_COLOR_SWATCHES_LESS,

  // Additions chosen to be high-contrast / non-redundant
  "#F3DFC0", // paper background (warm)
  "#7C5C2B", // brown ink
  "#A16207", // deep amber
  "#B91C1C", // deep red
  "#166534", // deep green
  "#0E7490"  // deep teal
];

// ------------------------------
// Dynamic palette augmentation
// ------------------------------
const MAX_DYNAMIC_SWATCHES = 50;

// Store dynamic swatches (chosen by user OR derived from imported Scene colours)
let DYNAMIC_COLOR_SWATCHES = [];
let _dynamicCursor = 0;

// Fast lookup for base palette (case-insensitive)
const _BASE_SWATCH_SET = new Set(DEFAULT_COLOR_SWATCHES.map(s => String(s).trim().toLowerCase()));

function getActiveColorPalette(){
  // Base + dynamic (dynamic may contain colours not in base)
  return [...DEFAULT_COLOR_SWATCHES, ...DYNAMIC_COLOR_SWATCHES];
}

function resetDynamicSwatches(){
  DYNAMIC_COLOR_SWATCHES = [];
  _dynamicCursor = 0;
  rebuildAllSwatches();
}

function addDynamicSwatch(hex){
  const v = _normalizeHex6(hex, "#111111");
  if (!v) return;

  const key = v.toLowerCase();
  if (_BASE_SWATCH_SET.has(key)) return;

  // Avoid duplicates in dynamic list
  if (DYNAMIC_COLOR_SWATCHES.some(c => String(c).toLowerCase() === key)) return;

  if (DYNAMIC_COLOR_SWATCHES.length < MAX_DYNAMIC_SWATCHES){
    DYNAMIC_COLOR_SWATCHES.push(v);
  } else {
    // Ring buffer overwrite
    DYNAMIC_COLOR_SWATCHES[_dynamicCursor] = v;
    _dynamicCursor = (_dynamicCursor + 1) % MAX_DYNAMIC_SWATCHES;
  }

  rebuildAllSwatches();
}

// Rebuild dynamic slots from colours *used in the Scene*
function rebuildDynamicPaletteFromScene(){
  const found = [];

  function add(val){
    const v = _normalizeHex6(val, "#111111");
    if (!v) return;
    const key = v.toLowerCase();
    if (_BASE_SWATCH_SET.has(key)) return;
    if (found.some(c => c.toLowerCase() === key)) return;
    found.push(v);
  }

  function addFromElements(elements){
    for (const el of (elements || [])){
      add(el.color);
      add(el.fill);
      add(el.stroke);
      add(el.haloColor);
    }
  }

  // Stage colours from the current page
  add(Scene?.stage?.bg);
  add(Scene?.stage?.defaultTextColor);
  add(Scene?.stage?.defaultFill);
  add(Scene?.stage?.defaultStroke);
  add(Scene?.stage?.defaultHaloColor);

  // Current page elements
  addFromElements(Scene?.elements);

  // All other pages in the document so colours are shared across the whole document
  if (typeof ScrapbookState !== 'undefined' && ScrapbookState?.doc?.pages){
    for (const page of ScrapbookState.doc.pages){
      const els = page?.payload?.scene?.elements;
      if (els) addFromElements(els);
      const st = page?.payload?.scene?.stage;
      if (st){
        add(st.bg);
        add(st.defaultTextColor);
        add(st.defaultFill);
        add(st.defaultStroke);
        add(st.defaultHaloColor);
      }
    }
  }

  DYNAMIC_COLOR_SWATCHES = found.slice(0, MAX_DYNAMIC_SWATCHES);
  _dynamicCursor = DYNAMIC_COLOR_SWATCHES.length % MAX_DYNAMIC_SWATCHES;

  rebuildAllSwatches();
}



const _swatchUpdaterByInput = new WeakMap();
const _swatchRebuilderByInput = new WeakMap();
const _allSwatchedInputs = new Set();

function _isHex6(s){
  return /^#[0-9A-Fa-f]{6}$/.test(String(s || "").trim());
}

function _normalizeHex6(value, fallback="#111111"){
  const fb = _isHex6(fallback) ? fallback : "#111111";

  // If already #RRGGBB, normalize casing (optional)
  const s = String(value ?? "").trim();
  if (_isHex6(s)) return s.toUpperCase();

  // If you have rgbaOrHexToHex, delegate to it
  if (typeof rgbaOrHexToHex === "function"){
    const v = rgbaOrHexToHex(s, fb);   // fb is NEVER null
    return _isHex6(v) ? v.toUpperCase() : fb;
  }

  return fb;
}


/**
 * Attaches a swatch strip to an existing <input type="color">.
 * - Works for Stage mini panel inputs (already in DOM) :contentReference[oaicite:4]{index=4}
 * - Works for inputs created by makeColorPickerWithSwatch() :contentReference[oaicite:5]{index=5}
 *
 * Options:
 * - palette: array of "#RRGGBB"
 * - onPick(hex): if supplied, called instead of default “set input + dispatch events”
 */
function attachSwatchesToColorInput(
  colorInput,
  { palette = DEFAULT_COLOR_SWATCHES, onPick = null, showCurrent = true } = {}
){
  const inp = colorInput;
  if (!inp || inp.tagName !== "INPUT" || inp.type !== "color") return;

  // palette can be array OR function returning array
  const paletteProvider = (typeof palette === "function") ? palette : () => palette;

  // Prevent double-attachment
  if (inp.dataset && inp.dataset.hasSwatches === "1"){
    // Already attached — but update its rebuilder to use latest provider if needed
    if (_swatchRebuilderByInput.has(inp)){
      _swatchRebuilderByInput.get(inp)(); // rebuild with current palette
      refreshSwatchesForColorInput(inp);
    }
    return;
  }
  if (inp.dataset) inp.dataset.hasSwatches = "1";

  const parent = inp.parentElement;
  if (!parent) return;

  // Build row container if not present
  let row = inp.closest(".colorControlRow");
  if (!row){
    row = document.createElement("div");
    row.className = "colorControlRow";
    parent.insertBefore(row, inp);
    row.appendChild(inp); // moves input into row
  }

  // Create swatch container
  const sw = document.createElement("div");
  sw.className = "colorSwatches";

  // Optional “current colour” swatch
  let currentBtn = null;
  if (showCurrent){
    currentBtn = document.createElement("button");
    currentBtn.type = "button";
    currentBtn.className = "swatchBtn";
    currentBtn.style.background = _normalizeHex6(inp.value, "#111111");
    currentBtn.title = "Current colour (click to open picker)";
    currentBtn.setAttribute("aria-label", "Current colour (click to open picker)");
    currentBtn.setAttribute("aria-pressed", "false");

    currentBtn.addEventListener("click", () => {
      try { inp.focus(); inp.click(); } catch (_) {}
    });

    sw.appendChild(currentBtn);
  }

  // Strip that holds the preset swatches (rebuildable)
  const strip = document.createElement("div");
  strip.className = "colorSwatchesStrip";
  sw.appendChild(strip);

  row.appendChild(sw);

  let buttons = [];
  let paletteSet = new Set();

  function rebuild(){
    strip.innerHTML = "";
    buttons = [];
    paletteSet = new Set();

    const pal = paletteProvider() || [];
    for (const hexRaw of pal){
      const hex = _normalizeHex6(hexRaw, "#111111");
      if (!hex) continue;
      const key = hex.toLowerCase();
      if (paletteSet.has(key)) continue; // dedupe
      paletteSet.add(key);

      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatchBtn";
      b.style.background = hex;
      b.title = hex;
      b.setAttribute("aria-label", `Pick ${hex}`);
      b.setAttribute("aria-pressed", "false");

      b.addEventListener("click", () => {
        const picked = _normalizeHex6(hex, "#111111");
        if (onPick){
          onPick(picked);
        } else {
          // Default behaviour: set input and emit events
          inp.value = picked;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
        refreshSwatchesForColorInput(inp);
      });

      strip.appendChild(b);
      buttons.push(b);
    }
  }

  function updatePressed(){
    const current = _normalizeHex6(inp.value, "#111111");
    const currentLower = current.toLowerCase();

    if (currentBtn){
      currentBtn.style.background = current;
      currentBtn.setAttribute("aria-pressed", "false");
      if (!paletteSet.has(currentLower)){
        currentBtn.title = `Custom: ${current}`;
        currentBtn.setAttribute("aria-label", `Custom: ${current}`);
      } else {
        currentBtn.title = "Current colour (click to open picker)";
        currentBtn.setAttribute("aria-label", "Current colour (click to open picker)");
      }
    }

    for (const b of buttons){
      const bg = String(b.style.background || "").trim();
      const asHex = _normalizeHex6(bg, "#FFFFFF") || bg;
      const pressed = (String(asHex).toLowerCase() === currentLower);
      b.setAttribute("aria-pressed", pressed ? "true" : "false");
      b.classList.toggle("isPressed", pressed);
    }
  }

  // Initial build
  rebuild();
  updatePressed();

  _swatchUpdaterByInput.set(inp, updatePressed);
  _swatchRebuilderByInput.set(inp, () => { rebuild(); updatePressed(); });
  _allSwatchedInputs.add(inp);
}



function refreshSwatchesForColorInput(colorInput){
  const fn = _swatchUpdaterByInput.get(colorInput);
  if (fn) fn();
}

function rebuildSwatchesForColorInput(colorInput){
  const fn = _swatchRebuilderByInput.get(colorInput);
  if (fn) fn();
}

function rebuildAllSwatches(){
  for (const inp of _allSwatchedInputs){
    rebuildSwatchesForColorInput(inp);
    refreshSwatchesForColorInput(inp);
  }
}


function makeColorPickerWithSwatch(label, value, onLive, onCommit, mixedLabel=null){
  const f = document.createElement("div");
  f.className = "field";

  const l = document.createElement("label");
  l.textContent = label;
  if (mixedLabel){
    const tag = document.createElement("span");
    tag.className = "mixedTag";
    tag.textContent = mixedLabel;
    l.appendChild(tag);
  }

  const inp = document.createElement("input");
  inp.type = "color";

  // Validate/normalize for <input type="color">
  inp.value = _normalizeHex6(value, "#111111");

  let liveTimer = null;

  function applyValue(hex, { commit }){
    const v = _normalizeHex6(hex, "#111111");
    inp.value = v;

    if (onLive) onLive(v);

    if (commit){
      addDynamicSwatch(v);       // <--- add this
      if (onCommit) onCommit(v);
      historyCommit("Edit properties");
    }

    // Keep swatch highlight correct (especially for programmatic sets)
    refreshSwatchesForColorInput(inp);
  }

  inp.addEventListener("input", (e) => {
    try{
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        applyValue(e.target.value, { commit: false });
      }, 16);
    } catch (err){
      console.warn(err);
    }
  });

  inp.addEventListener("change", (e) => {
    try{
      clearTimeout(liveTimer);
      applyValue(e.target.value, { commit: true });
    } catch (err){
      console.warn(err);
    }
  });

  f.appendChild(l);
  f.appendChild(inp);

  // Attach swatches next to the picker; swatch click should COMMIT.
  attachSwatchesToColorInput(inp, {
    palette: getActiveColorPalette,
    onPick: (hex) => applyValue(hex, { commit: true })
  });

  return f;
}


function makeColorPicker(label, value, onLive, onCommit){
  const f = document.createElement("div");
  f.className = "field";

  const l = document.createElement("label");
  l.textContent = label;

  const inp = document.createElement("input");
  inp.type = "color";

  // ✅ FIX: Validate hex before assigning to color input
  const hexValue = String(value || "#111111").trim();
  const validHex = /^#[0-9A-Fa-f]{6}$/i.test(hexValue) ? hexValue : "#111111";
  inp.value = validHex;

  let liveTimer = null;

  // Live preview: do NOT rebuild props panel here.
  inp.addEventListener("input", (e) => {
    if (APP_VECTOR_DEBUG) console.log("Colour Input Event");
    try { 
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        if (onLive) onLive(e.target.value); 
      }, 16); // ~60fps
    } catch (err) { 
      console.warn(err); 
    }
  });

  // Commit: picker closed (most reliable across browsers).
  inp.addEventListener("change", (e) => {
    if (APP_VECTOR_DEBUG) console.log("Colour Change Event");
    try {
      clearTimeout(liveTimer);
      if (onLive) onLive(e.target.value);
      // Ensure final value applied even if some browsers don't emit input as expected
      if (onCommit) {onCommit(e.target.value); historyCommit("Edit properties");}
    } catch (err) {
      console.warn(err);
    }
  });

  f.appendChild(l);
  f.appendChild(inp);
  return f;
}



  /* ============================================================
     Grouping
     ============================================================ */
  function groupSelection(){
    const sels = getSelectedElements();
    if (sels.length < 2) return;
    // Do not group if selection already all in same group
    if (getGroupIdFromSelection()) return;

    const gid = uid("grp");

    // Prefer the common color of text-like elements (if any), else default
    const textLikes = sels.filter(isTextLikeElement);
    const commonFg = commonValue(textLikes, e => e.color) || "#111111";

    Scene.groups[gid] = { id: gid, createdAt: new Date().toISOString(), foreground: commonFg };

    for (const el of sels) el.groupId = gid;


    // Selection becomes all in group (already is)
    scheduleAutosave();
    updateUiForSelection();
    render();
    historyCommit("Group");
    setStatus(tr("status_grouped", sels.length));
  }

  function ungroupSelection(){
    const gid = getGroupIdFromSelection();
    if (!gid) return;
    const els = getElementsInGroup(gid);
    for (const el of els) el.groupId = null;
    delete Scene.groups[gid];

    // keep selection as ungrouped elements
    selectOnlyElements(els.map(e => e.id));
    scheduleAutosave();
    updateUiForSelection();
    render();
    historyCommit("Ungroup");
    setStatus(tr("status_ungrouped"));
  }

  /* ============================================================
     Layer order
     ============================================================ */
  function bringForward(){
    const ids = [...selectedIds];
    if (!ids.length) return;
    // Move selected elements one step forward preserving internal order
    const idxs = ids.map(id => Scene.elements.findIndex(e => e.id === id)).filter(i => i >= 0).sort((a,b)=>b-a);
    for (const i of idxs){
      if (i < Scene.elements.length - 1){
        const tmp = Scene.elements[i];
        Scene.elements[i] = Scene.elements[i+1];
        Scene.elements[i+1] = tmp;
      }
    }
    scheduleAutosave(); render();
  }

 function bringForwardZ(){
  moveSelectionZ(+1);
  scheduleAutosave();
  render();
  historyCommit("Reorder");
  updateUiForSelection();
}

  function sendBackward(){
    const ids = [...selectedIds];
    if (!ids.length) return;
    const idxs = ids.map(id => Scene.elements.findIndex(e => e.id === id)).filter(i => i >= 0).sort((a,b)=>a-b);
    for (const i of idxs){
      if (i > 0){
        const tmp = Scene.elements[i];
        Scene.elements[i] = Scene.elements[i-1];
        Scene.elements[i-1] = tmp;
      }
    }
    scheduleAutosave(); render();
  }

  function sendBackwardZ(){
    moveSelectionZ(-1);
    scheduleAutosave();
    render();
    historyCommit("Reorder");
    updateUiForSelection();
  }

//copy/paste
function copySelection(){
  if (selectionIsEmpty()){
    setStatus(tr("status_copy_none"));
    return;
  }

  const ids = selectionIdsArray();
  const els = ids.map(getElementById).filter(Boolean);

  // If selection corresponds to exactly one group, preserve it on paste as a new group
  const gid = getGroupIdFromSelection();
  const hadSingleGroup = !!gid;

  const copiedGroups = {};
  if (hadSingleGroup && Scene.groups[gid]){
    copiedGroups[gid] = deepClone(Scene.groups[gid]);
  }

  CLIPBOARD.elements = deepClone(els);
  CLIPBOARD.groups = copiedGroups;
  CLIPBOARD.hadSingleGroup = hadSingleGroup;
  CLIPBOARD.sourceGroupId = gid || null;
  CLIPBOARD.pasteIndex = 0;
  CLIPBOARD.sourcePageId = ScrapbookState?.currentPageId || null;
  CLIPBOARD.lastPastePageId = null;

  if (CLIPBOARD.hadSingleGroup && CLIPBOARD.sourceGroupId) {
    const grp = Scene.groups?.[CLIPBOARD.sourceGroupId] || null;
    CLIPBOARD.sourceGroupRecord = grp ? deepClone(grp) : null;
  } else {
    CLIPBOARD.sourceGroupRecord = null;
  }

  setStatus(tr("status_copied", els.length));
  updateClipboardButtons();

}

function cutSelection(){
  if (selectionIsEmpty()){
    setStatus(tr("status_cut_none"));
    return;
  }

  // Block cutting locked elements (consistent with your delete rules)
  if (selectionHasLocked()){
    window.alert(tr("alert_cut_locked"));
    setStatus(tr("status_cut_blocked_locked"));
    return;
  }

  copySelection();

  const idsSet = new Set(selectionIdsArray());
  removeElementsByIds(idsSet);
  selectedIds.clear();

  scheduleAutosave();
  updateUiForSelection();
  render();
  historyCommit("Cut");
  setStatus(tr("status_cut_done"));
  updateClipboardButtons();

}

function pasteClipboard(){
  if (!CLIPBOARD.elements || !Array.isArray(CLIPBOARD.elements) || CLIPBOARD.elements.length === 0){
    setStatus(tr("status_paste_empty"));
    return;
  }

  // Compute a sensible offset (stage units). Use grid size if available.
  const base = Math.max(10, Number(Scene.stage.gridSize || 20));
  const currentPageId = ScrapbookState?.currentPageId || null;

  // First paste onto a different page: place elements at exact source coordinates (no offset).
  // Subsequent pastes on any page always offset so duplicates are visible.
  const isFirstCrossPagePaste =
    currentPageId &&
    CLIPBOARD.sourcePageId &&
    currentPageId !== CLIPBOARD.sourcePageId &&
    CLIPBOARD.lastPastePageId !== currentPageId;

  let dx, dy;
  if (isFirstCrossPagePaste) {
    dx = 0;
    dy = 0;
    // Don't increment pasteIndex — next paste on this page will be index 1 (first offset)
  } else {
    CLIPBOARD.pasteIndex += 1;
    dx = base * 0.6 * CLIPBOARD.pasteIndex;
    dy = base * 0.6 * CLIPBOARD.pasteIndex;
  }
  CLIPBOARD.lastPastePageId = currentPageId;

  // Map old element ids -> new element ids
  const idMap = new Map();

  // If selection was a single group, create a new group for pasted items
// If selection was a single group, create a new group for pasted items
let newGroupId = null;
if (CLIPBOARD.hadSingleGroup && CLIPBOARD.sourceGroupId) {
  newGroupId = uid("grp");

  const nowIso = new Date().toISOString();
  const srcGrp = CLIPBOARD.sourceGroupRecord || Scene.groups?.[CLIPBOARD.sourceGroupId] || null;

  // Clone source group metadata if available; otherwise fall back to minimal record
  const newGrp = srcGrp ? deepClone(srcGrp) : {};

  // Force identity + timestamps for the new group
  newGrp.id = newGroupId;

  // Preserve original createdAt if you want provenance; or overwrite (choose one):
  // Option A: treat paste as "newly created"
  newGrp.createdAt = nowIso;

  // Optional: if you track modifiedAt / updatedAt
  if ("modifiedAt" in newGrp) newGrp.modifiedAt = nowIso;
  if ("updatedAt" in newGrp) newGrp.updatedAt = nowIso;

  // Important: if group record contains transient UI fields, strip them
  delete newGrp._drag;
  delete newGrp._startX;
  delete newGrp._startY;

  Scene.groups[newGroupId] = newGrp;
}


  const newEls = [];

  for (const src of CLIPBOARD.elements){
    const el = deepClone(src);

    // New identity
    const oldId = el.id;
    el.id = uid("el");
    idMap.set(oldId, el.id);

    // Position offset (down + right)
    el.x = (Number(el.x) || 0) + dx;
    el.y = (Number(el.y) || 0) + dy;

    // Group handling
    if (newGroupId){
      el.groupId = newGroupId;
    } else {
      // If it was not a single-group copy, do not carry group ids across (avoid referencing old groups)
      el.groupId = null;
    }

    // Remove transient drag fields if present
    delete el._startX; delete el._startY;
    delete el._startW; delete el._startH;
    delete el._startRot; delete el._startFontSize;
    delete el._startRadius;

    newEls.push(el);
  }

  // Add pasted elements on top
  for (const el of newEls){
    Scene.elements.push(el);
  }

  // Select pasted elements
  selectOnlyElements(newEls.map(e => e.id));

  scheduleAutosave();
  updateUiForSelection();
  render();
  historyCommit("Paste");

  setStatus(tr("status_pasted", newEls.length));
  updateClipboardButtons();

}




function wireClipboardButtons(){
  const copyBtn  = document.getElementById("btnCopy");
  const cutBtn   = document.getElementById("btnCut");
  const pasteBtn = document.getElementById("btnPaste");
  if (!copyBtn || !cutBtn || !pasteBtn) return;

  const undoBtn  = document.getElementById("btnUndo");
  const redoBtn  = document.getElementById("btnRedo");

  if (undoBtn) undoBtn.addEventListener("click", () => historyUndo());
  if (redoBtn) redoBtn.addEventListener("click", () => historyRedo());

  copyBtn.addEventListener("click", () => copySelection());
  cutBtn.addEventListener("click",  () => cutSelection());
  pasteBtn.addEventListener("click",() => pasteClipboard());

  // Text Editor toggle button
  const teBtn = document.getElementById("btnToggleTextEditor");
  if (teBtn){
    teBtn.addEventListener("click", () => {
      if (FloatingTextEditor.isOpen){
        closeFloatingTextEditor();
      } else {
        showFloatingTextEditor();
        refreshFloatingTextEditorForSelection();
      }
      syncTextEditorToggleBtn();
    });
    syncTextEditorToggleBtn(); // set initial pressed state
  }

  updateClipboardButtons(); // set initial enabled/disabled state

  const meBtn = document.getElementById("btnToggleMediaEditor");
  if (meBtn){
    meBtn.addEventListener("click", () => {
      if (FloatingMediaEditor.isOpen){
        closeFloatingMediaEditor();
      } else {
        showFloatingMediaEditor();
        refreshFloatingMediaEditorForSelection();
      }
      syncMediaEditorToggleBtn();
    });
    syncMediaEditorToggleBtn();
  }

  const tbZoomInBtn = document.getElementById("btnTopbarZoomIn");
  if (tbZoomInBtn) tbZoomInBtn.addEventListener("click", () => {
    Scene.view.zoom = clamp(Scene.view.zoom * 1.15, 0.1, 10);
    scheduleAutosave(); render();
  });

  const tbZoomOutBtn = document.getElementById("btnTopbarZoomOut");
  if (tbZoomOutBtn) tbZoomOutBtn.addEventListener("click", () => {
    Scene.view.zoom = clamp(Scene.view.zoom / 1.15, 0.1, 10);
    scheduleAutosave(); render();
  });

  updateClipboardButtons(); // set initial enabled/disabled state
  updateUndoRedoUi();//update undo/redo buttons
}

function updateClipboardButtons(){
  const copyBtn  = document.getElementById("btnCopy");
  const cutBtn   = document.getElementById("btnCut");
  const pasteBtn = document.getElementById("btnPaste");
  if (!copyBtn || !cutBtn || !pasteBtn) return;

  const hasSel = selectedIds && selectedIds.size > 0;
  const canPaste = !!(CLIPBOARD && CLIPBOARD.elements && CLIPBOARD.elements.length);

  copyBtn.disabled  = !hasSel;
  cutBtn.disabled   = !hasSel || selectionHasLocked();
  pasteBtn.disabled = !canPaste;
}




  /* ============================================================
     Deletion
     ============================================================ */
  function deleteSelection(){
  if (!selectedIds.size) return;

  // CHANGE HERE: locked elements cannot be deleted
  if (selectionHasLocked()){
    window.alert(tr("alert_delete_locked"));
    setStatus(tr("status_delete_blocked_locked"));
    return;
  }

  // CHANGE HERE: always confirm delete to prevent accidental deletion
  const count = selectedIds.size;
  const ok = window.confirm(tr("confirm_delete", count));
  if (!ok) return;

  const ids = new Set(selectedIds);
  Scene.elements = Scene.elements.filter(e => !ids.has(e.id));
  selectedIds.clear();

  // cleanup empty groups
  const used = new Set(Scene.elements.map(e => e.groupId).filter(Boolean));
  for (const gid of Object.keys(Scene.groups)){
    if (!used.has(gid)) delete Scene.groups[gid];
  }

  scheduleAutosave();
  updateUiForSelection();
  render();
  historyCommit("Delete");
  setStatus(tr("status_deleted"));
}


  /* ============================================================
     Pointer events on canvas
     ============================================================ */
  wrap.addEventListener("pointerdown", (e) => {
    if (isTypingContext(document.activeElement)) return;

    const ptScreen = getPointerScreen(e);
    const ptStage = screenToStage(ptScreen);

    // Ensure we only interact within stage area for creation; selection may also be stage-limited.
    const insideStage = (ptStage.x >= 0 && ptStage.y >= 0 && ptStage.x <= Scene.stage.w && ptStage.y <= Scene.stage.h);

    if (activeTool === Tool.Pan){
      startPointerCapture(e);
      drag.mode = HANDLE.Pan;
      drag.startScreen = ptScreen;
      drag.panStartView = { zoom: Scene.view.zoom, ox: Scene.view.offsetX, oy: Scene.view.offsetY };
      setStatus(tr("status_panning"));
      return;
    }

    if (activeTool !== Tool.Select){
      if (!insideStage){
        setStatus(tr("status_click_create"));
        return;
      }

      // Creation tools: create on pointerdown and switch back to Select (prevents duplicate-creation bug)
      if (activeTool === Tool.Text){
        const el = newTextElement(ptStage.x, ptStage.y);
        addElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Sitelen){
        const el = newSitelenElement(ptStage.x, ptStage.y);
        addElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Glyph){
        const el = newGlyphElement(ptStage.x, ptStage.y);
        addElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Rect){
        const el = newRectElement(ptStage.x, ptStage.y);
        addElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Image){
        const el = newImageElement(ptStage.x, ptStage.y);
        addElement(el);
        pickImageForElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Audio){
        const el = newAudioElement(ptStage.x, ptStage.y);
        addElement(el);
        pickAudioForElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Video){
        const el = newVideoElement(ptStage.x, ptStage.y);
        addElement(el);
        pickVideoForElement(el);
        setTool(Tool.Select);
        return;
      }
      if (activeTool === Tool.Url){
        const el = newUrlElement(ptStage.x, ptStage.y);
        addElement(el);
        setTool(Tool.Select);
        window.setTimeout(() => {
          try { promptUrlForElement(el); }
          catch (err) { console.warn('Prompt URL failed', err); }
        }, 0);
        return;
      }
      if (activeTool === Tool.Delete){
        // Delete tool: delete element under pointer or selection
        const hit = pickTopmostElementAtStagePoint(ptStage);
        if (hit){
          selectOnlyElements(hit.groupId ? getElementsInGroup(hit.groupId).map(e=>e.id) : [hit.id]);
          deleteSelection();
        } else {
          deleteSelection();
        }
        setTool(Tool.Select);
        return;
      }
    }

    // Select tool behavior
    if (!insideStage){
      // Clicking outside stage clears selection unless shift
      if (!e.shiftKey) clearSelection();
      return;
    }

    // First: handle selection handles if any selected
    const handle = hitTestSelectionHandles(ptStage);
    if (handle !== HANDLE.None && anySelected()){

      // CHANGE HERE: block transforms if any selected is locked
      if (selectionHasLocked()){
        setStatus(tr("status_locked_unlock_edit"));
        return;
      }

      // If this is a Move (click inside selection body, not a resize/rotate handle),
      // immediately update the floating editor to reflect whichever element was clicked.
      // The drag still starts normally — this just updates the leader without waiting for pointerup.
      if (handle === HANDLE.Move && selectedIds.size > 1){
        const hitEl = pickTopmostElementAtStagePoint(ptStage);
        const S = FloatingSitelenEditor;
        if (hitEl && hitEl.id !== S._boundElId) {
          _lastGroupClickPt = { x: ptStage.x, y: ptStage.y };
          try { renderPropsPanel(); } catch(err) { console.warn(err); }
          refreshFloatingEditorForSelection(hitEl.id);
        }
        drag._groupRefreshClickPt = { x: ptStage.x, y: ptStage.y };
        drag._groupRefreshHitId = hitEl ? hitEl.id : null;
      }
      
      startPointerCapture(e);
      beginDragSelectionMode(handle, ptScreen, ptStage);
      setStatus(handle === HANDLE.Rotate ? "Rotate…" : "Transform…");
      return;
    }

    // Hit test for selecting element
    const hit = pickTopmostElementAtStagePoint(ptStage);

    if (hit){
      // Group selection rule: click inside any element of the group selects the group set.
      const ids = hit.groupId ? getElementsInGroup(hit.groupId).map(e => e.id) : [hit.id];

      if (e.shiftKey){
        // toggle the *whole group* if grouped, or element if not
        const allSelected = ids.every(id => selectedIds.has(id));
        if (allSelected) ids.forEach(id => selectedIds.delete(id));
        else ids.forEach(id => selectedIds.add(id));
        // Store click point for group shift-clicks too
        _lastGroupClickPt = hit.groupId ? { x: ptStage.x, y: ptStage.y } : null;
        updateUiForSelection();
        render();
      } else {
        // normal click: replace selection with this (or group).
        // If the click lands inside an already-selected multi-element group, defer
        // the leader refresh to pointerup (so drag-to-move is unaffected).
        const alreadyAllSelected = ids.every(id => selectedIds.has(id));
        if (alreadyAllSelected && selectedIds.size > 1) {
          // Mark for possible group-leader refresh on pointerup (only fires if no drag)
          drag._groupRefreshClickPt = { x: ptStage.x, y: ptStage.y };
          drag._groupRefreshHitId = hit.id;  // exact element the user clicked
        } else {
          // New or changed selection — update immediately as before
          drag._groupRefreshClickPt = null;
          drag._groupRefreshHitId = null;
          _lastGroupClickPt = hit.groupId ? { x: ptStage.x, y: ptStage.y } : null;
          selectOnlyElements(ids);
          selectWholeGroupIfApplicable(hit, e);//????
        }
      }


      // CHANGE HERE: block move if selection includes locked
      if (selectionHasLocked()){
        setStatus(tr("status_locked_unlock_move"));
        return;
      }

      // Start move drag immediately (no duplicate creation bug)
      startPointerCapture(e);
      beginDragSelectionMode(HANDLE.Move, ptScreen, ptStage);
      setStatus(tr("status_move"));
      return;
    }

    // Empty space: marquee selection
    _lastGroupClickPt = null;
    if (!e.shiftKey) selectedIds.clear();
    updateUiForSelection();

    startPointerCapture(e);
    drag.mode = HANDLE.Marquee;
    drag.startScreen = ptScreen;
    drag.startStage = ptStage;
    drag.marquee = { x0: ptStage.x, y0: ptStage.y, x1: ptStage.x, y1: ptStage.y };
    setStatus(tr("status_marquee"));
    render();
  }, { passive: true });

  wrap.addEventListener("pointermove", (e) => {
    if (!drag.active || e.pointerId !== drag.pointerId) return;

    const ptScreen = getPointerScreen(e);
    const ptStage = screenToStage(ptScreen);

    if (drag.mode === HANDLE.Pan){
      const dxScreen = ptScreen.x - drag.startScreen.x;
      const dyScreen = ptScreen.y - drag.startScreen.y;
      const z = drag.panStartView.zoom;
      Scene.view.offsetX = drag.panStartView.ox + dxScreen / z;
      Scene.view.offsetY = drag.panStartView.oy + dyScreen / z;
      render();
      return;
    }

    if (drag.mode === HANDLE.Marquee){
      drag.marquee.x1 = ptStage.x;
      drag.marquee.y1 = ptStage.y;
      render();
      return;
    }

    if (drag.mode === HANDLE.Move){
      const dx = ptStage.x - drag.startStage.x;
      const dy = ptStage.y - drag.startStage.y;
      applyMoveToSelection(dx, dy);
      render();
      return;
    }

    if (drag.mode === HANDLE.Rotate){
      const aabb = drag.startAabb;
      const cx = aabb.x + aabb.w/2;
      const cy = aabb.y + aabb.h/2;
      const ang = Math.atan2(ptStage.y - cy, ptStage.x - cx);
      const delta = deg(ang - drag.startAngle);
      applyRotateToSelection(delta);
      render();
      return;
    }

    // resize handles
    if (
      drag.mode === HANDLE.ResizeNW || drag.mode === HANDLE.ResizeN || drag.mode === HANDLE.ResizeNE ||
      drag.mode === HANDLE.ResizeE  || drag.mode === HANDLE.ResizeSE || drag.mode === HANDLE.ResizeS  ||
      drag.mode === HANDLE.ResizeSW || drag.mode === HANDLE.ResizeW
    ){
      applyScaleToSelection(drag.mode, ptStage, e.shiftKey);
      render();
      return;
    }
  }, { passive: true });

  wrap.addEventListener("pointerup", (e) => {
    if (!drag.active || e.pointerId !== drag.pointerId) return;

    if (drag.mode === HANDLE.Marquee && drag.marquee){
      const x0 = Math.min(drag.marquee.x0, drag.marquee.x1);
      const y0 = Math.min(drag.marquee.y0, drag.marquee.y1);
      const x1 = Math.max(drag.marquee.x0, drag.marquee.x1);
      const y1 = Math.max(drag.marquee.y0, drag.marquee.y1);

      const selected = [];
      for (const el of Scene.elements){
        // Select if entire element AABB is inside marquee (as requested)
        const b = aabbOfElements([el]);
        if (b.x >= x0 && b.y >= y0 && (b.x+b.w) <= x1 && (b.y+b.h) <= y1){
          selected.push(el.id);
        }
      }

      // If any selected elements are in groups, expand selection to include full groups
      const expanded = new Set(selected);
      for (const id of selected){
        const el = getElementById(id);
        if (el && el.groupId){
          for (const gEl of getElementsInGroup(el.groupId)) expanded.add(gEl.id);
        }
      }

      // Merge with existing selection (shift behavior already handled at down by not clearing)
      for (const id of expanded) selectedIds.add(id);

      updateUiForSelection();
      drag.marquee = null;
      setStatus(tr("status_selected", selectedIds.size));
      finalizeDrag();
      endPointerCapture();
      return;
    }

    // Group leader refresh: if this was a clean click (no drag) inside an already-selected
    // multi-element group, update the floating editor to reflect the clicked element —
    // but only if it would actually change the leader (avoids no-op re-renders).
    if (drag._groupRefreshClickPt) {
      const clickPt = drag._groupRefreshClickPt;
      const startPt = drag.startStage;
      const dx = startPt.x - clickPt.x;
      const dy = startPt.y - clickPt.y;
      const didDrag = (dx * dx + dy * dy) > 9; // 3px tolerance squared
      if (!didDrag) {
        const S = FloatingSitelenEditor;
        // Use the exact element hit at pointerdown — avoids z-order ambiguity
        const clickedEl = getElementById(drag._groupRefreshHitId);
        drag._groupRefreshHitId = null;
        if (clickedEl && clickedEl.id !== S._boundElId) {
          // Set the group click point then update props panel and floating editor
          // directly — bypassing updateUiForSelection() which would fire an
          // intermediate refreshFloatingEditorForSelection() with no forceLeaderId
          // before we get a chance to pass the correct one.
          _lastGroupClickPt = clickPt;
          try { renderPropsPanel(); } catch(e) { console.warn('renderPropsPanel error', e); }
          refreshFloatingEditorForSelection(clickedEl.id);
        }
      }
      drag._groupRefreshClickPt = null;
    }

    finalizeDrag();
    endPointerCapture();
    setStatus(tr("status_ready"));
  }, { passive: true });

  wrap.addEventListener("pointercancel", (e) => {
    if (!drag.active || e.pointerId !== drag.pointerId) return;
    drag._groupRefreshClickPt = null;
    drag._groupRefreshHitId = null;
    endPointerCapture();
    render();
    setStatus(tr("status_cancelled"));
  }, { passive: true });

  /* ============================================================
     Keyboard controls
     ============================================================ */
  window.addEventListener("keydown", (e) => {
if (isTypingContext(document.activeElement)) return;

    if (e.key === "Escape"){
      clearSelection();
      setStatus(tr("status_selection_cleared"));
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace"){
      if (anySelected()){
        e.preventDefault();
        deleteSelection();
      }
      return;
    }

  }, { passive: false });

  /* ============================================================
     Image picking
     ============================================================ */
function pickImageForElement(el){
  const inp = $("filePickImage");
  inp.value = "";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;

    // Store the image once in Assets; element references it by assetId.
    const dataUrl = await dataUrlFromBlob(file);
    const assetId = addImageAssetFromDataUrl(dataUrl);

    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth || img.width || 0;
      const natH = img.naturalHeight || img.height || 0;

      // Keep your existing behavior: default size if needed
      if (!el.w || !el.h){
        el.w = natW || el.w || 0;
        el.h = natH || el.h || 0;
      }

      // IMPORTANT: store only assetId (no base64 on the element)
      el.image = {
        assetId,
        naturalW: natW,
        naturalH: natH,
        origW: natW,
        origH: natH
      };

      el.keepAspect = (el.keepAspect == null) ? true : !!el.keepAspect;
      el.fill = "#FFFFFF";

      invalidateImageCache(el.id);
      invalidateColorKeyCache(el.id);
      scheduleAutosave();
      updateUiForSelection();
      render();
      setStatus(tr("status_image_embedded"));
      rebuildDynamicPaletteFromScene();

    };

    img.src = dataUrl;
  };
  inp.click();
}

async function createVideoPosterFromDataUrl(dataUrl){
  return await new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      // Release all decoded buffers on every exit path.
      const disposeVideo = () => {
        try { video.pause(); } catch {}
        try { video.removeAttribute('src'); } catch {}
        try { video.load(); } catch {}
        video.onerror = null;
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onloadeddata = null;
      };
      const finish = () => { disposeVideo(); resolve(""); };
      const capture = () => {
        try {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          if (!w || !h) return finish();
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(video, 0, 0, w, h);
          const result = c.toDataURL("image/png");
          // Reject blank frames (all-black or tiny data = empty capture)
          disposeVideo();
          resolve(result && result.length > 2048 ? result : "");
        } catch { finish(); }
      };
      video.onerror = finish;
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) * 0.05);
      };
      video.onseeked = () => { capture(); };
      video.onloadeddata = () => {
        if (!video.seeking) capture();
      };
      video.src = dataUrl;
    } catch { resolve(""); }
  });
}
async function blobToDataUrl(blob){
  try {
    if (!blob) return "";
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve("");
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}
async function capturePosterFromExternalImageUrl(href){
  const clean = String(href || '').trim();
  if (!clean) return '';

  // Attempt 1: CORS fetch → blob → data URL (works for permissive servers)
  try {
    const res = await fetch(clean, { mode: 'cors', credentials: 'omit', cache: 'force-cache', referrerPolicy: 'no-referrer' });
    if (res && res.ok) {
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) return dataUrl;
    }
  } catch {}

  // Attempt 2: no-cors fetch → blob → data URL
  // YouTube thumbnail servers (i.ytimg.com) block CORS but allow no-cors.
  // Opaque responses hide blob.size (reports 0), so we skip the size check
  // and rely on the data URL length check instead.
  try {
    const res = await fetch(clean, { mode: 'no-cors', credentials: 'omit', cache: 'force-cache', referrerPolicy: 'no-referrer' });
    if (res) {
      const blob = await res.blob();
      if (blob) {
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl && dataUrl.length > 512) return dataUrl; // >512 = real image data
      }
    }
  } catch {}

  // Attempt 3: anonymous <img> → canvas toDataURL (fails if server sends no CORS headers)
  return await new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 1;
          const h = img.naturalHeight || img.height || 1;
          if (!w || !h) return resolve('');
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = clean;
    } catch {
      resolve('');
    }
  });
}
async function capturePosterFromExternalImageUrls(hrefs){
  const urls = Array.isArray(hrefs) ? hrefs : [hrefs];
  for (const href of urls){
    const clean = String(href || '').trim();
    if (!clean) continue;
    const poster = await capturePosterFromExternalImageUrl(clean);
    if (poster) return poster;
  }
  return '';
}

async function maybePopulatePosterForUrlElement(el, { force = false } = {}){
  if (!el || el.type !== ElementType.Url || !el.url || typeof el.url !== 'object') return false;
  const href = String(el.url.href || '').trim();
  if (!href) return false;

  const detected = detectUrlKindFromHref(href);
  el.url.detectedKind = detected.kind;
  el.url.mimeHint = detected.mimeHint || '';

  const isPosterCandidate = detected.kind === 'image' || (detected.kind === 'video' && !!extractYouTubeVideoId(href));
  if (!isPosterCandidate) {
    el.url.posterAttempted = true;
    return false;
  }

  if (!force) {
    if (el.url.posterAssetId) return false;
    if (el.url.posterAttempted) return false;
  }

  let posterSourceHrefs = [];
  if (detected.kind === 'image') posterSourceHrefs = [href];
  else if (detected.kind === 'video') posterSourceHrefs = getBestEffortPosterUrlsForExternalVideo(href);

  if (!posterSourceHrefs.length) {
    el.url.posterAttempted = true;
    return false;
  }

  let remoteFallback = '';
  if (detected.kind === 'video') {
    remoteFallback = String(
      posterSourceHrefs.find((u) => /\/hqdefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      posterSourceHrefs.find((u) => /\/mqdefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      posterSourceHrefs.find((u) => /\/sddefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      posterSourceHrefs[0] || ''
    ).trim();
  } else {
    remoteFallback = String(posterSourceHrefs[0] || '').trim();
  }
  if (remoteFallback) {
    el.url.posterRemoteHref = remoteFallback;
    try { render(); } catch {}
  }

  const posterDataUrl = await capturePosterFromExternalImageUrls(posterSourceHrefs);
  el.url.posterAttempted = true;

  if (posterDataUrl) {
    // Best case: got a local data URL — store as a proper cached asset
    el.url.posterAssetId = addImageAssetFromDataUrl(posterDataUrl);
    return true;
  }

  // Fallback: all fetch attempts failed (common for YouTube due to CORS).
  // If we have a remoteFallback URL (e.g. i.ytimg.com/vi/.../hqdefault.jpg),
  // persist it as posterRemoteHref so the thumbnail renders on every draw
  // via ensureRemotePosterImageLoaded, and survives save/reload.
  if (remoteFallback) {
    el.url.posterRemoteHref = remoteFallback; // already set above, but ensure it sticks
    return true; // triggers autosave + sidebar refresh so the URL is saved to JSON
  }

  return false;
}

let _posterScanGeneration = 0;
async function opportunisticallyPopulateUrlPostersForScene(elements){
  const myGeneration = ++_posterScanGeneration;
  const list = Array.isArray(elements) ? elements : [];
  let changed = false;
  for (const el of list){
    // Abort if a newer page has started loading since we began
    if (myGeneration !== _posterScanGeneration) return false;
    try {
      const did = await maybePopulatePosterForUrlElement(el, { force: false });
      if (did) changed = true;
    } catch (err) {
      console.warn('URL poster population failed', err);
    }
  }
  // Only apply side-effects if we are still the active scan
  if (myGeneration !== _posterScanGeneration) return false;
  if (changed) {
    scheduleAutosave();
    try { render(); } catch {}
    try { renderScrapbookSidebar(); } catch {}
  }
  return changed;
}
function pickAudioForElement(el){
  const inp = $("filePickAudio"); inp.value = "";
  inp.onchange = async () => { const file = inp.files && inp.files[0]; if (!file) return; const dataUrl = await dataUrlFromBlob(file); const assetId = addBinaryAssetFromDataUrl("audio", dataUrl); el.audio = { assetId, mime: file.type || "audio/*", duration: 0, origName: file.name || "" }; el.title = file.name || "Audio"; scheduleAutosave(); updateUiForSelection(); render(); };
  inp.click();
}
function pickVideoForElement(el){
  const inp = $("filePickVideo"); inp.value = "";
  inp.onchange = async () => { const file = inp.files && inp.files[0]; if (!file) return; const dataUrl = await dataUrlFromBlob(file); const assetId = addBinaryAssetFromDataUrl("video", dataUrl); const posterDataUrl = await createVideoPosterFromDataUrl(dataUrl); el.posterAssetId = posterDataUrl ? addImageAssetFromDataUrl(posterDataUrl) : null; el.video = { assetId, mime: file.type || "video/*", duration: 0, naturalW: el.w, naturalH: el.h, origName: file.name || "" }; el.title = file.name || "Video"; scheduleAutosave(); updateUiForSelection(); render(); };
  inp.click();
}
let pendingUrlDialogResolver = null;
function ensureImmediateRemotePosterHint(el){
  if (!el || el.type !== ElementType.Url || !el.url) return;
  const href = String(el.url.href || '').trim();
  const detected = detectUrlKindFromHref(href);
  el.url.detectedKind = detected.kind;
  el.url.mimeHint = detected.mimeHint || '';
  if (detected.kind === 'image') {
    el.url.posterRemoteHref = href;
    return;
  }
  if (detected.kind === 'video') {
    const candidates = getBestEffortPosterUrlsForExternalVideo(href);
    const preferred = String(
      candidates.find((u) => /\/hqdefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      candidates.find((u) => /\/mqdefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      candidates.find((u) => /\/sddefault\.jpg(?:[?#].*)?$/i.test(String(u || ''))) ||
      candidates[0] || ''
    ).trim();
    el.url.posterRemoteHref = preferred;
    return;
  }
  el.url.posterRemoteHref = '';
}
// Generic styled confirm dialog — replaces browser confirm() with an in-app modal.
// Returns a Promise<boolean>: true if confirmed, false if cancelled.
let _pendingConfirmResolver = null;
function confirmDialog(title, message, confirmLabel = 'Confirm'){
  return new Promise((resolve) => {
    const backdrop = $('confirmDialogBackdrop');
    const titleEl  = $('confirmDialogTitle');
    const msgEl    = $('confirmDialogMessage');
    const btnOk    = $('btnConfirmDialogOk');
    const btnCan   = $('btnConfirmDialogCancel');
    if (!backdrop || !titleEl || !btnOk || !btnCan){ resolve(false); return; }
    if (_pendingConfirmResolver){ try { _pendingConfirmResolver(false); } catch {} _pendingConfirmResolver = null; }
    const cleanup = (result) => {
      backdrop.classList.remove('show');
      backdrop.setAttribute('aria-hidden', 'true');
      btnOk.onclick = null; btnCan.onclick = null; backdrop.onclick = null;
      const r = _pendingConfirmResolver; _pendingConfirmResolver = null;
      if (r) r(result);
    };
    _pendingConfirmResolver = resolve;
    titleEl.textContent = String(title || 'Are you sure?');
    msgEl.textContent   = String(message || '');
    btnOk.textContent   = String(confirmLabel || 'Confirm');
    backdrop.style.zIndex = String(CONFIRM_DIALOG_TOP_Z);
    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => { try { btnCan.focus(); } catch {} }, 0);
    btnOk.onclick  = () => cleanup(true);
    btnCan.onclick = () => cleanup(false);
    backdrop.onclick = (ev) => { if (ev.target === backdrop) cleanup(false); };
  });
}

function showUrlDialog(initialValue=''){
  return new Promise((resolve) => {
    const backdrop = $('urlDialogBackdrop');
    const input = $('urlDialogInput');
    const btnOk = $('btnUrlDialogOk');
    const btnCancel = $('btnUrlDialogCancel');
    if (!backdrop || !input || !btnOk || !btnCancel) { resolve({ ok:false, value:String(initialValue || '') }); return; }
    if (pendingUrlDialogResolver) {
      try { pendingUrlDialogResolver({ ok:false, value:String(initialValue || '') }); } catch {}
      pendingUrlDialogResolver = null;
    }
    const cleanup = (ok, value) => {
      backdrop.classList.remove('show');
      backdrop.setAttribute('aria-hidden', 'true');
      btnOk.onclick = null;
      btnCancel.onclick = null;
      backdrop.onclick = null;
      input.onkeydown = null;
      const r = pendingUrlDialogResolver;
      pendingUrlDialogResolver = null;
      if (r) r({ ok, value });
    };
    pendingUrlDialogResolver = resolve;
    input.value = String(initialValue || '');
    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 0);
    const stopEditEvent = (ev) => { ev.stopPropagation(); };
    input.addEventListener('keydown', stopEditEvent, true);
    input.addEventListener('keypress', stopEditEvent, true);
    input.addEventListener('keyup', stopEditEvent, true);
    input.addEventListener('paste', stopEditEvent, true);
    input.addEventListener('copy', stopEditEvent, true);
    input.addEventListener('cut', stopEditEvent, true);
    btnOk.onclick = () => cleanup(true, String(input.value || '').trim());
    btnCancel.onclick = () => cleanup(false, String(initialValue || ''));
    backdrop.onclick = (ev) => { if (ev.target === backdrop) cleanup(false, String(initialValue || '')); };
    input.onkeydown = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); cleanup(true, String(input.value || '').trim()); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cleanup(false, String(initialValue || '')); }
    };
  });
}
async function promptUrlForElement(el){
  const result = await showUrlDialog(el.url && el.url.href || '');
  if (!result || !result.ok) return;
  const clean = String(result.value || '').trim();
  const det = detectUrlKindFromHref(clean);
  el.url = { href: clean, detectedKind: det.kind, title: clean, posterAssetId: null, posterRemoteHref: '', mimeHint: det.mimeHint, posterAttempted: false };
  el.title = clean;
  if (!clean){
    scheduleAutosave();
    updateUiForSelection();
    render();
    try { renderScrapbookSidebar(); } catch {}
    return;
  }
  ensureImmediateRemotePosterHint(el);
  scheduleAutosave();
  updateUiForSelection();
  render();
  try { renderScrapbookSidebar(); } catch {}

  const defer = globalThis.requestIdleCallback
    ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 1500 })
    : (fn) => window.setTimeout(fn, 0);

  defer(async () => {
    try {
      const did = await maybePopulatePosterForUrlElement(el, { force: true });
      scheduleAutosave();
      if (did) {
        try { renderScrapbookSidebar(); } catch {}
      }
      updateUiForSelection();
      render();
    } catch (err) {
      console.warn('Deferred URL poster population failed', err);
      scheduleAutosave();
      updateUiForSelection();
      render();
    }
  });
}
async function pickBackgroundImageForScene(){
  const inp = $("filePickBgImage");
  inp.value = "";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;

    const dataUrl = await dataUrlFromBlob(file);
    const assetId = addImageAssetFromDataUrl(dataUrl);

    // Decode now: prevents “missing in export” + pop-in
    const img = new Image();
    img.src = dataUrl;
    try{
      if (img.decode) await img.decode();
      else await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    }catch{}

    Scene.stage.bgImgAssetId = assetId;
    Scene.stage.bgImgEnabled = true;
    if (typeof Scene.stage.bgImgKeepAspect !== "boolean") Scene.stage.bgImgKeepAspect = true;
    if (typeof Scene.stage.bgImgStretch !== "boolean") Scene.stage.bgImgStretch = false;

    invalidateBackgroundImageCache();
    scheduleAutosave();
    syncStageDefaultsUiFromScene();
    syncBackgroundResizeButtonState();
    render();
  };
  inp.click();
}

function clearBackgroundImageForScene(){
  Scene.stage.bgImgEnabled = false;
  Scene.stage.bgImgAssetId = null;
  invalidateBackgroundImageCache();
  scheduleAutosave();
  syncStageDefaultsUiFromScene();
  syncBackgroundResizeButtonState();
  render();
}

function resizeStageToBackgroundImage(){
  // Resize stage to the natural dimensions of the currently loaded background image.
  // Also forces Keep-aspect ON for the background image.
  const img = ensureBackgroundImageLoadedForStage();
  if (!img){
    // Not ready yet; trigger load and let the user click again once loaded.
    ensureBackgroundImageLoadedForStage();
    syncBackgroundResizeButtonState();
    return;
  }

  const natW = Number(img.naturalWidth || img.width || 0);
  const natH = Number(img.naturalHeight || img.height || 0);
  if (!Number.isFinite(natW) || !Number.isFinite(natH) || natW <= 0 || natH <= 0) return;

  const w = Math.max(64, Math.round(natW));
  const h = Math.max(64, Math.round(natH));

  Scene.stage.w = w;
  Scene.stage.h = h;
  Scene.stage.bgImgKeepAspect = true;

  // Sync UI inputs (so the user sees the new stage size)
  const sw = document.getElementById("stageW");
  const sh = document.getElementById("stageH");
  if (sw) sw.value = String(w);
  if (sh) sh.value = String(h);

  // Sync bg aspect checkbox
  const bgka = document.getElementById("bgImgKeepAspect");
  if (bgka) bgka.checked = true;

  fitStageToView();
  scheduleAutosave();
  render();
  historyCommit("Resize scene to background image");
}

function syncSnapButtonsFromScene(){
  const bGrid = document.getElementById("btnSnapGrid");
  const bObjs = document.getElementById("btnSnapObjs");
  if (!bGrid || !bObjs) return;

  const st = Scene.stage || (Scene.stage = {});
  const gridOn = !!st.snapGrid;
  const objsOn = !!st.snapObjects;

  bGrid.setAttribute("aria-pressed", gridOn ? "true" : "false");
  bObjs.setAttribute("aria-pressed", objsOn ? "true" : "false");

  // Optional: make state explicit in text too (helps on subtle themes)
  //bGrid.textContent = gridOn ? "Snap: Grid (On)" : "Snap: Grid";
  //bObjs.textContent = objsOn ? "Snap: Objects (On)" : "Snap: Objects";
}

function syncStageDefaultsUiFromScene(){
  const bg = document.getElementById("stageBg");
  const expbg = document.getElementById("exportStageBackground");
  const drfp = document.getElementById("defRenderFontPreset");
  const dtfo = document.getElementById("defTextFontOption");
  const danc = document.getElementById("defAbbreviateNumericCartouches");
  const dpcar = document.getElementById("defPreserveCenterOnAutoResize");
  const dsp = document.getElementById("defSpacingPreset");
  const dt = document.getElementById("defTextColor");
  const df = document.getElementById("defFill");
  const dfe = document.getElementById("defFillEnabled");
  const ds = document.getElementById("defStroke");
  const dsw = document.getElementById("defStrokeW");
  const diut = document.getElementById("defIgnoreUnknownText");
  const dhe = document.getElementById("defHaloEnabled");
  const dhc = document.getElementById("defHaloColor");
  const dht = document.getElementById("defHaloThickness");

  const st = Scene.stage || (Scene.stage = {});

 

  if (bg)  bg.value  = rgbaOrHexToHex(st.bg, DEFAULTS.stageBg);
  if (expbg) {expbg.checked = !!Scene.stage.exportStageBackground;}

  st.defaultRenderFontPreset = normalizeRenderFontPresetKey(
    st.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
  );

  // Rebuild the Default text font dropdown for the selected script preset first.
  stageFontPairController.setActivePreset(st.defaultRenderFontPreset, { persist: false });

  let desiredTextFontOption = normalizeTextFontOptionKeyForPreset(
    st.defaultTextFontOption || FONT_FAMILY_LITERAL,
    st.defaultRenderFontPreset
  );

  // Validate against the controller/preset option list.
  const textOptions = getTextFontOptionsForPresetKey(st.defaultRenderFontPreset);
  const allowedTextOptions = new Set(textOptions.map(([value]) => String(value)));

  if (!allowedTextOptions.has(String(desiredTextFontOption))) {
    desiredTextFontOption = getDefaultQuotedTextFontOptionForPreset(st.defaultRenderFontPreset);
  }

  // Validate against the actual DOM select too. This is what prevents the visible blank dropdown.
  if (dtfo) {
    const domAllowed = new Set(
      Array.from(dtfo.options || []).map(opt => String(opt.value))
    );

    if (!domAllowed.has(String(desiredTextFontOption))) {
      const patrickOption = Array.from(dtfo.options || []).find(opt =>
        String(opt.value).toLowerCase() === String(FONT_FAMILY_LITERAL).toLowerCase() ||
        String(opt.textContent || "").toLowerCase().includes("patrick")
      );

      if (patrickOption) {
        desiredTextFontOption = patrickOption.value;
      } else if (dtfo.options && dtfo.options.length > 0) {
        desiredTextFontOption = dtfo.options[0].value;
      } else {
        desiredTextFontOption = FONT_FAMILY_LITERAL;
      }
    }
  }

  st.defaultTextFontOption = desiredTextFontOption;
  st.defaultAbbreviateNumericCartouches = !!(st.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches);
  st.defaultPreserveCenterOnAutoResize = !!(st.defaultPreserveCenterOnAutoResize ?? DEFAULTS.defaultPreserveCenterOnAutoResize);
  st.defaultSpacingPreset = normalizeSpacingPreset(st.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);

  stageFontPairController.setSelectedTextFontOption(st.defaultTextFontOption, { persist: false });

  if (drfp) drfp.value = st.defaultRenderFontPreset;
  if (dtfo) dtfo.value = st.defaultTextFontOption;
  if (danc) danc.checked = !!st.defaultAbbreviateNumericCartouches;
  if (dpcar) dpcar.checked = !!st.defaultPreserveCenterOnAutoResize;
  if (dsp) dsp.value = st.defaultSpacingPreset;

  if (dt)  dt.value  = rgbaOrHexToHex(st.defaultTextColor, DEFAULTS.defaultTextColor);
  if (df)  df.value  = rgbaOrHexToHex(st.defaultFill, DEFAULTS.defaultFill);
  if (dfe) {dfe.checked = !!Scene.stage.defaultFillEnabled;}
  if (ds)  ds.value  = rgbaOrHexToHex(st.defaultStroke, DEFAULTS.defaultStroke);
  if (dsw) dsw.value = Number.isFinite(st.defaultStrokeW) ? st.defaultStrokeW : DEFAULTS.defaultStrokeW;
  if (diut) diut.checked = !!(st.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText);
  if (dhe) dhe.checked = !!(st.defaultHaloEnabled ?? DEFAULTS.defaultHaloEnabled);
  if (dhc) dhc.value = rgbaOrHexToHex(st.defaultHaloColor, DEFAULTS.defaultHaloColor);
  if (dht) dht.value = Number.isFinite(st.defaultHaloThicknessPx) ? st.defaultHaloThicknessPx : DEFAULTS.defaultHaloThicknessPx;


  const bge = document.getElementById("bgImgEnabled");
  const bgka = document.getElementById("bgImgKeepAspect");
  const bgs = document.getElementById("bgImgStretch");

  if (bge)  bge.checked  = !!Scene.stage.bgImgEnabled;
  if (bgka) bgka.checked = (Scene.stage.bgImgKeepAspect !== false);
  if (bgs)  bgs.checked  = !!Scene.stage.bgImgStretch;

  if (APP_VECTOR_DEBUG) console.log("Scene: " + JSON.stringify(st));

  syncSnapButtonsFromScene();

  syncBackgroundResizeButtonState();


    // Keep swatch highlights in sync (programmatic .value does not emit events)
  if (bg) refreshSwatchesForColorInput(bg);
  if (dhc) refreshSwatchesForColorInput(dhc);
  if (dt) refreshSwatchesForColorInput(dt);
  if (df) refreshSwatchesForColorInput(df);
  if (ds) refreshSwatchesForColorInput(ds);

}


  /* ============================================================
     Import/Export JSON and Export PNG
     ============================================================ */

     // ---------- Hardening helpers (put near utilities) ----------

const IMPORT_LIMIT_BYTES = 500_000_000;  // 500 MB cap — documents embed audio/video as base64
const MAX_ELEMENTS = 5000;               // prevent DoS-by-huge-array
const MAX_GROUPS = 5000;
const MAX_TEXT_LEN = 50_000;             // cap long sitelen/source text fields

function safeJsonParse(text){
  // Soft size warning for extremely large documents (embedded media makes these common)
  if (text.length > IMPORT_LIMIT_BYTES) {
    throw new Error(`Import too large (> ${IMPORT_LIMIT_BYTES} chars).`);
  }

  // Reviver blocks common prototype-pollution keys anywhere in the document.
  return JSON.parse(text, (k, v) => {
    if (k === "__proto__" || k === "constructor" || k === "prototype") return undefined;
    return v;
  });
}

function isPlainObject(x){
  return x !== null && typeof x === "object" && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
}



function mustBeFiniteNumber(x, name){
  if (typeof x !== "number" || !Number.isFinite(x)) throw new Error(`Invalid number: ${name}`);
  return x;
}

function mustBeString(x, name, maxLen = 10_000){
  if (typeof x !== "string") throw new Error(`Invalid string: ${name}`);
  if (x.length > maxLen) throw new Error(`String too long: ${name}`);
  return x;
}

function validateAndSanitizeScene(raw){
  if (!isPlainObject(raw)) throw new Error("Top-level scene must be an object.");

  // Allow either raw Scene or a wrapped payload (see export hardening below).
  const scene = raw.scene && isPlainObject(raw.scene) ? raw.scene : raw;

  if (!isPlainObject(scene.stage)) throw new Error("Missing/invalid stage.");
  if (!Array.isArray(scene.elements)) throw new Error("Missing/invalid elements array.");

  if (scene.elements.length > MAX_ELEMENTS) throw new Error(`Too many elements (> ${MAX_ELEMENTS}).`);
  if (scene.groups && Array.isArray(scene.groups) && scene.groups.length > MAX_GROUPS) {
    throw new Error(`Too many groups (> ${MAX_GROUPS}).`);
  }

  // Stage numeric hygiene + clamps
  const w = clamp(mustBeFiniteNumber(scene.stage.w, "stage.w"), 64, 20000);
  const h = clamp(mustBeFiniteNumber(scene.stage.h, "stage.h"), 64, 20000);
  const gridSize = clamp(mustBeFiniteNumber(scene.stage.gridSize ?? 20, "stage.gridSize"), 1, 1000);
  const snapTol = clamp(mustBeFiniteNumber(scene.stage.snapTol ?? 8, "stage.snapTol"), 0, 500);

  // Optional view/meta/groups defaults
  const meta = isPlainObject(scene.meta) ? scene.meta : {};
  const view = isPlainObject(scene.view) ? scene.view : {};
  const groups = Array.isArray(scene.groups) ? scene.groups : [];

  // Validate elements in a minimally-invasive way.
  // You can expand this per your exact element schema.
  const ids = new Set();
  const elements = scene.elements.map((el, idx) => {
    if (!isPlainObject(el)) throw new Error(`Element[${idx}] must be an object.`);
    const id = mustBeString(el.id ?? "", `elements[${idx}].id`, 200);
    if (!id) throw new Error(`Element[${idx}] missing id.`);
    if (ids.has(id)) throw new Error(`Duplicate element id: ${id}`);
    ids.add(id);

    // Defensive copies + numeric hygiene for common fields.
    // (Adjust keys to your actual schema.)
    const out = {...el};

    if ("x" in out) out.x = mustBeFiniteNumber(out.x, `elements[${idx}].x`);
    if ("y" in out) out.y = mustBeFiniteNumber(out.y, `elements[${idx}].y`);
    if ("w" in out) out.w = clamp(mustBeFiniteNumber(out.w, `elements[${idx}].w`), 1, 50000);
    if ("h" in out) out.h = clamp(mustBeFiniteNumber(out.h, `elements[${idx}].h`), 1, 50000);
    if ("rot" in out) out.rot = clamp(mustBeFiniteNumber(out.rot, `elements[${idx}].rot`), -360000, 360000);

    // Cap any large text payloads (sitelen source, labels, etc.)
    for (const k of ["text", "source", "sitelen", "label", "name"]) {
      if (k in out && typeof out[k] === "string") {
        if (out[k].length > MAX_TEXT_LEN) throw new Error(`Element[${idx}].${k} too long.`);
      }
    }

    return out;
  });

  // Return a sanitized, canonical scene object.
  return {
    meta,
    stage: { ...scene.stage, w, h, gridSize, snapTol },
    view,
    elements,
    groups
  };
}

function exportJson(){
  // Export only the stable, persisted parts.
  const stableScene = {
    meta: deepClone(Scene.meta),
    stage: deepClone(Scene.stage),
    view: deepClone(Scene.view),
    elements: deepClone(Scene.elements),
    groups: deepClone(Scene.groups),
  };

  const payload = { 
    format: "StaticCanvasLayout", 
    version: 2, 
    exportedAt: new Date().toISOString(), 
    scene: stableScene, 
    assets: serializeAssets() 
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  downloadBlob(blob, `layout_${nowIso()}.json`);
  setStatus(tr("status_exported_json"));
}

async function importJsonFromFile(file){
  // Basic file gating (not security, but good hygiene)
  if (!file) throw new Error("No file provided.");
  // File size check removed — embedded audio/video JSON files are legitimately large
  // Optional: if you only want .json
  // if (!/\.json$/i.test(file.name)) throw new Error("Please select a .json file.");

  let txt;
  try {
    txt = await file.text();
  } catch (e) {
    throw new Error("Could not read file.");
  }

  let raw;
  try {
    raw = safeJsonParse(txt);
  } catch (e) {
    throw new Error("Invalid JSON (parse failed).");
  }

  // If you already have normalizeScene(), keep it—but validate afterwards.
  // Support two formats:
  //  (A) Wrapper: { scene: {...}, assets: {...} }
  //  (B) Legacy:  {meta, stage, view, elements, groups, ...}  (scene directly)
  const isWrapper = raw && typeof raw === "object" && raw.scene && typeof raw.scene === "object";

  // If wrapper, load assets FIRST so normalizeScene can migrate/resolve legacy images if needed.
  if (isWrapper){
    try {
      deserializeAssets(raw.assets);
    } catch (e) {
      // If assets are malformed, fail early. Otherwise the scene will reference missing assetIds.
      throw new Error("Invalid assets data (deserialize failed).");
    }
  } else {
    // Legacy import: start with empty assets; normalizeScene may migrate legacy inline images into Assets.
    // (Do not clear Assets here if you want to allow merging imports; most editors expect replace.)
    // If you want replace semantics, uncomment:
    deserializeAssets(null);
  }

  // Normalize scene (wrapper uses raw.scene; legacy uses raw)
  let normalized;
  try {
    normalized = normalizeScene(isWrapper ? raw.scene : raw);
  } catch (e) {
    throw new Error("Invalid scene data (normalize failed).");
  }


  let sanitized;
  try {
    sanitized = validateAndSanitizeScene(normalized);
  } catch (e) {
    throw new Error(`Invalid scene format: ${e.message}`);
  }

  // Commit changes in one place only AFTER validation.
  Scene.meta = sanitized.meta;
  Scene.stage = sanitized.stage;
  Scene.view = sanitized.view;
  Scene.elements = sanitized.elements;
  Scene.groups = sanitized.groups;

  syncStageDefaultsUiFromScene();

  // Clear runtime state
  selectedIds.clear();
  imageCache.clear();
  colorKeyCache.clear();
sitelenCache.clear();
glyphCache.clear();
sitelenRasterJobs.clear();
glyphRasterJobs.clear();
sitelenRendererInstancePromises.clear();

  try {
      await dbPut(DB_KEY, {
        scene: deepClone(Scene),
        assets: serializeAssets()
      });
  } catch (e) {
    // If persistence fails, you may still keep the imported scene in memory,
    // but make the failure explicit.
    setStatus(tr("status_imported_json_db_fail"));
  }

  // Update UI controls with sanitized stage values
  $("stageW").value = String(Scene.stage.w);
  $("stageH").value = String(Scene.stage.h);
  $("gridSize").value = String(Scene.stage.gridSize);
  $("snapTol").value = String(Scene.stage.snapTol);

  setStatus(tr("status_imported_json"));

  // Preload every font needed by the imported scene before first visible draw,
  // so text/sitelen/glyph content appears together instead of trickling in.
  await hydrateSceneBeforeDisplay(Scene);

  // Scrapbook page imports replace the live editor scene, but the document
  // export code reads from the stored page payloads. Commit the imported
  // scene back into the currently selected scrapbook page immediately so PDF,
  // SVG ZIP, PNG ZIP, and HTML export cannot accidentally use the previous
  // page payload for the newly imported page.
  if (typeof ScrapbookState !== 'undefined' && ScrapbookState?.doc) {
    // v27: commit the imported live Scene/Assets directly to the selected
    // scrapbook page before any later export can read doc.pages.  Do not rely on
    // the async thumbnail path to perform the page-payload write.
    commitLiveEditorIntoCurrentScrapbookPageNow({ updateThumb: true });
  }

  updateUiForSelection();
  rebuildDynamicPaletteFromScene();
  fitStageToView();
  render();
  historyReset("Import");

}





function drawAudioLocal(el, x, y, w, h){
  const PAD = 10;
  const ICON_SIZE = Math.min(28, h * 0.45);   // music note box, scales with height
  const ICON_PAD = 8;                           // gap between icon and text
  const RADIUS = Math.min(8, w * 0.04, h * 0.12);

  ctx.save();

  // --- clip to element bounds so nothing spills out ---
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, RADIUS) : ctx.rect(x, y, w, h);
  ctx.clip();

  // --- background fill ---
  if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
    ctx.fillStyle = el.fill;
    ctx.fillRect(x, y, w, h);
  } else {
    // default soft tint so the element is always visible
    ctx.fillStyle = "rgba(240,234,255,0.82)";
    ctx.fillRect(x, y, w, h);
  }

  // --- border ---
  const strokeColor = el.stroke || "rgba(80,60,160,0.45)";
  const strokeW     = (el.strokeW ?? 0) > 0 ? el.strokeW : 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = strokeW;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, RADIUS) : ctx.rect(x, y, w, h);
  ctx.stroke();

  // --- centre content vertically ---
  const cy = y + h / 2;

  // --- music note icon (drawn with canvas paths, no external assets) ---
  const iconX = x + PAD;
  const iconY = cy - ICON_SIZE / 2;
  const ic = ctx.save.bind(ctx);  // just a shorthand alias — we use ctx.save/restore below

  ctx.save();
  ctx.fillStyle   = el.color || "rgba(80,60,160,0.88)";
  ctx.strokeStyle = el.color || "rgba(80,60,160,0.88)";
  ctx.lineWidth   = Math.max(1, ICON_SIZE * 0.09);
  ctx.lineCap     = "round";

  // Scale the note drawing to ICON_SIZE
  const S = ICON_SIZE;
  const nx = iconX;
  const ny = iconY;

  // Stem (vertical line on the right side of the note head)
  ctx.beginPath();
  ctx.moveTo(nx + S * 0.62, ny + S * 0.72);
  ctx.lineTo(nx + S * 0.62, ny + S * 0.18);
  ctx.stroke();

  // Flag (little curl at top of stem)
  ctx.beginPath();
  ctx.moveTo(nx + S * 0.62, ny + S * 0.18);
  ctx.bezierCurveTo(
    nx + S * 0.88, ny + S * 0.22,
    nx + S * 0.88, ny + S * 0.48,
    nx + S * 0.62, ny + S * 0.54
  );
  ctx.stroke();

  // Note head (filled oval)
  ctx.beginPath();
  ctx.ellipse(
    nx + S * 0.44, ny + S * 0.74,
    S * 0.22, S * 0.15,
    -0.4, 0, Math.PI * 2
  );
  ctx.fill();

  ctx.restore();

  // --- filename text, clipped & truncated with ellipsis ---
  const textX     = iconX + ICON_SIZE + ICON_PAD;
  const maxTxtW   = w - PAD - ICON_SIZE - ICON_PAD - PAD;  // right padding too
  const name      = String(el.title || (el.audio && el.audio.origName) || "Audio");
  const fontSize  = Math.max(11, Math.min(15, h * 0.28));

  ctx.fillStyle   = el.color || "#2a1a6e";
  ctx.font        = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign   = "left";

  // Measure and truncate with ellipsis to fit maxTxtW
  let display = name;
  if (maxTxtW > 10) {
    const ellipsis = "…";
    const ellW = ctx.measureText(ellipsis).width;
    if (ctx.measureText(display).width > maxTxtW) {
      // Binary-search the cut point
      let lo = 0, hi = display.length;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (ctx.measureText(display.slice(0, mid)).width + ellW <= maxTxtW) lo = mid;
        else hi = mid;
      }
      display = display.slice(0, lo) + ellipsis;
    }
  }
  ctx.fillText(display, textX, cy);

  ctx.restore();  // removes clip
}

function drawVideoLocal(el, x,y,w,h){
  const posterId = el.posterAssetId;
  if (posterId){
    // Use the dedicated poster cache (same fix as drawUrlLocal — avoids ElementType.Image guard)
    const img = ensureImageLoadedFromAssetId(posterId, el.id + '__vidposter');
    if (img){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        ctx.save(); ctx.fillStyle = el.fill; ctx.fillRect(x,y,w,h); ctx.restore();
      }
      const natW = img.naturalWidth || img.width || w;
      const natH = img.naturalHeight || img.height || h;
      let dx=x, dy=y, dw=w, dh=h;
      if (el.keepAspect){
        const s = Math.min(w/natW, h/natH);
        dw = natW*s; dh = natH*s; dx = x+(w-dw)/2; dy = y+(h-dh)/2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      if ((el.strokeW ?? 0) > 0){ ctx.save(); ctx.lineWidth = el.strokeW; ctx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)'; ctx.strokeRect(x,y,w,h); ctx.restore(); }
      return;
    }
    // Poster asset exists but not yet decoded — fall through to placeholder
  }
  drawMediaCardLocal(el, x, y, w, h, "VIDEO: " + (el.title || (el.video && el.video.origName) || "Video"), (el.video && el.video.origName) || el.sourceUrl || "");
}

function drawUrlLocal(el, x,y,w,h){
  const kind = String((el.url && el.url.detectedKind) || "link");
  const href = String(el.url && el.url.href || "").trim();

  // 1. Best case: embedded poster asset
  const posterId = el.url && el.url.posterAssetId ? el.url.posterAssetId : "";
  if ((kind === "image" || kind === "video") && posterId){
    const img = ensureImageLoadedFromAssetId(posterId, el.id + '__poster');
    if (img){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        ctx.save(); ctx.fillStyle = el.fill; ctx.fillRect(x,y,w,h); ctx.restore();
      }
      const natW = img.naturalWidth || img.width || w;
      const natH = img.naturalHeight || img.height || h;
      let dx=x, dy=y, dw=w, dh=h;
      if (el.keepAspect){
        const s = Math.min(w/natW, h/natH);
        dw = natW*s; dh = natH*s; dx = x+(w-dw)/2; dy = y+(h-dh)/2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      if ((el.strokeW ?? 0) > 0){ ctx.save(); ctx.lineWidth = el.strokeW; ctx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)'; ctx.strokeRect(x,y,w,h); ctx.restore(); }
      return;
    }
  }

  // 2. For YouTube URLs: always derive thumbnail URL live from video ID — never
  //    depend on posterRemoteHref being previously saved. hqdefault.jpg is always
  //    publicly available without CORS restrictions via <img> (no fetch needed).
  if (kind === "video") {
    const ytId = extractYouTubeVideoId(href);
    const remotePosterHref = ytId
      ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      : String(el.url && el.url.posterRemoteHref || "").trim();
    if (remotePosterHref){
      const img = ensureRemotePosterImageLoaded(remotePosterHref);
      if (img){
        if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
          ctx.save(); ctx.fillStyle = el.fill; ctx.fillRect(x,y,w,h); ctx.restore();
        }
        const natW = img.naturalWidth || img.width || w;
        const natH = img.naturalHeight || img.height || h;
        let dx=x, dy=y, dw=w, dh=h;
        if (el.keepAspect){
          const s = Math.min(w / natW, h / natH);
          dw = natW * s; dh = natH * s; dx = x + (w - dw)/2; dy = y + (h - dh)/2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        if ((el.strokeW ?? 0) > 0){ ctx.save(); ctx.lineWidth = (el.strokeW ?? 1); ctx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)'; ctx.strokeRect(x,y,w,h); ctx.restore(); }
        return;
      }
      // Not ready yet — render() will be called again once the image loads
      return; // show nothing rather than placeholder while loading
    }
  }

  // 3. Non-YouTube image URL with saved remote poster
  if (kind === "image") {
    const remotePosterHref = String(el.url && el.url.posterRemoteHref || "").trim();
    if (remotePosterHref){
      const img = ensureRemotePosterImageLoaded(remotePosterHref);
      if (img){
        if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
          ctx.save(); ctx.fillStyle = el.fill; ctx.fillRect(x,y,w,h); ctx.restore();
        }
        const natW = img.naturalWidth || img.width || w;
        const natH = img.naturalHeight || img.height || h;
        let dx=x, dy=y, dw=w, dh=h;
        if (el.keepAspect){
          const s = Math.min(w / natW, h / natH);
          dw = natW * s; dh = natH * s; dx = x + (w - dw)/2; dy = y + (h - dh)/2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        if ((el.strokeW ?? 0) > 0){ ctx.save(); ctx.lineWidth = (el.strokeW ?? 1); ctx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)'; ctx.strokeRect(x,y,w,h); ctx.restore(); }
        return;
      }
    }
  }

  drawMediaCardLocal(el, x, y, w, h, kind.toUpperCase() + ": URL", href);
}

  function drawElementToOffscreen(octx, el, forExport = false){
    // Skip media elements flagged as export-invisible — but always draw for thumbnails
    const _isMediaEl = el.type === ElementType.Audio || el.type === ElementType.Video || el.type === ElementType.Url;
    if (forExport && _isMediaEl && el.exportVisible === false) return;

    octx.save();
    octx.globalAlpha = clamp(el.opacity ?? 1, 0, 1);

    const cx = el.x + el.w/2;
    const cy = el.y + el.h/2;

    octx.translate(cx, cy);
    octx.rotate(rad(el.rotationDeg || 0));

    const x = -el.w/2;
    const y = -el.h/2;

    if (el.type === ElementType.Rect){
      // Rect
      const r = el.radius ?? 0;

      if (el.fillEnabled && el.fill && el.fill !== "transparent"){
        octx.fillStyle = el.fill;
        roundedRectPathOff(octx, x,y,el.w,el.h,r);
        octx.fill();
      }

      // NEW: halo behind stroke
      const haloW = effectiveHaloThicknessForElementExport(el);
      if (haloW > 0){
        octx.lineWidth = haloW;
        octx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
        octx.lineJoin = "round";
        octx.miterLimit = 2;
        roundedRectPathOff(octx, x,y,el.w,el.h,r);
        octx.stroke();
      }

      
      
      if ((el.strokeW ?? 0) > 0){
        octx.lineWidth = (el.strokeW ?? 1);
        octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
        roundedRectPathOff(octx, x,y,el.w,el.h,r);
        octx.stroke();
      }
    } else if (el.type === ElementType.Text){
      // Text
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle = el.fill;
        octx.fillRect(x,y,el.w,el.h);
      }
      
      const pad = 8;
      const innerX = x + pad;
      const innerY = y + pad;
      const innerW = Math.max(0, el.w - pad*2);
      const innerH = Math.max(0, el.h - pad*2);

      const fontSize = Math.max(6, (el.fontSize ?? 24));
      const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
      const lineHeight = Math.max(0.8, el.lineHeight ?? 1.15);

      octx.fillStyle = el.color || "#111111";
      octx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
      octx.textBaseline = "top";

      let textAlign = (el.align || "left");
      if (textAlign !== "left" && textAlign !== "center" && textAlign !== "right") textAlign = "left";
      octx.textAlign = textAlign;

      // NEW: halo config for Text export
      const haloW = effectiveHaloThicknessForElementExport(el);
      if (haloW > 0){
        octx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
        octx.lineWidth = haloW;
        octx.lineJoin = "round";
        octx.miterLimit = 2;
      }

      const rawLines = splitLinesForBox((el.type === ElementType.Sitelen) ? prepareSitelenInputWithActiveCartoucheDb(el.text) : el.text);
      const allLines = [];
      for (const ln0 of rawLines){
        const ln = (el.type === ElementType.Sitelen) ? renderSitelenLineToCanvasText(ln0) : String(ln0 ?? "");
        const wrapped = wrapLine(octx, ln, innerW);
        for (const wln of wrapped) allLines.push(wln);
      }

      const lhPx = fontSize * lineHeight;
      let ty = innerY;
      for (const ln of allLines){
        if (ty + lhPx > innerY + innerH + 0.5) break;
        let tx = innerX;
        if (textAlign === "center") tx = innerX + innerW/2;
        if (textAlign === "right") tx = innerX + innerW;

        if (haloW > 0) octx.strokeText(ln, tx, ty);
        octx.fillText(ln, tx, ty);

        // octx.fillText(ln, tx, ty);
        ty += lhPx;
      }

      if ((el.strokeW ?? 0) > 0){
        octx.lineWidth = (el.strokeW ?? 1);
        octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
        octx.strokeRect(x,y,el.w,el.h);
      }
    } else if (el.type === ElementType.Sitelen){
      const entry = ensureSitelenRaster(el);
      if (entry && entry.canvas){
        
        if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
          octx.fillStyle = el.fill;
          octx.fillRect(x,y,el.w,el.h);
        }

        // draw like image into the offscreen export, scaled to el.w/el.h
        octx.drawImage(entry.canvas, x, y, el.w, el.h);


        if ((el.strokeW ?? 0) > 0){
          octx.lineWidth = (el.strokeW ?? 1);
          octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
          octx.strokeRect(x,y,el.w,el.h);
        }
      } else {
        // placeholder if raster missing
        octx.setLineDash([6,4]);
        octx.strokeRect(x+1,y+1,el.w-2,el.h-2);
        octx.setLineDash([]);
      }

    } else if (el.type === ElementType.Glyph){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle = el.fill;
        octx.fillRect(x,y,el.w,el.h);
      }

      const cp = parseCodepointInput(el.codepoint);
      const ch = (typeof cp === "number") ? String.fromCodePoint(cp) : "?";
      const fontSize = Math.max(6, (el.fontSize ?? 64));
      const fontFamily = getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT;
      const cx2 = x + el.w/2;
      const cy2 = y + el.h/2;

      octx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
      octx.textBaseline = "middle";
      octx.textAlign = "center";

      const haloW = effectiveHaloThicknessForElementExport(el);
      if (haloW > 0){
        octx.strokeStyle = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
        octx.lineWidth = haloW;
        octx.lineJoin = "round";
        octx.miterLimit = 2;
        octx.strokeText(ch, cx2, cy2);
      }

      octx.fillStyle = el.color;
      octx.fillText(ch, cx2, cy2);

      if ((el.strokeW ?? 0) > 0){
        octx.lineWidth = (el.strokeW ?? 1);
        octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
        octx.strokeRect(x,y,el.w,el.h);
      }
    } else if (el.type === ElementType.Image){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle = el.fill;
        octx.fillRect(x,y,el.w,el.h);
      }
      // Use the shared imageCache — never allocate a throwaway Image() here.
      const img = ensureImageLoadedForElement(el);
      if (img){
        const ck = ensureColorKeyRaster(el, img);
        const drawable = (ck && ck.canvas) ? ck.canvas : img;
        octx.drawImage(drawable, x, y, el.w, el.h);
      } else {
        octx.strokeStyle = "rgba(17,17,17,0.28)";
        octx.lineWidth = 2;
        octx.setLineDash([6,4]);
        octx.strokeRect(x+1,y+1,el.w-2,el.h-2);
        octx.setLineDash([]);
      }
      if ((el.strokeW ?? 0) > 0){
        octx.lineWidth = (el.strokeW ?? 1);
        octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
        octx.strokeRect(x,y,el.w,el.h);
      }

    } else if (el.type === ElementType.Audio){
      // Audio: draw the same styled card as the live canvas
      // (exportVisible guard already handled above — if we reach here, draw it)
      _drawAudioOffscreen(octx, el, x, y, el.w, el.h);

    } else if (el.type === ElementType.Video){
      // Video: draw poster image if available, otherwise media card
      _drawVideoOffscreen(octx, el, x, y, el.w, el.h);

    } else if (el.type === ElementType.Url){
      // Url: draw poster image if available, otherwise media card
      _drawUrlOffscreen(octx, el, x, y, el.w, el.h);
    }

    octx.restore();
  }

  // ── Offscreen helpers for media elements ──────────────────────────────────
  // These mirror the live-canvas draw functions but use octx instead of ctx,
  // and load images synchronously from asset data URLs (no cache needed).

  function _drawPosterImageOffscreen(octx, posterId, el, x, y, w, h){
    const dataUrl = getAssetDataUrl(posterId);
    if (!dataUrl) return false;
    // Use the shared posterAssetImageCache so we get a fully-decoded image,
    // not a brand-new Image() that may not be complete yet on slower machines.
    const cacheKey = el.id + (el.url ? '__poster' : '__vidposter');
    const img = ensureImageLoadedFromAssetId(posterId, cacheKey);
    if (!img) return false;
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      octx.fillStyle = el.fill; octx.fillRect(x, y, w, h);
    }
    let dx = x, dy = y, dw = w, dh = h;
    if (el.keepAspect !== false){
      const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      dw = img.naturalWidth * s; dh = img.naturalHeight * s;
      dx = x + (w - dw) / 2; dy = y + (h - dh) / 2;
    }
    octx.drawImage(img, dx, dy, dw, dh);
    if ((el.strokeW ?? 0) > 0){
      octx.lineWidth = el.strokeW; octx.strokeStyle = el.stroke || "rgba(17,17,17,0.35)";
      octx.strokeRect(x, y, w, h);
    }
    return true;
  }

  function _drawMediaCardOffscreen(octx, el, x, y, w, h, label){
    const RADIUS = Math.min(8, w * 0.04, h * 0.12);
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      octx.fillStyle = el.fill; octx.fillRect(x, y, w, h);
    }
    octx.strokeStyle = el.stroke || "rgba(17,17,17,0.28)";
    octx.lineWidth = (el.strokeW ?? 0) > 0 ? el.strokeW : 1.5;
    octx.strokeRect(x, y, w, h);
    octx.fillStyle = el.color || "#111111";
    octx.font = `${Math.max(11, Math.min(14, h * 0.22))}px system-ui, sans-serif`;
    octx.textBaseline = "middle"; octx.textAlign = "left";
    // Simple truncation for offscreen
    let text = label;
    const maxW = w - 16;
    if (maxW > 10 && octx.measureText(text).width > maxW){
      while (text.length > 1 && octx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
      text += "…";
    }
    octx.fillText(text, x + 8, y + h / 2);
  }

  function _drawAudioOffscreen(octx, el, x, y, w, h){
    const name = String(el.title || (el.audio && el.audio.origName) || "Audio");
    _drawMediaCardOffscreen(octx, el, x, y, w, h, "♪ " + name);
  }

  function _drawVideoOffscreen(octx, el, x, y, w, h){
    const posterId = el.posterAssetId;
    if (posterId && _drawPosterImageOffscreen(octx, posterId, el, x, y, w, h)) return;
    _drawMediaCardOffscreen(octx, el, x, y, w, h, "▶ " + (el.title || (el.video && el.video.origName) || "Video"));
  }

  function _drawUrlOffscreen(octx, el, x, y, w, h){
    const kind = String((el.url && el.url.detectedKind) || "link");
    const href = String(el.url && el.url.href || "").trim();
    const posterId = el.url && el.url.posterAssetId ? el.url.posterAssetId : "";

    // 1. Embedded poster asset
    if (posterId && _drawPosterImageOffscreen(octx, posterId, el, x, y, w, h)) return;

    // 2. Remote poster — always derive YouTube URL live from video ID.
    // Only draw remote poster on the live canvas. For any offscreen/export canvas,
    // only posterAssetId (a local data URL asset) is safe — remote images from
    // i.ytimg.com have no CORS headers and will taint the canvas.
    // YouTube video: fall through to standard media card (thumbnail not available for export)
    const isYouTube = kind === "video" && !!extractYouTubeVideoId(href);
    if (isYouTube) {
      const label = "▶ " + (href || "URL");
      _drawMediaCardOffscreen(octx, el, x, y, w, h, label);
      return;
    }

    // 3. Non-YouTube URL: render the full href wrapped & fitted within the bounding box.
    //    Priority: normal size wrapped → shrink to MIN_FONT_PX wrapped → spill downward (never clip width).
    const MIN_FONT_PX = 10;
    const NORMAL_FONT_PX = Math.max(MIN_FONT_PX + 1, Math.min(14, h * 0.18));
    const PAD_X = 10;
    const PAD_Y = 10;
    const maxTextW = Math.max(20, w - PAD_X * 2);
    const icon = kind === "image" ? "🖼 " : "🔗 ";
    const displayText = icon + (href || "URL");

    // Helper: wrap text at a given font size, returns array of line strings
    function wrapAtSize(fontSize) {
      octx.font = `${fontSize}px system-ui, sans-serif`;
      const lineH = fontSize * 1.35;
      const lines = [];
      // Split on spaces but also allow breaking long unspaced strings (e.g. bare URLs)
      // by character-level fallback when a single word exceeds maxTextW
      const words = displayText.split(" ");
      let cur = "";
      for (const word of words) {
        const test = cur ? cur + " " + word : word;
        if (octx.measureText(test).width <= maxTextW || !cur) {
          // Check if the word itself exceeds maxTextW (no spaces to break on)
          if (!cur && octx.measureText(word).width > maxTextW) {
            // Character-level wrap for this word
            let charBuf = "";
            for (const ch of word) {
              const t = charBuf + ch;
              if (octx.measureText(t).width > maxTextW && charBuf) {
                lines.push(charBuf);
                charBuf = ch;
              } else {
                charBuf = t;
              }
            }
            cur = charBuf;
          } else {
            cur = test;
          }
        } else {
          lines.push(cur);
          cur = word;
        }
      }
      if (cur) lines.push(cur);
      return { lines, lineH };
    }

    // Try normal size first, then minimum
    let { lines, lineH } = wrapAtSize(NORMAL_FONT_PX);
    const totalHNormal = lines.length * lineH + PAD_Y * 2;
    let chosenFontSize = NORMAL_FONT_PX;
    if (totalHNormal > h) {
      // Try minimum font size
      const min = wrapAtSize(MIN_FONT_PX);
      lines = min.lines;
      lineH = min.lineH;
      chosenFontSize = MIN_FONT_PX;
    }

    // Draw background fill + border (respects element styling)
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)") {
      octx.fillStyle = el.fill;
      octx.fillRect(x, y, w, h);
    }
    octx.save();
    octx.strokeStyle = el.stroke || "rgba(17,17,17,0.28)";
    octx.lineWidth = (el.strokeW ?? 0) > 0 ? el.strokeW : 1.5;
    octx.strokeRect(x, y, w, h);

    // Draw lines — spill downward past bounding box bottom if needed, never clip width
    octx.fillStyle = el.color || "#111111";
    octx.font = `${chosenFontSize}px system-ui, sans-serif`;
    octx.textBaseline = "top";
    octx.textAlign = "left";
    let ty = y + PAD_Y;
    for (const ln of lines) {
      octx.fillText(ln, x + PAD_X, ty);
      ty += lineH;
    }
    octx.restore();
  }
  // ─────────────────────────────────────────────────────────────────────────

  async function exportPngTransparent(){
    await awaitAllRendererRastersReady();

    // Create offscreen canvas at exact stage size (no background fill => transparent)
    const off = document.createElement("canvas");
    off.width = Scene.stage.w;
    off.height = Scene.stage.h;
    const octx = off.getContext("2d");

    //do we draw the Scene background on export
    if(Scene.stage.exportStageBackground === true){
      octx.save();
      // NEW: stage background from scene
      octx.fillStyle = Scene.stage.bg || DEFAULTS.stageBg;
      octx.fillRect(0, 0, Scene.stage.w, Scene.stage.h);
      octx.restore();
    }


    // NEW: background image export (independent of exportStageBackground)
    if (Scene.stage.bgImgEnabled && Scene.stage.bgImgAssetId){
      const assetId = String(Scene.stage.bgImgAssetId);
      const dataUrl = getImageAssetDataUrl(assetId);
      if (dataUrl){
        // Prefer decoded cache if available
        let img = (bgImageCache.ready && bgImageCache.assetId === assetId) ? bgImageCache.img : null;
        if (!img){
          img = new Image();
          img.src = dataUrl;
        }

        if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
          const dest = computeBackgroundImageDestRect({
            stageW: Scene.stage.w,
            stageH: Scene.stage.h,
            natW: img.naturalWidth,
            natH: img.naturalHeight,
            stretch: !!Scene.stage.bgImgStretch,
            keepAspect: (Scene.stage.bgImgKeepAspect !== false),
          });

          octx.save();
          octx.beginPath();
          octx.rect(0, 0, Scene.stage.w, Scene.stage.h);
          octx.clip();
          octx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
          octx.restore();
        }
      }
    }


    // Render scene at 1:1 stage coords (no view transforms)
    // Note: We do NOT draw grid or stage background for export.
    for (const el of Scene.elements){
      drawElementToOffscreen(octx, el, true /* forExport */);
    }

    off.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `layout_${nowIso()}.png`);
      setStatus(tr("status_exported_png"));
    }, "image/png");
  }

  function roundedRectPathOff(octx, x,y,w,h,r){
    const rr = Math.max(0, Math.min(r, w/2, h/2));
    octx.beginPath();
    octx.moveTo(x+rr, y);
    octx.arcTo(x+w, y, x+w, y+h, rr);
    octx.arcTo(x+w, y+h, x, y+h, rr);
    octx.arcTo(x, y+h, x, y, rr);
    octx.arcTo(x, y, x+w, y, rr);
    octx.closePath();
  }

  /* ============================================================
     Media Guard Dialog
     ============================================================ */
  const MEDIA_GUARD_CONFIG = {
    image: {
      icon: '🖼️',
      title: 'Adding an Image',
      body: 'Embedding an image stores its full data inside the scrapbook file. A single high-resolution photo can add several megabytes, and multiple images can make the file significantly larger — which may affect save times and sharing.'
    },
    audio: {
      icon: '🎵',
      title: 'Adding Audio',
      body: 'Embedding audio stores the entire file inside your scrapbook. Even short audio clips can add many megabytes to the document size, which may affect save times, performance, and sharing.'
    },
    video: {
      icon: '🎬',
      title: 'Adding a Video',
      body: 'Embedding a video stores the full file inside your scrapbook. Videos can be very large — even a short clip may add tens of megabytes — which can significantly increase save times and make the document difficult to share.'
    }
  };

  function showMediaGuard(type, tool) {
    const guards = ScrapbookState?.doc?.settings?.mediaGuards;
    if (!guards || guards[type] === false) { setTool(tool); return; }

    const cfg      = MEDIA_GUARD_CONFIG[type];
    const overlay  = document.getElementById('mediaGuardOverlay');
    const icon     = document.getElementById('mediaGuardIcon');
    const title    = document.getElementById('mediaGuardTitle');
    const body     = document.getElementById('mediaGuardBody');
    const checkbox = document.getElementById('mediaGuardDontShow');
    const btnCancel    = document.getElementById('mediaGuardBtnCancel');
    const btnContinue  = document.getElementById('mediaGuardBtnContinue');

    icon.textContent  = cfg.icon;
    title.textContent = cfg.title;
    body.textContent  = cfg.body;
    checkbox.checked  = false;

    overlay.classList.add('open');
    btnContinue.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    }
    overlay.addEventListener('keydown', onKeyDown, true);

    function close() {
      overlay.classList.remove('open');
      overlay.removeEventListener('keydown', onKeyDown, true);
      btnCancel.onclick    = null;
      btnContinue.onclick  = null;
      overlay.onclick      = null;
    }

    btnCancel.onclick = () => close();
    overlay.onclick   = (e) => { if (e.target === overlay) close(); };

    btnContinue.onclick = () => {
      if (checkbox.checked && ScrapbookState?.doc?.settings?.mediaGuards) {
        ScrapbookState.doc.settings.mediaGuards[type] = false;
        debounceScrapbookSave();
      }
      close();
      setTool(tool);
    };
  }

  /* ============================================================
     Controls and buttons
     ============================================================ */
  $("toolSelect").addEventListener("click", () => setTool(Tool.Select));
  $("toolText").addEventListener("click", () => setTool(Tool.Text));
  $("toolSitelen").addEventListener("click", () => setTool(Tool.Sitelen));
  $("toolGlyph").addEventListener("click", () => setTool(Tool.Glyph));
  $("toolRect").addEventListener("click", () => setTool(Tool.Rect));
  $("toolImage").addEventListener("click", () => showMediaGuard("image", Tool.Image));
  $("toolAudio").addEventListener("click", () => showMediaGuard("audio", Tool.Audio));
  $("toolVideo").addEventListener("click", () => showMediaGuard("video", Tool.Video));
  $("toolUrl").addEventListener("click", () => setTool(Tool.Url));

  $("toolDelete").addEventListener("click", () => {
  if (anySelected()){
    deleteSelection();     // this is where confirm happens
    setTool(Tool.Select);  // return to normal tool
  } else {
    setTool(Tool.Delete);  // no selection: use click-to-delete mode
  }
});


  $("toolPan").addEventListener("click", () => setTool(Tool.Pan));

  $("btnGroup").addEventListener("click", () => groupSelection());
  $("btnUngroup").addEventListener("click", () => ungroupSelection());

  $("btnBringFwd").addEventListener("click", () => bringForwardZ());
  $("btnSendBack").addEventListener("click", () => sendBackwardZ());

$("btnNew").addEventListener("click", async () => {
  // CHANGE HERE: prevent accidental clearing
  const hasAnything =
    (Array.isArray(Scene.elements) && Scene.elements.length > 0) ||
    (Scene.groups && typeof Scene.groups === "object" && Object.keys(Scene.groups).length > 0);

  if (hasAnything){
    const ok = window.confirm(tr("confirm_clear"));
    if (!ok) return;
  }

  Scene.stage.bg = DEFAULTS.stageBg;
  Scene.stage.exportStageBackground = DEFAULTS.exportStageBackground;
  Scene.stage.defaultRenderFontPreset = DEFAULTS.defaultRenderFontPreset;
  Scene.stage.defaultTextFontOption = DEFAULTS.defaultTextFontOption;
  Scene.stage.defaultSpacingPreset = DEFAULTS.defaultSpacingPreset;
  Scene.stage.defaultTextColor = DEFAULTS.defaultTextColor;
  Scene.stage.defaultIgnoreUnknownText = DEFAULTS.defaultIgnoreUnknownText;
  Scene.stage.defaultFill = DEFAULTS.defaultFill;
  Scene.stage.defaultFillEnabled = DEFAULTS.defaultFillEnabled;
  Scene.stage.defaultStroke = DEFAULTS.defaultStroke;
  Scene.stage.defaultStrokeW = DEFAULTS.defaultStrokeW;

  Scene.stage.bgImgEnabled = DEFAULTS.bgImgEnabled;
  Scene.stage.bgImgAssetId = DEFAULTS.bgImgAssetId;
  Scene.stage.bgImgKeepAspect = DEFAULTS.bgImgKeepAspect;
  Scene.stage.bgImgStretch = DEFAULTS.bgImgStretch;
  invalidateBackgroundImageCache();

  Scene.elements = [];
  Scene.groups = {};
  selectedIds.clear();
  imageCache.clear();
  colorKeyCache.clear();
sitelenCache.clear();
glyphCache.clear();
sitelenRasterJobs.clear();
glyphRasterJobs.clear();
sitelenRendererInstancePromises.clear();

if (APP_VECTOR_DEBUG) console.log("New Scene "+ JSON.stringify(Scene));

  scheduleAutosave();
  syncStageDefaultsUiFromScene();
  updateUiForSelection();

  render();
  historyReset("New");
  resetDynamicSwatches();

  clearScrapbookSearchState();
  setStatus(tr("status_cleared"));
});


  $("btnExportJson").addEventListener("click", () => { void runExportGuarded('page-json', async () => { exportJson(); }); });
$("btnImportJson").addEventListener("click", () => {
  const inp = $("fileImportJson");
  inp.value = "";          // IMPORTANT: allow re-selecting the same file
  inp.click();
});

$("fileImportJson").addEventListener("change", async () => {
  const inp = $("fileImportJson");
  const f = inp.files && inp.files[0];
  if (!f) return;

  try{
    if (editorHasMeaningfulContent()){
      const confirmed = await confirmDialog(
        'Replace current page?',
        'The current page has content that will be replaced by the imported JSON. This cannot be undone.',
        'Replace page'
      );
      if (!confirmed){ inp.value = ''; return; }
    }
    await importJsonFromFile(f);
  }catch(err){
    console.error(err);
    setStatus(tr("status_import_failed", (err && err.message ? err.message : String(err))));
  } finally {
    inp.value = "";        // optional: makes repeated imports reliable
  }
});

  function docHasYouTubeUrls(){
    const pages = ScrapbookState?.doc?.pages || [];
    for (const page of pages){
      const els = page?.payload?.scene?.elements || [];
      for (const el of els){
        if (el.type === 'url' && el.url && extractYouTubeVideoId(String(el.url.href || ''))){
          return true;
        }
      }
      if (page.id === ScrapbookState?.currentPageId){
        for (const el of (Scene.elements || [])){
          if (el.type === 'url' && el.url && extractYouTubeVideoId(String(el.url.href || ''))){
            return true;
          }
        }
      }
    }
    return false;
  }

  function showYoutubeExportInfo(exportType, onContinue){
    const info = ScrapbookState?.doc?.settings?.youtubeExportInfo;
    if (!docHasYouTubeUrls() || (info && info[exportType] === false)){
      onContinue();
      return;
    }

    const overlay  = document.getElementById('mediaGuardOverlay');
    const icon     = document.getElementById('mediaGuardIcon');
    const title    = document.getElementById('mediaGuardTitle');
    const body     = document.getElementById('mediaGuardBody');
    const checkbox = document.getElementById('mediaGuardDontShow');
    const btnCancel    = document.getElementById('mediaGuardBtnCancel');
    const btnContinue  = document.getElementById('mediaGuardBtnContinue');

    icon.textContent  = '⚠️';
    title.textContent = 'YouTube Poster Images';
    body.textContent  = 'This scrapbook contains YouTube video links. YouTube poster images may not appear correctly on the first export attempt due to network restrictions. If thumbnails are missing, try exporting again — they usually appear after one or two attempts.';
    checkbox.checked  = false;

    btnCancel.style.display = 'none';
    btnContinue.textContent = 'Continue';

    overlay.classList.add('open');
    btnContinue.focus();

    function onKeyDown(e){
      if (e.key === 'Escape'){ e.stopPropagation(); close(true); }
    }
    overlay.addEventListener('keydown', onKeyDown, true);

    function close(proceed){
      overlay.classList.remove('open');
      overlay.removeEventListener('keydown', onKeyDown, true);
      btnCancel.style.display = '';
      btnContinue.textContent = 'Continue';
      btnContinue.onclick = null;
      overlay.onclick = null;
    }

    btnContinue.onclick = () => {
      if (checkbox.checked && ScrapbookState?.doc?.settings?.youtubeExportInfo){
        ScrapbookState.doc.settings.youtubeExportInfo[exportType] = false;
        debounceScrapbookSave();
      }
      close(true);
      onContinue();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay){ btnContinue.onclick(); }
    };
  }

  // Single-page PNG export: only check the current page (live scene) for YouTube URLs
  function currentPageHasYouTubeUrls(){
    for (const el of (Scene.elements || [])){
      if (el.type === 'url' && el.url && extractYouTubeVideoId(String(el.url.href || ''))){
        return true;
      }
    }
    return false;
  }

  $("btnExportPng").addEventListener("click", () => {
    const info = ScrapbookState?.doc?.settings?.youtubeExportInfo;
    if (currentPageHasYouTubeUrls() && (!info || info.pngSingle !== false)){
      showYoutubeExportInfo('pngSingle', () => {
        void runExportGuarded('page-png', async () => { await exportPngTransparent(); });
      });
    } else {
      void runExportGuarded('page-png', async () => { await exportPngTransparent(); });
    }
  });

  // Stage toggles
  function setPressed(btn, pressed){
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  }

  $("btnGrid").addEventListener("click", () => {
    Scene.stage.showGrid = !Scene.stage.showGrid;
    setPressed($("btnGrid"), Scene.stage.showGrid);
    scheduleAutosave(); render();
  });

  $("btnSnapGrid").addEventListener("click", () => {
    Scene.stage.snapGrid = !Scene.stage.snapGrid;
    setPressed($("btnSnapGrid"), Scene.stage.snapGrid);
    scheduleAutosave(); render();
  });

  $("btnSnapObjs").addEventListener("click", () => {
    Scene.stage.snapObjects = !Scene.stage.snapObjects;
    setPressed($("btnSnapObjs"), Scene.stage.snapObjects);
    scheduleAutosave(); render();
  });

  $("stageW").addEventListener("input", () => {
    const v = Number($("stageW").value);
    if (!Number.isFinite(v) || v < 64) return;
    Scene.stage.w = v;
    scheduleAutosave(); render();
  });
  $("stageH").addEventListener("input", () => {
    const v = Number($("stageH").value);
    if (!Number.isFinite(v) || v < 64) return;
    Scene.stage.h = v;
    scheduleAutosave(); render();
  });
  $("gridSize").addEventListener("input", () => {
    const v = Number($("gridSize").value);
    if (!Number.isFinite(v) || v < 2) return;
    Scene.stage.gridSize = v;
    scheduleAutosave(); render();
  });
  $("snapTol").addEventListener("input", () => {
    const v = Number($("snapTol").value);
    if (!Number.isFinite(v) || v < 1) return;
    Scene.stage.snapTol = v;
    scheduleAutosave(); render();
  });


function wireSnapButtons(){
  const bGrid = document.getElementById("btnSnapGrid");
  const bObjs = document.getElementById("btnSnapObjs");
  if (!bGrid || !bObjs) return;

  bGrid.addEventListener("click", () => {
    Scene.stage = Scene.stage || {};
    Scene.stage.snapGrid = !Scene.stage.snapGrid;
    syncSnapButtonsFromScene();
    render();
    saveToLocal?.();
  });

  bObjs.addEventListener("click", () => {
    Scene.stage = Scene.stage || {};
    Scene.stage.snapObjects = !Scene.stage.snapObjects;
    syncSnapButtonsFromScene();
    render();
    saveToLocal?.();
  });
}



function wireStageDefaultsUi(){
  const bg = document.getElementById("stageBg");
  const expbg = document.getElementById("exportStageBackground");
  const dtfo = document.getElementById("defTextFontOption");
  const danc = document.getElementById("defAbbreviateNumericCartouches");
  const dpcar = document.getElementById("defPreserveCenterOnAutoResize");
  const dsp = document.getElementById("defSpacingPreset");
  const dt = document.getElementById("defTextColor");
  const df = document.getElementById("defFill");
  const dfe = document.getElementById("defFillEnabled");
  const ds = document.getElementById("defStroke");
  const dsw = document.getElementById("defStrokeW");
  const diut = document.getElementById("defIgnoreUnknownText");
  const dhe = document.getElementById("defHaloEnabled");
  const dhc = document.getElementById("defHaloColor");
  const dht = document.getElementById("defHaloThickness");
  const bge = document.getElementById("bgImgEnabled");
  const bgka = document.getElementById("bgImgKeepAspect");
  const bgs = document.getElementById("bgImgStretch");
  const btnPickBg = document.getElementById("btnPickBgImage");
  const btnClearBg = document.getElementById("btnClearBgImage");
  const btnResizeStageToBg = document.getElementById("btnResizeStageToBg");
  const drfp = document.getElementById("defRenderFontPreset");



  let bgTimer = null;
  if (bg){
    if (APP_VECTOR_DEBUG) console.log("Define stage bg listeners");
    bg.addEventListener("input", (e) => {
      if (bgTimer) clearTimeout(bgTimer);   // cancel pending render
      bgTimer = setTimeout(() => {          // schedule a render shortly after last input
        if (APP_VECTOR_DEBUG) console.log("Define stage bg listener input");
        Scene.stage.bg = e.target.value;
        render();
        bgTimer = null;
      }, 60); // adjust debounce delay (e.g. 40–120)

      
    });
    bg.addEventListener("change", (e) => {
      if (bgTimer) clearTimeout(bgTimer);   // cancel pending render
      if (APP_VECTOR_DEBUG) console.log("Define stage bg listener change " + e.target.value);
      Scene.stage.bg = e.target.value;
      addDynamicSwatch(e.target.value);   // <--- add this
      scheduleAutosave();
      render();
    });
  }

   if (expbg){
    if (APP_VECTOR_DEBUG) console.log("Define stage export background expbg listener");
    expbg.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage export background expbg listener change "+ !!e.target.checked);
      Scene.stage.exportStageBackground = !!e.target.checked;
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_fill_enabled_updated"));
    });
  }

  if (drfp){
    drfp.addEventListener("change", async (e) => {
      Scene.stage.defaultRenderFontPreset = normalizeRenderFontPresetKey(e.target.value);
      Scene.stage.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(
        dtfo?.value || Scene.stage.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
        Scene.stage.defaultRenderFontPreset
      );

      stageFontPairController.setActivePreset(Scene.stage.defaultRenderFontPreset, { persist: false });
      stageFontPairController.setSelectedTextFontOption(Scene.stage.defaultTextFontOption, { persist: false });

      await waitForRenderPresetFonts(
        Scene.stage.defaultRenderFontPreset,
        56,
        resolveTextFontFamilyForPreset(
          Scene.stage.defaultTextFontOption,
          Scene.stage.defaultRenderFontPreset
        )
      );

      scheduleAutosave();
      render();
    });
  }

  if (dtfo){
    dtfo.addEventListener("change", async (e) => {
      Scene.stage.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(
        e.target.value,
        Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
      );

      stageFontPairController.setSelectedTextFontOption(Scene.stage.defaultTextFontOption, { persist: false });

      await waitForRenderPresetFonts(
        Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset,
        56,
        resolveTextFontFamilyForPreset(
          Scene.stage.defaultTextFontOption,
          Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset
        )
      );

      scheduleAutosave();
      render();
    });
  }

  if (danc){
    danc.addEventListener("change", (e) => {
      Scene.stage.defaultAbbreviateNumericCartouches = !!e.target.checked;
      scheduleAutosave();
      render();
    });
  }

  if (dpcar){
    dpcar.addEventListener("change", (e) => {
      Scene.stage.defaultPreserveCenterOnAutoResize = !!e.target.checked;
      scheduleAutosave();
      render();
    });
  }

  if (dsp){
    dsp.addEventListener("change", () => {
      Scene.stage.defaultSpacingPreset = normalizeSpacingPreset(dsp.value);
      scheduleAutosave();
      render();
    });
  }
  
  if (dt){
    if (APP_VECTOR_DEBUG) console.log("Define stage dt listener");
    dt.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage dt listener change "+ e.target.value);
      Scene.stage.defaultTextColor = e.target.value;
      addDynamicSwatch(e.target.value);   // <--- add this
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_text_updated"));
    });
  }

  if (diut){
    diut.addEventListener("change", (e) => {
      Scene.stage.defaultIgnoreUnknownText = !!e.target.checked;
      scheduleAutosave();
      render();
    });
  }

  // NEW: scene-wide halo defaults
  if (dhe){
    dhe.addEventListener("change", (e) => {
      Scene.stage.defaultHaloEnabled = !!e.target.checked;
      scheduleAutosave();
      render();
    });
  }
  if (dhc){
    dhc.addEventListener("change", (e) => {
      Scene.stage.defaultHaloColor = e.target.value;
      addDynamicSwatch(e.target.value);
      scheduleAutosave();
      render();
    });
  }
  if (dht){
    dht.addEventListener("change", (e) => {
      const v = clampHaloThicknessPx(e.target.value);
      // 0 means auto defaults
      if (v <= 0){
        Scene.stage.defaultHaloThicknessMode = "auto";
        Scene.stage.defaultHaloThicknessPx = 0;
      } else {
        Scene.stage.defaultHaloThicknessMode = "manual";
        Scene.stage.defaultHaloThicknessPx = v;
      }
      scheduleAutosave();
      render();
    });
  }

  if (dfe){
    if (APP_VECTOR_DEBUG) console.log("Define stage dfe listener");
    dfe.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage dfe listener change "+ !!e.target.checked);
      Scene.stage.defaultFillEnabled = !!e.target.checked;
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_fill_enabled_updated"));
    });
  }

  if (df){
    if (APP_VECTOR_DEBUG) console.log("Define stage df listener");
    df.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage df listener change "+ e.target.value);
      // store as rgba with alpha=1 for consistency with your element fill strings
      Scene.stage.defaultFill = e.target.value;
      addDynamicSwatch(e.target.value);   // <--- add this
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_fill_updated"));
    });
  }

  if (ds){
    if (APP_VECTOR_DEBUG) console.log("Define stage ds listener");
    ds.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage ds listener change " + e.target.value);
      Scene.stage.defaultStroke = e.target.value;
      addDynamicSwatch(e.target.value);   // <--- add this
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_stroke_updated"));
    });
  }

  if (dsw){
    if (APP_VECTOR_DEBUG) console.log("Define stage dsw listener");
    dsw.addEventListener("change", (e) => {
      if (APP_VECTOR_DEBUG) console.log("Define stage dsw listener change "+ e.target.value);
      Scene.stage.defaultStrokeW = Math.max(0, Number(e.target.value || 0));
      scheduleAutosave();
      //render();
      //setStatus(tr("status_default_stroke_w_updated"));
    });
  }

  if (bge){
  bge.addEventListener("change", (e) => {
    Scene.stage.bgImgEnabled = !!e.target.checked;
    if (Scene.stage.bgImgEnabled && !Scene.stage.bgImgAssetId){
      Scene.stage.bgImgEnabled = false;
      e.target.checked = false;
    }
    scheduleAutosave();
    render();
  });
}

if (bgka){
  bgka.addEventListener("change", (e) => {
    Scene.stage.bgImgKeepAspect = !!e.target.checked;
    scheduleAutosave();
    render();
  });
}

if (bgs){
  bgs.addEventListener("change", (e) => {
    Scene.stage.bgImgStretch = !!e.target.checked;
    scheduleAutosave();
    render();
  });
}

if (btnPickBg) btnPickBg.addEventListener("click", () => pickBackgroundImageForScene());
if (btnClearBg) btnClearBg.addEventListener("click", () => clearBackgroundImageForScene());
if (btnResizeStageToBg) btnResizeStageToBg.addEventListener("click", () => resizeStageToBackgroundImage());

    // Add swatches beside stage/default color inputs
  if (bg) attachSwatchesToColorInput(bg, { palette: getActiveColorPalette });
  if (dt) attachSwatchesToColorInput(dt, { palette: getActiveColorPalette });
  if (dhc) attachSwatchesToColorInput(dhc, { palette: getActiveColorPalette });
  if (df) attachSwatchesToColorInput(df, { palette: getActiveColorPalette });
  if (ds) attachSwatchesToColorInput(ds, { palette: getActiveColorPalette });

}

  // View controls
  $("btnFit").addEventListener("click", () => fitStageToView());
  $("btnResetView").addEventListener("click", () => {
    Scene.view.zoom = 1.0;
    Scene.view.offsetX = 0;
    Scene.view.offsetY = 0;
    scheduleAutosave(); render();
  });
  $("btnZoomIn").addEventListener("click", () => {
    Scene.view.zoom = clamp(Scene.view.zoom * 1.15, 0.1, 10);
    scheduleAutosave(); render();
  });
  $("btnZoomOut").addEventListener("click", () => {
    Scene.view.zoom = clamp(Scene.view.zoom / 1.15, 0.1, 10);
    scheduleAutosave(); render();
  });


async function preloadFontsForScene(scene = Scene){
  const jobs = [];
  const seen = new Set();

  const stagePreset = normalizeRenderFontPresetKey(scene?.stage?.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
  const stageTextFamily = resolveTextFontFamilyForPreset(
    scene?.stage?.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
    stagePreset
  );
  const stageKey = `${stagePreset}::${stageTextFamily}::56`;
  if (!seen.has(stageKey)) {
    seen.add(stageKey);
    jobs.push(waitForRenderPresetFonts(stagePreset, 56, stageTextFamily));
  }

  for (const el of Array.isArray(scene?.elements) ? scene.elements : []) {
    if (!el) continue;
    if (el.type === ElementType.Text || el.type === ElementType.Sitelen) {
      const presetKey = getElementRenderFontPresetKey(el);
      const textFamily = getElementResolvedTextFontFamily(el);
      const fontPx = Math.max(8, Number(el.fontSize || 56));
      const key = `${presetKey}::${textFamily}::${fontPx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(waitForRenderPresetFonts(presetKey, fontPx, textFamily));
    } else if (el.type === ElementType.Glyph) {
      const presetKey = getElementRenderFontPresetKey(el);
      const fontPx = Math.max(8, Number(el.fontSize || 56));
      const key = `${presetKey}::glyph::${fontPx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(waitForRenderPresetFonts(presetKey, fontPx));
    }
  }

  if (jobs.length) await Promise.allSettled(jobs);
}

async function awaitFontLoading(){
  if (!document.fonts || !document.fonts.ready) return;
  try{
    await hydrateSceneBeforeDisplay(Scene);
    await document.fonts.ready;
  }catch{
    // If a font fails to load, continue with fallbacks.
  }
}


async function hydrateSceneBeforeDisplay(scene = Scene){
  sceneHydrating = true;
  try{
    await preloadFontsForScene(scene);
    const jobs = [];
    for (const el of Array.isArray(scene?.elements) ? scene.elements : []){
      if (!el) continue;
      if (el.type === ElementType.Sitelen || el.type === "Sitelen"){
        invalidateSitelenCache(el.id);
        jobs.push(rebuildSitelenRasterWithRenderer(el, sitelenLayoutOptsForElement(el)));
      } else if (el.type === ElementType.Glyph || el.type === "Glyph"){
        invalidateGlyphCache(el.id);
        jobs.push(rebuildGlyphRasterWithRenderer(el));
      }
    }
    if (jobs.length) await Promise.allSettled(jobs);
  } finally {
    sceneHydrating = false;
  }
}

function relayoutAllSitelenAfterFontsReady(){
  return (document.fonts?.ready ?? Promise.resolve()).then(async () => {
    await hydrateSceneBeforeDisplay(Scene);
    render();
  });
}

document.addEventListener("keydown", (e) => {


  // Do not hijack shortcuts while typing in inputs/textareas/selects/contenteditable
  if (isTypingContext(document.activeElement)) return;

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (!mod) return;

  const k = String(e.key || "").toLowerCase();


  if ( k === "z"){
    e.preventDefault();
    if (e.shiftKey) historyRedo();
    else historyUndo();
    return;
  }

  if (k === "y"){
    e.preventDefault();
    historyRedo();
    return;
  }


  if (k === "c"){
    e.preventDefault();
    copySelection();
    return;
  }

  if (k === "x"){
    e.preventDefault();
    cutSelection();
    return;
  }

  if (k === "v"){
    e.preventDefault();
    pasteClipboard();
    return;
  }
}, { passive: false });

  /* ============================================================
     Load initial state
     ============================================================ */
  async function init(){
    applyUiText();
    initFloatingSitelenEditor();
    wireLangSelector();
    setStatus(tr("status_loading"));
    try{
      await stageFontPairController.ready;

      try {
        const syncResult = await stageFontPairController.syncPreloadedFontPairsFromManifest({
          manifestUrl: "../../fonts/preloaded-font-pairs.manifest.json",
          onlyIfExisting: false,
          force: true
        });

        if (APP_VECTOR_DEBUG) console.info("[scrapbook preloaded-fonts] sync result:", syncResult);

        if (syncResult.updated > 0) {
          await stageFontPairController.hydrateDynamicPresetsFromDb({ force: true });

          stageFontPairController.resetFontLoadState?.();

          sitelenRendererInstancePromises?.clear?.();
          sitelenRasterJobs?.clear?.();
          glyphRasterJobs?.clear?.();
          glyphCache?.clear?.();
          sitelenCache?.clear?.();

          if (APP_VECTOR_DEBUG) console.info(
            "[scrapbook preloaded-fonts] active preset after hydrate:",
            stageFontPairController.getActivePreset()
          );
        }
      } catch (err) {
        console.warn("[scrapbook preloaded-fonts] manifest sync failed:", err);
      }


      Scene.stage.defaultRenderFontPreset = normalizeRenderFontPresetKey(Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
      Scene.stage.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(
        Scene.stage.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
        Scene.stage.defaultRenderFontPreset
      );
      Scene.stage.defaultSpacingPreset = normalizeSpacingPreset(Scene.stage.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);
      await awaitFontLoading(); // <-- add this FIRST
      try { await ensureSitelenRendererModule(); } catch (e) { console.warn(e); }

      // Load cartouche DB page map
      try {
        const rendererMod = await import('../../js/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=55');
        const NanpaParser = rendererMod?.NanpaParser;
        if (NanpaParser && !globalThis.NanpaParser) globalThis.NanpaParser = NanpaParser;
        const cartoucheApi = await CartoucheApi.open({ lookup: true, nanpaParser: NanpaParser });
        globalCartouchePageMap = await cartoucheApi.resolvePageMap();
        rebuildActiveCartouchePageMap();
      } catch(e) { console.warn('CartoucheApi load failed, continuing without:', e); }

      //wire default stage controls
      wireStageDefaultsUi();

      //load scene
      const record = await dbGet(DB_KEY);
      if (!record) {
        Scene.stage.defaultRenderFontPreset = normalizeRenderFontPresetKey(stageFontPairController.getActivePreset()?.key || Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
        Scene.stage.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(
          stageFontPairController.getSelectedTextFontOptionKey() || Scene.stage.defaultTextFontOption || DEFAULTS.defaultTextFontOption,
          Scene.stage.defaultRenderFontPreset
        );
      }

      //load assets if they exist in file, used in format 2
      if(record && record.assets){
        deserializeAssets(record.assets);
      }
      
      //revert back to format 1 for loading scene
      const saved = (record && record.scene) ? record.scene : record;
      if (saved && saved.stage && Array.isArray(saved.elements)){
        const normalizedSaved = normalizeScene(saved);
        // restore
        Scene.meta = normalizedSaved.meta || Scene.meta;
        Scene.stage = normalizedSaved.stage;
        Scene.view = normalizedSaved.view || Scene.view;
        Scene.elements = normalizedSaved.elements || [];
        Scene.groups = normalizedSaved.groups || {};

        await hydrateSceneBeforeDisplay(Scene);

        $("stageW").value = String(Scene.stage.w);
        $("stageH").value = String(Scene.stage.h);
        $("gridSize").value = String(Scene.stage.gridSize);
        $("snapTol").value = String(Scene.stage.snapTol);

        setPressed($("btnGrid"), !!Scene.stage.showGrid);
        setPressed($("btnSnapGrid"), !!Scene.stage.snapGrid);
        setPressed($("btnSnapObjs"), !!Scene.stage.snapObjects);

        setStatus(tr("status_loaded"));
      } else {
        setStatus(tr("status_no_saved_scene"));
      }
    }catch(err){
      console.warn(err);
      setStatus(tr("status_idb_unavailable"));
    }

   
   

    updateUiForSelection();
    wireClipboardButtons();
    wireArrowKeyNudge();

    syncStageDefaultsUiFromScene();
    await hydrateSceneBeforeDisplay(Scene);

    //resizeCanvasToDisplay();
    fitStageToView();
    render();
    historyReset("Init");

  }


  function clearEditorRuntimeCaches(){
    selectedIds.clear();
    // imageCache, posterAssetImageCache, remotePosterImageCache are all keyed by
    // element ID (unique UUIDs) or URL — entries never collide across pages and
    // each function already handles staleness via its own assetId/ready checks.
    // Clearing them on page switch only causes unnecessary Image re-allocation and
    // re-decode churn on every navigation. Leave them intact.
    colorKeyCache.clear();
    sitelenCache.clear();
    glyphCache.clear();
    sitelenRasterJobs.clear();
    glyphRasterJobs.clear();
    sitelenRendererInstancePromises.clear();
  }

  function snapshotCurrentPagePayload(){
    return {
      scene: {
        meta: deepClone(Scene.meta),
        stage: deepClone(Scene.stage),
        view: deepClone(Scene.view),
        elements: deepClone(Scene.elements),
        groups: deepClone(Scene.groups),
      },
      assets: serializeAssets(),
    };
  }

  // Lightweight fingerprint of the current scene for change detection.
  // Deliberately excludes asset data URLs (which can be hundreds of MB)
  // — instead captures asset IDs, element geometry, and text content.
  function sceneFingerprint(){
    try {
      const els = (Scene.elements || []).map(el => ({
        id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h,
        rotationDeg: el.rotationDeg,
        title: el.title,
        text: el.text,
        // capture asset IDs but not data URLs
        imageAssetId: el.image && el.image.assetId,
        posterAssetId: el.posterAssetId,
        audioAssetId: el.audio && el.audio.assetId,
        videoAssetId: el.video && el.video.assetId,
        urlHref: el.url && el.url.href,
        exportVisible: el.exportVisible,
      }));
      return JSON.stringify({
        stageW: Scene.stage && Scene.stage.w,
        stageH: Scene.stage && Scene.stage.h,
        stageBg: Scene.stage && Scene.stage.bg,
        elementCount: els.length,
        elements: els,
        groupCount: (Scene.groups || []).length,
      });
    } catch { return String(Date.now()); }
  }

  async function loadPagePayloadIntoEditor(payload, reason = 'Page load', options = {}){
    stopActiveMediaPlayback();
    const opts = options || {};
    const silent = !!opts.silent;

    // v30: hard atomic display lock.  Nothing is allowed to update the live
    // SVG host or interaction overlay until the replacement page has been
    // fully loaded, hydrated, fitted, converted to SVG, and swapped in.
    const atomicToken = beginAtomicLiveSceneUpdate();
    let visibleSwapComplete = false;

    try {
      const rawScene = payload && payload.scene ? payload.scene : payload;
      deserializeAssets((payload && payload.assets) ? payload.assets : null);
      const normalized = normalizeScene(rawScene);
      const sanitized = validateAndSanitizeScene(normalized);
      Scene.meta = sanitized.meta;
      Scene.stage = sanitized.stage;
      Scene.view = sanitized.view;
      Scene.elements = sanitized.elements;
      Scene.groups = sanitized.groups;
      syncStageDefaultsUiFromScene();
      clearEditorRuntimeCaches();
      $("stageW").value = String(Scene.stage.w);
      $("stageH").value = String(Scene.stage.h);
      $("gridSize").value = String(Scene.stage.gridSize);
      $("snapTol").value = String(Scene.stage.snapTol);
      setPressed($("btnGrid"), !!Scene.stage.showGrid);
      setPressed($("btnSnapGrid"), !!Scene.stage.snapGrid);
      setPressed($("btnSnapObjs"), !!Scene.stage.snapObjects);

      await hydrateSceneBeforeDisplay(Scene);
      await awaitAllRendererRastersReady();

      updateUiForSelection();
      rebuildDynamicPaletteFromScene();
      if (!silent) {
        fitStageToView({ renderNow: false });
      }
      if (!opts.preserveHistory) historyReset(reason);

      if (!silent) {
        // Build the final page SVG while still locked, then swap the host once.
        // Do not release the lock before this resolves: otherwise async font/
        // hydration/render callbacks can briefly show the wrong page/transform.
        visibleSwapComplete = await buildAndSwapLiveSvgScene();
      }
    } catch (err) {
      if (!silent) {
        console.error("Page load / live SVG scene render failed", err);
        setStatus("Page render failed: " + (err?.message || err));
      }
      throw err;
    } finally {
      endAtomicLiveSceneUpdate(atomicToken);
    }

    if (!silent && visibleSwapComplete) {
      // Now that the final SVG is visible, draw the overlay once using the
      // final stable Scene.view.
      renderInteractionOverlay();
    }

    opportunisticallyPopulateUrlPostersForScene(Scene.elements).catch((err) => console.warn('Deferred URL poster scan failed', err));
  }

  async function renderCurrentPageDataUrl(maxW = 0, maxH = 0, forExport = false, forceStageBackground = false){
    await awaitAllRendererRastersReady();
    // Pre-warm poster image cache via the shared ensureImageLoadedFromAssetId path —
    // this is the same function the draw calls use, so images are guaranteed decoded.
    const preloadJobs = [];
    for (const el of (Scene.elements || [])){
      const posterId = el.posterAssetId || (el.url && el.url.posterAssetId) || "";
      if (posterId){
        const cacheKey = el.id + (el.url ? "__poster" : "__vidposter");
        preloadJobs.push(awaitImageLoadedFromAssetId(posterId, cacheKey));
      }
      const imageAssetId = el.image && el.image.assetId ? String(el.image.assetId) : "";
      if (imageAssetId){
        preloadJobs.push(awaitImageLoadedFromAssetId(imageAssetId, el.id + "__image"));
      }
    }
    if (Scene.stage?.bgImgEnabled && Scene.stage?.bgImgAssetId){
      preloadJobs.push(awaitImageLoadedFromAssetId(String(Scene.stage.bgImgAssetId), '__stageBgImage'));
    }
    if (preloadJobs.length) await Promise.allSettled(preloadJobs);
    const stageW = Scene.stage.w;
    const stageH = Scene.stage.h;
    let outW = stageW;
    let outH = stageH;
    if (maxW > 0 || maxH > 0){
      const sx = maxW > 0 ? (maxW / stageW) : Infinity;
      const sy = maxH > 0 ? (maxH / stageH) : Infinity;
      const s = Math.min(sx, sy, 1);
      outW = Math.max(1, Math.round(stageW * s));
      outH = Math.max(1, Math.round(stageH * s));
    }
    // Current-page export uses the live Scene/Assets path above.
    // Do not run the payload-local preload block here — there is no local payload
    // resolver in this function, and doing so causes stage/elements ReferenceErrors.

    const off = document.createElement('canvas');
    off.width = outW; off.height = outH;
    const octx = off.getContext('2d');
    octx.save();
    octx.scale(outW / stageW, outH / stageH);
    if (forceStageBackground || Scene.stage.exportStageBackground === true){
      octx.fillStyle = Scene.stage.bg || DEFAULTS.stageBg;
      octx.fillRect(0, 0, stageW, stageH);
    }
    if (Scene.stage.bgImgEnabled && Scene.stage.bgImgAssetId){
      const assetId = String(Scene.stage.bgImgAssetId);
      const dataUrl = getImageAssetDataUrl(assetId);
      if (dataUrl){
        let img = (bgImageCache.ready && bgImageCache.assetId === assetId) ? bgImageCache.img : null;
        if (!img){ img = new Image(); img.src = dataUrl; }
        if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
          const dest = computeBackgroundImageDestRect({ stageW, stageH, natW: img.naturalWidth, natH: img.naturalHeight, stretch: !!Scene.stage.bgImgStretch, keepAspect: (Scene.stage.bgImgKeepAspect !== false) });
          octx.save();
          octx.beginPath(); octx.rect(0, 0, stageW, stageH); octx.clip();
          octx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
          octx.restore();
        }
      }
    }
    for (const el of Scene.elements) drawElementToOffscreen(octx, el, forExport);
    octx.restore();
    const dataUrl = off.toDataURL('image/png');
    off.width = 1; off.height = 1;
    return dataUrl;
  }

  function editorHasMeaningfulContent(){
    return !!(Scene.elements && Scene.elements.length) || String(Scene.meta?.title || '').trim().length > 0;
  }

  window.LayoutEditorBridge = {
    snapshotCurrentPagePayload,
    loadPagePayloadIntoEditor,
    renderCurrentPageDataUrl,
    editorHasMeaningfulContent,
  };

  const SCRAPBOOK_DOC_DB_KEY = 'scrapbook_document_v1';
  let ScrapbookState = null;
  let scrapbookAutosaveTimer = null;
  let scrapbookMonitorTimer = null;
  let scrapbookUiLoadToken = 0;

  function nextScrapbookUiLoadToken(){
    scrapbookUiLoadToken += 1;
    return scrapbookUiLoadToken;
  }

  function isCurrentScrapbookUiLoadToken(token){
    return token === scrapbookUiLoadToken;
  }

  function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }
  function deep(obj){ return JSON.parse(JSON.stringify(obj)); }
  function debounceScrapbookSave(){
    if (scrapbookAutosaveTimer) clearTimeout(scrapbookAutosaveTimer);
    scrapbookAutosaveTimer = setTimeout(async () => {
      if (!ScrapbookState) return;
      try { await dbPut(SCRAPBOOK_DOC_DB_KEY, deep(ScrapbookState.doc)); }
      catch (err) { console.warn('scrapbook autosave failed', err); }
    }, 300);
  }
  function collectDocumentAssets(doc){
    const map = new Map();
    const dataUrlToId = new Map();
    const addSerialized = (serialized) => {
      const list = Array.isArray(serialized?.byId) ? serialized.byId : (Array.isArray(serialized) ? serialized : []);
      for (const a of list){
        if (!a || typeof a !== 'object' || !a.kind || !a.dataUrl) continue;
        const asset = deep(a);
        asset.id = String(asset.id || uid('asset'));
        if (dataUrlToId.has(asset.dataUrl)){
          const keptId = dataUrlToId.get(asset.dataUrl);
          if (!map.has(keptId)) map.set(keptId, asset);
          continue;
        }
        dataUrlToId.set(asset.dataUrl, asset.id);
        if (!map.has(asset.id)) map.set(asset.id, asset);
      }
    };
    addSerialized(doc?.assets);
    for (const page of (doc?.pages || [])) addSerialized(page?.payload?.assets);
    return { byId: Array.from(map.values()) };
  }

  function normalizeScrapbookDocumentDefaults(rawDefaults = {}, sourceStage = null){
    const d = isPlainObject(rawDefaults) ? rawDefaults : {};
    const st = sourceStage || Scene.stage || {};
    const presetKey = normalizeRenderFontPresetKey(d.defaultRenderFontPreset || st.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
    const out = {
      pageWidth: clamp(Math.round(Number(d.pageWidth) || st.w || DEFAULTS.stageW), 64, 12000),
      pageHeight: clamp(Math.round(Number(d.pageHeight) || st.h || DEFAULTS.stageH), 64, 12000),
      themeId: String(d.themeId || 'custom'),
      pageTemplate: String(d.pageTemplate || 'blank'),
      showGrid: !!(d.showGrid ?? st.showGrid ?? DEFAULTS.showGrid),
      gridSize: Number.isFinite(Number(d.gridSize)) ? clamp(Number(d.gridSize), 2, 1000) : (Number.isFinite(Number(st.gridSize)) ? clamp(Number(st.gridSize), 2, 1000) : DEFAULTS.gridSize),
      snapGrid: !!(d.snapGrid ?? st.snapGrid ?? DEFAULTS.snapGrid),
      snapObjects: !!(d.snapObjects ?? st.snapObjects ?? DEFAULTS.snapObjects),
      snapTol: Number.isFinite(Number(d.snapTol)) ? clamp(Number(d.snapTol), 0, 200) : (Number.isFinite(Number(st.snapTol)) ? clamp(Number(st.snapTol), 0, 200) : DEFAULTS.snapTol),
      stageBg: rgbaOrHexToHex(d.stageBg ?? st.bg ?? DEFAULTS.stageBg, DEFAULTS.stageBg),
      exportStageBackground: !!(d.exportStageBackground ?? st.exportStageBackground ?? DEFAULTS.exportStageBackground),
      bgImgEnabled: !!(d.bgImgEnabled ?? st.bgImgEnabled ?? DEFAULTS.bgImgEnabled),
      bgImgAssetId: d.bgImgAssetId != null && String(d.bgImgAssetId || '').trim() ? String(d.bgImgAssetId) : null,
      bgImgKeepAspect: !!(d.bgImgKeepAspect ?? st.bgImgKeepAspect ?? DEFAULTS.bgImgKeepAspect),
      bgImgStretch: !!(d.bgImgStretch ?? st.bgImgStretch ?? DEFAULTS.bgImgStretch),
      defaultRenderFontPreset: presetKey,
      defaultTextFontOption: normalizeTextFontOptionKeyForPreset(d.defaultTextFontOption || st.defaultTextFontOption || DEFAULTS.defaultTextFontOption, presetKey),
      defaultAbbreviateNumericCartouches: !!(d.defaultAbbreviateNumericCartouches ?? st.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches),
      defaultPreserveCenterOnAutoResize: !!(d.defaultPreserveCenterOnAutoResize ?? st.defaultPreserveCenterOnAutoResize ?? DEFAULTS.defaultPreserveCenterOnAutoResize),
      defaultSpacingPreset: normalizeSpacingPreset(d.defaultSpacingPreset ?? st.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset),
      defaultTextColor: rgbaOrHexToHex(d.defaultTextColor ?? st.defaultTextColor ?? DEFAULTS.defaultTextColor, DEFAULTS.defaultTextColor),
      defaultIgnoreUnknownText: !!(d.defaultIgnoreUnknownText ?? st.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText),
      defaultFill: rgbaOrHexToHex(d.defaultFill ?? st.defaultFill ?? DEFAULTS.defaultFill, DEFAULTS.defaultFill),
      defaultFillEnabled: !!(d.defaultFillEnabled ?? st.defaultFillEnabled ?? DEFAULTS.defaultFillEnabled),
      defaultStroke: rgbaOrHexToHex(d.defaultStroke ?? st.defaultStroke ?? DEFAULTS.defaultStroke, DEFAULTS.defaultStroke),
      defaultStrokeW: Number.isFinite(Number(d.defaultStrokeW)) ? clamp(Number(d.defaultStrokeW), 0, 200) : (Number.isFinite(Number(st.defaultStrokeW)) ? clamp(Number(st.defaultStrokeW), 0, 200) : DEFAULTS.defaultStrokeW),
      defaultHaloEnabled: !!(d.defaultHaloEnabled ?? st.defaultHaloEnabled ?? DEFAULTS.defaultHaloEnabled),
      defaultHaloColor: rgbaOrHexToHex(d.defaultHaloColor ?? st.defaultHaloColor ?? DEFAULTS.defaultHaloColor, DEFAULTS.defaultHaloColor),
      defaultHaloThicknessPx: Number.isFinite(Number(d.defaultHaloThicknessPx)) ? clamp(Number(d.defaultHaloThicknessPx), 0, 200) : (Number.isFinite(Number(st.defaultHaloThicknessPx)) ? clamp(Number(st.defaultHaloThicknessPx), 0, 200) : DEFAULTS.defaultHaloThicknessPx),
      defaultHaloThicknessMode: String(d.defaultHaloThicknessMode || st.defaultHaloThicknessMode || DEFAULTS.defaultHaloThicknessMode) === 'manual' ? 'manual' : 'auto',
    };
    if (!out.bgImgAssetId) out.bgImgEnabled = false;
    if (!['blank','title','content','diary','photoCaption','quote','collage'].includes(out.pageTemplate)) out.pageTemplate = 'blank';
    if (!['custom','scrapbook','diary','slideshow'].includes(out.themeId)) out.themeId = 'custom';
    return out;
  }

  function documentIncludesCoverPage(doc = null){
    const d = doc || ScrapbookState?.doc || {};
    return d?.settings?.includeCoverPageInExport !== false;
  }

  function documentCoverDateUsesAbbreviatedCartouche(doc = null){
    const d = doc || ScrapbookState?.doc || {};
    return !!d?.settings?.coverDateAbbreviateNumericCartouche;
  }

  function normalizeScrapbookPayload(rawPayload, fallbackAssets = null){
    const payload = rawPayload && rawPayload.scene ? deep(rawPayload) : { scene: deep(rawPayload || {}) };
    payload.assets = deep(payload.assets || fallbackAssets || { byId: [] });
    payload.scene = validateAndSanitizeScene(normalizeScene(payload.scene || {}));
    payload.scene.meta = isPlainObject(payload.scene.meta) ? payload.scene.meta : {};
    payload.scene.stage = isPlainObject(payload.scene.stage) ? payload.scene.stage : {};
    return payload;
  }
  function normalizeScrapbookDocument(rawDoc){
    if (!rawDoc || rawDoc.format !== 'StaticScrapbookDocument' || !Array.isArray(rawDoc.pages) || !rawDoc.pages.length) throw new Error('Invalid scrapbook document.');
    const rawSettingsHadCoverDateAbbrev = !!(
      rawDoc &&
      rawDoc.settings &&
      Object.prototype.hasOwnProperty.call(rawDoc.settings, 'coverDateAbbreviateNumericCartouche')
    );
    const doc = deep(rawDoc);
    doc.version = Math.max(1, Math.round(Number(doc.version) || 1));
    doc.exportedAt = String(doc.exportedAt || new Date().toISOString());
    doc.meta = isPlainObject(doc.meta) ? doc.meta : {};
    doc.meta.title = String(doc.meta.title || 'Untitled document').trim() || 'Untitled document';
    doc.meta.subtitle = String(doc.meta.subtitle || '');
    doc.meta.documentType = ['scrapbook','diary','slideshow','custom'].includes(String(doc.meta.documentType || '')) ? String(doc.meta.documentType) : 'scrapbook';
    doc.meta.createdAt = String(doc.meta.createdAt || new Date().toISOString());
    doc.meta.updatedAt = String(doc.meta.updatedAt || new Date().toISOString());
    doc.meta.language = (String(doc.meta.language || (langSel?.value || 'en')) === 'tp') ? 'tp' : 'en';
    doc.notes = String(doc.notes || '');
    const rawDocumentDefaults = isPlainObject(doc.documentDefaults) ? doc.documentDefaults : {};
    const rawDocumentDefaultsHasAbbrev = Object.prototype.hasOwnProperty.call(rawDocumentDefaults, 'defaultAbbreviateNumericCartouches');
    doc.documentDefaults = normalizeScrapbookDocumentDefaults(rawDocumentDefaults, Scene.stage || {});
    // Existing/imported documents that lack the abbreviation flag must stay visually unchanged.
    if (!rawDocumentDefaultsHasAbbrev) doc.documentDefaults.defaultAbbreviateNumericCartouches = false;
    doc.assets = deep(doc.assets || { byId: [] });
    doc.cartoucheDb = normalizeScrapbookCartoucheDb(doc.cartoucheDb);
    // Normalise media guard settings (default all ON for new/old docs that lack them)
    doc.settings = isPlainObject(doc.settings) ? doc.settings : {};
    doc.settings.includeCoverPageInExport = doc.settings.includeCoverPageInExport !== false;
    // Imported/existing documents preserve an explicit cover-date abbreviation
    // setting. If the setting is absent, default OFF for compatibility. New
    // documents are created separately with this setting ON.
    doc.settings.coverDateAbbreviateNumericCartouche = rawSettingsHadCoverDateAbbrev
      ? !!doc.settings.coverDateAbbreviateNumericCartouche
      : false;
    doc.settings.mediaGuards = isPlainObject(doc.settings.mediaGuards) ? doc.settings.mediaGuards : {};
    doc.settings.mediaGuards.image = doc.settings.mediaGuards.image !== false;
    doc.settings.mediaGuards.audio = doc.settings.mediaGuards.audio !== false;
    doc.settings.mediaGuards.video = doc.settings.mediaGuards.video !== false;
    // YouTube export info dialogs — default ON (show) for new and old docs that lack the field
    doc.settings.youtubeExportInfo = isPlainObject(doc.settings.youtubeExportInfo) ? doc.settings.youtubeExportInfo : {};
    doc.settings.youtubeExportInfo.pngSingle = doc.settings.youtubeExportInfo.pngSingle !== false;
    doc.settings.youtubeExportInfo.png  = doc.settings.youtubeExportInfo.png  !== false;
    doc.settings.youtubeExportInfo.html = doc.settings.youtubeExportInfo.html !== false;
    doc.settings.youtubeExportInfo.pdf  = doc.settings.youtubeExportInfo.pdf  !== false;
    const seenPageIds = new Set();
    doc.pages = doc.pages.map((page, idx) => {
      let id = String(page?.id || uid('page'));
      if (seenPageIds.has(id)) id = uid('page');
      seenPageIds.add(id);
      const tags = Array.isArray(page?.tags) ? [...new Set(page.tags.map(v => String(v).trim()).filter(Boolean))] : [];
      const payload = normalizeScrapbookPayload(page?.payload || page?.scene || page, doc.assets);
      return {
        id,
        kind: (String(page?.kind || 'page') === 'page') ? 'page' : 'page',
        name: String(page?.name || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`,
        notes: String(page?.notes || ''),
        tags,
        thumbnail: String(page?.thumbnail || ''),
        payload,
      };
    });
    doc.assets = collectDocumentAssets(doc);
    const canonicalAssets = deep(doc.assets);
    for (const page of doc.pages) page.payload.assets = deep(canonicalAssets);
    if (!doc.pages.some(p => p.id === doc.currentPageId)) doc.currentPageId = doc.pages[0].id;
    return doc;
  }

  function buildCanonicalScrapbookDocumentForExport(rawDoc){
    const doc = normalizeScrapbookDocument(rawDoc);
    const exportedAt = new Date().toISOString();
    const canonicalAssets = deep(collectDocumentAssets(doc));
    return {
      format: 'StaticScrapbookDocument',
      version: 1,
      exportedAt,
      meta: {
        title: String(doc.meta?.title || 'Untitled document'),
        subtitle: String(doc.meta?.subtitle || ''),
        documentType: ['scrapbook','diary','slideshow','custom'].includes(String(doc.meta?.documentType || '')) ? String(doc.meta.documentType) : 'scrapbook',
        createdAt: String(doc.meta?.createdAt || exportedAt),
        updatedAt: exportedAt,
        language: (String((langSel?.value || doc.meta?.language || 'en')) === 'tp') ? 'tp' : 'en'
      },
      notes: String(doc.notes || ''),
      documentDefaults: deep(normalizeScrapbookDocumentDefaults(doc.documentDefaults || {}, null)),
      cartoucheDb: deep(normalizeScrapbookCartoucheDb(doc.cartoucheDb)),
      settings: { includeCoverPageInExport: doc.settings?.includeCoverPageInExport !== false, coverDateAbbreviateNumericCartouche: !!doc.settings?.coverDateAbbreviateNumericCartouche, mediaGuards: { image: !!(doc.settings?.mediaGuards?.image !== false), audio: !!(doc.settings?.mediaGuards?.audio !== false), video: !!(doc.settings?.mediaGuards?.video !== false) }, youtubeExportInfo: { pngSingle: !!(doc.settings?.youtubeExportInfo?.pngSingle !== false), png: !!(doc.settings?.youtubeExportInfo?.png !== false), html: !!(doc.settings?.youtubeExportInfo?.html !== false), pdf: !!(doc.settings?.youtubeExportInfo?.pdf !== false) } },
      assets: canonicalAssets,
      pages: (doc.pages || []).map((page, idx) => ({
        id: String(page?.id || uid('page')),
        name: String(page?.name || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`,
        kind: 'page',
        thumbnail: String(page?.thumbnail || ''),
        scene: validateAndSanitizeScene(normalizeScene(deep(page?.payload?.scene || page?.scene || {}))),
        notes: String(page?.notes || ''),
        tags: Array.isArray(page?.tags) ? [...new Set(page.tags.map(v => String(v).trim()).filter(Boolean))] : []
      }))
    };
  }

  const ScrapbookSearchState = {
    isOpen: false,
    query: '',
    results: [],
    selectedKey: '',
    lastDocSig: '',
    root: null,
    header: null,
    input: null,
    resultsEl: null,
    closeBtn: null,
    runBtn: null,
    dragging: false,
    dragPointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  function closeScrapbookSearchWindow(){
    const S = ScrapbookSearchState;
    if (!S.root) return;
    S.isOpen = false;
    S.root.classList.remove('show');
    S.root.classList.add('hidden');
    S.root.setAttribute('aria-hidden', 'true');
  }

  function clampScrapbookSearchWindowToViewport(){
    const S = ScrapbookSearchState;
    if (!S.root) return;
    const rect = S.root.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    let left = rect.left;
    let top = rect.top;
    if (!Number.isFinite(left)) left = 16;
    if (!Number.isFinite(top)) top = 16;
    left = Math.max(8, Math.min(left, Math.max(8, vw - rect.width - 8)));
    top = Math.max(8, Math.min(top, Math.max(8, vh - rect.height - 8)));
    S.root.style.left = `${left}px`;
    S.root.style.top = `${top}px`;
  }

  function openScrapbookSearchWindow(){
    const S = ScrapbookSearchState;
    if (!S.root) return;
    S.isOpen = true;
    S.root.classList.remove('hidden');
    S.root.classList.add('show');
    S.root.setAttribute('aria-hidden', 'false');
    if (S.input) S.input.value = S.query || '';
    renderScrapbookSearchResults();
    clampScrapbookSearchWindowToViewport();
    S.input?.focus();
    S.input?.select();
  }

  function clearScrapbookSearchState(){
    const S = ScrapbookSearchState;
    S.query = '';
    S.results = [];
    S.selectedKey = '';
    S.lastDocSig = '';
    if (S.input) S.input.value = '';
    renderScrapbookSearchResults();
  }

  function normalizeSearchText(v){
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeSearchLower(v){
    return normalizeSearchText(v).toLowerCase();
  }

  function buildScrapbookSearchDocSignature(){
    if (!ScrapbookState?.doc) return '';
    const pages = ScrapbookState.doc.pages || [];
    const chunks = [];
    for (const page of pages){
      const payload = page?.payload?.scene;
      const elements = Array.isArray(payload?.elements) ? payload.elements : [];
      chunks.push(`${page.id}|${page.name || ''}|${page.notes || ''}|${elements.length}`);
      for (const el of elements){
        chunks.push(`${el.id}|${el.type}|${el.text || ''}|${el.codepoint || ''}`);
      }
    }
    return chunks.join('||');
  }

  function snippetForMatch(text, query){
    const src = normalizeSearchText(text);
    if (!src) return '';
    const q = normalizeSearchText(query).toLowerCase();
    if (!q) return src.slice(0, 140);
    const lower = src.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return src.slice(0, 140);
    const start = Math.max(0, idx - 36);
    const end = Math.min(src.length, idx + q.length + 72);
    return (start > 0 ? '…' : '') + src.slice(start, end) + (end < src.length ? '…' : '');
  }

  function resolveGlyphSearchCodepoint(query){
    const raw = normalizeSearchText(query);
    if (!raw || !/^[A-Za-z]+$/.test(raw)) return null;
    const key = normalizeTpWord(raw);
    if (!key || key !== raw.toLowerCase()) return null;
    const cp = MULTI_LINE_WORD_TO_UCSUR_CP[key];
    return Number.isFinite(cp) ? cp : null;
  }

  function buildScrapbookSearchResults(query){
    const doc = ScrapbookState?.doc;
    if (!doc) return [];
    const q = normalizeSearchText(query);
    if (!q) return [];
    const qLower = q.toLowerCase();
    const glyphCp = resolveGlyphSearchCodepoint(q);
    const out = [];
    for (const page of (doc.pages || [])){
      const pageName = String(page?.name || '');
      const pageNotes = String(page?.notes || '');
      if (pageName.toLowerCase().includes(qLower)){
        out.push({
          key: `page:${page.id}:name`,
          kind: 'page-name',
          pageId: page.id,
          pageName: pageName || 'Untitled page',
          title: pageName || 'Untitled page',
          meta: 'Page name',
          snippet: snippetForMatch(pageName, q)
        });
      }
      if (pageNotes.toLowerCase().includes(qLower)){
        out.push({
          key: `page:${page.id}:notes`,
          kind: 'page-notes',
          pageId: page.id,
          pageName: pageName || 'Untitled page',
          title: pageName || 'Untitled page',
          meta: 'Page notes',
          snippet: snippetForMatch(pageNotes, q)
        });
      }
      // For the current page, prefer live Scene.elements so edits (e.g. searchTag
      // changes) are immediately searchable without waiting for the payload sync.
      // However, if Scene.elements is empty the page may still be loading —
      // fall back to the stored payload so early searches still return results.
      const isCurrentPage = ScrapbookState?.currentPageId === page.id;
      const liveEls = Array.isArray(Scene.elements) ? Scene.elements : [];
      const storedEls = Array.isArray(page?.payload?.scene?.elements) ? page.payload.scene.elements : [];
      const elements = isCurrentPage && liveEls.length > 0 ? liveEls : storedEls;
      for (let elementIndex = 0; elementIndex < elements.length; elementIndex++){
        const el = elements[elementIndex];
        if (!el || !el.id) continue;
        if (el.type === ElementType.Text || el.type === ElementType.Sitelen){
          const txt = String(el.text || '');
          if (!txt || !txt.toLowerCase().includes(qLower)) continue;
          out.push({
            key: `element:${page.id}:${el.id}:${elementIndex}`,
            kind: el.type,
            pageId: page.id,
            elementId: el.id,
            elementIndex,
            elementType: el.type,
            elementText: txt,
            pageName: pageName || 'Untitled page',
            title: el.type === ElementType.Sitelen ? 'Sitelen element' : 'Text element',
            meta: `${el.type === ElementType.Sitelen ? 'Sitelen' : 'Text'} · ${pageName || 'Untitled page'}`,
            snippet: snippetForMatch(txt, q)
          });
        } else if (
          (el.type === ElementType.Audio || el.type === ElementType.Video || el.type === ElementType.Url) &&
          el.searchTag && el.searchTag.toLowerCase().includes(qLower)
        ){
          const typeLabel = el.type === ElementType.Audio ? 'Audio' : el.type === ElementType.Video ? 'Video' : 'URL';
          const elTitle = String(el.title || (el.audio && el.audio.origName) || (el.video && el.video.origName) || (el.url && el.url.href) || typeLabel);
          out.push({
            key: `element:${page.id}:${el.id}:${elementIndex}`,
            kind: el.type,
            pageId: page.id,
            elementId: el.id,
            elementIndex,
            elementType: el.type,
            elementText: String(el.searchTag || ''),
            pageName: pageName || 'Untitled page',
            title: elTitle,
            meta: `${typeLabel} · ${pageName || 'Untitled page'}`,
            snippet: `Tag: ${snippetForMatch(el.searchTag, q)}`
          });
        } else if (el.type === ElementType.Glyph && glyphCp != null){
          const cp = parseCodepointInput(el.codepoint);
          if (cp !== glyphCp) continue;
          out.push({
            key: `element:${page.id}:${el.id}:${elementIndex}`,
            kind: 'glyph',
            pageId: page.id,
            elementId: el.id,
            elementIndex,
            elementType: el.type,
            elementText: String(el.codepoint || ''),
            pageName: pageName || 'Untitled page',
            title: 'Glyph element',
            meta: `${q.toLowerCase()} · ${pageName || 'Untitled page'}`,
            snippet: `Matches glyph for toki pona word “${q.toLowerCase()}”.`
          });
        }
      }
    }
    return out;
  }

  function refreshScrapbookSearchResults(force = false){
    const S = ScrapbookSearchState;
    const q = normalizeSearchText(S.query);
    const sig = buildScrapbookSearchDocSignature();
    if (!force && sig === S.lastDocSig) return;
    S.lastDocSig = sig;
    S.results = q ? buildScrapbookSearchResults(q) : [];
    if (S.selectedKey && !S.results.some(r => r.key === S.selectedKey)) S.selectedKey = '';
    renderScrapbookSearchResults();
  }

  function runScrapbookSearch(){
    const S = ScrapbookSearchState;
    const nextQuery = normalizeSearchText(S.input ? S.input.value : S.query);
    S.query = nextQuery;
    S.lastDocSig = '';
    refreshScrapbookSearchResults(true);
  }

  function renderScrapbookSearchResults(){
    const S = ScrapbookSearchState;
    if (!S.resultsEl) return;
    const q = normalizeSearchText(S.query);
    if (S.input && S.input.value !== S.query) S.input.value = S.query;
    if (!q){
      S.resultsEl.innerHTML = `<div class="scrapbookSearchEmpty">Enter text to search across page names, page notes, text elements, sitelen elements, and audio/video/URL search tags. Glyph elements are only searched when the entire query is a single recognized toki pona word.</div>`;
      return;
    }
    if (!S.results.length){
      S.resultsEl.innerHTML = `<div class="scrapbookSearchEmpty">No matches for “${escapeHtml(q)}”.</div>`;
      return;
    }
    S.resultsEl.innerHTML = S.results.map(r => `
      <button class="scrapbookSearchItem${r.key === S.selectedKey ? ' active' : ''}" type="button" data-result-key="${escapeHtml(r.key)}">
        <div class="scrapbookSearchMeta">${escapeHtml(r.meta || '')}</div>
        <div class="scrapbookSearchTitle">${escapeHtml(r.title || '')}</div>
        <div class="scrapbookSearchSnippet">${escapeHtml(r.snippet || '')}</div>
      </button>`).join('');
    S.resultsEl.querySelectorAll('[data-result-key]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await activateScrapbookSearchResult(String(btn.getAttribute('data-result-key') || ''));
      });
    });
  }

  function requestAnimationFramePromise(){
    return new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
  }

  function findScrapbookSearchTargetElement(result){
    const elements = Array.isArray(Scene.elements) ? Scene.elements : [];
    if (!result || !result.elementId) return null;

    const matchesById = elements.filter(e => e && e.id === result.elementId);
    if (matchesById.length === 1) return matchesById[0];

    // Imported layout pages can contain repeated element IDs when a page has
    // been duplicated or imported from older JSON.  Search results therefore
    // store the element's page-local index and text snapshot as a deterministic
    // fallback.  Prefer exact id+index, then index+type+text, then first id.
    const idx = Number(result.elementIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < elements.length) {
      const candidate = elements[idx];
      if (candidate && (!result.elementType || candidate.type === result.elementType)) {
        const expectedText = String(result.elementText ?? '');
        const actualText = String(
          candidate.text ??
          candidate.searchTag ??
          candidate.codepoint ??
          ''
        );
        if (!expectedText || actualText === expectedText || actualText.includes(expectedText)) return candidate;
      }
    }

    return matchesById[0] || null;
  }

  function keepElementVisibleForSearchActivation(el){
    if (!el || !wrap || !Scene?.view) return false;
    const rect = wrap.getBoundingClientRect();
    const vw = Math.max(1, Number(rect.width) || 1);
    const vh = Math.max(1, Number(rect.height) || 1);
    const margin = 48;
    const cx = Number(el.x || 0) + Number(el.w || 0) / 2;
    const cy = Number(el.y || 0) + Number(el.h || 0) / 2;
    const screen = stageToScreen({ x: cx, y: cy });
    if (
      screen.x >= margin && screen.x <= vw - margin &&
      screen.y >= margin && screen.y <= vh - margin
    ) return false;

    const z = Math.max(0.0001, Number(Scene.view.zoom) || 1);
    Scene.view.offsetX = (vw / 2) / z - cx;
    Scene.view.offsetY = (vh / 2) / z - cy;
    return true;
  }

  async function selectScrapbookSearchResultElement(result){
    // Let any atomic page swap complete before drawing the selection overlay.
    // Selection is visual/editor state; it must not trigger a full SVG rebuild.
    for (let i = 0; i < 4 && liveSceneAtomicDepth > 0; i++) {
      await requestAnimationFramePromise();
    }

    const el = findScrapbookSearchTargetElement(result);
    if (!el) {
      refreshScrapbookSearchResults(true);
      return false;
    }

    selectedIds = new Set([el.id]);
    setTool(Tool.Select);
    updateUiForSelection();

    const movedView = keepElementVisibleForSearchActivation(el);
    if (movedView) {
      // Reposition the already-built SVG under the same viewport transform as
      // the overlay.  Do not rebuild content; only pan the view to the result.
      positionLiveSvgElement(document.getElementById("svgStageHost")?.querySelector("svg"));
    }
    renderInteractionOverlay();
    return true;
  }

  async function activateScrapbookSearchResult(resultKey){
    const S = ScrapbookSearchState;
    const result = S.results.find(r => r.key === resultKey);
    if (!result) {
      S.selectedKey = '';
      renderScrapbookSearchResults();
      return;
    }
    S.selectedKey = result.key;
    if (result.pageId && ScrapbookState?.currentPageId !== result.pageId){
      await switchToPage(result.pageId, { commitHistory: false });
    }
    if (result.elementId){
      const selected = await selectScrapbookSearchResultElement(result);
      if (!selected) return;
    } else {
      clearSelection();
      renderInteractionOverlay();
    }
    renderScrapbookSearchResults();
  }

  function initScrapbookSearchWindow(){
    const S = ScrapbookSearchState;
    S.root = $('scrapbookSearchWindow');
    S.header = $('scrapbookSearchWindowHeader');
    S.input = $('scrapbookSearchInput');
    S.resultsEl = $('scrapbookSearchResults');
    S.closeBtn = $('btnCloseScrapbookSearch');
    S.runBtn = $('btnRunScrapbookSearch');
    if (!S.root || !S.header || !S.input || !S.resultsEl) return;
    S.closeBtn?.addEventListener('click', () => closeScrapbookSearchWindow());
    S.runBtn?.addEventListener('click', () => runScrapbookSearch());
    S.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runScrapbookSearch(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeScrapbookSearchWindow(); }
    });
    S.header.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.closest('button')) return;
      const rect = S.root.getBoundingClientRect();
      S.dragging = true;
      S.dragPointerId = e.pointerId;
      S.startX = e.clientX;
      S.startY = e.clientY;
      S.startLeft = rect.left;
      S.startTop = rect.top;
      S.header.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    S.header.addEventListener('pointermove', (e) => {
      if (!S.dragging || S.dragPointerId !== e.pointerId) return;
      const dx = e.clientX - S.startX;
      const dy = e.clientY - S.startY;
      S.root.style.left = `${S.startLeft + dx}px`;
      S.root.style.top = `${S.startTop + dy}px`;
      clampScrapbookSearchWindowToViewport();
    });
    const stopDrag = (e) => {
      if (!S.dragging) return;
      if (e && S.dragPointerId != null && e.pointerId !== S.dragPointerId) return;
      S.dragging = false;
      if (S.dragPointerId != null) S.header.releasePointerCapture?.(S.dragPointerId);
      S.dragPointerId = null;
    };
    S.header.addEventListener('pointerup', stopDrag);
    S.header.addEventListener('pointercancel', stopDrag);
    window.addEventListener('resize', () => clampScrapbookSearchWindowToViewport());
    renderScrapbookSearchResults();
  }

  function buildDocumentSnapshotForHistory(){
    if (!ScrapbookState?.doc) return null;
    // Deep-clone the document but STRIP all asset dataUrl strings.
    // Assets are immutable and content-addressed — they live in ScrapbookState.doc.assets
    // and are looked up by ID on restore. Storing full data URLs in every undo entry
    // (up to History.max copies) causes catastrophic memory growth with embedded
    // images, audio, and video.
    const doc = deep(ScrapbookState.doc);
    const currentPageId = ScrapbookState.currentPageId || doc.currentPageId || doc.pages?.[0]?.id || null;
    const currentPage = doc.pages.find(p => p.id === currentPageId);
    if (currentPage){
      currentPage.payload = snapshotCurrentPagePayload();
      currentPage.thumbnail = String(currentPage.thumbnail || '');
    }
    doc.currentPageId = currentPageId;
    doc.meta = doc.meta || {};
    // Strip dataUrl from all asset entries — keep only id/kind/mime/hash for reference
    const stripAssets = (serialized) => {
      const list = Array.isArray(serialized?.byId) ? serialized.byId : (Array.isArray(serialized) ? serialized : []);
      return { byId: list.map(a => ({ id: a.id, kind: a.kind, mime: a.mime, hash: a.hash })) };
    };
    doc.assets = stripAssets(collectDocumentAssets(doc));
    for (const page of (doc.pages || [])){
      if (page?.payload?.assets) page.payload.assets = stripAssets(page.payload.assets);
    }
    return doc;
  }
  async function loadDocumentSnapshotIntoEditor(doc, reason = 'Restore document'){
    const uiLoadToken = nextScrapbookUiLoadToken();
    // History snapshots have stripped asset dataUrls (only id/kind/mime/hash stored).
    // Re-hydrate them from the live canonical asset store before normalizing.
    const liveAssetMap = new Map();
    const liveList = Array.isArray(ScrapbookState?.doc?.assets?.byId) ? ScrapbookState.doc.assets.byId : [];
    for (const a of liveList) if (a?.id && a?.dataUrl) liveAssetMap.set(a.id, a);
    const rehydrate = (serialized) => {
      const list = Array.isArray(serialized?.byId) ? serialized.byId : [];
      return { byId: list.map(a => liveAssetMap.get(a?.id) || a).filter(a => a?.dataUrl) };
    };
    if (doc?.assets) doc.assets = rehydrate(doc.assets);
    for (const page of (doc?.pages || [])){
      if (page?.payload?.assets) page.payload.assets = rehydrate(page.payload.assets);
    }
    const normalizedDoc = normalizeScrapbookDocument(doc);
    closePresentation();
    ScrapbookState.doc = normalizedDoc;
    ScrapbookState.currentPageId = normalizedDoc.currentPageId;
    bindScrapbookCartoucheDbDocumentToApp();
    const page = getCurrentPage() || normalizedDoc.pages[0];
    closeTransientEditorsForPageSwitch();
    await loadPagePayloadIntoEditor(page.payload, reason, { preserveHistory: true });
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    applyDocumentLanguage();
    // Regenerate thumbnail for the current page only
    page.thumbnail = await renderCurrentPageDataUrl(160, 110, false, true);
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
    ScrapbookState.lastEditorHash = sceneFingerprint();
    renderScrapbookSidebar();
    refreshCurrentPagePropertiesWindow();
    refreshScrapbookSearchResults(true);
    debounceScrapbookSave();
  }
  function getCurrentPage(){
    if (!ScrapbookState) return null;
    return ScrapbookState.doc.pages.find(p => p.id === ScrapbookState.currentPageId) || null;
  }
  function closeTransientEditorsForPageSwitch(){
    // NOTE: Do NOT close the floating text editor here — it is persistent and
    // stays open across page switches. refreshFloatingEditorForSelection() will
    // update its content once the new page's selection state is established.
    try { clearSelection(); } catch {}
    try { updateUiForSelection(); } catch {}
    try { render(); } catch {}
  }
  function flushActiveScrapbookUiEdits(){
    try {
      const active = document.activeElement;
      if (!active || typeof active.blur !== 'function') return;
      if (
        active.closest?.('#scrapbookDocSidebar') ||
        active.closest?.('.topbar') ||
        active.closest?.('#sbPresentationOverlay')
      ){
        active.blur();
      }
    } catch {}
  }

  function applyDocumentLanguage(){
    try {
      const lang = String(ScrapbookState?.doc?.meta?.language || 'en');
      if (langSel && (lang === 'en' || lang === 'tp')){
        langSel.value = lang;
        if (typeof setLanguage === 'function') setLanguage(lang);
      }
    } catch {}
  }
  async function syncEditorIntoCurrentPage(updateThumb = true){
    const page = getCurrentPage();
    if (!page) return;
    if (ScrapbookState?.doc?.meta && langSel) ScrapbookState.doc.meta.language = String(langSel.value || 'en');
    page.payload = snapshotCurrentPagePayload();
    if (updateThumb) page.thumbnail = await renderCurrentPageDataUrl(160, 110, false, true);
    if (ScrapbookState?.doc) ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
    debounceScrapbookSave();
    renderScrapbookSidebar();
  }
  function blankPayloadFromSnapshot(basePayload){
    const payload = deep(basePayload || snapshotCurrentPagePayload());
    payload.scene.meta = payload.scene.meta || {};
    payload.scene.elements = [];
    payload.scene.groups = [];
    payload.scene.view = payload.scene.view || {};
    // Reset stage background to default — old document colours must not carry
    // forward into a brand new document.
    if (payload.scene.stage){
      payload.scene.stage.bg = DEFAULTS.stageBg;
      payload.scene.stage.bgImgEnabled = false;
      payload.scene.stage.bgImgAssetId = null;
    }
    return payload;
  }
  function createDocumentFromPayload(payload){
    const firstPageId = uid('page');
    if (!payload || typeof payload !== 'object') payload = { scene: {} };
    payload.scene = payload.scene || {};
    payload.scene.stage = payload.scene.stage || {};
    // New scrapbook documents should start with abbreviated numeric cartouches ON.
    // Legacy/imported documents are still normalized separately with missing values OFF.
    payload.scene.stage.defaultAbbreviateNumericCartouches = true;
    const st = Object.assign({}, Scene.stage || {}, payload.scene.stage || {}, { defaultAbbreviateNumericCartouches: true });
    const documentDefaults = normalizeScrapbookDocumentDefaults({ defaultAbbreviateNumericCartouches: true }, st);
    return {
      format: 'StaticScrapbookDocument',
      version: 1,
      exportedAt: new Date().toISOString(),
      meta: { title: 'Untitled document', subtitle: '', documentType: 'scrapbook', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), language: (langSel?.value || 'en') },
      documentDefaults,
      assets: deep(payload?.assets || serializeAssets()),
      pages: [{ id: firstPageId, kind: 'page', name: 'Page 1', notes: '', tags: [], thumbnail: '', payload: deep(payload) }],
      currentPageId: firstPageId,
      cartoucheDb: normalizeScrapbookCartoucheDb(null),
      settings: { includeCoverPageInExport: true, coverDateAbbreviateNumericCartouche: true, mediaGuards: { image: true, audio: true, video: true }, youtubeExportInfo: { pngSingle: true, png: true, html: true, pdf: true } },
    };
  }

  function applyDocumentDefaultsToPayload(payload){
    const docDefaults = ScrapbookState?.doc?.documentDefaults || {};
    payload = deep(payload);
    payload.scene = payload.scene || {};
    payload.scene.meta = payload.scene.meta || {};
    payload.scene.stage = payload.scene.stage || {};
    const st = payload.scene.stage;
    st.w = clamp(Math.round(Number(docDefaults.pageWidth) || st.w || Scene.stage.w || 1280), 64, 12000);
    st.h = clamp(Math.round(Number(docDefaults.pageHeight) || st.h || Scene.stage.h || 800), 64, 12000);
    st.showGrid = !!docDefaults.showGrid;
    st.gridSize = Number.isFinite(Number(docDefaults.gridSize)) ? Number(docDefaults.gridSize) : (st.gridSize || 20);
    st.snapGrid = !!docDefaults.snapGrid;
    st.snapObjects = !!docDefaults.snapObjects;
    st.snapTol = Number.isFinite(Number(docDefaults.snapTol)) ? Number(docDefaults.snapTol) : (st.snapTol || 6);
    st.bg = docDefaults.stageBg || st.bg || '#FFFFFF';
    st.exportStageBackground = !!docDefaults.exportStageBackground;
    st.bgImgEnabled = !!docDefaults.bgImgEnabled;
    st.bgImgAssetId = docDefaults.bgImgAssetId || null;
    st.bgImgKeepAspect = !!(docDefaults.bgImgKeepAspect ?? DEFAULTS.bgImgKeepAspect);
    st.bgImgStretch = !!(docDefaults.bgImgStretch ?? DEFAULTS.bgImgStretch);
    st.defaultRenderFontPreset = normalizeRenderFontPresetKey(docDefaults.defaultRenderFontPreset || st.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
    
    st.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(
      docDefaults.defaultTextFontOption || FONT_FAMILY_LITERAL,
      st.defaultRenderFontPreset
    );
    st.defaultAbbreviateNumericCartouches = !!(docDefaults.defaultAbbreviateNumericCartouches ?? st.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches);
    st.defaultPreserveCenterOnAutoResize = !!(docDefaults.defaultPreserveCenterOnAutoResize ?? st.defaultPreserveCenterOnAutoResize ?? DEFAULTS.defaultPreserveCenterOnAutoResize);
    st.defaultSpacingPreset = normalizeSpacingPreset(docDefaults.defaultSpacingPreset ?? st.defaultSpacingPreset ?? DEFAULTS.defaultSpacingPreset);

    st.defaultTextColor = docDefaults.defaultTextColor || st.defaultTextColor || DEFAULTS.defaultTextColor;
    st.defaultIgnoreUnknownText = !!(docDefaults.defaultIgnoreUnknownText ?? st.defaultIgnoreUnknownText ?? DEFAULTS.defaultIgnoreUnknownText);
    st.defaultFill = docDefaults.defaultFill ?? st.defaultFill ?? DEFAULTS.defaultFill;
    st.defaultFillEnabled = !!(docDefaults.defaultFillEnabled ?? st.defaultFillEnabled ?? DEFAULTS.defaultFillEnabled);
    st.defaultStroke = docDefaults.defaultStroke ?? st.defaultStroke ?? DEFAULTS.defaultStroke;
    st.defaultStrokeW = Number.isFinite(Number(docDefaults.defaultStrokeW)) ? Number(docDefaults.defaultStrokeW) : (st.defaultStrokeW ?? DEFAULTS.defaultStrokeW);
    st.defaultHaloEnabled = !!(docDefaults.defaultHaloEnabled ?? st.defaultHaloEnabled ?? DEFAULTS.defaultHaloEnabled);
    st.defaultHaloColor = docDefaults.defaultHaloColor ?? st.defaultHaloColor ?? DEFAULTS.defaultHaloColor;
    st.defaultHaloThicknessPx = Number.isFinite(Number(docDefaults.defaultHaloThicknessPx)) ? Number(docDefaults.defaultHaloThicknessPx) : (st.defaultHaloThicknessPx ?? DEFAULTS.defaultHaloThicknessPx);
    st.defaultHaloThicknessMode = docDefaults.defaultHaloThicknessMode || st.defaultHaloThicknessMode || DEFAULTS.defaultHaloThicknessMode;
    if (ScrapbookState?.doc?.assets) payload.assets = deep(ScrapbookState.doc.assets);
    return payload;
  }

  function makeTemplateText(x, y, text, fontSize = 28, w = 320, h = 90){
    const el = newSitelenElement(x, y);
    el.text = text;
    el.fontSize = fontSize;
    el.w = w;
    el.h = h;
    el.keepAspect = false;
    return el;
  }

  function makeTemplateRect(x, y, w, h, fill = '#F6F1E8'){
    const el = newRectElement(x, y);
    el.w = w; el.h = h;
    el.fillEnabled = true;
    el.fill = fill;
    el.stroke = '#D3C7B7';
    el.strokeW = 2;
    return el;
  }

  function diaryDateLabel(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function buildTemplatePayload(kind = 'blank'){
    let payload = blankPayloadFromSnapshot(snapshotCurrentPagePayload());
    payload = applyDocumentDefaultsToPayload(payload);
    const scene = payload.scene;
    const st = scene.stage;
    const margin = 48;
    const fullW = st.w || 1280;
    const fullH = st.h || 800;
    if (kind === 'title'){
      scene.elements.push(makeTemplateText(margin, 80, 'nimi suli', 54, fullW - margin*2, 100));
      const sub = makeTemplateText(margin, 180, 'nimi lili', 28, fullW - margin*2, 70);
      sub.opacity = 0.85;
      scene.elements.push(sub);
      scene.meta.title = 'Title slide';
    } else if (kind === 'content'){
      scene.elements.push(makeTemplateText(margin, 50, 'nimi lipu', 42, fullW - margin*2, 80));
      scene.elements.push(makeTemplateText(margin, 150, 'ijo nanpa wan\nijo nanpa tu\nijo nanpa seli', 28, fullW - margin*2, fullH - 210));
      scene.meta.title = 'Content slide';
    } else if (kind === 'diary'){
      const hdr = makeTemplateRect(margin, margin, fullW - margin*2, 92, '#F4EBD7');
      hdr.isLocked = true;
      scene.elements.push(hdr);
      const title = makeTemplateText(margin + 18, margin + 12, 'nimi lipu mi', 34, fullW * 0.62, 54);
      title.isLocked = true;
      scene.elements.push(title);
      const date = makeTemplateText(fullW - margin - 360, margin + 12, diaryDateLabel(), 24, 320, 48);
      date.align = 'right';
      // The diary date is a sitelen element containing a numeric date string.
      // Match the document/page default so new diary pages respect the user's
      // abbreviated numeric cartouche preference instead of always using the
      // global Scene default from the currently displayed page.
      date.abbreviateNumericCartouches = !!(scene?.stage?.defaultAbbreviateNumericCartouches ?? DEFAULTS.defaultAbbreviateNumericCartouches);
      date.isLocked = true;
      scene.elements.push(date);
      const body = makeTemplateText(margin, 170, 'o sitelen lon ni', 28, fullW - margin*2, fullH - 220);
      scene.elements.push(body);
      scene.meta.title = 'Diary entry';
    } else if (kind === 'photoCaption'){
      const photo = makeTemplateRect(margin, 100, Math.round(fullW * 0.58), fullH - 180, '#EFE7DB');
      photo.isLocked = true;
      scene.elements.push(photo);
      const ph = makeTemplateText(margin + 24, 120, 'tomo sitelen', 30, photo.w - 48, 60);
      ph.isLocked = true;
      scene.elements.push(ph);
      scene.elements.push(makeTemplateText(Math.round(fullW * 0.66), 110, 'nimi pi sitelen', 34, fullW - Math.round(fullW * 0.66) - margin, 60));
      scene.elements.push(makeTemplateText(Math.round(fullW * 0.66), 190, 'toki pi sitelen', 26, fullW - Math.round(fullW * 0.66) - margin, fullH - 240));
      scene.meta.title = 'Photo with caption';
    } else if (kind === 'quote'){
      const q = makeTemplateText(110, Math.round(fullH*0.24), 'toki ni li lon', 46, fullW - 220, 180);
      q.align = 'center';
      scene.elements.push(q);
      const a = makeTemplateText(140, Math.round(fullH*0.62), '— jan', 28, fullW - 280, 60);
      a.align = 'right';
      scene.elements.push(a);
      scene.meta.title = 'Quote';
    } else if (kind === 'collage'){
      const boxes = [
        [margin, 80, Math.round(fullW*0.38), Math.round(fullH*0.32)],
        [Math.round(fullW*0.42), 80, Math.round(fullW*0.26), Math.round(fullH*0.22)],
        [Math.round(fullW*0.70), 80, fullW - Math.round(fullW*0.70) - margin, Math.round(fullH*0.42)],
        [margin, Math.round(fullH*0.46), Math.round(fullW*0.32), fullH - Math.round(fullH*0.46) - 90],
        [Math.round(fullW*0.36), Math.round(fullH*0.36), Math.round(fullW*0.30), fullH - Math.round(fullH*0.36) - 90],
      ];
      for (const [x,y,w,h] of boxes){
        const r = makeTemplateRect(x,y,w,h,'#EFE7DB'); r.isLocked = true; scene.elements.push(r);
      }
      scene.elements.push(makeTemplateText(margin, 24, 'kulupu sitelen', 34, fullW - margin*2, 48));
      scene.meta.title = 'Collage';
    } else {
      scene.meta.title = '';
    }
    return payload;
  }
  function ensureDocMetaBindings(docRoot){
    const titleInput = docRoot.querySelector('#sbDocTitle');
    const subtitleInput = docRoot.querySelector('#sbDocSubtitle');
    const typeSel = docRoot.querySelector('#sbDocType');
    if (titleInput) titleInput.oninput = () => {
      ScrapbookState.doc.meta.title = titleInput.value;
      const propTitle = document.getElementById('sbDocPropTitle');
      if (propTitle && propTitle.value !== titleInput.value) propTitle.value = titleInput.value;
      debounceScrapbookSave();
    };
    if (subtitleInput) subtitleInput.oninput = () => { ScrapbookState.doc.meta.subtitle = subtitleInput.value; debounceScrapbookSave(); };
    if (typeSel) typeSel.onchange = () => { ScrapbookState.doc.meta.documentType = typeSel.value; debounceScrapbookSave(); };
  }
  function escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function slug(value){
    return String(value || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'file';
  }
  function svgEsc(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function svgNum(value, fallback = 0){
    const n = Number(value);
    if (!Number.isFinite(n)) return String(fallback);
    return String(Math.round(n * 1000) / 1000);
  }

  function svgColor(value, fallback = "#111111"){
    const s = String(value ?? "").trim();
    if (!s) return fallback;
    if (s === "transparent" || s === "none") return s;
    return s;
  }

  function elementHasFillPaint(el){
    const fill = String(el?.fill ?? "").trim();
    return !!(
      el?.fillEnabled &&
      fill &&
      fill !== "transparent" &&
      fill !== "none" &&
      fill !== "rgba(255,255,255,0.0)" &&
      fill !== "rgba(255, 255, 255, 0)"
    );
  }

  function elementFillPaint(el){
    return elementHasFillPaint(el) ? svgColor(el.fill) : "none";
  }

  function elementStrokePaint(el, fallback = "rgba(17,17,17,0.35)"){
    const strokeW = Number(el?.strokeW ?? 0);
    if (!(strokeW > 0)) return { stroke: "none", strokeWidth: 0 };
    return { stroke: svgColor(el?.stroke || fallback), strokeWidth: strokeW };
  }

  function svgCssFontFamily(family){
    return cssFontFamily(family).replace(/"/g, "'");
  }

  function svgSitelenPreserveAspectRatio(el){
    if (el && el.keepAspect === false) return "none";
    const align = String(el?.align || "left").trim().toLowerCase();
    if (align === "right") return "xMaxYMin meet";
    if (align === "center") return "xMidYMin meet";
    return "xMinYMin meet";
  }

  const svgVectorElementCache = new Map();
  const svgRasterPreviewCache = new Map();
  let liveSvgRenderSeq = 0;
  let liveSvgRenderSuspended = false;
  let liveSceneAtomicDepth = 0;

  function beginAtomicLiveSceneUpdate(){
    liveSceneAtomicDepth += 1;
    liveSvgRenderSuspended = true;
    // Invalidate any async live SVG build that was started for the previous page.
    liveSvgRenderSeq += 1;
    return liveSceneAtomicDepth;
  }

  function endAtomicLiveSceneUpdate(token){
    if (liveSceneAtomicDepth > 0 && (!token || token === liveSceneAtomicDepth)) {
      liveSceneAtomicDepth -= 1;
    }
    if (liveSceneAtomicDepth <= 0) {
      liveSceneAtomicDepth = 0;
      liveSvgRenderSuspended = false;
    }
  }

  function clearSvgVectorElementCache(){
    svgVectorElementCache.clear();
    svgRasterPreviewCache.clear();
  }

  function invalidateSvgElementCaches(elId){
    const id = String(elId || "");
    if (!id) return;
    for (const k of Array.from(svgVectorElementCache.keys())) {
      if (k.startsWith(`${id}|`)) svgVectorElementCache.delete(k);
    }
    for (const k of Array.from(svgRasterPreviewCache.keys())) {
      if (k.startsWith(`${id}|`)) svgRasterPreviewCache.delete(k);
    }
  }

  function getVectorOffsetFontFamily(el){
    if (!el) return "";
    if (el.type === ElementType.Text) return getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
    if (el.type === ElementType.Sitelen) return getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT;
    if (el.type === ElementType.Glyph) return getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT;
    return "";
  }

  function firstFiniteNumber(...values){
    for (const value of values){
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function vectorPlacementCandidates(el){
    if (!el) return [];
    const table = Scene?.stage?.vectorDisplayOffsets || {};
    const family = getVectorOffsetFontFamily(el);
    const type = String(el.type || "");
    const byFont = family && table && typeof table === "object" ? table[family] : null;
    return [
      byFont && typeof byFont === "object" ? byFont[type] : undefined,
      byFont && typeof byFont === "object" ? byFont.default : undefined,
      table && typeof table === "object" ? table[type] : undefined,
      table && typeof table === "object" ? table.default : undefined
    ];
  }

  function vectorPlacementNumberFromEntry(entry, names){
    if (entry == null) return null;
    if (typeof entry === "number" || typeof entry === "string") {
      const n = Number(entry);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof entry === "object") {
      for (const name of names){
        const n = Number(entry[name]);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  }

  function lookupVectorPlacementNumber(el, names, fallback){
    const directNames = Array.isArray(names) ? names : [names];
    for (const name of directNames){
      const direct = Number(el?.[`vector${String(name).slice(0,1).toUpperCase()}${String(name).slice(1)}Em`]);
      if (Number.isFinite(direct)) return direct;
      const directPlain = Number(el?.[`vector${String(name).slice(0,1).toUpperCase()}${String(name).slice(1)}`]);
      if (Number.isFinite(directPlain)) return directPlain;
    }
    for (const entry of vectorPlacementCandidates(el)){
      const n = vectorPlacementNumberFromEntry(entry, directNames);
      if (n != null) return n;
    }
    return fallback;
  }

  function lookupVectorYOffsetEm(el){
    if (!el) return 0;
    const direct = firstFiniteNumber(el.vectorYOffsetEm);
    if (direct != null) return direct;
    return lookupVectorPlacementNumber(el, ["y", "yOffset", "yOffsetEm", "offset"], 0);
  }

  function lookupVectorXOffsetEm(el){
    if (!el) return 0;
    const direct = firstFiniteNumber(el.vectorXOffsetEm);
    if (direct != null) return direct;
    return lookupVectorPlacementNumber(el, ["x", "xOffset", "xOffsetEm"], 0);
  }

  function lookupVectorScale(el){
    if (!el) return 1;
    const direct = firstFiniteNumber(el.vectorScale);
    if (direct != null) return Math.max(0.05, direct);
    const n = lookupVectorPlacementNumber(el, ["scale", "scaleFactor"], 1);
    return Math.max(0.05, Number.isFinite(n) ? n : 1);
  }

  function vectorYOffsetPx(el){
    const fontPx = Math.max(6, Number(el?.fontSize ?? 24));
    return fontPx * lookupVectorYOffsetEm(el);
  }

  function vectorXOffsetPx(el){
    const fontPx = Math.max(6, Number(el?.fontSize ?? 24));
    return fontPx * lookupVectorXOffsetEm(el);
  }

  function svgElementInnerCacheKey(el){
    return JSON.stringify({
      vectorExportBridgeVersion: 17,
      type: el?.type,
      w: Number(el?.w || 0), h: Number(el?.h || 0),
      text: String(el?.text ?? ""), codepoint: String(el?.codepoint ?? ""),
      imageAssetId: String(el?.image?.assetId || ""),
      fill: String(el?.fill ?? ""), fillEnabled: !!el?.fillEnabled,
      stroke: String(el?.stroke ?? ""), strokeW: Number(el?.strokeW ?? 0),
      color: String(el?.color ?? ""), opacity: Number(el?.opacity ?? 1),
      radius: Number(el?.radius ?? 0),
      fontSize: Number(el?.fontSize ?? 0), fontFamily: String(el?.fontFamily ?? ""),
      quotedTextFontOption: String(el?.quotedTextFontOption ?? ""),
      renderFontPreset: getElementRenderFontPresetKey(el),
      textFontFamily: getElementResolvedTextFontFamily(el),
      quotedTextFontFamily: getElementResolvedQuotedTextFontFamily(el),
      literalCartoucheFamily: (el?.type === ElementType.Sitelen) ? getElementLiteralCartoucheFontFamily(el) : '',
      literalCartoucheSettings: (el?.type === ElementType.Sitelen) ? getElementLiteralCartoucheSettings(el) : null,
      align: String(el?.align ?? ""), lineHeight: Number(el?.lineHeight ?? 0),
      spacingPreset: getElementSpacingPreset(el),
      abbreviateNumericCartouches: !!(el?.type === ElementType.Sitelen && getElementAbbreviateNumericCartouches(el)),
      ignoreUnknownText: !!el?.ignoreUnknownText,
      haloEnabled: !!el?.haloEnabled, haloColor: String(el?.haloColor ?? ""),
      haloMode: String(el?.haloThicknessMode ?? ""), haloThickness: Number(el?.haloThickness ?? 0),
      vectorYOffsetEm: lookupVectorYOffsetEm(el),
      vectorXOffsetEm: lookupVectorXOffsetEm(el),
      vectorScale: lookupVectorScale(el),
      vectorPlacementMode: String(el?.vectorPlacementMode || ""),
      vectorGlyphTightMetrics: el?.vectorGlyphTightMetrics || null,
      vectorSitelenTightMetrics: el?.vectorSitelenTightMetrics || null
    });
  }

  function svgGroupTransformForElement(el){
    const cx = Number(el.x || 0) + Number(el.w || 0) / 2;
    const cy = Number(el.y || 0) + Number(el.h || 0) / 2;
    const rot = Number(el.rotationDeg || 0);
    return `translate(${svgNum(cx)} ${svgNum(cy)}) rotate(${svgNum(rot)})`;
  }

  function svgRectNode({x, y, w, h, r = 0, fill = "none", stroke = "none", strokeWidth = 0, opacity = null} = {}){
    const attrs = [
      `x="${svgNum(x)}"`, `y="${svgNum(y)}"`,
      `width="${svgNum(Math.max(0, Number(w || 0)))}"`,
      `height="${svgNum(Math.max(0, Number(h || 0)))}"`,
      `rx="${svgNum(Math.max(0, Number(r || 0)))}"`,
      `ry="${svgNum(Math.max(0, Number(r || 0)))}"`,
      `fill="${svgEsc(fill)}"`,
      `stroke="${svgEsc(stroke)}"`,
      `stroke-width="${svgNum(strokeWidth)}"`
    ];
    if (opacity != null) attrs.push(`opacity="${svgNum(opacity)}"`);
    return `<rect ${attrs.join(" ")} />`;
  }

  function crc32(bytes) {
    let c = -1;
    for (let i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (c ^ -1) >>> 0;
  }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function concatUint8(arrays) { const total = arrays.reduce((n,a)=>n+a.length,0); const out = new Uint8Array(total); let off=0; for (const a of arrays) { out.set(a, off); off += a.length; } return out; }
  async function buildStoredZip(files) {
    const enc = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = enc.encode(file.name);
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = crc32(data);
      const local = concatUint8([
        new Uint8Array([0x50,0x4b,0x03,0x04]), new Uint8Array(u16(20)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u32(crc)), new Uint8Array(u32(data.length)), new Uint8Array(u32(data.length)), new Uint8Array(u16(nameBytes.length)), new Uint8Array(u16(0)), nameBytes, data
      ]);
      localParts.push(local);
      const central = concatUint8([
        new Uint8Array([0x50,0x4b,0x01,0x02]), new Uint8Array(u16(20)), new Uint8Array(u16(20)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u32(crc)), new Uint8Array(u32(data.length)), new Uint8Array(u32(data.length)), new Uint8Array(u16(nameBytes.length)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u32(0)), new Uint8Array(u32(offset)), nameBytes
      ]);
      centralParts.push(central);
      offset += local.length;
    }
    const centralStart = offset;
    const centralBytes = concatUint8(centralParts);
    const end = concatUint8([
      new Uint8Array([0x50,0x4b,0x05,0x06]), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(files.length)), new Uint8Array(u16(files.length)), new Uint8Array(u32(centralBytes.length)), new Uint8Array(u32(centralStart)), new Uint8Array(u16(0))
    ]);
    return new Blob([concatUint8([...localParts, centralBytes, end])], { type: 'application/zip' });
  }
  async function blobToUint8Array(blob) { return new Uint8Array(await blob.arrayBuffer()); }

  function getPagePayload(page, options = {}){
    // v27: page export must not trust a stale stored payload for the currently
    // open scrapbook page.  A just-imported page JSON/layout JSON lives first in
    // the live editor Scene/Assets; if the stored payload was not refreshed yet,
    // exporting page.payload can repeat the previous page.  Callers that are
    // building output should request preferLiveCurrent so the active page is
    // snapshotted directly from the editor.
    if (
      options && options.preferLiveCurrent === true &&
      ScrapbookState && page && page.id === ScrapbookState.currentPageId
    ){
      return snapshotCurrentPagePayload();
    }
    return (page && (page.payload || page.scene || page)) || null;
  }

  function commitLiveEditorIntoCurrentScrapbookPageNow({ updateThumb = false } = {}){
    if (!ScrapbookState?.doc) return null;
    const page = getCurrentPage();
    if (!page) return null;
    // Store an immediate, synchronous payload snapshot before any thumbnail work.
    // This is the authoritative fix for imported-page exports: the document page
    // record must contain the live imported Scene before PDF/SVG/PNG/HTML loops
    // start reading doc.pages.
    page.payload = snapshotCurrentPagePayload();
    ScrapbookState.doc.currentPageId = ScrapbookState.currentPageId;
    ScrapbookState.lastEditorHash = sceneFingerprint();
    if (ScrapbookState.doc) ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
    debounceScrapbookSave();
    if (updateThumb) {
      // Fire-and-forget; exports must not wait on thumbnail generation, and the
      // page payload has already been committed above.
      renderCurrentPageDataUrl(160, 110, false, true)
        .then(dataUrl => { page.thumbnail = dataUrl || page.thumbnail || ''; debounceScrapbookSave(); try { renderScrapbookSidebar(); } catch {} })
        .catch(err => console.warn('Imported page thumbnail refresh failed:', err));
    }
    return page;
  }

  function sanitizeHotspotHref(rawHref){
    const href = String(rawHref || '').trim();
    if (!href) return '';
    // Block javascript/data/file/blob for exported clickable overlays.
    if (/^(javascript|data|file|blob):/i.test(href)) return '';
    // Allow common external/openable URL schemes and site-relative links.
    if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
    if (/^(\/|\.\/|\.\.\/|#)/.test(href)) return href;
    return href;
  }
  function collectPrintableHtmlHotspotsFromPayload(payload){
    const rawScene = payload && payload.scene ? payload.scene : payload;
    const normalized = normalizeScene(rawScene || {});
    const scene = validateAndSanitizeScene(normalized);
    const stage = scene.stage || {};
    const stageW = Math.max(1, Number(stage.w) || 1280);
    const stageH = Math.max(1, Number(stage.h) || 800);
    const hotspots = [];
    for (const el of (scene.elements || [])){
      if (!el || el.type !== ElementType.Url) continue;
      if (el.exportVisible === false) continue;
      const href = sanitizeHotspotHref(el.url && el.url.href);
      if (!href) continue;
      const x = Number(el.x) || 0;
      const y = Number(el.y) || 0;
      const w = Math.max(0, Number(el.w) || 0);
      const h = Math.max(0, Number(el.h) || 0);
      if (!(w > 0 && h > 0)) continue;
      hotspots.push({
        href,
        title: String((el.url && el.url.title) || el.title || href),
        x,
        y,
        w,
        h,
        rotationDeg: Number(el.rotationDeg) || 0,
      });
    }
    return { stageW, stageH, hotspots };
  }
  function hotspotToHtml(hotspot, stageW, stageH, pageName){
    const leftPct = (100 * hotspot.x / Math.max(1, stageW)).toFixed(6);
    const topPct = (100 * hotspot.y / Math.max(1, stageH)).toFixed(6);
    const widthPct = (100 * hotspot.w / Math.max(1, stageW)).toFixed(6);
    const heightPct = (100 * hotspot.h / Math.max(1, stageH)).toFixed(6);
    const rotationDeg = Number(hotspot.rotationDeg) || 0;
    const title = escapeHtml(hotspot.title || hotspot.href || pageName || 'Link');
    const label = escapeHtml(pageName ? `${pageName}: ${hotspot.href}` : hotspot.href);
    const transform = rotationDeg ? ` transform:rotate(${rotationDeg}deg); transform-origin:center center;` : '';
    const style = `left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%;${transform}`;
    return `<a class="hotspotLink" href="${escapeHtml(hotspot.href)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${title}" style="${style}"></a>`;
  }

  // Render a page payload to a data URL entirely offscreen — the live Scene,
  // Assets store, and editor state are never touched. Safe to call for any page
  // without flickering or disrupting the current editor view.
  async function renderPagePayloadToDataUrl(payload, maxW = 0, maxH = 0, forExport = false, forceStageBackground = false){
    const rawScene = payload && payload.scene ? payload.scene : payload;
    const rawAssets = payload && payload.assets ? payload.assets : null;

    // Build a temporary local asset map from this page's payload
    const localAssets = new Map(); // assetId -> dataUrl
    const assetList = Array.isArray(rawAssets?.byId) ? rawAssets.byId
                    : Array.isArray(rawAssets) ? rawAssets : [];
    for (const a of assetList){
      if (a && a.id && a.dataUrl) localAssets.set(String(a.id), a);
    }
    // Helper to look up an asset from the local store, falling back to global Assets
    const getLocalDataUrl = (assetId) => {
      if (!assetId) return null;
      const local = localAssets.get(String(assetId));
      if (local) return String(local.dataUrl || '');
      return getAssetDataUrl(assetId); // fall back to global store
    };

    // Normalize the scene (validates elements, stage etc.) without touching live Scene
    const normalized = normalizeScene(rawScene || {});
    const scene = validateAndSanitizeScene(normalized);
    const stage = scene.stage || {};
    const elements = scene.elements || [];

    const stageW = Math.max(1, stage.w || 1280);
    const stageH = Math.max(1, stage.h || 800);
    let outW = stageW, outH = stageH;
    if (maxW > 0 || maxH > 0){
      const sx = maxW > 0 ? maxW / stageW : Infinity;
      const sy = maxH > 0 ? maxH / stageH : Infinity;
      const s = Math.min(sx, sy, 1);
      outW = Math.max(1, Math.round(stageW * s));
      outH = Math.max(1, Math.round(stageH * s));
    }

    const off = document.createElement('canvas');
    off.width = outW; off.height = outH;
    const octx = off.getContext('2d');
    octx.save();
    octx.scale(outW / stageW, outH / stageH);

    // Stage background
    if (forceStageBackground || stage.exportStageBackground){
      octx.fillStyle = stage.bg || '#FFFFFF';
      octx.fillRect(0, 0, stageW, stageH);
    }

    // Background image
    if (stage.bgImgEnabled && stage.bgImgAssetId){
      const dataUrl = getLocalDataUrl(stage.bgImgAssetId);
      if (dataUrl){
        const img = ensureImageLoadedFromDataUrl(dataUrl, '__payload_stageBgImage');
        if (img && img.naturalWidth > 0){
          const dest = computeBackgroundImageDestRect({
            stageW, stageH,
            natW: img.naturalWidth, natH: img.naturalHeight,
            stretch: !!stage.bgImgStretch,
            keepAspect: stage.bgImgKeepAspect !== false,
          });
          octx.save();
          octx.beginPath(); octx.rect(0, 0, stageW, stageH); octx.clip();
          octx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
          octx.restore();
        }
      }
    }

    // Pre-warm Sitelen and Glyph raster caches for elements on this page.
    // These caches are global but only populated when a page has been visited.
    // For unvisited pages (e.g. export-all on first load) we trigger the async
    // raster builds now and await them before drawing.
    const rasterJobs = [];
    for (const el of elements){
      if (el.type === ElementType.Sitelen){
        const sig = getElementRendererSignature(el);
        const cached = sitelenCache.get(el.id);
        if (!cached || cached.sig !== sig || !cached.canvas){
          rasterJobs.push(rebuildSitelenRasterWithRenderer(el, { preserveCenter: false }));
        }
      } else if (el.type === ElementType.Glyph){
        const sig = getElementRendererSignature(el);
        const cached = glyphCache.get(el.id);
        if (!cached || cached.sig !== sig || !cached.canvas){
          rasterJobs.push(rebuildGlyphRasterWithRenderer(el));
        }
      }
    }
    if (rasterJobs.length) await Promise.allSettled(rasterJobs);

    // Draw each element using a local-asset-aware version of drawElementToOffscreen
    for (const el of elements){
      _drawElementOffscreenFromPayload(octx, el, getLocalDataUrl, forExport);
    }

    octx.restore();
    const dataUrl = off.toDataURL('image/png');
    // Zero the canvas immediately to release GPU texture memory
    off.width = 1; off.height = 1;
    return dataUrl;
  }

  // Draw a single element offscreen using a local asset resolver.
  // Mirrors drawElementToOffscreen but reads images from getLocalDataUrl
  // instead of the global Assets / imageCache stores.
  function _drawElementOffscreenFromPayload(octx, el, getLocalDataUrl, forExport){
    // exportVisible guard
    const isMediaEl = el.type === ElementType.Audio || el.type === ElementType.Video || el.type === ElementType.Url;
    if (forExport && isMediaEl && el.exportVisible === false) return;

    octx.save();
    octx.globalAlpha = clamp(el.opacity ?? 1, 0, 1);
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    octx.translate(cx, cy);
    octx.rotate(rad(el.rotationDeg || 0));
    const x = -el.w / 2, y = -el.h / 2;
    const w = el.w, h = el.h;

    // Helper: load image from local asset store via shared cache.
    // Uses ensureImageLoadedFromAssetId so Images are allocated once and reused,
    // not created and discarded on every element draw call.
    const loadImg = (assetId, kindHint = 'asset') => {
      if (!assetId) return null;
      const dataUrl = getLocalDataUrl(assetId);
      if (!dataUrl) return null;
      return ensureImageLoadedFromDataUrl(dataUrl, `${el.id}__${kindHint}__${assetId}`);
    };

    // Helper: draw a poster image
    const drawPoster = (posterId, keepAspect) => {
      const img = loadImg(posterId, el.url ? 'poster' : 'vidposter');
      if (!img) return false;
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle = el.fill; octx.fillRect(x, y, w, h);
      }
      let dx=x, dy=y, dw=w, dh=h;
      if (keepAspect !== false){
        const s = Math.min(w/img.naturalWidth, h/img.naturalHeight);
        dw=img.naturalWidth*s; dh=img.naturalHeight*s; dx=x+(w-dw)/2; dy=y+(h-dh)/2;
      }
      octx.drawImage(img, dx, dy, dw, dh);
      if ((el.strokeW??0)>0){ octx.lineWidth=el.strokeW; octx.strokeStyle=el.stroke||"rgba(17,17,17,0.35)"; octx.strokeRect(x,y,w,h); }
      return true;
    };

    // Helper: simple media card label
    const drawCard = (label) => _drawMediaCardOffscreen(octx, el, x, y, w, h, label);

    if (el.type === ElementType.Rect){
      const r = el.radius ?? 0;
      if (el.fillEnabled && el.fill && el.fill !== "transparent"){
        octx.fillStyle = el.fill; roundedRectPathOff(octx, x,y,w,h,r); octx.fill();
      }
      if ((el.strokeW??0)>0){ octx.lineWidth=el.strokeW; octx.strokeStyle=el.stroke||"rgba(17,17,17,0.35)"; roundedRectPathOff(octx,x,y,w,h,r); octx.stroke(); }

    } else if (el.type === ElementType.Text){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle = el.fill; octx.fillRect(x,y,w,h);
      }
      const pad = 8, innerW = Math.max(0, w-pad*2);
      const fontSize = Math.max(6, el.fontSize ?? 24);
      const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
      const lineHeight = Math.max(0.8, el.lineHeight ?? 1.15);
      octx.fillStyle = el.color || "#111111";
      octx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
      octx.textBaseline = "top"; octx.textAlign = el.align || "left";
      const rawLines = splitLinesForBox(el.text);
      let ty = y + pad;
      for (const ln0 of rawLines){
        for (const wln of wrapLine(octx, String(ln0 ?? ""), innerW)){
          if (ty + fontSize * lineHeight > y + h + 0.5) break;
          const tx = el.align === "center" ? x+pad+innerW/2 : el.align === "right" ? x+pad+innerW : x+pad;
          octx.fillText(wln, tx, ty);
          ty += fontSize * lineHeight;
        }
      }
      if ((el.strokeW??0)>0){ octx.lineWidth=el.strokeW; octx.strokeStyle=el.stroke||"rgba(17,17,17,0.35)"; octx.strokeRect(x,y,w,h); }

    } else if (el.type === ElementType.Sitelen || el.type === ElementType.Glyph){
      // Sitelen and Glyph use their own render caches (sitelenCache, glyphCache)
      // which are already populated by the live renderer. Delegate directly to
      // drawElementToOffscreen which knows how to use those caches correctly.
      // We need to undo the translate/rotate we did above first, then let
      // drawElementToOffscreen handle its own transform.
      octx.restore(); // undo our save above
      drawElementToOffscreen(octx, el, forExport);
      return; // skip the octx.restore() at the bottom — already done

    } else if (el.type === ElementType.Image){
      if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
        octx.fillStyle=el.fill; octx.fillRect(x,y,w,h);
      }
      const img = loadImg(el.image && el.image.assetId, 'image');
      if (img){ octx.drawImage(img, x, y, w, h); }
      else { octx.setLineDash([6,4]); octx.strokeRect(x+1,y+1,w-2,h-2); octx.setLineDash([]); }
      if ((el.strokeW??0)>0){ octx.lineWidth=el.strokeW; octx.strokeStyle=el.stroke||"rgba(17,17,17,0.35)"; octx.strokeRect(x,y,w,h); }

    } else if (el.type === ElementType.Audio){
      _drawAudioOffscreen(octx, el, x, y, w, h);

    } else if (el.type === ElementType.Video){
      if (!drawPoster(el.posterAssetId, el.keepAspect))
        drawCard("▶ " + (el.title || (el.video && el.video.origName) || "Video"));

    } else if (el.type === ElementType.Url){
      const posterId = el.url && el.url.posterAssetId;
      const kind = String((el.url && el.url.detectedKind) || "link");
      const href = String(el.url && el.url.href || "").trim();
      // Only use the locally-saved posterAssetId — remote images (YouTube thumbnails)
      // have no CORS headers and would taint the canvas, breaking toBlob()/toDataURL().
      const drawn = posterId ? drawPoster(posterId, el.keepAspect) : false;
      if (!drawn)
        drawCard((kind === "video" ? "▶ " : kind === "image" ? "🖼 " : "🔗 ") + (href || "URL"));
    }

    octx.restore();
  }

  function captureEditorSession(){
    // We deliberately do NOT clone History here — undo stacks contain full payload
    // snapshots which include asset data URLs. With embedded audio/video these can
    // be hundreds of MB and will overflow JSON.stringify. History is never mutated
    // during a temporary page-switch-for-rendering, so we just keep a reference
    // and restore it directly afterwards.
    return {
      payload: snapshotCurrentPagePayload(),
      selectionIds: Array.from(selectedIds),
      activeTool,
      historyUndo: History.undo,   // reference, not clone
      historyRedo: History.redo,
      historyLastSig: History.lastSig,
    };
  }
  async function restoreEditorSession(session, reason = 'Restore editor'){
    if (!session) return;
    await loadPagePayloadIntoEditor(session.payload, reason);
    // Restore History by reference — safe because we never mutated it during render
    History.undo = Array.isArray(session.historyUndo) ? session.historyUndo : [];
    History.redo = Array.isArray(session.historyRedo) ? session.historyRedo : [];
    History.lastSig = session.historyLastSig || '';
    History.isRestoring = false;
    selectedIds = new Set(Array.isArray(session.selectionIds) ? session.selectionIds : []);
    setTool(session.activeTool || Tool.Select);
    updateUndoRedoUi();
    updateUiForSelection();
    render();
  }
  async function renderScrapbookPageDataUrl(page, maxW = 0, maxH = 0, forExport = false){
    if (!ScrapbookState || !page) return '';
    const currentPageId = ScrapbookState.currentPageId;
    if (page.id === currentPageId){
      // Current page: use live Scene (already loaded, no disruption needed)
      await syncEditorIntoCurrentPage(false); // sync payload without re-rendering thumbnail
      return await renderCurrentPageDataUrl(maxW, maxH, forExport);
    }
    // All other pages: render purely offscreen from the stored payload.
    // The live editor Scene, Assets, and History are never touched.
    const payload = getPagePayload(page);
    return await renderPagePayloadToDataUrl(payload, maxW, maxH, forExport);
  }
  // ── PDF Export ────────────────────────────────────────────────────────────
  // Lazy-load pdf-lib from CDN on first use only.
  let _pdfLibPromise = null;
  async function ensurePdfLib(){
    if (window.PDFLib) return window.PDFLib;
    if (!_pdfLibPromise){
      _pdfLibPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        s.onload = () => resolve(window.PDFLib);
        s.onerror = () => reject(new Error('Failed to load pdf-lib'));
        document.head.appendChild(s);
      });
    }
    return _pdfLibPromise;
  }

  // Convert a canvas to PNG bytes for pdf-lib embedding
  async function canvasToPdfPngBytes(canvas){
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('toBlob failed'));
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    });
  }

  // Render a scene page at 2x resolution to a canvas for crisp PDF embedding
  // ── High-res text rasteriser (6x oversample → downscale) ─────────────────
  // Renders a Text element's content into a fresh canvas at 6x then
  // draws it downscaled onto octx at the element's natural position.
  // Text colour, alignment, wrapping and fill background are all respected.
  async function _drawTextElementHiResPdf(octx, el){
    const OVERSAMPLE = 6;
    const pad = 8;
    const w = el.w, h = el.h;
    const fontSize = Math.max(6, el.fontSize ?? 24);
    const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
    const lineHeight = Math.max(0.8, el.lineHeight ?? 1.15);
    const color = el.color || '#111111';
    const align = el.align || 'left';

    // Build hi-res canvas at OVERSAMPLE
    const hW = Math.round(w * OVERSAMPLE);
    const hH = Math.round(h * OVERSAMPLE);
    const hPad = pad * OVERSAMPLE;
    const hFontSize = fontSize * OVERSAMPLE;
    const hLineH = hFontSize * lineHeight;
    const hInnerW = Math.max(0, hW - hPad * 2);

    const hiCanvas = document.createElement('canvas');
    hiCanvas.width = hW; hiCanvas.height = hH;
    const hctx = hiCanvas.getContext('2d');

    // Fill background
    if (el.fillEnabled && el.fill && el.fill !== 'transparent' && el.fill !== 'rgba(255,255,255,0.0)'){
      hctx.fillStyle = el.fill;
      hctx.fillRect(0, 0, hW, hH);
    }

    // Render text
    hctx.fillStyle = color;
    hctx.font = `${hFontSize}px "${fontFamily}", system-ui, sans-serif`;
    hctx.textBaseline = 'top';
    hctx.textAlign = align;
    const rawLines = splitLinesForBox(el.text);
    let ty = hPad;
    for (const ln0 of rawLines){
      for (const wln of wrapLine(hctx, String(ln0 ?? ''), hInnerW)){
        if (ty + hLineH > hH + 0.5) break;
        const tx = align === 'center' ? hPad + hInnerW/2
                 : align === 'right'  ? hPad + hInnerW
                 : hPad;
        hctx.fillText(wln, tx, ty);
        ty += hLineH;
      }
    }

    // Stroke border
    if ((el.strokeW ?? 0) > 0){
      hctx.lineWidth = el.strokeW * OVERSAMPLE;
      hctx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)';
      hctx.strokeRect(0, 0, hW, hH);
    }

    // Place downscaled onto octx at element position with rotation
    octx.save();
    octx.globalAlpha = clamp(el.opacity ?? 1, 0, 1);
    octx.translate(el.x + w/2, el.y + h/2);
    octx.rotate(rad(el.rotationDeg || 0));
    octx.drawImage(hiCanvas, -w/2, -h/2, w, h);
    octx.restore();
  }

  // ── Hi-res Sitelen rasteriser ──────────────────────────────────────────────
  // Re-renders a Sitelen element using buildRenderPlan at 4x fontPx,
  // placing cartouches and quoted-text runs as separate hi-res PNGs.
  // Falls back to raster cache if renderer fails.
  // Hi-res Sitelen renderer for PDF: re-renders via renderTextToNewCanvas at
  // 4x fontPx, then scales the result canvas to fit the element bounding box
  // exactly as the normal raster path does — just at 4x resolution.
  async function _drawSitelenElementHiResPdf(octx, el){
    const SITELEN_SCALE = 4;
    try {
      const renderer = await getSitelenRendererForElement(el);
      const baseFontPx = Math.max(6, el.fontSize ?? 44);
      const hiPx = Math.round(baseFontPx * SITELEN_SCALE);

      // Render at 4x fontPx — same API as rebuildSitelenRasterWithRenderer
      const cfg = buildRendererCallConfigForElement(el);
      cfg.layout.fontPx = hiPx;
      cfg.layout.paddingPx = 0;
      cfg.paint.halo = { enabled: false, color: '#FFFFFF', widthPx: 0 };
      const result = await renderer.renderTextToNewCanvas(
        Object.assign({ input: prepareSitelenInputWithActiveCartoucheDb(String(el.text ?? '')) }, cfg)
      );
      if (!result || !result.canvas) throw new Error('no canvas');

      const srcCanvas = result.canvas;
      const elW = el.w, elH = el.h;

      // Scale to fit inside the element box, preserving aspect ratio
      const scaleX = elW / Math.max(1, srcCanvas.width);
      const scaleY = elH / Math.max(1, srcCanvas.height);
      const s = Math.min(scaleX, scaleY);
      const dstW = Math.round(srcCanvas.width * s);
      const dstH = Math.round(srcCanvas.height * s);

      octx.save();
      octx.globalAlpha = clamp(el.opacity ?? 1, 0, 1);
      octx.translate(el.x + elW / 2, el.y + elH / 2);
      octx.rotate(rad(el.rotationDeg || 0));
      if (el.fillEnabled && el.fill && el.fill !== 'transparent' && el.fill !== 'rgba(255,255,255,0.0)'){
        octx.fillStyle = el.fill;
        octx.fillRect(-elW / 2, -elH / 2, elW, elH);
      }
      // Centre the rendered sitelen within the element box
      octx.drawImage(srcCanvas, -dstW / 2, -dstH / 2, dstW, dstH);
      if ((el.strokeW ?? 0) > 0){
        octx.lineWidth = el.strokeW;
        octx.strokeStyle = el.stroke || 'rgba(17,17,17,0.35)';
        octx.strokeRect(-elW / 2, -elH / 2, elW, elH);
      }
      octx.restore();

    } catch (err) {
      console.warn('PDF Sitelen hi-res render failed, using cache:', err);
      _drawElementOffscreenFromPayload(octx, el, () => null, true);
    }
  }

  // ── PDF page renderer ──────────────────────────────────────────────────────
  // Renders a page payload to a canvas suitable for PDF embedding.
  // - Rects, Images, Audio, Video, URL: drawn at 2x via _drawElementOffscreenFromPayload
  // - Text: re-rasterised at 6x oversample for crispness
  // - Sitelen/Glyph: re-rendered via buildRenderPlan at 4x fontPx
  async function renderPageToHiResCanvas(payload, stageW, stageH){
    const SCALE = 2;
    const outW = Math.max(1, Math.round(stageW * SCALE));
    const outH = Math.max(1, Math.round(stageH * SCALE));
    const rawScene = payload && payload.scene ? payload.scene : payload;
    const rawAssets = payload && payload.assets ? payload.assets : null;
    const localAssets = new Map();
    const assetList = Array.isArray(rawAssets?.byId) ? rawAssets.byId
                    : Array.isArray(rawAssets) ? rawAssets : [];
    for (const a of assetList){
      if (a && a.id && a.dataUrl) localAssets.set(String(a.id), a);
    }
    const getLocalDataUrl = (assetId) => {
      if (!assetId) return null;
      const local = localAssets.get(String(assetId));
      if (local) return String(local.dataUrl || '');
      return getAssetDataUrl(assetId);
    };
    const normalized = normalizeScene(rawScene || {});
    const scene = validateAndSanitizeScene(normalized);
    const stage = scene.stage || {};
    const elements = scene.elements || [];

    // Pre-warm Glyph raster caches (Sitelen handled via buildRenderPlan now)
    const rasterJobs = [];
    for (const el of elements){
      if (el.type === ElementType.Glyph){
        const sig = getElementRendererSignature(el);
        const cached = glyphCache.get(el.id);
        if (!cached || cached.sig !== sig || !cached.canvas)
          rasterJobs.push(rebuildGlyphRasterWithRenderer(el));
      }
    }
    if (rasterJobs.length) await Promise.allSettled(rasterJobs);

    // Note: remote YouTube thumbnails (remotePosterImageCache) are NOT drawn onto
    // export canvases — i.ytimg.com has no CORS headers so drawImage() would taint
    // the canvas and break toBlob(). Only posterAssetId (local data URL) is used.

    const payloadPreloadJobs = [];
    if (stage.bgImgEnabled && stage.bgImgAssetId){
      const bgDataUrl = getLocalDataUrl(stage.bgImgAssetId);
      if (bgDataUrl) payloadPreloadJobs.push(awaitImageLoadedFromDataUrl(bgDataUrl, '__payload_stageBgImage_pdf'));
    }
    for (const el of elements){
      const imageAssetId = el.image && el.image.assetId ? String(el.image.assetId) : '';
      if (imageAssetId){
        const dataUrl = getLocalDataUrl(imageAssetId);
        if (dataUrl) payloadPreloadJobs.push(awaitImageLoadedFromDataUrl(dataUrl, el.id + '__payload_image_pdf'));
      }
      const posterId = el.posterAssetId || (el.url && el.url.posterAssetId) || '';
      if (posterId){
        const dataUrl = getLocalDataUrl(posterId);
        if (dataUrl) payloadPreloadJobs.push(awaitImageLoadedFromDataUrl(dataUrl, el.id + (el.url ? '__payload_poster_pdf' : '__payload_vidposter_pdf')));
      }
    }
    if (payloadPreloadJobs.length) await Promise.allSettled(payloadPreloadJobs);

    const off = document.createElement('canvas');
    off.width = outW; off.height = outH;
    const octx = off.getContext('2d');
    octx.save();
    octx.scale(SCALE, SCALE);

    // Background — always white for PDF
    octx.fillStyle = (stage.exportStageBackground && stage.bg) ? stage.bg : '#FFFFFF';
    octx.fillRect(0, 0, stageW, stageH);

    // Background image
    if (stage.bgImgEnabled && stage.bgImgAssetId){
      const dataUrl = getLocalDataUrl(stage.bgImgAssetId);
      if (dataUrl){
        const img = ensureImageLoadedFromDataUrl(dataUrl, '__payload_stageBgImage_pdf');
        if (img && img.naturalWidth > 0){
          const dest = computeBackgroundImageDestRect({
            stageW, stageH,
            natW: img.naturalWidth, natH: img.naturalHeight,
            stretch: !!stage.bgImgStretch,
            keepAspect: stage.bgImgKeepAspect !== false
          });
          octx.save(); octx.beginPath(); octx.rect(0, 0, stageW, stageH); octx.clip();
          octx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
          octx.restore();
        }
      }
    }

    // Draw elements — async for Text and Sitelen, sync for everything else
    for (const el of elements){
      // exportVisible guard
      const isMediaEl = el.type === ElementType.Audio || el.type === ElementType.Video || el.type === ElementType.Url;
      if (isMediaEl && el.exportVisible === false) continue;

      if (el.type === ElementType.Text){
        await _drawTextElementHiResPdf(octx, el);
      } else if (el.type === ElementType.Sitelen){
        await _drawSitelenElementHiResPdf(octx, el);
      } else {
        _drawElementOffscreenFromPayload(octx, el, getLocalDataUrl, true);
      }
    }
    octx.restore();
    return { canvas: off, w: outW, h: outH, stageW, stageH };
  }

  // Build an offscreen canvas for the PDF cover page.
  // Renders document title, subtitle, type, page count, and export date
  // as sitelen pona using nasinNanpa / nanpa-linja-n.
  async function buildPdfCoverCanvas(doc, stageW, stageH, exportDate){
    const SCALE = 2;
    const outW = Math.max(1, stageW * SCALE);
    const outH = Math.max(1, stageH * SCALE);
    const off = document.createElement('canvas');
    off.width = outW; off.height = outH;
    const octx = off.getContext('2d');

    // White background
    octx.fillStyle = '#FFFFFF';
    octx.fillRect(0, 0, outW, outH);

    // Decorative top bar
    octx.fillStyle = 'rgba(17,17,17,0.08)';
    octx.fillRect(0, 0, outW, Math.round(8 * SCALE));

    // Decorative bottom bar
    octx.fillStyle = 'rgba(17,17,17,0.08)';
    octx.fillRect(0, outH - Math.round(8 * SCALE), outW, Math.round(8 * SCALE));

    // Helper: draw text as sitelen raster using the nasinNanpa preset
    // Returns the rendered height in logical px
    const drawSitelenLine = async (text, yLogical, fontPx, color = '#111111', align = 'center') => {
      if (!text || !text.trim()) return fontPx * 1.4;
      // Build a fake sitelen element to reuse getSitelenRendererForElement
      const fakeEl = {
        type: ElementType.Sitelen,
        id: `_cover_${yLogical}`,
        text,
        fontSize: fontPx,
        renderFontPreset: 'nasinNanpa',
        fontFamily: null,
        textFontOption: TEXT_FONT_OPTION_NANPA_LINJA_N,
        color,
        align,
        haloEnabled: false,
        haloColor: '#FFFFFF',
        haloThicknessMode: 'auto',
        haloThickness: 0,
        abbreviateNumericCartouches: documentCoverDateUsesAbbreviatedCartouche(doc),
      };
      try {
        const renderer = await getSitelenRendererForElement(fakeEl);
        const cfg = buildRendererCallConfigForElement(fakeEl);
        cfg.layout.paddingPx = 0;
        const result = await renderer.renderTextToNewCanvas(Object.assign({ input: text }, cfg));
        if (!result || !result.canvas) return fontPx * 1.4;
        const srcCanvas = result.canvas;
        const natW = srcCanvas.width;
        const natH = srcCanvas.height;
        // Scale canvas content to fill width minus margins, maintaining aspect
        const margin = 80 * SCALE;
        const maxW = outW - margin * 2;
        const scale = Math.min(1, maxW / Math.max(1, natW));
        const dstW = Math.round(natW * scale);
        const dstH = Math.round(natH * scale);
        let dx;
        if (align === 'center') dx = Math.round((outW - dstW) / 2);
        else if (align === 'right') dx = outW - margin - dstW;
        else dx = margin;
        const dy = Math.round(yLogical * SCALE);
        octx.drawImage(srcCanvas, dx, dy, dstW, dstH);
        return dstH / SCALE;
      } catch (err) {
        // Fallback: plain text
        octx.fillStyle = color;
        octx.font = `${fontPx * SCALE}px system-ui, sans-serif`;
        octx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
        octx.textBaseline = 'top';
        const tx = align === 'center' ? outW / 2 : align === 'right' ? outW - 80 * SCALE : 80 * SCALE;
        octx.fillText(text, tx, yLogical * SCALE);
        return fontPx * 1.4;
      }
    };

    const meta = doc.meta || {};
    const pageCount = (doc.pages || []).length;
    const docType = String(meta.documentType || 'scrapbook');

    // Helper: draw plain latin text centred horizontally, returns line height used
    const drawLatinLine = (text, yLogical, fontPx, color = '#111111', style = 'normal') => {
      if (!text || !text.trim()) return fontPx * 1.4;
      octx.fillStyle = color;
      octx.font = `${style} ${Math.round(fontPx * SCALE)}px system-ui, -apple-system, sans-serif`;
      octx.textAlign = 'center';
      octx.textBaseline = 'top';
      octx.fillText(String(text), outW / 2, Math.round(yLogical * SCALE));
      return fontPx * 1.5;
    };

    let y = stageH * 0.12;

    // Title — bold latin
    const title = String(meta.title || 'Untitled document');
    const titleH = drawLatinLine(title, y, 56, '#111111', '700');
    y += titleH + stageH * 0.03;

    // Subtitle — regular latin
    if (meta.subtitle && meta.subtitle.trim()){
      const subH = drawLatinLine(meta.subtitle, y, 30, '#555555', '400');
      y += subH + stageH * 0.025;
    }

    // Divider line
    octx.strokeStyle = 'rgba(17,17,17,0.18)';
    octx.lineWidth = 2 * SCALE;
    const mx = 120 * SCALE;
    octx.beginPath();
    octx.moveTo(mx, y * SCALE);
    octx.lineTo(outW - mx, y * SCALE);
    octx.stroke();
    y += stageH * 0.04;

    // Document type + page count — latin
    const infoText = `${docType}  ·  ${pageCount} page${pageCount !== 1 ? 's' : ''}`;
    const infoH = drawLatinLine(infoText, y, 22, '#777777', '400');
    y += infoH + stageH * 0.035;

    // Export date — sitelen pona (nasin nanpa format)
    const dateH = await drawSitelenLine(exportDate, y, 28, '#555555', 'center');
    y += dateH;

    // Bottom: small latin footer
    drawLatinLine('PDF export', stageH * 0.90, 14, 'rgba(17,17,17,0.3)', '400');

    return { canvas: off, w: outW, h: outH, stageW, stageH };
  }

  async function buildPdfCoverSvgText(doc, stageW, stageH, exportDate){
    const w = Math.max(1, Number(stageW) || 1280);
    const h = Math.max(1, Number(stageH) || 800);
    const meta = doc?.meta || {};
    const title = String(meta.title || 'Untitled document');
    const subtitle = String(meta.subtitle || '');
    const docType = String(meta.documentType || 'scrapbook');
    const pageCount = (doc?.pages || []).length;
    const infoText = `${docType}  ·  ${pageCount} page${pageCount !== 1 ? 's' : ''}`;

    const centerText = (text, y, size, weight = 400, fill = '#111111') => {
      if (!String(text || '').trim()) return '';
      return `<text x="${svgNum(w / 2)}" y="${svgNum(y)}" text-anchor="middle" dominant-baseline="hanging" ` +
        `font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" ` +
        `font-size="${svgNum(size)}" font-weight="${svgNum(weight)}" fill="${svgEsc(fill)}">${svgEsc(text)}</text>`;
    };

    const parts = [];
    parts.push(svgRectNode({ x: 0, y: 0, w, h, fill: '#FFFFFF', stroke: 'none' }));
    parts.push(svgRectNode({ x: 0, y: 0, w, h: 8, fill: '#F0F0F0', stroke: 'none' }));
    parts.push(svgRectNode({ x: 0, y: h - 8, w, h: 8, fill: '#F0F0F0', stroke: 'none' }));

    let y = h * 0.12;
    parts.push(centerText(title, y, 56, 700, '#111111'));
    y += 84;
    if (subtitle.trim()){
      parts.push(centerText(subtitle, y, 30, 400, '#555555'));
      y += 58;
    }
    parts.push(svgRectNode({ x: w * 0.12, y, w: w * 0.76, h: 2, fill: '#D0D0D0', stroke: 'none' }));
    y += 42;
    parts.push(centerText(infoText, y, 22, 400, '#777777'));
    y += 42;

    // The original scrapbook PDF cover rendered the current date as a sitelen/numeric
    // cartouche. Keep that behavior, but emit it as SVG vector paths so the PDF
    // remains vector-first. The fallback is plain centered text only if the
    // vector date fragment fails.
    try {
      const dateFragment = await buildCoverDateCartoucheSvgFragment(doc, exportDate, w, 42);
      if (dateFragment) {
        parts.push(`<g transform="translate(${svgNum(w / 2)} ${svgNum(y + 43)})">${dateFragment}</g>`);
      } else {
        parts.push(centerText(exportDate, y, 20, 400, '#777777'));
      }
    } catch (err) {
      console.warn('Cover date cartouche SVG vector render failed; using plain date text:', err);
      parts.push(centerText(exportDate, y, 20, 400, '#777777'));
    }

    parts.push(centerText('PDF export', h * 0.90, 14, 400, '#BBBBBB'));

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${svgNum(w)}" height="${svgNum(h)}" viewBox="0 0 ${svgNum(w)} ${svgNum(h)}">\n` +
      `${parts.filter(Boolean).join('\n')}\n</svg>`;
  }

  function abbreviateNumericCartoucheCpsForExport(cps) {
    const input = Array.from(cps || []).map(cp => Number(cp)).filter(Number.isFinite);
    if (!input.length) return input;
    const dropAfterFirstNanpa = new Set([CP_NANPA, CP_EN, CP_NENA, NANPA_LINJA_N_WORD_TO_CP["open"]].filter(Number.isFinite));
    const out = [];
    let keptFirstNanpa = false;
    for (let i = 0; i < input.length; i++) {
      const cp = input[i];
      const isFinalNanpa = (cp === CP_NANPA && i === input.length - 1);
      if (!keptFirstNanpa) {
        out.push(cp);
        if (cp === CP_NANPA) keptFirstNanpa = true;
        continue;
      }
      if (isFinalNanpa) {
        out.push(cp);
        continue;
      }
      if (dropAfterFirstNanpa.has(cp)) continue;
      out.push(cp);
    }
    return out;
  }

  async function buildCoverDateCartoucheSvgFragment(doc, exportDate, stageW, fragmentH){
    const cleanDate = String(exportDate || '').trim();
    const caps = dateStrToNanpaCaps(cleanDate);
    if (!caps) throw new Error(`Cover date is not encodable as nanpa-linja-n date: ${cleanDate}`);
    const abbreviateCoverDate = documentCoverDateUsesAbbreviatedCartouche(doc);

    // IMPORTANT: Do not manually remove codepoints here. The scrapbook cover
    // date is produced by the sitelen renderer/parser path. The document flag
    // controls whether the numeric cartouche is abbreviated; imported documents
    // without the flag default to full output for compatibility, while new
    // documents are created with the flag enabled.
    const fakeEl = {
      id: '_cover_numeric_date_cartouche',
      type: ElementType.Sitelen,
      x: 0,
      y: 0,
      w: Math.max(1, Number(stageW) || 1280),
      h: Math.max(1, Number(fragmentH) || 48),
      rotationDeg: 0,
      opacity: 1,
      fillEnabled: false,
      fill: '#FFFFFF',
      strokeW: 0,
      stroke: '#111111',
      text: cleanDate,
      fontSize: 16,
      renderFontPreset: 'nasinNanpa',
      fontFamily: TEXT_FONT_OPTION_NANPA_LINJA_N,
      quotedTextFontOption: TEXT_FONT_OPTION_NANPA_LINJA_N,
      align: 'center',
      color: '#555555',
      lineHeight: 1.05,
      keepAspect: true,
      ignoreUnknownText: true,
      abbreviateNumericCartouches: abbreviateCoverDate,
      spacingPreset: 'default',
      haloEnabled: false,
      haloColor: '#FFFFFF',
      haloThicknessMode: 'auto',
      haloThickness: 0,
      preserveCenterOnAutoResize: false,
    };

    const exporter = await createVectorExporterForElement(fakeEl);
    const cfg = buildRendererCallConfigForElement(fakeEl);
    cfg.layout.paddingPx = 0;
    cfg.layout.align = 'center';
    cfg.parser.abbreviateNumericCartouches = abbreviateCoverDate;
    const plan = await exporter.buildPlan({ input: cleanDate, config: cfg });
    if (!plan || !Array.isArray(plan.lines) || !plan.lines.length) {
      throw new Error('Cover date renderer returned no vector plan.');
    }
    const blob = await exporter.exportTextToSvgBlob({
      plan,
      paddingPx: 0,
      fallbackWidthPx: Math.max(1, Number(plan.widthPx || fakeEl.w || 1)),
      fallbackHeightPx: Math.max(1, Number(plan.heightPx || fakeEl.h || 1))
    });
    const nested = await nestedSvgFromVectorBlob(blob);
    const vb = parseSvgViewBoxString(nested.viewBox, plan.widthPx || 1, plan.heightPx || 1);

    // Match production cover behavior: never scale the date cartouche up.
    // It is rendered at a small production-style cover-line size and only scaled
    // down if it would exceed the cover line's available width/height.
    const maxW = Math.max(120, Math.min(420, Math.max(1, Number(stageW) || 1280) * 0.36));
    const maxH = Math.max(18, Number(fragmentH) || 42);
    const scale = Math.min(1, maxW / Math.max(1, vb.w), maxH / Math.max(1, vb.h));
    const drawW = vb.w * scale;
    const drawH = vb.h * scale;
    const dx = -drawW / 2;
    const dy = -drawH / 2;
    return `<g data-cover-date="renderer-numeric-cartouche" data-cover-date-abbreviated="${abbreviateCoverDate ? 'true' : 'false'}" transform="translate(${svgNum(dx)} ${svgNum(dy)}) scale(${svgNum(scale)}) translate(${svgNum(-vb.x)} ${svgNum(-vb.y)})">${nested.inner}</g>`;
  }


  async function renderScrapbookCartouchePreviewSvgFromApp(options = {}){
    const input = String(options?.input ?? "");
    const fontPx = Math.max(8, Number(options?.fontPx ?? 44) || 44);
    const renderFontPreset = normalizeRenderFontPresetKey(options?.renderFontPreset || Scene?.stage?.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset);
    const quotedTextFontOption = normalizeValidQuotedTextFontOptionForSitelen(
      options?.quotedTextFontOption || Scene?.stage?.defaultTextFontOption || getRenderFontPreset(renderFontPreset)?.literalFamily || FONT_FAMILY_LITERAL,
      renderFontPreset
    );
    const fakeEl = {
      id: String(options?.id || '_scrapbook_cartouche_preview'),
      type: ElementType.Sitelen,
      x: 0,
      y: 0,
      w: Math.max(1, Number(options?.w || 1)),
      h: Math.max(1, Number(options?.h || 1)),
      rotationDeg: 0,
      opacity: 1,
      fillEnabled: false,
      fill: '#FFFFFF',
      strokeW: 0,
      stroke: '#111111',
      text: input,
      fontSize: fontPx,
      renderFontPreset,
      fontFamily: quotedTextFontOption,
      quotedTextFontOption,
      align: String(options?.align || 'left'),
      color: rgbaOrHexToHex(options?.color || '#111111', '#111111'),
      lineHeight: 1.05,
      keepAspect: true,
      ignoreUnknownText: options?.ignoreUnknownText !== false,
      abbreviateNumericCartouches: !!options?.abbreviateNumericCartouches,
      spacingPreset: normalizeSpacingPreset(options?.spacingPreset || 'default'),
      haloEnabled: !!options?.haloEnabled,
      haloColor: rgbaOrHexToHex(options?.haloColor || '#FFFFFF', '#FFFFFF'),
      haloThicknessMode: options?.haloThicknessMode === 'manual' ? 'manual' : 'auto',
      haloThickness: Number.isFinite(options?.haloThickness) ? Number(options.haloThickness) : 0,
      preserveCenterOnAutoResize: false,
    };

    const exporter = await createVectorExporterForElement(fakeEl);
    const cfg = buildRendererCallConfigForElement(fakeEl);
    cfg.layout.paddingPx = Math.max(0, Number(options?.paddingPx ?? 0) || 0);
    cfg.layout.align = fakeEl.align;

    // The proper-names popup passes already-resolved renderer input such as
    // [suwi mute] or ["Literal"].  Do not pass it back through the active DB
    // preparer here; the whole point of this bridge is to reuse the same
    // app-vector renderer/font/export contract while preserving the popup's
    // selected entry input exactly.
    const rawPlan = await exporter.buildPlan({ input, config: cfg });
    const plan = normalizeSitelenVectorPlanFontRoles(rawPlan, fakeEl);
    if (!planHasDrawableRuns(plan)) throw new Error('No drawable runs in scrapbook cartouche preview vector plan.');

    const blob = await exporter.exportTextToSvgBlob({
      plan,
      paddingPx: 0,
      fallbackWidthPx: Math.max(1, Number(plan.widthPx || fakeEl.w || 1)),
      fallbackHeightPx: Math.max(1, Number(plan.heightPx || fakeEl.h || 1))
    });
    const nested = await nestedSvgFromVectorBlob(blob);
    const vb = parseSvgViewBoxString(nested.viewBox, plan.widthPx || 1, plan.heightPx || 1);


    const width = Math.max(1, Math.ceil(vb.w));
    const height = Math.max(1, Math.ceil(vb.h));
    const unknownTextRects = (!fakeEl.ignoreUnknownText) ? svgUnknownTextRectsForPlan(plan) : '';
    const inner = unknownTextRects ? `${nested.inner}\n${unknownTextRects}` : nested.inner;
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgNum(width)}" height="${svgNum(height)}" viewBox="${formatSvgViewBoxBox(vb)}" data-preview-renderer="app-vector" data-preview-input="${svgEsc(input)}">${inner}</svg>`;
  }

  window.renderScrapbookCartouchePreviewSvg = renderScrapbookCartouchePreviewSvgFromApp;
  try { window.dispatchEvent(new CustomEvent('scrapbook-cartouche-preview-renderer-ready')); } catch {}

  async function appendPdfCoverPageFallback(pdfDoc, PDFLib, doc, stageW, stageH, exportDate){
    const { StandardFonts, rgb } = PDFLib;
    const pageW = Math.max(1, stageW) * SVG_PDF_PT_PER_PX;
    const pageH = Math.max(1, stageH) * SVG_PDF_PT_PER_PX;
    const page = pdfDoc.addPage([pageW, pageH]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 0, y: pageH - 8 * SVG_PDF_PT_PER_PX, width: pageW, height: 8 * SVG_PDF_PT_PER_PX, color: rgb(0.94, 0.94, 0.94) });
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: 8 * SVG_PDF_PT_PER_PX, color: rgb(0.94, 0.94, 0.94) });

    const meta = doc?.meta || {};
    const title = String(meta.title || 'Untitled document');
    const subtitle = String(meta.subtitle || '');
    const docType = String(meta.documentType || 'scrapbook');
    const pageCount = (doc?.pages || []).length;
    const infoText = `${docType}  ·  ${pageCount} page${pageCount !== 1 ? 's' : ''}`;

    const centerText = (text, y, size, useBold = false, gray = 0.08) => {
      const f = useBold ? bold : font;
      const safe = String(text || '');
      const textW = f.widthOfTextAtSize(safe, size);
      page.drawText(safe, { x: Math.max(24, (pageW - textW) / 2), y, size, font: f, color: rgb(gray, gray, gray) });
    };

    let y = pageH * 0.78;
    centerText(title, y, 34, true, 0.06);
    y -= 46;
    if (subtitle.trim()) { centerText(subtitle, y, 20, false, 0.32); y -= 34; }
    page.drawLine({ start: { x: pageW * 0.12, y }, end: { x: pageW * 0.88, y }, thickness: 1, color: rgb(0.82, 0.82, 0.82) });
    y -= 42;
    centerText(infoText, y, 16, false, 0.45);
    y -= 30;
    centerText(exportDate, y, 14, false, 0.45);
    centerText('PDF export', pageH * 0.08, 10, false, 0.65);
    return page;
  }

  // ── Wait for all poster images across all pages before export ───────────────
  // Collects every URL element from every page in the document, runs poster
  // population (fetch → data URL → posterAssetId) for any that are missing,
  // and waits for all remote poster <img> elements to finish decoding.
  // Called at the start of every export function.
  async function awaitPostersForExport(pages){
    if (!pages || !pages.length) return;

    // Collect all URL elements across all pages (including current page's live scene)
    const allUrlElements = [];
    for (const page of pages){
      let elements;
      if (ScrapbookState && page.id === ScrapbookState.currentPageId){
        // Use live scene for current page
        elements = Scene.elements || [];
      } else {
        const payload = getPagePayload(page);
        elements = payload?.scene?.elements || [];
      }
      for (const el of elements){
        if (el && el.type === ElementType.Url) allUrlElements.push(el);
      }
    }

    if (!allUrlElements.length) return;

    // Count how many poster candidates still need a local poster asset.
    const needsPoster = allUrlElements.filter(el => {
      if (!el.url) return false;
      const href = String(el.url.href || '').trim();
      if (!href) return false;
      if (el.url.posterAssetId) return false;
      const detected = detectUrlKindFromHref(href);
      return detected.kind === 'image' || (detected.kind === 'video' && !!extractYouTubeVideoId(href));
    });

    if (needsPoster.length) {
      setStatus(`Preparing export… fetching ${needsPoster.length} poster image${needsPoster.length !== 1 ? 's' : ''}…`);

      // Force retry here. A scrapbook loaded from storage may have posterAttempted=true
      // from an earlier deferred scan but still be missing posterAssetId.
      const jobs = needsPoster.map(el =>
        maybePopulatePosterForUrlElement(el, { force: true }).catch(err =>
          console.warn('Poster fetch failed for export:', err)
        )
      );
      await Promise.allSettled(jobs);
    }

    // Now wait for any remotePosterImageCache entries that are still loading
    // (used as fallback display on the live canvas — ensures they're decoded
    //  before we try to read them for thumbnail or status purposes)
    const remoteWaits = [];
    for (const el of allUrlElements){
      if (!el.url) continue;
      const href = String(el.url.posterRemoteHref || '').trim();
      if (!href) continue;
      if (el.url.posterAssetId) continue; // already have local asset, don't need remote
      // Wait for the remote <img> to decode (best-effort, 5s timeout per image)
      remoteWaits.push(new Promise((resolve) => {
        const candidates = buildRemotePosterCandidates(href);
        if (!candidates.length){ resolve(); return; }
        const key = candidates.join('|');
        const entry = remotePosterImageCache.get(key);
        if (!entry){ resolve(); return; }
        if (entry.ready){ resolve(); return; }
        const timer = setTimeout(resolve, 5000);
        const origOnload = entry.img.onload;
        entry.img.onload = (e) => {
          clearTimeout(timer);
          entry.ready = true;
          if (typeof origOnload === 'function') origOnload(e);
          resolve();
        };
        const origOnerror = entry.img.onerror;
        entry.img.onerror = (e) => {
          clearTimeout(timer);
          if (typeof origOnerror === 'function') origOnerror(e);
          resolve();
        };
      }));
    }
    if (remoteWaits.length) await Promise.allSettled(remoteWaits);

    const localPosterWaits = [];
    for (const el of allUrlElements){
      const posterId = String(el?.url?.posterAssetId || '').trim();
      if (!posterId) continue;
      localPosterWaits.push(awaitImageLoadedFromAssetId(posterId, el.id + '__poster'));
    }
    if (localPosterWaits.length) {
      setStatus(`Preparing export… loading ${localPosterWaits.length} local poster image${localPosterWaits.length !== 1 ? 's' : ''}…`);
      await Promise.allSettled(localPosterWaits);
    }

    // Trigger autosave so posterAssetId / posterRemoteHref are persisted
    // before the export renders pages
    try { scheduleAutosave(); } catch {}
  }



  async function appendSvgSceneTextToPdfDocument(pdfDoc, svgText, options = {}){
    if (!window.PDFLib && typeof PDFLib !== 'undefined') window.PDFLib = PDFLib;
    if (!svgPdfCanUseOperators()) throw new Error('pdf-lib operator helpers are unavailable; cannot preserve SVG transforms in PDF.');
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error('Composed SVG could not be parsed for PDF export.');
    const rootSvg = doc.documentElement;
    const stageW = Math.max(1, svgPdfNumber(rootSvg.getAttribute('width'), Scene.stage.w || 1));
    const stageH = Math.max(1, svgPdfNumber(rootSvg.getAttribute('height'), Scene.stage.h || 1));
    const bottomBleedPx = svgPdfBottomBleedPx(rootSvg, options.bottomBleedPx);
    const pdfStageH = stageH + bottomBleedPx;
    const page = pdfDoc.addPage([stageW * SVG_PDF_PT_PER_PX, pdfStageH * SVG_PDF_PT_PER_PX]);

    // If the root SVG has an explicit stage background, extend that background
    // into the PDF-only bottom bleed so visible sitelen overhang is not placed
    // over an unexpected white strip. The drawn SVG itself is unchanged.
    if (bottomBleedPx > 0){
      const bgFill = svgPdfFindStageBackgroundFill(rootSvg);
      const bg = bgFill ? svgPdfColor(bgFill, 1) : null;
      if (bg?.color){
        page.drawRectangle({
          x: 0,
          y: 0,
          width: stageW * SVG_PDF_PT_PER_PX,
          height: bottomBleedPx * SVG_PDF_PT_PER_PX,
          color: bg.color,
          opacity: bg.opacity ?? 1,
          borderWidth: 0
        });
      }
    }

    const clipPathMap = svgPdfBuildClipPathMap(doc);
    // Use the enlarged PDF media-box height for SVG->PDF y conversion. This
    // keeps SVG y=0 at the top of the page and moves the original stage bottom
    // above the media-box bottom by bottomBleedPx, so bottom sitelen overhang is
    // preserved instead of clipped by the PDF page boundary.
    await drawSvgDomNodeToPdf(rootSvg, pdfDoc, page, [1, 0, 0, 1, 0, 0], { fill: 'black', stroke: 'none', strokeWidth: 1, opacity: 1 }, pdfStageH, clipPathMap, true);
    return page;
  }


  async function withPayloadAsActiveScene(payload, fn){
    const savedScene = deepClone(Scene);
    const savedAssets = serializeAssets();
    const savedPageMap = pageMap;
    try {
      const cleanPayload = payload || {};
      deserializeAssets(cleanPayload.assets || cleanPayload.assetStore || cleanPayload.serializedAssets || null);
      const normalized = normalizeScene(deepClone(cleanPayload.scene || cleanPayload));
      Object.keys(Scene).forEach(k => { delete Scene[k]; });
      Object.assign(Scene, normalized);

      // Export iterates over many page payloads while reusing the same JS
      // process. Some imported layout pages legitimately reuse element ids
      // from earlier pages or from duplicated pages. Caches keyed by element id
      // must not cross the temporary page boundary or a later page can render
      // stale vectors from a previous payload.
      try { clearEditorRuntimeCaches(); } catch {}
      try { clearSvgVectorElementCache(); } catch {}

      return await fn();
    } finally {
      deserializeAssets(savedAssets);
      Object.keys(Scene).forEach(k => { delete Scene[k]; });
      Object.assign(Scene, savedScene);
      pageMap = savedPageMap;

      // Leave the restored live editor with no payload-specific vector/raster
      // leftovers from the page that was just exported. The next live render or
      // export pass will rebuild from the restored/current scene.
      try { clearEditorRuntimeCaches(); } catch {}
      try { clearSvgVectorElementCache(); } catch {}
    }
  }

  async function buildScrapbookPageSvgText(page, { forceStageBackground = false } = {}){
    const payload = getPagePayload(page, { preferLiveCurrent: true });
    return await withPayloadAsActiveScene(payload, async () => {
      await waitForRenderPresetFonts(Scene.stage.defaultRenderFontPreset || DEFAULTS.defaultRenderFontPreset, 64, null, []);
      // Production display/export hydrates sitelen and glyph elements before
      // rendering. Keep the same readiness path for the vector scene builder so
      // imported scrapbook sitelen boxes have current fonts, natural dimensions,
      // and parser state before SVG/PDF emission.
      await hydrateSceneBeforeDisplay(Scene);
      return await buildSceneSvgText({ includeEditorGrid: false, forceStageBackground });
    });
  }

  async function svgTextToPngBlobForSize(svgText, widthPx, heightPx){
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        try {
          const off = document.createElement('canvas');
          off.width = Math.max(1, Math.ceil(Number(widthPx) || img.width || 1));
          off.height = Math.max(1, Math.ceil(Number(heightPx) || img.height || 1));
          const octx = off.getContext('2d', { alpha: true });
          octx.clearRect(0, 0, off.width, off.height);
          octx.drawImage(img, 0, 0, off.width, off.height);
          URL.revokeObjectURL(url);
          off.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encode failed.')), 'image/png');
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG rasterization failed.')); };
      img.src = url;
    });
  }

  function parseSvgStageSize(svgText, fallbackW = 1280, fallbackH = 800){
    const w = /<svg[^>]*\bwidth="([0-9.]+)"/i.exec(svgText)?.[1];
    const h = /<svg[^>]*\bheight="([0-9.]+)"/i.exec(svgText)?.[1];
    return { w: Math.max(1, Number(w) || fallbackW), h: Math.max(1, Number(h) || fallbackH) };
  }

  async function exportAllPagesSvgZip(){
    if (!ScrapbookState) return;
    const doc = ScrapbookState.doc;
    const pages = doc.pages || [];
    await syncEditorIntoCurrentPage(false);
    commitLiveEditorIntoCurrentScrapbookPageNow({ updateThumb: false });
    await awaitPostersForExport(pages);
    const files = [];
    const total = pages.length;
    for (let i = 0; i < pages.length; i++){
      setStatus(`Exporting SVG ZIP… page ${i + 1} / ${total}`);
      const page = pages[i];
      const svgText = await buildScrapbookPageSvgText(page, { forceStageBackground: !!getPagePayload(page, { preferLiveCurrent: true })?.scene?.stage?.exportStageBackground });
      files.push({ name: `${String(i + 1).padStart(3, '0')}-${slug(page.name || 'page')}.svg`, data: new TextEncoder().encode(svgText) });
    }
    downloadBlob(await buildStoredZip(files), `${slug(doc.meta?.title || 'document')}-svg-pages.zip`);
    setStatus('SVG ZIP exported.');
  }


/* ============================================================
   SCRAPBOOK VECTOR SCENE EXPORT CORE
   Ported from layout-editor-vector-package-v52.
   ============================================================ */
  async function createVectorExporterForElement(el){
    const presetKey = getElementRenderFontPresetKey(el);
    try { stageFontPairController?.setActivePreset?.(presetKey, { persist: false }); } catch {}
    const renderer = await getSitelenRendererForElement(el);
    const literalCartoucheSettings = (el?.type === ElementType.Sitelen)
      ? getElementLiteralCartoucheSettings(el)
      : {};
    return await SitelenVectorExporter.create({
      renderer,
      fontController: stageFontPairController,
      literalCartoucheRuleClipScale: literalCartoucheSettings.literalCartoucheRuleClipScale,
      literalCartoucheRuleClipStrategy: literalCartoucheSettings.literalCartoucheRuleClipStrategy,
      literalCartoucheLeftCapClipRatio: literalCartoucheSettings.literalCartoucheLeftCapClipRatio,
      debug: false,
      debugWasm: false
    });
  }

  async function nestedSvgFromVectorBlob(blob){
    const svgText = await blob.text();
    const open = svgText.match(/<svg\b([^>]*)>/i);
    const closeIdx = svgText.toLowerCase().lastIndexOf("</svg>");
    if (!open || closeIdx < 0) throw new Error("Vector SVG parse failed.");
    const attrs = open[1] || "";
    const viewBoxMatch = attrs.match(/viewBox="([^"]+)"/i);
    const widthMatch = attrs.match(/width="([0-9.]+)"/i);
    const heightMatch = attrs.match(/height="([0-9.]+)"/i);
    const inner = svgText.slice(open.index + open[0].length, closeIdx);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${widthMatch?.[1] || 1} ${heightMatch?.[1] || 1}`;
    return { inner, viewBox };
  }

  function parseSvgViewBoxString(viewBox, fallbackW = 1, fallbackH = 1){
    const parts = String(viewBox || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
    return { x: 0, y: 0, w: Math.max(1, Number(fallbackW || 1)), h: Math.max(1, Number(fallbackH || 1)) };
  }

  function formatSvgViewBoxBox(box){
    const b = box || {};
    return `${svgNum(Number(b.x || 0))} ${svgNum(Number(b.y || 0))} ${svgNum(Math.max(1, Number(b.w || 1)))} ${svgNum(Math.max(1, Number(b.h || 1)))}`;
  }

  function svgPlacedVectorInnerGroup({ inner, viewBox, x, y, w, h, preserveAspectRatio = 'none', extraData = '' } = {}){
    const vb = (typeof viewBox === 'object' && viewBox)
      ? viewBox
      : parseSvgViewBoxString(viewBox, w, h);
    const localX = Number(x || 0);
    const localY = Number(y || 0);
    const boxW = Math.max(1, Number(w || 1));
    const boxH = Math.max(1, Number(h || 1));
    const vbW = Math.max(1, Number(vb.w || 1));
    const vbH = Math.max(1, Number(vb.h || 1));
    const par = String(preserveAspectRatio || 'none').trim();

    let sx = boxW / vbW;
    let sy = boxH / vbH;
    let dx = localX;
    let dy = localY;

    if (!/^none$/i.test(par)) {
      const meet = !/slice/i.test(par);
      const s = meet ? Math.min(sx, sy) : Math.max(sx, sy);
      sx = sy = s;
      const drawW = vbW * s;
      const drawH = vbH * s;
      if (/xMid/i.test(par)) dx += (boxW - drawW) / 2;
      else if (/xMax/i.test(par)) dx += (boxW - drawW);
      if (/YMid/i.test(par)) dy += (boxH - drawH) / 2;
      else if (/YMax/i.test(par)) dy += (boxH - drawH);
    }

    const dataAttr = extraData ? ` ${extraData}` : '';
    return `<g${dataAttr} transform="translate(${svgNum(dx)} ${svgNum(dy)}) scale(${svgNum(sx)} ${svgNum(sy)}) translate(${svgNum(-Number(vb.x || 0))} ${svgNum(-Number(vb.y || 0))})">${inner || ''}</g>`;
  }


  function svgParseHexRgb(value){
    const hex = rgbaOrHexToHex(value, "").trim();
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const s = m[1];
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function svgIsReddishHex(value){
    const rgb = svgParseHexRgb(value);
    if (!rgb) return false;
    return rgb.r >= 120 && rgb.r > rgb.g * 1.2 && rgb.r > rgb.b * 1.2;
  }

  function svgRelativeLuminance(value){
    const rgb = svgParseHexRgb(value);
    if (!rgb) return null;
    const channel = (v) => {
      const s = Math.max(0, Math.min(255, v)) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function svgContrastRatio(a, b){
    const la = svgRelativeLuminance(a);
    const lb = svgRelativeLuminance(b);
    if (la == null || lb == null) return 21;
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function svgResolveUnknownStrokeColor(display, fgHex, backgroundHex){
    const mode = String(display?.colorMode || "auto").toLowerCase();
    if (mode === "custom" && display?.color) return rgbaOrHexToHex(display.color, "#D00000");
    if (mode === "yellow") return "#C9A500";
    if (mode === "red") return "#D00000";

    // Auto mode mirrors the production raster renderer: start with red,
    // switch to yellow when the sitelen foreground is red/reddish. The extra
    // contrast checks stop either outline colour from disappearing on matching
    // element fills or stage backgrounds.
    const red = "#D00000";
    const yellow = "#C9A500";
    const black = "#000000";
    const white = "#FFFFFF";
    const surfaces = [fgHex, backgroundHex].map(v => rgbaOrHexToHex(v, "")).filter(v => /^#[0-9a-f]{6}$/i.test(v));

    const minContrast = 2.0;
    const candidateOrder = svgIsReddishHex(fgHex) ? [yellow, red, black, white] : [red, yellow, black, white];
    for (const c of candidateOrder) {
      if (surfaces.every(surface => svgContrastRatio(c, surface) >= minContrast)) return c;
    }
    return svgIsReddishHex(fgHex) ? yellow : red;
  }

  function svgUnknownTextRectForRun(run){
    const isUnknown = !!(run?.isUnrecognized || run?._element?.isUnrecognized);
    if (!isUnknown) return "";

    const display = run?.unknownDisplay || run?._element?.unknownDisplay || {};
    const pad = Number.isFinite(Number(display.paddingPx)) ? Number(display.paddingPx) : 2;
    const strokeW = Number.isFinite(Number(display.lineWidthPx)) ? Number(display.lineWidthPx) : 1.5;

    const x = Number.isFinite(Number(run?.drawXPx)) ? Number(run.drawXPx) : Number(run?.xPx || 0);
    const baselineY = Number(run?.baselineYPx || 0);
    const fontPx = Math.max(6, Number(run?.fontPx || 16));
    const ascent = Number.isFinite(Number(run?.ascentPx)) ? Number(run.ascentPx) : Math.ceil(fontPx * 0.8);
    const descent = Number.isFinite(Number(run?.descentPx)) ? Number(run.descentPx) : Math.ceil(fontPx * 0.2);
    const w = Math.max(1, Number(run?.widthPx || 1));
    const h = Math.max(1, ascent + descent);
    const fgHex = rgbaOrHexToHex(run?.fillStyle || run?._element?.color || "#111111", "#111111");
    const backgroundHex = rgbaOrHexToHex(run?._element?.fill || Scene?.stage?.bg || "#FFFFFF", "#FFFFFF");
    const strokeColor = svgResolveUnknownStrokeColor(display, fgHex, backgroundHex);
    const dashAttr = display?.dash ? ` stroke-dasharray="4 2"` : "";

    return `<rect data-unknown-text="true" x="${svgNum(x - pad)}" y="${svgNum(baselineY - ascent - pad)}" width="${svgNum(w + pad * 2)}" height="${svgNum(h + pad * 2)}" fill="none" stroke="${svgEsc(strokeColor)}" stroke-width="${svgNum(strokeW)}" vector-effect="non-scaling-stroke"${dashAttr} />`;
  }

  function svgUnknownTextRectsForPlan(plan){
    const rects = [];
    for (const line of (plan?.lines || [])) {
      for (const run of (line?.runs || [])) {
        const rect = svgUnknownTextRectForRun(run);
        if (rect) rects.push(rect);
      }
    }
    return rects.join("\n");
  }


  function isNoDrawableRunsError(err){
    return /No drawable runs in render plan/i.test(String(err && (err.message || err) || ""));
  }

  function findWholeSitelenNumericCartoucheHit(rawText){
    const raw = String(rawText ?? "");
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // This helper is intentionally strict: it is only for a whole sitelen element
    // whose complete text is numeric/date/time/code/proper-name input. Mixed
    // ordinary sitelen text still goes through the production renderer/parser.
    const hitSets = [
      ...findTimeSequencesWithCaps(trimmed),
      ...findDateSequencesWithCaps(trimmed),
      ...findDecimalSequencesWithCaps(trimmed),
      ...findNumberCodeSequencesWithCaps(trimmed),
      ...findNanpaLinjanProperNameSequencesWithCaps(trimmed)
    ];

    for (const h of hitSets) {
      if ((h.index | 0) !== 0 || (h.end | 0) !== trimmed.length) continue;
      if (h.kind === "tpPhrase") continue;
      if (!h.caps) continue;
      const isTimeLike = (h.kind === "time") || (h.kind === "date") || nanpaCapsIsValidTimeOrDate(h.caps);
      const cps = nanpaCapsToNanpaLinjanCodepoints(h.caps, { mode: "uniform", isTime: isTimeLike });
      if (cps && cps.length) return { ...h, cps, isTimeLike, raw: trimmed };
    }

    const idCps =
      tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed, { mode: "uniform" }) ??
      tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed.replace(/\s+/g, ""), { mode: "uniform" });
    if (idCps && idCps.length) return { kind: "properName", cps: idCps, raw: trimmed };

    return null;
  }

  function buildDirectNumericCartoucheVectorPlanForElement(el, numericHit, config){
    if (!numericHit || !Array.isArray(numericHit.cps) || !numericHit.cps.length) return null;

    const fontPx = Math.max(6, Number(el?.fontSize ?? config?.layout?.fontPx ?? 44));
    const halo = config?.paint?.halo || {};
    const haloWidth = halo?.enabled ? Math.max(0, Number(halo.widthPx || 0)) : 0;
    const padPx = Math.max(4, Math.round(fontPx * 0.11));
    const cartoucheFamily = String(getRenderFontPreset(getElementRenderFontPresetKey(el))?.cartoucheFamily || FONT_FAMILY_CARTOUCHE);
    const fillStyle = el?.color || config?.paint?.fillStyle || "#111111";

    let innerCps = Array.from(numericHit.cps || []);
    if (el?.abbreviateNumericCartouches) {
      innerCps = abbreviateNumericCartoucheCpsForExport(innerCps);
    }
    const frameCps = [CARTOUCHE_START_CP, ...innerCps, CARTOUCHE_END_CP];
    const chars = frameCps.map(cp => String.fromCodePoint(cp)).join("");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";
    ctx.font = `${fontPx}px "${cartoucheFamily}"`;
    setTextQuality(ctx);
    const m = ctx.measureText(chars);

    const ascent = (m.actualBoundingBoxAscent != null) ? m.actualBoundingBoxAscent : Math.ceil(fontPx * 0.95);
    const descent = (m.actualBoundingBoxDescent != null) ? m.actualBoundingBoxDescent : Math.ceil(fontPx * 0.35);
    const left = (m.actualBoundingBoxLeft != null) ? m.actualBoundingBoxLeft : 0;
    const right = (m.actualBoundingBoxRight != null) ? m.actualBoundingBoxRight : Math.ceil(m.width);
    const tightW = Math.max(1, Math.ceil(left + right));
    const tightH = Math.max(1, Math.ceil(ascent + descent));
    const widthPx = Math.max(1, Math.ceil(tightW + padPx * 2 + haloWidth * 2));
    const heightPx = Math.max(1, Math.ceil(tightH + padPx * 2 + haloWidth * 2));
    const drawXPx = padPx + left + haloWidth;
    const baselineYPx = padPx + ascent + haloWidth;

    const run = {
      kind: "glyph",
      renderMode: "rawUcsur",
      sourceKind: numericHit.kind || "numeric",
      fontRole: "number",
      fontFamily: cartoucheFamily,
      fontPx,
      cps: frameCps,
      xPx: drawXPx,
      drawXPx,
      baselineYPx,
      widthPx: tightW,
      heightPx: tightH,
      ascentPx: ascent,
      descentPx: descent,
      fillStyle,
      halo: {
        enabled: !!halo?.enabled,
        color: halo?.color || "#FFFFFF",
        widthPx: haloWidth
      },
      _element: {
        type: "run",
        cps: frameCps,
        fontFamily: cartoucheFamily,
        fillStyle,
        halo: { enabled: !!halo?.enabled, color: halo?.color || "#FFFFFF", widthPx: haloWidth }
      }
    };

    return {
      widthPx,
      heightPx,
      lines: [{
        index: 0,
        yPx: 0,
        baselineYPx,
        heightPx,
        runs: [run]
      }],
      diagnostics: [],
      normalizedInput: String(numericHit.raw || el?.text || ""),
      directNumericCartouche: true
    };
  }

  function normalizeSitelenVectorExportInput(rawText){
    return prepareSitelenInputWithActiveCartoucheDb(rawText);
  }

  function planHasDrawableRuns(plan){
    for (const line of (plan?.lines || [])) {
      for (const run of (line?.runs || [])) {
        if (!run || run.kind === "gap" || run.kind === "image" || run.isImage) continue;
        if (typeof run.encodedText === "string" && run.encodedText.length) return true;
        if (Array.isArray(run.cps) && run.cps.length) return true;
        const rel = run._element || run.element || null;
        if (typeof rel?.text === "string" && rel.text.length) return true;
        if (Array.isArray(rel?.cps) && rel.cps.length) return true;
      }
    }
    return false;
  }

  function normalizeSitelenVectorPlanFontRoles(plan, el){
    if (!plan || !el) return plan;
    const quotedLiteralFamily = getElementResolvedQuotedTextFontFamily(el) || getRenderFontPreset(getElementRenderFontPresetKey(el)).literalFamily || FONT_FAMILY_LITERAL;
    const literalCartoucheFamily = getElementLiteralCartoucheFontFamily(el);

    vectorFontDebug("normalizeSitelenVectorPlanFontRoles BEFORE", {
      elementId: el?.id || null,
      renderFontPreset: getElementRenderFontPresetKey(el),
      quotedTextFontOption: el?.quotedTextFontOption || null,
      quotedLiteralFamily,
      literalCartoucheFamily,
      runs: summarizeVectorFontPlan(plan)
    });

    for (const line of (plan.lines || [])) {
      for (const run of (line.runs || [])) {
        const element = run?._element || run?.element || null;
        const isQuotedLiteral =
          run?.fontRole === "literal" ||
          run?.isQuoted === true ||
          element?.isQuoted === true ||
          (run?.kind === "text" && run?.sourceKind === "quote");
        const isUnknownLiteral =
          run?.fontRole === "unknown" ||
          run?.isUnrecognized === true ||
          element?.isUnrecognized === true;
        const isLiteralCartouche =
          run?.fontRole === "literalCartouche" ||
          element?.isLiteralCartouche === true;

        if (isLiteralCartouche) {
          run.fontRole = "literalCartouche";
          run.fontFamily = literalCartoucheFamily;
          if (element) element.fontFamily = literalCartoucheFamily;
          continue;
        }

        if (isQuotedLiteral || isUnknownLiteral) {
          run.fontRole = isUnknownLiteral && !isQuotedLiteral ? "unknown" : "literal";
          run.fontFamily = quotedLiteralFamily;
          if (element) element.fontFamily = quotedLiteralFamily;
        }
      }
    }
    vectorFontDebug("normalizeSitelenVectorPlanFontRoles AFTER", {
      elementId: el?.id || null,
      quotedLiteralFamily,
      literalCartoucheFamily,
      runs: summarizeVectorFontPlan(plan)
    });
    return plan;
  }

  function isWhitespaceOnlySitelenElement(el){
    return String(el?.text ?? "").trim().length === 0;
  }

  async function svgSitelenElementForExport(el){
    const out = [];
    const x = -el.w / 2, y = -el.h / 2;
    const contentYOffset = vectorYOffsetPx(el);
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: svgColor(el.fill), stroke: "none"}));
    }

    // Production behavior: a sitelen element containing only whitespace/newlines
    // is a valid empty element. It has no drawable sitelen runs and should not
    // abort page/PDF export. Preserve any fill/stroke box, but emit no glyph paths.
    if (isWhitespaceOnlySitelenElement(el)){
      if ((el.strokeW ?? 0) > 0){
        out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: "none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1}));
      }
      return out.join("\n");
    }

    const exporter = await createVectorExporterForElement(el);
    const sitelenConfig = buildRendererCallConfigForElement(el);
    vectorFontDebug("svgSitelenElementForExport renderer config", {
      elementId: el?.id || null,
      text: String(el.text ?? ""),
      renderFontPreset: getElementRenderFontPresetKey(el),
      quotedTextFontOption: el?.quotedTextFontOption || null,
      resolvedQuotedLiteralFamily: getElementResolvedQuotedTextFontFamily(el),
      roles: sitelenConfig?.fonts?.roles || null,
      parser: sitelenConfig?.parser || null,
      layout: sitelenConfig?.layout || null
    });

    let plan = null;
    let selectedInput = null;
    let lastPlanError = null;

    const numericHit = findWholeSitelenNumericCartoucheHit(String(el.text ?? ""));
    if (numericHit) {
      plan = buildDirectNumericCartoucheVectorPlanForElement(el, numericHit, sitelenConfig);
      selectedInput = {
        label: "whole-numeric-cartouche-direct",
        input: String(el.text ?? ""),
        kind: numericHit.kind || "numeric"
      };
      vectorFontDebug("svgSitelenElementForExport direct numeric cartouche plan", {
        elementId: el?.id || null,
        text: String(el.text ?? ""),
        numericKind: numericHit.kind || null,
        abbreviated: !!el?.abbreviateNumericCartouches,
        planSize: { widthPx: plan?.widthPx, heightPx: plan?.heightPx },
        runs: summarizeVectorFontPlan(plan)
      });
    }

    if (!plan) {
      const normalizedInput = normalizeSitelenVectorExportInput(String(el.text ?? ""));
      try {
        const rawPlan = await exporter.buildPlan({ input: normalizedInput, config: sitelenConfig });
        vectorFontDebug("svgSitelenElementForExport production plan", {
          elementId: el?.id || null,
          normalizedInput,
          planSize: { widthPx: rawPlan?.widthPx, heightPx: rawPlan?.heightPx },
          rawRunCount: (rawPlan?.lines || []).reduce((n, line) => n + ((line?.runs || []).length), 0),
          hasDrawableRuns: planHasDrawableRuns(rawPlan),
          runs: summarizeVectorFontPlan(rawPlan)
        });
        const normalizedPlan = normalizeSitelenVectorPlanFontRoles(rawPlan, el);
        if (!planHasDrawableRuns(normalizedPlan)) {
          lastPlanError = new Error("No drawable runs in production-equivalent sitelen render plan");
        } else {
          plan = normalizedPlan;
          selectedInput = { label: "production-prepared", input: normalizedInput };
        }
      } catch (err) {
        lastPlanError = err;
        if (!isNoDrawableRunsError(err)) throw err;
      }
    }

    if (!plan) {
      throw new Error(`Sitelen vector export produced no drawable runs for element ${el?.id || ""}: ${String(el?.text ?? "").slice(0, 80)}. Last error: ${lastPlanError?.message || lastPlanError || "none"}`);
    }

    vectorFontDebug("svgSitelenElementForExport selected plan", {
      elementId: el?.id || null,
      selectedInputCandidate: selectedInput?.label || null,
      selectedInput: selectedInput?.input || null,
      planSize: { widthPx: plan?.widthPx, heightPx: plan?.heightPx }
    });

    let blob = null;
    try {
      blob = await exporter.exportTextToSvgBlob({
        plan,
        paddingPx: 0,
        fallbackWidthPx: Math.max(1, el.w),
        fallbackHeightPx: Math.max(1, el.h)
      });
    } catch (err) {
      if (!isNoDrawableRunsError(err)) throw err;
      throw new Error(`Sitelen vector export failed after selected drawable plan for element ${el?.id || ""}. This indicates exporter/plan drawable filtering mismatch: ${err.message || err}`);
    }
    const nested = await nestedSvgFromVectorBlob(blob);
    const unknownTextRects = (!el.ignoreUnknownText) ? svgUnknownTextRectsForPlan(plan) : "";
    const nestedInnerWithUnknownRects = unknownTextRects ? `${nested.inner}
${unknownTextRects}` : nested.inner;
    const tightMetrics = (el.vectorSitelenTightMetrics && typeof el.vectorSitelenTightMetrics === "object")
      ? el.vectorSitelenTightMetrics
      : null;
    if (tightMetrics){
      // Legacy/import-migrated sitelen elements are converted from the old
      // production raster box into a vector-native tight box.  The stored
      // source viewBox describes the visible renderer output in the original
      // vector coordinate space, and el.w/el.h describe the old displayed size
      // after production's drawImage scaling.  Use that exact viewBox/box pair
      // instead of doing a second center/meet scaling pass.
      const vb = parseSvgViewBoxString(nested.viewBox, tightMetrics.sourceCanvasW || el.w, tightMetrics.sourceCanvasH || el.h);
      const sourceX = Number(tightMetrics.sourceX ?? 0);
      const sourceY = Number(tightMetrics.sourceY ?? 0);
      const sourceW = Math.max(1, Number(tightMetrics.sourceW ?? vb.w));
      const sourceH = Math.max(1, Number(tightMetrics.sourceH ?? vb.h));
      const tightViewBox = { x: vb.x + sourceX, y: vb.y + sourceY, w: sourceW, h: sourceH };
      out.push(svgPlacedVectorInnerGroup({
        inner: nestedInnerWithUnknownRects,
        viewBox: tightViewBox,
        x,
        y: y + contentYOffset,
        w: el.w,
        h: el.h,
        preserveAspectRatio: 'none',
        extraData: 'data-sitelen-vector="flattened-tight" data-sitelen-overflow="visible"'
      }));
    } else {
      // Keep sitelen fragments as nested SVG viewBoxes, matching the layout-editor
      // vector exporter. The direct PDF DOM walker understands nested SVG
      // x/y/width/height/viewBox/preserveAspectRatio and applies those transforms
      // before drawing paths, so browser SVG, SVG ZIP, HTML, PNG-from-SVG, and
      // vector PDF now use the same placement semantics.
      const par = svgSitelenPreserveAspectRatio(el);
      const guardedViewBox = guardedSitelenViewBox(nested.viewBox, el);
      out.push(svgPlacedVectorInnerGroup({
        inner: nestedInnerWithUnknownRects,
        viewBox: guardedViewBox,
        x,
        y: y + contentYOffset,
        w: el.w,
        h: el.h,
        preserveAspectRatio: par,
        extraData: 'data-sitelen-vector="flattened-guarded" data-sitelen-overflow="visible"'
      }));
    }
    if ((el.strokeW ?? 0) > 0){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: "none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1}));
    }
    return out.join("\n");
  }

  function glyphUsesCanvasMiddlePlacement(el){
    // Long-term glyph model: all glyph elements, legacy and new, emulate
    // production Canvas drawText placement. The element box is a placement
    // box; fontSize controls glyph size. The glyph is not stretched to fill
    // the box unless a separate explicit font-scaling operation changes
    // fontSize.
    return !!el && (el.type === ElementType.Glyph || el.type === "glyph");
  }


  function svgTextLiteralSourceForElement(el){
    // Text elements are literal Unicode text containers. Do not run the
    // sitelen parser, CartoucheApi.prepareInput(), numeric-cartouche
    // normalization, or any nanpa-linja-n recognizer here. Existing UCSUR
    // characters, ordinary Latin text, numbers, dates, and punctuation are
    // emitted exactly as stored in el.text.
    return String(el?.text ?? "");
  }

  function svgTextWrapLinesForElement(el, innerW, fontSize, fontFamily){
    const c = document.createElement("canvas");
    const mctx = c.getContext("2d");
    mctx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
    try { setTextQuality(mctx); } catch {}
    const rawLines = splitLinesForBox(svgTextLiteralSourceForElement(el));
    const out = [];
    for (const ln0 of rawLines){
      const wrapped = wrapLine(mctx, String(ln0 ?? ""), Math.max(1, Number(innerW || 1)));
      if (wrapped && wrapped.length) out.push(...wrapped);
      else out.push("");
    }
    return out;
  }

  async function svgPlainTextVectorPathsForExport(el, lines, innerX, innerY, innerW, innerH, fontSize, linePx, fontFamily, fill, haloW, haloColor){
    const drawableLines = (Array.isArray(lines) ? lines : []).map(v => String(v ?? ""));
    if (!drawableLines.some(line => line.length > 0)) return "";

    const exporter = await createVectorExporterForElement(el);
    const canvas = document.createElement("canvas");
    const mctx = canvas.getContext("2d");
    mctx.font = `${fontSize}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
    try { setTextQuality(mctx); } catch {}

    const align = ["left", "center", "right"].includes(String(el.align || "left")) ? String(el.align || "left") : "left";
    const runs = [];
    let yCursor = 0;
    const ascentDefault = Math.ceil(fontSize * 0.82);
    const descentDefault = Math.ceil(fontSize * 0.24);

    for (const line of drawableLines){
      if (yCursor + linePx > innerH + 0.5) break;
      if (!line.length){
        yCursor += linePx;
        continue;
      }
      const m = mctx.measureText(line);
      const lineW = Math.max(1, Number(m.width || 1));
      const ascent = Math.max(1, Number(m.actualBoundingBoxAscent ?? ascentDefault));
      const descent = Math.max(0, Number(m.actualBoundingBoxDescent ?? descentDefault));
      const drawX = align === "center" ? Math.max(0, (innerW - lineW) / 2)
                  : align === "right" ? Math.max(0, innerW - lineW)
                  : 0;
      const baselineY = yCursor + ascent;
      runs.push({
        kind: "text",
        renderMode: "literalUnicode",
        sourceKind: "plainText",
        fontRole: "literal",
        fontFamily,
        fontPx: fontSize,
        encodedText: line,
        sourceText: line,
        xPx: drawX,
        drawXPx: drawX,
        baselineYPx: baselineY,
        widthPx: lineW,
        heightPx: Math.max(1, ascent + descent),
        ascentPx: ascent,
        descentPx: descent,
        fillStyle: fill,
        halo: { enabled: haloW > 0, color: haloColor, widthPx: haloW },
        _element: {
          type: "plain-text-run",
          text: line,
          fontFamily,
          fillStyle: fill,
          halo: { enabled: haloW > 0, color: haloColor, widthPx: haloW }
        }
      });
      yCursor += linePx;
    }

    if (!runs.length) return "";
    const plan = {
      widthPx: Math.max(1, Number(innerW || 1)),
      heightPx: Math.max(1, Number(innerH || 1)),
      fontPx: fontSize,
      fillStyle: fill,
      lines: [{ index: 0, yPx: 0, baselineYPx: 0, heightPx: innerH, runs }],
      diagnostics: [],
      plainTextLiteralUnicode: true,
      normalizedInput: drawableLines.join("\n")
    };

    const blob = await exporter.exportTextToSvgBlob({
      plan,
      paddingPx: 0,
      fallbackWidthPx: plan.widthPx,
      fallbackHeightPx: plan.heightPx
    });
    const nested = await nestedSvgFromVectorBlob(blob);

    // Do not use SVG <text> for PDF export: the PDF DOM walker deliberately
    // uses vector paths for text so the PDF output matches the live Patrick
    // Hand/literal font.  The input remains literal Unicode; only the final
    // drawing primitive changes from SVG text nodes to font-outline paths.
    return `<g data-element-kind="plain-text" data-text-processing="literal-unicode" data-text-output="font-outline-paths" transform="translate(${svgNum(innerX)} ${svgNum(innerY)})">${nested.inner}</g>`;
  }

  async function svgTextElementForExport(el){
    const out = [];
    const x = -Number(el.w || 0) / 2;
    const y = -Number(el.h || 0) / 2;
    const w = Math.max(1, Number(el.w || 1));
    const h = Math.max(1, Number(el.h || 1));

    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      out.push(svgRectNode({ x, y, w, h, fill: svgColor(el.fill), stroke: "none" }));
    }

    const pad = 8;
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = Math.max(1, w - pad * 2);
    const innerH = Math.max(1, h - pad * 2);
    const fontSize = Math.max(6, Number(el.fontSize ?? 24));
    const fontFamily = getElementResolvedTextFontFamily(el) || FONT_FAMILY_LITERAL;
    const lineHeight = Math.max(0.8, Number(el.lineHeight ?? 1.15));
    const linePx = fontSize * lineHeight;
    const fill = svgColor(el.color || "#111111");
    const haloW = effectiveHaloThicknessForElementExport(el);
    const haloColor = rgbaOrHexToHex(el.haloColor, "#FFFFFF");
    const lines = svgTextWrapLinesForElement(el, innerW, fontSize, fontFamily);

    const vectorText = await svgPlainTextVectorPathsForExport(el, lines, innerX, innerY, innerW, innerH, fontSize, linePx, fontFamily, fill, haloW, haloColor);
    if (vectorText) out.push(vectorText);

    if ((el.strokeW ?? 0) > 0){
      out.push(svgRectNode({ x, y, w, h, fill: "none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1 }));
    }
    return out.join("\n");
  }

  function canvasMiddleGlyphMetrics(el, cp, fontPx, fontFamily){
    const ch = (typeof cp === "number") ? String.fromCodePoint(cp) : "?";
    const c = document.createElement("canvas");
    const mctx = c.getContext("2d");
    mctx.font = `${fontPx}px ${cssFontFamily(fontFamily)}, system-ui, sans-serif`;
    mctx.textBaseline = "alphabetic";
    mctx.textAlign = "left";
    try { setTextQuality(mctx); } catch {}
    const m = mctx.measureText(ch);
    const advance = Math.max(1, Number(m.width || fontPx));
    const ascent = Math.max(1, Number(m.actualBoundingBoxAscent ?? fontPx * 0.8));
    const descent = Math.max(0, Number(m.actualBoundingBoxDescent ?? fontPx * 0.2));

    // Canvas production draws glyphs with textAlign="center" and
    // textBaseline="middle" at the element-box center.  The vector exporter
    // wants an alphabetic baseline, so convert the middle anchor to an
    // alphabetic baseline using the same measured font metrics.
    return {
      advance,
      ascent,
      descent,
      drawXPx: Math.max(0, Number(el.w || 0) / 2 - advance / 2),
      baselineYPx: Number(el.h || 0) / 2 + (ascent - descent) / 2,
    };
  }

  async function svgGlyphElementForExport(el){
    const out = [];
    const x = -el.w / 2, y = -el.h / 2;
    const contentYOffset = vectorYOffsetPx(el);
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: svgColor(el.fill), stroke: "none"}));
    }
    const cp = parseCodepointInput(el.codepoint);
    if (typeof cp === "number"){
      const fontPx = Math.max(6, Number(el.fontSize ?? 64));
      const fontFamily = getRenderFontPreset(getElementRenderFontPresetKey(el)).textFamily || FONT_FAMILY_TEXT;
      const exporter = await createVectorExporterForElement(el);
      const haloW = effectiveHaloThicknessForElementExport(el);
      const canvasMiddleGlyph = glyphUsesCanvasMiddlePlacement(el);
      const tightMetrics = null;

      let planW;
      let planH;
      let drawX;
      let baselineY;

      if (canvasMiddleGlyph){
        // Legacy production glyphs were drawn directly by Canvas with:
        //   textAlign = "center";
        //   textBaseline = "middle";
        //   fillText(ch, x + w/2, y + h/2)
        // Keep the imported box unchanged and emulate that anchor using vector
        // paths.  Do not tighten or scale imported glyph boxes.
        const metrics = canvasMiddleGlyphMetrics(el, cp, fontPx, fontFamily);
        planW = Math.max(1, Number(el.w || fontPx * 2));
        planH = Math.max(1, Number(el.h || fontPx * 2));
        drawX = metrics.drawXPx;
        baselineY = metrics.baselineYPx;
      } else {
        planW = Math.max(1, Number(tightMetrics?.widthPx ?? fontPx * 2));
        planH = Math.max(1, Number(tightMetrics?.heightPx ?? fontPx * 2));
        drawX = Math.max(0, Number(tightMetrics?.drawXPx ?? fontPx * 0.5));
        baselineY = Math.max(1, Number(tightMetrics?.baselineYPx ?? fontPx * 1.25));
      }

      const plan = {
        widthPx: planW,
        heightPx: planH,
        fontPx,
        fillStyle: rgbaOrHexToHex(el.color || "#111111", "#111111"),
        lines: [{ runs: [{
          kind: "glyph",
          cps: [cp],
          fontFamily,
          fontRole: "word",
          xPx: drawX,
          drawXPx: drawX,
          baselineYPx: baselineY,
          fontPx,
          fillStyle: rgbaOrHexToHex(el.color || "#111111", "#111111"),
          halo: { enabled: haloW > 0, color: rgbaOrHexToHex(el.haloColor, "#FFFFFF"), widthPx: haloW }
        }] }]
      };
      const blob = await exporter.exportTextToSvgBlob({ plan, paddingPx: 0, fallbackWidthPx: planW, fallbackHeightPx: planH });
      const nested = await nestedSvgFromVectorBlob(blob);

      if (canvasMiddleGlyph){
        // Same coordinate system as the imported element box, so no scaling and
        // no preserveAspectRatio fitting. overflow is visible to match Canvas:
        // production drawText is not clipped to the element rectangle.
        const glyphX = x + vectorXOffsetPx(el);
        const glyphY = y + contentYOffset;
        out.push(svgPlacedVectorInnerGroup({
          inner: nested.inner,
          viewBox: { x: 0, y: 0, w: planW, h: planH },
          x: glyphX,
          y: glyphY,
          w: el.w,
          h: el.h,
          preserveAspectRatio: 'none',
          extraData: 'data-glyph-vector="flattened-canvas-middle"'
        }));
      } else if (tightMetrics){
        const glyphX = x + vectorXOffsetPx(el);
        const glyphY = y + contentYOffset;
        out.push(svgPlacedVectorInnerGroup({
          inner: nested.inner,
          viewBox: nested.viewBox,
          x: glyphX,
          y: glyphY,
          w: el.w,
          h: el.h,
          preserveAspectRatio: 'none',
          extraData: 'data-glyph-vector="flattened-tight"'
        }));
      } else {
        const glyphScale = lookupVectorScale(el);
        const glyphViewportW = Math.max(1, fontPx * 2 * glyphScale);
        const glyphViewportH = Math.max(1, fontPx * 2 * glyphScale);
        const glyphX = x + (Number(el.w || 0) - glyphViewportW) / 2 + vectorXOffsetPx(el);
        const glyphY = y + (Number(el.h || 0) - glyphViewportH) / 2 + contentYOffset;
        out.push(svgPlacedVectorInnerGroup({
          inner: nested.inner,
          viewBox: nested.viewBox,
          x: glyphX,
          y: glyphY,
          w: glyphViewportW,
          h: glyphViewportH,
          preserveAspectRatio: 'xMidYMid meet',
          extraData: 'data-glyph-vector="flattened"'
        }));
      }
    }
    if ((el.strokeW ?? 0) > 0){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: "none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1}));
    }
    return out.join("\n");
  }

  async function svgImageElementForExport(el){
    const x = -el.w / 2, y = -el.h / 2;
    const out = [];
    if (el.fillEnabled && el.fill && el.fill !== "transparent" && el.fill !== "rgba(255,255,255,0.0)"){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: svgColor(el.fill), stroke: "none"}));
    }
    const dataUrl = el.image?.assetId ? getImageAssetDataUrl(el.image.assetId) : null;
    if (dataUrl){
      out.push(`<image x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(el.w)}" height="${svgNum(el.h)}" href="${svgEsc(dataUrl)}" preserveAspectRatio="none" />`);
    } else {
      out.push(svgRectNode({x:x+1, y:y+1, w:el.w-2, h:el.h-2, fill:"none", stroke:"rgba(17,17,17,0.28)", strokeWidth:2}));
    }
    if ((el.strokeW ?? 0) > 0){
      out.push(svgRectNode({x, y, w: el.w, h: el.h, fill: "none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1}));
    }
    return out.join("\n");
  }

  function svgMediaCardSvgForExport(el, label){
    const x = -Number(el.w || 0) / 2;
    const y = -Number(el.h || 0) / 2;
    const w = Math.max(1, Number(el.w || 1));
    const h = Math.max(1, Number(el.h || 1));
    const pad = Math.min(18, Math.max(8, Math.round(Math.min(w, h) * 0.08)));
    const title = String(label || 'Media').replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim() || 'Media';
    const sub = (el.type === ElementType.Url)
      ? String(el?.url?.href || '').trim()
      : String(el?.title || el?.searchTag || '').trim();
    const fontSize = Math.max(10, Math.min(22, Math.round(h * 0.18)));
    const subSize = Math.max(8, Math.min(14, Math.round(h * 0.11)));
    const fill = elementFillPaint(el);
    const strokeInfo = elementStrokePaint(el, 'rgba(17,17,17,0.25)');
    const parts = [];
    parts.push(svgRectNode({ x, y, w, h, r: 14, fill, stroke: strokeInfo.stroke, strokeWidth: strokeInfo.strokeWidth }));
    parts.push(`<text x="${svgNum(x + pad)}" y="${svgNum(y + pad)}" dominant-baseline="hanging" font-family="system-ui, -apple-system, sans-serif" font-size="${svgNum(fontSize)}" font-weight="700" fill="#333333">${svgEsc(title)}</text>`);
    if (sub) {
      const clipped = sub.length > 80 ? sub.slice(0, 77) + '...' : sub;
      parts.push(`<text x="${svgNum(x + pad)}" y="${svgNum(y + pad + fontSize + 8)}" dominant-baseline="hanging" font-family="system-ui, -apple-system, sans-serif" font-size="${svgNum(subSize)}" fill="#666666">${svgEsc(clipped)}</text>`);
    }
    return parts.join('\n');
  }

  function svgPosterImageNodeForExport(el, posterId, keepAspect){
    const dataUrl = posterId ? getImageAssetDataUrl(String(posterId)) : null;
    if (!dataUrl) return '';
    const x = -Number(el.w || 0) / 2;
    const y = -Number(el.h || 0) / 2;
    const w = Math.max(1, Number(el.w || 1));
    const h = Math.max(1, Number(el.h || 1));
    const out = [];
    if (el.fillEnabled && el.fill && el.fill !== 'transparent' && el.fill !== 'rgba(255,255,255,0.0)'){
      out.push(svgRectNode({ x, y, w, h, fill: svgColor(el.fill), stroke: 'none' }));
    }
    const preserve = keepAspect === false ? 'none' : 'xMidYMid meet';
    out.push(`<image x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(w)}" height="${svgNum(h)}" href="${svgEsc(dataUrl)}" preserveAspectRatio="${preserve}" />`);
    if ((el.strokeW ?? 0) > 0){
      out.push(svgRectNode({ x, y, w, h, fill: 'none', stroke: svgColor(el.stroke || 'rgba(17,17,17,0.35)'), strokeWidth: el.strokeW ?? 1 }));
    }
    return out.join('\n');
  }

  async function svgAudioElementForExport(el){
    return svgMediaCardSvgForExport(el, 'Audio');
  }

  async function svgVideoElementForExport(el){
    const poster = svgPosterImageNodeForExport(el, el.posterAssetId, el.keepAspect);
    return poster || svgMediaCardSvgForExport(el, 'Video');
  }

  async function svgUrlElementForExport(el){
    const posterId = el?.url?.posterAssetId;
    const poster = svgPosterImageNodeForExport(el, posterId, el.keepAspect);
    if (poster) return poster;
    const kind = String(el?.url?.detectedKind || 'link');
    return svgMediaCardSvgForExport(el, kind === 'video' ? 'Video link' : kind === 'image' ? 'Image link' : 'URL');
  }

  async function svgElementInnerForExport(el){
    const parts = [];
    const x = -el.w / 2, y = -el.h / 2;
    if (el.type === ElementType.Rect){
      const r = Number(el.radius ?? 0);
      const haloW = effectiveHaloThicknessForElementExport(el);
      if (el.fillEnabled && el.fill && el.fill !== "transparent") parts.push(svgRectNode({x, y, w: el.w, h: el.h, r, fill: svgColor(el.fill), stroke:"none"}));
      if (haloW > 0) parts.push(svgRectNode({x, y, w: el.w, h: el.h, r, fill:"none", stroke: rgbaOrHexToHex(el.haloColor, "#FFFFFF"), strokeWidth: haloW}));
      if ((el.strokeW ?? 0) > 0) parts.push(svgRectNode({x, y, w: el.w, h: el.h, r, fill:"none", stroke: svgColor(el.stroke || "rgba(17,17,17,0.35)"), strokeWidth: el.strokeW ?? 1}));
    } else if (el.type === ElementType.Text){
      // Text elements are literal Unicode text. They must never be routed
      // through the sitelen parser or numeric-cartouche normalization.
      parts.push(await svgTextElementForExport(el));
    } else if (el.type === ElementType.Sitelen){
      parts.push(await svgSitelenElementForExport(el));
    } else if (el.type === ElementType.Glyph){
      parts.push(await svgGlyphElementForExport(el));
    } else if (el.type === ElementType.Image){
      parts.push(await svgImageElementForExport(el));
    } else if (el.type === ElementType.Audio){
      if (el.exportVisible !== false) parts.push(await svgAudioElementForExport(el));
    } else if (el.type === ElementType.Video){
      if (el.exportVisible !== false) parts.push(await svgVideoElementForExport(el));
    } else if (el.type === ElementType.Url){
      if (el.exportVisible !== false) parts.push(await svgUrlElementForExport(el));
    }
    return parts.join("\n");
  }

  function svgRasterPreviewScale(){
    const dpr = window.devicePixelRatio || 1;
    const z = Number(Scene?.view?.zoom || 1);
    const raw = Math.min(4, Math.max(1, dpr * z));
    return Math.max(1, Math.round(raw * 2) / 2);
  }

  function svgLocalDocumentForElement(el, inner, bitmapScale = 1){
    const w = Math.max(1, Number(el?.w || 1));
    const h = Math.max(1, Number(el?.h || 1));
    const x = -w / 2;
    const y = -h / 2;
    const pxW = Math.max(1, Math.ceil(w * Math.max(1, bitmapScale || 1)));
    const pxH = Math.max(1, Math.ceil(h * Math.max(1, bitmapScale || 1)));
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${svgNum(pxW)}" height="${svgNum(pxH)}" viewBox="${svgNum(x)} ${svgNum(y)} ${svgNum(w)} ${svgNum(h)}">\n` +
      `${inner}\n</svg>`;
  }

  async function svgTextToDataUrlPng(svgText, widthPx, heightPx){
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const off = document.createElement("canvas");
          off.width = Math.max(1, Math.ceil(widthPx || img.width || 1));
          off.height = Math.max(1, Math.ceil(heightPx || img.height || 1));
          const octx = off.getContext("2d", { alpha: true });
          octx.clearRect(0, 0, off.width, off.height);
          octx.drawImage(img, 0, 0, off.width, off.height);
          URL.revokeObjectURL(url);
          resolve(off.toDataURL("image/png"));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Element SVG raster preview failed."));
      };
      img.src = url;
    });
  }

  async function svgRasterPreviewElementForDisplay(el, inner, innerKey){
    const alpha = clamp(el.opacity ?? 1, 0, 1);
    const scale = svgRasterPreviewScale();
    const key = `${el.id}|scale:${scale}|${innerKey}`;
    let entry = svgRasterPreviewCache.get(key);
    if (!entry){
      for (const k of Array.from(svgRasterPreviewCache.keys())) {
        if (k.startsWith(`${el.id}|`)) svgRasterPreviewCache.delete(k);
      }
      const w = Math.max(1, Number(el?.w || 1));
      const h = Math.max(1, Number(el?.h || 1));
      const pxW = Math.max(1, Math.ceil(w * scale));
      const pxH = Math.max(1, Math.ceil(h * scale));
      const localSvg = svgLocalDocumentForElement(el, inner, scale);
      const dataUrl = await svgTextToDataUrlPng(localSvg, pxW, pxH);
      entry = { dataUrl, scale, w, h };
      svgRasterPreviewCache.set(key, entry);
    }
    const x = -Number(el.w || 0) / 2;
    const y = -Number(el.h || 0) / 2;
    return `<g id="${svgEsc(el.id)}" data-preview="raster" opacity="${svgNum(alpha)}" transform="${svgEsc(svgGroupTransformForElement(el))}">\n` +
      `<image x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(el.w)}" height="${svgNum(el.h)}" href="${svgEsc(entry.dataUrl)}" preserveAspectRatio="none" />\n` +
      `</g>`;
  }

  async function svgElementForExport(el, { useRasterPreviewForUnselected = false } = {}){
    const alpha = clamp(el.opacity ?? 1, 0, 1);
    const innerKeyPart = svgElementInnerCacheKey(el);
    const key = `${el.id}|${innerKeyPart}`;
    let inner = svgVectorElementCache.get(key);
    if (inner == null){
      // Remove older cached entries for this element. Movement/rotation/opacity do not affect this key.
      for (const k of Array.from(svgVectorElementCache.keys())) {
        if (k.startsWith(`${el.id}|`)) svgVectorElementCache.delete(k);
      }
      inner = await svgElementInnerForExport(el);
      svgVectorElementCache.set(key, inner);
    }

    // Live editing acceleration only: deselected elements are shown as raster
    // previews generated from the exact same SVG fragment. Selected elements
    // remain live vector so editing stays crisp and direct. Exports never use
    // this branch because they call buildSceneSvgText with the default false.
    if (useRasterPreviewForUnselected && !isSelected(el.id)) {
      try {
        return await svgRasterPreviewElementForDisplay(el, inner, innerKeyPart);
      } catch (err) {
        console.warn("Raster preview failed; falling back to live vector", el?.id, err);
      }
    }

    return `<g id="${svgEsc(el.id)}" data-preview="vector" opacity="${svgNum(alpha)}" transform="${svgEsc(svgGroupTransformForElement(el))}">\n${inner}\n</g>`;
  }


  const SCRAPBOOK_VECTOR_SVG_BOTTOM_BLEED_PX = 96;

  function sceneSvgBottomBleedPx(){
    // Canonical SVG export must match the live scene: sitelen/vector glyph ink
    // may extend below the logical stage at the bottom of a scrapbook page.
    // If the scene contains sitelen vector elements, extend the exported SVG
    // viewport so the SVG ZIP/HTML/PNG/PDF all receive the same unclipped
    // vector content. This is not a raster fallback and it is not PDF-only.
    const els = Array.isArray(Scene?.elements) ? Scene.elements : [];
    return els.some(el => el && (el.type === ElementType.Sitelen || el.type === 'sitelen'))
      ? SCRAPBOOK_VECTOR_SVG_BOTTOM_BLEED_PX
      : 0;
  }

  async function buildSceneSvgText({ includeEditorGrid = false, forceStageBackground = false, useRasterPreviewForUnselected = false } = {}){
    await awaitAllRendererRastersReady();
    const defs = [];
    const body = [];
    const w = Math.max(1, Number(Scene.stage.w || DEFAULTS.stageW));
    const stageH = Math.max(1, Number(Scene.stage.h || DEFAULTS.stageH));
    const bottomBleedPx = sceneSvgBottomBleedPx();
    const h = stageH + bottomBleedPx;

    if (forceStageBackground || Scene.stage.exportStageBackground === true){
      body.push(svgRectNode({x:0, y:0, w, h, fill: svgColor(Scene.stage.bg || DEFAULTS.stageBg), stroke:"none"}));
    }

    if (Scene.stage.bgImgEnabled && Scene.stage.bgImgAssetId){
      const dataUrl = getImageAssetDataUrl(String(Scene.stage.bgImgAssetId));
      if (dataUrl){
        const img = ensureBackgroundImageLoadedForStage();
        const natW = img?.naturalWidth || 1;
        const natH = img?.naturalHeight || 1;
        const dest = computeBackgroundImageDestRect({
          stageW: w, stageH: stageH, natW, natH,
          stretch: !!Scene.stage.bgImgStretch,
          keepAspect: (Scene.stage.bgImgKeepAspect !== false)
        });
        defs.push(`<clipPath id="stageClip"><rect x="0" y="0" width="${svgNum(w)}" height="${svgNum(stageH)}" /></clipPath>`);
        body.push(`<g clip-path="url(#stageClip)"><image x="${svgNum(dest.x)}" y="${svgNum(dest.y)}" width="${svgNum(dest.w)}" height="${svgNum(dest.h)}" href="${svgEsc(dataUrl)}" preserveAspectRatio="none" /></g>`);
      }
    }

    if (includeEditorGrid && Scene.stage.showGrid){
      const gs = Math.max(2, Scene.stage.gridSize|0);
      const gridParts = [];
      for (let gx = 0; gx <= w + 0.5; gx += gs) gridParts.push(`<line x1="${svgNum(gx)}" y1="0" x2="${svgNum(gx)}" y2="${svgNum(h)}" />`);
      for (let gy = 0; gy <= h + 0.5; gy += gs) gridParts.push(`<line x1="0" y1="${svgNum(gy)}" x2="${svgNum(w)}" y2="${svgNum(gy)}" />`);
      body.push(`<g stroke="rgba(17,17,17,0.10)" stroke-width="1" fill="none">${gridParts.join("\n")}</g>`);
    }

    for (const el of Scene.elements){
      try { body.push(await svgElementForExport(el, { useRasterPreviewForUnselected })); }
      catch (err) {
        console.error("SVG vector element export failed", {
          id: el?.id || null,
          type: el?.type || null,
          text: typeof el?.text === "string" ? el.text : null,
          renderFontPreset: el ? getElementRenderFontPresetKey(el) : null,
          fontSize: el?.fontSize ?? null,
          error: err
        });
        if (el?.type === ElementType.Sitelen || el?.type === "sitelen") {
          throw err;
        }
        body.push(`<!-- vector export failed for ${svgEsc(el?.id || "element")}: ${svgEsc(err?.message || String(err))} -->`);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgNum(w)}" height="${svgNum(h)}" viewBox="0 0 ${svgNum(w)} ${svgNum(h)}">\n${defs.length ? `<defs>${defs.join("\n")}</defs>` : ""}\n${body.join("\n")}\n</svg>`;
  }

  async function exportSvgScene(){
    const svgText = await buildSceneSvgText({ includeEditorGrid: false });
    downloadBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), `layout_${nowIso()}.svg`);
    setStatus("Exported SVG (vector scene).");
  }

  function svgRootNumericAttr(svgText, attrName, fallback){
    const re = new RegExp(attrName + '="([0-9.+\-eE]+)"');
    const m = re.exec(String(svgText || ''));
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  async function svgTextToPngBlob(svgText){
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
      img.onload = () => {
        try {
          const off = document.createElement("canvas");
          off.width = Math.max(1, Math.ceil(svgRootNumericAttr(svgText, 'width', Scene.stage.w | 0)));
          off.height = Math.max(1, Math.ceil(svgRootNumericAttr(svgText, 'height', Scene.stage.h | 0)));
          const octx = off.getContext("2d");
          octx.clearRect(0, 0, off.width, off.height);
          octx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          off.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encode failed.")), "image/png");
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG rasterization failed.")); };
      img.src = url;
    });
  }

  async function exportPngFromSvgScene(){
    const svgText = await buildSceneSvgText({ includeEditorGrid: false });
    const blob = await svgTextToPngBlob(svgText);
    downloadBlob(blob, `layout_${nowIso()}.png`);
    setStatus("Exported PNG from SVG vector scene.");
  }

  async function exportHtmlScene(){
    const svgText = await buildSceneSvgText({ includeEditorGrid: false });
    const html = `<!doctype html>\n<meta charset="utf-8">\n<title>Layout vector export</title>\n<style>html,body{margin:0;background:#fff;}svg{display:block;max-width:100%;height:auto;}</style>\n${svgText}`;
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `layout_${nowIso()}.html`);
    setStatus("Exported HTML (embedded SVG vector scene).");
  }

  const SVG_PDF_PT_PER_PX = 72 / 96;
  // PDF pages need a small bottom bleed because SVG/live display allows
  // sitelen glyph ink and bounds-guard overhang to remain visible near the
  // bottom of the scrapbook stage. PDF pages otherwise hard-clip at the
  // page media box, which can cut off the lower parts of final sitelen lines.
  const SCRAPBOOK_VECTOR_PDF_BOTTOM_BLEED_PX = 96;

  function svgPdfBottomBleedPx(svgRoot, explicitValue = null){
    if (Number.isFinite(explicitValue)) return Math.max(0, Number(explicitValue) || 0);
    if (!svgRoot || !svgRoot.querySelector) return 0;
    // Only apply the automatic bleed to scrapbook content pages that actually
    // contain sitelen vector fragments. Cover SVGs and non-sitelen SVG output
    // keep their exact page size unless an explicit bleed is supplied.
    const hasSitelenVector = !!svgRoot.querySelector('[data-sitelen-vector]');
    return hasSitelenVector ? SCRAPBOOK_VECTOR_PDF_BOTTOM_BLEED_PX : 0;
  }

  function svgPdfFindStageBackgroundFill(rootSvg){
    if (!rootSvg || !rootSvg.children) return null;
    const width = svgPdfNumber(rootSvg.getAttribute('width'), 0);
    const height = svgPdfNumber(rootSvg.getAttribute('height'), 0);
    for (const child of Array.from(rootSvg.children || [])){
      if (String(child.localName || '').toLowerCase() !== 'rect') continue;
      const x = svgPdfNumber(child.getAttribute('x'), 0);
      const y = svgPdfNumber(child.getAttribute('y'), 0);
      const w = svgPdfNumber(child.getAttribute('width'), 0);
      const h = svgPdfNumber(child.getAttribute('height'), 0);
      if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) continue;
      if (Math.abs(w - width) > 0.5 || Math.abs(h - height) > 0.5) continue;
      const fill = svgPdfAttr(child, 'fill', null);
      if (fill && String(fill).toLowerCase() !== 'none') return fill;
    }
    return null;
  }

  function svgPdfCssMap(styleText){
    const out = {};
    String(styleText || "").split(";").forEach(part => {
      const idx = part.indexOf(":");
      if (idx <= 0) return;
      out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
    return out;
  }

  function svgPdfAttr(node, name, inheritedValue = undefined){
    if (!node || !node.getAttribute) return inheritedValue;
    const direct = node.getAttribute(name);
    if (direct != null && direct !== "") return direct;
    const style = svgPdfCssMap(node.getAttribute("style") || "");
    return style[name] ?? inheritedValue;
  }

  function svgPdfNumber(value, fallback = 0){
    const m = String(value ?? "").trim().match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function svgPdfNumberList(value){
    return String(value ?? "").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/ig)?.map(Number).filter(Number.isFinite) || [];
  }

  function svgPdfMatrixMultiply(a, b){
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5],
    ];
  }

  function svgPdfTranslate(tx, ty){ return [1, 0, 0, 1, Number(tx) || 0, Number(ty) || 0]; }
  function svgPdfScale(sx, sy = sx){ return [Number(sx) || 0, 0, 0, Number(sy) || 0, 0, 0]; }
  function svgPdfRotate(degValue){
    const a = (Number(degValue) || 0) * Math.PI / 180;
    const c = Math.cos(a), s = Math.sin(a);
    return [c, s, -s, c, 0, 0];
  }

  function svgPdfParseTransform(transformText){
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/ig;
    let hit;
    while ((hit = re.exec(String(transformText || ""))) !== null){
      const kind = hit[1].toLowerCase();
      const nums = svgPdfNumberList(hit[2]);
      let t = [1, 0, 0, 1, 0, 0];
      if (kind === "matrix" && nums.length >= 6) {
        t = nums.slice(0, 6);
      } else if (kind === "translate") {
        t = svgPdfTranslate(nums[0] || 0, nums.length > 1 ? nums[1] : 0);
      } else if (kind === "scale") {
        t = svgPdfScale(nums[0] ?? 1, nums.length > 1 ? nums[1] : (nums[0] ?? 1));
      } else if (kind === "rotate") {
        if (nums.length >= 3) {
          t = svgPdfMatrixMultiply(svgPdfMatrixMultiply(svgPdfTranslate(nums[1], nums[2]), svgPdfRotate(nums[0])), svgPdfTranslate(-nums[1], -nums[2]));
        } else {
          t = svgPdfRotate(nums[0] || 0);
        }
      }
      m = svgPdfMatrixMultiply(m, t);
    }
    return m;
  }

  function svgPdfMatrixPoint(m, x, y){
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
  }


  function svgPdfTransformedPointToPdfPath(m, x, y, stageH){
    const p = svgPdfMatrixPoint(m, x, y);
    // pdf-lib's page.drawSvgPath() treats the supplied path as SVG-style
    // coordinates and internally applies a Y-axis inversion. Therefore this
    // function must flatten into final SVG page coordinates scaled to points,
    // but must NOT pre-flip Y. The required page-height translation is supplied
    // in drawSvgDomNodeToPdf() via opts.y. Pre-flipping here double-flips the
    // path and moves it off the PDF page.
    return { x: p.x * SVG_PDF_PT_PER_PX, y: p.y * SVG_PDF_PT_PER_PX };
  }

  function svgPdfMatrixApproxScale(m){
    const sx = Math.hypot(Number(m?.[0] || 0), Number(m?.[1] || 0));
    const sy = Math.hypot(Number(m?.[2] || 0), Number(m?.[3] || 0));
    const vals = [sx, sy].filter(v => Number.isFinite(v) && v > 0);
    if (!vals.length) return 1;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function svgPdfTokenizePathData(d){
    const tokens = [];
    const re = /([AaCcHhLlMmQqSsTtVvZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
    let m;
    while ((m = re.exec(String(d || ""))) !== null) {
      if (m[1]) tokens.push({ type: "cmd", value: m[1] });
      else tokens.push({ type: "num", value: Number(m[2]) });
    }
    return tokens;
  }

  function svgPdfTransformPathDataToPdfPath(d, matrix, stageH){
    const tokens = svgPdfTokenizePathData(d);
    let i = 0;
    let cmd = "";
    let cx = 0, cy = 0;
    let sx = 0, sy = 0;
    const out = [];

    function hasNum(){ return i < tokens.length && tokens[i].type === "num"; }
    function readNum(){
      if (!hasNum()) return null;
      return tokens[i++].value;
    }
    function peekCmd(){ return i < tokens.length && tokens[i].type === "cmd" ? tokens[i].value : null; }
    function emitPoint(prefix, x, y){
      const p = svgPdfTransformedPointToPdfPath(matrix, x, y, stageH);
      out.push(`${prefix} ${svgNum(p.x)} ${svgNum(p.y)}`);
    }

    while (i < tokens.length) {
      const nextCmd = peekCmd();
      if (nextCmd) { cmd = tokens[i++].value; }
      if (!cmd) break;

      const lower = cmd.toLowerCase();
      const rel = cmd === lower;

      if (lower === "z") {
        out.push("Z");
        cx = sx; cy = sy;
        cmd = "";
        continue;
      }

      if (lower === "m") {
        let first = true;
        while (hasNum()) {
          const x0 = readNum(); const y0 = readNum();
          if (x0 == null || y0 == null) break;
          const x = rel ? cx + x0 : x0;
          const y = rel ? cy + y0 : y0;
          emitPoint(first ? "M" : "L", x, y);
          cx = x; cy = y;
          if (first) { sx = x; sy = y; first = false; }
          if (peekCmd()) break;
        }
        continue;
      }

      if (lower === "l") {
        while (hasNum()) {
          const x0 = readNum(); const y0 = readNum();
          if (x0 == null || y0 == null) break;
          const x = rel ? cx + x0 : x0;
          const y = rel ? cy + y0 : y0;
          emitPoint("L", x, y);
          cx = x; cy = y;
          if (peekCmd()) break;
        }
        continue;
      }

      if (lower === "h") {
        while (hasNum()) {
          const x0 = readNum(); if (x0 == null) break;
          const x = rel ? cx + x0 : x0;
          emitPoint("L", x, cy);
          cx = x;
          if (peekCmd()) break;
        }
        continue;
      }

      if (lower === "v") {
        while (hasNum()) {
          const y0 = readNum(); if (y0 == null) break;
          const y = rel ? cy + y0 : y0;
          emitPoint("L", cx, y);
          cy = y;
          if (peekCmd()) break;
        }
        continue;
      }

      if (lower === "c") {
        while (hasNum()) {
          const x1 = readNum(), y1 = readNum(), x2 = readNum(), y2 = readNum(), x = readNum(), y = readNum();
          if ([x1, y1, x2, y2, x, y].some(v => v == null)) break;
          const ax1 = rel ? cx + x1 : x1;
          const ay1 = rel ? cy + y1 : y1;
          const ax2 = rel ? cx + x2 : x2;
          const ay2 = rel ? cy + y2 : y2;
          const ax = rel ? cx + x : x;
          const ay = rel ? cy + y : y;
          const p1 = svgPdfTransformedPointToPdfPath(matrix, ax1, ay1, stageH);
          const p2 = svgPdfTransformedPointToPdfPath(matrix, ax2, ay2, stageH);
          const p = svgPdfTransformedPointToPdfPath(matrix, ax, ay, stageH);
          out.push(`C ${svgNum(p1.x)} ${svgNum(p1.y)} ${svgNum(p2.x)} ${svgNum(p2.y)} ${svgNum(p.x)} ${svgNum(p.y)}`);
          cx = ax; cy = ay;
          if (peekCmd()) break;
        }
        continue;
      }

      if (lower === "q") {
        while (hasNum()) {
          const x1 = readNum(), y1 = readNum(), x = readNum(), y = readNum();
          if ([x1, y1, x, y].some(v => v == null)) break;
          const ax1 = rel ? cx + x1 : x1;
          const ay1 = rel ? cy + y1 : y1;
          const ax = rel ? cx + x : x;
          const ay = rel ? cy + y : y;
          const p1 = svgPdfTransformedPointToPdfPath(matrix, ax1, ay1, stageH);
          const p = svgPdfTransformedPointToPdfPath(matrix, ax, ay, stageH);
          out.push(`Q ${svgNum(p1.x)} ${svgNum(p1.y)} ${svgNum(p.x)} ${svgNum(p.y)}`);
          cx = ax; cy = ay;
          if (peekCmd()) break;
        }
        continue;
      }

      // Unsupported commands are intentionally not guessed. They are uncommon in
      // the generated sitelen/vector scene; skipping is safer than producing a
      // wrongly transformed PDF path.
      console.warn("[layout-pdf-vector] unsupported SVG path command omitted", { cmd, d: String(d || "").slice(0, 160) });
      break;
    }

    return out.join(" ");
  }

  function svgPdfNodeMatrix(node, isRootSvg = false){
    let m = [1, 0, 0, 1, 0, 0];
    const tag = String(node?.localName || "").toLowerCase();
    if (tag === "svg" && !isRootSvg) {
      const x = svgPdfNumber(node.getAttribute("x"), 0);
      const y = svgPdfNumber(node.getAttribute("y"), 0);
      const w = svgPdfNumber(node.getAttribute("width"), 0);
      const h = svgPdfNumber(node.getAttribute("height"), 0);
      const vb = svgPdfNumberList(node.getAttribute("viewBox"));
      m = svgPdfMatrixMultiply(m, svgPdfTranslate(x, y));
      if (vb.length >= 4 && w > 0 && h > 0 && vb[2] > 0 && vb[3] > 0) {
        const par = String(node.getAttribute("preserveAspectRatio") || "xMidYMid meet").trim();
        if (/none/i.test(par)) {
          m = svgPdfMatrixMultiply(m, svgPdfScale(w / vb[2], h / vb[3]));
          m = svgPdfMatrixMultiply(m, svgPdfTranslate(-vb[0], -vb[1]));
        } else {
          const scale = Math.min(w / vb[2], h / vb[3]);
          let ox = 0, oy = 0;
          if (/xMid/i.test(par)) ox = (w - vb[2] * scale) / 2;
          else if (/xMax/i.test(par)) ox = (w - vb[2] * scale);
          if (/YMid/i.test(par)) oy = (h - vb[3] * scale) / 2;
          else if (/YMax/i.test(par)) oy = (h - vb[3] * scale);
          m = svgPdfMatrixMultiply(m, svgPdfTranslate(ox, oy));
          m = svgPdfMatrixMultiply(m, svgPdfScale(scale, scale));
          m = svgPdfMatrixMultiply(m, svgPdfTranslate(-vb[0], -vb[1]));
        }
      }
    }
    const tr = node?.getAttribute?.("transform");
    if (tr) m = svgPdfMatrixMultiply(m, svgPdfParseTransform(tr));
    return m;
  }

  function svgPdfColor(css, inheritedOpacity = 1){
    const PDFLib = window.PDFLib;
    if (!PDFLib) return null;
    let s = String(css ?? "").trim();
    if (!s || s === "none" || s === "transparent") return null;
    let opacity = inheritedOpacity;
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex){
      let h = hex[1];
      if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
      return {
        color: PDFLib.rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255),
        opacity
      };
    }
    const rgb = s.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb){
      const nums = rgb[1].split(",").map(x => Number(String(x).trim())).filter(Number.isFinite);
      if (nums.length >= 3){
        if (nums.length >= 4) opacity *= clamp(nums[3], 0, 1);
        return { color: PDFLib.rgb(clamp(nums[0], 0, 255) / 255, clamp(nums[1], 0, 255) / 255, clamp(nums[2], 0, 255) / 255), opacity };
      }
    }
    if (s.toLowerCase() === "black") return { color: PDFLib.rgb(0, 0, 0), opacity };
    if (s.toLowerCase() === "white") return { color: PDFLib.rgb(1, 1, 1), opacity };
    return null;
  }

  function svgPdfRectPath(node){
    const x = svgPdfNumber(node.getAttribute("x"), 0);
    const y = svgPdfNumber(node.getAttribute("y"), 0);
    const w = svgPdfNumber(node.getAttribute("width"), 0);
    const h = svgPdfNumber(node.getAttribute("height"), 0);
    if (!(w > 0 && h > 0)) return "";
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }

  function svgPdfLinePath(node){
    const x1 = svgPdfNumber(node.getAttribute("x1"), 0);
    const y1 = svgPdfNumber(node.getAttribute("y1"), 0);
    const x2 = svgPdfNumber(node.getAttribute("x2"), 0);
    const y2 = svgPdfNumber(node.getAttribute("y2"), 0);
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  async function svgPdfEmbedDataUrl(pdfDoc, href){
    const s = String(href || "");
    const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
    if (!m) return null;
    const mime = String(m[1] || "").toLowerCase();
    const isBase64 = !!m[2];
    const payload = m[3] || "";
    let bytes;
    if (isBase64) {
      const bin = atob(payload);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    if (mime.includes("png")) return await pdfDoc.embedPng(bytes);
    if (mime.includes("jpeg") || mime.includes("jpg")) return await pdfDoc.embedJpg(bytes);
    return null;
  }

  function svgPdfPageYFlipMatrix(stageH){
    return [SVG_PDF_PT_PER_PX, 0, 0, -SVG_PDF_PT_PER_PX, 0, Number(stageH || 0) * SVG_PDF_PT_PER_PX];
  }

  function svgPdfResolveUrlId(value){
    const s = String(value || "").trim();
    const m = s.match(/^url\(\s*['"]?#([^'")]+)['"]?\s*\)$/i);
    return m ? m[1] : "";
  }

  function svgPdfBuildClipPathMap(svgDoc){
    const out = new Map();
    for (const cp of Array.from(svgDoc.querySelectorAll("clipPath[id]"))) {
      const id = cp.getAttribute("id") || "";
      if (!id) continue;
      const rect = cp.querySelector("rect");
      if (rect) {
        out.set(id, {
          kind: "rect",
          x: svgPdfNumber(rect.getAttribute("x"), 0),
          y: svgPdfNumber(rect.getAttribute("y"), 0),
          w: Math.max(0, svgPdfNumber(rect.getAttribute("width"), 0)),
          h: Math.max(0, svgPdfNumber(rect.getAttribute("height"), 0))
        });
        continue;
      }
      const path = cp.querySelector("path[d]");
      if (path) out.set(id, { kind: "path", d: String(path.getAttribute("d") || "") });
    }
    return out;
  }

  function svgPdfPointToPdfOperatorCoords(p, stageH){
    return {
      x: Number(p.x || 0) * SVG_PDF_PT_PER_PX,
      y: (Number(stageH || 0) - Number(p.y || 0)) * SVG_PDF_PT_PER_PX
    };
  }

  function svgPdfPushClipForCurrentNode(node, page, matrix, clipPathMap, stageH){
    const P = window.PDFLib || {};
    const clipRef = svgPdfAttr(node, "clip-path", "");
    const clipId = svgPdfResolveUrlId(clipRef);
    if (!clipId) return false;
    const clipDef = clipPathMap?.get?.(clipId);
    if (!clipDef) {
      try { console.warn("[layout-pdf-vector] missing clipPath definition", { clipRef, clipId }); } catch {}
      return false;
    }

    if (!(page && typeof page.pushOperators === "function" &&
          P.pushGraphicsState && P.popGraphicsState && P.clip && P.endPath &&
          P.moveTo && P.lineTo && P.closePath)) {
      try { console.warn("[layout-pdf-vector] pdf-lib clipping operators unavailable; SVG clip-path omitted", { clipId }); } catch {}
      return false;
    }

    const ops = [P.pushGraphicsState()];

    if (clipDef.kind === "rect") {
      const x = clipDef.x;
      const y = clipDef.y;
      const w = clipDef.w;
      const h = clipDef.h;
      if (!(w > 0 && h > 0)) return false;
      const pts = [
        svgPdfPointToPdfOperatorCoords(svgPdfMatrixPoint(matrix, x, y), stageH),
        svgPdfPointToPdfOperatorCoords(svgPdfMatrixPoint(matrix, x + w, y), stageH),
        svgPdfPointToPdfOperatorCoords(svgPdfMatrixPoint(matrix, x + w, y + h), stageH),
        svgPdfPointToPdfOperatorCoords(svgPdfMatrixPoint(matrix, x, y + h), stageH)
      ];
      ops.push(P.moveTo(pts[0].x, pts[0].y));
      ops.push(P.lineTo(pts[1].x, pts[1].y));
      ops.push(P.lineTo(pts[2].x, pts[2].y));
      ops.push(P.lineTo(pts[3].x, pts[3].y));
      ops.push(P.closePath());
    } else if (clipDef.kind === "path" && clipDef.d) {
      // Rare fallback: clip paths generated by this editor are normally rects.
      // A path clip is preserved only when pdf-lib path operators are available
      // through drawSvgPath-style coordinates would require creating a clipping
      // path, not drawing a visible path, so we intentionally warn rather than
      // rasterize or silently guess.
      try { console.warn("[layout-pdf-vector] non-rect clipPath is not yet converted; SVG clip-path omitted", { clipId }); } catch {}
      return false;
    } else {
      return false;
    }

    ops.push(P.clip());
    ops.push(P.endPath());
    page.pushOperators(...ops);
    return true;
  }

  async function svgPdfDrawImageNode(node, pdfDoc, page, matrix, stageH){
    const href = node.getAttribute("href") || node.getAttribute("xlink:href") || node.getAttributeNS?.("http://www.w3.org/1999/xlink", "href") || "";
    const img = await svgPdfEmbedDataUrl(pdfDoc, href);
    if (!img) return;
    const x = svgPdfNumber(node.getAttribute("x"), 0);
    const y = svgPdfNumber(node.getAttribute("y"), 0);
    const w = Math.max(1e-6, svgPdfNumber(node.getAttribute("width"), img.width || 1));
    const h = Math.max(1e-6, svgPdfNumber(node.getAttribute("height"), img.height || 1));

    // Images are already raster sources, but their placement must still follow
    // the same SVG transform stack as vector paths.  The previous PDF image
    // path transformed the four corners, then drew the bitmap into the axis-
    // aligned bounding box. That throws away rotation, which is why rotated
    // image elements appeared unrotated/skewed in the vector PDF.
    //
    // Compose the full PDF CTM instead:
    //   SVG image unit square (PDF image coords, y-up)
    //   -> SVG image rect (x, y, width, height, y-down)
    //   -> inherited SVG matrix, including group rotation
    //   -> PDF page coordinates, including the single SVG-to-PDF Y flip.
    const imageRectMatrix = svgPdfMatrixMultiply(svgPdfTranslate(x, y + h), svgPdfScale(w, -h));
    const svgToPdfMatrix = svgPdfMatrixMultiply(svgPdfPageYFlipMatrix(stageH), svgPdfMatrixMultiply(matrix, imageRectMatrix));
    const P = window.PDFLib || {};

    if (page && typeof page.pushOperators === "function" && P.pushGraphicsState && P.popGraphicsState && P.concatTransformationMatrix) {
      page.pushOperators(
        P.pushGraphicsState(),
        P.concatTransformationMatrix(
          svgToPdfMatrix[0], svgToPdfMatrix[1], svgToPdfMatrix[2],
          svgToPdfMatrix[3], svgToPdfMatrix[4], svgToPdfMatrix[5]
        )
      );
      page.drawImage(img, { x: 0, y: 0, width: 1, height: 1 });
      page.pushOperators(P.popGraphicsState());
      return;
    }

    // Fallback for older pdf-lib builds: preserve size/position but not rotation.
    // This should not normally run because svgSceneTextToPdfBlob() already checks
    // for operator support.
    const pts = [svgPdfMatrixPoint(matrix, x, y), svgPdfMatrixPoint(matrix, x + w, y), svgPdfMatrixPoint(matrix, x + w, y + h), svgPdfMatrixPoint(matrix, x, y + h)];
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    page.drawImage(img, {
      x: minX * SVG_PDF_PT_PER_PX,
      y: (stageH - maxY) * SVG_PDF_PT_PER_PX,
      width: Math.max(1, maxX - minX) * SVG_PDF_PT_PER_PX,
      height: Math.max(1, maxY - minY) * SVG_PDF_PT_PER_PX,
    });
  }

  function svgPdfCanUseOperators(){
    const P = window.PDFLib || {};
    return !!(
      P.pushGraphicsState && P.popGraphicsState && P.concatTransformationMatrix &&
      P.clip && P.endPath && P.moveTo && P.lineTo && P.closePath
    );
  }

  async function drawSvgDomNodeToPdf(node, pdfDoc, page, matrix, inherited, stageH, clipPathMap, isRootSvg = false){
    if (!node || node.nodeType !== 1) return;
    const tag = String(node.localName || "").toLowerCase();
    if (tag === "defs" || tag === "clippath" || tag === "title" || tag === "desc") return;

    const ownMatrix = svgPdfNodeMatrix(node, isRootSvg);
    const nextMatrix = svgPdfMatrixMultiply(matrix, ownMatrix);
    const opacityAttr = svgPdfAttr(node, "opacity", null);
    const nextOpacity = inherited.opacity * (opacityAttr == null ? 1 : clamp(Number(opacityAttr), 0, 1));
    const nextStyle = {
      fill: svgPdfAttr(node, "fill", inherited.fill),
      stroke: svgPdfAttr(node, "stroke", inherited.stroke),
      strokeWidth: svgPdfAttr(node, "stroke-width", inherited.strokeWidth),
      opacity: nextOpacity,
    };

    // Preserve SVG clip-path semantics for vector PDF output.  This is required
    // for literal-cartouche left-overhang repair: the SVG exporter emits clipped
    // paths, and the PDF exporter must honor the same clip instead of drawing
    // the untrimmed overhanging rule/path.
    const didPushClip = svgPdfPushClipForCurrentNode(node, page, nextMatrix, clipPathMap, stageH);
    try {

    if (tag === "path" || tag === "rect" || tag === "line"){
      const d = tag === "path" ? String(node.getAttribute("d") || "") : (tag === "rect" ? svgPdfRectPath(node) : svgPdfLinePath(node));
      if (d.trim()){
        const transformedD = svgPdfTransformPathDataToPdfPath(d, nextMatrix, stageH);
        const fill = svgPdfColor(nextStyle.fill, nextStyle.opacity);
        const stroke = svgPdfColor(nextStyle.stroke, nextStyle.opacity);
        const scaleForStroke = svgPdfMatrixApproxScale(nextMatrix);
        const borderWidth = Math.max(0, svgPdfNumber(nextStyle.strokeWidth, 1) * scaleForStroke * SVG_PDF_PT_PER_PX);
        const opts = { x: 0, y: stageH * SVG_PDF_PT_PER_PX };
        if (fill) { opts.color = fill.color; opts.opacity = fill.opacity; }
        if (stroke && borderWidth > 0) { opts.borderColor = stroke.color; opts.borderOpacity = stroke.opacity; opts.borderWidth = borderWidth; }
        if (transformedD.trim() && (fill || (stroke && borderWidth > 0))){
          page.drawSvgPath(transformedD, opts);
        }
      }
      return;
    }

    if (tag === "image"){
      await svgPdfDrawImageNode(node, pdfDoc, page, nextMatrix, stageH);
      return;
    }

    if (tag === "text"){
      // Text elements are retained as selectable PDF text. Sitelen/glyph output is already <path>.
      // Honor the basic SVG anchoring used by the cover page and media cards so
      // PDF placement matches the SVG/HTML export instead of drifting left.
      const P = window.PDFLib;
      const txt = String(node.textContent || "");
      if (txt.trim()){
        const fontPx = svgPdfNumber(node.getAttribute("font-size"), 12);
        const p = svgPdfMatrixPoint(nextMatrix, svgPdfNumber(node.getAttribute("x"), 0), svgPdfNumber(node.getAttribute("y"), 0));
        const size = fontPx * SVG_PDF_PT_PER_PX;
        const fill = svgPdfColor(nextStyle.fill, nextStyle.opacity) || { color: P.rgb(0, 0, 0), opacity: nextStyle.opacity };
        const weight = String(node.getAttribute("font-weight") || "").trim().toLowerCase();
        const font = await pdfDoc.embedFont((weight === "bold" || Number(weight) >= 600) ? P.StandardFonts.HelveticaBold : P.StandardFonts.Helvetica);
        let pdfX = p.x * SVG_PDF_PT_PER_PX;
        const textW = font.widthOfTextAtSize(txt, size);
        const anchor = String(node.getAttribute("text-anchor") || "start").trim().toLowerCase();
        if (anchor === "middle") pdfX -= textW / 2;
        else if (anchor === "end") pdfX -= textW;
        const baseline = String(node.getAttribute("dominant-baseline") || "").trim().toLowerCase();
        const yAdjustPx = (baseline === "hanging" || baseline === "text-before-edge") ? fontPx : (fontPx * 0.8);
        const pdfY = (stageH - p.y - yAdjustPx) * SVG_PDF_PT_PER_PX;
        page.drawText(txt, { x: pdfX, y: pdfY, size, font, color: fill.color, opacity: fill.opacity });
      }
      return;
    }

    for (const child of Array.from(node.childNodes || [])){
      await drawSvgDomNodeToPdf(child, pdfDoc, page, nextMatrix, nextStyle, stageH, clipPathMap, false);
    }

    } finally {
      if (didPushClip) {
        try { page.pushOperators(window.PDFLib.popGraphicsState()); } catch (_) {}
      }
    }
  }

  async function svgSceneTextToPdfBlob(svgText){
    if (!window.PDFLib) throw new Error("pdf-lib is not loaded. Check ./vendor/pdf-lib.min.js is available.");
    if (typeof window.PDFLib.PDFDocument?.create !== "function") throw new Error("pdf-lib PDFDocument is unavailable.");
    if (typeof window.PDFLib.PDFPage?.prototype?.drawSvgPath !== "function" && typeof window.PDFLib.PDFDocument !== "undefined") {
      // Older pdf-lib builds do not expose PDFPage on the global; drawSvgPath is checked at runtime below.
    }
    if (!svgPdfCanUseOperators()) throw new Error("pdf-lib operator helpers are unavailable; cannot preserve SVG transforms in PDF.");
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) throw new Error("Composed SVG could not be parsed for PDF export.");
    const rootSvg = doc.documentElement;
    const stageW = Math.max(1, svgPdfNumber(rootSvg.getAttribute("width"), Scene.stage.w || 1));
    const stageH = Math.max(1, svgPdfNumber(rootSvg.getAttribute("height"), Scene.stage.h || 1));
    const bottomBleedPx = svgPdfBottomBleedPx(rootSvg, null);
    const pdfStageH = stageH + bottomBleedPx;
    const pdfDoc = await window.PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([stageW * SVG_PDF_PT_PER_PX, pdfStageH * SVG_PDF_PT_PER_PX]);
    if (bottomBleedPx > 0){
      const bgFill = svgPdfFindStageBackgroundFill(rootSvg);
      const bg = bgFill ? svgPdfColor(bgFill, 1) : null;
      if (bg?.color){
        page.drawRectangle({ x: 0, y: 0, width: stageW * SVG_PDF_PT_PER_PX, height: bottomBleedPx * SVG_PDF_PT_PER_PX, color: bg.color, opacity: bg.opacity ?? 1, borderWidth: 0 });
      }
    }
    const clipPathMap = svgPdfBuildClipPathMap(doc);
    await drawSvgDomNodeToPdf(rootSvg, pdfDoc, page, [1, 0, 0, 1, 0, 0], { fill: "black", stroke: "none", strokeWidth: 1, opacity: 1 }, pdfStageH, clipPathMap, true);
    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  async function blobToArrayBuffer(blob){
    if (!blob) throw new Error("Missing blob.");
    if (typeof blob.arrayBuffer === "function") return await blob.arrayBuffer();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob."));
      reader.readAsArrayBuffer(blob);
    });
  }

  async function svgSceneTextToPdfBlobMatched(svgText){
    if (!window.PDFLib) throw new Error("pdf-lib is not loaded. Check ./vendor/pdf-lib.min.js is available.");
    const PDFLib = window.PDFLib;
    if (typeof PDFLib.PDFDocument?.create !== "function") throw new Error("pdf-lib PDFDocument is unavailable.");

    const stageW = Math.max(1, Number(Scene.stage.w) || 1);
    const stageH = Math.max(1, Number(Scene.stage.h) || 1);

    // RASTER FALLBACK ONLY. Do not use this for the normal Export PDF button.
    // This rasterizes the composed SVG scene to PNG and embeds that full-page
    // bitmap into the PDF. It is useful only as an emergency visual-matching
    // fallback; it is not a true vector PDF export.
    const pngBlob = await svgTextToPngBlob(svgText);
    const pngBytes = await blobToArrayBuffer(pngBlob);

    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([stageW * SVG_PDF_PT_PER_PX, stageH * SVG_PDF_PT_PER_PX]);
    const png = await pdfDoc.embedPng(pngBytes);
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: stageW * SVG_PDF_PT_PER_PX,
      height: stageH * SVG_PDF_PT_PER_PX,
    });
    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  async function exportPdfFromSvgScene(){
    const svgText = await buildSceneSvgText({ includeEditorGrid: false, forceStageBackground: !!Scene.stage.exportStageBackground });
    // IMPORTANT: normal PDF export must remain a true vector export.
    // Do not route this through svgSceneTextToPdfBlobMatched(), because that
    // function rasterizes the composed SVG to PNG and embeds a page bitmap.
    // The intended pipeline is: composed SVG vector scene -> PDF vector paths.
    const blob = await svgSceneTextToPdfBlob(svgText);
    downloadBlob(blob, `layout_${nowIso()}.pdf`);
    setStatus("Exported vector PDF from SVG paths.");
  }


  async function exportPngTransparent(){
    await awaitAllRendererRastersReady();
    if (APP_VECTOR_DEBUG) console.log("Export PNG image");
    // Create offscreen canvas at exact stage size (no background fill => transparent)
    const off = document.createElement("canvas");
    off.width = Scene.stage.w;
    off.height = Scene.stage.h;
    const octx = off.getContext("2d");

    //do we draw the Scene background on export
    if(Scene.stage.exportStageBackground === true){
      octx.save();
      // NEW: stage background from scene
      octx.fillStyle = Scene.stage.bg || DEFAULTS.stageBg;
      octx.fillRect(0, 0, Scene.stage.w, Scene.stage.h);
      octx.restore();
    }


    // NEW: background image export (independent of exportStageBackground)
    if (Scene.stage.bgImgEnabled && Scene.stage.bgImgAssetId){
      const assetId = String(Scene.stage.bgImgAssetId);
      const dataUrl = getImageAssetDataUrl(assetId);
      if (dataUrl){
        // Prefer decoded cache if available
        let img = (bgImageCache.ready && bgImageCache.assetId === assetId) ? bgImageCache.img : null;
        if (!img){
          img = new Image();
          img.src = dataUrl;
        }

        if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
          const dest = computeBackgroundImageDestRect({
            stageW: Scene.stage.w,
            stageH: Scene.stage.h,
            natW: img.naturalWidth,
            natH: img.naturalHeight,
            stretch: !!Scene.stage.bgImgStretch,
            keepAspect: (Scene.stage.bgImgKeepAspect !== false),
          });

          octx.save();
          octx.beginPath();
          octx.rect(0, 0, Scene.stage.w, Scene.stage.h);
          octx.clip();
          octx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
          octx.restore();
        }
      }
    }


    // Render scene at 1:1 stage coords (no view transforms)
    // Note: We do NOT draw grid or stage background for export.
    for (const el of Scene.elements){
      drawElementToOffscreen(octx, el);
    }

    off.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `layout_${nowIso()}.png`);
      setStatus(tr("status_exported_png"));
    }, "image/png");
  }

  function roundedRectPathOff(octx, x,y,w,h,r){
    const rr = Math.max(0, Math.min(r, w/2, h/2));
    octx.beginPath();
    octx.moveTo(x+rr, y);
    octx.arcTo(x+w, y, x+w, y+h, rr);
    octx.arcTo(x+w, y+h, x, y+h, rr);
    octx.arcTo(x, y+h, x, y, rr);
    octx.arcTo(x, y, x+w, y, rr);
    octx.closePath();
  }

  /* ============================================================
     Controls and buttons
     ============================================================ */
  $("toolSelect").addEventListener("click", () => setTool(Tool.Select));
  $("toolText").addEventListener("click", () => setTool(Tool.Text));
  $("toolSitelen").addEventListener("click", () => setTool(Tool.Sitelen));
  $("toolGlyph").addEventListener("click", () => setTool(Tool.Glyph));
  $("toolRect").addEventListener("click", () => setTool(Tool.Rect));
  $("toolImage").addEventListener("click", () => setTool(Tool.Image));

  $("toolDelete").addEventListener("click", () => {
  if (anySelected()){
    deleteSelection();     // this is where confirm happens
    setTool(Tool.Select);  // return to normal tool
  } else {
    setTool(Tool.Delete);  // no selection: use click-to-delete mode
  }
});


  $("toolPan").addEventListener("click", () => setTool(Tool.Pan));

  $("btnGroup").addEventListener("click", () => groupSelection());
  $("btnUngroup").addEventListener("click", () => ungroupSelection());

  $("btnBringFwd").addEventListener("click", () => bringForwardZ());
  $("btnSendBack").addEventListener("click", () => sendBackwardZ());


  // v25: page-level New / Export JSON / Import JSON / Export PNG handlers are
  // registered once earlier in the editor bootstrap. Do not register them here
  // inside the scrapbook shell as well; duplicate file-input click handlers make
  // the browser import picker open twice and duplicate export work.

  async function exportDocumentPdf(){
    if (!ScrapbookState) return;
    const doc = ScrapbookState.doc;
    const pages = doc.pages || [];
    await syncEditorIntoCurrentPage(false);
    commitLiveEditorIntoCurrentScrapbookPageNow({ updateThumb: false });
    await awaitPostersForExport(pages);

    let PDFLib;
    try { PDFLib = await ensurePdfLib(); }
    catch (err){ alert('Could not load pdf-lib for PDF export: ' + (err.message || String(err))); return; }

    const exportDate = new Date().toISOString().slice(0, 10);
    const safeName = slug(doc.meta?.title || 'document');
    const totalPages = pages.length;

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(doc.meta?.title || 'Scrapbook');
    pdfDoc.setAuthor('nanpa-linja-n scrapbook layout editor vector');
    pdfDoc.setProducer('pdf-lib direct SVG vector path export');
    pdfDoc.setCreationDate(new Date());

    // Cover page is retained for compatibility with existing scrapbook exports.
    // It must not use a canvas/PNG raster path: the PDF cover is emitted as
    // SVG-derived vector PDF content, the same route used by content pages.
    if (documentIncludesCoverPage(doc) && pages[0]){
      const firstPayload = getPagePayload(pages[0]);
      const stageW = Math.max(1, firstPayload?.scene?.stage?.w || 1280);
      const stageH = Math.max(1, firstPayload?.scene?.stage?.h || 800);
      setStatus('Exporting vector PDF… cover page');
      try {
        const coverSvgText = await buildPdfCoverSvgText(doc, stageW, stageH, exportDate);
        await appendSvgSceneTextToPdfDocument(pdfDoc, coverSvgText, { bottomBleedPx: 0 });
      } catch (err) {
        console.warn('PDF cover SVG vector render failed; adding primitive vector fallback cover page:', err);
        await appendPdfCoverPageFallback(pdfDoc, PDFLib, doc, stageW, stageH, exportDate);
      }
    }

    for (let i = 0; i < pages.length; i++){
      setStatus(`Exporting vector PDF… page ${i + 1} / ${totalPages}`);
      const pageRec = pages[i];
      const svgText = await buildScrapbookPageSvgText(pageRec, { forceStageBackground: !!getPagePayload(pageRec, { preferLiveCurrent: true })?.scene?.stage?.exportStageBackground });
      await appendSvgSceneTextToPdfDocument(pdfDoc, svgText);
    }

    setStatus('Exporting PDF… saving…');
    const bytes = await pdfDoc.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeName}_${exportDate}.pdf`);
    setStatus('PDF exported (direct SVG vector paths).');
  }

  async function exportAllPagesPngZip(){
    if (!ScrapbookState) return;
    const doc = ScrapbookState.doc;
    const pages = doc.pages || [];
    await syncEditorIntoCurrentPage(false);

    // Wait for all poster images across all pages before rendering
    await awaitPostersForExport(pages);

    // Determine stage size from the first page
    const firstPayload = getPagePayload(pages[0]);
    const stageW = Math.max(1, firstPayload?.scene?.stage?.w || 1280);
    const stageH = Math.max(1, firstPayload?.scene?.stage?.h || 800);
    const exportDate = new Date().toISOString().slice(0, 10);
    const total = pages.length;

    const files = [];

    // Cover page as 000-cover.png
    if (documentIncludesCoverPage(doc)) {
      setStatus('Exporting ZIP… building cover page');
      try {
        await waitForRenderPresetFonts('nasinNanpa', 64, null, []);
        const cover = await buildPdfCoverCanvas(doc, stageW, stageH, exportDate);
        const coverBlob = await new Promise((res, rej) =>
          cover.canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
        );
        files.push({ name: `000-cover.png`, data: await blobToUint8Array(coverBlob) });
      } catch (err) {
        console.warn('ZIP cover page failed:', err);
      }
    }

    // Content pages as 001-name.png, 002-name.png, …
    for (let i = 0; i < pages.length; i++) {
      setStatus(`Exporting ZIP… page ${i + 1} / ${total}`);
      const page = pages[i];
      const svgText = await buildScrapbookPageSvgText(page, { forceStageBackground: !!getPagePayload(page, { preferLiveCurrent: true })?.scene?.stage?.exportStageBackground });
      const size = parseSvgStageSize(svgText, stageW, stageH);
      const blob = await svgTextToPngBlobForSize(svgText, size.w, size.h);
      files.push({ name: `${String(i+1).padStart(3,'0')}-${slug(page.name || 'page')}.png`, data: await blobToUint8Array(blob) });
    }

    downloadBlob(await buildStoredZip(files), `${slug(doc.meta?.title || 'document')}-pages.zip`);
    setStatus('ZIP exported.');
  }
  async function exportPrintHtmlScrapbook(){
    if (!ScrapbookState) return;
    const doc = ScrapbookState.doc;
    const pages = doc.pages || [];
    await syncEditorIntoCurrentPage(false);

    // Wait for all poster images across all pages before rendering
    await awaitPostersForExport(pages);

    // Determine stage size from the first page
    const firstPayload = getPagePayload(pages[0]);
    const stageW = Math.max(1, firstPayload?.scene?.stage?.w || 1280);
    const stageH = Math.max(1, firstPayload?.scene?.stage?.h || 800);
    const exportDate = new Date().toISOString().slice(0, 10);

    const pagesForHtml = [];
    if (documentIncludesCoverPage(doc)) {
      setStatus('Exporting HTML… building cover page');
      // Build cover page using the same canvas as PDF export
      let coverDataUrl = '';
      try {
        await waitForRenderPresetFonts('nasinNanpa', 64, null, []);
        const cover = await buildPdfCoverCanvas(doc, stageW, stageH, exportDate);
        coverDataUrl = cover.canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('Cover page render failed:', err);
      }
      // Cover page first
      if (coverDataUrl){
        pagesForHtml.push({ name: 'Cover', dataUrl: coverDataUrl, w: stageW, h: stageH, hotspots: [] });
      }
    }
    // Content pages
    const total = pages.length;
    for (let i = 0; i < pages.length; i++){
      setStatus(`Exporting HTML… page ${i + 1} / ${total}`);
      const page = pages[i];
      const payload = getPagePayload(page);
      const svgText = await buildScrapbookPageSvgText(page, { forceStageBackground: !!payload?.scene?.stage?.exportStageBackground });
      const hotspotInfo = collectPrintableHtmlHotspotsFromPayload(payload);
      pagesForHtml.push({
        name: page.name || 'Page',
        svgText,
        w: hotspotInfo.stageW,
        h: hotspotInfo.stageH,
        hotspots: hotspotInfo.hotspots,
      });
    }

    const docTitle = escapeHtml(doc.meta?.title || 'Print export');
    const pageHtml = pagesForHtml.map((p) => {
      const hotspotsHtml = (p.hotspots || []).map((h) => hotspotToHtml(h, p.w || 1, p.h || 1, p.name || 'Page')).join('');
      const visual = p.svgText ? `<div class="svgPage">${p.svgText.replace(/^<\?xml[^>]*>\s*/i, '')}</div>` : `<img alt="${escapeHtml(p.name)}" src="${p.dataUrl}">`;
      return `<section class="page"><div class="pageFrame" style="--page-aspect:${(p.w || 1)} / ${(p.h || 1)};">${visual}<div class="hotspotLayer" aria-hidden="true">${hotspotsHtml}</div></div></section>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{margin:0;font-family:system-ui;background:#ddd}.page{page-break-after:always;break-after:page;display:grid;place-items:center;min-height:100vh;padding:20px;background:#ddd}.pageFrame{position:relative;display:inline-block;width:min(calc(100vw - 40px),calc(95vh * var(--page-aspect)));max-width:100%;aspect-ratio:var(--page-aspect);line-height:0}.pageFrame img,.pageFrame svg{display:block;width:100%;height:100%;box-shadow:0 8px 28px rgba(0,0,0,.18);background:white}.svgPage{width:100%;height:100%;line-height:0}.hotspotLayer{position:absolute;inset:0;pointer-events:none}.hotspotLink{position:absolute;display:block;background:transparent;border:none;outline:none;text-decoration:none;cursor:pointer;pointer-events:auto}.hotspotLink:hover,.hotspotLink:focus-visible{background:transparent;border:none;outline:none}@media print{body{background:white}.page{padding:0;min-height:auto;background:white}.pageFrame{width:100%;max-width:100%;break-inside:avoid;page-break-inside:avoid}.pageFrame img{box-shadow:none;max-width:100vw;max-height:100vh}.hotspotLayer{display:none}}</style></head><body>${pageHtml}</body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html' }), `${slug(doc.meta?.title || 'document')}-print.html`);
    setStatus('HTML exported.');
  }
  let scrapbookPresentationIndex = 0;
  function updatePresentationHud(){
    const total = ScrapbookState?.doc?.pages?.length || 0;
    const idx = Math.max(0, Math.min(scrapbookPresentationIndex, Math.max(0, total - 1)));
    const page = ScrapbookState?.doc?.pages?.[idx] || null;
    const pos = $('sbPresentationPos');
    const title = $('sbPresentationTitle');
    const prev = $('sbPresentationPrev');
    const next = $('sbPresentationNext');
    const first = $('sbPresentationFirst');
    const last = $('sbPresentationLast');
    if (pos) pos.textContent = total ? `${idx + 1} / ${total}` : '0 / 0';
    if (title) title.textContent = page?.name || (total ? `Page ${idx + 1}` : '');
    if (prev) prev.disabled = idx <= 0;
    if (first) first.disabled = idx <= 0;
    if (next) next.disabled = total <= 0 || idx >= total - 1;
    if (last) last.disabled = total <= 0 || idx >= total - 1;
  }
  let _presentationBlobUrl = null;
  let _presentationRenderToken = 0;

  async function renderPresentationPage(index){
    const page = ScrapbookState?.doc?.pages?.[index];
    if (!page) return;

    const token = ++_presentationRenderToken;
    const host = $('sbPresentationStageWrap');

    // Revoke previous blob URL and clear DOM before doing any async work
    if (_presentationBlobUrl){
      URL.revokeObjectURL(_presentationBlobUrl);
      _presentationBlobUrl = null;
    }
    host.innerHTML = '';

    // Determine stage dimensions
    const payload = getPagePayload(page);
    const stageW = Math.max(1, payload?.scene?.stage?.w || 1280);
    const stageH = Math.max(1, payload?.scene?.stage?.h || 800);

    // Cap to screen to keep canvas small
    const maxW = Math.min(window.innerWidth, 1280);
    const maxH = Math.min(window.innerHeight, 900);
    const scale = Math.min(maxW / stageW, maxH / stageH, 1);
    const outW = Math.max(1, Math.round(stageW * scale));
    const outH = Math.max(1, Math.round(stageH * scale));

    // Render offscreen
    let blobUrl = null;
    try {
      const isCurrentPage = page.id === ScrapbookState?.currentPageId;
      let dataUrl;
      if (isCurrentPage){
        await syncEditorIntoCurrentPage(false);
        dataUrl = await renderCurrentPageDataUrl(outW, outH);
      } else {
        dataUrl = await renderPagePayloadToDataUrl(payload, outW, outH);
      }

      if (token !== _presentationRenderToken) return;

      // Convert to blob URL so the base64 string can be freed immediately
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (token !== _presentationRenderToken) return;
      blobUrl = URL.createObjectURL(blob);
      _presentationBlobUrl = blobUrl;
    } catch(err) {
      console.warn('Presentation render failed:', err);
      if (token !== _presentationRenderToken) return;
    }

    if (!blobUrl) return;

    const img = document.createElement('img');
    img.alt = page.name || `Page ${index + 1}`;
    img.src = blobUrl;
    img.style.maxWidth = '96vw';
    img.style.maxHeight = '92vh';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.boxShadow = '0 20px 50px rgba(0,0,0,.35)';
    img.style.background = 'white';
    host.append(img);
    updatePresentationHud();
  }
  async function openPresentation(startIndex = 0){
    if (!ScrapbookState?.doc?.pages?.length) return;
    flushActiveScrapbookUiEdits();
    scrapbookPresentationIndex = Math.max(0, Math.min(startIndex, ScrapbookState.doc.pages.length - 1));
    $('sbPresentationOverlay').style.display = 'flex';
    await renderPresentationPage(scrapbookPresentationIndex);
  }
  function getCurrentPageIndex(){
    const pages = ScrapbookState?.doc?.pages || [];
    const idx = pages.findIndex(p => p.id === ScrapbookState?.currentPageId);
    return idx >= 0 ? idx : 0;
  }

  function closePresentation(){
    const overlay = $('sbPresentationOverlay');
    const stageWrap = $('sbPresentationStageWrap');
    if (overlay) overlay.style.display = 'none';
    if (stageWrap) stageWrap.innerHTML = '';
    // Cancel any in-progress render and free blob URL memory
    _presentationRenderToken++;
    if (_presentationBlobUrl){
      URL.revokeObjectURL(_presentationBlobUrl);
      _presentationBlobUrl = null;
    }
    scrapbookPresentationIndex = getCurrentPageIndex();
  }
  async function stepPresentation(delta){
    if (!ScrapbookState?.doc?.pages?.length) return;
    scrapbookPresentationIndex = Math.max(0, Math.min(scrapbookPresentationIndex + delta, ScrapbookState.doc.pages.length - 1));
    await renderPresentationPage(scrapbookPresentationIndex);
  }
  async function jumpPresentation(index){
    if (!ScrapbookState?.doc?.pages?.length) return;
    scrapbookPresentationIndex = Math.max(0, Math.min(index, ScrapbookState.doc.pages.length - 1));
    await renderPresentationPage(scrapbookPresentationIndex);
  }

  function getPageListScrollContainer(){
    const list = $('sbPageList');
    if (!list) return null;
    return list.closest('.stageMiniBody') || list.parentElement || list;
  }

  function capturePageListAnchor(){
    const list = $('sbPageList');
    const scroller = getPageListScrollContainer();
    if (!list || !scroller || !ScrapbookState?.currentPageId) return null;
    const card = list.querySelector(`.pageCard[data-page-id="${ScrapbookState.currentPageId}"]`);
    if (!card) return { pageId: ScrapbookState.currentPageId, scrollTop: scroller.scrollTop, mode: 'scrollTop' };
    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      pageId: ScrapbookState.currentPageId,
      relativeTop: cardRect.top - scrollerRect.top,
      scrollTop: scroller.scrollTop,
      mode: 'anchor'
    };
  }

  function restorePageListAnchor(anchor){
    const list = $('sbPageList');
    const scroller = getPageListScrollContainer();
    if (!list || !scroller || !anchor) return;
    requestAnimationFrame(() => {
      const card = anchor.pageId ? list.querySelector(`.pageCard[data-page-id="${anchor.pageId}"]`) : null;
      if (card && anchor.mode === 'anchor') {
        const scrollerRect = scroller.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const delta = (cardRect.top - scrollerRect.top) - anchor.relativeTop;
        scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
        return;
      }
      if (Number.isFinite(anchor.scrollTop)) scroller.scrollTop = anchor.scrollTop;
    });
  }

  function ensureCurrentPageCardVisible(){
    const list = $('sbPageList');
    const scroller = getPageListScrollContainer();
    if (!list || !scroller || !ScrapbookState?.currentPageId) return;
    const card = list.querySelector(`.pageCard[data-page-id="${ScrapbookState.currentPageId}"]`);
    if (!card) return;
    requestAnimationFrame(() => {
      const scrollerRect = scroller.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const above = cardRect.top < scrollerRect.top;
      const below = cardRect.bottom > scrollerRect.bottom;
      if (above || below) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }




  function ensureScrapbookPagesPanelStyles(){
    if (document.getElementById('sbPagesPanelStyles')) return;
    const style = document.createElement('style');
    style.id = 'sbPagesPanelStyles';
    style.textContent = `
      #scrapbookDocSidebar .pagesPanel{min-height:0 !important;display:flex !important;flex-direction:column !important;overflow:hidden !important;}
      #scrapbookDocSidebar .pagesPanel > .panelHeader{flex:0 0 auto !important;}
      #scrapbookDocSidebar .pagesPanel .sbPagesActionBar{flex:0 0 auto !important;display:flex;flex-wrap:wrap;gap:5px;padding:7px 10px 6px;border-bottom:1px solid var(--panel-border,rgba(17,17,17,.14));background:var(--panel-bg,#fff7ec);position:sticky;top:0;z-index:2;}
      #scrapbookDocSidebar .pagesPanel .sbPagesActionBar .btn{font-size:12px !important;line-height:1 !important;padding:5px 8px !important;border-radius:8px !important;min-height:26px !important;min-width:0 !important;white-space:nowrap !important;}
      #scrapbookDocSidebar .pagesPanel .sbPagesListBody{flex:1 1 auto !important;min-height:0 !important;overflow:auto !important;padding:10px 12px !important;display:block !important;}
      #scrapbookDocSidebar .pagesPanel #sbPageList{display:flex;flex-direction:column;gap:10px;min-height:0;}
    `;
    document.head.appendChild(style);
  }

  const DocumentPropertiesState = {
    root: null,
    header: null,
    body: null,
    isOpen: false,
    dragging: false,
    dragPointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  function ensureDocumentPropertiesStyles(){
    if (document.getElementById('sbDocumentPropertiesStyles')) return;
    const style = document.createElement('style');
    style.id = 'sbDocumentPropertiesStyles';
    style.textContent = `
      #scrapbookDocSidebar .docNotesPanel{flex:0 0 auto !important;height:auto !important;min-height:142px !important;max-height:none !important;overflow:visible !important;}
      #scrapbookDocSidebar .docNotesPanel .panelHeader{flex:0 0 auto !important;}
      #scrapbookDocSidebar .docNotesPanel .stageMiniBody{flex:0 0 auto !important;height:auto !important;min-height:96px !important;max-height:none !important;overflow:visible !important;display:flex;flex-direction:column;gap:8px;}
      #scrapbookDocSidebar .docNotesPanel .row{flex:0 0 auto !important;min-height:0 !important;overflow:visible !important;}
      #scrapbookDocSidebar .docNotesPanel .field{overflow:visible !important;}
      #sbDocumentPropertiesWindow{position:fixed;left:96px;top:96px;width:720px;height:560px;min-width:360px;min-height:260px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);z-index:10060;display:none;flex-direction:column;background:var(--panel-bg,#fff7ec);border:1px solid var(--panel-border,rgba(17,17,17,.18));border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.24);overflow:hidden;resize:both;box-sizing:border-box;}
      #sbDocumentPropertiesHeader{flex:0 0 auto;cursor:move;user-select:none;}
      #sbDocumentPropertiesHeader *{user-select:none;}
      #sbDocumentPropertiesBody{flex:1 1 auto;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px;}
      #sbDocumentPropertiesBody fieldset{border:1px solid rgba(17,17,17,.14);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;}
      #sbDocumentPropertiesBody legend{font-weight:700;padding:0 6px;}
      #sbDocumentPropertiesBody .row{display:flex;gap:10px;align-items:flex-start;}
      #sbDocumentPropertiesBody .field{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:4px;}
      #sbDocumentPropertiesBody .field input[type="text"],#sbDocumentPropertiesBody .field input[type="number"],#sbDocumentPropertiesBody .field select,#sbDocumentPropertiesBody .field textarea{width:100%;box-sizing:border-box;}
    `;
    document.head.appendChild(style);
  }

  function loadDocumentPropertiesGeometry(){
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY_DOCUMENT_PROPS_GEOMETRY) || 'null');
      if (raw && typeof raw === 'object') return raw;
    } catch {}
    return null;
  }

  function saveDocumentPropertiesGeometry(){
    const root = DocumentPropertiesState.root;
    if (!root) return;
    try {
      const rect = root.getBoundingClientRect();
      localStorage.setItem(LS_KEY_DOCUMENT_PROPS_GEOMETRY, JSON.stringify({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));
    } catch {}
  }

  function clampDocumentPropertiesWindowToViewport(){
    const root = DocumentPropertiesState.root;
    if (!root) return;
    const margin = 8;
    const maxW = Math.max(360, window.innerWidth - margin * 2);
    const maxH = Math.max(260, window.innerHeight - margin * 2);
    const rect = root.getBoundingClientRect();
    const w = Math.min(Math.max(360, rect.width || 720), maxW);
    const h = Math.min(Math.max(260, rect.height || 560), maxH);
    let left = Number.isFinite(rect.left) ? rect.left : 96;
    let top = Number.isFinite(rect.top) ? rect.top : 96;
    left = clamp(left, margin, Math.max(margin, window.innerWidth - w - margin));
    top = clamp(top, margin, Math.max(margin, window.innerHeight - h - margin));
    root.style.width = `${Math.round(w)}px`;
    root.style.height = `${Math.round(h)}px`;
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function clampDocumentPropertiesWindowPositionToViewport(){
    const root = DocumentPropertiesState.root;
    if (!root) return;
    const margin = 8;
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, rect.width || parseFloat(root.style.width || '720') || 720);
    const h = Math.max(1, rect.height || parseFloat(root.style.height || '560') || 560);
    let left = Number.isFinite(rect.left) ? rect.left : parseFloat(root.style.left || '96');
    let top = Number.isFinite(rect.top) ? rect.top : parseFloat(root.style.top || '96');
    left = clamp(left, margin, Math.max(margin, window.innerWidth - w - margin));
    top = clamp(top, margin, Math.max(margin, window.innerHeight - h - margin));
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function ensureDocumentPropertiesWindow(){
    ensureDocumentPropertiesStyles();
    let root = document.getElementById('sbDocumentPropertiesWindow');
    if (!root){
      root = document.createElement('div');
      root.id = 'sbDocumentPropertiesWindow';
      root.className = 'sbDocumentPropertiesWindow';
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = `
        <div id="sbDocumentPropertiesHeader" class="panelHeader">
          <h3>${escapeHtml(tr('sb_hdr_doc_properties'))}</h3>
          <button id="sbCloseDocumentProperties" class="btn" type="button">Close</button>
        </div>
        <div id="sbDocumentPropertiesBody"></div>`;
      document.body.appendChild(root);
    }
    DocumentPropertiesState.root = root;
    DocumentPropertiesState.header = root.querySelector('#sbDocumentPropertiesHeader');
    DocumentPropertiesState.body = root.querySelector('#sbDocumentPropertiesBody');
    const closeBtn = root.querySelector('#sbCloseDocumentProperties');
    if (closeBtn && !closeBtn.__wired){
      closeBtn.__wired = true;
      closeBtn.addEventListener('click', () => closeDocumentPropertiesWindow());
    }
    const header = DocumentPropertiesState.header;
    if (header && !header.__wiredDrag){
      header.__wiredDrag = true;
      header.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        if (e.target && e.target.closest('button,input,select,textarea')) return;
        const rect = root.getBoundingClientRect();
        DocumentPropertiesState.dragging = true;
        DocumentPropertiesState.dragPointerId = e.pointerId;
        DocumentPropertiesState.startX = e.clientX;
        DocumentPropertiesState.startY = e.clientY;
        DocumentPropertiesState.startLeft = rect.left;
        DocumentPropertiesState.startTop = rect.top;
        // Lock the current size while moving. Native CSS resize should only happen
        // from the bottom-right resize handle, never as a side effect of dragging
        // the header.
        root.style.width = `${Math.round(rect.width)}px`;
        root.style.height = `${Math.round(rect.height)}px`;
        root.style.resize = 'none';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        header.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      header.addEventListener('pointermove', (e) => {
        if (!DocumentPropertiesState.dragging || e.pointerId !== DocumentPropertiesState.dragPointerId) return;
        root.style.left = `${DocumentPropertiesState.startLeft + e.clientX - DocumentPropertiesState.startX}px`;
        root.style.top = `${DocumentPropertiesState.startTop + e.clientY - DocumentPropertiesState.startY}px`;
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        clampDocumentPropertiesWindowPositionToViewport();
      });
      const stopDrag = (e) => {
        if (!DocumentPropertiesState.dragging) return;
        if (e && DocumentPropertiesState.dragPointerId != null && e.pointerId !== DocumentPropertiesState.dragPointerId) return;
        DocumentPropertiesState.dragging = false;
        if (DocumentPropertiesState.dragPointerId != null) header.releasePointerCapture?.(DocumentPropertiesState.dragPointerId);
        DocumentPropertiesState.dragPointerId = null;
        root.style.resize = 'both';
        clampDocumentPropertiesWindowPositionToViewport();
        saveDocumentPropertiesGeometry();
      };
      header.addEventListener('pointerup', stopDrag);
      header.addEventListener('pointercancel', stopDrag);
      window.addEventListener('resize', () => {
        if (DocumentPropertiesState.isOpen){ clampDocumentPropertiesWindowToViewport(); saveDocumentPropertiesGeometry(); }
      });
    }
    return root;
  }

  function closeDocumentPropertiesWindow(){
    const root = ensureDocumentPropertiesWindow();
    saveDocumentPropertiesGeometry();
    DocumentPropertiesState.isOpen = false;
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
  }

  function openDocumentPropertiesWindow(){
    if (!ScrapbookState?.doc) return;
    const root = ensureDocumentPropertiesWindow();
    renderDocumentPropertiesForm();
    root.style.display = 'flex';
    root.style.visibility = 'visible';
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
    root.setAttribute('aria-hidden', 'false');
    const saved = loadDocumentPropertiesGeometry();
    const w = Math.round(Number(saved?.width) || 720);
    const h = Math.round(Number(saved?.height) || 560);
    root.style.width = `${w}px`;
    root.style.height = `${h}px`;
    root.style.left = `${Math.round(Number(saved?.left) || 96)}px`;
    root.style.top = `${Math.round(Number(saved?.top) || 96)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    DocumentPropertiesState.isOpen = true;
    clampDocumentPropertiesWindowToViewport();
  }

  function optionListHtml(options, selected){
    return options.map(([value,label]) => `<option value="${escapeHtml(value)}"${String(value)===String(selected)?' selected':''}>${escapeHtml(label)}</option>`).join('');
  }

  function renderDocumentPropertiesForm(){
    const body = DocumentPropertiesState.body || ensureDocumentPropertiesWindow().querySelector('#sbDocumentPropertiesBody');
    if (!body || !ScrapbookState?.doc) return;
    const doc = ScrapbookState.doc;
    doc.documentDefaults = normalizeScrapbookDocumentDefaults(doc.documentDefaults, Scene.stage || {});
    doc.settings = isPlainObject(doc.settings) ? doc.settings : {};
    doc.settings.includeCoverPageInExport = doc.settings.includeCoverPageInExport !== false;
    if (!Object.prototype.hasOwnProperty.call(doc.settings, 'coverDateAbbreviateNumericCartouche')) {
      doc.settings.coverDateAbbreviateNumericCartouche = false;
    } else {
      doc.settings.coverDateAbbreviateNumericCartouche = !!doc.settings.coverDateAbbreviateNumericCartouche;
    }
    const defs = doc.documentDefaults;
    const textOpts = getTextFontOptionsForPresetKey(defs.defaultRenderFontPreset);
    const renderPresetRegistry = (typeof stageFontPairController !== 'undefined' && stageFontPairController?.getCombinedRegistrySnapshot) ? stageFontPairController.getCombinedRegistrySnapshot() : RENDER_FONT_PRESETS;
    const renderPresetOptions = Object.values(renderPresetRegistry || {}).map(p => [p.key, p.label || p.key]).filter(([key]) => key);
    body.innerHTML = `
      <fieldset>
        <legend>${escapeHtml(tr('sb_hdr_doc_specific_properties'))}</legend>
        <div class="row"><div class="field"><label for="sbDocPropTitle">${tr('sb_lbl_title')}</label><input id="sbDocPropTitle" type="text" value="${escapeHtml(doc.meta.title || '')}"></div></div>
        <div class="row"><div class="field"><label for="sbDocSubtitle">${tr('sb_lbl_subtitle')}</label><input id="sbDocSubtitle" type="text" value="${escapeHtml(doc.meta.subtitle || '')}"></div></div>
        <div class="row"><div class="field"><label for="sbDocType">${tr('sb_lbl_doc_type')}</label><select id="sbDocType">${optionListHtml([['scrapbook','scrapbook'],['diary','diary'],['slideshow','slideshow'],['custom','custom']], doc.meta.documentType || 'scrapbook')}</select></div><div class="field"><label for="sbThemeId">${tr('sb_lbl_theme')}</label><select id="sbThemeId">${optionListHtml([['custom','custom'],['scrapbook','scrapbook'],['diary','diary'],['slideshow','slideshow']], defs.themeId || 'custom')}</select></div></div>
        <div class="row"><div class="field"><label for="sbPageTemplate">${tr('sb_lbl_page_template')}</label><select id="sbPageTemplate">${optionListHtml([['blank','blank'],['title','title slide'],['content','content slide'],['diary','diary entry'],['photoCaption','photo-left caption-right'],['quote','quote page'],['collage','collage']], defs.pageTemplate || 'blank')}</select></div><div class="field"><label>${tr('sb_lbl_page_count')}</label><div class="hint">${doc.pages.length}</div></div></div>
        <div class="row"><div class="field"><label for="sbDocPageW">${tr('sb_lbl_page_w')}</label><input id="sbDocPageW" type="number" min="64" max="12000" step="1" value="${escapeHtml(String(defs.pageWidth || ''))}"></div><div class="field"><label for="sbDocPageH">${tr('sb_lbl_page_h')}</label><input id="sbDocPageH" type="number" min="64" max="12000" step="1" value="${escapeHtml(String(defs.pageHeight || ''))}"></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbIncludeCoverPage" type="checkbox"${doc.settings.includeCoverPageInExport !== false ? ' checked' : ''}>${tr('sb_lbl_include_cover_page')}</label></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbCoverDateAbbrev" type="checkbox"${doc.settings.coverDateAbbreviateNumericCartouche ? ' checked' : ''}>${tr('sb_lbl_cover_date_abbrev')}</label></div></div>
        <div class="row"><div class="field"><label for="sbDocNotes">${tr('sb_lbl_doc_notes')}</label><textarea class="notesScroll" id="sbDocNotes" rows="5" placeholder="${tr('sb_placeholder_doc_notes')}">${escapeHtml(doc.notes || '')}</textarea></div></div>
      </fieldset>
      <fieldset>
        <legend>${escapeHtml(tr('sb_hdr_doc_scene_defaults'))}</legend>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefShowGrid" type="checkbox"${defs.showGrid ? ' checked' : ''}>Grid</label></div><div class="field"><label class="checkInline"><input id="sbDefSnapGrid" type="checkbox"${defs.snapGrid ? ' checked' : ''}>Snap: Grid</label></div><div class="field"><label class="checkInline"><input id="sbDefSnapObjects" type="checkbox"${defs.snapObjects ? ' checked' : ''}>Snap: Objects</label></div></div>
        <div class="row"><div class="field"><label for="sbDefGridSize">Grid size</label><input id="sbDefGridSize" type="number" min="2" max="1000" step="1" value="${defs.gridSize}"></div><div class="field"><label for="sbDefSnapTol">Snap tolerance</label><input id="sbDefSnapTol" type="number" min="0" max="200" step="1" value="${defs.snapTol}"></div></div>
        <div class="row"><div class="field"><label for="sbDefStageBg">Stage background</label><input id="sbDefStageBg" type="color" value="${escapeHtml(rgbaOrHexToHex(defs.stageBg, DEFAULTS.stageBg))}"></div><div class="field"><label class="checkInline"><input id="sbDefExportStageBg" type="checkbox"${defs.exportStageBackground ? ' checked' : ''}>Export stage background</label></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefBgImgEnabled" type="checkbox"${defs.bgImgEnabled ? ' checked' : ''}>Use background image</label></div><div class="field"><button id="sbLoadDocBg" class="btn" type="button">${tr('sb_btn_load_doc_bg')}</button><button id="sbClearDocBg" class="btn" type="button" style="margin-top:6px;">${tr('sb_btn_clear_doc_bg')}</button><div class="hint">${defs.bgImgAssetId ? escapeHtml(defs.bgImgAssetId) : 'No default background image'}</div></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefBgKeepAspect" type="checkbox"${defs.bgImgKeepAspect ? ' checked' : ''}>Keep aspect ratio</label></div><div class="field"><label class="checkInline"><input id="sbDefBgStretch" type="checkbox"${defs.bgImgStretch ? ' checked' : ''}>Stretch to stage</label></div></div>
        <div class="row"><div class="field"><label for="sbDefRenderFontPreset">Default sitelen font family</label><select id="sbDefRenderFontPreset">${optionListHtml(renderPresetOptions, defs.defaultRenderFontPreset)}</select></div><div class="field"><label for="sbDefTextFontOption">Default text font</label><select id="sbDefTextFontOption">${optionListHtml(textOpts, defs.defaultTextFontOption)}</select></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefAbbrevNumeric" type="checkbox"${defs.defaultAbbreviateNumericCartouches ? ' checked' : ''}>Default abbreviate numeric cartouche output</label></div></div>
        <div class="row"><div class="field"><label for="sbDefSpacingPreset">Default sitelen spacing</label><select id="sbDefSpacingPreset">${optionListHtml(spacingPresetSelectOptions(), defs.defaultSpacingPreset)}</select></div><div class="field"><label class="checkInline"><input id="sbDefPreserveCenter" type="checkbox"${defs.defaultPreserveCenterOnAutoResize ? ' checked' : ''}>Default preserve center on auto resize</label></div></div>
        <div class="row"><div class="field"><label for="sbDefTextColor">Default text</label><input id="sbDefTextColor" type="color" value="${escapeHtml(rgbaOrHexToHex(defs.defaultTextColor, DEFAULTS.defaultTextColor))}"></div><div class="field"><label class="checkInline"><input id="sbDefIgnoreUnknown" type="checkbox"${defs.defaultIgnoreUnknownText ? ' checked' : ''}>Default ignore unknown text</label></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefHaloEnabled" type="checkbox"${defs.defaultHaloEnabled ? ' checked' : ''}>Default halo</label></div><div class="field"><label for="sbDefHaloColor">Default halo color</label><input id="sbDefHaloColor" type="color" value="${escapeHtml(rgbaOrHexToHex(defs.defaultHaloColor, DEFAULTS.defaultHaloColor))}"></div><div class="field"><label for="sbDefHaloThickness">Default halo thickness (px)</label><input id="sbDefHaloThickness" type="number" min="0" max="200" step="1" value="${defs.defaultHaloThicknessPx}"></div></div>
        <div class="row"><div class="field"><label class="checkInline"><input id="sbDefFillEnabled" type="checkbox"${defs.defaultFillEnabled ? ' checked' : ''}>Default allow fill</label></div><div class="field"><label for="sbDefFill">Default fill</label><input id="sbDefFill" type="color" value="${escapeHtml(rgbaOrHexToHex(defs.defaultFill, DEFAULTS.defaultFill))}"></div></div>
        <div class="row"><div class="field"><label for="sbDefStroke">Default stroke</label><input id="sbDefStroke" type="color" value="${escapeHtml(rgbaOrHexToHex(defs.defaultStroke, DEFAULTS.defaultStroke))}"></div><div class="field"><label for="sbDefStrokeW">Default stroke width</label><input id="sbDefStrokeW" type="number" min="0" max="200" step="1" value="${defs.defaultStrokeW}"></div></div>
      </fieldset>`;
    wireDocumentPropertiesForm(body);
  }

  function wireDocumentPropertiesForm(body){
    const doc = ScrapbookState.doc;
    const defs = doc.documentDefaults;
    const bindInput = (id, fn) => { const el = body.querySelector('#' + id); if (el) el.addEventListener('input', () => { fn(el); debounceScrapbookSave(); }); };
    const bindChange = (id, fn) => { const el = body.querySelector('#' + id); if (el) el.addEventListener('change', () => { fn(el); debounceScrapbookSave(); }); };
    bindInput('sbDocPropTitle', el => { doc.meta.title = el.value; const side = document.getElementById('sbDocTitle'); if (side) side.value = el.value; });
    bindInput('sbDocSubtitle', el => { doc.meta.subtitle = el.value; });
    bindChange('sbDocType', el => { doc.meta.documentType = el.value; });
    bindChange('sbThemeId', el => { defs.themeId = el.value; if (defs.themeId === 'diary') defs.pageTemplate = 'diary'; else if (defs.themeId === 'slideshow') defs.pageTemplate = 'title'; else if (defs.themeId === 'scrapbook') defs.pageTemplate = 'collage'; renderDocumentPropertiesForm(); });
    bindChange('sbPageTemplate', el => { defs.pageTemplate = el.value; });
    bindChange('sbDocPageW', el => { defs.pageWidth = clamp(Math.round(Number(el.value) || defs.pageWidth || 1280), 64, 12000); el.value = defs.pageWidth; });
    bindChange('sbDocPageH', el => { defs.pageHeight = clamp(Math.round(Number(el.value) || defs.pageHeight || 800), 64, 12000); el.value = defs.pageHeight; });
    bindChange('sbIncludeCoverPage', el => { doc.settings.includeCoverPageInExport = !!el.checked; });
    bindChange('sbCoverDateAbbrev', el => { doc.settings.coverDateAbbreviateNumericCartouche = !!el.checked; });
    bindInput('sbDocNotes', el => { doc.notes = el.value; });
    bindChange('sbDefShowGrid', el => { defs.showGrid = !!el.checked; });
    bindChange('sbDefSnapGrid', el => { defs.snapGrid = !!el.checked; });
    bindChange('sbDefSnapObjects', el => { defs.snapObjects = !!el.checked; });
    bindChange('sbDefGridSize', el => { defs.gridSize = clamp(Number(el.value) || 20, 2, 1000); el.value = defs.gridSize; });
    bindChange('sbDefSnapTol', el => { defs.snapTol = clamp(Number(el.value) || 0, 0, 200); el.value = defs.snapTol; });
    bindChange('sbDefStageBg', el => { defs.stageBg = el.value; addDynamicSwatch(el.value); });
    bindChange('sbDefExportStageBg', el => { defs.exportStageBackground = !!el.checked; });
    bindChange('sbDefBgImgEnabled', el => { defs.bgImgEnabled = !!el.checked && !!defs.bgImgAssetId; renderDocumentPropertiesForm(); });
    bindChange('sbDefBgKeepAspect', el => { defs.bgImgKeepAspect = !!el.checked; });
    bindChange('sbDefBgStretch', el => { defs.bgImgStretch = !!el.checked; });
    bindChange('sbDefRenderFontPreset', el => { defs.defaultRenderFontPreset = normalizeRenderFontPresetKey(el.value); defs.defaultTextFontOption = getDefaultQuotedTextFontOptionForPreset(defs.defaultRenderFontPreset); renderDocumentPropertiesForm(); });
    bindChange('sbDefTextFontOption', el => { defs.defaultTextFontOption = normalizeTextFontOptionKeyForPreset(el.value, defs.defaultRenderFontPreset); });
    bindChange('sbDefAbbrevNumeric', el => { defs.defaultAbbreviateNumericCartouches = !!el.checked; });
    bindChange('sbDefSpacingPreset', el => { defs.defaultSpacingPreset = normalizeSpacingPreset(el.value); });
    bindChange('sbDefPreserveCenter', el => { defs.defaultPreserveCenterOnAutoResize = !!el.checked; });
    bindChange('sbDefTextColor', el => { defs.defaultTextColor = el.value; addDynamicSwatch(el.value); });
    bindChange('sbDefIgnoreUnknown', el => { defs.defaultIgnoreUnknownText = !!el.checked; });
    bindChange('sbDefHaloEnabled', el => { defs.defaultHaloEnabled = !!el.checked; });
    bindChange('sbDefHaloColor', el => { defs.defaultHaloColor = el.value; addDynamicSwatch(el.value); });
    bindChange('sbDefHaloThickness', el => { defs.defaultHaloThicknessPx = clamp(Number(el.value) || 0, 0, 200); el.value = defs.defaultHaloThicknessPx; });
    bindChange('sbDefFillEnabled', el => { defs.defaultFillEnabled = !!el.checked; });
    bindChange('sbDefFill', el => { defs.defaultFill = el.value; addDynamicSwatch(el.value); });
    bindChange('sbDefStroke', el => { defs.defaultStroke = el.value; addDynamicSwatch(el.value); });
    bindChange('sbDefStrokeW', el => { defs.defaultStrokeW = clamp(Number(el.value) || 0, 0, 200); el.value = defs.defaultStrokeW; });

    // Use the same shared colour-palette swatches as the scene and element panels.
    // Adding a dynamic swatch anywhere refreshes all attached colour controls.
    ['sbDefStageBg','sbDefTextColor','sbDefHaloColor','sbDefFill','sbDefStroke'].forEach((id) => {
      const colorInput = body.querySelector('#' + id);
      if (colorInput) attachSwatchesToColorInput(colorInput, { palette: getActiveColorPalette });
    });

    const loadBg = body.querySelector('#sbLoadDocBg');
    if (loadBg) loadBg.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const dataUrl = await dataUrlFromBlob(file);
          const assetId = addImageAssetFromDataUrl(dataUrl);
          doc.assets = collectDocumentAssets(doc);
          defs.bgImgAssetId = assetId;
          defs.bgImgEnabled = true;
          doc.assets = collectDocumentAssets(doc);
          debounceScrapbookSave();
          renderDocumentPropertiesForm();
        } catch (err) { alert('Could not load default background image: ' + (err.message || String(err))); }
      });
      input.click();
    });
    const clearBg = body.querySelector('#sbClearDocBg');
    if (clearBg) clearBg.addEventListener('click', () => { defs.bgImgAssetId = null; defs.bgImgEnabled = false; debounceScrapbookSave(); renderDocumentPropertiesForm(); });
  }


  const CurrentPagePropertiesState = {
    root: null,
    header: null,
    body: null,
    isOpen: false,
    dragging: false,
    dragPointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  function ensureCurrentPagePropertiesStyles(){
    if (document.getElementById('sbCurrentPagePropertiesStyles')) return;
    const style = document.createElement('style');
    style.id = 'sbCurrentPagePropertiesStyles';
    style.textContent = `
      #scrapbookDocSidebar .pageNotesPanel{flex:0 0 auto !important;height:auto !important;min-height:142px !important;max-height:none !important;overflow:visible !important;}
      #scrapbookDocSidebar .pageNotesPanel .panelHeader{flex:0 0 auto !important;}
      #scrapbookDocSidebar .pageNotesPanel .stageMiniBody{flex:0 0 auto !important;height:auto !important;min-height:96px !important;max-height:none !important;overflow:visible !important;display:flex;flex-direction:column;gap:8px;}
      #scrapbookDocSidebar .pageNotesPanel .row{flex:0 0 auto !important;min-height:0 !important;overflow:visible !important;}
      #scrapbookDocSidebar .pageNotesPanel .field{overflow:visible !important;}
      #sbCurrentPagePropertiesWindow{position:fixed;left:120px;top:120px;width:560px;height:420px;min-width:340px;min-height:260px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);z-index:11020;display:none;flex-direction:column;background:var(--panel-bg,#fff7ec);border:1px solid var(--panel-border,rgba(17,17,17,.18));border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.24);overflow:hidden;resize:both;box-sizing:border-box;}
      #sbCurrentPagePropertiesHeader{flex:0 0 auto;cursor:move;user-select:none;}
      #sbCurrentPagePropertiesHeader *{user-select:none;}
      #sbCurrentPagePropertiesBody{flex:1 1 auto;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px;}
      #sbCurrentPagePropertiesBody fieldset{border:1px solid rgba(17,17,17,.14);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;}
      #sbCurrentPagePropertiesBody legend{font-weight:700;padding:0 6px;}
      #sbCurrentPagePropertiesBody .row{display:flex;gap:10px;align-items:flex-start;}
      #sbCurrentPagePropertiesBody .field{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:4px;}
      #sbCurrentPagePropertiesBody .field input[type="text"],#sbCurrentPagePropertiesBody .field textarea{width:100%;box-sizing:border-box;}
    `;
    document.head.appendChild(style);
  }

  function loadCurrentPagePropertiesGeometry(){
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY_CURRENT_PAGE_PROPS_GEOMETRY) || 'null');
      if (raw && typeof raw === 'object') return raw;
    } catch {}
    return null;
  }

  function saveCurrentPagePropertiesGeometry(){
    const root = CurrentPagePropertiesState.root;
    if (!root) return;
    try {
      const rect = root.getBoundingClientRect();
      localStorage.setItem(LS_KEY_CURRENT_PAGE_PROPS_GEOMETRY, JSON.stringify({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));
    } catch {}
  }

  function clampCurrentPagePropertiesWindowToViewport(){
    const root = CurrentPagePropertiesState.root;
    if (!root) return;
    const margin = 8;
    const maxW = Math.max(340, window.innerWidth - margin * 2);
    const maxH = Math.max(260, window.innerHeight - margin * 2);
    const rect = root.getBoundingClientRect();
    const w = Math.min(Math.max(340, rect.width || 560), maxW);
    const h = Math.min(Math.max(260, rect.height || 420), maxH);
    let left = Number.isFinite(rect.left) ? rect.left : 120;
    let top = Number.isFinite(rect.top) ? rect.top : 120;
    left = clamp(left, margin, Math.max(margin, window.innerWidth - w - margin));
    top = clamp(top, margin, Math.max(margin, window.innerHeight - h - margin));
    root.style.width = `${Math.round(w)}px`;
    root.style.height = `${Math.round(h)}px`;
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function clampCurrentPagePropertiesWindowPositionToViewport(){
    const root = CurrentPagePropertiesState.root;
    if (!root) return;
    const margin = 8;
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, rect.width || parseFloat(root.style.width || '560') || 560);
    const h = Math.max(1, rect.height || parseFloat(root.style.height || '420') || 420);
    let left = Number.isFinite(rect.left) ? rect.left : parseFloat(root.style.left || '120');
    let top = Number.isFinite(rect.top) ? rect.top : parseFloat(root.style.top || '120');
    left = clamp(left, margin, Math.max(margin, window.innerWidth - w - margin));
    top = clamp(top, margin, Math.max(margin, window.innerHeight - h - margin));
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function bringCurrentPagePropertiesToFront(){
    const root = CurrentPagePropertiesState.root;
    if (!root) return;
    floatingEditorZCounter = Math.max(floatingEditorZCounter + 1, FLOATING_EDITOR_BASE_Z + 20);
    root.style.zIndex = String(floatingEditorZCounter);
  }

  function ensureCurrentPagePropertiesWindow(){
    ensureCurrentPagePropertiesStyles();
    let root = document.getElementById('sbCurrentPagePropertiesWindow');
    if (!root){
      root = document.createElement('div');
      root.id = 'sbCurrentPagePropertiesWindow';
      root.className = 'sbCurrentPagePropertiesWindow';
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = `
        <div id="sbCurrentPagePropertiesHeader" class="panelHeader">
          <h3 id="sbCurrentPagePropertiesTitle">${escapeHtml(tr('sb_hdr_page_properties'))}</h3>
          <button id="sbCloseCurrentPageProperties" class="btn" type="button">Close</button>
        </div>
        <div id="sbCurrentPagePropertiesBody"></div>`;
      document.body.appendChild(root);
    }
    CurrentPagePropertiesState.root = root;
    CurrentPagePropertiesState.header = root.querySelector('#sbCurrentPagePropertiesHeader');
    CurrentPagePropertiesState.body = root.querySelector('#sbCurrentPagePropertiesBody');
    const title = root.querySelector('#sbCurrentPagePropertiesTitle');
    if (title) title.textContent = tr('sb_hdr_page_properties');
    const closeBtn = root.querySelector('#sbCloseCurrentPageProperties');
    if (closeBtn && !closeBtn.__wired){
      closeBtn.__wired = true;
      closeBtn.addEventListener('click', () => closeCurrentPagePropertiesWindow());
    }
    ['pointerdown','mousedown','focusin'].forEach((evt) => {
      if (!root[`__wiredBring_${evt}`]){
        root[`__wiredBring_${evt}`] = true;
        root.addEventListener(evt, bringCurrentPagePropertiesToFront, true);
      }
    });
    const header = CurrentPagePropertiesState.header;
    if (header && !header.__wiredDrag){
      header.__wiredDrag = true;
      header.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        if (e.target && e.target.closest('button,input,select,textarea')) return;
        bringCurrentPagePropertiesToFront();
        const rect = root.getBoundingClientRect();
        CurrentPagePropertiesState.dragging = true;
        CurrentPagePropertiesState.dragPointerId = e.pointerId;
        CurrentPagePropertiesState.startX = e.clientX;
        CurrentPagePropertiesState.startY = e.clientY;
        CurrentPagePropertiesState.startLeft = rect.left;
        CurrentPagePropertiesState.startTop = rect.top;
        root.style.width = `${Math.round(rect.width)}px`;
        root.style.height = `${Math.round(rect.height)}px`;
        root.style.resize = 'none';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        header.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      header.addEventListener('pointermove', (e) => {
        if (!CurrentPagePropertiesState.dragging || e.pointerId !== CurrentPagePropertiesState.dragPointerId) return;
        root.style.left = `${CurrentPagePropertiesState.startLeft + e.clientX - CurrentPagePropertiesState.startX}px`;
        root.style.top = `${CurrentPagePropertiesState.startTop + e.clientY - CurrentPagePropertiesState.startY}px`;
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        clampCurrentPagePropertiesWindowPositionToViewport();
      });
      const stopDrag = (e) => {
        if (!CurrentPagePropertiesState.dragging) return;
        if (e && CurrentPagePropertiesState.dragPointerId != null && e.pointerId !== CurrentPagePropertiesState.dragPointerId) return;
        CurrentPagePropertiesState.dragging = false;
        if (CurrentPagePropertiesState.dragPointerId != null) header.releasePointerCapture?.(CurrentPagePropertiesState.dragPointerId);
        CurrentPagePropertiesState.dragPointerId = null;
        root.style.resize = 'both';
        clampCurrentPagePropertiesWindowPositionToViewport();
        saveCurrentPagePropertiesGeometry();
      };
      header.addEventListener('pointerup', stopDrag);
      header.addEventListener('pointercancel', stopDrag);
      window.addEventListener('resize', () => {
        if (CurrentPagePropertiesState.isOpen){ clampCurrentPagePropertiesWindowToViewport(); saveCurrentPagePropertiesGeometry(); }
      });
    }
    return root;
  }

  function closeCurrentPagePropertiesWindow(){
    const root = ensureCurrentPagePropertiesWindow();
    saveCurrentPagePropertiesGeometry();
    CurrentPagePropertiesState.isOpen = false;
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
  }

  function openCurrentPagePropertiesWindow(){
    if (!ScrapbookState?.doc) return;
    const root = ensureCurrentPagePropertiesWindow();
    renderCurrentPagePropertiesForm();
    root.style.display = 'flex';
    root.style.visibility = 'visible';
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
    root.setAttribute('aria-hidden', 'false');
    const saved = loadCurrentPagePropertiesGeometry();
    root.style.width = `${Math.round(Number(saved?.width) || 560)}px`;
    root.style.height = `${Math.round(Number(saved?.height) || 420)}px`;
    root.style.left = `${Math.round(Number(saved?.left) || 120)}px`;
    root.style.top = `${Math.round(Number(saved?.top) || 120)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    CurrentPagePropertiesState.isOpen = true;
    bringCurrentPagePropertiesToFront();
    clampCurrentPagePropertiesWindowToViewport();
  }

  function syncCurrentPageNameControls(page){
    const p = page || getCurrentPage();
    if (!p) return;
    const sidebarName = document.getElementById('sbPageName');
    if (sidebarName && sidebarName.value !== String(p.name || '')) sidebarName.value = String(p.name || '');
    const popName = document.getElementById('sbCurrentPagePropName');
    if (popName && popName.value !== String(p.name || '')) popName.value = String(p.name || '');
    const activeCardInput = document.querySelector(`#sbPageList .pageCard[data-page-id="${CSS.escape(String(p.id))}"] .pageMeta input`);
    if (activeCardInput && activeCardInput.value !== String(p.name || '')) activeCardInput.value = String(p.name || '');
  }

  function renderCurrentPagePropertiesForm(){
    const body = CurrentPagePropertiesState.body || ensureCurrentPagePropertiesWindow().querySelector('#sbCurrentPagePropertiesBody');
    if (!body) return;
    const p = getCurrentPage();
    if (!p){
      body.innerHTML = `<div class="hint">No current page.</div>`;
      return;
    }
    const stage = p?.payload?.scene?.stage || Scene.stage || {};
    body.innerHTML = `
      <fieldset>
        <legend>${escapeHtml(tr('sb_hdr_current_page'))}</legend>
        <div class="row"><div class="field"><label for="sbCurrentPagePropName">${tr('sb_lbl_page_name')}</label><input id="sbCurrentPagePropName" type="text" value="${escapeHtml(p.name || '')}"></div></div>
        <div class="row"><div class="field"><label for="sbCurrentPagePropTags">${tr('sb_lbl_page_tags')}</label><input id="sbCurrentPagePropTags" type="text" value="${escapeHtml((p.tags || []).join(', '))}" placeholder="tag1, tag2"></div></div>
        <div class="row"><div class="field"><label>${tr('sb_lbl_page_size')}</label><div class="hint">${stage.w || ''} × ${stage.h || ''}</div></div></div>
        <div class="row"><div class="field"><label for="sbCurrentPagePropNotes">${tr('sb_lbl_page_notes')}</label><textarea class="notesScroll" id="sbCurrentPagePropNotes" rows="8" placeholder="${tr('sb_placeholder_page_notes')}">${escapeHtml(p.notes || '')}</textarea></div></div>
        <div class="docRowBtns"><button class="btn" id="sbCurrentPageApplyTemplate" type="button">${tr('sb_btn_apply_template')}</button></div>
      </fieldset>`;
    wireCurrentPagePropertiesForm(body);
  }

  function wireCurrentPagePropertiesForm(body){
    const name = body.querySelector('#sbCurrentPagePropName');
    const tags = body.querySelector('#sbCurrentPagePropTags');
    const notes = body.querySelector('#sbCurrentPagePropNotes');
    const apply = body.querySelector('#sbCurrentPageApplyTemplate');
    if (name) name.addEventListener('input', (e) => {
      const p = getCurrentPage();
      if (!p) return;
      p.name = e.target.value;
      syncCurrentPageNameControls(p);
      debounceScrapbookSave();
      refreshScrapbookSearchResults(true);
    });
    if (tags) tags.addEventListener('input', (e) => {
      const p = getCurrentPage();
      if (!p) return;
      p.tags = String(e.target.value || '').split(',').map(s => s.trim()).filter(Boolean);
      debounceScrapbookSave();
      refreshScrapbookSearchResults(true);
    });
    if (notes) notes.addEventListener('input', (e) => {
      const p = getCurrentPage();
      if (!p) return;
      p.notes = e.target.value;
      debounceScrapbookSave();
      refreshScrapbookSearchResults(true);
    });
    if (apply) apply.addEventListener('click', async () => { await applyTemplateToCurrentPage(); renderCurrentPagePropertiesForm(); });
  }

  function refreshCurrentPagePropertiesWindow(){
    if (CurrentPagePropertiesState.isOpen) renderCurrentPagePropertiesForm();
  }

  function renderScrapbookSidebar(){
    ensureDocumentPropertiesStyles();
    ensureCurrentPagePropertiesStyles();
    ensureScrapbookPagesPanelStyles();
    refreshScrapbookSearchResults();
    const root = document.getElementById('scrapbookDocSidebar');
    if (!root || !ScrapbookState) return;
    const doc = ScrapbookState.doc;
    const defs = doc.documentDefaults || (doc.documentDefaults = {});
    const curPage = getCurrentPage();
    root.innerHTML = `
      <div class="docSidebarBody">
        <section class="panel docNotesPanel">
          <div class="panelHeader"><h2>${tr('sb_hdr_document')}</h2></div>
          <div class="stageMiniBody">
            <div class="row"><div class="field"><label for="sbDocTitle">${tr('sb_lbl_title')}</label><input id="sbDocTitle" type="text" value="${escapeHtml(doc.meta.title || '')}"></div></div>
            <div class="row"><div class="field"><button class="btn" id="sbOpenDocProperties" type="button">${tr('sb_btn_doc_properties')}</button></div></div>
          </div>
        </section>
        <section class="panel pagesPanel" style="min-height:0;display:flex;flex-direction:column;overflow:hidden;">
          <div class="panelHeader"><h2>${tr('sb_hdr_pages')}</h2></div>
          <div class="sbPagesActionBar" aria-label="Page actions">
            <button class="btn" id="sbAddPage" type="button">${tr('sb_btn_add_page')}</button>
            <button class="btn" id="sbDupPage" type="button">${tr('sb_btn_dup_page_sm')}</button>
            <button class="btn" id="sbDelPage" type="button">${tr('sb_btn_del_page_sm')}</button>
            <button class="btn" id="sbPrevPage" type="button">${tr('sb_btn_prev_sm')}</button>
            <button class="btn" id="sbNextPage" type="button">${tr('sb_btn_next_sm')}</button>
          </div>
          <div class="stageMiniBody sbPagesListBody">
            <div id="sbPageList" class="pageList"></div>
          </div>
        </section>
        <section class="panel pageNotesPanel">
          <div class="panelHeader"><h2>${tr('sb_hdr_current_page')}</h2></div>
          <div class="stageMiniBody">
            <div class="row"><div class="field"><label for="sbPageName">${tr('sb_lbl_page_name')}</label><input id="sbPageName" type="text" value="${escapeHtml(curPage?.name || '')}"></div></div>
            <div class="row"><div class="field"><button class="btn" id="sbOpenCurrentPageProperties" type="button">${tr('sb_btn_page_properties')}</button></div></div>
          </div>
        </section>
      </div>`;
    ensureDocMetaBindings(root);
    const openDocPropsBtn = root.querySelector('#sbOpenDocProperties');
    if (openDocPropsBtn) openDocPropsBtn.addEventListener('click', (e) => { e.preventDefault(); openDocumentPropertiesWindow(); });
    const openPagePropsBtn = root.querySelector('#sbOpenCurrentPageProperties');
    if (openPagePropsBtn) openPagePropsBtn.addEventListener('click', (e) => { e.preventDefault(); openCurrentPagePropertiesWindow(); });
    root.querySelector('#sbPageName').oninput = (e) => {
      const p = getCurrentPage();
      if (p) {
        p.name = e.target.value;
        syncCurrentPageNameControls(p);
        debounceScrapbookSave();
        refreshScrapbookSearchResults(true);
      }
    };

    const list = root.querySelector('#sbPageList');
    let dragPageId = '';
    const clearPageDropMarks = () => {
      list.querySelectorAll('.pageCard.dropBefore').forEach(node => node.classList.remove('dropBefore'));
      const endDrop = list.querySelector('.pageListDropEnd');
      if (endDrop) endDrop.classList.remove('active');
    };
    for (const page of doc.pages){
      const card = document.createElement('div');
      card.className = 'pageCard' + (page.id === ScrapbookState.currentPageId ? ' active' : '');
      card.dataset.pageId = page.id;
      const thumb = page.thumbnail ? `<img class="pageThumb" alt="" src="${page.thumbnail}">` : `<div class="pageThumb"></div>`;
      card.innerHTML = `${thumb}<div class="pageMeta"><input type="text" value="${escapeHtml(page.name || '')}"><div class="hint">${page.payload?.scene?.stage?.w || ''} × ${page.payload?.scene?.stage?.h || ''}</div><div class="pageMiniBtns"><button class="btn" type="button" data-act="up">↑</button><button class="btn" type="button" data-act="down">↓</button></div></div>`;
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        dragPageId = page.id;
        card.classList.add('dragging');
        if (e.dataTransfer){
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', page.id);
        }
      });
      card.addEventListener('dragend', () => {
        dragPageId = '';
        card.classList.remove('dragging');
        clearPageDropMarks();
      });
      card.addEventListener('dragenter', (e) => {
        e.preventDefault();
        clearPageDropMarks();
        if (dragPageId && dragPageId !== page.id) card.classList.add('dropBefore');
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) card.classList.remove('dropBefore');
      });
      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        const fromId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragPageId;
        clearPageDropMarks();
        if (fromId) await reorderPagesBefore(fromId, page.id);
      });
      card.addEventListener('click', async (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        await switchToPage(page.id);
      });
      const inp = card.querySelector('input');
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('input', (e) => {
        page.name = e.target.value;
        if (page.id === ScrapbookState.currentPageId) syncCurrentPageNameControls(page);
        debounceScrapbookSave();
        refreshScrapbookSearchResults(true);
      });
      card.querySelector('[data-act="up"]').addEventListener('click', async (e) => { e.stopPropagation(); await movePage(page.id, -1); });
      card.querySelector('[data-act="down"]').addEventListener('click', async (e) => { e.stopPropagation(); await movePage(page.id, 1); });
      list.appendChild(card);
    }
    const endDrop = document.createElement('div');
    endDrop.className = 'pageListDropEnd';
    endDrop.title = 'Drop here to move page to end';
    endDrop.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (!dragPageId) return;
      clearPageDropMarks();
      endDrop.classList.add('active');
    });
    endDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    endDrop.addEventListener('dragleave', (e) => {
      if (!endDrop.contains(e.relatedTarget)) endDrop.classList.remove('active');
    });
    endDrop.addEventListener('drop', async (e) => {
      e.preventDefault();
      const fromId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragPageId;
      clearPageDropMarks();
      if (!fromId) return;
      const pages = ScrapbookState?.doc?.pages || [];
      const fromIdx = pages.findIndex(p => p.id === fromId);
      if (fromIdx < 0 || fromIdx === pages.length - 1) return;
      const [page] = pages.splice(fromIdx, 1);
      pages.push(page);
      const pageListAnchor = capturePageListAnchor();
      renderScrapbookSidebar();
      restorePageListAnchor(pageListAnchor);
      debounceScrapbookSave();
      historyCommit(`Reorder page: ${page.name || 'Page'}`);
    });
    list.appendChild(endDrop);
    root.querySelector('#sbAddPage').onclick = async () => { await addNewPage(); };
    root.querySelector('#sbDupPage').onclick = async () => { await duplicateCurrentPage(); };
    root.querySelector('#sbDelPage').onclick = async () => { await deleteCurrentPage(); };
    root.querySelector('#sbPrevPage').onclick = async () => { await stepPage(-1); };
    root.querySelector('#sbNextPage').onclick = async () => { await stepPage(1); };
    ensureCurrentPageCardVisible();
    syncPageNumberInputs();
    refreshCurrentPagePropertiesWindow();
  }
  function syncPageNumberInputs(){
    if (!ScrapbookState?.doc?.pages) return;
    const pages = ScrapbookState.doc.pages;
    const idx = pages.findIndex(p => p.id === ScrapbookState.currentPageId);
    const pageNum = idx >= 0 ? String(idx + 1) : '';
    const inp1 = $('sbGotoPageInput');
    const inp2 = $('compactGotoPageInput');
    if (inp1) inp1.value = pageNum;
    if (inp2) inp2.value = pageNum;
  }
  async function switchToPage(pageId, opts = {}){
    if (!ScrapbookState || pageId === ScrapbookState.currentPageId) return;
    const uiLoadToken = nextScrapbookUiLoadToken();
    const options = opts || {};
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(true);
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    ScrapbookState.currentPageId = pageId;
    ScrapbookState.doc.currentPageId = pageId;
    const page = getCurrentPage();
    if (!page) return;
    closeTransientEditorsForPageSwitch();
    await loadPagePayloadIntoEditor(page.payload, `Open ${page.name || 'page'}`, { preserveHistory: true });
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    applyDocumentLanguage();
    ScrapbookState.lastEditorHash = sceneFingerprint();
    if ($('sbPresentationOverlay') && $('sbPresentationOverlay').style.display === 'flex') closePresentation();
    renderScrapbookSidebar();
    refreshScrapbookSearchResults(true);
    debounceScrapbookSave();
    if (options.commitHistory !== false) historyCommit(`Switch page: ${page.name || 'Page'}`);
  }
  async function addNewPage(templateKind = null){
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(true);
    const kind = templateKind || ScrapbookState?.doc?.documentDefaults?.pageTemplate || 'blank';
    const base = buildTemplatePayload(kind);
    base.scene.meta = { ...(base.scene.meta || {}), title: base.scene.meta?.title || '' };
    const idx = ScrapbookState.doc.pages.length + 1;
    let pageName = `Page ${idx}`;
    if (kind === 'diary') pageName = diaryDateLabel();
    else if (kind === 'title') pageName = 'Title slide';
    else if (kind === 'content') pageName = `Slide ${idx}`;
    else if (kind === 'quote') pageName = 'Quote page';
    const page = { id: uid('page'), name: pageName, notes: '', tags: [], thumbnail: '', payload: base };
    ScrapbookState.doc.pages.push(page);
    await switchToInsertedPage(page);
    historyCommit(`Add page: ${page.name || 'Page'}`);
  }
  async function switchToInsertedPage(page){
    const uiLoadToken = nextScrapbookUiLoadToken();
    ScrapbookState.currentPageId = page.id;
    ScrapbookState.doc.currentPageId = page.id;
    closeTransientEditorsForPageSwitch();
    await loadPagePayloadIntoEditor(page.payload, `Open ${page.name || 'page'}`, { preserveHistory: true });
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    applyDocumentLanguage();
    page.thumbnail = await renderCurrentPageDataUrl(160, 110, false, true);
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    ScrapbookState.lastEditorHash = sceneFingerprint();
    if ($('sbPresentationOverlay') && $('sbPresentationOverlay').style.display === 'flex') closePresentation();
    renderScrapbookSidebar();
    refreshScrapbookSearchResults(true);
    debounceScrapbookSave();
  }
  async function applyTemplateToCurrentPage(){
    flushActiveScrapbookUiEdits();
    const cur = getCurrentPage();
    if (!cur || !ScrapbookState) return;
    const kind = ScrapbookState?.doc?.documentDefaults?.pageTemplate || 'blank';
    const ok = confirm(`Replace the current page with the "${kind}" template? This will overwrite the current page contents.`);
    if (!ok) return;
    await syncEditorIntoCurrentPage(false);
    const nextPayload = buildTemplatePayload(kind);
    if (cur.name && !/^Page \d+$/.test(cur.name)) nextPayload.scene.meta = { ...(nextPayload.scene.meta || {}), title: cur.name };
    cur.payload = nextPayload;
    cur.thumbnail = '';
    closeTransientEditorsForPageSwitch();
    await loadPagePayloadIntoEditor(cur.payload, `Apply ${kind} template`, { preserveHistory: true });
    ScrapbookState.lastEditorHash = sceneFingerprint();
    await syncEditorIntoCurrentPage(true);
    historyCommit(`Apply template: ${kind}`);
  }

  async function duplicateCurrentPage(){
    flushActiveScrapbookUiEdits();
    await syncEditorIntoCurrentPage(true);
    const cur = getCurrentPage(); if (!cur) return;
    const idx = ScrapbookState.doc.pages.findIndex(p => p.id === cur.id);
    const copy = deep(cur); copy.id = uid('page'); copy.name = `${cur.name || 'Page'} copy`;
    ScrapbookState.doc.pages.splice(idx + 1, 0, copy);
    await switchToInsertedPage(copy);
    historyCommit(`Duplicate page: ${copy.name || 'Page copy'}`);
  }
  async function deleteCurrentPage(){
    flushActiveScrapbookUiEdits();
    if (!ScrapbookState) return;
    if (ScrapbookState.doc.pages.length <= 1){ alert('The document must keep at least one page.'); return; }
    const cur = getCurrentPage(); if (!cur) return;
    if (!confirm(`Delete page "${cur.name || 'Untitled'}"?`)) return;
    const idx = ScrapbookState.doc.pages.findIndex(p => p.id === cur.id);
    ScrapbookState.doc.pages.splice(idx, 1);
    const next = ScrapbookState.doc.pages[Math.max(0, idx - 1)] || ScrapbookState.doc.pages[0];
    await switchToInsertedPage(next);
    historyCommit(`Delete page: ${cur.name || 'Untitled'}`);
  }
  async function movePage(pageId, delta){
    const pages = ScrapbookState.doc.pages;
    const idx = pages.findIndex(p => p.id === pageId);
    if (idx < 0) return;
    const nidx = Math.max(0, Math.min(pages.length - 1, idx + delta));
    if (nidx === idx) return;
    const [page] = pages.splice(idx, 1); pages.splice(nidx, 0, page);
    const pageListAnchor = capturePageListAnchor();
    renderScrapbookSidebar();
    restorePageListAnchor(pageListAnchor);
    debounceScrapbookSave();
    historyCommit(`Move page: ${page.name || 'Page'}`);
  }
  async function reorderPagesBefore(fromId, beforeId){
    const pages = ScrapbookState.doc.pages;
    const fromIdx = pages.findIndex(p => p.id === fromId);
    const beforeIdx = pages.findIndex(p => p.id === beforeId);
    if (fromIdx < 0 || beforeIdx < 0 || fromIdx === beforeIdx) return;
    const [page] = pages.splice(fromIdx, 1);
    const insertIdx = pages.findIndex(p => p.id === beforeId);
    pages.splice(insertIdx < 0 ? pages.length : insertIdx, 0, page);
    const pageListAnchor = capturePageListAnchor();
    renderScrapbookSidebar();
    restorePageListAnchor(pageListAnchor);
    debounceScrapbookSave();
    historyCommit(`Reorder page: ${page.name || 'Page'}`);
  }
  async function stepPage(delta){
    flushActiveScrapbookUiEdits();
    const pages = ScrapbookState.doc.pages;
    const idx = pages.findIndex(p => p.id === ScrapbookState.currentPageId);
    const next = pages[idx + delta];
    if (next) await switchToPage(next.id);
  }
  async function goToPageNumber(rawPageNumber){
    if (!ScrapbookState || !ScrapbookState.doc || !Array.isArray(ScrapbookState.doc.pages)) return;
    const pages = ScrapbookState.doc.pages;
    if (!pages.length) return;
    let pageNum = Math.floor(Number(rawPageNumber));
    if (!Number.isFinite(pageNum)) pageNum = 1;
    pageNum = Math.max(1, Math.min(pages.length, pageNum));
    const input = $('sbGotoPageInput');
    if (input) input.value = String(pageNum);
    const target = pages[pageNum - 1];
    if (target) await switchToPage(target.id);
  }
  function exportDocumentJson(){
    if (!ScrapbookState) return;
    // Use the live document directly — buildDocumentSnapshotForHistory strips asset
    // data URLs for memory efficiency and must not be used for export.
    const out = buildCanonicalScrapbookDocumentForExport(ScrapbookState.doc);
    const safeName = String(out.meta?.title || 'scrapbook').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'scrapbook';
    const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
    downloadBlob(blob, `${safeName}_${nowIso()}.json`);
  }
  async function importDocumentJsonFromFile(file){
    clearExportGuard();
    const txt = await file.text();
    const raw = safeJsonParse(txt);
    const normalized = normalizeScrapbookDocument(raw);
    await syncEditorIntoCurrentPage(true);
    await loadDocumentSnapshotIntoEditor(normalized, 'Import document');
  }
  async function newDocumentGuarded(){
    clearExportGuard();
    if (ScrapbookState && ScrapbookState.doc && ScrapbookState.doc.pages.length && editorHasMeaningfulContent()){
      const docTitle = ScrapbookState.doc.meta && ScrapbookState.doc.meta.title
        ? `"${ScrapbookState.doc.meta.title}"`
        : 'the current document';
      const pageCount = ScrapbookState.doc.pages.length;
      const confirmed = await confirmDialog(
        'Create new document?',
        `This will replace ${docTitle} (${pageCount} page${pageCount !== 1 ? 's' : ''}) with a blank document. This cannot be undone.`,
        'Create new'
      );
      if (!confirmed) return;
    }
    const uiLoadToken = nextScrapbookUiLoadToken();
    const payload = blankPayloadFromSnapshot(snapshotCurrentPagePayload());
    closePresentation();
    ScrapbookState.doc = createDocumentFromPayload(payload);
    ScrapbookState.currentPageId = ScrapbookState.doc.currentPageId;
    bindScrapbookCartoucheDbDocumentToApp();
    const cur = getCurrentPage();
    closeTransientEditorsForPageSwitch();
    await loadPagePayloadIntoEditor(cur.payload, 'New document', { preserveHistory: true });
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    applyDocumentLanguage();
    cur.thumbnail = await renderCurrentPageDataUrl(160,110, false, true);
    if (!isCurrentScrapbookUiLoadToken(uiLoadToken)) return;
    ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
    ScrapbookState.lastEditorHash = sceneFingerprint();
    clearScrapbookSearchState();
    renderScrapbookSidebar(); debounceScrapbookSave();
    historyReset('New document');
  }
  function installScrapbookChrome(){
    const wrap = document.querySelector('.wrap');
    wrap.classList.add('scrapbookShell');
    const docSidebar = document.createElement('section');
    docSidebar.className = 'panel docSidebar';
    docSidebar.id = 'scrapbookDocSidebar';
    wrap.insertBefore(docSidebar, wrap.firstElementChild);

    const row1 = document.querySelector('#topbar .topbarRow');
    // Move the toggle button (☰) into docGroup as its first child so they
    // share the same flex container and always appear on the same line.
    const toggleBtn = row1.firstElementChild;
    row1.removeChild(toggleBtn);
    const docGroup = document.createElement('div');
    docGroup.className = 'topbarGroup scrapbookGroup';
    docGroup.innerHTML = `<button class="btn" id="sbBtnNewDoc" type="button">${tr('sb_btn_new_doc')}</button><button class="btn" id="sbBtnImportDoc" type="button">${tr('sb_btn_import_doc')}</button><button class="btn" id="sbBtnExportDoc" type="button">${tr('sb_btn_export_doc')}</button><button class="btn" id="sbBtnExportAllPng" type="button">${tr('sb_btn_export_zip')}</button><button class="btn" id="sbBtnExportAllSvg" type="button">${tr('sb_btn_export_svg_zip')}</button><button class="btn" id="sbBtnExportPrint" type="button">${tr('sb_btn_export_print')}</button><button class="btn" id="sbBtnExportPdf" type="button">${tr('sb_btn_export_pdf')}</button><button class="btn" id="sbBtnPresent" type="button">${tr('sb_btn_present')}</button><button class="btn" id="sbBtnSearch" type="button">${tr('sb_btn_search')}</button>`;
    docGroup.insertBefore(toggleBtn, docGroup.firstElementChild);
    row1.insertBefore(docGroup, row1.firstElementChild);
    const pageGroup = document.createElement('div');
    pageGroup.className = 'topbarGroup scrapbookGroup';
    pageGroup.innerHTML = `<button class="btn" id="sbBtnNewPage" type="button">${tr('sb_btn_new_page')}</button><button class="btn" id="sbBtnDupPage" type="button">${tr('sb_btn_dup_page')}</button><button class="btn" id="sbBtnDeletePage" type="button">${tr('sb_btn_del_page')}</button><button class="btn" id="sbBtnMovePageUp" type="button">${tr('sb_btn_move_up')}</button><button class="btn" id="sbBtnMovePageDown" type="button">${tr('sb_btn_move_down')}</button><button class="btn" id="sbBtnPrevPage" type="button">${tr('sb_btn_prev_page')}</button><button class="btn" id="sbBtnNextPage" type="button">${tr('sb_btn_next_page')}</button><input class="langSel" id="sbGotoPageInput" type="number" min="1" step="1" placeholder="${tr('sb_ph_page_number')}" title="${tr('sb_btn_goto_page')}" style="width:88px;" /><button class="btn" id="sbBtnGotoPage" type="button">${tr('sb_btn_go')}</button>`;
    row1.insertBefore(pageGroup, docGroup.nextSibling);
    initScrapbookSearchWindow();
    installCompactToolbar();
    setToolbarLayoutMode(loadToolbarLayoutMode());
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json'; input.style.display = 'none'; input.id = 'sbImportDocInput';
    document.body.appendChild(input);
    $('sbBtnNewDoc').onclick = async () => { clearExportGuard(); await newDocumentGuarded(); };
    $('sbBtnImportDoc').onclick = () => { clearExportGuard(); input.click(); };
    $('sbBtnExportDoc').onclick = async () => {
      void runExportGuarded('doc-json', async () => {
        await syncEditorIntoCurrentPage(true);
        exportDocumentJson();
      });
    };
    // ── YouTube export info dialog ──────────────────────────────────────────
    // Scans all pages for YouTube URL elements. If any found and the per-export
    // "don't show again" preference is still ON, shows an info dialog before
    // proceeding. Reuses the existing #mediaGuardOverlay DOM at z-index 10500.
    function docHasYouTubeUrls(){
      const pages = ScrapbookState?.doc?.pages || [];
      for (const page of pages){
        const els = page?.payload?.scene?.elements || [];
        for (const el of els){
          if (el.type === 'url' && el.url && extractYouTubeVideoId(String(el.url.href || ''))){
            return true;
          }
        }
        // Also check live scene for the current page
        if (page.id === ScrapbookState?.currentPageId){
          for (const el of (Scene.elements || [])){
            if (el.type === 'url' && el.url && extractYouTubeVideoId(String(el.url.href || ''))){
              return true;
            }
          }
        }
      }
      return false;
    }

    function showYoutubeExportInfo(exportType, onContinue){
      // Skip dialog if no YouTube URLs in doc, or user said don't show again
      const info = ScrapbookState?.doc?.settings?.youtubeExportInfo;
      if (!docHasYouTubeUrls() || (info && info[exportType] === false)){
        onContinue();
        return;
      }

      const overlay  = document.getElementById('mediaGuardOverlay');
      const icon     = document.getElementById('mediaGuardIcon');
      const title    = document.getElementById('mediaGuardTitle');
      const body     = document.getElementById('mediaGuardBody');
      const checkbox = document.getElementById('mediaGuardDontShow');
      const btnCancel    = document.getElementById('mediaGuardBtnCancel');
      const btnContinue  = document.getElementById('mediaGuardBtnContinue');

      icon.textContent  = '⚠️';
      title.textContent = 'YouTube Poster Images';
      body.textContent  = 'This scrapbook contains YouTube video links. YouTube poster images may not appear correctly on the first export attempt due to network restrictions. If thumbnails are missing, try exporting again — they usually appear after one or two attempts.';
      checkbox.checked  = false;

      // Hide cancel — this is info only, export always continues
      btnCancel.style.display = 'none';
      btnContinue.textContent = 'Continue';

      overlay.classList.add('open');
      btnContinue.focus();

      function onKeyDown(e){
        if (e.key === 'Escape'){ e.stopPropagation(); close(true); }
      }
      overlay.addEventListener('keydown', onKeyDown, true);

      function close(proceed){
        overlay.classList.remove('open');
        overlay.removeEventListener('keydown', onKeyDown, true);
        btnCancel.style.display = '';
        btnContinue.textContent = 'Continue';
        btnContinue.onclick = null;
        overlay.onclick = null;
      }

      btnContinue.onclick = () => {
        if (checkbox.checked && ScrapbookState?.doc?.settings?.youtubeExportInfo){
          ScrapbookState.doc.settings.youtubeExportInfo[exportType] = false;
          debounceScrapbookSave();
        }
        close(true);
        onContinue();
      };

      // Clicking backdrop also continues (info dialog, no cancel)
      overlay.onclick = (e) => {
        if (e.target === overlay){ btnContinue.onclick(); }
      };
    }

    $('sbBtnExportAllPng').onclick = async () => {
      showYoutubeExportInfo('png', () => {
        void runExportGuarded('doc-png-zip', async () => { await exportAllPagesPngZip(); });
      });
    };
    const exportAllSvgBtn = $('sbBtnExportAllSvg');
    if (exportAllSvgBtn) exportAllSvgBtn.onclick = async () => {
      void runExportGuarded('doc-svg-zip', async () => { await exportAllPagesSvgZip(); });
    };
    $('sbBtnExportPrint').onclick  = async () => {
      showYoutubeExportInfo('html', () => {
        void runExportGuarded('doc-html', async () => { await exportPrintHtmlScrapbook(); });
      });
    };
    $('sbBtnExportPdf').onclick    = async () => {
      showYoutubeExportInfo('pdf', () => {
        void runExportGuarded('doc-pdf', async () => { await exportDocumentPdf(); });
      });
    };
    $('sbBtnPresent').onclick = async () => { await openPresentation(ScrapbookState.doc.pages.findIndex(p => p.id === ScrapbookState.currentPageId)); };
    $('sbBtnSearch').onclick = () => { openScrapbookSearchWindow(); };
    $('sbPresentationFirst').onclick = async () => { await jumpPresentation(0); };
    $('sbPresentationPrev').onclick = async () => { await stepPresentation(-1); };
    $('sbPresentationNext').onclick = async () => { await stepPresentation(1); };
    $('sbPresentationLast').onclick = async () => { await jumpPresentation((ScrapbookState.doc.pages?.length || 1) - 1); };
    $('sbClosePresentation').onclick = () => { closePresentation(); };
    $('sbPresentationOverlay').addEventListener('click', (e) => { if (e.target === $('sbPresentationOverlay')) closePresentation(); });
    $('sbBtnNewPage').onclick = async () => { await addNewPage(); };
    $('sbBtnDupPage').onclick = async () => { await duplicateCurrentPage(); };
    $('sbBtnDeletePage').onclick = async () => { await deleteCurrentPage(); };
    $('sbBtnMovePageUp').onclick = async () => { const cur = getCurrentPage(); if (cur) await movePage(cur.id, -1); };
    $('sbBtnMovePageDown').onclick = async () => { const cur = getCurrentPage(); if (cur) await movePage(cur.id, 1); };
    $('sbBtnPrevPage').onclick = async () => { await stepPage(-1); };
    $('sbBtnNextPage').onclick = async () => { await stepPage(1); };
    const gotoInput = $('sbGotoPageInput');
    const gotoBtn = $('sbBtnGotoPage');
    if (gotoBtn) gotoBtn.onclick = async () => { await goToPageNumber(gotoInput ? gotoInput.value : 1); };
    if (gotoInput) gotoInput.addEventListener('keydown', async (e) => { if (e.key === 'Enter') { e.preventDefault(); await goToPageNumber(gotoInput.value); } });
    input.onchange = async () => {
      const file = input.files && input.files[0]; input.value = '';
      if (!file) return;
      // Check if the current document has meaningful content across any page
      const docHasContent = ScrapbookState && ScrapbookState.doc &&
        (ScrapbookState.doc.pages.length > 1 ||
         editorHasMeaningfulContent() ||
         (ScrapbookState.doc.pages[0] && ScrapbookState.doc.pages[0].payload &&
          ScrapbookState.doc.pages[0].payload.scene &&
          (ScrapbookState.doc.pages[0].payload.scene.elements || []).length > 0));
      if (docHasContent){
        const docTitle = ScrapbookState.doc.meta && ScrapbookState.doc.meta.title
          ? `"${ScrapbookState.doc.meta.title}"`
          : 'the current document';
        const pageCount = ScrapbookState.doc.pages.length;
        const confirmed = await confirmDialog(
          'Replace document?',
          `Importing will permanently replace ${docTitle} (${pageCount} page${pageCount !== 1 ? 's' : ''}). This cannot be undone.`,
          'Replace & import'
        );
        if (!confirmed) return;
      }
      try {
        clearExportGuard();
        await importDocumentJsonFromFile(file);
      }
      catch (err) { alert(err.message || String(err)); }
    };
  }
  if (langSel){
    langSel.addEventListener('change', () => {
      if (ScrapbookState?.doc?.meta){ ScrapbookState.doc.meta.language = String(langSel.value || 'en'); debounceScrapbookSave(); }
    });
  }
  window.addEventListener('keydown', async (ev) => {
    if ($('sbPresentationOverlay') && $('sbPresentationOverlay').style.display !== 'none' && $('sbPresentationOverlay').style.display !== ''){
      if (ev.key === 'Escape') { closePresentation(); return; }
      if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); await stepPresentation(-1); return; }
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); await stepPresentation(1); return; }
      if (ev.key === 'Home') { ev.preventDefault(); await jumpPresentation(0); return; }
      if (ev.key === 'End') { ev.preventDefault(); await jumpPresentation((ScrapbookState.doc.pages?.length || 1) - 1); return; }
    }
  });

  async function startScrapbookShell(){
    installScrapbookChrome();
    closePresentation();

    const savedDoc = await dbGet(SCRAPBOOK_DOC_DB_KEY).catch(() => null);

    if (savedDoc && savedDoc.pages && savedDoc.pages.length){
      const normalizedDoc = normalizeScrapbookDocument(savedDoc);
      ScrapbookState = { doc: normalizedDoc, currentPageId: normalizedDoc.currentPageId || normalizedDoc.pages[0].id, lastEditorHash: '' };
      bindScrapbookCartoucheDbDocumentToApp();
      const cur = getCurrentPage() || normalizedDoc.pages[0];
      closeTransientEditorsForPageSwitch();
      await loadPagePayloadIntoEditor(cur.payload, 'Load document');
      applyDocumentLanguage();
      ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
      ScrapbookState.lastEditorHash = sceneFingerprint();
      refreshScrapbookSearchResults(true);
    } else {
      const payload = snapshotCurrentPagePayload();
      ScrapbookState = { doc: createDocumentFromPayload(payload), currentPageId: null, lastEditorHash: '' };
      bindScrapbookCartoucheDbDocumentToApp();
      ScrapbookState.currentPageId = ScrapbookState.doc.currentPageId;
      const cur = getCurrentPage();
      clearScrapbookSearchState();
      applyDocumentLanguage();
      ScrapbookState.doc.assets = collectDocumentAssets(ScrapbookState.doc);
      ScrapbookState.lastEditorHash = sceneFingerprint();
      debounceScrapbookSave();
    }

    // ── PERF FIX: Reveal the UI shell immediately, before the expensive
    //    thumbnail canvas render.  The sidebar shows placeholder thumbs
    //    first, then updates once thumbnails are ready.
    renderScrapbookSidebar();
    historyReset('Load document shell');

    document.body.classList.add('shellReady');
    const veil = document.getElementById('loadingVeil');
    if (veil){
      veil.classList.add('ready');
      veil.addEventListener('transitionend', () => veil.remove(), { once: true });
    }

    // Generate missing thumbnails in the background after UI is visible
    (async () => {
      try {
        const pages = ScrapbookState?.doc?.pages;
        if (!pages) return;
        let updated = false;
        for (const page of pages) {
          if (!page.thumbnail) {
            // Briefly load each page's payload to render its thumb
            const savedPayload = snapshotCurrentPagePayload();
            await loadPagePayloadIntoEditor(page.payload, 'Thumb render', { silent: true });
            page.thumbnail = await renderCurrentPageDataUrl(160, 110, false, true);
            await loadPagePayloadIntoEditor(savedPayload, 'Thumb restore', { silent: true });
            updated = true;
          }
        }
        if (updated) renderScrapbookSidebar();
      } catch (e) {
        console.warn('[thumb-gen]', e);
      }
    })();

    if (scrapbookMonitorTimer) clearInterval(scrapbookMonitorTimer);
    scrapbookMonitorTimer = setInterval(async () => {
      if (!ScrapbookState) return;
      const current = sceneFingerprint();
      if (current !== ScrapbookState.lastEditorHash){
        ScrapbookState.lastEditorHash = current;
        await syncEditorIntoCurrentPage(true);
      }
    }, 1200);
  }

  init().then(() => startScrapbookShell());

  /* ============================================================
     How to extend
     ------------------------------------------------------------
     - Add new element types in ElementType, provide a constructor newXxxElement().
     - Add drawing logic in drawElement / drawElementToOffscreen.
     - Add properties in renderPropsPanel for your new type.
     - Add tool button and creation behavior in pointerdown creation section.
     ============================================================ */
})();
