import type { ChessStore } from "./service";
type Row = Record<string, any>;
const clamp = (n: number) => Math.max(0, Math.min(1_000_000, Math.trunc(n) || 0));
export function rewardService(
  store: ChessStore,
  now = Date.now,
  newId = () => crypto.randomUUID(),
) {
  return async (uid: string | undefined, raw: unknown) => {
    if (!uid) throw new Error("UNAUTHENTICATED");
    if (!raw || typeof raw !== "object" || JSON.stringify(raw).length > 8000)
      throw new Error("INVALID_INPUT");
    const input = raw as Row;
    const validId = (id: unknown): id is string =>
      typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
    if (
      !validId(input.rewardId) ||
      !Array.isArray(input.rosterIds) ||
      !input.rosterIds.length ||
      input.rosterIds.length > 50 ||
      !input.rosterIds.every(validId)
    )
      throw new Error("INVALID_INPUT");
    return store.transaction(async (tx) => {
      const profile = await tx.get<Row>("users", uid);
      if (profile?.role !== "student" || !validId(profile.rosterId) || !validId(profile.schoolId))
        throw new Error("FORBIDDEN");
      const author = await tx.get<Row>("students", profile.rosterId);
      const config = await tx.get<Row>("schoolSettings", profile.schoolId);
      const reward = await tx.get<Row>("rewards", input.rewardId);
      const offices = ["interschool", "public", "culture", "sport", "media", "tech", "speaker"];
      const permitted = config?.offices
        ? config.offices[author?.office]?.permissions?.includes("awardRewards")
        : offices.includes(author?.office);
      if (
        !author ||
        author.schoolId !== profile.schoolId ||
        (author.authUid !== uid && author.linkedUserId !== uid) ||
        !permitted ||
        config?.points === false ||
        config?.selfGovernment === false
      )
        throw new Error("FORBIDDEN");
      if (
        !reward ||
        reward.schoolId !== profile.schoolId ||
        reward.authorRosterId !== profile.rosterId
      )
        throw new Error("FORBIDDEN");
      const already: { rosterId: string; name: string }[] = Array.isArray(reward.awarded)
        ? reward.awarded
        : reward.awardedRosterId
          ? [{ rosterId: reward.awardedRosterId, name: reward.awardedName ?? "" }]
          : [];
      const fresh = [...new Set<string>(input.rosterIds)].filter(
        (id) => id !== profile.rosterId && !already.some((a) => a.rosterId === id),
      );
      if (!fresh.length) throw new Error("INVALID_RECIPIENTS");
      const recipients = await Promise.all(fresh.map((id) => tx.get<Row>("students", id)));
      if (recipients.some((r) => !r || r.schoolId !== profile.schoolId))
        throw new Error("FORBIDDEN");
      const points = clamp(Number(reward.points)),
        budget = clamp(Number(author.budget)),
        cost = points * fresh.length;
      if (!points || cost > budget) throw new Error("BUDGET");
      // Client-controlled legacy `hold` is never accepted as proof of payment.
      tx.set("students", profile.rosterId, { ...author, budget: budget - cost });
      const names = recipients.map((student, index) => {
        const rosterId = fresh[index],
          before = clamp(Number(student!.points)),
          next = clamp(before + points);
        tx.set("students", rosterId, { ...student, points: next });
        tx.set("pointsHistory", newId(), {
          schoolId: profile.schoolId,
          rosterId,
          delta: next - before,
          note: `Нагорода: ${String(reward.title).slice(0, 160)}`,
          byUserId: uid,
          byName: profile.displayName ?? "",
          pointsAfter: next,
          createdAt: now(),
        });
        return { rosterId, name: String(student!.name ?? "") };
      });
      const awarded = [...already, ...names];
      tx.set("rewards", input.rewardId, {
        ...reward,
        awarded,
        hold: 0,
        awardedRosterId: awarded[0].rosterId,
        awardedName: awarded.map((a) => a.name).join(", "),
      });
      return { ok: true };
    });
  };
}
