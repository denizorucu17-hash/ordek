import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { looksLikeUrl } from "@/lib/address";
import { activeView, useBrowser } from "@/lib/browser-store";
import { suggestWeb } from "@/lib/search.functions";

export function AddressBar() {
  const view = useBrowser(activeView);
  const go = useBrowser((state) => state.go);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const request = useRef(0);

  const sync =
    view.type === "results" ? `${view.id}:${view.query}` : view.type === "reader" ? `${view.id}:${view.url}` : view.id;

  useEffect(() => {
    if (document.activeElement?.id === "omnibox") return;
    if (view.type === "results") setValue(view.query);
    else if (view.type === "reader") setValue(view.url);
    else setValue("");
    setHi(-1);
    setSuggestions([]);
  }, [sync, view]);

  useEffect(() => {
    if (!focused || value.trim().length < 2 || looksLikeUrl(value)) {
      setSuggestions([]);
      return;
    }
    const current = ++request.current;
    const handle = window.setTimeout(() => {
      void suggestWeb({ data: { q: value.trim() } })
        .then((items) => {
          if (current === request.current) setSuggestions(items);
        })
        .catch(() => {
          if (current === request.current) setSuggestions([]);
        });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [value, focused]);

  function submit(next: string) {
    setSuggestions([]);
    setFocused(false);
    void go(next);
  }

  const open = focused && suggestions.length > 0;

  return (
    <form
      className="relative min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        const chosen = hi >= 0 ? suggestions[hi] : value;
        submit(chosen);
      }}
    >
      <div
        className={`flex h-11 items-center rounded-full border bg-raised ${focused ? "border-primary" : "border-line"}`}
      >
        <Search className="ml-3 size-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          id="omnibox"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setHi(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setHi(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHi((index) => Math.min(suggestions.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHi((index) => Math.max(-1, index - 1));
            } else if (event.key === "Escape") {
              setSuggestions([]);
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Ara veya adres yaz"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Adres ve arama"
          aria-autocomplete="list"
          aria-expanded={open}
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base text-ink outline-none placeholder:text-muted"
        />
      </div>
      {open ? (
        <ul className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-raised shadow-sm">
          {suggestions.map((item, index) => (
            <li key={item}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setValue(item);
                  submit(item);
                }}
                className={`flex h-11 w-full items-center gap-2 px-4 text-left text-sm ${index === hi ? "bg-bg" : ""}`}
              >
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="truncate">{item}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
