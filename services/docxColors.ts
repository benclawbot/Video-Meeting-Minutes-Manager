import { DocxTemplateId } from "../types";

export interface TemplateColors {
  headerBg: string;
  headerText: string;
  rowText: string;
  border: string;
  title: string;
  subtitle: string;
  rowEvenBg: string;
  accent: string;
  accentLight: string;
  bodyText: string;
  listBullet: string;
  pageBg: string;
}

export const TEMPLATE_COLORS: Record<DocxTemplateId, TemplateColors> = {
  corporate: {
    headerBg: "1e3a8a",
    headerText: "FFFFFF",
    rowText: "1e293b",
    border: "1e3a8a",
    title: "1e3a8a",
    subtitle: "3b82f6",
    rowEvenBg: "eff6ff",
    accent: "3b82f6",
    accentLight: "dbeafe",
    bodyText: "334155",
    listBullet: "3b82f6",
    pageBg: "FFFFFF",
  },
  modern: {
    headerBg: "064e3b",
    headerText: "FFFFFF",
    rowText: "064e3b",
    border: "059669",
    title: "059669",
    subtitle: "10b981",
    rowEvenBg: "ecfdf5",
    accent: "059669",
    accentLight: "d1fae5",
    bodyText: "065f46",
    listBullet: "10b981",
    pageBg: "FFFFFF",
  },
  executive: {
    headerBg: "7c2d12",
    headerText: "FFFFFF",
    rowText: "292524",
    border: "7c2d12",
    title: "7c2d12",
    subtitle: "92400e",
    rowEvenBg: "fff7ed",
    accent: "b45309",
    accentLight: "fef3c7",
    bodyText: "44403c",
    listBullet: "92400e",
    pageBg: "FFFFFF",
  },
};
