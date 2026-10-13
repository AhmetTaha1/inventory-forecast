// app/lib/suppliers.server.ts
//
// Tedarikçi PRESET yönetimi (bkz. lead_time_and_snooze_ideas memory).
// Bir tedarikçi "isim + lead time" — bir ürüne atamak tedarikçinin O ANKİ
// leadTimeDays'ini variantOverrides tablosuna KOPYALAR (bkz.
// assignSupplierToVariant). Tedarikçiyi SONRADAN DÜZENLERSEN (updateSupplier),
// ona atanmış TÜM ürünlerin override'ı da otomatik yeni değere güncellenir —
// kullanıcı geri bildirimi üzerine: "sil + yeniden ekle" düzenleme yöntemi,
// zaten atanmış ürünleri eski (yanlış) lead time'da sessizce unutuyordu.

import prisma from "../db.server";
import { clampDays } from "./shopSettings.server";

export type Supplier = {
    id: string;
    name: string;
    leadTimeDays: number;
    assignedCount: number;
};

export async function getSuppliers(shop: string): Promise<Supplier[]> {
    const [rows, counts] = await Promise.all([
        prisma.supplier.findMany({ where: { shop }, orderBy: { name: "asc" } }),
        prisma.variantLeadTimeOverride.groupBy({
            by: ["supplierId"],
            where: { shop, supplierId: { not: null } },
            _count: { supplierId: true },
        }),
    ]);
    const countBySupplierId = new Map(counts.map((c) => [c.supplierId as string, c._count.supplierId]));
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        leadTimeDays: r.leadTimeDays,
        assignedCount: countBySupplierId.get(r.id) ?? 0,
    }));
}

export async function createSupplier(shop: string, name: string, leadTimeDays: number): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    await prisma.supplier.create({ data: { shop, name: trimmed, leadTimeDays: clampDays(leadTimeDays) } });
}

// Tedarikçiyi düzenler VE ona zaten atanmış her ürünün kopyalanmış
// leadTimeDays'ini de yeni değere günceller — bkz. üstteki not.
export async function updateSupplier(shop: string, id: string, name: string, leadTimeDays: number): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const clamped = clampDays(leadTimeDays);
    await prisma.$transaction([
        prisma.supplier.updateMany({ where: { shop, id }, data: { name: trimmed, leadTimeDays: clamped } }),
        prisma.variantLeadTimeOverride.updateMany({
            where: { shop, supplierId: id },
            data: { leadTimeDays: clamped },
        }),
    ]);
}

export async function deleteSupplier(shop: string, id: string): Promise<void> {
    // Bu tedarikçiye atanmış ürünlerin override'ı BOZULMUYOR (leadTimeDays
    // zaten kopyalanmıştı) — sadece "hangi tedarikçiden geldiği" bilgisi
    // (supplierId) artık geçersiz bir ID'ye işaret etmesin diye temizleniyor.
    await prisma.$transaction([
        prisma.variantLeadTimeOverride.updateMany({ where: { shop, supplierId: id }, data: { supplierId: null } }),
        prisma.supplier.deleteMany({ where: { shop, id } }),
    ]);
}

// leadTimeDays === null -> ürünün override'ını tamamen kaldır (mağaza
// varsayılanına dön). Aksi halde supplier'ın GÜNCEL leadTimeDays'i
// kopyalanıp supplierId not olarak set ediliyor.
export async function assignSupplierToVariant(shop: string, variantId: string, supplierId: string | null): Promise<void> {
    if (supplierId == null) {
        const existing = await prisma.variantLeadTimeOverride.findUnique({ where: { shop_variantId: { shop, variantId } } });
        if (!existing) return;
        if (existing.coverageDays == null) {
            await prisma.variantLeadTimeOverride.delete({ where: { shop_variantId: { shop, variantId } } });
        } else {
            await prisma.variantLeadTimeOverride.update({
                where: { shop_variantId: { shop, variantId } },
                data: { leadTimeDays: null, supplierId: null },
            });
        }
        return;
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || supplier.shop !== shop) return;

    await prisma.variantLeadTimeOverride.upsert({
        where: { shop_variantId: { shop, variantId } },
        update: { leadTimeDays: supplier.leadTimeDays, supplierId: supplier.id },
        create: { shop, variantId, leadTimeDays: supplier.leadTimeDays, supplierId: supplier.id },
    });
}

// Ürün detay sayfasındaki <select>'in "şu an seçili" değerini bilmesi için.
export async function getAssignedSupplierId(shop: string, variantId: string): Promise<string | null> {
    const row = await prisma.variantLeadTimeOverride.findUnique({ where: { shop_variantId: { shop, variantId } } });
    return row?.supplierId ?? null;
}
