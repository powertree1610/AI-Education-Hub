/** The sprout mark — growth, which is the whole product. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#0f766e" />
      <path
        d="M16 25v-8m0 0c0-4-2.7-6.5-7-6.5 0 4.2 2.8 6.5 7 6.5Zm0-2c0-4.8 3-7.5 7.5-7.5 0 5-3.2 7.5-7.5 7.5Z"
        stroke="#ccfbf1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
