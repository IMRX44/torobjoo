// Load the 225k-product catalog once at server start, so the first visitor doesn't wait for it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getCatalog } = await import("./lib/catalog");
  const t = Date.now();
  getCatalog()
    .then((d) => console.log(`[catalog] ${d.products.length} products, ${d.offers.length} offers loaded in ${Date.now() - t}ms`))
    .catch((e) => console.error("[catalog] failed to load:", e.message));
}
