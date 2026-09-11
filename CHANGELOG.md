# Changelog

## 1.0.0 — Primeira versão pública

Status: publicação em preparação.

- Criação do Home Assistant Add-on Repository LG_Local-Thing,
  mantido por Smart House.
- Distribuição da base funcional homologada como build interna
  1.0.8-local.3.
- Organização dos arquivos do add-on em `lg_local_thing/`.
- Alteração exclusiva dos campos `name`, `version`, `slug` e `url`
  no config.yaml para a identidade pública.
- Preservação byte a byte de Dockerfile, run.sh e dos quatro overrides,
  com conferência SHA256 contra os valores homologados.
- Preservação das opções funcionais, portas, MQTT e hostname originais.
- Registro do upstream anszom/rethink e do commit congelado
  `8f6d19ec9939f5f785bb1def3810540730e31bce`.
- Inclusão da licença GNU GPL v2 do upstream e da atribuição ao ReThink.
- Inclusão de exclusões para segredos, dados locais e backups.

A preparação desta distribuição não incluiu alterações no código
homologado nem uma nova homologação funcional.
