import type { Dictionary } from "../lib/translations";

// ---------------------------------------------------------------------------
// Yükleme ekranı — Suspense fallback olarak kullanılıyor (app._index.tsx).
// ---------------------------------------------------------------------------
// entry.server.tsx zaten "streaming" SSR'a hazır (onShellReady) — asıl
// eksik olan, YAVAŞ olabilecek veriyi (ilk Shopify senkronizasyonu) loader'da
// BEKLEMEDEN bir promise olarak döndürüp burada <Suspense>/<Await> ile
// akışla getirmekti. Bu sayede sayfa kabuğu (bu ekran) ANINDA geliyor,
// veri hazır olunca yerini gerçek içeriğe bırakıyor — önceden ilk açılışta
// veri hazır olana kadar tarayıcı bomboş kalıyordu.
//
// Kendi <style> bloğu var çünkü bu, gerçek içerikteki PAGE_CSS render
// edilmeden ÖNCE gösteriliyor — o CSS'e güvenemez.
const LOADING_SCREEN_CSS = `
@keyframes invf-loading-spin { to { transform: rotate(360deg); } }
.invf-loading-spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid #E3E3E3;
  border-top-color: #008060;
  animation: invf-loading-spin 0.8s linear infinite;
}
`;

export function LoadingScreen(props: { t: Dictionary }) {
  return (
    <s-page heading={props.t.pageHeading}>
      <style>{LOADING_SCREEN_CSS}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          minHeight: 360,
          padding: 40,
        }}
      >
        <div className="invf-loading-spinner" aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#5C5C5C" }}>
          {props.t.loadingMessage}
        </span>
      </div>
    </s-page>
  );
}
