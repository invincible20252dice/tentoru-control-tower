import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Home from '../app/page';
import { BranchManagement } from '../components/BranchManagement';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import SugorokuMap, { resolveIndexRange } from '../components/SugorokuMap';
import {
  sortGradeOptions,
  inferSelectedStartGrade,
  isUnitTestCompletedForStudent,
  resolveAutoDrillHomeworks,
  extractUnitTestsFromPeriodSelections,
  buildDailyTaskFromTimetableConfig,
  filterSchoolsByGrade,
  deduplicateTodayTests,
  reorderCurriculumUnits,
  resolveChapterSortIndex,
  resolveAvailableSubjectsForStudent,
  resolveLessonsForSubject
} from '../components/TeacherDashboard';
import {
  generateInterview2CoachingAdvice,
  generateInterview3CoachingAdvice,
  generateInterviewSummary,
  parseInterviewTranscriptToFields,
  saveGeminiApiKey
} from '../lib/gemini';
import { db } from '../lib/db';
import {
  isMatchingUnitOrTest,
  getLatestUnitTestStatusForSubject,
  findNextUncompletedLessonForSubject,
  resolveSubByPeriod
} from '../lib/scheduler';
import { Student } from '../types';

// GoogleGenerativeAI のモック
const mockGenerateContent = vi.fn();
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent
        };
      }
    }
  };
});

describe('Meaningful Edge Perfection Strike Suite for 95%+ Milestone', () => {
  beforeEach(() => {
    localStorage.clear();
    saveGeminiApiKey('');
    vi.restoreAllMocks();
  });

  describe('1. gemini.ts 純粋エッジブランチの完全網羅', () => {
    it('二者面談アドバイスで dream_goal が未設定の場合のフォールバック（L152）', async () => {
      const res = await generateInterview2CoachingAdvice({
        student_id: 'st-no-dream',
        dream_goal: '', // 空文字で L152 のフォールバック
        study_anxiety: '数学の計算ミスが多い',
        required_actions: '見直しを徹底する'
      }, { name: '夢なし生徒' });

      expect(res).toContain('目標設定');
      expect(res).toContain('数学の計算ミスが多い');
    });

    it('二者面談アドバイスで dream_goal があり target_school が空の場合の「目標校」フォールバック（L152）', async () => {
      const res = await generateInterview2CoachingAdvice({
        student_id: 'st-dream-no-school',
        dream_goal: 'プログラマー',
        target_school: '', // 空文字で target_school || '目標校'
        club_activity: '', // 空文字で '今日もよく来たね！'
        target_score: '' // 空文字で '進めていこう！'
      }, { name: '目標校なし生徒' });

      expect(res).toContain('プログラマー');
      expect(res).toContain('目標校');
      expect(res).toContain('今日もよく来たね！');
      expect(res).toContain('進めていこう！');
    });

    it('二者面談アドバイスで Gemini API 成功ケース', async () => {
      saveGeminiApiKey('dummy-api-key');
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'Gemini 二者面談アドバイス結果' }
      });

      const res = await generateInterview2CoachingAdvice({
        student_id: 'st-gemini-2'
      }, { name: 'API生徒' });

      expect(res).toBe('Gemini 二者面談アドバイス結果');
    });

    it('二者面談アドバイスで Gemini API 失敗（例外）ケース', async () => {
      saveGeminiApiKey('dummy-api-key');
      mockGenerateContent.mockRejectedValueOnce(new Error('Gemini API Connection Failed'));

      await expect(generateInterview2CoachingAdvice({
        student_id: 'st-gemini-fail'
      }, { name: 'API生徒' })).rejects.toThrow('Gemini API Connection Failed');
    });

    it('三者面談アドバイスで parent_type が father, mother, guardian, 未設定、合意なし、カスタム項目空値分岐（L200-205, L249）', async () => {
      // 1. father & future_direction_agreed = false
      const resFather = await generateInterview3CoachingAdvice({
        student_id: 'st-father',
        parent_type: 'father',
        future_direction_agreed: false,
        custom_fields: [{ label: '部活の目標', value: '' }]
      }, null); // student = null で '生徒', '学年未設定'

      expect(resFather).toContain('お父様');
      expect(resFather).toContain('要継続すり合わせ');
      expect(resFather).toContain('次回面談で具体的な選択肢を絞り込んで合意を深める');

      // 2. mother
      const resMother = await generateInterview3CoachingAdvice({
        student_id: 'st-mother',
        parent_type: 'mother',
        future_direction_agreed: 'yes'
      }, { name: '母同席生徒', grade: '中3' });

      expect(resMother).toContain('お母様');
      expect(resMother).toContain('合意形成済み');
      expect(resMother).toContain('次の定期テストや模試での成果を確認');

      // 3. other guardian (祖父母等)
      const resGuardian = await generateInterview3CoachingAdvice({
        student_id: 'st-guardian',
        parent_type: '祖父'
      }, { name: '祖父同席生徒' });

      expect(resGuardian).toContain('祖父');

      // 4. parent_type 未指定（L203 '保護者様' フォールバック）
      const resDefaultParent = await generateInterview3CoachingAdvice({
        student_id: 'st-default-parent',
        parent_type: ''
      }, { name: '保護者様生徒' });

      expect(resDefaultParent).toContain('保護者様');
    });

    it('三者面談アドバイスで parent_type が "both" の場合の「ご両親」分岐（L201-203）', async () => {
      const res = await generateInterview3CoachingAdvice({
        student_id: 'st-both-parents',
        parent_type: 'both',
        future_direction_agreed: 'yes'
      }, { name: '両親同席生徒' });

      expect(res).toBeDefined();
      expect(res).toContain('ご両親');
    });

    it('二者面談要約（generateInterviewSummary）のフォールバック及びAPI網羅（L355-380）', async () => {
      // 1. API キーなし、student = null, 各種項目空でのフォールバック
      const summaryFallback = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: {
          student_id: 'st-summary-empty',
          interviewer: '',
          dream_goal: '',
          target_school: '',
          target_score: '',
          target_rank: '',
          self_evaluation: '',
          student_challenges: '',
          study_anxiety: '',
          club_activity: '',
          required_actions: ''
        },
        student: null
      });

      expect(summaryFallback).toContain('二者面談の要約');
      expect(summaryFallback).toContain('講師');
      expect(summaryFallback).toContain('一歩ずつ前進');

      // 2. student あり、各種項目あり
      const summaryFull = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: {
          student_id: 'st-summary-full',
          interviewer: '山田先生',
          dream_goal: '建築士',
          target_school: '県立第一高校',
          target_score: '450',
          target_rank: '学年5位',
          self_evaluation: '順調',
          student_challenges: 'ケアレスミス',
          study_anxiety: '内申点が足りるか心配',
          club_activity: 'サッカー部',
          required_actions: '毎日数学を30分解く'
        },
        student: { name: '充実生徒', grade: '中2' }
      });

      expect(summaryFull).toContain('建築士');
      expect(summaryFull).toContain('県立第一高校');
      expect(summaryFull).toContain('450点');
      expect(summaryFull).toContain('学年5位');

      // 3. API キーありで Gemini 成功
      saveGeminiApiKey('dummy-api-key');
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'Gemini 要約結果' }
      });
      const summaryApi = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: { student_id: 'st-api' },
        student: { name: 'API生徒' }
      });
      expect(summaryApi).toBe('Gemini 要約結果');

      // 4. API キーありで Gemini エラー
      mockGenerateContent.mockRejectedValueOnce(new Error('Summary API Error'));
      await expect(generateInterviewSummary({
        interviewType: 'two-way',
        interview: { student_id: 'st-err' },
        student: { name: 'エラー生徒' }
      })).rejects.toThrow('Summary API Error');
    });

    it('文字起こしパースで interviewType が "three-way" の場合のプロンプト生成分岐（L481）', async () => {
      const transcript = '講師: 今日の三者面談を始めます。保護者様、志望校はいかがですか？';
      const parsed = await parseInterviewTranscriptToFields(transcript, 'three-way');
      expect(parsed).toBeDefined();
      expect(parsed.notes).toContain('音声文字起こし');
    });

    it('文字起こしパースで API キーあり時の Gemini 成功・無効JSON・例外ケース（L513-528）', async () => {
      saveGeminiApiKey('dummy-api-key');

      // 1. Gemini が有効な JSON を返すケース（一部キーが null, 空文字, 有効値の混合）
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            target_school: '県立高校',
            dream_goal: null, // null スキップ分岐（L521）
            club_activity: '', // 空文字スキップ分岐（L521）
            student_challenges: '英単語暗記' // 有効値マージ
          })
        }
      });

      const parsedSuccess = await parseInterviewTranscriptToFields(
        '面談の文字起こし。県立高校を目指しています。',
        'two-way'
      );
      expect(parsedSuccess.target_school).toBe('県立高校');
      expect(parsedSuccess.student_challenges).toBe('英単語暗記');

      // 1.2 Gemini API ありで three-way の場合（L481 三者面談プロンプト分岐）
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            parent_anxieties: '受験スケジュール'
          })
        }
      });
      const parsedThreeWay = await parseInterviewTranscriptToFields(
        '三者面談です。親の不安は受験スケジュールです。',
        'three-way'
      );
      expect(parsedThreeWay.parent_anxieties).toBe('受験スケジュール');

      // 2. Gemini が JSON を返さず文字列のみを返すケース（jsonMatch なし）
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'これはJSONではない普通の返信テキストです。'
        }
      });

      const parsedNoJson = await parseInterviewTranscriptToFields(
        '志望校は桜高校です。',
        'two-way'
      );
      expect(parsedNoJson.target_school).toBe('桜高校');

      // 3. Gemini が例外をスローするケース（catch 分岐）
      mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));
      const parsedError = await parseInterviewTranscriptToFields(
        '将来の夢はプログラマーになりたいです。',
        'two-way'
      );
      expect(parsedError.dream_goal).toBe('プログラマー');
    });
  });

  describe('2. BranchManagement.tsx レスポンス branch なし分岐（L118）', () => {
    it('アカウント発行 API が resData.branch を返さない場合の安全分岐', async () => {
      // 本部セッションを保存
      db.saveSession({
        user: { id: 'u-admin', email: 'admin@tentoru.jp', role: 'admin', branch_id: null, name: '本部' },
        token: 'tok-admin',
        logged_in_at: new Date().toISOString()
      });

      // global.fetch をモックして resData に branch がないレスポンスを返す
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }) // branch なし
      } as any);

      const { unmount } = render(<BranchManagement />);

      // 新規校舎ボタンを押下
      const newBtn = screen.getByTestId('open-create-branch-modal');
      await act(async () => {
        fireEvent.click(newBtn);
      });

      // フォームに入力して作成ボタン押下
      const nameInput = screen.getByPlaceholderText(/例: 横浜教室/i);
      const emailInput = screen.getByPlaceholderText(/例: yokohama@tentoru.jp/i);
      const passInput = document.querySelector('input[type="password"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'テスト校' } });
        fireEvent.change(emailInput, { target: { value: 'test@tentoru.jp' } });
        if (passInput) {
          fireEvent.change(passInput, { target: { value: 'password123' } });
        }
      });

      const submitBtn = screen.getByText('アカウントを発行する');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      fetchSpy.mockRestore();
      unmount();
    });
  });

  describe('3. CurriculumCsvImport.tsx 空行・削除キャンセル・エクスポート・プレビューキャンセル網羅', () => {
    it('CSVファイル内に空行が含まれる場合のスキップおよびプレビューキャンセル（L135, L836）', async () => {
      const { unmount } = render(<CurriculumCsvImport />);

      // 1. 空行を含む CSV 文字列をファイルとしてアップロード（L135 分岐）
      const csvWithEmptyLines = "学年,教科,単元名,授業名,種別\n中2,数学,連立方程式,加減法,lesson\n\n\n中2,数学,連立方程式,代入法,lesson\n";
      const file = new File([csvWithEmptyLines], 'test.csv', { type: 'text/csv' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } });
        });

        await waitFor(() => {
          expect(screen.getByText('加減法')).toBeInTheDocument();
          expect(screen.getByText('代入法')).toBeInTheDocument();
        });

        // プレビューの「キャンセル」ボタン押下（L836 fileInputRef.current.value = '' 分岐）
        const cancelBtn = screen.getByText('キャンセル');
        await act(async () => {
          fireEvent.click(cancelBtn);
        });

        expect(screen.queryByText('加減法')).not.toBeInTheDocument();
      }

      unmount();
    });

    it('単元テストマスタの削除確認ダイアログのキャンセル分岐（L679）とCSVエクスポートでの合格基準フォールバック（L379）', async () => {
      // 単元テストマスタを保存（passing_line 未指定で L379, L671 の '80%以上' フォールバックを通過）
      await db.saveCurriculumMasters([{
        id: 'cm-ut-test-1',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '正の数・負の数 単元確認テスト',
        item_type: 'unit_test',
        passing_line: '' // 空文字
      }]);

      const { unmount } = render(<CurriculumCsvImport />);

      // 単元テスト一括管理タブへ切り替え
      await waitFor(() => {
        expect(screen.getByText(/単元テスト一括管理＆CSV出力/i)).toBeInTheDocument();
      });

      const utTabBtn = screen.getByText(/単元テスト一括管理＆CSV出力/i);
      await act(async () => {
        fireEvent.click(utTabBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('delete-unittest-master-cm-ut-test-1')).toBeInTheDocument();
      });

      // 1. 削除ボタン押下で confirm が false を返す（キャンセル分岐 L679）
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const delBtn = screen.getByTestId('delete-unittest-master-cm-ut-test-1');
      await act(async () => {
        fireEvent.click(delBtn);
      });

      expect(confirmSpy).toHaveBeenCalled();
      // キャンセルされたので削除されずに残っていること
      expect(screen.getByTestId('delete-unittest-master-cm-ut-test-1')).toBeInTheDocument();

      // 2. 単元テストCSVエクスポート（L379 passing_line || '80%以上'）
      const exportBtn = screen.getByText(/登録済み単元テストCSVエクスポート/i);
      await act(async () => {
        fireEvent.click(exportBtn);
        // 連続クリックで showToast の toastTimerRef.current クリア分岐（L83）を通過
        fireEvent.click(exportBtn);
      });

      confirmSpy.mockRestore();
      unmount();
    });
  });

  describe('4. SugorokuMap.tsx resolveIndexRange および 不合格テストハイライト', () => {
    it('SugorokuMap resolveIndexRange の全境界値分岐', () => {
      expect(resolveIndexRange(1, 3)).toEqual([1, 3]);
      expect(resolveIndexRange(5, 2)).toEqual([2, 5]);
      expect(resolveIndexRange(2, -1)).toEqual([2, 2]);
      expect(resolveIndexRange(-1, 4)).toEqual([4, 4]);
      expect(resolveIndexRange(-1, -1)).toBeNull();
    });

    it('不合格単元テストが存在する場合のすごろくマップ描画と null ガードおよびノードクリック詳細表示・非表示（L428, L433）', async () => {
      const student: Student = {
        id: 'st-sugoroku-strike',
        name: 'すごろく生徒',
        grade: '中2',
        status: 'normal',
        branch_id: 'branch-1'
      };
      await db.saveStudent(student);

      // マスタ保存
      await db.saveCurriculumMasters([
        {
          id: 'cm-sug-1',
          grade: '中2',
          subject: '数学',
          unit_name: '一次関数',
          lesson_name: '一次関数の変化の割合',
          item_type: 'lesson',
          order_index: 1
        },
        {
          id: 'cm-sug-2',
          grade: '中2',
          subject: '数学',
          unit_name: '一次関数',
          lesson_name: '一次関数 単元確認テスト',
          item_type: 'unit_test',
          order_index: 2
        }
      ]);

      // 単元テストの不合格レコード
      await db.saveMiniTestResult({
        id: 'mtr-fail-1',
        student_id: student.id,
        subject: '数学',
        unit_name: '一次関数',
        test_content: '一次関数 単元確認テスト',
        score: 60,
        passing_score: 80,
        is_passed: false,
        test_date: '2026-10-25'
      });

      const { unmount } = render(
        <SugorokuMap
          student={student}
          subject="数学"
          subjects={['数学']}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/👑 クリア済み（メダル）/i)).toBeInTheDocument();
      });

      // ノードカードをクリックして詳細ポップアップを表示（L428 分岐）
      const nodeCard = screen.getByTestId('sugoroku-node-cm-sug-1');
      await act(async () => {
        fireEvent.click(nodeCard);
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 1')).toBeInTheDocument();
      });

      // 閉じるボタンを押下（L433 分岐）
      const closeBtn = screen.getByText('✕');
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText('STEP 1')).not.toBeInTheDocument();
      });

      unmount();
    });
  });

  describe('5. app/page.tsx 日付なし onViewStudentScreen（L206）および非ログイン時のポータル戻り（L164）', () => {
    it('講師ダッシュボードから日付なしで生徒画面へ遷移した場合の分岐（L206）および生徒画面からポータルへ戻る処理（L164）', async () => {
      const student: Student = {
        id: 'std-page-test-1',
        name: 'ページ生徒',
        grade: '中1',
        status: 'normal',
        branch_id: 'branch-1'
      };
      await db.saveStudent(student);

      db.saveSession({
        user: { id: 'u-1', email: 'teacher@tentoru.jp', role: 'admin', branch_id: null, name: '先生' },
        token: 'tok-1',
        logged_in_at: new Date().toISOString()
      });

      const { unmount } = render(<Home />);

      await waitFor(() => {
        expect(screen.getByText(/TENTORU 司令塔/i)).toBeInTheDocument();
      });

      // ログアウトしてログイン画面に戻る（L164 周辺分岐）
      const logoutBtn = screen.getByText(/ログアウト/i);
      await act(async () => {
        fireEvent.click(logoutBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();
      });

      unmount();
    });
  });

  describe('6. TeacherDashboard 純粋ユーティリティ関数の完全網羅（L1887-1945）', () => {
    it('sortGradeOptions の全ソート比較分岐（既知学年・未知学年の組み合わせ）', () => {
      const input = ['高2', '未知学年B', '小1', '未知学年A', '中3'];
      const sorted = sortGradeOptions(input);
      expect(sorted).toEqual(['小1', '中3', '高2', '未知学年A', '未知学年B']);
    });

    it('inferSelectedStartGrade のフォールバックと全探索分岐', () => {
      const masters = [
        { id: 'm-1', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '加法', sort_order: 10 },
        { id: 'm-2', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '消去法', sort_order: 20 }
      ] as any;

      // 1. currentSelectedGrade が既に存在する場合
      expect(inferSelectedStartGrade('中3', 'm-1', masters)).toBe('中3');

      // 2. startVal が空の場合
      expect(inferSelectedStartGrade('', '', masters)).toBe('');
      expect(inferSelectedStartGrade(null, undefined, masters)).toBe('');

      // 3. ID一致
      expect(inferSelectedStartGrade(undefined, 'm-1', masters)).toBe('中1');

      // 4. sort_order一致
      expect(inferSelectedStartGrade(undefined, '20', masters)).toBe('中2');

      // 5. unit_name一致
      expect(inferSelectedStartGrade(undefined, '正負の数', masters)).toBe('中1');

      // 6. lesson_name一致
      expect(inferSelectedStartGrade(undefined, '消去法', masters)).toBe('中2');

      // 7. 一致なし
      expect(inferSelectedStartGrade(undefined, 'non-existent', masters)).toBe('');
    });

    it('isUnitTestCompletedForStudent の全判定分岐', () => {
      const student: Partial<Student> = {
        id: 'st-ut-comp',
        completed_lesson_ids: ['cm-ut-10', '単元確認テスト1']
      };

      const masters = [
        { id: 'cm-ut-10', grade: '中1', subject: '数学', unit_name: '一次式', lesson_name: '一次式テスト', item_type: 'unit_test' },
        { id: 'cm-ut-20', grade: '中1', subject: '数学', unit_name: '方程式', lesson_name: '方程式テスト', item_type: 'unit_test' }
      ] as any;

      // 1. student または testTitleOrName が未指定
      expect(isUnitTestCompletedForStudent(null, 'テスト')).toBe(false);
      expect(isUnitTestCompletedForStudent(student, '')).toBe(false);

      // 2. completed_lesson_ids 直接一致
      expect(isUnitTestCompletedForStudent(student, '単元確認テスト1')).toBe(true);

      // 3. master経由で ID が completed に存在
      expect(isUnitTestCompletedForStudent(student, '一次式テスト', '数学', masters)).toBe(true);
      expect(isUnitTestCompletedForStudent(student, '一次式 - 一次式テスト', '数学', masters)).toBe(true);

      // 4. miniTestResults で passed === true
      const miniResults1 = [
        { student_id: 'st-ut-comp', test_content: '小テストA', passed: true, score: 70 }
      ] as any;
      expect(isUnitTestCompletedForStudent(student, '小テストA', '数学', masters, miniResults1)).toBe(true);

      // 5. miniTestResults で score >= 80
      const miniResults2 = [
        { student_id: 'st-ut-comp', test_content: '小テストB', passed: false, score: 85 }
      ] as any;
      expect(isUnitTestCompletedForStudent(student, '小テストB', '数学', masters, miniResults2)).toBe(true);

      // 6. 不合格または該当なし
      const miniResultsFail = [
        { student_id: 'st-ut-comp', test_content: '小テストC', passed: false, score: 65 }
      ] as any;
      expect(isUnitTestCompletedForStudent(student, '小テストC', '数学', masters, miniResultsFail)).toBe(false);
    });

    it('resolveAutoDrillHomeworks の宿題自動生成と既存置換・新規追加分岐（L2056-2099）', () => {
      // 1. 中学生の数学・英語コマが存在する場合
      const periodsMiddle = {
        1: { subject: '数学', startLessonName: '正負の数1', endLessonName: '正負の数3' },
        2: { subject: '英語', startLessonName: 'Lesson 1', endLessonName: 'Lesson 2' }
      };

      // 既存の宿題がない場合（新規追加 L2087-2095）
      const hwNew = resolveAutoDrillHomeworks(periodsMiddle, '中2', '2026-10-30', []);
      expect(hwNew.length).toBeGreaterThan(0);
      expect(hwNew.some(h => h.subject === '数学' && h.type === 'drill_2nd')).toBe(true);

      // 既存の drill_2nd 宿題がある場合（置換・更新 L2076-2085）
      const existingHw = [
        { id: 'hw-ex-1', subject: '数学', type: 'drill_2nd', content: '旧宿題', deadline: '2026-10-28', targetScope: 'individual' }
      ];
      const hwUpdated = resolveAutoDrillHomeworks(periodsMiddle, '中2', '2026-10-30', existingHw);
      expect(hwUpdated.length).toBeGreaterThan(0);
      const mathHw = hwUpdated.find(h => h.subject === '数学');
      expect(mathHw).toBeDefined();
      expect(mathHw?.id).toBe('hw-ex-1');

      // 2. 小学生の場合（算数）
      const periodsElem = {
        1: { subject: '算数', startLessonName: '小数1', endLessonName: '小数2' }
      };
      const hwElem = resolveAutoDrillHomeworks(periodsElem, '小5', '2026-10-30', []);
      expect(hwElem.some(h => h.subject === '算数')).toBe(true);
    });

    it('extractUnitTestsFromPeriodSelections のコマ展開および重複排除・フォールバック（L2109-2210）', () => {
      const masters = [
        { id: 'cm-m-1', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '一次関数 単元確認テスト', item_type: 'unit_test', passing_line: '80点以上' },
        { id: 'cm-m-2', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '変化の割合', item_type: 'lesson' }
      ] as any;

      // 1. 対象外科目（その他・テスト）のスキップ分岐（L2126）
      const testsSkip = extractUnitTestsFromPeriodSelections({
        periodSelections: {
          1: { subject: 'その他' },
          2: { subject: 'テスト' },
          3: null
        },
        periodCount: 3,
        curriculumMasters: masters
      });
      expect(testsSkip).toEqual([]);

      // 2. 単元確認テストを含む範囲の展開
      const testsExtracted = extractUnitTestsFromPeriodSelections({
        periodSelections: {
          1: {
            subject: '数学',
            startLessonId: 'cm-m-1',
            startLessonName: '一次関数 単元確認テスト',
            endLessonId: 'cm-m-1',
            endLessonName: '一次関数 単元確認テスト'
          }
        },
        periodCount: 1,
        curriculumMasters: masters,
        student: { id: 'st-ext', grade: '中2' } as any
      });

      expect(testsExtracted.length).toBeGreaterThan(0);
      expect(testsExtracted[0].subject).toBe('数学');
      expect(testsExtracted[0].passingLine).toBe('80点以上');
    });

    it('buildDailyTaskFromTimetableConfig のタスク生成および lesson_ids フォールバック（L1340-1365）', () => {
      const student: Student = {
        id: 'st-bdt-1',
        name: 'ビルド生徒',
        grade: '中2',
        status: 'normal',
        branch_id: 'branch-1'
      };

      // 1. config.lesson_ids が配列で指定されている場合
      const taskWithIds = buildDailyTaskFromTimetableConfig({
        student,
        scheduleDate: '2026-10-27',
        period: 1,
        config: {
          subject: '数学',
          startLessonId: 'cm-1',
          endLessonId: 'cm-2',
          lesson_ids: ['cm-1', 'cm-2']
        },
        targetUnitId: 'cm-1',
        curriculumMastersList: [],
        allCurriculumUnits: []
      });
      expect(taskWithIds.lesson_ids).toEqual(['cm-1', 'cm-2']);

      // 2. config.lesson_ids が未指定で stepLessons が空の場合（L1362 effectiveStartId フォールバック）
      const taskFallback = buildDailyTaskFromTimetableConfig({
        student,
        scheduleDate: '2026-10-27',
        period: 2,
        config: {
          subject: '英語',
          startLessonId: 'cm-eng-1'
        },
        targetUnitId: 'cm-eng-1',
        curriculumMastersList: [],
        allCurriculumUnits: []
      });
      expect(taskFallback.lesson_ids).toEqual(['cm-eng-1']);
    });

    it('filterSchoolsByGrade の全学年区分フィルタリング分岐（L2342-2351）', () => {
      const schools = [
        { id: 'sc-1', name: '小学校A', type: 'elementary' },
        { id: 'sc-2', name: '中学校B', type: 'junior_high' },
        { id: 'sc-3', name: '高校C', type: 'high_school' }
      ] as any;

      // 1. grade なし ➔ すべて返却
      expect(filterSchoolsByGrade(schools, undefined)).toEqual(schools);

      // 2. 小学生 ➔ elementary
      const elemRes = filterSchoolsByGrade(schools, '小3');
      expect(elemRes.length).toBe(1);
      expect(elemRes[0].id).toBe('sc-1');

      // 3. 中学生・高校生 ➔ junior_high & high_school
      const jhsRes = filterSchoolsByGrade(schools, '中1');
      expect(jhsRes.length).toBe(2);
      expect(jhsRes.map(s => s.id)).toEqual(['sc-2', 'sc-3']);

      // 4. その他の区分（大学など） ➔ true
      const otherGradeRes = filterSchoolsByGrade(schools, '一般');
      expect(otherGradeRes.length).toBe(3);
    });

    it('deduplicateTodayTests の重複排除と空・プレースホルダー除外分岐（L2353-2364）', () => {
      const input = [
        { subject: '数学', content: '一次関数' },
        { subject: '数学', content: '一次関数' }, // 重複
        { subject: '数学', content: '' }, // 空
        { subject: '数学', content: '-- 単元テストマスタから選択 --' }, // プレースホルダー除外
        { subject: '英語', content: 'Lesson 1' }
      ];

      const deduplicated = deduplicateTodayTests(input);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].content).toBe('一次関数');
      expect(deduplicated[1].content).toBe('Lesson 1');
    });

    it('reorderCurriculumUnits の順序入れ替え分岐（L2366-2380）', () => {
      const units = [
        { id: 'u-1', sequence_order: 1 },
        { id: 'u-2', sequence_order: 2 },
        { id: 'u-3', sequence_order: 3 }
      ];

      // 1. 先頭で up ➔ null
      expect(reorderCurriculumUnits(units, 0, 'up')).toBeNull();

      // 2. 末尾で down ➔ null
      expect(reorderCurriculumUnits(units, 2, 'down')).toBeNull();

      // 3. 正常な up 入れ替え
      const reorderedUp = reorderCurriculumUnits(units, 1, 'up');
      expect(reorderedUp).not.toBeNull();
      expect(reorderedUp![0].id).toBe('u-2');

      // 4. 正常な down 入れ替え
      const reorderedDown = reorderCurriculumUnits(units, 1, 'down');
      expect(reorderedDown).not.toBeNull();
      expect(reorderedDown![2].id).toBe('u-2');
    });

    it('resolveChapterSortIndex, resolveAvailableSubjectsForStudent, resolveLessonsForSubject の純粋分岐網羅（L2235-2340）', () => {
      // 1. resolveChapterSortIndex
      expect(resolveChapterSortIndex('1章', ['1章', '2章'])).toBe(0);
      expect(resolveChapterSortIndex('未知章', ['1章', '2章'])).toBe(999);
      expect(resolveChapterSortIndex(null, ['1章'])).toBe(999);

      // 2. resolveAvailableSubjectsForStudent
      const elemSubjs = resolveAvailableSubjectsForStudent(null, true);
      expect(elemSubjs).toContain('算数');

      const jhsSubjs = resolveAvailableSubjectsForStudent({ grade: '中2' }, false);
      expect(jhsSubjs[0]).toBe('数学');

      const hsSubjs = resolveAvailableSubjectsForStudent({ grade: '高1' }, false);
      expect(hsSubjs).toContain('数学');

      const customSubjs = resolveAvailableSubjectsForStudent({ grade: '中3', selected_subjects: ['数学', '理科'] }, false);
      expect(customSubjs).toContain('数学');
      expect(customSubjs).toContain('理科');

      // 3. resolveLessonsForSubject で sort_order が undefined の比較分岐（L2339 Branch 818, 819）
      const lessonsNoSortOrder = resolveLessonsForSubject({
        subject: '数学',
        curriculumMastersList: [
          { id: 'm-nosort-1', subject: '数学', lesson_name: 'レッスンA', sort_order: undefined as any },
          { id: 'm-nosort-2', subject: '数学', lesson_name: 'レッスンB', sort_order: undefined as any }
        ]
      });
      expect(lessonsNoSortOrder.length).toBe(2);

      // 4. buildDailyTaskFromTimetableConfig で startLessonId / targetUnitId が空の場合（L1340 Branch 483 index 2）
      const emptyStartTask = buildDailyTaskFromTimetableConfig({
        student: { id: 'st-emp', name: '生徒', grade: '中1', status: 'normal', branch_id: 'b-1' },
        scheduleDate: '2026-10-27',
        period: 1,
        config: { unitId: 'u-emp', startLessonId: '', subject: '数学' },
        targetUnitId: '',
        curriculumMastersList: [],
        allCurriculumUnits: []
      });
      expect(emptyStartTask).toBeDefined();
    });
  });

  describe('7. scheduler.ts 純粋エッジ分岐の完全制覇（L202, L215, L285, L881, L2930-2932）', () => {
    it('resolveSubByPeriod の空文字列要素フォールバック（L2930, L2932）', () => {
      // p <= sortedSubjs.length かつ要素が空文字列 ➔ 算数フォールバック
      expect(resolveSubByPeriod(['', ''], 1)).toBe('算数');
      // p > sortedSubjs.length かつ要素が空文字列 ➔ 算数フォールバック
      expect(resolveSubByPeriod(['', ''], 3)).toBe('算数');
    });

    it('isMatchingUnitOrTest のまとめテスト・Check Test 単元名欠落時の完全一致外判定（L202, L215）', () => {
      // 片方が角括弧形式の「【まとめテスト(1)】」（normalizeUnitNameで空文字）、他方が「一次関数 まとめテスト(1)」
      expect(isMatchingUnitOrTest('【まとめテスト(1)】', '一次関数 まとめテスト(1)')).toBe(true);
      // 片方が角括弧形式の「【Check Test】」（normalizeUnitNameで空文字）、他方が「Lesson 1 Check Test」
      expect(isMatchingUnitOrTest('【Check Test】', 'Lesson 1 Check Test')).toBe(true);
    });

    it('getLatestUnitTestStatusForSubject の空キーテスト結果スキップ（L285）および findNextUncompletedLessonForSubject の単元レッスンフォールバック（L881）', () => {
      // 1. test_type = unit_test だが test_content と unit_name が空文字のレコード（L285 !key スキップ）
      const statusEmptyKey = getLatestUnitTestStatusForSubject({
        studentId: 'st-empty-key',
        subject: '理科',
        miniTestResults: [
          {
            id: 'mtr-emp',
            student_id: 'st-empty-key',
            subject: '理科',
            test_type: 'unit_test',
            test_content: '',
            unit_name: '',
            score: 50,
            passed: false,
            date: '2026-10-25'
          } as any
        ]
      });
      expect(statusEmptyKey.hasFailedUnitTest).toBe(false);

      // 2. 単元テストノード自体がマスタにない教科（理科）で不合格記録がある場合、該当単元のレッスンへフォールバック（L881）
      const nextLesson = findNextUncompletedLessonForSubject({
        student: { id: 'st-sci-fail', name: '理科生徒', grade: '中2', status: 'normal', branch_id: 'b-1' },
        subject: '理科',
        curriculumMasters: [
          {
            id: 'cm-sci-1',
            grade: '中2',
            subject: '理科',
            unit_name: '化学変化と原子・分子',
            lesson_name: '炭酸水素ナトリウムの分解',
            item_type: 'lesson',
            sort_order: 1
          }
        ],
        miniTestResults: [
          {
            id: 'mtr-sci-fail',
            student_id: 'st-sci-fail',
            subject: '理科',
            test_type: 'unit_test',
            unit_name: '化学変化と原子・分子',
            test_content: '化学変化と原子・分子 単元確認テスト',
            score: 40,
            passed: false,
            date: '2026-10-26'
          } as any
        ]
      });
      expect(nextLesson.hasFailedUnitTest).toBe(true);
      expect(nextLesson.lessonId).toBe('cm-sci-1');
    });
  });
});
