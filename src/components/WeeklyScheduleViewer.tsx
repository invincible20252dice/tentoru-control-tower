'use client';

import React, { useState } from 'react';
import { LearningTask, StudentScheduleConfig } from '../lib/db';

const DAY_KEYS = [
  { key: 'monday', label: '月曜日', short: '月', dayNum: 1 },
  { key: 'tuesday', label: '火曜日', short: '火', dayNum: 2 },
  { key: 'wednesday', label: '水曜日', short: '水', dayNum: 3 },
  { key: 'thursday', label: '木曜日', short: '木', dayNum: 4 },
  { key: 'friday', label: '金曜日', short: '金', dayNum: 5 },
  { key: 'saturday', label: '土曜日', short: '土', dayNum: 6 },
  { key: 'sunday', label: '日曜日', short: '日', dayNum: 0 },
];

interface WeeklyScheduleViewerProps {
  tasks: LearningTask[];
  scheduleConfig?: StudentScheduleConfig;
  currentDateStr?: string; // YYYY-MM-DD
}

export const WeeklyScheduleViewer: React.FC<WeeklyScheduleViewerProps> = ({
  tasks,
  scheduleConfig,
  currentDateStr = new Date().toISOString().split('T')[0],
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('tuesday');

  const today = new Date(currentDateStr);
  const todayDayNum = today.getDay(); // 0(日) ~ 6(土)
  const todayDayKeyItem = DAY_KEYS.find(d => d.dayNum === todayDayNum) || DAY_KEYS[1]; // デフォルト火曜

  const selectedDays = scheduleConfig?.selected_days || ['tuesday', 'friday'];

  // 通塾日の中で「本日」以外の次回通塾日を特定
  const getNextSchoolDayKey = (): string | null => {
    if (selectedDays.length === 0) return null;
    const sorted = DAY_KEYS.filter(d => selectedDays.includes(d.key));
    if (sorted.length === 0) return null;

    const futureDay = sorted.find(d => d.dayNum > todayDayNum);
    if (futureDay) return futureDay.key;
    return sorted[0].key; // 次週の最初の通塾日
  };

  const nextSchoolDayKey = getNextSchoolDayKey();

  // 本日 or 指定された曜日のタスク抽出
  const getTasksForDayKey = (dayKey: string) => {
    // 擬似的に日付フィルタリング、または単元タスクを抽出
    return tasks.filter(t => t.status !== 'skipped').slice(0, scheduleConfig?.default_slots || 2);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 w-full max-w-4xl mx-auto my-4">
      {/* ヘッダー＆ビュー切り替えトグル */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-5 bg-teal-600 rounded-full inline-block"></span>
            週間スケジュール・授業予定ビュー
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            確定済みのコマ割りおよび次回通塾日の仮予定を確認できます。
          </p>
        </div>

        {/* トグルスイッチ */}
        <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'day'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            日表示 (Day View)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'week'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            週表示 (Week View)
          </button>
        </div>
      </div>

      {/* A. 日表示ビュー (Day View) */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DAY_KEYS.map(d => (
              <button
                key={d.key}
                onClick={() => setSelectedDayKey(d.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedDayKey === d.key
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 min-h-[160px]">
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
              {DAY_KEYS.find(d => d.key === selectedDayKey)?.label} の授業予定
            </h4>
            {selectedDays.includes(selectedDayKey) ? (
              <div className="space-y-2">
                {getTasksForDayKey(selectedDayKey).map((t, idx) => (
                  <div key={t.id || idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {t.office_note || `個別学習コマ ${idx + 1}`}
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                      確定予定
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm py-8 text-center bg-slate-100/50 rounded-lg border border-dashed border-slate-200">
                通塾日外のため「授業予定なし」
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. 週表示ビュー (Week View) */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAY_KEYS.map(d => {
            const isToday = d.key === todayDayKeyItem.key;
            const isSelectedSchoolDay = selectedDays.includes(d.key);
            const isNextSchoolDay = d.key === nextSchoolDayKey && !isToday;

            let cardBg = 'bg-slate-100/60 border-slate-200 text-slate-400';
            let badge = null;

            if (isSelectedSchoolDay) {
              if (isToday) {
                // 本日（確定予定）
                cardBg = 'bg-white border-teal-500 shadow-md ring-2 ring-teal-500/20 text-slate-800';
                badge = (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-600 text-white shadow-xs">
                    確定予定 (本日)
                  </span>
                );
              } else if (isNextSchoolDay) {
                // 次回通塾日 (仮の授業予定)
                cardBg = 'bg-amber-50/80 border-amber-300 text-slate-800';
                badge = (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white shadow-xs">
                    仮予定 (次回)
                  </span>
                );
              } else {
                // その他の通塾日
                cardBg = 'bg-white border-slate-300 text-slate-800';
                badge = (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    通塾予定日
                  </span>
                );
              }
            } else {
              // 非通塾日
              badge = (
                <span className="text-[10px] font-normal text-slate-400">
                  授業予定なし
                </span>
              );
            }

            const dayTasks = isSelectedSchoolDay ? getTasksForDayKey(d.key) : [];

            return (
              <div
                key={d.key}
                className={`rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[180px] ${cardBg}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                    <span className={`font-bold text-sm ${isToday ? 'text-teal-700' : 'text-slate-700'}`}>
                      {d.short}曜
                    </span>
                    {badge}
                  </div>

                  {/* タスク・コマ表示 */}
                  {isSelectedSchoolDay ? (
                    <div className="space-y-1.5">
                      {dayTasks.map((t, idx) => (
                        <div
                          key={idx}
                          className={`p-1.5 rounded text-xs border ${
                            isToday
                              ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                              : isNextSchoolDay
                              ? 'bg-amber-100/60 border-amber-200 text-amber-900 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="truncate font-semibold">{idx + 1}コマ目</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {isNextSchoolDay ? '仮授業コマ' : '指導確定コマ'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      休塾 / 授業なし
                    </div>
                  )}
                </div>

                {isSelectedSchoolDay && (
                  <div className="mt-2 text-[10px] text-right font-bold text-slate-500">
                    計 {dayTasks.length} コマ
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
