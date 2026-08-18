import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { configureWebPush } from "@/lib/notifications/webpush";

configureWebPush();

export async function POST(req: Request) {
  try {
    const { title, body, url } = await req.json();
    const supabase = createServerSupabaseClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    // On n'envoie qu'à l'utilisateur connecté (anti-IDOR).
    const targetId = authUser.id;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", targetId);

    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

    const results = await Promise.allSettled(
      subs.map((s: any) => webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url })))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent, total: subs.length });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
