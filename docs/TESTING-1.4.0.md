# Validação da versão 1.4.0

Modelo: AMNW24GTBA0 / CST_570004_WW. Referência: comandos enviados pelo
aplicativo LG ThinQ e respostas do aparelho, capturados em 15/09/2026.
Os dados de teste contêm somente ações e pacotes do protocolo, sem cadastro,
conta, endereço de rede ou identificador do aparelho.

## Escopo

31 comandos de referência cobrem temperatura, ventilação, modos, fluxos e
posições coletivas das aletas. O teste compara o pacote completo gerado,
incluindo cabeçalho, ordem dos TLVs e CRC, com a captura independente.
Os campos de configuração mantidos são inicializados conforme a referência;
não se pressupõe que o HA replique a memória de temperatura por modo do ThinQ.

| Controle | Campos observados |
| --- | --- |
| Modo | 0x1f9: refrigerar 0, desumidificar 1, ventilar 2, aquecer 4, automático 6 |
| Ventilação | 0x1fa: 1, 2, 4, 6, Força 7, auto 8 |
| Temperatura ajustada | 0x1fe: temperatura em °C multiplicada por 2 |
| Circular | 0x205: 0/1 |
| Indireto / Direto | 0x28e / 0x28f: 1 ativa |
| Smart / Atualização | 0x290 / 0x291: 1 ativa |
| Agitar | 0x325: 0/1 |
| Aletas juntas | 0x321: 0=Padr.; 0x1111 até 0x6666=posições 1–6 |

Força foi capturado em refrigeração com 18 °C; outros modos são bloqueados
para essa seleção. Saindo de Força para auto, o ajuste de 18 °C é mantido.
O firmware alterou temperatura/velocidade ao ativar Modo de atualização;
o driver aguarda o retorno, sem impor essa alteração aos demais cenários.
Desativar indireto/direto/Smart/Atualização com zero é uma extensão do campo
binário, ainda sem captura específica de desligamento de cada um.

As aletas individuais e oscilação horizontal estão fora do escopo solicitado.
Recursos opcionais herdados do RAC e os extremos da faixa 18–30 °C não foram
homologados por esta sessão. As temperaturas observadas são 18/19/20/22/23 °C.

## Execução dos testes

Sobre o upstream congelado em
`8f6d19ec9939f5f785bb1def3810540730e31bce`, aplique os overrides conforme o
Dockerfile, execute `npm ci` e `npm run build`. Em seguida, a partir deste
repositório, aponte `RETHINK_BUILD_DIR` para o diretório `dist` compilado e rode:

```sh
node --test tests/*.mjs tests/*.cjs
```

Há verificações de pacotes/CRC, ausência de publicação otimista dos novos
controles, descoberta tardia, preservação de identidade MQTT, rejeição de
entradas inválidas e regressões de cômodos, bridge e decodificador do monitor.
Ligar mantém o comando dedicado previamente testado no equipamento.

Compilação local não equivale a build da imagem Docker. A imagem é reconstruída
pelo Supervisor ao atualizar o add-on. Os testes de protocolo não substituem
a confirmação física final dos controles enviados pelo HA após a atualização.
