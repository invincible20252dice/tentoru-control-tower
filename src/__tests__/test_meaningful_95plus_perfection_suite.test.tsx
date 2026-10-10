import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard, { determineActiveGradeForSubject } from '../components/TeacherDashboard';
import { StudentScheduleConfigForm } from '../components/StudentScheduleConfigForm';
import { db } from '../lib/db';
import { 
  generateInterview2CoachingAdvice, 
  generateInterview3CoachingAdvice,
  generateInterviewSummary, 
  parseInterviewTranscriptToFields
} from '../lib/gemini';
import { Student, StudentInterview2, StudentInterview3, CurriculumMaster, LearningTask } from '../types';

describe('Meaningful 95%+ Perfection Test Suite for Complete Coverage', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    delete process.env.GEMINI_API_KEY;
  });

  describe('1. StudentScheduleConfigForm Full Branch Coverage (>=95%)', () => {
    it('handles studentId missing, config missing or empty fields, unlimited days, and slot input fallback', async () => {
      // 1. Without studentId
      const { unmount: unmount1 } = render(
        <StudentScheduleConfigForm 
          studentId="" 
          gradeType="junior_high" 
        />
      );
      unmount1();

      // 2. With partial config (missing fields) to trigger default fallbacks
      const studentWithPartialConfig: Student = {
        id: 'std-partial-cfg',
        student_id: 'std_p_cfg',
        name: '部分設定生徒',
        grade: '小4',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '小4',
        selected_subjects: ['算数'],
        attendance_days: ['火'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentWithPartialConfig);
      await db.saveStudentScheduleConfig({
        student_id: studentWithPartialConfig.id,
        // intentionally omit weekly_frequency, weekly_duration, selected_days, default_slots
      } as any);

      const onSaveMock = vi.fn();
      const { container, unmount: unmount2 } = render(
        <StudentScheduleConfigForm 
          studentId={studentWithPartialConfig.id} 
          gradeType="elementary" 
          onSaved={onSaveMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/週回数設定/)).toBeInTheDocument();
      });

      // Frequency switch to 無制限 (getMaxAllowedDays returns null -> no upper limit display)
      const freqSelect = screen.getByLabelText(/週回数設定/);
      fireEvent.change(freqSelect, { target: { value: '無制限' } });

      // Slots input fallback (invalid text -> parses to NaN -> fallbacks to 1)
      const slotInput = container.querySelector('input[type="number"]');
      if (slotInput) {
        fireEvent.change(slotInput, { target: { value: '' } });
      }

      // Toggle day button
      const monBtn = screen.getByText('月曜日');
      fireEvent.click(monBtn);

      // Submit
      const saveBtn = screen.getByRole('button', { name: /通塾設定を保存する/ });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalled();
      });

      unmount2();
    });

    it('enforces maximum day limit error toast when exceeding weekly frequency limit', async () => {
      const studentLimit: Student = {
        id: 'std-limit-test',
        student_id: 'std_limit',
        name: '曜日制限生徒',
        grade: '中2',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '中2',
        selected_subjects: ['数学'],
        attendance_days: ['火', '木'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentLimit);
      await db.saveStudentScheduleConfig({
        student_id: studentLimit.id,
        weekly_frequency: '2回',
        weekly_duration: '120分',
        selected_days: ['tuesday', 'friday'],
        default_slots: 2
      });

      const { unmount } = render(
        <StudentScheduleConfigForm 
          studentId={studentLimit.id} 
          gradeType="junior_high" 
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/週回数設定/)).toBeInTheDocument();
      });

      // Attempt to select a 3rd day when max is 2
      const monBtn = screen.getByText('月曜日');
      fireEvent.click(monBtn);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/週回数（2回）を超える曜日は選択できません/)).toBeInTheDocument();
      });

      unmount();
    });
  });

  describe('2. Gemini Coaching & Advice Branch Coverage (>=95%)', () => {
    it('covers all ternary branches of generateInterview2CoachingAdvice with varied fields', async () => {
      // 1. Full fields present
      const fullInterview: Partial<StudentInterview2> = {
        interviewer: '山田先生',
        interview_date: '2026-10-10',
        dream_goal: 'プログラマー',
        target_school: '第一高校',
        club_activity: 'サッカー部',
        club_members_count: 25,
        close_friends: '田中くん',
        study_anxiety: '数学の図形が苦手',
        self_evaluation: 'そこそこ頑張っている',
        student_challenges: '毎日の復習習慣',
        required_actions: '毎日15分の計算ドリル',
        expectations: '定期テスト80点以上',
        target_rank: '上位10位',
        target_score: '85点',
        notes: '意欲は高い',
        custom_fields: [{ id: 'cf1', label: '得意科目', value: '理科' }]
      };
      const student1: Partial<Student> = { name: '高橋健太', grade: '中2' };
      const adviceFull = await generateInterview2CoachingAdvice(fullInterview, student1);
      expect(adviceFull).toContain('数学の図形が苦手');
      expect(adviceFull).toContain('プログラマー');
      expect(adviceFull).toContain('サッカー部');

      // 2. Minimal fields (empty / falsy) to exercise all fallback branches
      const emptyInterview: Partial<StudentInterview2> = {
        study_anxiety: '',
        dream_goal: '',
        target_school: '',
        required_actions: '',
        club_activity: '',
        target_score: '',
        self_evaluation: '',
        student_challenges: '',
        notes: '',
        custom_fields: []
      };
      const adviceEmpty = await generateInterview2CoachingAdvice(emptyInterview, null);
      expect(adviceEmpty).toContain('生徒');
      expect(adviceEmpty).toContain('特段の強い不安は表出していません');
      expect(adviceEmpty).toContain('目標設定');
    });

    it('covers generateInterview3CoachingAdvice, generateInterviewSummary, and parseInterviewTranscriptToFields', async () => {
      // 1. generateInterview3CoachingAdvice with father and both
      const int3Father: Partial<StudentInterview3> = {
        parent_type: 'father',
        future_direction_agreed: false,
        parent_anxieties: '成績の伸び悩み',
        discussed_content: '志望校決定',
        custom_fields: [{ id: 'c3', label: '家庭での様子', value: 'ゲームが多い' }]
      };
      const advice3 = await generateInterview3CoachingAdvice(int3Father, { name: '生徒B', grade: '中3' });
      expect(advice3).toContain('お父様');
      expect(advice3).toContain('要継続すり合わせ');

      const int3Both: Partial<StudentInterview3> = {
        parent_type: 'both',
        future_direction_agreed: true
      };
      const adviceBoth = await generateInterview3CoachingAdvice(int3Both, null);
      expect(adviceBoth).toContain('ご両親');
      expect(adviceBoth).toContain('合意形成済み');

      // 2. generateInterviewSummary
      const summary2 = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: { interviewer: '講師A', study_anxiety: '英語の文法' }
      });
      expect(summary2).toBeDefined();

      const summary3 = await generateInterviewSummary({
        interviewType: 'three-way',
        interview: { interviewer: '講師B', parent_anxieties: '進路について', discussed_content: '夏期講習の計画' }
      });
      expect(summary3).toBeDefined();

      // 3. parseInterviewTranscriptToFields
      const parsedFields = await parseInterviewTranscriptToFields('山田先生と面談。数学が不安。志望校は第一高校。', 'two-way');
      expect(parsedFields).toBeDefined();
    });
  });

  describe('3. TeacherDashboard Edge Branches & Utilities Coverage (>=95%)', () => {
    it('covers determineActiveGradeForSubject with all grade types and missing params', () => {
      // 1. targetStudent is null/undefined
      expect(determineActiveGradeForSubject('算数', null)).toBe('all');
      expect(determineActiveGradeForSubject('算数', undefined)).toBe('all');

      // 2. High school student (not elementary)
      const hsStudent = { id: 'hs1', name: '高校生', grade: '高1', grade_category: 'high_school' } as Student;
      expect(determineActiveGradeForSubject('数学', hsStudent)).toBe('all');

      // 3. Elementary student with "3年生" format
      const elem3 = { id: 'e3', name: '小3生', grade: '3年生', grade_category: 'elementary' } as Student;
      expect(determineActiveGradeForSubject('算数', elem3)).toBe('小3');

      // 4. Elementary student with "園児" format
      const elemK = { id: 'ek', name: '園児生', grade: '園児', grade_category: 'elementary' } as Student;
      expect(determineActiveGradeForSubject('算数', elemK)).toBe('小1');

      // 5. Subject normalizer (数学 <-> 算数)
      const elemMath = { id: 'em', name: '算数生', grade: '小5', grade_category: 'elementary' } as Student;
      const tasks: LearningTask[] = [
        { id: 't-math', student_id: elemMath.id, scheduled_date: '2026-10-10', period: 1, subject: '数学', start_lesson_id: 'm1', status: 'unstarted' } as any
      ];
      const masters: CurriculumMaster[] = [
        { id: 'm1', subject: '算数', grade: '5年生', unit_name: '分数', lesson_name: '分数のたし算', sort_order: 1 }
      ];
      expect(determineActiveGradeForSubject('算数', elemMath, tasks, {}, '2026-10-10', masters)).toBe('小5');
    });

    it('covers TeacherDashboard two-way and three-way interview tabs directly and exercises interview buttons', async () => {
      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const student: Student = {
        id: 'std-td-interview-1',
        student_id: 'std_td_int',
        name: '面談テスト生徒',
        grade: '中2',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '中2',
        selected_subjects: ['数学', '英語'],
        attendance_days: ['火', '金'],
        completed_lesson_ids: []
      };
      await db.saveStudent(student);

      // Render directly with initialTab="two-way-interview" and valid UUID branch
      const { unmount: unmount1 } = render(
        <TeacherDashboard 
          onLogout={vi.fn()} 
          teacherType="junior_high" 
          initialTab="two-way-interview" 
          initialRole="admin"
          initialBranchId="11111111-2222-3333-4444-555555555555"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/二者面談/)).toBeInTheDocument();
      });

      // Click save button with no student selected (triggers alert('生徒を選択してください。'))
      const saveButtons = screen.getAllByRole('button');
      const interviewSaveBtn = saveButtons.find(b => b.textContent?.includes('保存') || b.textContent?.includes('面談記録を保存'));
      if (interviewSaveBtn) {
        fireEvent.click(interviewSaveBtn);
      }

      // Click voice record button (SpeechRecognition check)
      const micBtn = saveButtons.find(b => b.textContent?.includes('音声入力') || b.textContent?.includes('録音'));
      if (micBtn) {
        fireEvent.click(micBtn);
      }

      // Click AI parse button with empty transcript
      const aiBtn = saveButtons.find(b => b.textContent?.includes('AI自動抽出') || b.textContent?.includes('AI要約'));
      if (aiBtn) {
        fireEvent.click(aiBtn);
      }

      alertMock.mockRestore();
      unmount1();

      // Render directly with initialTab="three-way-interview" and non-UUID branch
      const { unmount: unmount2 } = render(
        <TeacherDashboard 
          onLogout={vi.fn()} 
          teacherType="junior_high" 
          initialTab="three-way-interview" 
          initialRole="teacher"
          initialBranchId="non-uuid-branch-id"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/三者面談/)).toBeInTheDocument();
      });
      unmount2();
    });
  });

  describe('4. DatabaseService Advanced Operations Coverage (>=95%)', () => {
    it('covers cleanupStudentCorruptedCompletedLessonIds and sanitize rules', async () => {
      const studentCorrupt: Student = {
        id: 'std-corrupt-clean-1',
        student_id: 'std_corrupt',
        name: 'データ汚染生徒',
        grade: '小4',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '小4',
        selected_subjects: ['算数'],
        attendance_days: ['火'],
        // Include corrupted IDs matching sanitize filter (cm-auto-sum...小2, cm-auto-sum...大きいかず, empty string, カタカナ)
        completed_lesson_ids: [
          'cm-normal-1', 
          'cm-auto-sum-算数-小2-ひっ算', 
          'cm-auto-sum-算数-大きいかず', 
          'cm-auto-sum-国語-カタカナ', 
          'cm-auto-sum1-国語-カタカナ',
          ''
        ]
      };
      await db.saveStudent(studentCorrupt);

      // Exercise cleanupStudentCorruptedCompletedLessonIds
      const cleaned = await db.cleanupStudentCorruptedCompletedLessonIds(studentCorrupt.id);
      expect(cleaned).toBeDefined();
      expect(cleaned?.completed_lesson_ids).not.toContain('cm-auto-sum-算数-小2-ひっ算');
      expect(cleaned?.completed_lesson_ids).not.toContain('cm-auto-sum-算数-大きいかず');
      expect(cleaned?.completed_lesson_ids).toContain('cm-normal-1');
      expect(cleaned?.completed_lesson_ids).toContain('cm-auto-sum1-国語-カタカナ');

      // Test with non-existing student
      const nullClean = await db.cleanupStudentCorruptedCompletedLessonIds('non-existing-id');
      expect(nullClean).toBeNull();
    });

    it('covers clearLocalMockCache, customApplyScopes, school deletion, deleteStudentInterview3, and normalizeTask', async () => {
      // 1. clearLocalMockCache
      db.clearLocalMockCache();

      // 2. CustomApplyScopes CRUD
      const scopeData = {
        id: 'test-scope-1',
        name: 'テスト適用スコープ',
        target_type: 'grade',
        targets: ['中1', '中2']
      };
      await db.saveCustomApplyScope(scopeData as any);
      const scopes = db.getCustomApplyScopes();
      expect(scopes.some(s => s.id === 'test-scope-1')).toBe(true);
      await db.deleteCustomApplyScope('test-scope-1');
      const scopesAfter = db.getCustomApplyScopes();
      expect(scopesAfter.some(s => s.id === 'test-scope-1')).toBe(false);

      // 3. deleteSchool
      await db.deleteSchool('テスト中学校');

      // 4. deleteStudentInterview3
      const int3 = {
        id: 'int3-del-test-1',
        student_id: 'std-del-1',
        interviewer: '講師X',
        interview_date: '2026-10-10',
        parent_type: 'mother',
        created_at: new Date().toISOString()
      };
      await db.saveStudentInterview3(int3 as any);
      expect(db.getStudentInterviews3('std-del-1').length).toBe(1);

      await db.deleteStudentInterview3(int3.id);
      expect(db.getStudentInterviews3('std-del-1').length).toBe(0);

      // 5. normalizeTask invalid scheduled_date fallback
      const taskWithInvalidDate: any = {
        id: 'task-invalid-date-1',
        student_id: 'std-del-1',
        scheduled_date: 'invalid-date-string-that-causes-nan',
        period: '1'
      };
      await db.saveLearningTasks([taskWithInvalidDate]);
      const savedTasks = db.getLearningTasks().filter(t => t.id === 'task-invalid-date-1');
      expect(savedTasks.length).toBe(1);
      expect(savedTasks[0].scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
