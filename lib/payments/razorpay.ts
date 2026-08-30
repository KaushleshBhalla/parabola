import "server-only";
import { createHmac } from "node:crypto";

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/**
 * Creates a Razorpay order for a project's creation fee. Not yet wired to
 * the real API or called from anywhere — project creation is currently free
 * (see lib/project-access.ts), so this only throws once real payment
 * enforcement is turned on without keys present.
 */
export async function createOrder(amountCents: number, currency: string) {
  if (!isRazorpayConfigured()) {
    throw new Error(
      "Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)."
    );
  }

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountCents,
      currency,
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay order creation failed: ${await res.text()}`);
  }

  return (await res.json()) as { id: string; amount: number; currency: string };
}

export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured.");
  }
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}
