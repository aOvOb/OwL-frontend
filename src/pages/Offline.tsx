import { useEffect, useMemo, useState } from "react";
import { type Song } from "../api";
import { Cover, PlayButtons, SongRow, toast } from "../components";
import { cancelPending, formatBytes, removeAll, storageUse, useOffline } from "../offline";
import { useSheets } from "../sheets";
import { Windowed } from "../windowed";

/** Library > 오프라인: songs saved on this device, what is still being saved, and space used. */
export function OfflineSongs() {
  const off = useOffline();
  const sheets = useSheets();
  const [use, setUse] = useState<{ songs: number; quota: number | null; persisted: boolean } | null>(null);

  useEffect(() => {
    storageUse().then(setUse);
  }, [off.songs.length]);

  const songs: Song[] = useMemo(() => [...off.songs].sort((a, b) => b.savedAt - a.savedAt).map((s) => s.song), [off.songs]);

  const clearAll = () =>
    sheets.actions("기기에 저장한 곡을 모두 삭제할까요?", `${songs.length}곡의 파일이 이 기기에서 지워져요. 서버의 곡은 그대로예요`, [
      { label: "모두 삭제", danger: true, run: async () => (await removeAll(), toast("모두 삭제했어요")) },
    ]);

  return (
    <>
      <div className="offline-head">
        <div className="offline-stats">
          <b>{songs.length}곡</b> · {use ? formatBytes(use.songs) : "…"}
          {use?.quota ? <span className="muted"> / 사용 가능 {formatBytes(use.quota)}</span> : null}
        </div>
        {off.saving.left > 0 && (
          <div className="offline-note">
            <span className="spinner tiny" /> {off.saving.left}곡 저장 중이에요. 앱을 열어 둔 동안 저장돼요
          </div>
        )}
        {off.saving.failed > 0 && off.saving.left === 0 && <div className="offline-note warn">{off.saving.failed}곡은 저장하지 못했어요. 다시 저장해 보세요</div>}
      </div>

      {songs.length > 0 && (
        <div className="detail-head compact">
          <PlayButtons songs={songs} />
        </div>
      )}

      {off.pending.length > 0 && (
        <>
          <h3 className="sub-head">서버에 받은 뒤 저장 ({off.pending.length})</h3>
          <div className="list">
            {off.pending.map((p) => (
              <div key={p.videoId} className="row dim">
                <div className="row-cover">
                  <Cover src={p.thumbnail} size={120} rounded="sm" />
                </div>
                <div className="row-text">
                  <div className="row-title">{p.title}</div>
                  <div className="row-sub">{p.artist}</div>
                </div>
                <button className="pill small ghost" onClick={() => cancelPending(p.videoId!)}>
                  취소
                </button>
              </div>
            ))}
          </div>
          <h3 className="sub-head">저장된 곡</h3>
        </>
      )}

      {songs.length === 0 && off.saving.left === 0 && (
        <p className="empty">
          곡이나 앨범, 재생목록에서 "기기에 저장"을 누르면 인터넷 없이도 들을 수 있어요. 홈 화면에 추가한 앱에서 저장하세요
        </p>
      )}
      <div className="list">
        <Windowed items={songs} keyOf={(s) => s.id}>
          {(s, i) => <SongRow song={s} list={songs} index={i} />}
        </Windowed>
      </div>

      {songs.length > 0 && (
        <button className="pill big ghost wide danger offline-clear" onClick={clearAll}>
          기기에 저장한 곡 모두 삭제
        </button>
      )}
      {use && !use.persisted && songs.length > 0 && (
        <p className="offline-foot">저장공간이 부족해지면 기기가 저장한 곡을 지울 수 있어요. 지워진 곡은 다시 저장하면 돼요</p>
      )}
    </>
  );
}
