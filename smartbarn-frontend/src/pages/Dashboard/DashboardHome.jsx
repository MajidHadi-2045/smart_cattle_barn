import React, { useState, useEffect, Suspense } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { fetchApi } from '../../utils/api';
import { socket } from '../../utils/socket';
import toast from 'react-hot-toast';
import { Beef, HeartPulse, Activity } from 'lucide-react';

const SensorTrendChart = React.lazy(() => import('../../components/dashboard/SensorTrendChart'));

const MultiSelectDropdown = ({ options = [], selectedIds = [], onChange, maxSelection, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const safeOptions = Array.isArray(options) ? options : [];
    const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

    const filteredOptions = safeOptions.filter(opt => opt && opt.cattleId && String(opt.cattleId).toLowerCase().includes((searchTerm || '').toLowerCase())).slice(0, 15);

    const handleToggle = (id) => {
        if (!id) return;
        if (safeSelectedIds.includes(id)) {
            onChange(safeSelectedIds.filter(v => v !== id));
        } else {
            if (safeSelectedIds.length < maxSelection) {
                onChange([...safeSelectedIds, id]);
            } else {
                toast.error(`Maksimal ${maxSelection} sapi dapat dipilih.`);
            }
        }
    };

    return (
        <div className="relative w-full sm:min-w-[250px]">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer flex justify-between items-center shadow-sm"
            >
                <span className="truncate font-semibold">{safeSelectedIds.length > 0 ? `${safeSelectedIds.length} Sapi Terpilih` : placeholder}</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <input 
                            type="text"
                            placeholder="Cari ID Sapi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-2 text-xs text-center text-slate-500">Tidak ditemukan</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <label key={opt.id || opt.cattleId} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-md transition-colors">
                                    <input 
                                        type="checkbox" 
                                        className="rounded text-amber-500 focus:ring-amber-500"
                                        checked={safeSelectedIds.includes(opt.cattleId)}
                                        onChange={() => handleToggle(opt.cattleId)}
                                    />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{opt.cattleId}</span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400">{safeSelectedIds.length}/{maxSelection} Dipilih</span>
                        <button onClick={() => setIsOpen(false)} className="px-3 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition">Tutup</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomPerformanceTooltip = ({ active, payload, label }) => {
    try {
        if (active && Array.isArray(payload) && payload.length > 0) {
            return (
                <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-md text-xs max-h-60 overflow-y-auto space-y-1.5 z-50 min-w-[200px]">
                    <p className="font-bold text-amber-400 border-b border-slate-700/80 pb-1 mb-1.5">{label || '-'}</p>
                    <div className="space-y-1">
                        {payload.map((entry, index) => {
                            if (!entry) return null;
                            const color = entry.color || entry.stroke || '#f59e0b';
                            const name = entry.name || 'Nilai';
                            const val = entry.value !== undefined && entry.value !== null ? entry.value : '-';
                            return (
                                <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                                    <span style={{ color }} className="font-semibold">{name}:</span>
                                    <span className="font-bold text-slate-100">{val}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
    } catch (e) {
        return null;
    }
    return null;
};

const InfoBadge = ({ label = 'Info' }) => (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-help" title="Arahkan kursor / klik untuk info">
        <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        {label && <span>{label}</span>}
    </span>
);

const DashboardHome = ({ isPublicRoute = false }) => {
    const userRole = isPublicRoute ? null : localStorage.getItem('userRole');
    const userName = isPublicRoute ? null : localStorage.getItem('userName');
    
    // --- 1. STATE MANAGEMENT ---
    const [zones, setZones] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [selectedSectionId, setSelectedSectionId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWsConnected, setIsWsConnected] = useState(socket.connected);
    const [timeRange, setTimeRange] = useState('24h');

    const [livestockStats, setLivestockStats] = useState({ total: 0, healthy: 0, sick: 0, pregnant: 0 });
    const [liveSensorData, setLiveSensorData] = useState({});
    const [historyDataBySection, setHistoryDataBySection] = useState([]);
    const [windHistory, setWindHistory] = useState([]);
    const [currentWindspeed, setCurrentWindspeed] = useState(0);

    const [wasteFilter, setWasteFilter] = useState('daily');
    const [wasteStats, setWasteStats] = useState({ fecesKg: 0, urineL: 0 });
    const [performanceData, setPerformanceData] = useState([]);
    const [performanceRange, setPerformanceRange] = useState('minggu');
    const [performanceChartCowIds, setPerformanceChartCowIds] = useState([]);
    const [performanceTableCowIds, setPerformanceTableCowIds] = useState([]);
    const [cows, setCows] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null, label: '' });
    const [performanceSummary, setPerformanceSummary] = useState({ totalBk: 0, startWeight: 0, endWeight: 0, adg: 0, fcr: 0 });
    const [performanceMultiSummaries, setPerformanceMultiSummaries] = useState([]);
    const [selectedCowsForChart, setSelectedCowsForChart] = useState([]);
    const [isDummyChart, setIsDummyChart] = useState(false);
    const [lastSensorUpdate, setLastSensorUpdate] = useState(0); // Set to 0 initially so it shows offline until data arrives
    const [currentTime, setCurrentTime] = useState(Date.now());

    // State & Handler untuk Hover Info Sapi Adaptif (Desktop & Mobile)
    const [hoveredCowInfo, setHoveredCowInfo] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const handleShowCowInfo = (e, sum) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const isMobile = window.innerWidth < 640;

        if (isMobile) {
            setHoveredCowInfo(sum);
            return;
        }

        let x = rect.right + 12;
        let y = rect.top;

        // Cegah tooltip terpotong di tepi kanan layar
        if (x + 300 > window.innerWidth) {
            x = Math.max(10, rect.left - 300);
        }
        // Cegah tooltip terpotong di tepi bawah layar (geser ke atas)
        if (y + 160 > window.innerHeight) {
            y = Math.max(10, window.innerHeight - 170);
        }

        setTooltipPos({ x, y });
        setHoveredCowInfo(sum);
    };

    const handleHideCowInfo = () => {
        if (window.innerWidth >= 640) {
            setHoveredCowInfo(null);
        }
    };

    // Daily Checklist & Input History States
    const [checklist, setChecklist] = useState({
        feedTask: { done: false, count: 0, title: 'Pencatatan Pakan', subtitle: 'Memuat...' },
        wasteTask: { done: false, count: 0, title: 'Pencatatan Limbah', subtitle: 'Memuat...' },
        weightTask: { done: false, pendingCows: 0, title: 'Penimbangan Sapi', subtitle: 'Memuat...' }
    });
    const [recentInputs, setRecentInputs] = useState([]);
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [isConfigSectionOpen, setIsConfigSectionOpen] = useState(false);
    const [customFeedGoal, setCustomFeedGoal] = useState(1);
    const [customFeedPeriod, setCustomFeedPeriod] = useState('daily');
    const [customWasteGoal, setCustomWasteGoal] = useState(1);
    const [customWastePeriod, setCustomWastePeriod] = useState('daily');
    const [customWeightGoal, setCustomWeightGoal] = useState(5);
    const [customWeightPeriod, setCustomWeightPeriod] = useState('monthly');
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editValue2, setEditValue2] = useState('');
    const [loadingHistory, setLoadingHistory] = useState(false);
    useEffect(() => {
        const handleOpenHistory = () => {
            fetchRecentInputs();
            setIsHistoryModalOpen(true);
        };
        window.addEventListener('openHistoryKoreksi', handleOpenHistory);
        return () => window.removeEventListener('openHistoryKoreksi', handleOpenHistory);
    }, []);

    // Timer untuk force re-render agar status live akurat
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    // --- 2. FUNGSI PENGAMBILAN DATA AWAL (HTTP) & REAL-TIME (WEBSOCKET) ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Ambil semua zona & section dulu jika belum ada
                let currentZones = zones;
                if (zones.length === 0) {
                    const zonesRes = await fetchApi('/zones');
                    currentZones = await zonesRes.json();
                    setZones(currentZones);
                    if (currentZones.length > 0) {
                        setSelectedZoneId(currentZones[0].id);
                        if (currentZones[0].sections.length > 0) {
                            setSelectedSectionId(currentZones[0].sections[0].id);
                        }
                    }
                }

                if (!selectedSectionId && currentZones.length > 0 && currentZones[0].sections.length > 0) {
                    setSelectedSectionId(currentZones[0].sections[0].id);
                }

                if (!selectedSectionId || !selectedZoneId) return;

                // 2. Fetch critical realtime data (Summary & Live Sensors)
                const fetchSummary = async () => {
                    try {
                        const res = await fetchApi('/dashboard/summary');
                        if (res.ok) {
                            const statsData = await res.json();
                            setLivestockStats({ 
                                total: statsData.total || 0, 
                                healthy: statsData.sehat || 0, 
                                sick: statsData.sakit || 0, 
                                pregnant: statsData.hamil || 0 
                            });
                        }
                    } catch (e) { console.error("Summary fetch error", e); }
                };

                const fetchLiveEnv = async () => {
                    try {
                        const res = await fetchApi(`/environment/live/${selectedZoneId}`);
                        if (res.ok) {
                            const text = await res.text();
                            if (text) {
                                const sensorData = JSON.parse(text);
                                setLiveSensorData({
                                    temp: sensorData?.temperature,
                                    hum: sensorData?.humidity,
                                    nh3: sensorData?.ammonia,
                                    thi: sensorData?.thi
                                });
                            } else {
                                setLiveSensorData({});
                            }
                        } else {
                            setLiveSensorData({});
                        }
                    } catch (e) { 
                        if (e.name !== 'SyntaxError') {
                            console.error("Live env fetch error", e);
                        }
                        setLiveSensorData({});
                    }
                };

                const fetchLiveWind = async () => {
                    try {
                        const res = await fetchApi(`/environment/live-wind/${selectedZoneId}`);
                        if (res.ok) {
                            const text = await res.text();
                            if (text) {
                                const liveWindData = JSON.parse(text);
                                setCurrentWindspeed(parseFloat(liveWindData.windspeed));
                            } else {
                                setCurrentWindspeed(null);
                            }
                        } else {
                            setCurrentWindspeed(null);
                        }
                    } catch (e) {
                        // Jangan print jika hanya error JSON parsing (artinya data belum tersedia)
                        if (e.name !== 'SyntaxError') {
                            console.error("Live wind fetch error", e);
                        }
                        setCurrentWindspeed(null);
                    }
                };

                const fetchWaste = async () => {
                    try {
                        const res = await fetchApi(`/dashboard/waste?filter=${wasteFilter}`);
                        if (res.ok) {
                            const wasteData = await res.json();
                            setWasteStats({ fecesKg: wasteData.fecesKg || 0, urineL: wasteData.urineL || 0 });
                        }
                    } catch (e) { console.error("Waste fetch error", e); }
                };

                const fetchChecklist = async () => {
                    try {
                        const res = await fetchApi('/dashboard/daily-checklist');
                        if (res.ok) {
                            const data = await res.json();
                            setChecklist(data);
                            if (data.config) {
                                setCustomFeedGoal(data.config.feed?.goal || 2);
                                setCustomFeedPeriod(data.config.feed?.period || 'daily');
                                setCustomWasteGoal(data.config.waste?.goal || 1);
                                setCustomWastePeriod(data.config.waste?.period || 'daily');
                                setCustomWeightGoal(data.config.weight?.goal || 1);
                                setCustomWeightPeriod(data.config.weight?.period || 'monthly');
                            }
                        }
                    } catch (e) { console.error("Checklist fetch error", e); }
                };

                const generateDummyPerformance = (range) => {
                    let days = range === 'hari' ? 1 : range === 'bulan' ? 30 : 7;
                    const chartData = [];
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days + 1);
                    for (let i = 0; i < days; i++) {
                        const d = new Date(startDate);
                        d.setDate(d.getDate() + i);
                        chartData.push({
                            date: d.toISOString().split('T')[0],
                            waste: parseFloat((30 + Math.random() * 10).toFixed(2)),
                            bk: parseFloat((15 + Math.random() * 5).toFixed(2)),
                            thi: parseFloat((68 + Math.random() * 7).toFixed(2)),
                            weightGain: parseFloat((1.0 + Math.random() * 0.5).toFixed(2))
                        });
                    }
                    return chartData;
                };


                const fetchCows = async () => {
                    try {
                        const res = await fetchApi('/livestock');
                        if (res.ok) {
                            const data = await res.json();
                            setCows(data);
                            return data;
                        }
                    } catch (e) { console.error("Cows fetch error", e); }
                    return [];
                };

                // Jalankan fetchCows dulu untuk mendapatkan daftar sapi, baru lempar ke fetchPerformance
                const cowsList = await fetchCows();
                
                // Run parallel but independent untuk yang lainnya
                await Promise.all([fetchSummary(), fetchLiveEnv(), fetchLiveWind(), fetchWaste(), fetchChecklist()]);

                // 3. Fetch heavy trend data separately
                try {
                    const [historyRes, windTrendRes] = await Promise.all([
                        fetchApi(`/environment/trend/${selectedZoneId}?range=${timeRange}`),
                        fetchApi(`/environment/wind/trend/${selectedZoneId}?range=${timeRange}`)
                    ]);

                    if (historyRes.ok) {
                        const historyData = await historyRes.json();
                        const isLongRange = ['5d', '7d', '30d'].includes(timeRange);
                        const formattedHistory = (Array.isArray(historyData) ? historyData : []).map(item => ({
                            time: isLongRange 
                                ? new Date(item.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            temp: parseFloat(item.temperature),
                            hum: parseFloat(item.humidity),
                            nh3: parseFloat(item.ammonia)
                        }));
                        setHistoryDataBySection(formattedHistory);
                    }

                    if (windTrendRes.ok) {
                        const windTrendData = await windTrendRes.json();
                        const isLongRange = ['5d', '7d', '30d'].includes(timeRange);
                        const formattedWind = (Array.isArray(windTrendData) ? windTrendData : []).map(item => ({
                            time: isLongRange 
                                ? new Date(item.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            speed: parseFloat(item.windspeed)
                        }));
                        setWindHistory(formattedWind);
                    }
                } catch (err) {
                    console.error("Trend data fetch error:", err);
                }

                setError(null);
            } catch (err) {
                console.error("Dashboard general error:", err);
                setError("Gagal memuat beberapa data dashboard");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();

        // Force update status just in case it connected before we listened
        setIsWsConnected(socket.connected);

        // WebSocket Event Listeners
        const onConnect = () => {
            console.log('Socket Connected in Dashboard');
            setIsWsConnected(true);
        };
        const onDisconnect = () => setIsWsConnected(false);
        
        const onEnvironmentData = (incomingData) => {
            // Kita terima data, kalau zoneId cocok atau bahkan nggak usah terlalu strict
            if (incomingData && incomingData.zoneId == selectedZoneId) {
                setLastSensorUpdate(Date.now());
                updateDashboardWithData({
                    timestamp: incomingData.timestamp || Date.now(),
                    temp: incomingData.temperature || 0,
                    hum: incomingData.humidity || 0,
                    nh3: incomingData.ammonia || 0,
                    thi: incomingData.thi
                });
            }
        };

        const onWindspeedData = (data) => {
            if (data && data.zoneId == selectedZoneId) {
                setLastSensorUpdate(Date.now());
                setCurrentWindspeed(parseFloat(data.windspeed || 0));
                const isLongRange = ['5d', '7d', '30d'].includes(timeRange);
                setWindHistory(prev => {
                    const timeLabel = isLongRange 
                        ? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    
                    const newDataPoint = {
                        time: timeLabel,
                        speed: parseFloat(data.windspeed || 0)
                    };
                    return [...prev, newDataPoint].slice(-100);
                });
            }
        };

        const updateDashboardWithData = (data) => {
            setLiveSensorData(prev => ({
                ...prev,
                temp: data.temp, 
                hum: data.hum, 
                nh3: data.nh3,
                thi: data.thi 
            }));
            setHistoryDataBySection(prev => {
                const isLongRange = ['5d', '7d', '30d'].includes(timeRange);
                const timeLabel = isLongRange 
                    ? new Date(data.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                const newDataPoint = {
                    time: timeLabel,
                    temp: parseFloat(data.temp),
                    hum: parseFloat(data.hum),
                    nh3: parseFloat(data.nh3)
                };
                return [...prev, newDataPoint].slice(-200);
            });
        };

        const onVitalsData = () => {
            // Walaupun data sapi tidak ditampilkan di halaman ini, kita gunakan detak jantungnya
            // (yang masuk setiap 1 detik) sebagai bukti bahwa sistem IoT sedang "Live"
            setLastSensorUpdate(Date.now());
        };

        // Subscribe to events
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('websocket:environment', onEnvironmentData);
        socket.on('websocket:windspeed', onWindspeedData);
        socket.on('vital-update', onVitalsData);

        const pollInterval = setInterval(() => {
            fetchInitialData();
            setIsWsConnected(socket.connected); // FORCE CHECK SOCKET STATUS EVERY 30S
        }, 30000); // Sinkronisasi setiap 30 detik

        return () => {
            clearInterval(pollInterval);
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('websocket:environment', onEnvironmentData);
            socket.off('websocket:windspeed', onWindspeedData);
            socket.off('vital-update', onVitalsData);
        };
    }, [selectedZoneId, selectedSectionId, timeRange, wasteFilter]);

    useEffect(() => {
        const fetchPerformance = async () => {
            try {
                let cleanChartCowIds = performanceChartCowIds.join(',');
                let cleanTableCowIds = performanceTableCowIds.join(',');

                if (cleanChartCowIds === '') {
                    setPerformanceData([]);
                    setSelectedCowsForChart([]);
                }
                if (cleanTableCowIds === '') {
                    setPerformanceMultiSummaries([]);
                }
                
                if (cleanChartCowIds !== '') {
                    const res = await fetchApi(`/livestock/performance-chart?period=${performanceRange}&cowId=${cleanChartCowIds}`);
                    if (res.ok) {
                        const chartResult = await res.json();
                        if (chartResult.isDummy) {
                            setPerformanceData(chartResult.data);
                            setIsDummyChart(chartResult.isDummy);
                            setSelectedCowsForChart(chartResult.selectedCows || []);
                        } else {
                            setPerformanceData(chartResult.data || []);
                            setIsDummyChart(false);
                            setSelectedCowsForChart(performanceChartCowIds);
                        }
                    }
                }

                if (cleanTableCowIds !== '') {
                    const tableRes = await fetchApi(`/livestock/performance-chart?period=${performanceRange}&cowId=${cleanTableCowIds}`);
                    if (tableRes.ok) {
                        const tableResult = await tableRes.json();
                        setPerformanceMultiSummaries(tableResult.multiSummaries || []);
                    }
                }
            } catch (e) { 
                console.error("Performance fetch error", e); 
                setPerformanceData([]);
                setIsDummyChart(false);
                setPerformanceMultiSummaries([]);
            }
        };

        fetchPerformance();
    }, [performanceRange, performanceChartCowIds, performanceTableCowIds]);


    const handleSaveChecklistConfig = async () => {
        setIsSavingConfig(true);
        try {
            const res = await fetchApi('/dashboard/checklist-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    feed: { goal: parseInt(customFeedGoal, 10) || 1, period: customFeedPeriod },
                    waste: { goal: parseInt(customWasteGoal, 10) || 1, period: customWastePeriod },
                    weight: { goal: parseInt(customWeightGoal, 10) || 1, period: customWeightPeriod }
                })
            });

            if (res.ok) {
                toast.success('Target tugas harian berhasil diperbarui!');
                setIsConfigSectionOpen(false);
                // Refresh checklist
                const checklistRes = await fetchApi('/dashboard/daily-checklist');
                if (checklistRes.ok) {
                    const data = await checklistRes.json();
                    setChecklist(data);
                }
            } else {
                toast.error('Gagal memperbarui target tugas harian.');
            }
        } catch (e) {
            console.error('Error saving checklist config', e);
            toast.error('Koneksi server gagal saat menyimpan target.');
        } finally {
            setIsSavingConfig(false);
        }
    };

    const fetchRecentInputs = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetchApi('/livestock/recent-inputs');
            if (res.ok) {
                const data = await res.json();
                setRecentInputs(data);
            }
        } catch (e) {
            console.error("Recent inputs fetch error", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        if (item.type === 'PAKAN') {
            setEditValue(item.raw.weightKg);
        } else if (item.type === 'TIMBANGAN') {
            setEditValue(item.raw.weight);
        } else if (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') {
            setEditValue(item.raw.fecesKg);
            setEditValue2(item.raw.urineL);
        }
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedItem) return;
        try {
            const id = selectedItem.id;
            let payload = {};
            let endpoint = '';
            if (selectedItem.type === 'PAKAN') {
                endpoint = `/livestock/feed/${id}`;
                payload = { weightKg: parseFloat(editValue) };
            } else if (selectedItem.type === 'TIMBANGAN') {
                endpoint = `/livestock/weight/${id}`;
                payload = { weight: parseFloat(editValue) };
            } else if (selectedItem.type === 'LIMBAH') {
                endpoint = `/livestock/waste/${id}`;
                payload = { fecesKg: parseFloat(editValue), urineL: parseFloat(editValue2) };
            } else if (selectedItem.type === 'LIMBAH_KANDANG') {
                endpoint = `/livestock/waste/zone/${id}`;
                payload = { fecesKg: parseFloat(editValue), urineL: parseFloat(editValue2) };
            }

            const res = await fetchApi(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Data berhasil diperbarui!');
                setIsEditModalOpen(false);
                fetchRecentInputs();
                // Refresh checklist & summary
                const checklistRes = await fetchApi('/dashboard/daily-checklist');
                if (checklistRes.ok) setChecklist(await checklistRes.json());
            } else {
                alert('Gagal memperbarui data.');
            }
        } catch (e) {
            console.error(e);
            alert('Terjadi kesalahan.');
        }
    };

    const handleDelete = (item) => {
        const itemLabel = item.type === 'LIMBAH_KANDANG' ? item.title : `${item.title} sapi ${item.cattleId}`;
        setDeleteConfirm({ isOpen: true, item: item, label: itemLabel, isBatch: false });
    };

    const confirmDelete = async () => {
        const { item } = deleteConfirm;
        if (!item) return;
        
        try {
            let endpoint = '';
            if (deleteConfirm.isBatch) {
                endpoint = `/livestock/history/batch/${item.batchId}`;
            } else {
                const id = item.id;
                if (item.type === 'PAKAN') endpoint = `/livestock/feed/${id}`;
                else if (item.type === 'TIMBANGAN') endpoint = `/livestock/weight/${id}`;
                else if (item.type === 'LIMBAH') endpoint = `/livestock/waste/${id}`;
                else if (item.type === 'LIMBAH_KANDANG') endpoint = `/livestock/waste/zone/${id}`;
            }

            const res = await fetchApi(endpoint, { method: 'DELETE' });
            if (res.ok) {
                alert('Data berhasil dihapus!');
                fetchRecentInputs();
                const checklistRes = await fetchApi('/dashboard/daily-checklist');
                if (checklistRes.ok) setChecklist(await checklistRes.json());
            } else {
                alert('Gagal menghapus data.');
            }
        } catch (e) {
            console.error(e);
            alert('Terjadi kesalahan.');
        } finally {
            setDeleteConfirm({ isOpen: false, item: null, label: '' });
        }
    }; 

    // --- 3. RENDER UI ---
    // Ambil data spesifik untuk zona yang sedang dipilih
    const rawHistory = Array.isArray(historyDataBySection) ? historyDataBySection : [];
    const currentHistory = rawHistory.map((envItem, index) => {
        // Cari data angin yang waktunya sama persis
        let windItem = (Array.isArray(windHistory) ? windHistory : []).find(w => w.time === envItem.time);
        
        // Fallback ke pencocokan indeks jika tidak ada kecocokan waktu
        if (!windItem && Array.isArray(windHistory) && windHistory[index]) {
            windItem = windHistory[index];
        }
        
        return {
            ...envItem,
            windspeed: windItem ? windItem.speed : null
        };
    });
    
    // Status Live Data
    // Kita anggap offline (merah) jika update terakhir lebih dari 2 menit (120000 ms)
    // Atau jika belum pernah menerima data sama sekali (lastSensorUpdate === 0)
    const isDataLive = isWsConnected && lastSensorUpdate > 0 && (currentTime - lastSensorUpdate < 120000);

    return (
        <div className="space-y-6 pb-20">
            {/* Header Dashboard / Beranda */}
            <div className="h-14 flex flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{isPublicRoute ? 'Beranda Publik' : 'Beranda Utama'}</h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-none mt-1 hidden sm:block">Pantau kondisi lingkungan dan ternak secara real-time</p>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    {isLoading ? (
                        <div className="h-9 w-32 sm:w-44 animate-shimmer rounded-lg"></div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <span className="relative flex h-3 w-3">
                              <span className={`${isDataLive ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full opacity-75 ${!isDataLive ? 'bg-red-400' : 'bg-green-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${!isDataLive ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {!isWsConnected ? 'WebSocket Terputus' : (!isDataLive ? 'Sensor Tidak Aktif' : 'Sistem Aktif (Live)')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODAL CHECKLIST HARIAN & KOREKSI --- */}
            {isChecklistModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl text-emerald-600">📋</span>
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">Pusat Tugas Harian & Koreksi Center</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Kelola kepatuhan pencatatan staf harian peternakan</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsConfigSectionOpen(!isConfigSectionOpen)}
                                    className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition duration-150 shadow-sm"
                                    title="Konfigurasi Target Tugas Harian"
                                >
                                    <span>⚙️</span> {isConfigSectionOpen ? 'Lihat Tugas' : 'Atur Target'}
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsChecklistModalOpen(false);
                                        setIsConfigSectionOpen(false);
                                    }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        
                        {/* Content Modal */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {isConfigSectionOpen ? (
                                    <div className="md:col-span-2 space-y-5 bg-slate-50/50 dark:bg-slate-900/10 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">⚙️ Konfigurasi Target Kepatuhan Harian</h4>
                                            <p className="text-xs text-slate-500">Atur batasan jumlah pencatatan minimum agar tugas harian dianggap 'Selesai' oleh sistem.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* 1. Target Pakan */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Pakan (Per Sapi)</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="10"
                                                        value={customFeedGoal}
                                                        onChange={(e) => setCustomFeedGoal(e.target.value)}
                                                        className="w-20 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                                    />
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">kali per</span>
                                                    <select value={customFeedPeriod} onChange={(e) => setCustomFeedPeriod(e.target.value)} className="w-28 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                                                        <option value="daily">Hari</option>
                                                        <option value="weekly">Minggu</option>
                                                        <option value="monthly">Bulan</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* 2. Target Limbah */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Limbah (Per Sapi)</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="50"
                                                        value={customWasteGoal}
                                                        onChange={(e) => setCustomWasteGoal(e.target.value)}
                                                        className="w-20 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                                    />
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">kali per</span>
                                                    <select value={customWastePeriod} onChange={(e) => setCustomWastePeriod(e.target.value)} className="w-28 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                                                        <option value="daily">Hari</option>
                                                        <option value="weekly">Minggu</option>
                                                        <option value="monthly">Bulan</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* 3. Target Timbangan */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Penimbangan (Per Sapi)</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="500"
                                                        value={customWeightGoal}
                                                        onChange={(e) => setCustomWeightGoal(e.target.value)}
                                                        className="w-20 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                                    />
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">kali per</span>
                                                    <select value={customWeightPeriod} onChange={(e) => setCustomWeightPeriod(e.target.value)} className="w-28 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                                                        <option value="daily">Hari</option>
                                                        <option value="weekly">Minggu</option>
                                                        <option value="monthly">Bulan</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <button 
                                                onClick={handleSaveChecklistConfig}
                                                disabled={isSavingConfig}
                                                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs rounded-xl transition duration-150 shadow-sm flex items-center gap-2"
                                            >
                                                {isSavingConfig ? 'Menyimpan...' : '💾 Simpan Konfigurasi'}
                                            </button>
                                            <button 
                                                onClick={() => setIsConfigSectionOpen(false)}
                                                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition duration-150"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="md:col-span-2 space-y-4">
                                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Status Tugas Hari Ini</h4>
                                        
                                        {/* 1. PAKAN */}
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850">
                                            <div className="flex items-center gap-3.5">
                                                {checklist.feedTask?.done ? (
                                                    <span className="text-green-500 text-xl">✅</span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-xl">⭕</span>
                                                )}
                                                <div>
                                                    <p className={`font-semibold text-sm ${checklist.feedTask?.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {checklist.feedTask?.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{checklist.feedTask?.subtitle}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${checklist.feedTask?.done ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                {checklist.feedTask?.done ? 'Selesai' : 'Belum'}
                                            </span>
                                        </div>

                                        {/* 2. LIMBAH */}
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850">
                                            <div className="flex items-center gap-3.5">
                                                {checklist.wasteTask?.done ? (
                                                    <span className="text-green-500 text-xl">✅</span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-xl">⭕</span>
                                                )}
                                                <div>
                                                    <p className={`font-semibold text-sm ${checklist.wasteTask?.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {checklist.wasteTask?.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{checklist.wasteTask?.subtitle}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${checklist.wasteTask?.done ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                {checklist.wasteTask?.done ? 'Selesai' : 'Belum'}
                                            </span>
                                        </div>

                                        {/* 3. TIMBANGAN */}
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850">
                                            <div className="flex items-center gap-3.5">
                                                {checklist.weightTask?.done ? (
                                                    <span className="text-green-500 text-xl">✅</span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-xl">⭕</span>
                                                )}
                                                <div>
                                                    <p className={`font-semibold text-sm ${checklist.weightTask?.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {checklist.weightTask?.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{checklist.weightTask?.subtitle}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${checklist.weightTask?.done ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                {checklist.weightTask?.done ? 'Selesai' : 'Belum'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-900 border border-green-100 dark:border-slate-800">
                                    <div>
                                        <h4 className="font-bold text-green-800 dark:text-emerald-400 text-base mb-1">Riwayat & Koreksi Data</h4>
                                        <p className="text-xs text-green-700 dark:text-slate-400 leading-relaxed mb-4">
                                            Salah memasukkan angka pakan, timbangan, atau limbah sapi hari ini? Gunakan fitur koreksi cepat untuk memperbaikinya tanpa mengacaukan statistik peternakan.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setIsChecklistModalOpen(false);
                                            fetchRecentInputs();
                                            setIsHistoryModalOpen(true);
                                        }}
                                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition duration-150 shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <span>✏️</span> Lihat & Edit Input Terakhir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- KARTU STATISTIK TERNAK --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-[106px] bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Populasi</p>
                        {isLoading ? (
                            <div className="h-8 animate-shimmer rounded w-16 mt-2"></div>
                        ) : (
                            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">{livestockStats.total} <span className="text-sm font-normal text-slate-500">Ekor</span></p>
                        )}
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                        <Beef size={24} className="text-blue-500" />
                    </div>
                </div>
                <div className="h-[106px] bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Kondisi Sehat</p>
                        {isLoading ? (
                            <div className="h-8 animate-shimmer rounded w-16 mt-2"></div>
                        ) : (
                            <p className="text-3xl font-bold text-green-600 mt-2">{livestockStats.healthy}</p>
                        )}
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                        <HeartPulse size={24} className="text-green-500" />
                    </div>
                </div>
                <div className="h-[106px] bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Kondisi Sakit</p>
                        {isLoading ? (
                            <div className="h-8 animate-shimmer rounded w-16 mt-2"></div>
                        ) : (
                            <p className="text-3xl font-bold text-red-500 mt-2">{livestockStats.sick}</p>
                        )}
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
                        <Activity size={24} className="text-red-500" />
                    </div>
                </div>
            </div>

            {/* --- PEMANTAUAN LINGKUNGAN (KARTU SENSOR) --- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 md:p-6 mt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Kondisi Udara & Lingkungan</h3>
                    
                    {/* Filter Kandang */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select 
                            aria-label="Pilih Kandang atau Zona"
                            value={selectedZoneId || ''}
                            onChange={(e) => {
                                const zid = e.target.value;
                                setSelectedZoneId(zid);
                            }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 font-medium min-w-[140px]"
                        >
                            <option value="">-- Pilih Kandang --</option>
                            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {/* Kartu Kecepatan Angin */}
                    <div 
                        className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-800/30 cursor-help transition-all hover:shadow-md"
                        title="Sirkulasi Angin: Kecepatan aliran udara kandang untuk menetralkan suhu panas & membuang gas racun amonia. Target: > 1 m/s"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-teal-100 dark:bg-teal-800/50 text-teal-600 dark:text-teal-400 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                                </div>
                                <span className="font-semibold text-teal-900 dark:text-teal-100 flex items-center gap-1">
                                    Sirkulasi Angin
                                </span>
                            </div>
                            <InfoBadge label="Info" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                                {currentWindspeed !== null ? currentWindspeed : '--'}
                            </span>
                            <span className="text-teal-800 dark:text-teal-200 font-medium mb-1">m/s</span>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-teal-900 dark:text-teal-200">Target: {'>'} 1 m/s</div>
                    </div>

                    {/* Kartu Suhu */}
                    <div 
                        className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800/30 cursor-help transition-all hover:shadow-md"
                        title="Suhu Ruangan: Suhu ambient udara sekitar kandang. Target ideal: 25 - 28 °C"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-800/50 text-orange-600 dark:text-orange-400 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path></svg>
                                </div>
                                <span className="font-semibold text-orange-900 dark:text-orange-100">Suhu Ruangan</span>
                            </div>
                            <InfoBadge label="Info" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                                {liveSensorData.temp !== undefined ? liveSensorData.temp : '--'}
                            </span>
                            <span className="text-orange-800 dark:text-orange-200 font-medium mb-1">°C</span>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-orange-900 dark:text-orange-200">Target: 25-28 °C</div>
                    </div>

                    {/* Kartu Kelembapan */}
                    <div 
                        className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 cursor-help transition-all hover:shadow-md"
                        title="Kelembapan Relatif (RH): Persentase kadar uap air udara di kandang. Target ideal: 60 - 80%"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a5 5 0 0 0 5-5c0-2-2.5-7-5-12-2.5 5-5 10-5 12a5 5 0 0 0 5 5Z"></path></svg>
                                </div>
                                <span className="font-semibold text-blue-900 dark:text-blue-100">Kelembapan</span>
                            </div>
                            <InfoBadge label="Info" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {liveSensorData.hum !== undefined ? liveSensorData.hum : '--'}
                            </span>
                            <span className="text-blue-800 dark:text-blue-200 font-medium mb-1">%</span>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-blue-900 dark:text-blue-200">Target: 60-80 %</div>
                    </div>

                    {/* Kartu Amonia */}
                    <div 
                        className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/30 cursor-help transition-all hover:shadow-md"
                        title="Gas Amonia (NH3): Gas hasil penguraian urine & feses sapi. Batas aman < 20 PPM. Bahaya jika > 20 PPM!"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>
                                </div>
                                <span className="font-semibold text-red-900 dark:text-red-100">Amonia (NH3)</span>
                            </div>
                            <InfoBadge label="Info" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                                {liveSensorData.nh3 !== undefined ? liveSensorData.nh3 : '--'}
                            </span>
                            <span className="text-red-800 dark:text-red-200 font-medium mb-1">PPM</span>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-red-900 dark:text-red-200">Batas: {'<'} 20 PPM</div>
                    </div>

                    {/* Kartu Stress Level (THI) */}
                    <div 
                        className={`p-4 rounded-xl border transition-all duration-500 cursor-help hover:shadow-md ${
                            !liveSensorData.thi ? 'bg-slate-50 dark:bg-slate-900/20 border-slate-100' :
                            liveSensorData.thi <= 74 ? 'bg-green-50 dark:bg-green-900/20 border-green-100' :
                            liveSensorData.thi <= 78 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100' :
                            liveSensorData.thi <= 83 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100' :
                            'bg-red-50 dark:bg-red-900/20 border-red-100'
                        }`}
                        title="Temperature Humidity Index (THI) NRC (1971): Zona Nyaman (≤74), Zona Waspada (75-78), Zona Bahaya (79-83), Zona Darurat (≥84)"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    !liveSensorData.thi ? 'bg-slate-100 text-slate-600' :
                                    liveSensorData.thi <= 74 ? 'bg-green-100 text-green-600' :
                                    liveSensorData.thi <= 78 ? 'bg-yellow-100 text-yellow-600' :
                                    liveSensorData.thi <= 83 ? 'bg-orange-100 text-orange-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-7.925 0"/><path d="M3 21h18"/><path d="M12 21v-4"/><path d="m4.93 19.07 1.41-1.41"/><path d="m19.07 19.07-1.41-1.41"/></svg>
                                </div>
                                <span className={`font-semibold ${
                                    !liveSensorData.thi ? 'text-slate-900' :
                                    liveSensorData.thi <= 74 ? 'text-green-900' :
                                    liveSensorData.thi <= 78 ? 'text-yellow-900' :
                                    liveSensorData.thi <= 83 ? 'text-orange-900' :
                                    'text-red-900'
                                }`}>Heat Stress (THI)</span>
                            </div>
                            <InfoBadge label="Info" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-end gap-2">
                                <span className={`text-3xl font-bold ${
                                    !liveSensorData.thi ? 'text-slate-600' :
                                    liveSensorData.thi <= 74 ? 'text-green-600' :
                                    liveSensorData.thi <= 78 ? 'text-yellow-600' :
                                    liveSensorData.thi <= 83 ? 'text-orange-600' :
                                    'text-red-600'
                                }`}>
                                    {liveSensorData.thi !== undefined ? (typeof liveSensorData.thi === 'number' ? liveSensorData.thi.toFixed(1) : liveSensorData.thi) : '--'}
                                </span>
                                <span className="text-slate-500 font-medium mb-1 text-xs">Indeks</span>
                            </div>
                            <div className={`mt-2 text-xs font-medium ${
                                !liveSensorData.thi ? 'text-slate-500/70' :
                                liveSensorData.thi <= 74 ? 'text-green-700/70' :
                                liveSensorData.thi <= 78 ? 'text-yellow-700/70' :
                                liveSensorData.thi <= 83 ? 'text-orange-700/70' :
                                'text-red-700/70'
                            }`}>Target: ≤ 74</div>
                            <p className={`text-[10px] font-bold uppercase mt-1 ${
                                !liveSensorData.thi ? 'text-slate-400' :
                                liveSensorData.thi <= 74 ? 'text-green-500' :
                                liveSensorData.thi <= 78 ? 'text-yellow-600' :
                                liveSensorData.thi <= 83 ? 'text-orange-500' :
                                'text-red-500'
                            }`}>
                                {!liveSensorData.thi ? 'Menunggu data...' :
                                 liveSensorData.thi <= 74 ? 'Zona Nyaman (Normal)' :
                                 liveSensorData.thi <= 78 ? 'Zona Waspada (Alert)' :
                                 liveSensorData.thi <= 83 ? 'Zona Bahaya (Danger)' :
                                 'Zona Darurat (Emergency)'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- GRAFIK HISTORI (LAZY LOADED RECHARTS UNTUK SUPER FAST LCP) --- */}
                <Suspense fallback={
                    <div className="mt-8 h-80 w-full bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse flex items-center justify-center text-slate-400 text-sm font-medium">
                        Memuat grafik tren sensor...
                    </div>
                }>
                    <SensorTrendChart currentHistory={currentHistory} timeRange={timeRange} setTimeRange={setTimeRange} />
                </Suspense>

                {/* --- RINGKASAN LIMBAH TERNAK --- */}
                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">Manajemen Limbah Peternakan</h4>
                            <p className="text-sm text-slate-500">Akumulasi produksi Feses dan Urine untuk diolah menjadi Biogas/Pupuk</p>
                        </div>
                        
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button onClick={() => setWasteFilter('daily')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${wasteFilter === 'daily' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Hari Ini</button>
                            <button onClick={() => setWasteFilter('weekly')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${wasteFilter === 'weekly' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Minggu Ini</button>
                            <button onClick={() => setWasteFilter('monthly')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${wasteFilter === 'monthly' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulan Ini</button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Feses Card */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex items-center gap-5">
                            <div className="p-4 bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M11 21a8 8 0 0 0 8-8v-2H5v2a8 8 0 0 0 8 8Z"/><path d="M12 11v4"/></svg>
                            </div>
                            <div>
                                <p className="text-amber-900 dark:text-amber-100 font-bold mb-1">Total Feses Padat</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-amber-600 dark:text-amber-400">{wasteStats.fecesKg.toFixed(1)}</span>
                                    <span className="font-semibold text-amber-800 dark:text-amber-200">Kg</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Urine Card */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-2xl border border-yellow-100 dark:border-yellow-800/30 flex items-center gap-5">
                            <div className="p-4 bg-yellow-100 dark:bg-yellow-800/50 text-yellow-600 dark:text-yellow-400 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                            </div>
                            <div>
                                <p className="text-yellow-900 dark:text-yellow-100 font-bold mb-1">Total Urine Cair</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-yellow-600 dark:text-yellow-400">{wasteStats.urineL.toFixed(1)}</span>
                                    <span className="font-semibold text-yellow-800 dark:text-yellow-200">Liter</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- GRAFIK PERFORMA TERNAK (BK vs Bobot vs Limbah vs THI) --- */}
                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                DMI (Dry Matter Intake)/BK VS ADG (Average Daily Gain)
                                {isDummyChart && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 uppercase font-black tracking-wider">Data Dummy</span>}
                            </h4>
                            <p className="text-sm text-slate-500">Bahan Kering (BK) Konsumsi vs Pertambahan Bobot</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative z-20">
                                <MultiSelectDropdown 
                                    options={cows} 
                                    selectedIds={performanceChartCowIds} 
                                    onChange={setPerformanceChartCowIds} 
                                    maxSelection={5} 
                                    placeholder="Pilih Sapi (Maks 5)" 
                                />
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setPerformanceRange('hari')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${performanceRange === 'hari' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Hari Ini</button>
                                <button onClick={() => setPerformanceRange('minggu')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${performanceRange === 'minggu' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Minggu Ini</button>
                                <button onClick={() => setPerformanceRange('bulan')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${performanceRange === 'bulan' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulan Ini</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[400px] w-full bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        {Array.isArray(performanceData) && performanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                                    
                                    {/* Y-Axis for Weight & BK */}
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />

                                    <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: '16px', fontSize: '11px' }} />
                                    <Tooltip content={<CustomPerformanceTooltip />} wrapperStyle={{ zIndex: 1000 }} />

                                    {Array.isArray(selectedCowsForChart) && selectedCowsForChart.flatMap((cowIdItem, idx) => {
                                        if (!cowIdItem) return [];
                                        const cowId = typeof cowIdItem === 'object' ? (cowIdItem.cattleId || cowIdItem.id || String(cowIdItem)) : String(cowIdItem);
                                        if (!cowId) return [];
                                        const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];
                                        const colorBk = colors[(idx * 2) % colors.length];
                                        const colorAdg = colors[(idx * 2 + 1) % colors.length];
                                        const isAll = cowId === 'ALL';
                                        return [
                                            <Line key={`${cowId}_bk_${idx}`} yAxisId="left" type="monotone" dataKey={isAll ? 'bk' : `${cowId}_bk`} name={`DMI BK (kg) ${!isAll ? cowId : ''}`} stroke={colorBk} strokeWidth={3} dot={{r:4}} isAnimationActive={false} connectNulls={true} />,
                                            <Line key={`${cowId}_adg_${idx}`} yAxisId="left" type="monotone" dataKey={isAll ? 'adg' : `${cowId}_adg`} name={`ADG (kg) ${!isAll ? cowId : ''}`} stroke={colorAdg} strokeWidth={3} dot={{r:4}} isAnimationActive={false} connectNulls={true} />
                                        ];
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-center p-6">
                                <svg className="w-12 h-12 text-amber-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Silakan Pilih Sapi</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                                    Pilih minimal 1 ID sapi pada menu filter di atas untuk melihat grafik performa DMI VS ADG.
                                </p>
                            </div>
                        )}
                    </div>
                    
                    
                    {/* Ringkasan Performa Table (Multi-Cows) */}
                    <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible bg-white dark:bg-slate-900/50">
                        <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 p-3 flex justify-between items-center rounded-t-xl">
                            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">Ringkasan Performa (Avg)</h5>
                            <div className="relative sm:min-w-[250px] z-20">
                                <MultiSelectDropdown 
                                    options={cows} 
                                    selectedIds={performanceTableCowIds} 
                                    onChange={setPerformanceTableCowIds} 
                                    maxSelection={10} 
                                    placeholder="Filter Sapi (Maks 10)" 
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto relative z-10 pb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 cursor-help" title="ID identifikasi unik untuk setiap ternak sapi">
                                        <div className="flex items-center gap-1">
                                            <span>ID Sapi</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-center cursor-help" title="Dry Matter Intake (DMI): Akumulasi bahan kering pakan murni yang dikonsumsi sapi (Kg BK)">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>Total DMI (Kg BK)</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-center cursor-help" title="Bobot awal sapi pada awal periode pengamatan (Kg)">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>Bobot Awal</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-center cursor-help" title="Bobot sapi saat ini. Jika belum ditimbang ulang, nilai dihitung otomatis berdasarkan estimasi pertambahan bobot harian (ADG)">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>Bobot Akhir</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-center cursor-help" title="Average Daily Gain (ADG): Rata-rata pertambahan bobot badan sapi per hari (Kg/hari)">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>ADG (Kg/hari)</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-center cursor-help" title="Feed Conversion Ratio (FCR): Rasio efisiensi pakan terhadap kenaikan bobot (semakin kecil nilai FCR, semakin efisien pakan)">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>FCR</span>
                                            <InfoBadge label="" />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-800/50">
                                {performanceMultiSummaries.length > 0 ? performanceMultiSummaries.map((sum) => {
                                    const weighInfoStr = sum.lastWeighDate ? new Date(sum.lastWeighDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Bobot Awal (Belum Ditimbang Ulang)';
                                    const updateInfoStr = sum.lastUpdatedDate ? new Date(sum.lastUpdatedDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru saja';
                                    const tooltipContent = `Sapi ID: ${sum.cowId}\n⚖️ Terakhir Ditimbang: ${weighInfoStr}\n🔄 Data Diperbaharui: ${updateInfoStr}`;

                                    return (
                                        <tr 
                                            key={sum.cowId} 
                                            className="group hover:bg-amber-50/50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                                            onMouseEnter={(e) => handleShowCowInfo(e, sum)}
                                            onMouseLeave={handleHideCowInfo}
                                            onClick={(e) => handleShowCowInfo(e, sum)}
                                        >
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{sum.cowId}</span>
                                                    <InfoBadge label="" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{Math.max(0, sum.totalBk || 0)}</td>
                                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{sum.startWeight}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                                {Math.max(sum.startWeight || 0, sum.endWeight || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{Math.max(0, sum.adg || 0)}</td>
                                            <td className="px-4 py-3 text-center font-bold text-purple-600 dark:text-purple-400">{Math.max(0, sum.fcr || 0)}</td>
                                        </tr>
                                    );
                                }) : performanceTableCowIds.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-slate-300 dark:text-slate-600 mb-2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                                </svg>
                                                <span className="text-slate-500 dark:text-slate-400 font-medium">Pilih sapi terlebih dahulu</span>
                                                <span className="text-xs text-slate-400 mt-1">Gunakan dropdown di atas untuk memilih sapi</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">Data ringkasan tidak tersedia</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* 1. MODAL RIWAYAT & KOREKSI DATA (HISTORY) */}
            {/* ========================================== */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transform transition-all duration-350 scale-100">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/55">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">✏️</span>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Koreksi Riwayat Input</h3>
                            </div>
                            <button 
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Di bawah ini adalah daftar 20 pencatatan pakan, timbangan, dan limbah sapi terbaru. Klik <b>Koreksi</b> untuk mengubah angka, atau <b>Hapus</b> untuk membatalkan pencatatan.
                            </p>

                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-2"></div>
                                    <p className="text-slate-400 text-sm font-medium">Memuat riwayat pencatatan...</p>
                                </div>
                            ) : recentInputs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <span className="text-4xl mb-2">🕒</span>
                                    <p className="text-sm">Belum ada riwayat input tercatat hari ini.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentInputs.map((item, idx) => (
                                        <div key={`${item.type}-${item.id}-${idx}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 gap-4 hover:border-slate-200 dark:hover:border-slate-700 transition duration-150">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                        item.type === 'PAKAN' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400' :
                                                        item.type === 'TIMBANGAN' ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' :
                                                        'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sapi ID: {item.cattleId}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.details}</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {new Date(item.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="flex-1 sm:flex-none py-1.5 px-3 bg-sky-55 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-lg transition"
                                                >
                                                    Koreksi
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="flex-1 sm:flex-none py-1.5 px-3 bg-red-55 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-bold text-xs rounded-lg transition"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/55">
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="px-5 py-2 bg-slate-205 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* 2. MODAL FORM EDIT DATA (EDIT POPUP) */}
            {/* ========================================== */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/55">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Koreksi Data {selectedItem?.type}</h3>
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedItem?.type === 'LIMBAH_KANDANG' ? (
                                    <>Kandang: <b>{selectedItem?.zoneName}</b> | </>
                                ) : (
                                    <>Sapi ID: <b>{selectedItem?.cattleId}</b> | </>
                                )}
                                Silakan masukkan data koreksi terbaru di bawah ini.
                            </p>

                            {/* PAKAN */}
                            {selectedItem?.type === 'PAKAN' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Berat Pakan Baru (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="Contoh: 15.5"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 dark:text-slate-100 font-medium"
                                    />
                                </div>
                            )}

                            {/* TIMBANGAN */}
                            {selectedItem?.type === 'TIMBANGAN' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Berat Sapi Baru (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="Contoh: 450.5"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 dark:text-slate-100 font-medium"
                                    />
                                </div>
                            )}

                            {/* LIMBAH & LIMBAH KANDANG */}
                            {(selectedItem?.type === 'LIMBAH' || selectedItem?.type === 'LIMBAH_KANDANG') && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Feces Baru (Kg)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder="Contoh: 12.4"
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 dark:text-slate-100 font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Urine Baru (Liter)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editValue2}
                                            onChange={(e) => setEditValue2(e.target.value)}
                                            placeholder="Contoh: 8.5"
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-800 dark:text-slate-100 font-medium"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/55">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 bg-slate-205 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Konfirmasi Hapus Data Dashboard */}
            {deleteConfirm.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 p-6 text-center animate-slide-up">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Konfirmasi Hapus</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus data <b>{deleteConfirm.label}</b>?</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm({ isOpen: false, item: null, label: '' })} 
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={confirmDelete} 
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Adaptive Hover / Touch Modal Info Sapi (Desktop & Mobile) */}
            {hoveredCowInfo && (
                <>
                    {/* Backdrop khusus Mobile */}
                    <div 
                        className="sm:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9998]"
                        onClick={() => setHoveredCowInfo(null)}
                    />

                    <div 
                        style={window.innerWidth >= 640 ? { left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` } : {}}
                        className={`fixed z-[9999] bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700 w-[calc(100vw-2rem)] sm:w-80 transition-all duration-150 animate-fade-in ${
                            window.innerWidth < 640 
                                ? 'bottom-6 left-4 right-4 mx-auto' 
                                : 'pointer-events-none'
                        }`}
                    >
                        <div className="font-bold text-amber-400 border-b border-slate-700/80 pb-2 mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>Detail Status Sapi</span>
                                <span className="text-white font-extrabold bg-amber-500/20 px-2 py-0.5 rounded text-xs">{hoveredCowInfo.cowId}</span>
                            </span>
                            <button 
                                onClick={() => setHoveredCowInfo(null)}
                                className="sm:hidden text-slate-400 hover:text-white text-base font-bold px-1 rounded transition-colors"
                                aria-label="Tutup info"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">⚖️ Terakhir Ditimbang:</span>
                                <span className="font-semibold text-emerald-300 text-right">
                                    {hoveredCowInfo.lastWeighDate ? new Date(hoveredCowInfo.lastWeighDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Bobot Awal (Belum Ditimbang Ulang)'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">🔄 Data Diperbaharui:</span>
                                <span className="font-semibold text-sky-300 text-right">
                                    {hoveredCowInfo.lastUpdatedDate ? new Date(hoveredCowInfo.lastUpdatedDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DashboardHome;