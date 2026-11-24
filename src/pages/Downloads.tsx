import { useEffect, useState } from "react";
import { api, type QueuedSong } from "../api";
import { ErrorBox, Loading, Spinner, useLoad } from "../components";
import { matches } from "../filter";
import { useSheets } from "../sheets";
import { Windowed } from "../windowed";

const SOURCE: Record<QueuedSong["source"], string> = { manual: "직접 요청", playlist: "재생목록", chart: "차트", album: "앨범" };
const time = (epoch?: number | null) =>
  epoch ? new Date(epoch * 1000).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

type Tab = "queue" | "retrying" | "failed";

/** The server's download queue: what is downloading, waiting, retrying later, and failed (DLQ). */
export function Downloads({ q = "" }: { q?: string }) {
  const sheets = useSheets();
  const { data, error, reload } = useLoad(() => api.downloads(), []);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const c = data.counts;
  const run = async (p: Promise<{ count: number }>, msg: (n: number) => string) => {
    try {
      sheets.toast(msg((await p).count));
      reload();
    } catch (e) {
      sheets.toast((e as Error).message);
    }
  };

  const status = data.pausedManually
    ? "다운로드가 멈춰 있어요"
    : data.pausedUntil
      ? `유튜브가 봇 확인을 요구해서 쉬는 중이에요. ${time(data.pausedUntil)}에 다시 시작해요`
      : `${data.tunnel ? "집 인터넷" : "서버 직접"}으로 받는 중, 한 시간에 최대 ${data.ratePerHour}곡 (지난 1시간 ${data.sentLastHour}곡)`;

  const list = (tab === "queue" ? [...data.active, ...data.queued] : tab === "retrying" ? data.retrying : data.failed).filter((s) =>
    matches(q, s.title, s.artist, s.album),
  );

  // Songs in this tab that can be taken off the list (the one being downloaded right now stays).
  const clearable = list.filter((s) => s.status !== "sent");
  const tabName = tab === "queue" ? "대기열" : tab === "retrying" ? "재시도 예정 목록" : "실패 목록";
  const clearAll = () =>
    sheets.actions(`${tabName}을 비울까요?`, `${clearable.length}곡을 목록에서 빼요. 차트 곡은 다음 차트 갱신 때 다시 들어올 수 있어요.`, [
      { label: `${clearable.length}곡 모두 빼기`, danger: true, run: () => run(api.dropDownloads(clearable.map((s) => s.videoId)), (n) => `${n}곡을 뺐어요`) },
    ]);

  const menu = (s: QueuedSong) =>
    sheets.actions(s.title || s.videoId, s.artist, [
      ...(s.status === "failed" || s.status === "retrying"
        ? [{ label: "지금 다시 시도", run: () => run(api.retryDownloads([s.videoId]), () => "대기열에 다시 넣었어요") }]
        : []),
      { label: "목록에서 빼기", danger: true, run: () => run(api.dropDownloads([s.videoId]), () => "목록에서 뺐어요") },
    ]);

  return (
    <>
      <div className={`dl-status ${data.pausedUntil || data.pausedManually ? "paused" : ""}`}>{status}</div>
      <div className="dl-counts">
        <span>받는 중 {c.sent ?? 0}</span>
        <span>대기 {c.queued ?? 0}</span>
        <span>재시도 예정 {c.retrying ?? 0}</span>
        <span className="bad">실패 {c.failed ?? 0}</span>
        <span className="good">완료 {c.done ?? 0}</span>
      </div>
      <div className="segmented">
        <button className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>
          대기열
        </button>
        <button className={tab === "retrying" ? "on" : ""} onClick={() => setTab("retrying")}>
          재시도 예정
        </button>
        <button className={tab === "failed" ? "on" : ""} onClick={() => setTab("failed")}>
          실패
        </button>
      </div>
      {(tab === "failed" && data.failed.length > 0) || clearable.length > 0 ? (
        <div className="play-row">
          {tab === "failed" && data.failed.length > 0 && (
            <button className="pill big ghost" onClick={() => run(api.retryDownloads(), (n) => `${n}곡을 대기열에 다시 넣었어요`)}>
              모두 다시 시도
            </button>
          )}
          {clearable.length > 0 && (
            <button className="pill big ghost" onClick={clearAll}>
              모두 비우기
            </button>
          )}
        </div>
      ) : null}
      {list.length === 0 && (
        <p className="empty">{q ? "찾는 곡이 없어요" : tab === "queue" ? "대기 중인 곡이 없어요" : tab === "retrying" ? "재시도할 곡이 없어요" : "실패한 곡이 없어요"}</p>
      )}
      <div className="list">
        <Windowed items={list} keyOf={(s) => s.videoId}>
          {(s) => (
            <div className="row" onClick={() => menu(s)} role="button">
              <div className="row-cover">
                {s.thumbnail ? <img className="thumb" src={s.thumbnail} alt="" loading="lazy" /> : <div className="thumb" />}
              </div>
              <div className="row-text">
                <div className="row-title">{s.title || s.videoId}</div>
                <div className="row-sub">
                  {s.status === "sent"
                    ? "받는 중…"
                    : s.status === "queued"
                      ? `${s.artist}, ${SOURCE[s.source]}`
                      : s.status === "retrying"
                        ? `${s.reasonText ?? ""}, ${time(s.next_try)}에 다시 시도`
                        : `${s.reasonText ?? ""}, ${s.attempts}번 시도`}
                </div>
              </div>
              {s.status === "sent" && <Spinner />}
            </div>
          )}
        </Windowed>
      </div>
    </>
  );
}
