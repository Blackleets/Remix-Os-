import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLocale } from '../hooks/useLocale';
import { cn } from './Common';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'pt', label: 'Portuguese', native: 'Português' }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-300 border backdrop-blur-md group",
          isOpen 
            ? "bg-white/10 border-white/20 ring-1 ring-white/10" 
            : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-5 h-5 rounded-lg border transition-colors",
          isOpen 
            ? "bg-blue-500/20 border-blue-500/40" 
            : "bg-white/5 border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/20"
        )}>
          <Globe className={cn(
            "w-3 h-3 transition-colors",
            isOpen ? "text-blue-400" : "text-neutral-500 group-hover:text-neutral-300"
          )} />
        </div>
        <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-[0.2em] min-w-[20px]">
          {language}
        </span>
        <ChevronDown className={cn(
          "w-3 h-3 text-neutral-600 transition-transform duration-300",
          isOpen ? "rotate-180 text-neutral-400" : "group-hover:text-neutral-400"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-48 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-[100] overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/5 mb-1.5">
              <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                Interface Protocol
              </p>
            </div>
            <div className="space-y-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group/item",
                    language === lang.code 
                      ? "bg-blue-600/15 text-white" 
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold uppercase tracking-tight">{lang.label}</span>
                    <span className="text-[9px] text-neutral-600 group-hover/item:text-neutral-500 transition-colors uppercase tracking-widest font-mono">
                      {lang.native}
                    </span>
                  </div>
                  {language === lang.code && (
                    <motion.div
                      layoutId="active-lang-dot"
                      className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
