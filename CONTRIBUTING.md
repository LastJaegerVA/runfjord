# Contributing to Runfjord

Thanks for helping out! Bug reports, translation fixes and small improvements are all welcome.

## Getting started

```bash
npm install
npm start
```

Your development library lives in the same place as the installed app's
(`~/.config/Runfjord` or `%APPDATA%\Runfjord`), so export a backup first if you care about it.

## Fixing or adding a translation

Every language is one file in [`renderer/locales/`](renderer/locales). The keys are the same in every file;
only the text after the colon changes.

**Fix a mistake:** edit the text in your language's file and open a pull request.

**Add a language:**

1. Copy `renderer/locales/en.js` to `renderer/locales/<code>.js` (for example `pt-PT.js`).
2. Change the first line to your code and the language's own name: `I18N.register('pt-PT', 'Português (Portugal)', { … })`.
3. Translate every value. Keep placeholders such as `{n}`, `{name}`, `{cat}` and `{file}` exactly as they are, and keep HTML tags like `<br>`, `<b>` and `<code>`.
4. Add the code to `CODES` in [`renderer/i18n.js`](renderer/i18n.js) and a `<script src="locales/<code>.js">` line in [`renderer/index.html`](renderer/index.html).
5. If the language is written right to left, add it to `RTL` in `renderer/i18n.js`.
6. For the Windows installer, add it to the two tables in [`tools/gen-installer-langs.js`](tools/gen-installer-langs.js) (only if NSIS has that language).
7. Run `npm run check` — it reports missing keys and broken placeholders.

### Plurals

Keys ending in `_one` / `_other` are plural forms. If your language needs more forms, add them with the
[CLDR plural category names](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html):
`_zero`, `_two`, `_few`, `_many`. Runfjord picks the right one automatically. See `ru.js` or `pl.js` for examples.

## Code style

- Plain JavaScript, no framework, no build step for the interface.
- Two-space indentation (see `.editorconfig`).
- All text the user sees goes through `t('key')` — never hard-code English in the interface.
- Keep `contextIsolation` on and talk to the main process only through `preload.js`.

## Reporting bugs

Open an issue and include your operating system, Runfjord version (Settings shows it), what you did, and what
happened. For a script that fails to run, the text in the **Output** tab helps a lot.

By contributing, you agree that your contribution is released under the project's [MIT License](LICENSE).
