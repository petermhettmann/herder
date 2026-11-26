// Shared by the agent's tool routes: the agent may pass a check-in id, or none.
export async function resolveCheckInId(base44, checkInId) {
  if (typeof checkInId === "string" && checkInId.trim()) return checkInId.trim();

  const sessionPage = await base44.entities.Session.filter(
    { status: { $in: ["active", "break"] } },
    { sort: "-start_time", limit: 1 },
  );
  const session = (sessionPage.items ?? [])[0];
  if (!session) return null;

  const checkInPage = await base44.entities.CheckIn.filter(
    { session: session.id },
    { sort: "-created_date", limit: 1 },
  );
  return (checkInPage.items ?? [])[0]?.id ?? null;
}