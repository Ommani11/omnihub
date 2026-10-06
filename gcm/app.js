const $ = (id) => document.getElementById(id);
const KEY = "gcm-prep-v1";

const state = load();
let data = null;
let view = "reading";
let glossFilter = "all";
let hideKnown = false;
let query = "";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { read: {}, notes: {}, known: {} };
  } catch {
    return { read: {}, notes: {}, known: {} };
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

function items() {
  return data.reading.blocks.flatMap((b) => b.items.map((item) => ({ ...item, block: b })));
}
function terms() {
  return data.glossary.categories.flatMap((c) => c.terms.map((t) => ({ ...t, category: c })));
}
function termById(id) {
  return terms().find((t) => t.id === id);
}

function matches(text) {
  if (!query) return true;
  return text.toLowerCase().includes(query);
}

async function init() {
  const res = await fetch("./data.json");
  if (!res.ok) throw new Error("Could not load data.json");
  data = await res.json();
  $("loading").remove();
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  });
  $("q").addEventListener("input", (e) => {
    query = e.target.value.trim().toLowerCase();
    render();
  });
  render();
}

function counts() {
  const allItems = items();
  const done = allItems.filter((i) => state.read[i.id]).length;
  const known = terms().filter((t) => state.known[t.id]).length;
  $("counts").textContent = `${done}/${allItems.length} read · ${known}/${terms().length} known`;
}

function render() {
  counts();
  $("main").innerHTML = view === "reading" ? readingView() : glossaryView();
  bind();
}

function nextItem() {
  return items().find((i) => !state.read[i.id]) || null;
}

function readingView() {
  const blocks = data.reading.blocks.map((block) => {
    const visible = block.items.filter((item) => matches([item.title, item.focus, item.why, item.type, block.label, block.theme].join(" ")));
    if (!visible.length) return "";
    const done = block.items.filter((i) => state.read[i.id]).length;
    const pct = Math.round((done / block.items.length) * 100);
    return `
      <section class="card" id="block-${esc(block.id)}">
        <div class="block-head">
          <h2>${esc(block.label)}</h2>
          <span class="meta">${done}/${block.items.length}</span>
        </div>
        <p class="meta">${esc(block.theme)}</p>
        <p class="goal"><strong>Leave able to:</strong> ${esc(block.goal)}</p>
        <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div style="margin-top:14px">
          ${visible.map(itemCard).join("")}
        </div>
      </section>`;
  }).join("");

  const next = nextItem();
  const nextCard = next && !query ? `
    <section class="card next">
      <p class="kicker">Up next</p>
      <h2>${esc(next.title)}</h2>
      <p class="meta">${esc(next.block.label)} · ${esc(next.block.theme)}</p>
      <p class="focus">${esc(next.focus)}</p>
    </section>` : "";

  return `
    ${nextCard}
    <section class="card">
      <p class="kicker">How to use the fortnight</p>
      <p>${esc(data.reading.how_to_use)}</p>
      <ol class="method">${data.reading.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>
    </section>
    ${blocks || `<p class="empty">Nothing matches that search.</p>`}
  `;
}

function itemCard(item) {
  const done = !!state.read[item.id];
  const note = state.notes[item.id] || "";
  const link = item.url
    ? `<a class="link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open source</a>`
    : "";
  return `
    <article class="item${done ? " done" : ""}">
      <input type="checkbox" data-read="${esc(item.id)}" ${done ? "checked" : ""} aria-label="Mark read: ${esc(item.title)}" />
      <div>
        <div class="row">
          <span class="chip ${esc(item.type)}">${esc(item.type)}</span>
        </div>
        <div class="title">${esc(item.title)}</div>
        <p class="focus"><strong>Look for:</strong> ${esc(item.focus)}</p>
        <p class="why">${esc(item.why)}</p>
        ${link}
        <label class="notes-label">Five lines: the rule, good here, poor here, evidence we have, evidence we do not.
          <textarea class="notes" data-note="${esc(item.id)}" placeholder="Write the five lines after you read it.">${esc(note)}</textarea>
        </label>
      </div>
    </article>`;
}

function glossaryView() {
  const cats = data.glossary.categories;
  const filters = [`<button type="button" data-filter="all" class="${glossFilter === "all" ? "active" : ""}">All</button>`]
    .concat(cats.map((c) => `<button type="button" data-filter="${esc(c.id)}" class="${glossFilter === c.id ? "active" : ""}">${esc(c.name)}</button>`))
    .join("");
  const list = terms().filter((t) => {
    if (glossFilter !== "all" && t.category.id !== glossFilter) return false;
    if (hideKnown && state.known[t.id]) return false;
    return matches([t.term, t.short, t.definition, t.example, t.use, t.category.name].join(" "));
  });
  return `
    <div class="filters" role="tablist">${filters}</div>
    <button type="button" class="toggle${hideKnown ? " on" : ""}" id="hide-known">${hideKnown ? "Showing still learning" : "Hide terms I know"}</button>
    <p class="meta" style="margin:10px 0 12px">${esc(data.glossary.note)}</p>
    ${list.map(termCard).join("") || `<p class="empty">Nothing in this cut.</p>`}
  `;
}

function termCard(t) {
  const known = !!state.known[t.id];
  const related = (t.related || []).map((id) => {
    const other = termById(id);
    return other ? `<button type="button" data-jump="${esc(id)}">${esc(other.term)}</button>` : "";
  }).join("");
  return `
    <article class="card term${known ? " known-card" : ""}${t.category.id === "misuse" ? " misuse" : ""}" id="term-${esc(t.id)}">
      <div class="term-top">
        <div>
          <p class="label">${esc(t.category.name)}</p>
          <h3>${esc(t.term)}</h3>
        </div>
        <button type="button" class="known${known ? " on" : ""}" data-known="${esc(t.id)}">${known ? "Known" : "Mark known"}</button>
      </div>
      <p class="short">${esc(t.short)}</p>
      <div class="block"><p class="label">Means</p><p>${esc(t.definition)}</p></div>
      <div class="block"><p class="label">Example</p><p>${esc(t.example)}</p></div>
      <div class="say"><p class="label">Say this</p><p>${esc(t.use)}</p></div>
      ${related ? `<div class="related">${related}</div>` : ""}
    </article>`;
}

function bind() {
  document.querySelectorAll("[data-read]").forEach((el) => {
    el.addEventListener("change", () => {
      state.read[el.dataset.read] = el.checked;
      save();
      render();
    });
  });
  document.querySelectorAll("[data-note]").forEach((el) => {
    el.addEventListener("input", () => {
      state.notes[el.dataset.note] = el.value;
      save();
      counts();
    });
  });
  document.querySelectorAll("[data-known]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.known;
      state.known[id] = !state.known[id];
      save();
      render();
      const node = document.getElementById("term-" + id);
      if (node) node.scrollIntoView({ block: "center" });
    });
  });
  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      glossFilter = el.dataset.filter;
      render();
    });
  });
  document.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => {
      glossFilter = "all";
      hideKnown = false;
      query = "";
      $("q").value = "";
      render();
      const node = document.getElementById("term-" + el.dataset.jump);
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  const hide = $("hide-known");
  if (hide) hide.addEventListener("click", () => { hideKnown = !hideKnown; render(); });
}

init().catch((err) => {
  $("main").innerHTML = `<p class="empty">${esc(err.message)}</p>`;
});
