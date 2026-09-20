export type Category = "out" | "soon" | "dead" | "nodata";
export type Filter = "all" | "urgent" | Category;

export type CategoryMeta = {
  label: string;
  hint: string;
  accent: string;
  soft: string;
  text: string;
};

export type CategoryMetaMap = { [K in Category]: CategoryMeta };

export type AlertTone = "critical" | "warning" | "success" | "info";
