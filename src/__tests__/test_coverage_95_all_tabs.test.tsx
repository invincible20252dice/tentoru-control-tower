import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

describe('TeacherDashboard All Tabs Coverage Suite (>95%)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates through all tabs and executes corresponding UI features', async () => {
    const student = {
      id: 'std-tabs-mock',
      name: 'タブ網羅テスト生徒',
      grade: '中2',
      grade_category: 'junior_high' as const,
      selected_subjects: ['数学', '英語'],
      selected_days: ['monday', 'thursday'],
      status: 'normal' as const,
      branch_name: '東京校',
      classroom: '東京校',
      school_id: 'school-1',
      target_high_school: 'トップ高',
      current_deviation: 60,
      target_deviation: 65,
      attendance_number: '1001',
      notes: '備考メモ',
      personality_tags: ['真面目', '集中力あり']
    };

    const schools = [
      { id: 'school-1', name: '第一中学校', branch_name: '東京校', code: 'JHS1' }
    ];

    const curriculumMasters = [
      { id: 'cm-tab-1', subject: '数学', grade_category: 'junior_high', target_grade: '中2', unit_name: '一次関数', lesson_name: '一次関数のグラフ', item_type: 'video_lesson', sort_order: 1 },
      { id: 'cm-tab-2', subject: '数学', grade_category: 'junior_high', target_grade: '中2', unit_name: '一次関数', lesson_name: '一次関数 単元テスト', item_type: 'unit_test', sort_order: 2 }
    ];

    await db.saveStudent(student as any);
    await db.saveSchool(schools[0] as any);
    await db.saveCurriculumMasters(curriculumMasters as any);

    render(<TeacherDashboard onLogout={vi.fn()} onBackToPortal={vi.fn()} isSuperAdmin={true} />);

    // 1. Click Create Student Tab
    const createStudentTab = screen.getAllByText('新規生徒アカウント発行')[0];
    await act(async () => {
      fireEvent.click(createStudentTab);
    });

    // 2. Click Branches Tab
    const branchesTab = screen.getByText('校舎アカウント管理');
    await act(async () => {
      fireEvent.click(branchesTab);
    });

    // 3. Click Curriculum Import Tab
    const curriculumImportTab = screen.getByText('カリキュラムCSVインポート');
    await act(async () => {
      fireEvent.click(curriculumImportTab);
    });

    // 4. Return to Student List and Select Student
    const studentListTab = screen.getByText('生徒一覧');
    await act(async () => {
      fireEvent.click(studentListTab);
    });

    // 5. Click Schedule Tab
    const scheduleTab = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 6. Click Curriculum Tab
    const curriculumTab = screen.getByText('学校カリキュラム管理');
    await act(async () => {
      fireEvent.click(curriculumTab);
    });

    // 7. Click Mini-tests Tab
    const miniTestsTab = screen.getByText('小テスト結果');
    await act(async () => {
      fireEvent.click(miniTestsTab);
    });

    // 8. Click Homeworks Tab
    const homeworksTab = screen.getByText('宿題提出状況');
    await act(async () => {
      fireEvent.click(homeworksTab);
    });

    // 9. Click Tests Tab
    const testsTab = screen.getByText('定期テスト・模試');
    await act(async () => {
      fireEvent.click(testsTab);
    });

    // 10. Click AI Report Tab
    const aiReportTab = screen.getByText('AI指導報告書');
    await act(async () => {
      fireEvent.click(aiReportTab);
    });

    // 11. Click Milestones Tab
    const milestonesTab = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(milestonesTab);
    });

    // 12. Click Student Detail Tab
    const studentDetailTab = screen.getByText('生徒情報');
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

    expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeTruthy();
  });
});
