const REAL_CAR = [
  {
    id: "r1",
    letter: "R",
    title: "Regulated by the Financial Conduct Authority",
    say: "We're authorised and regulated by the Financial Conduct Authority.",
    detail:
      "Eastern Western Motor Group Ltd is authorised and regulated by the Finacial Conduct Authority. FRN 310505. Eastern Motor Company Ltd (FRN 565317) and Western Automobile Company Ltd (FRN 565318) are appointed representatives of the Group.",
    tone: "navy",
  },
  {
    id: "e",
    letter: "E",
    title: "Explain products, not advice",
    say: "We'll explain the available products and answer your questions, but we won't provide financial advice or make recommendations.",
    detail:
      "We are not independent financial advisers. We provide details of products available. No advice or recommendation will be made. The customer must decide whether the product is right for them.",
    tone: "mid",
  },
  {
    id: "a1",
    letter: "A",
    title: "Act as a credit broker",
    say: "We're a credit broker, not a lender.",
    detail:
      "We introduce customers to lenders. We do not lend the money ourselves. This distinction must be explicit before any finance discussion continues.",
    tone: "steel",
  },
  {
    id: "l",
    letter: "L",
    title: "Limited lender panel",
    say: "We work with a selected panel of finance providers and, for some brands, can only introduce you to the manufacturer's finance company.",
    detail:
      "New Mercedes-Benz: Mercedes-Benz Financial Services only. New MINI (and some Young Used MINI): BMW Financial Services (GB) Limited trading as MINI Financial Services only — if they cannot offer, there is no alternative introduction. Other purchases: a limited panel of lenders, not the whole market.",
    tone: "pale",
  },
  {
    id: "c",
    letter: "C",
    title: "Commission disclosed",
    say: "We may receive commission from finance and insurance providers, which will be disclosed where applicable.",
    detail:
      "We do not charge a customer fee. Commission is typically a fixed fee or a fixed percentage of the amount borrowed. It does not influence the interest rate. It is fully disclosed before completion.",
    tone: "navy",
  },
  {
    id: "a2",
    letter: "A",
    title: "Additional products are optional",
    say: "Any insurance or protection products we discuss are entirely optional and are not required to obtain vehicle finance.",
    detail:
      "All insurance products are optional and come from a limited number of suppliers. We may ask questions to narrow the selection; the customer chooses.",
    tone: "mid",
  },
  {
    id: "r2",
    letter: "R",
    title: "Raise concerns",
    say: "If you're unhappy with any aspect of our service, we have a formal complaint process in place.",
    detail:
      "Eastern Western Motor Group Limited, 8 Westerton Road, Broxburn, EH52 5AU. Telephone 01506 600 000. Email financialservices@easternholdings.co.uk. Insurance arranging is covered by the FSCS (typically 90% of the claim, no upper limit).",
    tone: "steel",
  },
];

const SCRIPT = `Before we continue, I'd like to make you aware that we're regulated by the Financial Conduct Authority and act as a credit broker, not a lender. We will explain the finance options available, but we do not provide financial advice, so the final decision is yours. We work with a selected panel of finance providers and, for some brands, can only introduce you to the manufacturer's finance company. We do not charge a fee for arranging finance or insurance products, although we may receive commission from providers, which will be disclosed where applicable. Any insurance or protection products we discuss are entirely optional. If you have any questions or concerns at any stage, please let me know and I'll be happy to help.`;

const QUIZ = [
  {
    q: "When must the SDD be presented?",
    options: [
      "After the customer has chosen a finance product",
      "Before any meaningful discussion of regulated finance or insurance",
      "Only if the customer asks for it",
      "At handover / collection",
    ],
    answer: 1,
    why: "FCA status disclosure comes first. In Sales+ this is when an offer is first requested.",
  },
  {
    q: "Which statement is correct?",
    options: [
      "We are a lender and a broker",
      "We are independent financial advisers",
      "We are a credit broker, not a lender",
      "We always search the whole of the market",
    ],
    answer: 2,
    why: "Say it plainly: credit broker, not lender.",
  },
  {
    q: "Do colleagues provide financial advice or recommendations?",
    options: [
      "Yes, we recommend the best product",
      "Yes, but only for insurance",
      "No — we explain products and the customer decides",
      "Only if the customer is vulnerable",
    ],
    answer: 2,
    why: "Explain products, answer questions, no advice or recommendation.",
  },
  {
    q: "A customer is buying a new Mercedes-Benz. Who can you introduce them to?",
    options: [
      "Any lender on the Group panel",
      "Mercedes-Benz Financial Services only",
      "Mercedes-Benz Financial Services, then a backup lender if declined",
      "The customer's own bank first",
    ],
    answer: 1,
    why: "New Mercedes-Benz is a single-lender introduction.",
  },
  {
    q: "If MINI Financial Services cannot offer on a New MINI, what happens?",
    options: [
      "Introduce another panel lender",
      "Switch the customer to BMW Financial Services under a different name",
      "No alternative introduction can be offered",
      "The deal must proceed in cash only that day",
    ],
    answer: 2,
    why: "For New MINI (and some Young Used MINI) it is a single lender.",
  },
  {
    q: "Does commission change the interest rate the customer pays?",
    options: [
      "Yes — higher commission means a higher rate",
      "No — commission does not influence the interest rate, and it is disclosed",
      "Only on used cars",
      "Only if the customer pays a broker fee",
    ],
    answer: 1,
    why: "No customer fee. Commission is disclosed and does not set the rate.",
  },
  {
    q: "Are insurance or protection products required to obtain vehicle finance?",
    options: [
      "Yes, at least one product",
      "Yes, if the lender asks",
      "No — they are entirely optional",
      "Only tyre and alloy cover is required",
    ],
    answer: 2,
    why: "Additional products are optional. Finance cannot be conditional on taking them.",
  },
];

const NAMES = [
  "Audi Edinburgh",
  "Audi Stirling",
  "Western Maxus",
  "Western Chery",
  "Barnetts Chery",
  "Western Commercial",
  "Barnetts Nissan Perth",
  "Barnetts Honda Perth",
  "Eastern BMW",
  "Barnetts Honda Dundee",
  "Barnetts Toyota Dundee",
  "Eastern Mini",
  "Barnetts Toyota Perth",
  "Eastern Western Leasing",
  "Lexus Dundee",
  "Lexus Glasgow",
  "Luxury at Lexus",
  "Lexus Edinburgh",
  "Western Volkswagen Buzz Centre Edinburgh East",
  "Western Volkswagen Van Centre Edinburgh",
  "Western Volkswagen Buzz Centre",
  "GTI World",
  "Western Volkswagen",
  "Grassicks Garage",
  "Western Edinburgh (Straiton)",
  "Barnetts Mazda",
  "Western Mazda",
  "Barnetts Nissan",
  "Western Nissan",
  "Western Toyota",
  "Car Deal Warehouse",
  "Western Honda",
  "Mercedes Benz of Edinburgh",
  "Mercedes Benz of Coldstream",
];

const INS = [
  ["Mechanical Breakdown Insurance", "Red Sands Insurance Company (Europe) Limited"],
  ["Vehicle Minor Damage Insurance", "Aioi Nissay Dowa Insurance UK Limited"],
  ["Tyre & Alloy Protection", "Novus Underwriting Limited on behalf of Helvetia Global Solutions Ltd"],
  ["BMW Insured Warranty (Grassicks Garage & Eastern BMW & MINI)", "AWP P&C SA"],
];

const state = {
  tab: "learn",
  step: 0,
  checked: JSON.parse(localStorage.getItem("sddms-checks") || "[]"),
  q: 0,
  picked: null,
  score: 0,
  done: false,
};

function saveChecks() {
  localStorage.setItem("sddms-checks", JSON.stringify(state.checked));
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function letterPanel() {
  const item = REAL_CAR[state.step];
  const pct = Math.round(((state.step + 1) / REAL_CAR.length) * 100);
  const tiles = REAL_CAR.map(
    (it, i) =>
      `<button type="button" class="tile ${it.tone}${i === state.step ? " on" : ""}" data-step="${i}" aria-label="${it.letter}: ${it.title}">${it.letter}</button>`,
  ).join("");
  const covered = state.checked.includes(item.id);
  return `
    <section class="stack">
      <div class="row-between">
        <h2>The mnemonic</h2>
        <p class="kicker">${state.step + 1} / ${REAL_CAR.length}</p>
      </div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="tiles">${tiles}</div>
      <article class="panel">
        <p class="kicker steel">${item.letter} · say this</p>
        <h3>${item.title}</h3>
        <blockquote>“${item.say}”</blockquote>
        <p class="detail">${item.detail}</p>
        <div class="actions">
          <button type="button" class="btn paper" id="prev" ${state.step === 0 ? "disabled" : ""}>Previous</button>
          <button type="button" class="btn steel" id="next" ${state.step === REAL_CAR.length - 1 ? "disabled" : ""}>Next</button>
          <button type="button" class="btn ghost" id="mark">${covered ? "Covered" : "Mark covered"}</button>
        </div>
      </article>
      <div class="foundations">
        <article><h3>Present before discussing products</h3><p>The SDD must be provided and summarised before any meaningful conversation about regulated finance or insurance. In Sales+ this happens when an offer is first requested.</p></article>
        <article><h3>Understanding, not recitation</h3><p>Do not read the SDD verbatim. Customers should understand our role, our services, and the key FCA disclosures.</p></article>
        <article><h3>Integrated Sales+ journey</h3><p>Treat the SDD as a natural briefing, not an interruption. Cover REAL CAR, check understanding, then continue.</p></article>
      </div>
    </section>`;
}

function scriptPanel() {
  return `
    <section class="stack">
      <div class="row-between">
        <div>
          <h2>60-second executive version</h2>
          <p class="muted">A complete briefing. Adapt the wording — keep the points.</p>
        </div>
        <button type="button" class="btn navy" id="copy">Copy script</button>
      </div>
      <blockquote class="panel">“${SCRIPT}”</blockquote>
      <p class="muted">The aim is not word-for-word delivery — customer understanding.</p>
    </section>`;
}

function watchPanel() {
  return `
    <section class="stack">
      <h2>Explainer video</h2>
      <p class="muted">Walk through REAL CAR on screen, then use the mnemonic on the floor.</p>
      <div class="video">
        <iframe src="https://www.youtube-nocookie.com/embed/Nb1ceL0uGDM" title="SDD Made Simple explainer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <a class="link" href="https://youtu.be/Nb1ceL0uGDM" target="_blank" rel="noreferrer">Open on YouTube</a>
      <h3>Framework guide</h3>
      <img src="/sddms/real-car-guide.png" alt="SDD Made Simple: Mastering the REAL CAR compliance framework" />
    </section>`;
}

function sddPanel() {
  const rows = INS.map(([p, i]) => `<tr><td>${p}</td><td>${i}</td></tr>`).join("");
  const names = NAMES.map((n) => `<li>${n}</li>`).join("");
  return `
    <section class="stack">
      <div class="row-between">
        <div>
          <h2>Status Disclosure Document</h2>
          <p class="muted">EWMG – GSDDNA – V11 – 06.07.2026</p>
        </div>
        <a class="btn navy" href="/sddms/sdd.pdf" download>Download PDF</a>
      </div>
      <article class="doc">
        <p>The Financial Conduct Authority is the independent watchdog that regulates financial services. It requires us to give you this document to help you decide if our services are right for you.</p>
        <p><strong>Eastern Western Motor Group Ltd</strong>, 8 Westerton Road, East Mains Industrial Estate, Broxburn, Edinburgh, EH52 5AU, is authorised and regulated by the FCA. FRN 310505.</p>
        <p>Eastern Motor Company Ltd (FRN 565317) and Western Automobile Company Ltd (FRN 565318) are appointed representatives of Eastern Western Motor Group Ltd.</p>
        <h3>Finance / credit services</h3>
        <ul>
          <li>We are a credit broker and not a lender.</li>
          <li>New Mercedes-Benz: only Mercedes-Benz Financial Services.</li>
          <li>New MINI, and in some cases Young Used MINI: only BMW Financial Services (GB) Limited trading as MINI Financial Services. If they cannot offer, no alternative introduction is available.</li>
          <li>Otherwise we introduce you to a limited number of lenders. No advice or recommendation will be made.</li>
          <li>We do not charge a fee. Commission does not influence the interest rate and is fully disclosed before completion.</li>
        </ul>
        <h3>Insurance services</h3>
        <p>Products come from a limited number of suppliers. All are optional. No customer fee; we receive commission as a percentage of the annual premium.</p>
        <table>
          <thead><tr><th>Product</th><th>Insurer</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <h3>Complaints</h3>
        <p>Eastern Western Motor Group Limited, 8 Westerton Road, Broxburn, EH52 5AU. Telephone 01506 600 000. Email <a href="mailto:financialservices@easternholdings.co.uk">financialservices@easternholdings.co.uk</a>.</p>
        <p>FSCS applies to insurance services (typically 90% of the claim, no upper limit). Privacy: <a href="https://www.easternwestern.co.uk/site/privacy-policy/" target="_blank" rel="noreferrer">Group Privacy Policy</a>.</p>
        <h3>Trading names</h3>
        <ul class="names">${names}</ul>
      </article>
    </section>`;
}

function practicePanel() {
  const list = REAL_CAR.map((it) => {
    const on = state.checked.includes(it.id);
    return `<button type="button" class="check${on ? " on" : ""}" data-id="${it.id}"><span class="tile ${it.tone} sm">${it.letter}</span><span>${it.title}</span></button>`;
  }).join("");
  let quiz;
  if (state.done) {
    quiz = `<div class="panel"><p class="kicker">Result</p><p class="score">${state.score}/${QUIZ.length}</p><p class="detail">${state.score === QUIZ.length ? "Clean set. You can brief REAL CAR without the sheet." : "Revisit the letters you missed, then run it again before a shift."}</p></div>`;
  } else {
    const item = QUIZ[state.q];
    const opts = item.options
      .map((opt, i) => {
        let cls = "opt";
        if (state.picked !== null) {
          if (i === item.answer) cls += " ok";
          else if (i === state.picked) cls += " bad";
          else cls += " dim";
        }
        return `<button type="button" class="${cls}" data-opt="${i}">${opt}</button>`;
      })
      .join("");
    quiz = `
      <article class="card">
        <p class="muted">${state.q + 1} / ${QUIZ.length}</p>
        <h3>${item.q}</h3>
        <div class="opts">${opts}</div>
        ${
          state.picked !== null
            ? `<p class="muted why">${item.why}</p><button type="button" class="btn navy" id="nq">${state.q + 1 >= QUIZ.length ? "See score" : "Next question"}</button>`
            : ""
        }
      </article>`;
  }
  return `
    <section class="stack">
      <h2>Floor checklist</h2>
      <p class="muted">Tick each letter as you cover it. Stored on this device only.</p>
      <div class="checks">${list}</div>
      <p class="muted">${state.checked.length} of ${REAL_CAR.length} covered.</p>
      <div class="row-between">
        <h2>Quick check</h2>
        <button type="button" class="linkish" id="reset">Reset</button>
      </div>
      ${quiz}
    </section>`;
}

function render() {
  const body =
    state.tab === "learn"
      ? letterPanel()
      : state.tab === "script"
        ? scriptPanel()
        : state.tab === "watch"
          ? watchPanel()
          : state.tab === "sdd"
            ? sddPanel()
            : practicePanel();
  document.getElementById("main").innerHTML = body;
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === state.tab);
  });
  bind();
}

function bind() {
  document.querySelectorAll("[data-step]").forEach((b) => {
    b.onclick = () => {
      state.step = Number(b.dataset.step);
      render();
    };
  });
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const mark = document.getElementById("mark");
  if (prev)
    prev.onclick = () => {
      state.step = Math.max(0, state.step - 1);
      render();
    };
  if (next)
    next.onclick = () => {
      state.step = Math.min(REAL_CAR.length - 1, state.step + 1);
      render();
    };
  if (mark)
    mark.onclick = () => {
      const id = REAL_CAR[state.step].id;
      state.checked = state.checked.includes(id)
        ? state.checked.filter((x) => x !== id)
        : [...state.checked, id];
      saveChecks();
      render();
    };
  const copy = document.getElementById("copy");
  if (copy)
    copy.onclick = async () => {
      await navigator.clipboard.writeText(SCRIPT);
      copy.textContent = "Copied";
      setTimeout(() => {
        copy.textContent = "Copy script";
      }, 1400);
    };
  document.querySelectorAll("[data-id]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      state.checked = state.checked.includes(id)
        ? state.checked.filter((x) => x !== id)
        : [...state.checked, id];
      saveChecks();
      render();
    };
  });
  document.querySelectorAll("[data-opt]").forEach((b) => {
    b.onclick = () => {
      if (state.picked !== null) return;
      state.picked = Number(b.dataset.opt);
      if (state.picked === QUIZ[state.q].answer) state.score += 1;
      render();
    };
  });
  const nq = document.getElementById("nq");
  if (nq)
    nq.onclick = () => {
      if (state.q + 1 >= QUIZ.length) state.done = true;
      else {
        state.q += 1;
        state.picked = null;
      }
      render();
    };
  const reset = document.getElementById("reset");
  if (reset)
    reset.onclick = () => {
      state.q = 0;
      state.picked = null;
      state.score = 0;
      state.done = false;
      render();
    };
}

document.querySelectorAll("[data-tab]").forEach((b) => {
  b.onclick = () => setTab(b.dataset.tab);
});

render();
