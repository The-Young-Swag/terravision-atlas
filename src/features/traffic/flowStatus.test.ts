import { describe, expect, it } from 'vitest';
import { FLOW_BANDS, flowStatusColor, routeStatusSegments } from './flowStatus';
import type { FlowSample } from './flowEta';

function sample(pathIndex: number, currentSpeed: number): FlowSample {
  return { pathIndex, currentSpeed, freeFlowSpeed: 100 };
}

describe('flowStatusColor', () => {
  it('maps absolute speeds to the documented legend bands', () => {
    expect(flowStatusColor(0)).toBe(FLOW_BANDS[0].color);
    expect(flowStatusColor(0.9)).toBe(FLOW_BANDS[0].color);
    expect(flowStatusColor(30)).toBe(FLOW_BANDS[1].color);
    expect(flowStatusColor(90)).toBe(FLOW_BANDS[2].color);
    expect(flowStatusColor(130)).toBe(FLOW_BANDS[3].color);
  });

  it('treats band edges as the start of the faster band', () => {
    expect(flowStatusColor(1)).toBe(FLOW_BANDS[1].color);
    expect(flowStatusColor(60)).toBe(FLOW_BANDS[2].color);
    expect(flowStatusColor(120)).toBe(FLOW_BANDS[3].color);
  });
});

describe('routeStatusSegments', () => {
  it('returns no segments without samples', () => {
    expect(routeStatusSegments(10, [])).toEqual([]);
    expect(routeStatusSegments(1, [sample(0, 30)])).toEqual([]);
  });

  it('colors each inter-sample span by its leading sample', () => {
    const segments = routeStatusSegments(10, [sample(0, 130), sample(5, 30), sample(9, 0)]);
    expect(segments).toEqual([
      { fromIndex: 0, toIndex: 5, color: FLOW_BANDS[3].color },
      { fromIndex: 5, toIndex: 9, color: FLOW_BANDS[1].color },
      { fromIndex: 9, toIndex: 9, color: FLOW_BANDS[0].color },
    ]);
  });

  it('sorts out-of-order samples and drops out-of-range ones', () => {
    const segments = routeStatusSegments(6, [sample(4, 30), sample(99, 0), sample(0, 130)]);
    expect(segments).toEqual([
      { fromIndex: 0, toIndex: 4, color: FLOW_BANDS[3].color },
      { fromIndex: 4, toIndex: 5, color: FLOW_BANDS[1].color },
    ]);
  });
});
