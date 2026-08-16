const markets = [
  {
    id: 12,
    category: "crypto",
    label: "BTC/USD",
    question: "Will BTC/USD be at least $70,000 when the scheduler resolves?",
    rule: "CoinGecko price, jq path .bitcoin.usd, comparator >= 70000",
    yes: 62,
    no: 38,
    volume: 48.7,
    feed: "HTTP 200 · 28s ago",
    status: "Betting open",
  },
  {
    id: 13,
    category: "crypto",
    label: "ETH/USD",
    question: "Will ETH/USD clear $3,500 at the next checkpoint?",
    rule: "CoinGecko price, jq path .ethereum.usd, comparator >= 3500",
    yes: 44,
    no: 56,
    volume: 39.4,
    feed: "HTTP 200 · 42s ago",
    status: "Resolution queued",
  },
  {
    id: 14,
    category: "ritual",
    label: "Ritual jobs",
    question: "Will scheduled Ritual agent jobs pass 50,000 before resolve block?",
    rule: "Telemetry API, jq path .scheduler.totalJobs, comparator >= 50000",
    yes: 78,
    no: 22,
    volume: 54.2,
    feed: "HTTP 200 · 1m ago",
    status: "Live monitor",
  },
  {
    id: 15,
    category: "macro",
    label: "DeFi TVL",
    question: "Will Solana DeFi TVL stay above $6B at resolution?",
    rule: "DefiLlama chain TVL, jq path .tvl, comparator >= 6000000000",
    yes: 57,
    no: 43,
    volume: 27.6,
    feed: "HTTP 200 · 2m ago",
    status: "Betting open",
  },
];

const oracleReads = [
  ["BTC/USD", "$63,004", "CoinGecko · jq ok"],
  ["ETH/USD", "$1,877.93", "CoinGecko · jq ok"],
  ["Jobs", "42,816", "Ritual telemetry · jq ok"],
  ["TVL", "$5.82B", "DefiLlama · jq ok"],
];

const logLines = [
  ["09:42:18", "Picked TEE executor for HTTP capability", "ok"],
  ["09:42:21", "Scheduled resolve callback confirmed", "ok"],
  ["09:42:34", "Retry budget unchanged: 3 attempts", "watch"],
  ["09:43:02", "Oracle envelope decoded successfully", "ok"],
];

const marketGrid = document.querySelector("#marketGrid");
const oracleTape = document.querySelector("#oracleTape");
const agentLog = document.querySelector("#agentLog");
const toast = document.querySelector("#toast");
const totalVolume = document.querySelector("#totalVolume");
const testPanel = document.querySelector("#testPanel");
let activeFilter = "all";
let localDraftId = null;
let localPositions = [];

function yesOdds(market) {
  return (100 / market.yes).toFixed(2);
}

function noOdds(market) {
  return (100 / market.no).toFixed(2);
}

function renderMarkets(filter = "all") {
  activeFilter = filter;
  const visible = filter === "all" ? markets : markets.filter((market) => market.category === filter);
  marketGrid.innerHTML = visible
    .map(
      (market) => `
        <article class="market-card" data-id="${market.id}">
          <div class="market-top">
            <span class="tag">${market.label}</span>
            <span class="tag">${market.status}</span>
          </div>
          <div>
            <h3>${market.question}</h3>
            <p class="market-rule">${market.rule}</p>
          </div>
          <div class="odds-grid">
            <div class="odds-box">
              <span>YES pool</span>
              <strong>${market.yes}%</strong>
              <span>${yesOdds(market)}x estimated</span>
            </div>
            <div class="odds-box">
              <span>NO pool</span>
              <strong>${market.no}%</strong>
              <span>${noOdds(market)}x estimated</span>
            </div>
          </div>
          <div class="market-footer">
            <small>${market.volume.toFixed(1)} RITUAL · ${market.feed}</small>
            <div class="market-actions">
              <button class="button secondary choice-button yes" type="button" data-action="position" data-side="YES" data-id="${market.id}">
                YES
              </button>
              <button class="button secondary choice-button no" type="button" data-action="position" data-side="NO" data-id="${market.id}">
                NO
              </button>
              <button class="button secondary" type="button" data-action="inspect" data-id="${market.id}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v16" /></svg>
                Inspect
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTape() {
  oracleTape.innerHTML = oracleReads
    .map(
      ([label, value, source]) => `
        <div class="tape-row">
          <small>${label}</small>
          <strong>${value}</strong>
          <small>${source}</small>
        </div>
      `,
    )
    .join("");
}

function renderLog() {
  agentLog.innerHTML = logLines
    .map(
      ([time, line, tone]) => `
        <div class="log-row">
          <small>${time}</small>
          <strong>${line}</strong>
          <span class="tag">${tone}</span>
        </div>
      `,
    )
    .join("");
}

function updateTestPanel(title, detail) {
  testPanel.querySelector("strong").textContent = title;
  testPanel.querySelector("p").textContent = detail;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3600);
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderMarkets(button.dataset.filter);
  });
});

marketGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const market = markets.find((item) => item.id === Number(button.dataset.id));
  if (!market) return;
  if (button.dataset.action === "inspect") {
    updateTestPanel(
      `#${market.id} ${market.label}: ${market.status}`,
      `${market.rule}. Feed: ${market.feed}. Volume: ${market.volume.toFixed(1)} RITUAL.`,
    );
    showToast(`Inspecting #${market.id}. Details moved to the test console.`);
    return;
  }

  if (button.dataset.action === "position") {
    const side = button.dataset.side;
    localPositions.unshift({ marketId: market.id, side, amount: 0.25 });
    if (side === "YES") {
      market.yes = Math.min(95, market.yes + 1);
      market.no = 100 - market.yes;
    } else {
      market.no = Math.min(95, market.no + 1);
      market.yes = 100 - market.no;
    }
    market.volume += 0.25;
    totalVolume.textContent = markets.reduce((sum, item) => sum + item.volume, 0).toFixed(1);
    renderMarkets(activeFilter);
    updateTestPanel(
      `Local ${side} position staged on #${market.id}`,
      `0.25 RITUAL simulated. This is UI-only until wallet transactions are wired to bet().`,
    );
    showToast(`${side} test position added locally.`);
  }
});

document.querySelector("#connectWallet").addEventListener("click", (event) => {
  event.currentTarget.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
    Wallet ready
  `;
  showToast("Wallet connection mocked for the workshop UI.");
});

document.querySelector("#marketForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const question = String(form.get("question")).trim();
  const target = Number(form.get("target"));
  if (!question || Number.isNaN(target)) return;
  const draft = {
    id: localDraftId ?? Math.max(...markets.map((market) => market.id)) + 1,
    category: "crypto",
    label: "Draft",
    question,
    rule: `Drafted oracle rule with target ${target.toLocaleString()}`,
    yes: 50,
    no: 50,
    volume: 0,
    feed: "Staged locally",
    status: "Draft",
  };
  if (localDraftId === null) {
    localDraftId = draft.id;
    markets.unshift(draft);
  } else {
    const index = markets.findIndex((market) => market.id === localDraftId);
    markets[index] = draft;
  }
  totalVolume.textContent = markets.reduce((sum, market) => sum + market.volume, 0).toFixed(1);
  renderMarkets("all");
  document.querySelector("[data-filter='all']").click();
  updateTestPanel(
    `Draft market #${draft.id} staged`,
    "The draft is updated in place, so repeated tests will not spam duplicate cards.",
  );
  showToast("Draft staged locally. Re-submit edits the same draft card.");
});

document.querySelector("#clearDrafts").addEventListener("click", () => {
  for (let i = markets.length - 1; i >= 0; i--) {
    if (markets[i].status === "Draft") {
      markets.splice(i, 1);
    }
  }
  localDraftId = null;
  renderMarkets(activeFilter);
  updateTestPanel("Drafts cleared", "The market list is back to the seeded workshop data.");
  showToast("Local draft cards cleared.");
});

renderMarkets();
renderTape();
renderLog();
