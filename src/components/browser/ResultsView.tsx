import { activeView, useBrowser } from "@/lib/browser-store";
import { duckIcon } from "@/lib/address";
import type { ResultsView as ResultsModel } from "@/lib/browser-store";

function weekday(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "short" });
}

export function ResultsView() {
  const view = useBrowser(activeView);
  const go = useBrowser((state) => state.go);
  const reload = useBrowser((state) => state.reload);
  if (view.type !== "results") return null;
  return <ResultsBody view={view} go={go} reload={() => void reload()} />;
}

function ResultsBody({
  view,
  go,
  reload,
}: {
  view: ResultsModel;
  go: (input: string) => Promise<void>;
  reload: () => void;
}) {
  const data = view.data;
  const empty =
    view.status === "ready" &&
    data &&
    !data.answer &&
    !data.abstract &&
    !data.weather &&
    data.hits.length === 0 &&
    data.topics.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-sm text-muted">DuckDuckGo · {view.query}</p>

      {view.status === "loading" ? (
        <div className="mt-6 space-y-3" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-2xl bg-surface" />
          <div className="h-16 animate-pulse rounded-2xl bg-surface" />
          <div className="h-16 animate-pulse rounded-2xl bg-surface" />
        </div>
      ) : null}

      {view.status === "error" ? (
        <div className="mt-6 rounded-2xl border border-line bg-raised p-5">
          <p className="text-base">{view.error}</p>
          <button type="button" onClick={reload} className="mt-4 h-11 rounded-full bg-primary px-5 text-sm text-primary-ink">
            Yeniden dene
          </button>
        </div>
      ) : null}

      {data?.weather ? (
        <section className="mt-5 rounded-2xl border border-line bg-raised p-5">
          <p className="text-sm text-muted">{data.weather.place}</p>
          <p className="font-display text-5xl leading-none text-ink">{data.weather.temp}°</p>
          <p className="mt-2 text-sm">
            {data.weather.label} · rüzgar {data.weather.wind} km/s
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {data.weather.days.map((day, index) => (
              <li key={day.date} className="rounded-xl bg-bg px-2 py-3 text-center">
                <p className="text-xs text-muted">{index === 0 ? "Bugün" : weekday(day.date)}</p>
                <p className="mt-1 text-sm">
                  {day.max}° <span className="text-muted">{day.min}°</span>
                </p>
                <p className="mt-1 text-xs text-muted">{day.label}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data?.answer ? (
        <section className="mt-5 rounded-2xl border border-line bg-raised p-5">
          <p className="text-sm text-muted">Anında yanıt</p>
          <p className="mt-1 font-display text-4xl leading-none text-ink">{data.answer}</p>
        </section>
      ) : null}

      {data?.abstract ? (
        <section className="mt-5 rounded-2xl border border-line bg-raised p-5">
          <div className="flex gap-4">
            {data.image ? (
              <img
                src={data.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-24 shrink-0 rounded-xl object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="font-display text-2xl leading-snug text-ink">{data.heading || view.query}</h2>
              {data.abstractSource ? <p className="mt-1 text-sm text-primary">{data.abstractSource}</p> : null}
            </div>
          </div>
          <p className="mt-4 line-clamp-4 text-base leading-normal">{data.abstract}</p>
          {data.infobox.length > 0 ? (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.infobox.slice(0, 4).map((row) => (
                <div key={row.label} className="border-t border-line pt-2">
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="line-clamp-2 text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {data.abstractUrl ? (
            <button
              type="button"
              onClick={() => void go(data.abstractUrl || "")}
              className="mt-4 h-11 rounded-full border border-line px-4 text-sm"
            >
              Kaynağı oku
            </button>
          ) : null}
        </section>
      ) : null}

      {data && data.topics.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {data.topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => void go(topic)}
              className="h-11 rounded-full bg-surface px-4 text-sm"
            >
              {topic}
            </button>
          ))}
        </div>
      ) : null}

      {data && data.hits.length > 0 ? (
        <ul className="mt-4">
          {data.hits.map((hit) => (
            <li key={hit.url}>
              <button
                type="button"
                onClick={() => void go(hit.url)}
                className="flex w-full gap-3 rounded-2xl px-2 py-3 text-left"
              >
                <img
                  src={duckIcon(hit.host)}
                  alt=""
                  width={16}
                  height={16}
                  referrerPolicy="no-referrer"
                  className="mt-1 size-4 shrink-0"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-xs text-primary">{hit.host}</span>
                  <span className="mt-0.5 block text-lg leading-snug">{hit.title}</span>
                  {hit.snippet ? <span className="mt-1 block text-sm leading-normal text-muted">{hit.snippet}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <p className="mt-6 text-base">
          Bu aramada anında yanıt yok. Başka bir sözcük dene ya da <span className="text-primary">!w</span> ile
          Vikipedi'ye bak.
        </p>
      ) : null}

      {view.status === "ready" && data ? (
        <p className="mt-8 text-xs text-muted">
          Anında yanıt DuckDuckGo'dan gelir. Kaynak listesi Vikipedi ve DuckDuckGo başlıklarıdır. Sayfalar okuma
          modunda açılır.
        </p>
      ) : null}
    </div>
  );
}
