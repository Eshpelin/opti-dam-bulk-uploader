"use client";

import { useState, useMemo } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { User, Users, Loader2, X } from "lucide-react";
import type { AccessorType, AccessType } from "@/types";

interface AccessorSelectorProps {
  /** Override the selected accessor (for per-file usage). When omitted, uses global selectedAccessor. */
  value?: { id: string; type: AccessorType } | null;
  /** Called when the user picks an accessor. When omitted, updates global selectedAccessor. */
  onChange?: (accessor: { id: string; type: AccessorType } | null) => void;
  /** Current access type for compact mode toggle */
  accessType?: AccessType;
  /** Called when the user toggles access type in compact mode */
  onAccessTypeChange?: (accessType: AccessType) => void;
  /** Compact mode for inline use in upload items */
  compact?: boolean;
}

export function AccessorSelector({
  value,
  onChange,
  accessType: accessTypeProp,
  onAccessTypeChange,
  compact,
}: AccessorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const users = useUploadStore((s) => s.users);
  const teams = useUploadStore((s) => s.teams);
  const usersLoading = useUploadStore((s) => s.usersLoading);
  const teamsLoading = useUploadStore((s) => s.teamsLoading);
  const globalAccessor = useUploadStore((s) => s.selectedAccessor);
  const setGlobalAccessor = useUploadStore((s) => s.setSelectedAccessor);

  const selectedAccessor = value !== undefined ? value : globalAccessor;
  const setSelectedAccessor = onChange ?? setGlobalAccessor;

  const selectedLabel = useMemo(() => {
    if (!selectedAccessor) return "None";
    if (selectedAccessor.type === "team") {
      const team = teams.find((t) => t.id === selectedAccessor.id);
      return team?.name ?? "Unknown team";
    }
    const user = users.find((u) => u.id === selectedAccessor.id);
    return user?.fullName ?? "Unknown user";
  }, [selectedAccessor, users, teams]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams.slice(0, 25);
    const term = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(term)).slice(0, 25);
  }, [teams, search]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users.slice(0, 25);
    const term = search.toLowerCase();
    return users.filter((u) => u.fullName.toLowerCase().includes(term)).slice(0, 25);
  }, [users, search]);

  const loading = usersLoading || teamsLoading;

  if (loading && !compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading users and teams...
      </div>
    );
  }

  const dropdownContent = (
    <>
      <Input
        placeholder="Search users and teams..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 h-8 text-xs"
        autoFocus
      />

      {/* Access type toggle inside compact popover */}
      {compact && selectedAccessor && (
        <div className="flex items-center gap-1 mb-2 px-1">
          <span className="text-[10px] text-muted-foreground">Access:</span>
          <button
            onClick={() => onAccessTypeChange?.("view")}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              accessTypeProp === "view"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            View
          </button>
          <button
            onClick={() => onAccessTypeChange?.("edit")}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              accessTypeProp === "edit"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            Edit
          </button>
        </div>
      )}

      <div className="max-h-48 overflow-y-auto">
        {/* None option */}
        <button
          onClick={() => {
            setSelectedAccessor(null);
            setOpen(false);
            setSearch("");
          }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent ${
            !selectedAccessor ? "bg-accent" : ""
          }`}
        >
          None
        </button>

        {/* Teams section */}
        {filteredTeams.length > 0 && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
              Teams
            </div>
            {filteredTeams.map((team) => (
              <button
                key={`team-${team.id}`}
                onClick={() => {
                  setSelectedAccessor({ id: team.id, type: "team" });
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-1.5 truncate ${
                  selectedAccessor?.id === team.id && selectedAccessor?.type === "team"
                    ? "bg-accent"
                    : ""
                }`}
                title={team.name}
              >
                <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{team.name}</span>
              </button>
            ))}
          </>
        )}

        {/* Users section */}
        {filteredUsers.length > 0 && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
              Users
            </div>
            {filteredUsers.map((user) => (
              <button
                key={`user-${user.id}`}
                onClick={() => {
                  setSelectedAccessor({ id: user.id, type: "user" });
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-1.5 truncate ${
                  selectedAccessor?.id === user.id && selectedAccessor?.type === "user"
                    ? "bg-accent"
                    : ""
                }`}
                title={user.fullName}
              >
                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{user.fullName}</span>
              </button>
            ))}
          </>
        )}

        {filteredTeams.length === 0 && filteredUsers.length === 0 && (
          <div className="text-xs text-muted-foreground p-2">
            No results found
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-1.5">
      {!compact && (
        <>
          {selectedAccessor?.type === "team" ? (
            <Users className="h-4 w-4 text-muted-foreground" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">Default accessor:</span>
        </>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={compact ? "h-5 text-[10px] px-1.5 font-normal" : "h-7 text-xs"}
          >
            {compact ? (
              <span className="flex items-center gap-1">
                {selectedAccessor?.type === "team" ? (
                  <Users className="h-2.5 w-2.5" />
                ) : (
                  <User className="h-2.5 w-2.5" />
                )}
                <span className="max-w-[80px] truncate">{selectedLabel}</span>
                {selectedAccessor && (
                  <span className="text-muted-foreground">
                    ({accessTypeProp ?? "view"})
                  </span>
                )}
              </span>
            ) : (
              selectedLabel === "None" ? "None (no permissions)" : selectedLabel
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={compact ? "end" : "start"}
          className={compact ? "w-72" : "w-96"}
        >
          {dropdownContent}
        </PopoverContent>
      </Popover>
      {selectedAccessor && !compact && (
        <button
          onClick={() => setSelectedAccessor(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
