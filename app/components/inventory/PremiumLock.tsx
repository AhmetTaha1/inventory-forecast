import type { Dictionary } from "../../lib/translations";

// Ücretsiz katmanda kapalı olan bir özelliğin yerine geçen kart.
//
// Bilerek "erişiminiz yok" demiyor, özelliğin NE YAPTIĞINI anlatıyor:
// kapalı bir kapı göstermek yerine arkasında ne olduğunu göstermek,
// yükseltme kararını veren şey. Rakip yorumlarındaki en büyük öfke
// "önceden açık olan özelliğin sonradan paywall'a alınması"ydı — bu kart
// ilk günden burada, yani kimseden bir şey geri alınmıyor.
export const PREMIUM_LOCK_CSS = `
.invf-lock {
  border: 1px dashed #C9D4E3;
  border-radius: 12px;
  background: #FAFBFD;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.invf-lock-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #1F4C8C;
  background: #EAF4FF;
  padding: 3px 9px;
  border-radius: 999px;
}
.invf-lock-desc { font-size: 13.5px; color: #4A4A4A; line-height: 1.5; }
.invf-lock-cta {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 10px 18px;
  border-radius: 9px;
  background: #008060;
  color: #FFFFFF;
  font-size: 13.5px;
  font-weight: 700;
  text-decoration: none;
}
.invf-lock-cta:hover { background: #026B4F; }
`;

export function PremiumLock({
  description,
  planUrl,
  t,
}: {
  description: string;
  planUrl: string | null;
  t: Dictionary;
}) {
  return (
    <div className="invf-lock">
      <span className="invf-lock-badge">{t.premiumLockTitle}</span>
      <span className="invf-lock-desc">{description}</span>
      {/* target="_top" şart: plan sayfası Shopify admin'de, gömülü
          iframe'in içinde açılamaz. */}
      {planUrl && (
        <a href={planUrl} target="_top" className="invf-lock-cta">
          {t.premiumLockCta}
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
