import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			slate: {
  				'50': '#f8fafc',
  				'100': '#f1f5f9',
  				'200': '#e2e8f0',
  				'300': '#cbd5e1',
  				'400': '#94a3b8',
  				'500': '#64748b',
  				'600': '#475569',
  				'700': '#334155',
  				'800': '#1e293b',
  				'900': '#0f172a',
  				'950': '#020617'
  			},
  			amber: {
  				'50': '#fffbeb',
  				'100': '#fef3c7',
  				'200': '#fde68a',
  				'300': '#fcd34d',
  				'400': '#fbbf24',
  				'500': '#f59e0b',
  				'600': '#d97706',
  				'700': '#b45309',
  				'800': '#92400e',
  				'900': '#78350f',
  				'950': '#451a03'
  			},
  			brand: {
  				'50': '#faf5ff',
  				'100': '#f3e8ff',
  				'200': '#e9d5ff',
  				'300': '#d8b4fe',
  				'400': '#c084fc',
  				'500': '#a855f7',
  				'600': '#9333ea',
  				'700': '#7e22ce',
  				'800': '#6b21a8',
  				'900': '#581c87',
  				'950': '#3b0764',
				DEFAULT: '#a855f7'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-4px)'
  				}
  			},
  			aurora: {
  				from: {
  					backgroundPosition: '50% 50%, 50% 50%'
  				},
  				to: {
  					backgroundPosition: '350% 50%, 350% 50%'
  				}
  			},
  			'shimmer-slide': {
  				to: {
  					transform: 'translate(calc(100cqw - 100%), 0)'
  				}
  			},
  			'spin-around': {
  				'0%': {
  					transform: 'translateZ(0) rotate(0)'
  				},
  				'15%, 35%': {
  					transform: 'translateZ(0) rotate(90deg)'
  				},
  				'65%, 85%': {
  					transform: 'translateZ(0) rotate(270deg)'
  				},
  				'100%': {
  					transform: 'translateZ(0) rotate(360deg)'
  				}
  			},
			'wobble': {
          		'0%, 100%': { transform: 'rotate(0deg)' },
          		'20%, 60%': { transform: 'rotate(-6deg)' },
          		'40%, 80%': { transform: 'rotate(6deg)' },
        	},

			'pulse-sparkle': {
        	  '0%, 100%': { transform: 'scale(1)' },
        	  '50%': { transform: 'scale(1.2)' },
        	},
        	'fade-twinkle': {
        	  '0%, 100%': { opacity: '0' },
        	  '50%': { opacity: '1' },
        	},
			 'search-pop-lens': {
        	  '0%, 100%': { transform: 'scale(1)' }, // Ensures a smooth loop
        	  '50%': { transform: 'scale(1.15)' },
        	},
        	'search-pop-handle': {
        	  '0%, 100%': { transform: 'translate(0, 0)' }, // Ensures a smooth loop
        	  '50%': { transform: 'translate(-1px, 1px) scale(1.05)' },
        	},
        	'file-jiggle': {
        	  '0%, 100%': { transform: 'rotate(0deg)' },
        	  '25%': { transform: 'rotate(-2deg)' },
        	  '75%': { transform: 'rotate(2deg)' },
        	},
        	'text-slide-in': {
        	  '0%, 100%': { opacity: '1', transform: 'translateX(0)' },
        	  '25%': { opacity: '0', transform: 'translateX(10px)' },
        	  '50%': { opacity: '0', transform: 'translateX(-10px)' },
        	  '75%': { opacity: '1', transform: 'translateX(0)' },
        	},
			'sun-set': {
        	  '0%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
        	  '25%': { opacity: '0', transform: 'translateY(10px) rotate(90deg)' },
        	  '50%': { opacity: '0', transform: 'translateY(10px) rotate(90deg)' }, // Stays hidden
        	  '100%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
        	},
        	'moon-rise': {
        	  '0%, 50%': { opacity: '0', transform: 'translateY(0)' },
        	  '75%': { opacity: '1', transform: 'translateY(-10px)' },
        	  '100%': { opacity: '0', transform: 'translateY(0)' },
        	},

			'message-vibrate': {
        	  '0%, 100%': { transform: 'translateX(0)' },
        	  '10%, 50%, 90%': { transform: 'translateX(-1px)' },
        	  '30%, 70%': { transform: 'translateX(1px)' },
        	},
        	'reply-arrow': {
        	  '0%, 100%': { opacity: '0', transform: 'translateY(2px)' },
        	  '25%, 75%': { opacity: '1', transform: 'translateY(0)' },
        	},

			'book-flutter': {
          		'0%, 100%': { transform: 'translateY(0)' },
          		'50%': { transform: 'translateY(-2px)' },
        	},

			 'mic-fill': {
        	  '0%, 100%': {
        	    transform: 'scaleY(0)',
        	    opacity: '0',
        	  },
        	  '50%': {
        	    transform: 'scaleY(1)',
        	    opacity: '0.7', // A slight transparency looks nice
        	  },
        	},

			'logo-flow': {
        	  '0%, 100%': {
        	    opacity: '0',
        	    transform: 'translateX(-10px)',
        	  },
        	  '25%': {
        	    opacity: '1',
        	    transform: 'translateX(0)',
        	  },
        	  '75%': {
        	    opacity: '1',
        	    transform: 'translateX(0)',
        	  },
        	  '90%': {
        	    opacity: '0',
        	  },
        	},

			'glitch': {
        	  '0%': {
        	    transform: 'translate(0)',
        	  },
        	  '20%': {
        	    transform: 'translate(-5px, 5px)',
        	  },
        	  '40%': {
        	    transform: 'translate(-5px, -5px)',
        	  },
        	  '60%': {
        	    transform: 'translate(5px, 5px)',
        	  },
        	  '80%': {
        	    transform: 'translate(5px, -5px)',
        	  },
        	  '100%': {
        	    transform: 'translate(0)',
        	  },
        	},

			'shimmer': {
          		"0%": { backgroundPosition: "-200% 0" },
          		"100%": { backgroundPosition: "200% 0" },
        	},
			'slow-pan': {
          		'0%': { transform: 'scale(1.05) translate(-2%, 2%)' },
          		'100%': { transform: 'scale(1.05) translate(2%, -2%)' },
        	},
        	'twinkle': {
          		'0%, 100%': { opacity: '0.5' },
          		'50%': { opacity: '1' },
        	},
			'scroll': {
				to: { transform: 'translate(calc(-50% - 0.5rem))' },
			},
			marquee: {
				from: { transform: "translateX(0)" },
				to: { transform: "translateX(calc(-100% - var(--gap)))" },
			},
			"marquee-vertical": {
				from: { transform: "translateY(0)" },
				to: { transform: "translateY(calc(-100% - var(--gap)))" },
			},
	},
  		animation: {
			'wobble': 'wobble 0.8s infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'float': 'float 3s ease-in-out infinite',
  			'aurora': 'aurora 60s linear infinite',
  			'shimmer-slide': 'shimmer-slide var(--speed) ease-in-out infinite alternate',
  			'spin-around': 'spin-around calc(var(--speed) * 2) infinite linear',
			'pulse-sparkle': 'pulse-sparkle 1.5s infinite ease-in-out',
        	'fade-twinkle': 'fade-twinkle 1.5s infinite ease-in-out',
			'search-pop-lens': 'search-pop-lens 1s infinite ease-in-out',
        	'search-pop-handle': 'search-pop-handle 1s infinite ease-in-out',
        	'file-jiggle': 'file-jiggle 0.8s infinite ease-in-out',
        	'text-slide-in': 'text-slide-in 1.5s infinite ease-out', 
			 'sun-set': 'sun-set 2s infinite ease-in-out',   // Was 4s
        	'moon-rise': 'moon-rise 2s infinite ease-in-out',
			'message-vibrate': 'message-vibrate 0.6s infinite linear',
        	'reply-arrow': 'reply-arrow 1.2s infinite ease-in-out',

			'book-flutter': 'book-flutter 1.2s infinite ease-in-out',
			'mic-fill': 'mic-fill 1.5s infinite ease-in-out',
			'logo-flow': 'logo-flow 1.5s infinite ease-in-out',
			'glitch': 'glitch 1.5s linear infinite',
			'shimmer': 'shimmer 2s linear infinite',
			'slow-pan': 'slow-pan 25s ease-in-out infinite alternate',
        	'twinkle': 'twinkle 4s ease-in-out infinite',
			'scroll': 'scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite',
			marquee: "marquee var(--duration, 40s) linear infinite",
			"marquee-vertical":
				"marquee-vertical var(--duration, 40s) linear infinite",
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
