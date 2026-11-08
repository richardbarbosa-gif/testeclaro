/* =============================================================================
 * REGRAS DE NEGÓCIO DO DASHBOARD — edite aqui, não no app.js
 * -----------------------------------------------------------------------------
 * A classificação roda no navegador a cada carga. Mudou uma regra? Basta
 * publicar o site de novo: todos os meses (inclusive os antigos) são
 * reclassificados, sem precisar das planilhas originais.
 * ========================================================================== */

/** Códigos detalhados em cards fixos na seção "Por que cada código ofendeu". */
export const CODIGOS_DESTAQUE = [566, 589, 584, 203];

/** NAPs genéricas (cadastro sem NAP real) — não entram nos rankings de NAP. */
export const NAP_GENERICA = /^GPON/i;

/**
 * Identificador canônico da NAP. A mesma NAP aparece em formatos diferentes:
 *   VLB0520105 = VLB.XX.052.01.05 = (sem zero) VLB520105 -> VLB0520105
 * Retorna null para NAP vazia ou genérica.
 */
export function napCanonica(nap) {
  if (!nap) return null;
  const s = String(nap).toUpperCase().replace(/\s+/g, '');
  if (!s || NAP_GENERICA.test(s)) return null;
  let m = s.match(/^([A-Z]{3})\.XX\.(\d{3})\.(\d{2})\.(\d{2})$/);
  if (m) return m[1] + m[2] + m[3] + m[4];
  m = s.match(/^([A-Z]{3})(\d{2})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}0${m[2]}${m[3]}${m[4]}`;
  return s;
}

/** Nome de exibição de cada valor da coluna REGIAO. */
export const AREAS = {
  'AREA ANDRADINA': 'Andradina',
  'AREA BIRIGUI': 'Birigui',
  'AREA GUARARAPES': 'Guararapes',
  'AREA VALPARAISO': 'Valparaíso',
  'AREA DRACENA': 'Dracena',
  'AREA PENAPOLIS': 'Penápolis',
  'AREA MIRANDOPOL': 'Mirandópolis',
  'AREA PRESIDENTE': 'Presidente', // TODO confirmar: Prudente / Venceslau / Epitácio?
  'AREA ADAMANTINA': 'Adamantina',
};
export function nomeArea(regiao) {
  if (AREAS[regiao]) return AREAS[regiao];
  const s = String(regiao || 'Sem região').replace(/^AREA\s+/i, '').toLowerCase();
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/* -----------------------------------------------------------------------------
 * FAMÍLIAS — agrupam as visitas pelo tipo de intervenção (cor fixa por família).
 * Paleta categórica validada (CVD + contraste) para superfície branca.
 * -------------------------------------------------------------------------- */
export const FAMILIAS = [
  { id: 'drop', rotulo: 'Drop', curto: 'drop', cor: '#2a78d6' },
  { id: 'conector_nap', rotulo: 'Conector NAP (externo)', curto: 'conector NAP', cor: '#eb6834' },
  { id: 'conector_interno', rotulo: 'Conector interno', curto: 'conector interno', cor: '#1baf7a' },
  { id: 'rede_externa', rotulo: 'Rede externa (203)', curto: 'rede externa', cor: '#eda100' },
  { id: 'equipamento', rotulo: 'Equipamento', curto: 'equipamento', cor: '#e87ba4' },
  { id: 'outros', rotulo: 'Cliente / improdutiva / outros', curto: 'outros', cor: '#a3a29b' },
];

/** Família de UMA visita, pela CAUSA registrada (improdutiva tem prioridade). */
export function familiaDaVisita(r, n) {
  if (n(r.fato) === 'improdutiva') return 'outros';
  const c = n(r.causa);
  if (c === 'refeito drop') return 'drop';
  if (c === 'troca de conector externo nap') return 'conector_nap';
  if (c === 'troca de conector interno') return 'conector_interno';
  if (c === 'rede externa') return 'rede_externa';
  if (/^terminal|fonte|habilitacao|mesh|cabo especial|pto/.test(c)) return 'equipamento';
  return 'outros';
}

/* -----------------------------------------------------------------------------
 * DICIONÁRIO DE CÓDIGOS DE BAIXA
 * Descrições INFERIDAS da base de out/2026 (CAUSA + AÇÃO + observações).
 * Confirmar com o dicionário oficial da operação.
 * -------------------------------------------------------------------------- */
export const CODIGOS = {
  100: 'Diversos (rede/terminal)',
  103: 'Improdutiva – reagendada',
  106: 'Improdutiva – ativo sem sucesso',
  107: 'Improdutiva – cliente indisponível',
  203: 'Rede externa (NAP sem sinal)',
  301: 'Tipo de OS incorreta',
  302: 'Tipo de OS incorreta',
  409: 'VT sem validação',
  476: 'Mesh reconfigurado',
  506: 'VT sem validação',
  510: 'Troca de fonte',
  516: 'Troca de terminal – travado',
  517: 'Troca de terminal – queimado',
  518: 'Troca de terminal – habilitação',
  521: 'Troca de terminal – intermitente',
  522: 'Troca de terminal – intermitente',
  523: 'Mesh / Wi-Fi',
  524: 'Troca de terminal a pedido',
  527: 'Troca de terminal',
  529: 'Troca de terminal (cliente)',
  533: 'Boot em terminal travado',
  536: 'Reconfiguração de Wi-Fi',
  537: 'Reconfiguração de Wi-Fi',
  540: 'Troca de conector interno',
  541: 'Troca de conector interno',
  542: 'Troca de conector interno',
  543: 'Troca de conector NAP',
  544: 'Troca de conector',
  545: 'Troca de conector NAP',
  546: 'Troca de conector NAP',
  550: 'Instrução ao cliente (TV)',
  551: 'Troca de cabo especial',
  552: 'Orientação ao cliente',
  555: 'Sem defeito constatado',
  558: 'Boot em terminal travado',
  560: 'Equipamento do cliente',
  562: 'Reconexão na NAP',
  563: 'Reconexão de cabos',
  566: 'Troca de drop',
  584: 'Troca de conector interno',
  586: 'Troca de drop',
  588: 'Troca de conector interno',
  589: 'Troca de conector NAP',
  590: 'Remoção de PTO',
};

/* -----------------------------------------------------------------------------
 * GRUPOS DE CAUSA RAIZ (macro) e MOTIVOS (causa raiz)
 * -------------------------------------------------------------------------- */
export const GRUPOS = [
  { id: 'externo', rotulo: 'Agentes externos', desc: 'Poste, árvore, carga alta, vandalismo, animais…' },
  { id: 'clima', rotulo: 'Clima e energia', desc: 'Chuva, raio, queda de energia' },
  { id: 'rede', rotulo: 'Rede e conectorização', desc: 'Água, oxidação, atenuação, fibra rompida…' },
  { id: 'cliente', rotulo: 'Cliente', desc: 'Dano pelo cliente, ausência, orientação, equip. particular' },
  { id: 'equipamento', rotulo: 'Equipamento', desc: 'Travado, intermitente, queimado, defeito' },
  { id: 'processo', rotulo: 'Processo / apontamento', desc: 'OS incorreta, VT sem validação' },
  { id: 'sem_info', rotulo: 'Sem informação', desc: 'Observação sem causa identificável' },
];

/**
 * Regras aplicadas sobre o texto normalizado (minúsculo, sem acento).
 * ORDEM = PRIORIDADE: a primeira que casar define o motivo.
 * 1º tenta a OBSERVAÇÃO; se nada casar, tenta a SUBFALHA; senão "Sem informação".
 * Ex.: "terminal queimado após queda de energia depois de raio" -> Raio
 *      "conector oxidado na nap, cheio de água"                   -> Água / umidade
 */
export const MOTIVOS = [
  // --- clima que precisa vencer tudo
  { id: 'raio', rotulo: 'Raio', grupo: 'clima', re: /\braio\b|descarga atmosferica/ },
  // --- agentes externos
  { id: 'queda_arvore', rotulo: 'Queda de árvore', grupo: 'externo', re: /queda d[ae] arvore|arvore caiu|ca(iu|ir) (uma )?arvore/ },
  { id: 'troca_poste', rotulo: 'Troca de poste', grupo: 'externo', re: /\bposte\b/ },
  { id: 'poda_arvore', rotulo: 'Poda de árvore', grupo: 'externo', re: /poda/ },
  { id: 'carga_alta', rotulo: 'Carga alta', grupo: 'externo', re: /carga alta/ },
  { id: 'concorrencia', rotulo: 'Corte pela concorrência', grupo: 'externo', re: /concorren/ },
  { id: 'vandalismo', rotulo: 'Vandalismo', grupo: 'externo', re: /vandal/ },
  { id: 'animais', rotulo: 'Animais (maritaca etc.)', grupo: 'externo', re: /maritaca|passaro|animal|animais|roedor|\brato\b|esquilo|morcego|macaco/ },
  { id: 'pipa', rotulo: 'Linha de pipa', grupo: 'externo', re: /\bpipa\b|cerol/ },
  { id: 'cabo_baixo', rotulo: 'Cabo baixo', grupo: 'externo', re: /cabo baixo/ },
  // --- clima e energia
  { id: 'queda_energia', rotulo: 'Queda de energia', grupo: 'clima', re: /(queda|falta|pico) de ener?gia|oscilacao de energia/ },
  { id: 'chuva', rotulo: 'Chuva / evento climático', grupo: 'clima', re: /chuva|temporal|tempestade|vendaval|climatic/ },
  // --- rede e conectorização
  { id: 'agua', rotulo: 'Água / umidade', grupo: 'rede', re: /\bagua\b|umidade|molhad|infiltra/ },
  { id: 'insetos', rotulo: 'Insetos (formigas)', grupo: 'rede', re: /formiga|inseto|cupim|abelha|marimbondo|aranha/ },
  { id: 'oxidacao', rotulo: 'Oxidação / sujeira', grupo: 'rede', re: /oxidad|oxidacao|sujeira|\bsujo\b/ },
  { id: 'atenuacao', rotulo: 'Atenuação (troca preventiva)', grupo: 'rede', re: /atenuad|atenuacao|preventiva|instabilidade/ },
  { id: 'solto', rotulo: 'Conector / drop solto', grupo: 'rede', re: /solto|frouxo|mal encaixad|desencaixad/ },
  { id: 'fibra_rompida', rotulo: 'Fibra rompida', grupo: 'rede', re: /rompid|rompimento|fibra quebrada/ },
  { id: 'nap_sem_sinal', rotulo: 'NAP sem sinal (sem causa)', grupo: 'rede', re: /nap sem sinal|rede externa sem sinal|sem sinal na nap/ },
  // --- cliente
  { id: 'dano_cliente', rotulo: 'Danificado pelo cliente', grupo: 'cliente', re: /limpar o movel|pedreiro|reforma|danificou|danficou|danificado pelo cliente|causa cliente/ },
  { id: 'ausente', rotulo: 'Cliente ausente', grupo: 'cliente', re: /ausente|ninguem no local/ },
  { id: 'indisponivel', rotulo: 'Cliente indisponível', grupo: 'cliente', re: /nao podia acompanhar|compromisso|nao autoriza/ },
  { id: 'financeiro', rotulo: 'Financeiro / contrato', grupo: 'cliente', re: /fatura|cancelou|negociando|inadimpl/ },
  { id: 'desconectou', rotulo: 'Cliente desconectou cabos', grupo: 'cliente', re: /desconectou|tinha desconectado|ligar cabo/ },
  { id: 'equip_particular', rotulo: 'Equipamento do cliente', grupo: 'cliente', re: /roteador|particular|nao homologad|\bdvr\b|tv box|telefone do cliente|tomada/ },
  { id: 'normalizado', rotulo: 'Normalizado / sem defeito', grupo: 'cliente', re: /normalizad|sem defeito|virtua ok/ },
  { id: 'orientacao', rotulo: 'Orientação ao cliente', grupo: 'cliente', re: /senha|separar as redes|wifi errado|orienta|instrucao|nao sabia|dificuldade|globo ?play|grade/ },
  // --- equipamento
  { id: 'mesh', rotulo: 'Ajuste de Mesh', grupo: 'equipamento', re: /\bmesh\b/ },
  { id: 'travado', rotulo: 'Equipamento travado', grupo: 'equipamento', re: /travad/ },
  { id: 'intermitencia', rotulo: 'Intermitência', grupo: 'equipamento', re: /intermiten/ },
  { id: 'queimado', rotulo: 'Equipamento queimado', grupo: 'equipamento', re: /queimad/ },
  { id: 'adequacao', rotulo: 'Adequação à velocidade', grupo: 'equipamento', re: /compativel com velocidade|upgrade/ },
  { id: 'defeito', rotulo: 'Defeito no equipamento', grupo: 'equipamento', re: /defeito|sem funcionamento|desligando sozinha|acoplador|nao navega/ },
  // --- processo
  { id: 'os_incorreta', rotulo: 'OS incorreta', grupo: 'processo', re: /mudanca de ponto|os incorreta|veio incorreta|veio como mp|nomenclatura/ },
  { id: 'falha_anterior', rotulo: 'Falha na visita anterior', grupo: 'processo', re: /nao trocou antes|nao verificou/ },
  { id: 'sem_validacao', rotulo: 'VT sem validação', grupo: 'processo', re: /sem validacao|nao validou|nao justificou|sem explicacao/ },
];
export const MOTIVO_SEM_INFO = { id: 'sem_info', rotulo: 'Sem informação', grupo: 'sem_info' };

/** Sinais de qualidade de apontamento, procurados na observação. */
export const FLAGS = {
  baixa_errada: { rotulo: 'Indício de código de baixa errado', re: /baixou errado|baixa errada|cod(igo)? errado|errou a baixa|veio incorreta/ },
  sem_validacao: { rotulo: 'VT sem validação / justificativa', re: /sem validacao|nao validou|nao justificou/ },
};
