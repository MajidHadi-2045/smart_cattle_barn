import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FeatureCard = ({ title, desc, icon }) => {
    const [tilt, setTilt] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        const centerX = box.width / 2;
        const centerY = box.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        setTilt({ x: rotateX, y: rotateY });
    };

    return (
        <div 
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`,
                transition: 'transform 0.15s ease-out'
            }}
            className="min-w-[300px] md:min-w-[380px] snap-center p-10 bg-white rounded-[2.5rem] border border-slate-50 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.15)] transition-all duration-500 cursor-default group"
        >
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mb-8 group-hover:bg-primary-600 group-hover:text-white transition-all duration-500 shadow-sm">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">{title}</h3>
            <p className="text-slate-500 leading-relaxed text-base">
                {desc}
            </p>
        </div>
    );
};

const Typewriter = ({ text, delay = 150 }) => {
    const [currentText, setCurrentText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setCurrentText(prevText => prevText + text[currentIndex]);
                setCurrentIndex(prevIndex => prevIndex + 1);
            }, delay);
            return () => clearTimeout(timeout);
        } else {
            const resetTimeout = setTimeout(() => {
                setCurrentText('');
                setCurrentIndex(0);
            }, 3000);
            return () => clearTimeout(resetTimeout);
        }
    }, [currentIndex, delay, text]);

    return (
        <span className="text-primary-600 border-r-4 border-primary-600 pr-1 animate-pulse">
            {currentText}
        </span>
    );
};

const LandingPage = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [devTilt, setDevTilt] = useState({ x: 0, y: 0 });
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDevMouseMove = (e) => {
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        setDevTilt({ x: (y - (box.height / 2)) / 30, y: ((box.width / 2) - x) / 30 });
    };

    return (
        <div className="font-sans text-slate-900 bg-[#F8FAFC] antialiased scroll-smooth min-h-screen">

            {/* --- NAVBAR --- */}
            <nav className={`fixed w-full z-50 transition-all duration-500 px-4 md:px-8 pt-4 ${scrolled ? 'top-2' : 'top-0'}`}>
                <div className={`max-w-7xl mx-auto rounded-[2rem] transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/20 px-8 py-3' : 'bg-transparent px-0 py-6'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
                                <img src="/logoxl.svg" alt="Logo" className="h-8 w-8" />
                            </div>
                            <span className="text-xl font-bold text-slate-900 tracking-tight text-shadow-sm">Smart Cattle Barn</span>
                        </div>

                        <div className="hidden md:flex items-center space-x-10">
                            <a href="#features" className="text-slate-600 hover:text-primary-600 font-semibold transition text-sm">Fitur</a>
                            <a href="#mobile-app" className="text-slate-600 hover:text-primary-600 font-semibold transition text-sm">Aplikasi</a>
                            <a href="#about-pt" className="text-slate-600 hover:text-primary-600 font-semibold transition text-sm">Tentang</a>
                            <Link to="/public-dashboard" className="text-slate-600 hover:text-primary-600 font-semibold transition text-sm">Dashboard</Link>
                            <Link to="/login" className="px-7 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary-600 transition shadow-lg hover:shadow-primary-500/30 text-sm">
                                Login
                            </Link>
                        </div>

                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-slate-900">
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-24 left-4 right-4 bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col space-y-4 text-center font-bold">
                            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="py-2">Fitur</a>
                            <a href="#mobile-app" onClick={() => setIsMobileMenuOpen(false)} className="py-2">Mobile App</a>
                            <a href="#about-pt" onClick={() => setIsMobileMenuOpen(false)} className="py-2">Tentang</a>
                            <Link to="/public-dashboard" onClick={() => setIsMobileMenuOpen(false)} className="py-4 text-slate-600 border border-slate-200 rounded-2xl">Dashboard</Link>
                            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="py-4 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-primary-600 hover:shadow-primary-500/30 transition">Login</Link>
                        </div>
                    </div>
                )}
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-32 pb-24">
                
                {/* --- HERO SECTION (AS A CARD) --- */}
                <section className="bg-white rounded-[3rem] p-8 md:p-20 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary-50 rounded-full blur-3xl opacity-60"></div>
                    <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                        <div className="text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-primary-100 shadow-sm">
                                <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                                Smart Livestock Ecosystem
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-[1.15] mb-8 tracking-tighter">
                                Kelola Ternak <br />
                                <Typewriter text="Jauh Lebih Cerdas." />
                            </h1>
                            <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                                Efisiensi tanpa batas dengan integrasi IoT. Pantau kesehatan, pakan, dan lingkungan dalam satu genggaman yang terintegrasi penuh.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
                                <Link to="/dashboard" className="px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold hover:bg-primary-600 transition shadow-xl hover:shadow-primary-500/40 flex items-center justify-center gap-3 group">
                                    Mulai Sekarang
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </Link>
                                <a href="#mobile-app" className="px-10 py-5 bg-white text-slate-700 border border-slate-100 rounded-[1.5rem] font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-3">
                                    Unduh Aplikasi
                                </a>
                            </div>
                        </div>

                        <div className="relative hidden lg:block">
                            {/* NEW HIGH-FIDELITY DASHBOARD MOCKUP */}
                            <div className="bg-slate-900 rounded-[2.5rem] p-2.5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-[6px] border-slate-800/50 transform rotate-1 hover:rotate-0 transition-all duration-700">
                                <div className="bg-slate-50 rounded-[2rem] overflow-hidden aspect-[4/3] flex flex-col shadow-inner">
                                    {/* Mock Header */}
                                    <div className="h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                        </div>
                                        <div className="w-32 h-4 bg-slate-100 rounded-full"></div>
                                        <div className="w-4 h-4 bg-slate-200 rounded-full"></div>
                                    </div>
                                    
                                    <div className="flex-1 flex">
                                        {/* Mock Sidebar */}
                                        <div className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6">
                                            <div className="w-8 h-8 bg-primary-600/20 rounded-lg flex items-center justify-center"><div className="w-4 h-4 bg-primary-500 rounded-sm"></div></div>
                                            {[1,2,3,4].map(i => <div key={i} className="w-6 h-1.5 bg-slate-700 rounded-full"></div>)}
                                        </div>
                                        
                                        {/* Mock Main Content */}
                                        <div className="flex-1 p-6 space-y-6 overflow-hidden">
                                            <div className="flex justify-between items-end">
                                                <div className="space-y-2">
                                                    <div className="w-24 h-4 bg-slate-200 rounded"></div>
                                                    <div className="w-40 h-6 bg-slate-300 rounded"></div>
                                                </div>
                                                <div className="w-20 h-8 bg-green-100 rounded-lg border border-green-200 flex items-center justify-center"><div className="w-12 h-2 bg-green-500 rounded"></div></div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-4">
                                                {[1,2,3].map(i => (
                                                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                                                        <div className="w-8 h-8 bg-slate-50 rounded-lg"></div>
                                                        <div className="w-full h-2 bg-slate-100 rounded"></div>
                                                        <div className="w-1/2 h-4 bg-slate-800 rounded"></div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex-1 space-y-4">
                                                <div className="flex justify-between">
                                                    <div className="w-32 h-4 bg-slate-200 rounded"></div>
                                                    <div className="w-16 h-4 bg-slate-100 rounded"></div>
                                                </div>
                                                <div className="flex items-end gap-3 h-24">
                                                    {[40, 70, 45, 90, 65, 30, 80, 50, 60, 40].map((h, i) => (
                                                        <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-primary-500/10 rounded-t-md hover:bg-primary-500 transition-colors group relative">
                                                            {i === 3 && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] p-2 rounded-lg shadow-xl font-bold whitespace-nowrap z-20">Peak: 90%</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Floating Overlay Detail */}
                                <div className="absolute -bottom-6 -right-10 bg-white p-5 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-slate-100 w-52 animate-bounce duration-[4000ms] flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center shrink-0">
                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time</div>
                                        <div className="text-sm font-black text-slate-900">Active Sync</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* --- FEATURES SECTION --- */}
                <section id="features" className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-end px-4 gap-6">
                        <div>
                            <h2 className="text-sm font-bold text-primary-600 tracking-[0.2em] uppercase mb-3">Fitur Utama</h2>
                            <p className="text-3xl font-bold text-slate-900 tracking-tight">Kendalikan segalanya dalam satu sistem.</p>
                        </div>
                        <div className="hidden md:flex gap-3">
                            <button onClick={() => document.getElementById('fs').scrollBy({left: -400, behavior: 'smooth'})} className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-primary-50 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                            </button>
                            <button onClick={() => document.getElementById('fs').scrollBy({left: 400, behavior: 'smooth'})} className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-primary-50 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </div>
                    <div id="fs" className="flex overflow-x-auto gap-8 pb-10 px-4 snap-x snap-mandatory no-scrollbar scroll-smooth">
                        {[
                            { 
                                title: "Pemantauan IoT Real-time", 
                                desc: "Pantau vital sign (suhu tubuh, detak jantung) dan lingkungan (amonia, kelembapan) secara langsung melalui sensor cerdas.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg> 
                            },
                            { 
                                title: "Kalkulator Nutrisi & Pakan", 
                                desc: "Hitung otomatis kebutuhan Bahan Kering (BK) dan proporsi pakan (TMR, Hijauan, Konsentrat) untuk target pertumbuhan optimal.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg> 
                            },
                            { 
                                title: "Rekam Medis & Vaksinasi", 
                                desc: "Catat riwayat penyakit, penanganan, dan lakukan pencatatan vaksinasi massal (Bulk Action) dengan sangat mudah.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg> 
                            },
                            { 
                                title: "Manajemen Limbah", 
                                desc: "Pantau dan kelola akumulasi feses serta urine per kandang untuk menjaga kebersihan dan kesehatan lingkungan ternak.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> 
                            },
                            { 
                                title: "Laporan & Ekspor Otomatis", 
                                desc: "Hasilkan laporan operasional (medis, pakan, limbah) dalam format PDF yang rapi dan siap untuk dicetak.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg> 
                            }
                        ].map((f, i) => <FeatureCard key={i} {...f} />)}
                    </div>
                </section>

                {/* --- MOBILE APP SECTION (AS A CARD) --- */}
                <section id="mobile-app" className="bg-slate-900 rounded-[3rem] p-8 md:p-20 shadow-2xl relative overflow-hidden text-white">
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-primary-600/20 to-transparent"></div>
                    <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 flex justify-center">
                            <div className="w-[260px] h-[520px] bg-slate-950 rounded-[3rem] border-[10px] border-slate-800 shadow-[0_0_100px_rgba(37,99,235,0.2)] overflow-hidden">
                                <div className="h-full w-full bg-white p-6 pt-10">
                                    <div className="w-12 h-12 bg-primary-600 rounded-xl mb-6"></div>
                                    <div className="space-y-4">
                                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                        <div className="h-24 bg-slate-50 rounded-2xl"></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="h-20 bg-slate-50 rounded-xl"></div>
                                            <div className="h-20 bg-slate-50 rounded-xl"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 text-center lg:text-left">
                            <h2 className="text-4xl font-black mb-8 leading-tight">Mobile Application<br/><span className="text-primary-400 font-medium">Dalam Genggaman.</span></h2>
                            <p className="text-lg text-slate-400 mb-12 leading-relaxed max-w-lg mx-auto lg:mx-0">Pantau ternak langsung dari smartphone Anda. Dapatkan notifikasi darurat secara instan.</p>
                            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                                <a href="/smartbarn.apk" download className="bg-slate-800 border border-slate-700 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-700 transition">Unduh APK (Android)</a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- ABOUT PT (AS CARDS) --- */}
                <section id="about-pt" className="grid lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-100 flex flex-col justify-center">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl mb-8">AT</div>
                        <h2 className="text-2xl font-bold mb-4">PT AgriTekno Nusantara</h2>
                        <p className="text-slate-500 leading-relaxed font-medium">Pionir solusi peternakan berbasis IoT di Indonesia, berkomitmen menghadirkan efisiensi total melalui teknologi digital terdepan.</p>
                    </div>
                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 min-h-[400px]">
                        <iframe
                            width="100%" height="100%" frameBorder="0" scrolling="no" title="Lokasi"
                            src="https://www.openstreetmap.org/export/embed.html?bbox=105.301611%2C-5.300333%2C105.311611%2C-5.290333&amp;layer=mapnik&amp;marker=-5.295333%2C105.306611"
                        ></iframe>
                    </div>
                </section>

                {/* --- DEVELOPER SECTION (AS A CARD) --- */}
                <section id="developer" className="pt-8">
                    <div 
                        onMouseMove={handleDevMouseMove}
                        onMouseLeave={() => setDevTilt({x:0, y:0})}
                        style={{
                            transform: `perspective(1000px) rotateX(${devTilt.x}deg) rotateY(${devTilt.y}deg) scale3d(1.01, 1.01, 1.01)`,
                            transition: 'transform 0.2s ease-out'
                        }}
                        className="bg-white rounded-[3rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.1)] border border-white overflow-hidden flex flex-col group text-center"
                    >
                        <div className="w-full p-12 md:p-20 flex flex-col items-center justify-center bg-white relative">
                            <div className="absolute top-0 right-1/2 translate-x-1/2 p-8 text-[120px] md:text-[180px] font-black text-slate-50 select-none -z-0">DEV</div>
                            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
                                {/* Left Side: Developer Info */}
                                <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                                    <h4 className="text-primary-600 font-bold uppercase tracking-[0.2em] text-xs mb-4">The Developer</h4>
                                    <h3 className="text-5xl font-black text-slate-900 mb-2">Majid</h3>
                                    <p className="text-slate-400 font-bold mb-8 text-xl">Full Stack Developer</p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-left">Teknik Elektro</p>
                                            <p className="text-slate-400 text-sm font-medium text-left">Universitas Lampung (Unila)</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Quotes & Links */}
                                <div className="flex flex-col items-center lg:items-start max-w-lg">
                                    <div className="flex items-start gap-4 mb-8">
                                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 italic shrink-0 text-2xl font-serif">"</div>
                                        <p className="text-xl italic text-slate-500 leading-relaxed font-medium text-center lg:text-left">
                                            Membangun masa depan agrikultur modern melalui solusi perangkat lunak yang inovatif.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 justify-center lg:justify-start w-full">
                                        <a href="https://www.linkedin.com/in/majid-solihin-hadi-100759275/" target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary-600 transition shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                            LinkedIn
                                        </a>
                                        <a href="https://github.com/MajidHadi-2045" target="_blank" rel="noopener noreferrer" className="px-8 py-3 border border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                            GitHub
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- FOOTER (AS A CARD) --- */}
                <footer className="bg-white rounded-[2.5rem] p-10 md:p-16 shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 shadow-sm"><img src="/public/logoxl.svg" alt="Logo" className="h-6 w-6"/></div>
                            <span className="text-lg font-bold">Smart Cattle Barn</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">© 2026 PT AgriTekno Nusantara. All rights reserved.</p>
                        <div className="flex gap-8 text-sm font-bold text-slate-400">
                            <a href="#" className="hover:text-primary-600 transition">Privacy</a>
                            <a href="#" className="hover:text-primary-600 transition">Terms</a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default LandingPage;