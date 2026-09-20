import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopSettings, saveShopSettings } from "../lib/shopSettings.server";
import { DEFAULT_COVERAGE_DAYS, DEFAULT_LEAD_TIME_DAYS } from "../lib/forecast";
import { resolveLocale, getDictionary } from "../lib/translations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));

  const settings = await getShopSettings(session.shop);

  return {
    locale,
    leadTimeDays: settings?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS,
    coverageDays: settings?.coverageDays ?? DEFAULT_COVERAGE_DAYS,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();

  await saveShopSettings(session.shop, {
    leadTimeDays: Number(formData.get("leadTimeDays")),
    coverageDays: Number(formData.get("coverageDays")),
  });

  // Kaydedildikten sonra panele dönülüyor ve YENİDEN HESAPLAMA zorlanıyor
  // (?refresh=1) — aksi halde yeni ayar, önbellek 15 dakika dolana kadar
  // (ya da manuel "Refresh data"ya kadar) hiç yansımazdı.
  const locale = url.searchParams.get("locale");
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
.invf-settings-back { font-size: 13.5px; color: #008060; text-decoration: none; }
.invf-settings-back:hover { text-decoration: underline; }
`;

export default function Settings() {
  const { locale, leadTimeDays, coverageDays } = useLoaderData<typeof loader>();
  const t = getDictionary(locale);
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <s-page heading={t.settingsPageHeading}>
      <style>{SETTINGS_PAGE_CSS}</style>
      <s-stack gap="base">
        <div className="invf-settings-card">
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
                <a className="invf-settings-back" href={`/app${locale ? `?locale=${locale}` : ""}`}>
                  {t.settingsBackLink}
                </a>
              </div>
            </div>
          </Form>
        </div>
      </s-stack>
    </s-page>
  );
}
