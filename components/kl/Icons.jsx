const icon = (path, opts = {}) =>
  function KLIconComp({ size = 14 }) {
    return (
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill={opts.fill ? 'currentColor' : 'none'}
        stroke={opts.fill ? 'none' : 'currentColor'}
        strokeWidth={opts.sw || 1.4}
        strokeLinecap={opts.lc || undefined}
        strokeLinejoin={opts.lj || undefined}
      >
        {path}
      </svg>
    );
  };

export const KLIcon = {
  search: icon(
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
    </>,
    { sw: 1.5 }
  ),
  cube: icon(
    <>
      <path d="M8 1.5 14 5v6L8 14.5 2 11V5Z" />
      <path d="M2 5l6 3.5L14 5M8 8.5v6" />
    </>
  ),
  layers: icon(
    <>
      <path d="M8 1.5 1.5 5 8 8.5 14.5 5Z" />
      <path d="m1.5 8.5 6.5 3.5 6.5-3.5" />
      <path d="m1.5 11.5 6.5 3.5 6.5-3.5" />
    </>,
    { lj: 'round' }
  ),
  shield: icon(
    <>
      <path
        d="M8 1.5 13.5 4v4.5c0 3-2.5 5.4-5.5 6-3-.6-5.5-3-5.5-6V4Z"
        strokeLinejoin="round"
      />
      <path d="m6 8.2 1.5 1.5L10.5 6.7" strokeLinecap="round" />
    </>
  ),
  cluster: icon(
    <>
      <circle cx="8" cy="8" r="6.2" />
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2" />
    </>
  ),
  terminal: icon(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="m4 6 2.5 2L4 10M8 10.5h4" />
    </>,
    { lc: 'round' }
  ),
  file: icon(
    <>
      <path d="M3 1.5h6l3.5 3.5v9a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 1.5V5h3.5" />
    </>,
    { lj: 'round' }
  ),
  chevron: icon(<path d="m6 4 4 4-4 4" strokeLinecap="round" />, { sw: 1.6 }),
  plus: icon(<path d="M8 3v10M3 8h10" strokeLinecap="round" />, { sw: 1.6 }),
  refresh: icon(
    <>
      <path d="M2.5 8a5.5 5.5 0 0 1 9.5-3.8L13.5 5.5" strokeLinecap="round" />
      <path
        d="M13.5 2.5v3h-3M13.5 8a5.5 5.5 0 0 1-9.5 3.8L2.5 10.5"
        strokeLinecap="round"
      />
      <path d="M2.5 13.5v-3h3" strokeLinecap="round" />
    </>
  ),
  check: icon(
    <path
      d="m3 8.5 3.5 3.5 6.5-7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    { sw: 1.6 }
  ),
  upload: icon(
    <>
      <path
        d="M8 10V2m0 0L5 5m3-3 3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 12.5h11" strokeLinecap="round" />
    </>
  ),
  copy: icon(
    <>
      <rect x="4.5" y="4.5" width="9" height="9" rx="1" />
      <path d="M2.5 11V3a.5.5 0 0 1 .5-.5h8" />
    </>
  ),
};
