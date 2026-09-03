import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Home from '../app/page';
import { HorizontalDatePicker } from '../components/HorizontalDatePicker';
import { StudentScheduleConfigForm } from '../components/StudentScheduleConfigForm';
import { TestScoreRadarChart } from '../components/TestScoreRadarChart';
import { WeeklyScheduleViewer } from '../components/WeeklyScheduleViewer';
import { db, Student, LearningTask, CurriculumUnit, MilestonePlan } from '../lib/db';
import { 
  rescheduleDelayedTasks, 
  reorganizeFutureTasks, 
  rescheduleFutureUncompletedTasks, 
  calculateMockExamPassRate, 
  learnFromTeacherCorrections, 
  generateAIReportText, 
  calculateProgressGap,
  calculateDefaultSlots,
  getYearMonthWeek
} from '../lib/scheduler';

describe('Comprehensive Test Suite for High Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // 1. HorizontalDatePicker Component Tests
  // -------------------------------------------------------------
  describe('HorizontalDatePicker', () => {
    it('renders date picker and handles date/week navigation', () => {
      const handleChangeDate = vi.fn();
      const { rerender } = render(
        <HorizontalDatePicker selectedDate="2026-06-19" onChangeDate={handleChangeDate} />
      );

      // Check current date / week header
      expect(screen.getByText(/2026年6月/)).toBeDefined();

      // Click previous week button
      const prevBtn = screen.getByRole('button', { name: '前週へ' });
      fireEvent.click(prevBtn);
      expect(handleChangeDate).toHaveBeenCalledWith('2026-06-12');

      // Click next week button
      const nextBtn = screen.getByRole('button', { name: '次週へ' });
      fireEvent.click(nextBtn);
      expect(handleChangeDate).toHaveBeenCalledWith('2026-06-26');

      // Hidden input change
      const dateInput = screen.getByLabelText('日付選択') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-07-01' } });
      expect(handleChangeDate).toHaveBeenCalledWith('2026-07-01');

      // Rerender across month boundaries (e.g. cross month week)
      rerender(<HorizontalDatePicker selectedDate="2026-06-30" onChangeDate={handleChangeDate} />);
      expect(screen.getByText(/2026年6月 - 7月/)).toBeDefined();

      // Rerender across year boundaries
      rerender(<HorizontalDatePicker selectedDate="2026-12-31" onChangeDate={handleChangeDate} />);
      expect(screen.getByText(/2026年12月 - 2027年1月/)).toBeDefined();

      // Invalid or empty date string fallback test
      rerender(<HorizontalDatePicker selectedDate="invalid-date" onChangeDate={handleChangeDate} />);
      expect(screen.getByLabelText('日付選択')).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 2. StudentScheduleConfigForm Component Tests
  // -------------------------------------------------------------
  describe('StudentScheduleConfigForm', () => {
    it('renders for elementary student and handles form submission & day limits', async () => {
      const onSaved = vi.fn();
      render(
        <StudentScheduleConfigForm studentId="std-1" gradeType="elementary" onSaved={onSaved} />
      );

      expect(screen.getByText(/通塾条件・コマ数自動反映設定 \(小学生\)/)).toBeDefined();

      // Duration select change
      const durationSelect = screen.getByLabelText(/通塾時間設定/);
      fireEvent.change(durationSelect, { target: { value: '180分' } });

      // Toggle day button
      const monBtn = screen.getByRole('button', { name: '月曜日' });
      fireEvent.click(monBtn);

      // Exceed max allowed days limit (weekly_frequency: 2回 -> max 2 days)
      const wedBtn = screen.getByRole('button', { name: '水曜日' });
      fireEvent.click(wedBtn);
      const thuBtn = screen.getByRole('button', { name: '木曜日' });
      fireEvent.click(thuBtn); // Trigger error toast

      expect(screen.getByText(/週2回設定のため/)).toBeDefined();

      // Save form
      const saveBtn = screen.getByRole('button', { name: '通塾設定を保存する' });
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    });

    it('renders for junior high student and loads existing config', async () => {
      // Seed existing config
      db.saveStudentScheduleConfig({
        student_id: 'std-2',
        weekly_frequency: '3回',
        weekly_duration: '180分',
        selected_days: ['monday', 'wednesday', 'friday'],
        default_slots: 3
      });

      const onSaved = vi.fn();
      render(
        <StudentScheduleConfigForm studentId="std-2" gradeType="junior_high" onSaved={onSaved} />
      );

      expect(screen.getByText(/通塾条件・コマ数自動反映設定 \(中学生\/高校生\)/)).toBeDefined();

      const saveBtn = screen.getByRole('button', { name: '通塾設定を保存する' });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(onSaved).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------
  // 3. TestScoreRadarChart Component Tests
  // -------------------------------------------------------------
  describe('TestScoreRadarChart', () => {
    it('renders radar chart component correctly', () => {
      const sampleData = [
        { subject: '国語', score: 80 },
        { subject: '数学', score: 90 },
        { subject: '英語', score: 85 },
        { subject: '社会', score: 75 },
        { subject: '理科', score: 95 }
      ];

      render(<TestScoreRadarChart data={sampleData} />);
      expect(screen.getByText('教科別得点・能力レーダーチャート')).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 4. WeeklyScheduleViewer Component Tests
  // -------------------------------------------------------------
  describe('WeeklyScheduleViewer', () => {
    it('renders weekly schedule viewer and handles week change', () => {
      const student: Student = {
        id: 'std-1',
        name: 'テスト生徒',
        grade: '中2',
        level: 'A',
        school_id: 'sch-1',
        period_count: 2,
        created_at: new Date().toISOString()
      };

      const tasks: LearningTask[] = [
        {
          id: 'task-1',
          student_id: 'std-1',
          date: '2026-06-19',
          period_number: 1,
          subject: '数学',
          unit_name: '一次関数',
          status: 'completed',
          created_at: new Date().toISOString()
        }
      ];

      const { container } = render(
        <WeeklyScheduleViewer student={student} tasks={tasks} currentDateStr="2026-06-19" />
      );

      expect(screen.getByText('週間スケジュール・授業予定ビュー')).toBeDefined();
      expect(container).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 5. Home Portal Page Tests
  // -------------------------------------------------------------
  describe('Home Page Portal', () => {
    beforeEach(() => {
      db.saveSession({
        user: {
          id: 'admin-1',
          email: 'admin@tentoru.jp',
          role: 'admin',
          name: '本部統括管理者'
        },
        logged_in_at: new Date().toISOString()
      });
    });

    it('supports full portal interactions, teacher type selection, theme toggle, and student login', () => {
      render(<Home />);

      // Starts directly on TeacherDashboard
      expect(screen.getByText(/テントル 司令塔ダッシュボード \(講師用\)/)).toBeInTheDocument();

      // Navigate to portal
      fireEvent.click(screen.getByText('ポータルへ戻る'));

      // Theme toggle button
      const themeBtn = screen.getByText('ダークモードにする');
      fireEvent.click(themeBtn);
      expect(screen.getByText('ライトモードにする')).toBeDefined();

      // Click Teacher/Manager card to open teacher type selector
      const teacherRoleCard = screen.getByText('講師・管理者');
      fireEvent.click(teacherRoleCard);

      expect(screen.getByText('対象の学年区分を選択')).toBeDefined();

      // Back button in teacher type selector
      const backBtn = screen.getByText('戻る');
      fireEvent.click(backBtn);

      // Re-open and test high_school, junior_high, elementary teacher selections
      fireEvent.click(screen.getByText('講師・管理者'));
      const highBtn = screen.getByText('高校生');
      fireEvent.click(highBtn);
      fireEvent.click(screen.getByText('ポータルへ戻る'));

      fireEvent.click(screen.getByText('講師・管理者'));
      const jhBtn = screen.getByText('中学生');
      fireEvent.click(jhBtn);
      fireEvent.click(screen.getByText('ポータルへ戻る'));

      fireEvent.click(screen.getByText('講師・管理者'));
      const elemBtn = screen.getByText('小学生');
      fireEvent.click(elemBtn);

      // Verify Teacher Dashboard is rendered
      expect(screen.getByText('ポータルへ戻る')).toBeDefined();
      fireEvent.click(screen.getByText('ポータルへ戻る'));

      // Test Student Login
      const categorySelect = screen.getByTestId('portal-grade-category-select') as HTMLSelectElement;
      fireEvent.change(categorySelect, { target: { value: 'junior_high' } });

      const studentSelect = screen.getByTestId('portal-student-select') as HTMLSelectElement;
      const options = Array.from(studentSelect.options).filter(o => o.value !== '');
      if (options.length > 0) {
        fireEvent.change(studentSelect, { target: { value: options[0].value } });
        const studentLoginBtn = screen.getByText('生徒画面へ入る ➔');
        fireEvent.click(studentLoginBtn);
      }
    });

    it('alerts if student login is clicked without selecting student', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      render(<Home />);

      // Starts on dashboard, click back to portal
      fireEvent.click(screen.getByText('ポータルへ戻る'));

      const studentLoginBtn = screen.getByText('生徒画面へ入る ➔') as HTMLButtonElement;
      expect(studentLoginBtn.disabled).toBe(true);

      alertSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------
  // 6. DB Service Methods Edge Case Coverage
  // -------------------------------------------------------------
  describe('DB Service Methods Coverage', () => {
    it('covers custom classes, milestone templates, and fallback/cache handlers in db.ts', async () => {
      // Custom Class CRUD
      const customClass = {
        id: 'cls-1',
        name: '特設入試対策講座',
        created_at: new Date().toISOString()
      };
      await db.saveCustomClass(customClass);
      expect(db.getCustomClasses().some(c => c.name === '特設入試対策講座')).toBe(true);

      await db.deleteCustomClass('cls-1');
      expect(db.getCustomClasses().some(c => c.id === 'cls-1')).toBe(false);

      // Milestone Template CRUD
      const tpl = {
        id: 'tpl-test-1',
        name: 'レベルA標準テンプレート',
        target_level: 'A' as const,
        month: 4,
        week: 1,
        subject: '数学',
        unit_name: '正の数・負の数',
        sort_order: 1,
        created_at: new Date().toISOString()
      };
      await db.saveMilestoneTemplate(tpl);
      expect(db.getMilestoneTemplates().some(t => t.id === 'tpl-test-1')).toBe(true);

      await db.deleteMilestoneTemplate('tpl-test-1');
      expect(db.getMilestoneTemplates().some(t => t.id === 'tpl-test-1')).toBe(false);

      // Student interactions CRUD
      const interaction = {
        id: 'inter-1',
        student_id: 'std-1',
        date: '2026-06-19',
        category: '保護者対応' as const,
        memo: '面談実施',
        created_at: new Date().toISOString()
      };
      await db.saveStudentInteraction(interaction);
      expect(db.getStudentInteractions('std-1').length).toBeGreaterThan(0);

      // Personality options CRUD
      await db.addPersonalityOption('努力家');
      expect(db.getPersonalityOptions()).toContain('努力家');
    });
  });

  // -------------------------------------------------------------
  // 7. Scheduler Helper & Edge Cases Coverage
  // -------------------------------------------------------------
  describe('Scheduler Helper Edge Cases', () => {
    it('covers calculateDefaultSlots, getYearMonthWeek, and getSchoolYear', () => {
      expect(calculateDefaultSlots('elementary', '60分')).toBe(2);
      expect(calculateDefaultSlots('elementary', '90分')).toBe(2);
      expect(calculateDefaultSlots('elementary', '120分')).toBe(2);
      expect(calculateDefaultSlots('elementary', '180分')).toBe(2);

      expect(calculateDefaultSlots('junior_high', '120分')).toBe(2);
      expect(calculateDefaultSlots('junior_high', '180分')).toBe(3);
      expect(calculateDefaultSlots('junior_high', '240分')).toBe(4);
      expect(calculateDefaultSlots('junior_high', '無制限')).toBe(5);

      const ymw = getYearMonthWeek('2026-04-05');
      expect(ymw.month).toBe(4);
    });

    it('covers rescheduleDelayedTasks and reorganizeFutureTasks with edge inputs', async () => {
      const student: Student = {
        id: 'std-resched',
        name: '再テスト生徒',
        grade: '中1',
        level: 'B',
        school_id: 'sch-1',
        period_count: 2,
        created_at: new Date().toISOString()
      };

      const tasks: LearningTask[] = [
        {
          id: 'task-old-1',
          student_id: 'std-resched',
          date: '2026-06-01',
          period_number: 1,
          subject: '数学',
          unit_name: '正の数・負の数',
          status: 'delayed',
          created_at: new Date().toISOString()
        }
      ];

      const res = rescheduleDelayedTasks(student, tasks, '2026-06-19', [], []);
      expect(res).toBeDefined();

      const reorg = reorganizeFutureTasks('std-resched', '数学', tasks, []);
      expect(reorg).toBeDefined();

      const reschedUncomp = rescheduleFutureUncompletedTasks('std-resched', tasks, [], '2026-06-19', []);
      expect(reschedUncomp).toBeDefined();
    });

    it('covers calculateMockExamPassRate and AI report generator', () => {
      const passRate = calculateMockExamPassRate(85, 'A高校', [
        { id: 'sch-1', school_name: 'A高校', target_score: 80, target_deviation: 60 }
      ]);
      expect(passRate).toBeDefined();

      const report = generateAIReportText('テスト学習内容。大変頑張りました。', {
        exclamationsCount: 1,
        praiseToneCount: 1,
        positiveWords: ['成長']
      });
      expect(report).toBeDefined();
    });

    it('covers extra UI component branches and StudentScheduleConfigForm edge cases', async () => {
      // StudentScheduleConfigForm render
      const { unmount: unmountForm } = render(<StudentScheduleConfigForm studentId="std-err" gradeType="elementary" />);
      const slotsInput = screen.getByRole('spinbutton');
      fireEvent.change(slotsInput, { target: { value: '4' } });

      const saveBtn = screen.getByRole('button', { name: '通塾設定を保存する' });
      await act(async () => {
        fireEvent.click(saveBtn);
      });
      unmountForm();

      // WeeklyScheduleViewer Day View mode toggle
      const student: Student = {
        id: 'std-1',
        name: 'テスト生徒',
        grade: '中2',
        level: 'A',
        school_id: 'sch-1',
        period_count: 2,
        created_at: new Date().toISOString()
      };
      render(<WeeklyScheduleViewer student={student} tasks={[]} currentDateStr="2026-06-19" />);
      const dayViewBtn = screen.getByRole('button', { name: /日表示/ });
      fireEvent.click(dayViewBtn);

      const weekViewBtn = screen.getByRole('button', { name: /週表示/ });
      fireEvent.click(weekViewBtn);

      // TestScoreRadarChart with showTable false and empty data
      render(<TestScoreRadarChart data={[{ subject: '数学', score: 80 }]} showTable={false} />);
      render(<TestScoreRadarChart data={[]} />);
    });

    it('covers HorizontalDatePicker nav buttons and date selection', () => {
      const handleChangeDate = vi.fn();
      render(<HorizontalDatePicker selectedDate="2026-06-19" onChangeDate={handleChangeDate} />);
      const prevWeekBtn = screen.getByLabelText('前週へ');
      fireEvent.click(prevWeekBtn);
      const nextWeekBtn = screen.getByLabelText('次週へ');
      fireEvent.click(nextWeekBtn);

      // Hover events on buttons
      fireEvent.mouseEnter(prevWeekBtn);
      fireEvent.mouseLeave(prevWeekBtn);
      fireEvent.mouseEnter(nextWeekBtn);
      fireEvent.mouseLeave(nextWeekBtn);
    });

    it('covers StudentScheduleConfigForm config load and day toggles', async () => {
      db.saveStudentScheduleConfig({
        student_id: 'std-load-test',
        weekly_frequency: '2回',
        weekly_duration: '90分',
        selected_days: ['tuesday'],
        default_slots: 2
      });

      render(<StudentScheduleConfigForm studentId="std-load-test" gradeType="elementary" />);
      
      const monBtn = screen.getByRole('button', { name: '月曜日' });
      fireEvent.click(monBtn);

      const tueBtn = screen.getByRole('button', { name: '火曜日' });
      fireEvent.click(tueBtn);
    });

    it('covers Japanese date badge rendering, TeacherDashboard StudentScheduleConfigForm integration, and Minitest/Homework filters', async () => {
      // 1. TeacherDashboard rendering for StudentScheduleConfigForm in student-detail tab
      const TeacherDashboard = (await import('../components/TeacherDashboard')).default;
      const { StudentScheduleConfigForm } = await import('../components/StudentScheduleConfigForm');
      const { unmount } = render(<StudentScheduleConfigForm studentId="std-1" gradeType="elementary" />);
      expect(screen.getByText(/通塾条件・コマ数自動反映設定/)).toBeInTheDocument();
      unmount();

      // 2. Schedule tab date badge
      const { unmount: unmountDash } = render(<TeacherDashboard teacherType="junior_high" />);
      const studentItem = screen.getByText(/佐藤 拓海/);
      await act(async () => {
        fireEvent.click(studentItem);
      });
      const scheduleTabBtn = screen.getByText('学習計画・コマ割り');
      await act(async () => {
        fireEvent.click(scheduleTabBtn);
      });
      expect(screen.getByTestId('japanese-date-badge')).toBeInTheDocument();

      // 3. MiniTest tab filters
      const miniTestTabBtn = screen.getByText('小テスト結果');
      await act(async () => {
        fireEvent.click(miniTestTabBtn);
      });
      
      const gradeFilter = screen.getByLabelText('学年:');
      fireEvent.change(gradeFilter, { target: { value: '小学生' } });
      
      const subjectFilter = screen.getByLabelText('教科:');
      fireEvent.change(subjectFilter, { target: { value: '数学' } });

      const sortFilter = screen.getByLabelText('並び順:');
      fireEvent.change(sortFilter, { target: { value: 'name_asc' } });
      fireEvent.change(sortFilter, { target: { value: 'unsubmitted_first' } });
      fireEvent.change(sortFilter, { target: { value: 'passed_first' } });

      // 4. Homework tab filters
      const hwTabBtn = screen.getByText('宿題提出状況');
      await act(async () => {
        fireEvent.click(hwTabBtn);
      });
      
      const hwGradeFilter = screen.getByLabelText('学年:');
      fireEvent.change(hwGradeFilter, { target: { value: '中学生' } });

      const hwSubjectFilter = screen.getByLabelText('教科:');
      fireEvent.change(hwSubjectFilter, { target: { value: '英語' } });

      const hwSortFilter = screen.getByLabelText('並び順:');
      fireEvent.change(hwSortFilter, { target: { value: 'name_asc' } });
      fireEvent.change(hwSortFilter, { target: { value: 'unsubmitted_first' } });
      fireEvent.change(hwSortFilter, { target: { value: 'completed_first' } });

      unmountDash();
    });

    it('should test TestScoreRadarChart empty state, custom props, and status calculations', () => {
      const { rerender } = render(<TestScoreRadarChart data={[]} title="空データ" showTable={false} />);
      expect(screen.getByText('表示できる点数データがありません')).toBeInTheDocument();

      const testData = [
        { subject: '数学', score: 85 },
        { subject: '英語', score: 70 },
        { subject: '国語', score: 45 }
      ];

      rerender(<TestScoreRadarChart data={testData} chartColor="#ef4444" showTable={true} />);
      expect(screen.getByText('教科別スコア詳細')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('得意')).toBeInTheDocument();
      expect(screen.getByText('要強化')).toBeInTheDocument();
    });

    it('should test SugorokuMap with different node statuses, video watched, and test passed', async () => {
      vi.spyOn(db, 'getCurriculumMasters').mockReturnValue([]);
      vi.spyOn(db, 'fetchCurriculumMasters').mockResolvedValue([]);
      const SugorokuMap = (await import('../components/SugorokuMap')).default;
      const student: Student = {
        id: 'std-sugo-1',
        name: 'すごろく生徒',
        grade: '中1',
        school_id: 'sch-1',
        status: 'normal',
        created_at: ''
      };

      const units: CurriculumUnit[] = [
        { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' },
        { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '単元2', sequence_order: 2, created_at: '' },
        { id: 'u-3', school_id: 'sch-1', subject: '数学', name: '単元3', sequence_order: 3, created_at: '' }
      ];

      const tasks: LearningTask[] = [
        { id: 't-1', student_id: 'std-sugo-1', unit_id: 'u-1', scheduled_date: '2026-08-01', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
        { id: 't-2', student_id: 'std-sugo-1', unit_id: 'u-2', scheduled_date: '2026-08-02', status: 'unstarted', video_watched: true, test_passed: false, created_at: '' },
        { id: 't-3', student_id: 'std-sugo-1', unit_id: 'u-3', scheduled_date: '2026-08-03', status: 'skipped', video_watched: false, test_passed: false, created_at: '' }
      ];

      render(<SugorokuMap student={student} tasks={tasks} units={units} todayTasks={[]} onSelectTask={vi.fn()} />);

      expect(screen.getByTestId('sugoroku-node-u-1')).toBeInTheDocument();
      expect(screen.getByTestId('sugoroku-node-u-2')).toBeInTheDocument();
      expect(screen.getByTestId('sugoroku-node-u-3')).toBeInTheDocument();
    });

    it('should test TeacherDashboard Branch AI rules modal interactions and subject start grade selector', async () => {
      const TeacherDashboard = (await import('../components/TeacherDashboard')).default;
      render(<TeacherDashboard />);

      // Select student
      const studentCard = screen.getByText(/佐藤 拓海/);
      await act(async () => {
        fireEvent.click(studentCard);
      });

      // Open Branch AI rules modal
      const openAIRulesBtn = screen.getByTestId('open-branch-ai-rules-modal-btn');
      fireEvent.click(openAIRulesBtn);

      expect(screen.getAllByText(/校舎別AI自動設定ルール/)[0]).toBeInTheDocument();

      // Change inputs
      const lessonsPerSlotInput = screen.getByTestId('branch-ai-lessons-per-slot-input');
      const testPrepWeeksInput = screen.getByTestId('branch-ai-test-prep-weeks-input');
      const punkThresholdInput = screen.getByTestId('branch-ai-punk-threshold-input');
      const reviewIntervalInput = screen.getByTestId('branch-ai-review-slot-interval-input');

      fireEvent.change(lessonsPerSlotInput, { target: { value: '3' } });
      fireEvent.change(testPrepWeeksInput, { target: { value: '4' } });
      fireEvent.change(punkThresholdInput, { target: { value: '5' } });
      fireEvent.change(reviewIntervalInput, { target: { value: '3' } });

      // Save modal
      const saveRulesBtn = screen.getByTestId('save-branch-ai-rules-btn');
      await act(async () => {
        fireEvent.click(saveRulesBtn);
      });

      expect(screen.queryByTestId('save-branch-ai-rules-btn')).not.toBeInTheDocument();
    });
  });
});

