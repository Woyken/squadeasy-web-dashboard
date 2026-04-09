import daisyui from "daisyui"

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'fade-in-up': 'fadeInUp 0.5s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'count-flip': 'countFlip 0.6s ease-in-out',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                countFlip: {
                    '0%': { transform: 'rotateX(0deg)' },
                    '50%': { transform: 'rotateX(-90deg)' },
                    '100%': { transform: 'rotateX(0deg)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
        },
    },
    plugins: [daisyui],
    daisyui: {
        themes: [
            {
                squadDark: {
                    "primary": "#818cf8",
                    "primary-content": "#ffffff",
                    "secondary": "#a78bfa",
                    "secondary-content": "#ffffff",
                    "accent": "#34d399",
                    "accent-content": "#003320",
                    "neutral": "#1e1b4b",
                    "neutral-content": "#c7d2fe",
                    "base-100": "#0f0e1a",
                    "base-200": "#1a1830",
                    "base-300": "#252347",
                    "base-content": "#e0e7ff",
                    "info": "#38bdf8",
                    "info-content": "#002b3d",
                    "success": "#34d399",
                    "success-content": "#003320",
                    "warning": "#fbbf24",
                    "warning-content": "#382800",
                    "error": "#fb7185",
                    "error-content": "#3b0012",
                },
            },
        ],
    },
};
