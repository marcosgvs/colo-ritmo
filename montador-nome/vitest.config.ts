import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ignora os arquivos AppleDouble ("._*") que este volume cria sozinho.
    exclude: [...configDefaults.exclude, '**/._*'],
  },
});
