import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { api, type AdminStatus } from "../api";
import { ErrorBox, Loading, Page } from "../components";
import { IconChevron } from "../icons";
import { APP_VERSION, BUILD_ID } from "../version";

const gb = (n?: number | null) => (n == null ? "?" : `${(n / 1024 ** 3).toFixed(n >= 100 * 1024 ** 3 ? 0 : 1)}GB`);
const mb = (n?: number | null) => (n == null ? "?" : `${(n / 1024 ** 2).toFixed(1)}MB`);

function ago(sec?: number | null) {
  if (!sec) return "기록 없음";
  const m = Math.floor((Date.now() / 1000 - sec) / 60);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d ? `${d}일 ${h}시간` : `${h}시간 ${Math.floor((s % 3600) / 60)}분`;
}

/** Names people know instead of container names. */
const SERVICE: Record<string, string> = {
  "stack-caddy-1": "웹 서버(Caddy)",
  "stack-gonic-1": "음악 서버(Gonic)",
  "stack-charts-1": "차트, 검색, 다운로드 대기열",
  "stack-yubal-1": "다운로더(Yubal)",
  "stack-pot-1": "유튜브 토큰 도우미",
  "stack-authgate-1": "관리 화면 로그인",
  "owl-blue": "앱 서버(blue)",
  "owl-green": "앱 서버(green)",
};

function Meter({ label, used, total, text }: { label: string; used: number; total: number; text: string }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="adm-meter">
      <div className="adm-meter-head">
        <span>{label}</span>
        <span className="muted">{text}</span>
      </div>
      <div className="adm-bar">
        <span className={pct >= 85 ? "bad" : pct >= 70 ? "warn" : ""} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Admin home: the server's state (refreshed every 30 seconds; the server itself writes it once a minute)
 * and the admin tools. Only shown to admin accounts; the server checks every call.
 */
export function AdminPage() {
  const [s, setS] = useState<AdminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api.adminStatus().then(
      (r) => {
        setS(r);
        setError(null);
      },
      (e) => setError((e as Error).message),
    );
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const h = s?.host;
  const stale = h ? Date.now() / 1000 - h.t > 180 : false;
  const dl = s?.downloads;
  const backupOk = h?.backup.result === "success" && !!h.backup.last && Date.now() / 1000 - h.backup.last < 30 * 3600;
  const cost = h?.cost;
  const costOk = cost && !cost.error && cost.month_cost != null && cost.month_cost <= (cost.threshold ?? 0);

  return (
    <Page title="관리" back large={false}>
      <h1 className="large-title">관리</h1>

      <div className="adm-links">
        <Link to="/admin/activity" className="adm-link">
          <span>사용자 활동</span>
          <IconChevron size={16} />
        </Link>
        <Link to="/admin/songs" className="adm-link">
          <span>곡 관리</span>
          <IconChevron size={16} />
        </Link>
        <Link to="/library?tab=downloads" className="adm-link">
          <span>
            다운로드 대기열
            {dl && (
              <span className="muted">
                {" "}
                받는 중 {(dl.counts?.sent ?? 0) + (dl.counts?.queued ?? 0)}, 재시도 {dl.counts?.retrying ?? 0}, 실패 {dl.counts?.failed ?? 0}
              </span>
            )}
          </span>
          <IconChevron size={16} />
        </Link>
      </div>

      <h2 className="adm-h">서버 상태</h2>
      {error && !s ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !s ? (
        <Loading />
      ) : (
        <>
          {!h ? (
            <p className="adm-note bad">서버 상태 기록이 없어요. 서버에서 owl-status 타이머를 확인하세요</p>
          ) : (
            <>
              <p className={`adm-note ${stale ? "bad" : "muted"}`}>
                {stale ? `상태 기록이 ${ago(h.t)}에 멈췄어요` : `${ago(h.t)} 기록`}, 서버 켜진 지 {uptime(h.uptime_s)}
              </p>

              <div className="adm-card">
                <Meter label="CPU 부하" used={h.load[0]} total={h.cpus} text={`${h.load[0].toFixed(2)} / 코어 ${h.cpus}개`} />
                <Meter
                  label="메모리"
                  used={h.memory.total - h.memory.available}
                  total={h.memory.total}
                  text={`${gb(h.memory.total - h.memory.available)} / ${gb(h.memory.total)}`}
                />
                <Meter label="디스크" used={h.disk.used} total={h.disk.total} text={`${gb(h.disk.used)} / ${gb(h.disk.total)}`} />
              </div>

              <div className="adm-card adm-rows">
                <div className="adm-row">
                  <span className={`act-dot ${costOk ? "on" : "bad"}`} />
                  <span>이번 달 요금</span>
                  <span className="adm-val">
                    {cost?.error ? "점검 오류" : cost?.month_cost != null ? `$${cost.month_cost.toFixed(2)} (기준 $${(cost.threshold ?? 0).toFixed(2)})` : "기록 없음"}
                  </span>
                </div>
                {cost?.checked && <div className="adm-sub">마지막 점검 {cost.checked}{cost.error ? `, ${cost.error}` : ""}</div>}
                <div className="adm-row">
                  <span className={`act-dot ${backupOk ? "on" : "bad"}`} />
                  <span>매일 백업</span>
                  <span className="adm-val">{h.backup.result === "success" ? "성공" : h.backup.result ? `실패(${h.backup.result})` : "기록 없음"}</span>
                </div>
                <div className="adm-sub">
                  마지막 파일 {ago(h.backup.last)}, {mb(h.backup.size)}
                </div>
                {dl && (
                  <>
                    <div className="adm-row">
                      <span className={`act-dot ${dl.tunnel ? "on" : "bad"}`} />
                      <span>집 인터넷 통로</span>
                      <span className="adm-val">{dl.tunnel ? "연결됨" : "끊김(서버에서 직접 받음)"}</span>
                    </div>
                    {(dl.pausedUntil || dl.pausedManually) && (
                      <div className="adm-row">
                        <span className="act-dot bad" />
                        <span>다운로드</span>
                        <span className="adm-val">
                          {dl.pausedManually ? "멈춤(직접 멈춤)" : `멈춤, ${new Date(dl.pausedUntil! * 1000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지`}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <h2 className="adm-h">서비스</h2>
              <div className="adm-card adm-rows">
                {h.containers.map((c) => (
                  <div key={c.name} className="adm-row">
                    <span className={`act-dot ${c.state === "running" ? "on" : "bad"}`} />
                    <span>{SERVICE[c.name] ?? c.name}</span>
                    <span className="adm-val">{c.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="adm-h">버전</h2>
          <div className="adm-card adm-rows">
            <div className="adm-row">
              <span>앱</span>
              <span className="adm-val">
                {APP_VERSION} ({BUILD_ID.slice(0, 7)})
              </span>
            </div>
            <div className="adm-row">
              <span>앱 서버</span>
              <span className="adm-val">
                {s.backend.version} ({s.backend.build})
              </span>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
