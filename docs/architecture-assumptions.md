# Architekturannahmen und fachliche Grenzen

Dieses Modell ist eine Gesprächsskizze für Workshops. Es bildet ausgewählte Zusammenhänge ab, nicht alle unterstützten VMware-Topologien. Generische VCF-/VKS-Beispiele sind **keine offiziell abgenommenen Mustervorlagen** und keine Deployment-Empfehlung.

## Begriffe und Darstellung

- **Fleet → Instanz → Domain:** Eine VCF Fleet umfasst eine oder mehrere VCF Instances und gegebenenfalls eigenständige vCenter-Instanzen. Eine VCF Instance enthält eine Management Domain und optional weitere Workload Domains. Fleet-weite Managementkomponenten und Domain-Komponenten sind unterschiedliche Ebenen.[1]
- **Zuständigkeit ist nicht Hosting:** Ein vCenter oder NSX Manager kann eine Workload Domain verwalten, während seine Appliance in der Management Domain läuft. Ein farbiger Rahmen zeigt einen logischen Scope; er beweist weder VM-Platzierung noch physische oder sicherheitstechnische Isolation.[1] Im Workshop Zuständigkeit und Hosting ausdrücklich getrennt beschriften.
- **VKS heißt vSphere Kubernetes Service.** Der Service auf Supervisor verwaltet den Lebenszyklus von Kubernetes-Workloadclustern; Supervisor ist nicht der VKS-Workloadcluster.[2]
- **vSphere Namespace ≠ Kubernetes-Namespace eines Workloadclusters:** Der vSphere Namespace ist eine Ressourcen-/Zugriffsgrenze auf Supervisor; Namespaces innerhalb eines VKS-Clusters liegen auf einer anderen Ebene.[2] Ähnliche Namen bedeuten keine Identität und keine automatische Übernahme von Policies.
- **Supervisor kann mehrere vSphere-Zonen/Cluster umfassen:** Eine Skizze mit nur einem Cluster ist eine Vereinfachung, keine allgemeine Einschränkung der Plattform.[2]

## Versionsabhängigkeit statt harter Universalregeln

Die Dokumentprofile `unspecified`, `vcf-9.0` und `vcf-9.1` sind Kontextangaben, keine geprüften Kompatibilitätsmatrizen. Versionen einzelner Komponenten und Notizen müssen für die tatsächliche Umgebung ergänzt werden.

- **Management-Anzahlen:** `config.instances` ist eine Workshopangabe. Daraus folgt keine Aussage über zulässige Appliance-Anzahlen, Quorum, HA oder unterstützte Installationsvarianten. Anforderungen hängen vom konkreten Produkt, Release und Deploymentmodell ab und müssen separat geprüft werden.
- **NSX Edge nicht pauschal erzwingen:** Die VCF-9.0-Taxonomie führt Edge-Cluster als optionalen, bedarfsabhängigen Domain-Bestandteil auf.[1] Für Supervisor mit VPC in VCF 9.1 unterscheidet die Dokumentation verteilte und zentrale Anbindungen: zentral über Tier-0 mit Edge-Cluster; verteilt ohne Edge-Nodes, jedoch mit VNA-Cluster für Supervisor.[3] Ein fehlender Edge-Baustein ist daher nicht automatisch ein Architekturfehler. VNA, VPC und Transit Gateway sind im aktuellen Vertrag nicht als eigene Komponententypen enthalten; generische Netzwerkbausteine ersetzen deren Detailplanung nicht.
- **Keine Validatorgarantie:** Hinweise können nur ausgewählte Modellmuster erkennen. Keine vollständige Prüfung von Netzdesign, Storage, DNS/NTP, Zertifikaten, Kapazität, Verfügbarkeit, Lizenzen, Security, Upgradepfaden oder Hersteller-Support. Fehlende Warnungen sind kein Freigabenachweis.

## Technischer Modellvertrag

Maßgeblich ist [`src/contracts.ts`](../src/contracts.ts):

- `ArchitectureDocument` hat `schemaVersion: 1`, ID, Titel, Profil, Modus (`as-is`, `to-be`, `sandbox`), Knoten und Kanten.
- `ArchitectureNode` speichert Komponententyp, Bezeichnung, Position, optional `parentId` und Größe sowie Version, Anzahl und Notizen. `parentId` modelliert die visuelle/logische Einordnung, nicht automatisch den physischen Ausführungsort.
- Beziehungen sind `contains`, `manages`, `runs-on`, `uses-network`, `uses-storage` oder `connects`. Der Kantentyp drückt die beabsichtigte Beziehung aus; er löst keine Infrastrukturaktion aus.
- Persistierte Daten sind unabhängig von React-Flow-Interna. Die statische Browseranwendung verwendet lokale Speicherung und manuellen JSON-Import/-Export; keine automatische Inventarisierung oder Synchronisation mit der Infrastruktur.

**Praktische Abnahme:** Begriffe, logische Einordnung und tatsächliches Hosting gemeinsam durchgehen; Versionsprofil und offene Annahmen notieren; JSON-Roundtrip und Seiten-Neuladen testen. Das Ergebnis bleibt ein Workshopartefakt, bis ein verantwortlicher Architekt es anhand der konkreten Releases und Anforderungen geprüft hat.

## Sources

[1] https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/overview-of-vmware-cloud-foundation-9/workload-domains-in-vmware-cloud-foundation.html
[2] https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-service-administration-and-development/9-0/managing-vsphere-kubernetes-service/running-tkg-service-clusters/tkg-service-components.html
[3] https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/vsphere-supervisor-installation-and-configuration/supervisor-networking-with-virtual-private-clouds/supervisor-architecture-with-vpc-networking.html
