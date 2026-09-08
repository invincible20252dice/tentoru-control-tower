import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

let capturedFormatter: any = null;

vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    Tooltip: (props: any) => {
      capturedFormatter = props.formatter;
      return <div data-testid="mock-tooltip" />;
    }
  };
});

import { TestScoreRadarChart } from '../components/TestScoreRadarChart';

describe('TestScoreRadarChart Deep Coverage Suite', () => {
  it('covers TestScoreRadarChart tooltip formatter function', () => {
    const scores = [
      { subject: '数学', score: 85, fullMark: 100 },
      { subject: '英語', score: 90, fullMark: 100 }
    ];

    render(<TestScoreRadarChart data={scores} dataKeyName="得点" />);

    expect(capturedFormatter).toBeDefined();
    if (capturedFormatter) {
      const result = capturedFormatter(85);
      expect(result).toEqual(['85 点', '得点']);
    }
  });
});
