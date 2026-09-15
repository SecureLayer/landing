const form = document.getElementById("ab-form");
const ticketInput = document.getElementById("ab-ticket");
const charCount = document.getElementById("ab-char-count");
const submitBtn = document.getElementById("ab-submit");
const resultEl = document.getElementById("ab-result");
const spotsEl = document.getElementById("ab-spots");

async function refreshSpots() {
  try {
    const res = await fetch("/api/ai-agent/status");
    const data = await res.json();
    if (data.spotsRemaining <= 0) {
      spotsEl.textContent = "Today's spots are gone — come back tomorrow.";
      submitBtn.disabled = true;
    } else {
      spotsEl.textContent = `${data.spotsRemaining} of 50 spots left today.`;
    }
  } catch {
    spotsEl.textContent = "";
  }
}

ticketInput.addEventListener("input", () => {
  charCount.textContent = String(ticketInput.value.length);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    const res = await fetch("/api/ai-agent/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: ticketInput.value }),
    });
    const data = await res.json();

    resultEl.hidden = false;
    if (res.status === 429 || res.status === 400) {
      resultEl.className = "ab-result lose";
      resultEl.textContent = data.error;
    } else if (data.win) {
      resultEl.className = "ab-result win";
      resultEl.textContent = `You broke it! It called ${data.toolCalled}.`;
    } else {
      resultEl.className = "ab-result lose";
      resultEl.textContent = "It held the line — try a different angle.";
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit ticket";
    await refreshSpots();
  }
});

refreshSpots();
