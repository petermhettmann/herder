import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildNights } from "@/lib/programme";

// Builds a programme and its nights. The nights come from the pure builder; nothing here decides shape.
export const createProgramme = createServerFn({ method: "POST" })
  .validator(z.object({
    weeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
    mode: z.enum(["machine", "quiet"]),
    startDate: z.string().min(8),
    name: z.string().max(80).optional(),
  }))
  .handler(async ({ data, context }) => {
    const db = context.getBase44();
    const nights = buildNights(data);

    // Only one programme runs at a time.
    await db.entities.Programme.updateMany({ status: "active" }, { $set: { status: "abandoned" } });

    const programme = await db.entities.Programme.create({
      name: data.name || `${data.weeks} week ${data.mode}`,
      mode: data.mode,
      weeks: data.weeks,
      start_date: data.startDate,
      status: "active",
    });

    const rows = nights.map((night) => ({ ...night, programme: programme.id }));
    if (typeof db.entities.Night.bulkCreate === "function") {
      await db.entities.Night.bulkCreate(rows);
    } else {
      for (const row of rows) await db.entities.Night.create(row);
    }

    return { programmeId: programme.id, nights: rows.length };
  });