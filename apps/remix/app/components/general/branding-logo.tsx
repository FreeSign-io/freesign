import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * FreeSign brand mark + wordmark.
 *
 * - The 320x320 rounded tile uses the FreeSign emerald (#10b981) so the brand
 *   color is preserved across light and dark themes.
 * - The "FreeSign" wordmark inherits the surrounding text color via
 *   `currentColor`, so it flips between dark text on light backgrounds and
 *   light text on dark backgrounds without any extra wiring.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2248 320"
      role="img"
      aria-label="FreeSign"
      {...props}
    >
      <rect x="0" y="0" width="320" height="320" rx="64" ry="64" fill="#10b981" />
      <text
        x="160"
        y="232"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
        fontSize="220"
        fontWeight="800"
        fill="#000"
        textAnchor="middle"
        letterSpacing="-8"
      >
        F
      </text>
      <text
        x="380"
        y="226"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
        fontSize="200"
        fontWeight="800"
        fill="currentColor"
        letterSpacing="-8"
      >
        FreeSign
      </text>
    </svg>
  );
};
