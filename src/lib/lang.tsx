import { createContext, useContext } from 'react';
import zh from './copy.zh.json';
import en from './copy.en.json';
import type { Lang } from './i18n.ts';

export type Copy = typeof zh;
export const copies: Record<Lang, Copy> = { zh, en };

const LangContext = createContext<{ lang: Lang; c: Copy }>({ lang: 'zh', c: zh });
export const LangProvider = LangContext.Provider;
export const useLang = () => useContext(LangContext);
export const categoryLabels = (c: Copy) => ({ 'time-space': c.timeSpace, graphic: c.graphic, art: c.art });
