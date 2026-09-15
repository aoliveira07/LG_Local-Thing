# Changelog

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
