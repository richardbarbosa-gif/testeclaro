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

## Telas (rota `#/<ddd>/<tela>`)

`geral` (hero, KPIs, natureza das causas, leitura executiva, top códigos/causas/cidades) ·
`codigos` (ranking, motivos por código; destaques 566/589/584/203) ·
`causas` (natureza, **mapa de causas** treemap, cartões "tudo o que está relacionado", matriz causas × cidades) ·
`cidades` (cartão por cidade com insights vs média do DDD e mês anterior; matriz códigos × cidades; CSV "resumo por cidade") ·
`reincidencia` (endereços, NAPs, qualidade do apontamento) ·
`comparativo` (maior alta / maior queda, gráfico divergente, antes × depois, causas, motivos, cidades, evolução;
se o DDD atual tem 1 mês, o menu abre o comparativo do DDD que tem 2+) · `base` (tabela/cartões, busca, CSV).
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

## Pendências (confirmar com o Richard)

- **Trocar a senha temporária** por uma forte; considerar tornar o repositório privado.
- Base de assinantes por DDD (total e por área) — para taxa de VT e p.p.
- `AREA PRESIDENTE` (DDD 18) = Prudente, Venceslau ou Epitácio? Dicionário oficial dos códigos.
- DDD14set linha 150: só observação, demais colunas vazias — dado deslocado na planilha original.
