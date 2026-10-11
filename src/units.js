// Everything is stored in centimeters. These helpers convert only for display.

export const CM_PER_INCH = 2.54

export function toDisplay(cm, units) {
  return units === 'in' ? cm / CM_PER_INCH : cm
}

export function fromDisplay(value, units) {
  return units === 'in' ? value * CM_PER_INCH : value
}

// A length as text in the given unit: inches to one decimal place (with no
// trailing ".0"), centimeters as whole numbers. 152.4 cm → "60" in, "152" cm.
export function formatNumber(value, units) {
  const decimals = units === 'cm' ? 1 : 10
  return String(Math.round(value * decimals) / decimals)
}

// e.g. formatLength(152.4, 'in') → "60 in"
export function formatLength(cm, units) {
  return `${formatNumber(toDisplay(cm, units), units)} ${units}`
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
