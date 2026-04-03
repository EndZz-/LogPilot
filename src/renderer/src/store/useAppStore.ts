import { create } from 'zustand'
import {
  ParsedLog, ColorRule, ColorProfile, SessionSettings, LogLevel, EventGroup, DayBucket
} from '../../../shared/types'

export interface LoadedLog extends ParsedLog {
  loadProgress?: number  // 0-100 while loading
  isLoading?: boolean
}

export interface SelectedEntry {
  logId: string
  entryId: string
  timestamp: Date | null
}

export type ContextMenuState =
  | { type: 'group'; x: number; y: number; groupId: string; logId: string }
  | { type: 'date';  x: number; y: number; date: string;    logId: string }
  | null

interface AppState {
  // Loaded logs (one per tab)
  logs: LoadedLog[]
  activeLogId: string | null

  // Selection for correlation
  selectedEntry: SelectedEntry | null

  // Settings
  settings: SessionSettings

  // Color profiles
  colorProfiles: ColorProfile[]
  activeProfileId: string

  // Context menu
  contextMenu: ContextMenuState

  // Correlation window
  correlationOpen: boolean

  // Search/filter per log
  searchTerms: Record<string, string>

  // View mode per log
  viewModes: Record<string, 'grouped' | 'chronological'>

  // Level filters per log (stores hidden canonical level names, e.g. 'WARN' covers WARN+WARNING)
  levelFilters: Record<string, string[]>

  // Hidden items per log
  hiddenDates: Record<string, string[]>    // logId -> date[]
  hiddenGroups: Record<string, string[]>  // logId -> groupId[]

  // Whether the hidden panel is open
  hiddenPanelOpen: boolean

  // Actions
  addLog: (log: LoadedLog) => void
  updateLog: (id: string, patch: Partial<LoadedLog>) => void
  removeLog: (id: string) => void
  setActiveLog: (id: string) => void
  setSelectedEntry: (entry: SelectedEntry | null) => void

  toggleGroupCollapsed: (logId: string, bucketDate: string, groupId: string) => void
  toggleDayCollapsed: (logId: string, bucketDate: string) => void
  collapseAll: (logId: string) => void
  collapseDates: (logId: string) => void
  expandAll: (logId: string) => void

  setGroupColor: (logId: string, groupId: string, color: string | undefined) => void
  setGroupSignificant: (logId: string, groupId: string, significant: boolean) => void

  setContextMenu: (menu: ContextMenuState) => void
  setCorrelationOpen: (open: boolean) => void
  setSearchTerm: (logId: string, term: string) => void
  updateSettings: (patch: Partial<SessionSettings>) => void

  setViewMode: (logId: string, mode: 'grouped' | 'chronological') => void
  toggleLevelFilter: (logId: string, level: string) => void

  hideDate: (logId: string, date: string) => void
  unhideDate: (logId: string, date: string) => void
  hideAllOtherDates: (logId: string, keepDate: string) => void
  hideGroup: (logId: string, groupId: string) => void
  unhideGroup: (logId: string, groupId: string) => void
  setHiddenPanelOpen: (open: boolean) => void

  addColorProfile: (profile: ColorProfile) => void
  updateColorProfile: (id: string, patch: Partial<ColorProfile>) => void
  setActiveProfile: (id: string) => void
}

const DEFAULT_SETTINGS: SessionSettings = {
  correlationWindowSize: 10,
  fuzzyThreshold: 0.55,
  autoCollapseThreshold: 3,
  showNonSignificant: true,
  correlationWindowOpen: true
}

export const useAppStore = create<AppState>((set, get) => ({
  logs: [],
  activeLogId: null,
  selectedEntry: null,
  settings: DEFAULT_SETTINGS,
  colorProfiles: [],
  activeProfileId: 'default',
  contextMenu: null,
  correlationOpen: true,
  searchTerms: {},
  viewModes: {},
  levelFilters: {},
  hiddenDates: {},
  hiddenGroups: {},
  hiddenPanelOpen: false,

  addLog: (log) => set((s) => ({
    logs: [...s.logs, log],
    activeLogId: s.activeLogId ?? log.id
  })),

  updateLog: (id, patch) => set((s) => ({
    logs: s.logs.map(l => l.id === id ? { ...l, ...patch } : l)
  })),

  removeLog: (id) => set((s) => {
    const remaining = s.logs.filter(l => l.id !== id)
    const newActive = s.activeLogId === id
      ? (remaining[remaining.length - 1]?.id ?? null)
      : s.activeLogId
    return { logs: remaining, activeLogId: newActive }
  }),

  setActiveLog: (id) => set({ activeLogId: id }),
  setSelectedEntry: (entry) => set({ selectedEntry: entry }),

  toggleGroupCollapsed: (logId, bucketDate, groupId) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => b.date !== bucketDate ? b : {
        ...b,
        groups: b.groups.map(g => g.id !== groupId ? g : { ...g, collapsed: !g.collapsed })
      })
    })
  })),

  toggleDayCollapsed: (logId, bucketDate) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => b.date !== bucketDate ? b : { ...b, collapsed: !b.collapsed })
    })
  })),

  collapseAll: (logId) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => ({
        ...b,
        groups: b.groups.map(g => ({ ...g, collapsed: true }))
      }))
    })
  })),

  collapseDates: (logId) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => ({ ...b, collapsed: true }))
    })
  })),

  expandAll: (logId) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => ({
        ...b,
        collapsed: false,
        groups: b.groups.map(g => ({ ...g, collapsed: false }))
      }))
    })
  })),

  setGroupColor: (logId, groupId, color) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => ({
        ...b,
        groups: b.groups.map(g => g.id !== groupId ? g : { ...g, color })
      }))
    })
  })),

  setGroupSignificant: (logId, groupId, significant) => set((s) => ({
    logs: s.logs.map(l => l.id !== logId ? l : {
      ...l,
      buckets: l.buckets.map(b => ({
        ...b,
        groups: b.groups.map(g => g.id !== groupId ? g : { ...g, significant })
      }))
    })
  })),

  setContextMenu: (menu) => set({ contextMenu: menu }),
  setCorrelationOpen: (open) => set({ correlationOpen: open }),
  setSearchTerm: (logId, term) => set((s) => ({ searchTerms: { ...s.searchTerms, [logId]: term } })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setViewMode: (logId, mode) => set((s) => ({ viewModes: { ...s.viewModes, [logId]: mode } })),

  toggleLevelFilter: (logId, level) => set((s) => {
    const current = s.levelFilters[logId] ?? []
    const next = current.includes(level) ? current.filter(l => l !== level) : [...current, level]
    return { levelFilters: { ...s.levelFilters, [logId]: next } }
  }),

  hideDate: (logId, date) => set((s) => ({
    hiddenDates: { ...s.hiddenDates, [logId]: [...(s.hiddenDates[logId] ?? []).filter(d => d !== date), date] }
  })),
  unhideDate: (logId, date) => set((s) => ({
    hiddenDates: { ...s.hiddenDates, [logId]: (s.hiddenDates[logId] ?? []).filter(d => d !== date) }
  })),
  hideAllOtherDates: (logId, keepDate) => set((s) => {
    const log = s.logs.find(l => l.id === logId)
    if (!log) return {}
    const others = log.buckets.map(b => b.date).filter(d => d !== keepDate)
    const existing = s.hiddenDates[logId] ?? []
    const merged = Array.from(new Set([...existing, ...others]))
    return { hiddenDates: { ...s.hiddenDates, [logId]: merged } }
  }),
  hideGroup: (logId, groupId) => set((s) => ({
    hiddenGroups: { ...s.hiddenGroups, [logId]: [...(s.hiddenGroups[logId] ?? []).filter(id => id !== groupId), groupId] }
  })),
  unhideGroup: (logId, groupId) => set((s) => ({
    hiddenGroups: { ...s.hiddenGroups, [logId]: (s.hiddenGroups[logId] ?? []).filter(id => id !== groupId) }
  })),
  setHiddenPanelOpen: (open) => set({ hiddenPanelOpen: open }),

  addColorProfile: (profile) => set((s) => ({ colorProfiles: [...s.colorProfiles, profile] })),
  updateColorProfile: (id, patch) => set((s) => ({
    colorProfiles: s.colorProfiles.map(p => p.id !== id ? p : { ...p, ...patch })
  })),
  setActiveProfile: (id) => set({ activeProfileId: id })
}))

