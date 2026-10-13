// app/lib/digestScheduler.server.ts
//
// Ayrı bir cron/worker altyapısı YOK (bkz. Dockerfile: tek, sürekli çalışan
// Node süreci — serverless değil) — bu yüzden zamanlama, sürecin kendi
// içinde basit bir setInterval ile yapılıyor. Her CHECK_INTERVAL_MS'de bir
// "bugün gönderilmesi gereken bir mağaza var mı?" diye bakıyor
// (runDailyDigest zaten bunu digestPreference.server.ts'teki
// lastSentDate karşılaştırmasıyla kendi içinde filtreliyor). Süreç yeniden
// başlarsa (deploy, restart) hiçbir şey kaybolmuyor — bir sonraki tick'te
// "bugün gönderilmedi" kaydı hâlâ orada, otomatik telafi ediyor.
//
// SEND_HOUR_UTC'den önce hiç göndermiyoruz — aksi halde süreç gece yarısı
// UTC'de yeniden başlarsa herkese anında (mağazanın kendi gece yarısında)
// mail gitmiş olurdu. Bu basit/kaba bir zamanlama (tüm mağazalar için tek
// saat, mağaza saat dilimine göre değil) — daha hassas bir sürüm ilerideki
// bir iyileştirme, şu an için "günde bir kez, makul bir saatten sonra"
// yeterli.

import { runDailyDigest } from "./digest.server";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 dakika
const SEND_HOUR_UTC = 8;

declare global {
    // eslint-disable-next-line no-var
    var __invfDigestSchedulerStarted: boolean | undefined;
}

function tick() {
    if (new Date().getUTCHours() < SEND_HOUR_UTC) return;
    runDailyDigest().catch((error) => console.error("[digest] runDailyDigest hata verdi:", error));
}

// Vite'ın dev sunucusunda modül HMR ile yeniden yüklenebiliyor — global
// bayrak olmadan her yeniden yüklemede bir interval daha eklenir ve
// zamanla aynı mağazaya birden fazla mail atılabilirdi.
if (!globalThis.__invfDigestSchedulerStarted) {
    globalThis.__invfDigestSchedulerStarted = true;
    setInterval(tick, CHECK_INTERVAL_MS);
    // Süreç açılışında da bir kez dene — sunucu SEND_HOUR_UTC'den sonra
    // yeniden başladıysa 15 dakika beklemeden telafi etsin.
    tick();
}
