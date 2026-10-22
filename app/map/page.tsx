import { Suspense } from "react";
import MapPage from "@/components/tj/map-page";
export const metadata = { title: "نقشه و بورس‌ها" };
export default function Page() {
  return (
    <Suspense>
      <MapPage />
    </Suspense>
  );
}
