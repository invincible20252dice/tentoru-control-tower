import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SugorokuMap from '../components/SugorokuMap';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type MiniTestResult } from '../lib/db';

describe('SugorokuMap Extreme Branch Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers SugorokuMap subject fallback, fallbackUnits, and node name fallbacks', () => {
    // 1. Fallback when curriculum_masters is empty and only units exist
    const fallbackUnits: CurriculumUnit[] = [
      {
        id: 'unit-fb-1',
        subject: '数学',
        name: '正負の数 基礎',
        sequence_order: 1
      },
      {
        id: 'unit-fb-2',
        subject: '数学',
        name: '文字と式 基礎',
        sequence_order: undefined // tests sequence_order || 0
      }
    ];

    const student: Student = {
      id: 'st-sugo-1',
      name: 'すごろく生徒1',
      grade: '中1',
      completed_lesson_ids: ['unit-fb-1']
    };

    (db as any).saveMockData('curriculum_masters', []);

    // Render with units only, subject undefined (falls back to availableSubjects[0] or 数学)
    const { unmount } = render(
      <SugorokuMap
        student={student}
        units={fallbackUnits}
        availableSubjects={['数学', '英語']}
      />
    );

    expect(screen.getByText(/正負の数 基礎/)).toBeDefined();
    unmount();
  });

  it('exhaustively covers SugorokuMap masters with missing lesson_name and failed test matching branches', async () => {
    const dynamicDate = getDynamicDate(0);
    const student: Student = {
      id: 'st-sugo-failed-test',
      name: 'すごろく不合格生徒',
      grade: '中2',
      completed_lesson_ids: ['cm-sg-1', 'cm-sg-2']
    };

    // Masters where lesson_name is empty (falls back to unit_name), and unit_test item_type
    const masters: CurriculumMaster[] = [
      {
        id: 'cm-sg-1',
        grade: '中2',
        subject: '数学',
        unit_name: '一次関数の応用',
        lesson_name: '', // triggers lesson_name || unit_name
        sort_order: 1,
        item_type: 'lesson'
      },
      {
        id: 'cm-sg-2',
        grade: '中2',
        subject: '数学',
        unit_name: '一次関数の応用',
        lesson_name: '一次関数 単元確認テスト',
        sort_order: 2,
        item_type: 'unit_test'
      }
    ];

    (db as any).saveMockData('curriculum_masters', masters);

    // Failed mini test result for the unit test node
    const miniResults: MiniTestResult[] = [
      {
        id: 'mini-failed-sugo',
        student_id: student.id,
        subject: '数学',
        test_type: 'unit_test',
        test_content: '一次関数 単元確認テスト',
        unit_name: '一次関数の応用',
        date: dynamicDate,
        score: 50,
        status: 'failed'
      }
    ];
    (db as any).saveMockData('mini_test_results', miniResults);

    render(
      <SugorokuMap
        student={student}
        subject="数学"
        miniTestResults={miniResults}
      />
    );

    // Verify node with unit_name as fallback title is rendered
    expect(screen.getByText(/一次関数の応用/)).toBeDefined();

    // Click node to test node details selection
    const nodeElem = screen.getByText(/一次関数の応用/);
    fireEvent.click(nodeElem);
  });

  it('covers SugorokuMap subject change prop update', () => {
    const student: Student = {
      id: 'st-sugo-prop-change',
      name: '教科切替生徒',
      grade: '中3'
    };

    const { rerender } = render(
      <SugorokuMap
        student={student}
        subject="数学"
        availableSubjects={['数学', '英語']}
      />
    );

    // Rerender with changed subject prop
    rerender(
      <SugorokuMap
        student={student}
        subject="英語"
        availableSubjects={['数学', '英語']}
      />
    );

    expect(screen.getAllByText(/英語/).length).toBeGreaterThan(0);
  });
});
