const createMediaQuery = (n: string | number) => `@media screen and (min-width:${n})`

const addAliases = (arr: any, aliases: any[]) =>
  aliases.forEach((key, i) =>
    Object.defineProperty(arr, key, {
      enumerable: false,
      get() {
        return this[i]
      }
    })
  )

export const breakpoints = [32, 40, 48, 64].map(n => n + 'em');

export const mediaQueries = breakpoints.map(createMediaQuery)

const aliases = ['sm', 'md', 'lg', 'xl']

addAliases(breakpoints, aliases)
addAliases(mediaQueries, aliases)

export const space = [0, 4, 8, 16, 32, 64, 128]

export const fontFamily = `'IBM Plex Sans', sans-serif`

export const fontSizes = [10, 14, 16, 20, 24, 32, 40, 56, 72]

export const medium = 300
export const bold = 700
export const regular = 400

// styled-system's `fontWeight` function can hook into the `fontWeights` object
export const fontWeights = {
  medium,
  bold,
  regular
}

export const lineHeights = {
  standard: 1.5,
  display: 1.25
}

const letterSpacings = {
  normal: 'normal',
  caps: '0.025em'
}

export const textStyles = {
  display8: {
    fontSize: fontSizes[8] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display7: {
    fontSize: fontSizes[7] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display6: {
    fontSize: fontSizes[6] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display5: {
    fontSize: fontSizes[5] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display4: {
    fontSize: fontSizes[4] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display3: {
    fontSize: fontSizes[3] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display2: {
    fontSize: fontSizes[2] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display1: {
    fontSize: fontSizes[1] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display
  },
  display0: {
    fontSize: fontSizes[0] + 'px',
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
    letterSpacing: letterSpacings.caps,
    textTransform: 'uppercase'
  },
  body2: {
    fontSize: fontSizes[2] + 'px',
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.standard
  },
  body1: {
    fontSize: fontSizes[1] + 'px',
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.standard
  },
  body0: {
    fontSize: fontSizes[0] + 'px',
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.standard
  }
}


// color palette
const black = "#000";
const white = "#fff";
const textBlack = "#1e252e"
//// Gray
const lightGray = "#ebeff3";
const midGray = "#c9d3df";
const gray = "#8393A7";
const darkGray = "#53657d";
//// Blue
const lightBlue = "#cdf";
const blue = "#0055d5";
const darkBlue = "#049";
//// Green
const lightGreen = "#00ff77";
const green = "#00C05A"; // secondary
const darkGreen = "#00823c";
//// Red
const lightRed = "#fcc";
const red = "#c00"; // secondary
const darkRed = "#800";
//// Orange
const orange = "#fa0"; // secondary
const darkOrange = "#a50";
//// Purple
const lightPurple = "#ecf";
const purple = "#70b"; // secondary

// Color Themes
// should use colors from the palette above
//// Light color theme
// const text = "#001833";
const text = textBlack;
const textHighlight = blue;
const headerText = lightGray;
const headerBg = blue;
const headerIconColor = lightGray
const headerIconColor2 = midGray;
// const borderGray = "#d1d6db";
const borderGray = midGray; //used for borders of cards, pagination, sidebar
//const paginationHoverColor = "#f7f7f7"
const paginationHoverColor = lightBlue;
const paginationDisabled = lightGray;
// Icons colors
const iconColor = darkGray;
const iconColor2 = gray;
const spinnerColor = blue;


const colors = {
  black,
  white,
  lightGray,
  midGray,
  gray,
  darkGray,
  blue,
  lightBlue,
  darkBlue,
  green,
  lightGreen,
  darkGreen,
  red,
  lightRed,
  darkRed,
  orange,
  darkOrange,
  purple,
  lightPurple,
  text,
  textHighlight,
  headerText,
  headerBg,
  headerIconColor,
  headerIconColor2,
  borderGray,
  paginationHoverColor,
  paginationDisabled,
  iconColor,
  iconColor2,
  spinnerColor,
}

export type ThemeColor = keyof typeof colors;


export { colors }

export const colorStyles = {
  whiteOnText: {
    color: colors.white,
    backgroundColor: colors.text
  },
  whiteOnGray: {
    color: colors.white,
    backgroundColor: colors.gray
  },
  textOnLightGray: {
    color: colors.text,
    backgroundColor: colors.lightGray
  },
  whiteOnBlue: {
    color: colors.white,
    backgroundColor: colors.blue
  },
  blueOnLightBlue: {
    color: colors.blue,
    backgroundColor: colors.lightBlue
  },
  whiteOnGreen: {
    color: colors.white,
    backgroundColor: colors.green
  },
  greenOnLightGreen: {
    color: colors.green,
    backgroundColor: colors.lightGreen
  },
  whiteOnRed: {
    color: colors.white,
    backgroundColor: colors.red
  },
  redOnLightRed: {
    color: colors.red,
    backgroundColor: colors.lightRed
  },
  textOnOrange: {
    color: colors.text,
    backgroundColor: colors.orange
  },
  whiteOnPurple: {
    color: colors.white,
    backgroundColor: colors.purple
  },
  purpleOnLightPurple: {
    color: colors.purple,
    backgroundColor: colors.lightPurple
  },
  textOnWhite: {
    color: colors.text,
    backgroundColor: colors.white
  },
  grayOnWhite: {
    color: colors.gray,
    backgroundColor: colors.white
  },
  blueOnWhite: {
    color: colors.blue,
    backgroundColor: colors.white
  },
  greenOnWhite: {
    color: colors.green,
    backgroundColor: colors.white
  },
  redOnWhite: {
    color: colors.red,
    backgroundColor: colors.white
  },
  purpleOnWhite: {
    color: colors.purple,
    backgroundColor: colors.white
  },
  whiteOnDarkOrange: {
    color: colors.white,
    backgroundColor: colors.darkOrange
  },
  // info: textOnLightGray
  info: {
    color: colors.text,
    backgroundColor: colors.lightGray
  },
  // success: whiteOnGreen
  success: {
    color: colors.white,
    backgroundColor: colors.green
  },
  //warning: textOnOrange
  warning: {
    color: colors.text,
    backgroundColor: colors.orange
  },
  // danger: whiteOnRed
  danger: {
    color: colors.white,
    backgroundColor: colors.red
  }
}

// styled-system's `borderRadius` function can hook into the `radii` object/array
export const radii = [0, 2, 6]
export const radius = '5px'

export const maxContainerWidth = '1280px'

// boxShadows
export const boxShadows = [
  `0 0 2px 0 rgba(0,0,0,.08),0 1px 4px 0 rgba(0,0,0,.16)`,
  `0 0 2px 0 rgba(0,0,0,.08),0 2px 8px 0 rgba(0,0,0,.16)`,
  `0 0 2px 0 rgba(0,0,0,.08),0 4px 16px 0 rgba(0,0,0,.16)`,
  `0 0 2px 0 rgba(0,0,0,.08),0 8px 32px 0 rgba(0,0,0,.16)`
]

// animation duration
export const duration = {
  fast: `150ms`,
  normal: `300ms`,
  slow: `450ms`,
  slowest: `600ms`
}

// animation easing curves
const easeInOut = 'cubic-bezier(0.5, 0, 0.25, 1)'
const easeOut = 'cubic-bezier(0, 0, 0.25, 1)'
const easeIn = 'cubic-bezier(0.5, 0, 1, 1)'

const timingFunctions = {
  easeInOut,
  easeOut,
  easeIn
}

// animation delay
const transitionDelays = {
  small: `60ms`,
  medium: `160ms`,
  large: `260ms`,
  xLarge: `360ms`
}

const theme = {
  breakpoints,
  mediaQueries,
  space,
  fontFamily,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  regular,
  bold,
  textStyles,
  colors,
  colorStyles,
  radii,
  radius,
  boxShadows,
  maxContainerWidth,
  duration,
  timingFunctions,
  transitionDelays
}

export type Theme = typeof theme

export default theme
