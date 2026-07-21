"use client";
import Image from 'next/image';
import { useEffect } from 'react';
import phillyBudgetLogo from '@/src/assets/phillybudgetlogo.svg';

export default function Menu() {
  useEffect(() => {
    const btn = document.getElementById('mobile-menu-toggle');
    const panel = document.getElementById('mobile-menu-panel');
    if (!btn || !panel) return;
    
    const bars = btn.querySelector('[data-icon-bars]');
    const x = btn.querySelector('[data-icon-x]');
    
    const handleClick = () => {
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        panel.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        if (bars && x) {
          bars.classList.add('opacity-0', 'scale-90');
          x.classList.remove('opacity-0', 'scale-90');
        }
      } else {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        if (bars && x) {
          bars.classList.remove('opacity-0', 'scale-90');
          x.classList.add('opacity-0', 'scale-90');
        }
      }
    };
    
    btn.addEventListener('click', handleClick);
    return () => btn.removeEventListener('click', handleClick);
  }, []);

  return (
  <header className="py-5">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <nav className="relative z-50 flex justify-between">
        <div className="flex items-center md:gap-x-12">
          <a aria-label="Home" href="/">
            <Image loading="eager" width={302} height={59} unoptimized alt="philly budget logo" src={phillyBudgetLogo} />
          </a>
        </div>
        <div className="flex items-center gap-x-5 md:gap-x-8">
          <div className="hidden md:block"></div>
          <a className="text-center group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 bg-blue-800 text-white hover:text-slate-100 hover:bg-blue-600 active:bg-blue-900 active:text-blue-100 focus-visible:outline-blue-800" href="https://github.com/acouch/phila-budget-site/tree/main/data"><span>Raw data</span></a>
          <div className="-mr-1 md:hidden">
            <button id="mobile-menu-toggle" className="relative z-10 flex h-8 w-8 items-center justify-center focus:outline-none" aria-label="Toggle Navigation" aria-controls="mobile-menu-panel" aria-expanded="false" type="button">
              <svg aria-hidden="true" className="h-3.5 w-3.5 overflow-visible stroke-slate-700" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M0 1H14M0 7H14M0 13H14" className="origin-center transition" data-icon-bars></path>
                <path d="M2 2L12 12M12 2L2 12" className="origin-center transition scale-90 opacity-0" data-icon-x></path>
              </svg>
            </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}