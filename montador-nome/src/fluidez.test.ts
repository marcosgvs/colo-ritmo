import { describe, it, expect } from 'vitest';
import { organizarPorFluidez } from './fluidez';

describe('organizarPorFluidez', () => {
  it('coloca o mais curto na frente e o resto em ordem decrescente', () => {
    // pesos: Silva 1, Garcia 2, Pinheiro 3, Vasconcellos 5
    expect(
      organizarPorFluidez(['Vasconcellos', 'Silva', 'Pinheiro', 'Garcia']),
    ).toEqual(['Silva', 'Vasconcellos', 'Pinheiro', 'Garcia']);
  });

  it('segue o exemplo de pesos [1,2,3,5] → [1,5,3,2]', () => {
    // pesos: Silva 1, Garcia 2, Barbosa 3, Vasconcellos 5
    expect(
      organizarPorFluidez(['Garcia', 'Barbosa', 'Silva', 'Vasconcellos']),
    ).toEqual(['Silva', 'Vasconcellos', 'Barbosa', 'Garcia']);
  });

  it('mantém a ordem quando há 0 ou 1 sobrenome', () => {
    expect(organizarPorFluidez([])).toEqual([]);
    expect(organizarPorFluidez(['Araújo'])).toEqual(['Araújo']);
  });
});
