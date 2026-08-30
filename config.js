
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Assistant', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#050810', 800: '#0f172a', 700: '#1e293b', 600: '#334155' },
                        brand: { primary: '#3b82f6', secondary: '#8b5cf6', accent: '#f43f5e', success: '#10b981', warning: '#f59e0b' }
                    },
                    boxShadow: {
                        'glow-primary': '0 0 25px rgba(59, 130, 246, 0.4)',
                        'glow-secondary': '0 0 25px rgba(139, 92, 246, 0.4)',
                    }
                }
            }
        }
    