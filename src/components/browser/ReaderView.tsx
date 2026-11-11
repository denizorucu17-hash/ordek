import { useState } from "react";
import { hostOf, isLimitedHost } from "@/lib/address";
import { activeView, useBrowser } from "@/lib/browser-store";

export function ReaderView() {
  const view = useBrowser(activeView);
  const go = useBrowser((state) => state.go);
  const reload = useBrowser((state) => state.reload);
  const [copied, setCopied] = useState(false);
  if (view.type !== "reader") return null;
  const limited = isLimitedHost(view.url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(view.type === "reader" ? view.url : "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-sm text-primary">{hostOf(view.url)}</p>
      <h1 className="mt-1 font-display text-3xl leading-snug text-ink">{view.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>Okuma modu · betikler ve çerezler yüklenmedi</span>
        <button type="button" onClick={() => void copy()} className="h-11 rounded-full border border-line px-4 text-ink">
          {copied ? "Kopyalandı" : "Adresi kopyala"}
        </button>
      </div>

      {view.status === "loading" ? <div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface" /> : null}

      {view.status === "error" ? (
        <div className="mt-6 rounded-2xl border border-line bg-raised p-5">
          <p>{view.error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 h-11 rounded-full bg-primary px-5 text-sm text-primary-ink"
          >
            Yeniden dene
          </button>
        </div>
      ) : null}

      {limited ? (
        <p className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm leading-normal text-muted">
          Bu site uygulamasını okuma modu sadeleştiremez. Adresi kopyalayıp kendi tarayıcında açabilirsin.
        </p>
      ) : null}

      {view.data?.thin && view.status === "ready" && !limited ? (
        <p className="mt-5 text-sm text-muted">Bu sayfa okunabilir bir metin vermedi.</p>
      ) : null}

      {view.data?.html ? (
        <div
          className="read mt-6 overflow-x-auto"
          onClick={(event) => {
            const anchor = (event.target as HTMLElement).closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href) return;
            event.preventDefault();
            void go(href);
          }}
          dangerouslySetInnerHTML={{ __html: view.data.html }}
        />
      ) : null}
    </article>
  );
}
