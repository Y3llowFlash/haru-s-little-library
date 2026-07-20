"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";

type Book = {
  id: string;
  number: string;
  title: string;
  label: string;
  cover: string;
  color: string;
  colorDark: string;
  height: number;
  width: number;
  lean: number;
};

type PostPayload = {
  id: string;
  title: string;
  sections: EditorialSection[];
};

type EditorialSection = {
  kind: "flow" | "chapter" | "story" | "spotlight" | "image" | "ending";
  html: string;
};

type FlipBookHandle = {
  pageFlip: () => {
    flipNext: (corner?: "top" | "bottom") => void;
    flipPrev: (corner?: "top" | "bottom") => void;
  } | undefined;
};

const chibiNarutoRunner = new URL("./assets/chibi-naruto-shelf.png", import.meta.url).href;

const books: Book[] = [
  {
    id: "post00001",
    number: "001",
    title: "ပိုကြိုးစားတိုင်း စာပိုရလာမယ်လို့ ထင်နေတုန်းပဲလား?",
    label: "ပိုကြိုးစားတိုင်း စာပိုရလာမယ်လို့  ထင်နေ ... ",
    cover: "/assets/images/post00001/cover.jpg",
    color: "#d87954",
    colorDark: "#9b4932",
    height: 196,
    width: 54,
    lean: -2,
  },
  {
    id: "post00004",
    number: "004",
    title: "စာမလုပ်ဘဲ စာရနိုင်မယ့်နည်းလမ်းရှိလား?",
    label: "စာမလုပ်ဘဲ စာရနိုင်မယ့် .. ",
    cover: "/assets/images/post00004/cover_girl_and_books.jpg",
    color: "#dea33d",
    colorDark: "#a96c23",
    height: 216,
    width: 62,
    lean: 1,
  },
  {
    id: "post00006",
    number: "006",
    title: "စာကျက်တိုင်း စာမရနေတာ ဘာကြောင့်လဲ?",
    label: "စာကျက်တိုင်း စာမရနေတာ ... ",
    cover: "/assets/images/post00006/cover_boy_with_books.jpg",
    color: "#6f8f8b",
    colorDark: "#3f6663",
    height: 187,
    width: 58,
    lean: -1,
  },
  {
    id: "post00007",
    number: "007",
    title: "Active Recall — စာကျက်ပြီး စာမရတာမျိုး မဖြစ်စေမယ့် စာလုပ်နည်း",
    label: "Active Recall စာကျက်နည်း",
    cover: "/assets/images/post00007/cover_books_and_a_girl.jpg",
    color: "#b9633f",
    colorDark: "#78402d",
    height: 207,
    width: 60,
    lean: 2,
  },
  {
    id: "post00009",
    number: "009",
    title: "စာလုပ်ချိန်နည်းနည်းနဲ့ အမှတ်များများရစေမယ့် စာလုပ်နည်း (၅) ခု",
    label: "စာလုပ်ချိန်နည်းနည်းနဲ့ အမှတ်များများ ... ",
    cover: "/assets/images/post00009/study_effectively_for_cover.jpg",
    color: "#375c68",
    colorDark: "#203e48",
    height: 224,
    width: 68,
    lean: -1,
  },

  {
    id: "post00014",
    number: "014",
    title: "စာလုပ်ဖို့ ပျင်းနေတာ သင့်အမှားမဟုတ်ဘူး",
    label: "စာလုပ်ဖို့ ပျင်းနေတာ သင့်အမှားမဟုတ်ဘူး",
    cover: "/assets/images/post00014/cover.jpg",
    color: "#80627f",
    colorDark: "#4f3a51",
    height: 202,
    width: 58,
    lean: -2,
  },
  {
    id: "post00015",
    number: "015",
    title: "စာမေးပွဲမှာ မလျှမ်းအောင် ဘယ်လိုဖြေမလဲ?",
    label: "စာမေးပွဲမှာ မလျှမ်းအောင် ဘယ်လိုဖြေမလဲ?",
    cover: "/assets/images/post00015/cover.jpg",
    color: "#82945c",
    colorDark: "#4d5d39",
    height: 214,
    width: 60,
    lean: 1,
  },
];

export default function LittleLibrary() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [hoveredBook, setHoveredBook] = useState<Book | null>(null);

  const openBook = (book: Book) => {
    setSelectedBook(book);
    window.history.pushState({ book: book.id }, "", `?book=${book.id}`);
  };

  const closeBook = () => {
    setSelectedBook(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  useEffect(() => {
    const handlePopState = () => {
      const id = new URLSearchParams(window.location.search).get("book");
      setSelectedBook(books.find((book) => book.id === id) ?? null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <main className="library-shell">
      <div className="paper-grain" aria-hidden="true" />
      <header className="library-header">
        <a className="wordmark" href="#top" aria-label="Haru's Little Library home">
          <span className="wordmark-mark">H</span>
          <span>Haru</span>
        </a>
        <p>1% Better Every Day</p>
      </header>

      <section className="library-hero" id="top">
        <p className="eyebrow">စာကျက်နည်းနှင့် ဘဝအတွေးအခေါ်များကို မျှဝေရာနေရာ</p>
        <h1>Haru&apos;s Little Library</h1>
        <br></br>
        {/* <p className="hero-note">
          စာအုပ်လေးတစ်အုပ်ကို ရွေးပါ။<br />
          တစ်မျက်နှာချင်း အေးအေးဆေးဆေး ဖတ်ကြမယ်။
        </p> */}
      </section>

      <section className="shelf-scene" aria-labelledby="shelf-title">
        <h2 id="shelf-title" className="sr-only">Choose an article from the shelf</h2>
        <div className={`book-title-card ${hoveredBook ? "is-visible" : ""}`} aria-live="polite">
          <strong>{hoveredBook?.number ?? "စာအုပ်လေးကိုဖိပြီး"}</strong>
          <span>{hoveredBook?.title ?? "ရွေးကြည့်ပါ"}</span>
        </div>

        <div className="shelf-wall">
          <div className="books-row">
            <div className="bookend bookend-left" aria-hidden="true" />
            {books.map((book) => (
              <button
                key={book.id}
                className="shelf-book"
                style={
                  {
                    "--book-color": book.color,
                    "--book-dark": book.colorDark,
                    "--book-height": `${book.height}px`,
                    "--book-width": `${book.width}px`,
                    "--book-mobile-width": `${Math.round(book.width * 0.72)}px`,
                    "--book-lean": `${book.lean}deg`,
                  } as React.CSSProperties
                }
                onMouseEnter={() => setHoveredBook(book)}
                onMouseLeave={() => setHoveredBook(null)}
                onFocus={() => setHoveredBook(book)}
                onBlur={() => setHoveredBook(null)}
                onTouchStart={() => setHoveredBook(book)}
                onClick={() => openBook(book)}
                aria-label={`Open ${book.title}`}
              >
                <span className="book-top-line" />
                <span className="book-number">{book.number}</span>
                <span className="book-spine-title">{book.label}</span>
                <span className="book-foot">HARU</span>
              </button>
            ))}
            <div className="bookend bookend-right" aria-hidden="true" />
          </div>
          <div className="shelf-runner" aria-hidden="true">
            <span className="shelf-runner-sprite">
              <img
                src={chibiNarutoRunner}
                alt=""
                draggable="false"
                decoding="async"
              />
            </span>
          </div>
          <div className="wood-shelf" aria-hidden="true">
            <span />
          </div>
        </div>
        <p className="shelf-hint"><span>↖</span> စာအုပ်ကလေကို ထိပြီးဖွင့်ပါ</p>
      </section>

      <footer className="library-footer">
        <span>အခုတော့ ၅ အုပ်ပေါ့လေ</span>
        <span className="footer-flower" aria-hidden="true">✣</span>
        <span>နောက်ကျ အများကြီးထပ်လာမယ်နော် 🙂‍↔️</span>
      </footer>

      {selectedBook && <Reader book={selectedBook} onClose={closeBook} />}
    </main>
  );
}

function Reader({ book, onClose }: { book: Book; onClose: () => void }) {
  const [payload, setPayload] = useState<PostPayload | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isOpening, setIsOpening] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const flipBookRef = useRef<FlipBookHandle | null>(null);
  const openedOnce = useRef(false);
  const [desktopPageSize, setDesktopPageSize] = useState({ width: 460, height: 650 });

  useEffect(() => {
    let cancelled = false;
    fetch(`/content/${book.id}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load this book");
        return response.json();
      })
      .then((data: PostPayload) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    const paginate = async () => {
      await document.fonts?.ready;
      if (!cancelled) {
        const contentPages = paginateEditorialSections(payload.sections, desktopPageSize);
        setPages([
          makeCoverPage(book),
          ...contentPages,
          `<section class="end-page"><span>✣</span><p>ဒီစာအုပ်လေးကိုတော့<br>ဒီမှာပဲ အဆုံးသတ်ပါမယ်။</p><small>Haru · 1% Better Every Day</small></section>`,
        ]);
        setTimeout(() => setIsOpening(false), 180);
      }
    };
    paginate();

    const handleResize = debounce(() => paginate(), 240);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [book, payload, desktopPageSize]);

  useEffect(() => {
    const updateDesktopPageSize = () => {
      if (window.innerWidth < 760) {
        setDesktopPageSize({ width: 460, height: 650 });
        return;
      }

      // Keep the full open book, controls, and header inside shorter desktop windows.
      const height = Math.max(420, Math.min(650, window.innerHeight - 158));
      setDesktopPageSize({ width: Math.round((height * 460) / 650), height: Math.round(height) });
    };

    updateDesktopPageSize();
    window.addEventListener("resize", updateDesktopPageSize);
    return () => window.removeEventListener("resize", updateDesktopPageSize);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") flipBookRef.current?.pageFlip()?.flipNext();
      if (event.key === "ArrowLeft") flipBookRef.current?.pageFlip()?.flipPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const progress = pages.length > 1 ? Math.round(((currentPage + 1) / pages.length) * 100) : 0;

  return (
    <div className={`reader-overlay ${isOpening ? "is-opening" : "is-ready"}`} role="dialog" aria-modal="true" aria-label={book.title}>
      <div className="reader-backdrop" onClick={onClose} />
      <header className="reader-toolbar">
        <button className="round-button close-reader" onClick={onClose} aria-label="Close book">×</button>
        <div className="reader-heading">
          <span>BOOK {book.number}</span>
          <strong>{book.title}</strong>
        </div>
        <div className="reader-progress" aria-label={`${progress}% read`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="flipbook-stage">
        {loadError && (
          <div className="reader-message">
            <strong>စာအုပ်ကို ဖွင့်မရသေးပါ။</strong>
            <button onClick={onClose}>စင်ဆီ ပြန်သွားမယ်</button>
          </div>
        )}
        {!loadError && pages.length === 0 && (
          <div className="reader-message loading-book"><span /><p>စာအုပ်ဖွင့်နေပါတယ်…</p></div>
        )}
        {pages.length > 0 && (
          <HTMLFlipBook
            key={`${book.id}-${pages.length}`}
            ref={flipBookRef}
            className="flipbook"
            style={{}}
            width={desktopPageSize.width}
            height={desktopPageSize.height}
            minWidth={280}
            maxWidth={desktopPageSize.width}
            minHeight={420}
            maxHeight={desktopPageSize.height}
            size="stretch"
            startPage={0}
            drawShadow
            flippingTime={780}
            usePortrait
            startZIndex={10}
            autoSize
            maxShadowOpacity={0.45}
            showCover
            mobileScrollSupport={false}
            clickEventForward
            useMouseEvents
            swipeDistance={22}
            showPageCorners
            disableFlipByClick={false}
            onFlip={(event) => setCurrentPage(event.data)}
            onInit={() => {
              if (!openedOnce.current) {
                openedOnce.current = true;
                setTimeout(() => flipBookRef.current?.pageFlip()?.flipNext("bottom"), 520);
              }
            }}
          >
            {pages.map((html, index) => (
              <BookPage key={index} html={html} pageNumber={index} isCover={index === 0 || index === pages.length - 1} />
            ))}
          </HTMLFlipBook>
        )}
      </section>

      {pages.length > 0 && (
        <nav className="reader-controls" aria-label="Book navigation">
          <button onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} disabled={currentPage === 0} aria-label="Previous page">←</button>
          <span>{Math.min(currentPage + 1, pages.length)} / {pages.length}</span>
          <button onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} disabled={currentPage >= pages.length - 1} aria-label="Next page">→</button>
        </nav>
      )}
      <p className="swipe-note">စာမျက်နှာထောင့်ကို ဆွဲပါ · သို့မဟုတ် ဘယ်ညာပွတ်ပါ</p>
    </div>
  );
}

const BookPage = forwardRef<HTMLDivElement, { html: string; pageNumber: number; isCover: boolean }>(
  function BookPage({ html, pageNumber, isCover }, ref) {
    return (
      <div ref={ref} className={`book-page ${isCover ? "book-cover-page" : ""}`} data-density={isCover ? "hard" : "soft"}>
        <div className="page-paper">
          <div className="page-content" dangerouslySetInnerHTML={{ __html: html }} />
          {!isCover && <span className="page-number">{pageNumber}</span>}
        </div>
      </div>
    );
  },
);

function makeCoverPage(book: Book) {
  return `<section class="reader-cover" style="--cover-color:${book.color};--cover-dark:${book.colorDark}">
    <span class="cover-kicker">HARU'S LITTLE LIBRARY · ${book.number}</span>
    <h1>${book.title}</h1>
    <figure><img src="${book.cover}" alt="" /></figure>
    <p>Haru</p><small>1% Better Every Day</small>
  </section>`;
}

function paginateEditorialSections(
  sections: EditorialSection[],
  desktopPageSize: { width: number; height: number },
) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const portrait = viewportWidth < 760;
  const mobileWidth = Math.min(viewportWidth - 42, 460);
  const mobileRatioHeight = mobileWidth * (650 / 460);
  const width = portrait ? mobileWidth : desktopPageSize.width;
  const height = portrait
    ? Math.max(390, Math.min(viewportHeight - 180, mobileRatioHeight))
    : desktopPageSize.height;

  const measure = document.createElement("div");
  measure.className = "page-content page-measure";
  measure.style.width = `${width}px`;
  measure.style.height = `${height}px`;
  document.body.appendChild(measure);

  const output: string[] = [];
  let pageBlocks: HTMLElement[] = [];
  let pageKind: EditorialSection["kind"] = "flow";

  const commit = (kind = pageKind) => {
    if (!pageBlocks.length) return;
    output.push(`<section class="editorial-page editorial-${kind}">${pageBlocks.map((block) => block.outerHTML).join("")}</section>`);
    pageBlocks = [];
    measure.replaceChildren();
  };

  for (const section of sections) {
    // Every editorial beat begins on a fresh page by design.
    commit();
    pageKind = section.kind;

    const holder = document.createElement("div");
    holder.innerHTML = section.html;
    holder.querySelectorAll("script, style, nav, button, iframe, form").forEach((node) => node.remove());
    const blocks = Array.from(holder.children).filter((node) => {
      const element = node as HTMLElement;
      return Boolean(element.textContent?.trim() || element.querySelector("img"));
    }) as HTMLElement[];

    for (const original of blocks) {
      const block = original.cloneNode(true) as HTMLElement;
      block.querySelectorAll("img").forEach((image) => {
        image.setAttribute("loading", "lazy");
        image.removeAttribute("width");
        image.removeAttribute("height");
      });
      measure.appendChild(block.cloneNode(true));

      if (measure.scrollHeight > measure.clientHeight && pageBlocks.length) {
        measure.lastElementChild?.remove();
        commit(section.kind);
        measure.appendChild(block.cloneNode(true));
      }
      pageBlocks.push(block);
    }

    commit(section.kind);
  }

  measure.remove();
  return output.length ? output : ["<p>ဒီစာအုပ်မှာ စာမျက်နှာ မရှိသေးပါ။</p>"];
}

function debounce<TArgs extends unknown[]>(callback: (...args: TArgs) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: TArgs) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}
