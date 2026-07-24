type LibraryBook = {
  id: string;
  number: string;
  title: string;
};

const libraryBooks: Record<string, LibraryBook> = {
  post00001: {
    id: "post00001",
    number: "001",
    title: "ပိုကြိုးစားတိုင်း စာပိုရလာမယ်လို့ ထင်နေတုန်းပဲလား?",
  },
  post00004: {
    id: "post00004",
    number: "004",
    title: "စာမလုပ်ဘဲ စာရနိုင်မယ့်နည်းလမ်းရှိလား?",
  },
  post00006: {
    id: "post00006",
    number: "006",
    title: "စာကျက်တိုင်း စာမရနေတာ ဘာကြောင့်လဲ?",
  },
  post00007: {
    id: "post00007",
    number: "007",
    title: "Active Recall — စာကျက်ပြီး စာမရတာမျိုး မဖြစ်စေမယ့် စာလုပ်နည်း",
  },
  post00009: {
    id: "post00009",
    number: "009",
    title: "စာလုပ်ချိန်နည်းနည်းနဲ့ အမှတ်များများရစေမယ့် စာလုပ်နည်း (၅) ခု",
  },
  post00014: {
    id: "post00014",
    number: "014",
    title: "စာလုပ်ဖို့ ပျင်းနေတာ သင့်အမှားမဟုတ်ဘူး",
  },
  post00015: {
    id: "post00015",
    number: "015",
    title: "စာမေးပွဲမှာ မလျှမ်းအောင် ဘယ်လိုဖြေမလဲ?",
  },
};

let installed = false;
let switchingTimer: number | undefined;

function currentBookId() {
  return new URLSearchParams(window.location.search).get("book");
}

function bookIdFromHref(rawHref: string) {
  const match = rawHref.match(/post\d{5}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function isExternalHref(rawHref: string) {
  if (!/^(https?:)?\/\//i.test(rawHref)) return false;

  try {
    const url = new URL(rawHref, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function isShelfHref(rawHref: string) {
  if (rawHref === "/" || rawHref === "./" || rawHref === window.location.pathname) return true;

  try {
    const url = new URL(rawHref, window.location.href);
    return url.origin === window.location.origin && url.pathname === window.location.pathname && !url.searchParams.has("book");
  } catch {
    return false;
  }
}

function isUnavailableInternalHref(rawHref: string) {
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return false;
  if (isExternalHref(rawHref)) return false;

  try {
    return new URL(rawHref, window.location.href).origin === window.location.origin;
  } catch {
    return rawHref.startsWith("/") || rawHref.startsWith("./") || rawHref.startsWith("../");
  }
}

function decorateAnchor(anchor: HTMLAnchorElement, activeBookId: string | null) {
  const rawHref = anchor.getAttribute("data-original-href") ?? anchor.getAttribute("href")?.trim() ?? "";
  anchor.dataset.originalHref = rawHref;
  anchor.classList.remove("reader-book-link", "reader-home-link", "reader-link-unavailable", "reader-external-link", "is-current-book");
  anchor.removeAttribute("data-book-id");
  anchor.removeAttribute("data-library-home");
  anchor.removeAttribute("data-link-status");
  anchor.removeAttribute("aria-current");
  anchor.removeAttribute("aria-disabled");
  anchor.removeAttribute("tabindex");

  const linkedBookId = bookIdFromHref(rawHref);
  if (linkedBookId && libraryBooks[linkedBookId]) {
    const linkedBook = libraryBooks[linkedBookId];
    anchor.dataset.bookId = linkedBookId;
    anchor.href = `?book=${linkedBookId}`;
    anchor.classList.add("reader-book-link");
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    anchor.title = `Book ${linkedBook.number} ကို ဖွင့်မယ်`;

    if (linkedBookId === activeBookId) {
      anchor.classList.add("is-current-book");
      anchor.setAttribute("aria-current", "page");
      anchor.dataset.linkStatus = "လက်ရှိစာအုပ်";
      anchor.title = "လက်ရှိဖတ်နေသော စာအုပ်";
    }
    return;
  }

  if (isShelfHref(rawHref)) {
    anchor.href = window.location.pathname;
    anchor.dataset.libraryHome = "true";
    anchor.classList.add("reader-home-link");
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    anchor.title = "စာအုပ်စင်ဆီ ပြန်မယ်";
    return;
  }

  if (linkedBookId || isUnavailableInternalHref(rawHref)) {
    anchor.href = "#";
    anchor.classList.add("reader-link-unavailable");
    anchor.setAttribute("aria-disabled", "true");
    anchor.setAttribute("tabindex", "-1");
    anchor.dataset.linkStatus = "စင်ပေါ် မရောက်သေးပါ";
    anchor.title = "ဒီအကြောင်းအရာကို စာအုပ်စင်ထဲ မထည့်ရသေးပါ";
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    return;
  }

  if (isExternalHref(rawHref)) {
    anchor.classList.add("reader-external-link");
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
}

function decorateReaderLinks(root: ParentNode = document) {
  const activeBookId = currentBookId();
  root.querySelectorAll<HTMLAnchorElement>(".reader-overlay .page-content a").forEach((anchor) => decorateAnchor(anchor, activeBookId));
}

function showBookSwitchingState() {
  document.body.classList.add("reader-book-switching");
  if (switchingTimer) window.clearTimeout(switchingTimer);
  switchingTimer = window.setTimeout(() => {
    document.body.classList.remove("reader-book-switching");
    switchingTimer = undefined;
  }, 720);
}

function navigateToBook(bookId: string) {
  if (!libraryBooks[bookId] || bookId === currentBookId()) return;
  showBookSwitchingState();
  window.history.pushState({ book: bookId }, "", `${window.location.pathname}?book=${bookId}`);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { book: bookId } }));
}

function navigateToShelf() {
  window.history.pushState({}, "", window.location.pathname);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
}

function handleReaderLinkClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>(".reader-overlay .page-content a");
  if (!anchor) return;

  const bookId = anchor.dataset.bookId;
  if (bookId) {
    event.preventDefault();
    event.stopPropagation();
    navigateToBook(bookId);
    return;
  }

  if (anchor.dataset.libraryHome === "true") {
    event.preventDefault();
    event.stopPropagation();
    navigateToShelf();
    return;
  }

  if (anchor.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    event.stopPropagation();
  }
}

export function installReaderLinkRouter() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length || mutation.type === "childList") {
        decorateReaderLinks();
        break;
      }
    }
  });

  const start = () => {
    decorateReaderLinks();
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleReaderLinkClick, true);
    window.addEventListener("popstate", () => window.setTimeout(() => decorateReaderLinks(), 0));
  };

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}
