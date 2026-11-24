# Auralis RPG V10

Implementação nova em TypeScript, Three.js, Vite e Rapier, na branch `rebuild/auralis-v10`. A biblioteca e o código anterior permanecem preservados. A entrada ativa é `src/v10/main.ts`.

## Executar

Requisitos: Node.js 22.12+ ou 24, navegador com WebGL2.

```powershell
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Para validar a distribuição:

```powershell
npm run build
npm run preview
```

O build está em `dist/`. O deploy pressupõe a raiz do domínio. Nenhum deploy ou push remoto foi realizado.

## Jogar

Selecione Nova jornada, nome e classe. Converse com Helena na praça para iniciar as missões. O minimapa mostra vila (V), fazenda (F) e torre (T).

- WASD/setas: mover; Shift: correr; Espaço: saltar.
- Arrastar: girar câmera; roda/dois dedos: zoom; clique/toque no chão: percurso por grade.
- E: conversar, coletar, recolher lã, pescar ou confirmar construção.
- F: ataque; Q: habilidade (cura para clérigo, dano aumentado nas outras classes); R: esquiva.
- I: mochila; J: missões; C: receitas; B: construção; M/V: visão aérea.
- G: plantar na fazenda; H: regar e colher após 60 segundos.
- Esc: fechar menu ou cancelar construção.
- Controles touch oferecem movimento, câmera e ações; os botões G/H correspondem à agricultura.

O progresso é salvo manualmente pelo botão Salvar e automaticamente a cada 30 segundos. IndexedDB armazena a jornada neste navegador e nesta origem. Não limpe os dados do site se quiser preservá-la. Preferências de áudio/qualidade usam localStorage.

## Verificar

```powershell
npm run audit
npm test
npm run test:browser
node scripts/integration-check.mjs
```

Os testes de navegador usam Microsoft Edge instalado no caminho padrão do Windows e requerem o servidor local na porta 5173. Relatórios e capturas ficam em `docs/`.

## Estado da entrega

Esta é uma versão jogável em desenvolvimento, **não a implementação completa dos critérios do PROMPT_MASTER V10**. Ela possui terreno explorável, seis classes, física, animações, NPCs, combate com lobos, recursos, inventário, comércio, seis missões sequenciais, receitas, pesca, agricultura, construção básica e salvamento. Os sistemas e as limitações são descritos em [docs/STATUS.md](docs/STATUS.md). A qualidade visual ainda não equivale às referências artísticas anexadas.

Créditos e condições de distribuição: [assets/CREDITS.md](assets/CREDITS.md). As imagens de referência privadas, os recursos excluídos e HDRIs de procedência ainda não confirmada não foram incorporados ao runtime novo.
