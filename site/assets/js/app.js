/* =============================================================================
 * Ofensores de VT · Claro — aplicação (DDD 14 e DDD 18)
 * Sem dependências. Todo texto vindo dos dados entra via textContent (nunca innerHTML).
 * ========================================================================== */
import * as R from './regras.js';
import { derivarChave, decifrarMes, guardarChave, chaveGuardada, esquecerChave } from './cripto.js';

/* ------------------------------------------------------------------ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const norm = R.textoNorm;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
/** "texto com **negrito**" -> <span> com <strong>, sempre via textContent. */
function rico(txt) {
  const el = h('span');
  String(txt).split(/\*\*(.+?)\*\*/g).forEach((p, i) => el.append(i % 2 ? h('strong', { text: p }) : document.createTextNode(p)));
  return el;
}
const semNegrito = (t) => String(t).replace(/\*\*/g, '');

const ICONES = {
  geral: 'M4 4h6.5v7.5H4zM13.5 4H20v4.5h-6.5zM13.5 11.5H20V20h-6.5zM4 14.5h6.5V20H4z',
  codigos: 'M4 20h16M7 16.5v-5M12 16.5V6M17 16.5v-8',
  causas: 'M6 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5ZM18 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5ZM18 15.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5ZM8.5 6h7M6 8.5V12a6 6 0 0 0 6 6h3.5',
  cidades: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z',
  reincidencia: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
  comparativo: 'M7 18V6M3.5 9.5L7 6l3.5 3.5M17 6v12M13.5 14.5L17 18l3.5-3.5',
  base: 'M4 5h16v14H4zM4 10h16M10 10v9',
  filtro: 'M4 5h16l-6 7.5V19l-4-2v-4.5z',
  sair: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h10',
  pdf: 'M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z',
  mais: 'M5 12h.01M12 12h.01M19 12h.01',
  seta: 'M5 12h14M13 6l6 6-6 6',
  fechar: 'M6 6l12 12M18 6L6 18',
  busca: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13ZM20 20l-4.8-4.8',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
};
function icone(nome, tam) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('class', 'ic');
  el.setAttribute('aria-hidden', 'true');
  if (tam) { el.setAttribute('width', tam); el.setAttribute('height', tam); }
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONES[nome] || '');
  if (nome === 'mais') p.setAttribute('stroke-width', '3');
  el.append(p);
  return el;
}

const NF = new Intl.NumberFormat('pt-BR');
const fInt = (n) => NF.format(n);
const fDec = (x, d) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fPct = (x, d = 1) => `${fDec(x * 100, d)}%`;
const fPctMin = (x) => (x > 0 && x < 0.01 ? '<1%' : fPct(x, 0));
const sinal = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±');
const fSinal = (n) => `${sinal(n)}${fInt(Math.abs(n))}`;
const fPPdif = (x, d = 1) => `${sinal(x)}${fDec(Math.abs(x), d)} p.p.`;
const fData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const plural = (n, um, varios) => `${fInt(n)} ${n === 1 ? um : varios}`;
const vts = (n) => plural(n, 'VT', 'VTs');
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (id) => `${MESES_CURTOS[+id.slice(5, 7) - 1]}/${id.slice(2, 4)}`;

function contar(regs, chave) {
  const m = new Map();
  for (const r of regs) {
    const k = typeof chave === 'function' ? chave(r) : r[chave];
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
const ordenar = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
const INDEF = new Set(['sem_info', 'dano_sem_causa']);
/** ordena com "sem informação" / "dano sem causa" por último */
const ordenarIndef = (m) => ordenar(m).sort((a, b) => (INDEF.has(a[0]) || a[0] === 'sem_info') - (INDEF.has(b[0]) || b[0] === 'sem_info'));

/* ------------------------------------------------------------------ catálogos */
const VIEWS = [
  { id: 'geral', rotulo: 'Visão geral', curto: 'Geral', icone: 'geral' },
  { id: 'codigos', rotulo: 'Códigos de baixa', curto: 'Códigos', icone: 'codigos' },
  { id: 'causas', rotulo: 'Causas relacionadas', curto: 'Causas', icone: 'causas' },
  { id: 'cidades', rotulo: 'Cidades', curto: 'Cidades', icone: 'cidades' },
  { id: 'reincidencia', rotulo: 'Reincidência e qualidade', curto: 'Reincidência', icone: 'reincidencia' },
  { id: 'comparativo', rotulo: 'Comparativo mensal', curto: 'Comparativo', icone: 'comparativo' },
  { id: 'base', rotulo: 'Base de visitas', curto: 'Base', icone: 'base' },
];
const VIEWS_ABAS = ['geral', 'codigos', 'causas', 'cidades'];

const MOTIVO = new Map([...R.MOTIVOS.map((m) => [m.id, m]), ['sem_info', R.MOTIVO_SEM_INFO]]);
const FAMILIA = new Map(R.FAMILIAS.map((f) => [f.id, f]));
const EIXO = new Map(R.EIXOS.map((e) => [e.id, e]));
const NATUREZA = new Map(R.NATUREZAS.map((n) => [n.id, n]));
const FLAG_ROTULO = { ...Object.fromEntries(Object.entries(R.FLAGS).map(([k, f]) => [k, f.rotulo])), obs_vazia: 'Sem observação' };

let familiaCodigo = new Map();
let acaoCodigo = new Map();
const descCodigo = (c) => R.CODIGOS[c] || acaoCodigo.get(c) || `Código ${c}`;
const corFamilia = (f) => FAMILIA.get(f)?.cor || 'var(--sem-info)';
const corCodigo = (c) => corFamilia(familiaCodigo.get(c));
const rotMotivo = (id) => MOTIVO.get(id)?.rotulo || id;
const rotEixo = (id) => EIXO.get(id)?.rotulo || id;
const naturezaEixo = (id) => EIXO.get(id)?.natureza || 'indefinida';
const corNatureza = (id) => NATUREZA.get(id)?.cor || 'var(--sem-info)';
const corEixo = (id) => corNatureza(naturezaEixo(id));
const naturezaClara = (id) => id === 'cliente' || id === 'indefinida';
const chipCodigo = (c, extra) => h('span', { class: 'cod', style: { '--cor': corCodigo(c) }, title: descCodigo(c) }, String(c), extra ? h('small', { text: extra }) : null);

/* ------------------------------------------------------------------ estado */
const estado = {
  manifesto: null,
  dados: new Map(), // ddd -> { ordem: [mes], meses: Map(mes -> { meta, regs }) }
  ddd: null,
  mes: null,
  view: 'geral',
  area: '',
  parceira: '',
  codigo: '',
  base: {}, // "ddd-mes" -> base digitada neste navegador
  rankTodos: false,
  reinc: 'mes',
  comp: { a: null, b: null },
  tabela: { busca: '', motivo: '', eixo: '', flag: '', pagina: 0 },
  usuario: '',
  ligado: false,
};

/* ------------------------------------------------------------------ preparação dos dados */
function prepararMes(dados) {
  const regs = dados.registros.map((r) => {
    const { motivo, fonte } = R.classificarVisita(r);
    const t = norm(r.obs);
    const flags = Object.entries(R.FLAGS).filter(([, f]) => f.re.test(t)).map(([k]) => k);
    if (R.obsVazia(r.obs)) flags.push('obs_vazia');
    return {
      ...r,
      ddd: dados.ddd,
      mes: dados.mes,
      area: R.nomeArea(r.regiao),
      familia: R.familiaDaVisita(r),
      motivo: motivo.id,
      eixo: motivo.eixo,
      natureza: naturezaEixo(motivo.eixo),
      fonteMotivo: fonte,
      flags,
      napId: R.napCanonica(r.nap),
      chaveEnd: r.endereco ? `${r.regiao}|${norm(r.endereco)}` : null,
      quando: r.baixa || r.agenda || '',
    };
  });
  return { meta: dados, regs };
}

/** Família e descrição de cada código, olhando TODOS os meses e DDDs. */
function calcularCodigos() {
  const fam = new Map(); const acao = new Map();
  for (const { meses } of estado.dados.values()) {
    for (const { regs } of meses.values()) {
      for (const r of regs) {
        if (r.familia) { const m = fam.get(r.bx) || new Map(); m.set(r.familia, (m.get(r.familia) || 0) + 1); fam.set(r.bx, m); }
        if (r.acao) { const m = acao.get(r.bx) || new Map(); m.set(r.acao, (m.get(r.acao) || 0) + 1); acao.set(r.bx, m); }
      }
    }
  }
  familiaCodigo = new Map([...fam].map(([c, m]) => [c, ordenar(m)[0][0]]));
  acaoCodigo = new Map([...acao].map(([c, m]) => [c, ordenar(m)[0][0]]));
  for (const { meses } of estado.dados.values()) {
    for (const { regs } of meses.values()) for (const r of regs) if (!r.familia) r.familia = familiaCodigo.get(r.bx) || 'outros';
  }
}

/* ------------------------------------------------------------------ acesso aos dados */
const dddAtual = () => estado.dados.get(estado.ddd);
const ordemMeses = () => dddAtual()?.ordem || [];
const regsMes = (mes = estado.mes) => dddAtual()?.meses.get(mes)?.regs || [];
const metaMes = (mes = estado.mes) => dddAtual()?.meses.get(mes)?.meta;
const todosRegs = () => ordemMeses().flatMap((m) => regsMes(m));
const mesAnterior = (mes = estado.mes) => { const o = ordemMeses(); const i = o.indexOf(mes); return i > 0 ? o[i - 1] : null; };

function filtrar(regs, { area = true, parceira = true, codigo = true } = {}) {
  const cod = estado.codigo ? +estado.codigo : null;
  return regs.filter((r) => (!area || !estado.area || r.area === estado.area)
    && (!parceira || !estado.parceira || r.parceira === estado.parceira)
    && (!codigo || cod == null || r.bx === cod));
}

function baseEfetiva(mes = estado.mes) {
  const meta = metaMes(mes);
  if (!meta) return null;
  if (estado.area) {
    const regiao = regsMes(mes).find((r) => r.area === estado.area)?.regiao;
    const v = meta.base_assinantes?.por_regiao?.[regiao];
    return v > 0 ? v : null;
  }
  const local = estado.base[`${estado.ddd}-${mes}`];
  if (local > 0) return local;
  const v = meta.base_assinantes?.total;
  return v > 0 ? v : null;
}

function escopoTexto() {
  const p = [estado.area || 'todas as cidades'];
  if (estado.parceira) p.push(`parceira ${estado.parceira}`);
  if (estado.codigo) p.push(`código ${estado.codigo}`);
  return p.join(' · ');
}

function variacoes(regsA, regsB, chave) {
  const ca = contar(regsA, chave); const cb = contar(regsB, chave);
  const ta = regsA.length || 1; const tb = regsB.length || 1;
  return [...new Set([...ca.keys(), ...cb.keys()])].map((k) => {
    const a = ca.get(k) || 0; const b = cb.get(k) || 0;
    return { k, a, b, d: b - a, pp: (b / tb - a / ta) * 100 };
  });
}

/* ------------------------------------------------------------------ tooltip */
const tip = $('#tooltip');
function posicionarTip(x, y) {
  const w = tip.offsetWidth; const a = tip.offsetHeight;
  let left = x + 14; let top = y - a - 12;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top < 8) top = y + 18;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${top}px`;
}
function mostrarTip(alvo, x, y) {
  tip.replaceChildren(h('strong', { text: alvo.dataset.tip }), alvo.dataset.tipSub ? h('span', { text: alvo.dataset.tipSub }) : null);
  tip.hidden = false;
  posicionarTip(x, y);
}
function ligarTooltip() {
  document.addEventListener('pointerover', (e) => { const a = e.target.closest?.('[data-tip]'); if (a && e.pointerType !== 'touch') mostrarTip(a, e.clientX, e.clientY); });
  document.addEventListener('pointermove', (e) => { if (!tip.hidden) posicionarTip(e.clientX, e.clientY); });
  document.addEventListener('pointerout', (e) => { if (e.target.closest?.('[data-tip]')) tip.hidden = true; });
  document.addEventListener('focusin', (e) => { const a = e.target.closest?.('[data-tip]'); if (a) { const r = a.getBoundingClientRect(); mostrarTip(a, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
}

/* ------------------------------------------------------------------ componentes */
function barra(frac, cor) {
  return h('span', { class: 'trilho' }, h('span', { class: 'barra-h', style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%`, '--cor': cor } }));
}

/** Linha de barra: rótulo | barra | valor | % (ou extra). Vira botão se tiver onclick. */
function linhaBarra({ rotulo, prefixo, n, max, cor, pct, extra, onclick, title, sem, classe = '' }) {
  return h(onclick ? 'button' : 'div', { type: onclick ? 'button' : null, class: `linha-barra${sem ? ' linha-barra--sem' : ''} ${classe}`, onclick, title: title || rotulo },
    h('span', { class: 'rot' }, prefixo || null, h('span', { text: rotulo })),
    barra(max ? n / max : 0, cor),
    h('span', { class: 'val', text: fInt(n) }),
    extra || h('span', { class: 'pct', text: pct == null ? '' : fPct(pct, 0) }));
}

/** Delta em pílula. tipo 'abs' (VTs) ou 'pp' (já em pontos percentuais). */
function delta(atual, anterior, { tipo = 'abs', subirRuim = true, mesAnt, comPct = false } = {}) {
  if (anterior == null || atual == null) return null;
  const d = atual - anterior;
  const eps = tipo === 'pp' ? 0.05 : 0;
  const dir = Math.abs(d) <= eps ? 'neutro' : (d > 0) === subirRuim ? 'ruim' : 'bom';
  const seta = Math.abs(d) <= eps ? '■' : d > 0 ? '▲' : '▼';
  let txt = tipo === 'pp' ? fPPdif(d) : fSinal(d);
  if (comPct && tipo === 'abs' && anterior) txt += ` (${sinal(d)}${fPct(Math.abs(d) / anterior, 0)})`;
  return h('span', { class: `delta delta--${dir}`, title: mesAnt ? `vs ${mesAnt}` : null }, `${seta} ${txt}`);
}

function kpi({ rotulo, valor, sub, dlt, classe = '', canto }) {
  return h('div', { class: `kpi ${classe}` },
    h('p', { class: 'kpi__rotulo' }, h('span', { text: rotulo }), canto || null),
    h('p', { class: 'kpi__valor' }, valor, dlt || null),
    sub ? h('p', { class: 'kpi__sub' }, sub) : null);
}

function cartao({ titulo, sub, sobre, acao, classe = '', id }, ...corpo) {
  return h('article', { class: `cartao ${classe}`, id: id || null },
    titulo || acao ? h('div', { class: 'cartao__cab' },
      h('div', null, sobre ? h('p', { class: 'cartao__sobre', text: sobre }) : null,
        titulo ? h('h3', { class: 'cartao__titulo', text: titulo }) : null,
        sub ? h('p', { class: 'cartao__sub' }, sub) : null),
      acao || null) : null,
    ...corpo);
}

function linkSeta(texto, onclick) {
  return h('button', { class: 'link-seta', type: 'button', onclick }, texto, icone('seta'));
}

function secaoTitulo(titulo, texto, acao) {
  return h('div', { class: 'secao-titulo' }, h('div', null, h('h2', { text: titulo }), texto ? h('p', null, texto) : null), acao || null);
}

/** Barra segmentada (todo dividido em partes). partes: [{id, rotulo, n, cor, clara}] */
function segmentada(partes, total, { rotulos = true } = {}) {
  return h('div', { class: 'segmentada', role: 'img', 'aria-label': partes.map((p) => `${p.rotulo}: ${p.n}`).join(', ') },
    partes.filter((p) => p.n > 0).map((p) => h('span', {
      class: p.clara ? 'clara' : '',
      style: { '--cor': p.cor, 'flex-grow': String(p.n), 'flex-basis': '0' },
      tabindex: '0',
      dataset: { tip: `${fInt(p.n)} VTs · ${fPct(p.n / total)}`, tipSub: p.rotulo },
    }, rotulos && p.n / total >= 0.09 ? fPct(p.n / total, 0) : '')));
}

function partesNatureza(regs) {
  const c = contar(regs, 'natureza');
  return R.NATUREZAS.map((n) => ({ id: n.id, rotulo: n.rotulo, n: c.get(n.id) || 0, cor: n.cor, clara: naturezaClara(n.id) }));
}

/** Treemap "squarified" em coordenadas 0..W x 0..H (devolve retângulos). */
function squarify(itens, W, H) {
  const total = itens.reduce((s, d) => s + d.v, 0) || 1;
  const fila = itens.map((d) => ({ ...d, a: (d.v / total) * W * H }));
  const rects = [];
  let x = 0; let y = 0; let w = W; let hh = H; let linha = [];
  const pior = (l, lado) => {
    const s = l.reduce((t, d) => t + d.a, 0);
    const mx = Math.max(...l.map((d) => d.a)); const mn = Math.min(...l.map((d) => d.a));
    return Math.max((lado * lado * mx) / (s * s), (s * s) / (lado * lado * mn));
  };
  const assentar = () => {
    const s = linha.reduce((t, d) => t + d.a, 0);
    if (w >= hh) {
      const cw = s / hh; let cy = y;
      for (const d of linha) { const ch = d.a / cw; rects.push({ ...d, x, y: cy, w: cw, h: ch }); cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = s / w; let cx = x;
      for (const d of linha) { const cw = d.a / rh; rects.push({ ...d, x: cx, y, w: cw, h: rh }); cx += cw; }
      y += rh; hh -= rh;
    }
    linha = [];
  };
  let i = 0;
  while (i < fila.length) {
    const lado = Math.min(w, hh);
    if (!linha.length || pior([...linha, fila[i]], lado) <= pior(linha, lado)) { linha.push(fila[i]); i += 1; } else assentar();
  }
  if (linha.length) assentar();
  return rects;
}

const MQ_ESTREITO = window.matchMedia('(max-width: 700px)');
function treemap(itens, onclick) {
  const ratio = MQ_ESTREITO.matches ? 0.95 : 0.52;
  const W = 100; const H = 100 * ratio;
  const total = itens.reduce((s, d) => s + d.v, 0);
  const rects = squarify(itens.filter((d) => d.v > 0).sort((a, b) => b.v - a.v), W, H);
  return h('div', { class: 'treemap', role: 'list', 'aria-label': 'Mapa de causas' }, rects.map((r) => {
    const frac = r.v / total;
    const area = (r.w * r.h) / (W * H);
    const tam = area < 0.012 ? ' tile--x' : area < 0.03 ? ' tile--pp' : area < 0.07 ? ' tile--p' : '';
    return h('div', {
      class: `tile${r.clara ? ' clara' : ''}${tam}`, role: 'listitem',
      style: { left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%`, '--cor': r.cor },
    }, h('button', { type: 'button', onclick: () => onclick(r.id), dataset: { tip: `${r.rotulo}: ${fInt(r.v)} VTs (${fPct(frac)})`, tipSub: r.dica || '' }, 'aria-label': `${r.rotulo}: ${r.v} visitas` },
      h('strong', { text: r.rotulo }),
      h('span', { class: 'tile__n' }, fInt(r.v), h('small', { text: fPct(frac, 0) }))));
  }));
}

/**
 * Heatmap genérico. escala 'linha' = intensidade relativa dentro de cada linha; 'coluna' = dentro da coluna.
 * linhas/colunas: [{id, rotulo, sub}]; valor(l, c) -> número.
 */
function heatmap({ linhas, colunas, valor, escala = 'coluna', totalLinha, rotTotal = 'Total', onLinha, onColuna, linhaSel, tipLinha, tipColuna }) {
  const vals = linhas.map((l) => colunas.map((c) => valor(l.id, c.id)));
  const maxL = vals.map((row) => Math.max(0, ...row));
  const maxC = colunas.map((_, j) => Math.max(0, ...vals.map((row) => row[j])));
  return h('div', { class: 'rolagem' }, h('table', { class: 'heat' },
    h('thead', null, h('tr', null,
      h('th', { class: 'rot-cab' }),
      colunas.map((c) => h('th', null, onColuna ? h('button', { type: 'button', title: c.title || c.rotulo, onclick: () => onColuna(c.id) }, c.chip || c.rotulo, c.sub ? h('small', { text: c.sub }) : null) : h('span', null, c.chip || c.rotulo, c.sub ? h('small', { text: c.sub }) : null))),
      totalLinha ? h('th', { text: rotTotal, style: { 'text-align': 'right' } }) : null)),
    h('tbody', null, linhas.map((l, i) => h('tr', { class: linhaSel ? (linhaSel === l.id ? 'selecionada' : 'atenuada') : '' },
      h('td', { class: 'rot' }, onLinha ? h('button', { type: 'button', text: l.rotulo, onclick: () => onLinha(l.id) }) : h('span', { text: l.rotulo }), l.sub ? h('small', { text: l.sub }) : null),
      colunas.map((c, j) => {
        const v = vals[i][j];
        const mx = escala === 'linha' ? maxL[i] : maxC[j];
        const passo = v ? Math.max(1, Math.ceil((v / mx) * 5)) : 0;
        return h('td', {
          class: `${v ? '' : 'zero'}${v && v === mx ? ' max' : ''}`,
          dataset: v ? { n: String(passo), tip: `${fInt(v)} VTs · ${l.rotulo} × ${c.rotulo}`, tipSub: [tipLinha?.(l.id, v), tipColuna?.(c.id, v)].filter(Boolean).join(' · ') } : null,
          tabindex: v ? '0' : null,
          text: v ? fInt(v) : '·',
        });
      }),
      totalLinha ? h('td', { class: 'tot' }, totalLinha(l.id)) : null)))));
}

/* ------------------------------------------------------------------ navegação / ações */
function navegar(view) {
  // Comparativo sem 2 meses neste DDD? Abre direto no DDD que tem (hoje: DDD 14, set → out).
  let ddd = estado.ddd;
  if (view === 'comparativo' && ordemMeses().length < 2) ddd = [...estado.dados.keys()].find((d) => estado.dados.get(d).ordem.length > 1) || ddd;
  const alvo = `#/${ddd}/${view}`;
  if (window.location.hash !== alvo) window.location.hash = alvo; else aplicarRota();
}
function alternarCodigo(c, { irPara } = {}) {
  estado.codigo = String(estado.codigo) === String(c) ? '' : String(c);
  estado.tabela.pagina = 0;
  if (irPara && irPara !== estado.view) navegar(irPara); else renderTudo();
}
function alternarArea(a) {
  estado.area = estado.area === a ? '' : a;
  estado.tabela.pagina = 0;
  renderTudo();
}
function abrirBase({ motivo = '', eixo = '', flag = '', codigo } = {}) {
  if (codigo != null) estado.codigo = String(codigo);
  estado.tabela = { ...estado.tabela, motivo, eixo, flag, pagina: 0 };
  navegar('base');
}
function rolarPara(id) { requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }

/* ------------------------------------------------------------------ INSIGHTS */
function insightsDDD(regs, regsAnt, mAnt) {
  const total = regs.length;
  const out = [];
  if (!total) return out;
  if (regsAnt && regsAnt.length) {
    const d = total - regsAnt.length;
    const vc = variacoes(regsAnt, regs, 'bx').filter((x) => x.d !== 0 && Math.sign(x.d) === Math.sign(d)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const dr = vc[0];
    out.push(`As VTs ${d >= 0 ? 'subiram' : 'caíram'} **${fPct(Math.abs(d) / regsAnt.length)}** vs ${mAnt} (${fInt(regsAnt.length)} → ${fInt(total)})${dr ? `, puxadas pelo **${dr.k}** (${descCodigo(dr.k)}: ${fInt(dr.a)} → ${fInt(dr.b)})` : ''}.`);
    const ve = variacoes(regsAnt, regs, 'eixo').filter((x) => !INDEF.has(x.k)).sort((a, b) => b.d - a.d)[0];
    if (ve && ve.d >= 3) out.push(`O grupo **${rotEixo(ve.k)}** foi o que mais cresceu: ${fInt(ve.a)} → **${fInt(ve.b)} VTs**.`);
  }
  const cods = ordenar(contar(regs, 'bx'));
  if (!estado.codigo) {
    const [c1, n1] = cods[0];
    out.push(`O código **${c1}** (${descCodigo(c1)}) lidera com **${vts(n1)}** — ${fPct(n1 / total)} do total.`);
  }
  const eixos = ordenar(contar(regs.filter((r) => !INDEF.has(r.eixo)), 'eixo'));
  if (eixos.length) {
    const [e1, ne] = eixos[0];
    const mots = ordenar(contar(regs.filter((r) => r.eixo === e1), 'motivo')).slice(0, 3).map(([m, n]) => `${rotMotivo(m).toLowerCase()} ${n}`);
    out.push(`**${rotEixo(e1)}** é o principal grupo de causas: **${vts(ne)}** (${fPct(ne / total)}) — ${mots.join(', ')}.`);
  }
  const nat = contar(regs, 'natureza');
  out.push(`**${fPct((nat.get('externa') || 0) / total, 0)}** das VTs têm causa externa (clima, poste, caminhões, terceiros…) e **${fPct((nat.get('operacao') || 0) / total, 0)}** estão na mão da operação Claro (conectorização, equipamento e processo).`);
  if (!estado.area) {
    const [a1, na] = ordenar(contar(regs, 'area'))[0];
    const [ea] = ordenar(contar(regs.filter((r) => r.area === a1 && !INDEF.has(r.eixo)), 'eixo'))[0] || [];
    out.push(`**${a1}** concentrou **${vts(na)}** (${fPct(na / total)})${ea ? `; principal causa local: ${rotEixo(ea).toLowerCase()}` : ''}.`);
  }
  const indef = nat.get('indefinida') || 0;
  const vazias = regs.filter((r) => r.flags.includes('obs_vazia'));
  if (indef / total >= 0.15) {
    const [p1, np] = vazias.length ? ordenar(contar(vazias, 'parceira'))[0] : [null, 0];
    const fatia = p1 ? regs.filter((r) => r.parceira === p1).length / total : 0;
    out.push(`**${fPct(indef / total, 0)}** das VTs sem causa identificável — ${fInt(vazias.length)} sem nenhuma observação${p1 && np / vazias.length >= 0.6 ? ` (${fPct(np / vazias.length, 0)} delas da parceira **${p1}**, que fez ${fPct(fatia, 0)} das VTs)` : ''}. Cobrar o registro do porquê melhora esta leitura.`);
  } else if (vazias.length >= 5) {
    out.push(`**${vts(vazias.length)}** sem observação do técnico (${fPct(vazias.length / total, 0)}).`);
  }
  const agua = regs.filter((r) => r.motivo === 'agua' || r.motivo === 'oxidacao').length;
  if (agua >= 3) out.push(`**${vts(agua)}** com **água ou oxidação** no conector/NAP — efeito direto de chuva e umidade.`);
  const rein = regs.filter((r) => r.log > 0).length;
  if (rein) out.push(`**${fPct(rein / total)}** das VTs (${fInt(rein)}) já tinham visita anterior registrada (LOG ≥ 1).`);
  const err = regs.filter((r) => r.flags.includes('baixa_errada')).length;
  if (err) out.push(`**${plural(err, 'observação indica', 'observações indicam')}** código de baixa errado — isso distorce o ranking.`);
  return out.slice(0, 8);
}

function insightsCidade(cidade, regsC, regsDDD, regsCAnt, mAnt) {
  const n = regsC.length; const N = regsDDD.length;
  const out = [];
  if (!n) return out;
  if (regsCAnt && regsCAnt.length) {
    const d = n - regsCAnt.length;
    if (Math.abs(d) >= 3) {
      const dr = variacoes(regsCAnt, regsC, 'eixo').filter((x) => x.d !== 0 && Math.sign(x.d) === Math.sign(d) && !INDEF.has(x.k)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      out.push(`${d > 0 ? 'Alta' : 'Queda'} de **${fSinal(d)} VTs** vs ${mAnt} (${sinal(d)}${fPct(Math.abs(d) / regsCAnt.length, 0)})${dr ? `, puxada por ${rotEixo(dr.k).toLowerCase()} (${fSinal(dr.d)})` : ''}.`);
    }
  }
  const ec = contar(regsC, 'eixo'); const ed = contar(regsDDD, 'eixo');
  const cand = [...ec].filter(([e, v]) => !INDEF.has(e) && v >= 3).map(([e, v]) => ({ e, v, sc: v / n, sd: (ed.get(e) || 0) / N }))
    .map((x) => ({ ...x, lift: x.sd ? x.sc / x.sd : 9 })).filter((x) => x.lift >= 1.35)
    .sort((a, b) => b.v * (b.lift - 1) - a.v * (a.lift - 1));
  if (cand[0]) {
    const c = cand[0];
    const [m1, nm] = ordenar(contar(regsC.filter((r) => r.eixo === c.e), 'motivo'))[0];
    out.push(`**${rotEixo(c.e)}** pesa **${fPct(c.sc, 0)}** aqui (média do DDD: ${fPct(c.sd, 0)}) — principalmente ${rotMotivo(m1).toLowerCase()} (${nm}).`);
  } else {
    const [e1, v1] = ordenar(new Map([...ec].filter(([e]) => !INDEF.has(e))))[0] || [];
    if (e1) out.push(`Principal causa: **${rotEixo(e1).toLowerCase()}** (${vts(v1)}, ${fPct(v1 / n, 0)}).`);
  }
  const ic = regsC.filter((r) => r.natureza === 'indefinida').length / n; const id = regsDDD.filter((r) => r.natureza === 'indefinida').length / N;
  if (n >= 10 && ic >= 0.3 && ic - id >= 0.05) out.push(`**${fPct(ic, 0)}** das VTs sem causa identificável (DDD: ${fPct(id, 0)}) — observações vagas ou vazias.`);
  const rc = regsC.filter((r) => r.log > 0).length / n; const rd = regsDDD.filter((r) => r.log > 0).length / N;
  if (n >= 10 && rc - rd >= 0.06) out.push(`Reincidência de **${fPct(rc, 0)}** (DDD: ${fPct(rd, 0)}).`);
  const naps = ordenar(contar(regsC.filter((r) => r.napId), 'napId'));
  if (naps[0] && naps[0][1] >= 3) out.push(`NAP **${naps[0][0]}** concentrou ${vts(naps[0][1])}.`);
  const vaz = regsC.filter((r) => r.flags.includes('obs_vazia')).length;
  if (n >= 10 && vaz / n >= 0.2) out.push(`**${fPct(vaz / n, 0)}** das VTs sem observação do técnico.`);
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ VIEW: VISÃO GERAL */
function viewGeral(el) {
  const regs = filtrar(regsMes());
  const total = regs.length;
  const meta = metaMes();
  const ant = mesAnterior();
  const regsAnt = ant ? filtrar(regsMes(ant)) : null;
  const mAnt = ant ? mesCurto(ant) : null;
  if (!total) { el.replaceChildren(cartao({ titulo: 'Sem visitas no filtro atual' }, h('p', { class: 'vazio', text: 'Ajuste os filtros para ver os dados.' }))); return; }

  const cods = ordenar(contar(regs, 'bx'));
  const [c1, n1] = cods[0];
  const eixos = ordenarIndef(contar(regs, 'eixo'));
  const [e1, ne1] = eixos.find(([e]) => !INDEF.has(e)) || eixos[0];
  let frase;
  if (regsAnt && regsAnt.length) {
    const d = total - regsAnt.length;
    const dr = variacoes(regsAnt, regs, 'bx').filter((x) => x.d !== 0 && Math.sign(x.d) === Math.sign(d)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    frase = `${d >= 0 ? 'Alta' : 'Queda'} de **${fPct(Math.abs(d) / regsAnt.length, 0)}** sobre ${mAnt}${dr ? `, puxada pelo **${dr.k}** (${descCodigo(dr.k).toLowerCase()}, ${fSinal(dr.d)})` : ''}. Principal grupo de causas: **${rotEixo(e1).toLowerCase()}**.`;
  } else {
    frase = `O **${c1}** (${descCodigo(c1).toLowerCase()}) lidera com **${fPct(n1 / total, 0)}** das visitas. Principal grupo de causas: **${rotEixo(e1).toLowerCase()}** (${vts(ne1)}).`;
  }
  const meses = ordemMeses();
  const serie = meses.map((m) => ({ m, n: filtrar(regsMes(m)).length }));
  const maxS = Math.max(1, ...serie.map((s) => s.n));
  const contratos = new Set(regs.map((r) => r.contrato)).size;

  const hero = h('section', { class: 'hero' },
    h('div', { style: { position: 'relative', 'z-index': '1' } },
      h('p', { class: 'hero__rotulo', text: `Visitas técnicas · DDD ${estado.ddd} · ${meta.rotulo}` }),
      h('div', { class: 'hero__valor' }, h('strong', { text: fInt(total) }), delta(total, regsAnt?.length, { mesAnt: mAnt, comPct: true })),
      h('p', { class: 'hero__frase' }, rico(frase))),
    h('div', { class: 'hero__lado' },
      serie.length > 1 ? h('div', null,
        h('div', { class: 'spark', 'aria-label': 'Evolução mensal' }, serie.map((s) => h('i', { class: s.m === estado.mes ? 'atual' : '', style: { height: `${Math.max(6, (s.n / maxS) * 54)}px` } }, h('b', { text: fInt(s.n) })))),
        h('div', { class: 'spark-rotulos' }, serie.map((s) => h('small', { text: mesCurto(s.m) })))) : null,
      h('div', { class: 'hero__pilulas' },
        h('span', { class: 'pilula', text: plural(contratos, 'contrato', 'contratos') }),
        h('span', { class: 'pilula', text: plural(new Set(regs.map((r) => r.area)).size, 'cidade', 'cidades') }),
        h('span', { class: 'pilula', text: plural(cods.length, 'código', 'códigos') }),
        estado.area || estado.parceira || estado.codigo ? h('span', { class: 'pilula pilula--escura', text: escopoTexto() }) : null)));

  const pct = (arr, fn) => (arr && arr.length ? arr.filter(fn).length / arr.length : null);
  const rein = pct(regs, (r) => r.log > 0); const reinAnt = pct(regsAnt, (r) => r.log > 0);
  const impr = pct(regs, (r) => norm(r.fato) === 'improdutiva'); const imprAnt = pct(regsAnt, (r) => norm(r.fato) === 'improdutiva');
  const base = baseEfetiva(); const baseAnt = ant ? baseEfetiva(ant) : null;
  const taxa = base ? total / base : null; const taxaAnt = baseAnt && regsAnt ? regsAnt.length / baseAnt : null;
  const nAnt1 = regsAnt ? regsAnt.filter((r) => r.bx === c1).length : null;
  const kpis = h('div', { class: 'kpis' },
    kpi({ rotulo: 'Maior ofensor', valor: h('span', null, String(c1), h('small', { text: ` ${descCodigo(c1)}` })), sub: `${vts(n1)} · ${fPct(n1 / total)} do total`, dlt: nAnt1 != null ? delta(n1, nAnt1, { mesAnt: mAnt }) : null }),
    base ? kpi({ rotulo: 'Taxa de VT sobre a base', valor: fPct(taxa, 2), sub: `${fInt(total)} VTs ÷ ${fInt(base)} assinantes`, dlt: taxaAnt != null ? delta(taxa * 100, taxaAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null })
      : kpi({ rotulo: 'Taxa de VT sobre a base', valor: '—', classe: 'kpi--pendente', sub: h('span', null, estado.area ? 'Base por cidade ainda não informada.' : 'Informe a base de assinantes. ', estado.area ? null : h('button', { class: 'link-botao', type: 'button', text: 'Informar', onclick: abrirFiltros })) }),
    kpi({ rotulo: 'Reincidência', valor: fPct(rein), sub: `${vts(regs.filter((r) => r.log > 0).length)} com visita anterior`, dlt: reinAnt != null ? delta(rein * 100, reinAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null }),
    kpi({ rotulo: 'Improdutivas', valor: fPct(impr), sub: `${vts(regs.filter((r) => norm(r.fato) === 'improdutiva').length)} sem reparo executado`, dlt: imprAnt != null ? delta(impr * 100, imprAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null }));

  const partes = partesNatureza(regs);
  const natureza = cartao({ titulo: 'Natureza das causas', sub: 'De onde vêm as visitas — em vermelho, o que está na mão da operação.', acao: linkSeta('Causas', () => navegar('causas')) },
    segmentada(partes, total),
    h('div', { class: 'natureza-lista' }, partes.map((p) => h('div', { class: 'natureza-item' },
      h('i', { class: 'amostra', style: { '--cor': p.cor } }),
      h('div', null, h('strong', { text: p.rotulo }), h('small', { text: NATUREZA.get(p.id).desc })),
      h('p', { class: 'n' }, fInt(p.n), h('small', { text: ` · ${fPct(p.n / total, 0)}` }))))));
  const itens = insightsDDD(regs, regsAnt, mAnt);
  const leitura = cartao({ titulo: 'Leitura executiva', sub: `Gerada automaticamente · ${escopoTexto()}` },
    h('ol', { class: 'insights' }, itens.map((t) => h('li', null, rico(t)))));

  const topCods = cods.slice(0, 6);
  const cardCods = cartao({ titulo: 'Códigos que mais ofenderam', sub: 'Código de baixa principal (BX)', acao: linkSeta('Ranking', () => navegar('codigos')) },
    h('div', { class: 'barras' }, topCods.map(([c, n]) => linhaBarra({ prefixo: chipCodigo(c), rotulo: descCodigo(c), n, max: topCods[0][1], cor: corCodigo(c), pct: n / total, classe: 'linha-barra--larga', onclick: () => alternarCodigo(c, { irPara: 'codigos' }) }))));
  const topEixos = eixos.slice(0, 7);
  const cardEixos = cartao({ titulo: 'Principais grupos de causa', sub: 'Causas relacionadas somadas entre todos os códigos', acao: linkSeta('Detalhar', () => navegar('causas')) },
    h('div', { class: 'barras' }, topEixos.map(([e, n]) => linhaBarra({ rotulo: rotEixo(e), n, max: topEixos[0][1], cor: corEixo(e), pct: n / total, sem: INDEF.has(e), classe: 'linha-barra--larga', onclick: () => { navegar('causas'); rolarPara(`eixo-${e}`); } }))));
  const areas = ordenar(contar(filtrar(regsMes(), { area: false }), 'area'));
  const areasAnt = regsAnt ? contar(filtrar(regsMes(ant), { area: false }), 'area') : null;
  const totalAreas = areas.reduce((s, [, n]) => s + n, 0);
  const cardAreas = cartao({ titulo: 'Cidades', sub: areasAnt ? `VTs e variação vs ${mAnt}` : 'VTs por cidade / área', acao: linkSeta('Cidades', () => navegar('cidades')) },
    h('div', { class: 'barras' }, areas.map(([a, n]) => linhaBarra({
      rotulo: a, n, max: areas[0][1], cor: estado.area && estado.area !== a ? 'var(--seq-2)' : 'var(--claro)', pct: n / totalAreas, classe: areasAnt ? 'linha-barra--delta' : 'linha-barra--larga',
      extra: areasAnt ? h('span', { class: 'pct' }, delta(n, areasAnt.get(a) || 0, { mesAnt: mAnt }) || '') : null,
      onclick: () => alternarArea(a), title: `Filtrar ${a}`,
    }))));

  el.replaceChildren(hero, kpis, h('div', { class: 'g-1-2' }, natureza, leitura), h('div', { class: 'g3' }, cardCods, cardEixos, cardAreas));
}

/* ------------------------------------------------------------------ VIEW: CÓDIGOS */
function linhasMotivo(rc, cor) {
  const n = rc.length;
  const mots = ordenar(contar(rc, 'motivo')).sort((a, b) => (a[0] === 'sem_info') - (b[0] === 'sem_info'));
  const max = Math.max(...mots.map(([, v]) => v));
  return h('div', { class: 'barras' }, mots.map(([m, v]) => linhaBarra({
    rotulo: rotMotivo(m), n: v, max, cor: m === 'sem_info' ? 'var(--sem-info)' : corEixo(MOTIVO.get(m)?.eixo) === corNatureza('indefinida') ? 'var(--sem-info)' : cor,
    pct: v / n, sem: m === 'sem_info', title: `${rotEixo(MOTIVO.get(m)?.eixo)} — ver estas visitas`, onclick: () => abrirBase({ motivo: m, codigo: rc[0].bx }),
  })));
}

function cardCodigo(regs, c) {
  const rc = regs.filter((r) => r.bx === c);
  const cab = h('div', { class: 'card-cod__cab' },
    h('div', null,
      h('div', { class: 'card-cod__titulo' }, chipCodigo(c), h('h3', { text: descCodigo(c) })),
      h('p', { class: 'cartao__sub', text: rc.length ? `${fPct(rc.length / regs.length)} das VTs do filtro` : 'Sem ocorrências no filtro atual' })),
    h('div', { class: 'card-cod__total' }, h('strong', { text: fInt(rc.length) }), h('span', { text: 'VTs' })));
  if (!rc.length) return h('article', { class: 'cartao' }, cab);
  const [a1, na] = ordenar(contar(rc, 'area'))[0];
  const rein = rc.filter((r) => r.log > 0).length;
  return h('article', { class: 'cartao' }, cab, linhasMotivo(rc, corCodigo(c)),
    h('div', { class: 'card-pe' },
      h('span', null, 'Mais impactada: ', h('strong', { text: a1 }), ` (${fInt(na)})`),
      h('span', null, 'Reincidência: ', h('strong', { text: fPct(rein / rc.length, 0) })),
      String(c) !== estado.codigo ? linkSeta('Detalhar', () => { alternarCodigo(c); rolarPara('detalhe-codigo'); }) : null));
}

function detalheCodigo(regs, c) {
  const rc = regs.filter((r) => r.bx === c);
  if (!rc.length) return cartao({ id: 'detalhe-codigo', titulo: `Código ${c}` }, h('p', { class: 'vazio', text: 'Sem visitas deste código no filtro atual.' }));
  const areas = ordenar(contar(rc, 'area'));
  const subf = ordenar(contar(rc, (r) => r.subfalha || '(vazia)')).slice(0, 6);
  const fontes = contar(rc, 'fonteMotivo');
  const eixos = ordenarIndef(contar(rc, 'eixo'));
  return h('article', { class: 'cartao', id: 'detalhe-codigo' },
    h('div', { class: 'card-cod__cab' },
      h('div', null,
        h('div', { class: 'card-cod__titulo' }, chipCodigo(c), h('h3', { text: `${descCodigo(c)} — detalhamento` })),
        h('p', { class: 'cartao__sub', text: `${vts(rc.length)} · ${fPct(rc.length / regs.length)} do filtro · família: ${FAMILIA.get(familiaCodigo.get(c))?.rotulo || '—'}` })),
      h('button', { class: 'botao botao--sec botao--mini', type: 'button', text: 'Remover filtro', onclick: () => alternarCodigo(c) })),
    h('div', { class: 'detalhe-cod' },
      h('div', { style: { display: 'grid', gap: '10px', 'align-content': 'start' } },
        h('p', { class: 'subtitulo-bloco', text: 'Motivo raiz' }), linhasMotivo(rc, corCodigo(c)),
        h('p', { class: 'dica', text: `Origem do motivo: ${fInt(fontes.get('obs') || 0)} pela observação · ${fInt(fontes.get('subfalha') || 0)} pela SUBFALHA · ${fInt(fontes.get('causa') || 0)} pela CAUSA · ${fInt(fontes.get('nenhuma') || 0)} sem informação.` })),
      h('div', { style: { display: 'grid', gap: '10px', 'align-content': 'start' } },
        h('p', { class: 'subtitulo-bloco', text: 'Grupo de causa' }),
        segmentada(eixos.map(([e, n]) => ({ id: e, rotulo: rotEixo(e), n, cor: corEixo(e), clara: naturezaClara(naturezaEixo(e)) })), rc.length, { rotulos: false }),
        h('div', { class: 'legenda' }, eixos.slice(0, 5).map(([e, n]) => h('span', null, h('i', { class: 'amostra', style: { '--cor': corEixo(e) } }), `${rotEixo(e)} (${n})`))),
        h('p', { class: 'subtitulo-bloco', text: 'Onde ocorreu', style: { 'margin-top': '6px' } }),
        h('div', { class: 'barras' }, areas.map(([a, n]) => linhaBarra({ rotulo: a, n, max: areas[0][1], cor: 'var(--claro)', pct: n / rc.length, onclick: () => alternarArea(a) }))),
        h('p', { class: 'subtitulo-bloco', text: 'SUBFALHA registrada no sistema', style: { 'margin-top': '6px' } }),
        h('table', { class: 'mini-tabela' }, h('tbody', null, subf.map(([s, n]) => h('tr', null, h('td', { text: s }), h('td', { class: 'n', text: fInt(n) }))))))));
}

function viewCodigos(el) {
  const regs = filtrar(regsMes(), { codigo: false });
  const total = regs.length;
  if (!total) { el.replaceChildren(cartao({ titulo: 'Sem visitas no filtro atual' })); return; }
  const cods = ordenar(contar(regs, 'bx'));
  const max = cods[0][1];
  const base = baseEfetiva();
  const ant = mesAnterior();
  const regsAnt = ant ? filtrar(regsMes(ant), { codigo: false }) : null;
  const LIM = 12;
  const mostrar = estado.rankTodos ? cods : cods.slice(0, LIM);
  let acum = 0;
  const acumulados = new Map(cods.map(([c, n]) => { acum += n; return [c, acum / total]; }));
  const top3 = cods.slice(0, 3).reduce((s, [, n]) => s + n, 0);
  const vc = regsAnt ? variacoes(regsAnt, regs, 'bx').sort((a, b) => b.d - a.d) : null;

  const kpis = h('div', { class: 'kpis-linha' },
    kpi({ rotulo: 'Códigos distintos', valor: fInt(cods.length), sub: `em ${vts(total)}`, classe: 'kpi--compacto' }),
    kpi({ rotulo: 'Concentração', valor: fPct(top3 / total, 0), sub: `nos 3 maiores (${cods.slice(0, 3).map(([c]) => c).join(', ')})`, classe: 'kpi--compacto' }),
    vc && vc[0] && vc[0].d > 0 ? kpi({ rotulo: `Maior alta vs ${mesCurto(ant)}`, valor: h('span', null, String(vc[0].k), h('small', { text: ` ${descCodigo(vc[0].k)}` })), sub: `${fInt(vc[0].a)} → ${fInt(vc[0].b)} VTs`, dlt: delta(vc[0].b, vc[0].a), classe: 'kpi--compacto' }) : null,
    vc && vc.at(-1) && vc.at(-1).d < 0 ? kpi({ rotulo: `Maior queda vs ${mesCurto(ant)}`, valor: h('span', null, String(vc.at(-1).k), h('small', { text: ` ${descCodigo(vc.at(-1).k)}` })), sub: `${fInt(vc.at(-1).a)} → ${fInt(vc.at(-1).b)} VTs`, dlt: delta(vc.at(-1).b, vc.at(-1).a), classe: 'kpi--compacto' }) : null);

  const cab = h('div', { class: 'linha-rank linha-rank--cab', 'aria-hidden': 'true' },
    h('span', { class: 'pos', text: '#' }), h('span', { text: 'Código' }), h('span', { text: 'Descrição' }), h('span'),
    h('span', { class: 'val', text: 'VTs' }), h('span', { class: 'pct', text: '% VTs' }), h('span', { class: 'acum', text: 'Acum.' }),
    base ? h('span', { class: 'acum', text: 'Taxa' }) : null);
  const linhas = mostrar.map(([c, n], i) => h('button', {
    type: 'button', class: `linha-rank${String(c) === estado.codigo ? ' selecionada' : estado.codigo ? ' atenuada' : ''}`,
    'aria-pressed': String(String(c) === estado.codigo), 'aria-label': `Código ${c}, ${descCodigo(c)}: ${n} visitas. Filtrar por este código.`,
    onclick: () => { alternarCodigo(c); if (estado.codigo) rolarPara('detalhe-codigo'); },
  },
  h('span', { class: 'pos', text: String(i + 1) }), chipCodigo(c), h('span', { class: 'desc', text: descCodigo(c) }), barra(n / max, corCodigo(c)),
  h('span', { class: 'val', text: fInt(n) }), h('span', { class: 'pct', text: fPct(n / total) }), h('span', { class: 'acum', text: fPct(acumulados.get(c), 0) }),
  base ? h('span', { class: 'acum', text: `${fDec((n / base) * 100, 2)} p.p.`, title: 'Contribuição na taxa de VT' }) : null));
  const soma = mostrar.reduce((s, [, n]) => s + n, 0);
  const ranking = cartao({ titulo: 'Ranking de códigos de baixa', sub: 'Clique num código para filtrar todo o painel por ele. A cor indica o tipo de intervenção.', acao: h('div', { class: 'legenda so-desktop' }, R.FAMILIAS.map((f) => h('span', null, h('i', { class: 'amostra', style: { '--cor': f.cor } }), f.rotulo))) },
    h('div', { class: `ranking${base ? ' com-pp' : ''}` }, cab, linhas),
    h('div', { class: 'ranking__rodape' },
      h('p', { class: 'dica', text: estado.rankTodos ? `${cods.length} códigos no filtro atual.` : `Mostrando ${mostrar.length} de ${cods.length} códigos — somam ${fPct(soma / total)} das VTs.` }),
      cods.length > LIM ? h('button', { class: 'botao botao--sec botao--mini', type: 'button', text: estado.rankTodos ? `Só os ${LIM} maiores` : `Ver todos os ${cods.length}`, onclick: () => { estado.rankTodos = !estado.rankTodos; renderTudo(); } }) : null));

  const sel = h('label', { class: 'seletor-inline' }, 'Detalhar código:',
    h('select', { onchange: (e) => { estado.codigo = e.target.value; renderTudo(); if (estado.codigo) rolarPara('detalhe-codigo'); } },
      h('option', { value: '', text: '— escolher —' }),
      cods.map(([c, n]) => { const o = h('option', { value: String(c), text: `${c} · ${descCodigo(c)} (${n})` }); if (String(c) === estado.codigo) o.selected = true; return o; })));
  const destaques = R.CODIGOS_DESTAQUE.filter((c) => String(c) !== estado.codigo);
  el.replaceChildren(kpis, ranking,
    secaoTitulo('Por que cada código ofendeu', 'Motivo raiz lido na observação do técnico (com SUBFALHA e CAUSA como apoio). Clique num motivo para ver as visitas.', sel),
    estado.codigo ? detalheCodigo(regs, +estado.codigo) : null,
    h('div', { class: 'g2' }, destaques.map((c) => cardCodigo(regs, c))));
}

/* ------------------------------------------------------------------ VIEW: CAUSAS RELACIONADAS */
function viewCausas(el) {
  const regs = filtrar(regsMes());
  const total = regs.length;
  if (!total) { el.replaceChildren(cartao({ titulo: 'Sem visitas no filtro atual' })); return; }
  const ant = mesAnterior();
  const regsAnt = ant ? filtrar(regsMes(ant)) : null;
  const mAnt = ant ? mesCurto(ant) : null;
  const porEixo = contar(regs, 'eixo');
  const porEixoAnt = regsAnt ? contar(regsAnt, 'eixo') : null;
  const eixos = R.EIXOS.filter((e) => porEixo.get(e.id)).sort((a, b) => (INDEF.has(a.id)) - (INDEF.has(b.id)) || porEixo.get(b.id) - porEixo.get(a.id));

  const partes = partesNatureza(regs);
  const ext = partes.find((p) => p.id === 'externa').n; const op = partes.find((p) => p.id === 'operacao').n;
  const cardNat = cartao({ titulo: 'Natureza das causas', sub: escopoTexto() },
    h('p', { style: { 'font-size': '15px', color: 'var(--tinta-2)' } }, rico(`**${fPct(ext / total, 0)}** das visitas vieram de causas **externas**; **${fPct(op / total, 0)}** de causas em que a **operação Claro** pode atuar.`)),
    segmentada(partes, total),
    h('div', { class: 'natureza-lista' }, partes.map((p) => h('div', { class: 'natureza-item' },
      h('i', { class: 'amostra', style: { '--cor': p.cor } }),
      h('div', null, h('strong', { text: p.rotulo }), h('small', { text: NATUREZA.get(p.id).desc })),
      h('p', { class: 'n' }, fInt(p.n), h('small', { text: ` · ${fPct(p.n / total, 0)}` }))))));
  const cardMapa = cartao({ titulo: 'Mapa de causas', sub: 'Tamanho = nº de visitas. Clique num bloco para ver tudo o que está ligado a ele.' },
    treemap(eixos.map((e) => ({ id: e.id, rotulo: e.rotulo, v: porEixo.get(e.id), cor: corNatureza(e.natureza), clara: naturezaClara(e.natureza), dica: e.desc })), (id) => rolarPara(`eixo-${id}`)),
    h('div', { class: 'legenda' }, R.NATUREZAS.map((n) => h('span', null, h('i', { class: 'amostra', style: { '--cor': n.cor } }), n.rotulo))));

  const cards = eixos.map((e) => {
    const re = regs.filter((r) => r.eixo === e.id);
    const n = re.length;
    const mots = ordenar(contar(re, 'motivo'));
    const cods = ordenar(contar(re, 'bx')).slice(0, 8);
    const cids = ordenar(contar(re, 'area')).slice(0, 4);
    const cor = corNatureza(e.natureza);
    return h('article', { class: 'cartao', id: `eixo-${e.id}`, style: { 'scroll-margin-top': '96px' } },
      h('div', { class: 'eixo-cab' },
        h('div', null,
          h('h3', { style: { '--cor': cor } }, h('i'), e.rotulo),
          h('div', { style: { display: 'flex', gap: '8px', 'margin-top': '6px', 'flex-wrap': 'wrap' } },
            h('span', { class: `tag tag--${e.natureza}`, text: NATUREZA.get(e.natureza).rotulo }),
            porEixoAnt ? delta(n, porEixoAnt.get(e.id) || 0, { mesAnt: mAnt }) : null)),
        h('div', { class: 'eixo-n' }, h('strong', { text: fInt(n) }), h('span', { text: `VTs · ${fPct(n / total)}` }))),
      h('p', { class: 'eixo-desc', text: e.desc }),
      h('div', { style: { display: 'grid', gap: '6px' } }, h('p', { class: 'subtitulo-bloco', text: 'Motivos relacionados' }),
        h('div', { class: 'barras' }, mots.map(([m, v]) => linhaBarra({ rotulo: rotMotivo(m), n: v, max: mots[0][1], cor: naturezaClara(e.natureza) ? '#a9a7a0' : cor, pct: v / n, onclick: () => abrirBase({ motivo: m }), title: 'Ver estas visitas' })))),
      h('div', { class: 'eixo-blocos' },
        h('div', null, h('p', { class: 'subtitulo-bloco', text: 'Códigos envolvidos' }), h('div', { class: 'chips' }, cods.map(([c, v]) => chipCodigo(c, `×${v}`)))),
        h('div', null, h('p', { class: 'subtitulo-bloco', text: 'Cidades mais afetadas' }),
          h('div', { class: 'cidades-mini' }, cids.map(([a, v]) => h('div', null, h('span', { text: a }), h('b', { text: fInt(v) })))))),
      h('div', { class: 'card-pe' }, linkSeta(`Ver as ${vts(n)}`, () => abrirBase({ eixo: e.id }))));
  });

  const regsCid = filtrar(regsMes(), { area: false });
  const cidades = ordenar(contar(regsCid, 'area'));
  const mat = new Map(cidades.map(([a]) => [a, contar(regsCid.filter((r) => r.area === a), 'eixo')]));
  const totEixo = contar(regsCid, 'eixo');
  const eixosMat = R.EIXOS.filter((e) => totEixo.get(e.id)).sort((a, b) => totEixo.get(b.id) - totEixo.get(a.id));
  const matriz = cartao({ titulo: 'Causas × cidades', sub: 'Quantas visitas cada grupo de causa gerou em cada cidade. O ● marca a cidade mais afetada por cada causa.', acao: h('span', { class: 'escala so-desktop' }, 'menos', h('i'), h('i'), h('i'), h('i'), h('i'), 'mais') },
    heatmap({
      linhas: eixosMat.map((e) => ({ id: e.id, rotulo: e.rotulo })),
      colunas: cidades.map(([a]) => ({ id: a, rotulo: a })),
      valor: (e, a) => mat.get(a).get(e) || 0,
      escala: 'linha',
      totalLinha: (e) => [fInt(totEixo.get(e)), h('small', { text: fPct(totEixo.get(e) / regsCid.length, 0) })],
      onLinha: (e) => rolarPara(`eixo-${e}`),
      onColuna: (a) => alternarArea(a),
      tipLinha: (e, v) => `${fPct(v / totEixo.get(e), 0)} desta causa`,
      tipColuna: (a, v) => `${fPct(v / cidades.find(([x]) => x === a)[1], 0)} das VTs da cidade`,
    }));

  el.replaceChildren(h('div', { class: 'g-1-2' }, cardNat, cardMapa),
    secaoTitulo('Tudo o que está relacionado', 'Cada grupo junta motivos da mesma origem, somando todos os códigos. Ex.: água e oxidação no conector entram em “Chuva, vento e umidade”; o 589 cortado na troca de poste e o 566 rompido pela obra no poste entram em “Poste e concessionária”.'),
    h('div', { class: 'g2' }, cards),
    matriz);
}

/* ------------------------------------------------------------------ VIEW: CIDADES */
function resumoCidades() {
  const regsDDD = filtrar(regsMes(), { area: false });
  const ant = mesAnterior();
  const regsAntDDD = ant ? filtrar(regsMes(ant), { area: false }) : null;
  const mAnt = ant ? mesCurto(ant) : null;
  return ordenar(contar(regsDDD, 'area')).map(([a, n]) => {
    const rc = regsDDD.filter((r) => r.area === a);
    const rca = regsAntDDD ? regsAntDDD.filter((r) => r.area === a) : null;
    return { a, n, rc, rca, share: n / regsDDD.length, insights: insightsCidade(a, rc, regsDDD, rca, mAnt) };
  });
}

function exportarResumoCidades() {
  const linhas = resumoCidades();
  const eixos = R.EIXOS;
  const meta = metaMes();
  const cols = ['Cidade', 'VTs', '% do DDD', estado.comp && mesAnterior() ? `Variação vs ${mesCurto(mesAnterior())}` : 'Variação', 'Reincidência %', 'Sem observação', 'Top códigos',
    ...eixos.map((e) => e.rotulo), 'Leitura'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const corpo = linhas.map((l) => {
    const ce = contar(l.rc, 'eixo');
    return [l.a, l.n, fDec(l.share * 100, 1), l.rca ? l.n - l.rca.length : '', fDec((l.rc.filter((r) => r.log > 0).length / l.n) * 100, 1),
      l.rc.filter((r) => r.flags.includes('obs_vazia')).length,
      ordenar(contar(l.rc, 'bx')).slice(0, 3).map(([c, v]) => `${c} (${v})`).join(' / '),
      ...eixos.map((e) => ce.get(e.id) || 0),
      l.insights.map(semNegrito).join(' | ')];
  });
  const csv = [`Resumo por cidade — DDD ${estado.ddd} — ${meta.rotulo}${estado.parceira ? ` — parceira ${estado.parceira}` : ''}${estado.codigo ? ` — código ${estado.codigo}` : ''}`, cols.join(';'), ...corpo.map((r) => r.map(esc).join(';'))].join('\r\n');
  baixar(csv, `resumo-cidades-ddd${estado.ddd}-${estado.mes}.csv`);
}

function viewCidades(el) {
  const lista = resumoCidades();
  if (!lista.length) { el.replaceChildren(cartao({ titulo: 'Sem visitas no filtro atual' })); return; }
  const ant = mesAnterior();
  const mAnt = ant ? mesCurto(ant) : null;
  const base = metaMes().base_assinantes?.por_regiao || {};
  const cards = lista.map((l) => {
    const eixos = ordenar(new Map([...contar(l.rc, 'eixo')].filter(([e]) => !INDEF.has(e)))).slice(0, 3);
    const cods = ordenar(contar(l.rc, 'bx')).slice(0, 5);
    const b = base[l.rc[0].regiao];
    return h('article', { class: `cartao cidade${estado.area === l.a ? ' selecionada' : ''}` },
      h('div', { class: 'cidade__cab' },
        h('div', null, h('h3', { text: l.a }), h('p', { text: `${fPct(l.share)} das VTs do DDD${b ? ` · taxa ${fPct(l.n / b, 2)}` : ''}` })),
        h('div', { class: 'cidade__n' }, h('strong', { text: fInt(l.n) }), l.rca ? delta(l.n, l.rca.length, { mesAnt: mAnt }) : h('span', { class: 'kpi__sub', text: 'VTs' }))),
      segmentada(partesNatureza(l.rc), l.n, { rotulos: false }),
      h('div', { style: { display: 'grid', gap: '6px' } }, h('p', { class: 'subtitulo-bloco', text: 'Principais causas' }),
        h('div', { class: 'barras' }, eixos.map(([e, v]) => linhaBarra({ rotulo: rotEixo(e), n: v, max: eixos[0][1], cor: corEixo(e), pct: v / l.n })))),
      h('div', { style: { display: 'grid', gap: '6px' } }, h('p', { class: 'subtitulo-bloco', text: 'Códigos' }),
        h('div', { class: 'chips' }, cods.map(([c, v]) => chipCodigo(c, `×${v}`)))),
      l.insights.length ? h('ul', { class: 'insights insights--mini' }, l.insights.map((t) => h('li', null, rico(t)))) : null,
      h('div', { class: 'card-pe' }, linkSeta(estado.area === l.a ? 'Remover filtro' : `Filtrar ${l.a}`, () => alternarArea(l.a))));
  });

  const regsCid = filtrar(regsMes(), { area: false });
  const topCods = ordenar(contar(regsCid, 'bx')).slice(0, estado.codigo ? 1 : 8).map(([c]) => c);
  const mat = new Map(lista.map((l) => [l.a, contar(l.rc, 'bx')]));
  const totCod = contar(regsCid, 'bx');
  const matriz = cartao({ titulo: 'Códigos × cidades', sub: 'Em cada código, o ● marca a cidade mais impactada. Clique na cidade para filtrar.', acao: h('span', { class: 'escala so-desktop' }, 'menos', h('i'), h('i'), h('i'), h('i'), h('i'), 'mais') },
    heatmap({
      linhas: lista.map((l) => ({ id: l.a, rotulo: l.a })),
      colunas: topCods.map((c) => ({ id: c, rotulo: String(c), chip: chipCodigo(c), sub: descCodigo(c), title: `${c} · ${descCodigo(c)} — filtrar` })),
      valor: (a, c) => mat.get(a).get(c) || 0,
      escala: 'coluna',
      totalLinha: (a) => { const l = lista.find((x) => x.a === a); return [fInt(l.n), h('small', { text: fPct(l.share, 0) })]; },
      onLinha: (a) => alternarArea(a),
      onColuna: (c) => alternarCodigo(c),
      linhaSel: estado.area || null,
      tipLinha: (a, v) => `${fPct(v / lista.find((x) => x.a === a).n, 0)} das VTs da cidade`,
      tipColuna: (c, v) => `${fPct(v / totCod.get(c), 0)} do código`,
    }));

  el.replaceChildren(
    secaoTitulo(`${lista.length} cidades / áreas`, `Cada cartão mostra o peso da cidade no DDD${ant ? `, a variação vs ${mAnt}` : ''}, as causas que mais pesam e a leitura do que está acontecendo — comparando com a média do DDD.`,
      h('button', { class: 'botao botao--sec', type: 'button', onclick: exportarResumoCidades }, icone('download'), 'Exportar resumo (CSV)')),
    h('div', { class: 'legenda' }, R.NATUREZAS.map((n) => h('span', null, h('i', { class: 'amostra', style: { '--cor': n.cor } }), n.rotulo))),
    h('div', { class: 'g3' }, cards),
    matriz);
}

/* ------------------------------------------------------------------ VIEW: REINCIDÊNCIA + QUALIDADE */
function viewReincidencia(el) {
  const regs = filtrar(estado.reinc === 'todos' ? todosRegs() : regsMes());
  if (!regs.length) { el.replaceChildren(cartao({ titulo: 'Sem visitas no filtro atual' })); return; }
  const total = regs.length;
  const porContrato = contar(regs, 'contrato');
  const contratosRep = [...porContrato.values()].filter((n) => n > 1);
  const grupoEnd = new Map();
  for (const r of regs) if (r.chaveEnd) (grupoEnd.get(r.chaveEnd) || grupoEnd.set(r.chaveEnd, []).get(r.chaveEnd)).push(r);
  const ends = [...grupoEnd.values()].filter((v) => v.length > 1).sort((a, b) => b.length - a.length || (b.at(-1).quando > a.at(-1).quando ? 1 : -1));
  const grupoNap = new Map();
  for (const r of regs) if (r.napId) (grupoNap.get(r.napId) || grupoNap.set(r.napId, []).get(r.napId)).push(r);
  const naps = [...grupoNap.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
  const napsGen = ordenar(contar(regs.filter((r) => !r.napId), (r) => r.nap || '(vazia)'));
  const nGen = napsGen.reduce((s, [, n]) => s + n, 0);
  const comLog = regs.filter((r) => r.log > 0).length;

  const escopo = ordemMeses().length > 1 ? h('div', { class: 'alternador', role: 'group', 'aria-label': 'Período' },
    ['mes', 'todos'].map((v) => h('button', { type: 'button', 'aria-pressed': String(estado.reinc === v), text: v === 'mes' ? 'Mês selecionado' : `Todos os meses (${ordemMeses().length})`, onclick: () => { estado.reinc = v; renderTudo(); } }))) : null;

  const kpis = h('div', { class: 'kpis-linha' },
    kpi({ rotulo: 'VTs com visita anterior', valor: fPct(comLog / total), sub: `${vts(comLog)} com LOG ≥ 1`, classe: 'kpi--compacto' }),
    kpi({ rotulo: 'Contratos com 2+ VTs', valor: fInt(contratosRep.length), sub: `${fInt(contratosRep.reduce((s, n) => s + n - 1, 0))} visitas repetidas`, classe: 'kpi--compacto' }),
    kpi({ rotulo: 'Endereços com 2+ VTs', valor: fInt(ends.length), sub: 'mesmo endereço e cidade', classe: 'kpi--compacto' }),
    kpi({ rotulo: 'NAPs com 2+ VTs', valor: fInt(naps.length), sub: `entre ${fInt(grupoNap.size)} NAPs identificadas`, classe: 'kpi--compacto' }));

  const ordemTempo = (vs) => [...vs].sort((a, b) => (a.quando > b.quando ? 1 : -1));
  const sequencia = (vs) => {
    const el2 = h('span', { class: 'chips' });
    ordemTempo(vs).forEach((r, i) => {
      const chip = h('span', { class: 'cod', style: { '--cor': corCodigo(r.bx) }, tabindex: '0', dataset: { tip: `${r.bx} · ${descCodigo(r.bx)}`, tipSub: `${fData(r.agenda)} · ${rotMotivo(r.motivo)}` } }, String(r.bx));
      el2.append(i ? h('span', { class: 'passo' }, h('span', { class: 'seta', text: '→' }), chip) : chip);
    });
    return el2;
  };
  const LIM = 12;
  const tabEnd = ends.length ? [
    h('div', { class: 'rolagem tabela-desktop' }, h('table', { class: 'tabela' },
      h('thead', null, h('tr', null, h('th', { text: 'Endereço' }), h('th', { text: 'VTs', style: { 'text-align': 'right' } }), h('th', { text: 'Sequência de códigos' }), h('th', { text: 'Última visita' }))),
      h('tbody', null, ends.slice(0, LIM).map((vs) => {
        const ult = ordemTempo(vs).at(-1);
        return h('tr', null,
          h('td', { class: 'end' }, vs[0].endereco, h('small', { text: `${vs[0].area} · contrato ${vs[0].contrato}${new Set(vs.map((r) => r.contrato)).size > 1 ? ' e outros' : ''}` })),
          h('td', { class: 'n', text: fInt(vs.length) }), h('td', null, sequencia(vs)),
          h('td', null, h('span', { class: 'nowrap', text: fData(ult.agenda) }), h('small', { text: rotMotivo(ult.motivo) })));
      })))),
    h('div', { class: 'lista-cards' }, ends.slice(0, LIM).map((vs) => {
      const ult = ordemTempo(vs).at(-1);
      return h('div', { class: 'item-card' },
        h('div', { class: 'item-card__topo' }, h('b', { text: vs[0].endereco }), h('span', { class: 'delta delta--ruim', text: `${vs.length} VTs` })),
        h('p', { text: `${vs[0].area} · contrato ${vs[0].contrato} · última ${fData(ult.agenda)}: ${rotMotivo(ult.motivo)}` }),
        sequencia(vs));
    }))] : h('p', { class: 'vazio', text: 'Nenhum endereço com mais de uma visita no filtro atual.' });

  const tabNap = naps.length ? h('div', { class: 'barras' }, naps.slice(0, LIM).map(([nap, vs]) => h('div', { class: 'item-card' },
    h('div', { class: 'item-card__topo' }, h('b', { text: nap }), h('span', null, `${vs[0].area} · ${plural(new Set(vs.map((r) => r.chaveEnd)).size, 'endereço', 'endereços')} · `, h('strong', { text: vts(vs.length) }))),
    h('div', { class: 'chips' }, ordenar(contar(vs, 'bx')).map(([c, n]) => chipCodigo(c, n > 1 ? `×${n}` : '')))))) : h('p', { class: 'vazio', text: 'Nenhuma NAP com mais de uma visita no filtro atual.' });

  const flag = (k) => regs.filter((r) => r.flags.includes(k));
  const vazias = flag('obs_vazia');
  const porParc = ordenar(contar(vazias, 'parceira')).map(([p, n]) => `${p} ${n}`).join(' · ');
  const nSub = regs.filter((r) => r.fonteMotivo === 'subfalha' || r.fonteMotivo === 'causa').length;
  const nSem = regs.filter((r) => r.motivo === 'sem_info').length;
  const qual = (rot, n, sub, acao) => h('div', { class: 'qual-linha' },
    acao ? h('button', { type: 'button', onclick: acao }, h('span', { class: 'qual-rot', text: rot }), h('small', { text: sub })) : h('div', null, h('span', { class: 'qual-rot', text: rot }), h('small', { text: sub })),
    h('strong', { text: fInt(n) }));
  const qualidade = cartao({ titulo: 'Qualidade do apontamento', sub: 'Sinais encontrados no texto do técnico. Clique para ver as visitas.' },
    h('div', null,
      qual('Sem observação do técnico', vazias.length, porParc ? `por parceira: ${porParc}` : 'observação vazia, “ok”, “sem observação”…', vazias.length ? () => abrirBase({ flag: 'obs_vazia' }) : null),
      qual('Indício de código de baixa errado', flag('baixa_errada').length, '“baixou errado”, “baixa errada”, “código errado”…', flag('baixa_errada').length ? () => abrirBase({ flag: 'baixa_errada' }) : null),
      qual('VT sem validação / justificativa', flag('sem_validacao').length, 'técnico não validou ou não justificou', flag('sem_validacao').length ? () => abrirBase({ flag: 'sem_validacao' }) : null),
      qual('Motivo só pela SUBFALHA/CAUSA', nSub, 'a observação não trazia a causa', null),
      qual('Sem informação de motivo', nSem, 'nenhum campo identifica a causa', nSem ? () => abrirBase({ motivo: 'sem_info' }) : null),
      qual('NAP genérica / não cadastrada', nGen, napsGen.slice(0, 3).map(([v, n]) => `${v} (${n})`).join(' · ') || '—', null)));

  el.replaceChildren(
    secaoTitulo('Onde a causa não foi resolvida na primeira ida', 'Endereços e NAPs com mais de uma visita, com a sequência de códigos.', escopo),
    kpis,
    cartao({ titulo: 'Endereços com mais visitas', sub: `${plural(ends.length, 'endereço', 'endereços')} com 2+ VTs${estado.codigo ? ` do código ${estado.codigo}` : ''}. Passe o mouse no código para ver data e motivo.` }, tabEnd),
    h('div', { class: 'g2' },
      cartao({ titulo: 'NAPs com mais visitas', sub: `NAP genérica (${napsGen[0]?.[0] || '—'}) fora da conta: ${vts(nGen)} sem NAP real. Formatos diferentes da mesma NAP são unificados.` }, tabNap),
      qualidade));
}

/* ------------------------------------------------------------------ VIEW: COMPARATIVO */
function listaVariacao(itens, { maxAbs, comChip }) {
  if (!itens.length) return h('p', { class: 'vazio', text: 'Nenhuma variação.' });
  return h('div', { class: 'var-lista' }, itens.map((it) => h('div', { class: `var-linha${comChip ? '' : ' sem-chip'}` },
    comChip ? chipCodigo(it.k) : null,
    h('div', { class: 'rot' }, h('span', { text: it.rotulo }), h('small', { text: `${fInt(it.a)} → ${fInt(it.b)} VTs` })),
    barra(Math.abs(it.d) / maxAbs, it.d > 0 ? 'var(--ruim-marca)' : 'var(--bom-marca)'),
    h('div', { class: 'd' }, h('span', { class: `delta delta--${it.d > 0 ? 'ruim' : it.d < 0 ? 'bom' : 'neutro'}`, text: `${it.d > 0 ? '▲' : it.d < 0 ? '▼' : '■'} ${fSinal(it.d)}` }), h('small', { text: fPPdif(it.pp) })))));
}

function viewComparativo(el) {
  const meses = ordemMeses();
  if (meses.length < 2) {
    el.replaceChildren(cartao({ classe: 'estado-vazio' },
      h('div', { class: 'estado-vazio__ilustra', 'aria-hidden': 'true' },
        h('i', { class: 'up', style: { width: '92%' } }), h('i', { class: 'up', style: { width: '64%' } }), h('i', { style: { width: '40%' } }),
        h('i', { class: 'down', style: { width: '55%' } }), h('i', { class: 'down', style: { width: '30%' } })),
      h('div', null,
        h('h3', { text: 'O comparativo liga sozinho a partir do 2º mês' }),
        h('p', { text: `Hoje o DDD ${estado.ddd} tem 1 mês publicado (${metaMes(meses[0]).rotulo}). Com o próximo mês, esta tela mostra o que mais subiu e caiu em códigos, causas e cidades.` }),
        ...[...estado.dados.keys()].filter((d) => d !== estado.ddd && estado.dados.get(d).ordem.length > 1).map((d) => {
          const o = estado.dados.get(d).ordem;
          return h('button', { class: 'botao botao--primario', type: 'button', style: { 'margin-top': '14px' }, onclick: () => { window.location.hash = `#/${d}/comparativo`; } }, `Ver comparativo do DDD ${d} (${mesCurto(o.at(-2))} → ${mesCurto(o.at(-1))})`, icone('seta'));
        }))));
    return;
  }
  let { a, b } = estado.comp;
  if (!b || !meses.includes(b)) b = mesAnterior(estado.mes) ? estado.mes : meses[1];
  if (!a || !meses.includes(a) || a >= b) a = mesAnterior(b);
  estado.comp = { a, b };
  const opcoes = (atual, f) => meses.filter(f).map((m) => { const o = h('option', { value: m, text: metaMes(m).rotulo }); if (m === atual) o.selected = true; return o; });
  const sel = h('div', { class: 'seletor-inline' },
    'Comparar', h('select', { 'aria-label': 'Mês atual', onchange: (e) => { estado.comp = { a: null, b: e.target.value }; renderTudo(); } }, opcoes(b, (m) => m !== meses[0])),
    'com', h('select', { 'aria-label': 'Mês de referência', onchange: (e) => { estado.comp.a = e.target.value; renderTudo(); } }, opcoes(a, (m) => m < b)));

  const rA = filtrar(regsMes(a), { codigo: false }); const rB = filtrar(regsMes(b), { codigo: false });
  const cA = estado.codigo ? rA.filter((r) => r.bx === +estado.codigo) : rA;
  const cB = estado.codigo ? rB.filter((r) => r.bx === +estado.codigo) : rB;
  const ma = mesCurto(a); const mb = mesCurto(b);
  const pct = (arr, fn) => (arr.length ? (arr.filter(fn).length / arr.length) * 100 : 0);
  const bA = baseEfetiva(a); const bB = baseEfetiva(b);
  const imp = (r) => norm(r.fato) === 'improdutiva';
  const kpis = h('div', { class: 'kpis-linha' },
    kpi({ rotulo: `Total de VTs (${mb})`, valor: fInt(rB.length), dlt: delta(rB.length, rA.length, { mesAnt: ma, comPct: true }), sub: `${ma}: ${fInt(rA.length)}`, classe: 'kpi--compacto' }),
    bA && bB ? kpi({ rotulo: 'Taxa de VT', valor: fPct(rB.length / bB, 2), dlt: delta((rB.length / bB) * 100, (rA.length / bA) * 100, { tipo: 'pp', mesAnt: ma }), sub: `${ma}: ${fPct(rA.length / bA, 2)}`, classe: 'kpi--compacto' }) : null,
    kpi({ rotulo: 'Reincidência', valor: `${fDec(pct(rB, (r) => r.log > 0), 1)}%`, dlt: delta(pct(rB, (r) => r.log > 0), pct(rA, (r) => r.log > 0), { tipo: 'pp', mesAnt: ma }), sub: `${ma}: ${fDec(pct(rA, (r) => r.log > 0), 1)}%`, classe: 'kpi--compacto' }),
    kpi({ rotulo: 'Causas externas', valor: `${fDec(pct(rB, (r) => r.natureza === 'externa'), 0)}%`, dlt: delta(pct(rB, (r) => r.natureza === 'externa'), pct(rA, (r) => r.natureza === 'externa'), { tipo: 'pp', mesAnt: ma }), sub: `${ma}: ${fDec(pct(rA, (r) => r.natureza === 'externa'), 0)}%`, classe: 'kpi--compacto' }),
    kpi({ rotulo: 'Improdutivas', valor: `${fDec(pct(rB, imp), 1)}%`, dlt: delta(pct(rB, imp), pct(rA, imp), { tipo: 'pp', mesAnt: ma }), sub: `${ma}: ${fDec(pct(rA, imp), 1)}%`, classe: 'kpi--compacto' }));

  const vc = variacoes(rA, rB, 'bx').map((x) => ({ ...x, rotulo: descCodigo(x.k) }));

  // destaques: maior alta e maior queda, com o que puxou cada movimento
  const alta = vc.filter((x) => x.d > 0).sort((x, y) => y.d - x.d)[0];
  const queda = vc.filter((x) => x.d < 0).sort((x, y) => x.d - y.d)[0];
  const destaque = (x, tipo) => {
    if (!x) return cartao({ classe: 'destaque-var' }, h('p', { class: 'vazio', text: tipo === 'alta' ? 'Nenhum código aumentou.' : 'Nenhum código diminuiu.' }));
    const dentroA = rA.filter((r) => r.bx === x.k); const dentroB = rB.filter((r) => r.bx === x.k);
    const motor = variacoes(dentroA, dentroB, 'motivo').filter((m) => Math.sign(m.d) === Math.sign(x.d) && m.k !== 'sem_info').sort((p, q) => Math.abs(q.d) - Math.abs(p.d))[0];
    return h('article', { class: `cartao destaque-var destaque-var--${tipo}` },
      h('p', { class: 'destaque-var__sobre' }, tipo === 'alta' ? '▲ Código que mais aumentou' : '▼ Código que mais diminuiu'),
      h('div', { class: 'destaque-var__cod' }, chipCodigo(x.k), h('strong', { text: descCodigo(x.k) })),
      h('div', { class: 'destaque-var__nums' },
        h('span', { class: 'destaque-var__ab' }, h('small', { text: ma }), fInt(x.a)),
        h('span', { class: 'destaque-var__seta', text: '→' }),
        h('span', { class: 'destaque-var__ab destaque-var__ab--b' }, h('small', { text: mb }), fInt(x.b)),
        h('span', { class: 'destaque-var__d' }, `${fSinal(x.d)} VTs`, h('small', { text: x.a ? ` (${sinal(x.d)}${fPct(Math.abs(x.d) / x.a, 0)})` : ' (novo)' }))),
      h('p', { class: 'destaque-var__sub' }, rico(`Participação: ${fPct(x.a / (rA.length || 1))} → **${fPct(x.b / (rB.length || 1))}** (${fPPdif(x.pp)})${motor ? ` · motivo que mais ${x.d > 0 ? 'cresceu' : 'caiu'}: **${rotMotivo(motor.k).toLowerCase()}** (${fSinal(motor.d)})` : ''}.`)));
  };

  // gráfico divergente: diminuiu ◀ | ▶ aumentou
  const mov = vc.filter((x) => x.d !== 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 12).sort((x, y) => y.d - x.d);
  const maxMov = Math.max(1, ...mov.map((x) => Math.abs(x.d)));
  const divergente = h('div', { class: 'diverg' },
    h('div', { class: 'diverg__cab', 'aria-hidden': 'true' }, h('span'), h('span', { class: 'diverg__menos', text: '◀ diminuiu' }), h('span', { class: 'diverg__mais', text: 'aumentou ▶' }), h('span')),
    mov.map((x) => h('div', { class: 'diverg__linha', tabindex: '0', dataset: { tip: `${x.k} · ${descCodigo(x.k)}`, tipSub: `${ma}: ${fInt(x.a)} → ${mb}: ${fInt(x.b)} (${fSinal(x.d)} VTs · ${fPPdif(x.pp)})` } },
      h('span', { class: 'diverg__rot' }, chipCodigo(x.k), h('span', { text: descCodigo(x.k) })),
      h('span', { class: 'diverg__lado diverg__lado--menos' }, x.d < 0 ? h('i', { style: { width: `${(Math.abs(x.d) / maxMov) * 100}%` } }) : null),
      h('span', { class: 'diverg__lado diverg__lado--mais' }, x.d > 0 ? h('i', { style: { width: `${(x.d / maxMov) * 100}%` } }) : null),
      h('span', { class: `diverg__val ${x.d > 0 ? 'ruim' : 'bom'}`, text: fSinal(x.d) }))));

  // antes × depois (halteres) dos maiores códigos
  const maiores = vc.sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b)).slice(0, 8);
  const maxAB = Math.max(1, ...maiores.map((x) => Math.max(x.a, x.b)));
  const halteres = h('div', { class: 'halteres' },
    h('div', { class: 'legenda' }, h('span', null, h('i', { class: 'halter__ponto halter__ponto--a' }), metaMes(a).rotulo), h('span', null, h('i', { class: 'halter__ponto halter__ponto--b' }), metaMes(b).rotulo)),
    maiores.map((x) => {
      const lo = Math.min(x.a, x.b) / maxAB; const hi = Math.max(x.a, x.b) / maxAB;
      return h('div', { class: 'halter', tabindex: '0', dataset: { tip: `${x.k} · ${descCodigo(x.k)}`, tipSub: `${ma}: ${fInt(x.a)} → ${mb}: ${fInt(x.b)}` } },
        h('span', { class: 'diverg__rot' }, chipCodigo(x.k), h('span', { text: descCodigo(x.k) })),
        h('span', { class: 'halter__trilho' },
          h('i', { class: `halter__linha ${x.d > 0 ? 'ruim' : x.d < 0 ? 'bom' : ''}`, style: { left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` } }),
          h('i', { class: 'halter__ponto halter__ponto--a', style: { left: `${(x.a / maxAB) * 100}%` } }),
          h('i', { class: 'halter__ponto halter__ponto--b', style: { left: `${(x.b / maxAB) * 100}%` } })),
        h('span', { class: 'halter__val' }, `${fInt(x.a)} → `, h('strong', { text: fInt(x.b) })));
    }));
  const ve = variacoes(cA, cB, 'eixo').map((x) => ({ ...x, rotulo: rotEixo(x.k) }));
  const maxE = Math.max(1, ...ve.map((x) => Math.abs(x.d)));
  const vm = variacoes(cA, cB, 'motivo').filter((x) => x.d !== 0).map((x) => ({ ...x, rotulo: rotMotivo(x.k) }));
  const maxM = Math.max(1, ...vm.map((x) => Math.abs(x.d)));
  const va = variacoes(cA, cB, 'area').map((x) => ({ ...x, rotulo: x.k })).sort((x, y) => y.d - x.d);
  const maxA = Math.max(1, ...va.map((x) => Math.abs(x.d)));
  const totais = meses.map((m) => ({ m, n: filtrar(regsMes(m)).length }));
  const maxT = Math.max(1, ...totais.map((t) => t.n));
  const sub = estado.codigo ? ` · dentro do código ${estado.codigo}` : '';

  el.replaceChildren(
    secaoTitulo(`${metaMes(a).rotulo} → ${metaMes(b).rotulo}`, `Variação em VTs e em participação (p.p.) · ${escopoTexto()}`, sel),
    h('div', { class: 'g2' }, destaque(alta, 'alta'), destaque(queda, 'queda')),
    kpis,
    h('div', { class: 'g2' },
      cartao({ titulo: 'Variação por código', sub: `Os ${mov.length} maiores movimentos de ${ma} para ${mb} (VTs)` }, divergente),
      cartao({ titulo: 'Antes × depois', sub: 'Os maiores códigos nos dois meses' }, halteres)),
    h('div', { class: 'g2' },
      cartao({ titulo: 'Grupos de causa: variação', sub: `Causas relacionadas${sub}` }, listaVariacao(ve.filter((x) => x.d !== 0).sort((x, y) => y.d - x.d), { maxAbs: maxE })),
      cartao({ titulo: 'Motivos: maiores variações', sub: `Os 10 maiores movimentos${sub}` }, listaVariacao(vm.sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 10).sort((x, y) => y.d - x.d), { maxAbs: maxM }))),
    h('div', { class: 'g2' },
      cartao({ titulo: 'Variação por cidade', sub: `${ma} → ${mb}${sub}` }, listaVariacao(va, { maxAbs: maxA })),
      cartao({ titulo: 'Evolução mensal de VTs', sub: escopoTexto() },
        h('div', { class: 'colunas-mes' }, totais.map((t) => h('div', { class: `coluna-mes${t.m === b ? ' atual' : ''}` },
          h('b', { text: fInt(t.n) }), h('span', { style: { height: `${(t.n / maxT) * 140}px` }, dataset: { tip: vts(t.n), tipSub: metaMes(t.m).rotulo } })))),
        h('div', { class: 'rotulos-mes' }, totais.map((t) => h('small', { text: mesCurto(t.m) }))))));
}

/* ------------------------------------------------------------------ VIEW: BASE */
const POR_PAGINA = 20;
function regsBase() {
  const t = estado.tabela;
  const q = norm(t.busca);
  return filtrar(regsMes()).filter((r) => (!t.motivo || r.motivo === t.motivo) && (!t.eixo || r.eixo === t.eixo) && (!t.flag || r.flags.includes(t.flag))
    && (!q || norm([r.contrato, r.endereco, r.obs, r.nap, r.bx, r.area, rotMotivo(r.motivo), rotEixo(r.eixo), r.subfalha, r.parceira].join(' ')).includes(q)))
    .sort((a, b) => (b.agenda || '').localeCompare(a.agenda || '') || (b.baixa || '').localeCompare(a.baixa || ''));
}

function baixar(texto, nome) {
  const url = URL.createObjectURL(new Blob(['﻿', texto], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportarCSV() {
  const linhas = regsBase();
  const cols = [['DDD', (r) => r.ddd], ['Data agenda', (r) => r.agenda], ['Data baixa', (r) => r.baixa], ['Cidade', (r) => r.area], ['Código', (r) => r.bx], ['Descrição', (r) => descCodigo(r.bx)],
    ['Grupo de causa', (r) => rotEixo(r.eixo)], ['Natureza', (r) => NATUREZA.get(r.natureza)?.rotulo], ['Motivo raiz', (r) => rotMotivo(r.motivo)], ['Origem do motivo', (r) => r.fonteMotivo], ['Observação', (r) => r.obs],
    ['FATO', (r) => r.fato], ['CAUSA', (r) => r.causa], ['SUBFALHA', (r) => r.subfalha], ['AÇÃO', (r) => r.acao], ['Endereço', (r) => r.endereco], ['Contrato', (r) => r.contrato],
    ['NAP', (r) => r.nap], ['Parceira', (r) => r.parceira], ['LOG', (r) => r.log], ['RX', (r) => (r.rx_off ? 'OFF' : r.rx)]];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map(([c]) => c).join(';'), ...linhas.map((r) => cols.map(([, f]) => esc(f(r))).join(';'))].join('\r\n');
  baixar(csv, `vts-ddd${estado.ddd}-${estado.mes}${estado.area ? `-${norm(estado.area).replace(/\s/g, '-')}` : ''}${estado.codigo ? `-${estado.codigo}` : ''}.csv`);
}

function corpoTabela() {
  const linhas = regsBase();
  const t = estado.tabela;
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  t.pagina = Math.min(t.pagina, paginas - 1);
  const pag = linhas.slice(t.pagina * POR_PAGINA, (t.pagina + 1) * POR_PAGINA);
  const mot = (r) => [h('i', { class: 'pontinho', style: { '--cor': corEixo(r.eixo) } }), ` ${rotMotivo(r.motivo)}`];
  const tabela = h('div', { class: 'rolagem tabela-desktop' }, h('table', { class: 'tabela tabela-base' },
    h('thead', null, h('tr', null, ['Agenda', 'Cidade', 'Código', 'Motivo raiz', 'Observação do técnico', 'Endereço', 'Contrato', 'NAP', 'Parceira', 'LOG'].map((c) => h('th', { text: c })))),
    h('tbody', null, pag.length ? pag.map((r) => h('tr', null,
      h('td', { class: 'nowrap', text: fData(r.agenda) }), h('td', { class: 'nowrap', text: r.area }), h('td', null, chipCodigo(r.bx)),
      h('td', { class: 'motivo-cel' }, mot(r), h('small', { text: rotEixo(r.eixo) })),
      h('td', { class: 'obs', text: r.obs || '—' }), h('td', { text: r.endereco || '—' }), h('td', { class: 'nowrap num', text: r.contrato || '—' }),
      h('td', { class: 'nowrap', text: r.nap || '—' }), h('td', { class: 'nowrap', text: r.parceira || '—' }), h('td', { class: 'n', text: String(r.log) })))
      : h('tr', null, h('td', { colspan: '10', class: 'vazio', text: 'Nenhuma visita encontrada.' })))));
  const cards = h('div', { class: 'lista-cards' }, pag.length ? pag.map((r) => h('div', { class: 'item-card' },
    h('div', { class: 'item-card__topo' }, h('span', null, `${fData(r.agenda)} · `, h('b', { text: r.area })), chipCodigo(r.bx)),
    h('p', { class: 'rot-mot' }, mot(r)),
    h('p', { text: r.obs || '— sem observação —' }),
    h('p', { class: 'dica', text: [r.endereco, r.contrato && `contrato ${r.contrato}`, r.nap, r.parceira, r.log ? `LOG ${r.log}` : null].filter(Boolean).join(' · ') }))) : h('p', { class: 'vazio', text: 'Nenhuma visita encontrada.' }));
  const ir = (p) => { t.pagina = p; $('#base-corpo').replaceChildren(...corpoTabela()); $('#base-corpo').scrollIntoView({ block: 'start' }); };
  const pg = h('div', { class: 'paginacao' },
    h('span', { text: `${plural(linhas.length, 'visita', 'visitas')} · página ${t.pagina + 1} de ${paginas}` }),
    h('div', null,
      h('button', { class: 'botao botao--sec botao--mini', type: 'button', text: '← Anterior', disabled: t.pagina === 0, onclick: () => ir(t.pagina - 1) }),
      h('button', { class: 'botao botao--sec botao--mini', type: 'button', text: 'Próxima →', disabled: t.pagina >= paginas - 1, onclick: () => ir(t.pagina + 1) })));
  return [tabela, cards, pg];
}

function viewBase(el) {
  const t = estado.tabela;
  const chips = [];
  const chip = (txt, limpar) => h('span', { class: 'chip-filtro' }, txt, h('button', { type: 'button', 'aria-label': `Remover ${txt}`, text: '×', onclick: () => { limpar(); t.pagina = 0; renderTudo(); } }));
  if (t.eixo) chips.push(chip(`Grupo: ${rotEixo(t.eixo)}`, () => { t.eixo = ''; }));
  if (t.motivo) chips.push(chip(`Motivo: ${rotMotivo(t.motivo)}`, () => { t.motivo = ''; }));
  if (t.flag) chips.push(chip(FLAG_ROTULO[t.flag], () => { t.flag = ''; }));
  const busca = h('input', { type: 'search', placeholder: 'Buscar contrato, endereço, NAP, observação…', value: t.busca, 'aria-label': 'Buscar na base de visitas' });
  let timer;
  busca.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { t.busca = busca.value; t.pagina = 0; $('#base-corpo').replaceChildren(...corpoTabela()); }, 180); });
  el.replaceChildren(cartao({ titulo: 'Todas as visitas do filtro', sub: 'Com a observação original do técnico e o motivo identificado.' },
    h('div', { class: 'base__ferramentas' },
      h('label', { class: 'busca' }, icone('busca'), h('span', { class: 'sr-only', text: 'Buscar' }), busca),
      h('div', { class: 'chips', style: { gap: '8px' } }, chips,
        h('button', { class: 'botao botao--sec', type: 'button', title: 'Baixa as visitas do filtro atual (abre no Excel)', onclick: exportarCSV }, icone('download'), 'Exportar CSV'))),
    h('div', { id: 'base-corpo', style: { display: 'grid', gap: '12px' } }, corpoTabela())));
}

/* ------------------------------------------------------------------ cabeçalho, filtros e navegação */
const RENDER = { geral: viewGeral, codigos: viewCodigos, causas: viewCausas, cidades: viewCidades, reincidencia: viewReincidencia, comparativo: viewComparativo, base: viewBase };

function preencherSelect(sel, opcoes, valor, rotuloTodos) {
  sel.replaceChildren(h('option', { value: '', text: rotuloTodos }),
    ...opcoes.map(([v, rot]) => { const o = h('option', { value: String(v), text: rot }); if (String(v) === String(valor)) o.selected = true; return o; }));
  sel.classList.toggle('ativo', !!valor);
}

function renderShell() {
  const view = VIEWS.find((v) => v.id === estado.view);
  const meta = metaMes();
  $('#titulo-view').textContent = view.rotulo;
  $('#sobretitulo').textContent = `DDD ${estado.ddd} · ${meta.rotulo}${estado.area ? ` · ${estado.area}` : ''}`;
  document.title = `${view.rotulo} · DDD ${estado.ddd} · Ofensores de VT`;
  $$('[data-ddd-switch] button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ddd === estado.ddd)));
  $$('#menu a').forEach((a) => (a.dataset.view === estado.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $$('#abas-mobile button').forEach((b) => {
    const atual = b.dataset.view === estado.view || (b.dataset.view === 'mais' && !VIEWS_ABAS.includes(estado.view));
    if (atual) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $$('#folha-mais [data-view]').forEach((b) => (b.dataset.view === estado.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $$('.view').forEach((s) => s.classList.toggle('ativa', s.dataset.view === estado.view));

  const regs = regsMes();
  const areas = ordenar(contar(regs, 'area'));
  if (estado.area && !areas.some(([a]) => a === estado.area)) areas.push([estado.area, 0]);
  preencherSelect($('#f-area'), areas.map(([a, n]) => [a, `${a} (${n})`]), estado.area, 'Todas as cidades');
  preencherSelect($('#f-parceira'), ordenar(contar(regs, 'parceira')).map(([p, n]) => [p, `${p} (${n})`]), estado.parceira, 'Todas');
  const cods = ordenar(contar(filtrar(regs, { codigo: false }), 'bx'));
  if (estado.codigo && !cods.some(([c]) => String(c) === estado.codigo)) cods.push([+estado.codigo, 0]);
  preencherSelect($('#f-codigo'), cods.map(([c, n]) => [c, `${c} · ${descCodigo(c)} (${n})`]), estado.codigo, 'Todos os códigos');
  $('#f-mes').replaceChildren(...[...ordemMeses()].reverse().map((m) => { const o = h('option', { value: m, text: metaMes(m).rotulo }); if (m === estado.mes) o.selected = true; return o; }));
  const baseInput = $('#f-base');
  if (document.activeElement !== baseInput) baseInput.value = estado.base[`${estado.ddd}-${estado.mes}`] || meta.base_assinantes?.total || '';
  const ativos = [estado.area, estado.parceira, estado.codigo].filter(Boolean).length;
  $('#contador-filtros').hidden = !ativos;
  $('#contador-filtros').textContent = String(ativos);
  $('#btn-limpar').hidden = !ativos;
  $('#rodape-fonte').textContent = `Fonte: ${meta.fonte} (aba ${meta.aba}) · processado em ${meta.gerado_em.slice(8, 10)}/${meta.gerado_em.slice(5, 7)}/${meta.gerado_em.slice(0, 4)} · ${fInt(meta.total_linhas)} visitas no mês.`;
}

function renderTudo() {
  renderShell();
  for (const s of $$('.view')) RENDER[s.dataset.view](s);
}

function trocarDDD(ddd) {
  estado.ddd = ddd;
  estado.mes = ordemMeses().at(-1);
  estado.area = ''; estado.parceira = ''; estado.codigo = '';
  estado.comp = { a: null, b: null }; estado.reinc = 'mes'; estado.rankTodos = false;
  estado.tabela = { busca: '', motivo: '', eixo: '', flag: '', pagina: 0 };
}

function aplicarRota() {
  const m = window.location.hash.match(/^#\/(\d{2})\/(\w+)/);
  let ddd = m?.[1]; let view = m?.[2];
  if (!estado.dados.has(ddd)) ddd = estado.ddd;
  if (!VIEWS.some((v) => v.id === view)) view = 'geral';
  if (ddd !== estado.ddd) trocarDDD(ddd);
  const mudou = view !== estado.view;
  estado.view = view;
  fecharFolhas();
  renderTudo();
  if (mudou) window.scrollTo(0, 0);
}

function abrirFiltros() {
  if (!window.matchMedia('(max-width: 1023px)').matches) { $('#f-base').focus(); return; }
  $('#filtros').classList.add('aberta'); $('#fundo-filtros').hidden = false; $('#btn-filtros').setAttribute('aria-expanded', 'true');
}
function fecharFolhas() {
  $('#filtros').classList.remove('aberta'); $('#fundo-filtros').hidden = true; $('#btn-filtros').setAttribute('aria-expanded', 'false');
  $('#folha-mais').hidden = true; $('#fundo-mais').hidden = true;
}

function salvarBaseLocal() { try { localStorage.setItem('vt-dash-base', JSON.stringify(estado.base)); } catch { /* ok */ } }
function carregarBaseLocal() { try { estado.base = JSON.parse(localStorage.getItem('vt-dash-base') || '{}') || {}; } catch { estado.base = {}; } }

function sair() { esquecerChave(); try { sessionStorage.removeItem('vt-dash-usuario'); localStorage.removeItem('vt-dash-usuario'); } catch { /* ok */ } window.location.hash = ''; window.location.reload(); }

function montarNavegacao() {
  const ddds = R.DDDS.filter((d) => estado.dados.has(d)).concat([...estado.dados.keys()].filter((d) => !R.DDDS.includes(d)));
  $$('[data-ddd-switch]').forEach((sw) => sw.replaceChildren(...ddds.map((d) => h('button', { type: 'button', role: 'tab', dataset: { ddd: d }, text: `DDD ${d}`, onclick: () => { window.location.hash = `#/${d}/${estado.view}`; } }))));
  const menu = $('#menu');
  menu.replaceChildren(...VIEWS.flatMap((v, i) => [i === 4 ? h('div', { class: 'menu__sep' }) : null,
    h('a', { href: `#/${estado.ddd}/${v.id}`, dataset: { view: v.id }, onclick: (e) => { e.preventDefault(); navegar(v.id); } }, icone(v.icone), v.rotulo)].filter(Boolean)));
  $('#abas-mobile').replaceChildren(...VIEWS_ABAS.map((id) => VIEWS.find((v) => v.id === id)).map((v) => h('button', { type: 'button', dataset: { view: v.id }, onclick: () => navegar(v.id) }, icone(v.icone), v.curto)),
    h('button', { type: 'button', dataset: { view: 'mais' }, onclick: () => { $('#folha-mais').hidden = false; $('#fundo-mais').hidden = false; } }, icone('mais'), 'Mais'));
  const nome = estado.usuario ? estado.usuario.split('@')[0].split(/[._-]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : 'Usuário';
  const iniciais = nome.split(' ').map((p) => p[0]).slice(0, 2).join('');
  $('#usuario-nome').textContent = nome; $('#usuario-email').textContent = estado.usuario || ''; $('#avatar').textContent = iniciais;
  $('#folha-mais').replaceChildren(
    h('div', { class: 'usuario' }, h('span', { class: 'avatar', text: iniciais }), h('div', null, h('strong', { text: nome }), h('small', { text: estado.usuario || '' }))),
    ...VIEWS.filter((v) => !VIEWS_ABAS.includes(v.id)).map((v) => h('button', { type: 'button', dataset: { view: v.id }, onclick: () => navegar(v.id) }, icone(v.icone), v.rotulo)),
    h('hr'),
    h('button', { type: 'button', onclick: () => { fecharFolhas(); window.print(); } }, icone('pdf'), 'Imprimir / salvar PDF'),
    h('button', { type: 'button', onclick: sair }, icone('sair'), 'Sair'));
}

function ligarEventos() {
  if (estado.ligado) return;
  estado.ligado = true;
  $$('[data-icone]').forEach((s) => s.replaceWith(icone(s.dataset.icone)));
  $$('[data-acao="sair"]').forEach((b) => { b.append(icone('sair')); b.addEventListener('click', sair); });
  $$('[data-acao="pdf"]').forEach((b) => b.addEventListener('click', () => window.print()));
  $('#btn-fechar-filtros').append(icone('fechar'));
  $('#f-mes').addEventListener('change', (e) => { estado.mes = e.target.value; estado.comp = { a: null, b: null }; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-area').addEventListener('change', (e) => { estado.area = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-parceira').addEventListener('change', (e) => { estado.parceira = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-codigo').addEventListener('change', (e) => { estado.codigo = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-base').addEventListener('change', (e) => {
    const v = Math.round(Number(e.target.value)); const k = `${estado.ddd}-${estado.mes}`;
    if (v > 0) estado.base[k] = v; else delete estado.base[k];
    salvarBaseLocal(); renderTudo();
  });
  $('#btn-limpar').addEventListener('click', () => { estado.area = ''; estado.parceira = ''; estado.codigo = ''; estado.tabela = { busca: '', motivo: '', eixo: '', flag: '', pagina: 0 }; renderTudo(); });
  $('#btn-filtros').addEventListener('click', abrirFiltros);
  $('#btn-fechar-filtros').addEventListener('click', fecharFolhas);
  $('#btn-aplicar').addEventListener('click', fecharFolhas);
  $('#fundo-filtros').addEventListener('click', fecharFolhas);
  $('#fundo-mais').addEventListener('click', fecharFolhas);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolhas(); });
  window.addEventListener('hashchange', aplicarRota);
  window.addEventListener('scroll', () => $('.cabecalho').classList.toggle('rolou', window.scrollY > 4), { passive: true });
  MQ_ESTREITO.addEventListener('change', () => RENDER.causas($('.view[data-view="causas"]')));
}

/* ------------------------------------------------------------------ inicialização */
async function abrir(chave) {
  const lista = [...estado.manifesto.meses];
  const dados = await Promise.all(lista.map(async (m) => {
    const resp = await fetch(`data/${m.arquivo}`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('REDE');
    return decifrarMes(chave, m.id || m.mes, await resp.arrayBuffer());
  }));
  estado.dados = new Map();
  for (const d of dados) {
    const ddd = String(d.ddd || '18');
    if (!estado.dados.has(ddd)) estado.dados.set(ddd, { ordem: [], meses: new Map() });
    const g = estado.dados.get(ddd);
    g.meses.set(d.mes, prepararMes({ ...d, ddd }));
  }
  for (const g of estado.dados.values()) g.ordem = [...g.meses.keys()].sort();
  calcularCodigos();
  carregarBaseLocal();
  const m = window.location.hash.match(/^#\/(\d{2})\//);
  trocarDDD(m && estado.dados.has(m[1]) ? m[1] : (R.DDDS.find((d) => estado.dados.has(d)) || [...estado.dados.keys()][0]));
  $('#login').hidden = true;
  $('#carregando').hidden = true;
  $('#app').hidden = false;
  montarNavegacao();
  ligarEventos();
  if (!/^#\/\d{2}\/\w+/.test(window.location.hash)) window.history.replaceState(null, '', `#/${estado.ddd}/geral`);
  aplicarRota();
}

function mostrarLogin(msg = '') {
  $('#carregando').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-msg').textContent = msg;
  $('#usuario').focus();
}

function ligarLogin() {
  const btn = $('#btn-entrar'); const msg = $('#login-msg');
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#usuario').value.trim();
    const senha = $('#senha').value;
    const pedeLogin = estado.manifesto.kdf.credencial === 'login+senha';
    if ((pedeLogin && !login) || !senha) { msg.className = 'login__msg'; msg.textContent = pedeLogin ? 'Preencha login e senha.' : 'Digite a senha.'; return; }
    btn.disabled = true; btn.textContent = 'Abrindo…';
    msg.className = 'login__msg ok'; msg.textContent = 'Descriptografando os dados no seu navegador…';
    try {
      const chave = await derivarChave(login, senha, estado.manifesto.kdf);
      estado.usuario = login.toLowerCase();
      await abrir(chave);
      const lembrar = $('#lembrar').checked;
      await guardarChave(chave, lembrar);
      try { (lembrar ? localStorage : sessionStorage).setItem('vt-dash-usuario', estado.usuario); } catch { /* ok */ }
      $('#senha').value = '';
    } catch (err) {
      msg.className = 'login__msg';
      msg.textContent = err.message === 'SENHA' ? 'Login ou senha incorretos. Confira e tente de novo.' : 'Não foi possível abrir os dados. Verifique a conexão e tente novamente.';
      if (err.message !== 'SENHA') console.error(err);
      $('#senha').select();
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });
}

async function iniciar() {
  ligarTooltip();
  ligarLogin();
  try {
    const resp = await fetch('data/meses.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(String(resp.status));
    estado.manifesto = await resp.json();
  } catch (e) {
    console.error(e);
    mostrarLogin('Não foi possível carregar o índice de dados publicados.');
    $('#btn-entrar').disabled = true;
    return;
  }
  if (!window.crypto?.subtle || typeof DecompressionStream === 'undefined') {
    mostrarLogin('Navegador desatualizado: use Chrome, Edge, Firefox ou Safari recentes.');
    $('#btn-entrar').disabled = true;
    return;
  }
  const chave = await chaveGuardada();
  if (chave) {
    try { estado.usuario = sessionStorage.getItem('vt-dash-usuario') || localStorage.getItem('vt-dash-usuario') || ''; } catch { /* ok */ }
    try { await abrir(chave); return; } catch (e) { if (e.message !== 'SENHA') console.error(e); esquecerChave(); }
  }
  mostrarLogin();
}

iniciar();
