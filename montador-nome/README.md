# Montador de nome

Ferramentinha local pra montar o nome completo da bebê: escolhe um primeiro
nome, liga os sobrenomes das duas famílias e arrasta pra reordenar. Tudo em
memória, sem backend — vive isolada num subdiretório e **não entra no deploy do
colo-ritmo**.

## Rodar

```bash
cd montador-nome
npm install
npm run dev
```

Abre o endereço que o Vite mostrar (geralmente http://localhost:5173).

## Outros comandos

- `npm test` — testa o algoritmo "organizar por fluidez".
- `npm run build` — type-check + build de produção (opcional, não é usado pra subir).

## Como funciona

- **Primeiro nome**: chips por categoria (seleção única) ou campo "ou digite".
- **Sobrenomes**: chips liga/desliga, com cor por lado (lado 1 verde-azulado,
  lado 2 roxo). Tocar adiciona à ordem; tocar de novo remove.
- **Ordem**: lista arrastável (mouse, toque e teclado, via `@dnd-kit`). Cada
  item tem alça de arraste e × para remover; a numeração se atualiza sozinha.
- **Organizar por fluidez**: reordena para um fluxo sonoro curto → longo →
  médio → curto (o mais curto na frente, o resto em ordem decrescente de peso).
