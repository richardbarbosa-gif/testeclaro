# Ofensores de Visita Técnica · DDD 18

Painel interno que transforma a planilha mensal de visitas técnicas em respostas diretas:

- **Quais códigos de baixa mais ofenderam** (ranking com % e acumulado; com a base de assinantes, taxa de VT e p.p.)
- **Por que cada código ofendeu** — motivo raiz extraído da observação do técnico (566, 589, 584, 203 em destaque; qualquer código sob demanda)
- **Causa raiz consolidada** — ex.: "troca de poste" somando drop, conector NAP e rede externa
- **Impacto por área**, com a área mais impactada em cada código
- **Reincidência** — endereços e NAPs com mais de uma visita, com a sequência de códigos
- **Qualidade do apontamento** — baixas com indício de código errado, VT sem validação
- **Comparativo mensal** — o que mais subiu e mais caiu (liga automaticamente a partir do 2º mês)
- **Base de visitas** com busca e exportação CSV

Os dados ficam **criptografados (AES-256-GCM)**; o painel pede senha e descriptografa no navegador.
Nenhum dado de cliente é versionado neste repositório.

Documentação técnica, fluxo mensal e deploy: veja [`CLAUDE.md`](CLAUDE.md).
