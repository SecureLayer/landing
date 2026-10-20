const mScene = document.getElementById("mScene");
const mStand = document.getElementById("mStand");
const mStandPadlock = document.getElementById("mStandPadlock");
const mStandTime = document.getElementById("mStandTime");

if (mScene && mStand) {
  document.documentElement.classList.add("m-locked");

  if (mStandTime) {
    const fmt = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    };
    mStandTime.textContent = fmt();
    setInterval(() => {
      mStandTime.textContent = fmt();
    }, 30000);
  }

  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    mScene.classList.add("is-unlocked");
    document.documentElement.classList.remove("m-locked");
  };

  mStand.addEventListener("click", unlock);
  if (mStandPadlock) mStandPadlock.addEventListener("click", unlock);

  let startY = null;
  mStand.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
  });
  mStand.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    if (startY - e.clientY > 45) unlock();
  });
  mStand.addEventListener("pointerup", () => {
    startY = null;
  });

  mStand.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY < -30) unlock();
    },
    { passive: true },
  );
}
