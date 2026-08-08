import { createTheme, type MantineColorsTuple } from '@mantine/core';

const orange: MantineColorsTuple = [
  '#fff3e0',
  '#ffe0b8',
  '#ffca8c',
  '#ffb35d',
  '#ff9f37',
  '#f76707',
  '#e85d00',
  '#cf5200',
  '#b74700',
  '#9e3c00',
];

const dark: MantineColorsTuple = [
  '#c1c2c5',
  '#909296',
  '#5c5f66',
  '#3a3d42',
  '#2c2e33',
  '#25262b',
  '#1c1d21',
  '#18191c',
  '#141517',
  '#0f1011',
];

export const theme = createTheme({
  fontFamily: 'Inter, system-ui, sans-serif',
  primaryColor: 'accent',
  primaryShade: 5,
  defaultRadius: 'xs',
  colors: {
    accent: orange,
    dark,
  },
  radius: {
    xs: '2px',
    sm: '2px',
    md: '2px',
    lg: '4px',
    xl: '6px',
  },
  black: '#141517',
  components: {
    Drawer: {
      defaultProps: {
        radius: 0,
      },
    },
  },
});
