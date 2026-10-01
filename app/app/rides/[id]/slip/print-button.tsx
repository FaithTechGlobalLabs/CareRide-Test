"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button size="lg" className="h-10 px-4" onClick={() => window.print()}>
      <Printer /> Print
    </Button>
  );
}
