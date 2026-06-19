import { PwaRegister } from "@/components/pwa/pwa-register";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
