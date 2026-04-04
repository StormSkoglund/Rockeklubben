import { createClient } from "@supabase/supabase-js";
import readline from "readline";
import fs from "fs";
import path from "path";

// Load .env if present so the script works without manual `export` in PowerShell
function loadDotEnvFile() {
  try {
    const p = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(p)) return;
    const content = fs.readFileSync(p, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(.+))$/,
      );
      if (!m) continue;
      const key = m[1];
      const val = m[2] ?? m[3] ?? m[4] ?? "";
      const clean = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
      if (!process.env[key]) process.env[key] = clean;
    }
  } catch (err) {
    // ignore — fall back to existing env vars
  }
}
loadDotEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_ variants).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WEEKLY_TEMPLATES = [
  {
    names: "Silver Monochrome",
    weekday: 1,
    startTime: "18:00",
    endTime: "22:00",
  },
  {
    names: "Young Collection",
    weekday: 2,
    startTime: "16:00",
    endTime: "20:00",
  },
  {
    names: "Blue Experience",
    weekday: 3,
    startTime: "16:00",
    endTime: "20:30",
  },
  {
    names: ["Warfart", "Verdiløse Menn"],
    weekday: 4,
    startTime: "18:00",
    endTime: "23:00",
  },
  { names: "Dødsdau", weekday: 5, startTime: "18:00", endTime: "23:00" },
  { names: "Notörious", weekday: 6, startTime: "14:00", endTime: "18:00" },
  { names: "Storm Valley", weekday: 6, startTime: "18:30", endTime: "23:00" },
  { names: "Tommy Cash", weekday: 0, startTime: "18:00", endTime: "23:00" },
];

function getDateForWeekday(base, weekday, weekOffset = 0) {
  const d = new Date(base);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff + weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function setTime(dt, timeStr) {
  const [hh, mm] = timeStr.split(":").map((n) => parseInt(n, 10));
  const d = new Date(dt);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function getIsoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

function getWeekAwareName(tpl, dayDate) {
  if (!Array.isArray(tpl.names)) return tpl.names;
  // requested: Warfart on odd ISO week numbers, Verdiløse Menn on even.
  const weekNum = getIsoWeekNumber(dayDate);
  const index = weekNum % 2 === 1 ? 0 : 1;
  return tpl.names[index];
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function confirmPrompt(question) {
  return new Promise((res) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (ans) => {
      rl.close();
      res(/^y(es)?$/i.test(ans));
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  let weeks = 52;
  let autoYes = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") autoYes = true;
    if ((a === "--weeks" || a === "-w") && argv[i + 1]) {
      weeks = parseInt(argv[i + 1], 10) || weeks;
      i++;
    }
    if (!isNaN(Number(a)) && argv.length === 1) {
      weeks = parseInt(a, 10);
    }
  }

  if (!autoYes) {
    const ok = await confirmPrompt(
      `Insert weekly schedule for the next ${weeks} weeks? (yes/no) `,
    );
    if (!ok) {
      console.log("Aborted by user.");
      process.exit(0);
    }
  }

  console.log(`Seeding weekly schedule — ${weeks} weeks...`);
  const today = new Date();
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let w = 0; w < weeks; w++) {
    for (const tpl of WEEKLY_TEMPLATES) {
      const dayDate = getDateForWeekday(today, tpl.weekday, w);
      const bandName = getWeekAwareName(tpl, dayDate);
      const startDt = setTime(dayDate, tpl.startTime);
      const endDt = setTime(dayDate, tpl.endTime);

      try {
        const { data, error } = await supabase
          .from("bookings")
          .insert([
            {
              start_ts: startDt.toISOString(),
              end_ts: endDt.toISOString(),
              user_name: bandName,
              date: toYMD(startDt),
            },
          ])
          .select()
          .single();

        if (error || !data) {
          skipped++;
          // log cause for visibility
          if (error)
            console.log(
              `Skipped ${bandName} ${toYMD(startDt)} (${error.message || error.details || "constraint"})`,
            );
          continue;
        }

        inserted++;
        process.stdout.write(`+`);
      } catch (err) {
        failed++;
        console.error(
          `Error inserting ${bandName} on ${toYMD(startDt)}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    // small flush for readability
    if (w % 5 === 0) process.stdout.write(` (${w + 1}/${weeks} weeks)\n`);
  }

  console.log(
    `\nDone — inserted: ${inserted}, skipped: ${skipped}, failed: ${failed}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
