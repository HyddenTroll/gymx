import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { configureWebPush } from "@/lib/notifications/webpush";
import { getLocalToday } from "@/lib/dates";

configureWebPush();

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

const ESTIMULE_1RM = (charge: number, reps: number) => {
  if (reps <= 0 || charge <= 0) return 0;
  if (reps === 1) return charge;
  if (reps < 10) return Math.round(charge * (36 / (37 - reps)));
  return Math.round(charge * (1 + reps / 30));
};

export async function GET() {
  try {
    const supabase = adminClient();
    const today = getLocalToday();

    const { data: subs } = await supabase.from("push_subscriptions").select("user_id, subscription");
    if (!subs || subs.length === 0) return NextResponse.json({ checked: 0, sent: 0 });

    let sent = 0;

    for (const sub of subs) {
      const userId = sub.user_id;
      const subscription = sub.subscription;
      let notif: { title: string; body: string; url: string } | null = null;

      const { data: seanceToday } = await supabase
        .from("seances")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .eq("terminee", true)
        .limit(1);

      const dejaEntraine = (seanceToday?.length || 0) > 0;

      if (dejaEntraine) {
        const { data: recordsRecents } = await supabase
          .from("series")
          .select("charge, reps, exercice:exercice_id!inner(nom_fr)")
          .eq("validee", true)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recordsRecents && recordsRecents.length > 0) {
          for (const s of recordsRecents as any[]) {
            const rm = ESTIMULE_1RM(Number(s.charge), Number(s.reps));
            if (rm > 0 && s.exercice?.nom_fr) {
              notif = {
                title: `Séance terminée ✓`,
                body: `Bonne séance ! Retrouve tes stats sur le QG.`,
                url: "/qg",
              };
              break;
            }
          }
        }
      } else {
        const { data: prog } = await supabase
          .from("programme_actif")
          .select("id, jours_par_semaine, date_debut, semaine_courante, longueur_bloc")
          .eq("user_id", userId)
          .maybeSingle();

        if (prog && prog.date_debut) {
          const dateDebut = new Date(prog.date_debut);
          const joursEcoules = Math.floor((new Date().getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
          const jourDansSemaine = (joursEcoules % 7) + 1;
          const jourProgramme = ((jourDansSemaine - 1) % prog.jours_par_semaine) + 1;
          const estJourDeSport = jourProgramme <= prog.jours_par_semaine;

          if (estJourDeSport) {
            const { data: derniereSeance } = await supabase
              .from("seances")
              .select("date")
              .eq("user_id", userId)
              .eq("terminee", true)
              .order("date", { ascending: false })
              .limit(1)
              .maybeSingle();

            const joursSansSport = derniereSeance
              ? Math.floor((new Date().getTime() - new Date(derniereSeance.date).getTime()) / (1000 * 60 * 60 * 24))
              : 99;

            if (joursSansSport === 1) {
              const { data: structures } = await supabase
                .from("programme_structure")
                .select("exercice:exercice_id(nom_fr)")
                .eq("programme_actif_id", prog.id)
                .eq("jour", jourProgramme)
                .limit(3);
              const noms = (structures || []).map((s: any) => s.exercice?.nom_fr).filter(Boolean);
              const exosStr = noms.length > 0 ? noms.slice(0, 3).join(", ") : "";
              notif = {
                title: `Jour ${jourProgramme} prêt`,
                body: exosStr ? `${noms.length} exos : ${exosStr}${noms.length > 3 ? "..." : ""} — ~45 min` : `Jour ${jourProgramme} — 5-6 exos, ~45 min`,
                url: "/seance",
              };
            } else if (joursSansSport >= 3 && joursSansSport <= 4) {
              notif = {
                title: `3 jours sans séance`,
                body: `La régularité est le vrai levier. Une séance aujourd'hui relance la machine.`,
                url: "/seance",
              };
            } else if (joursSansSport >= 6) {
              const { data: seancesRecentes } = await supabase
                .from("seances")
                .select("id")
                .eq("user_id", userId)
                .eq("terminee", true)
                .gte("date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
              if (!seancesRecentes || seancesRecentes.length === 0) {
                notif = {
                  title: `1 semaine sans venir`,
                  body: `Le plus dur c'est de reprendre. Une séance légère aujourd'hui et c'est relancé.`,
                  url: "/seance",
                };
              }
            }
          }
        }
      }

      if (!notif) {
        const { data: gamification } = await supabase
          .from("gamification")
          .select("streak")
          .eq("user_id", userId)
          .maybeSingle();
        if (gamification && gamification.streak >= 3) {
          const { data: seanceRecente } = await supabase
            .from("seances")
            .select("date")
            .eq("user_id", userId)
            .eq("terminee", true)
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (seanceRecente) {
            const joursDepuis = Math.floor((new Date().getTime() - new Date(seanceRecente.date).getTime()) / (1000 * 60 * 60 * 24));
            if (joursDepuis === 1 && !dejaEntraine) {
              notif = {
                title: `${gamification.streak} séances d'affilée`,
                body: `Tu es à ${gamification.streak} de suite. 1 aujourd'hui et tu maintiens.`,
                url: "/seance",
              };
            }
          }
        }
      }

      if (notif) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify({
            title: notif.title,
            body: notif.body,
            url: notif.url,
          }));
          sent++;
        } catch {
          await supabase.from("push_subscriptions").delete().eq("user_id", userId);
        }
      }
    }

    return NextResponse.json({ checked: subs.length, sent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
