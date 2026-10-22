import { Suspense } from "react";
import ComparePage from "@/components/tj/compare-page";
export const metadata = { title: "مقایسهٔ کالاها" };
export default function Page() {
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}
