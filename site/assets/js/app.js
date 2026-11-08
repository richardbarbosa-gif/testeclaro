/* =============================================================================
 * Ofensores de VT · DDD 18 — aplicação
 * Sem dependências. Todo texto vindo dos dados entra via textContent (nunca innerHTML).
 * ========================================================================== */
import * as R from './regras.js';
import { derivarChave, decifrarMes, guardarChave, chaveGuardada, esquecerChave } from './cripto.js';

/* ------------------------------------------------------------------ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const norm = (t) => (t == null ? '' : String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim());

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

const NF = new Intl.NumberFormat('pt-BR');
const fInt = (n) => NF.format(n);
const fDec = (x, d) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fPct = (x, d = 1) => `${fDec(x * 100, d)}%`;
const sinal = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±');
const fSinal = (n) => `${sinal(n)}${fInt(Math.abs(n))}`;
const fPPdif = (x, d = 1) => `${sinal(x)}${fDec(Math.abs(x), d)} p.p.`;
const plural = (n, um, varios) => `${fInt(n)} ${n === 1 ? um : varios}`;
const vts = (n) => `${fInt(n)} ${n === 1 ? 'VT' : 'VTs'}`;
const fPctMin = (x) => (x > 0 && x < 0.01 ? '<1%' : fPct(x, 0));
const fData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
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
/** Mesmo que ordenar, mas "sem_info" sempre por último. */
const ordenarMotivos = (m) => ordenar(m).sort((a, b) => (a[0] === 'sem_info') - (b[0] === 'sem_info'));

/* ------------------------------------------------------------------ estado */
const estado = {
  manifesto: null,
  meses: new Map(), // id -> { meta, regs }
  ordem: [], // ids em ordem cronológica
  mes: null,
  area: '',
  parceira: '',
  codigo: '',
  base: {}, // id do mês -> base digitada no navegador
  rankTodos: false,
  reinc: 'mes',
  comp: { a: null, b: null },
  tabela: { busca: '', motivo: '', flag: '', pagina: 0 },
  ligado: false,
};

const MOTIVO = new Map([...R.MOTIVOS.map((m) => [m.id, m]), ['sem_info', R.MOTIVO_SEM_INFO]]);
const FAMILIA = new Map(R.FAMILIAS.map((f) => [f.id, f]));
const GRUPO = new Map(R.GRUPOS.map((g) => [g.id, g]));
let familiaCodigo = new Map();

const descCodigo = (c) => R.CODIGOS[c] || `Código ${c}`;
const corFamilia = (f) => FAMILIA.get(f)?.cor || 'var(--sem-info)';
const corCodigo = (c) => corFamilia(familiaCodigo.get(c));
const rotMotivo = (id) => MOTIVO.get(id)?.rotulo || id;
const chipCodigo = (c, extra = '') => h('span', { class: 'cod', style: { '--cor': corCodigo(c) }, title: descCodigo(c) }, `${c}${extra}`);

/* ------------------------------------------------------------------ classificação */
function classificar(txt) {
  const t = norm(txt);
  if (!t) return null;
  return R.MOTIVOS.find((m) => m.re.test(t)) || null;
}

function prepararMes(dados) {
  const regs = dados.registros.map((r) => {
    const porObs = classificar(r.obs);
    const porSub = porObs ? null : classificar(r.subfalha);
    const m = porObs || porSub || R.MOTIVO_SEM_INFO;
    const t = norm(r.obs);
    return {
      ...r,
      mes: dados.mes,
      area: R.nomeArea(r.regiao),
      familia: R.familiaDaVisita(r, norm),
      motivo: m.id,
      grupo: m.grupo,
      fonteMotivo: porObs ? 'obs' : porSub ? 'subfalha' : 'nenhuma',
      flags: Object.entries(R.FLAGS).filter(([, f]) => f.re.test(t)).map(([k]) => k),
      napId: R.napCanonica(r.nap),
      chaveEnd: r.endereco ? `${r.regiao}|${norm(r.endereco)}` : null,
      quando: r.baixa || r.agenda || '',
    };
  });
  return { meta: dados, regs };
}

/** Cor de cada código = família predominante das suas visitas (em todos os meses). */
function calcularFamiliaCodigo() {
  const cont = new Map();
  for (const { regs } of estado.meses.values()) {
    for (const r of regs) {
      const m = cont.get(r.bx) || new Map();
      m.set(r.familia, (m.get(r.familia) || 0) + 1);
      cont.set(r.bx, m);
    }
  }
  familiaCodigo = new Map([...cont].map(([c, m]) => [c, ordenar(m)[0][0]]));
}

/* ------------------------------------------------------------------ filtros */
const regsMes = (mes = estado.mes) => estado.meses.get(mes)?.regs || [];
const todosRegs = () => estado.ordem.flatMap((m) => regsMes(m));
const metaMes = (mes = estado.mes) => estado.meses.get(mes)?.meta;
const mesAnterior = (mes) => { const i = estado.ordem.indexOf(mes); return i > 0 ? estado.ordem[i - 1] : null; };

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
  const local = estado.base[mes];
  if (local > 0) return local;
  const v = meta.base_assinantes?.total;
  return v > 0 ? v : null;
}

function escopoTexto() {
  const p = [];
  p.push(estado.area || 'todas as áreas');
  if (estado.parceira) p.push(`parceira ${estado.parceira}`);
  if (estado.codigo) p.push(`código ${estado.codigo}`);
  return p.join(' · ');
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
  document.addEventListener('pointerover', (e) => {
    const alvo = e.target.closest?.('[data-tip]');
    if (alvo) mostrarTip(alvo, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', (e) => { if (!tip.hidden) posicionarTip(e.clientX, e.clientY); });
  document.addEventListener('pointerout', (e) => { if (e.target.closest?.('[data-tip]')) tip.hidden = true; });
  document.addEventListener('focusin', (e) => {
    const alvo = e.target.closest?.('[data-tip]');
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    mostrarTip(alvo, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
}

/* ------------------------------------------------------------------ peças de UI */
function barra(frac, cor, extra = {}) {
  return h('span', { class: 'trilho' },
    h('span', { class: 'barra-h', style: { width: `${Math.max(0, Math.min(1, frac)) * 100}%`, '--cor': cor }, ...extra }));
}

/** Delta para stat tile. tipo 'abs' (VTs) ou 'pp' (já em pontos percentuais). */
function delta(atual, anterior, { tipo = 'abs', subirRuim = true, mesAnt }) {
  if (anterior == null || atual == null) return null;
  const d = atual - anterior;
  const eps = tipo === 'pp' ? 0.05 : 0;
  const dir = Math.abs(d) <= eps ? 'neutro' : (d > 0) === subirRuim ? 'ruim' : 'bom';
  const seta = Math.abs(d) <= eps ? '■' : d > 0 ? '▲' : '▼';
  const txt = tipo === 'pp' ? fPPdif(d) : fSinal(d);
  return h('span', { class: `delta delta--${dir}`, title: `vs ${mesAnt}` }, `${seta} ${txt}`, h('span', { class: 'kpi__sub', text: ` vs ${mesAnt}` }));
}

function irPara(id) { document.getElementById(id)?.scrollIntoView({ block: 'start' }); }

/* ------------------------------------------------------------------ RESUMO */
function leituraExecutiva(regs) {
  const total = regs.length;
  const itens = [];
  if (!total) return itens;
  const cods = ordenar(contar(regs, 'bx'));
  if (!estado.codigo) {
    const [c1, n1] = cods[0];
    itens.push(`O código **${c1}** (${descCodigo(c1)}) liderou com **${fInt(n1)} VTs** — ${fPct(n1 / total)} das visitas.`);
    if (cods.length >= 3) {
      const t3 = cods.slice(0, 3);
      const s = t3.reduce((a, [, n]) => a + n, 0);
      itens.push(`Os 3 maiores ofensores (**${t3.map(([c]) => c).join(', ')}**) somam **${fPct(s / total)}** das visitas.`);
    }
  }
  const mots = ordenar(contar(regs.filter((r) => r.motivo !== 'sem_info'), 'motivo'));
  if (mots.length) {
    const [m1, nm] = mots[0];
    const fams = ordenar(contar(regs.filter((r) => r.motivo === m1), 'familia'))
      .map(([f, n]) => `${FAMILIA.get(f)?.curto || f} ${n}`);
    itens.push(`**${rotMotivo(m1)}** foi a principal causa raiz: **${fInt(nm)} VTs**${fams.length > 1 ? ` (${fams.join(' · ')})` : ''}.`);
  }
  const ext = regs.filter((r) => r.grupo === 'externo').length;
  if (ext) itens.push(`Agentes externos (poste, árvore, carga alta, vandalismo, animais…) explicam **${fPct(ext / total)}** das VTs (${fInt(ext)}).`);
  if (!estado.area) {
    const [a1, na] = ordenar(contar(regs, 'area'))[0];
    const [ca, nca] = ordenar(contar(regs.filter((r) => r.area === a1), 'bx'))[0];
    itens.push(`**${a1}** concentrou **${fInt(na)} VTs** (${fPct(na / total)}); principal código local: **${ca}** (${fInt(nca)}).`);
  }
  const agua = regs.filter((r) => r.motivo === 'agua').length;
  if (agua) itens.push(`**${fInt(agua)} conectores** foram encontrados com **água/umidade**.`);
  const rein = regs.filter((r) => r.log > 0).length;
  if (rein) itens.push(`**${fPct(rein / total)}** das VTs (${fInt(rein)}) já tinham visita anterior registrada (LOG ≥ 1).`);
  const err = regs.filter((r) => r.flags.includes('baixa_errada')).length;
  if (err) itens.push(`**${fInt(err)} observações** indicam código de baixa errado — isso distorce o ranking de ofensores.`);
  return itens;
}

function renderResumo() {
  const regs = filtrar(regsMes());
  const total = regs.length;
  const meta = metaMes();
  const ant = mesAnterior(estado.mes);
  const regsAnt = ant ? filtrar(regsMes(ant)) : null;
  const mAnt = ant ? mesCurto(ant) : null;
  const base = baseEfetiva();
  const baseAnt = ant ? baseEfetiva(ant) : null;
  const cont = $('#resumo');

  const contratos = new Set(regs.map((r) => r.contrato)).size;
  const hero = h('div', { class: 'hero' },
    h('div', null,
      h('p', { class: 'hero__rotulo', text: 'Visitas técnicas executadas' }),
      h('p', { class: 'hero__valor', text: fInt(total) }),
      h('p', { class: 'hero__sub', text: `${meta.rotulo} · ${escopoTexto()}` })),
    h('div', { class: 'hero__meta' },
      h('span', { class: 'pilula', text: plural(contratos, 'contrato', 'contratos') }),
      h('span', { class: 'pilula', text: plural(new Set(regs.map((r) => r.area)).size, 'área', 'áreas') }),
      h('span', { class: 'pilula', text: plural(new Set(regs.map((r) => r.bx)).size, 'código', 'códigos') }),
      regsAnt ? h('span', { class: 'pilula', text: `${fSinal(total - regsAnt.length)} vs ${mAnt}` }) : null));

  const kpi = (rotulo, valor, sub, dlt, extraClasse = '') => h('div', { class: `kpi ${extraClasse}` },
    h('p', { class: 'kpi__rotulo', text: rotulo }),
    h('p', { class: 'kpi__valor' }, valor, dlt),
    sub ? h('p', { class: 'kpi__sub' }, sub) : null);

  const cods = ordenar(contar(regs, 'bx'));
  const [c1, n1] = cods[0] || ['—', 0];
  const pct = (arr, fn) => (arr && arr.length ? arr.filter(fn).length / arr.length : null);
  const rein = pct(regs, (r) => r.log > 0);
  const reinAnt = pct(regsAnt, (r) => r.log > 0);
  const impr = pct(regs, (r) => norm(r.fato) === 'improdutiva');
  const imprAnt = pct(regsAnt, (r) => norm(r.fato) === 'improdutiva');

  const taxa = base ? total / base : null;
  const taxaAnt = baseAnt && regsAnt ? regsAnt.length / baseAnt : null;
  const kTaxa = base
    ? kpi('Taxa de VT sobre a base', fPct(taxa, 2), `${fInt(total)} VTs ÷ ${fInt(base)} assinantes`,
      taxaAnt != null ? delta(taxa * 100, taxaAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null)
    : kpi('Taxa de VT sobre a base', '—',
      h('span', null, estado.area ? 'Base por área ainda não informada. ' : 'Informe a base de assinantes para ver a taxa e os pontos percentuais. ',
        estado.area ? null : h('button', { class: 'link-botao', type: 'button', text: 'Informar agora', onclick: () => { $('#f-base').focus(); } })),
      null, 'kpi--pendente');

  const kpis = h('div', { class: 'kpis' },
    kpi('Maior ofensor', h('span', null, String(c1), h('small', { text: ` ${descCodigo(c1)}` })),
      total ? `${fInt(n1)} VTs · ${fPct(n1 / total)} do total` : null,
      null),
    kTaxa,
    kpi('Reincidência', rein != null ? fPct(rein) : '—', rein != null ? `${fInt(regs.filter((r) => r.log > 0).length)} VTs com visita anterior (LOG ≥ 1)` : null,
      rein != null && reinAnt != null ? delta(rein * 100, reinAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null),
    kpi('Improdutivas', impr != null ? fPct(impr) : '—', impr != null ? `${fInt(regs.filter((r) => norm(r.fato) === 'improdutiva').length)} VTs sem reparo executado` : null,
      impr != null && imprAnt != null ? delta(impr * 100, imprAnt * 100, { tipo: 'pp', mesAnt: mAnt }) : null));

  const itens = leituraExecutiva(regs);
  const leitura = h('div', { class: 'cartao leitura' },
    h('p', { class: 'cartao__titulo', text: 'Leitura executiva' }),
    h('p', { class: 'cartao__sub', text: 'Gerada automaticamente a partir dos dados do filtro atual.' }),
    itens.length ? h('ol', null, itens.map((t) => h('li', null, rico(t)))) : h('p', { class: 'vazio', text: 'Sem visitas no filtro atual.' }));

  cont.replaceChildren(h('div', { class: 'resumo' }, hero, kpis, leitura));
}

/* ------------------------------------------------------------------ RANKING DE CÓDIGOS */
function alternarCodigo(c) {
  estado.codigo = String(estado.codigo) === String(c) ? '' : String(c);
  estado.tabela.pagina = 0;
  renderTudo();
}

function renderCodigos() {
  const regs = filtrar(regsMes(), { codigo: false });
  const total = regs.length;
  const cont = $('#codigos');
  if (!total) { cont.replaceChildren(h('p', { class: 'vazio', text: 'Sem visitas no filtro atual.' })); return; }
  const cods = ordenar(contar(regs, 'bx'));
  const max = cods[0][1];
  const base = baseEfetiva();
  const LIM = 12;
  const mostrar = estado.rankTodos ? cods : cods.slice(0, LIM);
  let acum = 0;
  const acumulados = new Map(cods.map(([c, n]) => { acum += n; return [c, acum / total]; }));

  const cab = h('div', { class: 'linha-rank linha-rank--cab', 'aria-hidden': 'true' },
    h('span', { class: 'pos', text: '#' }), h('span', { text: 'Código' }), h('span', { text: 'Descrição' }), h('span'),
    h('span', { class: 'val', text: 'VTs' }), h('span', { class: 'pct', text: '% VTs' }), h('span', { class: 'acum', text: 'Acum.' }),
    base ? h('span', { class: 'acum pp', text: 'Taxa' }) : null);

  const linhas = mostrar.map(([c, n], i) => h('button', {
    type: 'button',
    class: `linha-rank${String(c) === estado.codigo ? ' selecionada' : estado.codigo ? ' atenuada' : ''}`,
    'aria-pressed': String(String(c) === estado.codigo),
    'aria-label': `Código ${c}, ${descCodigo(c)}: ${n} visitas, ${fPct(n / total)}. Filtrar por este código.`,
    onclick: () => alternarCodigo(c),
  },
  h('span', { class: 'pos', text: String(i + 1) }),
  chipCodigo(c),
  h('span', { class: 'desc', text: descCodigo(c) }),
  barra(n / max, corCodigo(c)),
  h('span', { class: 'val', text: fInt(n) }),
  h('span', { class: 'pct', text: fPct(n / total) }),
  h('span', { class: 'acum', text: fPct(acumulados.get(c), 0) }),
  base ? h('span', { class: 'acum pp', text: `${fDec((n / base) * 100, 2)} p.p.`, title: 'Contribuição na taxa de VT (VTs do código ÷ base)' }) : null));

  const somaMostrados = mostrar.reduce((a, [, n]) => a + n, 0);
  const rodape = h('div', { class: 'ranking__rodape' },
    h('p', { class: 'dica', text: estado.rankTodos ? `${cods.length} códigos no filtro atual.` : `Mostrando ${mostrar.length} de ${cods.length} códigos — juntos somam ${fPct(somaMostrados / total)} das VTs.` }),
    cods.length > LIM ? h('button', { class: 'botao botao--sec', type: 'button', text: estado.rankTodos ? `Mostrar só os ${LIM} maiores` : `Mostrar todos os ${cods.length}`, onclick: () => { estado.rankTodos = !estado.rankTodos; renderCodigos(); } }) : null);

  cont.replaceChildren(h('div', { class: `ranking${base ? ' com-pp' : ''}` }, cab, linhas), rodape);
}

/* ------------------------------------------------------------------ MOTIVOS POR CÓDIGO */
function abrirBase({ motivo = '', flag = '', codigo } = {}) {
  if (codigo != null && String(codigo) !== estado.codigo) estado.codigo = String(codigo);
  estado.tabela = { ...estado.tabela, motivo, flag, pagina: 0 };
  renderTudo();
  irPara('s-base');
}

function linhasMotivo(rc, cor) {
  const n = rc.length;
  const mots = ordenarMotivos(contar(rc, 'motivo'));
  const max = Math.max(...mots.map(([, v]) => v));
  return mots.map(([m, v]) => h('button', {
    type: 'button',
    class: `mot${m === 'sem_info' ? ' mot--sem' : ''}`,
    title: 'Ver estas visitas na base',
    onclick: () => abrirBase({ motivo: m, codigo: rc[0].bx }),
  },
  h('span', { class: 'mot__rot', text: rotMotivo(m), title: rotMotivo(m) }),
  barra(v / max, m === 'sem_info' ? 'var(--sem-info)' : cor),
  h('span', { class: 'val', text: fInt(v) }),
  h('span', { class: 'pct', text: fPct(v / n, 0) })));
}

function cardCodigo(regs, c, totalMes) {
  const rc = regs.filter((r) => r.bx === c);
  const cab = h('div', { class: 'card-cod__cab' },
    h('div', null,
      h('div', { class: 'card-cod__titulo' }, chipCodigo(c), h('h3', { text: descCodigo(c) })),
      h('p', { class: 'cartao__sub', text: rc.length ? `${fPct(rc.length / totalMes)} das VTs do mês` : 'Sem ocorrências no filtro atual' })),
    h('div', { class: 'card-cod__total' }, h('strong', { text: fInt(rc.length) }), h('span', { text: 'VTs' })));
  if (!rc.length) return h('article', { class: 'cartao card-cod' }, cab);
  const [a1, na] = ordenar(contar(rc, 'area'))[0];
  const rein = rc.filter((r) => r.log > 0).length;
  return h('article', { class: 'cartao card-cod' }, cab,
    h('div', null, linhasMotivo(rc, corCodigo(c))),
    h('div', { class: 'card-cod__pe' },
      h('span', null, 'Área mais impactada: ', h('strong', { text: a1 }), ` (${fInt(na)} · ${fPct(na / rc.length, 0)})`),
      h('span', null, 'Com visita anterior: ', h('strong', { text: fPct(rein / rc.length, 0) })),
      String(c) !== estado.codigo ? h('button', { class: 'link-botao', type: 'button', text: 'Detalhar código →', onclick: () => { alternarCodigo(c); irPara('s-motivos'); } }) : null));
}

function detalheCodigo(regs, c) {
  const rc = regs.filter((r) => r.bx === c);
  if (!rc.length) return h('div', { class: 'cartao' }, h('p', { class: 'vazio', text: `Sem visitas do código ${c} no filtro atual.` }));
  const areas = ordenar(contar(rc, 'area'));
  const maxA = areas[0][1];
  const subf = ordenar(contar(rc, (r) => r.subfalha || '(vazia)')).slice(0, 8);
  const fontes = contar(rc, 'fonteMotivo');
  const flagsErr = rc.filter((r) => r.flags.includes('baixa_errada')).length;
  return h('article', { class: 'cartao' },
    h('div', { class: 'card-cod__cab' },
      h('div', null,
        h('div', { class: 'card-cod__titulo' }, chipCodigo(c), h('h3', { text: `${descCodigo(c)} — detalhamento` })),
        h('p', { class: 'cartao__sub', text: `${fInt(rc.length)} VTs · ${fPct(rc.length / regs.length)} do filtro atual · ${FAMILIA.get(familiaCodigo.get(c))?.rotulo || ''}` })),
      h('button', { class: 'botao botao--sec', type: 'button', text: 'Remover filtro de código', onclick: () => alternarCodigo(c) })),
    h('div', { class: 'detalhe-cod' },
      h('div', null, h('p', { class: 'subtitulo-bloco', text: 'Motivo raiz' }), linhasMotivo(rc, corCodigo(c)),
        h('p', { class: 'dica' }, `Origem do motivo: ${fInt(fontes.get('obs') || 0)} pela observação · ${fInt(fontes.get('subfalha') || 0)} pela SUBFALHA · ${fInt(fontes.get('nenhuma') || 0)} sem informação.`,
          flagsErr ? ` ${fInt(flagsErr)} com indício de código errado.` : '')),
      h('div', { class: 'grade-detalhe' },
        h('p', { class: 'subtitulo-bloco', text: 'Onde ocorreu' }),
        h('div', null, areas.map(([a, n]) => h('div', { class: 'mot', role: 'presentation' },
          h('span', { class: 'mot__rot', text: a }), barra(n / maxA, 'var(--claro)'),
          h('span', { class: 'val', text: fInt(n) }), h('span', { class: 'pct', text: fPct(n / rc.length, 0) })))),
        h('p', { class: 'subtitulo-bloco', text: 'SUBFALHA registrada no sistema', style: { 'margin-top': '16px' } }),
        h('table', { class: 'mini-tabela' }, h('tbody', null, subf.map(([s, n]) => h('tr', null, h('td', { text: s }), h('td', { class: 'n', text: fInt(n) }))))))));
}

function renderMotivos() {
  const regs = filtrar(regsMes(), { codigo: false });
  const cont = $('#motivos');
  const cods = ordenar(contar(regs, 'bx'));
  const sel = h('label', { class: 'seletor-inline' }, 'Detalhar qualquer código:',
    h('select', { onchange: (e) => { estado.codigo = e.target.value; renderTudo(); } },
      h('option', { value: '', text: '— escolher —' }),
      cods.map(([c, n]) => { const o = h('option', { value: String(c), text: `${c} · ${descCodigo(c)} (${n})` }); if (String(c) === estado.codigo) o.selected = true; return o; })));
  const destaques = R.CODIGOS_DESTAQUE.filter((c) => String(c) !== estado.codigo);
  cont.replaceChildren(
    h('div', { style: { display: 'grid', gap: '16px' } },
      sel,
      estado.codigo ? detalheCodigo(regs, +estado.codigo) : null,
      estado.codigo && destaques.length ? h('p', { class: 'subtitulo-bloco', text: 'Códigos em destaque' }) : null,
      h('div', { class: 'motivos-grade' }, destaques.map((c) => cardCodigo(regs, c, regs.length)))));
}

/* ------------------------------------------------------------------ CAUSA RAIZ */
function legendaFamilias() {
  return R.FAMILIAS.map((f) => h('span', null, h('i', { class: 'amostra', style: { '--cor': f.cor } }), f.rotulo));
}

function renderCausas() {
  const regs = filtrar(regsMes());
  const total = regs.length;
  const cont = $('#causas');
  if (!total) { cont.replaceChildren(h('div', { class: 'cartao' }, h('p', { class: 'vazio', text: 'Sem visitas no filtro atual.' }))); return; }
  const porGrupo = contar(regs, 'grupo');
  const grupos = R.GRUPOS.filter((g) => porGrupo.get(g.id))
    .sort((a, b) => (a.id === 'sem_info') - (b.id === 'sem_info') || porGrupo.get(b.id) - porGrupo.get(a.id));
  const porMotivo = contar(regs, 'motivo');
  const maxMot = Math.max(...porMotivo.values());

  const tiles = h('div', { class: 'grupos-resumo' }, grupos.map((g) => h('div', { class: 'grupo-tile', title: g.desc },
    h('strong', { text: fPctMin(porGrupo.get(g.id) / total) }),
    h('span', { text: g.rotulo }),
    h('small', { text: vts(porGrupo.get(g.id)) }))));

  const linhas = [];
  for (const g of grupos) {
    linhas.push(h('div', { class: 'causa-grupo' }, h('span', { text: g.rotulo }), h('span', { text: `${vts(porGrupo.get(g.id))} · ${fPct(porGrupo.get(g.id) / total)}` })));
    const mots = R.MOTIVOS.concat(R.MOTIVO_SEM_INFO).filter((m) => m.grupo === g.id && porMotivo.get(m.id))
      .sort((a, b) => porMotivo.get(b.id) - porMotivo.get(a.id));
    for (const m of mots) {
      const n = porMotivo.get(m.id);
      const fams = ordenar(contar(regs.filter((r) => r.motivo === m.id), 'familia'));
      const pilha = h('span', { class: 'empilhada', style: { width: `${(n / maxMot) * 100}%` } },
        fams.map(([f, v]) => h('span', {
          tabindex: '0',
          style: { '--cor': corFamilia(f), 'flex-grow': String(v), 'flex-basis': '0' },
          dataset: { tip: `${fInt(v)} VTs · ${FAMILIA.get(f)?.rotulo || f}`, tipSub: `${m.rotulo} — ${fPct(v / n, 0)} desta causa` },
          'aria-label': `${m.rotulo}, ${FAMILIA.get(f)?.rotulo}: ${v} visitas`,
        })));
      linhas.push(h('div', { class: 'causa' },
        h('button', { class: 'link-botao causa__rot', type: 'button', style: { 'text-align': 'left', color: 'var(--tinta)', 'text-decoration': 'none', 'font-weight': '500', 'font-size': '14px' }, text: m.rotulo, title: 'Ver estas visitas na base', onclick: () => abrirBase({ motivo: m.id }) }),
        h('span', { class: 'trilho' }, pilha),
        h('span', { class: 'val', text: fInt(n) }),
        h('span', { class: 'pct', text: fPct(n / total) })));
    }
  }
  cont.replaceChildren(h('div', { style: { display: 'grid', gap: '14px' } },
    tiles,
    h('div', { class: 'cartao' },
      h('div', { class: 'secao__cab', style: { 'margin-bottom': '12px' } },
        h('p', { class: 'dica', text: 'Passe o mouse nos segmentos para ver a quantidade por tipo de intervenção. Clique na causa para ver as visitas.' }),
        h('div', { class: 'legenda' }, legendaFamilias())),
      h('div', { class: 'causas' }, linhas))));
}

/* ------------------------------------------------------------------ ÁREAS */
function renderAreas() {
  const regs = filtrar(regsMes(), { area: false });
  const cont = $('#areas');
  if (!regs.length) { cont.replaceChildren(h('div', { class: 'cartao' }, h('p', { class: 'vazio', text: 'Sem visitas no filtro atual.' }))); return; }
  const total = regs.length;
  const areas = ordenar(contar(regs, 'area'));
  const topCods = ordenar(contar(regs, 'bx')).slice(0, estado.codigo ? 1 : 8).map(([c]) => c);
  const mat = new Map(areas.map(([a]) => [a, contar(regs.filter((r) => r.area === a), 'bx')]));
  const colMax = new Map(topCods.map((c) => [c, Math.max(...areas.map(([a]) => mat.get(a).get(c) || 0))]));
  const totCod = contar(regs, 'bx');
  const meta = metaMes();
  const regiaoDe = new Map(regs.map((r) => [r.area, r.regiao]));

  const thead = h('thead', null, h('tr', null,
    h('th', { class: 'area-cab', text: 'Área' }),
    topCods.map((c) => h('th', null, h('button', { type: 'button', title: `${c} · ${descCodigo(c)} — clique para filtrar`, onclick: () => alternarCodigo(c) }, chipCodigo(c), h('small', { text: descCodigo(c) })))),
    estado.codigo ? null : h('th', { text: 'Outros' }),
    h('th', { text: 'Total', style: { 'text-align': 'right' } })));

  const tbody = h('tbody', null, areas.map(([a, nA]) => {
    const linha = mat.get(a);
    const somaTop = topCods.reduce((s, c) => s + (linha.get(c) || 0), 0);
    const baseA = meta.base_assinantes?.por_regiao?.[regiaoDe.get(a)];
    return h('tr', { class: estado.area === a ? 'selecionada' : estado.area ? 'atenuada' : '' },
      h('td', { class: 'area' }, h('button', { type: 'button', text: a, title: estado.area === a ? 'Remover filtro de área' : `Filtrar por ${a}`, onclick: () => { estado.area = estado.area === a ? '' : a; renderTudo(); } })),
      topCods.map((c) => {
        const v = linha.get(c) || 0;
        const mx = colMax.get(c);
        const passo = v ? Math.max(1, Math.ceil((v / mx) * 5)) : 0;
        return h('td', {
          class: `${v ? '' : 'zero'}${v && v === mx ? ' max' : ''}`,
          dataset: v ? { n: String(passo), tip: `${fInt(v)} VTs · ${c} em ${a}`, tipSub: `${fPct(v / nA, 0)} das VTs da área · ${fPct(v / totCod.get(c), 0)} do código` } : null,
          tabindex: v ? '0' : null,
          text: v ? fInt(v) : '·',
        });
      }),
      estado.codigo ? null : h('td', { text: fInt(nA - somaTop) }),
      h('td', { class: 'tot' }, fInt(nA), h('small', { text: baseA ? `${fPct(nA / baseA, 2)} da base` : fPct(nA / total) })));
  }));

  const destaques = topCods.slice(0, 6).map((c) => {
    const rc = regs.filter((r) => r.bx === c);
    const [a, n] = ordenar(contar(rc, 'area'))[0];
    return h('div', { class: 'destaque-area' }, chipCodigo(c),
      h('div', null, h('strong', { text: a }), h('span', { text: `${fInt(n)} de ${vts(rc.length)} · ${fPct(n / rc.length, 0)}` })));
  });

  cont.replaceChildren(h('div', { style: { display: 'grid', gap: '14px' } },
    h('div', { class: 'cartao' },
      h('div', { class: 'secao__cab', style: { 'margin-bottom': '10px' } },
        h('p', { class: 'dica', text: estado.area ? 'O filtro de área destaca a linha escolhida; a tabela continua mostrando todas as áreas para comparação.' : `${areas.length} áreas · intensidade relativa dentro de cada código (coluna).` }),
        h('span', { class: 'escala' }, 'menos', h('i'), h('i'), h('i'), h('i'), h('i'), 'mais')),
      h('div', { class: 'rolagem' }, h('table', { class: 'heat' }, thead, tbody))),
    h('p', { class: 'subtitulo-bloco', text: 'Área mais impactada por código' }),
    h('div', { class: 'destaques-area' }, destaques)));
}

/* ------------------------------------------------------------------ REINCIDÊNCIA + QUALIDADE */
function renderReincidencia() {
  const escopo = $('#reinc-escopo');
  if (estado.ordem.length > 1) {
    escopo.replaceChildren(h('div', { class: 'alternador', role: 'group', 'aria-label': 'Período da reincidência' },
      ['mes', 'todos'].map((v) => h('button', { type: 'button', 'aria-pressed': String(estado.reinc === v), text: v === 'mes' ? 'Mês selecionado' : `Todos os meses (${estado.ordem.length})`, onclick: () => { estado.reinc = v; renderReincidencia(); } }))));
  } else escopo.replaceChildren();

  const regs = filtrar(estado.reinc === 'todos' ? todosRegs() : regsMes());
  const cont = $('#reincidencia');
  if (!regs.length) { cont.replaceChildren(h('div', { class: 'cartao' }, h('p', { class: 'vazio', text: 'Sem visitas no filtro atual.' }))); return; }
  const total = regs.length;

  const porContrato = contar(regs, 'contrato');
  const contratosRep = [...porContrato.values()].filter((n) => n > 1);
  const grupoEnd = new Map();
  for (const r of regs) if (r.chaveEnd) (grupoEnd.get(r.chaveEnd) || grupoEnd.set(r.chaveEnd, []).get(r.chaveEnd)).push(r);
  const ends = [...grupoEnd.values()].filter((v) => v.length > 1)
    .sort((a, b) => b.length - a.length || (b.at(-1).quando > a.at(-1).quando ? 1 : -1));
  const grupoNap = new Map();
  for (const r of regs) if (r.napId) (grupoNap.get(r.napId) || grupoNap.set(r.napId, []).get(r.napId)).push(r);
  const naps = [...grupoNap.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
  const napsGenericas = ordenar(contar(regs.filter((r) => !r.napId), (r) => r.nap || '(vazia)'));
  const nGenerica = napsGenericas.reduce((s, [, n]) => s + n, 0);
  const comLog = regs.filter((r) => r.log > 0).length;

  const kpi = (rot, val, sub) => h('div', { class: 'kpi' }, h('p', { class: 'kpi__rotulo', text: rot }), h('p', { class: 'kpi__valor', text: val }), h('p', { class: 'kpi__sub', text: sub }));
  const kpis = h('div', { class: 'kpis-linha' },
    kpi('VTs com visita anterior', fPct(comLog / total), `${fInt(comLog)} VTs com LOG ≥ 1`),
    kpi('Contratos com 2+ VTs', fInt(contratosRep.length), `${fInt(contratosRep.reduce((s, n) => s + n - 1, 0))} visitas repetidas no período`),
    kpi('Endereços com 2+ VTs', fInt(ends.length), 'mesmo endereço, mesma área'),
    kpi('NAPs com 2+ VTs', fInt(naps.length), `entre ${fInt(grupoNap.size)} NAPs identificadas`));

  const sequencia = (vs) => {
    const ord = [...vs].sort((a, b) => (a.quando > b.quando ? 1 : -1));
    const el = h('span', { class: 'chips' });
    ord.forEach((r, i) => {
      const chip = h('span', { class: 'cod', style: { '--cor': corCodigo(r.bx) }, dataset: { tip: `${r.bx} · ${descCodigo(r.bx)}`, tipSub: `${fData(r.agenda)} · ${rotMotivo(r.motivo)}` }, tabindex: '0' }, String(r.bx));
      el.append(i ? h('span', { class: 'passo' }, h('span', { class: 'seta', text: '→' }), chip) : chip);
    });
    return el;
  };
  const LIM = 12;
  const tabEnd = ends.length ? h('div', { class: 'rolagem' }, h('table', { class: 'tabela' },
    h('thead', null, h('tr', null, h('th', { text: 'Endereço' }), h('th', { text: 'VTs', style: { 'text-align': 'right' } }), h('th', { text: 'Sequência de códigos' }), h('th', { text: 'Última' }))),
    h('tbody', null, ends.slice(0, LIM).map((vs) => {
      const ult = [...vs].sort((a, b) => (a.quando > b.quando ? 1 : -1)).at(-1);
      return h('tr', null,
        h('td', { class: 'end' }, vs[0].endereco, h('small', { text: `${vs[0].area} · contrato ${vs[0].contrato}${new Set(vs.map((r) => r.contrato)).size > 1 ? ' e outros' : ''}` })),
        h('td', { class: 'n', text: fInt(vs.length) }),
        h('td', null, sequencia(vs)),
        h('td', { class: 'ultima' }, h('span', { class: 'nowrap', text: fData(ult.agenda) }), h('small', { text: rotMotivo(ult.motivo) })));
    })))) : h('p', { class: 'vazio', text: 'Nenhum endereço com mais de uma visita no filtro atual.' });

  const tabNap = naps.length ? h('div', { class: 'rolagem' }, h('table', { class: 'tabela' },
    h('thead', null, h('tr', null, h('th', { text: 'NAP' }), h('th', { text: 'VTs', style: { 'text-align': 'right' } }), h('th', { text: 'End.', style: { 'text-align': 'right' } }), h('th', { text: 'Códigos' }))),
    h('tbody', null, naps.slice(0, LIM).map(([nap, vs]) => h('tr', null,
      h('td', { class: 'end' }, nap, h('small', { text: vs[0].area })),
      h('td', { class: 'n', text: fInt(vs.length) }),
      h('td', { class: 'n', text: fInt(new Set(vs.map((r) => r.chaveEnd)).size) }),
      h('td', null, h('span', { class: 'chips' }, ordenar(contar(vs, 'bx')).map(([c, n]) => chipCodigo(c, n > 1 ? ` ×${n}` : ''))))))))) : h('p', { class: 'vazio', text: 'Nenhuma NAP com mais de uma visita no filtro atual.' });

  // qualidade do apontamento
  const nErr = regs.filter((r) => r.flags.includes('baixa_errada')).length;
  const nVal = regs.filter((r) => r.flags.includes('sem_validacao')).length;
  const nSub = regs.filter((r) => r.fonteMotivo === 'subfalha').length;
  const nSem = regs.filter((r) => r.motivo === 'sem_info').length;
  const qual = (rot, n, sub, acao) => h('div', { class: 'qual-linha' },
    acao ? h('button', { type: 'button', onclick: acao }, h('span', { class: 'qual-rot', text: rot }), h('small', { text: sub })) : h('div', null, h('span', { text: rot }), h('small', { text: sub })),
    h('strong', { text: fInt(n) }));
  const qualidade = h('div', { class: 'cartao' },
    h('p', { class: 'cartao__titulo', text: 'Qualidade do apontamento' }),
    h('p', { class: 'cartao__sub', text: 'Sinais encontrados no texto da observação. Clique para ver as visitas.' }),
    h('div', { class: 'qualidade' },
      qual('Indício de código de baixa errado', nErr, '“baixou errado”, “baixa errada”, “código errado”…', nErr ? () => abrirBase({ flag: 'baixa_errada' }) : null),
      qual('VT sem validação / justificativa', nVal, 'técnico não validou ou não justificou', nVal ? () => abrirBase({ flag: 'sem_validacao' }) : null),
      qual('Motivo só pela SUBFALHA', nSub, 'observação não trazia a causa', null),
      qual('Sem informação de motivo', nSem, 'nem observação nem SUBFALHA identificam a causa', nSem ? () => abrirBase({ motivo: 'sem_info' }) : null),
      qual('NAP genérica / não cadastrada', nGenerica, napsGenericas.slice(0, 3).map(([v, n]) => `${v} (${n})`).join(' · ') || '—', null)));

  cont.replaceChildren(h('div', { style: { display: 'grid', gap: '16px' } },
    kpis,
    h('div', { class: 'cartao' }, h('p', { class: 'cartao__titulo', text: 'Endereços com mais visitas' }),
        h('p', { class: 'cartao__sub', text: `${fInt(ends.length)} endereço(s) com 2+ VTs${estado.codigo ? ` do código ${estado.codigo}` : ''}. Passe o mouse no código para ver data e motivo de cada visita.` }), tabEnd),
    h('div', { class: 'grade-2' },
      h('div', { class: 'cartao' }, h('p', { class: 'cartao__titulo', text: 'NAPs com mais visitas' }),
        h('p', { class: 'cartao__sub', text: `NAP genérica (ex.: ${napsGenericas[0]?.[0] || '—'}) desconsiderada: ${vts(nGenerica)} sem NAP real no cadastro. Formatos diferentes da mesma NAP são unificados.` }), tabNap),
      qualidade)));
}

/* ------------------------------------------------------------------ COMPARATIVO */
function listaVariacao(itens, { tipo, maxAbs }) {
  if (!itens.length) return h('p', { class: 'vazio', text: tipo === 'up' ? 'Nada aumentou.' : 'Nada diminuiu.' });
  return h('div', { class: 'var-lista' }, itens.map((it) => h('div', { class: `var-linha${it.chip ? '' : ' sem-chip'}` },
    it.chip || null,
    h('span', { class: 'rot' }, it.rotulo, h('small', { text: `${fInt(it.a)} → ${fInt(it.b)} VTs` })),
    barra(Math.abs(it.d) / maxAbs, it.d > 0 ? 'var(--ruim-marca)' : 'var(--bom-marca)'),
    h('span', { class: 'd' },
      h('span', { class: `delta delta--${it.d > 0 ? 'ruim' : 'bom'}`, text: `${it.d > 0 ? '▲' : '▼'} ${fSinal(it.d)}` }),
      h('small', { class: 'kpi__sub', style: { display: 'block' }, text: fPPdif(it.pp) })))));
}

function variacoes(regsA, regsB, chave, rotular) {
  const ca = contar(regsA, chave); const cb = contar(regsB, chave);
  const ta = regsA.length || 1; const tb = regsB.length || 1;
  return [...new Set([...ca.keys(), ...cb.keys()])].map((k) => {
    const a = ca.get(k) || 0; const b = cb.get(k) || 0;
    return { k, a, b, d: b - a, pp: (b / tb - a / ta) * 100, ...rotular(k) };
  });
}

function renderComparativo() {
  const cont = $('#comparativo');
  const sel = $('#comp-seletor');
  const meses = estado.ordem;
  if (meses.length < 2) {
    sel.replaceChildren();
    cont.replaceChildren(h('div', { class: 'cartao estado-vazio' },
      h('div', { class: 'estado-vazio__ilustra', 'aria-hidden': 'true' },
        h('i', { class: 'up', style: { width: '92%' } }), h('i', { class: 'up', style: { width: '64%' } }), h('i', { style: { width: '40%' } }),
        h('i', { class: 'down', style: { width: '55%' } }), h('i', { class: 'down', style: { width: '30%' } })),
      h('div', null,
        h('h3', { text: 'O comparativo liga sozinho a partir do 2º mês' }),
        h('p', { text: `Hoje há 1 mês publicado (${metaMes(meses[0]).rotulo}). Assim que o próximo mês for publicado, esta seção mostra automaticamente: os códigos que mais aumentaram e mais diminuíram, a variação das causas raiz e das áreas — em quantidade de VTs e em pontos percentuais — e a evolução mês a mês.` }))));
    return;
  }
  let { a, b } = estado.comp;
  if (!b || !meses.includes(b)) b = mesAnterior(estado.mes) ? estado.mes : meses[1];
  if (!a || !meses.includes(a) || a >= b) a = mesAnterior(b);
  estado.comp = { a, b };
  const opcoes = (atual, filtro) => meses.filter(filtro).map((m) => { const o = h('option', { value: m, text: metaMes(m).rotulo }); if (m === atual) o.selected = true; return o; });
  sel.replaceChildren(h('div', { class: 'seletor-inline' },
    'Comparar', h('select', { 'aria-label': 'Mês atual', onchange: (e) => { estado.comp.b = e.target.value; estado.comp.a = null; renderComparativo(); } }, opcoes(b, (m) => m !== meses[0])),
    'com', h('select', { 'aria-label': 'Mês de referência', onchange: (e) => { estado.comp.a = e.target.value; renderComparativo(); } }, opcoes(a, (m) => m < b))));

  const rA = filtrar(regsMes(a), { codigo: false });
  const rB = filtrar(regsMes(b), { codigo: false });
  const cA = estado.codigo ? rA.filter((r) => r.bx === +estado.codigo) : rA;
  const cB = estado.codigo ? rB.filter((r) => r.bx === +estado.codigo) : rB;
  const ma = mesCurto(a); const mb = mesCurto(b);
  const pct = (arr, fn) => (arr.length ? (arr.filter(fn).length / arr.length) * 100 : 0);

  const kpi = (rot, val, dlt, sub) => h('div', { class: 'kpi' }, h('p', { class: 'kpi__rotulo', text: rot }), h('p', { class: 'kpi__valor' }, val, dlt), h('p', { class: 'kpi__sub', text: sub }));
  const bA = baseEfetiva(a); const bB = baseEfetiva(b);
  const kpis = h('div', { class: 'kpis-linha' },
    kpi(`Total de VTs (${mb})`, fInt(rB.length), delta(rB.length, rA.length, { mesAnt: ma }), `${ma}: ${fInt(rA.length)} · ${rA.length ? `${sinal(rB.length - rA.length)}${fPct(Math.abs(rB.length - rA.length) / rA.length)}` : '—'}`),
    bA && bB ? kpi('Taxa de VT', fPct(rB.length / bB, 2), delta((rB.length / bB) * 100, (rA.length / bA) * 100, { tipo: 'pp', mesAnt: ma }), `${ma}: ${fPct(rA.length / bA, 2)}`) : null,
    kpi('Reincidência', `${fDec(pct(rB, (r) => r.log > 0), 1)}%`, delta(pct(rB, (r) => r.log > 0), pct(rA, (r) => r.log > 0), { tipo: 'pp', mesAnt: ma }), `${ma}: ${fDec(pct(rA, (r) => r.log > 0), 1)}%`),
    kpi('Improdutivas', `${fDec(pct(rB, (r) => norm(r.fato) === 'improdutiva'), 1)}%`, delta(pct(rB, (r) => norm(r.fato) === 'improdutiva'), pct(rA, (r) => norm(r.fato) === 'improdutiva'), { tipo: 'pp', mesAnt: ma }), `${ma}: ${fDec(pct(rA, (r) => norm(r.fato) === 'improdutiva'), 1)}%`));

  const vc = variacoes(rA, rB, 'bx', (c) => ({ rotulo: descCodigo(c), chip: chipCodigo(c) }));
  const sobe = vc.filter((x) => x.d > 0).sort((x, y) => y.d - x.d).slice(0, 8);
  const desce = vc.filter((x) => x.d < 0).sort((x, y) => x.d - y.d).slice(0, 8);
  const maxC = Math.max(1, ...vc.map((x) => Math.abs(x.d)));

  const vm = variacoes(cA, cB, 'motivo', (m) => ({ rotulo: rotMotivo(m) })).filter((x) => x.d !== 0);
  const mSobe = vm.filter((x) => x.d > 0).sort((x, y) => y.d - x.d).slice(0, 6);
  const mDesce = vm.filter((x) => x.d < 0).sort((x, y) => x.d - y.d).slice(0, 6);
  const maxM = Math.max(1, ...vm.map((x) => Math.abs(x.d)));

  const va = variacoes(cA, cB, 'area', (ar) => ({ rotulo: ar })).sort((x, y) => y.d - x.d);
  const maxA = Math.max(1, ...va.map((x) => Math.abs(x.d)));

  const totais = meses.map((m) => ({ m, n: filtrar(regsMes(m)).length }));
  const maxT = Math.max(1, ...totais.map((t) => t.n));
  const evolucao = h('div', { class: 'cartao' },
    h('p', { class: 'cartao__titulo', text: 'Evolução mensal de VTs' }),
    h('p', { class: 'cartao__sub', text: escopoTexto() }),
    h('div', { class: 'colunas-mes' }, totais.map((t) => h('div', { class: `coluna-mes${t.m === b ? ' atual' : t.m === a ? '' : ' outra'}` },
      h('b', { text: fInt(t.n) }), h('span', { style: { height: `${(t.n / maxT) * 130}px` }, dataset: { tip: `${fInt(t.n)} VTs`, tipSub: metaMes(t.m).rotulo } })))),
    h('div', { class: 'rotulos-mes' }, totais.map((t) => h('small', { text: mesCurto(t.m) }))));

  const card = (titulo, sub, corpo) => h('div', { class: 'cartao' }, h('p', { class: 'cartao__titulo', text: titulo }), h('p', { class: 'cartao__sub', text: sub }), h('div', { style: { 'margin-top': '10px' } }, corpo));
  cont.replaceChildren(h('div', { style: { display: 'grid', gap: '16px' } },
    kpis,
    h('div', { class: 'grade-2' },
      card('Códigos que mais aumentaram', `${ma} → ${mb} · variação em VTs e em participação (p.p.)`, listaVariacao(sobe, { tipo: 'up', maxAbs: maxC })),
      card('Códigos que mais diminuíram', `${ma} → ${mb}`, listaVariacao(desce, { tipo: 'down', maxAbs: maxC }))),
    h('div', { class: 'grade-2' },
      card('Causas raiz em alta', estado.codigo ? `Dentro do código ${estado.codigo}` : 'Todas as famílias', listaVariacao(mSobe, { tipo: 'up', maxAbs: maxM })),
      card('Causas raiz em queda', estado.codigo ? `Dentro do código ${estado.codigo}` : 'Todas as famílias', listaVariacao(mDesce, { tipo: 'down', maxAbs: maxM }))),
    h('div', { class: 'grade-2' },
      card('Variação por área', `${ma} → ${mb}${estado.codigo ? ` · código ${estado.codigo}` : ''}`, h('div', { class: 'var-lista' }, va.map((it) => h('div', { class: 'var-linha sem-chip' },
        h('span', { class: 'rot' }, it.rotulo, h('small', { text: `${fInt(it.a)} → ${fInt(it.b)} VTs` })),
        barra(Math.abs(it.d) / maxA, it.d > 0 ? 'var(--ruim-marca)' : 'var(--bom-marca)'),
        h('span', { class: 'd' }, h('span', { class: `delta delta--${it.d > 0 ? 'ruim' : it.d < 0 ? 'bom' : 'neutro'}`, text: `${it.d > 0 ? '▲' : it.d < 0 ? '▼' : '■'} ${fSinal(it.d)}` })))))),
      evolucao)));
}

/* ------------------------------------------------------------------ BASE DE VISITAS */
const POR_PAGINA = 20;
function regsBase() {
  const t = estado.tabela;
  const q = norm(t.busca);
  return filtrar(regsMes()).filter((r) => (!t.motivo || r.motivo === t.motivo) && (!t.flag || r.flags.includes(t.flag))
    && (!q || norm([r.contrato, r.endereco, r.obs, r.nap, r.bx, r.area, rotMotivo(r.motivo), r.subfalha, r.parceira].join(' ')).includes(q)))
    .sort((a, b) => (b.agenda || '').localeCompare(a.agenda || '') || (b.baixa || '').localeCompare(a.baixa || ''));
}

function exportarCSV() {
  const linhas = regsBase();
  const cols = [['Data agenda', (r) => r.agenda], ['Data baixa', (r) => r.baixa], ['Área', (r) => r.area], ['Código', (r) => r.bx], ['Descrição', (r) => descCodigo(r.bx)],
    ['Família', (r) => FAMILIA.get(r.familia)?.rotulo], ['Motivo raiz', (r) => rotMotivo(r.motivo)], ['Origem do motivo', (r) => r.fonteMotivo], ['Observação', (r) => r.obs],
    ['FATO', (r) => r.fato], ['CAUSA', (r) => r.causa], ['SUBFALHA', (r) => r.subfalha], ['AÇÃO', (r) => r.acao], ['Endereço', (r) => r.endereco], ['Contrato', (r) => r.contrato],
    ['NAP', (r) => r.nap], ['Parceira', (r) => r.parceira], ['LOG', (r) => r.log], ['RX', (r) => (r.rx_off ? 'OFF' : r.rx)]];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map(([c]) => c).join(';'), ...linhas.map((r) => cols.map(([, f]) => esc(f(r))).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `vts-${estado.mes}${estado.area ? `-${norm(estado.area).replace(/\s/g, '-')}` : ''}${estado.codigo ? `-${estado.codigo}` : ''}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function corpoTabela() {
  const linhas = regsBase();
  const t = estado.tabela;
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  t.pagina = Math.min(t.pagina, paginas - 1);
  const pag = linhas.slice(t.pagina * POR_PAGINA, (t.pagina + 1) * POR_PAGINA);
  const tabela = h('div', { class: 'rolagem' }, h('table', { class: 'tabela tabela-base' },
    h('thead', null, h('tr', null, ['Agenda', 'Área', 'Código', 'Motivo raiz', 'Observação do técnico', 'Endereço', 'Contrato', 'NAP', 'Parceira', 'LOG'].map((c) => h('th', { text: c })))),
    h('tbody', null, pag.length ? pag.map((r) => h('tr', null,
      h('td', { class: 'nowrap', text: fData(r.agenda) }),
      h('td', { class: 'nowrap', text: r.area }),
      h('td', null, chipCodigo(r.bx)),
      h('td', { class: 'motivo-cel' }, h('i', { class: 'pontinho', style: { '--cor': corFamilia(r.familia) } }), rotMotivo(r.motivo), r.fonteMotivo === 'subfalha' ? h('small', { class: 'dica', text: ' (subfalha)' }) : null),
      h('td', { class: 'obs', text: r.obs || '—' }),
      h('td', { text: r.endereco || '—' }),
      h('td', { class: 'nowrap num', text: r.contrato || '—' }),
      h('td', { class: 'nowrap', text: r.nap || '—' }),
      h('td', { class: 'nowrap', text: r.parceira || '—' }),
      h('td', { class: 'n', text: String(r.log) })))
      : h('tr', null, h('td', { colspan: '10', class: 'vazio', text: 'Nenhuma visita encontrada.' })))));
  const pg = h('div', { class: 'paginacao' },
    h('span', { text: `${fInt(linhas.length)} visita(s) · página ${t.pagina + 1} de ${paginas}` }),
    h('div', null,
      h('button', { class: 'botao botao--sec', type: 'button', text: '← Anterior', disabled: t.pagina === 0, onclick: () => { t.pagina -= 1; $('#base-corpo').replaceChildren(...corpoTabela()); } }),
      h('button', { class: 'botao botao--sec', type: 'button', text: 'Próxima →', disabled: t.pagina >= paginas - 1, onclick: () => { t.pagina += 1; $('#base-corpo').replaceChildren(...corpoTabela()); } })));
  return [tabela, pg];
}

function renderBase() {
  const t = estado.tabela;
  const chips = [];
  if (t.motivo) chips.push(h('span', { class: 'chip-filtro' }, `Motivo: ${rotMotivo(t.motivo)}`, h('button', { type: 'button', 'aria-label': 'Remover filtro de motivo', text: '×', onclick: () => { t.motivo = ''; t.pagina = 0; renderBase(); } })));
  if (t.flag) chips.push(h('span', { class: 'chip-filtro' }, R.FLAGS[t.flag].rotulo, h('button', { type: 'button', 'aria-label': 'Remover filtro', text: '×', onclick: () => { t.flag = ''; t.pagina = 0; renderBase(); } })));
  const busca = h('input', { type: 'search', placeholder: 'Buscar contrato, endereço, NAP, observação…', value: t.busca, 'aria-label': 'Buscar na base de visitas' });
  let timer;
  busca.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { t.busca = busca.value; t.pagina = 0; $('#base-corpo').replaceChildren(...corpoTabela()); }, 180); });
  $('#base').replaceChildren(
    h('div', { class: 'base__ferramentas' },
      h('label', { class: 'busca' },
        h('span', { class: 'sr-only', text: 'Buscar' }),
        busca),
      h('div', { class: 'chips', style: { gap: '8px', 'align-items': 'center' } }, chips,
        h('button', { class: 'botao botao--sec', type: 'button', text: 'Exportar CSV', title: 'Baixa as visitas do filtro atual (abre no Excel)', onclick: exportarCSV }))),
    h('div', { id: 'base-corpo' }, corpoTabela()));
  // ícone de lupa (SVG estático, sem dados)
  const lupa = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lupa.setAttribute('viewBox', '0 0 24 24'); lupa.setAttribute('width', '16'); lupa.setAttribute('height', '16'); lupa.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', 'M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.38A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z');
  lupa.append(p); $('.busca').prepend(lupa);
}

/* ------------------------------------------------------------------ filtros (barra) */
function preencherSelect(sel, opcoes, valor, rotuloTodos) {
  sel.replaceChildren(h('option', { value: '', text: rotuloTodos }),
    ...opcoes.map(([v, rot]) => { const o = h('option', { value: String(v), text: rot }); if (String(v) === String(valor)) o.selected = true; return o; }));
  sel.classList.toggle('ativo', !!valor);
}

function renderBarra() {
  const regs = regsMes();
  const areas = ordenar(contar(regs, 'area'));
  if (estado.area && !areas.some(([a]) => a === estado.area)) areas.push([estado.area, 0]);
  preencherSelect($('#f-area'), areas.map(([a, n]) => [a, `${a} (${n})`]), estado.area, 'Todas as áreas');
  const parc = ordenar(contar(regs, 'parceira'));
  preencherSelect($('#f-parceira'), parc.map(([p, n]) => [p, `${p} (${n})`]), estado.parceira, 'Todas');
  const cods = ordenar(contar(filtrar(regs, { codigo: false }), 'bx'));
  if (estado.codigo && !cods.some(([c]) => String(c) === estado.codigo)) cods.push([+estado.codigo, 0]);
  preencherSelect($('#f-codigo'), cods.map(([c, n]) => [c, `${c} · ${descCodigo(c)} (${n})`]), estado.codigo, 'Todos os códigos');
  const mes = $('#f-mes');
  mes.replaceChildren(...[...estado.ordem].reverse().map((m) => { const o = h('option', { value: m, text: metaMes(m).rotulo }); if (m === estado.mes) o.selected = true; return o; }));
  const baseInput = $('#f-base');
  const baseVal = estado.base[estado.mes] || metaMes().base_assinantes?.total || '';
  if (document.activeElement !== baseInput) baseInput.value = baseVal;
  $('#btn-limpar').hidden = !(estado.area || estado.parceira || estado.codigo);
  $('#topo-periodo').textContent = `${metaMes().rotulo}${estado.area ? ` · ${estado.area}` : ''}`;
  const meta = metaMes();
  $('#rodape-fonte').textContent = `Fonte: ${meta.fonte} (aba ${meta.aba}) · processado em ${meta.gerado_em.slice(8, 10)}/${meta.gerado_em.slice(5, 7)}/${meta.gerado_em.slice(0, 4)} · ${fInt(meta.total_linhas)} visitas no mês.`;
}

function salvarBaseLocal() { try { localStorage.setItem('vt-dash-base', JSON.stringify(estado.base)); } catch { /* ok */ } }
function carregarBaseLocal() { try { estado.base = JSON.parse(localStorage.getItem('vt-dash-base') || '{}') || {}; } catch { estado.base = {}; } }

function ligarEventos() {
  if (estado.ligado) return;
  estado.ligado = true;
  $('#f-mes').addEventListener('change', (e) => { estado.mes = e.target.value; estado.comp = { a: null, b: null }; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-area').addEventListener('change', (e) => { estado.area = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-parceira').addEventListener('change', (e) => { estado.parceira = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-codigo').addEventListener('change', (e) => { estado.codigo = e.target.value; estado.tabela.pagina = 0; renderTudo(); });
  $('#f-base').addEventListener('change', (e) => {
    const v = Math.round(Number(e.target.value));
    if (v > 0) estado.base[estado.mes] = v; else delete estado.base[estado.mes];
    salvarBaseLocal(); renderTudo();
  });
  $('#btn-limpar').addEventListener('click', () => { estado.area = ''; estado.parceira = ''; estado.codigo = ''; estado.tabela = { busca: '', motivo: '', flag: '', pagina: 0 }; renderTudo(); });
  $('#btn-imprimir').addEventListener('click', () => window.print());
  $('#btn-sair').addEventListener('click', () => { esquecerChave(); window.location.reload(); });

  // destaca a seção visível na barra de âncoras
  const links = [...document.querySelectorAll('.ancoras a')];
  const obs = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (en.isIntersecting) links.forEach((l) => l.classList.toggle('ativa', l.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  document.querySelectorAll('.secao').forEach((s) => obs.observe(s));
}

function renderTudo() {
  renderBarra();
  renderResumo();
  renderCodigos();
  renderMotivos();
  renderCausas();
  renderAreas();
  renderReincidencia();
  renderComparativo();
  renderBase();
}

/* ------------------------------------------------------------------ inicialização */
async function abrir(chave) {
  const lista = [...estado.manifesto.meses].sort((x, y) => x.mes.localeCompare(y.mes));
  const dados = await Promise.all(lista.map(async (m) => {
    const resp = await fetch(`data/${m.arquivo}`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('REDE');
    return decifrarMes(chave, m.mes, await resp.arrayBuffer());
  }));
  estado.meses = new Map(dados.map((d) => [d.mes, prepararMes(d)]));
  estado.ordem = lista.map((m) => m.mes);
  estado.mes = estado.ordem.at(-1);
  calcularFamiliaCodigo();
  carregarBaseLocal();
  $('#legenda-familias').replaceChildren(...legendaFamilias());
  $('#login').hidden = true;
  $('#carregando').hidden = true;
  $('#app').hidden = false;
  ligarEventos();
  renderTudo();
}

function mostrarLogin(msg = '') {
  $('#carregando').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-msg').textContent = msg;
  $('#usuario').focus();
}

function ligarLogin() {
  const form = $('#form-login');
  const btn = $('#btn-entrar');
  const msg = $('#login-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#usuario').value.trim();
    const senha = $('#senha').value;
    const pedeLogin = estado.manifesto.kdf.credencial === 'login+senha';
    if ((pedeLogin && !login) || !senha) { msg.className = 'login__msg'; msg.textContent = pedeLogin ? 'Preencha login e senha.' : 'Digite a senha.'; return; }
    btn.disabled = true; btn.textContent = 'Abrindo…';
    msg.className = 'login__msg ok'; msg.textContent = 'Descriptografando os dados no seu navegador…';
    try {
      const chave = await derivarChave(login, senha, estado.manifesto.kdf);
      await abrir(chave);
      await guardarChave(chave, $('#lembrar').checked);
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
    try { await abrir(chave); return; } catch (e) { if (e.message !== 'SENHA') console.error(e); esquecerChave(); }
  }
  mostrarLogin();
}

iniciar();
