// app/lib/digest.server.ts
//
// Günlük e-posta özeti — içerik + tek-mağaza gönderim + tüm mağazalar için
// toplu çalıştırma. Zamanlama digestScheduler.server.ts'te; bu dosya SADECE
// "bir mağaza için özet oluştur ve gönder" mantığını içeriyor, ne zaman
// çalışacağını bilmiyor (ayrım, iki kaygının birbirine karışmaması için).

import prisma from "../db.server";
import shopify from "../shopify.server";
import { getForecastGroups } from "./forecastCache.server";
import { getShopsDueForDigest, markDigestSent } from "./digestPreference.server";
import { getActiveSnoozes } from "./snooze.server";
import { resolvePlanTier } from "./partnerBilling.server";
import { sendEmail, isEmailConfigured } from "./email.server";
import { resolveLocale, getDictionary, type Dictionary } from "./translations";
import { URGENT_DAYS } from "./inventory/constants";
import { buildCategoryMeta } from "./inventory/categoryMeta";

// Offline session'dan mağaza sahibinin admin dili — background job'da
// request/query parametresi olmadığı için tek kaynağımız bu (bkz. OAuth
// sırasında Session.locale'ye Shopify'ın kendisi yazıyor).
async function resolveShopLocale(shop: string): Promise<Dictionary> {
    const session = await prisma.session.findFirst({ where: { shop, isOnline: false } });
    return getDictionary(resolveLocale(session?.locale ?? null));
}

function statTile(color: { accent: string; soft: string; text: string }, label: string, value: number): string {
    return `
    <td style="padding:4px;">
      <div style="border-left:4px solid ${color.accent};background:${color.soft};border-radius:8px;padding:12px 16px;">
        <div style="font-size:22px;font-weight:800;color:${color.text};line-height:1.1;">${value}</div>
        <div style="font-size:12.5px;color:${color.text};margin-top:2px;">${label}</div>
      </div>
    </td>`;
}

function buildDigestHtml(args: {
    t: Dictionary;
    shop: string;
    outOfStockCount: number;
    soonCount: number;
    reorderAlertCount: number;
    appUrl: string;
}): string {
    const { t, outOfStockCount, soonCount, reorderAlertCount, appUrl } = args;
    const meta = buildCategoryMeta(t);
    const hasUrgent = outOfStockCount > 0 || soonCount > 0 || reorderAlertCount > 0;
    const dateText = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long" });

    const lines: string[] = [];
    if (outOfStockCount > 0) lines.push(`<p style="margin:0 0 8px;font-size:14px;color:#1A1A1A;">${t.digestEmailOutOfStockLine(outOfStockCount)}</p>`);
    if (soonCount > 0) lines.push(`<p style="margin:0 0 8px;font-size:14px;color:#1A1A1A;">${t.digestEmailSoonLine(soonCount, URGENT_DAYS)}</p>`);
    if (reorderAlertCount > 0) lines.push(`<p style="margin:0 0 8px;font-size:14px;color:#1A1A1A;">${t.digestEmailReorderLine(reorderAlertCount)}</p>`);
    if (!hasUrgent) lines.push(`<p style="margin:0 0 8px;font-size:14px;color:#1A1A1A;">${t.digestEmailAllGoodLine}</p>`);

    return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#1A1A1A;">
    <div style="font-size:13px;color:#6B6B6B;margin-bottom:4px;">${dateText}</div>
    <div style="font-size:19px;font-weight:800;margin-bottom:16px;">${t.digestEmailSubject(dateText)}</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        ${statTile(meta.out, meta.out.label, outOfStockCount)}
        ${statTile(meta.soon, meta.soon.label, soonCount)}
      </tr>
    </table>
    ${lines.join("\n")}
    <a href="${appUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#008060;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;">${t.digestEmailViewInApp}</a>
    <p style="margin-top:24px;font-size:12px;color:#9A9A9A;">${t.digestEmailFooter}</p>
  </div>`;
}

export async function sendDigestForShop(shop: string, recipient: string): Promise<void> {
    const { admin } = await shopify.unauthenticated.admin(shop);

    // Gunluk ozet premium ozellik. Kontrol GONDERIM anininda: magaza
    // tercihi acikken plani dusurmus olabilir, ya da ucretsiz bir magaza
    // dogrudan istek atip tercihi acmis olabilir. Sessizce atlaniyor.
    const { tier } = await resolvePlanTier(admin);
    if (tier !== "paid") return;
    const { groups } = await getForecastGroups(shop, admin);
    const t = await resolveShopLocale(shop);

    // Ertelenmiş ürünler e-postada da sayılmamalı. Önceden ham
    // `groups.*.length` kullanılıyordu, oysa panel ertelenenleri çıkarıyor
    // (bkz. app._index.tsx: splitSnoozed) — sonuç olarak panel "3 ürün
    // stokta yok" derken sabah gelen e-posta aynı an için "13" diyordu.
    // Mağaza sahibi bilerek "şimdilik önemseme" dediği ürünler için
    // e-posta uyarısı almaya devam etmemeli.
    const snoozes = await getActiveSnoozes(shop);
    const notSnoozed = (items: { variantId: string }[]) =>
        items.filter((f) => !snoozes.has(f.variantId)).length;

    const html = buildDigestHtml({
        t,
        shop,
        outOfStockCount: notSnoozed(groups.outOfStock),
        soonCount: notSnoozed(groups.soonToStockout),
        reorderAlertCount: notSnoozed(groups.reorderAlerts),
        appUrl: process.env.SHOPIFY_APP_URL || "",
    });

    await sendEmail({ to: recipient, subject: t.digestEmailSubject(new Date().toLocaleDateString()), html });
}

// Aynı anda İKİ tur çalışmasını engelleyen bayrak. Bu, az mağazayla asla
// görünmeyen ama mağaza sayısı arttıkça kaçınılmaz hale gelen gerçek bir
// hataydı: zamanlayıcı 15 dakikada bir tetikliyor (bkz.
// digestScheduler.server.ts), ama 100 mağazalık bir turda her mağaza için
// sırayla tahmin yenilemesi + e-posta gönderimi yapılıyor — bu rahatlıkla
// 15 dakikayı aşar. Süre aşılınca zamanlayıcı İKİNCİ bir turu başlatıyordu
// ve ikinci tur, birinci turun henüz işlemediği (dolayısıyla hâlâ "bugün
// gönderilmedi" görünen) mağazaları yeniden listeye alıp AYNI mağazaya
// ikinci kez e-posta gönderiyordu. Turlar üst üste bindikçe bu katlanarak
// artıyordu. Ödeme yapan bir müşteriye günde birkaç kez aynı e-postayı
// göndermek, kötü yorumun en kısa yolu.
let digestRunInFlight = false;

// digestScheduler.server.ts'in tetiklediği toplu çalıştırma. Bir mağazanın
// gönderimi başarısız olursa (ör. o mağaza uninstall etmiş, admin çağrısı
// hata verdi) diğerlerini ENGELLEMİYOR — hatayı loglayıp devam ediyor.
//
// Mağazalar BİLEREK sırayla (paralel değil) işleniyor: hem Shopify Admin API
// hem Resend tarafındaki oran sınırlarına takılmamak için. 100 mağaza birkaç
// dakika sürer, bu bir arka plan işi olduğu için sorun değil.
export async function runDailyDigest(): Promise<void> {
    if (!isEmailConfigured()) return; // RESEND_* env eksikse sessizce atla

    if (digestRunInFlight) {
        console.log("[digest] Önceki tur hâlâ sürüyor, bu tur atlandı.");
        return;
    }
    digestRunInFlight = true;

    try {
        const today = new Date().toISOString().slice(0, 10);
        const due = await getShopsDueForDigest(today);

        for (const { shop, recipient } of due) {
            try {
                await sendDigestForShop(shop, recipient);
                await markDigestSent(shop, today);
            } catch (error) {
                console.error(`[digest] ${shop} için gönderim başarısız:`, error);
            }
        }
    } finally {
        // finally şart: tur ortasında beklenmedik bir hata çıksa bile bayrak
        // mutlaka sıfırlanmalı, aksi halde e-posta özeti süreç yeniden
        // başlatılana kadar kalıcı olarak durur.
        digestRunInFlight = false;
    }
}
