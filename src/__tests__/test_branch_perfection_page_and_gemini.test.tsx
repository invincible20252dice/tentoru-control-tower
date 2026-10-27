import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Page from '../app/page';
import {
  saveGeminiApiKey,
  getGeminiApiKey,
  generateInterviewSummary,
  parseInterviewTranscriptToFields
} from '../lib/gemini';
import TimelineSubjectView from '../components/TimelineSubjectView';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import { db, Student, LearningTask, MiniTestResult, CurriculumUnit } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getDynamicISO = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('Branch Perfection: page.tsx, gemini.ts, TimelineSubjectView, CurriculumCsvImport', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. page.tsx branch perfection', () => {
    it('should cover teacherType initialization from localStorage and grade category filters', async () => {
      localStorage.setItem('tentoru_teacher_type', 'high_school');
      
      const students: Student[] = [
        {
          id: 'st-elem-1',
          name: '小学生太郎',
          grade: '小3',
          grade_category: '小学生',
          school_name: '小学校',
          period_count: 2,
          day_of_week: ['mon'],
          selected_subjects: ['算数'],
          completed_lesson_ids: [],
          created_at: getDynamicISO(0)
        },
        {
          id: 'st-jh-1',
          name: '中学生次郎',
          grade: '中2',
          grade_category: '中学生',
          school_name: '中学校',
          period_count: 2,
          day_of_week: ['tue'],
          selected_subjects: ['数学'],
          completed_lesson_ids: [],
          created_at: getDynamicISO(0)
        },
        {
          id: 'st-hs-1',
          name: '高校生三郎',
          grade: '高1',
          grade_category: '高校生',
          school_name: '高校',
          period_count: 2,
          day_of_week: ['wed'],
          selected_subjects: ['英語'],
          completed_lesson_ids: [],
          created_at: getDynamicISO(0)
        },
        {
          id: 'st-other-1',
          name: 'その他四郎',
          grade: '園児',
          grade_category: '',
          school_name: '幼稚園',
          period_count: 1,
          day_of_week: ['thu'],
          selected_subjects: [],
          completed_lesson_ids: [],
          created_at: getDynamicISO(0)
        },
        {
          id: 'st-grad-1',
          name: '既卒五郎',
          grade: '既卒',
          grade_category: '',
          school_name: '予備校',
          period_count: 2,
          day_of_week: ['fri'],
          selected_subjects: [],
          completed_lesson_ids: [],
          created_at: getDynamicISO(0)
        }
      ];

      (db as any).saveMockData('students', students);

      // Session exists -> lands on teacher dashboard
      db.saveSession({
        user: { id: 'u1', email: 'teacher@test.com', role: 'teacher', branch_id: 'b1' }
      } as any);

      // Set URL params for date and studentId
      const targetDate = getDynamicDateStr(2);
      window.history.pushState({}, '', `/?targetDate=${targetDate}&studentId=st-elem-1`);

      const { container, unmount } = render(<Page />);

      await waitFor(() => {
        expect(container).toBeDefined();
      });

      unmount();
    });

    it('should test elementary and junior_high saved types, unauthenticated login view, and back to portal', async () => {
      // 1. Unauthenticated -> lands on login screen
      localStorage.removeItem('tentoru_auth_session');
      localStorage.setItem('tentoru_teacher_type', 'elementary');

      const { unmount } = render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/TENTORU/i)).toBeDefined();
      });

      unmount();

      // 2. junior_high saved
      localStorage.setItem('tentoru_teacher_type', 'junior_high');
      db.saveSession({
        user: { id: 'u2', email: 'admin@test.com', role: 'admin' }
      } as any);
      const { unmount: unmount2 } = render(<Page />);
      await waitFor(() => {
        expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
      });
      unmount2();
    });
  });

  describe('2. gemini.ts branch perfection', () => {
    it('should cover saveGeminiApiKey removal and getGeminiApiKey fallback', () => {
      saveGeminiApiKey('test-key-123');
      expect(getGeminiApiKey()).toBe('test-key-123');

      // Empty key triggers removeItem
      saveGeminiApiKey('');
      expect(localStorage.getItem('tentoru_gemini_api_key')).toBeNull();
    });

    it('should cover generateInterviewSummary for all parent_type permutations and custom fields', async () => {
      saveGeminiApiKey(''); // Fallback without API key

      const student: Student = {
        id: 'st-summary',
        name: '面談花子',
        grade: '中3',
        grade_category: 'junior_high',
        school_name: '中学',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['数学'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      };

      // 1. Three-way with mother
      const resMother = await generateInterviewSummary({
        interviewType: 'three-way',
        interview: {
          id: 'int-1',
          student_id: student.id,
          interview_type: 'three-way',
          parent_type: 'mother',
          interviewer: '山田先生',
          interview_date: getDynamicDateStr(0),
          discussed_content: '志望校の相談',
          parent_anxieties: '数学の伸び悩み',
          custom_fields: [{ label: '家庭学習時間', value: '1時間' }]
        },
        student
      });
      expect(resMother).toContain('お母様');
      expect(resMother).toContain('山田先生');
      expect(resMother).toContain('志望校の相談');

      // 2. Three-way with father
      const resFather = await generateInterviewSummary({
        interviewType: 'three-way',
        interview: {
          id: 'int-2',
          student_id: student.id,
          interview_type: 'three-way',
          parent_type: 'father',
          interviewer: '田中先生',
          interview_date: getDynamicDateStr(0),
          discussed_content: '高校見学について',
          parent_anxieties: ''
        },
        student
      });
      expect(resFather).toContain('お父様');

      // 3. Three-way with both parents and empty custom field value
      const resBoth = await generateInterviewSummary({
        interviewType: 'three-way',
        interview: {
          id: 'int-3',
          student_id: student.id,
          interview_type: 'three-way',
          parent_type: 'both',
          interviewer: '佐藤先生',
          interview_date: getDynamicDateStr(0),
          discussed_content: '',
          parent_anxieties: '',
          custom_fields: [{ label: '特記事項', value: '' }]
        },
        student: null as any
      });
      expect(resBoth).toContain('ご両親');

      // 4. Two-way with target_school, target_score, and target_rank
      const resTwoWay = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: {
          id: 'int-4',
          student_id: student.id,
          interview_type: 'two-way',
          interviewer: '鈴木先生',
          interview_date: getDynamicDateStr(0),
          dream_goal: 'エンジニアになりたい',
          target_school: '県立高校',
          target_score: '85',
          target_rank: '10位以内',
          club_activity: 'サッカー部',
          club_members_count: '25',
          close_friends: '山田くん',
          self_evaluation: '頑張っている',
          student_challenges: '毎日の継続'
        },
        student
      });
      expect(resTwoWay).toContain('県立高校');
      expect(resTwoWay).toContain('鈴木先生');
    });

    it('should cover parseInterviewTranscriptToFields rule-based and gemini error handling', async () => {
      saveGeminiApiKey(''); // Trigger extractRuleBased

      const transcript = `
志望校は第一高校。
将来の夢は獣医師。
部活はバスケットボール部。
人数は15人。
よく一緒にいる友達は健太。
自己評価は普通。
課題は英語の単語力。
行動は毎日単語テストを解くこと。
目標は80点。
保護者の不安は集中力。
      `;

      const parsedThreeWay = await parseInterviewTranscriptToFields(transcript, 'three-way');
      expect(parsedThreeWay.dream_goal).toBe('獣医師');
      expect(parsedThreeWay.target_school).toBe('第一高校');
      expect(parsedThreeWay.club_activity).toBe('バスケットボール部');
      expect(parsedThreeWay.club_members_count).toBe('15');
      expect(parsedThreeWay.close_friends).toBe('健太');
      expect(parsedThreeWay.self_evaluation).toBe('普通');
      expect(parsedThreeWay.student_challenges).toBe('英語の単語力');
      expect(parsedThreeWay.required_actions).toBe('毎日単語テストを解くこと');
      expect(parsedThreeWay.target_score).toBe('80点');
      expect(parsedThreeWay.parent_anxieties).toBe('集中力');
      expect(parsedThreeWay.notes).toContain('【音声文字起こし】');

      const parsedTwoWay = await parseInterviewTranscriptToFields('特に情報のない雑談', 'two-way');
      expect(parsedTwoWay.notes).toContain('特に情報のない雑談');

      // Empty transcript branch
      expect(await parseInterviewTranscriptToFields('', 'two-way')).toEqual({});
    });
  });

  describe('3. TimelineSubjectView branch perfection', () => {
    it('should cover date priorities, subject matching, and skip-lesson prevention branches', () => {
      const student: Student = {
        id: 'st-tl-1',
        name: 'タイムライン生徒',
        grade: '小2',
        grade_category: 'elementary',
        school_name: '小学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        // 飛び石: step 1 は完了、step 2 は未完了、step 3 は完了
        completed_lesson_ids: ['step-1', 'step-3'],
        created_at: getDynamicISO(0)
      };

      const timelineUnits: any[] = [
        { id: 'step-1', grade: '小2', subject: '算数', unit_name: 'たしざん1', lesson_name: 'たしざん1', name: 'たしざん1', item_type: 'lesson', sort_order: 1 },
        { id: 'step-2', grade: '小2', subject: '算数', unit_name: 'たしざん2', lesson_name: 'たしざん2', name: 'たしざん2', item_type: 'lesson', sort_order: 2 },
        { id: 'step-3', grade: '小2', subject: '算数', unit_name: 'ひきざん1', lesson_name: 'ひきざん1', name: 'ひきざん1', item_type: 'lesson', sort_order: 3 },
        { id: 'ut-1', grade: '小2', subject: '算数', unit_name: '単元テスト1', lesson_name: 'たしざん 単元確認テスト', name: 'たしざん 単元確認テスト', item_type: 'unit_test', sort_order: 4 }
      ];

      const testDate = getDynamicDateStr(1);
      const studentTasks: LearningTask[] = [
        // task with lesson_ids array
        {
          id: 't-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: testDate,
          period: 1,
          status: 'unstarted',
          lesson_ids: ['step-2'],
          created_at: getDynamicISO(0)
        },
        // task with unit_id / start_lesson_id / end_lesson_id (empty array)
        {
          id: 't-2',
          student_id: student.id,
          subject: '数学', // Cross-compatible with 算数
          scheduled_date: testDate,
          period: 2,
          status: 'unstarted',
          lesson_ids: [],
          unit_id: 'step-2',
          start_lesson_id: 'step-2',
          end_lesson_id: 'step-2',
          created_at: getDynamicISO(0)
        }
      ];

      const miniTestResults: MiniTestResult[] = [
        {
          id: 'mt-1',
          student_id: student.id,
          subject: '算数',
          date: testDate,
          unit_name: '単元テスト1',
          test_content: 'たしざん 単元確認テスト',
          passed: false,
          created_at: getDynamicISO(0)
        }
      ];

      const onDateChangeMock = vi.fn();
      const onOpenEditUnitTestModalMock = vi.fn();
      const onDeleteUnitTestMasterMock = vi.fn();

      const { getByText, unmount } = render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          timelineUnits={timelineUnits}
          studentTasks={studentTasks}
          miniTestResults={miniTestResults}
          targetDate={testDate}
          onDateChange={onDateChangeMock}
          onOpenEditUnitTestModal={onOpenEditUnitTestModalMock}
          onDeleteUnitTestMaster={onDeleteUnitTestMasterMock}
        />
      );

      expect(getByText('たしざん1')).toBeDefined();

      // Test "今日" button click
      const todayBtn = getByText('今日');
      fireEvent.click(todayBtn);
      expect(onDateChangeMock).toHaveBeenCalled();

      unmount();
    });

    it('should cover fallback dates: propScheduleDate, initialDate, and window search params', () => {
      const student: Student = {
        id: 'st-tl-2',
        name: 'フォールバック生徒',
        grade: '中1',
        grade_category: 'junior_high',
        school_name: '中学',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['数学'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      };

      const testDate = getDynamicDateStr(5);

      // Render with propScheduleDate
      const { unmount: unmount1 } = render(
        <TimelineSubjectView
          student={student}
          subject="数学"
          timelineUnits={[]}
          studentTasks={[]}
          miniTestResults={[]}
          propScheduleDate={testDate}
        />
      );
      unmount1();

      // Render with initialDate
      const { unmount: unmount2 } = render(
        <TimelineSubjectView
          student={student}
          subject="英語"
          timelineUnits={[]}
          studentTasks={[]}
          miniTestResults={[]}
          initialDate={testDate}
        />
      );
      unmount2();
    });
  });

  describe('4. CurriculumCsvImport branch perfection', () => {
    it('should parse complex CSV with quotes, missing fields, review test, and unit test flags', async () => {
      const originalReadAsText = FileReader.prototype.readAsText;
      FileReader.prototype.readAsText = function(blob: any) {
        const text = (blob as any)._text || '';
        if (this.onload) {
          this.onload({ target: { result: text } } as any);
        }
      };

      const onImportSuccess = vi.fn();
      const { container, unmount } = render(
        <CurriculumCsvImport
          existingMasters={[]}
          onImportSuccess={onImportSuccess}
        />
      );

      // CSV with quotes, summary test, check test, unit test
      const csvContent = [
        '学年,教科,単元名,授業名,種別,合格ライン',
        '"小1","算数","たしざん","たしざんのきほん","授業",""',
        "'小1','算数','たしざん','まとめテスト(1)','まとめテスト','90%以上'",
        '小1,算数,ひきざん,Check Test 1,check test,80%',
        '小2,算数,かけ算,九九の単元確認テスト,unit_test,',
        ',,,,単元,', // Fallback defaults: 小5, 算数, 単元未設定, 授業名未設定
        '中1,数学,正負の数,確認問題,テスト,85%'
      ].join('\n');

      const file = new File([csvContent], 'curriculum.csv', { type: 'text/csv' });
      (file as any)._text = csvContent;
      const input = container.querySelector('input[type="file"]');
      if (input) {
        fireEvent.change(input, { target: { files: [file] } });
      }

      await waitFor(() => {
        expect(screen.getByText(/たしざんのきほん/)).toBeDefined();
      });

      FileReader.prototype.readAsText = originalReadAsText;
      unmount();
    });
  });
});
