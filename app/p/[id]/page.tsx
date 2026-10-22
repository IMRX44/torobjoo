import type { Metadata } from "next";
import ProductPage from "@/components/tj/product-page";
import { getCatalog } from "@/lib/catalog";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = (await getCatalog()).product(id);
  return p ? { title: p.persian_title, description: `قیمت ${p.persian_title} در ${p.offer_count} فروشگاه حضوری تهران` } : { title: "کالا" };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductPage id={id} />;
}
