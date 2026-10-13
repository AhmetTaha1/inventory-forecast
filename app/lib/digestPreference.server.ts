// app/lib/digestPreference.server.ts
//
// Günlük e-posta özeti opt-in tercihi. Kayıt yoksa (ya da enabled=false)
// digest KAPALI sayılır — varsayılan davranış "gönderme".

import prisma from "../db.server";

export type DigestPreference = {
    enabled: boolean;
    recipient: string;
    lastSentDate: string | null;
};

export async function getDigestPreference(shop: string): Promise<DigestPreference | null> {
    const row = await prisma.digestPreference.findUnique({ where: { shop } });
    if (!row) return null;
    return { enabled: row.enabled, recipient: row.recipient, lastSentDate: row.lastSentDate };
}

export async function saveDigestPreference(shop: string, input: { enabled: boolean; recipient: string }): Promise<void> {
    await prisma.digestPreference.upsert({
        where: { shop },
        update: { enabled: input.enabled, recipient: input.recipient },
        create: { shop, enabled: input.enabled, recipient: input.recipient },
    });
}

// digestScheduler.server.ts'in "bugün zaten gönderdim mi?" kontrolü için.
export async function getShopsDueForDigest(todayDateString: string): Promise<{ shop: string; recipient: string }[]> {
    const rows = await prisma.digestPreference.findMany({
        where: { enabled: true, NOT: { lastSentDate: todayDateString } },
    });
    return rows.map((r) => ({ shop: r.shop, recipient: r.recipient }));
}

export async function markDigestSent(shop: string, todayDateString: string): Promise<void> {
    await prisma.digestPreference.update({ where: { shop }, data: { lastSentDate: todayDateString } });
}
