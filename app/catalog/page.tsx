import { redirect } from "next/navigation";
// The old catalog page is now /search (filters) and /plan (saved stops).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await searchParams;
  redirect(s.view === "plan" ? "/plan" : "/search");
}
