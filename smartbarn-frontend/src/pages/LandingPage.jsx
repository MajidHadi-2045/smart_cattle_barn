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
            className="min-w-[300px] md:min-w-[380px] snap-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-default group"
        >
            <div className="w-14 h-14 bg-primary-50 rounded-lg flex items-center justify-center text-primary-700 mb-6 group-hover:bg-primary-700 group-hover:text-white transition-all duration-300 shadow-sm">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
                {desc}
            </p>
        </div>
    );
};

const Typewriter = ({ text = "Jauh Lebih Cerdas.", phrases }) => {
    const defaultPhrases = phrases || [text, "Jauh Lebih Efisien.", "Hasil Maksimal."];
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const targetText = defaultPhrases[currentPhraseIndex] || text;

        if (!isDeleting && displayedText === targetText) {
            const timeout = setTimeout(() => setIsDeleting(true), 2500);
            return () => clearTimeout(timeout);
        }

        if (isDeleting && displayedText === "") {
            setIsDeleting(false);
            setCurrentPhraseIndex((prev) => (prev + 1) % defaultPhrases.length);
            return;
        }

        const speed = isDeleting ? 40 : 85;
        const timer = setTimeout(() => {
            setDisplayedText(
                isDeleting
                    ? targetText.substring(0, displayedText.length - 1)
                    : targetText.substring(0, displayedText.length + 1)
            );
        }, speed);

        return () => clearTimeout(timer);
    }, [displayedText, isDeleting, currentPhraseIndex, defaultPhrases, text]);

    return (
        <span className="text-primary-700 font-black inline">
            <span className="inline">{displayedText}</span>
            <span className="w-[3px] h-[0.85em] bg-primary-700 ml-1 inline-block animate-cursor-blink rounded-sm align-middle"></span>
        </span>
    );
};

const LandingPage = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [devTilt, setDevTilt] = useState({ x: 0, y: 0 });
    const [phoneTilt, setPhoneTilt] = useState({ x: 0, y: 0 });
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDevMouseMove = (e) => {
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        setDevTilt({ x: (y - (box.height / 2)) / 30, y: ((box.width / 2) - x) / 30 });
    };

    const handlePhoneMouseMove = (e) => {
        const card = e.currentTarget;
        const box = card.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        setPhoneTilt({
            x: (y - (box.height / 2)) / 20,
            y: ((box.width / 2) - x) / 20
        });
    };

    return (
        <div className="font-sans text-slate-900 bg-[#F8FAFC] antialiased scroll-smooth min-h-screen">

            {/* --- NAVBAR --- */}
            <nav className={`fixed w-full z-50 transition-all duration-500 px-4 md:px-8 pt-4 ${scrolled ? 'top-2' : 'top-0'}`}>
                <div className={`max-w-7xl mx-auto rounded-[2rem] transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/20 px-8 py-3' : 'bg-transparent px-0 py-6'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
                                <img src="/logoxl.svg" alt="Logo Smart Cattle Barn" width="32" height="32" className="h-8 w-8" />
                            </div>
                            <span className="text-xl font-bold text-slate-900 tracking-tight text-shadow-sm">Smart Cattle Barn</span>
                        </div>

                        <div className="hidden md:flex items-center space-x-10">
                            <a href="#features" className="text-slate-700 hover:text-primary-700 font-semibold transition text-sm">Fitur</a>
                            <a href="#mobile-app" className="text-slate-700 hover:text-primary-700 font-semibold transition text-sm">Aplikasi</a>
                            <a href="#about-pt" className="text-slate-700 hover:text-primary-700 font-semibold transition text-sm">Tentang</a>
                            <Link to="/public-dashboard" className="text-slate-700 hover:text-primary-700 font-semibold transition text-sm">Dashboard</Link>
                            <Link to="/login" className="px-7 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-500/30 text-sm">
                                Login
                            </Link>
                        </div>

                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                            aria-label="Buka menu navigasi mobile" 
                            className="md:hidden text-slate-900 p-2 rounded-lg"
                        >
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-24 left-4 right-4 bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col space-y-4 text-center font-bold">
                            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-700">Fitur</a>
                            <a href="#mobile-app" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-700">Mobile App</a>
                            <a href="#about-pt" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-700">Tentang</a>
                            <Link to="/public-dashboard" onClick={() => setIsMobileMenuOpen(false)} className="py-4 text-slate-700 border border-slate-200 rounded-2xl">Dashboard</Link>
                            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="py-4 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-primary-700 hover:shadow-primary-500/30 transition">Login</Link>
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
                            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black text-slate-900 leading-[1.22] sm:leading-[1.18] mb-6 tracking-tight">
                                <span className="block mb-1 sm:mb-2">Kelola Ternak</span>
                                <Typewriter text="Jauh Lebih Cerdas." />
                            </h1>
                            <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                                Efisiensi tanpa batas dengan integrasi IoT. Pantau kesehatan ternak, manajemen pakan, dan mikroklimat kandang secara terpadu.
                                <span className="block text-primary-700 font-semibold mt-2 text-sm sm:text-base">
                                    Kini hadir dengan Beranda Publik transparan yang dapat dipantau oleh siapa saja secara real-time.
                                </span>
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <Link to="/dashboard" className="px-7 py-3.5 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800 transition shadow-sm flex items-center justify-center gap-2.5 group">
                                    <span>Mulai Sekarang</span>
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </Link>
                                <a href="#mobile-app" className="px-7 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2.5">
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
                                        <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time</div>
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
                            <h2 className="text-sm font-bold text-primary-700 tracking-[0.2em] uppercase mb-3">Fitur Utama</h2>
                            <p className="text-3xl font-bold text-slate-900 tracking-tight">Kendalikan segalanya dalam satu sistem.</p>
                        </div>
                        <div className="hidden md:flex gap-3">
                            <button 
                                onClick={() => document.getElementById('fs').scrollBy({left: -400, behavior: 'smooth'})} 
                                aria-label="Geser fitur ke kiri"
                                className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-primary-50 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                            </button>
                            <button 
                                onClick={() => document.getElementById('fs').scrollBy({left: 400, behavior: 'smooth'})} 
                                aria-label="Geser fitur ke kanan"
                                className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-primary-50 transition-colors"
                            >
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
                                title: "Dashboard Publik Transparan", 
                                desc: "Sajikan data performa, pertumbuhan ternak (DMI vs ADG), dan sensor secara live kepada publik atau stakeholder tanpa perlu login.", 
                                icon: <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 
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
                            {/* Smartphone Container dengan 3D Parallax Hover Effect */}
                            <div 
                                onMouseMove={handlePhoneMouseMove}
                                onMouseLeave={() => setPhoneTilt({ x: 0, y: 0 })}
                                style={{
                                    transform: `perspective(1000px) rotateX(${phoneTilt.x}deg) rotateY(${phoneTilt.y}deg) scale3d(1.02, 1.02, 1.02)`,
                                    transition: 'transform 0.2s ease-out'
                                }}
                                className="relative group cursor-pointer"
                            >
                                {/* Ambient Glow Aura di belakang smartphone */}
                                <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/25 via-teal-500/15 to-primary-600/20 rounded-[3.5rem] blur-2xl opacity-60 group-hover:opacity-90 transition duration-500 -z-10"></div>

                                {/* Bodi Smartphone Flagship Modern */}
                                <div className="w-[275px] sm:w-[295px] h-[550px] sm:h-[570px] bg-slate-950 rounded-[3.2rem] p-2.5 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8),0_0_60px_rgba(16,185,129,0.18)] border border-slate-700/60 ring-1 ring-white/10 relative overflow-hidden flex flex-col justify-between">
                                    
                                    {/* Layar Aplikasi: Tampilan Antarmuka Asli Smart Cattle Barn (Clean & High-Fidelity) */}
                                    <div className="bg-white rounded-[2.6rem] h-full w-full overflow-hidden flex flex-col justify-between p-4 pt-2.5 text-slate-800 shadow-inner relative select-none">
                                        
                                        {/* Status Bar Ponsel (09:41, Dynamic Island, Sinyal & Baterai) */}
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 px-1 pt-1">
                                            <span>09:41</span>
                                            {/* Dynamic Island Notch */}
                                            <div className="w-20 h-4 bg-slate-950 rounded-full flex items-center justify-end pr-1.5 shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800 border border-slate-700"></div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-700">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" opacity="0.3"/><path d="M12 6a6 6 0 0 0-6 6c0 1.41.49 2.72 1.32 3.75L12 19l4.68-3.25C17.51 14.72 18 13.41 18 12a6 6 0 0 0-6-6z"/></svg>
                                                <div className="w-4 h-2 border border-slate-700 rounded-xs p-0.5 flex items-center">
                                                    <div className="w-full h-full bg-slate-800 rounded-2xs"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 mt-2">
                                            {/* App Top Bar: Logo Resmi Smart Cattle Barn & Status Koneksi */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-slate-50 rounded-lg border border-slate-100 shadow-2xs">
                                                        <img src="/logoxl.svg" alt="Smart Cattle Barn" className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-900 leading-tight">Smart Cattle Barn</div>
                                                        <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                            Kandang A • Terhubung
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 relative">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                                </div>
                                            </div>

                                            {/* Kartu Telemetri Lingkungan Kandang */}
                                            <div className="rounded-2xl p-3 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 border border-slate-100 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mikroklimat Kandang</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">Optimal</span>
                                                </div>
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-2xl font-black text-slate-900 tracking-tight">24.6°C</span>
                                                    <span className="text-xs font-semibold text-slate-500">68% RH</span>
                                                    <span className="text-[10px] font-medium text-emerald-600 ml-auto">THI: 72</span>
                                                </div>
                                                {/* Grafik Gelombang Tren Suhu Real-Time */}
                                                <div className="h-10 w-full relative pt-1">
                                                    <svg className="w-full h-full text-emerald-500 overflow-visible" viewBox="0 0 100 28" fill="none">
                                                        <defs>
                                                            <linearGradient id="phoneTelemetryGrad" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                                                                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                                                            </linearGradient>
                                                        </defs>
                                                        <path 
                                                            d="M0 20 Q 15 6, 30 16 T 60 10 T 82 5 T 100 12" 
                                                            stroke="currentColor" 
                                                            strokeWidth="2.2" 
                                                            strokeLinecap="round" 
                                                        />
                                                        <path 
                                                            d="M0 20 Q 15 6, 30 16 T 60 10 T 82 5 T 100 12 L 100 28 L 0 28 Z" 
                                                            fill="url(#phoneTelemetryGrad)" 
                                                        />
                                                        <circle cx="82" cy="5" r="2.5" fill="#10B981" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Grid Metrik Cepat: Populasi Sapi & Pakan Harian */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Widget Populasi Ternak */}
                                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between h-[78px]">
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400">Populasi</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-900 leading-none">142 Ekor</div>
                                                        <div className="text-[9px] text-emerald-600 font-semibold mt-1">100% Kondisi Sehat</div>
                                                    </div>
                                                </div>

                                                {/* Widget Pakan Harian */}
                                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between h-[78px]">
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400">Pakan</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-900 leading-none">850 Kg</div>
                                                        <div className="text-[9px] text-teal-600 font-semibold mt-1">Jadwal Terpenuhi</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Otomasi Aktuator IoT */}
                                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between shadow-2xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-emerald-950 leading-tight">Sirkulasi & Kipas Aktif</div>
                                                        <div className="text-[8px] text-emerald-700">Otomasi Berjalan Normal</div>
                                                    </div>
                                                </div>
                                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black uppercase tracking-wider">AUTO</span>
                                            </div>
                                        </div>

                                        {/* Bottom Navigation Dock & Home Bar */}
                                        <div className="border-t border-slate-100 pt-2 space-y-1.5">
                                            <div className="flex items-center justify-around text-slate-400">
                                                <div className="flex flex-col items-center text-emerald-600">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                                                    <span className="text-[8px] font-bold mt-0.5">Beranda</span>
                                                </div>
                                                <div className="flex flex-col items-center hover:text-slate-600 transition">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                                    <span className="text-[8px] font-medium mt-0.5">Ternak</span>
                                                </div>
                                                <div className="flex flex-col items-center hover:text-slate-600 transition">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                                                    <span className="text-[8px] font-medium mt-0.5">Medis</span>
                                                </div>
                                            </div>
                                            {/* Home Indicator */}
                                            <div className="w-20 h-1 bg-slate-300 rounded-full mx-auto"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 text-center lg:text-left">
                            <h2 className="text-4xl font-black mb-8 leading-tight">Mobile Application<br/><span className="text-primary-400 font-medium">Dalam Genggaman.</span></h2>
                            <p className="text-lg text-slate-300 mb-12 leading-relaxed max-w-lg mx-auto lg:mx-0">Pantau ternak langsung dari smartphone Anda. Dapatkan notifikasi darurat secara instan.</p>
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
                        <p className="text-slate-600 leading-relaxed font-medium">Pionir solusi peternakan berbasis IoT di Indonesia, berkomitmen menghadirkan efisiensi total melalui teknologi digital terdepan.</p>
                    </div>
                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 min-h-[400px]">
                        <iframe
                            width="100%" height="100%" frameBorder="0" scrolling="no" title="Lokasi Peternakan Sapi"
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
                                    <p className="text-primary-700 font-bold uppercase tracking-[0.2em] text-xs mb-4">The Developer</p>
                                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-2">Majid</h2>
                                    <p className="text-slate-600 font-bold mb-8 text-xl">Full Stack Developer</p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-left">Teknik Elektro</p>
                                            <p className="text-slate-600 text-sm font-medium text-left">Universitas Lampung (Unila)</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Quotes & Links */}
                                <div className="flex flex-col items-center lg:items-start max-w-lg">
                                    <div className="flex items-start gap-4 mb-8">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 italic shrink-0 text-2xl font-serif">"</div>
                                        <p className="text-xl italic text-slate-600 leading-relaxed font-medium text-center lg:text-left">
                                            Membangun masa depan agrikultur modern melalui solusi perangkat lunak yang inovatif.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 justify-center lg:justify-start w-full">
                                        <a href="https://www.linkedin.com/in/majid-solihin-hadi-100759275/" target="_blank" rel="noopener noreferrer" aria-label="Profil LinkedIn Pengembang Majid" className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary-700 transition shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                            LinkedIn
                                        </a>
                                        <a href="https://github.com/MajidHadi-2045" target="_blank" rel="noopener noreferrer" aria-label="Profil GitHub Pengembang Majid" className="px-8 py-3 border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
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
                            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 shadow-sm"><img src="/logoxl.svg" alt="Logo Smart Cattle Barn" width="24" height="24" className="h-6 w-6"/></div>
                            <span className="text-lg font-bold">Smart Cattle Barn</span>
                        </div>
                        <p className="text-slate-600 text-sm font-medium">© 2026 PT AgriTekno Nusantara. All rights reserved.</p>
                        <div className="flex gap-8 text-sm font-bold text-slate-600">
                            <a href="#" className="hover:text-primary-700 transition">Privacy</a>
                            <a href="#" className="hover:text-primary-700 transition">Terms</a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default LandingPage;