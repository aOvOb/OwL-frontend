import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, playlistCoverUrl, type ItemInput, type PlaylistSummary } from "./api";

export type Action = { label: string; icon?: React.ReactNode; danger?: boolean; run: () => void | Promise<void> };

type Sheets = {
  /** Apple-style action sheet ("⋯" menu). */
  actions: (title: string, subtitle: string | undefined, actions: Action[]) => void;
  /** "Add to playlist" picker for one or many songs. */
  addTo: (items: ItemInput[]) => void;
  /** Text prompt (new playlist name, rename). */
  prompt: (title: string, initial: string, onOk: (value: string) => void | Promise<void>) => void;
  toast: (msg: string) => void;
};

const Ctx = createContext<Sheets | null>(null);
export const useSheets = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("SheetProvider missing");
  return v;
};

type State =
  | { kind: "none" }
  | { kind: "actions"; title: string; subtitle?: string; actions: Action[] }
  | { kind: "addTo"; items: ItemInput[] }
  | { kind: "prompt"; title: string; value: string; onOk: (v: string) => void | Promise<void> };

export function SheetProvider({ children, toast }: { children: React.ReactNode; toast: (m: string) => void }) {
  const [state, setState] = useState<State>({ kind: "none" });
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setState({ kind: "none" });
      setClosing(false);
    }, 220);
  }, []);

  const value: Sheets = {
    actions: (title, subtitle, actions) => setState({ kind: "actions", title, subtitle, actions }),
    addTo: (items) => setState({ kind: "addTo", items: items.filter((i) => i.title) }),
    prompt: (title, initial, onOk) => setState({ kind: "prompt", title, value: initial, onOk }),
    toast,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {state.kind !== "none" && (
        <div className={`sheet-backdrop ${closing ? "closing" : ""}`} onClick={close}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {state.kind === "actions" && <ActionList state={state} close={close} />}
            {state.kind === "addTo" && <AddTo items={state.items} close={close} toast={toast} setState={setState} />}
            {state.kind === "prompt" && <Prompt state={state} close={close} toast={toast} />}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

function ActionList({ state, close }: { state: Extract<State, { kind: "actions" }>; close: () => void }) {
  return (
    <>
      <div className="sheet-head">
        <div className="sheet-title">{state.title}</div>
        {state.subtitle && <div className="sheet-sub">{state.subtitle}</div>}
      </div>
      <div className="sheet-group">
        {state.actions.map((a) => (
          <button
            key={a.label}
            className={`sheet-item ${a.danger ? "danger" : ""}`}
            onClick={async () => {
              close();
              await a.run();
            }}
          >
            <span>{a.label}</span>
            {a.icon}
          </button>
        ))}
      </div>
      <button className="sheet-cancel" onClick={close}>
        취소
      </button>
    </>
  );
}

function AddTo({ items, close, toast, setState }: {
  items: ItemInput[];
  close: () => void;
  toast: (m: string) => void;
  setState: (s: State) => void;
}) {
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.myPlaylists().then(setLists, (e) => toast(e.message));
  }, [toast]);

  const missing = items.filter((i) => !i.songId).length;
  const done = (name: string) => {
    toast(missing ? `"${name}"에 추가했어요. ${missing}곡은 받는 대로 재생돼요` : `"${name}"에 추가했어요`);
    window.dispatchEvent(new Event("owl:playlists-changed"));
  };

  const addTo = async (pl: PlaylistSummary) => {
    setBusy(true);
    try {
      await api.addToPlaylist(pl.id, items);
      close();
      done(pl.name);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  const createNew = () =>
    setState({
      kind: "prompt",
      title: "새 재생목록",
      value: "",
      onOk: async (name) => {
        await api.createPlaylist(name, items);
        done(name);
      },
    });

  return (
    <>
      <div className="sheet-head">
        <div className="sheet-title">재생목록에 추가</div>
        <div className="sheet-sub">{items.length === 1 ? `${items[0].title} · ${items[0].artist}` : `${items.length}곡`}</div>
      </div>
      <div className="sheet-group scroll">
        <button className="sheet-item new" onClick={createNew} disabled={busy}>
          <span className="pl-thumb plus">+</span>
          <span>새 재생목록</span>
        </button>
        {!lists && <div className="sheet-empty">불러오는 중…</div>}
        {lists?.map((pl) => (
          <button key={pl.id} className="sheet-item pl" onClick={() => addTo(pl)} disabled={busy}>
            <PlaylistThumb pl={pl} />
            <span className="pl-text">
              <span>{pl.name}</span>
              <small>{pl.count}곡</small>
            </span>
          </button>
        ))}
      </div>
      <button className="sheet-cancel" onClick={close}>
        취소
      </button>
    </>
  );
}

function Prompt({ state, close, toast }: { state: Extract<State, { kind: "prompt" }>; close: () => void; toast: (m: string) => void }) {
  const [value, setValue] = useState(state.value);
  const [busy, setBusy] = useState(false);
  const ok = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      await state.onOk(v);
      close();
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={ok}>
      <div className="sheet-head">
        <div className="sheet-title">{state.title}</div>
      </div>
      <div className="sheet-group">
        <input className="sheet-input" autoFocus value={value} maxLength={100} placeholder="이름" onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="sheet-row">
        <button type="button" className="sheet-cancel half" onClick={close}>
          취소
        </button>
        <button className="sheet-cancel half primary" disabled={busy || !value.trim()}>
          확인
        </button>
      </div>
    </form>
  );
}

/** Custom cover, else a 2x2 mosaic of the first songs' artwork. */
export function PlaylistThumb({ pl, large = false }: { pl: PlaylistSummary | { id: string; cover: boolean; updatedAt: number; thumbnails: string[] }; large?: boolean }) {
  const custom = playlistCoverUrl(pl);
  const size = large ? 600 : 160;
  const src = (t: string) => (t.startsWith("https://") ? t : `/api/cover/${encodeURIComponent(t)}?size=${size / 2}`);
  return (
    <span className={`pl-thumb ${large ? "large" : ""}`}>
      {custom ? (
        <img src={custom} alt="" />
      ) : pl.thumbnails.length >= 4 ? (
        <span className="mosaic">
          {pl.thumbnails.slice(0, 4).map((t, i) => (
            <img key={i} src={src(t)} alt="" loading="lazy" />
          ))}
        </span>
      ) : pl.thumbnails.length ? (
        <img src={src(pl.thumbnails[0])} alt="" />
      ) : (
        <span className="pl-empty">♪</span>
      )}
    </span>
  );
}
