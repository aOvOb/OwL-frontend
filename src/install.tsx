import { useEffect, useState } from "react";
import { IconClose, IconKebab, IconPlus, IconShare } from "./icons";

// Shown only when OwL is open in a browser tab, not as an installed app.
// Each platform installs differently, so the banner explains the steps for the one in hand.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome, Edge and Samsung Internet fire this once, early. Catch it at load time so the button can use it later.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPrompt;
  listeners.forEach((f) => f());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((f) => f());
});

const DISMISS_KEY = "owl.install.hiddenUntil";
const HIDE_DAYS = 7;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

type Platform = "ios" | "ios-inapp" | "android" | "android-inapp" | "desktop";

function detect(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // In-app browsers (KakaoTalk, Instagram, Naver, Line, Facebook) cannot add to the home screen.
  const inapp = /KAKAOTALK|Instagram|NAVER|Line\/|FBAN|FBAV|everytimeApp|DaumApps/i.test(ua);
  if (ios) return inapp ? "ios-inapp" : "ios";
  if (/Android/.test(ua)) return inapp ? "android-inapp" : "android";
  return "desktop";
}

function hiddenNow() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [show, setShow] = useState(() => !isInstalled() && !hiddenNow());
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);
  const platform = detect();

  useEffect(() => {
    const f = () => {
      if (isInstalled()) setShow(false);
      rerender((n) => n + 1);
    };
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);

  // Desktop browsers without an install prompt (Firefox, for example) have no way to install; stay quiet there.
  if (!show || (platform === "desktop" && !deferred)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + HIDE_DAYS * 86400_000));
    } catch {
      // private mode: it just shows again next time
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") setShow(false);
    else rerender((n) => n + 1);
  };

  return (
    <div className="install" role="region" aria-label="앱 설치 안내">
      <div className="install-head">
        <img className="install-logo" src="/icons/icon-192.png" alt="" />
        <div className="install-text">
          <b>OwL을 앱으로 설치하세요</b>
          <span>홈 화면에서 바로 열고, 화면이 꽉 차게 보여요</span>
        </div>
        {deferred ? (
          <button className="install-btn" onClick={install}>
            설치
          </button>
        ) : (
          <button className="install-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "접기" : "방법"}
          </button>
        )}
        <button className="install-close" onClick={dismiss} aria-label="닫기 (7일 동안 숨김)">
          <IconClose size={18} />
        </button>
      </div>
      {open && !deferred && <Steps platform={platform} />}
    </div>
  );
}

function Steps({ platform }: { platform: Platform }) {
  if (platform === "ios-inapp" || platform === "android-inapp")
    return (
      <ol className="install-steps">
        <li>이 앱 안의 브라우저에서는 설치할 수 없어요.</li>
        <li>
          오른쪽 위나 아래의 메뉴에서 {platform === "ios-inapp" && <><b>Safari로 열기</b> 또는 </>}
          <b>다른 브라우저로 열기</b>를 누르세요.
        </li>
        <li>열린 브라우저에서 이 안내를 다시 따라 하세요.</li>
      </ol>
    );
  if (platform === "ios")
    return (
      <ol className="install-steps">
        <li>
          화면 아래(또는 주소창 옆)의 공유 버튼 <IconShare size={17} className="install-ico" />을 누르세요.
        </li>
        <li>
          목록을 내려 <b>홈 화면에 추가</b> <IconPlus size={15} className="install-ico boxed" />를 누르세요.
        </li>
        <li>
          오른쪽 위의 <b>추가</b>를 누르면 홈 화면에 OwL 아이콘이 생겨요.
        </li>
        <li className="install-note">Safari를 권장해요. 잠금 화면 재생 조작도 홈 화면 앱에서 가장 잘 동작해요.</li>
      </ol>
    );
  return (
    <ol className="install-steps">
      <li>
        브라우저 오른쪽 위의 메뉴 <IconKebab size={17} className="install-ico" />를 누르세요.
      </li>
      <li>
        <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요. 삼성 인터넷은 메뉴(≡)에서 <b>현재 페이지 추가</b> → <b>홈 화면</b>이에요.
      </li>
      <li>
        <b>설치</b>를 누르면 홈 화면에 OwL 아이콘이 생겨요.
      </li>
    </ol>
  );
}
