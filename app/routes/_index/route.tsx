import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, Link, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "Inventory Forecast — Never miss a reorder" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

// Yaklaşımı: bu sayfa merchant henüz uygulamayı kurmadan (ya da oturumu
// düşüp mağaza alanını yeniden girmesi gerektiğinde) gördüğü TEK genel/
// embed-dışı sayfa — App Store incelemesinden geçen bir ziyaretçi de bunu
// görebilir. Önceden şablondan kalma placeholder metinlerle ("A short
// heading about [your app]") bomboş duruyordu; artık gerçek değer
// önerisini anlatıyor. Bilerek İngilizce: locale tespiti (resolveLocale)
// Shopify'ın admin URL'sine eklediği query parametresine dayanıyor, bu
// sayfa kuruluma başlamadan önce göründüğü için o parametre henüz yok.
const FEATURES = [
  {
    title: "Stockout forecasts",
    desc: "See exactly which products are running low and when they'll run out, based on your real sales velocity — not guesswork.",
  },
  {
    title: "Smart reorder alerts",
    desc: "Set your supplier lead time once, and we'll tell you exactly when — and how much — to reorder before it's too late.",
  },
  {
    title: "Zero setup friction",
    desc: "No spreadsheets, no manual tracking. Install and see your first forecast in minutes, right inside your Shopify admin.",
  },
];

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Never miss a reorder again</h1>
        <p className={styles.text}>
          Inventory Forecast predicts exactly when each product will run out — and
          tells you when and how much to reorder.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" placeholder="my-shop-domain.myshopify.com" />
              <span className={styles.hint}>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          {FEATURES.map((f) => (
            <li key={f.title}>
              <strong>{f.title}</strong>
              <span>{f.desc}</span>
            </li>
          ))}
        </ul>
        <Link className={styles.footerLink} to="/privacy">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}
