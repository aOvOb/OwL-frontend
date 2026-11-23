import { IconSearch } from "./icons";

/** Case- and space-insensitive "contains" over a few fields (title, artist, album...). */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const want = n(q);
  return !want || fields.some((f) => f && n(f).includes(want));
}

/** Filter box for a list already on screen (Library tabs). */
export function FilterBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <form className="searchbar" onSubmit={(e) => (e.preventDefault(), (document.activeElement as HTMLElement | null)?.blur())}>
      <IconSearch size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search" type="search" />
    </form>
  );
}
