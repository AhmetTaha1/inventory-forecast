import type { Dictionary } from "../../lib/translations";
import type { AccuracyScorecard } from "../../lib/forecastAccuracy.server";

// Tahmin karnesi kartı — kendi isabetimizi mağaza sahibine dürüstçe
// gösteriyor (bkz. forecastAccuracy.server.ts). Kategorideki rakiplerin en
// büyük şikâyeti tahminlerin "kara kutu" olması; bu kart tam o boşluğu
// hedefliyor.
//
// Kart SADECE gerçekten ölçülmüş tahmin varsa render ediliyor (çağıran taraf
// null kontrolü yapıyor) — "henüz veri yok" diyen boş bir karne, güven
// vermek yerine tam tersini yapardı.
export const ACCURACY_CARD_CSS = `
.invf-accuracy {
  border: 1px solid #D7E3EF;
  border-left: 4px solid #2C6ECB;
  border-radius: 12px;
  background: #F7FAFD;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.invf-accuracy-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #1F4C8C;
}
.invf-accuracy-headline { font-size: 14.5px; font-weight: 700; color: #1A1A1A; }
.invf-accuracy-sub { font-size: 12.5px; color: #5C5C5C; line-height: 1.45; }
.invf-accuracy-examples {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.invf-accuracy-examples li { font-size: 12px; color: #4A4A4A; overflow-wrap: anywhere; }
`;

export function AccuracyCard({ scorecard, t }: { scorecard: AccuracyScorecard; t: Dictionary }) {
  return (
    <div className="invf-accuracy" role="status">
      <span className="invf-accuracy-title">{t.accuracyTitle}</span>
      <span className="invf-accuracy-headline">
        {t.accuracyHeadline(scorecard.withinQuarterPct, scorecard.checkedCount)}
      </span>
      <span className="invf-accuracy-sub">
        {t.accuracyMedian(scorecard.medianErrorPct, scorecard.horizonDays)}
      </span>
      {scorecard.examples.length > 0 && (
        <ul className="invf-accuracy-examples">
          {scorecard.examples.map((e) => (
            <li key={e.productTitle}>
              {t.accuracyExample(e.productTitle, e.predicted, e.actual)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
