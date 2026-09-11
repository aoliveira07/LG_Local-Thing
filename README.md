# LG_Local-Thing

Home Assistant Add-on Repository mantido por **Smart House**, derivado do
[ReThink](https://github.com/anszom/rethink).

## 📘 Manual de implantação

Para instalar o projeto em um novo cliente, use o manual completo:

**[Baixar / abrir o Manual de Implantação LG_Local-Thing 1.0.0 (PDF)](docs/Manual_Implantacao_LG_Local-Thing_1.0.0_COMPLETO.pdf)**

O manual contém o processo completo com capturas de tela:

1. Instalação do **LG_Local-Thing** no Home Assistant OS pelo repositório GitHub.
2. Instalação e configuração do **Mosquitto MQTT Broker**.
3. Configuração do MQTT no LG_Local-Thing.
4. Instalação e configuração do **AdGuard Home**.
5. Criação das reescritas DNS:
   - `common.lgthinq.com` → IP do Home Assistant
   - `rethink.lgthinq.com` → IP do Home Assistant
6. Configuração do DHCP/DNS no roteador do cliente.
7. Preparação de um notebook Windows com **Git**, **Node.js** e dependências do ReThink.
8. Provisionamento dos aparelhos LG pelo PowerShell.
9. Validação final no ReThink, MQTT, Home Assistant e AdGuard.

### Instalação rápida do add-on

No Home Assistant, abra a loja de aplicativos/complementos e adicione este repositório:

```text
https://github.com/aoliveira07/LG_Local-Thing
```

Depois instale **LG Local Thing** e configure o MQTT.

### Provisionamento dos aparelhos LG

No notebook Windows, com o repositório upstream preparado, o provisionamento é executado em PowerShell:

```powershell
Set-Location "$env:USERPROFILE\SmartHouse\rethink"

$WIFI_SSID = Read-Host "Digite o nome da rede Wi-Fi"
$PASS = Read-Host "Digite a senha do Wi-Fi"

npx.cmd tsx .\rethink-setup.ts 192.168.120.254 "$WIFI_SSID" "$PASS"
```

O endereço `192.168.120.254` é o endereço padrão usado pelo aparelho LG durante o provisionamento. Diagnostique outro IP somente se o procedimento apresentar erro de conexão.

> **Importante:** não publique senhas Wi-Fi, credenciais MQTT, tokens, chaves privadas, certificados privados ou dados específicos de clientes no repositório.

## Versão 1.0.0

A **1.0.0 é a primeira versão pública do LG_Local-Thing**. A base funcional foi
homologada originalmente como build interna **1.0.8-local.3**, exportada da
instalação Home Assistant e posteriormente validada em uma segunda instalação
Home Assistant OS com MQTT, AdGuard Home, DNS local e múltiplos aparelhos LG.

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
originais foram mantidos.

## Estrutura

- `repository.yaml`: identificação do repositório de add-ons.
- `lg_local_thing/config.yaml`: configuração pública do add-on.
- `lg_local_thing/Dockerfile`: construção com o commit upstream congelado.
- `lg_local_thing/run.sh`: inicialização homologada.
- `lg_local_thing/overrides/`: quatro arquivos homologados de customização.
- `docs/`: documentação de implantação.
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
