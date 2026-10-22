import { health, completion, ProviderError } from "@/lib/agent/provider";
import { tools } from "@/lib/agent/tools";
export async function GET() {
  return Response.json(health());
}
export async function POST(r: Request) {
  try {
    const result = await completion(
      [
        {
          role: "user",
          content: "Call search_products for QCY. Do not invent data.",
        },
      ],
      tools,
      r.signal,
      () => {},
    );
    return Response.json({
      ...health(),
      nativeToolsObserved: !!result.tool_calls?.length,
    });
  } catch (e) {
    return Response.json(
      { ...health(), code: e instanceof ProviderError ? e.code : "ERROR" },
      { status: 502 },
    );
  }
}
