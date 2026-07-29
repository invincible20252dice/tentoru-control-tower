'use client';

import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip
} from 'recharts';

export interface SubjectScoreItem {
  subject: string;
  score: number; // 0 ~ 100 または 偏差値
  fullMark?: number;
}

interface TestScoreRadarChartProps {
  title?: string;
  data: SubjectScoreItem[];
  dataKeyName?: string;
  chartColor?: string;
  showTable?: boolean;
}

export const TestScoreRadarChart: React.FC<TestScoreRadarChartProps> = ({
  title = '教科別得点・能力レーダーチャート',
  data,
  dataKeyName = '得点',
  chartColor = '#3b82f6',
  showTable = true,
}) => {
  const chartData = data.map(item => ({
    subject: item.subject,
    score: item.score ?? 0,
    fullMark: item.fullMark || 100,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 w-full max-w-4xl mx-auto my-4 transition-all">
      {title && (
        <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="w-2 h-5 bg-blue-600 rounded-full inline-block"></span>
          {title}
        </h3>
      )}

      <div className={`grid grid-cols-1 ${showTable ? 'lg:grid-cols-12' : 'grid-cols-1'} gap-6 items-center`}>
        {/* レーダーチャート表示エリア */}
        <div className={`${showTable ? 'lg:col-span-7' : 'col-span-1'} w-full h-[280px] sm:h-[320px] flex items-center justify-center`}>
          {chartData.length === 0 ? (
            <div className="text-slate-400 text-sm">表示できる点数データがありません</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Radar
                  name={dataKeyName}
                  dataKey="score"
                  stroke={chartColor}
                  fill={chartColor}
                  fillOpacity={0.45}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} 点`, dataKeyName]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px'
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 点数一覧テーブルエリア */}
        {showTable && (
          <div className="lg:col-span-5 w-full bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">教科別スコア詳細</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="py-2 px-2">教科</th>
                    <th className="py-2 px-2 text-right">得点</th>
                    <th className="py-2 px-2 text-right">評価/状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chartData.map((item, idx) => {
                    let levelBadge = { label: '良好', color: 'bg-emerald-100 text-emerald-700' };
                    if (item.score >= 80) {
                      levelBadge = { label: '得意', color: 'bg-blue-100 text-blue-700 font-bold' };
                    } else if (item.score < 60) {
                      levelBadge = { label: '要強化', color: 'bg-rose-100 text-rose-700 font-bold' };
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-100/60 transition-colors">
                        <td className="py-2 px-2 font-medium text-slate-800">{item.subject}</td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900">{item.score} <span className="text-xs font-normal text-slate-400">点</span></td>
                        <td className="py-2 px-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${levelBadge.color}`}>
                            {levelBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
