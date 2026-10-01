import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import SugorokuMap from '../components/SugorokuMap';
import { db } from '../lib/db';
import { Student, LearningTask, MiniTestResult } from '../types';

describe('RPG Student Dashboard & Adventure Map UX Tests', () => {
  const todayStr = new Date().toISOString().split('T')[0];

  const mockStudent: Student = {
    id: 'student-rpg-1',
    student_id: 'student-rpg-1',
    name: '冒険者 生徒',
    email: 'adventurer@example.com',
    grade: '中1',
    school_id: 'sch-rpg',
    status: 'normal',
    start_unit_id: null,
    level: 'A',
    period_count: 2,
    created_at: new Date().toISOString(),
    selected_subjects: ['数学', '英語'],
    completed_lesson_ids: ['cm-m1-m1'],
  };

  const mockTasks: LearningTask[] = [
    {
      id: 'task-quest-1',
      student_id: 'student-rpg-1',
      subject: '数学',
      unit_id: 'cm-m1-m2',
      period: 1,
      start_lesson_id: 'cm-m1-m2',
      end_lesson_id: 'cm-m1-m2',
      start_lesson_name: '文字と式',
      end_lesson_name: '文字と式',
      custom_unit_name: '文字と式',
      scheduled_date: todayStr,
      status: 'pending',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'task-quest-2',
      student_id: 'student-rpg-1',
      subject: '英語',
      unit_id: 'cm-m1-e1',
      period: 2,
      start_lesson_id: 'cm-m1-e1',
      end_lesson_id: 'cm-m1-e1',
      start_lesson_name: 'be動詞の現在形',
      end_lesson_name: 'be動詞の現在形',
      custom_unit_name: 'be動詞の現在形',
      scheduled_date: todayStr,
      status: 'pending',
      video_watched: true,
      test_passed: false,
      created_at: new Date().toISOString(),
    },
  ];

  const mockMiniTest: MiniTestResult = {
    id: 'test-boss-1',
    student_id: 'student-rpg-1',
    date: todayStr,
    subject: '数学',
    score: null,
    status: 'pending',
    type: 'review',
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    db.clearMockData();
    await db.saveStudent(mockStudent);
    await db.saveLearningTasks(mockTasks);
    await db.saveMiniTestResult(mockMiniTest);
  });

  describe('SugorokuMap RPG World UX', () => {
    it('renders RPG adventure world map with pin avatar, speech bubble, and stone paths', () => {
      const { container } = render(
        <SugorokuMap
          student={mockStudent}
          activeSubject="数学"
          todayTasks={mockTasks}
          theme="light"
        />
      );

      // Map header
      expect(screen.getByText(/数学の学習マップ/)).toBeInTheDocument();
      expect(screen.getByText('冒険マップ')).toBeInTheDocument();

      // RPG map wrapper with gradient & border
      const mapWrapper = container.querySelector('[class*="mapWrapper"]');
      expect(mapWrapper).toBeInTheDocument();

      // "いまここ！" speech bubble & pin avatar
      expect(screen.getByText('いまここ！')).toBeInTheDocument();
      const pinAvatar = screen.getByText('📍');
      expect(pinAvatar).toBeInTheDocument();

      // Cobblestone trail lines
      const trailLines = container.querySelectorAll('[class*="trailLine"]');
      expect(trailLines.length).toBeGreaterThan(0);

      // Click node to open details popup
      const firstNode = screen.getByTestId('sugoroku-node-cm-jhs-1');
      fireEvent.click(firstNode);
      expect(screen.getByText(/STEP 1/)).toBeInTheDocument();
    });

    it('handles theme change and subject tabs selection', () => {
      const onSelectSubject = vi.fn();
      const { rerender } = render(
        <SugorokuMap
          student={mockStudent}
          activeSubject="数学"
          todayTasks={mockTasks}
          theme="dark"
          onSelectSubject={onSelectSubject}
        />
      );

      // Subject tab switch
      const engTab = screen.getByRole('button', { name: /英語/ });
      fireEvent.click(engTab);
      expect(onSelectSubject).toHaveBeenCalledWith('英語');

      // Re-render with selected subject
      rerender(
        <SugorokuMap
          student={mockStudent}
          activeSubject="英語"
          todayTasks={mockTasks}
          theme="dark"
        />
      );
      expect(screen.getByText(/英語の学習マップ/)).toBeInTheDocument();
    });
  });

  describe('StudentDashboard Boss Battle & Main Quest UX', () => {
    it('renders main quest highlight badge, 3D quest button, and boss battle test card', async () => {
      const onBack = vi.fn();

      const { container } = render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={onBack}
          theme="light"
          initialDate={todayStr}
        />
      );

      // Main quest badge & 3D button
      expect(screen.getByText('★ 今日のメインクエスト')).toBeInTheDocument();
      const questButton = screen.getByRole('button', { name: /学習をスタート！ ▶/ });
      expect(questButton).toBeInTheDocument();

      // Boss battle test card
      const bossBattleHeader = screen.getByText(/本日のテスト（ボス戦チャレンジ）/);
      expect(bossBattleHeader).toBeInTheDocument();

      // Score input & 撃破報告（保存） ⚔️ button
      const saveBtn = screen.getByRole('button', { name: /撃破報告（保存） ⚔️/ });
      expect(saveBtn).toBeInTheDocument();

      const scoreInput = screen.getByTestId(`test-score-input-${mockMiniTest.id}`);
      expect(scoreInput).toBeInTheDocument();

      // Enter score and submit
      fireEvent.change(scoreInput, { target: { value: '85' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const tests = db.getMiniTestResults();
        const updated = tests.find(t => t.id === mockMiniTest.id);
        expect(updated?.score).toBe(85);
      });
    });

    it('rejects invalid test scores in boss battle card', async () => {
      const onBack = vi.fn();

      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={onBack}
          theme="light"
          initialDate={todayStr}
        />
      );

      const saveBtn = screen.getByRole('button', { name: /撃破報告（保存） ⚔️/ });
      const scoreInput = screen.getByTestId(`test-score-input-${mockMiniTest.id}`);

      // Invalid score (> 100)
      fireEvent.change(scoreInput, { target: { value: '120' } });
      fireEvent.click(saveBtn);

      const tests = db.getMiniTestResults();
      const updated = tests.find(t => t.id === mockMiniTest.id);
      expect(updated?.score).toBeNull();
    });
  });
});
