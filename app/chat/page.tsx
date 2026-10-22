import { Suspense } from "react";
import ChatApp from "@/components/tj/chat-app";
export const metadata = { title: "دستیار خرید" };
export default function Page() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
