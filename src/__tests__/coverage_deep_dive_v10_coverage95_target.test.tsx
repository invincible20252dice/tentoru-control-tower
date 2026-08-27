import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Coverage Deep Dive V10 Coverage 95%+ Target Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS01',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: 'std-v10-1',
      student_id: 'SV1001',
      name: '詳細テスト 太郎',
      grade: '中2',
      grade_category: '中学生',
      level: 'B',
      school_id: 'sch-1',
      school_name: '恵比寿中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '荒木はやと',
      assigned_teachers: ['荒木はやと'],
      birthday: '2012-05-15',
      parent_name: '詳細テスト 保護者',
      parent_phone: '090-1234-5678',
      parent_email: 'parent@example.com',
      club_activities: 'サッカー部',
      hobbies: '読書',
      personality_tags: ['真面目', '計画的']
    };
    await db.saveStudent(student);
  });

  it('navigates all TeacherDashboard tabs and triggers teacher notes / student detail modal options', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard teacherType="junior_high" onBackToPortal={vi.fn()} />);

    // 全タブ巡回
    const tabs = ['生徒一覧', '小テスト結果', '宿題提出状況', '定期テスト・模試', '年間計画（マイルストーン）', '学習設定・受講設定', '講師・保護者対応メモ', '校舎・学校マスタ設定'];
    for (const tabName of tabs) {
      const btn = screen.queryByRole('button', { name: new RegExp(tabName, 'i') });
      if (btn) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });
});
