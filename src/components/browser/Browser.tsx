import { ArrowLeft, ArrowRight, Menu, Plus, RotateCw, Star, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { activeTab, activeView, useBrowser, viewTitle } from "@/lib/browser-store";
import { AddressBar } from "./AddressBar";
import { HomeView } from "./HomeView";
import { ReaderView } from "./ReaderView";
import { ResultsView } from "./ResultsView";
import { SidePanel } from "./SidePanel";

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-ink disabled:text-muted"
    >
      {children}
    </button>
  );
}

export function Browser() {
  const tabs = useBrowser((state) => state.tabs);
  const activeId = useBrowser((state) => state.activeId);
  const view = useBrowser(activeView);
  const canBack = useBrowser((state) => activeTab(state).cursor > 0);
  const canForward = useBrowser((state) => {
    const tab = activeTab(state);
    return tab.cursor < tab.history.length - 1;
  });
  const loading = useBrowser((state) => {
    const current = activeView(state);
    return current.type !== "home" && current.status === "loading";
  });
  const bookmarked = useBrowser((state) => {
    const current = activeView(state);
    if (current.type === "home") return false;
    const target = current.type === "results" ? current.query : current.url;
    return state.bookmarks.some((bookmark) => bookmark.target === target);
  });
  const back = useBrowser((state) => state.back);
  const forward = useBrowser((state) => state.forward);
  const reload = useBrowser((state) => state.reload);
  const newTab = useBrowser((state) => state.newTab);
  const closeTab = useBrowser((state) => state.closeTab);
  const selectTab = useBrowser((state) => state.selectTab);
  const toggleBookmark = useBrowser((state) => state.toggleBookmark);
  const setPanel = useBrowser((state) => state.setPanel);

  useEffect(() => {
    void useBrowser.persist.rehydrate();
    function onKey(event: KeyboardEvent) {
      const state = useBrowser.getState();
      const meta = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const key = event.key.toLowerCase();
      if (meta && key === "t") {
        event.preventDefault();
        state.newTab();
      } else if (meta && key === "w") {
        event.preventDefault();
        state.closeTab(state.activeId);
      } else if (meta && key === "l") {
        event.preventDefault();
        document.getElementById("omnibox")?.focus();
      } else if (meta && key === "d") {
        event.preventDefault();
        state.toggleBookmark();
      } else if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        state.back();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        state.forward();
      } else if (event.key === "Escape") {
        state.setPanel("none");
      } else if (!typing && event.key === "/") {
        event.preventDefault();
        document.getElementById("omnibox")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const title = viewTitle(view);
    document.title = title === "Yeni sekme" ? "Ördek" : `${title} · Ördek`;
  }, [view]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink">
      <div className="tabs flex items-end gap-1 overflow-x-auto bg-bg px-2 pt-2">
        {tabs.map((tab) => {
          const current = tab.history[tab.cursor];
          const title = viewTitle(current);
          const active = tab.id === activeId;
          return (
            <div key={tab.id} className={`flex h-11 shrink-0 items-center rounded-t-lg ${active ? "bg-surface" : ""}`}>
              <button
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`max-w-40 truncate px-3 text-sm ${active ? "text-ink" : "text-muted"}`}
                title={title}
              >
                {title}
              </button>
              <button
                type="button"
                aria-label={`${title} sekmesini kapat`}
                onClick={() => closeTab(tab.id)}
                className="mr-1 grid size-9 place-items-center rounded-full text-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
        <button type="button" aria-label="Yeni sekme" onClick={newTab} className="grid size-11 shrink-0 place-items-center">
          <Plus className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-line bg-surface px-1 py-1 sm:px-2">
        <IconButton label="Geri" disabled={!canBack} onClick={back}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="hidden sm:contents">
          <IconButton label="İleri" disabled={!canForward} onClick={forward}>
            <ArrowRight className="size-5" />
          </IconButton>
          <IconButton label="Yenile" onClick={() => void reload()}>
            <RotateCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
          </IconButton>
        </span>
        <AddressBar />
        <IconButton label={bookmarked ? "Yer imini kaldır" : "Yer imi"} onClick={toggleBookmark}>
          <Star className={`size-5 ${bookmarked ? "fill-bill text-bill" : ""}`} />
        </IconButton>
        <IconButton label="Menü" onClick={() => setPanel("menu")}>
          <Menu className="size-5" />
        </IconButton>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {view.type === "home" ? <HomeView /> : null}
        {view.type === "results" ? <ResultsView /> : null}
        {view.type === "reader" ? <ReaderView /> : null}
      </main>
      <SidePanel />
    </div>
  );
}
