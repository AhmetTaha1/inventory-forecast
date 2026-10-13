import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from "../lib/suppliers.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { resolveLocale, getDictionary, type Dictionary } from "../lib/translations";
import { resolvePlanTier } from "../lib/partnerBilling.server";
import { PremiumLock, PREMIUM_LOCK_CSS } from "../components/inventory/PremiumLock";
import { INVF_FONT_STACK } from "../lib/fontStack";

// ---------------------------------------------------------------------------
// Tedarikçi listesi (bkz. suppliers.server.ts) — mağaza sahibi burada bir
// kez "Acme Co, 21 gün" gibi preset'ler tanımlıyor, sonra ürün detay
// sayfasında (app.product.$variantId.tsx) tek tıkla o lead time'ı ürüne
// uygulayabiliyor. Kullanıcı geri bildirimi: bir tedarikçi eklemenin TEK
// BAŞINA hiçbir ürünü etkilemediği belli değildi ("ekledim, ne oldu şimdi?")
// — bu yüzden aşağıda kısa bir "nasıl çalışır" notu ve her satırda "kaç
// ürüne atanmış" sayacı var.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));

  const [suppliers, plan] = await Promise.all([getSuppliers(session.shop), resolvePlanTier(admin)]);
  return { locale, suppliers, isPaid: plan.tier === "paid", planUrl: plan.planUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  // Tedarikci yonetimi premium — sunucu tarafinda da kapali.
  const { tier } = await resolvePlanTier(admin);
  if (tier !== "paid") return { ok: false };
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") ?? "");
    const leadTimeDays = Number(formData.get("leadTimeDays"));
    if (name.trim() && Number.isFinite(leadTimeDays)) {
      await createSupplier(session.shop, name, leadTimeDays);
    }
  } else if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "");
    const leadTimeDays = Number(formData.get("leadTimeDays"));
    if (id && name.trim() && Number.isFinite(leadTimeDays)) {
      await updateSupplier(session.shop, id, name, leadTimeDays);
      // Düzenleme, bu tedarikçiye atanmış ürünlerin lead time'ını da
      // değiştirebilir (bkz. updateSupplier) — forecast önbelleği bunu
      // hemen yansıtmalı, 15 dakika beklemeden.
      await getForecastGroups(session.shop, admin, { forceRefresh: true });
    }
  } else if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    if (id) await deleteSupplier(session.shop, id);
  }

  return { ok: true };
};

const PAGE_CSS = `
.invf-sup-card {
  max-width: 520px;
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 14px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-family: ${INVF_FONT_STACK};
}
.invf-sup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px solid #F1F1F1;
}
.invf-sup-row:last-child { border-bottom: none; }
.invf-sup-name { font-size: 14px; font-weight: 600; color: #1A1A1A; word-break: break-word; }
.invf-sup-days { font-size: 12.5px; color: #6B6B6B; margin-top: 2px; }
.invf-sup-count { font-size: 12px; color: #026B4F; font-weight: 600; margin-top: 2px; }
.invf-sup-count--zero { color: #8A5A00; }
.invf-sup-actions { display: flex; gap: 8px; flex-shrink: 0; }
/* Kullanıcı geri bildirimi: bu sayfanın hiç mobil dokunma alanı ayarı
   yoktu — butonlar ~26px yüksekliğindeydi (asgari önerilen 44px'in
   çok altında). Dolgu artırıldı, hepsi ~40px'e çıktı. */
.invf-sup-edit {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 10px 14px;
  border-radius: 7px;
  border: 1px solid #D4D4D4;
  font-size: 12.5px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-sup-edit:hover { background: #F7F7F7; border-color: #008060; }
.invf-sup-delete {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 10px 14px;
  border-radius: 7px;
  border: 1px solid #D4D4D4;
  font-size: 12.5px;
  font-weight: 600;
  color: #6B6B6B;
}
.invf-sup-delete:hover { background: #FEE9E8; border-color: #D72C0D; color: #D72C0D; }
.invf-sup-editform { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; width: 100%; }
.invf-sup-editform input {
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid #D4D4D4;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
}
.invf-sup-save {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 10px 14px;
  border-radius: 7px;
  background: #008060;
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
}
.invf-sup-save:hover { background: #026B4F; }
@media (max-width: 480px) {
  .invf-sup-card { padding: 16px; }
}
/* Kullanıcı geri bildirimi: tedarikçi eklerken/silerken hiçbir geri bildirim
   yoktu — butonlar sadece pasifleşiyordu. Kök düzeydeki ince ilerleme çubuğu
   (app.tsx) gömülü çerçevenin en tepesinde kaldığı için fark edilmiyor.
   Artık işlem yapılan butonun İÇİNDE dönen bir gösterge, bitince de kısa bir
   onay çıkıyor. */
@keyframes invf-sup-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.invf-sup-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 7px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.45);
  border-top-color: #FFFFFF;
  animation: invf-sup-spin 0.7s linear infinite;
  vertical-align: -1px;
}
.invf-sup-spinner--dark { border-color: #D4D4D4; border-top-color: #008060; }
.invf-sup-saved {
  display: inline-flex;
  align-items: center;
  font-size: 12.5px;
  font-weight: 700;
  color: #0C5132;
  margin-left: 10px;
}
.invf-sup-form { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.invf-sup-field { display: flex; flex-direction: column; gap: 4px; }
.invf-sup-field label { font-size: 12px; font-weight: 700; color: #4A4A4A; }
.invf-sup-field input {
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid #D4D4D4;
  border-radius: 8px;
  font: inherit;
  font-size: 13.5px;
}
.invf-sup-add {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 10px 18px;
  border-radius: 8px;
  background: #008060;
  color: #FFFFFF;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
}
.invf-sup-add:hover { background: #026B4F; }
.invf-sup-empty { font-size: 13px; color: #6B6B6B; }
.invf-sup-back {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 11px 18px;
  border-radius: 9px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font-size: 13.5px;
  font-weight: 600;
  color: #1A1A1A;
  text-decoration: none;
  font-family: ${INVF_FONT_STACK};
}
.invf-sup-back:hover { background: #F7F7F7; border-color: #008060; }
`;

export default function Suppliers() {
  const { locale, suppliers, isPaid, planUrl } = useLoaderData<typeof loader>();
  const t = getDictionary(locale);
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";
  // Hangi işlemin sürdüğünü biliyoruz ki gösterge SADECE tıklanan butonda
  // dönsün — hepsini birden döndürmek hangi işin yapıldığını belirsizleştirir.
  const busyIntent = navigation.formData?.get("intent") as string | undefined;
  const busyId = navigation.formData?.get("id") as string | undefined;

  // busy -> idle geçişinde kısa bir onay (bkz. LeadTimeInlineEdit'teki aynı desen).
  const [justSaved, setJustSaved] = useState(false);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !isBusy) {
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 1800);
      return () => clearTimeout(timer);
    }
    wasBusy.current = isBusy;
  }, [isBusy]);

  return (
    <s-page heading={t.suppliersPageHeading}>
      <style>{PAGE_CSS + PREMIUM_LOCK_CSS}</style>
      <s-stack gap="base">
        {!isPaid && <PremiumLock description={t.premiumLockSuppliers} planUrl={planUrl} t={t} />}

        {isPaid && (
        <div className="invf-sup-card">
          <p style={{ margin: 0, fontSize: 13.5, color: "#5C5C5C" }}>{t.suppliersIntro}</p>

          {suppliers.length === 0 ? (
            <p className="invf-sup-empty">{t.suppliersEmpty}</p>
          ) : (
            <div>
              {suppliers.map((s) => (
                <SupplierRow key={s.id} supplier={s} t={t} isBusy={isBusy} busyIntent={busyIntent} busyId={busyId} />
              ))}
            </div>
          )}

          <Form method="post" className="invf-sup-form">
            <input type="hidden" name="intent" value="create" />
            <div className="invf-sup-field">
              <label htmlFor="name">{t.suppliersNameLabel}</label>
              <input id="name" name="name" type="text" required placeholder={t.suppliersNamePlaceholder} />
            </div>
            <div className="invf-sup-field" style={{ width: 120 }}>
              <label htmlFor="leadTimeDays">{t.suppliersLeadTimeLabel}</label>
              <input id="leadTimeDays" name="leadTimeDays" type="number" min={1} max={365} required defaultValue={14} />
            </div>
            <button type="submit" className="invf-sup-add" disabled={isBusy}>
              {busyIntent === "create" && <span className="invf-sup-spinner" aria-hidden="true" />}
              {t.suppliersAddButton}
            </button>
            {justSaved && !isBusy && (
              <span className="invf-sup-saved">✓ {t.inlineLeadTimeSaved}</span>
            )}
          </Form>
        </div>
        )}

        <Link to={`/app${locale ? `?locale=${locale}` : ""}`} className="invf-sup-back">
          {t.settingsBackLink}
        </Link>
      </s-stack>
    </s-page>
  );
}

// Kullanıcı geri bildirimi: "sil + yeniden ekle" düzenleme yöntemi, o
// tedarikçiye zaten atanmış ürünleri eski lead time'da sessizce bırakıyordu.
// Artık gerçek bir düzenleme modu var — updateSupplier zaten atanmış TÜM
// ürünleri de yeni değere günceller (bkz. suppliers.server.ts).
function SupplierRow(props: { supplier: Supplier; t: Dictionary; isBusy: boolean; busyIntent?: string; busyId?: string }) {
  const { supplier: s, t, isBusy, busyIntent, busyId } = props;
  // Gosterge SADECE bu satirin islemi calisirken donuyor.
  const savingThis = busyId === s.id && busyIntent === "update";
  const deletingThis = busyId === s.id && busyIntent === "delete";
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="invf-sup-row">
        <Form method="post" className="invf-sup-editform">
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="id" value={s.id} />
          <input name="name" type="text" defaultValue={s.name} required style={{ flex: "1 1 160px" }} />
          <input name="leadTimeDays" type="number" min={1} max={365} required defaultValue={s.leadTimeDays} style={{ width: 90 }} />
          <button type="submit" className="invf-sup-save" disabled={isBusy} onClick={() => setEditing(false)}>
            {savingThis && <span className="invf-sup-spinner" aria-hidden="true" />}
            {t.suppliersSaveButton}
          </button>
          <button type="button" className="invf-sup-delete" onClick={() => setEditing(false)}>
            {t.suppliersCancelButton}
          </button>
        </Form>
      </div>
    );
  }

  return (
    <div className="invf-sup-row">
      <div>
        <div className="invf-sup-name">{s.name}</div>
        <div className="invf-sup-days">{t.suppliersLeadTimeLine(s.leadTimeDays)}</div>
        <div className={s.assignedCount === 0 ? "invf-sup-count invf-sup-count--zero" : "invf-sup-count"}>
          {t.suppliersAssignedCount(s.assignedCount)}
        </div>
      </div>
      <div className="invf-sup-actions">
        <button type="button" className="invf-sup-edit" onClick={() => setEditing(true)}>
          {t.suppliersEditButton}
        </button>
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={s.id} />
          <button type="submit" className="invf-sup-delete" disabled={isBusy}>
            {deletingThis && <span className="invf-sup-spinner invf-sup-spinner--dark" aria-hidden="true" />}
            {t.suppliersDeleteButton}
          </button>
        </Form>
      </div>
    </div>
  );
}
