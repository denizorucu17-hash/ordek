import { useState } from "react";
import { REGIONS } from "@/lib/regions";
import { useBrowser } from "@/lib/browser-store";

export function SidePanel() {
  const open = useBrowser((state) => state.panel === "menu");
  const setPanel = useBrowser((state) => state.setPanel);
  const region = useBrowser((state) => state.region);
  const setRegion = useBrowser((state) => state.setRegion);
  const bookmarks = useBrowser((state) => state.bookmarks);
  const recents = useBrowser((state) => state.recents);
  const go = useBrowser((state) => state.go);
  const forgetLocal = useBrowser((state) => state.forgetLocal);
  const back = useBrowser((state) => state.back);
  const forward = useBrowser((state) => state.forward);
  const reload = useBrowser((state) => state.reload);
  const [armed, setArmed] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Menüyü kapat" className="absolute inset-0 bg-ink/40" onClick={() => setPanel("none")} />
      <aside className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-line bg-raised px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Menü</h2>
          <button type="button" onClick={() => setPanel("none")} className="h-11 px-3 text-sm">
            Kapat
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" onClick={back} className="h-11 rounded-full border border-line text-sm">
            Geri
          </button>
          <button type="button" onClick={forward} className="h-11 rounded-full border border-line text-sm">
            İleri
          </button>
          <button type="button" onClick={() => void reload()} className="h-11 rounded-full border border-line text-sm">
            Yenile
          </button>
        </div>

        <h3 className="mt-6 text-sm text-muted">Bölge</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {REGIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={region === item.id}
              onClick={() => setRegion(item.id)}
              className={`h-11 rounded-full px-4 text-sm ${region === item.id ? "bg-primary text-primary-ink" : "border border-line"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-sm text-muted">Yer imleri</h3>
        {bookmarks.length === 0 ? <p className="mt-2 text-sm">Henüz yok. Yıldızı kullan.</p> : null}
        <ul>
          {bookmarks.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => void go(item.target)} className="flex h-11 w-full items-center text-left">
                <span className="truncate">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-sm text-muted">Geçmiş</h3>
        {recents.length === 0 ? <p className="mt-2 text-sm">Henüz arama yok.</p> : null}
        <ul>
          {recents.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => void go(item.target)} className="flex h-11 w-full items-center text-left">
                <span className="truncate">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-sm text-muted">Kısayollar</h3>
        <p className="mt-2 text-sm leading-normal">
          Ctrl+T yeni sekme, Ctrl+W kapat, Ctrl+L adres, Ctrl+D yer imi. !w Vikipedi, !yt YouTube, !gh GitHub, !mdn
          belgeler, !osm harita.
        </p>

        <button
          type="button"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            forgetLocal();
            setArmed(false);
          }}
          className="mt-6 h-11 rounded-full border border-line text-sm"
        >
          {armed ? "Emin misin? Sil" : "Yer imlerini ve geçmişi sil"}
        </button>
      </aside>
    </div>
  );
}
