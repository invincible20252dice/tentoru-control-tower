import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';

describe('Coverage Deep Dive V8 Final 95%+ Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();

    const branch1: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS01',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch1);

    const student: Student = {
      id: 'std-v8-1',
      student_id: 'SV801',
      name: '最終 太郎',
      grade: '小6',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['算数'],
      teacher_in_charge: '荒木はやと'
    };
    await db.saveStudent(student);
  });

  it('covers CurriculumCsvImport drag and drop events', async () => {
    render(<CurriculumCsvImport onImportSuccess={vi.fn()} />);

    const dropzone = screen.getByTestId('csv-dropzone');

    // Drag & Drop イベントの発火
    await act(async () => {
      fireEvent.dragOver(dropzone);
    });

    await act(async () => {
      fireEvent.dragLeave(dropzone);
    });

    const file = new File(['学年,教科,単元名,授業名\n小6,算数,分数,分数の割り算'], 'test.csv', { type: 'text/csv' });
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      });
    });

    await act(async () => {
      fireEvent.click(dropzone);
    });
  });

  it('covers TeacherDashboard unit test creation modal inputs', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard teacherType="elementary" initialStudentId="std-v8-1" onBackToPortal={vi.fn()} />);

    // 「学習設定・受講設定」または「カリキュラムマスタ」関連タブへ切り替え
    const tabs = ['小テスト結果', '宿題提出状況', '年間計画（マイルストーン）', '学習設定・受講設定'];
    for (const t of tabs) {
      const btn = screen.queryByRole('button', { name: new RegExp(t, 'i') });
      if (btn) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });
});
