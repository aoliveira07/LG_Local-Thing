# Validação 1.1.0

## Verificações realizadas

- Build do aplicativo (`npm run build`) com o upstream congelado e os overrides: passou.
- Seis testes específicos em `tests/rooms.test.mjs`: passaram. Cobrem migração
  dos nomes 1.0.0, IDs estáveis, escrita atômica, MQTT Discovery, autenticação
  WebSocket, listagem/criação/remoção de associação e bloqueio de acesso direto.
- Interface exercitada em navegador Chromium/Edge, em desktop e celular:
  primeiro nome vazio, criação de cômodo, renomeação, atualização ao vivo durante
  edição, erro ao salvar e HA indisponível. Sem erros JavaScript ou rolagem
  horizontal no viewport de 390 px.
- Duas falhas nos testes gerais também foram reproduzidas no código original
  do upstream neste Windows/Node 24: expectativa de SIGTERM em `bridge/util`
  e contagem imediata de listeners após fechar o cliente WebSocket em
  `management/device-monitor`. Não foram consideradas testes aprovados.
- Resultado geral: 500 de 504 testes passaram. Além das duas falhas acima,
  dois testes de `util/lgcloud/state` pressupõem `/tmp` e falharam pela ausência
  desse diretório neste Windows. O arquivo testado não foi alterado.
- Sem execução Docker local: Docker/WSL não estão disponíveis neste ambiente.
  O Dockerfile utiliza Node 20 Alpine; a construção final ocorre no Supervisor.

## Reproduzir os testes específicos

Em ambiente Linux, use duas pastas separadas. No checkout deste repositório,
execute (o clone deve apontar para uma pasta ainda inexistente):

```sh
git clone https://github.com/anszom/rethink ../rethink-test
git -C ../rethink-test checkout --detach 8f6d19ec9939f5f785bb1def3810540730e31bce
cp -R lg_local_thing/overrides/. ../rethink-test/
(cd ../rethink-test && npm ci && npm run build)
RETHINK_BUILD_DIR="$(realpath ../rethink-test/dist)" node --test tests/rooms.test.mjs
docker build -t lg-local-thing:1.1.0 ./lg_local_thing
```

## Teste na instalação Home Assistant

1. Atualize o add-on para 1.1.0 e confira o término do build e os logs de MQTT.
2. Abra Interface Web pelo HA. Confira os nomes existentes e os estados.
3. Em um aparelho novo, use Configurar aparelho: o nome começa vazio.
4. Salve um nome e selecione um cômodo existente. Confira em
   Configurações → Dispositivos e serviços → MQTT se o dispositivo está na área.
5. Em Renomear / cômodo, crie outro cômodo e confira a área no HA.
6. Compare os IDs das entidades antes/depois de renomear. Devem permanecer iguais.
7. Reinicie o add-on e confira a persistência de nomes e associações.
8. Confira um comando real e o retorno de estado do aparelho pelo HA.

A associação pode aguardar MQTT Discovery; a tentativa é repetida a cada
30 segundos. Se continuar pendente, confira se o aparelho possui mapeamento
suportado e se o dispositivo foi descoberto na integração MQTT. A alteração
atua no cômodo do dispositivo; áreas individuais de entidades são mantidas.

Esta versão ainda depende dessa validação com o ambiente e os aparelhos reais.
