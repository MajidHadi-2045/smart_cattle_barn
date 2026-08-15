import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

const SensorTrendChart = ({ currentHistory, timeRange, setTimeRange }) => {
  return (
    <div className="mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Grafik Tren Sensor ({
            timeRange === '1h' ? '1 Jam Terakhir' : 
            timeRange === '24h' ? '24 Jam Terakhir' :
            timeRange === '7d' ? '7 Hari Terakhir' :
            '30 Hari Terakhir'
          })
        </h4>
        
        {/* Time Range Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          {[
            { id: '1h', label: '1 Jam' },
            { id: '24h', label: '24 Jam' },
            { id: '7d', label: '7 Hari' },
            { id: '30d', label: '1 Bulan' }
          ].map(btn => (
            <button 
              key={btn.id}
              onClick={() => setTimeRange(btn.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${timeRange === btn.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80 w-full">
        {currentHistory && currentHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={currentHistory} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} minTickGap={30} />
              
              {/* Y Axis Kiri (Suhu & Amonia) */}
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              
              {/* Y Axis Kanan (Kelembapan - Skala Persentase) */}
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#3b82f6', fontSize: 12}} domain={[0, 100]} />

              <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />

              {/* Garis Grafik */}
              <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Suhu (°C)" />
              <Line yAxisId="left" type="monotone" dataKey="nh3" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Amonia (ppm)" />
              <Line yAxisId="left" type="monotone" dataKey="windspeed" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Kecepatan Angin (m/s)" />
              <Line yAxisId="right" type="monotone" dataKey="hum" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Kelembapan (%)" />
              <Brush dataKey="time" height={30} stroke="#cbd5e1" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Belum ada data historis yang terekam.
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorTrendChart;
