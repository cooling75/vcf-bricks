# vcf-bricks

Browser-Workshoptool zum gemeinsamen Skizzieren von VMware Cloud Foundation (VCF) und vSphere Kubernetes Service (VKS): Bausteine, Beziehungen und schlichte farbige Rahmen für Fleet, Instanz und Domains. Gedacht für Architekturgespräche und Messe-Demos, nicht für Produktionsplanung oder automatisierte Bereitstellung.

**Stand:** benutzbarer MVP, veröffentlicht unter **https://cooling75.github.io/vcf-bricks/**. Typecheck, 56 Unit-Tests und 6 Chromium-Browsertests erfolgreich; die Browsertests wurden zusätzlich direkt gegen die veröffentlichte Seite ausgeführt. Beispiele sind generische Gesprächsgrundlagen, keine offiziell abgenommenen Mustervorlagen.

## Platzieren und Zuordnen (diese Änderung)

Explizites Einfügeziel, Katalog-Drag-and-drop mit Zielvorschau, Umordnen durch Ziehen oder Eigenschaftenauswahl und ein aufklappbarer Strukturbaum vereinfachen den Aufbau. Bestehende Kommunikationsbeziehungen bleiben erhalten, ihre Werkzeuge sind standardmäßig eingeklappt. Details und Bedienwege: [Platzieren und Zuordnen](docs/placement-and-assignment.md).

Die Onlinevariante benötigt keine Nachbildung der physischen Messe-Musterlösung. Dark Mode, eine geprüfte Katalogerweiterung und individuell einstellbare Rahmen-Schriftgrößen sind nicht Teil dieser Änderung.

## Lokal starten

Voraussetzungen: Node.js **24** (wie in CI), npm und das eingecheckte `package-lock.json`.

```sh
npm ci
npm run dev
```

Die vom Terminal angezeigte Adresse mit dem Pfad **`/vcf-bricks/`** öffnen. Die Dev-/Preview-Skripte binden an `0.0.0.0`; für ausschließlich lokalen Zugriff beispielsweise `npm run dev -- --host 127.0.0.1` verwenden.

```sh
npm run typecheck
npm run test:run
npm run build
npx --no-install playwright install --with-deps chromium
npm run test:e2e -- --project=chromium
npm run preview -- --host 127.0.0.1
```

Die Browsertests bauen die Anwendung und starten ihre Produktionsvorschau selbst auf Port 4174. Die Produktionsvorschau separat unter `http://127.0.0.1:4173/vcf-bricks/` prüfen. Auf Linux kann die Installation der Browser-Systempakete Administratorrechte benötigen.

## Vor einer Demo abnehmen

- [ ] Generisches VCF- und VKS-Beispiel öffnen; Fleet-/Instanz-/Domain-Grenzen und Begriffe fachlich prüfen.
- [ ] Bausteine hinzufügen, verschieben, bearbeiten, verbinden und löschen; Zoom und Auswahl testen.
- [ ] Neu laden: lokales Dokument bleibt erhalten. JSON exportieren, wieder importieren und Inhalt vergleichen; ungültige JSON-Datei darf den aktuellen Entwurf nicht zerstören.
- [ ] Produktionsvorschau unter `/vcf-bricks/`: keine fehlenden Assets oder Fehler in der Browserkonsole; Layout auch auf dem vorgesehenen Messebildschirm prüfen.
- [ ] Lokale Daten nach der Demo entfernen und durch Neuladen kontrollieren; keine Kundendaten oder Screenshots im Repository ablegen.

Diese manuelle Abnahme ergänzt Unit- und Browsertests. Architekturhinweise sind keine Support-, Kompatibilitäts-, Sizing- oder Vollständigkeitsgarantie; siehe [Annahmen und Grenzen](docs/architecture-assumptions.md).

## Daten und Grenzen

Die Anwendung ist als statische React-/TypeScript-/Vite-App mit `@xyflow/react` aufgebaut. Entwürfe werden lokal im Browser (`localStorage`) gehalten; JSON dient dem manuellen Austausch. Kein App-Backend, keine Live-Anbindung an VCF/vCenter und keine Anwendungstelemetrie vorgesehen.

**Lokaler Speicher ist nicht verschlüsselt.** Browserprofil, Erweiterungen und andere Benutzer desselben Profils können ein Risiko darstellen. JSON-Exporte sind ebenfalls Klartext. Keine Zugangsdaten, Kundennamen oder realen Infrastrukturdetails in Demos verwenden. Der Hostinganbieter verarbeitet beim Abruf der Seite übliche technische Zugriffsdaten; „keine Anwendungstelemetrie“ bedeutet nicht „keine Provider-Logs“.

Auf gemeinsam genutzten Geräten nach dem Workshop die Website-/Speicherdaten für die verwendete Origin über die Browser-Einstellungen oder Entwicklertools löschen, neu laden und zusätzlich heruntergeladene JSON-Dateien entfernen. Browserdaten sind an die Origin gebunden, nicht nur an `/vcf-bricks/`: Das Löschen kann weitere Apps derselben Origin betreffen. Ein Export ist ein manuelles Backup; lokale Speicherung ersetzt kein Backup.

## CI und Hosting

- `ci.yml`: Pull Requests auf `main` und Pushes nach `main`; Node 24, `npm ci`, Typecheck, Unit-Tests, Build und Playwright/Chromium. **Keine Veröffentlichung.**
- `pages.yml`: Push nach `main` oder manueller Start auf `main`; eigener Typecheck-/Unit-Test-/Build-Gate, danach separater Deploymentjob. Auch die Chromium-Browsertests gegen den Produktionsbuild müssen vor jeder Veröffentlichung erfolgreich sein.
- Actions sind auf überprüfte Release-Commit-SHAs gepinnt. Nur der Deploymentjob erhält `pages: write` und `id-token: write`; PR-Code erhält keine Deploymentrechte.

Liveadresse: **https://cooling75.github.io/vcf-bricks/**. Pages verwendet **GitHub Actions**; das Environment `github-pages` erlaubt nur `main`. Nach Änderungen die Zieladresse inklusive Neuladen und JSON-Roundtrip prüfen. Für die gleiche automatisierte Abnahme gegen die veröffentlichte Seite: `PLAYWRIGHT_BASE_URL=https://cooling75.github.io/vcf-bricks/ npm run test:e2e`. Es wird nur `dist/` veröffentlicht. Der Vite-Basispfad ist `/vcf-bricks/`; bei Umbenennung oder anderer Hosting-URL muss er geprüft werden.

Hinweise zum Hosting: [GitHub Pages mit eigenen Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Projektstatus und Rechte

Unabhängiges Workshopprojekt, kein offizielles Produkt und keine Freigabe durch Broadcom, VMware oder SVA. Produktnamen dienen nur der fachlichen Einordnung; keine offiziellen Logos oder Partneraussagen. Eine Projektlizenz ist noch nicht festgelegt; aus dem öffentlichen Repository folgt keine pauschale Nutzungserlaubnis. Vor Weitergabe oder produktivem Einsatz Rechte und Freigaben klären.
