export default function EffectIcon({ type }) {
  return (
    <svg className="effect-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === "block" && <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m5 19 14-14" /></>}
      {type === "scatter" && <><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z" /><path d="M12 9v6M9 12h6" /></>}
      {type === "double" && <><path d="M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4" /><path d="m10 6 2 2 2-2M10 18h4" /></>}
      {type === "erase" && <><path d="M5 11a7 7 0 1 1 14 0v4l-3 1v5H8v-5l-3-1Z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /><path d="m11 15 1-2 1 2M11 18v3M13 18v3" /></>}
    </svg>
  );
}
