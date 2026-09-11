import { describe, expect, it, beforeEach } from 'vitest';
import { panelLabel, useUiPanelStore } from './uiPanelStore';

beforeEach(() => {
  useUiPanelStore.setState({ closedPanels: {}, lastClosed: null });
});

describe('uiPanelStore close/restore', () => {
  it('closes a panel and tracks it as last closed', () => {
    useUiPanelStore.getState().closePanel('weather');
    const state = useUiPanelStore.getState();
    expect(state.closedPanels['weather']).toBe(true);
    expect(state.lastClosed).toBe('weather');
  });

  it('reopens the last closed panel, falling back to the previous one', () => {
    const store = useUiPanelStore.getState();
    store.closePanel('layers');
    useUiPanelStore.getState().closePanel('weather');
    useUiPanelStore.getState().reopenLastClosed();
    const state = useUiPanelStore.getState();
    expect(state.closedPanels['weather']).toBeUndefined();
    expect(state.closedPanels['layers']).toBe(true);
    expect(state.lastClosed).toBe('layers');
  });

  it('reopening a non-last panel keeps lastClosed intact', () => {
    useUiPanelStore.getState().closePanel('layers');
    useUiPanelStore.getState().closePanel('weather');
    useUiPanelStore.getState().reopenPanel('layers');
    const state = useUiPanelStore.getState();
    expect(state.closedPanels['layers']).toBeUndefined();
    expect(state.lastClosed).toBe('weather');
  });

  it('labels every FloatingPanel id used in the app', () => {
    for (const id of ['layers', 'geodetic', 'datum-viz', 'evacuation', 'shelters', 'weather', 'alerts', 'fuel', 'storytelling']) {
      expect(panelLabel(id)).not.toBe(id);
    }
  });
});
