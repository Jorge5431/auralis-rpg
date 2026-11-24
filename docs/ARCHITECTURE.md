# Arquitetura V10

O ponto de entrada novo importa exclusivamente `src/v10`. Nenhum módulo do jogo anterior é reutilizado. `PROMPT_MASTER.json` preserva a especificação recebida.

- **Terrain.ts**: ruído determinístico, ilha assimétrica de aproximadamente 400 × 500 m, máscaras de lago, montanhas e caminhos. A malha visual alimenta a colisão Rapier.
- **World.ts**: construções procedurais agrupadas por material; vegetação instanciada; margens, rio, cachoeira, nuvens e iluminação. Modelos de natureza da biblioteca e folhagem procedural complementar.
- **Assets.ts**: catálogo como lista autorizada, cache de promises, SkeletonUtils.clone, LoadingManager e redirecionamento de texturas externas desktop/mobile. Texturas embutidas de personagens permanecem originais.
- **Physics.ts**: mundo Rapier e cápsula cinemática, timestep de 1/60, gravidade, salto, degraus e colisores simplificados. Obstáculos estáticos compartilham posições com a geometria.
- **Navigation.ts**: A* em grade, bloqueando lago, borda, encostas íngremes e edificações; usado pelo clique/toque no terreno.
- **Actor.ts**: mixers independentes e transições entre clips existentes. Armas incluídas nos modelos de classe são preservadas.
- **State.ts**: dados de itens e missões; transações de comércio/crafting; progressão; validação e armazenamento versionado IndexedDB.
- **Input.ts**: teclado, órbita, toque, pinça e destinos de movimento.
- **Game.ts**: coordenação da simulação, interações, IA local, combate, projéteis, pesca, plantações, construção, salvamento e câmera.
- **UI.ts/style.css**: interface pt-BR e diálogos HTML, minimapa e touch.

## Recursos e distribuição

A biblioteca original é mantida em `public/assets`. Apenas recursos requisitados são carregados em runtime. A geração do build copia a biblioteca para `dist`, mas isso não significa que o navegador a transfira inteira. O cache offline inclui o shell e no máximo 80 requisições de recursos permitidos, após acesso. Não é feito preload de 665 MiB.

O service worker é gerado com identificação nova a cada build. Dados de salvamento ficam fora do cache de arquivos. O runtime usa URLs absolutas; hospedagem em subdiretório requer adaptação das URLs e do manifest.

## Evolução necessária

Separar os sistemas de gameplay atualmente coordenados por Game em módulos com eventos tipados; adicionar streaming por região, descarte explícito de entidades ao trocar jornadas, LOD por distância e armazenamento com múltiplos slots expostos na UI. Não tratar a existência de um arquivo como evidência de conclusão de uma fase.
