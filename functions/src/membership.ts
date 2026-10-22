import type { ChessTransaction } from "./service";

type Row = Record<string, any>;
export interface MembershipTransaction extends ChessTransaction {
  find(collection: string, field: string, value: string): Promise<{ id: string; data: Row }[]>;
}
export interface MembershipStore {
  transaction<T>(work: (tx: MembershipTransaction) => Promise<T>): Promise<T>;
}
const id = (v: unknown): string => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new Error("INVALID_ID");
  return v;
};
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Privileged membership changes never trust a role, school or roster sent by a browser.
export function membershipService(
  store: MembershipStore,
  now = Date.now,
  newId = () => crypto.randomUUID(),
) {
  return async (actor: { uid: string; email?: string | null } | undefined, raw: unknown) => {
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || JSON.stringify(raw).length > 8000)
      throw new Error("INVALID_INPUT");
    const input = raw as Row,
      { uid } = actor,
      time = now();
    // Commit the attempt separately, including failed codes. Throwing inside the main
    // transaction would roll back the rate limit and allow unlimited guessing.
    await store.transaction(async (tx) => {
      const old = await tx.get<Row>("membershipLimits", uid);
      const reset = !old || time - old.start >= 600_000;
      const count = reset ? 0 : old.count;
      if (count >= 20) throw new Error("RATE_LIMIT");
      tx.set("membershipLimits", uid, { start: reset ? time : old.start, count: count + 1 });
    });
    return store.transaction(async (tx) => {
      const profile = await tx.get<Row>("users", uid);
      const base = {
        ...profile,
        email: actor.email ?? null,
        displayName:
          text(input.displayName) ||
          profile?.displayName ||
          text(actor.email?.split("@")[0]) ||
          "Користувач",
        createdAt: profile?.createdAt ?? time,
      };
      const save = (patch: Row) => tx.set("users", uid, { ...base, ...patch });
      if (input.action === "createSchool") {
        if (profile?.schoolId) throw new Error("ALREADY_LINKED");
        const name = text(input.name);
        if (!name) throw new Error("INVALID_NAME");
        const schoolId = newId();
        tx.set("schools", schoolId, {
          name,
          createdBy: uid,
          creatorEmail: actor.email ?? null,
          createdAt: time,
        });
        save({
          role: "admin",
          isAdmin: true,
          schoolId,
          schoolName: name,
          rosterId: null,
          classId: null,
          groupId: null,
          setupComplete: true,
        });
        return { schoolId };
      }
      if (input.action === "createChat") {
        if (!profile?.schoolId || !["student", "parent", "teacher", "admin"].includes(profile.role))
          throw new Error("FORBIDDEN");
        const cfg = await tx.get<Row>("schoolSettings", profile.schoolId);
        if (cfg?.chat === false) throw new Error("FEATURE_DISABLED");
        if (
          !["dm", "group"].includes(input.kind) ||
          !Array.isArray(input.memberUids) ||
          input.memberUids.length > 30
        )
          throw new Error("INVALID_MEMBERS");
        const members = [...new Set([uid, ...input.memberUids.map(id)])];
        if (members.length < 2 || (input.kind === "dm" && members.length !== 2))
          throw new Error("INVALID_MEMBERS");
        for (const member of members) {
          const p = await tx.get<Row>("users", member);
          if (p?.schoolId !== profile.schoolId) throw new Error("FORBIDDEN");
        }
        const chatId = newId();
        tx.set("chats", chatId, {
          schoolId: profile.schoolId,
          kind: input.kind,
          name: text(input.name) || "Діалог",
          classId: null,
          memberUids: members,
          isAuto: false,
          createdBy: uid,
          lastBody: null,
          lastAt: null,
        });
        return { id: chatId };
      }
      const code = text(input.code, 32).replace(/\s/g, "").toUpperCase();
      if (!/^[A-Z2-9]{16}$/.test(code)) throw new Error("CODE_NOT_FOUND");
      if (input.action === "joinTeacher") {
        const invite = await tx.get<Row>("teacherInvites", code);
        if (!invite) throw new Error("CODE_NOT_FOUND");
        if (invite.usedBy && invite.usedBy !== uid) throw new Error("CODE_USED");
        if (
          profile?.schoolId &&
          (profile.schoolId !== invite.schoolId || !["teacher", "admin"].includes(profile.role))
        )
          throw new Error("ALREADY_LINKED");
        const school = await tx.get<Row>("schools", id(invite.schoolId));
        if (!school) throw new Error("CODE_NOT_FOUND");
        if (invite.usedBy === uid && profile?.schoolId === invite.schoolId)
          return { schoolId: invite.schoolId };
        tx.set("teacherInvites", code, { ...invite, usedBy: uid });
        save({
          role: "teacher",
          isAdmin: false,
          schoolId: invite.schoolId,
          schoolName: school.name,
          rosterId: null,
          classId: null,
          groupId: null,
          setupComplete: false,
        });
        return { schoolId: invite.schoolId };
      }
      if (!["linkStudent", "linkParent"].includes(input.action)) throw new Error("INVALID_ACTION");
      const invites = await tx.find("studentInvites", "code", code);
      if (invites.length !== 1) throw new Error("CODE_NOT_FOUND");
      const invite = invites[0];
      const roster = await tx.get<Row>("students", invite.id);
      if (!roster || roster.schoolId !== invite.data.schoolId) throw new Error("CODE_NOT_FOUND");
      const school = await tx.get<Row>("schools", id(roster.schoolId));
      if (!school) throw new Error("CODE_NOT_FOUND");
      const parent = input.action === "linkParent";
      const demo =
        input.demo === true &&
        !parent &&
        school.createdBy === uid &&
        profile?.schoolId === roster.schoolId;
      const same =
        profile?.schoolId === roster.schoolId &&
        profile?.rosterId === invite.id &&
        profile?.role === (parent ? "parent" : "student");
      if (profile?.schoolId && !same && !demo) throw new Error("ALREADY_LINKED");
      if (!parent && [roster.authUid, roster.linkedUserId].some((owner) => owner && owner !== uid))
        throw new Error("CODE_USED");
      const teacherChats: { id: string; data: Row }[] = [];
      if (demo) {
        for (const c of school.chatIds ?? []) {
          if (c.kind !== "teachers") continue;
          const chat = await tx.get<Row>("chats", id(c.id));
          if (chat && chat.schoolId === roster.schoolId && chat.kind === "teachers")
            teacherChats.push({ id: c.id, data: chat });
        }
      }
      for (const c of teacherChats)
        tx.set("chats", c.id, {
          ...c.data,
          memberUids: c.data.memberUids.filter((member: string) => member !== uid),
        });
      tx.set(
        "students",
        invite.id,
        parent
          ? { ...roster, parentUids: [...new Set([...(roster.parentUids ?? []), uid])] }
          : { ...roster, authUid: uid, linkedUserId: uid },
      );
      save({
        role: parent ? "parent" : "student",
        isAdmin: false,
        schoolId: roster.schoolId,
        schoolName: school.name,
        classId: roster.classId ?? null,
        groupId: roster.groupId ?? null,
        rosterId: invite.id,
        childRosterId: parent ? invite.id : null,
        displayName: parent ? base.displayName : roster.name,
        setupComplete: true,
      });
      return { schoolId: roster.schoolId };
    });
  };
}
