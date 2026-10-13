// app/lib/partnerBilling.server.ts
//
// Shopify App Pricing entegrasyonu — planlar/fiyat/deneme süresi KOD İÇİNDE
// DEĞİL, Partner Dashboard'da tanımlı (bkz. shopify.dev/docs/apps/launch/
// billing/shopify-app-pricing). Bu dosya sadece "bu mağazanın aktif bir
// aboneliği var mı?" sorusunu Partner API üzerinden soruyor — appSubscriptionCreate
// / billing.request GİBİ Billing API çağrıları BİLEREK YOK, Shopify yeni
// public app'ler için bunları artık "legacy" sayıyor.
//
// Gerekli iki ortam değişkeni (Partner Dashboard'dan tek seferlik alınır):
//   SHOPIFY_PARTNER_ORG_ID           — Partner Dashboard URL'sindeki organizasyon ID'si
//   SHOPIFY_PARTNER_API_ACCESS_TOKEN — "Manage apps" izinli bir Partner API client token'ı
// App'in kendi GID'i ve handle'ı ELLE girilmiyor — her istekte zaten çekilen
// admin GraphQL client'ından `{ app { id handle } }` ile dinamik alınıyor,
// bu yüzden yanlış/eski bir handle yüzünden TÜM mağazalar için bozuk bir
// yönlendirme riski yok.

const PARTNER_API_VERSION = "2026-07";

type Admin = {
    graphql: (
        query: string,
        options?: { variables?: Record<string, unknown> },
    ) => Promise<{ json: () => Promise<any> }>;
};

export function isBillingConfigured(): boolean {
    return Boolean(process.env.SHOPIFY_PARTNER_ORG_ID && process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN);
}

const APP_AND_SHOP_QUERY = `#graphql
  query InvfAppAndShop {
    app {
      id
      handle
    }
    shop {
      id
    }
  }`;

export async function fetchAppAndShopIds(admin: Admin): Promise<{ appId: string; appHandle: string; shopId: string }> {
    const res = await admin.graphql(APP_AND_SHOP_QUERY);
    const { data } = await res.json();
    if (!data?.app?.id || !data?.app?.handle || !data?.shop?.id) {
        throw new Error("App/shop ID sorgusu beklenen alanları döndürmedi.");
    }
    return { appId: data.app.id, appHandle: data.app.handle, shopId: data.shop.id };
}

const ACTIVE_SUBSCRIPTION_QUERY = `
  query ($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      trialEndsAt
    }
  }`;

export type ActiveSubscription = { billingPeriod: string; trialEndsAt: string | null } | null;

// Partner API'ye her sayfa yüklemesinde gitmek yerine (gereksiz gecikme +
// rate limit riski), kısa süreli bellek-içi önbellek — forecastCache.server.ts'teki
// TTL felsefesiyle aynı: hafif bayatlık, tam kilit/dağıtık garanti yok, tek
// sunuculu ölçekte pragmatik bir çözüm.
//
// "Abonelik yok" (null) sonucu SADECE 15 saniye önbellekleniyor, "aktif
// abonelik var" sonucu tam 10 dakika: bir mağaza sahibi plan seçim
// sayfasına yönlendirilip ÖDEME YAPTIKTAN hemen sonra uygulamaya geri
// dönerse, eski (10 dk'lık) tek bir TTL onu "abonelik yok" önbelleğine
// tekrar tekrar çarptırıp az önce ödeme yapmış birini yeniden plan
// sayfasına yönlendiriyordu (kötü bir ilk izlenim). Pozitif sonucu hâlâ
// uzun süre önbelleklemek güvenli — bir abonelik iptal edilmediği sürece
// aktif kalır, sık sık değişmez.
const POSITIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 15 * 1000;
const subscriptionCache = new Map<string, { result: ActiveSubscription; checkedAt: number }>();

export async function fetchActiveSubscription(appId: string, shopId: string): Promise<ActiveSubscription> {
    const cached = subscriptionCache.get(shopId);
    if (cached) {
        const ttl = cached.result ? POSITIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
        if (Date.now() - cached.checkedAt < ttl) return cached.result;
    }

    const orgId = process.env.SHOPIFY_PARTNER_ORG_ID;
    const token = process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;

    const res = await fetch(`https://partners.shopify.com/${orgId}/api/${PARTNER_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token as string,
        },
        body: JSON.stringify({
            query: ACTIVE_SUBSCRIPTION_QUERY,
            variables: { appId, shopId },
        }),
    });
    const { data, errors } = await res.json();

    // Bilerek burada "abonelik yok" varsaymıyoruz — throttling/geçici hata
    // durumunda ödeme yapan bir mağazayı yanlışlıkla dışarı atmamak için
    // hatayı fırlatıyoruz; çağıran taraf (app.tsx) bunu "fail open" (erişime
    // izin ver) olarak ele alıyor, "fail closed" değil.
    if (!res.ok || errors) {
        throw new Error(`Partner API isteği başarısız: ${JSON.stringify(errors ?? res.status)}`);
    }

    const result: ActiveSubscription = data.activeSubscription;
    subscriptionCache.set(shopId, { result, checkedAt: Date.now() });
    return result;
}

// Shopify App Pricing'in barındırdığı plan seçim sayfası — merchant burada
// planı onaylıyor, biz hiçbir zaman appSubscriptionCreate çağırmıyoruz.
export function planSelectionUrl(storeHandle: string, appHandle: string): string {
    return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

export type PlanTier = "free" | "paid";

// ---------------------------------------------------------------------------
// ÜCRETSİZ KATMAN
//
// Mimari kararı: ücretsiz katman Partner Dashboard'da BİR PLAN DEĞİL.
// Orada tek bir ücretli plan tanımlı ($24/ay + 30 gün deneme); aboneliği
// olmayan mağaza otomatik olarak ücretsiz katmanda sayılıyor. Bunun iki
// pratik faydası var:
//   1. "Aboneliği var mı?" sorusu tek bir evet/hayır — plan adı/fiyatı
//      string olarak eşleştirmeye gerek yok, Partner Dashboard'da plan adı
//      değiştiğinde kod sessizce bozulmuyor.
//   2. Ücretsiz kullanıcı hiçbir onay ekranından geçmeden uygulamayı
//      kullanmaya başlıyor — bu kategoride kurulum hacmi (dolayısıyla ilk
//      yorumlar) bununla geliyor.
//
// Aboneliği olmayan mağaza artık plan sayfasına YÖNLENDİRİLMİYOR (eski
// davranış); sınırlı ama çalışan bir deneyim alıyor ve yükseltme çağrısını
// panelde görüyor.
export async function resolvePlanTier(admin: Admin): Promise<{
    tier: PlanTier;
    trialDaysLeft: number | null;
    planUrl: string | null;
}> {
    // Billing hiç yapılandırılmamışsa (yerel geliştirme, ortam değişkenleri
    // boş) her şey açık — aksi halde geliştirirken uygulama sürekli
    // ücretsiz katman kısıtlarıyla çalışırdı.
    if (!isBillingConfigured()) return { tier: "paid", trialDaysLeft: null, planUrl: null };

    try {
        const { appId, appHandle, shopId } = await fetchAppAndShopIds(admin);
        const subscription = await fetchActiveSubscription(appId, shopId);
        const shopDomain = await fetchShopDomain(admin);
        const planUrl = planSelectionUrl(shopDomain.replace(".myshopify.com", ""), appHandle);

        if (!subscription) return { tier: "free", trialDaysLeft: null, planUrl };

        let trialDaysLeft: number | null = null;
        if (subscription.trialEndsAt) {
            const msLeft = new Date(subscription.trialEndsAt).getTime() - Date.now();
            if (msLeft > 0) trialDaysLeft = Math.ceil(msLeft / 86_400_000);
        }
        return { tier: "paid", trialDaysLeft, planUrl };
    } catch (error) {
        // "Fail open": Partner API kesintisinde ödeme yapan mağazaları
        // ücretsiz katmana düşürüp özelliklerini kısmak, kesinti
        // yaşatmaktan daha kötü bir müşteri deneyimi olurdu.
        console.error("[billing] Plan katmanı belirlenemedi, tam erişim veriliyor:", error);
        return { tier: "paid", trialDaysLeft: null, planUrl: null };
    }
}

const SHOP_DOMAIN_QUERY = `#graphql
  query InvfShopDomain { shop { myshopifyDomain } }`;

async function fetchShopDomain(admin: Admin): Promise<string> {
    const res = await admin.graphql(SHOP_DOMAIN_QUERY);
    const { data } = await res.json();
    return data?.shop?.myshopifyDomain ?? "";
}
