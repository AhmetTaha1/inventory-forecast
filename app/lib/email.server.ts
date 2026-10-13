// app/lib/email.server.ts
//
// İnce bir Resend sarmalayıcısı (bkz. resend.com/docs/api-reference/emails/send-email).
// Gerekli iki ortam değişkeni set edilene kadar TAMAMEN no-op — gönderim
// denemesi yerine konsola loglar, digest özelliğinin geri kalanının
// (tercih kaydı, içerik oluşturma, zamanlayıcı) API key olmadan da
// geliştirilip test edilebilmesi için (bkz. billing.server.ts'teki
// isBillingConfigured() ile aynı "readiness-first" yaklaşım).
//
//   RESEND_API_KEY   — resend.com/api-keys
//   RESEND_FROM_EMAIL — Resend'de doğrulanmış bir gönderen adresi
//                       (ör. "Envanter Tahmini <digest@senin-domainin.com>")

export function isEmailConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail(args: { to: string; subject: string; html: string }): Promise<void> {
    if (!isEmailConfigured()) {
        console.log(`[email] Yapılandırılmamış (RESEND_API_KEY/RESEND_FROM_EMAIL eksik) — gönderilmedi: "${args.subject}" -> ${args.to}`);
        return;
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: args.to,
            subject: args.subject,
            html: args.html,
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Resend isteği başarısız (${res.status}): ${body}`);
    }
}
