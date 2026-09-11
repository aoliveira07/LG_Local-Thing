# LG_Local-Thing

Home Assistant Add-on Repository mantido por **Smart House**, derivado do
[ReThink](https://github.com/anszom/rethink).

## Versão 1.0.0

A **1.0.0 é a primeira versão pública do LG_Local-Thing**. Sua publicação
está em preparação. A base funcional foi homologada originalmente como
build interna **1.0.8-local.3** e exportada da instalação Home Assistant.

Os seis arquivos funcionais preservados foram conferidos por SHA256 contra
os valores fornecidos na homologação, sem alteração de conteúdo.

## Origem e modificações

- Upstream: https://github.com/anszom/rethink
- Commit upstream congelado: `8f6d19ec9939f5f785bb1def3810540730e31bce`.
- Autoria do projeto original: autores e colaboradores do ReThink.
- Manutenção desta distribuição: **Smart House**.

A base interna inclui inicialização com opções do Home Assistant e
customizações locais em `cloud/homeassistant.ts`, `management/index.ts`,
`html/panel.js` e `util/friendly-names.ts`, relacionadas à integração
Home Assistant/MQTT, ao painel de gerenciamento e aos nomes amigáveis
persistentes. Esses arquivos são provenientes do pacote homologado.

Para esta distribuição pública:
- Os arquivos do add-on foram organizados em `lg_local_thing/`.
- Somente `name`, `version`, `slug` e `url` foram alterados no
  `config.yaml` homologado.
- Foram adicionados os metadados do repositório, esta documentação,
  o changelog, as exclusões do Git e a licença do upstream.
- `Dockerfile`, `run.sh` e os quatro overrides foram preservados
  byte a byte.

As opções funcionais, portas, MQTT, hostname e demais configurações
originais foram mantidos. Não foi realizada nova homologação funcional
durante esta preparação documental.

## Estrutura

- `repository.yaml`: identificação do repositório de add-ons.
- `lg_local_thing/config.yaml`: configuração pública do add-on.
- `lg_local_thing/Dockerfile`: construção com o commit upstream congelado.
- `lg_local_thing/run.sh`: inicialização homologada.
- `lg_local_thing/overrides/`: quatro arquivos homologados de customização.
- `CHANGELOG.md`: histórico da distribuição pública.
- `COPYING`: licença GNU GPL v2 integral do upstream.
- `.gitignore`: exclusões de segredos, dados de execução e backups.

## Dados locais

As credenciais MQTT devem ser configuradas nas opções do add-on no
Home Assistant. Os valores padrão de usuário e senha permanecem vazios.

Chaves privadas, certificados, credenciais MQTT ou Wi-Fi, tokens, backups
e dados específicos de cliente não fazem parte desta distribuição.
Arquivos de execução como `options.json`, `config.json`,
`friendly-names.json` e o diretório `state/` não devem ser versionados.

As referências a caminhos em `/data/` nos scripts são necessárias ao
funcionamento; os arquivos de dados e segredos desses caminhos não estão
incluídos no repositório.

## Licença

Este projeto preserva a **GNU General Public License, versão 2 (GPL v2)**,
utilizada pelo ReThink. O texto integral em [COPYING](COPYING) foi obtido
do upstream no commit congelado indicado acima.

Os créditos e avisos de autoria e licença do ReThink e de seus
colaboradores são preservados. Esta distribuição é derivada do ReThink.

## Repositório

https://github.com/aoliveira07/LG_Local-Thing
