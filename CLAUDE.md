# Ofensores de Visita Técnica · DDD 18 (Claro)

Dashboard interno que mostra **quais códigos de baixa mais ofenderam** nas visitas técnicas (VT)
do DDD 18, **por quê** (motivo raiz lido da observação do técnico), **onde** (área/cidade),
**reincidência** (endereço/NAP com várias visitas) e o **comparativo mês a mês**.
Público: o Richard (dono do projeto, trabalha na Claro) e o chefe dele — tem que ser claro,
profissional e intuitivo. Idioma de tudo: **português do Brasil**.

## ⚠️ Segurança — leia antes de qualquer coisa

- **O repositório GitHub é PÚBLICO.** A planilha tem endereço completo e número de contrato de cliente.
- **NUNCA commitar** `.xlsx`, `.csv`, `dados/` ou JSON em texto puro. O `.gitignore` já bloqueia; não force.
- **`site/data/` também NÃO é versionado** (gitignore): os `.bin` cifrados ficam **só na Hostinger**.
  Motivo: a credencial atual é fraca e temporária; arquivo cifrado com senha fraca num repo público
  seria quebrável para sempre (o histórico do git não esquece). Na Hostinger ele é substituível.
  (O `.bin` que ficou no 1º commit foi cifrado com uma senha forte antiga, já descartada — inofensivo.)
- **Acesso = login + senha.** A chave AES vem de PBKDF2(`login minúsculo` + `\n` + `senha`). Não há servidor:
  login/senha errados simplesmente não descriptografam. Login atual: e-mail corporativo do Richard;
  **a senha não fica no repositório** — peça ao usuário. O `publicar.py` valida a credencial contra os
  meses já publicados (recusa credencial diferente, para não quebrar o site).
- A senha atual é **temporária e fraca** (pedido do usuário, só para apresentar). Lembre-o de trocar
  por uma forte (`--trocar-senha`) assim que possível.
- Toda string vinda dos dados entra no DOM via `textContent` (função `h()` em `app.js`). Nunca `innerHTML`.
- CSP restritiva (só `'self'`): **não adicione CDN/fontes externas** sem ajustar `index.html` e `site/.htaccess`.

## Estrutura

```
CLAUDE.md                  este arquivo
scripts/processar.py       planilha .xlsx  -> dados/processado/AAAA-MM.json (texto puro, fora do git)
scripts/publicar.py        dados/processado -> site/data/AAAA-MM.bin + site/data/meses.json (criptografa)
site/                      o que vai para a Hostinger (estático, sem build)
  index.html               login + esqueleto das seções
  .htaccess  robots.txt    HTTPS, headers de segurança, noindex, cache
  assets/css/app.css       tokens da marca (vermelho Claro #E30613), layout, impressão
  assets/js/regras.js      ⭐ REGRAS DE NEGÓCIO (motivos, famílias, códigos, áreas, NAP)
  assets/js/app.js         carga, filtros, todas as seções (sem dependências)
  assets/js/cripto.js      WebCrypto: PBKDF2 -> AES-GCM, gunzip
  assets/img/              logos (branco/vermelho com alpha), raios.svg (marca d'água), campanha
  data/meses.json          manifesto (lista de meses + salt/iterações do KDF)   ┐ NÃO versionados:
  data/AAAA-MM.bin         dados do mês criptografados                         ┘ gerados e enviados à Hostinger
```

Sem framework e sem build: HTML/CSS/JS puro (ES modules). Gráficos são HTML/CSS (barras, heatmap,
barras empilhadas, colunas). Python 3 + `openpyxl` + `cryptography` para os scripts.

## Fluxo mensal (ex.: chegou a planilha de novembro)

1. Salve a planilha **fora do repositório** (ex.: scratchpad) e processe:
   ```bash
   python3 scripts/processar.py /caminho/planilha-novembro.xlsx            # mês detectado pela Data da Agenda
   python3 scripts/processar.py arq.xlsx --mes 2026-11 --base-total 16000 \
       --base-regiao "AREA BIRIGUI=5200" --base-regiao "AREA ANDRADINA=4100"
   ```
   Confira no resumo impresso: nº de visitas, top códigos e avisos (colunas ignoradas, meses fora).
2. Publique (pede login/senha; ou variáveis de ambiente):
   ```bash
   DASH_LOGIN='richard.barbosa@claro.com.br' DASH_SENHA='...' python3 scripts/publicar.py
   ```
   Numa sessão nova `site/data/` estará vazio (não versionado): para manter os meses anteriores,
   processe também as planilhas deles (peça ao usuário) ou baixe os `.bin`/`meses.json` do
   `public_html/data` da Hostinger antes de publicar. Senão o deploy publica só o mês novo.
   Só os meses presentes em `dados/processado/` são (re)cifrados; os demais `.bin` ficam intactos.
   Reprocessar um mês sem a planilha: `--extrair` devolve o JSON puro para `dados/processado/`.
   Trocar credencial: `--trocar-senha` (usa `NOVA_SENHA` e, opcional, `NOVO_LOGIN`).
3. Teste local: `cd site && python3 -m http.server 8765` e abra `http://127.0.0.1:8765`
   (Playwright/Chromium já existem no ambiente; confira console sem erros e a seção Comparativo).
4. Commit (código e docs; `site/data/` fica fora) → push → deploy na Hostinger (abaixo).

O **comparativo** liga sozinho quando houver 2+ meses em `meses.json`. A **base de assinantes**
pode vir no processamento (`--base-total`, `--base-regiao`) ou ser digitada no filtro do painel
(fica só naquele navegador). Com base: taxa de VT (%) e contribuição de cada código em p.p.

## Planilha de entrada (aba única, 1ª linha = cabeçalho)

Colunas reconhecidas por nome (sem acento/maiúscula; aliases em `COLUNAS` no `processar.py`):
`Observação, FATO, CAUSA, SUBFALHA, AÇÃO, RX, barr (data/hora da baixa), Data da Agenda, REGIAO,
NUM_CONTRATO, FECHAMENTO, TIPO_ORD_SRV, LOG, BX, BX1..BX4, NAP, END_COMPLETO, PARCEIRA, DDD`.
Obrigatórias: `BX, REGIAO, Observação, Data da Agenda`. Ignoradas hoje: `Validação On line`, `ULT BX` (vazias).

## Regras de negócio (todas em `site/assets/js/regras.js`)

A classificação roda **no navegador**: mudou regra → só republicar o site; todos os meses são reclassificados.

- **Código de baixa analisado = coluna `BX`** (código principal). `BX1..BX4` = códigos das visitas anteriores.
- **Motivo raiz**: lista `MOTIVOS`, regex sobre o texto normalizado; **a ordem é a prioridade**
  (ex.: "queimado após queda de energia depois de raio" → Raio; "oxidado, cheio de água" → Água).
  1º tenta a **Observação**, depois a **SUBFALHA**, senão "Sem informação". Em out/2026: 440/441 pela observação.
  A observação vence a SUBFALHA de propósito: a SUBFALHA vem mal apontada (ex.: 589 com SUBFALHA
  "Vandalismo" cuja observação diz "danificado após troca de poste").
- **Grupos de causa** (`GRUPOS`): agentes externos, clima e energia, rede e conectorização, cliente,
  equipamento, processo, sem informação.
- **Família da visita** (`familiaDaVisita`, pela CAUSA; FATO=Improdutiva tem prioridade): drop,
  conector NAP, conector interno, rede externa (203), equipamento, outros. Cor do código = família predominante.
  Paleta validada para daltonismo (skill dataviz) — não troque cores sem revalidar.
- **Códigos em destaque** (cards fixos): `CODIGOS_DESTAQUE = [566, 589, 584, 203]`.
- **Dicionário de códigos** (`CODIGOS`): descrições **inferidas** da base (confirmar com o oficial).
- **Áreas** (`AREAS`): "AREA X" → nome de exibição.
- **NAP**: `GPONA01` (e `^GPON`) = genérica, fora dos rankings. Formatos são unificados por `napCanonica`
  (`VLB.XX.052.01.05` = `VLB0520105`; `VLB370405` → `VLB0370405`).
- **Reincidência**: `LOG ≥ 1` (= nº de visitas anteriores do contrato); endereço = REGIAO + END_COMPLETO normalizado.
- **Flags de qualidade** (`FLAGS`): indício de código errado ("baixou errado", "baixa errada"…), VT sem validação.

## Deploy — Hostinger (plano Business)

- Site: **https://palegoldenrod-shrew-176665.hostingersite.com** (domínio temporário, criado para este projeto).
- `username` da conta: obtenha com `hosting_websites_list` filtrando por esse domínio (não versionar — repo público).
- O ambiente de nuvem do Claude Code **não acessa** `*.hostingersite.com` (rede limitada); confirme o deploy
  com `hosting_files_list-website-and-directories` e peça ao usuário para abrir o link.
- Método: zip do **conteúdo** de `site/` (index.html na raiz do zip, incluindo `.htaccess`) →
  upload TUS (`hosting_files_generate-upload-url`) → `hosting_websites_deploy-static-site-archive`
  com `archive_path: "site.zip"`. Detalhes na skill `hostinger:deploy-to-hosting`.
  ```bash
  cd site && zip -r ../ofensores_$(date +%Y%m%d_%H%M%S).zip . -x '*.DS_Store' && cd ..
  ```
- Verificar depois: `curl -sI https://DOMINIO/ | grep -i x-robots` e abrir o site (login com a senha).
- Cada deploy substitui todo o conteúdo do site.

## Pendências / perguntas em aberto (confirmar com o Richard)

- **Trocar a senha temporária** por uma forte (12+ caracteres) — `publicar.py --trocar-senha` + deploy.
- Repositório público: sugerido ao usuário torná-lo privado (GitHub → Settings → Danger Zone).

- Base de assinantes do DDD 18 (total e, se possível, por área) — virá depois (precisa de VPN).
- `AREA PRESIDENTE` = Presidente Prudente, Venceslau ou Epitácio?
- Dicionário oficial dos códigos (ex.: diferença entre 584 e 540/541/542, todos "conector interno").
- Confirmar leitura de `LOG` (visitas anteriores) e `BX1..BX4` (códigos dessas visitas).
- Total de VTs considera todas as linhas da planilha (todas vieram `FECHAMENTO = EXECUTADO`).

## Convenções

- Código e textos em português; nomes de função/variável em português (`renderResumo`, `filtrar`…).
- Antes de publicar: `node --check site/assets/js/*.js`, abrir no Chromium, console sem erros,
  checar desktop (1440px) e celular (iPhone 13) sem rolagem horizontal.
- Commits pequenos e descritivos; nunca incluir dados de cliente.
