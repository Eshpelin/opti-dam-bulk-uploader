"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  UploadFile,
  LogEntry,
  LogSeverity,
  CmpFolder,
  CmpUser,
  CmpTeam,
  FileSource,
  AccessorType,
  AccessType,
} from "@/types";

const MAX_LOG_ENTRIES = 50_000;
let logIdCounter = 0;

interface UploadStore {
  // Auth
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;

  // Files
  files: Map<string, UploadFile>;
  fileOrder: string[];

  // Queue control
  maxParallelSlots: number;
  isUploading: boolean;
  isPaused: boolean;

  // Folder
  selectedFolderId: string | null;
  folders: CmpFolder[];
  foldersLoading: boolean;

  // Accessor (users and teams)
  users: CmpUser[];
  usersLoading: boolean;
  teams: CmpTeam[];
  teamsLoading: boolean;
  selectedAccessor: { id: string; type: AccessorType } | null;
  selectedAccessType: AccessType;

  // Console
  logs: LogEntry[];
  logFilter: "all" | "error" | "warn" | "info";

  // Auth actions
  setAuthenticating: (v: boolean) => void;
  setAuthenticated: (v: boolean) => void;
  setAuthError: (err: string | null) => void;

  // File actions
  addFiles: (
    items: Array<{
      name: string;
      size: number;
      source: FileSource;
      sourcePath: string;
      browserFile?: File | null;
      relativePath?: string | null;
    }>
  ) => void;
  removeFile: (id: string) => void;
  retryFile: (id: string) => void;
  setFileFolderId: (id: string, folderId: string | null) => void;
  clearCompleted: () => void;

  // Progress actions
  updateFileProgress: (
    id: string,
    updates: Partial<
      Pick<
        UploadFile,
        | "status"
        | "progress"
        | "bytesUploaded"
        | "size"
        | "speed"
        | "eta"
        | "completedChunks"
        | "assetId"
        | "error"
        | "uploadId"
        | "cmpKey"
        | "totalChunks"
        | "startedAt"
        | "completedAt"
        | "folderId"
        | "accessorId"
        | "accessorType"
        | "accessType"
      >
    >
  ) => void;
  setFileStatus: (
    id: string,
    status: UploadFile["status"],
    extra?: Partial<UploadFile>
  ) => void;

  // Queue actions
  setIsUploading: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setMaxParallelSlots: (n: number) => void;

  // Folder actions
  setFolders: (folders: CmpFolder[]) => void;
  setFoldersLoading: (v: boolean) => void;
  setSelectedFolderId: (id: string | null) => void;

  // Accessor actions
  setUsers: (users: CmpUser[]) => void;
  setUsersLoading: (v: boolean) => void;
  setTeams: (teams: CmpTeam[]) => void;
  setTeamsLoading: (v: boolean) => void;
  setSelectedAccessor: (accessor: { id: string; type: AccessorType } | null) => void;
  setSelectedAccessType: (type: AccessType) => void;
  setFileAccessor: (fileId: string, accessor: { id: string; type: AccessorType } | null) => void;
  setFileAccessType: (fileId: string, accessType: AccessType) => void;

  // Console actions
  addLog: (severity: LogSeverity, message: string, fileName?: string) => void;
  setLogFilter: (filter: "all" | "error" | "warn" | "info") => void;
  clearLogs: () => void;

  // Reset
  reset: () => void;
}

function makeEmptyFile(
  name: string,
  size: number,
  source: FileSource,
  sourcePath: string,
  browserFile?: File | null,
  relativePath?: string | null
): UploadFile {
  return {
    id: uuidv4(),
    name,
    source,
    sourcePath,
    size,
    status: "queued",
    progress: 0,
    bytesUploaded: 0,
    speed: 0,
    eta: 0,
    assetId: null,
    error: null,
    uploadId: null,
    cmpKey: null,
    totalChunks: 0,
    completedChunks: 0,
    startedAt: null,
    completedAt: null,
    browserFile: browserFile ?? null,
    folderId: null,
    relativePath: relativePath ?? null,
    accessorId: null,
    accessorType: null,
    accessType: "view",
  };
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isAuthenticating: false,
  authError: null,
  files: new Map(),
  fileOrder: [],
  maxParallelSlots: 6,
  isUploading: false,
  isPaused: false,
  selectedFolderId: null,
  folders: [],
  foldersLoading: false,
  users: [],
  usersLoading: false,
  teams: [],
  teamsLoading: false,
  selectedAccessor: null,
  selectedAccessType: "view",
  logs: [],
  logFilter: "all",

  // Auth
  setAuthenticating: (v) => set({ isAuthenticating: v }),
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  setAuthError: (err) => set({ authError: err }),

  // File actions
  addFiles: (items) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const newOrder = [...state.fileOrder];
      const newLogs = [...state.logs];

      for (const item of items) {
        const file = makeEmptyFile(
          item.name,
          item.size,
          item.source,
          item.sourcePath,
          item.browserFile,
          item.relativePath
        );
        // Inherit the current defaults
        file.folderId = state.selectedFolderId;
        if (state.selectedAccessor) {
          file.accessorId = state.selectedAccessor.id;
          file.accessorType = state.selectedAccessor.type;
        }
        file.accessType = state.selectedAccessType;
        newFiles.set(file.id, file);
        newOrder.push(file.id);

        newLogs.push({
          id: ++logIdCounter,
          timestamp: Date.now(),
          severity: "info",
          message: `Added to queue (${formatSize(item.size)})`,
          fileName: item.name,
        });
      }

      // Trim logs
      while (newLogs.length > MAX_LOG_ENTRIES) {
        newLogs.shift();
      }

      return { files: newFiles, fileOrder: newOrder, logs: newLogs };
    }),

  removeFile: (id) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(id);
      newFiles.delete(id);
      const newOrder = state.fileOrder.filter((fid) => fid !== id);

      const newLogs = [...state.logs];
      if (file) {
        newLogs.push({
          id: ++logIdCounter,
          timestamp: Date.now(),
          severity: "info",
          message: `Removed from queue`,
          fileName: file.name,
        });
      }

      return { files: newFiles, fileOrder: newOrder, logs: newLogs };
    }),

  retryFile: (id) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(id);
      if (!file || file.status !== "failed") return state;

      const retried: UploadFile = {
        ...file,
        status: "queued",
        progress: 0,
        bytesUploaded: 0,
        speed: 0,
        eta: 0,
        error: null,
        uploadId: null,
        cmpKey: null,
        completedChunks: 0,
        totalChunks: 0,
        startedAt: null,
        completedAt: null,
      };
      newFiles.set(id, retried);

      const newLogs = [...state.logs];
      newLogs.push({
        id: ++logIdCounter,
        timestamp: Date.now(),
        severity: "info",
        message: `Re-queued for retry`,
        fileName: file.name,
      });

      return { files: newFiles, logs: newLogs };
    }),

  setFileFolderId: (id, folderId) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(id);
      if (!file || file.status !== "queued") return state;
      newFiles.set(id, { ...file, folderId });
      return { files: newFiles };
    }),

  clearCompleted: () =>
    set((state) => {
      const newFiles = new Map(state.files);
      const removed: string[] = [];

      for (const [id, file] of newFiles) {
        if (file.status === "completed") {
          newFiles.delete(id);
          removed.push(id);
        }
      }

      const newOrder = state.fileOrder.filter(
        (id) => !removed.includes(id)
      );
      return { files: newFiles, fileOrder: newOrder };
    }),

  // Progress
  updateFileProgress: (id, updates) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(id);
      if (!file) return state;

      newFiles.set(id, { ...file, ...updates });
      return { files: newFiles };
    }),

  setFileStatus: (id, status, extra) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(id);
      if (!file) return state;

      const updated = { ...file, status, ...extra };
      newFiles.set(id, updated);

      const newLogs = [...state.logs];
      if (status === "completed") {
        newLogs.push({
          id: ++logIdCounter,
          timestamp: Date.now(),
          severity: "success",
          message: `Upload complete. Asset ID: ${extra?.assetId ?? "unknown"}`,
          fileName: file.name,
        });
      } else if (status === "failed") {
        newLogs.push({
          id: ++logIdCounter,
          timestamp: Date.now(),
          severity: "error",
          message: `Upload failed: ${extra?.error ?? "Unknown error"}`,
          fileName: file.name,
        });
      }

      while (newLogs.length > MAX_LOG_ENTRIES) {
        newLogs.shift();
      }

      return { files: newFiles, logs: newLogs };
    }),

  // Queue
  setIsUploading: (v) => set({ isUploading: v }),
  setIsPaused: (v) => set({ isPaused: v }),
  setMaxParallelSlots: (n) =>
    set({ maxParallelSlots: Math.max(1, Math.min(12, n)) }),

  // Folders
  setFolders: (folders) => set({ folders }),
  setFoldersLoading: (v) => set({ foldersLoading: v }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),

  // Accessors
  setUsers: (users) => set({ users }),
  setUsersLoading: (v) => set({ usersLoading: v }),
  setTeams: (teams) => set({ teams }),
  setTeamsLoading: (v) => set({ teamsLoading: v }),
  setSelectedAccessor: (accessor) => set({ selectedAccessor: accessor }),
  setSelectedAccessType: (type) => set({ selectedAccessType: type }),
  setFileAccessor: (fileId, accessor) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(fileId);
      if (!file || file.status !== "queued") return state;
      newFiles.set(fileId, {
        ...file,
        accessorId: accessor?.id ?? null,
        accessorType: accessor?.type ?? null,
      });
      return { files: newFiles };
    }),
  setFileAccessType: (fileId, accessType) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(fileId);
      if (!file || file.status !== "queued") return state;
      newFiles.set(fileId, { ...file, accessType });
      return { files: newFiles };
    }),

  // Console
  addLog: (severity, message, fileName) =>
    set((state) => {
      const newLogs = [...state.logs];
      newLogs.push({
        id: ++logIdCounter,
        timestamp: Date.now(),
        severity,
        message,
        fileName,
      });
      while (newLogs.length > MAX_LOG_ENTRIES) {
        newLogs.shift();
      }
      return { logs: newLogs };
    }),

  setLogFilter: (filter) => set({ logFilter: filter }),
  clearLogs: () => set({ logs: [] }),

  // Reset
  reset: () =>
    set({
      isAuthenticated: false,
      isAuthenticating: false,
      authError: null,
      files: new Map(),
      fileOrder: [],
      isUploading: false,
      isPaused: false,
      selectedFolderId: null,
      folders: [],
      foldersLoading: false,
      users: [],
      usersLoading: false,
      teams: [],
      teamsLoading: false,
      selectedAccessor: null,
      selectedAccessType: "view",
      logs: [],
      logFilter: "all",
    }),
}));

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
