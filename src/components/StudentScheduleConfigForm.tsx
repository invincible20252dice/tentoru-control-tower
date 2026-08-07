'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, StudentScheduleConfig } from '../lib/db';
import { calculateDefaultSlots } from '../lib/scheduler';

const ALL_DAYS = [
  { key: 'monday', label: '月' },
  { key: 'tuesday', label: '火' },
  { key: 'wednesday', label: '水' },
  { key: 'thursday', label: '木' },
  { key: 'friday', label: '金' },
  { key: 'saturday', label: '土' },
  { key: 'sunday', label: '日' }
];

const scheduleSchema = z.object({
  weekly_frequency: z.string().min(1, '週回数を選択してください'),
  weekly_duration: z.string().min(1, '通塾時間を選択してください'),
  selected_days: z.array(z.string()),
  default_slots: z.number().min(1, 'コマ数は1以上を設定してください').max(10, 'コマ数は最大10です'),
});

export type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface StudentScheduleConfigFormProps {
  studentId: string;
  gradeType?: 'elementary' | 'junior_high' | string;
  onSaved?: (config: StudentScheduleConfig) => void;
}

export const StudentScheduleConfigForm: React.FC<StudentScheduleConfigFormProps> = ({
  studentId,
  gradeType = 'junior_high',
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isElementary = gradeType === 'elementary';

  const durationOptions = isElementary
    ? [
        { value: '60分', label: '60分' },
        { value: '90分', label: '90分' },
        { value: '120分', label: '120分' },
        { value: '180分', label: '180分' },
        { value: '240分', label: '240分' },
        { value: '無制限', label: '無制限' },
        { value: '自由追加', label: '自由追加 (手動)' },
      ]
    : [
        { value: '120分', label: '120分' },
        { value: '180分', label: '180分' },
        { value: '240分', label: '240分' },
        { value: '無制限', label: '無制限' },
        { value: '自由追加', label: '自由追加 (手動)' },
      ];

  const frequencyOptions = [
    { value: '2回', label: '週2回' },
    { value: '3回', label: '週3回' },
    { value: '4回', label: '週4回' },
    { value: '5回', label: '週5回' },
    { value: '無制限', label: '無制限' },
    { value: '自由追加', label: '自由追加' },
  ];

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      weekly_frequency: '2回',
      weekly_duration: isElementary ? '90分' : '120分',
      selected_days: ['tuesday', 'friday'],
      default_slots: 2,
    }
  });

  const watchFrequency = watch('weekly_frequency');
  const watchDuration = watch('weekly_duration');
  const watchSelectedDays = watch('selected_days');

  // データ初期ロード
  useEffect(() => {
    if (!studentId) return;
    const config = db.getStudentScheduleConfig(studentId);
    if (config) {
      setValue('weekly_frequency', config.weekly_frequency || '2回');
      setValue('weekly_duration', config.weekly_duration || (isElementary ? '90分' : '120分'));
      setValue('selected_days', config.selected_days || ['tuesday', 'friday']);
      setValue('default_slots', config.default_slots || calculateDefaultSlots(gradeType, config.weekly_duration || '120分'));
    }
  }, [studentId, gradeType, isElementary, setValue]);

  // 通塾時間が変わった時にコマ数を自動計算してセット
  useEffect(() => {
    const slots = calculateDefaultSlots(gradeType, watchDuration);
    setValue('default_slots', slots);
  }, [watchDuration, gradeType, setValue]);

  // 週回数と曜日選択の連動制限チェック
  const getMaxAllowedDays = (freq: string): number | null => {
    if (freq.includes('2')) return 2;
    if (freq.includes('3')) return 3;
    if (freq.includes('4')) return 4;
    if (freq.includes('5')) return 5;
    return null; // 無制限、自由追加
  };

  const handleToggleDay = (dayKey: string) => {
    const currentDays = watchSelectedDays || [];
    const isSelected = currentDays.includes(dayKey);
    const maxDays = getMaxAllowedDays(watchFrequency);

    if (!isSelected && maxDays !== null && currentDays.length >= maxDays) {
      showToast(`週${maxDays}回設定のため、曜日は最大${maxDays}つまでしか選択できません。`, 'error');
      setError('selected_days', {
        type: 'manual',
        message: `週回数（${watchFrequency}）を超える曜日は選択できません。`
      });
      return;
    }

    clearErrors('selected_days');
    const newDays = isSelected
      ? currentDays.filter(d => d !== dayKey)
      : [...currentDays, dayKey];

    setValue('selected_days', newDays);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const onSubmit = async (data: ScheduleFormData) => {
    const maxDays = getMaxAllowedDays(data.weekly_frequency);
    if (maxDays !== null && data.selected_days.length > maxDays) {
      showToast(`選択中の曜日は最大${maxDays}つまでに制限されています。`, 'error');
      return;
    }

    setLoading(true);
    try {
      const configToSave: StudentScheduleConfig = {
        student_id: studentId,
        weekly_frequency: data.weekly_frequency,
        weekly_duration: data.weekly_duration,
        selected_days: data.selected_days,
        default_slots: data.default_slots,
      };

      await db.saveStudentScheduleConfig(configToSave);
      try {
        const student = db.getStudents().find(s => s.id === studentId);
        if (student) {
          student.default_slots = data.default_slots;
          student.period_count = data.default_slots;
          await db.saveStudent(student);
        }
      } catch (e) {
        console.warn('Student period_count sync warning:', e);
      }
      showToast('通塾条件およびコマ数設定を更新・保存しました。', 'success');
      if (onSaved) onSaved(configToSave);
    } catch (err: any) {
      console.error(err);
      showToast('設定の保存に失敗しました。', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginBottom: '24px' }}>
      {/* トースト通知 */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 50,
            padding: '12px 20px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            backgroundColor: toast.type === 'success' ? '#059669' : '#dc2626',
            transition: 'all 0.3s'
          }}
        >
          {toast.message}
        </div>
      )}

      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '4px', height: '16px', backgroundColor: '#4f46e5', borderRadius: '2px', display: 'inline-block' }}></span>
        通塾条件・コマ数自動反映設定 ({isElementary ? '小学生' : '中学生/高校生'})
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 2列グリッド: 週回数 & 通塾時間 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* A. 週回数設定 */}
          <div>
            <label htmlFor="weekly-frequency-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>
              週回数設定
            </label>
            <Controller
              name="weekly_frequency"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  id="weekly-frequency-select"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    backgroundColor: '#fff',
                    color: '#1e293b',
                    boxSizing: 'border-box'
                  }}
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.weekly_frequency && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{errors.weekly_frequency.message}</p>
            )}
          </div>

          {/* B. 通塾時間設定（学年別に動的切り替え） */}
          <div>
            <label htmlFor="weekly-duration-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>
              通塾時間設定 ({isElementary ? '小学生向け' : '中学生向け'})
            </label>
            <Controller
              name="weekly_duration"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  id="weekly-duration-select"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    backgroundColor: '#fff',
                    color: '#1e293b',
                    boxSizing: 'border-box'
                  }}
                >
                  {durationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '-8px 0 0 0' }}>
          通塾時間を選択すると、標準コマ数が自動計算されて適用されます。
        </p>

        {/* C. コマ割り自動連動表示 */}
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', display: 'block' }}>自動連動コマ数（標準コマ数）</span>
            <span style={{ fontSize: '0.75rem', color: '#15803d' }}>通塾パターンから自動割り出しされたコマ設定</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Controller
              name="default_slots"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  min={1}
                  max={10}
                  {...field}
                  onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    textAlign: 'center',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#166534',
                    backgroundColor: '#fff'
                  }}
                />
              )}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>コマ</span>
          </div>
        </div>

        {/* D. 通塾曜日選択 (週回数との完全連動) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
              通塾曜日選択
            </label>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              選択中: <strong style={{ color: '#4f46e5', fontWeight: 'bold' }}>{watchSelectedDays?.length || 0}</strong> 曜日
              {getMaxAllowedDays(watchFrequency) !== null && (
                <span> (上限 {getMaxAllowedDays(watchFrequency)} つ)</span>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ALL_DAYS.map(d => {
              const isSelected = (watchSelectedDays || []).includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => handleToggleDay(d.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: isSelected ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#4f46e5' : '#f8fafc',
                    color: isSelected ? '#ffffff' : '#475569'
                  }}
                >
                  {d.label}曜日
                </button>
              );
            })}
          </div>
          {errors.selected_days && (
            <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px' }}>{errors.selected_days.message}</p>
          )}
        </div>

        {/* 保存ボタン */}
        <div style={{ paddingTop: '4px' }}>
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              handleSubmit(onSubmit)(e);
            }}
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {loading ? '保存中...' : '通塾設定を保存する'}
          </button>
        </div>
      </div>
    </div>
  );
};
