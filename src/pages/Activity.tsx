import { useCallback, useEffect, useState } from "react";
import { api, type ActivityEvent, type ActivitySummary, type UserActivity } from "../api";
import { ErrorBox, Loading, Page } from "../components";

const RANGES = [
  { days: 1, label: "오늘" },
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
];

/** "방금", "5분 전", "3시간 전", "2일 전", or a date for older ones. */
function ago(t?: number | null) {
  if (!t) return "기록 없음";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

const time = (t: number) =>
  new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function describe(e: ActivityEvent) {
  const song = [e.title, e.artist].filter(Boolean).join(", ");
  switch (e.type) {
    case "play":
      return `재생: ${song || e.songId}`;
    case "download":
      return (e.count ?? 1) > 1 ? `다운로드 요청 ${e.count}곡: ${song} 외` : `다운로드 요청: ${song || "링크"}`;
    case "login":
      return "로그인";
    default:
      return e.type;
  }
}

/**
 * Admin page: what each account has been doing. Recorded by the backend: logins, app use (at most once
 * per 30 minutes), songs started and download requests. Kept for three months. Refreshes every 30 seconds.
 */
export function AdminActivityPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminActivity(days).then(
      (r) => {
        setData(r);
        setError(null);
      },
      (e) => setError((e as Error).message),
    );
  }, [days]);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Page title="사용자 활동" back large={false}>
      <h1 className="large-title">사용자 활동</h1>
      <div className="segmented">
        {RANGES.map((r) => (
          <button key={r.days} className={days === r.days ? "on" : ""} onClick={() => setDays(r.days)}>
            {r.label}
          </button>
        ))}
      </div>
      {error && !data ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <p className="admin-count">
            계정 {data.users.length}개, 지금 사용 중 {data.users.filter(online).length}명. 재생은 곡을 처음부터 틀 때 셉니다
          </p>
          {data.users.length === 0 && <p className="empty">아직 기록된 활동이 없어요</p>}
          {data.users.map((u) => (
            <UserCard key={u.username} u={u} days={data.days} open={open === u.username} onToggle={() => setOpen(open === u.username ? null : u.username)} />
          ))}
        </>
      )}
    </Page>
  );
}

const online = (u: UserActivity) => !!u.lastSeen && Date.now() - u.lastSeen < 10 * 60_000;

function UserCard({ u, days, open, onToggle }: { u: UserActivity; days: number; open: boolean; onToggle: () => void }) {
  const max = Math.max(1, ...u.daily);
  return (
    <div className="act-card" role="button" onClick={onToggle}>
      <div className="act-head">
        <span className={`act-dot ${online(u) ? "on" : ""}`} />
        <span className="act-name">{u.username}</span>
        <span className="act-seen">{online(u) ? "사용 중" : ago(u.lastSeen)}</span>
      </div>
      {u.nowPlaying && <div className="act-now">♪ {[u.nowPlaying.title, u.nowPlaying.artist].filter(Boolean).join(", ")}</div>}
      <div className="act-stats">
        <span>
          재생 <b>{u.plays}</b>
        </span>
        <span>
          다운로드 <b>{u.downloads}</b>
        </span>
        <span>
          활동한 날 <b>{u.activeDays}</b>/{days}
        </span>
      </div>
      {days > 1 && (
        <div className="act-bars" aria-label="날짜별 재생 수">
          {u.daily.map((n, i) => (
            <span key={i} style={{ height: `${Math.max(n ? 12 : 4, (n / max) * 100)}%` }} className={n ? "" : "zero"} title={`${n}곡`} />
          ))}
        </div>
      )}
      {u.topArtists.length > 0 && (
        <div className="act-artists">
          {u.topArtists.map((a) => (
            <span key={a.name}>
              {a.name} {a.count}
            </span>
          ))}
        </div>
      )}
      {open && (
        <ul className="act-recent" onClick={(e) => e.stopPropagation()}>
          {u.recent.length === 0 && <li className="muted">이 기간에 기록이 없어요</li>}
          {u.recent.map((e, i) => (
            <li key={i}>
              <span className="act-time">{time(e.t)}</span>
              <span>{describe(e)}</span>
            </li>
          ))}
          {u.lastLogin && <li className="muted">마지막 로그인 {ago(u.lastLogin)}</li>}
        </ul>
      )}
    </div>
  );
}
