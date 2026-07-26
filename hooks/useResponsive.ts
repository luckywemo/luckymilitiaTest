import { useState, useEffect } from 'react';

export interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

function getResponsiveState(): ResponsiveState {
  if (typeof window === 'undefined') {
    return { width: 1920, height: 1080, isMobile: false, isTablet: false, isDesktop: true, isLandscape: true, isPortrait: false, breakpoint: 'xl' };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  let breakpoint: ResponsiveState['breakpoint'] = 'xs';
  if (width >= 1280) breakpoint = 'xl';
  else if (width >= 1024) breakpoint = 'lg';
  else if (width >= 768) breakpoint = 'md';
  else if (width >= 640) breakpoint = 'sm';
  return { width, height, isMobile, isTablet, isDesktop, isLandscape, isPortrait, breakpoint };
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(getResponsiveState);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setState(getResponsiveState()), 100);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearTimeout(timeout);
    };
  }, []);

  return state;
}
