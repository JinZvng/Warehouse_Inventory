// hooks/useKonamiCode.ts
import { useEffect, useState } from 'react';

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
  'Enter'
];

export const useKonamiCode = (action: () => void) => {
  const [inputHistory, setInputHistory] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Agregamos la tecla presionada al historial
      const newHistory = [...inputHistory, e.key];

      // Si el historial es más largo que la secuencia, cortamos el inicio
      if (newHistory.length > KONAMI_SEQUENCE.length) {
        newHistory.shift();
      }

      setInputHistory(newHistory);

      // Comparamos si el historial coincide con la secuencia ganadora
      // Convertimos a string para comparar fácil arrays
      if (JSON.stringify(newHistory) === JSON.stringify(KONAMI_SEQUENCE)) {
        action();
        setInputHistory([]); // Reiniciamos para que se pueda volver a hacer
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputHistory, action]);
};