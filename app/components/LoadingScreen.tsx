import { useEffect, useState } from "react";
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
// YENİ: tek bir sabit metin yerine, gerçek işlemi (senkronizasyon → analiz
// → hesaplama) yansıtan sırayla değişen mesajlar — bekleme süresi boyunca
// "bir şeyler oluyor" hissini canlı tutuyor (profesyonel uygulamalarda
// yaygın bir desen). Backend'den gerçek ilerleme yüzdesi almıyoruz, bu
// yüzden sabit aralıklarla döngüsel geçiş yapıyor — dürüstçe bir "tahmini
// akış", gerçek bir ilerleme çubuğu değil.
//
// Kendi <style> bloğu var çünkü bu, gerçek içerikteki PAGE_CSS render
// edilmeden ÖNCE gösteriliyor — o CSS'e güvenemez.
const LOADING_SCREEN_CSS = `
@keyframes invf-loading-spin { to { transform: rotate(360deg); } }
@keyframes invf-loading-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.invf-loading-spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid #E3E3E3;
  border-top-color: #008060;
  animation: invf-loading-spin 0.8s linear infinite;
}
.invf-loading-message {
  animation: invf-loading-fade 300ms ease;
}
`;

const MESSAGE_INTERVAL_MS = 2200;

export function LoadingScreen(props: { t: Dictionary }) {
  const { t } = props;
  const messages = [
    t.loadingMessage,
    t.loadingMessageSales,
    t.loadingMessageForecast,
    t.loadingMessageAlmostDone,
  ];
  const [index, setIndex] = useState(0);

  // Sunucu render'ında (ilk gönderilen HTML) her zaman ilk mesaj görünür —
  // döngü SADECE tarayıcıda (client), JS çalışmaya başladıktan sonra devam
  // ediyor. Bu yüzden SSR/hydration uyuşmazlığı riski yok.
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <s-page heading={t.pageHeading}>
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
        <span
          key={index}
          className="invf-loading-message"
          style={{ fontSize: 14, fontWeight: 600, color: "#5C5C5C" }}
        >
          {messages[index]}
        </span>
      </div>
    </s-page>
  );
}
