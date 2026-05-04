import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

const helper = createColumnHelper();

const COLUMNS = [
  helper.accessor('title',        { header: 'Title',         size: 220 }),
  helper.accessor('company_era',  { header: 'Era',           size: 100 }),
  helper.accessor('series',       { header: 'Franchise',     size: 140 }),
  helper.accessor('genre',        { header: 'Genre',         size: 120 }),
  helper.accessor('release_year', { header: 'Year',          size: 70,  sortingFn: 'alphanumeric' }),
  helper.accessor('platform_family', { header: 'Platform',   size: 110 }),
  helper.accessor('exclusivity_status', { header: 'Excl.',   size: 90  }),
  helper.accessor(row => row.avg_critic ? row.avg_critic.toFixed(0) : '—', {
    id: 'critic', header: 'Critic', size: 70,
  }),
  helper.accessor(row => row.total_sales > 0 ? `${row.total_sales.toFixed(2)}M` : '—', {
    id: 'sales', header: 'Sales', size: 80,
  }),
];

export default function GameTable({ titles }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [eraFilter,    setEraFilter]    = useState('');
  const [platFilter,   setPlatFilter]   = useState('');
  const [genreFilter,  setGenreFilter]  = useState('');
  const [sorting,      setSorting]      = useState([{ id: 'release_year', desc: false }]);

  const filtered = useMemo(() => {
    let data = titles || [];
    if (eraFilter)   data = data.filter(t => t.company_era === eraFilter);
    if (platFilter)  data = data.filter(t => t.platforms?.includes(platFilter));
    if (genreFilter) data = data.filter(t => t.genre === genreFilter);
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      data = data.filter(t => t.title?.toLowerCase().includes(q) || t.series?.toLowerCase().includes(q));
    }
    return data;
  }, [titles, eraFilter, platFilter, genreFilter, globalFilter]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const eras      = ['', 'Squaresoft', 'Enix', 'Square Enix'];
  const platforms = ['', 'Nintendo', 'PlayStation', 'PC', 'Microsoft', 'Mobile', 'Sega'];
  const genres    = useMemo(() => ['', ...new Set((titles || []).filter(t => t.genre).map(t => t.genre)).values()], [titles]);

  return (
    <div style={{ width: '100%' }}>
      {/* Filters */}
      <div className="explorer-filters" style={{ marginBottom: 16 }}>
        <input
          placeholder="Search titles or franchises…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 6,
            fontSize: 12, fontFamily: 'var(--font-body)', width: 220,
          }}
        />
        <select className="filter-select" value={eraFilter} onChange={e => setEraFilter(e.target.value)}>
          <option value="">All Eras</option>
          {eras.slice(1).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={platFilter} onChange={e => setPlatFilter(e.target.value)}>
          <option value="">All Platforms</option>
          {platforms.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
          <option value="">All Genres</option>
          {genres.slice(1).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} titles
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
        <table className="game-table">
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    style={{ width: h.column.columnDef.size }}
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.slice(0, 300).map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
