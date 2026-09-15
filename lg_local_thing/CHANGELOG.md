# Changelog

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

## 1.0.0

Primeira distribuição pública da build interna homologada 1.0.8-local.3.
