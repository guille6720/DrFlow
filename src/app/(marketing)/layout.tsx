import { MarketingThemeScript } from "@/core/components/landing/marketing-theme-script";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingThemeScript />
      {children}
    </>
  );
}
