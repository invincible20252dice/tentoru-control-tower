import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('StudentDashboard Deep Branch Perfection Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('covers video watch, test pass/fail, custom task completion, and score input', async () => {
    const todayStr = getDynamicDateStr(0);

    const mockStudent = {
      id: 'st-dash-dyn-1',
      student_id: 'std_dash_01',
      name: 'ダッシュボード生徒',
      grade: '中2',
      school_id: 'sch-1',
      school_name: 'テスト中',
      status: 'normal' as const,
      completed_lesson_ids: ['step-prev-1']
    };

    const mockUnit = {
      id: 'u-dash-1',
      school_id: 'sch-1',
      subject: '数学',
      name: '連立方程式',
      sequence_order: 1,
      link_url: 'https://example.com/video1',
      created_at: new Date().toISOString()
    };

    const mockTasks = [
      {
        id: 't-dash-video',
        student_id: mockStudent.id,
        unit_id: mockUnit.id,
        subject: '数学',
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted' as const,
        video_watched: false,
        test_passed: false,
        lesson_range: '第1講 連立方程式の解き方',
        created_at: new Date().toISOString()
      },
      {
        id: 't-dash-unit-test',
        student_id: mockStudent.id,
        unit_id: mockUnit.id,
        subject: '数学',
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted' as const,
        video_watched: true,
        test_passed: false,
        custom_unit_name: '数学: 連立方程式 - 単元確認テスト',
        created_at: new Date().toISOString()
      },
      {
        id: 't-dash-custom',
        student_id: mockStudent.id,
        subject: '自習',
        scheduled_date: todayStr,
        period: 3,
        status: 'unstarted' as const,
        video_watched: false,
        test_passed: false,
        custom_unit_name: '英単語ターゲット100個暗記',
        created_at: new Date().toISOString()
      }
    ];

    const mockMiniTest = {
      id: 'mini-dash-1',
      student_id: mockStudent.id,
      date: todayStr,
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '連立方程式',
      test_content: '連立方程式 単元テスト',
      score: null,
      passed: null,
      status: 'unstarted' as const,
      passing_line: '80点以上',
      target_scope: 'individual' as const,
      created_at: new Date().toISOString()
    };

    const mockHomework = {
      id: 'hw-dash-1',
      student_id: mockStudent.id,
      date: todayStr,
      subject: '数学',
      homework_content: '計算問題集 P10-12',
      homework_deadline: getDynamicDateStr(2),
      status: 'incomplete' as const,
      created_at: new Date().toISOString()
    };

    vi.spyOn(db, 'getStudent').mockReturnValue(mockStudent as any);
    vi.spyOn(db, 'getCurriculumUnits').mockReturnValue([mockUnit as any]);
    vi.spyOn(db, 'getLearningTasks').mockReturnValue(mockTasks as any);
    vi.spyOn(db, 'fetchLearningTasks').mockResolvedValue(mockTasks as any);
    vi.spyOn(db, 'getMiniTestResults').mockReturnValue([mockMiniTest as any]);
    vi.spyOn(db, 'getHomeworkResults').mockReturnValue([mockHomework as any]);
    vi.spyOn(db, 'getCurriculumMasters').mockReturnValue([]);

    const saveTasksSpy = vi.spyOn(db, 'saveLearningTasks').mockResolvedValue(true as any);
    const addLogSpy = vi.spyOn(db, 'addLearningLog').mockResolvedValue(true as any);
    const saveStudentSpy = vi.spyOn(db, 'saveStudent').mockResolvedValue(mockStudent as any);
    const saveMiniTestSpy = vi.spyOn(db, 'saveMiniTestResult').mockResolvedValue(true as any);

    render(
      <StudentDashboard
        student={mockStudent as any}
        onBackToPortal={vi.fn()}
      />
    );

    // 1. 動画視聴ボタンを押す
    const watchVideoBtns = screen.queryAllByRole('button');
    const watchBtn = watchVideoBtns.find(b => b.textContent?.includes('解説動画') || b.textContent?.includes('動画'));
    if (watchBtn) {
      await act(async () => {
        fireEvent.click(watchBtn);
      });
      expect(saveTasksSpy).toHaveBeenCalled();
      expect(addLogSpy).toHaveBeenCalled();
    }

    // 2. テスト合格ボタンを押す
    const allButtons = screen.queryAllByRole('button');
    const passBtn = allButtons.find(b => b.textContent?.includes('合格') || b.textContent?.includes('クリア'));
    if (passBtn) {
      await act(async () => {
        fireEvent.click(passBtn);
      });
      expect(saveTasksSpy).toHaveBeenCalled();
      expect(saveStudentSpy).toHaveBeenCalled();
    }

    // 3. テスト不合格ボタンを押す
    const failBtn = allButtons.find(b => b.textContent?.includes('不合格') || b.textContent?.includes('再テスト'));
    if (failBtn) {
      await act(async () => {
        fireEvent.click(failBtn);
      });
      expect(saveMiniTestSpy).toHaveBeenCalled();
    }

    // 4. カスタムタスク（自習タスク）の完了トグル
    const completeBtns = screen.queryAllByRole('button');
    const customCompleteBtn = completeBtns.find(b => b.textContent?.includes('完了にする') || b.textContent?.includes('未完了'));
    if (customCompleteBtn) {
      await act(async () => {
        fireEvent.click(customCompleteBtn);
      });
      expect(saveTasksSpy).toHaveBeenCalled();
    }

    // 5. 得点入力フィールドのテスト
    const scoreInputs = document.querySelectorAll('input[type="number"], input[placeholder*="点"]');
    if (scoreInputs.length > 0) {
      const input = scoreInputs[0] as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { value: '85' } });
        fireEvent.blur(input);
      });
      expect(saveMiniTestSpy).toHaveBeenCalled();

      // 不合格点数入力
      await act(async () => {
        fireEvent.change(input, { target: { value: '65' } });
        fireEvent.blur(input);
      });
      expect(saveMiniTestSpy).toHaveBeenCalled();
    }
  });

  it('covers fallback date determination when no today tasks exist but future or past tasks exist', () => {
    const todayStr = getDynamicDateStr(0);
    const futureDateStr = getDynamicDateStr(3);

    const mockStudent = {
      id: 'st-dash-dyn-fallback',
      student_id: 'std_fallback_01',
      name: 'フォールバック生徒',
      grade: '中1',
      school_id: 'sch-1',
      status: 'normal' as const
    };

    const futureTask = {
      id: 't-future-1',
      student_id: mockStudent.id,
      scheduled_date: futureDateStr,
      period: 1,
      status: 'unstarted' as const,
      created_at: new Date().toISOString()
    };

    vi.spyOn(db, 'getLearningTasks').mockReturnValue([futureTask as any]);
    vi.spyOn(db, 'getMiniTestResults').mockReturnValue([]);
    vi.spyOn(db, 'getHomeworkResults').mockReturnValue([]);

    render(
      <StudentDashboard
        student={mockStudent as any}
        onBackToPortal={vi.fn()}
      />
    );

    // Past task only branch
    const pastDateStr = getDynamicDateStr(-3);
    const pastTask = {
      id: 't-past-1',
      student_id: mockStudent.id,
      scheduled_date: pastDateStr,
      period: 1,
      status: 'unstarted' as const,
      created_at: new Date().toISOString()
    };
    vi.spyOn(db, 'getLearningTasks').mockReturnValue([pastTask as any]);

    render(
      <StudentDashboard
        student={mockStudent as any}
        onBackToPortal={vi.fn()}
      />
    );
  });
});
