import { Link } from 'react-router-dom';
import { Button } from '../components/Common';
import { ArrowRight, BarChart3, ShieldCheck, Zap, Globe, Cpu, Layers, Package, Users, ShoppingCart, Settings, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform, useReducedMotion, AnimatePresence } from 'motion/react';
import { useRef, useState, useEffect } from 'react';

const Typewriter = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (delay > 0) {
      timeout = setTimeout(() => {
        let i = 0;
        const interval = setInterval(() => {
          setDisplayedText(text.slice(0, i + 1));
          i++;
          if (i === text.length) clearInterval(interval);
        }, 50);
      }, delay * 1000);
    } else {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i === text.length) clearInterval(interval);
      }, 50);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [text, delay]);

  return (
    <span>
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 1, 0, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity, times: [0, 0.49, 0.5, 0.99, 1] }}
        className="inline-block w-[2px] h-[1em] bg-blue-500 ml-1 translate-y-0.5"
      />
    </span>
  );
};

const MockupConsole = () => {
  const [activeTab, setActiveTab] = useState(0); // 0: Financials, 1: Inventory, 2: Intelligence
  const [logs, setLogs] = useState<string[]>(['[OS] Initializing business core...']);
  const statusPool = [
    '[SYSTEM] Syncing customer vault...',
    '[OS] Inventory calibration complete',
    '[INTEL] Analyzing revenue trends...',
    '[OS] Processing batch orders...',
    '[SYSTEM] Security handshake: Verified',
    '[INTEL] Low stock prediction triggered',
    '[OS] Indexing distribution nodes...',
    '[SYSTEM] Financial matrix updated'
  ];

  useEffect(() => {
    const tabInterval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % 3);
    }, 5000);

    const logInterval = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev, statusPool[Math.floor(Math.random() * statusPool.length)]];
        return next.slice(-6);
      });
    }, 3000);

    return () => {
      clearInterval(tabInterval);
      clearInterval(logInterval);
    };
  }, []);

  return (
    <div className="p-4 md:p-8 grid grid-cols-12 gap-6 bg-neutral-950">
      {/* Console Sidebar */}
      <div className="col-span-12 md:col-span-4 space-y-4">
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">System Log</span>
            </div>
            <span className="text-[9px] font-mono text-neutral-600">LIVE // R_OS</span>
          </div>
          <div className="space-y-2 font-mono text-[10px] text-neutral-500">
            {logs.map((log, i) => (
              <motion.div
                key={i + log}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2"
              >
                <span className="text-blue-900 opacity-50">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <span className={log.startsWith('[INTEL]') ? 'text-blue-400' : ''}>{log}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-5 border border-white/5 rounded-2xl space-y-4 bg-black/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Core Modules</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${activeTab === i ? 'bg-blue-500' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Financials', active: activeTab === 0 },
              { label: 'Inventory', active: activeTab === 1 },
              { label: 'Intelligence', active: activeTab === 2 }
            ].map((m, i) => (
              <div key={i} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${m.active ? 'bg-white/5' : ''}`}>
                <span className={`text-[11px] ${m.active ? 'text-white' : 'text-neutral-600'}`}>{m.label}</span>
                {m.active && <div className="w-1 h-1 bg-blue-500 rounded-full" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Workspace */}
      <div className="col-span-12 md:col-span-8 space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {activeTab === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="contents">
              {[
                { label: 'Total Revenue', value: '$128,402', change: '+14%' },
                { label: 'Net Profit', value: '$42,150', change: '+8%' },
                { label: 'Avg Order', value: '$842', change: '+3%' },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {stat.value}
                    <span className="text-[10px] text-emerald-500 font-mono font-normal">{stat.change}</span>
                  </p>
                </div>
              ))}
            </motion.div>
          )}
          {activeTab === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="contents">
              {[
                { label: 'Items in Stock', value: '1,240', status: 'Healthy' },
                { label: 'Low Stock Alerts', value: '4', status: 'Action' },
                { label: 'Stock Value', value: '$210k', status: 'Stable' },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {stat.value}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${stat.status === 'Action' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{stat.status}</span>
                  </p>
                </div>
              ))}
            </motion.div>
          )}
          {activeTab === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="contents">
              {[
                { label: 'Prediction Accuracy', value: '98.2%', detail: 'v4.0' },
                { label: 'Anomalies', value: '0', detail: 'Clean' },
                { label: 'Insights Ready', value: '12', detail: 'Critical' },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {stat.value}
                    <span className="text-[10px] text-blue-500 font-mono font-normal uppercase">{stat.detail}</span>
                  </p>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="h-80 bg-white/[0.02] border border-white/5 rounded-2xl relative p-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 0 && (
              <motion.div
                key="finance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest">Recent Sales Pipeline</span>
                  <div className="h-2 w-32 bg-emerald-500/20 border border-emerald-500/30 rounded-full overflow-hidden">
                    <motion.div initial={{ x: '-100%' }} animate={{ x: '10%' }} transition={{ duration: 2, repeat: Infinity }} className="h-full w-full bg-emerald-500" />
                  </div>
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 w-full bg-white/5 rounded-lg flex items-center px-4 justify-between border border-white/5">
                    <div className="flex gap-4 items-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <div className="h-2 w-32 bg-white/10 rounded" />
                    </div>
                    <div className="font-mono text-[10px] text-white/40">+$ {Math.floor(Math.random() * 1000)}.00</div>
                  </div>
                ))}
              </motion.div>
            )}
            {activeTab === 1 && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest">Critical Stock Levels</span>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[8px] text-red-500 font-bold uppercase">4 Warnings</div>
                  </div>
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 w-full bg-white/5 rounded-lg flex items-center px-4 justify-between border border-white/5">
                    <div className="flex gap-4 items-center">
                      <div className={`w-1.5 h-1.5 rounded-full ${i < 2 ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div className="h-2 w-48 bg-white/10 rounded" />
                    </div>
                    <div className="font-mono text-[10px] text-white/40">{Math.floor(Math.random() * 100)} Units</div>
                  </div>
                ))}
              </motion.div>
            )}
            {activeTab === 2 && (
              <motion.div
                key="intel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest">Growth Vector Analysis</span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-600/5 border border-blue-600/10 rounded-2xl">
                      <p className="text-[10px] text-blue-400 mb-2 uppercase font-bold tracking-widest">Best Performer</p>
                      <div className="h-3 w-3/4 bg-white/10 rounded mb-2" />
                      <div className="h-2 w-1/2 bg-white/5 rounded" />
                    </div>
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <p className="text-[10px] text-neutral-500 mb-2 uppercase font-bold tracking-widest">Anomaly Detection</p>
                      <div className="flex gap-2 items-center">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] text-neutral-400">All Nodes Secure</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center relative">
                    <BarChart3 className="w-32 h-32 text-blue-500/10" />
                    <motion.div
                      animate={{ height: ['40%', '80%', '60%', '90%', '50%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute bottom-0 left-1/4 w-4 bg-blue-500/20 rounded-t"
                    />
                    <motion.div
                      animate={{ height: ['60%', '40%', '90%', '50%', '80%'] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="absolute bottom-0 left-1/2 w-4 bg-blue-500/40 rounded-t"
                    />
                    <motion.div
                      animate={{ height: ['20%', '60%', '40%', '70%', '30%'] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute bottom-0 left-3/4 w-4 bg-blue-500/10 rounded-t"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export function Landing() {
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const mockupY = useTransform(scrollYProgress, [0, 0.3], [100, 0]);
  const mockupScale = useTransform(scrollYProgress, [0, 0.3], [0.8, 1]);

  const variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 40, filter: 'blur(10px)' },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 1.2,
        delay: 0.2 + i * 0.2,
        ease: [0.16, 1, 0.3, 1] as any
      }
    })
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Remix OS</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#preview" className="hover:text-white transition-colors">Platform</a>
              <a href="#insights" className="hover:text-white transition-colors">Intelligence</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </div>
            <Link to="/auth">
              <Button variant="secondary" className="bg-white text-black hover:bg-neutral-200 border-none px-6">
                Enter Console
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative h-screen flex flex-col justify-center items-center overflow-hidden pt-20">
          <div className="absolute inset-0 hero-gradient opacity-60" />
          <div className="absolute inset-0 grid-bg opacity-20" />
          
          <motion.div 
            style={{ opacity: heroOpacity }}
            className="relative z-10 text-center max-w-5xl px-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-blue-400 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <Typewriter text="V1.0 ALPHA — Business Operating System" delay={0.5} />
            </motion.div>

            <div className="overflow-hidden mb-8">
              <motion.h1 
                custom={1}
                variants={variants}
                initial="hidden"
                animate="visible"
                className="font-display text-5xl md:text-8xl lg:text-[100px] font-bold tracking-[-0.04em] leading-[0.95] text-white glow-text"
              >
                Manage your business
              </motion.h1>
              <motion.h1 
                custom={2}
                variants={variants}
                initial="hidden"
                animate="visible"
                className="font-display text-5xl md:text-8xl lg:text-[100px] font-bold tracking-[-0.04em] leading-[0.95] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/30"
              >
                with total precision.
              </motion.h1>
            </div>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Remix OS is a high-performance workspace for retail and distribution. 
              Integrated inventory, customers, and orders—unified in one premium core.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/auth">
                <Button className="w-full sm:w-auto px-10 py-7 text-lg h-auto rounded-full bg-white text-black hover:scale-105 transition-transform duration-300">
                  Enter Console <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="ghost" className="w-full sm:w-auto px-10 py-7 text-lg h-auto rounded-full border border-white/10 hover:bg-white/5 uppercase tracking-widest text-[10px] font-bold">
                  Explore Platform
                </Button>
              </a>
            </motion.div>
          </motion.div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
        </section>

        {/* Product Showcase */}
        <section id="preview" className="relative px-6 pb-40">
          <motion.div
            style={{ y: mockupY, scale: mockupScale }}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-7xl mx-auto"
          >
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[32px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative bg-neutral-900 border border-white/10 rounded-[28px] overflow-hidden shadow-2xl">
                <div className="h-10 border-b border-white/5 bg-neutral-900/50 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" />
                  </div>
                  <div className="mx-auto text-[10px] text-neutral-500 tracking-widest uppercase flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> remix-os.console/dashboard
                  </div>
                </div>
                <MockupConsole />
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-40 border-t border-white/5">
          <div className="text-center mb-24">
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6">Everything your business <br /> needs to thrive.</h2>
            <p className="text-neutral-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Ditch the spreadsheets. Remix OS provides a cohesive interface for the core pillars of your operations, all powered by real-time intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Users, title: "Customer CRM", desc: "Manage detailed client profiles, purchase history, and relationship metrics in one unified vault.", color: "text-blue-500" },
              { icon: Package, title: "Product Catalog", desc: "Digitalize your entire inventory with rich metadata, categories, and multi-variant support.", color: "text-purple-500" },
              { icon: Layers, title: "Inventory Control", desc: "Track stock levels across multiple locations with automated movement logs and low-stock triggers.", color: "text-emerald-500" },
              { icon: ShoppingCart, title: "Order Processing", desc: "Seamlessly handle sales, distribution, and fulfillment from a transaction-safe command center.", color: "text-orange-500" },
              { icon: Cpu, title: "AI Insights", desc: "Native machine learning that surfaces sales trends, growth opportunities, and supply chain risks.", color: "text-pink-500" },
              { icon: Settings, title: "Business Core", desc: "Manage your organizational settings, team permissions, and global business parameters.", color: "text-cyan-500" }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -8 }}
                className="group p-8 bg-neutral-900/30 border border-white/5 rounded-3xl hover:border-white/20 transition-all duration-500"
              >
                <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-500 ${feature.color}`}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display font-medium text-2xl mb-4">{feature.title}</h3>
                <p className="text-neutral-500 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Intelligence Section */}
        <section id="insights" className="bg-neutral-950 py-40 overflow-hidden relative border-y border-white/5">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px] translate-x-1/2 -translate-y-1/2" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-20">
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-blue-500 mb-4 block">Artificial Intelligence</span>
                <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-8">Intelligence in every <span className="text-blue-500 italic">operation.</span></h2>
                <p className="text-neutral-400 text-lg leading-relaxed mb-12">
                  Our integrated AI models monitor every stock movement, customer interaction, and sales trend. 
                  Get predictive alerts for low stock and automated insights into your most profitable products.
                </p>
                <div className="space-y-6">
                  {[
                    { label: "Predictive Stock Forecasting", desc: "Know what to order before you run out." },
                    { label: "Customer LTV Analysis", desc: "Identify your most valuable relationships automatically." },
                    { label: "Revenue Optimization", desc: "Smart pricing suggestions based on demand patterns." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.label}</p>
                        <p className="text-xs text-neutral-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full flex justify-center">
                <div className="w-full aspect-square max-w-md bg-gradient-to-br from-blue-600/20 to-transparent border border-white/10 rounded-3xl p-8 flex items-center justify-center relative overflow-hidden group">
                   <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
                   <div className="relative z-10 text-center">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center"
                      >
                        <Cpu className="w-12 h-12 text-blue-400" />
                      </motion.div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
                      </div>
                      <p className="mt-8 font-display text-2xl font-bold tracking-tighter uppercase opacity-50">Active Core</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-40 border-t border-white/5">
          <div className="text-center mb-24">
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6">Simple plans for <br /> every stage of growth.</h2>
            <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
              Transparent pricing designed to scale with your business volume.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Starter",
                price: "$49",
                desc: "Perfect for new retail operations.",
                features: ["Up to 500 Customers", "1,000 Product Variants", "Basic AI Insights", "1 Location", "Standard Support"]
              },
              {
                name: "Professional",
                price: "$149",
                desc: "High-performance tools for growing businesses.",
                features: ["Unlimited Customers", "Unlimited Products", "Advanced Predictive AI", "5 Locations", "Priority 24/7 Support", "API Access"],
                popular: true
              },
              {
                name: "Business",
                price: "$399",
                desc: "The ultimate OS for multi-node distribution.",
                features: ["Unlimited Everything", "Custom AI Training", "Infinite Locations", "Dedicated Support Manager", "White-label Console", "SOC2 Compliance"]
              }
            ].map((plan, i) => (
              <div 
                key={i}
                className={`relative p-8 rounded-3xl border ${plan.popular ? 'bg-white/5 border-blue-500/50' : 'bg-neutral-900/30 border-white/5'} flex flex-col`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="font-display text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-neutral-500 text-sm">{plan.desc}</p>
                </div>
                <div className="mb-8">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-neutral-500 ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-neutral-400">
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button className={`w-full py-6 rounded-2xl ${plan.popular ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                    Choose {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-40 relative">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-8">Start managing <br /> with clarity.</h2>
            <p className="text-neutral-400 text-xl mb-12 max-w-xl mx-auto">
              Join hundreds of businesses using Remix OS to unify their operations and scale with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button className="w-full sm:w-auto px-12 py-8 text-xl h-auto rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-all hover:scale-105">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4 max-w-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-[2px]" />
              </div>
              <span className="font-bold text-lg tracking-tight">Remix OS</span>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              The high-performance business operating system for modern retail and distribution.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 text-sm">
            <div className="space-y-4">
              <p className="font-bold text-xs uppercase tracking-widest">Platform</p>
              <ul className="space-y-2 text-neutral-500">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#preview" className="hover:text-white transition-colors">Terminal</a></li>
                <li><a href="#insights" className="hover:text-white transition-colors">Intelligence</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="font-bold text-xs uppercase tracking-widest">Company</p>
              <ul className="space-y-2 text-neutral-500">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div className="space-y-4 col-span-2 sm:col-span-1">
              <p className="font-bold text-xs uppercase tracking-widest">Legal</p>
              <ul className="space-y-2 text-neutral-500">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] text-neutral-600 uppercase tracking-widest">
          <p>© 2024 Remix Technologies Inc.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
