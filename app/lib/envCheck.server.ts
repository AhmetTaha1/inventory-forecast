// app/lib/envCheck.server.ts
//
// Sunucu açılışında BİR KEZ çalışan ortam değişkeni kontrolü.
//
// Neden var: bu uygulamada eksik bir ortam değişkeni çoğu zaman GÜRÜLTÜLÜ bir
// hata vermez, SESSİZCE yanlış davranır — ki bu çok daha tehlikelidir:
//
//   - SHOPIFY_PARTNER_* eksikse abonelik kontrolü tamamen devre dışı kalır ve
//     uygulamayı kuran herkes ücretsiz kullanır. Hiçbir hata görünmez, sadece
//     para tahsil edilmez.
//   - RESEND_* eksikse mağaza sahibi günlük özeti açar, "kaydedildi" onayını
//     görür, ama e-posta hiç gitmez.
//   - SHOPIFY_APP_URL eksikse e-postadaki "uygulamada görüntüle" bağlantısı
//     boş bir adrese gider.
//
// Bu yüzden süreç ÇÖKERTİLMİYOR (çalışan bir uygulamayı eksik bir e-posta
// ayarı yüzünden kapatmak doğru olmaz) ama üretimde belirgin bir uyarı
// basılıyor. Geliştirmede bu değişkenlerin olmaması normal, o yüzden sessiz.

type EnvRequirement = {
    keys: string[];
    label: string;
    consequence: string;
};

const PRODUCTION_REQUIREMENTS: EnvRequirement[] = [
    {
        keys: ["SHOPIFY_PARTNER_ORG_ID", "SHOPIFY_PARTNER_API_ACCESS_TOKEN"],
        label: "Abonelik/ücretlendirme kontrolü",
        consequence: "abonelik hiç kontrol edilmiyor — uygulamayı kuran HERKES ücretsiz kullanabilir",
    },
    {
        keys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
        label: "Günlük e-posta özeti",
        consequence: "mağaza sahibi özeti açabilir ve 'kaydedildi' görür, ama e-posta hiç gönderilmez",
    },
    {
        keys: ["SHOPIFY_APP_URL"],
        label: "Uygulama adresi",
        consequence: "e-postadaki 'uygulamada görüntüle' bağlantısı boş adrese gider",
    },
];

export function checkEnvironment(): void {
    if (process.env.NODE_ENV !== "production") return;

    const missing = PRODUCTION_REQUIREMENTS.filter((req) =>
        req.keys.some((key) => !process.env[key]),
    );
    if (missing.length === 0) return;

    console.warn("\n[env] ÜRETİM ORTAMINDA EKSİK YAPILANDIRMA:");
    for (const req of missing) {
        const absent = req.keys.filter((key) => !process.env[key]);
        console.warn(`  - ${req.label}: ${absent.join(", ")} tanımlı değil`);
        console.warn(`    Sonuç: ${req.consequence}`);
    }
    console.warn("  Ayrıntı için .env.example dosyasına bak.\n");
}
