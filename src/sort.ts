import { useState } from "react";
import type { Action } from "./sheets";

export type SortKey = "manual" | "title" | "artist" | "added";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

export const SORT_LABEL: Record<SortKey, string> = {
  manual: "내가 추가한 순서",
  title: "제목",
  artist: "아티스트",
  added: "최근에 추가한 순서",
};

/** Sort choice per list, remembered on this device. */
export function useSort(storageKey: string, initial: Sort): [Sort, (s: Sort) => void] {
  const read = (): Sort => {
    try {
      const v = JSON.parse(localStorage.getItem(`owl-sort-${storageKey}`) ?? "null");
      if (v && v.key in SORT_LABEL && (v.dir === "asc" || v.dir === "desc")) return v;
    } catch {
      /* storage unavailable */
    }
    return initial;
  };
  const [sort, setSort] = useState<Sort>(read);
  const set = (s: Sort) => {
    setSort(s);
    try {
      localStorage.setItem(`owl-sort-${storageKey}`, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  };
  return [sort, set];
}

const collator = new Intl.Collator("ko", { sensitivity: "base", numeric: true });

/** Returns a sorted copy. "manual" keeps the given order (desc reverses it). */
export function sortItems<T>(items: T[], sort: Sort, get: { title: (t: T) => string; artist: (t: T) => string; added: (t: T) => number }): T[] {
  const indexed = items.map((item, i) => ({ item, i }));
  const cmp = (a: { item: T; i: number }, b: { item: T; i: number }) => {
    switch (sort.key) {
      case "title":
        return collator.compare(get.title(a.item), get.title(b.item)) || a.i - b.i;
      case "artist":
        return collator.compare(get.artist(a.item), get.artist(b.item)) || collator.compare(get.title(a.item), get.title(b.item));
      case "added":
        return get.added(a.item) - get.added(b.item) || a.i - b.i;
      default:
        return a.i - b.i;
    }
  };
  const sorted = indexed.sort(cmp).map((x) => x.item);
  return sort.dir === "desc" ? sorted.reverse() : sorted;
}

/** Actions for the sort sheet: pick a key, then the direction. */
export function sortActions(sort: Sort, setSort: (s: Sort) => void, keys: SortKey[] = ["manual", "title", "artist", "added"]): Action[] {
  return [
    ...keys.map((k) => ({ label: `${sort.key === k ? "✓ " : ""}${SORT_LABEL[k]}`, run: () => setSort({ key: k, dir: sort.dir }) })),
    { label: `${sort.dir === "asc" ? "✓ " : ""}오름차순`, run: () => setSort({ key: sort.key, dir: "asc" }) },
    { label: `${sort.dir === "desc" ? "✓ " : ""}내림차순`, run: () => setSort({ key: sort.key, dir: "desc" }) },
  ];
}
