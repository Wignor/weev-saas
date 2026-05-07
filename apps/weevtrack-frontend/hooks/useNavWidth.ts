'use client';
import { useEffect, useState } from 'react';

export function useNavWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 768) {
        setWidth(0);
      } else {
        setWidth(document.body.classList.contains('nav-collapsed') ? 64 : 220);
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  return width;
}
