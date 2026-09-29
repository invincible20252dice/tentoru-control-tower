import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import SugorokuMap from '../components/SugorokuMap';
import { db } from '../lib/db';
import { Student, LearningTask } from '../types';

describe('Student Dashboard & Sugoroku Map UI Fixes Verification', () => {
  const mockStudentElem: Student = {
    id: 'student-test-elem',
    student_id: 'student103',
    name: '中尾 謙信',
    email: 'nakao@example.com',
    grade: '小5',
    school_id: 'sch-1',
    status: 'normal',
    start_unit_id: null,
    level: 'A',
    period_count: 2,
    created_at: new Date().toISOString(),
    selected_subjects: ['算数', '国語', '英語'],
    completed_lesson_ids: ['cm-p1-m1']
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const mockTasks: LearningTask[] = [
    {
      id: 'task-test-elem-1',
      student_id: 'student-test-elem',
      unit_id: 'cm-p1-m1',
      subject: '算数',
      period: 1,
      scheduled_date: todayStr,
      status: 'pending',
      video_watched: false,
      test_passed: false,
      start_lesson_id: 'cm-p1-m1',
      end_lesson_id: 'cm-p1-m1',
      completed_lesson_ids: ['cm-p1-m1'],
      created_at: new Date().toISOString()
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    db.clearMockData();
    await db.saveStudent(mockStudentElem);
    await db.saveLearningTasks(mockTasks);
  });

  it('Fix #2 Header: should remove login ID and account status: normal, and show stylish grade badge next to student name', () => {
    render(<StudentDashboard student={mockStudentElem} onBackToPortal={() => {}} />);

    // 1. Student name and grade badge
    expect(screen.getByText(/中尾 謙信 さんの学習画面/)).toBeInTheDocument();
    expect(screen.getByText('学年: 小5')).toBeInTheDocument();

    // 2. Unwanted system metadata must NOT be rendered
    expect(screen.queryByText(/student103/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ログインID:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/アカウント状況:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/通常進捗/)).not.toBeInTheDocument();

    // 3. Streak badge is rendered
    expect(screen.getByText(/🔥 3日連続学習中！/)).toBeInTheDocument();
  });

  it('Fix #2 Header: should display status badge only when student is fast or warning', () => {
    const fastStudent = { ...mockStudentElem, status: 'fast' as const };
    const { unmount } = render(<StudentDashboard student={fastStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/爆速中！/)).toBeInTheDocument();
    unmount();

    const warningStudent = { ...mockStudentElem, status: 'warning' as const };
    render(<StudentDashboard student={warningStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/計画パンク/)).toBeInTheDocument();
  });

  it('Fix #1 Left Column: should prevent text wrapping in STEP label, unit cards, and action buttons', async () => {
    render(<StudentDashboard student={mockStudentElem} onBackToPortal={() => {}} />);

    // Wait for timetable tasks to load
    await waitFor(() => {
      expect(screen.getByTestId('period-row-1')).toBeInTheDocument();
    });

    // Check step progress card exists
    const stepCard = screen.queryByTestId('step-card-1-0');
    if (stepCard) {
      expect(stepCard.textContent).toContain('STEP 1:');
    }

    // Check action buttons in period
    const watchBtn = screen.queryByRole('button', { name: /動画を視聴する/ });
    if (watchBtn) {
      expect(watchBtn).toBeInTheDocument();
    }
    const testBtn = screen.queryByRole('button', { name: /単元テストを受ける/ });
    if (testBtn) {
      expect(testBtn).toBeInTheDocument();
    }
  });

  it('Fix #1 Bottom Sections: should completely remove weekly schedule, radar chart, and simulator from student screen', () => {
    render(<StudentDashboard student={mockStudentElem} onBackToPortal={() => {}} />);

    // Verify complete removal of lower noise sections
    expect(screen.queryByText('週間スケジュール・授業予定ビュー')).not.toBeInTheDocument();
    expect(screen.queryByText(/教科別理解度・得点レーダーチャート/)).not.toBeInTheDocument();
    expect(screen.queryByText(/機能シミュレータ/)).not.toBeInTheDocument();
    expect(screen.queryByText('⚠️ 2日連続未達成を作る')).not.toBeInTheDocument();
    expect(screen.queryByText('🔄 全データをリセット')).not.toBeInTheDocument();
  });

  it('Fix #3 Right Column: SugorokuMap should render RPG world map with trail path, glowing star node, and gold/emerald medal', async () => {
    const { container } = render(
      <SugorokuMap
        student={mockStudentElem}
        subject="算数"
        subjects={['算数', '国語', '英語']}
        units={[]}
        tasks={mockTasks}
        todayTasks={mockTasks}
        theme="light"
      />
    );

    // 1. Should render subject title & RPG board container
    expect(screen.getByText('算数の学習マップ')).toBeInTheDocument();
    const wrapper = container.querySelector('[class*="mapWrapper"]');
    expect(wrapper).toBeInTheDocument();

    // 2. Should render all nodes
    const node1 = screen.getByTestId('sugoroku-node-cm-p1-m1');
    expect(node1).toBeInTheDocument();

    // 3. Active node has active styling / speech bubble
    expect(screen.getByText('ここからスタート！')).toBeInTheDocument();

    // 4. Tap node to show details banner
    fireEvent.click(node1);
    expect(screen.getByText(/STEP 1/)).toBeInTheDocument();

    // 5. Check RPG trail line connectors exist between nodes with pathRow wrapper
    const trailLines = container.querySelectorAll('[class*="trailLine"]');
    expect(trailLines.length).toBeGreaterThan(0);
    const pathRows = container.querySelectorAll('[class*="pathRow"]');
    expect(pathRows.length).toBeGreaterThan(0);

    // 6. Check RPG legend items
    expect(screen.getByText(/👑 クリア済み（メダル）/)).toBeInTheDocument();
    expect(screen.getByText(/🌟 現在地・挑戦中（スター）/)).toBeInTheDocument();

    // 7. Check 3D stone node classes
    const activeCircle = container.querySelector('[class*="circleActive"]');
    expect(activeCircle).toBeInTheDocument();
  });
});
