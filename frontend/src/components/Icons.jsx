const PATHS = {
  journal: (
    <>
      <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h5M8.5 12h7M8.5 15.5h5" />
    </>
  ),
  behavior: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 19.5c1.2-3.2 3.3-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m4.5 16 4.2-4 3 2.8 2.3-2 5.5 4.7" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.2l2.8 1.8" />
    </>
  ),
  evaluation: (
    <>
      <path d="M5 19V10M12 19V5M19 19v-6" />
    </>
  ),
  next: <path d="M5 12h14M13 6l6 6-6 6" />,
  feel: (
    <>
      <path d="M12 4.5a7.5 7.5 0 1 0 0 15" />
      <path d="M12 12 16.5 8" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </>
  ),
  chevronRight: (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  check: (
    <>
      <path d="m5 13 4 4L19 7" />
    </>
  ),
}

export default function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
