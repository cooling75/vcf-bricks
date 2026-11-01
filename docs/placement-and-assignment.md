# Platzieren und Zuordnen

Diese Iteration konzentriert sich auf Bausteine und ihre logische Zuordnung. Kommunikationsbeziehungen sind nachrangig; vorhandene JSON-Verbindungen bleiben erhalten. Dark Mode, neue NSX-/VNA-Objekte und individuell einstellbare Schriftgrößen sind separate Folgeschritte.

## Baustein hinzufügen

- Unter **Einfügen in** einen Rahmen oder die freie Baufläche wählen. Der vollständige Pfad macht verschachtelte Ziele unterscheidbar.
- Ein Klick auf einen Katalogeintrag fügt den Baustein auf einem freien Platz im gewählten Ziel ein und fokussiert ihn.
- Alternativ den Baustein aus dem Katalog auf die Baufläche ziehen. Der hervorgehobene Rahmen zeigt das tatsächliche Ablageziel. Bei verschachtelten Rahmen wird der innerste getroffene Rahmen gewählt.
- Ein Drop auf die freie Baufläche fügt ohne übergeordneten Rahmen ein, unabhängig vom zuvor ausgewählten Einfügeziel.
- Beim Auswählen eines Rahmens wird er zum Einfügeziel; beim Auswählen einer Komponente wird ihr Rahmen zum Ziel. Das Ziel ist jederzeit separat änderbar.

## Bestehenden Baustein zuordnen

- Eine Komponente in einen anderen Rahmen ziehen. Der Zielrahmen wird während der Bewegung hervorgehoben. Außerhalb aller Rahmen wird sie auf die freie Baufläche verschoben.
- Alternativ unter **Zugehöriger Rahmen** das neue Ziel wählen. Der Baustein erhält dort einen freien Platz und wird fokussiert.
- Eigene Unterrahmen können nicht als Ziel einer übergeordneten Gruppe gewählt werden. Beim Verschieben eines Rahmens bleiben seine enthaltenen Bausteine relativ zu ihm erhalten.
- **Rückgängig** und **Wiederholen** behandeln Position und Zuordnung als eine gemeinsame Änderung.
- Neue Rahmen sind kompakter als zuvor und wachsen bei Bedarf für ihre Inhalte. Bestehende/importierte Rahmen werden nicht pauschal umgebaut.

## Übersicht

- **Struktur** zeigt einen aufklappbaren Baum. Auswahl im Baum fokussiert das Element auf der Baufläche.
- **Alles einpassen**, **Auswahl fokussieren** und **100 %** wechseln zwischen Überblick und Bearbeitung.
- Rahmen haben größere Beschriftungen und eine breitere Griffzone. Die Schriftgröße ist in diesem Schritt noch nicht individuell konfigurierbar.
- Kommunikationsbeziehungen sind in den Eigenschaften unter **Kommunikationsbeziehungen (optional)** eingeklappt. Bestehende Linien werden weiterhin angezeigt und unverändert exportiert.

Die logische Zuordnung ist keine Aussage über physisches Hosting oder eine offizielle Architekturvalidierung. Touch-Benutzer können das Einfügeziel, Katalogklick und den Eigenschafteneditor verwenden; Katalog-Drag-and-drop nutzt die native Desktop-HTML-Drag-API.
