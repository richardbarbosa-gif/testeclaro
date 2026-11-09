/* =============================================================================
 * REGRAS DE NEGÓCIO DO DASHBOARD — edite aqui, não no app.js
 * -----------------------------------------------------------------------------
 * A classificação roda no navegador a cada carga. Mudou uma regra? Basta
 * publicar o site de novo: todos os meses (inclusive os antigos) são
 * reclassificados, sem precisar das planilhas originais.
 *
 * Hierarquia:  REGRA (regex) -> MOTIVO (causa raiz) -> EIXO (causas relacionadas)
 *              -> NATUREZA (externa / operação Claro / cliente / não identificada)
 * ========================================================================== */

/** Códigos detalhados em cards fixos na seção "Códigos". */
export const CODIGOS_DESTAQUE = [566, 589, 584, 203];

/** DDDs acompanhados (ordem das abas). */
export const DDDS = ['18', '14'];

/* -----------------------------------------------------------------------------
 * TEXTO
 * -------------------------------------------------------------------------- */
export const textoNorm = (t) => (t == null ? '' : String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim());

/** Observação vazia ou sem conteúdo ("Sem observação", "Ok", "Observação baixa OS 1"…). */
export function obsVazia(obs) {
  const t = textoNorm(obs).replace(/[.#]/g, '').trim();
  return !t || t.length < 3 || /^(sem observ\w*|ok|observacao baixa os ?\d*|\d{3})$/.test(t);
}

/* -----------------------------------------------------------------------------
 * NAP
 * -------------------------------------------------------------------------- */
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

/* -----------------------------------------------------------------------------
 * ÁREAS (coluna REGIAO) -> nome de exibição
 * -------------------------------------------------------------------------- */
export const AREAS = {
  // DDD 18
  'AREA ANDRADINA': 'Andradina',
  'AREA BIRIGUI': 'Birigui',
  'AREA GUARARAPES': 'Guararapes',
  'AREA VALPARAISO': 'Valparaíso',
  'AREA DRACENA': 'Dracena',
  'AREA PENAPOLIS': 'Penápolis',
  'AREA MIRANDOPOL': 'Mirandópolis',
  'AREA PRESIDENTE': 'Presidente', // TODO confirmar: Prudente / Venceslau / Epitácio?
  'AREA ADAMANTINA': 'Adamantina',
  // DDD 14
  'AREA LENCOIS PA': 'Lençóis Paulista',
  'AREA AVARE': 'Avaré',
  'AREA OURINHOS': 'Ourinhos',
  'AREA AGUDOS': 'Agudos',
  'AREA GARCA': 'Garça',
  'AREA LINS': 'Lins',
  'AREA SANTA CRUZ': 'Santa Cruz do Rio Pardo',
  'AREA PROMISSAO': 'Promissão',
};
export function nomeArea(regiao) {
  if (AREAS[regiao]) return AREAS[regiao];
  const s = String(regiao || 'Sem região').replace(/^AREA\s+/i, '').toLowerCase();
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/* -----------------------------------------------------------------------------
 * FAMÍLIAS — tipo de intervenção (cor fixa por família; paleta validada p/ daltonismo)
 * -------------------------------------------------------------------------- */
export const FAMILIAS = [
  { id: 'drop', rotulo: 'Drop', curto: 'drop', cor: '#2a78d6' },
  { id: 'conector_nap', rotulo: 'Conector NAP (externo)', curto: 'conector NAP', cor: '#eb6834' },
  { id: 'conector_interno', rotulo: 'Conector interno', curto: 'conector interno', cor: '#1baf7a' },
  { id: 'rede_externa', rotulo: 'Rede externa (203)', curto: 'rede externa', cor: '#eda100' },
  { id: 'equipamento', rotulo: 'Equipamento', curto: 'equipamento', cor: '#e87ba4' },
  { id: 'outros', rotulo: 'Cliente / improdutiva / outros', curto: 'outros', cor: '#a3a29b' },
];

/** Família de UMA visita pela CAUSA. Retorna null se não der para saber (o app usa a família do código). */
export function familiaDaVisita(r) {
  if (textoNorm(r.fato) === 'improdutiva' || textoNorm(r.causa) === 'improdutiva') return 'outros';
  const c = textoNorm(r.causa);
  if (!c) return null;
  if (c === 'refeito drop') return 'drop';
  if (c === 'troca de conector externo nap') return 'conector_nap';
  if (c === 'troca de conector interno') return 'conector_interno';
  if (c === 'rede externa') return 'rede_externa';
  if (/^terminal|fonte|habilitacao|mesh|cabo especial|pto|acoplador|esticador|equipamento desconfigurado|rede (des)?unificad/.test(c)) return 'equipamento';
  return 'outros';
}

/* -----------------------------------------------------------------------------
 * DICIONÁRIO DE CÓDIGOS DE BAIXA — descrições INFERIDAS das bases (confirmar com o oficial).
 * Código fora da lista: o app usa a AÇÃO mais frequente daquele código.
 * -------------------------------------------------------------------------- */
export const CODIGOS = {
  100: 'Diversos (rede/terminal)',
  101: 'Improdutiva – endereço não localizado',
  103: 'Improdutiva – reagendada',
  106: 'Improdutiva – ativo sem sucesso',
  107: 'Improdutiva – cliente indisponível',
  203: 'Rede externa (NAP sem sinal)',
  301: 'Tipo de OS incorreta',
  302: 'Tipo de OS incorreta',
  312: 'Cliente não solicitou o serviço',
  409: 'VT sem validação',
  471: 'Reconfiguração do terminal',
  473: 'Instrução Wi-Fi (2G/5G)',
  474: 'Mesh reposicionado',
  476: 'Mesh reconfigurado',
  506: 'VT sem validação',
  510: 'Troca de fonte',
  514: 'Habilitação',
  516: 'Troca de terminal – travado',
  517: 'Troca de terminal – queimado',
  518: 'Troca de terminal – habilitação',
  521: 'Troca de terminal – intermitente',
  522: 'Troca de terminal – intermitente',
  523: 'Mesh / Wi-Fi',
  524: 'Troca de terminal a pedido',
  527: 'Troca de terminal',
  529: 'Troca de terminal (cliente)',
  530: 'Troca de terminal / Mesh',
  533: 'Boot em terminal travado',
  534: 'Reconfiguração do terminal',
  535: 'Reconfiguração do terminal',
  536: 'Reconfiguração de Wi-Fi',
  537: 'Reconfiguração de Wi-Fi',
  540: 'Troca de conector interno',
  541: 'Troca de conector interno',
  542: 'Troca de conector interno',
  543: 'Troca de conector NAP',
  544: 'Troca de conector',
  545: 'Troca de conector NAP',
  546: 'Troca de conector NAP',
  548: 'Troca de conector interno',
  549: 'Velocidade conforme contratado',
  550: 'Instrução ao cliente (TV)',
  551: 'Troca de cabo especial',
  552: 'Orientação ao cliente',
  555: 'Sem defeito constatado',
  556: 'Sem defeito constatado',
  557: 'Sem defeito (telefone)',
  558: 'Boot em terminal travado',
  560: 'Equipamento do cliente',
  562: 'Reconexão na NAP',
  563: 'Reconexão de cabos',
  566: 'Troca de drop',
  575: 'Sem defeito (equip. do cliente)',
  582: 'Mesh / troca de terminal',
  584: 'Troca de conector interno',
  586: 'Troca de drop',
  588: 'Troca de conector interno',
  589: 'Troca de conector NAP',
  590: 'Remoção de PTO',
  594: 'Reconfiguração de senha',
};

/* -----------------------------------------------------------------------------
 * NATUREZA (macro) e EIXOS (causas relacionadas)
 * -------------------------------------------------------------------------- */
export const NATUREZAS = [
  { id: 'externa', rotulo: 'Causas externas', desc: 'Clima, energia, poste, caminhões, terceiros, animais', cor: '#34343a' },
  { id: 'operacao', rotulo: 'Operação Claro', desc: 'Conectorização, equipamento e processo — onde a operação atua', cor: '#e30613' },
  { id: 'cliente', rotulo: 'Cliente', desc: 'Ausência, orientação, dano ou equipamento do cliente', cor: '#8f8d86' },
  { id: 'indefinida', rotulo: 'Causa não identificada', desc: 'Dano sem causa citada ou sem informação', cor: '#d6d4cd' },
];

export const EIXOS = [
  { id: 'chuva', rotulo: 'Chuva, vento e umidade', natureza: 'externa', desc: 'Chuva, ventania, raio, queda de árvore, água e oxidação no conector/NAP' },
  { id: 'carga_alta', rotulo: 'Carga alta (caminhões)', natureza: 'externa', desc: 'Caminhão/veículo alto rompendo drop ou derrubando NAP; cabo baixo' },
  { id: 'poste', rotulo: 'Poste e concessionária', natureza: 'externa', desc: 'Troca/manutenção de poste e obras da concessionária (CPFL)' },
  { id: 'terceiros', rotulo: 'Terceiros e vandalismo', natureza: 'externa', desc: 'Outras operadoras, vandalismo, cabo cortado, linha de pipa' },
  { id: 'vegetacao', rotulo: 'Poda de árvore', natureza: 'externa', desc: 'Poda de árvore atingindo drop/conector' },
  { id: 'animais', rotulo: 'Animais e insetos', natureza: 'externa', desc: 'Maritaca e outros animais, formigas' },
  { id: 'energia', rotulo: 'Energia elétrica', natureza: 'externa', desc: 'Queda/oscilação de energia e descarga elétrica' },
  { id: 'rede', rotulo: 'Conectorização e instalação', natureza: 'operacao', desc: 'Atenuação, conector solto/fora do padrão, esticador' },
  { id: 'equipamento', rotulo: 'Equipamento', natureza: 'operacao', desc: 'ONT/MTA/Mesh com defeito, travado, intermitente, desconfigurado ou incompatível' },
  { id: 'processo', rotulo: 'Processo e apontamento', natureza: 'operacao', desc: 'OS incorreta, endereço não localizado, VT sem validação' },
  { id: 'cliente', rotulo: 'Cliente', natureza: 'cliente', desc: 'Ausente, orientação, dano ou equipamento do cliente, sem defeito' },
  { id: 'dano_sem_causa', rotulo: 'Dano sem causa citada', natureza: 'indefinida', desc: 'Rompimento, conector danificado ou NAP sem sinal sem o porquê' },
  { id: 'sem_info', rotulo: 'Sem informação', natureza: 'indefinida', desc: 'Nem observação, nem SUBFALHA, nem CAUSA indicam o motivo' },
];

/* -----------------------------------------------------------------------------
 * MOTIVOS (catálogo) — cada um pertence a UM eixo
 * -------------------------------------------------------------------------- */
export const MOTIVOS = [
  // chuva, vento e umidade
  { id: 'chuva', rotulo: 'Chuva / ventania', eixo: 'chuva' },
  { id: 'raio', rotulo: 'Raio', eixo: 'chuva' },
  { id: 'queda_arvore', rotulo: 'Queda de árvore / galho', eixo: 'chuva' },
  { id: 'agua', rotulo: 'Água / umidade', eixo: 'chuva' },
  { id: 'oxidacao', rotulo: 'Oxidação / sujeira', eixo: 'chuva' },
  // carga alta
  { id: 'carga_alta', rotulo: 'Carga alta (caminhão)', eixo: 'carga_alta' },
  { id: 'cabo_baixo', rotulo: 'Cabo baixo', eixo: 'carga_alta' },
  // poste
  { id: 'troca_poste', rotulo: 'Troca / obra de poste', eixo: 'poste' },
  { id: 'concessionaria', rotulo: 'Concessionária de energia (CPFL)', eixo: 'poste' },
  // terceiros
  { id: 'terceiros', rotulo: 'Terceiros / outra operadora', eixo: 'terceiros' },
  { id: 'vandalismo', rotulo: 'Vandalismo', eixo: 'terceiros' },
  { id: 'cortado', rotulo: 'Cabo cortado (autor não citado)', eixo: 'terceiros' },
  { id: 'pipa', rotulo: 'Linha de pipa', eixo: 'terceiros' },
  // vegetação, animais, energia
  { id: 'poda_arvore', rotulo: 'Poda de árvore', eixo: 'vegetacao' },
  { id: 'animais', rotulo: 'Animais (maritaca etc.)', eixo: 'animais' },
  { id: 'insetos', rotulo: 'Insetos (formigas)', eixo: 'animais' },
  { id: 'queda_energia', rotulo: 'Queda de energia / descarga', eixo: 'energia' },
  // conectorização e instalação
  { id: 'atenuacao', rotulo: 'Atenuação / sinal fora do padrão', eixo: 'rede' },
  { id: 'solto', rotulo: 'Conector solto / fora do padrão', eixo: 'rede' },
  { id: 'esticador', rotulo: 'Esticador / ancoragem', eixo: 'rede' },
  // dano sem causa citada
  { id: 'nap_sem_sinal', rotulo: 'NAP sem sinal (sem causa)', eixo: 'dano_sem_causa' },
  { id: 'rompimento', rotulo: 'Rompimento (sem causa)', eixo: 'dano_sem_causa' },
  { id: 'conector_danificado', rotulo: 'Conector danificado (sem causa)', eixo: 'dano_sem_causa' },
  // equipamento
  { id: 'mesh', rotulo: 'Mesh / cobertura Wi-Fi', eixo: 'equipamento' },
  { id: 'reconfiguracao', rotulo: 'Desconfigurado / resetado', eixo: 'equipamento' },
  { id: 'adequacao', rotulo: 'Incompatível com a velocidade', eixo: 'equipamento' },
  { id: 'intermitencia', rotulo: 'Intermitência / instabilidade', eixo: 'equipamento' },
  { id: 'travado', rotulo: 'Equipamento travado', eixo: 'equipamento' },
  { id: 'queimado', rotulo: 'Equipamento queimado', eixo: 'equipamento' },
  { id: 'defeito', rotulo: 'Defeito no equipamento', eixo: 'equipamento' },
  // processo
  { id: 'os_incorreta', rotulo: 'OS incorreta / não solicitada', eixo: 'processo' },
  { id: 'endereco', rotulo: 'Endereço não localizado', eixo: 'processo' },
  { id: 'falha_anterior', rotulo: 'Falha na visita anterior', eixo: 'processo' },
  { id: 'sem_validacao', rotulo: 'VT sem validação', eixo: 'processo' },
  // cliente
  { id: 'vazamento', rotulo: 'Vazamento na residência', eixo: 'cliente' },
  { id: 'dano_cliente', rotulo: 'Danificado pelo cliente', eixo: 'cliente' },
  { id: 'ausente', rotulo: 'Cliente ausente', eixo: 'cliente' },
  { id: 'indisponivel', rotulo: 'Cliente indisponível / reagendou', eixo: 'cliente' },
  { id: 'financeiro', rotulo: 'Financeiro / contrato', eixo: 'cliente' },
  { id: 'desconectou', rotulo: 'Cliente desconectou cabos', eixo: 'cliente' },
  { id: 'equip_particular', rotulo: 'Equipamento do cliente', eixo: 'cliente' },
  { id: 'normalizado', rotulo: 'Sem defeito / já normalizado', eixo: 'cliente' },
  { id: 'orientacao', rotulo: 'Orientação ao cliente', eixo: 'cliente' },
];
export const MOTIVO_SEM_INFO = { id: 'sem_info', rotulo: 'Sem informação', eixo: 'sem_info' };

/* -----------------------------------------------------------------------------
 * REGRAS — regex sobre texto normalizado (minúsculo, sem acento).
 * ORDEM = PRIORIDADE: a primeira que casar define o motivo.
 * Aplicadas em sequência na OBSERVAÇÃO; se nada casar, na SUBFALHA; depois na CAUSA.
 * Ex.: "terminal queimado após queda de energia depois de raio" -> Raio
 *      "conector oxidado na nap, cheio de água"                   -> Água / umidade
 *      "modem molhou pois estourou um cano"                      -> Vazamento (não é chuva)
 * -------------------------------------------------------------------------- */
const R = (motivo, re) => ({ motivo, re });
export const REGRAS = [
  R('vazamento', /estourou (um )?cano|cano de agua|vazamento/),
  R('raio', /\braio\b|descarga atmosferica/),
  R('queda_arvore', /queda d[aeo]s? (galho|arvore)|galho|arvores? (caiu|cairam)|ca(iu|ir|iram) (uma |umas |as )?arvores?/),
  R('troca_poste', /trocas? d[eo]s? postes?|manutencao no poste|poste da concessionaria|obra no poste|troca de poste/),
  R('concessionaria', /cpfl|concessionaria|elektro|energisa|equipe .{0,40}energia|parte da energia/),
  R('poda_arvore', /\bpoda/),
  R('carga_alta', /carga alta|caminh(ao|oes)|veiculo alto|onibus/),
  R('terceiros', /terceir|aonet|zaaz|outra operadora|outra empresa|concorren|manutencao (de outra|perto da|no cab|na rua)/),
  R('vandalismo', /vandal/),
  R('animais', /maritaca|passaro|animal|animais|roedor|\brato\b|esquilo|morcego|macaco|cachorr|\bcao\b|\bgato\b|comeu|mastigou/),
  R('cortado', /cortaram|cortad[oa]|\bcortou\b/),
  R('pipa', /\bpipa\b|cerol/),
  R('esticador', /esticador|ancoragem/),
  R('cabo_baixo', /cabo baixo|drops? (muito )?baixos?|(tava|estava) (muito )?baixo/),
  R('queda_energia', /(queda|quedas|falta|pico|oscilacao) de ener?gia|descarga eletrica/),
  R('chuva', /chuva|chov|temporal|tempestade|vendaval|ventania|\bvento|climatic|queda de torre/),
  R('agua', /\bagua\b|umidade|molhad|molhou|infiltra/),
  R('insetos', /formiga|inseto|cupim|abelha|marimbondo|aranha/),
  R('oxidacao', /oxidad|oxidacao|sujeira|\bsujo\b/),
  // conector com sinal ruim -> atenuação (antes da regra de NAP sem sinal)
  R('atenuacao', /conector.{0,45}(atenua|medidas fora do padrao|oscilando)|(atenua|oscilando).{0,20}conector/),
  R('nap_sem_sinal', /\bnap\b.{0,45}(sem sinal|fora d[eo] (padrao|sinal)|sinal (fora|alterado|alto|atenuado)|\blos\b|com -?\d{2}|estava com -?\d{2}|problema)|(rede|red) (externa|esterno|principal).{0,30}(sem sinal|problema|fora|alto|allto)|^rede externa$|sem sinal na nap|problema na nap|nap caida/),
  R('atenuacao', /atenua|preventiva|motivo de instabilidade|deixando o sinal|sinal (estava |esta |muito )?(alto|allto|ruim|alterado)|dando \d+ de sinal|menos 4\d|oscilando sinal/),
  R('solto', /solto|frouxo|mal encaixad|desencaixad|conector fora do padrao|desconectado na nap|fora da nap|reconectad/),
  R('rompimento', /rompid|rompimento|rompeu|arrebent|estourou|fibra quebrada|dobrad|(drop|drope|fibra|cabo).{0,25}danificad/),
  R('conector_danificado', /conector.{0,30}(danificad|\bdani|estragou|quebrad|com defeito)|danificad.{0,15}conector|^estava danificad|estragou/),
  R('dano_cliente', /limpar o movel|pedreiro|reforma|danificou|danficou|danificado pelo cliente|causa cliente|cliente dobrou|cliente quebrou|caiu do movel|derrubou/),
  R('ausente', /ausente|ninguem|casa fechada|nao (esta|estava|estaba|tava) (em casa|na (casa|residencia))|nao atend|nao fui atendido/),
  R('indisponivel', /nao podia acompanhar|compromisso|nao autoriza|reagend|ficou para depois/),
  R('endereco', /endereco nao localizado|nao (foi )?localizad[oa] (o )?endereco|desconhece assinante/),
  R('financeiro', /fatura|cancelou|negociando|inadimpl/),
  R('os_incorreta', /mudanca de ponto|os incorreta|veio incorreta|veio como mp|nomenclatura|nao solicitou|foi aberto uma visita|abriu (uma )?visita|retirada de equipamento|contrato ativo|local informado|reativar|cancelamento|mudanca de (local|endereco)/),
  R('desconectou', /desconectou|tinha desconectado|ligar cabo|desconectado do computador/),
  R('reconfiguracao', /reconfigur|resetad|\breset|voltou de fabrica|desunific|unificad|desconfigur|pareamento|perd[ie]u a configuracao/),
  R('equip_particular', /roteador|router|(roteador|tv|aparelho|sistema|equipamento) particular|nao homologad|\bdvr\b|tv box|telefone do cliente|tomada|pirata|cabo de rede|computador|smart ?tv/),
  R('mesh', /\bmesh\b|alcance|cobertura|repetidor/),
  R('normalizado', /sem defeito|nenhum (problema|defeito)|nao (foi )?identificad[oa] (nenhum )?(defeito|problema)|sem anormalidade|ja havia normalizado|ja (se )?restabeleceu|nao ha problema|esta normal|estava ok|virtua ok|funcionando perfeitamente|^sina(l|is) (esta |e )?ok|estava tudo (funcionando|ok)|todos os testes.{0,20}tudo ok|velocidade conforme/),
  R('orientacao', /senha|separar as redes|wifi errado|orient|instrucao|nao sabia|dificuldade|duvida|explicad|globo ?play|grade|\bjogo\b|sites especificos|rede 5g|nao estava conectado/),
  R('intermitencia', /intermi?n?ten|intermint|instabilidade|uma hora funciona|para e volta|caindo|oscila|reiniciando|ligando e desligando|desligando sozinh|desligado sozinh|nao (esta )?segurando/),
  R('adequacao', /\b350\b|incompativel|nao (era |e )?compativel|compativel com|nao suporta|suporta (a )?sua velocidade|nao (estava |esta |tava )?(chegando|batendo|entregando).{0,20}velocidade|wi-?fi 6|upgrade/),
  R('travado', /travad|travando|travamento/),
  R('queimado', /queim/),
  R('defeito', /defeito|sem funcionamento|acoplador|nao navega|nao estava navegando|terminal sem navegacao|piscando|pon vermelho|luz do ponto vermelha|\blos\b|sumindo|problema no (equipamento|sinal)|com problema|nao abre as portas|nao esta funcionando|nao sincroniz|mal contato|nao funcionava|quebrad/),
  R('falha_anterior', /nao trocou antes|nao verificou|tecnico anterior/),
  R('sem_validacao', /sem validacao|nao validou|nao justificou|sem explicacao/),
];

const MOTIVO_POR_ID = new Map([...MOTIVOS.map((m) => [m.id, m]), ['sem_info', MOTIVO_SEM_INFO]]);
export const motivoPorId = (id) => MOTIVO_POR_ID.get(id);

export function classificarTexto(txt) {
  const t = textoNorm(txt);
  if (!t) return null;
  const regra = REGRAS.find((r) => r.re.test(t));
  return regra ? MOTIVO_POR_ID.get(regra.motivo) : null;
}

/** Motivo de uma visita: observação -> SUBFALHA -> CAUSA -> sem informação. */
export function classificarVisita(r) {
  for (const [fonte, txt] of [['obs', r.obs], ['subfalha', r.subfalha], ['causa', r.causa]]) {
    const m = classificarTexto(txt);
    if (m) return { motivo: m, fonte };
  }
  return { motivo: MOTIVO_SEM_INFO, fonte: 'nenhuma' };
}

/** Sinais de qualidade de apontamento, procurados na observação. */
export const FLAGS = {
  baixa_errada: { rotulo: 'Indício de código de baixa errado', re: /baixou errado|baixa errada|cod(igo)? errado|errou a baixa|veio incorreta/ },
  sem_validacao: { rotulo: 'VT sem validação / justificativa', re: /sem validacao|nao validou|nao justificou/ },
};
