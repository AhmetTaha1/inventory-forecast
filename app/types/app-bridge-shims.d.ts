// GEÇİCİ: @shopify/polaris-types paketi s-app-nav için tip tanımı içermiyor
// (bilinen eksiklik, bkz. github.com/Shopify/shopify-app-bridge/issues/544).
// Paket güncellenirse bu dosya kaldırılabilir.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};