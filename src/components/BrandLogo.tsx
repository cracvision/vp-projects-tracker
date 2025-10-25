// src/components/BrandLogo.tsx
import { BRAND_LOGO_URL } from "@/lib/brand";

export default function BrandLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt="VP Projects Tracker"
      className={className + " select-none"}
      draggable={false}
    />
  );
}
