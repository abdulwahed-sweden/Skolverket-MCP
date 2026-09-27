# exports/

Ögonblicksbilder av vad handledarverktygen returnerar, för inspektion och
referens.

**De är inte en sanningskälla.** Sanningen är Skolverkets API, hämtat live via
`get_tutor_teaching_context`. Läs aldrig en fil härifrån i körande kod, och
redigera aldrig en för hand — då börjar två versioner av läroplanen leva
parallellt, och den här filen är den som blir inaktuell.

Filerna byggs aldrig manuellt. De genereras genom ett riktigt `tools/call` mot
MCP-servern över stdio, så innehållet är exakt det en klient får:

```
npm run export:teaching-context
```

`provenance.retrievedForDate` i varje fil anger när ögonblicksbilden togs.

| Fil | Anrop |
| --- | --- |
| `GRGRSVA01-4-6.json` | `get_tutor_teaching_context { subjectCode: "GRGRSVA01", stage: "4-6", grade: 5 }` |
