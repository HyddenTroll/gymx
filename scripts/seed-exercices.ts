/**
 * Script de seed GYMX — import des exercices dans Supabase
 * 
 * Usage : npx tsx scripts/seed-exercices.ts
 * 
 * Prérequis : 
 *   - Variables d'env SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY définies
 *   - Migration SQL 001_init.sql déjà exécutée sur la base
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FREE_EXERCISE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const JS_DELIVR_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db/exercises/";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  process.exit(1);
}

interface MappingEntry {
  nom_fr: string;
  nom_en: string;
  groupe: string;
  sous_region: string;
  equipement: string;
  compound: boolean;
  role: string;
  unite: string;
  pas: number;
  assist_inverse: boolean;
}

interface FreeExerciseDbEntry {
  id: string;
  name: string;
  force: string;
  level: string;
  mechanic: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(mappingName: string, dbEntries: FreeExerciseDbEntry[]): FreeExerciseDbEntry | null {
  const normalized = normalizeName(mappingName);

  const exact = dbEntries.find((e) => normalizeName(e.name) === normalized);
  if (exact) return exact;

  const includes = dbEntries.find((e) => normalizeName(e.name).includes(normalized));
  if (includes) return includes;

  const words = normalized.split(" ");
  return dbEntries.find((e) => {
    const dbWords = normalizeName(e.name).split(" ");
    return words.every((w) => dbWords.some((dw) => dw.includes(w) || w.includes(dw)));
  }) || null;
}

function mapEquipment(equipement: string): string {
  switch (equipement) {
    case "salle": return "machine";
    case "halteres": return "dumbbell";
    case "corps": return "body_only";
    default: return "other";
  }
}

async function main() {
  console.log("🚀 Début du seed GYMX...\n");

  // 1. Charger le mapping
  const mappingPath = path.join(__dirname, "exercices-mapping.json");
  const mapping: MappingEntry[] = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
  console.log(`📋 ${mapping.length} exercices chargés depuis le mapping\n`);

  // 2. Fetch free-exercise-db
  console.log("🌐 Téléchargement de free-exercise-db...");
  const response = await fetch(FREE_EXERCISE_DB_URL);
  if (!response.ok) {
    console.error(`❌ Échec du téléchargement: ${response.status}`);
    process.exit(1);
  }
  const allExercises: FreeExerciseDbEntry[] = await response.json();
  console.log(`✅ ${allExercises.length} exercices dans le dataset\n`);

  // 3. Connexion Supabase
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  // 4. Matcher et insérer chaque exercice
  let matched = 0;
  let missed = 0;
  const missedList: string[] = [];
  const insertedIds: Map<string, string> = new Map(); // nom_fr -> uuid

  for (const entry of mapping) {
    const dbEntry = fuzzyMatch(entry.nom_en, allExercises);

    const slug = slugify(entry.nom_fr);
    const imageUrl = dbEntry && dbEntry.images.length > 0
      ? `${JS_DELIVR_BASE}${dbEntry.images[0]}`
      : null;

    const instructions = dbEntry?.instructions || [];

    if (!dbEntry) {
      missed++;
      missedList.push(`${entry.nom_fr} (${entry.nom_en})`);
    } else {
      matched++;
    }

    const { data, error } = await supabase
      .from("exercices")
      .upsert({
        nom_fr: entry.nom_fr,
        nom_en: entry.nom_en,
        slug,
        groupe: entry.groupe,
        sous_region: entry.sous_region,
        equipement: entry.equipement,
        compound: entry.compound,
        role: entry.role,
        assist_inverse: entry.assist_inverse,
        unite_par_defaut: entry.unite,
        pas_par_defaut: entry.pas,
        image_url: imageUrl,
        instructions,
      }, { onConflict: "slug" })
      .select("id")
      .single();

    if (error) {
      console.error(`❌ Erreur insertion ${entry.nom_fr}:`, error.message);
    } else if (data) {
      insertedIds.set(entry.nom_fr, data.id);
    }

    progress(mapping.indexOf(entry) + 1, mapping.length);
  }

  console.log(`\n\n✅ Matchés: ${matched} | Ratés: ${missed}`);
  if (missedList.length > 0) {
    console.log("\n⚠️  Exercices non trouvés dans free-exercise-db (image_url = null):");
    missedList.forEach((name) => console.log(`   - ${name}`));
  }

  // 5. Créer les pools de substitution par sous-région
  console.log("\n📦 Création des pools de substitution...");
  const regions: Map<string, { nom_fr: string; id: string }[]> = new Map();

  for (const entry of mapping) {
    const id = insertedIds.get(entry.nom_fr);
    if (!id) continue;

    const list = regions.get(entry.sous_region) || [];
    list.push({ nom_fr: entry.nom_fr, id });
    regions.set(entry.sous_region, list);
  }

  for (const [region, exos] of regions) {
    for (let i = 0; i < exos.length; i++) {
      const { error } = await supabase
        .from("pools_substitution")
        .upsert({
          sous_region: region,
          exercice_id: exos[i].id,
          ordre: i,
        }, { onConflict: undefined });

      if (error) {
        console.error(`❌ Pool ${region}/${exos[i].nom_fr}:`, error.message);
      }
    }
  }

  console.log(`✅ ${regions.size} pools créés`);

  console.log("\n🎉 Seed terminé !");
}

function progress(current: number, total: number) {
  const pct = Math.round((current / total) * 100);
  const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r   [${bar}] ${pct}% (${current}/${total})`);
}

main().catch(console.error);
