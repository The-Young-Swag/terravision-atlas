import { create } from 'zustand';

// Session-scoped visibility for floating bubble panels (Item 12).
// Close hides the panel for the session WITHOUT unmounting its content —
// FloatingPanel keeps children mounted under a `hidden` wrapper, so user
// inputs and selections survive a close/restore cycle. No data or panel
// logic lives here, only display availability.
interface UiPanelState {
  /** Panel ids currently hidden via the toolbar Close action. */
  closedPanels: Record<string, true>;
  /** Most recently closed panel id (restore entry point), null when none. */
  lastClosed: string | null;
  closePanel: (id: string) => void;
  reopenPanel: (id: string) => void;
  reopenLastClosed: () => void;
}

export const useUiPanelStore = create<UiPanelState>((set) => ({
  closedPanels: {},
  lastClosed: null,
  closePanel: (id) =>
    set((state) => ({
      closedPanels: { ...state.closedPanels, [id]: true },
      lastClosed: id,
    })),
  reopenPanel: (id) =>
    set((state) => {
      const closedPanels = { ...state.closedPanels };
      delete closedPanels[id];
      const remaining = Object.keys(closedPanels);
      return {
        closedPanels,
        lastClosed:
          state.lastClosed === id ? (remaining.length > 0 ? remaining[remaining.length - 1] : null) : state.lastClosed,
      };
    }),
  reopenLastClosed: () =>
    set((state) => {
      if (!state.lastClosed) return state;
      const closedPanels = { ...state.closedPanels };
      delete closedPanels[state.lastClosed];
      const remaining = Object.keys(closedPanels);
      return {
        closedPanels,
        lastClosed: remaining.length > 0 ? remaining[remaining.length - 1] : null,
      };
    }),
}));

/** Human-readable labels for the restore control (keys = FloatingPanel ids). */
export const PANEL_LABELS: Record<string, string> = {
  layers: 'Layers',
  geodetic: 'Geodetic',
  'datum-viz': 'Datum shift',
  evacuation: 'Navigation',
  shelters: 'Shelter locator',
  weather: 'Weather',
  alerts: 'Live alerts',
  fuel: 'Fuel calculator',
  storytelling: 'Storytelling',
};

export function panelLabel(id: string): string {
  return PANEL_LABELS[id] ?? id;
}
