import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
}

interface StockChartProps {
  data: ChartDataPoint[];
  signal?: {
    type: 'LONG' | 'SHORT';
    entry: number;
    tp: number;
    sl: number;
  };
}

export const StockChart: React.FC<StockChartProps> = ({ data, signal }) => {
  const isUp = data.length > 1 ? data[data.length - 1].price >= data[0].price : true;
  const color = isUp ? "#10b981" : "#f43f5e";

  return (
    <div className="h-[350px] w-full bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 relative overflow-hidden">
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-mono text-zinc-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </div>
      </div>

      <h3 className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-6">Market Trend Analysis</h3>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
          <XAxis 
            dataKey="time" 
            stroke="#52525b" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke="#52525b" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            orientation="right"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '11px' }}
            itemStyle={{ color: color }}
            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
          />
          
          {signal && (
            <>
              <ReferenceLine y={signal.entry} stroke="#3b82f6" strokeDasharray="3 3">
                <Label value="ENTRY" position="left" fill="#3b82f6" fontSize={10} fontWeight="bold" />
              </ReferenceLine>
              <ReferenceLine y={signal.tp} stroke="#10b981" strokeDasharray="3 3">
                <Label value="TP" position="left" fill="#10b981" fontSize={10} fontWeight="bold" />
              </ReferenceLine>
              <ReferenceLine y={signal.sl} stroke="#f43f5e" strokeDasharray="3 3">
                <Label value="SL" position="left" fill="#f43f5e" fontSize={10} fontWeight="bold" />
              </ReferenceLine>
            </>
          )}

          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            strokeWidth={2}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
