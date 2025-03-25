module.exports = {
  content: ["./*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-bg-primary)',
        secondary: 'var(--color-bg-secondary)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
        // Aggiungi tutte le variabili CSS
      }
    },
  },
  plugins: [],
}