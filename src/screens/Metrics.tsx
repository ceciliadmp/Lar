import { useEffect, useMemo, useState } from 'react';
import type { Actions } from '../App';
import { Avatar } from '../components/ui';
import { avatarFor, type HouseView, type StatsView } from '../state';

type Range = 'day' | 'week' | 'month' | 'year';

const RANGES: { id: Range; label: string }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
];

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* ---------- datas como 'AAAA-MM-DD' ---------- */

const parse = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (k: string, n: number) => {
  const d = parse(k);
  d.setDate(d.getDate() + n);
  return key(d);
};
/** Segunda-feira da semana de `k`. */
const weekStart = (k: string) => plusDays(k, -((parse(k).getDay() + 6) % 7));

interface Bucket {
  id: string;
  /** Rótulo curto no eixo. */
  label: string;
  /** Nome completo (dica e descrição para leitor de tela). */
  full: string;
  start: string;
  end: string;
  current: boolean;
}

/** Os períodos do gráfico: 14 dias, 12 semanas, 12 meses ou os anos com dados. */
function buckets(range: Range, today: string, firstDay: string | null): Bucket[] {
  const out: Bucket[] = [];
  if (range === 'day') {
    for (let i = 13; i >= 0; i--) {
      const k = plusDays(today, -i);
      const d = parse(k);
      out.push({ id: k, label: String(d.getDate()), full: `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, start: k, end: k, current: i === 0 });
    }
  } else if (range === 'week') {
    const ws = weekStart(today);
    for (let i = 11; i >= 0; i--) {
      const s = plusDays(ws, -7 * i);
      const e = plusDays(s, 6);
      const d = parse(s);
      const de = parse(e);
      out.push({
        id: s,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        full: `semana de ${d.getDate()} ${MONTHS[d.getMonth()]} a ${de.getDate()} ${MONTHS[de.getMonth()]}`,
        start: s,
        end: e,
        current: i === 0,
      });
    }
  } else if (range === 'month') {
    const t = parse(today);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      out.push({
        id: key(d),
        label: MONTHS[d.getMonth()],
        full: `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`,
        start: key(d),
        end: key(last),
        current: i === 0,
      });
    }
  } else {
    const y = parse(today).getFullYear();
    const first = Math.min(firstDay ? parse(firstDay).getFullYear() : y, y);
    for (let yy = Math.max(first, y - 5); yy <= y; yy++) {
      out.push({ id: String(yy), label: String(yy), full: String(yy), start: `${yy}-01-01`, end: `${yy}-12-31`, current: yy === y });
    }
  }
  return out;
}

const count = (n: number) => (n === 1 ? '1 tarefa' : `${n} tarefas`);

/** Aba Histórico: quantas tarefas foram feitas por dia, semana, mês ou ano. */
export function Metrics({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const [stats, setStats] = useState<StatsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<Range>('day');

  // Busca ao abrir e sempre que algo for marcado ou desmarcado na casa.
  const doneSignature = s.tasks.map((t) => `${t.id}:${Object.keys(t.completions).length}`).join(',');
  useEffect(() => {
    let alive = true;
    void actions.getStats().then((st) => {
      if (!alive) return;
      if (st) setStats(st);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSignature]);

  const data = useMemo(() => {
    if (!stats) return null;
    const days = Object.keys(stats.days).sort();
    const total = (start: string, end: string, member?: string) => {
      let n = 0;
      for (const d of days) {
        if (d < start || d > end) continue;
        const per = stats.days[d];
        n += member ? (per[member] ?? 0) : Object.values(per).reduce((a, b) => a + b, 0);
      }
      return n;
    };
    const t = stats.today;
    const td = parse(t);
    const monthStart = key(new Date(td.getFullYear(), td.getMonth(), 1));
    const prevMonthStart = key(new Date(td.getFullYear(), td.getMonth() - 1, 1));
    const prevMonthEnd = plusDays(monthStart, -1);
    const yearStart = `${td.getFullYear()}-01-01`;
    const ws = weekStart(t);
    const tiles = [
      { label: 'Hoje', value: total(t, t), prev: total(plusDays(t, -1), plusDays(t, -1)), prevLabel: 'ontem' },
      { label: 'Esta semana', value: total(ws, t), prev: total(plusDays(ws, -7), plusDays(ws, -1)), prevLabel: 'semana passada' },
      { label: 'Este mês', value: total(monthStart, t), prev: total(prevMonthStart, prevMonthEnd), prevLabel: 'mês passado' },
      { label: 'Este ano', value: total(yearStart, t), prev: null, prevLabel: '' },
    ];
    const bs = buckets(range, t, days[0] ?? null).map((b) => ({ ...b, value: total(b.start, b.end) }));
    const rangeStart = bs[0].start;
    const rangeEnd = bs[bs.length - 1].end;
    // Quem fez: membros atuais e quem já saiu da casa (se fez algo no período).
    const ids = new Set<string>(s.members.map((m) => m.id));
    for (const d of days) if (d >= rangeStart && d <= rangeEnd) for (const id of Object.keys(stats.days[d])) ids.add(id);
    const people = [...ids]
      .map((id) => ({ id, name: s.members.find((m) => m.id === id)?.name ?? stats.names[id] ?? 'Ex-membro', value: total(rangeStart, rangeEnd, id) }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
    return { tiles, bs, people, any: days.length > 0 };
  }, [stats, range, s.members]);

  const rangeText = { day: 'nos últimos 14 dias', week: 'nas últimas 12 semanas', month: 'nos últimos 12 meses', year: 'por ano' }[range];

  return (
    <div className="screen tab-screen">
      <h1 className="title-l">Histórico</h1>
      <p className="tasks__subtitle">{s.house.name}</p>

      {!data ? (
        <p className="day__empty" style={{ marginTop: 24 }}>{failed ? 'Não foi possível carregar o histórico.' : 'Carregando…'}</p>
      ) : (
        <>
          <div className="kpis">
            {data.tiles.map((k) => (
              <div key={k.label} className="kpi">
                <span className="kpi__label">{k.label}</span>
                <span className="kpi__value">{k.value}</span>
                {k.prev !== null && (
                  <span className="kpi__delta">
                    {k.prevLabel}: {k.prev}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="segmented metrics__ranges" role="group" aria-label="Agrupar por">
            {RANGES.map((r) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>

          <h2 className="section-title">Tarefas feitas {rangeText}</h2>
          {data.any ? (
            <BarChart bars={data.bs} range={range} />
          ) : (
            <p className="day__empty">Ainda não há tarefas feitas. Quando alguém marcar uma tarefa, ela aparece aqui.</p>
          )}


          <h2 className="section-title">Quem fez {rangeText}</h2>
          <ul className="list people-bars">
            {data.people.map((p) => {
              const max = Math.max(1, data.people[0].value);
              const member = s.members.some((m) => m.id === p.id);
              return (
                <li key={p.id} className="people-bars__row">
                  {member ? <Avatar info={avatarFor(s, p.id)} /> : <span className="avatar avatar--sm avatar--gone" aria-hidden="true">·</span>}
                  <div className="people-bars__main">
                    <div className="people-bars__top">
                      <span className="people-bars__name">{p.id === s.meId ? `${p.name} (você)` : p.name}</span>
                      <span className="people-bars__value">{count(p.value)}</span>
                    </div>
                    <div className="people-bars__track" aria-hidden="true">
                      <div className="people-bars__fill" style={{ width: `${(p.value / max) * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- gráfico de barras (uma série, a cor do app) ---------- */

const W = 342;
const H = 200;
const PAD = { top: 22, right: 4, bottom: 26, left: 28 };

/** Topo da escala: o dobro de um passo "redondo" e inteiro, para o meio também ser inteiro. */
function niceMax(v: number) {
  const half = Math.max(1, Math.ceil(v / 2));
  const p = Math.pow(10, Math.floor(Math.log10(half)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (Number.isInteger(m * p) && m * p >= half) return 2 * m * p;
  }
  return 20 * p;
}

/** A dica fica dentro do gráfico: nas pontas, alinha pela borda em vez de centralizar. */
function tipAlign(i: number, n: number): 'start' | 'center' | 'end' {
  if (n > 4 && i <= 1) return 'start';
  if (n > 4 && i >= n - 2) return 'end';
  return 'center';
}

function BarChart({ bars, range }: { bars: (Bucket & { value: number })[]; range: Range }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = niceMax(Math.max(...bars.map((b) => b.value)));
  const ticks = [0, max / 2, max];
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / bars.length;
  const bw = Math.min(24, slot - 2); // no máximo 24px; sempre 2px de folga entre barras vizinhas
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const top = Math.max(...bars.map((b) => b.value));
  const hovered = bars.find((b) => b.id === hover);
  // Rótulo direto só no período atual e no maior valor (nunca em todas as barras).
  const labelled = new Set(bars.filter((b) => (b.current || (b.value === top && top > 0)) && b.value > 0).map((b) => b.id));
  // Muitos rótulos no eixo (dias e semanas): mostra um sim, um não, sempre o atual.
  const showTick = (i: number) =>
    (range !== 'day' && range !== 'week') || (bars.length - 1 - i) % 2 === 0;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gráfico de barras: ${bars.map((b) => `${b.full}: ${count(b.value)}`).join('; ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="chart__tick">
              {t}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(b.value));
          const x0 = cx - bw / 2;
          const r = Math.min(4, h, bw / 2);
          // Topo arredondado (4px), base reta encostada na linha do zero.
          const d = h > 0 ? `M${x0},${y(0)} V${y(b.value) + r} Q${x0},${y(b.value)} ${x0 + r},${y(b.value)} H${x0 + bw - r} Q${x0 + bw},${y(b.value)} ${x0 + bw},${y(b.value) + r} V${y(0)} Z` : '';
          return (
            <g
              key={b.id}
              tabIndex={0}
              className={hover === b.id ? 'chart__bar is-hover' : 'chart__bar'}
              aria-label={`${b.full}: ${count(b.value)}`}
              onPointerEnter={() => setHover(b.id)}
              onPointerLeave={() => setHover((h0) => (h0 === b.id ? null : h0))}
              onFocus={() => setHover(b.id)}
              onBlur={() => setHover((h0) => (h0 === b.id ? null : h0))}
            >
              {/* Área de toque maior que a barra: a coluna inteira */}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {d && <path d={d} className="chart__mark" />}
              {labelled.has(b.id) && (
                <text x={cx} y={y(b.value) - 6} textAnchor="middle" className="chart__value">
                  {b.value}
                </text>
              )}
              {showTick(i) && (
                <text x={cx} y={H - 8} textAnchor="middle" className={b.current ? 'chart__label is-current' : 'chart__label'}>
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className={`chart__tip chart__tip--${tipAlign(bars.indexOf(hovered), bars.length)}`}
          role="status"
          style={{
            left: `${((PAD.left + slot * bars.indexOf(hovered) + slot / 2) / W) * 100}%`,
            top: `${(Math.max(PAD.top, y(hovered.value)) / H) * 100}%`,
          }}
        >
          <strong>{count(hovered.value)}</strong>
          <span>{hovered.full}</span>
        </div>
      )}
    </div>
  );
}
