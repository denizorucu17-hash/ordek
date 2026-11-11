import { activeTab, useBrowser, viewTitle } from "@/lib/browser-store";
import { Mark } from "./Mark";

const STARTERS = [
  { label: "İstanbul", query: "İstanbul" },
  { label: "Türk kahvesi", query: "Türk kahvesi" },
  { label: "Hava durumu", query: "hava durumu" },
  { label: "12 × (7 + 3)", query: "12*(7+3)" },
];

export function HomeView() {
  const go = useBrowser((state) => state.go);
  const recents = useBrowser((state) => state.recents);
  const bookmarks = useBrowser((state) => state.bookmarks);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-14">
      <div className="flex items-center gap-3">
        <Mark className="size-12 shrink-0" />
        <div>
          <h1 className="font-display text-4xl leading-none text-ink">Ördek</h1>
          <p className="mt-1 text-sm text-muted">DuckDuckGo tabanlı gizlilik tarayıcısı</p>
        </div>
      </div>
      <p className="mt-6 max-w-xl text-base leading-normal text-ink">
        Araman DuckDuckGo anında yanıtına gider. Açtığın sayfa burada betiksiz ve çerezsiz okunur. Yer imleri yalnız bu
        cihazda durur.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {STARTERS.map((item) => (
          <button
            key={item.query}
            type="button"
            onClick={() => void go(item.query)}
            className="h-11 rounded-full border border-line bg-raised px-4 text-sm text-ink"
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">!w vikipedi · !yt video · !gh kod · !mdn doküman · !osm harita</p>

      {bookmarks.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">Yer imleri</h2>
          <ul className="mt-2 divide-y divide-line">
            {bookmarks.slice(0, 5).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void go(item.target)}
                  className="flex h-11 w-full items-center text-left"
                >
                  <span className="truncate">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recents.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">Son bakılanlar</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recents.slice(0, 6).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void go(item.target)}
                  className="h-11 max-w-full truncate rounded-full bg-surface px-4 text-sm"
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <TabHint />
    </div>
  );
}

function TabHint() {
  const count = useBrowser((state) => state.tabs.length);
  const title = useBrowser((state) => viewTitle(activeTab(state).history[activeTab(state).cursor]));
  return (
    <p className="mt-10 text-xs text-muted">
      {count} sekme açık · {title}. Ctrl+T yeni sekme, Ctrl+L adres çubuğu.
    </p>
  );
}
