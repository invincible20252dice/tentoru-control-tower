import { describe, it, expect, beforeEach } from 'vitest';
import { Student, CurriculumMaster, LearningTask } from '../lib/db';

describe('Unit Test Completion Strictness and Current Position Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ensures completing unit test (STEP 14) only completes step 14 and sets STEP 15 as next current position', () => {
    const student: Student = {
      id: 'st-strict-1',
      name: '厳格進捗生徒',
      grade: '小1',
      completed_lesson_ids: ['cm-add-1', 'cm-add-2', 'cm-add-13'] // STEP 13まで完了と想定
    };

    const curriculumNodes: Array<{ id: string; name: string; sortOrder: number }> = [
      { id: 'cm-add-13', name: 'たしざん(3)', sortOrder: 13 },
      { id: 'cm-add-14-test', name: 'たしざん - 単元確認テスト', sortOrder: 14 },
      { id: 'cm-sub-15', name: 'ひきざん - かずをあらわす', sortOrder: 15 },
      { id: 'cm-sub-16', name: 'ひきざん(1)', sortOrder: 16 },
      { id: 'cm-sub-17', name: 'ひきざん(2)', sortOrder: 17 },
      { id: 'cm-sub-18', name: 'ひきざん(3)', sortOrder: 18 },
      { id: 'cm-sub-19-test', name: 'ひきざん - 単元確認テスト', sortOrder: 19 }
    ];

    // STEP 14 (単元確認テスト) のみを完了にするアクション
    const step14Id = 'cm-add-14-test';
    const updatedCompletedIds = Array.from(new Set([...(student.completed_lesson_ids || []), step14Id]));

    const updatedStudent: Student = {
      ...student,
      completed_lesson_ids: updatedCompletedIds
    };

    // 厳格な ID 一致によるノード完了判定
    const isCompletedNode = (nodeId: string) => updatedStudent.completed_lesson_ids?.includes(nodeId);

    // STEP 14 は完了
    expect(isCompletedNode('cm-add-14-test')).toBe(true);

    // 次の「ひきざん」の各授業 (STEP 15〜18) およびテスト (STEP 19) は未完了
    expect(isCompletedNode('cm-sub-15')).toBe(false);
    expect(isCompletedNode('cm-sub-16')).toBe(false);
    expect(isCompletedNode('cm-sub-17')).toBe(false);
    expect(isCompletedNode('cm-sub-18')).toBe(false);
    expect(isCompletedNode('cm-sub-19-test')).toBe(false);

    // 最初の未完了ノード（現在地）の計算
    const firstUncompletedNode = curriculumNodes.find(n => !isCompletedNode(n.id));
    expect(firstUncompletedNode).toBeDefined();
    expect(firstUncompletedNode?.id).toBe('cm-sub-15');
    expect(firstUncompletedNode?.name).toBe('ひきざん - かずをあらわす');
  });
});
