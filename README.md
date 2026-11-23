# Auralis RPG v9 — Ilha flutuante

Primeira fundação 3D da ilha de Auralis, criada do zero a partir do desenho enviado: vila e comércio ao norte, criação de ovelhas e torre a leste, floresta nas laterais, lago no centro e montanha com cachoeira ao sul. O projeto usa Three.js e controles orbitais para computador e telas sensíveis ao toque.

## Abrir no Windows

1. Instale o Node.js 20.19 ou mais recente (ou 22.12 ou mais recente).
2. Abra um terminal nesta pasta e execute `npm install`.
3. Execute `npm run dev` e abra o endereço local que aparecer.

Para gerar uma versão estática, execute `npm run build`. Os arquivos finais ficam em `dist/`.

## Controles

- Arrastar com o mouse ou um dedo: girar a câmera.
- Roda do mouse ou pinça: aproximar e afastar.
- Botões de região: levar a câmera até a vila, o rebanho, o lago ou a montanha.
- “Reiniciar vista”: voltar à visão geral.

## Recursos

Os modelos e mapas de textura usados pelo projeto estão em `public/assets/`. As texturas de Poly Haven e os modelos CC0 de Kenney e Quaternius foram selecionados das pastas locais; as imagens de personagem foram reduzidas para 1K, e apenas dependências glTF necessárias foram incluídas. O modelo de ovelha foi extraído individualmente do pacote de criaturas. Os arquivos de origem grandes, arquivos Blender/FBX e pacotes ZIP não fazem parte do repositório.

Consulte [assets/CREDITS.md](assets/CREDITS.md) e os arquivos de licença junto aos modelos.
