import { Suspense } from "react";
import SearchPage from "@/components/tj/search-page";
export const metadata = { title: "جست‌وجو" };
export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
