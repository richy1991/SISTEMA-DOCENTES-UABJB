import { useState, useEffect } from 'react';

export function useTheme() {
  // Obtener tema guardado o usar 'system' por defecto
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'system';
  });

  // Estado calculado del tema real (light o dark)
  const [effectiveTheme, setEffectiveTheme] = useState('light');

  useEffect(() => {
    // Función para detectar preferencia del sistema
    const getSystemTheme = () => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Calcular el tema efectivo
    const calculateEffectiveTheme = () => {
      if (theme === 'system') {
        return getSystemTheme();
      }
      return theme;
    };

    // Aplicar el tema
    const applyTheme = () => {
      const effective = calculateEffectiveTheme();
      setEffectiveTheme(effective);

      // Agregar o quitar clase 'dark' del documento
      if (effective === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Aplicar tema inicial
    applyTheme();

    // Escuchar cambios en la preferencia del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Función para cambiar el tema
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return {
    theme, // 'light', 'dark', o 'system'
    effectiveTheme, // el tema real aplicado ('light' o 'dark')
    setTheme: changeTheme,
    isLight: effectiveTheme === 'light',
    isDark: effectiveTheme === 'dark',
  };
}