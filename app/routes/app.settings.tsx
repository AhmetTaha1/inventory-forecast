import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopSettings, saveShopSettings, hasSettingsTourBeenSeen } from "../lib/shopSettings.server";
import { getDigestPreference, saveDigestPreference } from "../lib/digestPreference.server";
import { DEFAULT_COVERAGE_DAYS, DEFAULT_LEAD_TIME_DAYS } from "../lib/forecast";
import { resolveLocale, getDictionary } from "../lib/translations";
import { resolvePlanTier } from "../lib/partnerBilling.server";
import { PremiumLock, PREMIUM_LOCK_CSS } from "../components/inventory/PremiumLock";
import { SettingsPageTour } from "../components/SettingsPageTour";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));

  const [settings, digest, settingsTourSeen, plan] = await Promise.all([
    getShopSettings(session.shop),
    getDigestPreference(session.shop),
    hasSettingsTourBeenSeen(session.shop),
    resolvePlanTier(admin),
  ]);

  return {
    locale,
    isPaid: plan.tier === "paid",
    planUrl: plan.planUrl,
    leadTimeDays: settings?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS,
    coverageDays: settings?.coverageDays ?? DEFAULT_COVERAGE_DAYS,
    digestEnabled: digest?.enabled ?? false,
    digestRecipient: digest?.recipient ?? "",
    digestJustSaved: url.searchParams.get("saved") === "digest",
    showSettingsTour: !settingsTourSeen,
  };
};

// İki ayrı <Form> (sipariş ayarları + digest tercihi) aynı action'a
// gönderiyor, `intent` gizli alanıyla ayırt ediliyor — ayrı bir route
// açmak bu kadar küçük bir ikinci form için gereksiz olurdu.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();
  const locale = url.searchParams.get("locale");

  if (formData.get("intent") === "digest") {
    await saveDigestPreference(session.shop, {
      enabled: formData.get("digestEnabled") === "on",
      recipient: String(formData.get("digestRecipient") ?? "").trim(),
    });
    const target = new URL(url.pathname, url.origin);
    target.searchParams.set("saved", "digest");
    if (locale) target.searchParams.set("locale", locale);
    return redirect(target.pathname + target.search);
  }

  await saveShopSettings(session.shop, {
    leadTimeDays: Number(formData.get("leadTimeDays")),
    coverageDays: Number(formData.get("coverageDays")),
  });

  // Kaydedildikten sonra panele dönülüyor ve YENİDEN HESAPLAMA zorlanıyor
  // (?refresh=1) — aksi halde yeni ayar, önbellek 15 dakika dolana kadar
  // (ya da manuel "Refresh data"ya kadar) hiç yansımazdı.
  const target = new URL("/app", url.origin);
  target.searchParams.set("refresh", "1");
  if (locale) target.searchParams.set("locale", locale);
  return redirect(target.pathname + target.search);
};

const SETTINGS_PAGE_CSS = `
.invf-settings-card {
  max-width: 520px;
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 14px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.invf-settings-intro { font-size: 13.5px; color: #5C5C5C; line-height: 1.5; margin: 0; }
.invf-settings-field { display: flex; flex-direction: column; gap: 6px; }
.invf-settings-field label { font-size: 13.5px; font-weight: 700; color: #1A1A1A; }
.invf-settings-field .help { font-size: 12.5px; color: #6B6B6B; }
.invf-settings-field input {
  box-sizing: border-box;
  width: 140px;
  padding: 10px 12px;
  border: 1px solid #D4D4D4;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  color: #1A1A1A;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.invf-settings-field input:focus {
  border-color: #008060;
  box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.15);
}
.invf-settings-actions { display: flex; align-items: center; gap: 16px; }
.invf-settings-save {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 11px 20px;
  border-radius: 9px;
  background: #008060;
  color: #FFFFFF;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  transition: background 150ms ease;
}
.invf-settings-save:hover { background: #026B4F; }
.invf-settings-save[disabled] { opacity: 0.6; cursor: wait; }
/* Bilerek düz metin DEĞİL, kenarlıklı gerçek bir buton — panelin
   genelindeki "Temizle"/"Ayarlar" butonlarıyla aynı görsel dil. */
.invf-settings-back {
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
}
.invf-settings-back:hover { background: #F7F7F7; border-color: #008060; }
.invf-settings-checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.invf-settings-checkbox-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #008060;
  cursor: pointer;
}
.invf-settings-checkbox-row label { font-size: 13.5px; font-weight: 700; color: #1A1A1A; cursor: pointer; }
.invf-settings-saved {
  font-size: 13px;
  font-weight: 700;
  color: #0C5132;
}
`;

export default function Settings() {
  const { locale, leadTimeDays, coverageDays, digestEnabled, digestRecipient, digestJustSaved, showSettingsTour, isPaid, planUrl } =
    useLoaderData<typeof loader>();
  const t = getDictionary(locale);
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const [digestChecked, setDigestChecked] = useState(digestEnabled);

  return (
    <s-page heading={t.settingsPageHeading}>
      <style>{SETTINGS_PAGE_CSS + PREMIUM_LOCK_CSS}</style>
      <s-stack gap="base">
        <div className="invf-settings-card" id="invf-settings-reorder-card">
          <p className="invf-settings-intro">{t.settingsIntro}</p>

          <Form method="post">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="invf-settings-field">
                <label htmlFor="leadTimeDays">{t.leadTimeFieldLabel}</label>
                <input
                  id="leadTimeDays"
                  name="leadTimeDays"
                  type="number"
                  min={1}
                  max={365}
                  required
                  defaultValue={leadTimeDays}
                />
                <span className="help">{t.leadTimeFieldHelp}</span>
              </div>

              <div className="invf-settings-field">
                <label htmlFor="coverageDays">{t.coverageDaysFieldLabel}</label>
                <input
                  id="coverageDays"
                  name="coverageDays"
                  type="number"
                  min={1}
                  max={365}
                  required
                  defaultValue={coverageDays}
                />
                <span className="help">{t.coverageDaysFieldHelp}</span>
              </div>

              <div className="invf-settings-actions">
                <button type="submit" className="invf-settings-save" disabled={isSaving}>
                  {t.settingsSaveButton}
                </button>
              </div>
            </div>
          </Form>
        </div>

        <div className="invf-settings-card" id="invf-settings-digest-card">
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>{t.digestSectionTitle}</p>
            <p className="invf-settings-intro" style={{ marginTop: 4 }}>{t.digestSectionDesc}</p>
          </div>

          {!isPaid && <PremiumLock description={t.premiumLockDigest} planUrl={planUrl} t={t} />}

          {isPaid && (
          <Form method="post">
            <input type="hidden" name="intent" value="digest" />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="invf-settings-checkbox-row">
                <input
                  id="digestEnabled"
                  name="digestEnabled"
                  type="checkbox"
                  defaultChecked={digestEnabled}
                  onChange={(e) => setDigestChecked(e.target.checked)}
                />
                <label htmlFor="digestEnabled">{t.digestEnableLabel}</label>
              </div>

              {digestChecked && (
                <div className="invf-settings-field">
                  <label htmlFor="digestRecipient">{t.digestEmailLabel}</label>
                  <input
                    id="digestRecipient"
                    name="digestRecipient"
                    type="email"
                    style={{ width: "100%", maxWidth: 320 }}
                    placeholder={t.digestEmailPlaceholder}
                    defaultValue={digestRecipient}
                    required={digestChecked}
                  />
                </div>
              )}

              <div className="invf-settings-actions">
                <button type="submit" className="invf-settings-save" disabled={isSaving}>
                  {t.digestSaveButton}
                </button>
                {digestJustSaved && <span className="invf-settings-saved">✓ {t.digestSavedConfirmation}</span>}
              </div>
            </div>
          </Form>
          )}
        </div>

        {/* Kullanıcı geri bildirimi: bu link bir kartın içindeki bir form
            eylemi DEĞİL, tüm sayfa için geçerli bir gezinme eylemi —
            "Reorder settings" kartının bir parçasıymış gibi görünmemesi
            için tüm kartların DIŞINA, sayfanın en altına alındı (bkz.
            app.suppliers.tsx'teki aynı desen). */}
        <Link className="invf-settings-back" to={`/app${locale ? `?locale=${locale}` : ""}`}>
          {t.settingsBackLink}
        </Link>
      </s-stack>

      {showSettingsTour && <SettingsPageTour t={t} />}
    </s-page>
  );
}
