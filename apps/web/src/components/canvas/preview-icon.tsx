const paths: Record<string, string> = {
  draw: 'M4 17.5 3 21l3.5-1L19 7.5q2-2 0-4t-4 0ZM13.5 5l5 5M8 21h12',
  comment: 'M7 4h10q4 0 4 4v6q0 4-4 4h-5l-5 3v-3q-4 0-4-4V8q0-4 4-4ZM8 10h8M8 14h4',
  close: 'm7 7 10 10M17 7 7 17',
  plus: 'M12 5v14M5 12h14',
  reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  ambient: 'M9 4H7q-3 0-3 3v2m11-5h2q3 0 3 3v2M4 15v2q0 3 3 3h2m11-5v2q0 3-3 3h-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  float: 'M13 4h5q2 0 2 2v5M20 4l-8 8M9 4H6q-2 0-2 2v12q0 2 2 2h12q2 0 2-2v-3',
  dock: 'M7 4h10q3 0 3 3v10q0 3-3 3H7q-3 0-3-3V7q0-3 3-3Zm2 0v16m8-12-4 4 4 4m-4-4h6',
  inspect: 'M9 3H6q-3 0-3 3v3m12-6h3q3 0 3 3v3M3 15v3q0 3 3 3h3m12-6v3q0 3-3 3h-3M9 9l7 3-3 1-1 3Z',
  camera: 'M8 5l1-2h6l1 2h3q2 0 2 2v11q0 2-2 2H5q-2 0-2-2V7q0-2 2-2Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  record: 'M5 5h10q2 0 2 2v10q0 2-2 2H5q-2 0-2-2V7q0-2 2-2Zm12 5 4-3v10l-4-3M8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  chat: 'M7 4h10q4 0 4 4v6q0 4-4 4h-5l-5 3v-3q-4 0-4-4V8q0-4 4-4ZM8 9h8M8 13h5',
  start: 'M6 6v12M17 7.5Q17 6.2 16 6.9L10 11Q8.5 12 10 13L16 17.1Q17 17.8 17 16.5Z',
  end: 'M18 6v12M7 7.5Q7 6.2 8 6.9L14 11Q15.5 12 14 13L8 17.1Q7 17.8 7 16.5Z',
  previous: 'M6 5v14M17 7l-7 5 7 5Z',
  next: 'M18 5v14M7 7l7 5-7 5Z',
  play: 'M8 7.2Q8 5.5 9.5 6.4L17.4 11.1Q19 12 17.4 12.9L9.5 17.6Q8 18.5 8 16.8Z',
  pause: 'M8.5 6.5v11M15.5 6.5v11',
  loop: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
  volume: 'M10 5 5 9H2v6h3l5 4ZM14 9a5 5 0 0 1 0 6m3-10a10 10 0 0 1 0 14',
  muted: 'M10 5 5 9H2v6h3l5 4Zm5 4 6 6m0-6-6 6',
  fullscreen: 'M9 4H6Q4 4 4 6v3m11-5h3q2 0 2 2v3M4 15v3q0 2 2 2h3m11-5v3q0 2-2 2h-3',
  collapse: 'M4 9h3q2 0 2-2V4m11 5h-3q-2 0-2-2V4M4 15h3q2 0 2 2v3m11-5h-3q-2 0-2 2v3',
  keyboard: 'M6 5h12q3 0 3 3v8q0 3-3 3H6q-3 0-3-3V8q0-3 3-3ZM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8',
  chevron: 'm7 10 5 5 5-5',
  move: 'M6 6q0-2 1.6-.8l11.2 8.2q1.5 1.1-.5 1.1h-4.4q-1 0-1.6.8L8 19q-2 2-2-.5Z',
  frame: 'M4 8h16M4 16h16M8 4v16M16 4v16',
  rectangle: 'M7 4h10q3 0 3 3v10q0 3-3 3H7q-3 0-3-3V7q0-3 3-3Z',
  text: 'M4 7V4h16v3M12 4v16m-4 0h8',
};
/** One optical size and stroke throughout the canvas dock. */
export function PreviewIcon(props: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
    stroke-linecap="round" stroke-linejoin="round" class="syka-preview-icon" aria-hidden="true"><path d={paths[props.name] ?? paths.move} /></svg>;
}
