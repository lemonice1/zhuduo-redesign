import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZhuDuo | Product preview",
  description: "Electrical equipment and modular housing product preview.",
  robots: { index: false, follow: false }
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
