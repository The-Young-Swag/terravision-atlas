import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useBrightBasemap } from '../../../hooks/useBrightBasemap';
import { panelLabel, useUiPanelStore } from '../../../stores/uiPanelStore';

// Persistent restore entry point for toolbar-closed panels (Item 12).
// Renders only while at least one panel is closed; the primary button
// re-opens the last closed panel in place with its state intact, and the
// expander lists every other closed panel for direct restore.
export function PanelRestoreBar() {
  const closedPanels = useUiPanelStore((s) => s.closedPanels);
  const lastClosed = useUiPanelStore((s) => s.lastClosed);
  const reopenLastClosed = useUiPanelStore((s) => s.reopenLastClosed);
  const reopenPanel = useUiPanelStore((s) => s.reopenPanel);
  const isBrightBasemap = useBrightBasemap();
  const [expanded, setExpanded] = useState(false);

  const closedIds = Object.keys(closedPanels);
  if (closedIds.length === 0 || !lastClosed) return null;
  const others = closedIds.filter((id) => id !== lastClosed);

  return (
    <div
      className="glass-strong absolute right-4 top-20 z-40 flex flex-col gap-1 rounded-2xl p-1.5"
      role="region"
      aria-label="Restore closed panels"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={reopenLastClosed}
          title={`Restore ${panelLabel(lastClosed)} panel`}
          className="flex items-center gap-2 rounded-xl bg-[#5500a4] px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Restore {panelLabel(lastClosed)}
        </button>
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            title={`${others.length} more closed panel${others.length === 1 ? '' : 's'}`}
            className={`rounded-xl px-2.5 py-2 font-mono text-[11px] transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}
          >
            +{others.length}
          </button>
        )}
      </div>
      {expanded && others.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-white/10 pt-1.5">
          {others.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => reopenPanel(id)}
              title={`Restore ${panelLabel(id)} panel`}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] transition hover:bg-white/10 ${isBrightBasemap ? 'text-slate-700' : 'text-slate-300'}`}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              {panelLabel(id)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
