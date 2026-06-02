import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { socket } from '../../utils/socket';
import toast from 'react-hot-toast';

import { fetchApi, mutate } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const Livestock = () => {
    // --- 1. STATE MANAGEMENT ---
    const [cows, setCows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zones, setZones] = useState([]);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, SEHAT, SAKIT
    const [isWsConnected, setIsWsConnected] = useState(socket.connected);

    // Thresholds
    const VITAL_THRESHOLDS = {
        temp: { min: 38.0, max: 39.5, label: 'Suhu' },
        heartRate: { min: 48, max: 100, label: 'Detak Jantung' }
    };

    const getVitalStatus = (type, value) => {
        if (!value || value === 0) return 'normal';
        if (value < VITAL_THRESHOLDS[type].min || value > VITAL_THRESHOLDS[type].max) return 'danger';
        return 'normal';
    };

    // Modal States
    const [showCowModal, setShowCowModal] = useState(false);
    const [cowFormData, setCowFormData] = useState({ id: null, cattleId: '', breed: '', gender: 'Betina', birthDate: '', initialWeight: '', sectionId: '', status: 'SEHAT' });
    
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [wasteSummary, setWasteSummary] = useState({ totalFeces: 0, totalUrine: 0, cowCount: 0 });
    const [selectedWasteCows, setSelectedWasteCows] = useState([]);
    const [manualWaste, setManualWaste] = useState({ fecesKg: '', urineL: '' });
    const [wasteMode, setWasteMode] = useState('INDIVIDU'); // 'INDIVIDU' or 'KANDANG'
    const [selectedWasteZone, setSelectedWasteZone] = useState('');

    const [showBulkWeightModal, setShowBulkWeightModal] = useState(false);
    const [showBulkFeedModal, setShowBulkFeedModal] = useState(false);
    const [selectedFeedWeightCows, setSelectedFeedWeightCows] = useState([]);
    const [bulkWeight, setBulkWeight] = useState('');
    const [bulkFeed, setBulkFeed] = useState({ feedType: 'Hijauan', weightKg: '' });
    
    // Filter Kandang untuk bulk modals
    const [wasteZoneFilter, setWasteZoneFilter] = useState('ALL');
    const [weightZoneFilter, setWeightZoneFilter] = useState('ALL');
    const [feedZoneFilter, setFeedZoneFilter] = useState('ALL');

    const [showChartModal, setShowChartModal] = useState(false);
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [formSelectedZoneId, setFormSelectedZoneId] = useState(''); // Untuk form Tambah Sapi
    const [manageSelectedZoneId, setManageSelectedZoneId] = useState(null); // Untuk modal Kelola Zona
    const [chartData, setChartData] = useState([]);
    const [activeChartCow, setActiveChartCow] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedCow, setSelectedCow] = useState(null);
    const [feedNeeds, setFeedNeeds] = useState(null);
    const [feedGoal, setFeedGoal] = useState(1);
    const [healthRecords, setHealthRecords] = useState([]);
    const [healthRecordsLimit, setHealthRecordsLimit] = useState(5);
    
    // Config Nutrisi Manual
    const [showNutritionConfig, setShowNutritionConfig] = useState(false);
    const [feedingMethod, setFeedingMethod] = useState('CAMPURAN'); // CAMPURAN, HIJAUAN_SAJA, KONSENTRAT_SAJA, TMR
    const [nutritionPrefsForm, setNutritionPrefsForm] = useState({
        targetBkPercent: 2.5,
        forageRatio: 60,
        concentrateRatio: 40,
        forageDM: 20,
        concentrateDM: 86
    });

    // Nutrition Modal
    const [showNutritionModal, setShowNutritionModal] = useState(false);
    const [weightInput, setWeightInput] = useState('');
    const [weightDateInput, setWeightDateInput] = useState(new Date().toISOString().split('T')[0]);
    const [feedInput, setFeedInput] = useState({ feedType: 'Hijauan', weightKg: '' });

    // --- 2. FUNGSI MENGAMBIL DATA (READ) ---
    const fetchLivestock = async () => {
        setIsLoading(true);
        try {
            const response = await fetchApi('/livestock');
            if (!response.ok) throw new Error('Gagal mengambil data ternak');
            const data = await response.json();
            // Inisialisasi vitals ke 0 agar tidak menampilkan data lama dari backend (sesuai req user)
            // Data akan terisi otomatis saat socket mengirimkan update real-time
            const initializedData = data.map(cow => ({
                ...cow,
                heartRate: 0,
                temp: 0,
                heartRateLastUpdate: 0,
                tempLastUpdate: 0
            }));
            setCows(initializedData);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWasteSummary = async () => {
        try {
            const res = await fetchApi('/livestock/waste/summary');
            if (res.ok) setWasteSummary(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchWasteSettings = async () => {
        try {
            const res = await fetchApi('/livestock/waste/settings');
            if (res.ok) setWasteSettings(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchZones = async () => {
        try {
            const res = await fetchApi('/zones');
            if (res.ok) setZones(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchHealthRecords = async () => {
        try {
            const response = await fetchApi('/health');
            if (response.ok) {
                const data = await response.json();
                setHealthRecords(data);
            }
        } catch (err) {
            console.error('Error fetching health records', err);
        }
    };

    useEffect(() => {
        fetchLivestock();
        fetchWasteSummary();
        fetchWasteSettings();
        fetchZones();
        fetchHealthRecords();

        const fetchChecklistConfig = async () => {
            try {
                const res = await fetchApi('/dashboard/daily-checklist');
                if (res.ok) {
                    const data = await res.json();
                    if (data.config) {
                        setFeedGoal(data.config.feedGoal || 1);
                    }
                }
            } catch (err) {
                console.error('Error fetching checklist config', err);
            }
        };
        fetchChecklistConfig();

        const onWsConnect = () => setIsWsConnected(true);
        const onWsDisconnect = () => setIsWsConnected(false);

        socket.on('connect', onWsConnect);
        socket.on('disconnect', onWsDisconnect);

        // Listener Global untuk Update Vital Sapi secara Real-time di List
        socket.on('vital-update', (payload) => {
            setCows(prevCows => prevCows.map(cow => {
                if (cow.id === payload.cattleId) {
                    const now = Date.now();
                    return {
                        ...cow,
                        heartRate: payload.heartRate !== undefined && payload.heartRate > 0 ? payload.heartRate : cow.heartRate,
                        heartRateLastUpdate: payload.heartRate !== undefined && payload.heartRate > 0 ? now : cow.heartRateLastUpdate,
                        temp: payload.bodyTemperature !== undefined && payload.bodyTemperature > 0 ? payload.bodyTemperature : cow.temp,
                        tempLastUpdate: payload.bodyTemperature !== undefined && payload.bodyTemperature > 0 ? now : cow.tempLastUpdate
                    };
                }
                return cow;
            }));
        });

        const stalenessInterval = setInterval(() => {
            const now = Date.now();
            setCows(prevCows => {
                let hasChanged = false;
                const newCows = prevCows.map(cow => {
                    let newCow = { ...cow };
                    let cowChanged = false;
                    
                    // Cek Detak Jantung (2 detik)
                    if (cow.heartRate > 0 && now - cow.heartRateLastUpdate > 2000) {
                        newCow.heartRate = 0;
                        cowChanged = true;
                    }
                    
                    // Cek Suhu (1 menit)
                    if (cow.temp > 0 && now - cow.tempLastUpdate > 60000) {
                        newCow.temp = 0;
                        cowChanged = true;
                    }
                    
                    if (cowChanged) hasChanged = true;
                    return cowChanged ? newCow : cow;
                });
                return hasChanged ? newCows : prevCows;
            });
        }, 1000);

        return () => {
            socket.off('connect', onWsConnect);
            socket.off('disconnect', onWsDisconnect);
            socket.off('vital-update');
            clearInterval(stalenessInterval);
        };
    }, []);

    // --- 3. FUNGSI CRUD SAPI ---
    const handleSaveCow = async (e) => {
        e.preventDefault();
        
        const isEdit = cowFormData.id !== null;
        const url = isEdit ? `/livestock/${cowFormData.id}` : '/livestock';
        const method = isEdit ? 'PATCH' : 'POST';

        const payload = { 
            ...cowFormData,
            sectionId: parseInt(cowFormData.sectionId),
            initialWeight: parseFloat(cowFormData.initialWeight),
            weight: parseFloat(cowFormData.initialWeight),
            currentWeight: parseFloat(cowFormData.initialWeight)
        };

        toast.promise(
            fetchApi(url, {
                method,
                body: JSON.stringify(payload)
            }).then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal menyimpan data');
                }
                return res.json();
            }),
            {
                loading: 'Sedang menyimpan data sapi...',
                success: (savedCow) => {
                    setShowCowModal(false);
                    
                    // Temukan nama zona dan section berdasarkan sectionId yang dipilih
                    let zoneName = '-';
                    let sectionName = '-';
                    zones.forEach(z => {
                        const sec = z.sections?.find(s => s.id === parseInt(cowFormData.sectionId));
                        if (sec) {
                            zoneName = z.name;
                            sectionName = sec.name;
                        }
                    });

                    if (isEdit) {
                        setCows(prev => prev.map(c => c.id === cowFormData.cattleId ? {
                            ...c,
                            dbId: savedCow.id,
                            breed: cowFormData.breed,
                            gender: cowFormData.gender,
                            weight: parseFloat(cowFormData.initialWeight),
                            status: cowFormData.status,
                            zone: zoneName,
                            section: { ...c.section, name: sectionName, zone: { name: zoneName } }
                        } : c));
                    } else {
                        const newCowObj = {
                            dbId: savedCow.id,
                            id: cowFormData.cattleId,
                            breed: cowFormData.breed,
                            gender: cowFormData.gender,
                            weight: parseFloat(cowFormData.initialWeight),
                            status: cowFormData.status,
                            zone: zoneName,
                            section: { name: sectionName, zone: { name: zoneName } },
                            heartRate: 0,
                            temp: 0,
                            heartRateLastUpdate: 0,
                            tempLastUpdate: 0
                        };
                        setCows(prev => [newCowObj, ...prev]);
                    }

                    return 'Berhasil menyimpan data sapi!';
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        );
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Apakah Anda yakin ingin menghapus data sapi ini?`)) return;
        toast.promise(
            fetchApi(`/livestock/${id}`, { method: 'DELETE' })
            .then(res => { if(!res.ok) throw new Error(); return res; }),
            {
                loading: 'Menghapus data...',
                success: () => {
                    setCows(cows.filter(cow => cow.id !== id));
                    return 'Data sapi berhasil dihapus';
                },
                error: 'Gagal menghapus data',
            }
        );
    };

    const openEditCow = (cow) => {
        // Find DB id (backend returns cattleId as 'id' usually, so we use dbId for patch)
        setCowFormData({
            id: cow.dbId,
            cattleId: cow.id,
            breed: cow.breed,
            gender: cow.gender,
            birthDate: '', // Can't easily map age back to birthDate perfectly without real date
            initialWeight: cow.weight,
            zone: cow.zone,
            status: cow.status
        });
        setShowCowModal(true);
    };

    // --- 4. FUNGSI LIMBAH ---

    const handleManualWaste = async (e) => {
        e.preventDefault();
        
        if (!selectedWasteZone) {
            toast.error('Pilih kandang untuk dicatat limbahnya');
            return;
        }

        toast.promise(
            fetchApi('/livestock/waste/zone', {
                method: 'POST',
                body: JSON.stringify({
                    zoneId: parseInt(selectedWasteZone),
                    fecesKg: parseFloat(manualWaste.fecesKg),
                    urineL: parseFloat(manualWaste.urineL)
                })
            }).then(async res => { if(!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'Gagal'); } return res; }),
            {
                loading: 'Mencatat limbah kandang...',
                success: () => {
                    setManualWaste({ fecesKg: '', urineL: '' });
                    setSelectedWasteZone('');
                    fetchWasteSummary();
                    return 'Berhasil mencatat limbah kandang!';
                },
                error: (err) => err.message,
            }
        );
    };

    const getBulkFeedBkPercent = (feedType) => {
        switch(feedType) {
            case 'Hijauan': return 20;
            case 'Konsentrat': return 86;
            case 'Konsentrat+hijauan': return 53;
            case 'Tmr': return 50;
            default: return 50;
        }
    };

    const calculateGroupRecommendations = () => {
        let totalBk = 0;
        let totalForageAsFed = 0;
        let totalConcentrateAsFed = 0;
        let totalTmrAsFed = 0;

        selectedFeedWeightCows.forEach(cowId => {
            const cow = cows.find(c => c.id === cowId);
            if (!cow) return;

            const lastWeightRecord = cow.weightRecords && cow.weightRecords.length > 0
                ? cow.weightRecords[0].weight
                : (cow.initialWeight || 300);

            const targetBkPercent = cow.targetBkPercent ?? 2.5;
            const bkReq = lastWeightRecord * (targetBkPercent / 100);
            totalBk += bkReq;

            const forageRatio = cow.forageRatio ?? 60;
            const concentrateRatio = cow.concentrateRatio ?? 40;
            const forageDM = cow.forageDM ?? 20;
            const concentrateDM = cow.concentrateDM ?? 86;

            if (concentrateRatio === 999) {
                totalTmrAsFed += bkReq / (forageDM / 100);
            } else {
                if (forageRatio > 0) {
                    totalForageAsFed += (bkReq * (forageRatio / 100)) / (forageDM / 100);
                }
                if (concentrateRatio > 0) {
                    totalConcentrateAsFed += (bkReq * (concentrateRatio / 100)) / (concentrateDM / 100);
                }
            }
        });

        return {
            totalBk,
            totalForageAsFed,
            totalConcentrateAsFed,
            totalTmrAsFed
        };
    };

    const handleBulkWeightSubmit = async (e) => {
        e.preventDefault();
        if (selectedFeedWeightCows.length === 0) { toast.error('Pilih minimal satu sapi'); return; }
        if (!bulkWeight) { toast.error('Masukkan berat badan sapi'); return; }
        const todayStr = new Date().toISOString().split('T')[0];
        const promises = selectedFeedWeightCows.map(cowId =>
            fetchApi('/livestock/weight', { method: 'POST', body: JSON.stringify({ cattleId: cowId, weight: parseFloat(bulkWeight), date: todayStr }) })
        );
        toast.promise(
            Promise.all(promises).then(async (results) => { for (const res of results) { if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'Ada yang gagal'); } } return results; }),
            {
                loading: 'Mencatat timbang kelompok...',
                success: () => { setBulkWeight(''); setSelectedFeedWeightCows([]); setShowBulkWeightModal(false); fetchLivestock(); return 'Berat kelompok berhasil dicatat!'; },
                error: (err) => `Gagal: ${err.message || 'Error server'}`
            }
        );
    };

    const handleBulkFeedSubmit = async (e) => {
        e.preventDefault();
        if (selectedFeedWeightCows.length === 0) { toast.error('Pilih minimal satu sapi'); return; }
        if (!bulkFeed.weightKg) { toast.error('Masukkan berat pakan'); return; }
        const bkPercent = getBulkFeedBkPercent(bulkFeed.feedType);
        const promises = selectedFeedWeightCows.map(cowId =>
            fetchApi('/livestock/feed', { method: 'POST', body: JSON.stringify({ cattleId: cowId, feedType: bulkFeed.feedType, weightKg: parseFloat(bulkFeed.weightKg), bkPercent }) })
        );
        toast.promise(
            Promise.all(promises).then(async (results) => { for (const res of results) { if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'Ada yang gagal'); } } return results; }),
            {
                loading: 'Mencatat pakan kelompok...',
                success: () => { setBulkFeed({ feedType: 'Hijauan', weightKg: '' }); setSelectedFeedWeightCows([]); setShowBulkFeedModal(false); fetchLivestock(); return 'Pakan kelompok berhasil dicatat!'; },
                error: (err) => `Gagal: ${err.message || 'Error server'}`
            }
        );
    };

    const handleAddZone = async (e) => {
        e.preventDefault();
        if (!newZoneName) return;
        toast.promise(
            fetchApi('/zones', {
                method: 'POST',
                body: JSON.stringify({ name: newZoneName })
            }).then(res => { if(!res.ok) throw new Error(); return res; }),
            {
                loading: 'Menambah kandang baru...',
                success: () => {
                    setNewZoneName('');
                    fetchZones();
                    return 'Kandang berhasil ditambahkan!';
                },
                error: 'Gagal menambah kandang',
            }
        );
    };

    const handleAddSection = async (zoneId) => {
        if (!newSectionName) return;
        toast.promise(
            fetchApi(`/zones/${zoneId}/sections`, {
                method: 'POST',
                body: JSON.stringify({ name: newSectionName })
            }).then(res => { if(!res.ok) throw new Error(); return res; }),
            {
                loading: 'Menambah section...',
                success: () => {
                    setNewSectionName('');
                    fetchZones();
                    return 'Section berhasil ditambahkan!';
                },
                error: 'Gagal menambah section',
            }
        );
    };

    const handleDeleteSection = async (id) => {
        if (!window.confirm('Hapus section ini?')) return;
        toast.promise(
            fetchApi(`/zones/sections/${id}`, { method: 'DELETE' }).then(res => { if(!res.ok) throw new Error(); return res; }),
            {
                loading: 'Menghapus section...',
                success: () => {
                    fetchZones();
                    return 'Section berhasil dihapus!';
                },
                error: 'Gagal menghapus section',
            }
        );
    };

    const handleDeleteZone = async (id) => {
        if (!window.confirm('Hapus kandang ini? Semua section di dalamnya juga akan terhapus.')) return;
        toast.promise(
            fetchApi(`/zones/${id}`, { method: 'DELETE' }).then(res => { if(!res.ok) throw new Error(); return res; }),
            {
                loading: 'Menghapus kandang...',
                success: () => {
                    fetchZones();
                    return 'Kandang berhasil dihapus!';
                },
                error: 'Gagal menghapus kandang',
            }
        );
    };

    // --- 5. FUNGSI GRAFIK REALTIME (EKG) ---
    const openChartModal = async (cattleId) => {
        setActiveChartCow(cattleId);
        setShowChartModal(true);
        setChartData([]);

        try {
            const token = localStorage.getItem('token');
            // Fetch history from API endpoint 5 (findOne by dbId)
            // Wait, we need dbId. Let's find it.
            const cow = cows.find(c => c.id === cattleId);
            if(cow) {
                const res = await fetchApi(`/livestock/${cow.dbId}`);
                const data = await res.json();
                if(data && data.vitals) {
                    const history = data.vitals.reverse().map(v => ({
                        time: new Date(v.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second:'2-digit' }),
                        heartRate: v.heartRate,
                        temp: v.bodyTemperature
                    }));
                    setChartData(history);
                }
            }
        } catch (err) { console.error("Gagal load history chart", err); }
    };

    useEffect(() => {
        if (!activeChartCow) return;
        const onVitalUpdate = (payload) => {
            setChartData(prev => {
                const lastPoint = prev.length > 0 ? prev[prev.length - 1] : { heartRate: 0, temp: 0 };
                const newDataPoint = {
                    time: new Date(payload.timestamp || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second:'2-digit' }),
                    heartRate: payload.heartRate !== undefined ? payload.heartRate : lastPoint.heartRate,
                    temp: payload.bodyTemperature !== undefined ? payload.bodyTemperature : lastPoint.temp
                };
                const updated = [...prev, newDataPoint];
                return updated.length > 30 ? updated.slice(updated.length - 30) : updated;
            });
        };

        const eventName = `vital-update-${activeChartCow}`;
        socket.on(eventName, onVitalUpdate);

        return () => {
            socket.off(eventName, onVitalUpdate);
        };
    }, [activeChartCow]);

    const openCowDetail = async (cow) => {
        setSelectedCow(cow);
        setShowDetailModal(true);
        setShowNutritionConfig(false);
        setFeedNeeds(null);
        setHealthRecordsLimit(5);
        try {
            const res = await fetchApi(`/livestock/feed-needs/${cow.id}`);
            if (res.ok) {
                const data = await res.json();
                setFeedNeeds(data);
                if (data.prefs) {
                    setNutritionPrefsForm(data.prefs);
                    if (data.prefs.concentrateRatio === 999) {
                        setFeedingMethod('TMR');
                    } else if (data.prefs.concentrateRatio === 0) {
                        setFeedingMethod('HIJAUAN_SAJA');
                    } else if (data.prefs.forageRatio === 0) {
                        setFeedingMethod('KONSENTRAT_SAJA');
                    } else {
                        setFeedingMethod('CAMPURAN');
                    }
                } else {
                    // Defaults fallback
                    setNutritionPrefsForm({ targetBkPercent: 2.5, forageRatio: 60, concentrateRatio: 40, forageDM: 20, concentrateDM: 86 });
                    setFeedingMethod('CAMPURAN');
                }
            }
        } catch (e) {
            console.error("Failed to load feed needs", e);
        }
    };

    const openNutritionConfig = async (cow) => {
        await openCowDetail(cow);
        setShowNutritionConfig(true);
    };

    const openFeedModal = async (cow) => {
        setSelectedCow(cow);
        try {
            const res = await fetchApi(`/livestock/feed-needs/${cow.id}`);
            if (res.ok) {
                const data = await res.json();
                setFeedNeeds(data);
                if (data.prefs) {
                    setNutritionPrefsForm(data.prefs);
                    if (data.prefs.concentrateRatio === 999) {
                        setFeedingMethod('TMR');
                        setFeedInput({ feedType: 'Tmr', weightKg: '' });
                    } else if (data.prefs.concentrateRatio === 0) {
                        setFeedingMethod('HIJAUAN_SAJA');
                        setFeedInput({ feedType: 'Hijauan', weightKg: '' });
                    } else if (data.prefs.forageRatio === 0) {
                        setFeedingMethod('KONSENTRAT_SAJA');
                        setFeedInput({ feedType: 'Konsentrat', weightKg: '' });
                    } else {
                        setFeedingMethod('CAMPURAN');
                        setFeedInput({ feedType: 'Konsentrat+hijauan', weightKg: '' });
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load feed needs", e);
        }
        setShowDetailModal(false);
        setShowNutritionModal(true);
    };

    const handleSaveNutritionPrefs = async (e) => {
        e.preventDefault();
        
        let finalPrefs = { ...nutritionPrefsForm };
        if (feedingMethod === 'HIJAUAN_SAJA') {
            finalPrefs.forageRatio = 100;
            finalPrefs.concentrateRatio = 0;
        } else if (feedingMethod === 'KONSENTRAT_SAJA') {
            finalPrefs.forageRatio = 0;
            finalPrefs.concentrateRatio = 100;
        } else if (feedingMethod === 'TMR') {
            finalPrefs.forageRatio = 100;
            finalPrefs.concentrateRatio = 999;
        }

        toast.promise(
            fetchApi(`/livestock/${selectedCow.dbId}`, {
                method: 'PATCH',
                body: JSON.stringify(finalPrefs)
            }).then(res => { if(!res.ok) throw new Error(); return res.json(); }),
            {
                loading: 'Menyimpan konfigurasi...',
                success: () => {
                    setShowNutritionConfig(false);
                    mutate(`/livestock/feed-needs/${selectedCow.id}`);
                    openCowDetail(selectedCow); // Reload feed needs
                    return 'Konfigurasi nutrisi berhasil disimpan!';
                },
                error: 'Gagal menyimpan konfigurasi',
            }
        );
    };

    const handleRecordWeight = async (e) => {
        e.preventDefault();
        toast.promise(
            fetchApi('/livestock/weight', {
                method: 'POST',
                body: JSON.stringify({ cattleId: selectedCow.id, weight: parseFloat(weightInput), date: weightDateInput })
            }).then(async res => { if(!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'Gagal'); } return res; }),
            {
                loading: 'Mencatat berat...',
                success: () => {
                    const newWeight = parseFloat(weightInput);
                    setWeightInput('');
                    
                    // Update state lokal tanpa reload seluruh halaman
                    setCows(prev => prev.map(c => c.id === selectedCow.id ? { ...c, weight: newWeight } : c));
                    openCowDetail({ ...selectedCow, weight: newWeight }); // Refresh feed needs dan modal
                    return 'Berat berhasil dicatat!';
                },
                error: (err) => err.message,
            }
        );
    };

    const handleRecordFeed = async (e) => {
        e.preventDefault();

        let computedBkPercent = 50;
        switch(feedInput.feedType) {
            case 'Hijauan': computedBkPercent = nutritionPrefsForm.forageDM || 20; break;
            case 'Konsentrat': computedBkPercent = nutritionPrefsForm.concentrateDM || 86; break;
            case 'Konsentrat+hijauan': computedBkPercent = ((nutritionPrefsForm.forageDM || 20) + (nutritionPrefsForm.concentrateDM || 86)) / 2; break;
            case 'Konsentrat+hijauan+vitamin': computedBkPercent = ((nutritionPrefsForm.forageDM || 20) + (nutritionPrefsForm.concentrateDM || 86)) / 2; break;
            case 'Tmr': computedBkPercent = (nutritionPrefsForm.concentrateRatio === 999) ? (nutritionPrefsForm.forageDM || 50) : 50; break;
        }

        toast.promise(
            fetchApi('/livestock/feed', {
                method: 'POST',
                body: JSON.stringify({ 
                    cattleId: selectedCow.id, 
                    feedType: feedInput.feedType, 
                    weightKg: parseFloat(feedInput.weightKg), 
                    bkPercent: parseFloat(computedBkPercent.toFixed(2)) 
                })
            }).then(async res => { if(!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.message || 'Gagal'); } return res; }),
            {
                loading: 'Mencatat pakan...',
                success: () => {
                    setFeedInput(prev => ({ ...prev, weightKg: '' }));
                    return 'Pakan berhasil dicatat!';
                },
                error: (err) => err.message,
            }
        );
    };

    const filteredCows = cows.filter(cow => {
        const matchesSearch = cow.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            cow.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            cow.zone.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || cow.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header & Quick Action Row */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Manajemen Ternak</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola data individu sapi dan limbah peternakan</p>
                </div>
                
                {/* Clean, Unified Action Buttons Deck */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button 
                        onClick={() => setShowWasteModal(true)} 
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                    >
                        <span>Manajemen Limbah</span>
                    </button>
                    <button 
                        onClick={() => { setSelectedFeedWeightCows([]); setShowBulkWeightModal(true); }} 
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-900/50 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                    >
                        <span>⚖️ Timbang Kelompok</span>
                    </button>
                    <button 
                        onClick={() => { setSelectedFeedWeightCows([]); setShowBulkFeedModal(true); }} 
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                    >
                        <span>🌾 Pakan Kelompok</span>
                    </button>
                    <button 
                        onClick={() => setShowZoneModal(true)} 
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/50 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                    >
                        <span>Kelola Kandang</span>
                    </button>
                    <button 
                        onClick={() => { 
                            setCowFormData({ id: null, cattleId: '', breed: '', gender: 'Betina', birthDate: '', initialWeight: '', sectionId: '', status: 'SEHAT' }); 
                            setFormSelectedZoneId('');
                            setShowCowModal(true); 
                        }} 
                        className="flex-1 lg:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                        <span>+ Tambah Sapi</span>
                    </button>
                </div>
            </div>

            {/* Modern Filter & Search Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                {/* Search box with modern magnifying glass icon wrapper */}
                <div className="relative flex-1 w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                        </svg>
                    </span>
                    <input 
                        type="text" 
                        placeholder="Cari ID Sapi, Breed, atau Kandang..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 transition text-sm font-medium shadow-sm"
                    />
                </div>
                
                {/* Clean status filter select dropdown */}
                <div className="w-full md:w-56">
                    <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 transition text-sm font-semibold shadow-sm cursor-pointer"
                    >
                        <option value="ALL">Semua Status Sapi</option>
                        <option value="SEHAT">🟢 Sehat</option>
                        <option value="SAKIT">🔴 Sakit</option>
                    </select>
                </div>
            </div>

            {/* Banner Limbah Harian */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-400 rounded-xl p-5 text-white shadow-lg flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg">Total Limbah Terkumpul Hari Ini</h3>
                    <p className="text-amber-100 text-sm">Berdasarkan {wasteSummary.cowCount} sapi yang telah dicatat</p>
                </div>
                <div className="flex gap-6 text-right">
                    <div>
                        <p className="text-3xl font-black">{wasteSummary.totalFeces} <span className="text-sm font-normal">kg Feses</span></p>
                    </div>
                    <div>
                        <p className="text-3xl font-black">{wasteSummary.totalUrine} <span className="text-sm font-normal">L Urine</span></p>
                    </div>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">Error: {error}</div>}
            
            {/* Grid Kartu Sapi */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6 animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 h-48 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                <div>
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-1"></div>
                                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl"></div>
                                <div className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6 items-start">
                    {filteredCows.map((cow) => (
                        <div key={cow.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => openCowDetail(cow)}>
                                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl font-bold shadow-sm group-hover:scale-110 transition-transform">🐮</div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-primary-600 transition-colors">{cow.id}</h3>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{cow.breed || cow.gender}</p>
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${cow.status === 'SEHAT' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {cow.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Berat</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{cow.weight} <span className="text-xs">kg</span></p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Lokasi</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200 truncate" title={`${cow.section?.zone?.name} - ${cow.section?.name}`}>
                                    {cow.section?.zone?.name || 'Kandang'} / {cow.section?.name || 'Section'}
                                </p>
                            </div>
                        </div>

                        {/* Nutrition Summary (Quick View) */}
                        <div className="mb-3 bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-100 dark:border-amber-900/20">
                            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-1.5">
                                <span>Target BK: <strong className="text-amber-700 dark:text-amber-500">{(cow.weight * ((cow.targetBkPercent ?? 2.5) / 100)).toFixed(2)} kg</strong></span>
                                <span>As-Fed: <strong className="text-amber-700 dark:text-amber-500">{(((cow.weight * ((cow.targetBkPercent ?? 2.5) / 100)) * ((cow.forageRatio ?? 60) / 100)) / ((cow.forageDM ?? 20) / 100) + ((cow.weight * ((cow.targetBkPercent ?? 2.5) / 100)) * ((cow.concentrateRatio ?? 40) / 100)) / ((cow.concentrateDM ?? 86) / 100)).toFixed(2)} kg</strong></span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-amber-100/50 dark:border-amber-900/10 text-slate-600 dark:text-slate-400">
                                <span>Pemberian Pakan: <strong className="text-indigo-700 dark:text-indigo-400">{cow.fedCountToday ?? 0} / {cow.feedingFrequency ?? 2} Kali</strong></span>
                                {(cow.fedCountToday ?? 0) >= (cow.feedingFrequency ?? 2) ? (
                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full text-[9px] border border-green-200 dark:border-green-800/30">
                                        <span>✅</span> Selesai
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-bold">Belum Selesai</span>
                                )}
                            </div>
                        </div>

                        {/* Always Visible Actions */}
                        <div className="mb-2">
                            <button onClick={() => openNutritionConfig(cow)} className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 transition flex items-center justify-center gap-1 shadow-sm">
                                ⚙️ Parameter Target Nutrisi
                            </button>
                        </div>

                        {/* Hidden Actions (Hover to reveal sensors & edit) */}
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-2 hidden group-hover:flex items-center justify-between transition-all">
                            <div className="flex gap-1.5">
                                <button 
                                    onClick={() => openChartModal(cow.id)} 
                                    className={`flex items-center gap-1 px-1.5 py-1 rounded transition ${getVitalStatus('temp', cow.temp) === 'danger' ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`} 
                                    title={getVitalStatus('temp', cow.temp) === 'danger' ? 'PERINGATAN: Suhu tidak normal!' : 'Lihat Grafik Suhu'}
                                >
                                    🌡️ <span className="text-xs font-bold">{cow.temp > 0 ? `${cow.temp}°C` : '--'}</span>
                                </button>
                                <button 
                                    onClick={() => openChartModal(cow.id)} 
                                    className={`flex items-center gap-1 px-1.5 py-1 rounded transition ${getVitalStatus('heartRate', cow.heartRate) === 'danger' ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`} 
                                    title={getVitalStatus('heartRate', cow.heartRate) === 'danger' ? 'PERINGATAN: Detak jantung tidak normal!' : 'Lihat Grafik EKG'}
                                >
                                    ❤️ <span className="text-xs font-bold">{cow.heartRate > 0 ? cow.heartRate : '--'}</span>
                                </button>
                            </div>
                            <div className="flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditCow(cow)} className="p-1 text-slate-400 hover:text-blue-500 transition" title="Edit Sapi">✏️</button>
                                <button onClick={() => handleDelete(cow.id)} className="p-1 text-slate-400 hover:text-red-500 transition" title="Hapus">🗑️</button>
                            </div>
                        </div>
                        
                        {/* Warning Label */}
                        {(getVitalStatus('temp', cow.temp) === 'danger' || getVitalStatus('heartRate', cow.heartRate) === 'danger') && (
                            <div className="mt-3 py-1 px-3 bg-red-600 text-white text-[10px] font-black rounded-lg text-center uppercase tracking-widest animate-bounce">
                                ⚠️ Bahaya: Kondisi Kritis
                            </div>
                        )}
                    </div>
                ))}
            </div>
            )}

            {/* --- MODAL TAMBAH/EDIT SAPI --- */}
            {showCowModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCowModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-xl">{cowFormData.id ? 'Edit Data Sapi' : 'Tambah Sapi Baru'}</h3>
                            <button onClick={() => setShowCowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>
                        <form onSubmit={handleSaveCow} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">ID RFID Sapi</label>
                                    <input required type="text" value={cowFormData.cattleId} onChange={e=>setCowFormData({...cowFormData, cattleId: e.target.value})} disabled={!!cowFormData.id} className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Jenis / Breed</label>
                                    <input required type="text" value={cowFormData.breed} onChange={e=>setCowFormData({...cowFormData, breed: e.target.value})} className="w-full p-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Berat (Kg)</label>
                                    <input required type="number" step="0.1" value={cowFormData.initialWeight} onChange={e=>setCowFormData({...cowFormData, initialWeight: e.target.value})} className="w-full p-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status Kesehatan</label>
                                    <select value={cowFormData.status} onChange={e=>setCowFormData({...cowFormData, status: e.target.value})} className="w-full p-2 border rounded-lg">
                                        <option value="SEHAT">Sehat</option>
                                        <option value="SAKIT">Sakit</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Jenis Kelamin</label>
                                    <select value={cowFormData.gender} onChange={e=>setCowFormData({...cowFormData, gender: e.target.value})} className="w-full p-2 border rounded-lg">
                                        <option value="Jantan">Jantan</option>
                                        <option value="Betina">Betina</option>
                                    </select>
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Pilih Kandang</label>
                                        <select 
                                            value={formSelectedZoneId} 
                                            onChange={e => setFormSelectedZoneId(e.target.value)} 
                                            className="w-full p-2 border rounded-lg"
                                            required
                                        >
                                            <option value="">-- Pilih Kandang --</option>
                                            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Pilih Section</label>
                                        <select 
                                            value={cowFormData.sectionId || ''} 
                                            onChange={e => setCowFormData({...cowFormData, sectionId: e.target.value})} 
                                            className="w-full p-2 border rounded-lg"
                                            required
                                            disabled={!formSelectedZoneId}
                                        >
                                            <option value="">-- Pilih Section --</option>
                                            {zones.find(z => z.id == formSelectedZoneId)?.sections.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowCowModal(false)} className="px-4 py-2 border rounded-lg text-slate-600 font-medium">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium shadow-lg hover:bg-primary-700">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL MANAJEMEN LIMBAH --- */}
            {showWasteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" onClick={() => { setShowWasteModal(false); setWasteZoneFilter('ALL'); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/10">
                            <div className="flex items-center gap-2.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M11 21a8 8 0 0 0 8-8v-2H5v2a8 8 0 0 0 8 8Z"/><path d="M12 11v4"/></svg>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Manajemen Limbah</h3>
                            </div>
                            <button onClick={() => { setShowWasteModal(false); setWasteZoneFilter('ALL'); }} className="text-slate-400 hover:text-slate-650 text-2xl font-bold">×</button>
                        </div>

                        <div className="p-4">
                            <form onSubmit={handleManualWaste} className="space-y-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Pilih Kandang</label>
                                    <select
                                        required
                                        value={selectedWasteZone}
                                        onChange={(e) => setSelectedWasteZone(e.target.value)}
                                        className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-primary-500 outline-none transition"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.map(z => (
                                            <option key={z.id} value={z.id}>🏢 {z.name.replace(/ZONA/gi, 'Kandang')}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">Pencatatan limbah kolektif per Kandang (feces dan urine yang dibersihkan dari seluruh area kandang).</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 bg-amber-50/40 dark:bg-slate-900/30 p-3 rounded-xl border border-amber-100/40 dark:border-slate-700">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Feses (Kg)</label>
                                        <input required type="number" step="0.1" placeholder="Contoh: 5.2" value={manualWaste.fecesKg} onChange={e=>setManualWaste({...manualWaste, fecesKg: e.target.value})} className="w-full p-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-xs" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Urine (Liter)</label>
                                        <input required type="number" step="0.1" placeholder="Contoh: 3.5" value={manualWaste.urineL} onChange={e=>setManualWaste({...manualWaste, urineL: e.target.value})} className="w-full p-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-xs" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition">Simpan Input Limbah</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL KELOLA KANDANG --- */}
            {showZoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowZoneModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-xl">Kelola Kandang / Barn Section</h3>
                            <button onClick={() => setShowZoneModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>
                        <div className="p-5">
                            <form onSubmit={handleAddZone} className="flex gap-2 mb-6">
                                <input 
                                    type="text" 
                                    placeholder="Contoh: Kandang A" 
                                    value={newZoneName}
                                    onChange={(e) => setNewZoneName(e.target.value)}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none"
                                    required
                                />
                                <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold transition">Tambah</button>
                            </form>

                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                {zones.map(z => (
                                    <div key={z.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{z.name}</span>
                                            <button onClick={() => handleDeleteZone(z.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">Hapus Kandang</button>
                                        </div>
                                        
                                        {/* Sections List */}
                                        <div className="ml-4 space-y-2 mb-3 border-l-2 border-slate-200 dark:border-slate-600 pl-4">
                                            {z.sections.map(s => (
                                                <div key={s.id} className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600 dark:text-slate-300 font-medium">📍 {s.name}</span>
                                                    <button onClick={() => handleDeleteSection(s.id)} className="text-slate-400 hover:text-red-500 font-bold">×</button>
                                                </div>
                                            ))}
                                            {z.sections.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada section</p>}
                                        </div>

                                        {/* Add Section Form */}
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Nama Section Baru..." 
                                                value={manageSelectedZoneId === z.id ? newSectionName : ''}
                                                onFocus={() => setManageSelectedZoneId(z.id)}
                                                onChange={(e) => setNewSectionName(e.target.value)}
                                                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 outline-none"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => handleAddSection(z.id)}
                                                className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 px-3 py-1.5 text-xs rounded-md font-bold"
                                            >
                                                + Section
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {zones.length === 0 && <p className="text-center text-slate-500 py-4">Belum ada kandang yang ditambahkan.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL GRAFIK KESEHATAN (EKG) --- */}
            {showChartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => { setShowChartModal(false); setActiveChartCow(null); }}>
                    <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-xl text-white">Grafik Vital Sign Real-time</h3>
                                <p className="text-slate-400 text-sm">ID Sapi: <span className="text-primary-400 font-bold">{activeChartCow}</span> (Live dari Sensor IoT)</p>
                            </div>
                            <button onClick={() => { setShowChartModal(false); setActiveChartCow(null); }} className="text-slate-400 hover:text-white text-3xl font-light">×</button>
                        </div>
                        
                        <div className="p-6">
                            {/* Chart Heart Rate */}
                            <div className="h-48 w-full mb-8">
                                <h4 className="text-rose-400 text-sm font-bold mb-2 flex items-center gap-2">❤️ Detak Jantung (BPM)</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="time" stroke="#64748b" fontSize={12} tick={{fill: '#64748b'}} />
                                        <YAxis stroke="#64748b" fontSize={12} domain={['dataMin - 10', 'dataMax + 10']} tick={{fill: '#64748b'}} />
                                        <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff'}} itemStyle={{color: '#fb7185'}} />
                                        <Line type="monotone" dataKey="heartRate" stroke="#fb7185" strokeWidth={3} dot={false} isAnimationActive={false} />
                                        <Brush dataKey="time" height={20} stroke="#334155" fill="#0f172a" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chart Body Temp */}
                            <div className="h-48 w-full">
                                <h4 className="text-orange-400 text-sm font-bold mb-2 flex items-center gap-2">🌡️ Suhu Tubuh (°C)</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="time" stroke="#64748b" fontSize={12} tick={{fill: '#64748b'}} />
                                        <YAxis stroke="#64748b" fontSize={12} domain={[35, 45]} tick={{fill: '#64748b'}} />
                                        <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff'}} itemStyle={{color: '#fb923c'}} />
                                        <Line type="monotone" dataKey="temp" stroke="#fb923c" strokeWidth={3} dot={false} isAnimationActive={false} />
                                        <Brush dataKey="time" height={20} stroke="#334155" fill="#0f172a" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- MODAL DETAIL SAPI --- */}
            {showDetailModal && selectedCow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDetailModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 animate-fade-in-up max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="relative h-32 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-t-3xl overflow-hidden">
                            <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 z-20 text-white hover:bg-white/20 rounded-full p-1 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div className="px-8 pb-8 -mt-12 relative z-10">
                            <div className="flex flex-col items-center text-center">
                                <div className="h-24 w-24 rounded-full bg-white dark:bg-slate-700 border-4 border-white dark:border-slate-800 flex items-center justify-center text-4xl shadow-lg mb-4 z-20 overflow-visible">
                                    <span className="block transform scale-125">🐮</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{selectedCow.id}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${selectedCow.status === 'SEHAT' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                        {selectedCow.status}
                                    </span>
                                    <span className="text-slate-400 text-xs">•</span>
                                    <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest">{selectedCow.breed}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 mt-8">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Informasi Dasar</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Gender</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCow.gender}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Berat Awal</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCow.weight} kg</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Kebutuhan Nutrisi</p>
                                        <button onClick={() => setShowNutritionConfig(!showNutritionConfig)} className="text-[10px] text-primary-600 font-bold hover:underline">
                                            {showNutritionConfig ? 'Batal' : 'Pengaturan Manual'}
                                        </button>
                                    </div>
                                    
                                    {showNutritionConfig ? (
                                        <form onSubmit={handleSaveNutritionPrefs} className="space-y-3 mt-3 animate-fade-in text-xs border-t border-slate-200 dark:border-slate-700 pt-3">
                                            {/* Metode Pemberian Pakan */}
                                            <div>
                                                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Metode Pemberian Pakan</label>
                                                <select
                                                    value={feedingMethod}
                                                    onChange={(e) => {
                                                        const method = e.target.value;
                                                        setFeedingMethod(method);
                                                        if (method === 'HIJAUAN_SAJA') {
                                                            setNutritionPrefsForm({
                                                                ...nutritionPrefsForm,
                                                                forageRatio: 100,
                                                                concentrateRatio: 0
                                                            });
                                                        } else if (method === 'KONSENTRAT_SAJA') {
                                                            setNutritionPrefsForm({
                                                                ...nutritionPrefsForm,
                                                                forageRatio: 0,
                                                                concentrateRatio: 100
                                                            });
                                                        } else if (method === 'TMR') {
                                                            setNutritionPrefsForm({
                                                                ...nutritionPrefsForm,
                                                                forageRatio: 100,
                                                                concentrateRatio: 999,
                                                                forageDM: 50 // Default TMR DM
                                                            });
                                                        } else {
                                                            // Campuran
                                                            setNutritionPrefsForm({
                                                                ...nutritionPrefsForm,
                                                                forageRatio: 60,
                                                                concentrateRatio: 40
                                                            });
                                                        }
                                                    }}
                                                    className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 rounded-md dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold"
                                                >
                                                    <option value="CAMPURAN">Campuran (Hijauan + Konsentrat)</option>
                                                    <option value="HIJAUAN_SAJA">Hanya Hijauan Saja</option>
                                                    <option value="KONSENTRAT_SAJA">Hanya Konsentrat Saja</option>
                                                    <option value="TMR">TMR (Total Mixed Ration)</option>
                                                </select>
                                            </div>

                                            {/* Target BK */}
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Target Nutrisi</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Kebutuhan Bahan Kering (BK)</label>
                                                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                            <input type="number" step="0.1" value={nutritionPrefsForm.targetBkPercent} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, targetBkPercent: parseFloat(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                            <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold text-[10px] whitespace-nowrap">% dari Bobot</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Frekuensi Makan</label>
                                                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                            <input type="number" min="1" max="10" value={nutritionPrefsForm.feedingFrequency ?? 2} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, feedingFrequency: parseInt(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                            <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold text-[10px] whitespace-nowrap">Kali / Hari</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pembagian Porsi */}
                                            {feedingMethod === 'CAMPURAN' && (
                                                <div>
                                                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">⚖️ Proporsi (Rasio)</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">Hijauan</label>
                                                            <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                                <input type="number" value={nutritionPrefsForm.forageRatio} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, forageRatio: parseFloat(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                                <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">Konsentrat</label>
                                                            <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                                <input type="number" value={nutritionPrefsForm.concentrateRatio} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, concentrateRatio: parseFloat(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                                <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Kandungan Air (Dry Matter) */}
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                                                    {feedingMethod === 'TMR' ? '💧 Kualitas TMR' : '💧 Kualitas (Kandungan BK)'}
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {feedingMethod !== 'KONSENTRAT_SAJA' && (
                                                        <div className={feedingMethod !== 'CAMPURAN' ? 'col-span-2' : ''}>
                                                            <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">
                                                                {feedingMethod === 'TMR' ? 'Bahan Kering TMR' : 'Hijauan'}
                                                            </label>
                                                            <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                                <input title="Persentase Bahan Kering murni" type="number" step="0.1" value={nutritionPrefsForm.forageDM} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, forageDM: parseFloat(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                                <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {feedingMethod !== 'HIJAUAN_SAJA' && feedingMethod !== 'TMR' && (
                                                        <div className={feedingMethod !== 'CAMPURAN' ? 'col-span-2' : ''}>
                                                            <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">Konsentrat</label>
                                                            <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                                <input title="Persentase Bahan Kering murni" type="number" step="0.1" value={nutritionPrefsForm.concentrateDM} onChange={(e) => setNutritionPrefsForm({...nutritionPrefsForm, concentrateDM: parseFloat(e.target.value)})} className="w-full p-1.5 outline-none text-center font-bold bg-transparent text-slate-700 dark:text-slate-200" />
                                                                <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1.5 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <button type="submit" className="w-full bg-primary-600 text-white font-bold py-2 rounded-lg hover:bg-primary-700 transition mt-2">💾 Simpan Parameter</button>
                                        </form>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500">Kebutuhan BK / Hari</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{feedNeeds ? feedNeeds.bkRequirement.toFixed(2) : '-'} kg</span>
                                            </div>
                                            
                                            {feedNeeds?.prefs?.concentrateRatio === 999 ? (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">As-Fed (TMR @ {feedNeeds?.prefs?.forageDM || 50}% BK)</span>
                                                        <span className="font-bold text-green-600 dark:text-green-400">{feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-bold">Total As-Fed (TMR)</span>
                                                        <span className="font-black text-slate-800 dark:text-white">{feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                </>
                                            ) : feedNeeds?.prefs?.concentrateRatio === 0 ? (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">As-Fed (100% Hijauan @ {feedNeeds?.prefs?.forageDM || 20}% BK)</span>
                                                        <span className="font-bold text-green-600 dark:text-green-400">{feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-bold">Total As-Fed (Hijauan)</span>
                                                        <span className="font-black text-slate-800 dark:text-white">{feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                </>
                                            ) : feedNeeds?.prefs?.forageRatio === 0 ? (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">As-Fed (100% Konsentrat @ {feedNeeds?.prefs?.concentrateDM || 86}% BK)</span>
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">{feedNeeds ? feedNeeds.suggestedConcentrateAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-bold">Total As-Fed (Konsentrat)</span>
                                                        <span className="font-black text-slate-800 dark:text-white">{feedNeeds ? feedNeeds.suggestedConcentrateAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">As-Fed ({feedNeeds?.prefs?.forageRatio || 60}% Hijauan)</span>
                                                        <span className="font-bold text-green-600 dark:text-green-400">{feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">As-Fed ({feedNeeds?.prefs?.concentrateRatio || 40}% Konsentrat)</span>
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">{feedNeeds ? feedNeeds.suggestedConcentrateAsFed.toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">Total As-Fed (Campuran)</span>
                                                        <span className="font-black text-slate-800 dark:text-white">{feedNeeds ? (feedNeeds.suggestedForageAsFed + feedNeeds.suggestedConcentrateAsFed).toFixed(2) : '-'} kg</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* --- RIWAYAT KESEHATAN SAPI --- */}
                                {(() => {
                                    const cowHealthRecords = healthRecords.filter(r => r.cattleId === selectedCow.id);
                                    return (
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Riwayat Kesehatan ({cowHealthRecords.length})</p>
                                            {cowHealthRecords.length === 0 ? (
                                                <p className="text-xs text-slate-500 italic py-1">Belum ada riwayat pemeriksaan medis.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {cowHealthRecords.slice(0, healthRecordsLimit).map((record, index) => (
                                                        <div key={record.id || index} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs shadow-sm space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-slate-800 dark:text-slate-200">{record.diagnosa || record.diagnosis || '-'}</span>
                                                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${
                                                                    record.status === 'SEMBUH' || record.status === 'Sembuh' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                    record.status === 'KRITIS' || record.status === 'Kritis' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                    record.status === 'MATI' || record.status === 'Mati' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' :
                                                                    'bg-orange-50 text-orange-700 border-orange-200'
                                                                }`}>
                                                                    {record.status === 'DALAM_PERAWATAN' ? 'DALAM PERAWATAN' : record.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-650 dark:text-slate-300">Penanganan: {record.penanganan || record.treatment || '-'}</p>
                                                            <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-700/50 mt-1">
                                                                <span>Pemeriksa: {record.pemeriksa || record.vet || '-'}</span>
                                                                <span>{record.createdAt ? new Date(record.createdAt).toLocaleDateString('id-ID') : '-'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    
                                                    {cowHealthRecords.length > 5 && (
                                                        <div className="text-center pt-1">
                                                            {healthRecordsLimit === 5 ? (
                                                                <button 
                                                                    onClick={() => setHealthRecordsLimit(10)} 
                                                                    className="text-[11px] text-primary-600 font-bold hover:underline"
                                                                >
                                                                    Lihat Lebih Banyak (Hingga 10) 👇
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => setHealthRecordsLimit(5)} 
                                                                    className="text-[11px] text-primary-600 font-bold hover:underline"
                                                                >
                                                                    Sembunyikan 👆
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button 
                                    onClick={() => { setShowDetailModal(false); setShowNutritionModal(true); }}
                                    className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition"
                                >
                                    ⚖️ Timbang & Pakan
                                </button>
                                <button 
                                    onClick={() => { setShowDetailModal(false); openEditCow(selectedCow); }}
                                    className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold hover:bg-slate-200 transition"
                                >
                                    Edit Data
                                </button>
                                <button 
                                    onClick={() => { setShowDetailModal(false); openChartModal(selectedCow.id); }}
                                    className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition"
                                >
                                    Cek Vital
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL NUTRITION (TIMBANG & PAKAN) --- */}
            {showNutritionModal && selectedCow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowNutritionModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-xl">Nutrisi & Pertumbuhan</h3>
                            <button onClick={() => { setShowNutritionModal(false); setShowDetailModal(true); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        </div>
                        
                        <div className="p-5 space-y-6">
                            {/* Form Timbang */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2">⚖️ Catat Berat Badan Sapi</h4>
                                <form onSubmit={handleRecordWeight} className="flex gap-2 flex-wrap">
                                    <input 
                                        type="date" required 
                                        value={weightDateInput} onChange={e => setWeightDateInput(e.target.value)}
                                        className="flex-[1] min-w-[120px] p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300"
                                    />
                                    <input 
                                        type="number" step="0.1" required placeholder="Berat saat ini (kg)" 
                                        value={weightInput} onChange={e => setWeightInput(e.target.value)}
                                        className="flex-[2] min-w-[130px] p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 text-sm" 
                                    />
                                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-md w-full sm:w-auto mt-2 sm:mt-0">Simpan</button>
                                </form>
                            </div>

                            {/* Form Pakan */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-2">🌾 Catat Pakan As-Fed</h4>
                                {feedNeeds && (() => {
                                    const feedType = feedInput.feedType;
                                    const concentrateRatio = feedNeeds.prefs?.concentrateRatio ?? 40;
                                    const forageRatio = feedNeeds.prefs?.forageRatio ?? 60;
                                    
                                    let targetBk = 0;
                                    let targetAsFed = 0;
                                    let label = feedType;
                                    let isWarning = false;

                                    if (concentrateRatio === 999) {
                                        if (feedType === 'Tmr') {
                                            targetBk = feedNeeds.bkRequirement;
                                            targetAsFed = feedNeeds.suggestedForageAsFed;
                                            label = 'TMR';
                                        } else {
                                            isWarning = true;
                                            label = `${feedType} (Sapi di-set TMR)`;
                                        }
                                    } else if (concentrateRatio === 0) {
                                        if (feedType === 'Hijauan') {
                                            targetBk = feedNeeds.bkRequirement;
                                            targetAsFed = feedNeeds.suggestedForageAsFed;
                                            label = 'Hijauan';
                                        } else {
                                            isWarning = true;
                                            label = `${feedType} (Sapi di-set Hijauan Saja)`;
                                        }
                                    } else if (forageRatio === 0) {
                                        if (feedType === 'Konsentrat') {
                                            targetBk = feedNeeds.bkRequirement;
                                            targetAsFed = feedNeeds.suggestedConcentrateAsFed;
                                            label = 'Konsentrat';
                                        } else {
                                            isWarning = true;
                                            label = `${feedType} (Sapi di-set Konsentrat Saja)`;
                                        }
                                    } else {
                                        if (feedType === 'Hijauan') {
                                            targetBk = feedNeeds.bkRequirement * (forageRatio / 100);
                                            targetAsFed = feedNeeds.suggestedForageAsFed;
                                            label = 'Hijauan';
                                        } else if (feedType === 'Konsentrat') {
                                            targetBk = feedNeeds.bkRequirement * (concentrateRatio / 100);
                                            targetAsFed = feedNeeds.suggestedConcentrateAsFed;
                                            label = 'Konsentrat';
                                        } else if (['Konsentrat+hijauan', 'Konsentrat+hijauan+vitamin', 'Tmr'].includes(feedType)) {
                                            targetBk = feedNeeds.bkRequirement;
                                            targetAsFed = feedNeeds.suggestedForageAsFed + feedNeeds.suggestedConcentrateAsFed;
                                            label = 'Total Campuran';
                                        }
                                    }
                                    
                                    const feedGoal = feedNeeds.feedGoal || 1;
                                    const singleAsFed = targetAsFed / feedGoal;
                                    
                                    return (
                                        <div className={`mb-3 p-3 rounded-xl text-xs flex flex-col gap-2 border shadow-sm ${
                                            isWarning 
                                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30' 
                                            : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50'
                                        }`}>
                                            <div className="flex justify-between items-center">
                                                <span className={`font-semibold ${isWarning ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {isWarning ? '⚠️ ' : '💡 '} Rekomendasi ({label}):
                                                </span>
                                                <span className={`font-bold ${isWarning ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                                    BK: {targetBk.toFixed(2)} kg
                                                </span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center pt-2 border-t border-amber-100/50 dark:border-amber-900/30">
                                                <span className="text-slate-500">Rekomendasi 1x Makan:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setFeedInput({ ...feedInput, weightKg: singleAsFed.toFixed(1) })}
                                                    className="font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-350 text-sm bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 px-2 py-0.5 rounded-lg transition border border-emerald-200/40 dark:border-emerald-900/40"
                                                    title="Klik untuk isi otomatis"
                                                >
                                                    🎯 {singleAsFed.toFixed(2)} kg
                                                </button>
                                            </div>

                                            {feedGoal > 1 && (
                                                <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
                                                    <span>Total Harian (As-Fed):</span>
                                                    <span>{targetAsFed.toFixed(2)} kg (Dibagi {feedGoal}x pakan)</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                <form onSubmit={handleRecordFeed} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Jenis Pakan</label>
                                        <select 
                                            value={feedInput.feedType} 
                                            onChange={e => setFeedInput({...feedInput, feedType: e.target.value})} 
                                            className="w-full p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                                        >
                                            <option value="Hijauan">Hijauan</option>
                                            <option value="Konsentrat">Konsentrat</option>
                                            <option value="Konsentrat+hijauan">Konsentrat+hijauan</option>
                                            <option value="Konsentrat+hijauan+vitamin">Konsentrat+hijauan+vitamin</option>
                                            <option value="Tmr">Tmr</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Berat Diberikan (As-Fed dalam Kg)</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number" step="0.1" required placeholder="Contoh: 15.5" 
                                                value={feedInput.weightKg} onChange={e => setFeedInput({...feedInput, weightKg: e.target.value})}
                                                className="flex-1 p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600" 
                                            />
                                            <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">Simpan Pakan</button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- MODAL BULK TIMBANG --- */}
            {showBulkWeightModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" onClick={() => { setShowBulkWeightModal(false); setWeightZoneFilter('ALL'); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-sky-50 dark:bg-sky-950/15">
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">⚖️</span>
                                <h3 className="font-bold text-lg text-sky-900 dark:text-sky-100">Timbang Berat Kelompok</h3>
                            </div>
                            <button onClick={() => { setShowBulkWeightModal(false); setWeightZoneFilter('ALL'); }} className="text-slate-400 hover:text-slate-650 text-2xl font-bold">×</button>
                        </div>
                        <div className="p-4">
                            <form onSubmit={handleBulkWeightSubmit} className="space-y-3.5">
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Pilih Sapi</label>
                                        <div className="space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const filteredIds = cows.filter(c => weightZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(weightZoneFilter)).map(c => c.id);
                                                    setSelectedFeedWeightCows(Array.from(new Set([...selectedFeedWeightCows, ...filteredIds])));
                                                }} 
                                                className="text-xs text-sky-700 font-bold hover:underline"
                                            >
                                                Pilih Semua
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const filteredIds = cows.filter(c => weightZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(weightZoneFilter)).map(c => c.id);
                                                    setSelectedFeedWeightCows(selectedFeedWeightCows.filter(id => !filteredIds.includes(id)));
                                                }} 
                                                className="text-xs text-slate-500 font-medium hover:underline"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>

                                    {/* Kandang Filter Dropdown */}
                                    <div className="mb-2">
                                        <select
                                            value={weightZoneFilter}
                                            onChange={(e) => setWeightZoneFilter(e.target.value)}
                                            className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 bg-slate-50 text-slate-750 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-sky-500 outline-none transition"
                                        >
                                            <option value="ALL">📍 Semua Kandang</option>
                                            {zones.map(z => (
                                                <option key={z.id} value={z.id}>📍 {z.name.replace(/ZONA/gi, 'Kandang')}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-slate-50 dark:bg-slate-900 space-y-0.5 custom-scrollbar">
                                        {(() => {
                                            const filtered = cows.filter(c => weightZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(weightZoneFilter));
                                            if (filtered.length === 0) {
                                                return <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada sapi di kandang ini</p>;
                                            }
                                            return filtered.map(c => (
                                                <label key={c.id} className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-md cursor-pointer transition">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedFeedWeightCows.includes(c.id)} 
                                                        onChange={(e) => { 
                                                            if (e.target.checked) setSelectedFeedWeightCows([...selectedFeedWeightCows, c.id]); 
                                                            else setSelectedFeedWeightCows(selectedFeedWeightCows.filter(id => id !== c.id)); 
                                                        }} 
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700" 
                                                    />
                                                    <div className="flex-1 flex justify-between items-center pr-1">
                                                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{c.id}</span>
                                                        <span className="text-[10px] text-slate-500">{(c.section?.zone?.name || '').replace(/ZONA/gi, 'Kandang')} / {c.section?.name || '-'}</span>
                                                    </div>
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{selectedFeedWeightCows.length} sapi terpilih</p>
                                </div>
                                <div className="bg-sky-50/50 dark:bg-slate-900/30 p-3 rounded-xl border border-sky-100/50 dark:border-slate-700 space-y-2">
                                    <h4 className="font-bold text-sky-900 dark:text-sky-200 text-xs flex items-center gap-1">⚖️ Berat Badan Sapi (Kg)</h4>
                                    <input type="number" step="0.1" required placeholder="Contoh: 350.5" value={bulkWeight} onChange={e => setBulkWeight(e.target.value)} className="w-full p-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-xs" />
                                </div>
                                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition">Simpan Timbang Kelompok</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL BULK PAKAN --- */}
            {showBulkFeedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" onClick={() => { setShowBulkFeedModal(false); setFeedZoneFilter('ALL'); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/15">
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">🌾</span>
                                <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100">Pakan Kelompok</h3>
                            </div>
                            <button onClick={() => { setShowBulkFeedModal(false); setFeedZoneFilter('ALL'); }} className="text-slate-400 hover:text-slate-650 text-2xl font-bold">×</button>
                        </div>
                        <div className="p-4">
                            <form onSubmit={handleBulkFeedSubmit} className="space-y-3.5">
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Pilih Sapi</label>
                                        <div className="space-x-2">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const filteredIds = cows.filter(c => feedZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(feedZoneFilter)).map(c => c.id);
                                                    setSelectedFeedWeightCows(Array.from(new Set([...selectedFeedWeightCows, ...filteredIds])));
                                                }} 
                                                className="text-xs text-emerald-700 font-bold hover:underline"
                                            >
                                                Pilih Semua
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const filteredIds = cows.filter(c => feedZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(feedZoneFilter)).map(c => c.id);
                                                    setSelectedFeedWeightCows(selectedFeedWeightCows.filter(id => !filteredIds.includes(id)));
                                                }} 
                                                className="text-xs text-slate-500 font-medium hover:underline"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>

                                    {/* Kandang Filter Dropdown */}
                                    <div className="mb-2">
                                        <select
                                            value={feedZoneFilter}
                                            onChange={(e) => setFeedZoneFilter(e.target.value)}
                                            className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 bg-slate-50 text-slate-750 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-emerald-500 outline-none transition"
                                        >
                                            <option value="ALL">📍 Semua Kandang</option>
                                            {zones.map(z => (
                                                <option key={z.id} value={z.id}>📍 {z.name.replace(/ZONA/gi, 'Kandang')}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-slate-50 dark:bg-slate-900 space-y-0.5 custom-scrollbar">
                                        {(() => {
                                            const filtered = cows.filter(c => feedZoneFilter === 'ALL' || c.section?.zone?.id === parseInt(feedZoneFilter));
                                            if (filtered.length === 0) {
                                                return <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada sapi di kandang ini</p>;
                                            }
                                            return filtered.map(c => (
                                                <label key={c.id} className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-md cursor-pointer transition">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedFeedWeightCows.includes(c.id)} 
                                                        onChange={(e) => { 
                                                            if (e.target.checked) setSelectedFeedWeightCows([...selectedFeedWeightCows, c.id]); 
                                                            else setSelectedFeedWeightCows(selectedFeedWeightCows.filter(id => id !== c.id)); 
                                                        }} 
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700" 
                                                    />
                                                    <div className="flex-1 flex justify-between items-center pr-1">
                                                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{c.id}</span>
                                                        <span className="text-[10px] text-slate-500">{(c.section?.zone?.name || '').replace(/ZONA/gi, 'Kandang')} / {c.section?.name || '-'}</span>
                                                    </div>
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{selectedFeedWeightCows.length} sapi terpilih</p>
                                </div>

                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">🌾 Input Pemberian Pakan</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-emerald-800 mb-1">Jenis Pakan</label>
                                            <select value={bulkFeed.feedType} onChange={e => setBulkFeed({...bulkFeed, feedType: e.target.value})} className="w-full p-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-600 bg-white">
                                                <option value="Hijauan">Hijauan</option>
                                                <option value="Konsentrat">Konsentrat</option>
                                                <option value="Konsentrat+hijauan">Konsentrat+Hijauan</option>
                                                <option value="Tmr">TMR</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-emerald-800 mb-1">Berat As-Fed (Kg)</label>
                                            <input type="number" step="0.1" placeholder="Contoh: 12.5" value={bulkFeed.weightKg} onChange={e => setBulkFeed({...bulkFeed, weightKg: e.target.value})} className="w-full p-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-600 bg-white" />
                                        </div>
                                    </div>

                                    {/* Advanced Group Nutrition Recommendations Card */}
                                    {selectedFeedWeightCows.length > 0 && (() => {
                                        const recs = calculateGroupRecommendations();
                                        const feedType = bulkFeed.feedType;
                                        const bkPct = getBulkFeedBkPercent(feedType);
                                        const asFedInputVal = parseFloat(bulkFeed.weightKg || '0');
                                        const totalInputAsFed = asFedInputVal * selectedFeedWeightCows.length;
                                        const totalInputBk = totalInputAsFed * (bkPct / 100);

                                        // Hitung rekomendasi berdasarkan jenis pakan terpilih
                                        let selectedRecTotal = 0;
                                        let labelRec = '';
                                        
                                        if (feedType === 'Hijauan') {
                                            selectedRecTotal = recs.totalForageAsFed;
                                            labelRec = 'Rekomendasi Hijauan';
                                        } else if (feedType === 'Konsentrat') {
                                            selectedRecTotal = recs.totalConcentrateAsFed;
                                            labelRec = 'Rekomendasi Konsentrat';
                                        } else if (feedType === 'Tmr') {
                                            selectedRecTotal = recs.totalTmrAsFed;
                                            labelRec = 'Rekomendasi TMR';
                                        } else if (feedType === 'Konsentrat+hijauan') {
                                            selectedRecTotal = recs.totalForageAsFed + recs.totalConcentrateAsFed;
                                            labelRec = 'Rekomendasi Campuran (Hijauan + Konsentrat)';
                                        }

                                        const recPerCow = selectedRecTotal / selectedFeedWeightCows.length;
                                        const recPerCowSession = recPerCow / feedGoal;

                                        return (
                                            <div className="space-y-3 mt-3">
                                                {/* Card 1: Live Recommendations */}
                                                <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-slate-900/60 dark:to-slate-900/40 rounded-xl border border-indigo-100/70 dark:border-slate-700/80 text-xs space-y-2">
                                                    <div className="flex items-center justify-between pb-1 border-b border-indigo-100 dark:border-slate-700">
                                                        <span className="font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                                            💡 Rekomendasi Nutrisi Kelompok
                                                        </span>
                                                        <span className="bg-indigo-100/80 dark:bg-indigo-950/40 px-2 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-400 rounded-md">
                                                            {selectedFeedWeightCows.length} Sapi
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                                        <div>
                                                            <span className="text-slate-500 block">Total BK Kelompok:</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{recs.totalBk.toFixed(2)} kg BK/hari</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 block">Goal Makan Harian:</span>
                                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{feedGoal}x sehari</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-lg border border-indigo-55/40 dark:border-slate-700/50 space-y-2">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">{labelRec}:</p>
                                                        
                                                        {feedType === 'Konsentrat+hijauan' ? (
                                                            <div className="space-y-1.5 text-[11px]">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-slate-500">Hijauan Harian (Kelompok):</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{recs.totalForageAsFed.toFixed(2)} kg</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-slate-500">Konsentrat Harian (Kelompok):</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{recs.totalConcentrateAsFed.toFixed(2)} kg</span>
                                                                </div>
                                                                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px]">
                                                                    <span className="text-slate-400">Porsi Per Sapi / Makan ({feedGoal}x):</span>
                                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                        Hijauan: {(recs.totalForageAsFed / (selectedFeedWeightCows.length * feedGoal)).toFixed(2)} kg | Kons: {(recs.totalConcentrateAsFed / (selectedFeedWeightCows.length * feedGoal)).toFixed(2)} kg
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1 text-[11px]">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Total Harian (Kelompok):</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRecTotal.toFixed(2)} kg</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Total Harian (Per Sapi):</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{recPerCow.toFixed(2)} kg</span>
                                                                </div>
                                                                {feedGoal > 1 && (
                                                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                        <span>Porsi 1x Makan (Per Sapi):</span>
                                                                        <span>{recPerCowSession.toFixed(2)} kg</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                                                            <button
                                                                type="button"
                                                                onClick={() => setBulkFeed({ ...bulkFeed, weightKg: recPerCow.toFixed(2) })}
                                                                className="flex-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded text-[10px] font-bold border border-indigo-200/40 transition"
                                                            >
                                                                🎯 Gunakan Harian ({recPerCow.toFixed(2)} kg)
                                                            </button>
                                                            {feedGoal > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setBulkFeed({ ...bulkFeed, weightKg: recPerCowSession.toFixed(2) })}
                                                                    className="flex-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-200/40 transition"
                                                                >
                                                                    🎯 Gunakan Porsi 1x ({recPerCowSession.toFixed(2)} kg)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 2: Input Result Info */}
                                                {asFedInputVal > 0 && (
                                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                                        <p className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wide">📊 Estimasi Pencatatan:</p>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">As-Fed Per Cow:</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{asFedInputVal.toFixed(2)} kg</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Kandungan BK ({bkPct}%):</span>
                                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{(asFedInputVal * (bkPct / 100)).toFixed(2)} kg BK/sapi</span>
                                                        </div>
                                                        {selectedFeedWeightCows.length > 1 && (
                                                            <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
                                                                <span className="text-slate-500 font-semibold">Total As-Fed ({selectedFeedWeightCows.length} sapi):</span>
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalInputAsFed.toFixed(2)} kg</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button type="submit" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold shadow-lg transition">Simpan Pakan Kelompok</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Livestock;