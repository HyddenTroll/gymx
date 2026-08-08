const VAPID_PUBLIC_KEY = "BLF9CX2KrZwE1GaC50vywGJPcQlYLjdzPQb6MFGvvpCgQkq-DNbG95gysCBmno3O4rPeljR8S7zaWsdffzgthL8";

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
    });
    const { data: { user } } = await (await import("@/lib/supabase/client")).createClient().auth.getUser();
    if (!user) return false;
    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const sub = await getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch("/api/notifications/subscribe", { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

async function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function enableNotifications(): Promise<"ok" | "denied" | "unsupported"> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  const permitted = await requestPermission();
  if (!permitted) return "denied";
  const subscribed = await subscribeToPush();
  return subscribed ? "ok" : "denied";
}

export async function disableNotifications(): Promise<boolean> {
  return unsubscribeFromPush();
}

export async function isSubscribed(): Promise<boolean> {
  const sub = await getSubscription();
  if (!sub) return false;
  return true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw.split("").map((c) => c.charCodeAt(0)));
}
