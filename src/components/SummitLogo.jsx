export function SummitLogo({ className = "w-8 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="summitGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer shield/crest border */}
      <path d="M50 8 L88 27 V58 C88 75 72 88 50 91 C28 88 12 75 12 58 V27 L50 8 Z" stroke="url(#summitGrad)" strokeWidth="3" fill="none" />
      {/* Overlapping geometric peaks (The Summit) */}
      <path d="M22 65 L40 38 L54 65 Z" fill="rgba(59, 130, 246, 0.25)" stroke="#3b82f6" strokeWidth="1" />
      <path d="M46 65 L60 44 L78 65 Z" fill="rgba(29, 78, 216, 0.25)" stroke="#1d4ed8" strokeWidth="1" />
      <path d="M32 65 L50 24 L68 65 Z" fill="url(#summitGrad)" opacity="0.85" filter="url(#glow)" />
      {/* Blockchain node dots interlinking the peaks */}
      <circle cx="50" cy="24" r="3" fill="#fcd34d" />
      <circle cx="40" cy="38" r="2.5" fill="#ffffff" stroke="#3b82f6" strokeWidth="1" />
      <circle cx="60" cy="44" r="2.5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1" />
      {/* Connecting node lines */}
      <line x1="50" y1="24" x2="40" y2="38" stroke="#fcd34d" strokeWidth="1.2" strokeDasharray="2,2" />
      <line x1="50" y1="24" x2="60" y2="44" stroke="#fcd34d" strokeWidth="1.2" strokeDasharray="2,2" />
    </svg>
  );
}
