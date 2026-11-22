import { useEffect, useState } from "react";
import { IconBack, IconClose } from "./icons";

// Shown only when OwL is open in a browser tab, not as an installed app.
// Chrome, Edge and Samsung Internet on Android (and desktop Chrome/Edge) can install with one tap.
// iPhone cannot: Safari gives web pages no way to start "Add to Home Screen", so we show a guide instead.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// The browser fires this once, early. Catch it at load time so the buttons can use it later.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPrompt;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  notify();
});

function useInstallState() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return { canPrompt: deferred !== null, installed: isInstalled() };
}

async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}

const DISMISS_KEY = "owl.install.hiddenUntil";
const HIDE_DAYS = 7;
const GUIDE_HASH = "#install";

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

type Platform = "ios" | "android" | "desktop";

function detect(): { platform: Platform; inapp: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // In-app browsers (KakaoTalk, Instagram, Naver, Line, Facebook) cannot add to the home screen.
  const inapp = /KAKAOTALK|Instagram|NAVER|Line\/|FBAN|FBAV|everytimeApp|DaumApps/i.test(ua);
  return { platform: ios ? "ios" : /Android/.test(ua) ? "android" : "desktop", inapp };
}

function hiddenNow() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

// The guide is an overlay marked by #install in the URL: a shared link opens it, the Android back button
// closes it, and the app underneath (router, player) stays mounted, so music keeps playing.
const GUIDE_EVENT = "owl:install-guide";

function openGuide() {
  history.pushState({ ...history.state, owlInstall: true }, "", location.pathname + location.search + GUIDE_HASH);
  window.dispatchEvent(new Event(GUIDE_EVENT));
}

function closeGuide() {
  if (history.state?.owlInstall) history.back();
  else {
    history.replaceState(history.state, "", location.pathname + location.search);
    window.dispatchEvent(new Event(GUIDE_EVENT));
  }
}

export function useGuideOpen() {
  const [open, setOpen] = useState(location.hash === GUIDE_HASH);
  useEffect(() => {
    const f = () => setOpen(location.hash === GUIDE_HASH);
    window.addEventListener("popstate", f);
    window.addEventListener(GUIDE_EVENT, f);
    return () => {
      window.removeEventListener("popstate", f);
      window.removeEventListener(GUIDE_EVENT, f);
    };
  }, []);
  return open;
}

export function InstallBanner() {
  const [show, setShow] = useState(() => !isInstalled() && !hiddenNow());
  const { canPrompt, installed } = useInstallState();
  const { platform } = detect();

  // Desktop browsers without an install prompt (Firefox, for example) cannot install; stay quiet there.
  if (!show || installed || (platform === "desktop" && !canPrompt)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + HIDE_DAYS * 86400_000));
    } catch {
      // private mode: it just shows again next time
    }
    setShow(false);
  };

  const install = async () => {
    if (canPrompt) {
      if (await promptInstall()) setShow(false);
    } else openGuide();
  };

  return (
    <div className="install" role="region" aria-label="앱 설치 안내">
      <div className="install-head">
        <img className="install-logo" src="/icons/icon-192.png" alt="" />
        <div className="install-text">
          <b>OwL 앱 설치</b>
          <span>홈 화면에서 바로 열고, 화면이 꽉 차게 보여요</span>
        </div>
        <button className="install-btn" onClick={install}>
          설치하기
        </button>
        <button className="install-close" onClick={dismiss} aria-label="닫기 (7일 동안 숨김)">
          <IconClose size={18} />
        </button>
      </div>
    </div>
  );
}

/* ---------- Guide page ---------- */

type Step = { text: React.ReactNode; art: React.ReactNode };

export function InstallGuide() {
  const env = detect();
  const [tab, setTab] = useState<"ios" | "android">(env.platform === "android" ? "android" : "ios");
  const { canPrompt, installed } = useInstallState();
  const [copied, setCopied] = useState(false);

  // Lock the page underneath while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const steps = tab === "ios" ? IOS_STEPS : ANDROID_STEPS;

  return (
    <div className="guide" role="dialog" aria-modal="true" aria-label="OwL 설치 방법">
      <div className="guide-top">
        <button className="guide-back" onClick={closeGuide} aria-label="뒤로">
          <IconBack size={22} />
        </button>
      </div>
      <div className="guide-hero">
        <img src="/icons/icon-192.png" alt="" />
        <h1>OwL 설치하기</h1>
        <p>홈 화면에 추가하면 앱처럼 열리고, 잠금 화면에서도 재생을 조작할 수 있어요.</p>
      </div>

      {installed && <div className="guide-callout ok">이미 앱으로 열려 있어요. 설치가 끝난 상태예요.</div>}

      {canPrompt && !installed && (
        <button className="guide-install" onClick={() => promptInstall().then((ok) => ok && closeGuide())}>
          바로 설치
        </button>
      )}

      {env.inapp && (
        <div className="guide-callout">
          <b>카카오톡 같은 앱 안에서 열었어요.</b> 여기서는 설치할 수 없어요. 오른쪽 위(또는 아래)의 메뉴에서{" "}
          <b>{env.platform === "ios" ? "Safari로 열기" : "다른 브라우저로 열기"}</b>를 누른 뒤 아래 순서를 따라 하세요.
          <button className="guide-copy" onClick={copy}>
            {copied ? "주소를 복사했어요" : "주소 복사"}
          </button>
        </div>
      )}

      <div className="guide-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "ios"} onClick={() => setTab("ios")}>
          아이폰
        </button>
        <button role="tab" aria-selected={tab === "android"} onClick={() => setTab("android")}>
          안드로이드
        </button>
      </div>

      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <div className="guide-num">{i + 1}</div>
            <div className="guide-body">
              <p>{s.text}</p>
              <div className="guide-art">{s.art}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="guide-foot">
        {tab === "ios"
          ? "iOS 18 이하에서는 Safari 아래쪽 도구 막대에 공유 버튼(네모에 위쪽 화살표)이 바로 있어요. 그 버튼을 누르고 3번부터 따라 하세요. 공유 화면에 홈 화면에 추가가 없으면 맨 아래 작업 편집(Edit Actions)에서 켜세요. 휴대폰이 영어로 설정돼 있으면 괄호 안의 영어 이름을 찾으면 돼요."
          : "삼성 인터넷은 아래쪽 메뉴(≡)에서 현재 페이지 추가 → 홈 화면을 누르세요."}
      </p>
    </div>
  );
}

/* ---------- Illustrations ----------
   Simple drawings of the browser screens (not real captures), with the button to tap circled in red. */

const W = 300;
const RED = "#e0414a";
const Phone = ({ h, children }: { h: number; children: React.ReactNode }) => (
  <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-hidden className="guide-svg">
    <rect x="0.5" y="0.5" width={W - 1} height={h - 1} rx="18" fill="#1c1c1e" stroke="#3a3a3c" />
    {children}
  </svg>
);
const Ring = ({ x, y, w, h, r = 10 }: { x: number; y: number; w: number; h: number; r?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={RED} strokeWidth="3" />
);
const Tap = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle cx={x} cy={y} r="14" fill={RED} opacity="0.25" />
    <circle cx={x} cy={y} r="6" fill={RED} />
  </g>
);
const T = ({ x, y, s = 13, c = "#f2f2f7", w = 400, a = "start", children }: { x: number; y: number; s?: number; c?: string; w?: number; a?: "start" | "middle" | "end"; children: React.ReactNode }) => (
  <text x={x} y={y} fontSize={s} fill={c} fontWeight={w} textAnchor={a} fontFamily="-apple-system, system-ui, sans-serif">
    {children}
  </text>
);
const ShareGlyph = ({ x, y, c = "#0a84ff" }: { x: number; y: number; c?: string }) => (
  <path transform={`translate(${x - 12} ${y - 12})`} d="M12 3v12M8 7l4-4 4 4M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
);
const PlusBox = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x - 10} ${y - 10})`} fill="none" stroke="#f2f2f7" strokeWidth="1.6">
    <rect x="1" y="1" width="18" height="18" rx="4" />
    <path d="M10 5.5v9M5.5 10h9" strokeLinecap="round" />
  </g>
);
const PageLines = ({ y }: { y: number }) => (
  <g fill="#2c2c2e">
    <rect x="20" y={y} width="180" height="10" rx="5" />
    <rect x="20" y={y + 20} width="240" height="10" rx="5" />
    <rect x="20" y={y + 40} width="210" height="10" rx="5" />
  </g>
);

/** A menu row: Korean label on the left, the English label (for phones set to English) in grey on the right. */
const MenuRow = ({ y, ko, en, x = 58, right = W - 58, bold }: { y: number; ko: string; en: string; x?: number; right?: number; bold?: boolean }) => (
  <>
    <T x={x} y={y} w={bold ? 600 : 400}>
      {ko}
    </T>
    <T x={right} y={y} s={10.5} c="#8e8e93" a="end">
      {en}
    </T>
  </>
);

const IOS_STEPS: Step[] = [
  {
    text: (
      <>
        Safari 맨 아래 주소창 왼쪽 끝의 <b>≡</b>(줄 세 개) 버튼을 누르세요. 화면 배치에 따라 <b>⋯</b>(점 세 개) 버튼일 수도 있어요.
      </>
    ),
    art: (
      <Phone h={140}>
        <PageLines y={24} />
        {/* back/forward pill */}
        <rect x="12" y="88" width="66" height="40" rx="20" fill="#2c2c2e" />
        <g fill="none" stroke="#f2f2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M34 100l-7 8 7 8" opacity="0.4" />
          <path d="M56 100l7 8-7 8" />
        </g>
        {/* address pill: page menu, domain, reload */}
        <rect x="86" y="88" width={W - 148} height="40" rx="20" fill="#2c2c2e" />
        <g stroke="#f2f2f7" strokeWidth="2" strokeLinecap="round">
          <path d="M101 101h14M101 108h14M101 115h10" />
        </g>
        <T x={124} y={113} c="#d1d1d6" s={12}>
          aovob7.duckdns.org
        </T>
        <path d={`M${W - 76} 103a6 6 0 1 0 2 5`} fill="none" stroke="#f2f2f7" strokeWidth="1.8" strokeLinecap="round" />
        {/* tabs button */}
        <circle cx={W - 30} cy="108" r="20" fill="#2c2c2e" />
        <g fill="none" stroke="#f2f2f7" strokeWidth="1.8">
          <rect x={W - 36} y="102" width="12" height="12" rx="3" />
          <path d={`M${W - 32} 99h7a3 3 0 0 1 3 3v7`} />
        </g>
        <Ring x={88} y={88} w={40} h={40} r={20} />
        <Tap x={118} y={124} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        열린 메뉴에서 <b>공유</b>(Share)를 누르세요.
      </>
    ),
    art: (
      <Phone h={196}>
        <rect x="16" y="12" width={W - 32} height="172" rx="22" fill="#2c2c2e" />
        <MenuRow y={42} ko="웹사이트 번역" en="Translate Website" x={64} right={W - 34} />
        <line x1="34" y1="58" x2={W - 34} y2="58" stroke="#3a3a3c" />
        <ShareGlyph x={44} y={80} c="#f2f2f7" />
        <MenuRow y={86} ko="공유" en="Share" x={64} right={W - 34} bold />
        <MenuRow y={122} ko="책갈피에 추가" en="Add to Bookmarks" x={64} right={W - 34} />
        <MenuRow y={158} ko="페이지에서 찾기" en="Find on Page" x={64} right={W - 34} />
        <Ring x={22} y={62} w={W - 44} h={38} />
        <Tap x={140} y={88} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        공유 화면을 위로 끌어올리거나 아래로 내려서 <b>홈 화면에 추가</b>(Add to Home Screen)를 누르세요.
      </>
    ),
    art: (
      <Phone h={210}>
        <rect x="14" y="14" width={W - 28} height="44" rx="12" fill="#2c2c2e" />
        <image href="/icons/icon-192.png" x="24" y="22" width="28" height="28" />
        <T x={62} y={34} w={600}>
          OwL
        </T>
        <T x={62} y={50} s={11} c="#8e8e93">
          owl.aovob7.duckdns.org
        </T>
        <rect x="14" y="68" width={W - 28} height="128" rx="12" fill="#2c2c2e" />
        <MenuRow y={95} ko="복사" en="Copy" x={28} />
        <line x1="28" y1="110" x2={W - 14} y2="110" stroke="#3a3a3c" />
        <MenuRow y={137} ko="읽기 목록에 추가" en="Add to Reading List" x={28} />
        <line x1="28" y1="152" x2={W - 14} y2="152" stroke="#3a3a3c" />
        <MenuRow y={179} ko="홈 화면에 추가" en="Add to Home Screen" x={28} right={W - 62} bold />
        <PlusBox x={W - 38} y={174} />
        <Ring x={16} y={155} w={W - 32} h={38} />
        <Tap x={W - 38} y={186} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        오른쪽 위의 <b>추가</b>(Add)를 누르세요.
      </>
    ),
    art: (
      <Phone h={150}>
        <T x={22} y={36} c="#0a84ff">
          취소
        </T>
        <T x={W / 2} y={36} a="middle" w={600}>
          홈 화면에 추가
        </T>
        <T x={W - 22} y={36} a="end" c="#0a84ff" w={600}>
          추가
        </T>
        <Ring x={W - 64} y={16} w={52} h={30} />
        <Tap x={W - 38} y={44} />
        <rect x="14" y="62" width={W - 28} height="72" rx="12" fill="#2c2c2e" />
        <image href="/icons/icon-192.png" x="26" y="72" width="52" height="52" />
        <T x={92} y={94} w={600}>
          OwL
        </T>
        <T x={92} y={114} s={11} c="#8e8e93">
          https://owl.aovob7.duckdns.org/
        </T>
      </Phone>
    ),
  },
  {
    text: (
      <>
        홈 화면에 생긴 <b>OwL</b> 아이콘으로 여세요. 처음 한 번은 다시 로그인해야 할 수 있어요.
      </>
    ),
    art: <HomeScreen />,
  },
];

const ANDROID_STEPS: Step[] = [
  {
    text: (
      <>
        크롬 오른쪽 위의 <b>⋮</b>(점 세 개) 메뉴를 누르세요.
      </>
    ),
    art: (
      <Phone h={140}>
        <rect x="14" y="16" width={W - 64} height="34" rx="17" fill="#2c2c2e" />
        <T x={34} y={38} c="#d1d1d6">
          owl.aovob7.duckdns.org
        </T>
        <g fill="#f2f2f7">
          <circle cx={W - 28} cy="25" r="2.4" />
          <circle cx={W - 28} cy="33" r="2.4" />
          <circle cx={W - 28} cy="41" r="2.4" />
        </g>
        <Ring x={W - 46} y={13} w={36} h={40} />
        <Tap x={W - 20} y={50} />
        <PageLines y={74} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.
      </>
    ),
    art: (
      <Phone h={200}>
        <rect x="110" y="12" width={W - 122} height="176" rx="10" fill="#2c2c2e" />
        <T x={126} y={42}>새 탭</T>
        <T x={126} y={76}>기록</T>
        <T x={126} y={110}>다운로드</T>
        <T x={126} y={144} w={600}>
          홈 화면에 추가
        </T>
        <T x={126} y={176}>설정</T>
        <Ring x={114} y={122} w={W - 130} h={34} />
        <Tap x={W - 40} y={148} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        <b>설치</b>(또는 <b>추가</b>)를 누르세요.
      </>
    ),
    art: (
      <Phone h={170}>
        <rect x="24" y="16" width={W - 48} height="138" rx="18" fill="#2c2c2e" />
        <T x={44} y={46} s={15} w={600}>
          앱 설치
        </T>
        <image href="/icons/icon-192.png" x="44" y="62" width="40" height="40" />
        <T x={96} y={80} w={600}>
          OwL
        </T>
        <T x={96} y={96} s={11} c="#8e8e93">
          owl.aovob7.duckdns.org
        </T>
        <T x={W - 120} y={136} c="#8ab4f8">
          취소
        </T>
        <T x={W - 64} y={136} c="#8ab4f8" w={600}>
          설치
        </T>
        <Ring x={W - 76} y={116} w={46} h={30} />
        <Tap x={W - 44} y={146} />
      </Phone>
    ),
  },
  {
    text: (
      <>
        홈 화면(또는 앱 목록)에 생긴 <b>OwL</b> 아이콘으로 여세요.
      </>
    ),
    art: <HomeScreen />,
  },
];

function HomeScreen() {
  const cells = [0, 1, 2, 3, 4, 5, 6];
  return (
    <Phone h={162}>
      {cells.map((i) => (
        <rect key={i} x={30 + (i % 4) * 64} y={22 + Math.floor(i / 4) * 66} width="44" height="44" rx="11" fill="#2c2c2e" />
      ))}
      <image href="/icons/icon-192.png" x={30 + 3 * 64} y={88} width="44" height="44" style={{ clipPath: "inset(0 round 11px)" }} />
      <T x={30 + 3 * 64 + 22} y={152} s={11} a="middle">
        OwL
      </T>
      <Ring x={30 + 3 * 64 - 6} y={82} w={56} h={56} r={14} />
    </Phone>
  );
}
