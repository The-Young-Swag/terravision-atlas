// Mobile-only floating tool bubble (iPhone-style FAB). Rendered only below
// the md breakpoint (md:hidden); desktop keeps the fixed NotchSidebar.
// Tapping the bubble fans out the real panel entry points — the same panel
// ids the notch opens (layers, alerts, weather, navigation/evacuation,
// survey tools, shelters, filtered by active mode) via the shared
// close/restore store, so a closed panel reopens from here. Panels
// themselves keep their real app content; this menu holds no panel data.

import { useState } from 'react';
import {
  AlertTriangle,
  CloudSun,
  HousePlus,
  Layers,
  Navigation,
  Plus,
  Ruler,
} from 'lucide-react';
import { useUiPanelStore } from '../../shared/stores/uiPanelStore';
import type { AppMode } from '../../shared/types';

interface FabItem {
  panelId: string;
  label: string;
  icon: typeof Layers;
  accent: string;
  modes: AppMode[] | 'all';
}

const ITEMS: FabItem[] = [
  { panelId: 'layers', label: 'Layers', icon: Layers, accent: '#8b7bff', modes: 'all' },
  { panelId: 'alerts', label: 'Live alerts', icon: AlertTriangle, accent: '#ff6b6b', modes: 'all' },
  { panelId: 'weather', label: 'Weather', icon: CloudSun, accent: '#38bdf8', modes: ['explore', 'monitor'] },
  { panelId: 'evacuation', label: 'Navigation', icon: Navigation, accent: '#00d890', modes: ['explore', 'monitor'] },
  { panelId: 'geodetic', label: 'Survey tools', icon: Ruler, accent: '#f59e0b', modes: ['survey'] },
  { panelId: 'shelters', label: 'Shelter locator', icon: HousePlus, accent: '#a78bfa', modes: ['monitor'] },
];

export function MobileToolFab({ activeMode }: { activeMode: AppMode }) {
  const [open, setOpen] = useState(false);
  const reopenPanel = useUiPanelStore((s) => s.reopenPanel);

  const visible = ITEMS.filter((item) => item.modes === 'all' || item.modes.includes(activeMode));

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 md:hidden ${open ? 'mobile-fab-open' : ''}`}
      aria-label="Tools menu"
    >
      <div className="relative h-14 w-14">
        {visible.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.panelId}
              type="button"
              onClick={() => {
                reopenPanel(item.panelId);
                setOpen(false);
              }}
              title={`Open ${item.label}`}
              aria-label={`Open ${item.label}`}
              aria-hidden={!open}
              tabIndex={open ? 0 : -1}
              className={`mobile-fab-item mobile-fab-item-${index} glass-strong flex h-11 w-11 items-center justify-center rounded-full`}
            >
              <Icon className="h-[18px] w-[18px]" style={{ color: item.accent }} aria-hidden />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Collapse tools menu' : 'Expand tools menu'}
          aria-expanded={open}
          className="mobile-fab-main glass-strong absolute bottom-0 right-0 flex h-14 w-14 items-center justify-center rounded-full bg-[#059669]/90"
        >
          <Plus className="h-6 w-6 text-white" aria-hidden />
        </button>
      </div>
    </div>
  );
}
