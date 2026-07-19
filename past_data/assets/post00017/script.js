const progressBar = document.getElementById("progressBar");
const shareButton = document.getElementById("shareArticle");
const copyButton = document.getElementById("copyLink");
const toast = document.getElementById("toast");

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link copied");
  } catch {
    const input = document.createElement("textarea");
    input.value = window.location.href;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    showToast(copied ? "Link copied" : "Copy the link from your browser");
  }
}

shareButton.addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Game Theory — Haru",
        text: "Game Theory — Haru · 1% Better Every Day",
        url: window.location.href,
      });
    } catch (error) {
      if (error.name !== "AbortError") copyLink();
    }
  } else {
    copyLink();
  }
});

copyButton.addEventListener("click", copyLink);
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();
