import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hostOf, resolveAddress } from "./address";
import { parseRegion, type RegionId } from "./regions";
import { readPage, searchWeb } from "./search.functions";
import type { ReaderPayload, SearchPayload } from "./search-types";

export type HomeView = { id: string; type: "home" };
export type ResultsView = {
  id: string;
  type: "results";
  query: string;
  status: "loading" | "ready" | "error";
  data: SearchPayload | null;
  error: string | null;
};
export type ReaderView = {
  id: string;
  type: "reader";
  url: string;
  title: string;
  status: "loading" | "ready" | "error";
  data: ReaderPayload | null;
  error: string | null;
};
export type View = HomeView | ResultsView | ReaderView;

export type Tab = {
  id: string;
  history: View[];
  cursor: number;
};

export type Bookmark = {
  id: string;
  title: string;
  target: string;
  kind: "search" | "page";
};

export type Recent = Bookmark & { at: number };

type BrowserState = {
  tabs: Tab[];
  activeId: string;
  bookmarks: Bookmark[];
  recents: Recent[];
  region: RegionId;
  panel: "none" | "menu";
  go: (input: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  reload: () => Promise<void>;
  newTab: () => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  toggleBookmark: () => void;
  setRegion: (region: RegionId) => void;
  setPanel: (panel: "none" | "menu") => void;
  forgetLocal: () => void;
};

function homeView(): HomeView {
  return { id: "view-home", type: "home" };
}

function initialTab(): Tab {
  return { id: "tab-1", history: [homeView()], cursor: 0 };
}

export function viewTitle(view: View): string {
  if (view.type === "home") return "Yeni sekme";
  if (view.type === "results") return view.query;
  return view.title || hostOf(view.url);
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Bir şeyler ters gitti.";
}

function patchView(viewId: string, patch: Partial<ResultsView> | Partial<ReaderView>) {
  useBrowser.setState((state) => ({
    tabs: state.tabs.map((tab) => ({
      ...tab,
      history: tab.history.map((view) => (view.id === viewId ? ({ ...view, ...patch } as View) : view)),
    })),
  }));
}

function pushView(tabId: string, view: View) {
  useBrowser.setState((state) => ({
    tabs: state.tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      const history = tab.history.slice(0, tab.cursor + 1);
      history.push(view);
      const trimmed = history.slice(-30);
      return { ...tab, history: trimmed, cursor: trimmed.length - 1 };
    }),
  }));
}

function remember(item: { title: string; target: string; kind: "search" | "page" }) {
  useBrowser.setState((state) => {
    const next: Recent = { ...item, id: crypto.randomUUID(), at: Date.now() };
    const recents = [next, ...state.recents.filter((recent) => recent.target !== item.target)].slice(0, 10);
    return { recents };
  });
}

async function loadReader(viewId: string, url: string) {
  try {
    const data = await readPage({ data: { url } });
    patchView(viewId, { status: "ready", data, title: data.title || hostOf(data.url), error: null });
    remember({ kind: "page", target: data.url, title: data.title || hostOf(data.url) });
  } catch (error) {
    patchView(viewId, { status: "error", error: errorText(error) });
  }
}

async function loadSearch(viewId: string, query: string, region: RegionId) {
  try {
    const data = await searchWeb({ data: { q: query, kl: region } });
    const follow =
      data.redirect && !data.answer && !data.abstract && !data.weather && data.hits.length === 0 ? data.redirect : null;
    if (follow) {
      const reader: ReaderView = {
        id: viewId,
        type: "reader",
        url: follow,
        title: hostOf(follow),
        status: "loading",
        data: null,
        error: null,
      };
      useBrowser.setState((state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          history: tab.history.map((view) => (view.id === viewId ? reader : view)),
        })),
      }));
      await loadReader(viewId, follow);
      return;
    }
    patchView(viewId, { status: "ready", data, error: null });
  } catch (error) {
    patchView(viewId, { status: "error", error: errorText(error) });
  }
}

export const useBrowser = create<BrowserState>()(
  persist(
    (set, get) => ({
      tabs: [initialTab()],
      activeId: "tab-1",
      bookmarks: [],
      recents: [],
      region: "tr-tr",
      panel: "none",
      setPanel: (panel) => set({ panel }),
      setRegion: (region) => set({ region: parseRegion(region) }),
      forgetLocal: () => set({ bookmarks: [], recents: [] }),
      selectTab: (id) => set({ activeId: id, panel: "none" }),
      newTab: () => {
        const state = get();
        if (state.tabs.length >= 8) return;
        const id = crypto.randomUUID();
        set({
          tabs: [...state.tabs, { id, history: [{ id: crypto.randomUUID(), type: "home" }], cursor: 0 }],
          activeId: id,
          panel: "none",
        });
      },
      closeTab: (id) => {
        const state = get();
        if (state.tabs.length === 1) {
          set({
            tabs: [{ id: state.tabs[0].id, history: [{ id: crypto.randomUUID(), type: "home" }], cursor: 0 }],
            panel: "none",
          });
          return;
        }
        const tabs = state.tabs.filter((tab) => tab.id !== id);
        const activeId = state.activeId === id ? tabs[Math.max(0, tabs.length - 1)].id : state.activeId;
        set({ tabs, activeId });
      },
      back: () => {
        const state = get();
        set({
          panel: "none",
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeId ? { ...tab, cursor: Math.max(0, tab.cursor - 1) } : tab,
          ),
        });
      },
      forward: () => {
        const state = get();
        set({
          panel: "none",
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeId ? { ...tab, cursor: Math.min(tab.history.length - 1, tab.cursor + 1) } : tab,
          ),
        });
      },
      toggleBookmark: () => {
        const state = get();
        const tab = state.tabs.find((item) => item.id === state.activeId);
        const view = tab?.history[tab.cursor];
        if (!view || view.type === "home") return;
        const target = view.type === "results" ? view.query : view.url;
        const kind = view.type === "results" ? "search" : "page";
        const title = view.type === "results" ? view.query : view.data?.title || view.title;
        const existing = state.bookmarks.find((bookmark) => bookmark.target === target);
        if (existing) {
          set({ bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== existing.id) });
          return;
        }
        const bookmark: Bookmark = { id: crypto.randomUUID(), title, target, kind };
        set({
          bookmarks: [bookmark, ...state.bookmarks].slice(0, 40),
        });
      },
      go: async (input) => {
        const address = resolveAddress(input);
        if (!address) return;
        const state = get();
        const tabId = state.activeId;
        set({ panel: "none" });
        if (address.kind === "read") {
          const viewId = crypto.randomUUID();
          pushView(tabId, {
            id: viewId,
            type: "reader",
            url: address.url,
            title: hostOf(address.url),
            status: "loading",
            data: null,
            error: null,
          });
          await loadReader(viewId, address.url);
          return;
        }
        const viewId = crypto.randomUUID();
        pushView(tabId, {
          id: viewId,
          type: "results",
          query: address.query,
          status: "loading",
          data: null,
          error: null,
        });
        remember({ kind: "search", target: address.query, title: address.query });
        await loadSearch(viewId, address.query, get().region);
      },
      reload: async () => {
        const state = get();
        const tab = state.tabs.find((item) => item.id === state.activeId);
        const view = tab?.history[tab.cursor];
        if (!view || view.type === "home") return;
        if (view.type === "results") {
          patchView(view.id, { status: "loading", error: null });
          await loadSearch(view.id, view.query, state.region);
          return;
        }
        patchView(view.id, { status: "loading", error: null });
        await loadReader(view.id, view.url);
      },
    }),
    {
      name: "ordek-browser",
      skipHydration: true,
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        recents: state.recents,
        region: state.region,
      }),
    },
  ),
);

export function activeTab(state: BrowserState): Tab {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0];
}

export function activeView(state: BrowserState): View {
  const tab = activeTab(state);
  return tab.history[tab.cursor] ?? tab.history[0];
}
