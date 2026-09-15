# Changelog

## 1.4.0 — Comandos CST baseados nas capturas LG

- Ventilação Força (7), com temperatura de 18 °C em refrigeração.
- Comandos de modo, ventilação e temperatura no formato capturado no LG ThinQ.
- Posições coletivas das aletas Padr./1–6 e Circular pelo campo correto do CST.
- Entidade Fluxo de ar com os seis modos automáticos observados.
- Removida a interpretação RAC de oscilação horizontal/vertical neste modelo.
- Monitor interpreta aletas coletivas, Força e fluxos CST.
- Testes com 31 pares de referência de comandos/respostas, incluindo CRC.
- Sem controle individual das aletas. Validação física final pelo HA pendente.

## 1.3.0 — Diagnóstico com origem HA / LG

- Monitor distingue HA, LG ThinQ, diagnóstico manual e serviço local.
- Resumos de TLV com CRC válido e comparação dos últimos comandos HA/LG e estado observado.
- Comandos da nuvem continuam sendo encaminhados ao aparelho; atribuição não altera os pacotes.
- Ativar bridge reutiliza cadastro local salvo quando disponível; novo cadastro exige confirmação explícita e Ingress autenticado.
- Logout encerra as conexões do bridge e impede reconexão automática sem credenciais.
- Build, 14 testes direcionados e testes de interface desktop/celular passaram.
- Operação com a conta LG e comparação física precisam de validação no ambiente do usuário.

## 1.2.1 — Correção de ligar pelo Home Assistant

- CST: liga com o pacote dedicado de alimentação, validado fisicamente no AMNW24GTBA0.
- Ao sair de desligado para o mesmo modo salvo, envia apenas o comando de ligar.
- Ao escolher outro modo, envia a configuração de modo seguida do comando explícito de ligar.
- Estado mostrado continua dependendo do retorno do aparelho.
- Build e 10 testes CST/nomes/cômodos passaram; outros modos e extras permanecem experimentais.

## 1.2.0 — Suporte experimental CST_570004_WW

- Driver específico para AMNW24GTBA0 baseado no RAC_056905_WW, mantendo os demais modelos.
- Inicialização a partir dos cinco campos de estado observados nas capturas reais.
- Ventilação 1, 2, 4, 6 e auto, conforme controle AKB75735404 / PWLSSB21H.
- Comandos de ligar/desligar, temperatura e modos padrão RAC.
- Swing vertical/horizontal, Jet, purificação, economia e temporizadores condicionados às capacidades anunciadas pelo aparelho.
- Não aplica sondagem de filtro nem calibração de potência específica do RAC ao CST.
- 3 testes CST, 6 testes de nomes/cômodos e 27 testes RAC/TLV passaram; build do aplicativo passou.
- Capturas validam leitura; comandos de saída foram testados em simulação, ainda pendentes de validação no aparelho real.

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
