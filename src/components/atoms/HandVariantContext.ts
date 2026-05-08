import { createContext } from 'react';
import type { HandVariant } from '@/types';

export const HandVariantContext = createContext<HandVariant>('italic');
