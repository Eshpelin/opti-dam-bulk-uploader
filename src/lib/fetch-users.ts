"use client";

import { useUploadStore } from "@/stores/upload-store";

/**
 * Fetches all CMP users and teams in parallel and stores them.
 * Shared between auth-form (initial login) and session restore (page refresh).
 */
export async function fetchAndStoreUsers() {
  const store = useUploadStore.getState();
  store.setUsersLoading(true);
  store.setTeamsLoading(true);

  const usersPromise = fetch("/api/users")
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const mapped = data.users.map((u: { id: string; fullName: string }) => ({
        id: u.id,
        fullName: u.fullName,
      }));
      store.setUsers(mapped);
      store.addLog("info", `Loaded ${mapped.length} users`);
    })
    .catch(() => {
      store.addLog("warn", "Could not load users. Accessor selection will be unavailable.");
    })
    .finally(() => {
      store.setUsersLoading(false);
    });

  const teamsPromise = fetch("/api/teams")
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const mapped = data.teams.map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }));
      store.setTeams(mapped);
      store.addLog("info", `Loaded ${mapped.length} teams`);
    })
    .catch(() => {
      store.addLog("warn", "Could not load teams. Accessor selection will be unavailable.");
    })
    .finally(() => {
      store.setTeamsLoading(false);
    });

  await Promise.all([usersPromise, teamsPromise]);
}
