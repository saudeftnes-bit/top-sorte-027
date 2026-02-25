import React, { createContext, useContext, useEffect, useState } from 'react';

interface DarkModeContextType {
    isDark: boolean;
    toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
    isDark: false,
    toggle: () => { },
});

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDark, setIsDark] = useState<boolean>(() => {
        try {
            const stored = localStorage.getItem('darkMode');
            if (stored !== null) return stored === 'true';
            return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('darkMode', isDark.toString());
    }, [isDark]);

    const toggle = () => setIsDark(prev => !prev);

    return (
        <DarkModeContext.Provider value={{ isDark, toggle }}>
            {children}
        </DarkModeContext.Provider>
    );
};

export const useDarkMode = () => useContext(DarkModeContext);
