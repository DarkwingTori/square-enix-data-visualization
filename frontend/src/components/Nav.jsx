const ACTS = [
  { id: 'hero',   label: 'Intro' },
  { id: 'act1',   label: 'I — Two Kingdoms' },
  { id: 'act2',   label: 'II — Cold War' },
  { id: 'act3',   label: 'III — Merger' },
  { id: 'act4',   label: 'IV — Genres' },
  { id: 'act5',   label: 'V — Franchises' },
  { id: 'act6',   label: 'VI — Explorer' },
];

export default function Nav({ activeAct }) {
  return (
    <nav className="site-nav">
      <div className="site-nav__brand">SQUARE ENIX — A DATA STORY</div>
      <div className="site-nav__links">
        {ACTS.map(a => (
          <a
            key={a.id}
            href={`#${a.id}`}
            className={`site-nav__link${activeAct === a.id ? ' active' : ''}`}
          >
            {a.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
