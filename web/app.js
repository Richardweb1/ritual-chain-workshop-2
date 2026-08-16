const functions = [
  {
    name: "submitCommitment",
    signature: "submitCommitment(uint256 bountyId, bytes32 commitment)",
    detail: "Stores only a bytes32 hash during the submission phase.",
  },
  {
    name: "revealAnswer",
    signature: "revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt)",
    detail: "Verifies answer, salt, sender, and bounty id after the deadline.",
  },
  {
    name: "judgeAll",
    signature: "judgeAll(uint256 bountyId, bytes calldata llmInput)",
    detail: "Accepts one batch judging payload for all valid revealed answers.",
  },
  {
    name: "finalizeWinner",
    signature: "finalizeWinner(uint256 bountyId, uint256 winnerIndex)",
    detail: "Pays the selected valid revealed submitter and closes the bounty.",
  },
];

const tests = [
  ["Commit privacy", "Stores only the commitment hash before reveal."],
  ["Deadline guard", "Rejects reveals before the submission deadline."],
  ["Reveal validity", "Rejects wrong salt and wrong sender reveal attempts."],
  ["Winner flow", "Reveals, judges, and finalizes only valid answers."],
];

const architecture = [
  ["Plaintext before reveal", "Only on the participant device."],
  ["On-chain before reveal", "Bounty metadata, submitter, and commitment hash."],
  ["Plaintext in Ritual-native design", "Participant device and Ritual TEE only."],
  ["LLM input", "One batched prompt built from eligible submissions."],
];

const functionGrid = document.querySelector("#functionGrid");
const testGrid = document.querySelector("#testGrid");
const architectureList = document.querySelector("#architectureList");
const testPanel = document.querySelector("#testPanel");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function updateTestPanel(title, detail) {
  testPanel.querySelector("strong").textContent = title;
  testPanel.querySelector("p").textContent = detail;
}

function renderFunctions() {
  functionGrid.innerHTML = functions
    .map(
      (item) => `
        <article class="market-card">
          <div class="market-top">
            <span class="tag">Required</span>
            <span class="tag">EVM portable</span>
          </div>
          <div>
            <h3>${item.name}</h3>
            <p class="market-rule">${item.detail}</p>
          </div>
          <div class="formula-box">
            <code>${item.signature}</code>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTests() {
  testGrid.innerHTML = tests
    .map(
      ([name, detail], index) => `
        <button class="market-card test-case" type="button" data-index="${index}">
          <div class="market-top">
            <span class="tag">Test ${index + 1}</span>
            <span class="tag">Passing</span>
          </div>
          <div>
            <h3>${name}</h3>
            <p class="market-rule">${detail}</p>
          </div>
        </button>
      `,
    )
    .join("");
}

function renderArchitecture() {
  architectureList.innerHTML = architecture
    .map(
      ([label, value]) => `
        <div class="tape-row">
          <small>${label}</small>
          <strong>${value}</strong>
          <small>documented</small>
        </div>
      `,
    )
    .join("");
}

testGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".test-case");
  if (!card) return;
  const [name, detail] = tests[Number(card.dataset.index)];
  updateTestPanel(name, detail);
  showToast(`${name} inspected.`);
});

document.querySelector("#copyCommand").addEventListener("click", async () => {
  const command = "cd hardhat && pnpm exec hardhat test";
  try {
    await navigator.clipboard.writeText(command);
    showToast("Test command copied.");
  } catch {
    showToast(command);
  }
});

renderFunctions();
renderTests();
renderArchitecture();
