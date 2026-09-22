import type { GlobalThemeOverrides } from 'naive-ui'

/** Naive theme for Admin Mission Control shell (visual only). */
export const adminThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3b82f6',
    primaryColorHover: '#60a5fa',
    primaryColorPressed: '#2563eb',
    successColor: '#34d399',
    warningColor: '#fbbf24',
    errorColor: '#f87171',
    infoColor: '#38bdf8',
    borderRadius: '10px',
    bodyColor: '#141e33',
    cardColor: 'rgba(36, 48, 76, 0.94)',
    modalColor: '#1e2a44',
    popoverColor: '#24314e',
    tableColor: 'rgba(36, 48, 76, 0.94)',
    inputColor: 'rgba(28, 38, 62, 0.88)',
    actionColor: 'rgba(186, 203, 225, 0.1)',
    hoverColor: 'rgba(59, 130, 246, 0.14)',
    pressedColor: 'rgba(59, 130, 246, 0.2)',
    textColorBase: '#f4f7fc',
    textColor1: '#f4f7fc',
    textColor2: 'rgba(226, 232, 240, 0.92)',
    textColor3: 'rgba(196, 208, 224, 0.82)',
    borderColor: 'rgba(186, 203, 225, 0.26)',
    dividerColor: 'rgba(186, 203, 225, 0.18)',
  },
  Button: {
    textColorPrimary: '#f8fafc',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#e2e8f0',
  },
  Tag: {
    colorBordered: 'rgba(148, 163, 184, 0.14)',
  },
  Drawer: {
    color: '#182238',
  },
  Spin: {
    color: '#3b82f6',
  },
}
