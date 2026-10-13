const dLock = document.getElementById("dLock");
const dLockForm = document.getElementById("dLockForm");
const dLockDate = document.getElementById("dLockDate");
const dLockTime = document.getElementById("dLockTime");

if (dLock && dLockForm) {
  if (dLockDate) {
    const fmtDate = () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date());
    dLockDate.textContent = fmtDate();
  }

  if (dLockTime) {
    const fmtTime = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    };
    dLockTime.textContent = fmtTime();
    setInterval(() => {
      dLockTime.textContent = fmtTime();
    }, 30000);
  }

  dLockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    dLock.classList.add("is-unlocked");
  });
}
