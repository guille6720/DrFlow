import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function PanelShell({
  embedded,
  title,
  children,
}: {
  embedded?: boolean;
  title?: string;
  children: ReactNode;
}) {
  if (embedded) return <div className="space-y-3">{children}</div>;
  return <Card title={title}>{children}</Card>;
}
