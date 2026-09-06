const paths: Record<string, string> = {
  fit: 'M3 6.5V3.5h3M13 6.5V3.5h-3M3 9.5v3h3M13 9.5v3h-3',
  expand: 'M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10',
  download: 'M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10',
  image: 'M2.5 3.5h11v9h-11zM2.5 10l3-3 2.5 2.5L10.5 7l3 3M6 6.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0',
  sun: 'M8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1',
  moon: 'M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6',
  panel: 'M2.5 3h11v10h-11zM6.5 3v10',
  print: 'M4.5 6V2.5h7V6M4.5 11.5h-2v-4h11v4h-2M4.5 9.5h7v4h-7z',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5V6h3',
  problems: 'M8 2.5 14.5 13h-13zM8 6.5v3M8 11.2v.6',
}

export function Icon({ name, size = 15 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? ''} />
    </svg>
  )
}
