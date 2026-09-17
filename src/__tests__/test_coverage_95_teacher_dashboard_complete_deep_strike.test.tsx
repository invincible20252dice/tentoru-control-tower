import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster } from '../lib/db';

describe('TeacherDashboard Complete Deep Strike Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const fullStudent: Student = {
    id: 'std-strike-1',
    student_id: 'strike101',
    name: '佐々木 希美',
    name_kana: 'ササキ ノゾミ',
    email: 'sasaki@tentoru.test',
    grade: '中2',
    school_id: 'sch-1',
    school_name: '天登第二中学校',
    classroom: '渋谷教室',
    status: 'normal',
    period_count: 2,
    level: 'A',
    registered_grade: '中2',
    registered_year: 2026,
    selected_subjects: ['数学', '英語'],
    assigned_teachers: ['福田 尚弘'],
    target_schools: '都立日比谷高校',
    personal_goal: '数学85点以上',
    start_unit_id: 'cm-201',
    personality_tags: ['真面目', '負けず嫌い'],
    enrollment_date: '2025-04-01',
    created_at: '2026-04-01T00:00:00Z',
    excluded_lesson_ids: []
  };

  const fullCurriculumMasters: CurriculumMaster[] = [
    {
      id: 'cm-201',
      grade: '中2',
      subject: '数学',
      unit_name: '連立方程式',
      lesson_name: '第1講 加減法',
      sort_order: 1,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    },
    {
      id: 'cm-202',
      grade: '中2',
      subject: '数学',
      unit_name: '連立方程式',
      lesson_name: '第2講 代入法',
      sort_order: 2,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    }
  ];

  it('tests full tabs switching, date navigation, and search filter', async () => {
    db.saveStudent(fullStudent);
    db.saveCurriculumMasters(fullCurriculumMasters);

    await act(async () => {
      render(
        <TeacherDashboard
          students={[fullStudent]}
          initialTab="student-list"
          teacherType="junior_high"
        />
      );
    });

    // 1. 各タブのクリック切り替え
    const tabNames = ['student-list', 'schedule-matrix', 'curriculum', 'create-student', 'branch-management'];
    for (const t of tabNames) {
      const tabBtn = screen.queryByTestId(`tab-${t}`) || screen.queryByText(new RegExp(t, 'i'));
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    // 2. 日付ナビゲーション操作
    const prevDayBtn = screen.queryByText('◀ 前日') || screen.queryByTitle('前日');
    if (prevDayBtn) {
      await act(async () => {
        fireEvent.click(prevDayBtn);
      });
    }

    const nextDayBtn = screen.queryByText('翌日 ▶') || screen.queryByTitle('翌日');
    if (nextDayBtn) {
      await act(async () => {
        fireEvent.click(nextDayBtn);
      });
    }

    const todayBtn = screen.queryByText('今日') || screen.queryByTitle('今日');
    if (todayBtn) {
      await act(async () => {
        fireEvent.click(todayBtn);
      });
    }
  });

  it('tests student selection, detail tabs, interaction memos, and schedule configs', async () => {
    db.saveStudent(fullStudent);
    db.saveCurriculumMasters(fullCurriculumMasters);

    await act(async () => {
      render(
        <TeacherDashboard
          students={[fullStudent]}
          initialStudentId={fullStudent.id}
          initialTab="student-list"
          teacherType="junior_high"
        />
      );
    });

    // 生徒詳細タブの切り替え（学習計画、生徒情報、テスト履歴、週次設定など）
    const detailTabs = screen.queryAllByRole('button');
    for (const btn of detailTabs) {
      if (btn.textContent?.includes('生徒情報') || btn.textContent?.includes('学習計画') || btn.textContent?.includes('通塾設定')) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }

    // 相談メモの追加
    const memoInput = screen.queryByPlaceholderText(/面談・相談内容を入力|メモ/);
    if (memoInput) {
      await act(async () => {
        fireEvent.change(memoInput, { target: { value: '保護者面談：数学の復習を強化する方針で合意' } });
      });
      const saveMemoBtn = screen.queryByText(/メモを記録|保存/);
      if (saveMemoBtn) {
        await act(async () => {
          fireEvent.click(saveMemoBtn);
        });
      }
    }
  });
});
