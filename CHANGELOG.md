# Changelog

## 1.1.1 — Monitoramento e navegação

- Botão Editar no painel e opções avançadas abaixo de Monitorar.
- Tela de monitoramento no tema Smart House, em português, com Voltar aos aparelhos.
- Navegação preserva o caminho do Ingress do Home Assistant.
- Rolagem automática opcional, limpeza e limite de 500 mensagens no monitor.
- Comandos de diagnóstico recolhidos; envio desabilitado ao perder a conexão.
- Opções avançadas permanecem abertas durante atualizações do painel.
- Build do aplicativo e testes de navegador passaram: navegação, comandos,
  mensagens, rolagem e telas de 320, 390, 768 e 1440 px.
- Build Docker e teste com aparelhos reais dependem da atualização no HA.

## 1.1.0 — Painel Smart House e cômodos

Status: **disponível para teste em instalação Home Assistant**.

- Painel responsivo escuro, ícone LG, estados dos serviços e ações por aparelho.
- Primeiro cadastro com nome e cômodo; renomeação e troca de cômodo posteriores.
- Listagem/criação de áreas reais do HA e associação do dispositivo MQTT.
- Persistência de associações pendentes e novas tentativas após MQTT Discovery.
- Preservação dos IDs de entidades existentes ao renomear e migração dos nomes 1.0.0.
- API de áreas disponível apenas pelo Ingress autenticado do Supervisor.
- Habilitação de `homeassistant_api`; token utilizado somente no backend.
- Atualização dos overrides e Dockerfile; `run.sh` e upstream congelado preservados.
- Testes de persistência, falhas, MQTT, áreas e bloqueio de acesso direto.

## 1.0.0 — Primeira versão pública

Status: **homologada para implantação**.

- Criação do Home Assistant Add-on Repository **LG_Local-Thing**, mantido por Smart House.
- Distribuição pública da base funcional homologada originalmente como build interna `1.0.8-local.3`.
- Organização dos arquivos do add-on em `lg_local_thing/`.
- Alteração somente dos campos de identidade pública `name`, `version`, `slug` e `url` no `config.yaml` homologado.
- Preservação byte a byte de `Dockerfile`, `run.sh` e dos quatro arquivos de override, com conferência SHA256 contra os valores homologados.
- Preservação das opções funcionais, portas, MQTT, hostname e demais parâmetros da build validada.
- Registro do upstream `anszom/rethink` e congelamento no commit `8f6d19ec9939f5f785bb1def3810540730e31bce`.
- Inclusão da licença GNU GPL v2 do upstream e da atribuição ao ReThink.
- Inclusão de exclusões para segredos, dados locais, certificados privados e backups.
- Validação de instalação limpa em um segundo Home Assistant OS diretamente pelo repositório GitHub.
- Validação de inicialização do LG Local Thing e conexão MQTT.
- Validação de DNS local com AdGuard Home usando reescritas para `common.lgthinq.com` e `rethink.lgthinq.com`.
- Validação do DNS entregue aos clientes pela LAN/DHCP do roteador.
- Validação de provisionamento de aparelhos LG e publicação das entidades no Home Assistant via MQTT Discovery.
- Inclusão de manual completo de implantação em `docs/Manual_Implantacao_LG_Local-Thing_1.0.0_COMPLETO.pdf`.
- Expansão do `README.md` com roteiro de implantação, preparação do Windows/PowerShell, provisionamento por aparelho, validações e exemplo de configuração de DNS em rede UniFi.

### Base técnica

A versão 1.0.0 utiliza o upstream ReThink congelado no commit:

`8f6d19ec9939f5f785bb1def3810540730e31bce`

A distribuição foi testada em uma implantação externa com Home Assistant OS, Mosquitto MQTT Broker, AdGuard Home, DNS local e aparelhos LG conectados ao servidor local.
