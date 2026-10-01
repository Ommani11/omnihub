/* File Check — document map and tick list. Names and rules come only from data/documents.json. */

(function () {
  "use strict";

  var PREFIX = "filecheck:v1:";
  var IMPORTANCE = ["critical", "high", "medium", "low"];
  var SCOPE_TAGS = ["core", "finance", "insurance", "supplementaryInvoice", "supplementary-invoice"];
  var REL_TYPES = ["align", "co-required", "precedes", "alternative"];
  var SEVERITY = ["critical", "high", "medium", "low"];
  var SIZE = { critical: 34, high: 26, medium: 20, low: 15 };
  var NAVY = "#143665";
  var STEEL = "#4a7fb5";
  var INK = "#122033";
  var MUTED = "#5c6b7d";
  var OK = "#2f6b4f";
  var DONE = "#3ee08a";
  var PILL = {
    finance: "Finance",
    insurance: "Insurance",
    supplementaryInvoice: "Supplementary invoice"
  };

  var state = {
    data: null,
    scope: null,
    draft: {},
    layout: "constellation",
    selectedId: null,
    hoverId: null,
    view: "map",
    network: null,
    nodes: null,
    edges: null,
    edgeLook: {},
    scopeMode: "create",
    saveTimer: 0
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------- helpers -------------------------------- */

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;");
  }

  function dataUrl() {
    var path = window.location.pathname;
    var at = path.indexOf("/filecheck");
    var base = at === -1 ? "/filecheck/" : path.slice(0, at) + "/filecheck/";
    return base + "data/documents.json";
  }

  function byId(id) {
    if (!state.data) return null;
    for (var i = 0; i < state.data.documents.length; i++) {
      if (state.data.documents[i].id === id) return state.data.documents[i];
    }
    return null;
  }

  function isString(value) { return typeof value === "string"; }

  /* -------------------------------- validate -------------------------------- */

  function validateWhen(when, where, allowed, errors) {
    if (when == null) return;
    if (typeof when !== "object" || Array.isArray(when)) {
      errors.push(where + ".when is invalid.");
      return;
    }
    var keys = Object.keys(when);
    if (!keys.length) errors.push(where + ".when is empty.");
    keys.forEach(function (key) {
      var canon = canonicalScope(key);
      if (!allowed[canon] && !allowed[key]) errors.push(where + ".when." + key + " is not a scope question.");
      else if (typeof when[key] !== "boolean") errors.push(where + ".when." + key + " must be true or false.");
    });
  }

  function validate(data) {
    var errors = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return ["File is not a JSON object."];
    }
    if (!data.meta || typeof data.meta !== "object" || Array.isArray(data.meta)) {
      errors.push("meta is missing.");
    } else {
      if (!isString(data.meta.toolTitle) || !data.meta.toolTitle) errors.push("meta.toolTitle is missing.");
      if (!isString(data.meta.version) || !data.meta.version) errors.push("meta.version is missing.");
      if (!Array.isArray(data.meta.scopeQuestions) || data.meta.scopeQuestions.length === 0) {
        errors.push("meta.scopeQuestions is missing.");
      } else {
        var seenQ = {};
        data.meta.scopeQuestions.forEach(function (q, i) {
          var where = "scopeQuestions[" + i + "]";
          if (!q || typeof q !== "object") {
            errors.push(where + " is missing.");
            return;
          }
          if (!isString(q.id) || !q.id) errors.push(where + ".id is missing.");
          else if (seenQ[q.id]) errors.push(where + ".id is duplicated.");
          else seenQ[q.id] = true;
          if (!isString(q.label) || !q.label) errors.push(where + ".label is missing.");
        });
      }
    }
    if (!Array.isArray(data.documents)) {
      errors.push("documents is missing.");
      return errors;
    }
    var allowedWhen = { finance: true, insurance: true, supplementaryInvoice: true };
    if (data.meta && Array.isArray(data.meta.scopeQuestions)) {
      data.meta.scopeQuestions.forEach(function (q) {
        if (q && isString(q.id) && q.id) allowedWhen[canonicalScope(q.id)] = true;
      });
    }
    var seen = {};
    data.documents.forEach(function (doc, i) {
      var where = doc && isString(doc.id) && doc.id ? "document “" + doc.id + "”" : "documents[" + i + "]";
      if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
        errors.push(where + " is not an object.");
        return;
      }
      if (!isString(doc.id) || !doc.id) errors.push(where + ": id is missing.");
      else if (seen[doc.id]) errors.push(where + ": duplicate id.");
      else seen[doc.id] = true;
      if (!isString(doc.name) || !doc.name) errors.push(where + ": name is missing.");
      if (!isString(doc.shortName) || !doc.shortName) errors.push(where + ": shortName is missing.");
      if (IMPORTANCE.indexOf(doc.importance) === -1) errors.push(where + ": importance is missing or invalid.");
      if (!isString(doc.category)) errors.push(where + ": category is missing.");
      if (!Array.isArray(doc.scope)) errors.push(where + ": scope is missing.");
      else doc.scope.forEach(function (tag, j) {
        if (SCOPE_TAGS.indexOf(tag) === -1) errors.push(where + ": scope[" + j + "] is invalid.");
      });
      if (!Array.isArray(doc.rules)) errors.push(where + ": rules is missing.");
      else doc.rules.forEach(function (rule, j) {
        var ruleWhere = where + ": rules[" + j + "]";
        if (isString(rule)) return;
        if (!rule || typeof rule !== "object" || Array.isArray(rule) || !isString(rule.text) || !rule.text) {
          errors.push(ruleWhere + " is not text.");
          return;
        }
        validateWhen(rule.when, ruleWhere, allowedWhen, errors);
      });
      if (!Array.isArray(doc.checks)) errors.push(where + ": checks is missing.");
      else doc.checks.forEach(function (check, j) {
        var cwhere = where + ": checks[" + j + "]";
        if (!check || typeof check !== "object") {
          errors.push(cwhere + " is missing.");
          return;
        }
        if (!isString(check.id) || !check.id) errors.push(cwhere + ".id is missing.");
        if (!isString(check.text) || !check.text) errors.push(cwhere + ".text is missing.");
        if (typeof check.required !== "boolean") errors.push(cwhere + ".required is missing.");
        validateWhen(check.when, cwhere, allowedWhen, errors);
      });
      if (!Array.isArray(doc.crossReference)) errors.push(where + ": crossReference is missing.");
      else doc.crossReference.forEach(function (ref, j) {
        var rwhere = where + ": crossReference[" + j + "]";
        if (!ref || typeof ref !== "object") {
          errors.push(rwhere + " is missing.");
          return;
        }
        if (!isString(ref.documentId) || !ref.documentId) errors.push(rwhere + ".documentId is missing.");
        if (!isString(ref.what)) errors.push(rwhere + ".what is missing.");
        if (!isString(ref.where)) errors.push(rwhere + ".where is missing.");
        validateWhen(ref.when, rwhere, allowedWhen, errors);
      });
      if (!Array.isArray(doc.relationships)) errors.push(where + ": relationships is missing.");
      else doc.relationships.forEach(function (rel, j) {
        var lwhere = where + ": relationships[" + j + "]";
        if (!rel || typeof rel !== "object") {
          errors.push(lwhere + " is missing.");
          return;
        }
        if (!isString(rel.targetId) || !rel.targetId) errors.push(lwhere + ".targetId is missing.");
        if (REL_TYPES.indexOf(rel.type) === -1) errors.push(lwhere + ".type is missing or invalid.");
        if (!isString(rel.note)) errors.push(lwhere + ".note is missing.");
        validateWhen(rel.when, lwhere, allowedWhen, errors);
      });
      if (!isString(doc.bestPractice)) errors.push(where + ": bestPractice is missing.");
      if (!Array.isArray(doc.commonErrors)) errors.push(where + ": commonErrors is missing.");
      else doc.commonErrors.forEach(function (item, j) {
        var ewhere = where + ": commonErrors[" + j + "]";
        if (isString(item)) return;
        if (!item || typeof item !== "object" || Array.isArray(item) || !isString(item.text)) {
          errors.push(ewhere + " is not text.");
          return;
        }
        validateWhen(item.when, ewhere, allowedWhen, errors);
      });
    });
    if (data.reconciliations != null) {
      if (!Array.isArray(data.reconciliations)) {
        errors.push("reconciliations is not a list.");
      } else {
        data.reconciliations.forEach(function (item, i) {
          var rwhere = "reconciliations[" + i + "]";
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            errors.push(rwhere + " is missing.");
            return;
          }
          if (!isString(item.from) || !item.from) errors.push(rwhere + ".from is missing.");
          else if (!seen[item.from]) errors.push(rwhere + ".from is not a document.");
          if (!isString(item.to) || !item.to) errors.push(rwhere + ".to is missing.");
          else if (!seen[item.to]) errors.push(rwhere + ".to is not a document.");
          if (!isString(item.check) || !item.check) errors.push(rwhere + ".check is missing.");
          if (SEVERITY.indexOf(item.severity) === -1) errors.push(rwhere + ".severity is missing or invalid.");
          validateWhen(item.when, rwhere, allowedWhen, errors);
        });
      }
    }
    return errors;
  }

  /* -------------------------------- storage -------------------------------- */

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function tickKey(docId, checkId) { return PREFIX + docId + ":" + checkId; }

  function isTicked(docId, checkId) { return storageGet(tickKey(docId, checkId)) === "1"; }

  function loadScope() {
    var raw = storageGet(PREFIX + "_scope");
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function scopeReady(scope) {
    if (!scope || !state.data) return false;
    return state.data.meta.scopeQuestions.every(function (q) {
      return typeof scope[q.id] === "boolean";
    });
  }

  function clearFileKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) keys.push(key);
      }
    } catch (err) {
      return false;
    }
    var ok = true;
    keys.forEach(function (key) { if (!storageSet(key, null)) ok = false; });
    return ok;
  }

  function showSaved(ok) {
    var note = $("saved-note");
    note.textContent = ok ? "Saved on this device" : "Could not save on this device.";
  }

  /* -------------------------------- scope + progress -------------------------------- */

  function canonicalScope(tag) {
    if (tag === "supplementary-invoice") return "supplementaryInvoice";
    return tag;
  }

  function scopeLabel(tag) {
    var key = canonicalScope(tag);
    if (key === "core") return "Core";
    if (PILL[key]) return PILL[key];
    return tag;
  }

  function scopeOn(tag) {
    if (!state.scope) return false;
    var key = canonicalScope(tag);
    return state.scope[key] === true || state.scope[tag] === true;
  }

  function appliesNow(when) {
    if (when == null) return true;
    if (!state.scope) return false;
    var keys = Object.keys(when);
    for (var i = 0; i < keys.length; i++) {
      var raw = keys[i];
      var key = canonicalScope(raw);
      var actual = state.scope[key];
      if (typeof actual !== "boolean") actual = state.scope[raw];
      if (actual !== when[raw]) return false;
    }
    return true;
  }

  function entryText(item) {
    if (isString(item)) return item;
    if (item && isString(item.text)) return item.text;
    return "";
  }

  function entryWhen(item) {
    if (!item || isString(item)) return null;
    return item.when;
  }

  function activeChecks(doc) {
    return (doc.checks || []).filter(function (check) { return appliesNow(check.when); });
  }

  function isVisible(doc) {
    if (!state.scope) return false;
    var tags = doc.scope || [];
    if (tags.indexOf("core") !== -1) return true;
    return tags.some(scopeOn);
  }

  function visibleDocuments() {
    if (!state.data) return [];
    return state.data.documents.filter(isVisible);
  }

  function docProgress(doc) {
    var checks = activeChecks(doc);
    var required = checks.filter(function (check) { return check.required; });
    var done = required.filter(function (check) { return isTicked(doc.id, check.id); }).length;
    var any = checks.some(function (check) { return isTicked(doc.id, check.id); });
    var status = "untouched";
    if (required.length === 0 || done === required.length) status = "complete";
    else if (done > 0 || any) status = "progress";
    return { required: required.length, done: done, status: status };
  }

  function fileProgress() {
    var docs = visibleDocuments();
    var required = 0;
    var done = 0;
    docs.forEach(function (doc) {
      var progress = docProgress(doc);
      required += progress.required;
      done += progress.done;
    });
    return { docs: docs.length, required: required, done: done, complete: docs.length > 0 && done === required };
  }

  function renderProgress() {
    var el = $("progress-text");
    if (!state.data) return;
    if (!state.scope) {
      el.textContent = "Choose what is in this file to see the map.";
      el.classList.remove("done");
      return;
    }
    if (state.data.documents.length === 0) {
      el.textContent = "Document list not loaded. Add entries to data/documents.json.";
      el.classList.remove("done");
      return;
    }
    var progress = fileProgress();
    if (progress.docs === 0) {
      el.textContent = "No documents for this file type.";
      el.classList.remove("done");
      return;
    }
    if (progress.complete) {
      el.textContent = "Required checks complete for this file type.";
      el.classList.add("done");
      return;
    }
    el.textContent = progress.done + " of " + progress.required + " required checks";
    el.classList.remove("done");
  }

  function renderPills() {
    var host = $("scope-pills");
    if (!state.data || !scopeReady(state.scope)) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = state.data.meta.scopeQuestions.map(function (q) {
      var yes = state.scope[q.id] === true;
      var label = PILL[q.id] || q.label;
      return '<span class="pill ' + (yes ? "yes" : "no") + '">' + esc(label) + " · " + (yes ? "Yes" : "No") + "</span>";
    }).join("");
  }

  /* -------------------------------- document body -------------------------------- */

  function targetName(id) {
    var doc = byId(id);
    return doc ? doc.shortName + " — " + doc.name : id;
  }

  function checksHtml(doc) {
    var checks = activeChecks(doc);
    if (!checks.length) {
      return "<p>" + (doc.checks.length ? "No checks for this file type." : "No checks on this document.") + "</p>";
    }
    return '<div class="checks">' + checks.map(function (check) {
      var on = isTicked(doc.id, check.id);
      return '<button type="button" class="check" role="checkbox" aria-checked="' + (on ? "true" : "false") +
        '" data-check="' + esc(check.id) + '" data-doc="' + esc(doc.id) + '">' +
        '<span class="box" aria-hidden="true"></span>' +
        "<span>" + esc(check.text) + "</span>" +
        (check.required ? '<span class="req">Required</span>' : "") +
        "</button>";
    }).join("") + "</div>";
  }

  function crossHtml(doc) {
    var refs = doc.crossReference.filter(function (ref) { return appliesNow(ref.when); });
    if (!refs.length) return "";
    var rows = refs.map(function (ref) {
      var target = byId(ref.documentId);
      var visible = target && isVisible(target);
      var label = target ? target.name : ref.documentId;
      var note = esc(ref.what) + (ref.where ? " — " + esc(ref.where) : "");
      if (!target) {
        return '<button type="button" class="xref" disabled>Not in the document list<span>' + note + "</span></button>";
      }
      if (!visible) {
        return '<button type="button" class="xref" disabled>' + esc(label) +
          "<span>Not in this file type. " + note + "</span></button>";
      }
      return '<button type="button" class="xref" data-goto="' + esc(ref.documentId) + '">' +
        esc(label) + "<span>" + note + "</span></button>";
    }).join("");
    return '<section class="section"><h3>Cross-reference</h3>' + rows + "</section>";
  }

  function reconcileHtml(doc) {
    var list = (state.data && state.data.reconciliations) || [];
    var items = list.filter(function (item) {
      return appliesNow(item.when) && (item.from === doc.id || item.to === doc.id);
    });
    if (!items.length) return "";
    var rows = items.map(function (item) {
      var otherId = item.from === doc.id ? item.to : item.from;
      var other = byId(otherId);
      var visible = other && isVisible(other);
      var title = esc(targetName(otherId));
      var open = visible
        ? '<button type="button" class="linkish" data-goto="' + esc(otherId) + '">Open ' + title + "</button>"
        : "<p>" + title + (other ? " — not in this file type" : " — not in the document list") + "</p>";
      return '<div class="rel"><span class="chip ' + esc(item.severity) + '">' + esc(item.severity) + "</span>" +
        "<strong>" + esc(item.check) + "</strong>" + open + "</div>";
    }).join("");
    return '<section class="section"><h3>Reconciliations</h3>' + rows + "</section>";
  }

  function relationsHtml(doc) {
    var rels = doc.relationships.filter(function (rel) { return appliesNow(rel.when); });
    if (!rels.length) return "";
    var rows = rels.map(function (rel) {
      var target = byId(rel.targetId);
      var visible = target && isVisible(target);
      var title = esc(targetName(rel.targetId));
      var note = rel.note ? "<p>" + esc(rel.note) + "</p>" : "";
      var open = visible
        ? '<button type="button" class="linkish" data-goto="' + esc(rel.targetId) + '">Open ' + title + "</button>"
        : "<p>" + title + (target ? " — not in this file type" : " — not in the document list") + "</p>";
      return '<div class="rel"><div class="rel-type">' + esc(rel.type) + "</div>" + open + note + "</div>";
    }).join("");
    return '<section class="section"><h3>Relationships</h3>' + rows + "</section>";
  }

  function guidanceHtml(doc) {
    var html = "";
    if (doc.bestPractice.trim()) {
      html += '<section class="section"><h3>Best practice</h3><div class="guidance">' + esc(doc.bestPractice) + "</div></section>";
    }
    var errors = doc.commonErrors.filter(function (item) {
      return appliesNow(entryWhen(item)) && entryText(item).trim();
    });
    if (errors.length) {
      html += '<section class="section"><h3>Common errors</h3><ul class="errors">' +
        errors.map(function (item) { return "<li>" + esc(entryText(item)) + "</li>"; }).join("") +
        "</ul></section>";
    }
    return html;
  }

  function documentBodyHtml(doc) {
    var progress = docProgress(doc);
    var ruleItems = doc.rules.filter(function (rule) {
      return appliesNow(entryWhen(rule)) && entryText(rule).trim();
    });
    var rules = ruleItems.length
      ? '<section class="section"><h3>Rules</h3><ul class="rules">' +
        ruleItems.map(function (rule) { return "<li>" + esc(entryText(rule)) + "</li>"; }).join("") +
        "</ul></section>"
      : "";
    var tags = (doc.scope || []).map(function (tag) {
      return '<span class="chip">' + esc(scopeLabel(tag)) + "</span>";
    }).join("");
    var category = doc.category ? '<span class="chip">' + esc(doc.category) + "</span>" : "";
    return '<p class="kicker">' + esc(doc.shortName) + "</p>" +
      "<h2>" + esc(doc.name) + "</h2>" +
      '<div class="meta-row">' +
      '<span class="chip ' + esc(doc.importance) + '">' + esc(doc.importance) + "</span>" +
      category +
      tags +
      '<span class="chip">' + progress.done + "/" + progress.required + " required</span>" +
      "</div>" +
      '<section class="section"><h3>Checks</h3>' + checksHtml(doc) + "</section>" +
      rules +
      reconcileHtml(doc) +
      crossHtml(doc) +
      relationsHtml(doc) +
      guidanceHtml(doc);
  }

  /* -------------------------------- drawer + checklist -------------------------------- */

  function renderDrawer() {
    var drawer = $("drawer");
    var doc = state.selectedId ? byId(state.selectedId) : null;
    if (!doc || !isVisible(doc) || state.view !== "map") {
      drawer.hidden = true;
      drawer.innerHTML = "";
      return;
    }
    drawer.hidden = false;
    drawer.innerHTML =
      '<div class="drawer-top"><div>' + documentBodyHtml(doc) + "</div></div>" +
      '<div class="drawer-actions">' +
      '<button type="button" class="btn navy" data-action="open-checklist">Open full checklist</button>' +
      '<button type="button" class="btn ghost-ink" data-action="close-drawer">Close</button>' +
      "</div>";
    var title = drawer.querySelector("h2");
    if (title) title.id = "drawer-title";
    drawer.setAttribute("aria-labelledby", "drawer-title");
  }

  function renderChecklist() {
    var docs = visibleDocuments();
    var nav = $("doc-nav");
    var main = $("check-main");
    if (!state.data || state.data.documents.length === 0) {
      nav.innerHTML = "";
      main.innerHTML = "<p>Document list not loaded. Add entries to data/documents.json.</p>";
      return;
    }
    if (!docs.length) {
      nav.innerHTML = "";
      main.innerHTML = "<p>No documents for this file type.</p>";
      return;
    }
    if (!state.selectedId || !docs.some(function (doc) { return doc.id === state.selectedId; })) {
      state.selectedId = docs[0].id;
    }
    nav.innerHTML = docs.map(function (doc) {
      var progress = docProgress(doc);
      var pct = progress.required === 0 ? 100 : Math.round((progress.done / progress.required) * 100);
      return '<button type="button" class="doc-jump ' + (progress.status === "complete" ? "complete" : "") +
        '" data-goto="' + esc(doc.id) + '" aria-current="' + (doc.id === state.selectedId ? "true" : "false") + '">' +
        '<span class="sn">' + esc(doc.shortName) + "</span>" +
        '<span class="nm">' + esc(doc.name) + "</span>" +
        '<span class="mini">' + progress.done + " of " + progress.required + " required</span>" +
        '<span class="mini-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>' +
        "</button>";
    }).join("");
    var doc = byId(state.selectedId);
    main.innerHTML = '<div class="panel-top"><div>' + documentBodyHtml(doc) + "</div></div>";
  }

  function showMap() {
    state.view = "map";
    $("shell").classList.remove("with-checklist");
    $("view-checklist").hidden = true;
    $("view-map").hidden = false;
    renderDrawer();
    if (state.network) {
      window.requestAnimationFrame(function () {
        state.network.redraw();
        if (state.selectedId) {
          state.network.selectNodes([state.selectedId]);
          applyFade(state.selectedId);
        }
        frameSelection(state.selectedId);
      });
    }
  }

  function showChecklist() {
    state.view = "checklist";
    $("shell").classList.add("with-checklist");
    $("view-map").hidden = !wideLayout();
    $("drawer").hidden = true;
    $("view-checklist").hidden = false;
    renderChecklist();
    var back = $("back-to-map");
    if (back) back.focus();
    if (state.network && wideLayout()) {
      window.requestAnimationFrame(function () {
        state.network.redraw();
        frameSelection(state.selectedId);
      });
    }
  }

  /* -------------------------------- graph -------------------------------- */

  function rgba(hex, alpha) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function highlightId() { return state.selectedId || state.hoverId || null; }

  function neighbourSet(id) {
    var keep = {};
    keep[id] = true;
    if (!state.edges) return keep;
    state.edges.get().forEach(function (edge) {
      if (edge.from === id) keep[edge.to] = true;
      if (edge.to === id) keep[edge.from] = true;
    });
    return keep;
  }

  function isDimmed(id) {
    var focus = highlightId();
    if (!focus) return false;
    return !neighbourSet(focus)[id];
  }

  function nodeOptions(doc, dim) {
    var progress = docProgress(doc);
    var border = progress.status === "complete" ? DONE : progress.status === "progress" ? STEEL : MUTED;
    var fill = doc.importance === "medium" || doc.importance === "low" ? STEEL : NAVY;
    var width = progress.status === "complete" ? 8 : progress.status === "untouched" ? 2 : 4;
    return {
      borderWidth: dim ? 2 : width,
      color: {
        background: dim ? rgba(fill, 0.16) : fill,
        border: dim ? rgba(border, progress.status === "complete" ? 0.85 : 0.28) : border,
        highlight: { background: fill, border: border },
        hover: { background: fill, border: border }
      },
      font: {
        color: dim ? rgba(INK, 0.28) : INK,
        size: 13,
        face: "Source Sans 3"
      },
      size: SIZE[doc.importance] || 20
    };
  }

  function makeNode(doc, pos) {
    var visual = nodeOptions(doc, false);
    var node = {
      id: doc.id,
      label: doc.shortName,
      title: doc.name + " — " + doc.importance,
      shape: "dot",
      size: visual.size,
      borderWidth: visual.borderWidth,
      color: visual.color,
      font: visual.font,
      margin: 10
    };
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
      node.physics = false;
    }
    return node;
  }

  function edgeVisual(types) {
    var allAlt = types.every(function (type) { return type === "alternative"; });
    var co = types.indexOf("co-required") !== -1;
    var precedes = types.indexOf("precedes") !== -1;
    return {
      dashes: allAlt,
      color: co || precedes ? NAVY : STEEL,
      width: co ? 2.6 : 1.6
    };
  }

  function buildEdges(docs) {
    var visible = {};
    docs.forEach(function (doc) { visible[doc.id] = true; });
    var groups = {};
    docs.forEach(function (doc) {
      doc.relationships.forEach(function (rel) {
        if (!appliesNow(rel.when) || !visible[rel.targetId] || rel.targetId === doc.id) return;
        var a = doc.id < rel.targetId ? doc.id : rel.targetId;
        var b = doc.id < rel.targetId ? rel.targetId : doc.id;
        var key = a + "|" + b;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ from: doc.id, to: rel.targetId, type: rel.type, note: rel.note });
      });
    });
    return Object.keys(groups).map(function (key) {
      var rels = groups[key];
      var precedes = rels.filter(function (rel) { return rel.type === "precedes"; });
      var from = key.split("|")[0];
      var to = key.split("|")[1];
      var arrows = { to: { enabled: false } };
      if (precedes.length) {
        var forward = precedes.filter(function (rel) { return rel.from + "->" + rel.to === precedes[0].from + "->" + precedes[0].to; });
        from = precedes[0].from;
        to = precedes[0].to;
        arrows = forward.length === precedes.length
          ? { to: { enabled: true, scaleFactor: 0.7 } }
          : { to: { enabled: true, scaleFactor: 0.7 }, from: { enabled: true, scaleFactor: 0.7 } };
      }
      var types = [];
      rels.forEach(function (rel) { if (types.indexOf(rel.type) === -1) types.push(rel.type); });
      var look = edgeVisual(types);
      var title = rels.map(function (rel) {
        return rel.type + (rel.note ? " — " + rel.note : "");
      }).join("\n");
      var pair = key.split("|");
      var recs = ((state.data && state.data.reconciliations) || []).filter(function (item) {
        return appliesNow(item.when) && ((item.from === pair[0] && item.to === pair[1]) || (item.from === pair[1] && item.to === pair[0]));
      });
      if (recs.length) {
        title += "\n" + recs.map(function (item) {
          return item.severity + " reconcile — " + item.check;
        }).join("\n");
        if (recs.some(function (item) { return item.severity === "critical"; })) {
          look.color = NAVY;
          look.width = Math.max(look.width, 3.2);
        }
      }
      return {
        id: key,
        from: from,
        to: to,
        dashes: look.dashes,
        width: look.width,
        arrows: arrows,
        color: { color: look.color, highlight: look.color, opacity: 0.95 },
        title: title,
        baseColor: look.color,
        baseDashes: look.dashes,
        baseWidth: look.width
      };
    });
  }

  function placeOnArc(list, radius, start, end) {
    var pos = {};
    var n = list.length;
    for (var i = 0; i < n; i++) {
      var t = start + ((i + 0.5) / n) * (end - start);
      pos[list[i].id] = { x: Math.cos(t) * radius, y: Math.sin(t) * radius };
    }
    return pos;
  }

  function placeOnCircle(list, radius) {
    var pos = {};
    var n = list.length;
    for (var i = 0; i < n; i++) {
      var t = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pos[list[i].id] = { x: Math.cos(t) * radius, y: Math.sin(t) * radius };
    }
    return pos;
  }

  function ringPositions(docs) {
    var core = [];
    var buckets = { finance: [], insurance: [], supplementaryInvoice: [] };
    var multi = [];
    var sorted = docs.slice().sort(function (a, b) { return a.shortName.localeCompare(b.shortName); });
    sorted.forEach(function (doc) {
      var tags = (doc.scope || []).map(canonicalScope).filter(function (tag) { return tag !== "core"; });
      if ((doc.scope || []).indexOf("core") !== -1 || !tags.length) core.push(doc);
      else if (tags.length === 1 && buckets[tags[0]]) buckets[tags[0]].push(doc);
      else multi.push(doc);
    });
    var pos = {};
    var width = (Math.PI * 2) / 3 * 0.78;
    var centers = {
      finance: -Math.PI / 2,
      insurance: -Math.PI / 2 + (2 * Math.PI) / 3,
      supplementaryInvoice: -Math.PI / 2 + (4 * Math.PI) / 3
    };
    Object.assign(pos, placeOnCircle(core, 150));
    Object.keys(buckets).forEach(function (key) {
      var center = centers[key];
      Object.assign(pos, placeOnArc(buckets[key], 330, center - width / 2, center + width / 2));
    });
    multi.forEach(function (doc, index) {
      var tags = doc.scope.map(canonicalScope).filter(function (tag) { return tag !== "core" && centers[tag] != null; });
      var x = 0;
      var y = 0;
      tags.forEach(function (tag) {
        x += Math.cos(centers[tag]);
        y += Math.sin(centers[tag]);
      });
      var angle = tags.length ? Math.atan2(y, x) : index;
      var radius = 470 + (index % 2) * 36;
      pos[doc.id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    return pos;
  }

  function graphOptions(mode) {
    var physicsOn = mode === "constellation";
    return {
      autoResize: true,
      interaction: { hover: true, tooltipDelay: 80, multiselect: false, navigationButtons: false },
      physics: physicsOn ? {
        enabled: true,
        solver: "barnesHut",
        barnesHut: {
          gravitationalConstant: -9000,
          centralGravity: 0.28,
          springLength: 170,
          springConstant: 0.045,
          damping: 0.5,
          avoidOverlap: 0.85
        },
        stabilization: { enabled: true, iterations: 180, updateInterval: 25, fit: true }
      } : { enabled: false },
      layout: { improvedLayout: mode !== "rings", randomSeed: 7 },
      nodes: { shape: "dot", chosen: true },
      edges: { smooth: { type: "continuous", roundness: 0.35 } }
    };
  }

  function applyFade(focus) {
    if (!state.nodes || !state.edges) return;
    var keep = focus ? neighbourSet(focus) : null;
    state.nodes.get().forEach(function (node) {
      var doc = byId(node.id);
      if (!doc) return;
      var dim = !!(keep && !keep[node.id]);
      var visual = nodeOptions(doc, dim);
      state.nodes.update({
        id: node.id,
        borderWidth: visual.borderWidth,
        color: visual.color,
        font: visual.font
      });
    });
    state.edges.get().forEach(function (edge) {
      var look = state.edgeLook[edge.id] || { color: STEEL, dashes: false, width: 1.6 };
      var linked = !focus || ((edge.from === focus || edge.to === focus) && keep[edge.from] && keep[edge.to]);
      var color = look.color;
      state.edges.update({
        id: edge.id,
        dashes: look.dashes,
        width: linked ? look.width : 1,
        color: {
          color: linked ? color : rgba(color, 0.12),
          highlight: color,
          opacity: linked ? 0.95 : 0.12
        }
      });
    });
  }

  function refreshNode(id) {
    if (!state.nodes) return;
    var doc = byId(id);
    if (!doc) return;
    var visual = nodeOptions(doc, isDimmed(id));
    state.nodes.update({
      id: id,
      borderWidth: visual.borderWidth,
      color: visual.color,
      font: visual.font,
      size: visual.size
    });
  }

  function wideLayout() {
    return window.matchMedia("(min-width: 1280px)").matches;
  }

  function viewFrame() {
    var el = $("network");
    var rect = el.getBoundingClientRect();
    var left = Math.max(rect.left, 0);
    var top = Math.max(rect.top, 0);
    var right = Math.min(rect.right, window.innerWidth);
    var bottom = Math.min(rect.bottom, window.innerHeight);
    var legend = document.querySelector(".legend");
    if (legend) {
      var legendRect = legend.getBoundingClientRect();
      if (legendRect.height && legendRect.top < bottom) bottom = Math.min(bottom, legendRect.top - 8);
    }
    if (bottom < top + 120) bottom = Math.min(rect.bottom, window.innerHeight);
    var width = Math.max(160, right - left);
    var height = Math.max(160, bottom - top);
    return {
      width: width,
      height: height,
      offset: {
        x: (left + width / 2) - (rect.left + rect.width / 2),
        y: (top + height / 2) - (rect.top + rect.height / 2)
      }
    };
  }

  function clusterBounds(ids) {
    var positions = state.network.getPositions(ids);
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var count = 0;
    ids.forEach(function (id) {
      var pos = positions[id];
      if (!pos) return;
      var doc = byId(id);
      var margin = (SIZE[doc && doc.importance] || 20) + 28;
      minX = Math.min(minX, pos.x - margin);
      maxX = Math.max(maxX, pos.x + margin);
      minY = Math.min(minY, pos.y - margin);
      maxY = Math.max(maxY, pos.y + margin);
      count += 1;
    });
    if (!count) return null;
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  }

  function frameSelection(id) {
    if (!state.network || state.framing || !state.nodes) return;
    var ids = id && state.nodes.get(id) ? Object.keys(neighbourSet(id)) : state.nodes.getIds();
    if (!ids.length) return;
    var box = clusterBounds(ids);
    if (!box) return;
    var view = viewFrame();
    var spanX = Math.max(48, box.maxX - box.minX);
    var spanY = Math.max(48, box.maxY - box.minY);
    var scale = Math.min((view.width - 48) / spanX, (view.height - 48) / spanY);
    if (scale > 1.2) scale = 1.2;
    if (!(scale > 0)) scale = 0.2;
    state.framing = true;
    state.network.moveTo({
      position: { x: box.x, y: box.y },
      scale: scale,
      offset: view.offset,
      animation: reduceMotion ? false : { duration: 280, easingFunction: "easeInOutQuad" }
    });
    window.setTimeout(function () { state.framing = false; }, 360);
  }

  function fitGraph() {
    frameSelection(state.selectedId);
  }

  function freezePhysics() {
    if (!state.network) return;
    state.network.setOptions({ physics: false });
  }

  function showMapMessage(text) {
    var el = $("map-message");
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  function mountGraph() {
    var host = $("network");
    if (state.network) {
      state.network.destroy();
      state.network = null;
      state.nodes = null;
      state.edges = null;
    }
    host.innerHTML = "";
    var docs = visibleDocuments();
    if (!docs.length) {
      if (!state.data || state.data.documents.length === 0) {
        showMapMessage("Document list not loaded. Add entries to data/documents.json.");
      } else {
        showMapMessage("No documents for this file type.");
      }
      return;
    }
    showMapMessage("");
    if (!window.vis || !window.vis.Network || !window.vis.DataSet) {
      showMapMessage("The document map could not load.");
      return;
    }
    var positions = state.layout === "rings" ? ringPositions(docs) : null;
    var nodeData = docs.map(function (doc) { return makeNode(doc, positions ? positions[doc.id] : null); });
    var edgeItems = buildEdges(docs);
    state.edgeLook = {};
    edgeItems.forEach(function (edge) {
      state.edgeLook[edge.id] = { color: edge.baseColor, dashes: edge.baseDashes, width: edge.baseWidth };
    });
    state.nodes = new window.vis.DataSet(nodeData);
    state.edges = new window.vis.DataSet(edgeItems);
    state.network = new window.vis.Network(host, { nodes: state.nodes, edges: state.edges }, graphOptions(state.layout));
    var settled = false;
    function settle() {
      if (settled || !state.network) return;
      settled = true;
      freezePhysics();
      fitGraph();
    }
    state.network.on("click", function (params) {
      var id = params.nodes && params.nodes[0];
      if (!id) return;
      state.hoverId = null;
      state.selectedId = id;
      applyFade(id);
      if (state.view === "checklist") {
        renderChecklist();
        window.requestAnimationFrame(function () { frameSelection(id); });
        return;
      }
      state.view = "map";
      renderDrawer();
      window.requestAnimationFrame(function () { frameSelection(id); });
    });
    state.network.on("hoverNode", function (params) {
      if (state.selectedId) return;
      state.hoverId = params.node;
      applyFade(params.node);
    });
    state.network.on("blurNode", function () {
      if (state.selectedId) return;
      state.hoverId = null;
      applyFade(null);
    });
    state.network.on("dragEnd", function () { freezePhysics(); });
    state.network.on("resize", function () {
      if (state.view !== "map" || !state.selectedId) return;
      window.requestAnimationFrame(function () { frameSelection(state.selectedId); });
    });
    if (state.layout === "constellation") {
      state.network.once("stabilizationIterationsDone", settle);
      window.setTimeout(settle, 1200);
    } else {
      settle();
    }
    if (state.selectedId && docs.some(function (doc) { return doc.id === state.selectedId; })) {
      state.network.selectNodes([state.selectedId]);
      applyFade(state.selectedId);
    } else if (state.selectedId) {
      state.selectedId = null;
      renderDrawer();
    }
  }

  function setLayout(mode) {
    state.layout = mode;
    $("layout-constellation").setAttribute("aria-pressed", mode === "constellation" ? "true" : "false");
    $("layout-rings").setAttribute("aria-pressed", mode === "rings" ? "true" : "false");
    if (state.view === "map" && scopeReady(state.scope)) mountGraph();
  }

  /* -------------------------------- modals -------------------------------- */

  function setInert(on) {
    var shell = $("shell");
    if (on) shell.setAttribute("inert", "");
    else shell.removeAttribute("inert");
  }

  function renderScopeForm() {
    var host = $("scope-questions");
    var questions = state.data.meta.scopeQuestions;
    host.innerHTML = questions.map(function (q) {
      var value = state.draft[q.id];
      return "<fieldset><legend>" + esc(q.label) + "</legend>" +
        '<div class="yn">' +
        '<button type="button" data-scope-id="' + esc(q.id) + '" data-scope-value="yes" aria-pressed="' + (value === true) + '">Yes</button>' +
        '<button type="button" data-scope-id="' + esc(q.id) + '" data-scope-value="no" aria-pressed="' + (value === false) + '">No</button>' +
        "</div></fieldset>";
    }).join("");
    var ready = questions.every(function (q) { return typeof state.draft[q.id] === "boolean"; });
    $("scope-continue").disabled = !ready;
    $("modal-empty").hidden = state.data.documents.length !== 0;
    $("scope-cancel").hidden = state.scopeMode !== "edit";
  }

  function openScope(mode) {
    state.scopeMode = mode;
    state.draft = {};
    if (mode === "edit" && state.scope) {
      state.data.meta.scopeQuestions.forEach(function (q) {
        if (typeof state.scope[q.id] === "boolean") state.draft[q.id] = state.scope[q.id];
      });
    }
    renderScopeForm();
    $("reset-modal").hidden = true;
    $("scope-modal").hidden = false;
    setInert(true);
    var first = $("scope-questions").querySelector("button");
    if (first) first.focus();
  }

  function closeScope() {
    $("scope-modal").hidden = true;
    if ($("reset-modal").hidden) setInert(false);
  }

  function openReset() {
    $("reset-modal").hidden = false;
    setInert(true);
    $("reset-cancel").focus();
  }

  function closeReset() {
    $("reset-modal").hidden = true;
    if ($("scope-modal").hidden) setInert(false);
  }

  function commitScope() {
    var questions = state.data.meta.scopeQuestions;
    if (!questions.every(function (q) { return typeof state.draft[q.id] === "boolean"; })) return;
    var scope = {};
    questions.forEach(function (q) { scope[q.id] = state.draft[q.id]; });
    var ok = storageSet(PREFIX + "_scope", JSON.stringify(scope));
    state.scope = scope;
    closeScope();
    renderPills();
    renderProgress();
    if (state.view === "checklist") renderChecklist();
    else renderDrawer();
    mountGraph();
    if (!ok) showSaved(false);
  }

  function startNextFile() {
    var ok = clearFileKeys();
    state.scope = null;
    state.selectedId = null;
    state.hoverId = null;
    state.view = "map";
    $("shell").classList.remove("with-checklist");
    $("view-checklist").hidden = true;
    $("view-map").hidden = false;
    $("drawer").hidden = true;
    $("saved-note").textContent = "";
    closeReset();
    renderPills();
    renderProgress();
    if (state.network) {
      state.network.destroy();
      state.network = null;
      state.nodes = null;
      state.edges = null;
    }
    openScope("create");
    if (!ok) showSaved(false);
  }

  /* -------------------------------- ticks -------------------------------- */

  function toggleCheck(docId, checkId) {
    var doc = byId(docId);
    if (!doc) return;
    var check = null;
    for (var i = 0; i < doc.checks.length; i++) {
      if (doc.checks[i].id === checkId) check = doc.checks[i];
    }
    if (!check || !appliesNow(check.when)) return;
    var next = !isTicked(docId, checkId);
    var ok = storageSet(tickKey(docId, checkId), next ? "1" : null);
    if (ok) ok = storageSet(PREFIX + "_touched", "1");
    showSaved(ok);
    refreshNode(docId);
    renderProgress();
    if (state.view === "checklist") renderChecklist();
    else renderDrawer();
    var again = document.querySelector(
      '[data-doc="' + (window.CSS && CSS.escape ? CSS.escape(docId) : docId) + '"][data-check="' +
      (window.CSS && CSS.escape ? CSS.escape(checkId) : checkId) + '"]'
    );
    if (again) again.focus();
  }

  function openDocument(id) {
    var doc = byId(id);
    if (!doc || !isVisible(doc)) return;
    state.selectedId = id;
    state.hoverId = null;
    if (state.view === "checklist") {
      renderChecklist();
      var article = $("check-main");
      if (article) article.scrollIntoView({ block: "nearest" });
      return;
    }
    applyFade(id);
    renderDrawer();
    if (state.network) {
      state.network.selectNodes([id]);
      frameSelection(id);
    }
  }

  /* -------------------------------- events -------------------------------- */

  function onClick(event) {
    var scopeBtn = event.target.closest("[data-scope-id]");
    if (scopeBtn) {
      state.draft[scopeBtn.getAttribute("data-scope-id")] = scopeBtn.getAttribute("data-scope-value") === "yes";
      renderScopeForm();
      var again = $("scope-questions").querySelector(
        '[data-scope-id="' + scopeBtn.getAttribute("data-scope-id") + '"][data-scope-value="' + scopeBtn.getAttribute("data-scope-value") + '"]'
      );
      if (again) again.focus();
      return;
    }
    var check = event.target.closest("[data-check]");
    if (check) {
      toggleCheck(check.getAttribute("data-doc"), check.getAttribute("data-check"));
      return;
    }
    var go = event.target.closest("[data-goto]");
    if (go && !go.disabled) {
      openDocument(go.getAttribute("data-goto"));
      return;
    }
    var action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.getAttribute("data-action") === "close-drawer") {
      state.selectedId = null;
      state.hoverId = null;
      if (state.network) state.network.unselectAll();
      applyFade(null);
      renderDrawer();
    }
    if (action.getAttribute("data-action") === "open-checklist") showChecklist();
  }

  document.addEventListener("click", onClick);
  $("layout-constellation").addEventListener("click", function () { setLayout("constellation"); });
  $("layout-rings").addEventListener("click", function () { setLayout("rings"); });
  $("open-checklist").addEventListener("click", showChecklist);
  $("change-scope").addEventListener("click", function () {
    if (!state.data) return;
    openScope(scopeReady(state.scope) ? "edit" : "create");
  });
  $("start-next").addEventListener("click", openReset);
  $("back-to-map").addEventListener("click", showMap);
  $("scope-continue").addEventListener("click", commitScope);
  $("scope-cancel").addEventListener("click", function () {
    if (state.scopeMode === "edit") closeScope();
  });
  $("reset-cancel").addEventListener("click", closeReset);
  $("reset-confirm").addEventListener("click", startNextFile);

  /* -------------------------------- narrow options menu -------------------------------- */

  var menuQuery = window.matchMedia("(max-width: 959px)");

  function menuOpen() {
    return $("menu-toggle").getAttribute("aria-expanded") === "true";
  }

  function setMenu(open) {
    if (!menuQuery.matches) open = false;
    $("menu-toggle").setAttribute("aria-expanded", open ? "true" : "false");
    $("toolbar-actions").classList.toggle("is-open", open);
    if (open) {
      var first = $("toolbar-actions").querySelector("button");
      if (first) first.focus();
      return;
    }
    if (menuQuery.matches && $("toolbar-actions").contains(document.activeElement)) {
      $("menu-toggle").focus();
    }
  }

  $("menu-toggle").addEventListener("click", function () { setMenu(!menuOpen()); });
  $("toolbar-actions").addEventListener("click", function (event) {
    if (event.target.closest("button")) setMenu(false);
  });
  document.addEventListener("click", function (event) {
    if (!menuOpen()) return;
    if (event.target.closest("#toolbar-actions, #menu-toggle")) return;
    setMenu(false);
  });
  if (menuQuery.addEventListener) menuQuery.addEventListener("change", function () { setMenu(false); });
  else if (menuQuery.addListener) menuQuery.addListener(function () { setMenu(false); });

  var wideQuery = window.matchMedia("(min-width: 1280px)");
  function syncChecklistSplit() {
    if (state.view !== "checklist") return;
    $("view-map").hidden = !wideQuery.matches;
    if (wideQuery.matches && state.network) {
      window.requestAnimationFrame(function () {
        state.network.redraw();
        frameSelection(state.selectedId);
      });
    }
  }
  if (wideQuery.addEventListener) wideQuery.addEventListener("change", syncChecklistSplit);
  else if (wideQuery.addListener) wideQuery.addListener(syncChecklistSplit);

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (menuOpen()) {
      setMenu(false);
      $("menu-toggle").focus();
      return;
    }
    if (!$("reset-modal").hidden) {
      closeReset();
      return;
    }
    if (!$("scope-modal").hidden) {
      if (state.scopeMode === "edit" && scopeReady(state.scope)) closeScope();
      return;
    }
    if (!$("drawer").hidden) {
      state.selectedId = null;
      state.hoverId = null;
      if (state.network) state.network.unselectAll();
      applyFade(null);
      renderDrawer();
    }
  });

  /* -------------------------------- boot -------------------------------- */

  function showErrors(messages) {
    var box = $("load-error");
    box.hidden = false;
    box.innerHTML = "<strong>Document list not loaded. Add entries to data/documents.json.</strong><ul>" +
      messages.map(function (message) { return "<li>" + esc(message) + "</li>"; }).join("") +
      "</ul>";
    $("progress-text").textContent = "Document list not loaded. Add entries to data/documents.json.";
    showMapMessage("Document list not loaded. Add entries to data/documents.json.");
    $("scope-modal").hidden = true;
    $("reset-modal").hidden = true;
    setInert(false);
  }

  function boot(data) {
    state.data = data;
    if (isString(data.meta.toolTitle) && data.meta.toolTitle) {
      $("tool-name").textContent = data.meta.toolTitle;
      document.title = data.meta.toolTitle + " — OmniHub";
    }
    state.scope = loadScope();
    if (!scopeReady(state.scope)) state.scope = null;
    if (storageGet(PREFIX + "_touched") === "1") showSaved(true);
    renderPills();
    renderProgress();
    if (!state.scope) openScope("create");
    else mountGraph();
  }

  fetch(dataUrl(), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Could not read data/documents.json (" + response.status + ").");
      return response.json();
    })
    .then(function (data) {
      var errors = validate(data);
      if (errors.length) {
        showErrors(errors);
        return;
      }
      boot(data);
    })
    .catch(function (err) {
      showErrors([err && err.message ? err.message : "Could not read data/documents.json."]);
    });
})();
