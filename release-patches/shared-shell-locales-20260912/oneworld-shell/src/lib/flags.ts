/**
 * BUNDLED FLAGS — the language picker's flags, shipped IN the app (Lee, 17 Aug 2026:
 * "the flag isn't showing... that's part of our shell"). They used to load from an
 * external CDN at runtime, which meant ad-blockers, offline PWAs and locked-down
 * networks showed the two-letter fallback instead of the flag. ~1KB each, seven total.
 */
export const FLAG_DATA: Record<string, string> = {
  us: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAVBAMAAADGNLEtAAAALVBMVEX////GU3LZjKGzGUINM2PsxtAYPWotT3hed5enma46WoBPa46zGkMkR3Jrgp+6ntXWAAAAiklEQVQY02Nwc0lJcQMSxghgw+CRVdaWkVXWooQEGFxaPLxKWjxcGJCBn1fJExAWRAJglUuAKlEEPdyXgA1A0e62LTu9bFt2CopF3iCh9LItKE5yX5tVe31tVgmq9pL0NLcy95RQJMAAdiUQo2ifCQUoKrECY0xgw6CEBWDXLogFYBfECrBahM1JAItMTcEiMDpsAAAAAElFTkSuQmCC",
  co: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAbBAMAAAD8PtBdAAAAD1BMVEUAMIfIEC7/zQCWGER/fkQonp92AAAAHklEQVQoz2NQwgIYRrKgCxbAMLDAGAtgEMQC6CYIAA/lM811RVp8AAAAAElFTkSuQmCC",
  es: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAbCAMAAAA5zj1cAAAApVBMVEX6vQCtFRnBPxP3tgCkSRTxsQC9miCtkjL3ugDcdwrVkwndpwauUEi3k3ecLQyvGx01YomtXy3Zhha+gw+4LiCzn4jKeBKyYgjmoAOkXUK/RhC1kJmmKh+0oKCbYwN5OAWWHxSVi0HypQNcdGsDAgC9g1j6vgSWhnLfsSXCn169cE24eBuaNwzQaiOYagW8bxWIOhqoKhPLdq4yUHR+UgVZLWaBHkAs3esWAAAAk0lEQVQ4y+WTVxLDIAxESQwBAwb33tKc3sv9j5YbWJp8JvurNzsrzYpMkCI/BU6RIt9phqIcJSOpEGBu7c2WA+iXOWmbtTmTACh42PdelSgwp+d2nXdvTjuAc3X5vL6qJo4XQEZ9qd8PXaR7yDE5GFOf6XbNRrmB8cgcKaUraJm5z4NiE4RLH3FyIUaG6Pb85XN9AIg9CvrV7UGSAAAAAElFTkSuQmCC",
  de: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAYAgMAAAD16ldTAAAACVBMVEUAAADdAAD/zgDGIigcAAAAFUlEQVQY02NgoBEIhQPqMlfBAVWZANYST7G6bxb2AAAAAElFTkSuQmCC",
  ru: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAbAgMAAABzfiX9AAAACVBMVEUAOabVKx7///95ANL1AAAAFUlEQVQY02NYBQcMtGLSAYTCAa2YAJQLWaccQRfwAAAAAElFTkSuQmCC",
  cn: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAbCAMAAAA5zj1cAAAAOVBMVEXuHCX3jRL//wDuISPyURvvLCH6ugrwPh7xSRz0ZxjwNyD1ehX+6QP7wgn/+AH5ow793wX3lhHzXBqicYSuAAAAX0lEQVQYGe3BSRKCQBAAweplVgYB//9YY/QMdHgmk7+kxB1janvhhjD5mzvD+XHn3CKbriIJsG3lXMqqOipTMa4MVSegvo5d+KqdC61gwmQ5GyG9E+ALMS0XYhKPR9wHPPwBnsz8tAoAAAAASUVORK5CYII=",
  br: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAcCAMAAAAkyw3kAAAAkFBMVEUAlED/ywAwJoEOlzwemjdQSI83oDHjxQZKpC2fthhGN3NAM3VZU5fywAjEmyQ/NYf5yQFoU101K4OVd0OvuRRzdKTSwQuOshx8ryFjqifCvQ+p0MFGP4y8w8q+0tKXrLjwyATrxwXltRC+lyhkXp+JdW12XlWkgji0uM+rqnXr8vDS593K4tmZflSJj7ROQ3x/jyqZAAAA70lEQVQ4y82T2RKCMAxFTaEKBSwUcQEUF9y3//87IwVxpEp9cbyPmTNZbpJO56/U7WphxghgZLRzVg9QPasFM20oZX9MOpmDFwaOE4QeLCbv08UAfUYKsT5AbKq5sY8ceQhJf6zyZIiNeawGmYeB4atThhxiPzsektku4i6SW8VQ0hOAtStE6kZZMkVyI2NPTpmDypOqMo2SLGVVdGA2QAchLtnLKWqAdemAins+eifzaaN0PUzICTYniurpWb2hwp6lQzjFjJzQnC5V9lSGr8ppXC5Wbwx/WeH1wwr1j+KLM9M/XPkKvs4r6D/Xz3QDO1IMs+uu/zEAAAAASUVORK5CYII=",
};

/** Bundled flag when we ship it, CDN for anything else (currency lists cover ~50 countries —
 *  bundling all of those is not worth the bytes; the 7 language flags are the ones in the
 *  header and pickers that Lee flagged as missing). */
export const flagSrc = (cc: string | undefined | null, size: "w40" | "w80" = "w40"): string =>
  (cc && FLAG_DATA[cc]) || `https://flagcdn.com/${size}/${cc}.png`;
