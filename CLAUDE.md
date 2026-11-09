# Ofensores de Visita Técnica · Claro (DDD 14 e DDD 18)

Painel interno que mostra **quais códigos de baixa mais ofenderam** nas visitas técnicas (VT),
**por quê** (motivo raiz lido da observação do técnico), **o que está relacionado** (causas agrupadas
entre códigos), **onde** (cidade/área, com leitura automática por cidade), **reincidência** e o
**comparativo mês a mês**. Um painel por DDD (abas DDD 18 / DDD 14).
Público: o Richard (dono do projeto, trabalha na Claro) e o chefe dele — tem que ser claro,
profissional e "encantar", no computador e no celular. Idioma de tudo: **português do Brasil**.

## ⚠️ Segurança — leia antes de qualquer coisa

- **O repositório GitHub é PÚBLICO.** As planilhas têm endereço e número de contrato de cliente.
- **NUNCA commitar** `.xlsx`, `.csv`, `dados/`, JSON em texto puro **nem `site/data/`** (gitignore).
  Os `.bin` cifrados ficam **só na Hostinger** (senha atual é fraca/temporária; cifrado com senha
  fraca em repo público seria quebrável para sempre). O `.bin` do 1º commit usa uma senha forte antiga — inofensivo.
- **Acesso = login + senha.** Chave AES = PBKDF2(`login minúsculo` + `\n` + `senha`, 600k). Sem servidor:
  credencial errada simplesmente não descriptografa. Login: e-mail corporativo do Richard;
  **a senha não fica no repositório** — peça ao usuário. `publicar.py` recusa credencial diferente da já publicada.
- Senha atual **temporária e fraca** (pedido do usuário). Lembre-o de trocar (`--trocar-senha`).
- Texto vindo dos dados entra no DOM só via `textContent` (função `h()` em `app.js`). Nunca `innerHTML`.
- CSP restritiva (só `'self'`): **nada de CDN**. Fonte Plus Jakarta Sans é auto-hospedada (`assets/fonts`, OFL).

## Estrutura

```
scripts/processar.py   planilha .xlsx (TODAS as abas válidas) -> dados/processado/<DDD>-<AAAA-MM>.json
scripts/publicar.py    dados/processado -> site/data/<DDD>-<AAAA-MM>.bin + site/data/meses.json (cifra)
site/                  vai inteiro para a Hostinger (estático, sem build)
  index.html           login + casca (menu lateral, cabeçalho, filtros/gaveta, abas do celular)
  assets/js/regras.js  ⭐ REGRAS DE NEGÓCIO: regras->motivos->eixos->natureza, famílias, códigos, áreas, NAP
  assets/js/app.js     rotas, filtros, 7 telas, insights, gráficos (HTML/CSS/SVG, sem bibliotecas)
  assets/js/cripto.js  WebCrypto: PBKDF2 -> AES-GCM, gunzip
  assets/css/app.css   tokens da marca (vermelho #E30613, grafite), layout, celular, impressão
  assets/fonts/        plus-jakarta-sans.woff2 + licença OFL
  data/                (não versionado) meses.json + .bin cifrados
```

## Telas e navegação

Rota completa no endereço: `#/<ddd>/<tela>?mes=&area=&parc=&cod=&mot=&eixo=&flag=` (só parâmetros não vazios;
o mês mais recente não vai na URL). **Todo clique de aprofundamento usa `ir({...})`** — vira um passo no
histórico. O botão **← Voltar** (trilha no cabeçalho, `renderTrilha`) desfaz o último passo e **restaura a
rolagem** (`estado.posicoes`); o voltar/avançar do navegador funciona igual. A trilha mostra
"Vendo: Cidade … × · Código … ×" (× remove aquele filtro). Nunca altere `estado.area/codigo/...` direto: use `ir()`.

`geral` (hero com "Set → Out", KPIs com "era X em set", natureza, leitura executiva, top códigos/causas/cidades) ·
`codigos` (com código escolhido, a **página do código** abre no topo; depois ranking e destaques 566/589/584/203) ·
`causas` (natureza, **mapa de causas** treemap, cartões "tudo o que está relacionado", matriz causas × cidades) ·
`cidades` (com cidade escolhida, a **página da cidade** abre no topo: leitura completa, grupos, códigos, "o que mais mudou";
depois cartões das outras cidades, matriz códigos × cidades e CSV "resumo por cidade") ·
`reincidencia` (endereços, NAPs, qualidade do apontamento) ·
`comparativo` (resumo grande "Setembro 323 → Outubro 379 · ▲ 56 visitas a mais" + frase; listas "o que mais subiu /
caiu" com o motivo que puxou; indicadores "era X em set"; tabelas **Setembro | Outubro | Diferença** por código,
cidade e grupo de causa; evolução só com 3+ meses. Se o DDD atual tem 1 mês, o menu abre o DDD que tem 2+) ·
`base` (tabela/cartões, busca, CSV).
No celular (<1024px): barra vermelha com troca de DDD, filtros em gaveta, abas fixas (Geral, Códigos, Causas, Cidades, Mais).

## Fluxo mensal (ex.: chegaram as planilhas de novembro)

1. Salve a planilha **fora do repositório** e processe (uma aba por DDD/mês; DDD e mês detectados):
   ```bash
   python3 scripts/processar.py /caminho/planilha.xlsx                 # todas as abas
   python3 scripts/processar.py arq.xlsx --aba DDD14nov --base-total 16000 --base-regiao "AREA AVARE=5200"
   ```
   Confira o resumo e os avisos (linhas sem BX são ignoradas e avisadas — ex.: linha 150 de DDD14set).
2. **Numa sessão nova `site/data/` está vazio.** Para manter os meses já publicados, reprocesse as planilhas
   antigas (peça ao usuário) ou baixe `public_html/data/*` da Hostinger antes. Depois:
   ```bash
   DASH_LOGIN='richard.barbosa@claro.com.br' DASH_SENHA='...' python3 scripts/publicar.py
   ```
   `--extrair` devolve os JSON a partir dos `.bin`; `--trocar-senha` usa `NOVA_SENHA` (e `NOVO_LOGIN`).
3. Teste: `cd site && python3 -m http.server 8765`; Playwright/Chromium do ambiente; todas as telas nos dois
   DDDs, console sem erros, celular (iPhone 13) sem rolagem horizontal.
   Sintaxe: copie cada `.js` para `x.mjs` e rode `node --check x.mjs` (o `node --check` direto no `.js` não valida módulo).
4. Commit (código e docs) → push → deploy na Hostinger.

## Planilha de entrada

Uma aba por DDD/mês (ex.: `Planilha2` = DDD 18 out, `DDD14set`, `DDD14out`), 1ª linha = cabeçalho:
`Observação, FATO, CAUSA, SUBFALHA, AÇÃO, RX, barr (data/hora da baixa), Data da Agenda, REGIAO,
NUM_CONTRATO, FECHAMENTO, TIPO_ORD_SRV, LOG, BX, BX1..BX4, NAP, END_COMPLETO, PARCEIRA, DDD`.
Obrigatórias: `BX, REGIAO, Observação, Data da Agenda`. Aliases em `COLUNAS` (processar.py).

## Regras de negócio (`site/assets/js/regras.js`) — classificação roda no navegador

- **Código analisado = `BX`**. `BX1..BX4` = códigos das visitas anteriores; `LOG` = nº de visitas anteriores.
- **Motivo raiz**: `REGRAS` (regex em texto normalizado), **ordem = prioridade**; aplicadas na Observação →
  SUBFALHA → CAUSA → "Sem informação" (origem guardada em `fonteMotivo`). A observação vence a SUBFALHA
  de propósito (SUBFALHA vem mal apontada). Armadilhas já tratadas: "estourou um cano" = vazamento (não chuva);
  "após troca normalizado / atingindo o contratado" aparece depois de reparo (não é "sem defeito");
  "caminhão" = carga alta; "CPFL"/"equipe da energia" = concessionária; "AONET/Zaaz/outra operadora" = terceiros.
- Cobertura (out/26): DDD 18 440/441 pela observação; DDD 14 ~84–87% com motivo — o resto é observação
  vazia/sem causa (vira insight de qualidade, por parceira).
- **Eixos (causas relacionadas)** `EIXOS`: chuva/vento/umidade (inclui água e oxidação), carga alta, poste e
  concessionária, terceiros e vandalismo, poda, animais, energia, conectorização, equipamento, processo,
  cliente, dano sem causa citada, sem informação. **Natureza** `NATUREZAS`: externa (grafite), operação Claro
  (vermelho — o que a operação pode atacar), cliente (cinza), não identificada (cinza claro).
- **Família** (cor dos códigos, paleta validada p/ daltonismo): pela CAUSA; sem CAUSA → família predominante do código.
- `CODIGOS` (descrições inferidas — confirmar); código fora da lista usa a AÇÃO mais frequente.
- `AREAS`: nomes das áreas dos dois DDDs. NAP: `^GPON` = genérica; `napCanonica` unifica formatos.
- Insights (`insightsDDD`, `insightsCidade` em app.js): variação vs mês anterior e o que puxou, eixo
  sobre-representado na cidade vs média do DDD (lift ≥ 1,35), causa não identificada, reincidência, NAP crítica.

## Deploy — Hostinger (plano Business)

- Site: **https://palegoldenrod-shrew-176665.hostingersite.com** (domínio temporário deste projeto).
- `username`: via `hosting_websites_list` filtrando o domínio (não versionar).
- Este ambiente **não acessa** `*.hostingersite.com`: confirme com `hosting_files_list-website-and-directories`
  (tamanhos iguais aos locais) e peça ao usuário para abrir o link.
- Método: zip do **conteúdo** de `site/` (com `.htaccess`) → `hosting_files_generate-upload-url` (TUS) →
  `hosting_websites_deploy-static-site-archive` com `archive_path: "site.zip"`. Cada deploy substitui o site.

## Linguagem das comparações (pedido do usuário: "fácil de enxergar")

- Sempre explícito, com os dois meses: `comparacao(a, b, mesA, mesB)` → "Set 8 → Out 27 · ▲ subiu 19".
- Frases: "Subiu de 35 em setembro para 66 em outubro — o que mais cresceu foi …". Nomes de mês por extenso.
- Evite "+238%" (só mostre % quando faz sentido) e "p.p." (use "pts" no selo e "era X% em setembro" no texto).

## Pendências (confirmar com o Richard)

- **Trocar a senha temporária** por uma forte; considerar tornar o repositório privado.
- Base de assinantes por DDD (total e por área) — para taxa de VT e p.p.
- `AREA PRESIDENTE` (DDD 18) = Prudente, Venceslau ou Epitácio? Dicionário oficial dos códigos.
- DDD14set linha 150: só observação, demais colunas vazias — dado deslocado na planilha original.

## Convenções

- **Ao terminar qualquer mudança: atualize este CLAUDE.md, faça commit/push e publique na Hostinger** (pedido do usuário).
- Ao preencher um elemento com partes opcionais use `montar(el, ...)` (ignora null — `replaceChildren(null)` escreve "null" na tela).
- Código e textos em português; nomes de função/variável em português.
- Antes de publicar: sintaxe como `.mjs`, Chromium em todas as telas dos dois DDDs, console sem erros,
  nenhum "null/undefined/NaN" visível, celular (iPhone 13) sem rolagem horizontal.
- Commits pequenos e descritivos; nunca incluir dados de cliente.
