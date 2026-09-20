// ---------------------------------------------------------------------------
// Kartların ortak üst şeridi
// ---------------------------------------------------------------------------
// Bilerek ayrı, bağımsız bir eleman: kartın "border"/"active" durumuyla
// karışıp kaybolmasın diye. Rengi active durumuna hiç bakmaz, her zaman
// aynı kalır — sadece "empty" (sayısı 0, tıklanamaz) kartlarda griye döner.

export function CardStripe(props: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: props.color,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }}
    />
  );
}
