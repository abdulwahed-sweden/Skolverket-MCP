/**
 * Ämnesuppslagning — den punkt där ett tyst fel blir farligt.
 *
 * Ali läser Svenska som andraspråk. Löser "svenska som andraspråk" upp till
 * GRGRSVE01 i stället för GRGRSVA01 får han giltig men fel läroplan, utan att
 * något felmeddelande syns. Det är just den mappningen som testas här.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSubject,
  stageForGrade,
  gradesInStage,
  ACCEPTED_SUBJECT_ALIASES,
  MissingSubjectError,
  UnknownSubjectError,
} from '../../src/tutor/subjects.js';

describe('Svenska som andraspråk löses upp till GRGRSVA01', () => {
  // Stavningen användaren faktiskt skriver, med mellanslag och å.
  it('accepterar "svenska som andraspråk"', () => {
    const s = resolveSubject('svenska som andraspråk');
    expect(s.code).toBe('GRGRSVA01');
    expect(s.key).toBe('svenska_som_andrasprak');
    expect(s.label).toBe('Svenska som andraspråk');
  });

  it.each([
    'svenska som andraspråk',
    'Svenska som andraspråk',
    'SVENSKA SOM ANDRASPRÅK',
    '  svenska   som   andraspråk  ',
    'svenska som andrasprak',
    'svenska_som_andrasprak',
    'svenska_som_andraspråk',
    'sva',
    'SVA',
    'GRGRSVA01',
    'grgrsva01',
  ])('löser "%s" till GRGRSVA01', (alias) => {
    expect(resolveSubject(alias).code).toBe('GRGRSVA01');
  });
});

describe('Svenska löses upp till GRGRSVE01', () => {
  it.each(['svenska', 'Svenska', ' SVENSKA ', 'sv', 'GRGRSVE01'])(
    'löser "%s" till GRGRSVE01',
    (alias) => {
      expect(resolveSubject(alias).code).toBe('GRGRSVE01');
    }
  );
});

describe('de två ämnena blandas aldrig ihop', () => {
  it('ger olika ämneskoder', () => {
    const sve = resolveSubject('svenska');
    const sva = resolveSubject('svenska som andraspråk');
    expect(sve.code).not.toBe(sva.code);
    expect(sve.code).toBe('GRGRSVE01');
    expect(sva.code).toBe('GRGRSVA01');
  });

  it('låter inte "svenska" fånga upp SVA-stavningarna', () => {
    // "svenska som andraspråk" börjar med "svenska"; en prefixmatchning skulle
    // ge fel ämne. Uppslagningen är exakt, inte prefixbaserad.
    for (const alias of ACCEPTED_SUBJECT_ALIASES) {
      const code = resolveSubject(alias).code;
      const isSvaSpelling = /andrasp|^sva$|sva01/i.test(alias);
      expect(code).toBe(isSvaSpelling ? 'GRGRSVA01' : 'GRGRSVE01');
    }
  });
});

describe('inga gissningar', () => {
  it('kastar när ämnet saknas i stället för att välja ett', () => {
    expect(() => resolveSubject(undefined)).toThrow(MissingSubjectError);
    expect(() => resolveSubject(null)).toThrow(MissingSubjectError);
    expect(() => resolveSubject('')).toThrow(MissingSubjectError);
    expect(() => resolveSubject('   ')).toThrow(MissingSubjectError);
    expect(() => resolveSubject(undefined)).toThrow(/giltig men fel läroplan/);
  });

  it('kastar på okänt ämne i stället för att närmaste-matcha', () => {
    for (const bad of ['matematik', 'engelska', 'svensk', 'andraspråk', 'sv2', 'GRGRMAT01']) {
      expect(() => resolveSubject(bad), bad).toThrow(UnknownSubjectError);
    }
  });

  it('räknar upp de accepterade värdena i felet', () => {
    expect(() => resolveSubject('matematik')).toThrow(/svenska som andraspråk/);
  });
});

describe('stadium härleds ur årskurs', () => {
  it.each([
    [1, '1-3'],
    [3, '1-3'],
    [4, '4-6'],
    [5, '4-6'],
    [6, '4-6'],
    [7, '7-9'],
    [9, '7-9'],
  ])('årskurs %i ligger i stadiet %s', (grade, stage) => {
    expect(stageForGrade(grade)).toBe(stage);
  });

  it('kastar för årskurser utanför grundskolan', () => {
    for (const g of [0, 10, -1, 13]) {
      expect(() => stageForGrade(g), String(g)).toThrow(/finns inte i grundskolan/);
    }
  });

  it('räknar upp stadiets årskurser', () => {
    expect(gradesInStage('4-6')).toEqual([4, 5, 6]);
    expect(gradesInStage('okänt')).toEqual([]);
  });
});
