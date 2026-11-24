# Estado da implementação

Versão jogável inicial, não conclusão integral da especificação V10.

## Implementado e verificado

- Biblioteca: 694 arquivos conferidos por SHA-256; 80 variantes presentes. Main preservada.
- Terreno contínuo, lago central, vila norte, fazenda nordeste, torre leste, montanhas sul; floresta, vegetação instanciada e materiais autorizados.
- Rapier: cápsula, gravidade, salto, degraus, colisão com construções e recuperação de queda. Percurso físico até a nascente e subida da escada da torre verificados.
- Seis classes selecionáveis; clips Idle, Walk e ataque existentes nos seis modelos. Movimento e combate executados com Guerreiro; renderização e combate das demais classes ainda requerem revisão individual.
- Diálogo inicial com recompensa, coleta, compra/venda, combate e loot, inventário, receita, equipamento com modificador de dano e progressão por XP.
- Pesca com janela de fisgada, plantio/rega/colheita, construção consumindo recursos e armazenamento em baú. Fogueiras recuperam vida fora de combate; abrigo serve como ponto de recuperação.
- Salvamento validado em IndexedDB e recuperação após reload. Cache seletivo de produção testado sem rede após carregar a jornada online.
- Joystick e layout touch emulados em Edge, incluindo mudança de orientação.

## Limitações e trabalho restante

- Direção artística ainda abaixo das referências: relevo, silhueta inferior, arquitetura, céu e água necessitam refinamento substancial. A cachoeira é simplificada; não há reflexos planares, profundidade real da água ou efeitos volumétricos.
- Casas ainda são exteriores sólidos; interiores, taverna e oficinas acessíveis não foram implementados. Torre possui escada e terraço simplificados.
- NPCs de comércio/diálogo ficam em posições fixas. Não há rotinas diárias completas, navegação social ou moradores adicionais. Ovelhas e lobos têm IA local simples.
- Combate limitado a lobos: sem chefes, árvores de habilidades, distribuição de atributos, bloqueio ou balanceamento completo. Ataque corpo a corpo usa proximidade; projéteis ainda precisam de colisão com obstáculos.
- Inventário não possui arrastar/soltar, divisão de pilhas ou oito slots de equipamento. Comércio não limita estoque do vendedor. Crafting não exige estação.
- Construções têm modelos básicos, sem rotação de posicionamento. Agricultura usa um cultivo. Pesca não possui vara visível. Não há personalização de aparência.
- Ciclo de luz existe, mas clima, lua/estrelas, iluminação noturna regional, áudio ambiente espacial e trilha sonora permanecem pendentes. Áudio atual: efeitos procedurais curtos.
- Ainda faltam streaming regional, LOD por distância, descarte completo ao reiniciar jornadas e perfis gráficos mais completos. Texturas embutidas não são substituídas pelo resolvedor desktop/mobile.
- Um slot de jornada exposto na interface. Sem migração de versões anteriores, exportação ou recuperação de backup.
- Sem teste em aparelho Android real, Linux ou macOS. Emulação não comprova desempenho nesses dispositivos.
- Cadeia completa das seis missões ainda não foi jogada do início ao fim. Nenhuma publicação remota foi realizada.

## Evidências

- `asset-audit.json`: auditoria integral da biblioteca.
- `browser-check.json`: movimento, console, recursos e amostra de FPS.
- `integration-check.json`: nove cenários de integração aprovados, incluindo touch emulado; zero pageerrors.
- `life-check.json`: pesca, agricultura e construção/baú aprovados. O teste agrícola adianta o timestamp para validar maturidade sem esperar um minuto.
- `terrain-check.json`: caminhada com controlador físico por sete trechos e subida de aproximadamente 19,27 m na torre. Esse teste dirige o controlador por waypoints, não simula uma pessoa usando teclado.
- `offline-check.json`: recarregar e continuar offline aprovado, com cache de 25 entradas na execução registrada.
- `screenshots/`: capturas reais do navegador.

As amostras de desempenho ficam aproximadamente em 56–60 FPS no Edge headless desta máquina; não são benchmark prolongado nem medição em celular. O bundle Rapier permanece grande (cerca de 4,33 MB sem gzip), separado do código de renderização e aplicação. O build avisa sobre chunks maiores que 500 kB.
