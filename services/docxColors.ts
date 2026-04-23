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
    headerBg: "1e3a5f",
    headerText: "FFFFFF",
    rowText: "1e293b",
    border: "1e3a5f",
    title: "1e3a5f",
    subtitle: "3b82f6",
    rowEvenBg: "f0f4f8",
    accent: "3b82f6",
    accentLight: "dbeafe",
    bodyText: "334155",
    listBullet: "3b82f6",
    pageBg: "FFFFFF",
  },
  modern: {
    headerBg: "0f4c5c",
    headerText: "FFFFFF",
    rowText: "0f4c5c",
    border: "0f4c5c",
    title: "0f4c5c",
    subtitle: "14b8a6",
    rowEvenBg: "ecf5f2",
    accent: "14b8a6",
    accentLight: "d1fae5",
    bodyText: "065f46",
    listBullet: "14b8a6",
    pageBg: "F8FDFB",
  },
  executive: {
    headerBg: "1a1d29",
    headerText: "FFFFFF",
    rowText: "292524",
    border: "292524",
    title: "1a1d29",
    subtitle: "d4a843",
    rowEvenBg: "f5f0eb",
    accent: "d4a843",
    accentLight: "fef3c7",
    bodyText: "44403c",
    listBullet: "d4a843",
    pageBg: "FAFAF8",
  },
};
